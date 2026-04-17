/**
 * weatherRiskModel.js
 * ─────────────────────────────────────────────────────────────────────────────
 * A pure-JS Random Forest that scores environmental risk (0–100) from:
 *   • temperature  (°C)
 *   • aqi          (US AQI 0–500)
 *   • rainfall     (mm/hr)
 *
 * Architecture
 * ────────────
 * • 20 decision trees, each trained on a bootstrap sample of 300 synthetic
 *   labelled observations generated from domain knowledge.
 * • Each tree uses a random subset of 2 features per split (feature bagging).
 * • Final score = mean of all tree predictions, clamped to [0, 100].
 *
 * Why pure JS?
 * ────────────
 * No Python runtime, no native addons, no extra npm packages.
 * Runs in the same Node process as Express with zero cold-start overhead.
 *
 * Public API
 * ──────────
 *   scoreWeatherRisk({ temperature, aqi, rainfall })
 *     → { riskScore, riskLevel, triggerType, featureImportance, details }
 *
 *   scoreWeatherRiskBatch(observations[])
 *     → array of results
 */

'use strict';

// ── 1. Synthetic training data generator ─────────────────────────────────────
// Produces labelled (features → riskScore) observations that encode the
// parametric insurance domain rules:
//   temp > 42  → heat trigger   (high risk)
//   aqi  > 200 → pollution      (high risk)
//   rain > 50  → flood          (high risk)
//   combinations amplify risk

function generateTrainingData(n = 300, seed = 42) {
  // Deterministic LCG so the forest is identical on every server restart
  let s = seed;
  const rand = () => { s = (s * 1664525 + 1013904223) & 0xffffffff; return (s >>> 0) / 0xffffffff; };

  const data = [];
  for (let i = 0; i < n; i++) {
    // Sample realistic Indian weather ranges
    const temp     = 15 + rand() * 45;          // 15–60 °C
    const aqi      = 10 + rand() * 490;          // 10–500
    const rainfall = rand() < 0.7 ? 0 : rand() * 120; // 70% dry days

    // Domain-rule label (ground truth)
    let score = 10; // baseline

    // Temperature contribution (non-linear: exponential above 38°C)
    if (temp > 42) score += 30 + Math.min(20, (temp - 42) * 4);
    else if (temp > 38) score += 10 + (temp - 38) * 5;
    else if (temp > 32) score += (temp - 32) * 2;

    // AQI contribution
    if (aqi > 300)      score += 35;
    else if (aqi > 200) score += 25 + (aqi - 200) * 0.1;
    else if (aqi > 150) score += 10 + (aqi - 150) * 0.3;
    else if (aqi > 100) score += (aqi - 100) * 0.2;

    // Rainfall contribution
    if (rainfall > 80)  score += 30 + (rainfall - 80) * 0.3;
    else if (rainfall > 50) score += 20 + (rainfall - 50) * 0.33;
    else if (rainfall > 20) score += (rainfall - 20) * 0.67;

    // Interaction bonus: multiple triggers compound
    const triggers = [temp > 42, aqi > 200, rainfall > 50].filter(Boolean).length;
    if (triggers >= 2) score += 10 * (triggers - 1);

    // Add small noise so trees don't all split identically
    score += (rand() - 0.5) * 6;

    data.push({ temp, aqi, rainfall, score: Math.max(0, Math.min(100, score)) });
  }
  return data;
}

// ── 2. Decision tree (regression) ────────────────────────────────────────────

function variance(values) {
  if (values.length === 0) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  return values.reduce((s, v) => s + (v - mean) ** 2, 0) / values.length;
}

function bestSplit(samples, features) {
  let bestVar = Infinity, bestFeat = null, bestThresh = null;

  for (const feat of features) {
    const vals = [...new Set(samples.map(s => s[feat]))].sort((a, b) => a - b);
    // Try midpoints between consecutive unique values (max 20 candidates for speed)
    const step = Math.max(1, Math.floor(vals.length / 20));
    for (let i = 0; i < vals.length - 1; i += step) {
      const thresh = (vals[i] + vals[i + 1]) / 2;
      const left   = samples.filter(s => s[feat] <= thresh);
      const right  = samples.filter(s => s[feat] >  thresh);
      if (!left.length || !right.length) continue;
      const weightedVar =
        (left.length  * variance(left.map(s => s.score)) +
         right.length * variance(right.map(s => s.score))) / samples.length;
      if (weightedVar < bestVar) {
        bestVar = weightedVar; bestFeat = feat; bestThresh = thresh;
      }
    }
  }
  return { feat: bestFeat, thresh: bestThresh };
}

function buildTree(samples, depth = 0, maxDepth = 8, minLeaf = 5, randFeat) {
  const scores = samples.map(s => s.score);
  const mean   = scores.reduce((a, b) => a + b, 0) / scores.length;

  if (depth >= maxDepth || samples.length <= minLeaf || variance(scores) < 1) {
    return { leaf: true, value: mean };
  }

  const features = randFeat();
  const { feat, thresh } = bestSplit(samples, features);
  if (feat === null) return { leaf: true, value: mean };

  const left  = samples.filter(s => s[feat] <= thresh);
  const right = samples.filter(s => s[feat] >  thresh);
  if (!left.length || !right.length) return { leaf: true, value: mean };

  return {
    leaf: false, feat, thresh,
    left:  buildTree(left,  depth + 1, maxDepth, minLeaf, randFeat),
    right: buildTree(right, depth + 1, maxDepth, minLeaf, randFeat),
  };
}

