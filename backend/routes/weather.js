const express = require('express');
const router = express.Router();
const axios = require('axios');

const OPENWEATHER_API_KEY = process.env.OPENWEATHER_API_KEY || 'demo';
const AQICN_API_KEY = process.env.AQICN_API_KEY || 'demo';

// Thresholds
const THRESHOLDS = {
  rainfall: 50, // mm
  temperature: 42, // Celsius
  aqi: 400
};

// Get current weather data for a city
router.get('/current/:city', async (req, res) => {
  try {
    const { city } = req.params;

    // For demo purposes, return mock data
    const mockData = {
      city,
      rainfall: Math.floor(Math.random() * 80),
      temperature: 30 + Math.floor(Math.random() * 15),
      aqi: 100 + Math.floor(Math.random() * 400),
      timestamp: new Date()
    };

    // Check if any threshold is crossed
    const alerts = [];
    if (mockData.rainfall > THRESHOLDS.rainfall) {
      alerts.push({ type: 'rainfall', message: 'Heavy rainfall detected', value: mockData.rainfall });
    }
    if (mockData.temperature > THRESHOLDS.temperature) {
      alerts.push({ type: 'temperature', message: 'Extreme heat detected', value: mockData.temperature });
    }
    if (mockData.aqi > THRESHOLDS.aqi) {
      alerts.push({ type: 'aqi', message: 'Severe pollution detected', value: mockData.aqi });
    }

    res.json({
      ...mockData,
      alerts,
      isDisruption: alerts.length > 0
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Check triggers for all active riders
router.get('/check-triggers', async (req, res) => {
  try {
    const Rider = require('../models/Rider');
    const Payout = require('../models/Payout');

    const riders = await Rider.find({ isActive: true });
    const triggeredPayouts = [];

    for (const rider of riders) {
      // Get weather data for rider's city
      const weatherResponse = await axios.get(`http://localhost:5000/api/weather/current/${rider.city}`);
      const weatherData = weatherResponse.data;

      if (weatherData.isDisruption) {
        // Calculate lost income
        const hoursLost = rider.workingHours * 0.5; // Assume 50% productivity loss
        const avgHourlyEarning = 120; // ₹120 per hour
        const estimatedLoss = Math.floor(hoursLost * avgHourlyEarning);

        // Calculate payout (capped at plan limit)
        const payoutAmount = Math.min(estimatedLoss, rider.insurancePlan.maxPayout);

        // Create payout record
        const payout = new Payout({
          riderId: rider._id,
          amount: payoutAmount,
          reason: weatherData.alerts.map(a => a.message).join(', '),
          triggerData: {
            rainfall: weatherData.rainfall,
            temperature: weatherData.temperature,
            aqi: weatherData.aqi
          },
          estimatedLostIncome: estimatedLoss,
          status: 'completed',
          transactionId: `TXN${Date.now()}`
        });

        await payout.save();
        triggeredPayouts.push(payout);
      }
    }

    res.json({
      message: 'Trigger check completed',
      ridersChecked: riders.length,
      payoutsTriggered: triggeredPayouts.length,
      payouts: triggeredPayouts
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
