/**
 * RideShield Admin API
 * Protected by admin secret key (set ADMIN_SECRET in .env)
 */
const express = require('express');
const Rider   = require('../models/Rider');
const Claim   = require('../models/Claim');
const Payout  = require('../models/Payout');
const router  = express.Router();

// Simple admin auth middleware
const adminAuth = (req, res, next) => {
  const key = req.headers['x-admin-key'] || req.query.key;
  if (key !== (process.env.ADMIN_SECRET || 'rideshield_admin_2026')) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  next();
};

// GET /api/admin/stats — overview numbers
router.get('/stats', adminAuth, async (req, res) => {
  try {
    const [totalRiders, activePlans, totalClaims, approvedClaims, flaggedClaims, totalPayouts] = await Promise.all([
      Rider.countDocuments(),
      Rider.countDocuments({ 'insurancePlan.name': { $exists: true, $ne: null } }),
      Claim.countDocuments(),
      Claim.countDocuments({ status: 'Approved' }),
      Claim.countDocuments({ status: 'Flagged' }),
      Payout.aggregate([{ $match: { status: 'completed' } }, { $group: { _id: null, total: { $sum: '$amount' } } }]),
    ]);

    const todayStart = new Date(); todayStart.setHours(0,0,0,0);
    const [todayClaims, todayPayouts] = await Promise.all([
      Claim.countDocuments({ createdAt: { $gte: todayStart } }),
      Payout.countDocuments({ createdAt: { $gte: todayStart }, status: 'completed' }),
    ]);

    res.json({
      totalRiders,
      activePlans,
      totalClaims,
      approvedClaims,
      flaggedClaims,
      totalPayoutAmount: totalPayouts[0]?.total || 0,
      todayClaims,
      todayPayouts,
      approvalRate: totalClaims > 0 ? Math.round((approvedClaims / totalClaims) * 100) : 0,
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/admin/riders — all riders with plan info
router.get('/riders', adminAuth, async (req, res) => {
  try {
    const riders = await Rider.find().sort({ createdAt: -1 }).select('-password');
    res.json({ riders });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/admin/claims — all claims
router.get('/claims', adminAuth, async (req, res) => {
  try {
    const claims = await Claim.find().sort({ createdAt: -1 }).limit(100).populate('riderId', 'name city phone');
    res.json({ claims });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/admin/payouts — all payouts
router.get('/payouts', adminAuth, async (req, res) => {
  try {
    const payouts = await Payout.find().sort({ createdAt: -1 }).limit(100).populate('riderId', 'name city phone');
    res.json({ payouts });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// PUT /api/admin/claims/:id — approve or flag a claim
router.put('/claims/:id', adminAuth, async (req, res) => {
  try {
    const { status } = req.body;
    const claim = await Claim.findByIdAndUpdate(req.params.id, { status }, { new: true });
    res.json({ claim });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// DELETE /api/admin/riders/:id — deactivate rider
router.delete('/riders/:id', adminAuth, async (req, res) => {
  try {
    await Rider.findByIdAndUpdate(req.params.id, { isActive: false });
    res.json({ message: 'Rider deactivated' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
