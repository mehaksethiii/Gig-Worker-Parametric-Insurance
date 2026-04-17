/**
 * weatherClaimCron.js
 * Runs every 1 hour — fetches weather + AQI for every active rider.
 * If temperature > 42°C OR AQI > 200 → calls POST /api/claims/auto-trigger
 * which creates a Claim (approved) + Payout in the database.
 */

const axios  = require('axios');
const Rider  = require('../models/Rider');
const Payout = require('../models/Payout');
const { notifyRiskHigh }    = require('./notificationService');
const { scoreWeatherRisk }  = require('./weatherRiskModel');

const OWM_KEY         = process.env.OPENWEATHER_API_KEY;
const INTERNAL_SECRET = process.env.INTERNAL_SECRET || 'internal_cron_secret';
const BASE_URL        = process.env.BASE_URL        || 'http://localhost:5000';

const TEMP_THRESHOLD = 42;
const AQI_THRESHOLD  = 200;
const RAIN_THRESHOLD = 50;

// ── helpers ──────────────────────────────────────────────────────────────────

function pm25ToAqi(pm) {
  const bp = [
    [0,    12,    0,   50],
    [12.1, 35.4,  51,  100],
    [35.5, 55.4,  101, 150],
    [55.5, 150.4, 151, 200],
    [150.5,250.4, 201, 300],
    [250.5,350.4, 301, 400],
    [350.5,500.4, 401, 500],
  ];
  for (const [cLow, cHigh, iLow, iHigh] of bp) {
    if (pm >= cLow && pm <= cHigh)
      return Math.round(((iHigh - iLow) / (cHigh - cLow)) * (pm - cLow) + iLow);
  }
  return 500;
}

/**
 * Fetch live weather + AQI for a city.
 * Returns { temperature, aqi, rainfall, description } or throws.
 */
async function fetchWeatherForCity(city) {
  if (!OWM_KEY || OWM_KEY === 'your_openweather_api_key_here') {
    // Mock data when no API key is configured
    return { temperature: 38, aqi: 95, rainfall: 0, description: 'mock data', source: 'mock' };
  }

  // Geocode city → lat/lon (India first)
  let geoData = [];
  const geoRes = await axios.get(
    `https://api.openweathermap.org/geo/1.0/direct?q=${encodeURIComponent(city)},IN&limit=5&appid=${OWM_KEY}`
  );
  geoData = geoRes.data.filter(d => d.country === 'IN');

  if (!geoData.length) {
    const fallback = await axios.get(
      `https://api.openweathermap.org/geo/1.0/direct?q=${encodeURIComponent(city)}&limit=5&appid=${OWM_KEY}`
    );
    geoData = fallback.data.filter(d => d.country === 'IN');
  }
  if (!geoData.length) throw new Error(`City "${city}" not found in India`);

  const { lat, lon } = geoData[0];

  const [weatherRes, airRes] = await Promise.all([
    axios.get(`https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${OWM_KEY}&units=metric`),
    axios.get(`https://api.openweathermap.org/data/2.5/air_pollution?lat=${lat}&lon=${lon}&appid=${OWM_KEY}`),
  ]);

  const w   = weatherRes.data;
  const air = airRes.data.list[0];

  return {
    temperature: Math.round(w.main.temp),
    aqi:         pm25ToAqi(air.components.pm2_5),
    rainfall:    w.rain ? (w.rain['1h'] ?? w.rain['3h'] ?? 0) : 0,
    description: w.weather[0].description,
    source:      'live',
  };
}

/**
 * Calculate payout amount based on ML risk score and rider plan.
 */
function calculatePayout(rider, weather, mlRiskScore) {
  const maxPayout = rider.insurancePlan?.maxPayout || 500;

  // Use ML score directly as severity (0–1 scale)
  // Score 55 = threshold, 100 = maximum severity
  const severity = Math.min(1, Math.max(0, (mlRiskScore - 40) / 60));

  const hoursLost     = (rider.workingHours || 8) * severity;
  const estimatedLoss = Math.floor(hoursLost * 120); // ₹120/hr baseline
  return {
    payoutAmount:    Math.min(estimatedLoss, maxPayout),
    estimatedLoss,
    severity,
  };
}

// ── main job ─────────────────────────────────────────────────────────────────

async function runWeatherClaimJob() {
  console.log(`\n⏰ [WeatherClaimCron] Starting at ${new Date().toISOString()}`);

  let riders;
  try {
    riders = await Rider.find({ isActive: true });
  } catch (err) {
    console.error('❌ [WeatherClaimCron] Failed to fetch riders:', err.message);
    return;
  }

  console.log(`   Checking ${riders.length} active rider(s)…`);

  let triggered = 0;
  let skipped   = 0;

  for (const rider of riders) {
    try {
      // ── 1. Fetch weather ────────────────────────────────────────────────
      const weather = await fetchWeatherForCity(rider.city);

      // ── 2. Score with ML model (replaces raw threshold checks) ──────────
      const mlResult      = scoreWeatherRisk({
        temperature: weather.temperature,
        aqi:         weather.aqi,
        rainfall:    weather.rainfall,
      });

      // Trigger if ML score ≥ 55 (Medium-High boundary) OR any hard threshold breached
      const heatTriggered = weather.temperature > TEMP_THRESHOLD;
      const aqiTriggered  = weather.aqi         > AQI_THRESHOLD;
      const rainTriggered = weather.rainfall     > RAIN_THRESHOLD;
      const mlTriggered   = mlResult.riskScore   >= 55;

      if (!heatTriggered && !aqiTriggered && !rainTriggered && !mlTriggered) {
        skipped++;
        continue;
      }

      // Fire risk-high notification regardless of whether a claim is created
      notifyRiskHigh({
        riderId:     rider._id,
        temperature: weather.temperature,
        aqi:         weather.aqi,
        city:        rider.city,
      }).catch(() => {});

      // ── 3. Calculate payout using ML risk score ─────────────────────────
      const { payoutAmount, estimatedLoss } = calculatePayout(rider, weather, mlResult.riskScore);
      if (payoutAmount <= 0) { skipped++; continue; }

      // ── 3. Delegate to /api/claims/auto-trigger ─────────────────────────
      const { data, status } = await axios.post(
        `${BASE_URL}/api/claims/auto-trigger`,
        {
          riderId:       rider._id,
          temperature:   weather.temperature,
          aqi:           weather.aqi,
          rainfall:      weather.rainfall,
          payoutAmount,
          estimatedLoss,
        },
        { headers: { 'x-internal-secret': INTERNAL_SECRET }, validateStatus: () => true }
      );

      if (status === 201) {
        triggered++;
        console.log(`   ✅ ${rider.name} (${rider.city}) — ₹${payoutAmount} | ML score:${mlResult.riskScore} temp:${weather.temperature}°C aqi:${weather.aqi}`);
      } else if (status === 409) {
        console.log(`   ⏭  ${rider.name} (${rider.city}) — ${data.error}`);
        skipped++;
      } else {
        console.warn(`   ⚠️  ${rider.name} (${rider.city}) — HTTP ${status}: ${data.error}`);
        skipped++;
      }

    } catch (riderErr) {
      console.warn(`   ⚠️  Skipping ${rider.name} (${rider.city}): ${riderErr.message}`);
    }
  }

  console.log(`⏰ [WeatherClaimCron] Done — triggered: ${triggered}, skipped/no-trigger: ${skipped}\n`);
}

module.exports = { runWeatherClaimJob };
