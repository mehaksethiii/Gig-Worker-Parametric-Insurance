/**
 * riskScore.js
 * ─────────────────────────────────────────────────────────────────────────────
 * GET  /api/risk-score                  — single score (ML-powered)
 * POST /api/risk-score/batch            — batch scoring (ML-powered)
 * GET  /api/risk-score/model-info       — model metadata
 *
 * Previously used a pure-JS random forest.
 * Now delegates to the trained scikit-learn RandomForestClassifier via
 * mlRiskPredictor.js → ml-model/predict.py
 * ─────────────────────────────────────────────────────────────────────────────
 */

'use strict';

const express = require('express');
const { runMLPrediction } = require('../services/mlRiskPredictor');
const router  = express.Router();

// ── GET /api/risk-score ───────────────────────────────────────────────────────
router.get('/', async (req, res) => {
  const temperature = parseFloat(req.query.temperature ?? 30);
  const aqi         = parseFloat(req.query.aqi         ?? 80);
  const rainfall    = parseFloat(req.query.rainfall    ?? 0);

  if ([temperature, aqi, rainfall].some(isNaN)) {
    return res.status(400).json({ error: 'temperature, aqi, and rainfall must be numbers.' });
  }

  try {
    const result = await runMLPrediction({ temperature, aqi, rainfall });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/risk-score/batch ────────────────────────────────────────────────
router.post('/batch', async (req, res) => {
  const { observations } = req.body;
  if (!Array.isArray(observations) || observations.length === 0) {
    return res.status(400).json({ error: 'observations must be a non-empty array.' });
  }
  if (observations.length > 50) {
    return res.status(400).json({ error: 'Max 50 observations per batch (ML model limit).' });
  }

  try {
    // Run predictions in parallel (capped at 10 concurrent to avoid overloading Python)
    const CHUNK = 10;
    const results = [];
    for (let i = 0; i < observations.length; i += CHUNK) {
      const chunk = observations.slice(i, i + CHUNK);
      const batch = await Promise.all(chunk.map(o => runMLPrediction(o)));
      results.push(...batch);
    }
    res.json({ results });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/risk-score/model-info ────────────────────────────────────────────
router.get('/model-info', (req, res) => {
  const fs   = require('fs');
  const path = require('path');
  const infoPath = path.resolve(__dirname, '../../ml-model/model_info.json');

  try {
    const info = JSON.parse(fs.readFileSync(infoPath, 'utf8'));
    res.json(info);
  } catch {
    res.json({
      model:       'RandomForestClassifier (scikit-learn)',
      note:        'Run train_risk_model.py to regenerate model_info.json',
      features:    ['temperature','aqi','rainfall','humidity','wind_speed',
                    'working_hours','experience_yrs','city_risk',
                    'delivery_risk','vehicle_risk',
                    'heat_aqi_interaction','rain_wind_interaction',
                    'fatigue_score','heat_stress_index','multi_trigger'],
      outputRange: '0–100',
      levels:      { Low: '0–41', Medium: '42–67', High: '68–100' },
    });
  }
});

module.exports = router;
