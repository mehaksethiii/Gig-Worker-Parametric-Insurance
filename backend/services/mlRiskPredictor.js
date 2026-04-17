/**
 * mlRiskPredictor.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Bridges Node.js ↔ Python ML model.
 *
 * Spawns  ml-model/predict.py  as a child process, passes input as JSON via
 * argv[1], reads the JSON result from stdout.
 *
 * City / delivery / vehicle lookup tables mirror the training dataset so the
 * Node layer can resolve string inputs (e.g. "Delhi", "food") into the numeric
 * features the model expects.
 * ─────────────────────────────────────────────────────────────────────────────
 */

'use strict';

const { spawn }  = require('child_process');
const path       = require('path');

// ── Paths ─────────────────────────────────────────────────────────────────────
const PREDICT_SCRIPT = path.resolve(
  __dirname,
  '../../ml-model/predict.py',
);

// ── Lookup tables (must match training data) ──────────────────────────────────
const CITY_RISK = {
  Mumbai:    0.78, Delhi:     0.82, Bangalore: 0.55,
  Hyderabad: 0.62, Chennai:   0.72, Kolkata:   0.75, Pune: 0.58,
};

const DELIVERY_RISK = {
  food: 0.72, grocery: 0.62, package: 0.52, pharmacy: 0.58, other: 0.57,
};

const VEHICLE_RISK = {
  bike: 0.70, scooter: 0.65, bicycle: 0.80, car: 0.45,
};

// ── Core predictor ────────────────────────────────────────────────────────────

/**
 * runMLPrediction(input)
 *
 * @param {object} input
 * @param {number}  input.temperature    °C
 * @param {number}  input.aqi            US AQI 0–500
 * @param {number}  [input.rainfall]     mm/hr  (default 0)
 * @param {number}  [input.humidity]     %      (default 65)
 * @param {number}  [input.wind_speed]   km/h   (default 10)
 * @param {number}  [input.working_hours]       (default 8)
 * @param {number}  [input.experience_yrs]      (default 2)
 * @param {string}  [input.city]                (default 'Delhi')
 * @param {string}  [input.delivery_type]       (default 'food')
 * @param {string}  [input.vehicle_type]        (default 'bike')
 *
 * @returns {Promise<{
 *   riskScore:     number,
 *   riskLevel:     string,
 *   probabilities: object,
 *   triggerType:   string,
 *   confidence:    string,
 *   isDisruption:  boolean,
 *   modelVersion:  string,
 *   features:      object,
 * }>}
 */
function runMLPrediction(input = {}) {
  return new Promise((resolve, reject) => {
    // Resolve string fields → numeric risk values
    const city         = input.city          || 'Delhi';
    const deliveryType = input.delivery_type || 'food';
    const vehicleType  = input.vehicle_type  || 'bike';

    const payload = {
      temperature:   parseFloat(input.temperature   ?? 30),
      aqi:           parseFloat(input.aqi           ?? 80),
      rainfall:      parseFloat(input.rainfall      ?? 0),
      humidity:      parseFloat(input.humidity      ?? 65),
      wind_speed:    parseFloat(input.wind_speed    ?? 10),
      working_hours: parseFloat(input.working_hours ?? 8),
      experience_yrs:parseFloat(input.experience_yrs ?? 2),
      city_risk:     CITY_RISK[city]          ?? 0.65,
      delivery_risk: DELIVERY_RISK[deliveryType] ?? 0.62,
      vehicle_risk:  VEHICLE_RISK[vehicleType]   ?? 0.65,
    };

    const jsonArg = JSON.stringify(payload);

    const proc = spawn('python', [PREDICT_SCRIPT, jsonArg], {
      timeout: 15000,   // 15 s hard limit
    });

    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', chunk => { stdout += chunk.toString(); });
    proc.stderr.on('data', chunk => { stderr += chunk.toString(); });

    proc.on('close', code => {
      if (stderr) {
        console.warn('[ML] Python stderr:', stderr.trim());
      }

      try {
        const result = JSON.parse(stdout.trim());

        if (result.error) {
          console.error('[ML] Prediction error from Python:', result.error);
          // Return a safe fallback rather than crashing the request
          return resolve(fallbackPrediction(payload));
        }

        console.log('[ML] Prediction:', JSON.stringify({
          riskScore:   result.riskScore,
          riskLevel:   result.riskLevel,
          triggerType: result.triggerType,
          confidence:  result.confidence,
        }));

        resolve(result);
      } catch (parseErr) {
        console.error('[ML] Failed to parse Python output:', stdout);
        resolve(fallbackPrediction(payload));
      }
    });

    proc.on('error', err => {
      console.error('[ML] Failed to spawn Python process:', err.message);
      resolve(fallbackPrediction(payload));
    });
  });
}

/**
 * Fallback when Python process fails — uses simple threshold rules.
 * Ensures the API never returns 500 due to ML issues.
 */
function fallbackPrediction(payload) {
  const { temperature, aqi, rainfall } = payload;
  let score = 20;
  if (temperature > 42) score += 30;
  else if (temperature > 38) score += 15;
  if (aqi > 200) score += 30;
  else if (aqi > 150) score += 15;
  if (rainfall > 50) score += 20;
  score = Math.min(100, score);

  const riskLevel = score >= 68 ? 'High' : score >= 42 ? 'Medium' : 'Low';

  console.warn('[ML] Using fallback rule-based prediction (score:', score, ')');
  return {
    riskScore:     score,
    riskLevel,
    probabilities: {},
    triggerType:   'none',
    confidence:    'Low',
    isDisruption:  score >= 42,
    modelVersion:  'fallback-1.0',
    features:      payload,
    _fallback:     true,
  };
}

module.exports = { runMLPrediction, CITY_RISK, DELIVERY_RISK, VEHICLE_RISK };
