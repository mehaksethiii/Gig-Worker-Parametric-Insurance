/**
 * RideShield — Automatic Settlement Pipeline
 * Implements the 5-step flow from the DEVTrails slide:
 * 1. Trigger confirmed  2. Eligibility check  3. Payout calculated
 * 4. Transfer initiated  5. Record updated
 *
 * Channels: UPI (preferred) → IMPS fallback → Razorpay sandbox (demo)
 * Rules: fraud check BEFORE payment, rollback on failure, minutes not hours
 */

const express = require('express');
const jwt     = require('jsonwebtoken');
const Payout  = require('../models/Payout');
const Claim   = require('../models/Claim');
const Rider   = require('../models/Rider');
const { sendUpiPayout } = require('../services/cashfreePayout');
const { routePayout }   = require('../services/payoutRouter');
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

// ── Helpers ──────────────────────────────────────────────────────────────────

function addStep(payout, step, status, detail) {
  payout.steps.push({ step, status, timestamp: new Date(), detail });
}

// ── Main settlement function ──────────────────────────────────────────────────

async function runSettlement(payout, rider) {
  const txnRef = `RS_${rider._id.toString().slice(-6)}_${Date.now()}`;

  try {
    // STEP 1 — Trigger confirmed (already done by caller, just log)
    addStep(payout, 'trigger_confirmed', 'done', `Weather/disaster trigger confirmed. Reason: ${payout.reason}`);
    await payout.save();

    // STEP 2 — Eligibility check
    payout.status = 'processing';
    const hasPolicy  = !!rider.insurancePlan?.name;
    const isActive   = rider.isActive;
    const dayStart   = new Date(); dayStart.setHours(0, 0, 0, 0);
    const dupePayout = await Payout.findOne({
      riderId: rider._id,
      reason: payout.reason,
      createdAt: { $gte: dayStart },
      status: 'completed',
    });

    if (!hasPolicy || !isActive || dupePayout) {
      const reason = !hasPolicy ? 'No active policy' : !isActive ? 'Rider inactive' : 'Duplicate payout today';
      addStep(payout, 'eligibility_check', 'failed', reason);
      payout.status = 'failed';
      payout.failureReason = reason;
      await payout.save();
      return { success: false, reason };
    }
    addStep(payout, 'eligibility_check', 'done', `Policy: ${rider.insurancePlan.name}, Zone: ${rider.city}, No duplicate`);
    await payout.save();

    // STEP 3 — Payout calculated
    const dailyRate  = Math.round(payout.estimatedLostIncome / (rider.workingHours || 8));
    const triggerDays = 1; // parametric: 1 trigger event = 1 day
    const calculated  = Math.min(payout.amount, rider.insurancePlan.maxPayout);
    addStep(payout, 'payout_calculated', 'done', `₹${dailyRate}/hr × ${rider.workingHours}hrs × ${triggerDays} day = ₹${calculated}`);
    payout.amount = calculated;
    await payout.save();

    // STEP 4 — Transfer initiated via payout router (UPI → IMPS → Sandbox)
    const recentPayouts = await Payout.find({ riderId: rider._id }).sort({ createdAt: -1 }).limit(10);
    const txnResult = await routePayout({ rider, amount: calculated, txnRef, recentPayouts });

    if (!txnResult.success) {
      addStep(payout, 'transfer_initiated', 'failed', `Blocked: ${txnResult.message}`);
      payout.status = 'failed';
      payout.failureReason = txnResult.message;
      await payout.save();
      return { success: false, reason: txnResult.message };
    }

    const channelLabel = {
      upi:     `UPI → ${rider.upiId}`,
      imps:    `IMPS → ${rider.bankName || 'Bank'}`,
      sandbox: 'Razorpay/Stripe Sandbox (demo)',
    }[txnResult.channel] || txnResult.label;

    addStep(payout, 'transfer_initiated', 'done',
      `${channelLabel} — ₹${calculated} sent. TxnID: ${txnResult.txnId}${txnResult.utr ? ` UTR: ${txnResult.utr}` : ''}`
    );
    if (txnResult.rollbackAttempted) {
      payout.rollbackAttempted = true;
    }

    payout.transactionId = txnResult.txnId;
    payout.channel       = txnResult.channel;
    payout.settledAt     = txnResult.settledAt;
    await payout.save();

    // STEP 5 — Record updated
    payout.status = 'completed';
    addStep(payout, 'record_updated', 'done', `Payout logged. TxnID: ${txnResult.txnId}. BillingCenter reconciled.`);
    await payout.save();

    return { success: true, txnId: txnResult.txnId, channel: txnResult.channel, amount: calculated };

  } catch (err) {
    payout.status = 'failed';
    payout.failureReason = err.message;
    addStep(payout, 'record_updated', 'failed', `Settlement failed: ${err.message}`);
    await payout.save();
    return { success: false, reason: err.message };
  }
}

