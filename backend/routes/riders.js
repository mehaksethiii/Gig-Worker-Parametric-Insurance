const express = require('express');
const router = express.Router();
const Rider = require('../models/Rider');

// Register new rider
router.post('/register', async (req, res) => {
  try {
    const { name, phone, city, platform, workingHours, insurancePlan, riskScore } = req.body;

    // Check if rider already exists
    const existingRider = await Rider.findOne({ phone });
    if (existingRider) {
      return res.status(400).json({ error: 'Rider already registered with this phone number' });
    }

    const rider = new Rider({
      name,
      phone,
      city,
      platform,
      workingHours,
      insurancePlan,
      riskScore
    });

    await rider.save();
    res.status(201).json({ message: 'Rider registered successfully', rider });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get rider by phone
router.get('/phone/:phone', async (req, res) => {
  try {
    const rider = await Rider.findOne({ phone: req.params.phone });
    if (!rider) {
      return res.status(404).json({ error: 'Rider not found' });
    }
    res.json(rider);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get all riders
router.get('/', async (req, res) => {
  try {
    const riders = await Rider.find({ isActive: true });
    res.json(riders);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update rider insurance plan
router.put('/:id/plan', async (req, res) => {
  try {
    const { insurancePlan } = req.body;
    const rider = await Rider.findByIdAndUpdate(
      req.params.id,
      { insurancePlan },
      { new: true }
    );
    res.json({ message: 'Insurance plan updated', rider });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
