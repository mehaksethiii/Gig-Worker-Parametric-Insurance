/**
 * simulate.js
 * Demo-only endpoint — bypasses cooldown, fraud checks, and daily caps.
 * Protected by JWT so only logged-in riders can trigger it.
 *
 * POST /api/simulate/event
 * Body: { eventType: 'heatwave' | 'flood' | 'smog' | 'combined' }
 *
 * Returns the full pipeline result:
 *   weatherSnapshot → mlScore → claim → payout → receipt
 */

const express  = require('express');
const jwt      = require('jsonwebtoken');
const Rider    = require('../models/Rider');
const Claim    = require('../models/Claim');
const Payout   = require('../models/Payout');
const { scoreWeatherRisk }    = require('../services/weatherRiskModel');
const { processMockPayout }   = require('../services/mockPayout');
const { notifyClaimTriggered, notifyPayoutProcessed, notifyRiskHigh } = require('../services/notificationService');
const router   = express.Router();

const JWT_SECRET = process.env.JWT_SECRET || 'rideshield_secret_key';

const auth = (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    req.userId = jwt.verify(token, JWT_SECRET).id;
    next();
  } catch {
    res.status(401).json({ error: 'Unauthorized' });
  }
};

// ── Fake weather snapshots per event type ─────────────────────────────────────
const EVENTS = {
  heatwave: {
    label:       '🌡️ Heatwave',
    temperature: 47,
    aqi:         165,
    rainfall:    0,
    description: 'Extreme heat — temperature 47°C, well above the 42°C trigger threshold',
    color:       '#f97316',
  },
  flood: {
    label:       '🌧️ Flash Flood',
    temperature: 31,
    aqi:         90,
    rainfall:    85,
    description: 'Heavy rainfall 85mm/hr — severe flooding conditions',
    color:       '#60a5fa',
  },
  smog: {
    label:       '🌫️ Smog Alert',
    temperature: 34,
    aqi:         320,
    rainfall:    0,
    description: 'Hazardous air quality — AQI 320, far above the 200 threshold',
    color:       '#a78bfa',
  },
  combined: {
    label:       '⚡ Combined Event',
    temperature: 44,
    aqi:         230,
    rainfall:    55,
    description: 'Multiple triggers: extreme heat + poor air quality + heavy rain',
    color:       '#facc15',
  },
};

// ── Payout calculation (same logic as cron, no caps for demo) ─────────────────
function calcDemoPayout(rider, mlScore) {
  const maxPayout = rider.insurancePlan?.maxPayout || 500;
  const severity  = Math.min(1, Math.max(0, (mlScore - 40) / 60));
  const hoursLost = (rider.workingHours || 8) * severity;
  const estimated = Math.floor(hoursLost * 120);
  return { amount: Math.min(estimated, maxPayout), estimated, severity };
}

