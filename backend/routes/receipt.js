/**
 * receipt.js
 * ─────────────────────────────────────────────────────────────────────────────
 * GET /api/receipt/:payoutId   — returns a styled HTML receipt (printable PDF)
 * GET /api/receipt/:payoutId/json — returns receipt data as JSON
 *
 * The HTML response is designed to be printed/saved as PDF via browser print
 * or a headless PDF tool. No extra npm packages required.
 * ─────────────────────────────────────────────────────────────────────────────
 */

'use strict';

const express = require('express');
const jwt     = require('jsonwebtoken');
const Payout  = require('../models/Payout');
const Claim   = require('../models/Claim');
const Rider   = require('../models/Rider');
const router  = express.Router();

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

// ── Receipt data builder ──────────────────────────────────────────────────────
async function buildReceiptData(payoutId, userId) {
  const payout = await Payout.findById(payoutId).lean();
  if (!payout) throw new Error('Payout not found');
  if (userId && payout.riderId.toString() !== userId.toString()) {
    throw new Error('Unauthorized');
  }

  const [rider, claim] = await Promise.all([
    Rider.findById(payout.riderId).select('-password').lean(),
    payout.claimId ? Claim.findById(payout.claimId).lean() : null,
  ]);

  const channelLabel = {
    upi:     `UPI — ${rider?.upiId || 'N/A'}`,
    imps:    `IMPS — ${rider?.bankName || 'Bank Transfer'}`,
    sandbox: 'Sandbox (Demo)',
  }[payout.channel] || payout.channel || 'Sandbox';

  return {
    receiptNo:     `RS-${payout._id.toString().slice(-8).toUpperCase()}`,
    payoutId:      payout._id,
    transactionId: payout.transactionId || 'PENDING',
    amount:        payout.amount,
    status:        payout.status,
    channel:       channelLabel,
    settledAt:     payout.settledAt || payout.createdAt,
    createdAt:     payout.createdAt,
    reason:        payout.reason,
    steps:         payout.steps || [],
    rider: {
      name:  rider?.name  || 'Unknown',
      email: rider?.email || '',
      phone: rider?.phone || '',
      city:  rider?.city  || '',
      plan:  rider?.insurancePlan?.name || 'Basic',
    },
    claim: claim ? {
      id:          claim._id,
      triggerType: claim.triggerType,
      status:      claim.status,
      fraudFlags:  claim.fraudFlags || [],
    } : null,
    triggerData: payout.triggerData || {},
  };
}

