const express = require('express');
const router = express.Router();

// Send email via Resend API (HTTPS — works on Render free tier)
const sendEmail = async ({ to, subject, html }) => {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error('RESEND_API_KEY not set');
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: 'RideShield <onboarding@resend.dev>', to, subject, html }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Resend error');
  return data;
};

const buildEmailHtml = ({ riderName, familyName, familyRelation, reason, claimAmount, status }) => {
  const isApproved = status === 'approved';
  return `
  <div style="font-family:'Segoe UI',Arial,sans-serif;max-width:560px;margin:auto;background:#ffffff;border-radius:18px;overflow:hidden;box-shadow:0 8px 32px rgba(0,0,0,0.12)">
    <!-- Header -->
    <div style="background:linear-gradient(135deg,#1e3a5f 0%,#2c5282 60%,#2b6cb0 100%);padding:2.5rem 2rem;text-align:center">
      <div style="font-size:2.5rem;margin-bottom:0.5rem">🛡️</div>
      <h1 style="color:white;margin:0;font-size:1.6rem;font-weight:800;letter-spacing:-0.5px">RideShield</h1>
      <p style="color:rgba(255,255,255,0.75);margin:0.4rem 0 0;font-size:0.9rem">Family Assurance — Automated Protection Alert</p>
    </div>

    <!-- Body -->
    <div style="padding:2rem 2.2rem">
      <p style="font-size:1.05rem;color:#2d3748;margin-top:0">
        Hi <strong style="color:#1e3a5f">${familyName}</strong> <span style="color:#718096;font-size:0.9rem">(${familyRelation})</span>,
      </p>
      <p style="color:#4a5568;line-height:1.8;font-size:0.95rem">
        We're reaching out because <strong>${riderName}</strong>'s delivery work has been affected today
        due to <strong style="color:#e53e3e">${reason}</strong>.
      </p>

      ${isApproved ? `
      <div style="background:linear-gradient(135deg,#f0fff4,#e6fffa);border:1.5px solid #48bb78;padding:1.2rem 1.4rem;border-radius:12px;margin:1.5rem 0">
        <p style="margin:0;color:#276749;font-weight:700;font-size:1rem">✅ Claim Approved — Payout Sent!</p>
        <p style="margin:0.6rem 0 0;color:#2d3748;font-size:0.92rem;line-height:1.7">
          <strong>₹${claimAmount}</strong> has been automatically transferred to ${riderName}'s account.
          Their earnings for today are fully protected. No action needed from anyone. ❤️
        </p>
      </div>` : `
      <div style="background:linear-gradient(135deg,#fffbeb,#fefcbf);border:1.5px solid #f6ad55;padding:1.2rem 1.4rem;border-radius:12px;margin:1.5rem 0">
        <p style="margin:0;color:#c05621;font-weight:700;font-size:1rem">⚠️ Coverage Activated — Please Don't Worry</p>
        <p style="margin:0.6rem 0 0;color:#2d3748;font-size:0.92rem;line-height:1.7">
          RideShield has automatically activated insurance coverage for ${riderName}.
          A payout of <strong>₹${claimAmount}</strong> is being processed right now.
          Their income is protected — no forms, no waiting.
        </p>
      </div>`}

      <p style="color:#4a5568;line-height:1.8;font-size:0.92rem">
        ${riderName} is safe. Our AI system detected the disruption and handled everything automatically —
        so they can focus on staying safe, and you don't need to worry. 🙏
      </p>

      <!-- Stats row -->
      <div style="display:flex;gap:1rem;margin:1.5rem 0;flex-wrap:wrap">
        <div style="flex:1;min-width:120px;background:#f7fafc;border-radius:10px;padding:0.9rem;text-align:center">
          <div style="font-size:1.4rem">💰</div>
          <div style="font-weight:700;color:#1e3a5f;font-size:1rem">₹${claimAmount}</div>
          <div style="color:#718096;font-size:0.75rem">Payout Amount</div>
        </div>
        <div style="flex:1;min-width:120px;background:#f7fafc;border-radius:10px;padding:0.9rem;text-align:center">
          <div style="font-size:1.4rem">⚡</div>
          <div style="font-weight:700;color:#1e3a5f;font-size:1rem">Auto</div>
          <div style="color:#718096;font-size:0.75rem">No Manual Steps</div>
        </div>
        <div style="flex:1;min-width:120px;background:#f7fafc;border-radius:10px;padding:0.9rem;text-align:center">
          <div style="font-size:1.4rem">🛡️</div>
          <div style="font-weight:700;color:#1e3a5f;font-size:1rem">Active</div>
          <div style="color:#718096;font-size:0.75rem">Coverage Status</div>
        </div>
      </div>
    </div>

    <!-- Footer -->
    <div style="background:#f7fafc;padding:1.2rem 2rem;border-top:1px solid #e2e8f0;text-align:center">
      <p style="color:#718096;font-size:0.8rem;margin:0;line-height:1.7">
        This message was sent automatically by <strong>RideShield</strong> on behalf of ${riderName}.<br/>
        We're here for your family — rain or shine, always. ❤️
      </p>
    </div>
  </div>`;
};

// POST /api/notify/family
router.post('/family', async (req, res) => {
  const { riderName, familyEmail, familyName, familyRelation, reason, claimAmount, status } = req.body;
  if (!familyEmail) return res.status(400).json({ error: 'No family email provided' });

  const isApproved = status === 'approved';
  const subject = isApproved
    ? `✅ ${riderName}'s earnings are secured today — RideShield ❤️`
    : `⚠️ Don't worry — RideShield is protecting ${riderName} right now`;

  try {
    const info = await sendEmail({
      to: familyEmail,
      subject,
      html: buildEmailHtml({ riderName, familyName, familyRelation, reason, claimAmount, status }),
    });
    console.log('✅ Family email sent to:', familyEmail, info.id);
    res.json({ success: true, id: info.id });
  } catch (err) {
    console.error('❌ Email error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/notify/test
router.get('/test', async (req, res) => {
  try {
    const info = await sendEmail({
      to: process.env.EMAIL_USER || 'test@example.com',
      subject: '✅ RideShield Email Test',
      html: '<h2>Email is working! 🎉</h2><p>Your RideShield Resend setup is configured correctly.</p>',
    });
    res.json({ success: true, id: info.id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
