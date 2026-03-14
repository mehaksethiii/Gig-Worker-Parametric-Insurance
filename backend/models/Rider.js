const mongoose = require('mongoose');

const riderSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true
  },
  phone: {
    type: String,
    required: true,
    unique: true
  },
  city: {
    type: String,
    required: true
  },
  platform: {
    type: String,
    enum: ['Zomato', 'Swiggy', 'Both'],
    required: true
  },
  workingHours: {
    type: Number,
    required: true,
    min: 1,
    max: 24
  },
  insurancePlan: {
    name: String,
    premium: Number,
    maxPayout: Number
  },
  riskScore: {
    type: String,
    enum: ['Low', 'Medium', 'High'],
    default: 'Medium'
  },
  isActive: {
    type: Boolean,
    default: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Rider', riderSchema);
