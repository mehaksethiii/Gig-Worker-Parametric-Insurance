/**
 * GET  /api/prediction/weekly          — prediction for the authenticated rider
 * GET  /api/prediction/weekly/:riderId — prediction for a specific rider (admin / internal)
 */

const express  = require('express');
const jwt      = require('jsonwebtoken');
const Rider    = require('../models/Rider');
const { predictWeeklyRisk } = require('../services/riskPredictor');
const router   = express.Router();

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

// ── GET /api/prediction/weekly ────────────────────────────────────────────────
router.get('/weekly', auth, async (req, res) => {
  try {
    const rider = await Rider.findById(req.userId).lean();
    if (!rider) return res.status(404).json({ error: 'Rider not found' });

    const prediction = await predictWeeklyRisk({
      riderId:      rider._id,
      city:         rider.city,
      workingHours: rider.workingHours,
      deliveryType: rider.deliveryType,
    });

    res.json({ prediction });
  } catch (err) {
    console.error('[Prediction] Error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/prediction/weekly/:riderId ───────────────────────────────────────
// Internal / admin use — protected by internal secret
router.get('/weekly/:riderId', async (req, res) => {
  const secret = req.headers['x-internal-secret'];
  if (secret !== (process.env.INTERNAL_SECRET || 'internal_cron_secret')) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  try {
    const rider = await Rider.findById(req.params.riderId).lean();
    if (!rider) return res.status(404).json({ error: 'Rider not found' });

    const prediction = await predictWeeklyRisk({
      riderId:      rider._id,
      city:         rider.city,
      workingHours: rider.workingHours,
      deliveryType: rider.deliveryType,
    });

    res.json({ prediction });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