// ── HTML receipt template ─────────────────────────────────────────────────────
function buildReceiptHTML(data) {
  const statusColor = data.status === 'completed' ? '#22c55e' : data.status === 'failed' ? '#ef4444' : '#f59e0b';
  const statusLabel = data.status === 'completed' ? '✅ PAID' : data.status === 'failed' ? '❌ FAILED' : '⏳ PENDING';
  const date = new Date(data.settledAt).toLocaleString('en-IN', {
    day: 'numeric', month: 'long', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });

  const stepsHTML = data.steps.map(s => `
    <tr>
      <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;color:#64748b;font-size:13px">${s.step.replace(/_/g,' ').replace(/\b\w/g,c=>c.toUpperCase())}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9">
        <span style="background:${s.status==='done'?'#dcfce7':s.status==='failed'?'#fee2e2':'#fef9c3'};color:${s.status==='done'?'#166534':s.status==='failed'?'#991b1b':'#854d0e'};padding:2px 8px;border-radius:999px;font-size:11px;font-weight:700">${s.status.toUpperCase()}</span>
      </td>
      <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;color:#475569;font-size:12px">${s.detail || ''}</td>
    </tr>
  `).join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>RideShield Payout Receipt — ${data.receiptNo}</title>
  <style>
    @media print {
      body { margin: 0; }
      .no-print { display: none !important; }
      .page { box-shadow: none !important; }
    }
    * { box-sizing: border-box; }
    body { font-family: 'Segoe UI', Arial, sans-serif; background: #f1f5f9; margin: 0; padding: 24px; }
    .page { max-width: 680px; margin: auto; background: white; border-radius: 20px; overflow: hidden; box-shadow: 0 8px 40px rgba(0,0,0,0.12); }
    .header { background: linear-gradient(135deg, #1e3a5f 0%, #2563eb 100%); padding: 32px 36px; color: white; }
    .header h1 { margin: 0; font-size: 26px; font-weight: 800; }
    .header p { margin: 4px 0 0; opacity: 0.75; font-size: 13px; }
    .badge { display: inline-block; background: rgba(255,255,255,0.15); border: 1px solid rgba(255,255,255,0.3); padding: 4px 14px; border-radius: 999px; font-size: 12px; margin-top: 12px; }
    .body { padding: 32px 36px; }
    .amount-box { background: linear-gradient(135deg, #f0fdf4, #dcfce7); border: 2px solid #22c55e; border-radius: 16px; padding: 24px; text-align: center; margin-bottom: 28px; }
    .amount-box .label { color: #166534; font-size: 13px; font-weight: 600; text-transform: uppercase; letter-spacing: 1px; }
    .amount-box .value { color: #15803d; font-size: 48px; font-weight: 900; margin: 8px 0 4px; }
    .amount-box .status { color: ${statusColor}; font-size: 16px; font-weight: 700; }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 24px; }
    .field { background: #f8fafc; border-radius: 10px; padding: 14px 16px; }
    .field .key { color: #94a3b8; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px; }
    .field .val { color: #1e293b; font-size: 14px; font-weight: 600; word-break: break-all; }
    .section-title { font-size: 13px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; margin: 24px 0 12px; }
    table { width: 100%; border-collapse: collapse; }
    .footer { background: #f8fafc; padding: 20px 36px; border-top: 1px solid #e2e8f0; text-align: center; }
    .footer p { color: #94a3b8; font-size: 12px; margin: 0; line-height: 1.8; }
    .print-btn { display: block; width: 100%; padding: 14px; background: #2563eb; color: white; border: none; border-radius: 10px; font-size: 15px; font-weight: 700; cursor: pointer; margin-bottom: 12px; }
    .print-btn:hover { background: #1d4ed8; }
  </style>
</head>
<body>
  <div class="page">
    <div class="header">
      <div style="font-size:32px;margin-bottom:8px">🛡️</div>
      <h1>RideShield</h1>
      <p>Parametric Insurance — Payout Receipt</p>
      <div class="badge">Receipt No: ${data.receiptNo}</div>
    </div>

    <div class="body">
      <div class="amount-box">
        <div class="label">Amount Transferred</div>
        <div class="value">₹${data.amount.toLocaleString('en-IN')}</div>
        <div class="status">${statusLabel}</div>
      </div>

      <div class="grid">
        <div class="field">
          <div class="key">Transaction ID</div>
          <div class="val">${data.transactionId}</div>
        </div>
        <div class="field">
          <div class="key">Payment Channel</div>
          <div class="val">${data.channel}</div>
        </div>
        <div class="field">
          <div class="key">Rider Name</div>
          <div class="val">${data.rider.name}</div>
        </div>
        <div class="field">
          <div class="key">City</div>
          <div class="val">${data.rider.city}</div>
        </div>
        <div class="field">
          <div class="key">Insurance Plan</div>
          <div class="val">${data.rider.plan}</div>
        </div>
        <div class="field">
          <div class="key">Settled At</div>
          <div class="val">${date}</div>
        </div>
        <div class="field" style="grid-column:1/-1">
          <div class="key">Reason</div>
          <div class="val">${data.reason}</div>
        </div>
        ${data.triggerData.temperature ? `
        <div class="field">
          <div class="key">Temperature</div>
          <div class="val">${data.triggerData.temperature}°C</div>
        </div>` : ''}
        ${data.triggerData.aqi ? `
        <div class="field">
          <div class="key">AQI</div>
          <div class="val">${data.triggerData.aqi}</div>
        </div>` : ''}
      </div>

      ${data.steps.length > 0 ? `
      <div class="section-title">Settlement Pipeline</div>
      <table>
        <thead>
          <tr style="background:#f8fafc">
            <th style="padding:8px 12px;text-align:left;font-size:11px;color:#94a3b8;font-weight:600;text-transform:uppercase">Step</th>
            <th style="padding:8px 12px;text-align:left;font-size:11px;color:#94a3b8;font-weight:600;text-transform:uppercase">Status</th>
            <th style="padding:8px 12px;text-align:left;font-size:11px;color:#94a3b8;font-weight:600;text-transform:uppercase">Detail</th>
          </tr>
        </thead>
        <tbody>${stepsHTML}</tbody>
      </table>` : ''}

      <div style="margin-top:28px" class="no-print">
        <button class="print-btn" onclick="window.print()">🖨️ Download / Print Receipt</button>
      </div>
    </div>

    <div class="footer">
      <p>
        This is an automatically generated receipt from <strong>RideShield</strong>.<br/>
        Payout ID: ${data.payoutId} | Generated: ${new Date().toLocaleString('en-IN')}<br/>
        For disputes, contact support@rideshield.in
      </p>
    </div>
  </div>
</body>
</html>`;
}

// ── Routes ────────────────────────────────────────────────────────────────────

// GET /api/receipt/:payoutId — HTML receipt (printable)
router.get('/:payoutId', auth, async (req, res) => {
  try {
    const data = await buildReceiptData(req.params.payoutId, req.userId);
    res.setHeader('Content-Type', 'text/html');
    res.send(buildReceiptHTML(data));
  } catch (err) {
    if (err.message === 'Unauthorized') return res.status(403).json({ error: 'Forbidden' });
    if (err.message === 'Payout not found') return res.status(404).json({ error: 'Payout not found' });
    res.status(500).json({ error: err.message });
  }
});

// GET /api/receipt/:payoutId/json — JSON receipt data
router.get('/:payoutId/json', auth, async (req, res) => {
  try {
    const data = await buildReceiptData(req.params.payoutId, req.userId);
    res.json({ receipt: data });
  } catch (err) {
    if (err.message === 'Unauthorized') return res.status(403).json({ error: 'Forbidden' });
    if (err.message === 'Payout not found') return res.status(404).json({ error: 'Payout not found' });
    res.status(500).json({ error: err.message });
  }
});

// GET /api/receipt/admin/:payoutId — admin access (no auth check on riderId)
router.get('/admin/:payoutId', (req, res, next) => {
  const key = req.headers['x-admin-key'] || req.query.key;
  if (key !== (process.env.ADMIN_SECRET || 'rideshield_admin_2026')) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  next();
}, async (req, res) => {
  try {
    const data = await buildReceiptData(req.params.payoutId, null);
    res.setHeader('Content-Type', 'text/html');
    res.send(buildReceiptHTML(data));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
