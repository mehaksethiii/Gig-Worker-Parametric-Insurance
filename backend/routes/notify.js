const express = require('express');
const nodemailer = require('nodemailer');
const router = express.Router();

// POST /api/notify/family
router.post('/family', async (req, res) => {
  const { riderName, familyEmail, familyName, familyRelation, reason, claimAmount, status } = req.body;

  if (!familyEmail) return res.status(400).json({ error: 'No family email provided' });

  // Use Gmail or any SMTP — falls back to Ethereal (test) if no env vars
  let transporter;
  if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
    transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS },
    });
  } else {
    // Ethereal test account for demo
    const testAccount = await nodemailer.createTestAccount();
    transporter = nodemailer.createTransport({
      host: 'smtp.ethereal.email', port: 587,
      auth: { user: testAccount.user, pass: testAccount.pass },
    });
  }

  const isApproved = status === 'approved';

  const subject = isApproved
    ? `✅ Good news — ${riderName}'s earnings are secured today ❤️`
    : `⚠️ Don't worry — RideShield is protecting ${riderName}`;

  const html = `
    <div style="font-family:Arial,sans-serif;max-width:520px;margin:auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.1)">
      <div style="background:linear-gradient(135deg,#1e3a5f,#2c5282);padding:2rem;text-align:center">
        <h1 style="color:white;margin:0;font-size:1.5rem">🛡️ RideShield</h1>
        <p style="color:rgba(255,255,255,0.8);margin:0.5rem 0 0">Family Assurance Message</p>
      </div>
      <div style="padding:2rem">
        <p style="font-size:1rem;color:#2d3748">Hi <strong>${familyName}</strong> (${familyRelation}),</p>
        <p style="color:#4a5568;line-height:1.7">
          We wanted to let you know that <strong>${riderName}</strong>'s work has been affected today
          due to <strong>${reason}</strong>.
        </p>
        ${isApproved ? `
        <div style="background:#f0fff4;border-left:4px solid #48bb78;padding:1rem;border-radius:8px;margin:1.5rem 0">
          <p style="margin:0;color:#276749;font-weight:600">✅ Great news!</p>
          <p style="margin:0.5rem 0 0;color:#2d3748">
            ${riderName}'s claim of <strong>₹${claimAmount}</strong> has been approved.
            Their earnings for today are fully protected. ❤️
          </p>
        </div>` : `
        <div style="background:#fffbeb;border-left:4px solid #f6ad55;padding:1rem;border-radius:8px;margin:1.5rem 0">
          <p style="margin:0;color:#c05621;font-weight:600">⚠️ Please don't worry</p>
          <p style="margin:0.5rem 0 0;color:#2d3748">
            RideShield has automatically activated coverage for ${riderName}.
            Their income is being protected right now.
          </p>
        </div>`}
        <p style="color:#4a5568;line-height:1.7">
          ${riderName} is safe, and our system is working to ensure this situation
          doesn't impact your family's financial stability.
        </p>
        <p style="color:#718096;font-size:0.85rem;margin-top:2rem;border-top:1px solid #e2e8f0;padding-top:1rem">
          This message was sent by RideShield on behalf of ${riderName}.<br/>
          <em>We're here for you — always. ❤️</em>
        </p>
      </div>
    </div>
  `;

  try {
    const info = await transporter.sendMail({
      from: `"RideShield ❤️" <${process.env.EMAIL_USER || 'rideshield@demo.com'}>`,
      to: familyEmail,
      subject,
      html,
    });
    console.log('Family email sent:', nodemailer.getTestMessageUrl(info) || info.messageId);
    res.json({ success: true, preview: nodemailer.getTestMessageUrl(info) });
  } catch (err) {
    console.error('Email error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
