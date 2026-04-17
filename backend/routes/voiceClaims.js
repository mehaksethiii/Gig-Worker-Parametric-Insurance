/**
 * voiceClaims.js
 * ─────────────────────────────────────────────────────────────────────────────
 * POST /api/voice-claims/process
 *
 * Processes a voice transcript (text from speech-to-text) and maps it to a
 * parametric insurance claim. Supports Hindi and English phrases.
 *
 * Input:  { transcript: "baarish ho rahi hai", riderId?, language? }
 * Output: { detected, claimType, confidence, suggestedReason, autoSubmit }
 *
 * POST /api/voice-claims/submit
 * Full pipeline: transcript → detect → validate weather → submit claim
 * ─────────────────────────────────────────────────────────────────────────────
 */

'use strict';

const express = require('express');
const jwt     = require('jsonwebtoken');
const Rider   = require('../models/Rider');
const Claim   = require('../models/Claim');
const Payout  = require('../models/Payout');
const { runFraudChecks }       = require('../services/fraudDetector');
const { processMockPayout, isMockMode } = require('../services/mockPayout');
const { notifyClaimTriggered } = require('../services/notificationService');
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

// ── Keyword maps ──────────────────────────────────────────────────────────────
// Maps spoken phrases (Hindi + English) to claim types
const VOICE_PATTERNS = [
  // Rain / flood
  {
    type:     'rain',
    keywords: ['baarish', 'barish', 'rain', 'flood', 'paani', 'pani', 'baarish ho rahi', 'heavy rain',
               'flooding', 'waterlogging', 'jal bhar', 'baarish aa rahi', 'tez baarish'],
    reason:   'Heavy rainfall disrupting delivery operations',
    emoji:    '🌧️',
  },
  // Heat
  {
    type:     'heat',
    keywords: ['garmi', 'heat', 'hot', 'bahut garmi', 'extreme heat', 'loo', 'lू', 'tapish',
               'garam', 'heat wave', 'heatwave', 'bahut garam'],
    reason:   'Extreme heat conditions making delivery unsafe',
    emoji:    '🌡️',
  },
  // Strike / curfew
  {
    type:     'combined',
    keywords: ['strike', 'bandh', 'hartal', 'curfew', 'road block', 'roadblock', 'jam', 'chakka jam',
               'protest', 'dharana', 'andolan', 'rasta roko', 'traffic jam', 'blocked road'],
    reason:   'Strike / bandh / curfew blocking delivery routes',
    emoji:    '🚫',
  },
  // Pollution / smog
  {
    type:     'pollution',
    keywords: ['pollution', 'smog', 'pradushan', 'dhuan', 'dhuwaan', 'aqi', 'air quality',
               'saans nahi', 'breathe', 'visibility', 'fog', 'dhund'],
    reason:   'Severe air pollution (AQI) making outdoor work hazardous',
    emoji:    '😷',
  },
  // Accident / road damage
  {
    type:     'combined',
    keywords: ['accident', 'durghatna', 'road damage', 'pothole', 'khudai', 'construction',
               'road closed', 'diversion', 'detour'],
    reason:   'Road damage / accident blocking delivery route',
    emoji:    '⚠️',
  },
];

// ── NLP: detect claim type from transcript ────────────────────────────────────
function detectClaimFromTranscript(transcript) {
  if (!transcript || typeof transcript !== 'string') {
    return { detected: false, claimType: null, confidence: 0, reason: null };
  }

  const lower = transcript.toLowerCase().trim();
  let bestMatch = null;
  let bestScore = 0;

  for (const pattern of VOICE_PATTERNS) {
    let score = 0;
    let matchedKeywords = [];

    for (const kw of pattern.keywords) {
      if (lower.includes(kw)) {
        score += kw.split(' ').length; // multi-word phrases score higher
        matchedKeywords.push(kw);
      }
    }

    if (score > bestScore) {
      bestScore = score;
      bestMatch = { ...pattern, matchedKeywords, score };
    }
  }

  if (!bestMatch || bestScore === 0) {
    return { detected: false, claimType: null, confidence: 0, reason: null };
  }

  // Confidence: 1 keyword = 60%, 2 = 80%, 3+ = 95%
  const confidence = Math.min(95, 50 + bestMatch.matchedKeywords.length * 15);

  return {
    detected:         true,
    claimType:        bestMatch.type,
    confidence,
    suggestedReason:  bestMatch.reason,
    emoji:            bestMatch.emoji,
    matchedKeywords:  bestMatch.matchedKeywords,
    transcript,
  };
}

