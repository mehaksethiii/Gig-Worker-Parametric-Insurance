import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Shield, Check, TrendingUp } from 'lucide-react';
import { getToken, getRider, saveAuth } from '../auth';
import './SelectPlanPage.css';

const PLANS = [
  {
    id: 'starter', name: 'Starter', price: 99, maxPayout: 250, category: 'basic',
    badge: null, icon: '🌱', color: '#68d391',
    features: ['Weather alerts only', 'Up to ₹250 weekly payout', 'Email support', 'Basic AI monitoring'],
  },
  {
    id: 'basic', name: 'Basic', price: 199, maxPayout: 500, category: 'basic',
    badge: null, icon: '🛡️', color: '#4facfe',
    features: ['Weather disruption coverage', 'Up to ₹500 weekly payout', 'SMS alerts', 'Basic AI monitoring'],
  },
  {
    id: 'standard', name: 'Standard', price: 299, maxPayout: 750, category: 'popular',
    badge: 'Most Popular', icon: '⚡', color: '#ff6b35',
    features: ['All Basic features', 'Local shutdown coverage', 'Up to ₹750 weekly payout', 'Priority AI monitoring', '24/7 support'],
  },
  {
    id: 'premium', name: 'Premium', price: 399, maxPayout: 1200, category: 'popular',
    badge: 'Best Value', icon: '🔥', color: '#fa709a',
    features: ['All Standard features', 'Pollution + heat coverage', 'Up to ₹1200 weekly payout', 'Instant payout < 2hrs', 'Advanced fraud protection'],
  },
  {
    id: 'pro', name: 'Pro', price: 599, maxPayout: 2000, category: 'advanced',
    badge: null, icon: '💎', color: '#764ba2',
    features: ['All Premium features', 'Multi-zone coverage', 'Up to ₹2000 weekly payout', 'Dedicated account manager', 'Priority claim processing', 'Trust score boost'],
  },
  {
    id: 'enterprise', name: 'Enterprise', price: 999, maxPayout: 5000, category: 'advanced',
    badge: '🏆 Top Tier', icon: '👑', color: '#ffd700',
    features: ['All Pro features', 'Fleet coverage (up to 5 riders)', 'Up to ₹5000 weekly payout', 'Custom triggers', 'White-glove support', 'Monthly risk report', 'API access'],
  },
];

const TABS = [
  { id: 'all',      label: 'All Plans' },
  { id: 'basic',    label: 'Starter' },
  { id: 'popular',  label: '🔥 Popular' },
  { id: 'advanced', label: '💎 Advanced' },
];

