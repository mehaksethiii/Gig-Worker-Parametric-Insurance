const express        = require('express');
const jwt            = require('jsonwebtoken');
const Claim          = require('../models/Claim');
const Rider          = require('../models/Rider');
const Payout         = require('../models/Payout');
const { runFraudChecks }    = require('../services/fraudDetector');
const { processMockPayout, isMockMode } = require('../services/mockPayout');
const {
  notifyRiskHigh,
  notifyClaimTriggered,
  notifyClaimFlagged,
} = require('../services/notificationService');
const router         = express.Router();

const JWT_SECRET = process.env.JWT_SECRET || 'rideshield_secret_key';

// ── Thresholds (single source of truth) ──────────────────────────────────────
const THRESHOLDS = { temperature: 42, aqi: 200, rainfall: 50 };

const authMiddleware = (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    req.userId = jwt.verify(token, JWT_SECRET).id;
    next();
  } catch {
    res.status(401).json({ error: 'Unauthorized' });
  }
};

// Returns how much has already been paid/queued to this rider today
async function getDailyPayoutTotal(riderId) {
  const dayStart = new Date(); dayStart.setHours(0, 0, 0, 0);
  const payouts = await Payout.find({
    riderId,
    createdAt: { $gte: dayStart },
    status: { $in: ['completed', 'processing', 'pending'] },
  });
  return payouts.reduce((sum, p) => sum + p.amount, 0);
}

// Derive triggerType enum value from weather readings
function resolveTriggerType(temperature, aqi, rainfall) {
  const heat      = temperature > THRESHOLDS.temperature;
  const pollution = aqi         > THRESHOLDS.aqi;
  const rain      = rainfall    > THRESHOLDS.rainfall;
  const count     = [heat, pollution, rain].filter(Boolean).length;
  if (count > 1)   return 'combined';
  if (heat)        return 'heat';
  if (pollution)   return 'pollution';
  if (rain)        return 'rain';
  return null; // no trigger
}

