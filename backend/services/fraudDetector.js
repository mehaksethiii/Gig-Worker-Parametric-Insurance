/**
 * fraudDetector.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Multi-signal fraud detection engine with XAI (Explainable AI) output.
 *
 * Checks:
 *  1. Burst claims        — 2+ claims in 1 hour
 *  2. Location mismatch   — rider city ≠ weather city
 *  3. Payout abuse        — 5+ payouts OR ₹3000+ in 7 days
 *  4. Claim velocity      — 3+ claims in 7 days
 *  5. Missing trigger data
 *  6. Abnormal amount     — claim > 2× rider's average payout
 *  7. Time-of-day anomaly — claim at unusual hours (1–4 AM)
 *  8. Duplicate GPS       — same GPS coords as another rider's recent claim
 *
 * Returns:
 *   { flags, isFraud, severity, trustScore, xaiExplanation, signals }
 * ─────────────────────────────────────────────────────────────────────────────
 */

'use strict';

const Claim  = require('../models/Claim');
const Payout = require('../models/Payout');

// ── Thresholds ────────────────────────────────────────────────────────────────
const BURST_WINDOW_MS        = 60 * 60 * 1000;
const BURST_LIMIT            = 2;
const PAYOUT_ABUSE_DAYS      = 7;
const PAYOUT_ABUSE_MAX_COUNT = 5;
const PAYOUT_ABUSE_MAX_TOTAL = 3000;
const VELOCITY_DAYS          = 7;
const VELOCITY_LIMIT         = 3;
const ABNORMAL_MULTIPLIER    = 2.5;   // flag if claim > 2.5× avg payout
const NIGHT_HOURS_START      = 1;     // 1 AM
const NIGHT_HOURS_END        = 4;     // 4 AM
const GPS_DUPLICATE_RADIUS_M = 50;    // metres

function normaliseCity(city = '') {
  return city.toLowerCase().replace(/[^a-z0-9 ]/g, '').trim();
}

// ── Individual checks ─────────────────────────────────────────────────────────

async function checkBurstClaims(riderId) {
  const since = new Date(Date.now() - BURST_WINDOW_MS);
  const count = await Claim.countDocuments({
    riderId,
    createdAt: { $gte: since },
    status:    { $nin: ['rejected'] },
  });
  if (count >= BURST_LIMIT) {
    return {
      flag:   `Burst claims: ${count} claim(s) in the last hour (limit: ${BURST_LIMIT})`,
      signal: 'burst_claims',
      score:  -30,
      detail: `${count} claims submitted within 60 minutes — possible automated abuse`,
    };
  }
  return null;
}

function checkLocationMismatch(riderCity, weatherCity) {
  if (!weatherCity) return null;
  const a = normaliseCity(riderCity);
  const b = normaliseCity(weatherCity);
  if (!a || !b) return null;
  if (a === b || a.includes(b) || b.includes(a)) return null;
  return {
    flag:   `Location mismatch: rider in "${riderCity}" but weather data for "${weatherCity}"`,
    signal: 'location_mismatch',
    score:  -35,
    detail: `Rider's registered city does not match the weather API city — possible GPS spoofing`,
  };
}

async function checkPayoutAbuse(riderId) {
  const since = new Date(Date.now() - PAYOUT_ABUSE_DAYS * 86400000);
  const recentPayouts = await Payout.find({
    riderId,
    createdAt: { $gte: since },
    status:    { $in: ['completed', 'processing', 'pending'] },
  });
  if (recentPayouts.length >= PAYOUT_ABUSE_MAX_COUNT) {
    return {
      flag:   `Payout abuse: ${recentPayouts.length} payouts in ${PAYOUT_ABUSE_DAYS} days (limit: ${PAYOUT_ABUSE_MAX_COUNT})`,
      signal: 'payout_abuse_count',
      score:  -30,
      detail: `Unusually high payout frequency — ${recentPayouts.length} payouts in 7 days`,
    };
  }
  const total = recentPayouts.reduce((s, p) => s + p.amount, 0);
  if (total >= PAYOUT_ABUSE_MAX_TOTAL) {
    return {
      flag:   `Payout abuse: ₹${total} paid in ${PAYOUT_ABUSE_DAYS} days (limit: ₹${PAYOUT_ABUSE_MAX_TOTAL})`,
      signal: 'payout_abuse_amount',
      score:  -25,
      detail: `Total payout ₹${total} exceeds ₹${PAYOUT_ABUSE_MAX_TOTAL} threshold in 7 days`,
    };
  }
  return null;
}

