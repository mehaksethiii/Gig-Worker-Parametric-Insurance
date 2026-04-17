/**
 * POST /api/predict-risk
 * ─────────────────────────────────────────────────────────────────────────────
 * Real ML-powered risk prediction endpoint.
 *
 * Replaces the old hardcoded if-else logic in riskScore.js with a trained
 * RandomForestClassifier (scikit-learn, 85.8% accuracy, 5000-sample dataset).
 *
 * Request body (all optional — sensible defaults applied):
 * {
 *   "temperature":    38,        // °C
 *   "aqi":            180,       // US AQI 0–500
 *   "rainfall":       5,         // mm/hr
 *   "humidity":       70,        // %
 *   "wind_speed":     12,        // km/h
 *   "working_hours":  9,         // hours per day
 *   "experience_yrs": 2,         // years of experience
 *   "city":           "Delhi",   // city name
 *   "delivery_type":  "food",    // food | grocery | package | pharmacy | other
 *   "vehicle_type":   "bike"     // bike | scooter | bicycle | car
 * }
 *
 * Response:
 * {
 *   "riskScore":     72,
 *   "riskLevel":     "High",
 *   "triggerType":   "heat",
 *   "confidence":    "High",
 *   "isDisruption":  true,
 *   "probabilities": { "Low": 0.05, "Medium": 0.18, "High": 0.77 },
 *   "modelVersion":  "1.0.0",
 *   "features":      { ... },
 *   "meta":          { "model": "RandomForest", "latencyMs": 312 }
 * }
 * ─────────────────────────────────────────────────────────────────────────────
 */

'use strict';

const express            = require('express');
const { runMLPrediction, CITY_RISK, DELIVERY_RISK, VEHICLE_RISK } = require('../services/mlRiskPredictor');
const router             = express.Router();

// ── POST /api/predict-risk ────────────────────────────────────────────────────
router.post('/', async (req, res) => {
  const startTime = Date.now();

  try {
    const {
      temperature,
      aqi,
      rainfall     = 0,
      humidity     = 65,
      wind_speed   = 10,
      working_hours = 8,
      experience_yrs = 2,
      city          = 'Delhi',
      delivery_type = 'food',
      vehicle_type  = 'bike',
    } = req.body;

    // ── Input validation ────────────────────────────────────────────────────
    if (temperature === undefined || aqi === undefined) {
      return res.status(400).json({
        error: 'temperature and aqi are required fields.',
        example: {
          temperature: 38, aqi: 180, rainfall: 5,
          city: 'Delhi', delivery_type: 'food',
        },
      });
    }

    const tempNum = parseFloat(temperature);
    const aqiNum  = parseFloat(aqi);

    if (isNaN(tempNum) || isNaN(aqiNum)) {
      return res.status(400).json({ error: 'temperature and aqi must be numeric.' });
    }
    if (tempNum < -10 || tempNum > 60) {
      return res.status(400).json({ error: 'temperature must be between -10 and 60 °C.' });
    }
    if (aqiNum < 0 || aqiNum > 500) {
      return res.status(400).json({ error: 'aqi must be between 0 and 500.' });
    }

    // ── Run ML prediction ───────────────────────────────────────────────────
    const prediction = await runMLPrediction({
      temperature:    tempNum,
      aqi:            aqiNum,
      rainfall:       parseFloat(rainfall)      || 0,
      humidity:       parseFloat(humidity)      || 65,
      wind_speed:     parseFloat(wind_speed)    || 10,
      working_hours:  parseFloat(working_hours) || 8,
      experience_yrs: parseFloat(experience_yrs)|| 2,
      city,
      delivery_type,
      vehicle_type,
    });

    const latencyMs = Date.now() - startTime;

    return res.json({
      ...prediction,
      meta: {
        model:      prediction._fallback ? 'rule-based-fallback' : 'RandomForestClassifier',
        accuracy:   prediction._fallback ? null : '85.8%',
        latencyMs,
        timestamp:  new Date().toISOString(),
      },
    });

  } catch (err) {
    console.error('[PredictRisk] Unexpected error:', err.message);
    return res.status(500).json({ error: 'Internal server error during risk prediction.' });
  }
});

// ── GET /api/predict-risk (convenience — query params) ───────────────────────
router.get('/', async (req, res) => {
  const startTime = Date.now();

  const temperature = parseFloat(req.query.temperature ?? 30);
  const aqi         = parseFloat(req.query.aqi         ?? 80);
  const rainfall    = parseFloat(req.query.rainfall    ?? 0);

  if ([temperature, aqi, rainfall].some(isNaN)) {
    return res.status(400).json({ error: 'temperature, aqi, and rainfall must be numbers.' });
  }

  try {
    const prediction = await runMLPrediction({
      temperature,
      aqi,
      rainfall,
      city:          req.query.city          || 'Delhi',
      delivery_type: req.query.delivery_type || 'food',
      vehicle_type:  req.query.vehicle_type  || 'bike',
      working_hours: parseFloat(req.query.working_hours  || 8),
      experience_yrs:parseFloat(req.query.experience_yrs || 2),
    });

    return res.json({
      ...prediction,
      meta: {
        model:     prediction._fallback ? 'rule-based-fallback' : 'RandomForestClassifier',
        accuracy:  prediction._fallback ? null : '85.8%',
        latencyMs: Date.now() - startTime,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// ── GET /api/predict-risk/model-info ─────────────────────────────────────────
router.get('/model-info', (req, res) => {
  const fs   = require('fs');
  const path = require('path');
  const infoPath = path.resolve(__dirname, '../../ml-model/model_info.json');

  try {
    const info = JSON.parse(fs.readFileSync(infoPath, 'utf8'));
    res.json(info);
  } catch {
    res.json({
      model_type:   'RandomForestClassifier',
      note:         'Run train_risk_model.py to generate model_info.json',
      features:     Object.keys(CITY_RISK),
      city_risk:    CITY_RISK,
      delivery_risk:DELIVERY_RISK,
      vehicle_risk: VEHICLE_RISK,
    });
  }
});

module.exports = router;
