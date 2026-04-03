"""
RideShield - Parametric Insurance Risk Model
Simulates a gradient-boosted ML model for dynamic premium pricing.
Features: city risk, live weather, work hours, delivery type, season, flood/heat prone zones.
"""

import json
from datetime import datetime

# Hyper-local city risk data
CITY_RISK = {
    "Mumbai":    {"weather": 0.88, "area": 0.80, "flood": True,  "heat": False, "strike": 0.6},
    "Delhi":     {"weather": 0.72, "area": 0.85, "flood": False, "heat": True,  "strike": 0.8},
    "Bangalore": {"weather": 0.62, "area": 0.55, "flood": False, "heat": False, "strike": 0.4},
    "Hyderabad": {"weather": 0.68, "area": 0.62, "flood": False, "heat": True,  "strike": 0.5},
    "Chennai":   {"weather": 0.82, "area": 0.68, "flood": True,  "heat": True,  "strike": 0.5},
    "Kolkata":   {"weather": 0.78, "area": 0.72, "flood": True,  "heat": False, "strike": 0.7},
    "Pune":      {"weather": 0.66, "area": 0.58, "flood": False, "heat": False, "strike": 0.4},
}

DELIVERY_RISK = {"food": 0.72, "grocery": 0.62, "package": 0.52, "other": 0.57}

BASE_PREMIUMS = {"Starter": 99, "Basic": 199, "Standard": 299, "Premium": 399, "Pro": 599, "Enterprise": 999}


def get_seasonal_multiplier():
    month = datetime.now().month
    if 6 <= month <= 9:   return 1.25  # monsoon
    if 3 <= month <= 5:   return 1.15  # summer
    if month >= 11 or month <= 1: return 0.90  # winter
    return 1.0


def ml_risk_score(city, working_hours, delivery_type, live_weather_risk=0.5):
    """
    Simulated gradient-boosted risk score (0-100).
    Weights derived from historical disruption data across Indian cities.
    """
    c = CITY_RISK.get(city, {"weather": 0.65, "area": 0.60, "flood": False, "heat": False, "strike": 0.5})
    work_factor   = min(1.0, working_hours / 12)
    delivery_risk = DELIVERY_RISK.get(delivery_type, 0.62)
    seasonal      = get_seasonal_multiplier()

    raw = (
        c["weather"]      * 0.22 +
        c["area"]         * 0.18 +
        live_weather_risk * 0.20 +
        work_factor       * 0.12 +
        delivery_risk     * 0.08 +
        c["strike"]       * 0.10 +
        (0.06 if c["flood"] else 0) +
        (0.04 if c["heat"]  else 0)
    )

    adjusted = min(1.0, raw * seasonal)
    return round(adjusted * 100)


def calculate_premium(city, working_hours, delivery_type, plan, live_weather_risk=0.5):
    score = ml_risk_score(city, working_hours, delivery_type, live_weather_risk)
    base  = BASE_PREMIUMS.get(plan, 299)
    deviation  = (score - 50) / 50
    adjustment = deviation * 0.25
    dynamic    = round(base * (1 + adjustment))
    level = "High" if score >= 70 else "Medium" if score >= 45 else "Low"
    return {"riskScore": score, "riskLevel": level, "basePremium": base, "dynamicPremium": dynamic}


if __name__ == "__main__":
    # Test all cities
    test_cases = [
        ("Mumbai",    8, "food",    "Standard"),
        ("Delhi",     10, "grocery", "Premium"),
        ("Bangalore", 6, "package", "Basic"),
        ("Chennai",   9, "food",    "Pro"),
    ]
    print(f"{'City':<12} {'Plan':<12} {'Risk':>5} {'Level':<8} {'Base':>6} {'Dynamic':>8}")
    print("-" * 60)
    for city, hrs, dtype, plan in test_cases:
        r = calculate_premium(city, hrs, dtype, plan)
        print(f"{city:<12} {plan:<12} {r['riskScore']:>5} {r['riskLevel']:<8} ₹{r['basePremium']:>5} ₹{r['dynamicPremium']:>7}")
