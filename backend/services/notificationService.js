/**
 * notificationService.js
 * Central helper for creating and querying notifications.
 * Also sends email notifications for payouts and flagged claims.
 */

const Notification = require('../models/Notification');

// ── Email sender (Resend API) ─────────────────────────────────────────────────
async function sendEmail({ to, subject, html }) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey || !to) return null;
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method:  'POST',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body:    JSON.stringify({ from: 'RideShield <onboarding@resend.dev>', to, subject, html }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Resend error');
    console.log(`📧 [Email] Sent to ${to}: ${subject}`);
    return data;
  } catch (err) {
    console.warn(`📧 [Email] Failed to send to ${to}: ${err.message}`);
    return null;
  }
}

/**
 * Create and persist a notification.
 * Fire-and-forget safe — errors are logged, never thrown.
 */
async function createNotification({ riderId, type, title, body, claimId, payoutId, meta = {} }) {
  try {
    const n = new Notification({ riderId, type, title, body, claimId, payoutId, meta });
    await n.save();
    console.log(`🔔 [Notification] ${type} → rider ${riderId}: ${title}`);
    return n;
  } catch (err) {
    console.error('❌ [Notification] Failed to save:', err.message);
    return null;
  }
}

// ── Typed helpers ─────────────────────────────────────────────────────────────

function notifyRiskHigh({ riderId, temperature, aqi, city }) {
  const parts = [];
  if (temperature > 42) parts.push(`${temperature}°C heat`);
  if (aqi > 200)        parts.push(`AQI ${aqi}`);
  return createNotification({
    riderId,
    type:  'risk_high',
    title: '⚠️ High Risk Conditions Detected',
    body:  `${parts.join(' and ')} detected in ${city}. Your coverage is active.`,
    meta:  { temperature, aqi, city },
  });
}

function notifyClaimTriggered({ riderId, claimId, triggerType, amount, reason }) {
  return createNotification({
    riderId,
    type:    'claim_triggered',
    title:   '🛡️ Claim Automatically Triggered',
    body:    `A ${triggerType} claim of ₹${amount} has been raised. Reason: ${reason}`,
    claimId,
    meta:    { triggerType, amount, reason },
  });
}

async function notifyPayoutProcessed({ riderId, payoutId, claimId, amount, txnId, channel, riderEmail, riderName }) {
  // In-app notification
  await createNotification({
    riderId,
    type:     'payout_processed',
    title:    '💸 Payout Sent to Your Account',
    body:     `₹${amount} has been transferred via ${channel}. TxnID: ${txnId}`,
    claimId,
    payoutId,
    meta:     { amount, txnId, channel },
  });

  // Email notification
  if (riderEmail) {
    const html = `
    <div style="font-family:'Segoe UI',Arial,sans-serif;max-width:520px;margin:auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.10)">
      <div style="background:linear-gradient(135deg,#059669,#22c55e);padding:28px 28px 20px;text-align:center">
        <div style="font-size:40px">💸</div>
        <h2 style="color:white;margin:8px 0 0;font-size:22px;font-weight:800">Payout Sent!</h2>
        <p style="color:rgba(255,255,255,0.85);margin:4px 0 0;font-size:13px">RideShield Parametric Insurance</p>
      </div>
      <div style="padding:28px">
        <p style="color:#374151;font-size:15px">Hi <strong>${riderName || 'Rider'}</strong>,</p>
        <p style="color:#4b5563;line-height:1.7">Your insurance payout has been processed successfully.</p>
        <div style="background:#f0fdf4;border:1.5px solid #22c55e;border-radius:12px;padding:20px;text-align:center;margin:20px 0">
          <div style="color:#166534;font-size:13px;font-weight:600;text-transform:uppercase;letter-spacing:1px">Amount Transferred</div>
          <div style="color:#15803d;font-size:40px;font-weight:900;margin:8px 0">₹${amount}</div>
          <div style="color:#6b7280;font-size:13px">via ${channel}</div>
        </div>
        <table style="width:100%;border-collapse:collapse">
          <tr><td style="padding:8px 0;color:#9ca3af;font-size:13px">Transaction ID</td><td style="padding:8px 0;color:#111827;font-size:13px;font-weight:600;text-align:right">${txnId}</td></tr>
          <tr><td style="padding:8px 0;color:#9ca3af;font-size:13px;border-top:1px solid #f3f4f6">Channel</td><td style="padding:8px 0;color:#111827;font-size:13px;font-weight:600;text-align:right;border-top:1px solid #f3f4f6">${channel}</td></tr>
          <tr><td style="padding:8px 0;color:#9ca3af;font-size:13px;border-top:1px solid #f3f4f6">Date</td><td style="padding:8px 0;color:#111827;font-size:13px;font-weight:600;text-align:right;border-top:1px solid #f3f4f6">${new Date().toLocaleString('en-IN')}</td></tr>
        </table>
      </div>
      <div style="background:#f9fafb;padding:16px 28px;border-top:1px solid #e5e7eb;text-align:center">
        <p style="color:#9ca3af;font-size:12px;margin:0">RideShield — Protecting gig workers, automatically. ❤️</p>
      </div>
    </div>`;
    sendEmail({ to: riderEmail, subject: `✅ ₹${amount} payout sent — RideShield`, html }).catch(() => {});
  }
}

async function notifyClaimFlagged({ riderId, claimId, flags, riderEmail, riderName }) {
  // In-app notification
  await createNotification({
    riderId,
    type:    'claim_flagged',
    title:   '🚩 Claim Flagged for Review',
    body:    `Your claim has been flagged and is under manual review. Reason: ${flags[0] ?? 'Suspicious activity'}`,
    claimId,
    meta:    { flags },
  });

  // Email notification
  if (riderEmail) {
    const html = `
    <div style="font-family:'Segoe UI',Arial,sans-serif;max-width:520px;margin:auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.10)">
      <div style="background:linear-gradient(135deg,#dc2626,#ef4444);padding:28px;text-align:center">
        <div style="font-size:40px">🚩</div>
        <h2 style="color:white;margin:8px 0 0;font-size:20px;font-weight:800">Claim Under Review</h2>
      </div>
      <div style="padding:28px">
        <p style="color:#374151">Hi <strong>${riderName || 'Rider'}</strong>,</p>
        <p style="color:#4b5563;line-height:1.7">Your recent claim has been flagged for manual review by our fraud detection system.</p>
        <div style="background:#fef2f2;border:1.5px solid #ef4444;border-radius:12px;padding:16px;margin:16px 0">
          <p style="color:#991b1b;font-weight:700;margin:0 0 8px">Flags raised:</p>
          ${flags.map(f => `<p style="color:#7f1d1d;font-size:13px;margin:4px 0">• ${f}</p>`).join('')}
        </div>
        <p style="color:#4b5563;font-size:13px;line-height:1.7">Our team will review your claim within 24 hours. If approved, the payout will be processed immediately. No action is required from you.</p>
      </div>
      <div style="background:#f9fafb;padding:16px 28px;border-top:1px solid #e5e7eb;text-align:center">
        <p style="color:#9ca3af;font-size:12px;margin:0">RideShield — support@rideshield.in</p>
      </div>
    </div>`;
    sendEmail({ to: riderEmail, subject: `⚠️ Your RideShield claim is under review`, html }).catch(() => {});
  }
}

module.exports = {
  createNotification,
  notifyRiskHigh,
  notifyClaimTriggered,
  notifyPayoutProcessed,
  notifyClaimFlagged,
  sendEmail,
};
