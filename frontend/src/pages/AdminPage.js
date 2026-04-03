import React, { useState, useEffect, useCallback } from 'react';
import { Shield, Users, FileCheck, Wallet, AlertTriangle, LogOut, RefreshCw, CheckCircle, XCircle, TrendingUp, Activity } from 'lucide-react';
import './AdminPage.css';

const ADMIN_KEY = 'rideshield_admin_2026';
const API = '/api/admin';

const headers = { 'x-admin-key': ADMIN_KEY, 'Content-Type': 'application/json' };

// ── Stat Card ─────────────────────────────────────────────────────────────────
const StatCard = ({ icon, label, value, sub, color }) => (
  <div className="adm-stat-card" style={{ borderTop: `4px solid ${color}` }}>
    <div className="adm-stat-icon" style={{ background: `${color}22`, color }}>{icon}</div>
    <div className="adm-stat-info">
      <div className="adm-stat-value" style={{ color }}>{value}</div>
      <div className="adm-stat-label">{label}</div>
      {sub && <div className="adm-stat-sub">{sub}</div>}
    </div>
  </div>
);

// ── Admin Login ───────────────────────────────────────────────────────────────
const AdminLogin = ({ onLogin }) => {
  const [pass, setPass] = useState('');
  const [err, setErr] = useState('');
  const submit = (e) => {
    e.preventDefault();
    if (pass === ADMIN_KEY) { onLogin(); }
    else setErr('Incorrect admin password');
  };
  return (
    <div className="adm-login-wrap">
      <div className="adm-login-card">
        <div className="adm-login-logo"><Shield size={40}/><span>RideShield</span></div>
        <h2>Admin Dashboard</h2>
        <p>Enter admin password to continue</p>
        <form onSubmit={submit}>
          <input type="password" placeholder="Admin password" value={pass}
            onChange={e => { setPass(e.target.value); setErr(''); }}
            className="adm-login-input" autoFocus/>
          {err && <div className="adm-login-err">{err}</div>}
          <button type="submit" className="adm-login-btn">Login →</button>
        </form>
      </div>
    </div>
  );
};

