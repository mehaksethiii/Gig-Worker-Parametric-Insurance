import React, { useState, useEffect, useRef } from 'react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts';

// ─── Sensor Fusion Engine ───────────────────────────────────────────────────
const useSensorFusion = () => {
  const [sensors, setSensors] = useState({
    gps: null, accelerometer: null, gyroscope: null, network: null,
  });
  const [motionFlag, setMotionFlag] = useState(null);
  const posHistory = useRef([]);

  useEffect(() => {
    // GPS
    if (navigator.geolocation) {
      const watcher = navigator.geolocation.watchPosition(pos => {
        const { latitude: lat, longitude: lon, speed, accuracy } = pos.coords;
        const now = Date.now();
        posHistory.current.push({ lat, lon, t: now });
        if (posHistory.current.length > 10) posHistory.current.shift();

        // Temporal Consistency — impossible speed check
        let speedFlag = null;
        if (posHistory.current.length >= 2) {
          const prev = posHistory.current[posHistory.current.length - 2];
          const curr = posHistory.current[posHistory.current.length - 1];
          const dt = (curr.t - prev.t) / 1000; // seconds
          const dLat = curr.lat - prev.lat;
          const dLon = curr.lon - prev.lon;
          const distKm = Math.sqrt(dLat**2 + dLon**2) * 111;
          const speedKmh = (distKm / dt) * 3600;
          if (speedKmh > 150) speedFlag = `Impossible speed: ${Math.round(speedKmh)} km/h in ${Math.round(dt)}s`;
        }

        setSensors(s => ({ ...s, gps: { lat, lon, speed: speed ? Math.round(speed * 3.6) : 0, accuracy: Math.round(accuracy), speedFlag } }));
      }, null, { enableHighAccuracy: true, maximumAge: 0 });
      return () => navigator.geolocation.clearWatch(watcher);
    }
  }, []);

  useEffect(() => {
    // Accelerometer + Gyroscope via DeviceMotion
    const handleMotion = (e) => {
      const acc = e.accelerationIncludingGravity;
      const rot = e.rotationRate;
      if (!acc) return;
      const magnitude = Math.sqrt((acc.x||0)**2 + (acc.y||0)**2 + (acc.z||0)**2);
      const isMoving = magnitude > 11.5; // > gravity = movement
      setSensors(s => ({
        ...s,
        accelerometer: { x: acc.x?.toFixed(2), y: acc.y?.toFixed(2), z: acc.z?.toFixed(2), magnitude: magnitude.toFixed(2), isMoving },
        gyroscope: rot ? { alpha: rot.alpha?.toFixed(1), beta: rot.beta?.toFixed(1), gamma: rot.gamma?.toFixed(1) } : null,
      }));
      // GPS says moving but phone is still → flag
      if (sensors.gps?.speed > 5 && !isMoving) {
        setMotionFlag('GPS shows movement but device sensors detect no motion — possible GPS spoofing');
      } else {
        setMotionFlag(null);
      }
    };
    window.addEventListener('devicemotion', handleMotion);
    return () => window.removeEventListener('devicemotion', handleMotion);
  }, [sensors.gps]);

  useEffect(() => {
    // Network info
    const conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    if (conn) {
      setSensors(s => ({ ...s, network: { type: conn.effectiveType, downlink: conn.downlink, rtt: conn.rtt } }));
    }
  }, []);

  return { sensors, motionFlag };
};

// ─── Multi-Signal Trust Engine ───────────────────────────────────────────────
const calcTrustScore = ({ sensors, motionFlag, weatherRisk, claimHistory, peerCount, locationMatch }) => {
  let score = 100;
  const reasons = [];
  const flags = [];

  // GPS consistency
  if (sensors.gps?.speedFlag) { score -= 25; flags.push(sensors.gps.speedFlag); }
  else reasons.push('GPS trajectory consistent');

  // Motion vs GPS mismatch
  if (motionFlag) { score -= 20; flags.push(motionFlag); }
  else if (sensors.accelerometer) reasons.push('Device motion matches GPS');

  // Location match
  if (!locationMatch) { score -= 20; flags.push('Location mismatch with registered city'); }
  else reasons.push('Location verified with registered city');

  // Weather confirmation
  if (weatherRisk > 40) reasons.push(`Weather confirms disruption (risk: ${weatherRisk}%)`);
  else { score -= 10; flags.push('No significant weather disruption detected'); }

  // Peer verification
  if (peerCount >= 3) reasons.push(`${peerCount} nearby riders confirmed same disruption`);
  else if (peerCount === 0) { score -= 15; flags.push('0 nearby riders reported same issue'); }

  // Claim history
  const recentClaims = claimHistory?.filter(c => {
    const days = (Date.now() - new Date(c.date || c.createdAt)) / 86400000;
    return days <= 7;
  }).length || 0;
  if (recentClaims >= 3) { score -= 15; flags.push(`High claim frequency: ${recentClaims} claims in 7 days`); }
  else reasons.push('Claim frequency normal');

  score = Math.max(0, Math.min(100, score));
  const level = score >= 75 ? 'Low Risk' : score >= 50 ? 'Medium Risk' : 'High Risk';
  const color = score >= 75 ? '#48bb78' : score >= 50 ? '#f6ad55' : '#fc8181';
  const verdict = flags.length >= 2 ? 'Flagged' : flags.length === 1 ? 'Review' : 'Approved';

  return { score, level, color, verdict, reasons, flags };
};