// ── POST /api/voice-claims/process ───────────────────────────────────────────
// Analyse transcript only — no claim created
router.post('/process', auth, (req, res) => {
  const { transcript } = req.body;
  if (!transcript) {
    return res.status(400).json({ error: 'transcript is required' });
  }

  const result = detectClaimFromTranscript(transcript);
  console.log(`🎤 [VoiceClaims] transcript="${transcript}" → detected=${result.detected} type=${result.claimType} confidence=${result.confidence}%`);

  res.json({
    ...result,
    message: result.detected
      ? `Detected: ${result.emoji} ${result.claimType} claim (${result.confidence}% confidence)`
      : 'Could not detect a claim type from the transcript. Please try again.',
    supportedPhrases: {
      rain:      ['baarish ho rahi hai', 'heavy rain', 'flooding'],
      heat:      ['bahut garmi hai', 'extreme heat', 'heat wave'],
      strike:    ['bandh hai', 'strike ho rahi hai', 'chakka jam'],
      pollution: ['bahut pradushan hai', 'smog', 'air quality kharab'],
    },
  });
});

// ── POST /api/voice-claims/submit ─────────────────────────────────────────────
// Full pipeline: transcript → detect → fraud check → create claim → payout
router.post('/submit', auth, async (req, res) => {
  try {
    const { transcript, triggerData = {}, amount } = req.body;
    if (!transcript) {
      return res.status(400).json({ error: 'transcript is required' });
    }

    const detection = detectClaimFromTranscript(transcript);
    if (!detection.detected) {
      return res.status(422).json({
        error:   'Could not detect a valid claim type from the voice transcript.',
        transcript,
        hint:    'Try phrases like "baarish ho rahi hai" or "bahut garmi hai"',
      });
    }

    if (detection.confidence < 50) {
      return res.status(422).json({
        error:      `Low confidence (${detection.confidence}%) — please speak more clearly`,
        detection,
      });
    }

    const rider = await Rider.findById(req.userId);
    if (!rider?.insurancePlan?.name) {
      return res.status(400).json({ error: 'No active insurance plan' });
    }

    const maxPayout    = rider.insurancePlan.maxPayout || 500;
    const claimAmount  = Math.min(amount || Math.round(maxPayout * 0.5), maxPayout);
    const reason       = detection.suggestedReason;
    const triggerType  = detection.claimType;

    // Fraud check
    const fraud = await runFraudChecks({
      riderId:     req.userId,
      riderCity:   rider.city,
      triggerData: { ...triggerData, city: rider.city },
      amount:      claimAmount,
      maxPayout,
    });

    if (fraud.isFraud) {
      return res.status(422).json({
        error:          'Voice claim flagged for fraud — payout blocked',
        fraudFlags:     fraud.flags,
        xaiExplanation: fraud.xaiExplanation,
        detection,
      });
    }

    const claimStatus = fraud.severity === 'low' ? 'flagged' : 'approved';

    const claim = new Claim({
      riderId:      req.userId,
      triggerType,
      payoutAmount: claimAmount,
      amount:       claimAmount,
      reason:       `[Voice] ${reason}`,
      triggerData:  { ...triggerData, city: rider.city },
      validation:   { method: 'user-reported', confidenceScore: detection.confidence },
      status:       claimStatus,
      fraudFlags:   fraud.flags,
    });
    await claim.save();

    notifyClaimTriggered({
      riderId:     req.userId,
      claimId:     claim._id,
      triggerType,
      amount:      claimAmount,
      reason:      `[Voice] ${reason}`,
    }).catch(() => {});

    // Auto-settle if clean
    if (claimStatus === 'approved') {
      const payout = new Payout({
        riderId:             rider._id,
        claimId:             claim._id,
        amount:              claimAmount,
        reason:              `[Voice] ${reason}`,
        triggerData:         triggerData,
        estimatedLostIncome: claimAmount,
        status:              'pending',
        steps: [
          { step: 'trigger_confirmed', status: 'done', timestamp: new Date(), detail: `Voice: "${transcript}"` },
          { step: 'eligibility_check', status: 'done', timestamp: new Date(), detail: `Plan: ${rider.insurancePlan.name}` },
          { step: 'payout_calculated', status: 'done', timestamp: new Date(), detail: `₹${claimAmount}` },
        ],
      });
      await payout.save();

      if (isMockMode()) {
        processMockPayout(payout, rider).catch(console.error);
      } else {
        const { runSettlement } = require('./settlement');
        runSettlement(payout, rider).catch(console.error);
      }
    }

    console.log(`🎤 [VoiceClaims] ${rider.name} — "${transcript}" → ${triggerType} ₹${claimAmount} [${claimStatus}]`);

    res.status(201).json({
      success:    true,
      claim,
      detection,
      fraudFlags: fraud.flags,
      xai:        fraud.xaiExplanation,
      message:    `Voice claim submitted: ${detection.emoji} ${reason} — ₹${claimAmount} ${claimStatus === 'approved' ? 'payout initiated' : 'flagged for review'}`,
    });

  } catch (err) {
    console.error('[VoiceClaims] Error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/voice-claims/phrases ─────────────────────────────────────────────
// Returns all supported voice phrases for the frontend
router.get('/phrases', (req, res) => {
  res.json({
    patterns: VOICE_PATTERNS.map(p => ({
      type:     p.type,
      emoji:    p.emoji,
      reason:   p.reason,
      examples: p.keywords.slice(0, 5),
    })),
  });
});

module.exports = router;
