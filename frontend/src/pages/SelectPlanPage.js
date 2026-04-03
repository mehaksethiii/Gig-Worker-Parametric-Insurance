import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Shield, Check, TrendingUp, Download } from 'lucide-react';
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

// ── Load Razorpay script dynamically ─────────────────────────────────────────
const loadRazorpay = () => new Promise(resolve => {
  if (window.Razorpay) return resolve(true);
  const script = document.createElement('script');
  script.src = 'https://checkout.razorpay.com/v1/checkout.js';
  script.onload = () => resolve(true);
  script.onerror = () => resolve(false);
  document.body.appendChild(script);
});

// ── Generate & download receipt as HTML file ──────────────────────────────────
const downloadReceipt = ({ riderName, plan, premium, paymentId, orderId, city, date }) => {
  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8"/>
  <title>RideShield Payment Receipt</title>
  <style>
    body { font-family: Arial, sans-serif; max-width: 600px; margin: 40px auto; color: #2d3748; }
    .header { background: linear-gradient(135deg,#1e3a5f,#2c5282); color: white; padding: 2rem; border-radius: 12px 12px 0 0; text-align: center; }
    .header h1 { margin: 0; font-size: 1.8rem; } .header p { margin: 0.3rem 0 0; opacity: 0.8; }
    .body { border: 1px solid #e2e8f0; border-top: none; padding: 2rem; border-radius: 0 0 12px 12px; }
    .row { display: flex; justify-content: space-between; padding: 0.7rem 0; border-bottom: 1px solid #f0f0f0; }
    .row:last-child { border-bottom: none; }
    .label { color: #718096; font-size: 0.9rem; } .value { font-weight: 700; color: #1e3a5f; }
    .success { background: #f0fff4; border: 1.5px solid #48bb78; border-radius: 8px; padding: 1rem; text-align: center; margin: 1.5rem 0; color: #276749; font-weight: 700; }
    .footer { text-align: center; color: #a0aec0; font-size: 0.8rem; margin-top: 1.5rem; }
  </style>
</head>
<body>
  <div class="header"><h1>🛡️ RideShield</h1><p>Payment Receipt</p></div>
  <div class="body">
    <div class="success">✅ Payment Successful — Your coverage is now active!</div>
    <div class="row"><span class="label">Rider Name</span><span class="value">${riderName}</span></div>
    <div class="row"><span class="label">City</span><span class="value">${city}</span></div>
    <div class="row"><span class="label">Plan Activated</span><span class="value">${plan} Plan</span></div>
    <div class="row"><span class="label">Amount Paid</span><span class="value">₹${premium}</span></div>
    <div class="row"><span class="label">Payment ID</span><span class="value">${paymentId}</span></div>
    <div class="row"><span class="label">Order ID</span><span class="value">${orderId}</span></div>
    <div class="row"><span class="label">Date & Time</span><span class="value">${date}</span></div>
    <div class="row"><span class="label">Status</span><span class="value" style="color:#48bb78">✅ Confirmed</span></div>
    <div class="footer">This is an auto-generated receipt from RideShield. Keep it for your records.<br/>We're here for you — rain or shine ❤️</div>
  </div>
</body>
</html>`;

  const blob = new Blob([html], { type: 'text/html' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `RideShield_Receipt_${paymentId}.html`;
  a.click();
  URL.revokeObjectURL(url);
};

const SelectPlanPage = () => {
  const navigate = useNavigate();
  const [selectedPlan, setSelectedPlan] = useState('standard');
  const [activeTab, setActiveTab] = useState('all');
  const [riskData, setRiskData] = useState(null);
  const [loadingRisk, setLoadingRisk] = useState(false);
  const [paying, setPaying] = useState(false);
  const [receipt, setReceipt] = useState(null); // stores last payment receipt data

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

    setPaying(true);

    // Try Razorpay checkout
    try {
      const loaded = await loadRazorpay();
      if (!loaded) throw new Error('Razorpay failed to load');

      // Create order on backend
      const orderRes = await fetch('/api/payment/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: premium, planName: plan.name }),
      });
      const orderData = await orderRes.json();

      if (!orderData.success) throw new Error('Order creation failed');

      // Open Razorpay checkout
      await new Promise((resolve, reject) => {
        const options = {
          key:         orderData.keyId,
          amount:      orderData.amount,
          currency:    'INR',
          name:        'RideShield',
          description: `${plan.name} Plan — Weekly Insurance`,
          order_id:    orderData.orderId,
          prefill: {
            name:    riderData.name  || '',
            email:   riderData.email || '',
            contact: riderData.phone || '',
          },
          theme: { color: plan.color },
          handler: async (response) => {
            // Verify payment
            await fetch('/api/payment/verify', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(response),
            });

            // Save receipt data
            const receiptData = {
              riderName: riderData.name,
              plan:      plan.name,
              premium,
              paymentId: response.razorpay_payment_id,
              orderId:   response.razorpay_order_id,
              city:      riderData.city,
              date:      new Date().toLocaleString('en-IN'),
            };
            setReceipt(receiptData);
            resolve(response);
          },
          modal: { ondismiss: () => reject(new Error('Payment cancelled')) },
        };
        new window.Razorpay(options).open();
      });

    } catch (err) {
      if (err.message !== 'Payment cancelled') {
        console.warn('Razorpay unavailable, activating directly:', err.message);
      } else {
        setPaying(false);
        return; // user cancelled
      }
    }

    // Save plan (whether paid or direct)
    const insuranceData = {
      ...riderData,
      plan: plan.name,
      premium,
      maxPayout: plan.maxPayout,
      riskScore: riskData?.riskScore || 70,
      riskLevel: riskData?.riskLevel || 'Medium',
    };
    localStorage.setItem('insuranceData', JSON.stringify(insuranceData));
    const token = getToken();
    if (token) {
      fetch('/api/auth/update-plan', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ plan: plan.name, premium, maxPayout: plan.maxPayout }),
      }).then(r => r.json()).then(d => { if (d.rider) saveAuth(token, d.rider); }).catch(() => {});
    }

    setPaying(false);
    if (!receipt) navigate('/dashboard'); // navigate only if no receipt to show
  };

  const plan = PLANS.find(p => p.id === selectedPlan);

  return (
    <div className="select-plan-page">
      <nav className="navbar">
        <div className="nav-container">
          <div className="logo" onClick={() => navigate('/')}><Shield size={32}/><span>RideShield</span></div>
        </div>
      </nav>

      {/* ── Payment Success Receipt Modal ── */}
      {receipt && (
        <div className="receipt-overlay">
          <div className="receipt-modal">
            <div className="receipt-header">
              <div className="receipt-check">✅</div>
              <h2>Payment Successful!</h2>
              <p>Your {receipt.plan} plan is now active</p>
            </div>
            <div className="receipt-body">
              <div className="receipt-row"><span>Rider</span><strong>{receipt.riderName}</strong></div>
              <div className="receipt-row"><span>Plan</span><strong>{receipt.plan}</strong></div>
              <div className="receipt-row"><span>Amount Paid</span><strong style={{color:'#48bb78'}}>₹{receipt.premium}</strong></div>
              <div className="receipt-row"><span>Payment ID</span><strong style={{fontSize:'0.8rem'}}>{receipt.paymentId}</strong></div>
              <div className="receipt-row"><span>Date</span><strong>{receipt.date}</strong></div>
            </div>
            <div className="receipt-actions">
              <button className="btn-download-receipt" onClick={() => downloadReceipt(receipt)}>
                <Download size={16}/> Download Receipt
              </button>
              <button className="btn-go-dashboard" onClick={() => navigate('/dashboard')}>
                Go to Dashboard →
              </button>
            </div>
          </div>
        </div>
      )}

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
          <button className="btn-continue" onClick={handleSelectPlan} disabled={paying}>
            {paying ? '⏳ Processing...' : `Pay & Activate ${plan?.icon} ${plan?.name} Plan →`}
          </button>
          <p className="plan-note">Secured by Razorpay · Cancel anytime · No hidden fees</p>
        </div>
      </div>
    </div>
  );
};

export default SelectPlanPage;