async function checkClaimVelocity(riderId) {
  const since = new Date(Date.now() - VELOCITY_DAYS * 86400000);
  const count = await Claim.countDocuments({
    riderId,
    createdAt: { $gte: since },
    status:    { $nin: ['rejected'] },
  });
  if (count >= VELOCITY_LIMIT) {
    return {
      flag:   `High claim frequency: ${count} claims in ${VELOCITY_DAYS} days (limit: ${VELOCITY_LIMIT})`,
      signal: 'claim_velocity',
      score:  -15,
      detail: `${count} claims in 7 days — above normal frequency for this plan`,
    };
  }
  return null;
}

function checkMissingTriggerData(triggerData) {
  const hasTemp     = triggerData?.temperature != null;
  const hasAqi      = triggerData?.aqi         != null;
  const hasRainfall = triggerData?.rainfall     != null;
  if (!hasTemp && !hasAqi && !hasRainfall) {
    return {
      flag:   'Missing environmental trigger data (no temperature, AQI, or rainfall)',
      signal: 'missing_trigger_data',
      score:  -10,
      detail: 'Claim submitted without any weather readings — cannot verify parametric trigger',
    };
  }
  return null;
}

async function checkAbnormalAmount(riderId, amount) {
  const d90 = new Date(Date.now() - 90 * 86400000);
  const payouts = await Payout.find({
    riderId,
    createdAt: { $gte: d90 },
    status:    'completed',
  }).lean();

  if (payouts.length < 3) return null; // not enough history

  const avg = payouts.reduce((s, p) => s + p.amount, 0) / payouts.length;
  if (amount > avg * ABNORMAL_MULTIPLIER) {
    return {
      flag:   `Abnormal claim amount: ₹${amount} is ${(amount / avg).toFixed(1)}× the rider's average (₹${Math.round(avg)})`,
      signal: 'abnormal_amount',
      score:  -20,
      detail: `Claim amount significantly higher than historical average — possible inflated claim`,
    };
  }
  return null;
}

function checkTimeOfDayAnomaly() {
  const hour = new Date().getHours();
  if (hour >= NIGHT_HOURS_START && hour < NIGHT_HOURS_END) {
    return {
      flag:   `Time-of-day anomaly: claim submitted at ${hour}:00 (unusual hours ${NIGHT_HOURS_START}–${NIGHT_HOURS_END} AM)`,
      signal: 'time_anomaly',
      score:  -10,
      detail: `Claims between 1–4 AM are statistically rare for delivery workers — flagged for review`,
    };
  }
  return null;
}

async function checkDuplicateGPS(riderId, triggerData) {
  if (!triggerData?.gpsLat || !triggerData?.gpsLon) return null;

  const since = new Date(Date.now() - 30 * 60 * 1000); // last 30 min
  const recentClaims = await Claim.find({
    riderId:              { $ne: riderId },
    createdAt:            { $gte: since },
    'validation.gpsLat':  { $exists: true },
    'validation.gpsLon':  { $exists: true },
  }).lean();

  const { gpsLat: lat1, gpsLon: lon1 } = triggerData;
  const R = 6371000; // metres

  const duplicate = recentClaims.find(c => {
    const lat2 = c.validation.gpsLat;
    const lon2 = c.validation.gpsLon;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2)**2 + Math.cos(lat1 * Math.PI/180) * Math.cos(lat2 * Math.PI/180) * Math.sin(dLon/2)**2;
    const dist = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return dist < GPS_DUPLICATE_RADIUS_M;
  });

  if (duplicate) {
    return {
      flag:   `Duplicate GPS: another rider submitted a claim from the same location within 30 minutes`,
      signal: 'duplicate_gps',
      score:  -15,
      detail: `GPS coordinates match another recent claim — possible coordinated fraud`,
    };
  }
  return null;
}

