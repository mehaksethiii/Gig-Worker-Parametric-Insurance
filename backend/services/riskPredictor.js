/**
 * riskPredictor.js
 * Predicts next-week risk level for a rider using:
 *
 *  Signal 1 — Historical claim frequency   (30-day rolling window)
 *  Signal 2 — Claim severity trend         (avg payout, rising/falling)
 *  Signal 3 — Trigger type distribution    (heat / rain / pollution / combined)
 *  Signal 4 — City baseline risk           (static hyper-local data)
 *  Signal 5 — Seasonal multiplier          (monsoon, summer, winter)
 *  Signal 6 — Day-of-week pattern          (weekday vs weekend claim rate)
 *  Signal 7 — Recent disruption momentum   (last 7 days vs prior 7 days)
 *
 * Output: { riskLevel, riskScore, confidence, forecast[], signals, advice }
 */

const Claim  = require('../models/Claim');
const Payout = require('../models/Payout');

// ── Static city data (mirrors premium.js) ────────────────────────────────────
const CITY_RISK = {
  Mumbai:    { base: 0.84, floodProne: true,  heatProne: false, monsoonIntensity: 0.95 },
  Delhi:     { base: 0.78, floodProne: false, heatProne: true,  monsoonIntensity: 0.65 },
  Bangalore: { base: 0.58, floodProne: false, heatProne: false, monsoonIntensity: 0.55 },
  Hyderabad: { base: 0.65, floodProne: false, heatProne: true,  monsoonIntensity: 0.60 },
  Chennai:   { base: 0.75, floodProne: true,  heatProne: true,  monsoonIntensity: 0.80 },
  Kolkata:   { base: 0.75, floodProne: true,  heatProne: false, monsoonIntensity: 0.85 },
  Pune:      { base: 0.62, floodProne: false, heatProne: false, monsoonIntensity: 0.70 },
};

// ── Seasonal helpers ──────────────────────────────────────────────────────────
const MONTH_RISK = [
  0.75, 0.70, 0.80, 0.85, 0.90, // Jan–May
  1.00, 1.10, 1.15, 1.05, 0.85, // Jun–Oct (monsoon peak Jul–Aug)
  0.75, 0.70,                    // Nov–Dec
];

function getSeasonalMultiplier(date = new Date()) {
  return MONTH_RISK[date.getMonth()];
}

function getSeasonLabel(date = new Date()) {
  const m = date.getMonth() + 1;
  if (m >= 6 && m <= 9)  return 'Monsoon Season';
  if (m >= 3 && m <= 5)  return 'Summer Season';
  if (m >= 11 || m <= 1) return 'Winter Season';
  return 'Transition Season';
}

// ── Next-week date range ──────────────────────────────────────────────────────
function getNextWeekDates() {
  const days = [];
  const now  = new Date();
  for (let i = 1; i <= 7; i++) {
    const d = new Date(now);
    d.setDate(now.getDate() + i);
    days.push(d);
  }
  return days;
}

// ── Score → level ─────────────────────────────────────────────────────────────
function scoreToLevel(score) {
  if (score >= 72) return 'High';
  if (score >= 45) return 'Medium';
  return 'Low';
}

function levelColor(level) {
  return { High: '#ef4444', Medium: '#f97316', Low: '#22c55e' }[level] ?? '#94a3b8';
}

// ── Main predictor ────────────────────────────────────────────────────────────

/**
 * predictWeeklyRisk({ riderId, city, workingHours, deliveryType })
 *
 * @returns {Promise<PredictionResult>}
 */
