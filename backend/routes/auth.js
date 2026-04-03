const express = require('express');
const jwt = require('jsonwebtoken');
const Rider = require('../models/Rider');
const router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET || 'rideshield_secret_key';

const sign = (rider) => jwt.sign({ id: rider._id }, JWT_SECRET, { expiresIn: '30d' });

const safe = (rider) => ({
  id: rider._id,
  name: rider.name,
  email: rider.email,
  phone: rider.phone,
  city: rider.city,
  workingHours: rider.workingHours,
  deliveryType: rider.deliveryType,
  insurancePlan: rider.insurancePlan,
  riskScore: rider.riskScore,
  riskLevel: rider.riskLevel,
  upiId: rider.upiId,
  bankName: rider.bankName,
  accountNumber: rider.accountNumber,
  ifscCode: rider.ifscCode,
  preferredPaymentMode: rider.preferredPaymentMode,
  familyEmail: rider.familyEmail,
  familyName: rider.familyName,
  familyRelation: rider.familyRelation,
});

// POST /api/auth/register
router.post('/register', async (req, res) => {
  try {
    const { name, email, password, phone, city, workingHours, deliveryType,
            upiId, bankName, accountNumber, ifscCode, preferredPaymentMode,
            familyEmail, familyName, familyRelation } = req.body;
    if (await Rider.findOne({ email }))
      return res.status(400).json({ error: 'Email already registered. Please log in.' });

    const rider = new Rider({
      name, email, password, phone, city, workingHours, deliveryType,
      upiId: upiId || '', bankName: bankName || '',
      accountNumber: accountNumber || '', ifscCode: ifscCode || '',
      preferredPaymentMode: preferredPaymentMode || 'sandbox',
      familyEmail: familyEmail || '', familyName: familyName || '', familyRelation: familyRelation || '',
    });
    await rider.save();
    res.status(201).json({ token: sign(rider), rider: safe(rider) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const rider = await Rider.findOne({ email });
    if (!rider) return res.status(404).json({ error: 'No account found with this email.' });
    if (!(await rider.comparePassword(password)))
      return res.status(401).json({ error: 'Incorrect password.' });
    res.json({ token: sign(rider), rider: safe(rider) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/auth/me
router.get('/me', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'Unauthorized' });
    const { id } = jwt.verify(token, JWT_SECRET);
    const rider = await Rider.findById(id).select('-password');
    if (!rider) return res.status(404).json({ error: 'User not found' });
    res.json({ rider: safe(rider) });
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
});

// PUT /api/auth/update-plan
router.put('/update-plan', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    const { id } = jwt.verify(token, JWT_SECRET);
    const { plan, premium, maxPayout, paymentId } = req.body;
    const rider = await Rider.findByIdAndUpdate(id,
      { insurancePlan: { name: plan, premium, maxPayout, paymentId, activatedAt: new Date() } },
      { new: true }
    );
    res.json({ success: true, rider: safe(rider) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