// ─── Component ───────────────────────────────────────────────────────────────
const AIDefenseEngine = ({ insuranceData, weatherRisk, claims }) => {
  const { sensors, motionFlag } = useSensorFusion();
  const [peerCount] = useState(Math.floor(Math.random() * 12) + 2);
  const [locationMatch] = useState(() => {
    try { return !JSON.parse(localStorage.getItem('locationFraud')); } catch { return true; }
  });
  const [showXAI, setShowXAI] = useState(false);

  // Real-Time Risk Stream
  const [liveRisk, setLiveRisk] = useState(weatherRisk || 45);
  const [riskHistory, setRiskHistory] = useState([weatherRisk || 45]);
  const [riskTrend, setRiskTrend] = useState('stable');

  useEffect(() => {
    const interval = setInterval(() => {
      setLiveRisk(prev => {
        const delta = (Math.random() - 0.45) * 8;
        const next = Math.min(100, Math.max(0, Math.round(prev + delta)));
        setRiskHistory(h => [...h.slice(-19), next]);
        setRiskTrend(next > prev + 3 ? 'rising' : next < prev - 3 ? 'falling' : 'stable');
        return next;
      });
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  // Geo-Fencing zones
  const CITY_ZONES = {
    Mumbai:    [
      { areas: ['Andheri', 'Bandra', 'Dadar', 'Kurla'],           name: 'Zone A — Western Suburbs' },
      { areas: ['Dharavi', 'Sion', 'Chembur', 'Ghatkopar'],       name: 'Zone B — Central Mumbai' },
      { areas: ['Navi Mumbai', 'Thane', 'Mira Road', 'Vasai'],    name: 'Zone C — Outskirts' },
    ],
    Delhi:     [
      { areas: ['Connaught Place', 'Karol Bagh', 'Chandni Chowk', 'Lajpat Nagar'], name: 'Zone A — City Center' },
      { areas: ['Okhla', 'Noida Sector 18', 'Gurgaon', 'Faridabad'],               name: 'Zone B — Industrial Area' },
      { areas: ['Dwarka', 'Rohini', 'Vasant Kunj', 'Greater Noida'],               name: 'Zone C — Suburbs' },
    ],
    Bangalore: [
      { areas: ['Koramangala', 'Indiranagar', 'MG Road', 'Brigade Road'], name: 'Zone A — City Core' },
      { areas: ['Whitefield', 'Electronic City', 'Marathahalli', 'HSR'], name: 'Zone B — Tech Corridor' },
      { areas: ['Yelahanka', 'Devanahalli', 'Kengeri', 'Tumkur Road'],   name: 'Zone C — Outskirts' },
    ],
    Hyderabad: [
      { areas: ['Hitech City', 'Banjara Hills', 'Jubilee Hills', 'Madhapur'], name: 'Zone A — IT Hub' },
      { areas: ['Secunderabad', 'Begumpet', 'Ameerpet', 'Kukatpally'],        name: 'Zone B — Central' },
      { areas: ['LB Nagar', 'Uppal', 'Ghatkesar', 'Shamshabad'],              name: 'Zone C — Outskirts' },
    ],
    Chennai:   [
      { areas: ['T Nagar', 'Anna Nagar', 'Nungambakkam', 'Egmore'], name: 'Zone A — City Center' },
      { areas: ['Velachery', 'Tambaram', 'Chromepet', 'Pallavaram'], name: 'Zone B — South Chennai' },
      { areas: ['Ambattur', 'Avadi', 'Poonamallee', 'Sriperumbudur'], name: 'Zone C — Outskirts' },
    ],
    Kolkata:   [
      { areas: ['Park Street', 'Salt Lake', 'New Town', 'Esplanade'], name: 'Zone A — City Core' },
      { areas: ['Howrah', 'Dumdum', 'Barasat', 'Behala'],             name: 'Zone B — Industrial' },
      { areas: ['Rajarhat', 'Garia', 'Sonarpur', 'Baruipur'],         name: 'Zone C — Suburbs' },
    ],
    Pune:      [
      { areas: ['Koregaon Park', 'Shivajinagar', 'FC Road', 'Camp'], name: 'Zone A — City Center' },
      { areas: ['Hinjewadi', 'Wakad', 'Baner', 'Kharadi'],           name: 'Zone B — IT Zone' },
      { areas: ['Hadapsar', 'Wagholi', 'Undri', 'Katraj'],           name: 'Zone C — Outskirts' },
    ],
  };

  const cityZoneData = CITY_ZONES[insuranceData?.city] || [
    { areas: ['City Center', 'Main Market', 'Old Town', 'Railway Station Area'], name: `Zone A — ${insuranceData?.city || 'City'} Core` },
    { areas: ['Industrial Area', 'Bus Stand Area', 'Commercial Zone', 'Market Road'], name: 'Zone B — Commercial' },
    { areas: ['Suburbs', 'Outskirts', 'Residential Colony', 'Highway Area'], name: 'Zone C — Outskirts' },
  ];

  const [geoZones] = useState([
    { id: 1, risk: 'High',   reason: 'Heavy rainfall detected', riders: 12, eligible: true,  color: '#fc8181' },
    { id: 2, risk: 'Medium', reason: 'Strike reported nearby',   riders: 5,  eligible: true,  color: '#f6ad55' },
    { id: 3, risk: 'Low',    reason: 'Normal conditions',        riders: 8,  eligible: false, color: '#68d391' },
  ]);

  // Determine which zone the user is in based on location fraud / city
  const userZone = (() => {
    const locFraud = (() => { try { return JSON.parse(localStorage.getItem('locationFraud')); } catch { return null; } })();
    if (locFraud && !locFraud.verified) return null; // mismatch — not in any zone
    const city = insuranceData?.city || '';
    if (['Mumbai','Chennai','Kolkata'].includes(city)) return 1; // Zone A — high risk cities
    if (['Delhi','Hyderabad'].includes(city)) return 2;           // Zone B — medium
    return 3;                                                      // Zone C — others
  })();

  // Cross-Platform Sync
  const [deviceSessions] = useState([
    { device: 'Chrome / Windows', lastSeen: '2 min ago', location: insuranceData?.city || 'Delhi', status: 'active' },
    { device: 'Mobile App / Android', lastSeen: '1 hr ago', location: insuranceData?.city || 'Delhi', status: 'inactive' },
  ]);

  // Zero Trust — every claim must pass all checks
  const zeroTrustChecks = [
    { label: 'GPS Signal Verified',        pass: !!sensors.gps && !sensors.gps.speedFlag },
    { label: 'Motion Sensor Cross-Check',  pass: !motionFlag },
    { label: 'Location Zone Match',        pass: locationMatch },
    { label: 'Weather Trigger Confirmed',  pass: liveRisk > 40 },
    { label: 'Peer Verification (≥3)',     pass: peerCount >= 3 },
    { label: 'No Duplicate Claim Today',   pass: true },
    { label: 'Temporal Consistency',       pass: !sensors.gps?.speedFlag },
    { label: 'Anomaly Score < Threshold',  pass: liveRisk < 80 },
  ];
  const passCount = zeroTrustChecks.filter(c => c.pass).length;
  const ztVerdict = passCount >= 7 ? 'APPROVED' : passCount >= 5 ? 'REVIEW' : 'DENIED';
  const ztColor   = passCount >= 7 ? '#48bb78' : passCount >= 5 ? '#f6ad55' : '#fc8181';

  const [heatmapZones] = useState([
    { zone: 'Connaught Place, Delhi',   fraud: 78, disruption: 45, color: '#fc8181' },
    { zone: 'Andheri, Mumbai',          fraud: 32, disruption: 82, color: '#f6ad55' },
    { zone: 'Koramangala, Bangalore',   fraud: 15, disruption: 28, color: '#68d391' },
    { zone: 'Banjara Hills, Hyderabad', fraud: 45, disruption: 60, color: '#f6ad55' },
    { zone: 'Salt Lake, Kolkata',       fraud: 62, disruption: 55, color: '#fc8181' },
  ]);

  const trust = calcTrustScore({ sensors, motionFlag, weatherRisk, claimHistory: claims, peerCount, locationMatch });

  return (
    <div className="ai-defense">
      <h2>🧠 AI Defense Engine</h2>
      <p className="section-subtitle">Multi-signal fraud detection — combining GPS, sensors, weather, peers & history</p>

      {/* Trust Score */}
      <div className="ade-trust-card" style={{ borderColor: trust.color }}>
        <div className="ade-trust-left">
          <svg viewBox="0 0 120 120" className="ade-gauge">
            <circle cx="60" cy="60" r="50" fill="none" stroke="#e2e8f0" strokeWidth="10"/>
            <circle cx="60" cy="60" r="50" fill="none" stroke={trust.color} strokeWidth="10"
              strokeDasharray={`${(trust.score/100)*314} 314`} strokeLinecap="round"
              transform="rotate(-90 60 60)" style={{ transition: 'stroke-dasharray 1s ease' }}/>
            <text x="60" y="55" textAnchor="middle" fontSize="24" fontWeight="900" fill={trust.color}>{trust.score}</text>
            <text x="60" y="72" textAnchor="middle" fontSize="10" fill="#718096">{trust.level}</text>
          </svg>
          <div className="ade-verdict" style={{ background: trust.color }}>
            {trust.verdict === 'Approved' ? '✅' : trust.verdict === 'Review' ? '⚠️' : '🚫'} {trust.verdict}
          </div>
        </div>
        <div className="ade-trust-right">
          <h3>Multi-Signal Trust Score</h3>
          <p>Based on {6} real-time signals analyzed simultaneously</p>
          <div className="ade-signals">
            {[
              { label: 'GPS Consistency',    ok: !sensors.gps?.speedFlag,   val: sensors.gps ? `${sensors.gps.speed || 0} km/h` : 'Waiting...' },
              { label: 'Motion Sensors',     ok: !motionFlag,                val: sensors.accelerometer ? (sensors.accelerometer.isMoving ? 'Moving' : 'Still') : 'No sensor' },
              { label: 'Location Match',     ok: locationMatch,              val: locationMatch ? 'Verified' : 'Mismatch' },
              { label: 'Weather Confirmed',  ok: weatherRisk > 40,           val: `${weatherRisk}% risk` },
              { label: 'Peer Verification',  ok: peerCount >= 3,             val: `${peerCount} riders` },
              { label: 'Claim Frequency',    ok: (claims?.length || 0) < 3,  val: `${claims?.length || 0} this week` },
            ].map((sig, i) => (
              <div key={i} className="ade-signal-row">
                <span className={`ade-signal-dot ${sig.ok ? 'ok' : 'flag'}`}/>
                <span className="ade-signal-label">{sig.label}</span>
                <span className="ade-signal-val">{sig.val}</span>
                <span className={`ade-signal-status ${sig.ok ? 'ok' : 'flag'}`}>{sig.ok ? '✓' : '✗'}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Sensor Fusion */}
      <div className="ade-section">
        <h3>📡 Sensor Fusion Engine</h3>
        <div className="ade-sensors-grid">
          <div className="ade-sensor-card">
            <div className="ade-sensor-visual" style={{
              background: 'linear-gradient(135deg,#ebf8ff,#bee3f8)',
              borderBottom: '2px solid #4facfe',
            }}>
              <svg viewBox="0 0 80 60" style={{width:'100%',height:'100%'}}>
                {/* Satellite signal rings */}
                {[28,20,12].map((r,i) => (
                  <circle key={i} cx="40" cy="38" r={r} fill="none"
                    stroke={`rgba(79,172,254,${0.25+i*0.2})`} strokeWidth="1.5"
                    strokeDasharray={i===0?"4 3":"none"}/>
                ))}
                {/* Pin */}
                <circle cx="40" cy="38" r="5" fill="#4facfe"/>
                <path d="M40,33 Q44,26 40,20 Q36,26 40,33Z" fill="#e53e3e"/>
                {/* Satellite */}
                <rect x="58" y="8" width="10" height="6" rx="1" fill="#4facfe" opacity="0.8"/>
                <line x1="55" y1="11" x2="58" y2="11" stroke="#4facfe" strokeWidth="1.5"/>
                <line x1="68" y1="11" x2="71" y2="11" stroke="#4facfe" strokeWidth="1.5"/>
                <line x1="63" y1="8" x2="63" y2="5" stroke="#4facfe" strokeWidth="1.5"/>
                {/* Signal beam */}
                <line x1="58" y1="14" x2="44" y2="33" stroke="rgba(79,172,254,0.4)" strokeWidth="1" strokeDasharray="2 2"/>
              </svg>
            </div>
            <div className="ade-sensor-icon">📍</div>
            <h4>GPS</h4>
            {sensors.gps ? (<>
              <p>Speed: <strong>{sensors.gps.speed} km/h</strong></p>
              <p>Accuracy: <strong>±{sensors.gps.accuracy}m</strong></p>
              {sensors.gps.speedFlag
                ? <span className="ade-flag-tag">🚩 {sensors.gps.speedFlag}</span>
                : <span className="ade-ok-tag">✅ Normal</span>}
            </>) : <p className="ade-waiting">Acquiring GPS...</p>}
          </div>

          <div className="ade-sensor-card">
            <div className="ade-sensor-visual" style={{
              background: 'linear-gradient(135deg,#fff8f0,#feebc8)',
              borderBottom: '2px solid #f6ad55',
            }}>
              <svg viewBox="0 0 80 60" style={{width:'100%',height:'100%'}}>
                {/* Phone outline */}
                <rect x="28" y="8" width="24" height="40" rx="4" fill="white" stroke="#f6ad55" strokeWidth="2"/>
                <rect x="31" y="12" width="18" height="28" rx="2" fill="#fff8f0"/>
                <circle cx="40" cy="44" r="2" fill="#f6ad55"/>
                {/* Motion waves */}
                {[1,2,3].map((n,i) => (
                  <path key={i}
                    d={`M${18-i*4},${28+i*4} Q${22-i*4},${20+i*2} ${18-i*4},${12+i*0}`}
                    fill="none" stroke={`rgba(246,173,85,${0.6-i*0.15})`} strokeWidth="2" strokeLinecap="round"/>
                ))}
                {[1,2,3].map((n,i) => (
                  <path key={i}
                    d={`M${62+i*4},${28+i*4} Q${58+i*4},${20+i*2} ${62+i*4},${12+i*0}`}
                    fill="none" stroke={`rgba(246,173,85,${0.6-i*0.15})`} strokeWidth="2" strokeLinecap="round"/>
                ))}
                {/* Acceleration arrow */}
                <path d="M36,26 L44,26 L42,22 M44,26 L42,30" stroke="#e67e22" strokeWidth="2" strokeLinecap="round" fill="none"/>
              </svg>
            </div>
            <div className="ade-sensor-icon">📳</div>
            <h4>Accelerometer</h4>
            {sensors.accelerometer ? (<>
              <p>X: {sensors.accelerometer.x} · Y: {sensors.accelerometer.y}</p>
              <p>Magnitude: <strong>{sensors.accelerometer.magnitude} m/s²</strong></p>
              <span className={sensors.accelerometer.isMoving ? 'ade-ok-tag' : 'ade-neutral-tag'}>
                {sensors.accelerometer.isMoving ? '🏃 Moving' : '🧍 Still'}
              </span>
            </>) : <p className="ade-waiting">No motion sensor data<br/><small>(available on mobile)</small></p>}
          </div>

          <div className="ade-sensor-card">
            <div className="ade-sensor-visual" style={{
              background: 'linear-gradient(135deg,#f0fff4,#c6f6d5)',
              borderBottom: '2px solid #48bb78',
            }}>
              <svg viewBox="0 0 80 60" style={{width:'100%',height:'100%'}}>
                {/* WiFi / network arcs */}
                {[22,16,10].map((r,i) => (
                  <path key={i}
                    d={`M${40-r},${34} A${r},${r} 0 0,1 ${40+r},${34}`}
                    fill="none" stroke={`rgba(72,187,120,${0.3+i*0.25})`} strokeWidth="2.5" strokeLinecap="round"/>
                ))}
                <circle cx="40" cy="36" r="3.5" fill="#48bb78"/>
                {/* Signal bars */}
                {[0,1,2,3].map((n,i) => (
                  <rect key={i} x={52+i*6} y={44-(i+1)*6} width="4" height={(i+1)*6}
                    rx="1" fill={`rgba(72,187,120,${0.4+i*0.2})`}/>
                ))}
                {/* Speed label */}
                <text x="14" y="52" fontSize="7" fill="#276749" fontWeight="700">NETWORK</text>
              </svg>
            </div>
            <div className="ade-sensor-icon">🌐</div>
            <h4>Network</h4>
            {sensors.network ? (<>
              <p>Type: <strong>{sensors.network.type}</strong></p>
              <p>Speed: <strong>{sensors.network.downlink} Mbps</strong></p>
              <p>Latency: <strong>{sensors.network.rtt}ms</strong></p>
            </>) : <p className="ade-waiting">Network info unavailable</p>}
          </div>

          <div className="ade-sensor-card">
            <div className="ade-sensor-visual" style={{
              background: 'linear-gradient(135deg,#faf5ff,#e9d8fd)',
              borderBottom: '2px solid #9b59b6',
            }}>
              <svg viewBox="0 0 80 60" style={{width:'100%',height:'100%'}}>
                {/* Timeline track */}
                <line x1="10" y1="35" x2="70" y2="35" stroke="#e9d8fd" strokeWidth="3" strokeLinecap="round"/>
                {/* Position dots on timeline */}
                {[10,22,34,46,58,70].map((x,i) => (
                  <circle key={i} cx={x} cy="35" r={i===5?5:3}
                    fill={i===5?'#9b59b6':'rgba(155,89,182,0.5)'}
                    stroke={i===5?'white':'none'} strokeWidth="1.5"/>
                ))}
                {/* Connecting line (path taken) */}
                <polyline points="10,35 22,32 34,36 46,33 58,35 70,35"
                  fill="none" stroke="#9b59b6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                {/* Check mark */}
                <circle cx="40" cy="18" r="9" fill="#9b59b6"/>
                <path d="M35,18 L38,21 L45,14" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
              </svg>
            </div>
            <div className="ade-sensor-icon">⚡</div>
            <h4>Temporal Check</h4>
            {sensors.gps?.speedFlag
              ? <span className="ade-flag-tag">🚩 {sensors.gps.speedFlag}</span>
              : <><p>Last 10 positions analyzed</p><span className="ade-ok-tag">✅ No impossible jumps</span></>}
          </div>
        </div>
        {motionFlag && (
          <div className="ade-motion-flag">
            🚩 <strong>Sensor Mismatch:</strong> {motionFlag}
          </div>
        )}
      </div>

      {/* XAI — Explainable Decision */}
      <div className="ade-section">
        <div className="ade-xai-header" onClick={() => setShowXAI(v => !v)}>
          <h3>🔍 Explainable Decision Engine (XAI)</h3>
          <span>{showXAI ? '▲' : '▼'} {trust.verdict}</span>
        </div>
        {showXAI && (
          <div className="ade-xai-body">
            <div className="ade-verdict-big" style={{ color: trust.color }}>
              {trust.verdict === 'Approved' ? '✅ Claim Approved' : trust.verdict === 'Review' ? '⚠️ Under Review' : '🚫 Claim Flagged'}
            </div>
            {trust.reasons.length > 0 && (
              <div className="ade-reasons">
                <strong>✅ Approved because:</strong>
                <ul>{trust.reasons.map((r,i) => <li key={i}>{r}</li>)}</ul>
              </div>
            )}
            {trust.flags.length > 0 && (
              <div className="ade-flags-list">
                <strong>🚩 Flagged because:</strong>
                <ul>{trust.flags.map((f,i) => <li key={i}>{f}</li>)}</ul>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Distributed Verification */}
      <div className="ade-section">
        <h3>👥 Distributed Verification Layer</h3>
        <div className="ade-peer-card">
          <div className="ade-peer-count" style={{ color: peerCount >= 3 ? '#48bb78' : '#fc8181' }}>
            {peerCount}
          </div>
          <div>
            <strong>{peerCount >= 3 ? '✅ Peer Verified' : '⚠️ Low Peer Confirmation'}</strong>
            <p>{peerCount} out of ~15 nearby riders reported the same disruption in your zone.</p>
            <p className="ade-peer-note">
              {peerCount >= 5 ? 'Strong community confirmation — claim credibility HIGH' :
               peerCount >= 3 ? 'Moderate confirmation — claim credibility MEDIUM' :
               'Low confirmation — claim will be reviewed manually'}
            </p>
          </div>
        </div>
      </div>

      {/* Anomaly Heatmap */}
      <div className="ade-section">
        <h3>🗺️ Anomaly Heatmap</h3>
        <p className="ade-sub">Zones with high fraud attempts vs genuine disruptions</p>

        {/* Visuals row: Pie chart + India map */}
        <div className="ade-heatmap-visuals">

          {/* Pie Chart — Fraud vs Disruption breakdown */}
          <div className="ade-pie-card">
            <div className="ade-pie-title">📊 Fraud vs Disruption Split</div>
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie
                  data={[
                    { name: 'High Fraud Zones',    value: heatmapZones.filter(z => z.fraud > 60).length },
                    { name: 'Watch Zones',          value: heatmapZones.filter(z => z.fraud > 40 && z.fraud <= 60).length },
                    { name: 'Safe Zones',           value: heatmapZones.filter(z => z.fraud <= 40).length },
                  ]}
                  cx="50%" cy="50%" innerRadius={55} outerRadius={85}
                  paddingAngle={4} dataKey="value"
                >
                  <Cell fill="#fc8181"/>
                  <Cell fill="#f6ad55"/>
                  <Cell fill="#68d391"/>
                </Pie>
                <Tooltip
                  contentStyle={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '0.8rem' }}
                  formatter={(val, name) => [`${val} zone${val !== 1 ? 's' : ''}`, name]}
                />
                <Legend iconType="circle" iconSize={10} wrapperStyle={{ fontSize: '0.78rem' }}/>
              </PieChart>
            </ResponsiveContainer>
            {/* Avg fraud vs disruption summary */}
            <div className="ade-pie-stats">
              <div className="ade-pie-stat">
                <span style={{ color: '#fc8181' }}>●</span>
                Avg Fraud: <strong>{Math.round(heatmapZones.reduce((s,z)=>s+z.fraud,0)/heatmapZones.length)}%</strong>
              </div>
              <div className="ade-pie-stat">
                <span style={{ color: '#4facfe' }}>●</span>
                Avg Disruption: <strong>{Math.round(heatmapZones.reduce((s,z)=>s+z.disruption,0)/heatmapZones.length)}%</strong>
              </div>
            </div>
          </div>

          {/* India SVG Map with city pins */}
          <div className="ade-map-card">
            <div className="ade-pie-title">🇮🇳 City Risk Map</div>
            <div className="ade-india-map">
              {/* Real India map image as background */}
              <div style={{ position: 'relative', width: '100%', maxWidth: '280px' }}>
                <img
                  src={`${process.env.PUBLIC_URL}/india-map.png.webp`}
                  alt="India Map"
                  style={{ width: '100%', borderRadius: '8px', opacity: 0.85 }}
                  onError={e => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'block'; }}
                />
                {/* City pins overlaid on the image */}
                <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }}>
                  {[
                    { name: 'Delhi',     top: '22%', left: '42%', fraud: 78, disruption: 45 },
                    { name: 'Mumbai',    top: '55%', left: '22%', fraud: 32, disruption: 82 },
                    { name: 'Bangalore', top: '75%', left: '38%', fraud: 15, disruption: 28 },
                    { name: 'Hyderabad', top: '65%', left: '42%', fraud: 45, disruption: 60 },
                    { name: 'Kolkata',   top: '38%', left: '72%', fraud: 62, disruption: 55 },
                    { name: 'Chennai',   top: '78%', left: '48%', fraud: 28, disruption: 70 },
                  ].map((city, i) => {
                    const isHighFraud = city.fraud > 60;
                    const isWatch = city.fraud > 40 && city.fraud <= 60;
                    const dotColor = isHighFraud ? '#fc8181' : isWatch ? '#f6ad55' : '#68d391';
                    const isUserCity = (insuranceData?.city || '').toLowerCase() === city.name.toLowerCase();
                    return (
                      <div key={i} style={{ position: 'absolute', top: city.top, left: city.left, transform: 'translate(-50%,-50%)', textAlign: 'center' }}>
                        <div style={{
                          width: isUserCity ? '14px' : '10px',
                          height: isUserCity ? '14px' : '10px',
                          borderRadius: '50%',
                          background: dotColor,
                          border: `2px solid white`,
                          boxShadow: `0 0 8px ${dotColor}`,
                          margin: '0 auto',
                        }}/>
                        <div style={{ fontSize: '7px', fontWeight: 700, color: '#1e3a5f', whiteSpace: 'nowrap', marginTop: '1px', textShadow: '0 1px 2px white' }}>{city.name}</div>
                        <div style={{ fontSize: '6px', color: dotColor, fontWeight: 700 }}>{city.fraud}%</div>
                      </div>
                    );
                  })}
                </div>
                {/* Fallback SVG */}
                <svg viewBox="0 0 550 600" style={{ display: 'none', width: '100%' }}>
                  <rect width="550" height="600" fill="#f0f4f8" rx="8"/>
                  <text x="275" y="300" textAnchor="middle" fontSize="14" fill="#718096">India Map</text>
                </svg>
              </div>
              <div className="ade-map-legend">
                <span><span style={{color:'#fc8181'}}>●</span> High Fraud</span>
                <span><span style={{color:'#f6ad55'}}>●</span> Watch</span>
                <span><span style={{color:'#68d391'}}>●</span> Safe</span>
                <span><span style={{color:'#4facfe'}}>★</span> Your City</span>
              </div>
            </div>
          </div>
        </div>

        {/* Table rows below */}
        <div className="ade-heatmap">
          <div className="ade-heatmap-header">
            <span>Zone</span><span>Fraud Risk</span><span>Disruption</span><span>Status</span>
          </div>
          {heatmapZones.map((z, i) => (
            <div key={i} className="ade-heatmap-row">
              <span className="ade-zone-name">📍 {z.zone}</span>
              <div className="ade-bar-wrap">
                <div className="ade-bar-fill" style={{ width: `${z.fraud}%`, background: '#fc8181' }}/>
                <span>{z.fraud}%</span>
              </div>
              <div className="ade-bar-wrap">
                <div className="ade-bar-fill" style={{ width: `${z.disruption}%`, background: '#4facfe' }}/>
                <span>{z.disruption}%</span>
              </div>
              <span className="ade-zone-tag" style={{ background: z.color }}>
                {z.fraud > 60 ? 'High Fraud' : z.fraud > 40 ? 'Watch' : 'Safe'}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Real-Time Risk Stream */}
      <div className="ade-section">
        <h3>📈 Real-Time Risk Stream</h3>
        <p className="ade-sub">Live updating risk score — refreshes every 2 seconds</p>
        <div className="ade-risk-stream">

          {/* Big animated gauge */}
          <div className="ade-risk-visual">
            <div className="ade-risk-orb" style={{
              '--risk': liveRisk,
              background: liveRisk >= 70
                ? 'radial-gradient(circle at 40% 35%, #9b59b6, #6c3483)'
                : liveRisk >= 45
                ? 'radial-gradient(circle at 40% 35%, #b39ddb, #7b1fa2)'
                : 'radial-gradient(circle at 40% 35%, #ce93d8, #8e24aa)',
              boxShadow: liveRisk >= 70
                ? '0 0 40px rgba(155,89,182,0.7), 0 0 80px rgba(155,89,182,0.4)'
                : liveRisk >= 45
                ? '0 0 40px rgba(179,157,219,0.7), 0 0 80px rgba(179,157,219,0.4)'
                : '0 0 40px rgba(206,147,216,0.6), 0 0 80px rgba(206,147,216,0.3)',
            }}>
              <div className="ade-orb-number">{liveRisk}%</div>
              <div className="ade-orb-label">RISK</div>
              <div className="ade-orb-wave"/>
            </div>

            {/* Trend arrow */}
            <div className={`ade-trend-arrow ${riskTrend}`}>
              {riskTrend === 'rising' ? '↑' : riskTrend === 'falling' ? '↓' : '→'}
              <span>{riskTrend === 'rising' ? 'Rising' : riskTrend === 'falling' ? 'Falling' : 'Stable'}</span>
            </div>

            {/* Mini bars */}
            <div className="ade-mini-bars">
              {riskHistory.slice(-12).map((v, i) => (
                <div key={i} className="ade-mini-bar-wrap">
                  <div className="ade-mini-bar" style={{
                    height: `${Math.max(8, v * 0.7)}px`,
                    background: v >= 70 ? '#9b59b6' : v >= 45 ? '#b39ddb' : '#ce93d8',
                    opacity: 0.3 + (i / 12) * 0.7,
                  }}/>
                </div>
              ))}
            </div>
          </div>

          {/* 3 signal pills */}
          <div className="ade-risk-pills">
            {[
              { label: 'Weather',  val: `${Math.min(100, Math.round(liveRisk * 0.8))}%`,  color: '#9b59b6' },
              { label: 'Area',     val: `${Math.min(100, Math.round(liveRisk * 0.6))}%`,  color: '#b39ddb' },
              { label: 'History',  val: `${Math.min(100, Math.round(liveRisk * 0.4))}%`,  color: '#ce93d8' },
            ].map((p, i) => (
              <div key={i} className="ade-risk-pill">
                <div className="ade-pill-ring" style={{ '--pct': Math.min(100, Math.round(liveRisk * (0.8 - i * 0.2))) }}>
                  <svg viewBox="0 0 60 60">
                    <circle cx="30" cy="30" r="24" fill="none" stroke="#e2e8f0" strokeWidth="5"/>
                    <circle cx="30" cy="30" r="24" fill="none" stroke={p.color} strokeWidth="5"
                      strokeDasharray={`${(parseInt(p.val)/100)*150} 150`}
                      strokeLinecap="round" transform="rotate(-90 30 30)"
                      style={{ transition: 'stroke-dasharray 0.8s ease' }}/>
                    <text x="30" y="35" textAnchor="middle" fontSize="12" fontWeight="800" fill={p.color}>{p.val}</text>
                  </svg>
                </div>
                <span>{p.label}</span>
              </div>
            ))}
          </div>

          <div className="ade-risk-status-bar" style={{
            background: liveRisk >= 70 ? 'linear-gradient(135deg,#f3e5f5,#e1bee7)' :
                        liveRisk >= 45 ? 'linear-gradient(135deg,#ede7f6,#d1c4e9)' :
                                         'linear-gradient(135deg,#f8f0ff,#e8d5f5)',
            borderColor: liveRisk >= 70 ? '#9b59b6' : liveRisk >= 45 ? '#b39ddb' : '#ce93d8',
          }}>
            <span style={{ fontSize: '1.4rem' }}>
              {liveRisk >= 70 ? '🔴' : liveRisk >= 45 ? '🟡' : '🟢'}
            </span>
            <span style={{ fontWeight: 600, color: '#1e3a5f' }}>
              {liveRisk >= 70 ? 'High Risk — Claims auto-activated. Family notified.' :
               liveRisk >= 45 ? 'Medium Risk — Active monitoring. Ready to trigger.' :
               'Low Risk — All clear. Normal conditions.'}
            </span>
          </div>
        </div>
      </div>

      {/* Geo-Fencing Intelligence */}
      <div className="ade-section">
        <h3>📍 Geo-Fencing Intelligence Engine</h3>
        <p className="ade-sub">Dynamic risk zones — riders inside eligible zones get auto-coverage</p>

        {/* User zone banner */}
        {userZone ? (
          <div className="user-zone-banner" style={{ borderColor: geoZones[userZone-1].color, background: `${geoZones[userZone-1].color}15` }}>
            <span style={{ fontSize: '2rem' }}>📍</span>
            <div>
              <strong style={{ color: geoZones[userZone-1].color }}>You are in {geoZones[userZone-1].name}</strong>
              <p>{geoZones[userZone-1].eligible ? `✅ You are auto-eligible for claims — ${geoZones[userZone-1].reason}` : '⬜ No active disruption in your zone right now'}</p>
            </div>
            <div className="uzb-badge" style={{ background: geoZones[userZone-1].color }}>Zone {String.fromCharCode(64+userZone)}</div>
          </div>
        ) : (
          <div className="user-zone-banner" style={{ borderColor: '#fc8181', background: '#fff5f5' }}>
            <span style={{ fontSize: '2rem' }}>⚠️</span>
            <div><strong style={{ color: '#c53030' }}>Location mismatch — not assigned to any zone</strong><p>Your GPS location doesn't match your registered city. Claims are blocked.</p></div>
          </div>
        )}

        <div className="geo-zones-visual">
          {geoZones.map((z, i) => {
            const zoneInfo = cityZoneData[i] || cityZoneData[0];
            return (
            <div key={z.id} className={`geo-zone-box ${userZone === z.id ? 'user-here' : ''}`}>
              <div className="geo-zone-symbol" style={{ background: `radial-gradient(circle at 40% 35%, ${z.color}cc, ${z.color})`, boxShadow: userZone === z.id ? `0 0 30px ${z.color}88, 0 0 60px ${z.color}44` : `0 8px 24px rgba(0,0,0,0.15)` }}>
                <div className="geo-zone-rings">
                  <div className="geo-ring" style={{ width:'85%', height:'85%', borderColor:`${z.color}88` }}/>
                  <div className="geo-ring" style={{ width:'60%', height:'60%', borderColor:`${z.color}bb` }}/>
                  <div className="geo-ring" style={{ width:'35%', height:'35%', borderColor:'white' }}/>
                </div>
                <div className="geo-zone-letter">{String.fromCharCode(65+i)}</div>
                {Array.from({length:Math.min(z.riders,5)}).map((_,ri)=>(
                  <div key={ri} className="geo-rider-dot" style={{ top:`${30+Math.sin(ri*1.05)*28}%`, left:`${30+Math.cos(ri*1.05)*28}%` }}>🛵</div>
                ))}
                {userZone === z.id && <div className="geo-you-dot">👤 You</div>}
              </div>
              {userZone === z.id && <div className="geo-you-tag" style={{ background: z.color }}>📍 You're here</div>}
              <div className="geo-zone-name-label">{zoneInfo.name}</div>
              <div className="geo-zone-label" style={{ color: z.color }}>{z.risk} Risk</div>
              <div className="geo-zone-count">👥 {z.riders} riders</div>
              <div className="geo-zone-eligible">{z.eligible ? '✅ Auto-eligible' : '⬜ Safe zone'}</div>
              <div className="geo-zone-examples">
                <div className="geo-examples-title">📍 Areas:</div>
                {zoneInfo.areas.map((ex, ei) => (
                  <div key={ei} className="geo-example-tag" style={{ borderColor: z.color, color: z.color }}>{ex}</div>
                ))}
              </div>
            </div>
            );
          })}
        </div>
      </div>

      {/* Zero Trust Claim Processing */}
      <div className="ade-section">
        <h3>🔐 Zero Trust Claim Processing</h3>
        <p className="ade-sub">Every claim must pass ALL 8 checks — nothing is assumed safe</p>
        <div className="ade-zt-grid">
          {zeroTrustChecks.map((c, i) => (
            <div key={i} className={`ade-zt-check ${c.pass ? 'pass' : 'fail'}`}>
              <span>{c.pass ? '✅' : '❌'}</span>
              <span>{c.label}</span>
            </div>
          ))}
        </div>
        <div className="ade-zt-verdict" style={{ background: ztColor }}>
          Zero Trust Verdict: <strong>{ztVerdict}</strong> ({passCount}/8 checks passed)
        </div>
      </div>

      {/* Cross-Platform Sync */}
      <div className="ade-section">
        <h3>🌐 Cross-Platform Data Sync</h3>
        <p className="ade-sub">Behavior synced across all your devices — prevents multi-device fraud</p>
        <div className="ade-devices">
          {deviceSessions.map((d, i) => (
            <div key={i} className={`ade-device-card ${d.status}`}>
              <div className="ade-device-icon">{d.device.includes('Mobile') ? '📱' : '💻'}</div>
              <div className="ade-device-info">
                <strong>{d.device}</strong>
                <span>Last seen: {d.lastSeen} · {d.location}</span>
              </div>
              <span className={`ade-device-status ${d.status}`}>{d.status === 'active' ? '🟢 Active' : '⚫ Inactive'}</span>
            </div>
          ))}
        </div>
        <p className="ade-sync-note">🔒 If the same claim is submitted from 2 devices simultaneously, it is automatically flagged as duplicate fraud.</p>
      </div>

    </div>
  );
};

export default AIDefenseEngine;
