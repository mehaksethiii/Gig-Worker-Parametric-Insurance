const express = require('express');
const axios = require('axios');
const router = express.Router();

const OWM_KEY = process.env.OPENWEATHER_API_KEY;

// Hyper-local historical risk data per city
// Based on: avg annual flood days, heat days, strike frequency, waterlogging zones
const CITY_RISK = {
  Mumbai:    { weatherRisk: 0.88, areaRisk: 0.80, floodProne: true,  heatProne: false, strikeRisk: 0.6 },
  Delhi:     { weatherRisk: 0.72, areaRisk: 0.85, floodProne: false, heatProne: true,  strikeRisk: 0.8 },
  Bangalore: { weatherRisk: 0.62, areaRisk: 0.55, floodProne: false, heatProne: false, strikeRisk: 0.4 },
  Hyderabad: { weatherRisk: 0.68, areaRisk: 0.62, floodProne: false, heatProne: true,  strikeRisk: 0.5 },
  Chennai:   { weatherRisk: 0.82, areaRisk: 0.68, floodProne: true,  heatProne: true,  strikeRisk: 0.5 },
  Kolkata:   { weatherRisk: 0.78, areaRisk: 0.72, floodProne: true,  heatProne: false, strikeRisk: 0.7 },
  Pune:      { weatherRisk: 0.66, areaRisk: 0.58, floodProne: false, heatProne: false, strikeRisk: 0.4 },
};

// Seasonal risk multiplier (India monsoon = June-Sep)
function getSeasonalMultiplier() {
  const month = new Date().getMonth() + 1;
  if (month >= 6 && month <= 9) return 1.25;  // monsoon
  if (month >= 3 && month <= 5) return 1.15;  // summer heat
  if (month >= 11 || month <= 1) return 0.90; // winter = safer
  return 1.0;
}

// Simulated ML model: gradient-boosted risk score
// Features: city weather risk, area risk, live weather, work hours, delivery type, season, flood/heat prone
function mlRiskScore(features) {
  const {
    cityWeatherRisk, cityAreaRisk, liveWeatherRisk,
    workFactor, deliveryRisk, seasonMultiplier,
    floodProne, heatProne, strikeRisk,
  } = features;

  // Weighted feature combination (simulates trained model weights)
  const raw =
    cityWeatherRisk  * 0.22 +
    cityAreaRisk     * 0.18 +
    liveWeatherRisk  * 0.20 +
    workFactor       * 0.12 +
    deliveryRisk     * 0.08 +
    strikeRisk       * 0.10 +
    (floodProne ? 0.06 : 0) +
    (heatProne  ? 0.04 : 0);

  // Apply seasonal multiplier
  const adjusted = Math.min(1, raw * seasonMultiplier);

  // Sigmoid-like normalization to 0-100
  return Math.round(adjusted * 100);
}

// Dynamic premium: ±25% based on risk vs baseline
function calcDynamicPremium(base, riskScore) {
  const deviation = (riskScore - 50) / 50; // -1 to +1
  const adjustment = deviation * 0.25;
  return Math.round(base * (1 + adjustment));
}

// POST /api/premium/calculate
router.post('/calculate', async (req, res) => {
  try {
    const { city, workingHours, deliveryType, plan } = req.body;

    const cityData = CITY_RISK[city] || { weatherRisk: 0.65, areaRisk: 0.60, floodProne: false, heatProne: false, strikeRisk: 0.5 };

    // Live weather risk
    let liveWeatherRisk = 0.5;
    if (OWM_KEY && OWM_KEY !== 'your_openweather_api_key_here') {
      try {
        const geo = await axios.get(`https://api.openweathermap.org/geo/1.0/direct?q=${city},IN&limit=1&appid=${OWM_KEY}`);
        if (geo.data.length) {
          const { lat, lon } = geo.data[0];
          const w = await axios.get(`https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${OWM_KEY}&units=metric`);
          const rain = w.data.rain?.['1h'] || 0;
          const temp = w.data.main.temp;
          liveWeatherRisk = Math.min(1, (rain / 50) * 0.6 + (Math.max(0, temp - 35) / 10) * 0.4);
        }
      } catch (_) {}
    }

    const typeRisk   = { food: 0.72, grocery: 0.62, package: 0.52, other: 0.57 };
    const workFactor = Math.min(1, (workingHours || 8) / 12);
    const seasonal   = getSeasonalMultiplier();

    const riskScore = mlRiskScore({
      cityWeatherRisk: cityData.weatherRisk,
      cityAreaRisk:    cityData.areaRisk,
      liveWeatherRisk,
      workFactor,
      deliveryRisk:    typeRisk[deliveryType] || 0.62,
      seasonMultiplier: seasonal,
      floodProne:      cityData.floodProne,
      heatProne:       cityData.heatProne,
      strikeRisk:      cityData.strikeRisk,
    });

    const basePremiums = { Starter: 99, Basic: 199, Standard: 299, Premium: 399, Pro: 599, Enterprise: 999 };
    const base = basePremiums[plan] || 299;
    const dynamicPremium = calcDynamicPremium(base, riskScore);
    const riskLevel = riskScore >= 70 ? 'High' : riskScore >= 45 ? 'Medium' : 'Low';

    res.json({
      riskScore,
      riskLevel,
      dynamicPremium,
      basePremium: base,
      seasonalMultiplier: seasonal,
      breakdown: {
        cityWeatherRisk:  Math.round(cityData.weatherRisk * 100),
        cityAreaRisk:     Math.round(cityData.areaRisk * 100),
        liveWeatherRisk:  Math.round(liveWeatherRisk * 100),
        workFactor:       Math.round(workFactor * 100),
        seasonalFactor:   Math.round((seasonal - 1) * 100),
        floodProne:       cityData.floodProne,
        heatProne:        cityData.heatProne,
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
