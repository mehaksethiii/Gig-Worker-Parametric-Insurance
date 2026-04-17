/**
 * RideShield Admin API
 * Protected by admin secret key (set ADMIN_SECRET in .env)
 */
const express      = require('express');
const Rider        = require('../models/Rider');
const Claim        = require('../models/Claim');
const Payout       = require('../models/Payout');
const Notification = require('../models/Notification');
const router       = express.Router();

const ADMIN_SECRET = process.env.ADMIN_SECRET || 'rideshield_admin_2026';

const adminAuth = (req, res, next) => {
  const key = req.headers['x-admin-key'] || req.query.key;
  if (key !== ADMIN_SECRET) return res.status(403).json({ error: 'Forbidden' });
  next();
};

// ── GET /api/admin/dashboard ──────────────────────────────────────────────────
// Single endpoint that returns everything the admin screen needs.
router.get('/dashboard', adminAuth, async (req, res) => {
  try {
    const now        = new Date();
    const todayStart = new Date(now); todayStart.setHours(0, 0, 0, 0);
    const day7       = new Date(now - 7  * 86400000);
    const day30      = new Date(now - 30 * 86400000);

    const [
      // ── Users ──────────────────────────────────────────────────────────────
      totalUsers,
      activeUsers,
      usersWithPlan,
      newUsersToday,
      newUsers7d,

      // ── Claims ─────────────────────────────────────────────────────────────
      totalClaims,
      pendingClaims,
      approvedClaims,
      paidClaims,
      flaggedClaims,
      rejectedClaims,
      claimsToday,
      claims7d,

      // ── Payouts ────────────────────────────────────────────────────────────
      payoutStats,
      payoutsToday,
      payouts7d,
      pendingPayouts,

      // ── Risk distribution ──────────────────────────────────────────────────
      riskDist,

      // ── Trigger type distribution ──────────────────────────────────────────
      triggerDist,

      // ── City distribution ──────────────────────────────────────────────────
      cityDist,

      // ── Fraud flags breakdown ──────────────────────────────────────────────
      fraudFlagBreakdown,

      // ── 30-day daily claim trend ───────────────────────────────────────────
      claimTrend,

      // ── Recent flagged claims ──────────────────────────────────────────────
      recentFlagged,

    ] = await Promise.all([
      // Users
      Rider.countDocuments(),
      Rider.countDocuments({ isActive: true }),
      Rider.countDocuments({ 'insurancePlan.name': { $exists: true, $ne: null } }),
      Rider.countDocuments({ createdAt: { $gte: todayStart } }),
      Rider.countDocuments({ createdAt: { $gte: day7 } }),

      // Claims
      Claim.countDocuments(),
      Claim.countDocuments({ status: 'pending' }),
      Claim.countDocuments({ status: 'approved' }),
      Claim.countDocuments({ status: 'paid' }),
      Claim.countDocuments({ status: 'flagged' }),
      Claim.countDocuments({ status: 'rejected' }),
      Claim.countDocuments({ createdAt: { $gte: todayStart } }),
      Claim.countDocuments({ createdAt: { $gte: day7 } }),

      // Payouts — total amount + count
      Payout.aggregate([
        { $match: { status: { $in: ['completed', 'pending'] } } },
        { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 }, avgAmount: { $avg: '$amount' } } },
      ]),
      Payout.countDocuments({ createdAt: { $gte: todayStart }, status: 'completed' }),
      Payout.countDocuments({ createdAt: { $gte: day7 },      status: 'completed' }),
      Payout.countDocuments({ status: 'pending' }),

      // Risk distribution across riders
      Rider.aggregate([
        { $group: { _id: '$riskLevel', count: { $sum: 1 } } },
      ]),

      // Trigger type distribution across claims
      Claim.aggregate([
        { $group: { _id: '$triggerType', count: { $sum: 1 } } },
      ]),

      // Top cities by claim count
      Claim.aggregate([
        { $group: { _id: '$triggerData.city', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 6 },
      ]),

      // Fraud flag text frequency
      Claim.aggregate([
        { $match: { status: 'flagged', fraudFlags: { $exists: true, $ne: [] } } },
        { $unwind: '$fraudFlags' },
        { $group: { _id: '$fraudFlags', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 5 },
      ]),

      // Daily claim count for last 30 days
      Claim.aggregate([
        { $match: { createdAt: { $gte: day30 } } },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
            count: { $sum: 1 },
            flagged: { $sum: { $cond: [{ $eq: ['$status', 'flagged'] }, 1, 0] } },
          },
        },
        { $sort: { _id: 1 } },
      ]),

      // 10 most recent flagged claims with rider info
      Claim.find({ status: 'flagged' })
        .sort({ createdAt: -1 })
        .limit(10)
        .populate('riderId', 'name city phone')
        .lean(),
    ]);

    // ── Normalise aggregation results ─────────────────────────────────────────
    const riskDistMap = { Low: 0, Medium: 0, High: 0 };
    riskDist.forEach(r => { if (r._id) riskDistMap[r._id] = r.count; });

    const triggerDistMap = { heat: 0, rain: 0, pollution: 0, combined: 0 };
    triggerDist.forEach(t => { if (t._id) triggerDistMap[t._id] = t.count; });

    const payoutTotal    = payoutStats[0]?.total    ?? 0;
    const payoutCount    = payoutStats[0]?.count     ?? 0;
    const payoutAvg      = Math.round(payoutStats[0]?.avgAmount ?? 0);
    const fraudRate      = totalClaims > 0 ? +((flaggedClaims / totalClaims) * 100).toFixed(1) : 0;
    const approvalRate   = totalClaims > 0 ? +((paidClaims + approvedClaims) / totalClaims * 100).toFixed(1) : 0;

    res.json({
      generatedAt: now.toISOString(),

      users: {
        total:       totalUsers,
        active:      activeUsers,
        withPlan:    usersWithPlan,
        newToday:    newUsersToday,
        new7d:       newUsers7d,
        planRate:    totalUsers > 0 ? +((usersWithPlan / totalUsers) * 100).toFixed(1) : 0,
      },

      claims: {
        total:       totalClaims,
        pending:     pendingClaims,
        approved:    approvedClaims,
        paid:        paidClaims,
        flagged:     flaggedClaims,
        rejected:    rejectedClaims,
        today:       claimsToday,
        last7d:      claims7d,
        fraudRate,
        approvalRate,
      },

      payouts: {
        totalAmount: payoutTotal,
        totalCount:  payoutCount,
        avgAmount:   payoutAvg,
        today:       payoutsToday,
        last7d:      payouts7d,
        pending:     pendingPayouts,
      },

      riskDistribution: riskDistMap,
      triggerDistribution: triggerDistMap,

      topCities: cityDist.map(c => ({ city: c._id ?? 'Unknown', count: c.count })),

      fraudFlagBreakdown: fraudFlagBreakdown.map(f => ({
        flag:  f._id,
        count: f.count,
      })),

      claimTrend: claimTrend.map(d => ({
        date:    d._id,
        total:   d.count,
        flagged: d.flagged,
      })),

      recentFlaggedClaims: recentFlagged.map(c => ({
        id:          c._id,
        riderName:   c.riderId?.name  ?? 'Unknown',
        riderCity:   c.riderId?.city  ?? '—',
        triggerType: c.triggerType,
        amount:      c.payoutAmount,
        flags:       c.fraudFlags,
        createdAt:   c.createdAt,
      })),
    });
  } catch (err) {
    console.error('[Admin Dashboard]', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── Existing routes (kept unchanged) ─────────────────────────────────────────

router.get('/stats', adminAuth, async (req, res) => {
  try {
    const [totalRiders, activePlans, totalClaims, approvedClaims, flaggedClaims, totalPayouts] = await Promise.all([
      Rider.countDocuments(),
      Rider.countDocuments({ 'insurancePlan.name': { $exists: true, $ne: null } }),
      Claim.countDocuments(),
      Claim.countDocuments({ status: 'approved' }),
      Claim.countDocuments({ status: 'flagged' }),
      Payout.aggregate([{ $match: { status: 'completed' } }, { $group: { _id: null, total: { $sum: '$amount' } } }]),
    ]);
    const todayStart = new Date(); todayStart.setHours(0,0,0,0);
    const [todayClaims, todayPayouts] = await Promise.all([
      Claim.countDocuments({ createdAt: { $gte: todayStart } }),
      Payout.countDocuments({ createdAt: { $gte: todayStart }, status: 'completed' }),
    ]);
    res.json({
      totalRiders, activePlans, totalClaims, approvedClaims, flaggedClaims,
      totalPayoutAmount: totalPayouts[0]?.total || 0,
      todayClaims, todayPayouts,
      approvalRate: totalClaims > 0 ? Math.round((approvedClaims / totalClaims) * 100) : 0,
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/riders', adminAuth, async (req, res) => {
  try {
    const riders = await Rider.find().sort({ createdAt: -1 }).select('-password');
    res.json({ riders });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/claims', adminAuth, async (req, res) => {
  try {
    const claims = await Claim.find().sort({ createdAt: -1 }).limit(100).populate('riderId', 'name city phone');
    res.json({ claims });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/payouts', adminAuth, async (req, res) => {
  try {
    const payouts = await Payout.find().sort({ createdAt: -1 }).limit(100).populate('riderId', 'name city phone');
    res.json({ payouts });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/claims/:id', adminAuth, async (req, res) => {
  try {
    const { status } = req.body;
    const claim = await Claim.findByIdAndUpdate(req.params.id, { status }, { new: true });
    res.json({ claim });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/riders/:id', adminAuth, async (req, res) => {
  try {
    await Rider.findByIdAndUpdate(req.params.id, { isActive: false });
    res.json({ message: 'Rider deactivated' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