// ── POST /api/simulate/event ──────────────────────────────────────────────────
router.post('/event', auth, async (req, res) => {
  const { eventType = 'heatwave' } = req.body;
  const event = EVENTS[eventType];
  if (!event) {
    return res.status(400).json({
      error: `Unknown eventType. Valid: ${Object.keys(EVENTS).join(', ')}`,
    });
  }

  try {
    const rider = await Rider.findById(req.userId);
    if (!rider) return res.status(404).json({ error: 'Rider not found' });

    // Ensure rider has a plan for demo (assign a default if missing)
    if (!rider.insurancePlan?.name) {
      rider.insurancePlan = { name: 'Standard', premium: 299, maxPayout: 500 };
    }

    // ── Step 1: Weather snapshot ──────────────────────────────────────────
    const weather = {
      temperature: event.temperature,
      aqi:         event.aqi,
      rainfall:    event.rainfall,
      city:        rider.city,
      source:      'simulation',
    };

    // ── Step 2: ML risk score ─────────────────────────────────────────────
    const mlResult = scoreWeatherRisk({
      temperature: weather.temperature,
      aqi:         weather.aqi,
      rainfall:    weather.rainfall,
    });

    // ── Step 3: Notify risk high ──────────────────────────────────────────
    notifyRiskHigh({
      riderId:     rider._id,
      temperature: weather.temperature,
      aqi:         weather.aqi,
      city:        rider.city,
    }).catch(() => {});

    // ── Step 4: Create claim (no fraud check, no cooldown — demo mode) ────
    const triggerType = mlResult.triggerType === 'none' ? 'heat' : mlResult.triggerType;
    const reasons     = [];
    if (weather.temperature > 42) reasons.push(`Extreme heat (${weather.temperature}°C)`);
    if (weather.aqi         > 200) reasons.push(`Poor air quality (AQI ${weather.aqi})`);
    if (weather.rainfall    > 50)  reasons.push(`Heavy rainfall (${weather.rainfall}mm)`);
    const reason = reasons.join(' + ') || event.description;

    const { amount, estimated } = calcDemoPayout(rider, mlResult.riskScore);

    const claim = new Claim({
      riderId:      rider._id,
      triggerType,
      payoutAmount: amount,
      amount,
      reason,
      triggerData:  weather,
      validation:   { method: 'auto', confidenceScore: 90 },
      status:       'approved',
      fraudFlags:   [],
    });
    await claim.save();

    notifyClaimTriggered({
      riderId:     rider._id,
      claimId:     claim._id,
      triggerType: claim.triggerType,
      amount,
      reason,
    }).catch(() => {});

    // ── Step 5: Create and process payout ────────────────────────────────
    const payout = new Payout({
      riderId:             rider._id,
      claimId:             claim._id,
      amount,
      reason,
      triggerData:         { temperature: weather.temperature, aqi: weather.aqi, rainfall: weather.rainfall },
      estimatedLostIncome: estimated,
      status:              'pending',
      steps: [
        { step: 'trigger_confirmed',  status: 'done',    timestamp: new Date(), detail: `[DEMO] ${event.label}` },
        { step: 'eligibility_check',  status: 'done',    timestamp: new Date(), detail: `Plan: ${rider.insurancePlan.name}` },
        { step: 'payout_calculated',  status: 'done',    timestamp: new Date(), detail: `₹${amount} (ML score: ${mlResult.riskScore}/100)` },
        { step: 'transfer_initiated', status: 'pending', timestamp: new Date(), detail: 'Processing mock transfer…' },
      ],
    });
    await payout.save();

    const receipt = await processMockPayout(payout, rider);

    // ── Step 6: Return full pipeline result ───────────────────────────────
    res.status(201).json({
      demo:    true,
      event: {
        type:        eventType,
        label:       event.label,
        description: event.description,
        color:       event.color,
      },
      weather,
      mlScore: {
        riskScore:         mlResult.riskScore,
        riskLevel:         mlResult.riskLevel,
        triggerType:       mlResult.triggerType,
        featureImportance: mlResult.featureImportance,
      },
      claim: {
        id:          claim._id,
        triggerType: claim.triggerType,
        amount:      claim.payoutAmount,
        status:      'paid',
        reason:      claim.reason,
      },
      payout: {
        id:            payout._id,
        amount:        receipt.amount,
        txnId:         receipt.txnId,
        utr:           receipt.utr,
        channel:       receipt.channel,
        settledAt:     receipt.settledAt,
      },
      rider: {
        name: rider.name,
        city: rider.city,
        plan: rider.insurancePlan.name,
      },
    });
  } catch (err) {
    console.error('[Simulate]', err.message);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/simulate/events — list available event types
router.get('/events', (req, res) => {
  res.json({
    events: Object.entries(EVENTS).map(([type, e]) => ({
      type,
      label:       e.label,
      description: e.description,
      color:       e.color,
      weather:     { temperature: e.temperature, aqi: e.aqi, rainfall: e.rainfall },
    })),
  });
});

module.exports = router;
