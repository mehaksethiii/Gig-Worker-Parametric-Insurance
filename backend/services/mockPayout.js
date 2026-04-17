/**
 * mockPayout.js
 * Simulates a payment transfer for demo / development environments.
 *
 * What it does:
 *  1. Generates a realistic fake transaction ID
 *  2. Simulates a short network delay (300–800 ms)
 *  3. Saves transaction details to the Payout document
 *  4. Marks the linked Claim as "paid"
 *  5. Returns a full receipt object
 *
 * Set MOCK_PAYOUT=true in .env to force mock mode even when real keys exist.
 * In production (MOCK_PAYOUT unset / false) this module is bypassed and the
 * real settlement pipeline runs instead.
 */

const Payout = require('../models/Payout');
const Claim  = require('../models/Claim');
const { notifyPayoutProcessed } = require('./notificationService');

// ── ID generators ─────────────────────────────────────────────────────────────

const PREFIXES = ['TXN', 'PAY', 'RS', 'MOCK'];

/**
 * Generate a fake but realistic-looking transaction ID.
 * Format: <PREFIX>_<TIMESTAMP_BASE36>_<RANDOM_HEX>
 * Example: RS_LK3M2P_A4F9C1
 */
function generateTxnId() {
  const prefix    = PREFIXES[Math.floor(Math.random() * PREFIXES.length)];
  const timestamp = Date.now().toString(36).toUpperCase();
  const random    = Math.floor(Math.random() * 0xFFFFFF).toString(16).toUpperCase().padStart(6, '0');
  return `${prefix}_${timestamp}_${random}`;
}

/** UTR (Unique Transaction Reference) — used in UPI / IMPS receipts */
function generateUTR() {
  const bank = ['HDFC', 'ICIC', 'SBIN', 'AXIS', 'KOTK'][Math.floor(Math.random() * 5)];
  const digits = Math.floor(Math.random() * 1e12).toString().padStart(12, '0');
  return `${bank}${digits}`;
}

// ── Simulate network latency ──────────────────────────────────────────────────

function simulateDelay() {
  const ms = 300 + Math.floor(Math.random() * 500); // 300–800 ms
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ── Main export ───────────────────────────────────────────────────────────────

/**
 * processMockPayout(payout, rider)
 *
 * Runs the mock payment flow and persists results.
 *
 * @param {import('mongoose').Document} payout  - Payout document (already saved)
 * @param {import('mongoose').Document} rider   - Rider document
 * @returns {Promise<{
 *   success:       boolean,
 *   txnId:         string,
 *   utr:           string,
 *   channel:       string,
 *   amount:        number,
 *   settledAt:     Date,
 *   receipt:       object,
 * }>}
 */
async function processMockPayout(payout, rider) {
  const txnId     = generateTxnId();
  const utr       = generateUTR();
  const settledAt = new Date();

  // Determine display channel from rider preference
  const channelMap = { upi: 'UPI (mock)', bank: 'IMPS (mock)', sandbox: 'Sandbox' };
  const channel    = channelMap[rider.preferredPaymentMode] || 'Sandbox';

  // Simulate network delay
  await simulateDelay();

  // ── Update Payout document ────────────────────────────────────────────────
  payout.status        = 'completed';
  payout.transactionId = txnId;
  payout.channel       = rider.preferredPaymentMode === 'upi'  ? 'upi'
                       : rider.preferredPaymentMode === 'bank' ? 'imps'
                       : 'sandbox';
  payout.upiId         = rider.upiId || null;
  payout.settledAt     = settledAt;

  // Append settlement steps
  const existingSteps = payout.steps || [];
  const stepNames     = existingSteps.map(s => s.step);

  if (!stepNames.includes('trigger_confirmed')) {
    payout.steps.push({ step: 'trigger_confirmed',  status: 'done', timestamp: settledAt, detail: payout.reason });
  }
  if (!stepNames.includes('eligibility_check')) {
    payout.steps.push({ step: 'eligibility_check',  status: 'done', timestamp: settledAt, detail: `Plan: ${rider.insurancePlan?.name || 'Basic'}` });
  }
  if (!stepNames.includes('payout_calculated')) {
    payout.steps.push({ step: 'payout_calculated',  status: 'done', timestamp: settledAt, detail: `₹${payout.amount} approved` });
  }
  payout.steps.push({
    step:      'transfer_initiated',
    status:    'done',
    timestamp: settledAt,
    detail:    `${channel} — ₹${payout.amount} sent. TxnID: ${txnId} | UTR: ${utr}`,
  });
  payout.steps.push({
    step:      'record_updated',
    status:    'done',
    timestamp: settledAt,
    detail:    `Mock payout completed. TxnID: ${txnId}`,
  });

  await payout.save();

  // ── Mark linked Claim as "paid" ───────────────────────────────────────────
  if (payout.claimId) {
    await Claim.findByIdAndUpdate(payout.claimId, {
      status:    'paid',
      paymentId: txnId,
    });
  }

  const receipt = {
    txnId,
    utr,
    channel,
    amount:    payout.amount,
    riderId:   rider._id,
    riderName: rider.name,
    settledAt,
    payoutId:  payout._id,
    claimId:   payout.claimId || null,
    mode:      'mock',
  };

  console.log(`💸 [MockPayout] ${rider.name} — ₹${payout.amount} | TxnID: ${txnId} | UTR: ${utr}`);

  // Notify rider that payout was processed
  notifyPayoutProcessed({
    riderId:  rider._id,
    payoutId: payout._id,
    claimId:  payout.claimId || null,
    amount:   payout.amount,
    txnId,
    channel,
  }).catch(() => {});

  return { success: true, ...receipt };
}

/**
 * isMockMode()
 * Returns true when MOCK_PAYOUT=true in env OR when no real payment keys exist.
 */
function isMockMode() {
  if (process.env.MOCK_PAYOUT === 'true') return true;
  const hasCashfree = process.env.CASHFREE_CLIENT_ID && process.env.CASHFREE_CLIENT_SECRET;
  const hasRazorpay = process.env.RAZORPAY_KEY_ID    && process.env.RAZORPAY_KEY_SECRET;
  return !hasCashfree && !hasRazorpay;
}

module.exports = { processMockPayout, isMockMode, generateTxnId };
