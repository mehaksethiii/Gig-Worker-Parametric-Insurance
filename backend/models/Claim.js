const mongoose = require('mongoose');

const claimSchema = new mongoose.Schema({
  riderId:   { type: mongoose.Schema.Types.ObjectId, ref: 'Rider', required: true },
  amount:    { type: Number, required: true },
  reason:    { type: String, required: true },
  triggerData: {
    rainfall:    Number,
    temperature: Number,
    aqi:         Number,
    city:        String,
  },
  // Flood validation evidence
  validation: {
    gpsLat:          Number,   // rider's exact lat at claim time
    gpsLon:          Number,   // rider's exact lon at claim time
    gpsAccuracy:     Number,   // metres
    speedKmh:        Number,   // movement speed — low = stuck
    hyperLocalRain:  Number,   // OWM rainfall at exact GPS coords
    crowdCount:      Number,   // nearby riders who reported same condition
    photoUrl:        String,   // optional photo evidence
    confidenceScore: Number,   // 0-100 composite validation score
    method:          String,   // 'auto' | 'user-reported' | 'crowd-corroborated'
  },
  status: {
    type: String,
    enum: ['Processing', 'Approved', 'Flagged', 'Rejected'],
    default: 'Processing',
  },
  fraudFlags: [String],
  paymentId:  String,
  createdAt:  { type: Date, default: Date.now },
});

module.exports = mongoose.model('Claim', claimSchema);