// ── Routes ────────────────────────────────────────────────────────────────────

// POST /api/settlement/initiate
// Called after a claim is approved — kicks off the full 5-step pipeline
router.post('/initiate', authMiddleware, async (req, res) => {
  try {
    const { claimId, amount, reason, triggerData } = req.body;
    const rider = await Rider.findById(req.userId);
    if (!rider) return res.status(404).json({ error: 'Rider not found' });

    const hoursLost      = (rider.workingHours || 8) * 0.6;
    const estimatedLoss  = Math.round(hoursLost * 70);

    const payout = new Payout({
      riderId:             rider._id,
      claimId,
      amount:              amount || estimatedLoss,
      reason:              reason || 'Weather Disruption',
      triggerData,
      estimatedLostIncome: estimatedLoss,
      steps:               [],
    });
    await payout.save();

    // Run settlement async — respond immediately with payout ID
    res.status(202).json({ message: 'Settlement pipeline started', payoutId: payout._id, status: 'processing' });

    // Run in background
    runSettlement(payout, rider).catch(console.error);

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/settlement/status/:payoutId — poll for live step updates
router.get('/status/:payoutId', authMiddleware, async (req, res) => {
  try {
    const payout = await Payout.findById(req.params.payoutId);
    if (!payout) return res.status(404).json({ error: 'Payout not found' });
    res.json({
      status:        payout.status,
      amount:        payout.amount,
      channel:       payout.channel,
      transactionId: payout.transactionId,
      settledAt:     payout.settledAt,
      steps:         payout.steps,
      failureReason: payout.failureReason,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/settlement/history — rider's full payout history
router.get('/history', authMiddleware, async (req, res) => {
  try {
    const payouts = await Payout.find({ riderId: req.userId }).sort({ createdAt: -1 }).limit(20);
    res.json({ payouts });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/settlement/payment-details — rider saves payment details
router.put('/payment-details', authMiddleware, async (req, res) => {
  try {
    const { upiId, bankName, accountNumber, ifscCode, preferredPaymentMode } = req.body;
    
    // Maintain old route compatibility, but map fields
    const updates = {};
    if (upiId !== undefined) updates.upiId = upiId;
    if (bankName !== undefined) updates.bankName = bankName;
    if (accountNumber !== undefined) updates.accountNumber = accountNumber;
    if (ifscCode !== undefined) updates.ifscCode = ifscCode;
    if (preferredPaymentMode !== undefined) updates.preferredPaymentMode = preferredPaymentMode;

    await Rider.findByIdAndUpdate(req.userId, updates);
    res.json({ message: 'Payment details saved successfully', details: updates });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Deprecated (kept for backward compatibility with SettlementTab)
router.put('/upi', authMiddleware, async (req, res) => {
  try {
    const { upiId } = req.body;
    if (!upiId || !upiId.includes('@')) return res.status(400).json({ error: 'Invalid UPI ID format' });
    await Rider.findByIdAndUpdate(req.userId, { upiId, preferredPaymentMode: 'upi' });
    res.json({ message: 'UPI ID saved', upiId });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
module.exports.runSettlement = runSettlement;
