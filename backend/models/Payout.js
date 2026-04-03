const mongoose = require('mongoose');

const payoutSchema = new mongoose.Schema({
  riderId:            { type: mongoose.Schema.Types.ObjectId, ref: 'Rider', required: true },
  claimId:            { type: mongoose.Schema.Types.ObjectId, ref: 'Claim' },
  amount:             { type: Number, required: true },
  reason:             { type: String, required: true },
  triggerData:        { rainfall: Number, temperature: Number, aqi: Number },
  estimatedLostIncome:{ type: Number, required: true },

  // Settlement pipeline fields (from slide)
  channel:            { type: String, enum: ['upi', 'imps', 'sandbox'], default: 'sandbox' },
  upiId:              String,
  transactionId:      String,
  settledAt:          Date,
  failureReason:      String,
  rollbackAttempted:  { type: Boolean, default: false },

  // Step tracking
  steps: [{
    step:      String,   // 'trigger_confirmed' | 'eligibility_check' | 'payout_calculated' | 'transfer_initiated' | 'record_updated'
    status:    String,   // 'pending' | 'done' | 'failed'
    timestamp: Date,
    detail:    String,
  }],

  status: {
    type: String,
    enum: ['pending', 'processing', 'completed', 'failed', 'rolled_back'],
    default: 'pending',
  },
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('Payout', payoutSchema);
