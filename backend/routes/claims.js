const express = require('express');
const jwt = require('jsonwebtoken');
const Claim = require('../models/Claim');
const Rider = require('../models/Rider');
const router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET || 'rideshield_secret_key';

const authMiddleware = (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    req.userId = jwt.verify(token, JWT_SECRET).id;
    next();
  } catch {
    res.status(401).json({ error: 'Unauthorized' });
  }
};

// Fraud detection engine
function detectFraud(claimData, riderHistory) {
  const flags = [];

  // Flag 1: Too many claims in 7 days
  const recentClaims = riderHistory.filter(c => {
    const diff = (Date.now() - new Date(c.createdAt)) / (1000 * 60 * 60 * 24);
    return diff <= 7;
  });
  if (recentClaims.length >= 3) flags.push('High claim frequency in 7 days');

  // Flag 2: Claim amount suspiciously high
  if (claimData.amount > claimData.maxPayout * 0.95) flags.push('Claim near maximum payout limit');

  // Flag 3: No weather trigger data
  if (!claimData.triggerData?.rainfall && !claimData.triggerData?.temperature) {
    flags.push('Missing environmental trigger data');
  }

  return flags;
}

// Returns how much has already been paid/queued to this rider today
async function getDailyPayoutTotal(riderId) {
  const Payout = require('../models/Payout');
  const dayStart = new Date(); dayStart.setHours(0, 0, 0, 0);
  const payouts = await Payout.find({
    riderId,
    createdAt: { $gte: dayStart },
    status: { $in: ['completed', 'processing', 'pending'] },
  });
  return payouts.reduce((sum, p) => sum + p.amount, 0);
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
      status: { $in: ['Processing', 'Approved'] },
    });
    if (sameDaySameReason) {
      return res.status(409).json({ error: 'Duplicate claim: same reason already submitted today', existingClaimId: sameDaySameReason._id });
    }

    // Daily cap: reject if rider already hit maxPayout today
    const paidToday = await getDailyPayoutTotal(req.userId);
    const remaining = maxPayout - paidToday;
    if (remaining <= 0) {
      return res.status(400).json({ error: 'Daily payout cap reached', paidToday, maxPayout });
    }

    // Cap the claim amount to whatever headroom is left
    const cappedAmount = Math.min(amount, remaining);

    const history = await Claim.find({ riderId: req.userId }).sort({ createdAt: -1 });
    const fraudFlags = detectFraud({ amount: cappedAmount, maxPayout, triggerData }, history);

    // Incorporate validation confidence into status decision
    const confidence = triggerData?.confidenceScore ?? 50;
    const hasValidation = triggerData?.gpsLat && triggerData?.gpsLon;
    if (hasValidation && confidence < 40) fraudFlags.push('Low validation confidence score');

    const status = fraudFlags.length >= 2 ? 'Flagged' : 'Processing';

    const claim = new Claim({
      riderId: req.userId,
      amount: cappedAmount,
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
        method:          triggerData.crowdCount >= 3 ? 'crowd-corroborated' : hasValidation ? 'user-reported' : 'auto',
      } : undefined,
      status,
      fraudFlags,
    });
    await claim.save();

    if (status === 'Processing') {
      setTimeout(async () => {
        await Claim.findByIdAndUpdate(claim._id, { status: 'Approved' });
        // Auto-trigger settlement pipeline after approval
        try {
          const { runSettlement } = require('./settlement');
          const Payout = require('../models/Payout');
          const hoursLost     = (rider.workingHours || 8) * 0.6;
          const estimatedLoss = Math.round(hoursLost * 70);
          const payout = new Payout({
            riderId: rider._id, claimId: claim._id,
            amount: cappedAmount, reason, triggerData,
            estimatedLostIncome: estimatedLoss, steps: [],
          });
          await payout.save();
          runSettlement(payout, rider).catch(console.error);
        } catch (e) { console.error('Settlement auto-trigger failed:', e.message); }
      }, 2000);
    }

    res.status(201).json({ claim, fraudFlags, status, cappedAmount, remainingToday: remaining - cappedAmount });
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
    const { offlineClaims } = req.body; // array of queued claims
    const results = [];

    for (const c of offlineClaims) {
      const history = await Claim.find({ riderId: req.userId });
      const fraudFlags = detectFraud(
        { amount: c.amount, maxPayout: 1000, triggerData: c.triggerData },
        history
      );
      const status = fraudFlags.length >= 2 ? 'Flagged' : 'Approved';
      const claim = new Claim({ riderId: req.userId, ...c, status, fraudFlags });
      await claim.save();
      results.push({ id: claim._id, status });
    }

    res.json({ synced: results.length, results });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
