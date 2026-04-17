const express = require('express');
const axios   = require('axios');
const jwt     = require('jsonwebtoken');
const Claim   = require('../models/Claim');
const Payout  = require('../models/Payout');
const Rider   = require('../models/Rider');
const { scoreWeatherRisk } = require('../services/weatherRiskModel');
const router  = express.Router();

const OWM_KEY    = process.env.OPENWEATHER_API_KEY;
const JWT_SECRET = process.env.JWT_SECRET || 'rideshield_secret_key';

const auth = (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    req.userId = jwt.verify(token, JWT_SECRET).id;
    next();
  } catch {
    res.status(401).json({ error: 'Unauthorized' });
  }
};

// ── Static city risk table ────────────────────────────────────────────────────
const CITY_RISK = {
  Mumbai:    { weatherRisk: 0.88, areaRisk: 0.80, floodProne: true,  heatProne: false, strikeRisk: 0.6, cityMultiplier: 1.20 },
  Delhi:     { weatherRisk: 0.72, areaRisk: 0.85, floodProne: false, heatProne: true,  strikeRisk: 0.8, cityMultiplier: 1.15 },
  Bangalore: { weatherRisk: 0.62, areaRisk: 0.55, floodProne: false, heatProne: false, strikeRisk: 0.4, cityMultiplier: 0.95 },
  Hyderabad: { weatherRisk: 0.68, areaRisk: 0.62, floodProne: false, heatProne: true,  strikeRisk: 0.5, cityMultiplier: 1.00 },
  Chennai:   { weatherRisk: 0.82, areaRisk: 0.68, floodProne: true,  heatProne: true,  strikeRisk: 0.5, cityMultiplier: 1.10 },
  Kolkata:   { weatherRisk: 0.78, areaRisk: 0.72, floodProne: true,  heatProne: false, strikeRisk: 0.7, cityMultiplier: 1.10 },
  Pune:      { weatherRisk: 0.66, areaRisk: 0.58, floodProne: false, heatProne: false, strikeRisk: 0.4, cityMultiplier: 0.98 },
};

const BASE_PREMIUMS = { Starter: 99, Basic: 199, Standard: 299, Premium: 399, Pro: 599, Enterprise: 999 };
const DELIVERY_RISK = { food: 0.72, grocery: 0.62, package: 0.52, other: 0.57 };

// ── Seasonal multiplier ───────────────────────────────────────────────────────
function getSeasonalMultiplier() {
  const m = new Date().getMonth() + 1;
  if (m >= 6 && m <= 9)  return { value: 1.25, label: 'Monsoon'    };
  if (m >= 3 && m <= 5)  return { value: 1.15, label: 'Summer'     };
  if (m >= 11 || m <= 1) return { value: 0.90, label: 'Winter'     };
  return                         { value: 1.00, label: 'Transition' };
}

// ── Core risk score (0–100) ───────────────────────────────────────────────────
function computeBaseRiskScore({ city, workingHours, deliveryType, liveWeatherRisk = 0.5 }) {
  const c          = CITY_RISK[city] ?? { weatherRisk: 0.65, areaRisk: 0.60, floodProne: false, heatProne: false, strikeRisk: 0.5 };
  const workFactor = Math.min(1, (workingHours || 8) / 12);
  const delRisk    = DELIVERY_RISK[deliveryType] ?? 0.62;
  const seasonal   = getSeasonalMultiplier().value;

  const raw =
    c.weatherRisk  * 0.22 +
    c.areaRisk     * 0.18 +
    liveWeatherRisk * 0.20 +
    workFactor     * 0.12 +
    delRisk        * 0.08 +
    c.strikeRisk   * 0.10 +
    (c.floodProne ? 0.06 : 0) +
    (c.heatProne  ? 0.04 : 0);

  return Math.round(Math.min(1, raw * seasonal) * 100);
}

