const express = require('express');
const router  = require('express').Router();
const Rider   = require('../models/Rider');
const bcrypt  = require('bcrypt');
const jwt     = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'rideshield_secret_key';

// 🚀 REGISTER
router.post('/register', async (req, res) => {
  try {
    const { name, phone, city, email, password, workingHours, deliveryType } = req.body;

    const existingUser = await Rider.findOne({ email: email.toLowerCase() });
    if (existingUser) return res.status(400).json({ error: 'User already exists' });

    const rider = new Rider({
      name, phone, city,
      email:        email.toLowerCase(),
      password,
      workingHours: workingHours || 8,
      deliveryType: deliveryType || 'food',
      platform:     'Other',
      riskScore:    50,
      riskLevel:    'Medium',
    });
    await rider.save();

    const token = jwt.sign({ id: rider._id }, JWT_SECRET, { expiresIn: '30d' });
    const { password: _, ...riderData } = rider.toObject();
    res.status(201).json({ message: 'Rider registered successfully', token, rider: riderData });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 🔐 LOGIN
router.post('/login', async (req, res) => {
  try {
    const email    = req.body.email?.toLowerCase();
    const password = req.body.password;
    if (!email || !password) return res.status(400).json({ error: 'Email and password required' });

    const user = await Rider.findOne({ email });
    if (!user) return res.status(400).json({ error: 'User not found' });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ error: 'Wrong password' });

    const token = jwt.sign({ id: user._id }, JWT_SECRET, { expiresIn: '30d' });
    const { password: _, ...userData } = user.toObject();
    res.json({ message: 'Login successful', token, user: userData });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 📊 GET ALL RIDERS
router.get('/', async (req, res) => {
  try {
    const riders = await Rider.find().select('-password');
    res.json(riders);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// 🗑 DELETE ALL (dev only)
router.get('/delete-all', async (req, res) => {
  try {
    await Rider.deleteMany({});
    res.json({ message: 'All users deleted' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;