const SelectPlanPage = () => {
  const navigate = useNavigate();
  const [selectedPlan, setSelectedPlan] = useState('standard');
  const [activeTab, setActiveTab] = useState('all');
  const [riskData, setRiskData] = useState(null);
  const [loadingRisk, setLoadingRisk] = useState(false);
  const [upiId, setUpiId] = useState(getRider()?.upiId || '');
  const [activating, setActivating] = useState(false);

  const riderData = getRider() || JSON.parse(localStorage.getItem('riderData') || '{}');
  const visiblePlans = activeTab === 'all' ? PLANS : PLANS.filter(p => p.category === activeTab);

  useEffect(() => {
    if (!riderData?.city) return;
    const plan = PLANS.find(p => p.id === selectedPlan);
    if (!plan) return;
    setLoadingRisk(true);
    fetch('/api/premium/calculate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ city: riderData.city, workingHours: riderData.workingHours, deliveryType: riderData.deliveryType, plan: plan.name }),
    })
      .then(r => r.json()).then(d => setRiskData(d)).catch(() => setRiskData(null))
      .finally(() => setLoadingRisk(false));
  }, [selectedPlan]); // eslint-disable-line

  const handleSelectPlan = async () => {
    const plan = PLANS.find(p => p.id === selectedPlan);
    const premium = riskData?.dynamicPremium || plan.price;
    setActivating(true);

    // Save UPI to backend if provided
    const token = getToken();
    if (token && upiId && upiId.includes('@')) {
      fetch('/api/settlement/payment-details', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ upiId, preferredPaymentMode: 'upi' }),
      }).catch(() => {});
    }

    const insuranceData = {
      ...riderData,
      plan: plan.name,
      premium,
      maxPayout: plan.maxPayout,
      upiId,
      riskScore: riskData?.riskScore || 70,
      riskLevel: riskData?.riskLevel || 'Medium',
    };
    localStorage.setItem('insuranceData', JSON.stringify(insuranceData));
    if (token) {
      fetch('/api/auth/update-plan', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ plan: plan.name, premium, maxPayout: plan.maxPayout }),
      }).then(r => r.json()).then(d => { if (d.rider) saveAuth(token, d.rider); }).catch(() => {});
    }
    setActivating(false);
    navigate('/dashboard');
  };

  const plan = PLANS.find(p => p.id === selectedPlan);

  return (
    <div className="select-plan-page">
      <nav className="navbar">
        <div className="nav-container">
          <div className="logo" onClick={() => navigate('/')}><Shield size={32}/><span>RideShield</span></div>
        </div>
      </nav>

      <div className="plan-container">
        <div className="plan-header">
          <h1>Choose Your Protection Plan</h1>
          <p>6 plans from ₹99/week to full fleet coverage — pick what fits your life</p>
        </div>

        {riskData && (
          <div className={`risk-banner risk-${riskData.riskLevel.toLowerCase()}`}>
            <TrendingUp size={20}/>
            <span>AI Risk Score for {riderData.city}: <strong>{riskData.riskScore}/100</strong> ({riskData.riskLevel} Risk)</span>
            <span className="dynamic-price">Suggested Premium: <strong>₹{riskData.dynamicPremium}/week</strong></span>
          </div>
        )}
        {loadingRisk && <div className="risk-loading">⚡ Calculating your AI risk score...</div>}

        <div className="plan-tabs">
          {TABS.map(t => (
            <button key={t.id} className={`plan-tab ${activeTab === t.id ? 'active' : ''}`} onClick={() => setActiveTab(t.id)}>
              {t.label}
            </button>
          ))}
        </div>

        <div className="plans-grid">
          {visiblePlans.map((p) => (
            <div key={p.id} className={`plan-card ${selectedPlan === p.id ? 'selected' : ''}`}
              style={{ '--plan-color': p.color }}
              onClick={() => setSelectedPlan(p.id)}>
              {p.badge && <div className="popular-badge" style={{ background: p.color }}>{p.badge}</div>}
              <div className="plan-icon">{p.icon}</div>
              <div className="plan-name">{p.name}</div>
              <div className="plan-price">
                <span className="currency">₹</span>
                <span className="amount">{selectedPlan === p.id && riskData ? riskData.dynamicPremium : p.price}</span>
                <span className="period">/week</span>
              </div>
              {selectedPlan === p.id && riskData && riskData.dynamicPremium !== p.price && (
                <div className="price-note">Base ₹{p.price} · AI adjusted</div>
              )}
              <div className="plan-payout">Max Payout: <strong style={{ color: p.color }}>₹{p.maxPayout.toLocaleString()}</strong></div>
              <div className="plan-features">
                {p.features.map((f, i) => (
                  <div key={i} className="feature-item">
                    <Check size={16} style={{ color: p.color }}/><span>{f}</span>
                  </div>
                ))}
              </div>
              <button className={`btn-select ${selectedPlan === p.id ? 'selected' : ''}`}
                style={selectedPlan === p.id ? { background: p.color, borderColor: p.color } : { borderColor: p.color, color: p.color }}
                onClick={e => { e.stopPropagation(); setSelectedPlan(p.id); }}>
                {selectedPlan === p.id ? '✓ Selected' : 'Select Plan'}
              </button>
            </div>
          ))}
        </div>

        <div className="plan-footer">
          {/* UPI / Payout details input */}
          <div className="plan-upi-box">
            <div className="plan-upi-title">📱 Enter your UPI ID for automatic payouts</div>
            <p className="plan-upi-sub">When a claim is approved, payout goes here instantly — no action needed from you</p>
            <div className="plan-upi-row">
              <input
                className="plan-upi-input"
                type="text"
                placeholder="e.g. yourname@paytm or 9876543210@upi"
                value={upiId}
                onChange={e => setUpiId(e.target.value)}
              />
              {upiId.includes('@') && <span className="plan-upi-check">✅</span>}
            </div>
            <p className="plan-upi-hint">💡 You'll verify your identity via Razorpay OTP (₹1 refundable) — plan is free</p>
          </div>

          <button className="btn-continue" onClick={handleSelectPlan} disabled={activating}>
            {activating ? '⏳ Activating...' : `Activate ${plan?.icon} ${plan?.name} Plan →`}
          </button>
          <p className="plan-note">✅ Free activation · Payouts sent automatically to your UPI when disruption is verified</p>
        </div>
      </div>
    </div>
  );
};

export default SelectPlanPage;
