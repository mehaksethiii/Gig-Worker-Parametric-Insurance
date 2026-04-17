"""
train_risk_model.py
────────────────────────────────────────────────────────────────────────────────
Real ML pipeline for Gig Worker Parametric Insurance Risk Prediction.

Dataset: Synthetically generated from Kaggle-style delivery/gig-worker datasets
         (Zomato Delivery, Urban Company, Indian Weather AQI datasets).
         Features mirror real-world distributions from those datasets.

Model:   RandomForestClassifier → riskLevel (Low / Medium / High)
         + calibrated riskScore (0–100) via probability output

Output:  ml-model/risk_model.pkl   — trained model + scaler bundle
         ml-model/model_info.json  — metadata, feature importance, accuracy

Run:     python ml-model/train_risk_model.py
────────────────────────────────────────────────────────────────────────────────
"""

import os
import json
import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestClassifier, GradientBoostingClassifier
from sklearn.preprocessing import StandardScaler, LabelEncoder
from sklearn.model_selection import train_test_split, cross_val_score
from sklearn.metrics import classification_report, accuracy_score, confusion_matrix
from sklearn.pipeline import Pipeline
import joblib

# ── Paths ─────────────────────────────────────────────────────────────────────
SCRIPT_DIR  = os.path.dirname(os.path.abspath(__file__))
MODEL_PATH  = os.path.join(SCRIPT_DIR, "risk_model.pkl")
INFO_PATH   = os.path.join(SCRIPT_DIR, "model_info.json")

# ── 1. Dataset Generation ─────────────────────────────────────────────────────
# Simulates a Kaggle-style dataset combining:
#   - Zomato/Swiggy delivery worker data (working hours, delivery type, city)
#   - IMD (India Meteorological Dept) weather data (temperature, rainfall)
#   - CPCB AQI data (air quality index)
#   - Urban gig worker survey data (experience, vehicle type)

np.random.seed(42)
N = 5000  # dataset size

print("=" * 60)
print("  RideShield ML Pipeline — Risk Model Training")
print("=" * 60)
print(f"\n📦 Generating synthetic Kaggle-style dataset ({N} samples)...")

# City profiles (based on real Indian city risk data)
CITIES = {
    "Mumbai":    {"temp_mean": 32, "temp_std": 4,  "aqi_mean": 120, "aqi_std": 60,  "rain_prob": 0.45, "rain_mean": 35, "base_risk": 0.78},
    "Delhi":     {"temp_mean": 35, "temp_std": 8,  "aqi_mean": 220, "aqi_std": 90,  "rain_prob": 0.25, "rain_mean": 15, "base_risk": 0.82},
    "Bangalore": {"temp_mean": 27, "temp_std": 3,  "aqi_mean": 85,  "aqi_std": 35,  "rain_prob": 0.35, "rain_mean": 20, "base_risk": 0.55},
    "Hyderabad": {"temp_mean": 33, "temp_std": 5,  "aqi_mean": 130, "aqi_std": 50,  "rain_prob": 0.30, "rain_mean": 18, "base_risk": 0.62},
    "Chennai":   {"temp_mean": 34, "temp_std": 4,  "aqi_mean": 110, "aqi_std": 45,  "rain_prob": 0.40, "rain_mean": 30, "base_risk": 0.72},
    "Kolkata":   {"temp_mean": 31, "temp_std": 5,  "aqi_mean": 160, "aqi_std": 70,  "rain_prob": 0.42, "rain_mean": 28, "base_risk": 0.75},
    "Pune":      {"temp_mean": 30, "temp_std": 4,  "aqi_mean": 95,  "aqi_std": 40,  "rain_prob": 0.32, "rain_mean": 22, "base_risk": 0.58},
}

DELIVERY_TYPES = ["food", "grocery", "package", "pharmacy", "other"]
DELIVERY_RISK  = {"food": 0.72, "grocery": 0.62, "package": 0.52, "pharmacy": 0.58, "other": 0.57}
VEHICLE_TYPES  = ["bike", "scooter", "bicycle", "car"]
VEHICLE_RISK   = {"bike": 0.70, "scooter": 0.65, "bicycle": 0.80, "car": 0.45}

city_names = list(CITIES.keys())
city_probs = [0.20, 0.22, 0.15, 0.13, 0.12, 0.10, 0.08]  # realistic distribution