// ── Claims-based loading factor ───────────────────────────────────────────────
// Analyses the rider's last 90 days of claims to compute a surcharge/discount.
//
// Rules:
//  • Each approved/paid claim in 90 days adds +3% loading (max +30%)
//  • Each flagged claim adds +5% loading (max +20%)
//  • Zero claims in 90 days → −10% no-claims discount
//  • Claim frequency > 5 in 30 days → +15% burst surcharge
//  • Total payout > ₹2000 in 30 days → +10% high-value surcharge
async function computeClaimsLoading(riderId) {
  const now   = new Date();
  const d90   = new Date(now - 90 * 86400000);
  const d30   = new Date(now - 30 * 86400000);

  const [claims90, payouts30] = await Promise.all([
    Claim.find({ riderId, createdAt: { $gte: d90 }, status: { $nin: ['rejected'] } }).lean(),
    Payout.find({ riderId, createdAt: { $gte: d30 }, status: { $in: ['completed', 'pending'] } }).lean(),
  ]);

  const approved = claims90.filter(c => ['approved', 'paid'].includes(c.status));
  const flagged  = claims90.filter(c => c.status === 'flagged');
  const recent30 = claims90.filter(c => new Date(c.createdAt) >= d30);
  const totalPaid30 = payouts30.reduce((s, p) => s + p.amount, 0);

  let loading = 0;
  const factors = [];

  // No-claims discount
  if (claims90.length === 0) {
    loading -= 0.10;
    factors.push({ label: 'No-claims discount', value: -10, type: 'discount' });
  }

  // Per-claim loading
  const claimLoading = Math.min(0.30, approved.length * 0.03);
  if (claimLoading > 0) {
    loading += claimLoading;
    factors.push({ label: `${approved.length} claim(s) in 90 days`, value: Math.round(claimLoading * 100), type: 'surcharge' });
  }

  // Fraud/flagged surcharge
  const flagLoading = Math.min(0.20, flagged.length * 0.05);
  if (flagLoading > 0) {
    loading += flagLoading;
    factors.push({ label: `${flagged.length} flagged claim(s)`, value: Math.round(flagLoading * 100), type: 'surcharge' });
  }

  // Burst surcharge
  if (recent30.length > 5) {
    loading += 0.15;
    factors.push({ label: `High claim frequency (${recent30.length} in 30 days)`, value: 15, type: 'surcharge' });
  }

  // High-value surcharge
  if (totalPaid30 > 2000) {
    loading += 0.10;
    factors.push({ label: `High payout volume (₹${totalPaid30} in 30 days)`, value: 10, type: 'surcharge' });
  }

  return {
    loadingFactor: Math.max(-0.15, Math.min(0.50, loading)), // clamp −15% to +50%
    factors,
    claimsAnalysed: claims90.length,
    approvedCount:  approved.length,
    flaggedCount:   flagged.length,
  };
}

// ── Live weather fetch (returns raw readings for the ML model) ────────────────
async function fetchLiveWeather(city) {
  if (!OWM_KEY || OWM_KEY === 'your_openweather_api_key_here') {
    return { temperature: 30, aqi: 80, rainfall: 0, source: 'mock' };
  }
  try {
    const geo = await axios.get(
      `https://api.openweathermap.org/geo/1.0/direct?q=${encodeURIComponent(city)},IN&limit=1&appid=${OWM_KEY}`
    );
    if (!geo.data.length) return { temperature: 30, aqi: 80, rainfall: 0, source: 'fallback' };
    const { lat, lon } = geo.data[0];
    const [wRes, airRes] = await Promise.all([
      axios.get(`https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${OWM_KEY}&units=metric`),
      axios.get(`https://api.openweathermap.org/data/2.5/air_pollution?lat=${lat}&lon=${lon}&appid=${OWM_KEY}`),
    ]);
    const w   = wRes.data;
    const pm  = airRes.data.list[0].components.pm2_5;
    // Convert PM2.5 → AQI (same breakpoints as weather.js)
    const aqi = pm25ToAqi(pm);
    return {
      temperature: Math.round(w.main.temp),
      aqi,
      rainfall: w.rain?.['1h'] ?? w.rain?.['3h'] ?? 0,
      source: 'live',
    };
  } catch {
    return { temperature: 30, aqi: 80, rainfall: 0, source: 'fallback' };
  }
}

