const express = require('express');
const jwt     = require('jsonwebtoken');
const Payout  = require('../models/Payout');
const Claim   = require('../models/Claim');
const Rider   = require('../models/Rider');
const { processMockPayout, isMockMode } = require('../services/mockPayout');
const router  = express.Router();

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

// ── GET /api/payouts/rider/:riderId ───────────────────────────────────────────
// Legacy route — kept for backward compatibility
router.get('/rider/:riderId', async (req, res) => {
  try {
    const payouts = await Payout.find({ riderId: req.params.riderId })
      .sort({ createdAt: -1 });
    res.json(payouts);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/payouts/stats/:riderId ───────────────────────────────────────────
router.get('/stats/:riderId', async (req, res) => {
  try {
    const payouts = await Payout.find({
      riderId: req.params.riderId,
      status:  'completed',
    });
    const totalPayout = payouts.reduce((sum, p) => sum + p.amount, 0);
    res.json({
      totalPayouts:  payouts.length,
      totalAmount:   totalPayout,
      averageAmount: payouts.length > 0 ? Math.floor(totalPayout / payouts.length) : 0,
      recentPayouts: payouts.slice(0, 5),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/payouts/create ──────────────────────────────────────────────────
// Create a payout manually (testing / admin use)
router.post('/create', async (req, res) => {
  try {
    const payout = new Payout(req.body);
    await payout.save();
    res.status(201).json({ message: 'Payout created', payout });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/payouts/:userId ──────────────────────────────────────────────────
// Returns full payout history for a user, enriched with claim details.
// JWT userId in param must match the authenticated token.
router.get('/:userId', authMiddleware, async (req, res) => {
  try {
    const { userId } = req.params;

    // Only allow riders to fetch their own history (admins can bypass via /admin routes)
    if (req.userId !== userId) {
      return res.status(403).json({ error: 'Access denied — you can only view your own payout history' });
    }

    const payouts = await Payout.find({ riderId: userId })
      .sort({ createdAt: -1 })
      .populate('claimId', 'triggerType status fraudFlags triggerData createdAt');

    // Compute summary stats
    const completed = payouts.filter(p => p.status === 'completed');
    const totalPaid = completed.reduce((sum, p) => sum + p.amount, 0);

    const history = payouts.map(p => ({
      payoutId:      p._id,
      amount:        p.amount,
      status:        p.status,
      channel:       p.channel,
      transactionId: p.transactionId || null,
      utr:           p.upiId         || null,
      reason:        p.reason,
      triggerData:   p.triggerData,
      settledAt:     p.settledAt     || null,
      failureReason: p.failureReason || null,
      steps:         p.steps,
      claim: p.claimId ? {
        claimId:     p.claimId._id,
        triggerType: p.claimId.triggerType,
        status:      p.claimId.status,
        fraudFlags:  p.claimId.fraudFlags,
        triggerData: p.claimId.triggerData,
        createdAt:   p.claimId.createdAt,
      } : null,
      createdAt: p.createdAt,
    }));

    res.json({
      userId,
      summary: {
        totalPayouts:    payouts.length,
        completedCount:  completed.length,
        pendingCount:    payouts.filter(p => p.status === 'pending').length,
        failedCount:     payouts.filter(p => p.status === 'failed').length,
        totalAmountPaid: totalPaid,
      },
      payouts: history,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/payouts/process/:payoutId ───────────────────────────────────────
// Manually trigger mock payout for an existing pending Payout document.
// Useful for testing or retrying failed payouts.
router.post('/process/:payoutId', authMiddleware, async (req, res) => {
  try {
    const payout = await Payout.findById(req.params.payoutId);
    if (!payout) return res.status(404).json({ error: 'Payout not found' });

    if (payout.riderId.toString() !== req.userId) {
      return res.status(403).json({ error: 'Access denied' });
    }
    if (payout.status === 'completed') {
      return res.status(409).json({ error: 'Payout already completed', transactionId: payout.transactionId });
    }

    const rider = await Rider.findById(payout.riderId);
    if (!rider) return res.status(404).json({ error: 'Rider not found' });

    if (isMockMode()) {
      const result = await processMockPayout(payout, rider);
      return res.json({ message: 'Mock payout processed', ...result });
    }

    // Real mode — kick off settlement pipeline
    const { runSettlement } = require('./settlement');
    res.status(202).json({ message: 'Settlement pipeline started', payoutId: payout._id });
    runSettlement(payout, rider).catch(console.error);

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
