const express = require('express');
const router = express.Router();
const Payout = require('../models/Payout');

// Get all payouts for a rider
router.get('/rider/:riderId', async (req, res) => {
  try {
    const payouts = await Payout.find({ riderId: req.params.riderId })
      .sort({ createdAt: -1 });
    res.json(payouts);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get payout statistics
router.get('/stats/:riderId', async (req, res) => {
  try {
    const payouts = await Payout.find({ 
      riderId: req.params.riderId,
      status: 'completed'
    });

    const totalPayout = payouts.reduce((sum, p) => sum + p.amount, 0);
    const avgPayout = payouts.length > 0 ? totalPayout / payouts.length : 0;

    res.json({
      totalPayouts: payouts.length,
      totalAmount: totalPayout,
      averageAmount: Math.floor(avgPayout),
      recentPayouts: payouts.slice(0, 5)
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create manual payout (for testing)
router.post('/create', async (req, res) => {
  try {
    const payout = new Payout(req.body);
    await payout.save();
    res.status(201).json({ message: 'Payout created', payout });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
