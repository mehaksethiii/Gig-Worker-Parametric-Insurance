/**
 * realtime.js
 * ─────────────────────────────────────────────────────────────────────────────
 * GET /api/realtime/risk-stream  — Server-Sent Events (SSE) stream
 *
 * Pushes live risk score updates to the frontend every 30 seconds.
 * No WebSocket library needed — SSE works over plain HTTP.
 *
 * Frontend usage:
 *   const es = new EventSource('/api/realtime/risk-stream?token=<jwt>');
 *   es.onmessage = (e) => { const data = JSON.parse(e.data); ... };
 *
 * GET /api/realtime/risk-snapshot  — single risk snapshot (REST fallback)
 * ─────────────────────────────────────────────────────────────────────────────
 */

'use strict';

const express = require('express');
const jwt     = require('jsonwebtoken');
const axios   = require('axios');
const Rider   = require('../models/Rider');
const Claim   = require('../models/Claim');
const { scoreWeatherRisk } = require('../services/weatherRiskModel');
const router  = express.Router();

const JWT_SECRET = process.env.JWT_SECRET || 'rideshield_secret_key';
const OWM_KEY    = process.env.OPENWEATHER_API_KEY;

// ── Active SSE connections ────────────────────────────────────────────────────
const connections = new Map(); // userId → res

// ── Weather fetch (lightweight, cached per city) ──────────────────────────────
const weatherCache = new Map(); // city → { data, ts }
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

async function getCachedWeather(city) {
  const cached = weatherCache.get(city);
  if (cached && Date.now() - cached.ts < CACHE_TTL_MS) return cached.data;

  if (!OWM_KEY || OWM_KEY === 'your_openweather_api_key_here') {
    // Mock data
    const mock = {
      temperature: 30 + Math.round(Math.random() * 10),
      aqi:         80  + Math.round(Math.random() * 60),
      rainfall:    0,
      description: 'clear sky',
      source:      'mock',
    };
    weatherCache.set(city, { data: mock, ts: Date.now() });
    return mock;
  }

  try {
    const geoRes = await axios.get(
      `https://api.openweathermap.org/geo/1.0/direct?q=${encodeURIComponent(city)},IN&limit=1&appid=${OWM_KEY}`
    );
    if (!geoRes.data.length) throw new Error('City not found');
    const { lat, lon } = geoRes.data[0];

    const [wRes, airRes] = await Promise.all([
      axios.get(`https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${OWM_KEY}&units=metric`),
      axios.get(`https://api.openweathermap.org/data/2.5/air_pollution?lat=${lat}&lon=${lon}&appid=${OWM_KEY}`),
    ]);

    const pm  = airRes.data.list[0].components.pm2_5;
    const aqi = pm25ToAqi(pm);
    const data = {
      temperature: Math.round(wRes.data.main.temp),
      aqi,
      rainfall:    wRes.data.rain?.['1h'] ?? 0,
      description: wRes.data.weather[0].description,
      source:      'live',
    };
    weatherCache.set(city, { data, ts: Date.now() });
    return data;
  } catch {
    return { temperature: 30, aqi: 80, rainfall: 0, description: 'unknown', source: 'fallback' };
  }
}

function pm25ToAqi(pm) {
  const bp = [
    [0,12,0,50],[12.1,35.4,51,100],[35.5,55.4,101,150],
    [55.5,150.4,151,200],[150.5,250.4,201,300],[250.5,350.4,301,400],[350.5,500.4,401,500],
  ];
  for (const [cL,cH,iL,iH] of bp) {
    if (pm >= cL && pm <= cH) return Math.round(((iH-iL)/(cH-cL))*(pm-cL)+iL);
  }
  return 500;
}