function pm25ToAqi(pm) {
  const bp = [
    [0, 12, 0, 50], [12.1, 35.4, 51, 100], [35.5, 55.4, 101, 150],
    [55.5, 150.4, 151, 200], [150.5, 250.4, 201, 300],
    [250.5, 350.4, 301, 400], [350.5, 500.4, 401, 500],
  ];
  for (const [cL, cH, iL, iH] of bp) {
    if (pm >= cL && pm <= cH) return Math.round(((iH - iL) / (cH - cL)) * (pm - cL) + iL);
  }
  return 500;
}

// ── Core risk score — now powered by the Random Forest ML model ───────────────
// The ML score (0–100) from weather inputs is blended with city/work/delivery
// factors to produce the final premium risk score.
function computeBaseRiskScore({ mlWeatherScore, city, workingHours, deliveryType }) {
  const c          = CITY_RISK[city] ?? { weatherRisk: 0.65, areaRisk: 0.60, floodProne: false, heatProne: false, strikeRisk: 0.5 };
  const workFactor = Math.min(1, (workingHours || 8) / 12);
  const delRisk    = DELIVERY_RISK[deliveryType] ?? 0.62;
  const seasonal   = getSeasonalMultiplier().value;

  // ML weather score normalised to 0–1
  const mlNorm = mlWeatherScore / 100;

  const raw =
    mlNorm         * 0.35 +   // ML model replaces the old liveWeatherRisk + cityWeatherRisk combo
    c.areaRisk     * 0.18 +
    workFactor     * 0.12 +
    delRisk        * 0.08 +
    c.strikeRisk   * 0.10 +
    (c.floodProne ? 0.06 : 0) +
    (c.heatProne  ? 0.04 : 0) +
    0.07;                      // base offset (replaces old cityWeatherRisk * 0.22 floor)

  return Math.round(Math.min(1, raw * seasonal) * 100);
}

