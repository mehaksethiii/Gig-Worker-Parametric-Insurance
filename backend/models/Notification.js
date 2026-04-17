const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  riderId: { type: mongoose.Schema.Types.ObjectId, ref: 'Rider', required: true },

  type: {
    type: String,
    enum: ['risk_high', 'claim_triggered', 'payout_processed', 'claim_flagged', 'system'],
    required: true,
  },

  title:   { type: String, required: true },
  body:    { type: String, required: true },

  // Optional linked documents
  claimId:  { type: mongoose.Schema.Types.ObjectId, ref: 'Claim'  },
  payoutId: { type: mongoose.Schema.Types.ObjectId, ref: 'Payout' },

  // Extra context (temperature, aqi, amount, txnId, etc.)
  meta: { type: mongoose.Schema.Types.Mixed, default: {} },

  read:      { type: Boolean, default: false },
  createdAt: { type: Date,    default: Date.now },
});

// Index for fast per-rider queries sorted by date
notificationSchema.index({ riderId: 1, createdAt: -1 });

module.exports = mongoose.model('Notification', notificationSchema);
