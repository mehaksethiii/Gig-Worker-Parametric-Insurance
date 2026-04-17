const express      = require('express');
const jwt          = require('jsonwebtoken');
const Notification = require('../models/Notification');
const router       = express.Router();

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

// GET /api/notifications — fetch all for the authenticated rider
router.get('/', auth, async (req, res) => {
  try {
    const limit  = Math.min(parseInt(req.query.limit  ?? '30'), 100);
    const unread = req.query.unread === 'true';

    const query = { riderId: req.userId };
    if (unread) query.read = false;

    const notifications = await Notification.find(query)
      .sort({ createdAt: -1 })
      .limit(limit);

    const unreadCount = await Notification.countDocuments({ riderId: req.userId, read: false });

    res.json({ notifications, unreadCount });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/notifications/:id/read — mark one as read
router.patch('/:id/read', auth, async (req, res) => {
  try {
    const n = await Notification.findOneAndUpdate(
      { _id: req.params.id, riderId: req.userId },
      { read: true },
      { new: true },
    );
    if (!n) return res.status(404).json({ error: 'Not found' });
    res.json({ notification: n });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/notifications/read-all — mark all as read
router.patch('/read-all', auth, async (req, res) => {
  try {
    await Notification.updateMany({ riderId: req.userId, read: false }, { read: true });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/notifications/:id — delete one
router.delete('/:id', auth, async (req, res) => {
  try {
    await Notification.findOneAndDelete({ _id: req.params.id, riderId: req.userId });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