// ── Full premium calculation ──────────────────────────────────────────────────
async function calculateFullPremium(rider) {
  const city         = rider.city;
  const plan         = rider.insurancePlan?.name ?? 'Standard';
  const cityData     = CITY_RISK[city] ?? { cityMultiplier: 1.0, floodProne: false, heatProne: false };
  const seasonal     = getSeasonalMultiplier();
  const base         = BASE_PREMIUMS[plan] ?? 299;

  const [liveWeather, claimsData] = await Promise.all([
    fetchLiveWeather(city),
    computeClaimsLoading(rider._id),
  ]);

  // Run the ML model on live weather readings
  const mlResult = scoreWeatherRisk({
    temperature: liveWeather.temperature,
    aqi:         liveWeather.aqi,
    rainfall:    liveWeather.rainfall,
  });

  const riskScore = computeBaseRiskScore({
    mlWeatherScore: mlResult.riskScore,
    city,
    workingHours:   rider.workingHours,
    deliveryType:   rider.deliveryType,
  });

  const riskDeviation    = (riskScore - 50) / 50;
  const riskAdjustment   = 1 + riskDeviation * 0.25;
  const claimsAdjustment = 1 + claimsData.loadingFactor;

  const dynamicPremium = Math.round(
    base * cityData.cityMultiplier * seasonal.value * riskAdjustment * claimsAdjustment
  );

  const riskLevel = riskScore >= 70 ? 'High' : riskScore >= 45 ? 'Medium' : 'Low';

  const breakdown = [
    { label: 'Base Premium',          value: base,                                          type: 'base',     note: `${plan} plan` },
    { label: 'City Loading',          value: Math.round((cityData.cityMultiplier - 1)*100), type: cityData.cityMultiplier >= 1 ? 'surcharge' : 'discount', note: `${city} risk profile` },
    { label: 'Seasonal Factor',       value: Math.round((seasonal.value - 1) * 100),        type: seasonal.value >= 1 ? 'surcharge' : 'discount', note: seasonal.label },
    { label: 'ML Risk Score',         value: Math.round(riskDeviation * 25),                type: riskDeviation >= 0 ? 'surcharge' : 'discount', note: `RF model score ${riskScore}/100 (temp ${liveWeather.temperature}°C, AQI ${liveWeather.aqi}, rain ${liveWeather.rainfall}mm)` },
    ...claimsData.factors,
  ];

  return {
    basePremium:        base,
    dynamicPremium,
    riskScore,
    riskLevel,
    cityMultiplier:     cityData.cityMultiplier,
    seasonalMultiplier: seasonal.value,
    seasonLabel:        seasonal.label,
    claimsLoading:      Math.round(claimsData.loadingFactor * 100),
    breakdown,
    claimsSummary: {
      analysed: claimsData.claimsAnalysed,
      approved: claimsData.approvedCount,
      flagged:  claimsData.flaggedCount,
    },
    mlModel: {
      weatherRiskScore:  mlResult.riskScore,
      weatherRiskLevel:  mlResult.riskLevel,
      triggerType:       mlResult.triggerType,
      featureImportance: mlResult.featureImportance,
      inputs:            liveWeather,
    },
    savings:   dynamicPremium < base ? base - dynamicPremium : 0,
    surcharge: dynamicPremium > base ? dynamicPremium - base : 0,
  };
}

// ── Routes ────────────────────────────────────────────────────────────────────

// GET /api/premium/my — dynamic premium for the authenticated rider
router.get('/my', auth, async (req, res) => {
  try {
    const rider = await Rider.findById(req.userId).lean();
    if (!rider) return res.status(404).json({ error: 'Rider not found' });

    const result = await calculateFullPremium(rider);

    // Persist updated risk score back to rider document
    await Rider.findByIdAndUpdate(req.userId, {
      riskScore: result.riskScore,
      riskLevel: result.riskLevel,
    });

    res.json({ premium: result });
  } catch (err) {
    console.error('[Premium] Error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/premium/calculate — anonymous calculation (no auth, no claim history)
router.post('/calculate', async (req, res) => {
  try {
    const { city, workingHours, deliveryType, plan, temperature, aqi, rainfall } = req.body;

    // Use provided weather values or fetch live
    let weather = { temperature: temperature ?? 30, aqi: aqi ?? 80, rainfall: rainfall ?? 0, source: 'provided' };
    if (temperature == null) {
      weather = await fetchLiveWeather(city);
    }

    const mlResult    = scoreWeatherRisk(weather);
    const riskScore   = computeBaseRiskScore({ mlWeatherScore: mlResult.riskScore, city, workingHours, deliveryType });
    const cityData    = CITY_RISK[city] ?? { cityMultiplier: 1.0, floodProne: false, heatProne: false };
    const seasonal    = getSeasonalMultiplier();
    const base        = BASE_PREMIUMS[plan] ?? 299;
    const riskDev     = (riskScore - 50) / 50;
    const dynamicPremium = Math.round(base * cityData.cityMultiplier * seasonal.value * (1 + riskDev * 0.25));
    const riskLevel   = riskScore >= 70 ? 'High' : riskScore >= 45 ? 'Medium' : 'Low';

    res.json({
      riskScore, riskLevel, dynamicPremium, basePremium: base,
      seasonalMultiplier: seasonal.value,
      mlModel: {
        weatherRiskScore:  mlResult.riskScore,
        weatherRiskLevel:  mlResult.riskLevel,
        triggerType:       mlResult.triggerType,
        featureImportance: mlResult.featureImportance,
        inputs:            weather,
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