rows = []
for i in range(N):
    city_name    = np.random.choice(city_names, p=city_probs)
    city         = CITIES[city_name]
    delivery     = np.random.choice(DELIVERY_TYPES)
    vehicle      = np.random.choice(VEHICLE_TYPES, p=[0.45, 0.30, 0.10, 0.15])
    working_hrs  = np.random.normal(8, 2.5)
    working_hrs  = float(np.clip(working_hrs, 2, 16))
    experience   = float(np.random.exponential(2.5))  # years, skewed toward newer workers
    experience   = float(np.clip(experience, 0.1, 15))

    # Weather features (city-specific distributions)
    temperature  = float(np.random.normal(city["temp_mean"], city["temp_std"]))
    temperature  = float(np.clip(temperature, 10, 55))
    aqi          = float(np.random.normal(city["aqi_mean"], city["aqi_std"]))
    aqi          = float(np.clip(aqi, 10, 500))
    has_rain     = np.random.random() < city["rain_prob"]
    rainfall     = float(np.random.exponential(city["rain_mean"])) if has_rain else 0.0
    rainfall     = float(np.clip(rainfall, 0, 150))
    humidity     = float(np.random.normal(65, 15))
    humidity     = float(np.clip(humidity, 20, 100))
    wind_speed   = float(np.random.exponential(12))
    wind_speed   = float(np.clip(wind_speed, 0, 80))

    # City risk level (0–1 encoded)
    city_risk    = city["base_risk"]

    # ── Ground-truth risk score (domain-rule labelling) ──────────────────────
    score = 10.0  # baseline

    # Temperature contribution (exponential above threshold)
    if temperature > 45:   score += 35 + (temperature - 45) * 3
    elif temperature > 42: score += 22 + (temperature - 42) * 4.3
    elif temperature > 38: score += 10 + (temperature - 38) * 3
    elif temperature > 32: score += (temperature - 32) * 1.5

    # AQI contribution
    if aqi > 300:          score += 35 + (aqi - 300) * 0.05
    elif aqi > 200:        score += 22 + (aqi - 200) * 0.13
    elif aqi > 150:        score += 10 + (aqi - 150) * 0.24
    elif aqi > 100:        score += (aqi - 100) * 0.20

    # Rainfall contribution
    if rainfall > 80:      score += 28 + (rainfall - 80) * 0.25
    elif rainfall > 50:    score += 18 + (rainfall - 50) * 0.33
    elif rainfall > 20:    score += (rainfall - 20) * 0.60

    # Wind speed (high wind = dangerous for 2-wheelers)
    if wind_speed > 50:    score += 15
    elif wind_speed > 30:  score += 8

    # Humidity (extreme humidity = heat stress)
    if humidity > 85:      score += 8
    elif humidity > 75:    score += 4

    # City baseline
    score += city_risk * 15

    # Working hours (longer = more fatigue risk)
    score += min(12, working_hrs) * 1.2

    # Delivery type risk
    score += DELIVERY_RISK[delivery] * 8

    # Vehicle risk
    score += VEHICLE_RISK[vehicle] * 6

    # Experience (inverse — more experience = lower risk)
    score -= min(experience, 8) * 1.5

    # Multi-trigger compound effect
    triggers = sum([temperature > 42, aqi > 200, rainfall > 50, wind_speed > 40])
    if triggers >= 2: score += 12 * (triggers - 1)

    # Add realistic noise
    score += np.random.normal(0, 4)
    score  = float(np.clip(score, 0, 100))

    # Label
    if score >= 68:   risk_level = "High"
    elif score >= 42: risk_level = "Medium"
    else:             risk_level = "Low"

    rows.append({
        "temperature":   round(temperature, 1),
        "aqi":           round(aqi, 1),
        "rainfall":      round(rainfall, 1),
        "humidity":      round(humidity, 1),
        "wind_speed":    round(wind_speed, 1),
        "working_hours": round(working_hrs, 1),
        "experience_yrs":round(experience, 1),
        "city_risk":     round(city_risk, 2),
        "delivery_risk": round(DELIVERY_RISK[delivery], 2),
        "vehicle_risk":  round(VEHICLE_RISK[vehicle], 2),
        "risk_score":    round(score, 1),
        "risk_level":    risk_level,
    })

df = pd.DataFrame(rows)

print(f"✅ Dataset generated: {len(df)} rows × {len(df.columns)} columns")
print(f"\n📊 Class distribution:")
print(df["risk_level"].value_counts().to_string())
print(f"\n📈 Feature statistics:")
print(df[["temperature","aqi","rainfall","working_hours","risk_score"]].describe().round(2).to_string())

# ── 2. Feature Engineering ────────────────────────────────────────────────────
print("\n🔧 Engineering features...")

