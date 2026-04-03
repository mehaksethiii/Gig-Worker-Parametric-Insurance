/**
 * Cashfree Payouts Service
 * Docs: https://docs.cashfree.com/docs/payout-api-overview
 *
 * Flow:
 *  1. Authenticate → get bearer token (valid 30 min)
 *  2. Add beneficiary (rider's UPI ID)
 *  3. Request transfer
 *  4. Poll transfer status
 */

const axios = require('axios');

const BASE = process.env.CASHFREE_ENV === 'PROD'
  ? 'https://payout-api.cashfree.com'
  : 'https://payout-gamma.cashfree.com';   // sandbox

let _token = null;
let _tokenExpiry = 0;

// ── Step 1: Authenticate ─────────────────────────────────────────────────────
async function getToken() {
  if (_token && Date.now() < _tokenExpiry) return _token;

  const res = await axios.post(
    `${BASE}/payout/v1/authorize`,
    {},
    {
      headers: {
        'X-Client-Id':     process.env.CASHFREE_CLIENT_ID,
        'X-Client-Secret': process.env.CASHFREE_CLIENT_SECRET,
      },
    }
  );

  if (res.data.status !== 'SUCCESS') {
    throw new Error(`Cashfree auth failed: ${res.data.message}`);
  }

  _token = res.data.data.token;
  _tokenExpiry = Date.now() + 25 * 60 * 1000; // 25 min buffer
  return _token;
}

function authHeaders(token) {
  return {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
}

// ── Step 2: Add / verify beneficiary ─────────────────────────────────────────
async function ensureBeneficiary(token, beneId, upiId, name, email, phone) {
  // Check if already exists
  try {
    const check = await axios.get(`${BASE}/payout/v1/getBeneficiary/${beneId}`, {
      headers: authHeaders(token),
    });
    if (check.data.status === 'SUCCESS') return; // already exists
  } catch (_) {}

  // Create beneficiary
  const res = await axios.post(
    `${BASE}/payout/v1/addBeneficiary`,
    {
      beneId,
      name:    name  || 'RideShield Rider',
      email:   email || 'rider@rideshield.in',
      phone:   phone || '9999999999',
      vpa:     upiId,   // UPI Virtual Payment Address
      address: 'India',
      city:    'Delhi',
      state:   'Delhi',
      pincode: '110001',
    },
    { headers: authHeaders(token) }
  );

  if (res.data.status !== 'SUCCESS') {
    throw new Error(`Add beneficiary failed: ${res.data.message}`);
  }
}

// ── Step 3: Request transfer ──────────────────────────────────────────────────
async function requestTransfer(token, transferId, beneId, amount, remarks) {
  const res = await axios.post(
    `${BASE}/payout/v1/requestTransfer`,
    {
      beneId,
      amount:     String(amount),   // Cashfree expects string
      transferId,
      transferMode: 'UPI',
      remarks:    remarks || 'RideShield insurance payout',
    },
    { headers: authHeaders(token) }
  );

  if (res.data.status !== 'SUCCESS') {
    throw new Error(`Transfer request failed: ${res.data.message}`);
  }

  return res.data.data;
}

// ── Step 4: Get transfer status ───────────────────────────────────────────────
async function getTransferStatus(token, transferId) {
  const res = await axios.get(
    `${BASE}/payout/v1/getTransferStatus?transferId=${transferId}`,
    { headers: authHeaders(token) }
  );
  return res.data.data || {};
}

// ── Main export: full payout flow ─────────────────────────────────────────────
/**
 * sendUpiPayout({ riderId, upiId, amount, riderName, email, phone, reason })
 * Returns { success, transferId, status, utr, message }
 */
async function sendUpiPayout({ riderId, upiId, amount, riderName, email, phone, reason }) {
  if (!process.env.CASHFREE_CLIENT_ID || !process.env.CASHFREE_CLIENT_SECRET) {
    // Graceful sandbox simulation if keys not set
    return {
      success:    true,
      transferId: `SANDBOX_${riderId}_${Date.now()}`,
      status:     'SUCCESS',
      utr:        `UTR${Date.now()}`,
      channel:    'sandbox',
      message:    'Sandbox simulation (add Cashfree keys for real transfers)',
    };
  }

  const token      = await getToken();
  const beneId     = `RIDER_${riderId}`.slice(0, 50);
  const transferId = `RS_${riderId}_${Date.now()}`.slice(0, 40);

  // Add beneficiary
  await ensureBeneficiary(token, beneId, upiId, riderName, email, phone);

  // Request transfer
  await requestTransfer(token, transferId, beneId, amount, reason);

  // Poll status (up to 10s)
  let statusData = {};
  for (let i = 0; i < 5; i++) {
    await new Promise(r => setTimeout(r, 2000));
    statusData = await getTransferStatus(token, transferId);
    if (['SUCCESS', 'FAILED', 'REVERSED'].includes(statusData.transfer?.status)) break;
  }

  const txStatus = statusData.transfer?.status || 'PENDING';
  const utr      = statusData.transfer?.utr || null;

  return {
    success:    txStatus === 'SUCCESS',
    transferId,
    status:     txStatus,
    utr,
    channel:    'upi',
    message:    txStatus === 'SUCCESS'
      ? `₹${amount} sent to ${upiId} via UPI. UTR: ${utr}`
      : `Transfer status: ${txStatus}`,
  };
}

module.exports = { sendUpiPayout, getToken, getTransferStatus };
