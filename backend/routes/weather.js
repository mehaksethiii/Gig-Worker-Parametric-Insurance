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

// POST /api/weather/validate-disaster
// Validates any natural disaster report using hyper-local weather + crowd signal + movement
router.post('/validate-disaster', async (req, res) => {
  const { lat, lon, disasterType = 'flood', speedKmh = null, crowdCount = 0 } = req.body;
  if (!lat || !lon) return res.status(400).json({ error: 'lat and lon required' });

  // Per-disaster weather thresholds and what to check
  const DISASTER_WEATHER = {
    flood:      { field: 'rainfall',    threshold: THRESHOLDS.rainfall,    label: 'rainfall',     unit: 'mm' },
    cyclone:    { field: 'windSpeed',   threshold: 60,                     label: 'wind speed',   unit: 'km/h' },
    drought:    { field: 'temperature', threshold: THRESHOLDS.temperature, label: 'temperature',  unit: '°C' },
    heatwave:   { field: 'temperature', threshold: THRESHOLDS.temperature, label: 'temperature',  unit: '°C' },
    earthquake: { field: null,          threshold: null,                   label: null,           unit: null },
    landslide:  { field: 'rainfall',    threshold: 30,                     label: 'rainfall',     unit: 'mm' },
    lightning:  { field: 'rainfall',    threshold: 20,                     label: 'rainfall',     unit: 'mm' },
    smog:       { field: 'aqi',         threshold: THRESHOLDS.aqi,         label: 'AQI',          unit: '' },
  };

  const dConfig = DISASTER_WEATHER[disasterType] || DISASTER_WEATHER.flood;
  let weatherSnapshot = {};
  let weatherSource   = 'unavailable';

  try {
    if (OWM_KEY && OWM_KEY !== 'your_openweather_api_key_here') {
      const [wRes, airRes] = await Promise.all([
        axios.get(`https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${OWM_KEY}&units=metric`),
        axios.get(`https://api.openweathermap.org/data/2.5/air_pollution?lat=${lat}&lon=${lon}&appid=${OWM_KEY}`),
      ]);
      const w = wRes.data;
      weatherSnapshot = {
        rainfall:    w.rain?.['1h'] ?? w.rain?.['3h'] ?? 0,
        temperature: Math.round(w.main.temp),
        windSpeed:   Math.round(w.wind.speed * 3.6),
        aqi:         pm25ToAqi(airRes.data.list[0].components.pm2_5),
      };
      weatherSource = 'live';
    }
  } catch (_) { weatherSource = 'unavailable'; }

  let score = 0;
  const signals = [];

  // 1. Hyper-local weather signal for this disaster type (max 40 pts)
  if (dConfig.field && weatherSource === 'live') {
    const observed = weatherSnapshot[dConfig.field] ?? 0;
    if (observed >= dConfig.threshold) {
      score += 40;
      signals.push({ signal: dConfig.field, value: observed, pts: 40, note: `${observed}${dConfig.unit} ${dConfig.label} detected at your exact location` });
    } else if (observed >= dConfig.threshold * 0.6) {
      score += 20;
      signals.push({ signal: dConfig.field, value: observed, pts: 20, note: `${observed}${dConfig.unit} ${dConfig.label} — moderate conditions at your location` });
    } else {
      signals.push({ signal: dConfig.field, value: observed, pts: 0, note: `${dConfig.label} reading (${observed}${dConfig.unit}) below threshold at your location` });
    }
  } else if (dConfig.field === null) {
    // Earthquake — no weather signal, rely on crowd + movement
    score += 15;
    signals.push({ signal: 'no_weather_proxy', value: null, pts: 15, note: 'No weather proxy for earthquakes — crowd and movement signals weighted higher' });
  } else if (weatherSource === 'unavailable') {
    score += 15;
    signals.push({ signal: 'weather_unavailable', value: null, pts: 15, note: 'Weather API unavailable — neutral score applied' });
  }

  // 2. Movement speed (max 30 pts) — earthquake gets higher weight since no weather signal
  const movementMax = dConfig.field === null ? 40 : 30;
  if (speedKmh !== null) {
    if (speedKmh < 2) {
      score += movementMax;
      signals.push({ signal: 'movement', value: speedKmh, pts: movementMax, note: 'Stationary — consistent with being stuck or sheltering' });
    } else if (speedKmh < 8) {
      score += Math.round(movementMax * 0.5);
      signals.push({ signal: 'movement', value: speedKmh, pts: Math.round(movementMax * 0.5), note: 'Very slow movement — possible disruption' });
    } else {
      signals.push({ signal: 'movement', value: speedKmh, pts: 0, note: 'Moving normally — no disruption signal from speed' });
    }
  }

  // 3. Crowd corroboration (max 30 pts)
  if (crowdCount >= 3) {
    score += 30;
    signals.push({ signal: 'crowd', value: crowdCount, pts: 30, note: `${crowdCount} nearby riders confirmed same condition` });
  } else if (crowdCount >= 1) {
    score += 15;
    signals.push({ signal: 'crowd', value: crowdCount, pts: 15, note: `${crowdCount} nearby rider(s) reported same condition` });
  }

  const confidence = Math.min(100, score);
  const tier       = confidence >= 70 ? 'high' : confidence >= 40 ? 'medium' : 'low';

  res.json({
    validated: confidence >= 40,
    confidenceScore: confidence,
    tier,
    disasterType,
    weatherSnapshot,
    weatherSource,
    signals,
    message: confidence >= 40
      ? `${disasterType} condition validated (confidence: ${confidence}/100)`
      : `Insufficient evidence (confidence: ${confidence}/100) — claim will be reviewed`,
  });
});