# Interaction features (domain-informed)
df["heat_aqi_interaction"]  = (df["temperature"] / 50) * (df["aqi"] / 500)
df["rain_wind_interaction"]  = (df["rainfall"] / 150) * (df["wind_speed"] / 80)
df["fatigue_score"]          = (df["working_hours"] / 16) * (1 / (df["experience_yrs"] + 1))
df["heat_stress_index"]      = df["temperature"] * (df["humidity"] / 100)
df["multi_trigger"]          = (
    (df["temperature"] > 42).astype(int) +
    (df["aqi"] > 200).astype(int) +
    (df["rainfall"] > 50).astype(int)
)

FEATURE_COLS = [
    "temperature", "aqi", "rainfall", "humidity", "wind_speed",
    "working_hours", "experience_yrs", "city_risk",
    "delivery_risk", "vehicle_risk",
    "heat_aqi_interaction", "rain_wind_interaction",
    "fatigue_score", "heat_stress_index", "multi_trigger",
]

X = df[FEATURE_COLS].values
y = df["risk_level"].values
y_score = df["risk_score"].values

print(f"✅ Feature matrix: {X.shape[0]} samples × {X.shape[1]} features")

# ── 3. Train / Test Split ─────────────────────────────────────────────────────
X_train, X_test, y_train, y_test = train_test_split(
    X, y, test_size=0.20, random_state=42, stratify=y
)
print(f"\n📂 Train: {len(X_train)} | Test: {len(X_test)}")

# ── 4. Model Training ─────────────────────────────────────────────────────────
print("\n🤖 Training RandomForestClassifier...")

pipeline = Pipeline([
    ("scaler", StandardScaler()),
    ("model",  RandomForestClassifier(
        n_estimators=200,
        max_depth=12,
        min_samples_split=5,
        min_samples_leaf=2,
        max_features="sqrt",
        class_weight="balanced",
        random_state=42,
        n_jobs=-1,
    )),
])

pipeline.fit(X_train, y_train)

# ── 5. Evaluation ─────────────────────────────────────────────────────────────
y_pred = pipeline.predict(X_test)
acc    = accuracy_score(y_test, y_pred)

print(f"\n✅ Test Accuracy: {acc:.4f} ({acc*100:.1f}%)")
print("\n📋 Classification Report:")
print(classification_report(y_test, y_pred, target_names=["High", "Low", "Medium"]))

# Cross-validation
cv_scores = cross_val_score(pipeline, X, y, cv=5, scoring="accuracy")
print(f"📊 5-Fold CV Accuracy: {cv_scores.mean():.4f} ± {cv_scores.std():.4f}")

# Feature importance
rf_model   = pipeline.named_steps["model"]
importance = rf_model.feature_importances_
feat_imp   = dict(sorted(
    zip(FEATURE_COLS, importance.tolist()),
    key=lambda x: x[1], reverse=True
))

print("\n🌲 Top 10 Feature Importances:")
for feat, imp in list(feat_imp.items())[:10]:
    bar = "█" * int(imp * 100)
    print(f"  {feat:<28} {imp:.4f}  {bar}")

# ── 6. Save Model ─────────────────────────────────────────────────────────────
bundle = {
    "pipeline":     pipeline,
    "feature_cols": FEATURE_COLS,
    "label_classes": pipeline.classes_.tolist(),
}
joblib.dump(bundle, MODEL_PATH)
print(f"\n💾 Model saved → {MODEL_PATH}")

# Save metadata
model_info = {
    "model_type":       "RandomForestClassifier",
    "n_estimators":     200,
    "max_depth":        12,
    "training_samples": len(X_train),
    "test_samples":     len(X_test),
    "test_accuracy":    round(acc, 4),
    "cv_accuracy_mean": round(float(cv_scores.mean()), 4),
    "cv_accuracy_std":  round(float(cv_scores.std()), 4),
    "features":         FEATURE_COLS,
    "feature_importance": {k: round(v, 4) for k, v in feat_imp.items()},
    "classes":          pipeline.classes_.tolist(),
    "risk_thresholds":  {"High": "score >= 68", "Medium": "score >= 42", "Low": "score < 42"},
    "dataset_info": {
        "total_samples": N,
        "source": "Synthetic — based on Kaggle delivery/gig-worker + IMD weather + CPCB AQI distributions",
        "cities": list(CITIES.keys()),
        "class_distribution": df["risk_level"].value_counts().to_dict(),
    },
}
with open(INFO_PATH, "w") as f:
    json.dump(model_info, f, indent=2)
print(f"📄 Model info saved → {INFO_PATH}")

print("\n" + "=" * 60)
print("  Training complete! Model ready for inference.")
print("=" * 60)
