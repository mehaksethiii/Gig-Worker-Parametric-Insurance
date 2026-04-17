/**
 * geofence.js
 * ─────────────────────────────────────────────────────────────────────────────
 * POST /api/geofence/validate   — check if GPS coords are in an eligible zone
 * GET  /api/geofence/zones/:city — return risk zones for a city
 *
 * Cities are divided into risk zones (High / Medium / Low).
 * Only riders inside eligible zones get auto-coverage for certain trigger types.
 * ─────────────────────────────────────────────────────────────────────────────
 */

'use strict';

const express = require('express');
const jwt     = require('jsonwebtoken');
const router  = express.Router();

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

// ── City risk zones ───────────────────────────────────────────────────────────
// Each zone: { name, center: [lat, lon], radiusKm, riskLevel, coverageTypes }
const CITY_ZONES = {
  Delhi: [
    { name: 'Central Delhi',    center: [28.6448, 77.2167], radiusKm: 8,  riskLevel: 'High',   coverageTypes: ['heat','pollution','rain','combined'] },
    { name: 'North Delhi',      center: [28.7041, 77.1025], radiusKm: 10, riskLevel: 'High',   coverageTypes: ['heat','pollution','combined'] },
    { name: 'South Delhi',      center: [28.5355, 77.2910], radiusKm: 10, riskLevel: 'Medium', coverageTypes: ['heat','pollution'] },
    { name: 'East Delhi',       center: [28.6600, 77.3100], radiusKm: 8,  riskLevel: 'Medium', coverageTypes: ['heat','pollution','rain'] },
    { name: 'West Delhi',       center: [28.6500, 77.0900], radiusKm: 10, riskLevel: 'Medium', coverageTypes: ['heat','pollution'] },
    { name: 'Outer Delhi',      center: [28.7500, 77.1200], radiusKm: 15, riskLevel: 'Low',    coverageTypes: ['heat'] },
  ],
  Mumbai: [
    { name: 'South Mumbai',     center: [18.9220, 72.8347], radiusKm: 6,  riskLevel: 'High',   coverageTypes: ['rain','combined','pollution'] },
    { name: 'Dharavi',          center: [19.0400, 72.8500], radiusKm: 4,  riskLevel: 'High',   coverageTypes: ['rain','combined'] },
    { name: 'Bandra-Kurla',     center: [19.0596, 72.8656], radiusKm: 5,  riskLevel: 'High',   coverageTypes: ['rain','pollution','combined'] },
    { name: 'Andheri',          center: [19.1136, 72.8697], radiusKm: 8,  riskLevel: 'Medium', coverageTypes: ['rain','pollution'] },
    { name: 'Thane',            center: [19.2183, 72.9781], radiusKm: 10, riskLevel: 'Medium', coverageTypes: ['rain'] },
    { name: 'Navi Mumbai',      center: [19.0330, 73.0297], radiusKm: 12, riskLevel: 'Low',    coverageTypes: ['rain'] },
  ],
  Bangalore: [
    { name: 'Central Bangalore',center: [12.9716, 77.5946], radiusKm: 8,  riskLevel: 'Medium', coverageTypes: ['rain','pollution'] },
    { name: 'Whitefield',       center: [12.9698, 77.7500], radiusKm: 8,  riskLevel: 'Low',    coverageTypes: ['rain'] },
    { name: 'Electronic City',  center: [12.8399, 77.6770], radiusKm: 6,  riskLevel: 'Low',    coverageTypes: ['rain'] },
    { name: 'Outer Ring Road',  center: [12.9352, 77.6245], radiusKm: 10, riskLevel: 'Medium', coverageTypes: ['rain','pollution'] },
  ],
  Chennai: [
    { name: 'Central Chennai',  center: [13.0827, 80.2707], radiusKm: 8,  riskLevel: 'High',   coverageTypes: ['rain','heat','combined'] },
    { name: 'North Chennai',    center: [13.1500, 80.2800], radiusKm: 10, riskLevel: 'High',   coverageTypes: ['rain','combined'] },
    { name: 'South Chennai',    center: [12.9500, 80.2200], radiusKm: 10, riskLevel: 'Medium', coverageTypes: ['rain','heat'] },
    { name: 'West Chennai',     center: [13.0500, 80.1800], radiusKm: 8,  riskLevel: 'Medium', coverageTypes: ['heat','pollution'] },
  ],
  Hyderabad: [
    { name: 'Old City',         center: [17.3616, 78.4747], radiusKm: 6,  riskLevel: 'High',   coverageTypes: ['heat','pollution','combined'] },
    { name: 'HITEC City',       center: [17.4435, 78.3772], radiusKm: 8,  riskLevel: 'Medium', coverageTypes: ['heat','pollution'] },
    { name: 'Secunderabad',     center: [17.4399, 78.4983], radiusKm: 8,  riskLevel: 'Medium', coverageTypes: ['heat','rain'] },
  ],
  Kolkata: [
    { name: 'Central Kolkata',  center: [22.5726, 88.3639], radiusKm: 8,  riskLevel: 'High',   coverageTypes: ['rain','combined','pollution'] },
    { name: 'North Kolkata',    center: [22.6200, 88.3700], radiusKm: 8,  riskLevel: 'High',   coverageTypes: ['rain','combined'] },
    { name: 'South Kolkata',    center: [22.5000, 88.3500], radiusKm: 10, riskLevel: 'Medium', coverageTypes: ['rain','pollution'] },
    { name: 'Salt Lake',        center: [22.5800, 88.4200], radiusKm: 8,  riskLevel: 'Medium', coverageTypes: ['rain'] },
  ],
  Pune: [
    { name: 'Central Pune',     center: [18.5204, 73.8567], radiusKm: 8,  riskLevel: 'Medium', coverageTypes: ['rain','pollution'] },
    { name: 'Hinjewadi',        center: [18.5912, 73.7389], radiusKm: 8,  riskLevel: 'Low',    coverageTypes: ['rain'] },
    { name: 'Kothrud',          center: [18.5074, 73.8077], radiusKm: 6,  riskLevel: 'Medium', coverageTypes: ['rain','heat'] },
  ],
};