// ── Build risk snapshot for a rider ──────────────────────────────────────────
async function buildRiskSnapshot(rider) {
  const weather  = await getCachedWeather(rider.city);
  const mlResult = scoreWeatherRisk({
    temperature: weather.temperature,
    aqi:         weather.aqi,
    rainfall:    weather.rainfall,
  });

  // Recent claims count (last 24h)
  const since24h = new Date(Date.now() - 86400000);
  const recentClaims = await Claim.countDocuments({
    riderId:   rider._id,
    createdAt: { $gte: since24h },
    status:    { $nin: ['rejected'] },
  });

  return {
    riderId:     rider._id,
    city:        rider.city,
    riskScore:   mlResult.riskScore,
    riskLevel:   mlResult.riskLevel,
    triggerType: mlResult.triggerType,
    isDisruption:mlResult.isDisruption,
    weather: {
      temperature: weather.temperature,
      aqi:         weather.aqi,
      rainfall:    weather.rainfall,
      description: weather.description,
    },
    recentClaims24h: recentClaims,
    alerts: buildAlerts(weather, mlResult),
    timestamp: new Date().toISOString(),
  };
}

function buildAlerts(weather, mlResult) {
  const alerts = [];
  if (weather.temperature > 42) alerts.push({ type: 'heat',      message: `Extreme heat: ${weather.temperature}°C`, severity: 'high' });
  if (weather.aqi > 200)        alerts.push({ type: 'pollution', message: `Hazardous AQI: ${weather.aqi}`,          severity: 'high' });
  if (weather.rainfall > 50)    alerts.push({ type: 'rain',      message: `Heavy rain: ${weather.rainfall}mm`,      severity: 'high' });
  if (mlResult.riskScore >= 70) alerts.push({ type: 'risk',      message: `High risk score: ${mlResult.riskScore}/100`, severity: 'high' });
  else if (mlResult.riskScore >= 45) alerts.push({ type: 'risk', message: `Medium risk: ${mlResult.riskScore}/100`, severity: 'medium' });
  return alerts;
}

// ── SSE: GET /api/realtime/risk-stream ────────────────────────────────────────
router.get('/risk-stream', async (req, res) => {
  // Auth via query param (SSE can't set headers)
  const token = req.query.token;
  let userId;
  try {
    userId = jwt.verify(token, JWT_SECRET).id;
  } catch {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const rider = await Rider.findById(userId).lean();
  if (!rider) return res.status(404).json({ error: 'Rider not found' });

  // SSE headers
  res.setHeader('Content-Type',  'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection',    'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // disable nginx buffering
  res.flushHeaders();

  // Close any existing connection for this user
  if (connections.has(userId)) {
    try { connections.get(userId).end(); } catch {}
  }
  connections.set(userId, res);

  const sendSnapshot = async () => {
    try {
      const snapshot = await buildRiskSnapshot(rider);
      res.write(`data: ${JSON.stringify(snapshot)}\n\n`);
    } catch (err) {
      res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`);
    }
  };

  // Send immediately, then every 30 seconds
  await sendSnapshot();
  const interval = setInterval(sendSnapshot, 30000);

  // Heartbeat every 15s to keep connection alive
  const heartbeat = setInterval(() => {
    res.write(': heartbeat\n\n');
  }, 15000);

  req.on('close', () => {
    clearInterval(interval);
    clearInterval(heartbeat);
    connections.delete(userId);
    console.log(`📡 [Realtime] SSE closed for rider ${userId}`);
  });

  console.log(`📡 [Realtime] SSE opened for rider ${userId} (${rider.city})`);
});

// ── REST: GET /api/realtime/risk-snapshot ─────────────────────────────────────
router.get('/risk-snapshot', async (req, res) => {
  const token = req.headers.authorization?.split(' ')[1] || req.query.token;
  let userId;
  try {
    userId = jwt.verify(token, JWT_SECRET).id;
  } catch {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const rider    = await Rider.findById(userId).lean();
    if (!rider) return res.status(404).json({ error: 'Rider not found' });
    const snapshot = await buildRiskSnapshot(rider);
    res.json(snapshot);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/realtime/connections — admin: how many SSE connections are open ──
router.get('/connections', (req, res) => {
  const key = req.headers['x-admin-key'] || req.query.key;
  if (key !== (process.env.ADMIN_SECRET || 'rideshield_admin_2026')) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  res.json({ activeConnections: connections.size });
});

module.exports = router;
