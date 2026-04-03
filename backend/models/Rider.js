const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const riderSchema = new mongoose.Schema({
  name:         { type: String, required: true },
  email:        { type: String, required: true, unique: true, lowercase: true },
  password:     { type: String, required: true },
  phone:        { type: String, required: true },
  city:         { type: String, required: true },
  workingHours: { type: Number, required: true, min: 1, max: 24 },
  deliveryType: { type: String, default: 'food' },
  platform:     { type: String, default: 'Other' },
  location: {
    lat: Number,
    lon: Number,
    zone: String,
  },
  insurancePlan: {
    name: String,
    premium: Number,
    maxPayout: Number,
    paymentId: String,
    activatedAt: Date,
  },
  upiId:        { type: String, default: '' },
  bankName:     { type: String, default: '' },
  accountNumber:{ type: String, default: '' },
  ifscCode:     { type: String, default: '' },
  preferredPaymentMode: { type: String, enum: ['upi', 'bank', 'sandbox'], default: 'sandbox' },
  familyEmail:  { type: String, default: '' },
  familyName:   { type: String, default: '' },
  familyRelation:{ type: String, default: '' },

  riskScore:    { type: Number, default: 70 },
  riskLevel:    { type: String, enum: ['Low','Medium','High'], default: 'Medium' },
  isActive:     { type: Boolean, default: true },
  createdAt:    { type: Date, default: Date.now },
});

riderSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

riderSchema.methods.comparePassword = function (plain) {
  return bcrypt.compare(plain, this.password);
};

module.exports = mongoose.model('Rider', riderSchema);