// ── Haversine distance ────────────────────────────────────────────────────────
function distanceKm(lat1, lon1, lat2, lon2) {
  const R    = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a    = Math.sin(dLat/2)**2 + Math.cos(lat1 * Math.PI/180) * Math.cos(lat2 * Math.PI/180) * Math.sin(dLon/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

// ── Find which zone a GPS point falls in ─────────────────────────────────────
function findZone(lat, lon, city) {
  const zones = CITY_ZONES[city];
  if (!zones) return null;

  let bestZone = null;
  let bestDist = Infinity;

  for (const zone of zones) {
    const dist = distanceKm(lat, lon, zone.center[0], zone.center[1]);
    if (dist <= zone.radiusKm && dist < bestDist) {
      bestDist = dist;
      bestZone = { ...zone, distanceKm: Math.round(dist * 10) / 10 };
    }
  }

  return bestZone;
}

// ── POST /api/geofence/validate ───────────────────────────────────────────────
router.post('/validate', auth, (req, res) => {
  const { lat, lon, city, claimType } = req.body;

  if (!lat || !lon) {
    return res.status(400).json({ error: 'lat and lon are required' });
  }
  if (!city) {
    return res.status(400).json({ error: 'city is required' });
  }

  const zone = findZone(parseFloat(lat), parseFloat(lon), city);

  if (!zone) {
    return res.json({
      eligible:    false,
      zone:        null,
      reason:      `GPS coordinates are outside all registered risk zones for ${city}`,
      city,
      coordinates: { lat, lon },
    });
  }

  // Check if this claim type is covered in this zone
  const claimCovered = !claimType || zone.coverageTypes.includes(claimType);

  console.log(`📍 [Geofence] lat=${lat} lon=${lon} city=${city} → zone="${zone.name}" riskLevel=${zone.riskLevel} eligible=${claimCovered}`);

  res.json({
    eligible:    claimCovered,
    zone: {
      name:          zone.name,
      riskLevel:     zone.riskLevel,
      coverageTypes: zone.coverageTypes,
      distanceKm:    zone.distanceKm,
    },
    reason: claimCovered
      ? `Location verified in ${zone.name} (${zone.riskLevel} risk zone)`
      : `Claim type "${claimType}" is not covered in ${zone.name}. Covered types: ${zone.coverageTypes.join(', ')}`,
    city,
    coordinates: { lat, lon },
  });
});

// ── GET /api/geofence/zones/:city ─────────────────────────────────────────────
router.get('/zones/:city', (req, res) => {
  const city  = req.params.city;
  const zones = CITY_ZONES[city];

  if (!zones) {
    return res.status(404).json({
      error:           `No zone data for city: ${city}`,
      supportedCities: Object.keys(CITY_ZONES),
    });
  }

  res.json({
    city,
    zones: zones.map(z => ({
      name:          z.name,
      center:        z.center,
      radiusKm:      z.radiusKm,
      riskLevel:     z.riskLevel,
      coverageTypes: z.coverageTypes,
    })),
    totalZones: zones.length,
  });
});

// ── GET /api/geofence/cities ──────────────────────────────────────────────────
router.get('/cities', (req, res) => {
  res.json({
    cities: Object.keys(CITY_ZONES).map(city => ({
      name:       city,
      zoneCount:  CITY_ZONES[city].length,
      highRiskZones: CITY_ZONES[city].filter(z => z.riskLevel === 'High').length,
    })),
  });
});

module.exports = router;