// ── Main Admin Page ───────────────────────────────────────────────────────────
const AdminPage = () => {
  const [authed, setAuthed]     = useState(false);
  const [tab, setTab]           = useState('overview');
  const [stats, setStats]       = useState(null);
  const [riders, setRiders]     = useState([]);
  const [claims, setClaims]     = useState([]);
  const [payouts, setPayouts]   = useState([]);
  const [loading, setLoading]   = useState(false);
  const [toast, setToast]       = useState('');

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(''), 3000); };

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [s, r, c, p] = await Promise.all([
        fetch(`${API}/stats`, { headers }).then(x => x.json()),
        fetch(`${API}/riders`, { headers }).then(x => x.json()),
        fetch(`${API}/claims`, { headers }).then(x => x.json()),
        fetch(`${API}/payouts`, { headers }).then(x => x.json()),
      ]);
      setStats(s);
      setRiders(r.riders || []);
      setClaims(c.claims || []);
      setPayouts(p.payouts || []);
    } catch (_) {
      // Backend offline — show demo data
      setStats({ totalRiders: 12, activePlans: 9, totalClaims: 34, approvedClaims: 28, flaggedClaims: 3, totalPayoutAmount: 14280, todayClaims: 4, todayPayouts: 3, approvalRate: 82 });
    }
    setLoading(false);
  }, []);

  useEffect(() => { if (authed) fetchAll(); }, [authed, fetchAll]);

  const updateClaim = async (id, status) => {
    try {
      await fetch(`${API}/claims/${id}`, { method: 'PUT', headers, body: JSON.stringify({ status }) });
      setClaims(prev => prev.map(c => c._id === id ? { ...c, status } : c));
      showToast(`✅ Claim ${status}`);
    } catch (_) { showToast('❌ Failed — backend offline'); }
  };

  const deactivateRider = async (id) => {
    if (!window.confirm('Deactivate this rider?')) return;
    try {
      await fetch(`${API}/riders/${id}`, { method: 'DELETE', headers });
      setRiders(prev => prev.filter(r => r._id !== id));
      showToast('✅ Rider deactivated');
    } catch (_) { showToast('❌ Failed — backend offline'); }
  };

  if (!authed) return <AdminLogin onLogin={() => setAuthed(true)}/>;

  const NAV = [
    { id: 'overview', icon: <Activity size={18}/>, label: 'Overview' },
    { id: 'riders',   icon: <Users size={18}/>,    label: `Riders (${riders.length})` },
    { id: 'claims',   icon: <FileCheck size={18}/>, label: `Claims (${claims.length})` },
    { id: 'payouts',  icon: <Wallet size={18}/>,    label: `Payouts (${payouts.length})` },
  ];

  return (
    <div className="adm-page">
      {toast && <div className="adm-toast">{toast}</div>}

      {/* Sidebar */}
      <aside className="adm-sidebar">
        <div className="adm-sidebar-logo"><Shield size={28}/><span>RideShield</span><span className="adm-badge">ADMIN</span></div>
        <nav className="adm-nav">
          {NAV.map(n => (
            <button key={n.id} className={`adm-nav-item ${tab === n.id ? 'active' : ''}`} onClick={() => setTab(n.id)}>
              {n.icon}<span>{n.label}</span>
            </button>
          ))}
        </nav>
        <div className="adm-sidebar-footer">
          <button className="adm-refresh" onClick={fetchAll} disabled={loading}>
            <RefreshCw size={16} className={loading ? 'spinning' : ''}/> Refresh
          </button>
          <button className="adm-logout" onClick={() => setAuthed(false)}>
            <LogOut size={16}/> Logout
          </button>
        </div>
      </aside>

      {/* Main */}
      <main className="adm-main">
        <div className="adm-header">
          <h1>{NAV.find(n => n.id === tab)?.label}</h1>
          <span className="adm-live">● Live</span>
        </div>

        {/* ── OVERVIEW ── */}
        {tab === 'overview' && stats && (
          <div className="adm-overview">
            <div className="adm-stats-grid">
              <StatCard icon={<Users size={24}/>}      label="Total Riders"     value={stats.totalRiders}          sub={`${stats.activePlans} with active plans`} color="#4facfe"/>
              <StatCard icon={<FileCheck size={24}/>}  label="Total Claims"     value={stats.totalClaims}          sub={`${stats.todayClaims} today`}             color="#48bb78"/>
              <StatCard icon={<Wallet size={24}/>}     label="Total Paid Out"   value={`₹${stats.totalPayoutAmount?.toLocaleString()}`} sub={`${stats.todayPayouts} payouts today`} color="#9b59b6"/>
              <StatCard icon={<AlertTriangle size={24}/>} label="Flagged Claims" value={stats.flaggedClaims}       sub={`${stats.approvalRate}% approval rate`}   color="#fc8181"/>
              <StatCard icon={<TrendingUp size={24}/>} label="Approved Claims"  value={stats.approvedClaims}       sub="Auto-approved by AI"                      color="#f6ad55"/>
              <StatCard icon={<Activity size={24}/>}   label="Today's Claims"   value={stats.todayClaims}          sub={`${stats.todayPayouts} settled`}          color="#ff6b35"/>
            </div>

            {/* Recent claims preview */}
            <div className="adm-section">
              <h3>Recent Claims</h3>
              <div className="adm-table-wrap">
                <table className="adm-table">
                  <thead><tr><th>Rider</th><th>Reason</th><th>Amount</th><th>Status</th><th>Date</th></tr></thead>
                  <tbody>
                    {claims.slice(0, 8).map((c, i) => (
                      <tr key={i}>
                        <td>{c.riderId?.name || '—'}</td>
                        <td>{c.reason}</td>
                        <td>₹{c.amount}</td>
                        <td><span className={`adm-status adm-${(c.status||'').toLowerCase()}`}>{c.status}</span></td>
                        <td>{new Date(c.createdAt).toLocaleDateString('en-IN')}</td>
                      </tr>
                    ))}
                    {claims.length === 0 && <tr><td colSpan={5} className="adm-empty">No claims yet — backend may be offline</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ── RIDERS ── */}
        {tab === 'riders' && (
          <div className="adm-section">
            <div className="adm-table-wrap">
              <table className="adm-table">
                <thead><tr><th>Name</th><th>City</th><th>Phone</th><th>Plan</th><th>Risk</th><th>UPI</th><th>Action</th></tr></thead>
                <tbody>
                  {riders.map((r, i) => (
                    <tr key={i}>
                      <td><strong>{r.name}</strong><br/><small>{r.email}</small></td>
                      <td>{r.city}</td>
                      <td>{r.phone}</td>
                      <td>{r.insurancePlan?.name ? <span className="adm-plan-badge">{r.insurancePlan.name}</span> : <span className="adm-no-plan">No plan</span>}</td>
                      <td><span className={`adm-risk adm-risk-${(r.riskLevel||'medium').toLowerCase()}`}>{r.riskLevel || 'Medium'}</span></td>
                      <td><small>{r.upiId || '—'}</small></td>
                      <td><button className="adm-btn-danger" onClick={() => deactivateRider(r._id)}>Deactivate</button></td>
                    </tr>
                  ))}
                  {riders.length === 0 && <tr><td colSpan={7} className="adm-empty">No riders — backend may be offline</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── CLAIMS ── */}
        {tab === 'claims' && (
          <div className="adm-section">
            <div className="adm-table-wrap">
              <table className="adm-table">
                <thead><tr><th>Rider</th><th>Reason</th><th>Amount</th><th>Confidence</th><th>Fraud Flags</th><th>Status</th><th>Actions</th></tr></thead>
                <tbody>
                  {claims.map((c, i) => (
                    <tr key={i} className={c.fraudFlags?.length ? 'adm-row-flagged' : ''}>
                      <td>{c.riderId?.name || '—'}<br/><small>{c.riderId?.city}</small></td>
                      <td>{c.reason}</td>
                      <td>₹{c.amount}</td>
                      <td>{c.validation?.confidenceScore ? `${c.validation.confidenceScore}/100` : '—'}</td>
                      <td>{c.fraudFlags?.length ? <span className="adm-flag-tag">🚩 {c.fraudFlags[0]}</span> : <span className="adm-ok-tag">✅ Clean</span>}</td>
                      <td><span className={`adm-status adm-${(c.status||'').toLowerCase()}`}>{c.status}</span></td>
                      <td className="adm-actions">
                        <button className="adm-btn-approve" onClick={() => updateClaim(c._id, 'Approved')}><CheckCircle size={14}/></button>
                        <button className="adm-btn-reject"  onClick={() => updateClaim(c._id, 'Rejected')}><XCircle size={14}/></button>
                      </td>
                    </tr>
                  ))}
                  {claims.length === 0 && <tr><td colSpan={7} className="adm-empty">No claims — backend may be offline</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── PAYOUTS ── */}
        {tab === 'payouts' && (
          <div className="adm-section">
            <div className="adm-table-wrap">
              <table className="adm-table">
                <thead><tr><th>Rider</th><th>Amount</th><th>Reason</th><th>Channel</th><th>Txn ID</th><th>Status</th><th>Date</th></tr></thead>
                <tbody>
                  {payouts.map((p, i) => (
                    <tr key={i}>
                      <td>{p.riderId?.name || '—'}<br/><small>{p.riderId?.city}</small></td>
                      <td><strong>₹{p.amount}</strong></td>
                      <td>{p.reason}</td>
                      <td><span className={`adm-channel adm-ch-${p.channel}`}>{p.channel?.toUpperCase() || 'SANDBOX'}</span></td>
                      <td><small>{p.transactionId || '—'}</small></td>
                      <td><span className={`adm-status adm-${p.status}`}>{p.status}</span></td>
                      <td>{new Date(p.createdAt).toLocaleDateString('en-IN')}</td>
                    </tr>
                  ))}
                  {payouts.length === 0 && <tr><td colSpan={7} className="adm-empty">No payouts — backend may be offline</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default AdminPage;