// ── Severity classifier ───────────────────────────────────────────────────────
const HIGH_SEVERITY_SIGNALS = ['burst_claims', 'location_mismatch', 'payout_abuse_count', 'payout_abuse_amount'];

function classifySeverity(results) {
  const signals = results.filter(Boolean).map(r => r.signal);
  if (signals.length === 0) return 'none';
  const isHigh = signals.some(s => HIGH_SEVERITY_SIGNALS.includes(s));
  return isHigh ? 'high' : 'low';
}

// ── Trust score (0–100) ───────────────────────────────────────────────────────
function computeTrustScore(results) {
  const totalDeduction = results.filter(Boolean).reduce((s, r) => s + Math.abs(r.score), 0);
  return Math.max(0, 100 + results.filter(Boolean).reduce((s, r) => s + r.score, 0));
}

// ── XAI explanation builder ───────────────────────────────────────────────────
function buildXAIExplanation(results, severity, trustScore) {
  const triggered = results.filter(Boolean);
  const passed    = [
    'burst_claims', 'location_mismatch', 'payout_abuse_count', 'payout_abuse_amount',
    'claim_velocity', 'missing_trigger_data', 'abnormal_amount', 'time_anomaly', 'duplicate_gps',
  ].filter(sig => !triggered.find(r => r.signal === sig));

  return {
    verdict:    severity === 'high' ? 'BLOCKED' : severity === 'low' ? 'FLAGGED_FOR_REVIEW' : 'APPROVED',
    trustScore,
    summary:    severity === 'none'
      ? `All ${passed.length} fraud checks passed. Claim approved automatically.`
      : `${triggered.length} of ${triggered.length + passed.length} checks failed. ${severity === 'high' ? 'Payout blocked.' : 'Flagged for manual review.'}`,
    failedChecks: triggered.map(r => ({
      signal:  r.signal,
      flag:    r.flag,
      detail:  r.detail,
      impact:  r.score,
    })),
    passedChecks: passed.map(sig => ({
      signal: sig,
      result: 'PASS',
    })),
    recommendation: severity === 'high'
      ? 'Payout blocked. Manual review required before any transfer.'
      : severity === 'low'
      ? 'Payout allowed but claim flagged for manual review within 24 hours.'
      : 'Proceed with automatic payout.',
  };
}

// ── Main export ───────────────────────────────────────────────────────────────
async function runFraudChecks({ riderId, riderCity, triggerData, amount, maxPayout }) {
  // Run all async checks in parallel
  const [burst, abuse, velocity, abnormal, dupGPS] = await Promise.all([
    checkBurstClaims(riderId),
    checkPayoutAbuse(riderId),
    checkClaimVelocity(riderId),
    checkAbnormalAmount(riderId, amount),
    checkDuplicateGPS(riderId, triggerData),
  ]);

  // Sync checks
  const locResult     = checkLocationMismatch(riderCity, triggerData?.city);
  const missingResult = checkMissingTriggerData(triggerData);
  const timeResult    = checkTimeOfDayAnomaly();

  const allResults = [burst, abuse, velocity, locResult, missingResult, abnormal, timeResult, dupGPS];
  const triggered  = allResults.filter(Boolean);

  const flags      = triggered.map(r => r.flag);
  const severity   = classifySeverity(allResults);
  const isFraud    = severity === 'high';
  const trustScore = computeTrustScore(allResults);
  const xaiExplanation = buildXAIExplanation(allResults, severity, trustScore);
  const signals    = allResults.map(r => r ? { signal: r.signal, passed: false, detail: r.detail } : null).filter(Boolean);

  if (flags.length > 0) {
    console.warn(`🚨 [FraudDetector] rider=${riderId} severity=${severity} trustScore=${trustScore} flags=[${flags.join(' | ')}]`);
  } else {
    console.log(`✅ [FraudDetector] rider=${riderId} trustScore=${trustScore} — all checks passed`);
  }

  return { flags, isFraud, severity, trustScore, xaiExplanation, signals };
}

module.exports = { runFraudChecks };