// GET /api/weather/check-triggers
router.get('/check-triggers', async (req, res) => {
  try {
    const Rider  = require('../models/Rider');
    const Payout = require('../models/Payout');
    const riders = await Rider.find({ isActive: true });
    const triggered = [];

    for (const rider of riders) {
      const { data: wd } = await axios.get(`http://localhost:5000/api/weather/current/${encodeURIComponent(rider.city)}`);
      if (!wd.isDisruption) continue;

      const maxPayout = rider.insurancePlan?.maxPayout || 500;

      // ── 1. Daily cap: sum all payouts already made today ──────────────────
      const dayStart = new Date(); dayStart.setHours(0, 0, 0, 0);
      const todayPayouts = await Payout.find({
        riderId: rider._id,
        createdAt: { $gte: dayStart },
        status: { $in: ['completed', 'processing', 'pending'] },
      });
      const paidToday = todayPayouts.reduce((sum, p) => sum + p.amount, 0);
      if (paidToday >= maxPayout) continue; // already hit daily cap

      // ── 2. Cooldown: skip if a payout was made in the last 4 hours ────────
      const cooldownStart = new Date(Date.now() - 4 * 60 * 60 * 1000);
      const recentPayout = await Payout.findOne({
        riderId: rider._id,
        createdAt: { $gte: cooldownStart },
      });
      if (recentPayout) continue;

      // ── 3. Aggregate triggers — take highest-severity, not sum ────────────
      //    Severity weights: shutdown/AQI > heat > rain
      //    Each trigger contributes a % of estimated lost income, capped at 100%
      const severityMap = {
        rainfall:    Math.min(1, wd.rainfall    / THRESHOLDS.rainfall),
        temperature: Math.min(1, (wd.temperature - THRESHOLDS.temperature + 5) / 10),
        aqi:         Math.min(1, wd.aqi         / (THRESHOLDS.aqi * 2)),
      };
      // Combined severity = highest single trigger + 20% bonus per additional trigger
      const activeTriggers = wd.alerts.map(a => severityMap[a.type] || 0).sort((a, b) => b - a);
      const combinedSeverity = Math.min(
        1,
        activeTriggers[0] + activeTriggers.slice(1).reduce((s, v) => s + v * 0.2, 0)
      );

      const hoursLost      = rider.workingHours * combinedSeverity;
      const estimatedLoss  = Math.floor(hoursLost * 120);
      // ── 4. Cap at (maxPayout - already paid today) ────────────────────────
      const payoutAmount   = Math.min(estimatedLoss, maxPayout - paidToday);
      if (payoutAmount <= 0) continue;

      const payout = new Payout({
        riderId: rider._id,
        amount: payoutAmount,
        reason: wd.alerts.map(a => a.message).join(' + '),
        triggerData: { rainfall: wd.rainfall, temperature: wd.temperature, aqi: wd.aqi },
        estimatedLostIncome: estimatedLoss,
        status: 'completed',
        transactionId: `TXN${Date.now()}`,
      });
      await payout.save();
      triggered.push(payout);
    }
    res.json({ message: 'Trigger check completed', ridersChecked: riders.length, payoutsTriggered: triggered.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