function predictTree(node, sample) {
  if (node.leaf) return node.value;
  return sample[node.feat] <= node.thresh
    ? predictTree(node.left,  sample)
    : predictTree(node.right, sample);
}

// ── 3. Random Forest ──────────────────────────────────────────────────────────

const FEATURES    = ['temp', 'aqi', 'rainfall'];
const N_TREES     = 20;
const N_FEATURES  = 2;   // features per split (√3 ≈ 2)

function buildForest(seed = 42) {
  let s = seed + 1;
  const lcg = () => { s = (s * 22695477 + 1) & 0xffffffff; return (s >>> 0) / 0xffffffff; };

  const allData = generateTrainingData(300, seed);

  return Array.from({ length: N_TREES }, (_, t) => {
    // Bootstrap sample
    const bootstrap = Array.from({ length: allData.length }, () =>
      allData[Math.floor(lcg() * allData.length)]
    );
    // Random feature selector for each split
    const randFeat = () => {
      const shuffled = [...FEATURES].sort(() => lcg() - 0.5);
      return shuffled.slice(0, N_FEATURES);
    };
    return buildTree(bootstrap, 0, 8, 5, randFeat);
  });
}

// Build once at module load — takes ~50 ms, then cached forever
const FOREST = buildForest(42);
console.log(`🌲 [WeatherRiskModel] Random Forest ready (${N_TREES} trees)`);

// ── 4. Feature importance (permutation-based, approximate) ───────────────────

function computeImportance() {
  const testSet = generateTrainingData(100, 99);
  const baseline = testSet.reduce((s, d) => {
    const pred = FOREST.reduce((sum, t) => sum + predictTree(t, d), 0) / N_TREES;
    return s + (pred - d.score) ** 2;
  }, 0) / testSet.length;

  const importance = {};
  for (const feat of FEATURES) {
    const permuted = testSet.map(d => {
      const shuffled = { ...d, [feat]: testSet[Math.floor(Math.random() * testSet.length)][feat] };
      return FOREST.reduce((sum, t) => sum + predictTree(t, shuffled), 0) / N_TREES;
    });
    const permMSE = permuted.reduce((s, p, i) => s + (p - testSet[i].score) ** 2, 0) / testSet.length;
    importance[feat] = Math.max(0, Math.round(((permMSE - baseline) / (baseline || 1)) * 100));
  }
  // Normalise to sum to 100
  const total = Object.values(importance).reduce((a, b) => a + b, 0) || 1;
  for (const k of FEATURES) importance[k] = Math.round((importance[k] / total) * 100);
  return importance;
}

const FEATURE_IMPORTANCE = computeImportance();
console.log(`📊 [WeatherRiskModel] Feature importance: temp=${FEATURE_IMPORTANCE.temp}% aqi=${FEATURE_IMPORTANCE.aqi}% rain=${FEATURE_IMPORTANCE.rainfall}%`);

// ── 5. Public scoring function ────────────────────────────────────────────────

/**
 * Determine the primary trigger type from raw readings.
 */
function resolveTriggerType(temp, aqi, rainfall) {
  const heat  = temp     > 42;
  const poll  = aqi      > 200;
  const rain  = rainfall > 50;
  const count = [heat, poll, rain].filter(Boolean).length;
  if (count > 1)  return 'combined';
  if (heat)       return 'heat';
  if (poll)       return 'pollution';
  if (rain)       return 'rain';
  return 'none';
}

/**
 * scoreWeatherRisk({ temperature, aqi, rainfall })
 *
 * @param {object} input
 * @param {number} input.temperature  °C
 * @param {number} input.aqi          US AQI (0–500)
 * @param {number} input.rainfall     mm/hr
 *
 * @returns {{
 *   riskScore:         number,   // 0–100
 *   riskLevel:         string,   // 'Low' | 'Medium' | 'High'
 *   triggerType:       string,   // 'none' | 'heat' | 'pollution' | 'rain' | 'combined'
 *   isDisruption:      boolean,
 *   featureImportance: object,   // { temp, aqi, rainfall } percentages
 *   details: {
 *     treeCount:    number,
 *     rawPrediction: number,
 *     thresholds:   object,
 *   }
 * }}
 */
function scoreWeatherRisk({ temperature = 30, aqi = 80, rainfall = 0 } = {}) {
  const sample = {
    temp:     Math.max(0, Math.min(60,  temperature)),
    aqi:      Math.max(0, Math.min(500, aqi)),
    rainfall: Math.max(0, Math.min(200, rainfall)),
  };

  const rawPrediction = FOREST.reduce((sum, tree) => sum + predictTree(tree, sample), 0) / N_TREES;
  const riskScore     = Math.round(Math.max(0, Math.min(100, rawPrediction)));
  const riskLevel     = riskScore >= 70 ? 'High' : riskScore >= 45 ? 'Medium' : 'Low';
  const triggerType   = resolveTriggerType(temperature, aqi, rainfall);

  return {
    riskScore,
    riskLevel,
    triggerType,
    isDisruption: triggerType !== 'none',
    featureImportance: FEATURE_IMPORTANCE,
    details: {
      treeCount:     N_TREES,
      rawPrediction: +rawPrediction.toFixed(2),
      inputs:        { temperature, aqi, rainfall },
      thresholds:    { temperature: 42, aqi: 200, rainfall: 50 },
    },
  };
}

/**
 * scoreWeatherRiskBatch(observations)
 * Scores an array of { temperature, aqi, rainfall } objects.
 */
function scoreWeatherRiskBatch(observations = []) {
  return observations.map(o => scoreWeatherRisk(o));
}

module.exports = { scoreWeatherRisk, scoreWeatherRiskBatch, FEATURE_IMPORTANCE };