// POST /api/claims/submit
router.post('/submit', authMiddleware, async (req, res) => {
  try {
    const rider = await Rider.findById(req.userId);
    if (!rider?.insurancePlan?.name) {
      return res.status(400).json({ error: 'No active insurance plan' });
    }

    const { amount, reason, triggerData } = req.body;
    const maxPayout = rider.insurancePlan.maxPayout;

    // Hard dedup: reject if same reason already claimed today
    const dayStart = new Date(); dayStart.setHours(0, 0, 0, 0);
    const sameDaySameReason = await Claim.findOne({
      riderId: req.userId,
      reason,
      createdAt: { $gte: dayStart },
      status: { $in: ['pending', 'approved'] },
    });
    if (sameDaySameReason) {
      return res.status(409).json({
        error: 'Duplicate claim: same reason already submitted today',
        existingClaimId: sameDaySameReason._id,
      });
    }

    // Daily cap
    const paidToday = await getDailyPayoutTotal(req.userId);
    const remaining = maxPayout - paidToday;
    if (remaining <= 0) {
      return res.status(400).json({ error: 'Daily payout cap reached', paidToday, maxPayout });
    }

    const cappedAmount = Math.min(amount, remaining);

    // ── Fraud detection (runs before any approval) ────────────────────────
    const fraud = await runFraudChecks({
      riderId:     req.userId,
      riderCity:   rider.city,
      triggerData,
      amount:      cappedAmount,
      maxPayout,
    });

    // Low-confidence GPS validation adds an extra flag
    const confidence    = triggerData?.confidenceScore ?? 50;
    const hasValidation = triggerData?.gpsLat && triggerData?.gpsLon;
    if (hasValidation && confidence < 40) {
      fraud.flags.push('Low validation confidence score');
    }

    // High-severity fraud → flag and block payout immediately
    if (fraud.isFraud) {
      const flaggedClaim = new Claim({
        riderId:      req.userId,
        triggerType:  resolveTriggerType(
          triggerData?.temperature ?? 0,
          triggerData?.aqi         ?? 0,
          triggerData?.rainfall    ?? 0,
        ) || 'rain',
        payoutAmount: cappedAmount,
        amount:       cappedAmount,
        reason,
        triggerData,
        status:     'flagged',
        fraudFlags: fraud.flags,
      });
      await flaggedClaim.save();
      console.warn(`🚫 [submit] Claim flagged (high severity) for rider ${rider.name}: ${fraud.flags.join(', ')}`);
      notifyClaimFlagged({ riderId: req.userId, claimId: flaggedClaim._id, flags: fraud.flags }).catch(() => {});
      return res.status(422).json({
        error:    'Claim flagged for fraud — payout blocked pending review',
        claimId:  flaggedClaim._id,
        fraudFlags: fraud.flags,
        severity: fraud.severity,
      });
    }

    const triggerType = resolveTriggerType(
      triggerData?.temperature ?? 0,
      triggerData?.aqi         ?? 0,
      triggerData?.rainfall    ?? 0,
    ) || 'rain';

    // Low-severity fraud → save as flagged for manual review but don't block
    const status = fraud.severity === 'low' ? 'flagged' : 'pending';

    const claim = new Claim({
      riderId:      req.userId,
      triggerType,
      payoutAmount: cappedAmount,
      amount:       cappedAmount,
      reason,
      triggerData,
      validation: hasValidation ? {
        gpsLat:          triggerData.gpsLat,
        gpsLon:          triggerData.gpsLon,
        gpsAccuracy:     triggerData.gpsAccuracy,
        speedKmh:        triggerData.speedKmh,
        hyperLocalRain:  triggerData.hyperLocalRain,
        crowdCount:      triggerData.crowdCount,
        photoUrl:        triggerData.photoUrl,
        confidenceScore: confidence,
        method: triggerData.crowdCount >= 3 ? 'crowd-corroborated' : 'user-reported',
      } : undefined,
      status,
      fraudFlags: fraud.flags,
    });
    await claim.save();

    // Notify rider that a claim was triggered
    notifyClaimTriggered({
      riderId:     req.userId,
      claimId:     claim._id,
      triggerType: claim.triggerType,
      amount:      cappedAmount,
      reason,
    }).catch(() => {});

    // Only proceed to settlement if claim is clean (pending → approved → paid)
    if (status === 'pending') {
      setTimeout(async () => {
        await Claim.findByIdAndUpdate(claim._id, { status: 'approved' });
        try {
          const hoursLost     = (rider.workingHours || 8) * 0.6;
          const estimatedLoss = Math.round(hoursLost * 70);
          const payout = new Payout({
            riderId:             rider._id,
            claimId:             claim._id,
            amount:              cappedAmount,
            reason,
            triggerData,
            estimatedLostIncome: estimatedLoss,
            steps:               [],
          });
          await payout.save();

          if (isMockMode()) {
            await processMockPayout(payout, rider);
          } else {
            const { runSettlement } = require('./settlement');
            runSettlement(payout, rider).catch(console.error);
          }
        } catch (e) { console.error('Settlement auto-trigger failed:', e.message); }
      }, 2000);
    }

    res.status(201).json({
      claim,
      fraudFlags:     fraud.flags,
      fraudSeverity:  fraud.severity,
      status,
      cappedAmount,
      remainingToday: remaining - cappedAmount,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/claims/report-disaster
// Rider self-reports any natural disaster — used for crowd corroboration
router.post('/report-disaster', authMiddleware, async (req, res) => {
  try {
    const { lat, lon, reason, disasterType = 'flood', speedKmh } = req.body;
    if (!lat || !lon) return res.status(400).json({ error: 'GPS coordinates required' });

    const windowStart = new Date(Date.now() - 30 * 60 * 1000);
    const recentReports = await Claim.find({
      createdAt: { $gte: windowStart },
      reason,
      'validation.gpsLat': { $exists: true },
    });

    const R = 6371;
    const nearbyCount = recentReports.filter(c => {
      const dLat = (c.validation.gpsLat - lat) * Math.PI / 180;
      const dLon = (c.validation.gpsLon - lon) * Math.PI / 180;
      const a = Math.sin(dLat/2)**2 + Math.cos(lat * Math.PI/180) * Math.cos(c.validation.gpsLat * Math.PI/180) * Math.sin(dLon/2)**2;
      return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)) <= 2;
    }).length;

    const validationRes = await axios.post(`http://localhost:5000/api/weather/validate-disaster`, {
      lat, lon, disasterType, speedKmh, crowdCount: nearbyCount,
    });
    const validation = validationRes.data;

    res.json({
      crowdCount: nearbyCount,
      validation,
      readyToSubmit: validation.validated,
      message: nearbyCount > 0
        ? `${nearbyCount} other rider(s) near you also reported this — strong corroboration`
        : 'You are the first to report in this area',
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/claims/my
router.get('/my', authMiddleware, async (req, res) => {
  try {
    const claims = await Claim.find({ riderId: req.userId }).sort({ createdAt: -1 });
    res.json({ claims });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/claims/sync-offline  (offline queue sync)
router.post('/sync-offline', authMiddleware, async (req, res) => {
  try {
    const { offlineClaims } = req.body;
    const results = [];

    for (const c of offlineClaims) {
      const rider = await Rider.findById(req.userId);
      const fraud = await runFraudChecks({
        riderId:     req.userId,
        riderCity:   rider?.city || '',
        triggerData: c.triggerData,
        amount:      c.amount,
        maxPayout:   1000,
      });
      const triggerType = resolveTriggerType(
        c.triggerData?.temperature ?? 0,
        c.triggerData?.aqi         ?? 0,
        c.triggerData?.rainfall    ?? 0,
      ) || 'rain';
      const status = fraud.isFraud ? 'flagged' : 'approved';
      const claim  = new Claim({
        riderId: req.userId, ...c,
        triggerType,
        payoutAmount: c.amount,
        status,
        fraudFlags: fraud.flags,
      });
      await claim.save();
      results.push({ id: claim._id, status });
    }

    res.json({ synced: results.length, results });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/claims/auto-trigger ─────────────────────────────────────────────
// Called internally (by the cron job) when risk conditions are met.
// Body: { riderId, temperature, aqi, rainfall, payoutAmount, estimatedLoss }
router.post('/auto-trigger', async (req, res) => {
  // Internal-only: require a shared secret so this isn't publicly callable
  const secret = req.headers['x-internal-secret'];
  if (secret !== (process.env.INTERNAL_SECRET || 'internal_cron_secret')) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  try {
    const { riderId, temperature, aqi, rainfall, payoutAmount, estimatedLoss } = req.body;
    if (!riderId || payoutAmount == null) {
      return res.status(400).json({ error: 'riderId and payoutAmount are required' });
    }

    const rider = await Rider.findById(riderId);
    if (!rider) return res.status(404).json({ error: 'Rider not found' });

    const triggerType = resolveTriggerType(temperature ?? 0, aqi ?? 0, rainfall ?? 0);
    if (!triggerType) return res.status(400).json({ error: 'No risk condition met' });

    // Cooldown: one auto-claim per rider per hour
    const cooldownStart = new Date(Date.now() - 60 * 60 * 1000);
    const recent = await Claim.findOne({
      riderId,
      triggerType,
      createdAt: { $gte: cooldownStart },
      status:    { $in: ['pending', 'approved', 'paid'] },
    });
    if (recent) {
      return res.status(409).json({ error: 'Cooldown active — claim already created this hour', claimId: recent._id });
    }

    // Daily cap check
    const maxPayout = rider.insurancePlan?.maxPayout || 500;
    const paidToday = await getDailyPayoutTotal(riderId);
    const capped    = Math.min(payoutAmount, maxPayout - paidToday);
    if (capped <= 0) {
      return res.status(400).json({ error: 'Daily payout cap reached' });
    }

    const reasons = [];
    if (temperature > THRESHOLDS.temperature) reasons.push(`Extreme heat (${temperature}°C)`);
    if (aqi         > THRESHOLDS.aqi)         reasons.push(`Poor air quality (AQI ${aqi})`);
    if (rainfall    > THRESHOLDS.rainfall)    reasons.push(`Heavy rainfall (${rainfall}mm)`);
    const reason = reasons.join(' + ');

    // ── Fraud detection before approval ──────────────────────────────────
    const triggerDataForFraud = { temperature, aqi, rainfall, city: rider.city };
    const fraud = await runFraudChecks({
      riderId,
      riderCity:   rider.city,
      triggerData: triggerDataForFraud,
      amount:      capped,
      maxPayout,
    });

    if (fraud.isFraud) {
      const flaggedClaim = new Claim({
        riderId, triggerType,
        payoutAmount: capped, amount: capped,
        reason,
        triggerData:  triggerDataForFraud,
        validation:   { method: 'auto', confidenceScore: 85 },
        status:       'flagged',
        fraudFlags:   fraud.flags,
      });
      await flaggedClaim.save();
      console.warn(`🚫 [auto-trigger] Claim flagged for rider ${rider.name}: ${fraud.flags.join(', ')}`);
      notifyClaimFlagged({ riderId, claimId: flaggedClaim._id, flags: fraud.flags }).catch(() => {});
      return res.status(422).json({
        error:      'Claim flagged for fraud — payout blocked pending review',
        claimId:    flaggedClaim._id,
        fraudFlags: fraud.flags,
        severity:   fraud.severity,
      });
    }

    // Create Claim — low-severity fraud still saves but stays flagged for review
    const claimStatus = fraud.severity === 'low' ? 'flagged' : 'approved';
    const claim = new Claim({
      riderId,
      triggerType,
      payoutAmount: capped,
      amount:       capped,
      reason,
      triggerData:  triggerDataForFraud,
      validation:   { method: 'auto', confidenceScore: 85 },
      status:       claimStatus,
      fraudFlags:   fraud.flags,
    });
    await claim.save();

    // Notify rider about the auto-triggered claim
    notifyClaimTriggered({
      riderId,
      claimId:     claim._id,
      triggerType: claim.triggerType,
      amount:      capped,
      reason,
    }).catch(() => {});

    // Also fire a risk-high notification so the banner shows on dashboard
    notifyRiskHigh({ riderId, temperature, aqi, city: rider.city }).catch(() => {});

    // Only create a Payout if the claim is clean
    let payout = null;
    if (claimStatus === 'approved') {
      payout = new Payout({
        riderId,
        claimId:             claim._id,
        amount:              capped,
        reason:              claim.reason,
        triggerData:         { temperature, aqi, rainfall },
        estimatedLostIncome: estimatedLoss ?? capped,
        status:              'pending',
        steps: [
          { step: 'trigger_confirmed',  status: 'done',    timestamp: new Date(), detail: reason },
          { step: 'eligibility_check',  status: 'done',    timestamp: new Date(), detail: 'Active rider with plan' },
          { step: 'payout_calculated',  status: 'done',    timestamp: new Date(), detail: `₹${capped}` },
          { step: 'transfer_initiated', status: 'pending', timestamp: new Date(), detail: 'Awaiting settlement' },
        ],
      });
      await payout.save();

      if (isMockMode()) {
        await processMockPayout(payout, rider);
      } else {
        const { runSettlement } = require('./settlement');
        runSettlement(payout, rider).catch(console.error);
      }
    }

    console.log(`✅ [auto-trigger] ${rider.name} (${rider.city}) — ${triggerType} → ₹${capped} [${claimStatus}]`);
    res.status(201).json({ claim, payout, fraudFlags: fraud.flags, fraudSeverity: fraud.severity });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