async function predictWeeklyRisk({ riderId, city, workingHours = 8, deliveryType = 'food' }) {
  const now     = new Date();
  const day30   = new Date(now - 30 * 86400000);
  const day7    = new Date(now - 7  * 86400000);
  const day14   = new Date(now - 14 * 86400000);

  // ── Fetch historical data ─────────────────────────────────────────────────
  const [claims30, payouts30] = await Promise.all([
    Claim.find({
      riderId,
      createdAt: { $gte: day30 },
      status:    { $nin: ['rejected'] },
    }).lean(),
    Payout.find({
      riderId,
      createdAt: { $gte: day30 },
      status:    { $in: ['completed', 'pending', 'processing'] },
    }).lean(),
  ]);

  // ── Signal 1: Claim frequency (0–1) ──────────────────────────────────────
  // Normalise: 0 claims = 0, 10+ claims in 30 days = 1.0
  const claimFreqScore = Math.min(1, claims30.length / 10);

  // ── Signal 2: Severity trend ──────────────────────────────────────────────
  // Compare avg payout last 7 days vs prior 7 days
  const recent7  = payouts30.filter(p => new Date(p.createdAt) >= day7);
  const prior7   = payouts30.filter(p => new Date(p.createdAt) >= day14 && new Date(p.createdAt) < day7);
  const avg7     = recent7.length  ? recent7.reduce((s, p) => s + p.amount, 0)  / recent7.length  : 0;
  const avgPrior = prior7.length   ? prior7.reduce((s, p) => s + p.amount, 0)   / prior7.length   : 0;
  const trendDir = avg7 > avgPrior * 1.1 ? 'rising' : avg7 < avgPrior * 0.9 ? 'falling' : 'stable';
  const trendScore = avg7 > 0 ? Math.min(1, avg7 / 500) : 0; // 500 = high payout baseline

  // ── Signal 3: Trigger type distribution ──────────────────────────────────
  const typeCounts = { heat: 0, rain: 0, pollution: 0, combined: 0 };
  claims30.forEach(c => { if (c.triggerType) typeCounts[c.triggerType] = (typeCounts[c.triggerType] || 0) + 1; });
  const dominantType = Object.entries(typeCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'none';

  // ── Signal 4: City baseline ───────────────────────────────────────────────
  const cityData    = CITY_RISK[city] ?? { base: 0.65, floodProne: false, heatProne: false, monsoonIntensity: 0.65 };
  const cityScore   = cityData.base;

  // ── Signal 5: Seasonal multiplier ────────────────────────────────────────
  const seasonal    = getSeasonalMultiplier();
  const seasonLabel = getSeasonLabel();

  // ── Signal 6: Work intensity factor ──────────────────────────────────────
  const workFactor  = Math.min(1, workingHours / 12);
  const delivRisk   = { food: 0.72, grocery: 0.62, package: 0.52, other: 0.57 }[deliveryType] ?? 0.62;

  // ── Signal 7: Disruption momentum (last 7 vs prior 7 days) ───────────────
  const recent7Claims = claims30.filter(c => new Date(c.createdAt) >= day7).length;
  const prior7Claims  = claims30.filter(c => new Date(c.createdAt) >= day14 && new Date(c.createdAt) < day7).length;
  const momentumScore = recent7Claims > prior7Claims
    ? Math.min(1, recent7Claims / 5)
    : Math.min(1, prior7Claims / 5) * 0.6;

  // ── Composite score (weighted sum → 0–100) ────────────────────────────────
  const raw =
    claimFreqScore * 0.20 +
    trendScore     * 0.15 +
    momentumScore  * 0.15 +
    cityScore      * 0.20 +
    workFactor     * 0.10 +
    delivRisk      * 0.10 +
    (cityData.floodProne ? 0.05 : 0) +
    (cityData.heatProne  ? 0.05 : 0);

  const compositeScore = Math.round(Math.min(1, raw * seasonal) * 100);
  const riskLevel      = scoreToLevel(compositeScore);

  // ── Confidence: higher when more historical data exists ───────────────────
  const dataPoints = claims30.length + payouts30.length;
  const confidence = dataPoints >= 10 ? 'High'
                   : dataPoints >= 4  ? 'Medium'
                   : 'Low';

  // ── 7-day forecast (per-day score with seasonal + day-of-week variation) ──
  const DOW_FACTOR = [0.85, 1.00, 1.00, 1.00, 1.05, 1.10, 0.90]; // Sun–Sat
  const forecast = getNextWeekDates().map(date => {
    const dowFactor  = DOW_FACTOR[date.getDay()];
    const dayScore   = Math.round(Math.min(100, compositeScore * dowFactor * getSeasonalMultiplier(date)));
    const dayLevel   = scoreToLevel(dayScore);
    return {
      date:      date.toISOString().split('T')[0],
      dayName:   date.toLocaleDateString('en-IN', { weekday: 'short' }),
      riskScore: dayScore,
      riskLevel: dayLevel,
      color:     levelColor(dayLevel),
    };
  });

  // ── Signals summary (for UI breakdown) ───────────────────────────────────
  const signals = [
    {
      key:   'claim_frequency',
      label: 'Claim Frequency',
      value: `${claims30.length} claims in 30 days`,
      score: Math.round(claimFreqScore * 100),
      impact: claimFreqScore > 0.5 ? 'high' : claimFreqScore > 0.2 ? 'medium' : 'low',
    },
    {
      key:   'severity_trend',
      label: 'Payout Trend',
      value: trendDir === 'rising'  ? `↑ Rising (avg ₹${Math.round(avg7)})` :
             trendDir === 'falling' ? `↓ Falling (avg ₹${Math.round(avg7)})` :
             `→ Stable (avg ₹${Math.round(avg7)})`,
      score: Math.round(trendScore * 100),
      impact: trendDir === 'rising' ? 'high' : trendDir === 'stable' ? 'medium' : 'low',
    },
    {
      key:   'city_baseline',
      label: 'City Risk Profile',
      value: `${city} — ${Math.round(cityScore * 100)}/100 baseline`,
      score: Math.round(cityScore * 100),
      impact: cityScore > 0.75 ? 'high' : cityScore > 0.60 ? 'medium' : 'low',
    },
    {
      key:   'season',
      label: 'Seasonal Factor',
      value: `${seasonLabel} (×${seasonal.toFixed(2)})`,
      score: Math.round((seasonal - 0.7) / 0.6 * 100),
      impact: seasonal >= 1.1 ? 'high' : seasonal >= 1.0 ? 'medium' : 'low',
    },
    {
      key:   'momentum',
      label: 'Recent Disruptions',
      value: `${recent7Claims} claims this week vs ${prior7Claims} last week`,
      score: Math.round(momentumScore * 100),
      impact: recent7Claims > prior7Claims ? 'high' : 'low',
    },
    {
      key:   'dominant_trigger',
      label: 'Primary Risk Type',
      value: dominantType === 'none' ? 'No recent triggers' : `${dominantType.charAt(0).toUpperCase() + dominantType.slice(1)} (most frequent)`,
      score: typeCounts[dominantType] ?? 0,
      impact: dominantType === 'combined' ? 'high' : dominantType !== 'none' ? 'medium' : 'low',
    },
  ];

  // ── Actionable advice ─────────────────────────────────────────────────────
  const advice = buildAdvice({ riskLevel, dominantType, trendDir, city, cityData, seasonal });

  return {
    riskLevel,
    riskScore:     compositeScore,
    riskColor:     levelColor(riskLevel),
    confidence,
    seasonLabel,
    dominantTrigger: dominantType,
    trendDirection:  trendDir,
    forecast,
    signals,
    advice,
    meta: {
      claimsAnalysed:  claims30.length,
      payoutsAnalysed: payouts30.length,
      windowDays:      30,
      generatedAt:     new Date().toISOString(),
    },
  };
}

// ── Advice builder ────────────────────────────────────────────────────────────
function buildAdvice({ riskLevel, dominantType, trendDir, city, cityData, seasonal }) {
  const tips = [];

  if (riskLevel === 'High') {
    tips.push('Consider reducing working hours on peak-risk days this week.');
    tips.push('Ensure your insurance plan covers your current earnings level.');
  }
  if (dominantType === 'heat' || cityData.heatProne) {
    tips.push('Carry extra water and plan rest breaks during midday hours (12–4 PM).');
  }
  if (dominantType === 'rain' || cityData.floodProne) {
    tips.push('Check flood-prone routes before starting shifts. Avoid low-lying areas.');
  }
  if (dominantType === 'pollution') {
    tips.push('Wear an N95 mask on high-AQI days. Limit outdoor exposure when AQI > 200.');
  }
  if (trendDir === 'rising') {
    tips.push('Payout amounts are trending up — conditions are worsening. Stay alert.');
  }
  if (seasonal >= 1.1) {
    tips.push(`${getSeasonLabel()} increases risk significantly in ${city}. Extra caution advised.`);
  }
  if (tips.length === 0) {
    tips.push('Conditions look stable. Keep your plan active for continued protection.');
  }

  return tips;
}

module.exports = { predictWeeklyRisk };
