const mongoose = require('mongoose');

const claimSchema = new mongoose.Schema({
  riderId: { type: mongoose.Schema.Types.ObjectId, ref: 'Rider', required: true },

  // ── Parametric trigger fields ─────────────────────────────────────────────
  triggerType: {
    type: String,
    enum: ['heat', 'rain', 'pollution', 'combined'],
    required: true,
  },
  payoutAmount: { type: Number, required: true },   // final approved payout in ₹

  // ── Legacy / extended fields (kept for backward compat) ───────────────────
  amount:  { type: Number },   // alias for payoutAmount on older docs
  reason:  { type: String },   // human-readable trigger description

  triggerData: {
    rainfall:    Number,   // mm
    temperature: Number,   // °C
    aqi:         Number,   // US AQI
    city:        String,
  },

  // Validation evidence (GPS, crowd, photo)
  validation: {
    gpsLat:          Number,
    gpsLon:          Number,
    gpsAccuracy:     Number,
    speedKmh:        Number,
    hyperLocalRain:  Number,
    crowdCount:      Number,
    photoUrl:        String,
    confidenceScore: Number,   // 0-100
    method:          String,   // 'auto' | 'user-reported' | 'crowd-corroborated'
  },

  // ── Status ────────────────────────────────────────────────────────────────
  status: {
    type: String,
    enum: ['pending', 'approved', 'paid', 'flagged', 'rejected'],
    default: 'pending',
  },

  fraudFlags: [String],
  paymentId:  String,
  createdAt:  { type: Date, default: Date.now },
});

// Virtual so old code reading .amount still works
claimSchema.virtual('effectiveAmount').get(function () {
  return this.payoutAmount ?? this.amount;
});

module.exports = mongoose.model('Claim', claimSchema);
