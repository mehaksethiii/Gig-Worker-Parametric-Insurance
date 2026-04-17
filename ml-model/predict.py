"""
predict.py
────────────────────────────────────────────────────────────────────────────────
Inference script called by the Node.js backend via child_process.spawn.

Usage (called by Node):
    python predict.py '{"temperature":38,"aqi":180,"rainfall":5,...}'

Reads input JSON from argv[1], loads the trained model, returns JSON to stdout.

Output JSON:
    {
      "riskScore":  72,
      "riskLevel":  "High",
      "probabilities": {"Low": 0.05, "Medium": 0.18, "High": 0.77},
      "triggerType": "heat",
      "confidence": "High",
      "modelVersion": "1.0.0"
    }
────────────────────────────────────────────────────────────────────────────────
"""

import sys
import json
import os
import numpy as np

# ── Paths ─────────────────────────────────────────────────────────────────────
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
MODEL_PATH = os.path.join(SCRIPT_DIR, "risk_model.pkl")

def load_model():
    try:
        import joblib
        return joblib.load(MODEL_PATH)
    except Exception as e:
        raise RuntimeError(f"Failed to load model from {MODEL_PATH}: {e}")

def resolve_trigger_type(temperature, aqi, rainfall, wind_speed=0):
    heat  = temperature > 42
    poll  = aqi > 200
    rain  = rainfall > 50
    wind  = wind_speed > 40
    count = sum([heat, poll, rain, wind])
    if count > 1:  return "combined"
    if heat:       return "heat"
    if poll:       return "pollution"
    if rain:       return "rain"
    if wind:       return "wind"
    return "none"

def build_features(inp, feature_cols):
    """Build feature vector from input dict, matching training feature order."""
    temperature   = float(inp.get("temperature",   30))
    aqi           = float(inp.get("aqi",           80))
    rainfall      = float(inp.get("rainfall",       0))
    humidity      = float(inp.get("humidity",      65))
    wind_speed    = float(inp.get("wind_speed",    10))
    working_hours = float(inp.get("working_hours",  8))
    experience    = float(inp.get("experience_yrs", 2))
    city_risk     = float(inp.get("city_risk",    0.65))
    delivery_risk = float(inp.get("delivery_risk", 0.62))
    vehicle_risk  = float(inp.get("vehicle_risk",  0.65))

    # Engineered features (must match training exactly)
    heat_aqi_interaction  = (temperature / 50) * (aqi / 500)
    rain_wind_interaction = (rainfall / 150) * (wind_speed / 80)
    fatigue_score         = (working_hours / 16) * (1 / (experience + 1))
    heat_stress_index     = temperature * (humidity / 100)
    multi_trigger         = int(temperature > 42) + int(aqi > 200) + int(rainfall > 50)

    feature_map = {
        "temperature":          temperature,
        "aqi":                  aqi,
        "rainfall":             rainfall,
        "humidity":             humidity,
        "wind_speed":           wind_speed,
        "working_hours":        working_hours,
        "experience_yrs":       experience,
        "city_risk":            city_risk,
        "delivery_risk":        delivery_risk,
        "vehicle_risk":         vehicle_risk,
        "heat_aqi_interaction": heat_aqi_interaction,
        "rain_wind_interaction":rain_wind_interaction,
        "fatigue_score":        fatigue_score,
        "heat_stress_index":    heat_stress_index,
        "multi_trigger":        multi_trigger,
    }

    return np.array([[feature_map[col] for col in feature_cols]])

def predict(inp):
    bundle       = load_model()
    pipeline     = bundle["pipeline"]
    feature_cols = bundle["feature_cols"]
    classes      = bundle["label_classes"]  # e.g. ['High', 'Low', 'Medium']

    X = build_features(inp, feature_cols)

    # Predicted class
    risk_level = pipeline.predict(X)[0]

    # Class probabilities
    proba = pipeline.predict_proba(X)[0]
    prob_dict = {cls: round(float(p), 4) for cls, p in zip(classes, proba)}

    # Convert probability to 0–100 risk score
    # Weighted: Low=20, Medium=55, High=85 (midpoints of each band)
    BAND_MIDPOINTS = {"Low": 20, "Medium": 55, "High": 85}
    risk_score = int(round(sum(
        prob_dict.get(cls, 0) * BAND_MIDPOINTS.get(cls, 50)
        for cls in ["Low", "Medium", "High"]
    )))
    risk_score = max(0, min(100, risk_score))

    # Confidence based on max probability
    max_prob = max(proba)
    confidence = "High" if max_prob >= 0.75 else "Medium" if max_prob >= 0.55 else "Low"

    trigger_type = resolve_trigger_type(
        inp.get("temperature", 30),
        inp.get("aqi", 80),
        inp.get("rainfall", 0),
        inp.get("wind_speed", 0),
    )

    return {
        "riskScore":     risk_score,
        "riskLevel":     risk_level,
        "probabilities": prob_dict,
        "triggerType":   trigger_type,
        "confidence":    confidence,
        "isDisruption":  trigger_type != "none",
        "modelVersion":  "1.0.0",
        "features": {
            "temperature":   inp.get("temperature", 30),
            "aqi":           inp.get("aqi", 80),
            "rainfall":      inp.get("rainfall", 0),
            "working_hours": inp.get("working_hours", 8),
        },
    }

if __name__ == "__main__":
    try:
        # Support two input modes:
        #   1. argv[1]  — Node.js passes JSON as first argument
        #   2. stdin    — fallback for piped input
        if len(sys.argv) >= 2 and sys.argv[1] not in ("--stdin", ""):
            raw = sys.argv[1]
        else:
            raw = sys.stdin.read().strip()

        if not raw:
            raise ValueError("No input JSON provided.")

        inp = json.loads(raw)
        result = predict(inp)
        print(json.dumps(result))

    except Exception as e:
        error_out = {"error": str(e), "riskScore": 50, "riskLevel": "Medium"}
        print(json.dumps(error_out))
        sys.exit(1)
