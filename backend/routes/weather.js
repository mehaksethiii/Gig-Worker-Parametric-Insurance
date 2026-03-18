const express = require('express');
const router  = express.Router();
const axios   = require('axios');

const OWM_KEY = process.env.OPENWEATHER_API_KEY;

const THRESHOLDS = { rainfall: 50, temperature: 42, aqi: 200 };

// Convert PM2.5 (µg/m³) → US AQI (0-500 scale)
function pm25ToAqi(pm) {
  const breakpoints = [
    [0,    12,    0,   50],
    [12.1, 35.4,  51,  100],
    [35.5, 55.4,  101, 150],
    [55.5, 150.4, 151, 200],
    [150.5,250.4, 201, 300],
    [250.5,350.4, 301, 400],
    [350.5,500.4, 401, 500],
  ];
  for (const [cLow, cHigh, iLow, iHigh] of breakpoints) {
    if (pm >= cLow && pm <= cHigh) {
      return Math.round(((iHigh - iLow) / (cHigh - cLow)) * (pm - cLow) + iLow);
    }
  }
  return 500;
}

// GET /api/weather/current/:city
router.get('/current/:city', async (req, res) => {
  const { city } = req.params;

  if (!OWM_KEY || OWM_KEY === 'your_openweather_api_key_here') {
    const mock = {
      city, rainfall: 0, temperature: 32, aqi: 95,
      description: 'Clear sky', humidity: 55, windSpeed: 12, feelsLike: 34,
      pm25: 18, source: 'mock', timestamp: new Date(),
    };
    mock.alerts = buildAlerts(mock);
    mock.isDisruption = mock.alerts.length > 0;
    return res.json(mock);
  }

  try {
    // Step 1 — geocode city name → lat/lon (India first, then global fallback)
    let lat, lon, resolvedCity;

    const geoRes = await axios.get(
      `https://api.openweathermap.org/geo/1.0/direct?q=${encodeURIComponent(city)},IN&limit=5&appid=${OWM_KEY}`
    );

    let geoData = geoRes.data.filter(d => d.country === 'IN');

    // Fallback: search without country code (catches alternate spellings)
    if (!geoData.length) {
      const geoFallback = await axios.get(
        `https://api.openweathermap.org/geo/1.0/direct?q=${encodeURIComponent(city)}&limit=5&appid=${OWM_KEY}`
      );
      geoData = geoFallback.data.filter(d => d.country === 'IN');
    }

    if (!geoData.length) {
      return res.status(404).json({ error: `City "${city}" not found in India` });
    }

    ({ lat, lon, name: resolvedCity } = geoData[0]);

    // Step 2 — current weather
    const [weatherRes, airRes] = await Promise.all([
      axios.get(`https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${OWM_KEY}&units=metric`),
      axios.get(`https://api.openweathermap.org/data/2.5/air_pollution?lat=${lat}&lon=${lon}&appid=${OWM_KEY}`),
    ]);

    const w   = weatherRes.data;
    const air = airRes.data.list[0];

    const rainfall    = w.rain ? (w.rain['1h'] ?? w.rain['3h'] ?? 0) : 0;
    const temperature = Math.round(w.main.temp);
    const feelsLike   = Math.round(w.main.feels_like);
    const humidity    = w.main.humidity;
    const windSpeed   = Math.round(w.wind.speed * 3.6); // m/s → km/h
    const description = w.weather[0].description;
    const pm25        = air.components.pm2_5;
    const aqi         = pm25ToAqi(pm25);

    const result = {
      city: resolvedCity, lat, lon,
      rainfall, temperature, feelsLike,
      humidity, windSpeed, description,
      pm25: Math.round(pm25), aqi,
      source: 'live',
      timestamp: new Date(),
    };
    result.alerts      = buildAlerts(result);
    result.isDisruption = result.alerts.length > 0;

    res.json(result);
  } catch (err) {
    console.error('Weather API error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

function buildAlerts(data) {
  const alerts = [];
  if (data.rainfall    > THRESHOLDS.rainfall)    alerts.push({ type: 'rainfall',    message: 'Heavy rainfall detected',  value: data.rainfall });
  if (data.temperature > THRESHOLDS.temperature) alerts.push({ type: 'temperature', message: 'Extreme heat detected',     value: data.temperature });
  if (data.aqi         > THRESHOLDS.aqi)         alerts.push({ type: 'aqi',         message: 'Poor air quality detected', value: data.aqi });
  return alerts;
}

// GET /api/weather/check-triggers
router.get('/check-triggers', async (req, res) => {
  try {
    const Rider  = require('../models/Rider');
    const Payout = require('../models/Payout');
    const riders = await Rider.find({ isActive: true });
    const triggered = [];

    for (const rider of riders) {
      const { data: wd } = await axios.get(`http://localhost:5000/api/weather/current/${encodeURIComponent(rider.city)}`);
      if (wd.isDisruption) {
        const hoursLost     = rider.workingHours * 0.5;
        const estimatedLoss = Math.floor(hoursLost * 120);
        const payoutAmount  = Math.min(estimatedLoss, rider.insurancePlan.maxPayout);
        const payout = new Payout({
          riderId: rider._id, amount: payoutAmount,
          reason: wd.alerts.map(a => a.message).join(', '),
          triggerData: { rainfall: wd.rainfall, temperature: wd.temperature, aqi: wd.aqi },
          estimatedLostIncome: estimatedLoss,
          status: 'completed', transactionId: `TXN${Date.now()}`,
        });
        await payout.save();
        triggered.push(payout);
      }
    }
    res.json({ message: 'Trigger check completed', ridersChecked: riders.length, payoutsTriggered: triggered.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
