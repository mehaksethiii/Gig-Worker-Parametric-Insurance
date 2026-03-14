import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Shield, Check } from 'lucide-react';
import './SelectPlanPage.css';

const SelectPlanPage = () => {
  const navigate = useNavigate();
  const [selectedPlan, setSelectedPlan] = useState('standard');

  const plans = [
    {
      id: 'basic',
      name: 'Basic',
      price: 199,
      maxPayout: 500,
      features: [
        'Weather disruption coverage',
        'Up to ₹500 weekly payout',
        'Basic AI monitoring',
        'Email support'
      ]
    },
    {
      id: 'standard',
      name: 'Standard',
      price: 299,
      maxPayout: 750,
      popular: true,
      features: [
        'All Basic features',
        'Local shutdown coverage',
        'Up to ₹750 weekly payout',
        'Priority AI monitoring',
        'SMS + Email alerts',
        '24/7 support'
      ]
    },
    {
      id: 'premium',
      name: 'Premium',
      price: 399,
      maxPayout: 1000,
      features: [
        'All Standard features',
        'Pollution coverage',
        'Up to ₹1000 weekly payout',
        'Advanced fraud protection',
        'Instant payout (< 2 hours)',
        'Dedicated support'
      ]
    }
  ];

  const handleSelectPlan = () => {
    const riderData = JSON.parse(localStorage.getItem('riderData'));
    const plan = plans.find(p => p.id === selectedPlan);
    
    const insuranceData = {
      ...riderData,
      plan: plan.name,
      premium: plan.price,
      maxPayout: plan.maxPayout,
      riskScore: Math.floor(Math.random() * 30) + 60
    };

    localStorage.setItem('insuranceData', JSON.stringify(insuranceData));
    navigate('/dashboard');
  };

  return (
    <div className="select-plan-page">
      <nav className="navbar">
        <div className="nav-container">
          <div className="logo" onClick={() => navigate('/')}>
            <Shield size={32} />
            <span>RideShield</span>
          </div>
        </div>
      </nav>

      <div className="plan-container">
        <div className="plan-header">
          <h1>Choose Your Protection Plan</h1>
          <p>Select the plan that best fits your needs</p>
        </div>

        <div className="plans-grid">
          {plans.map((plan) => (
            <div
              key={plan.id}
              className={`plan-card ${selectedPlan === plan.id ? 'selected' : ''} ${plan.popular ? 'popular' : ''}`}
              onClick={() => setSelectedPlan(plan.id)}
            >
              {plan.popular && <div className="popular-badge">Most Popular</div>}
              
              <div className="plan-name">{plan.name}</div>
              <div className="plan-price">
                <span className="currency">₹</span>
                <span className="amount">{plan.price}</span>
                <span className="period">/week</span>
              </div>
              <div className="plan-payout">
                Max Payout: <strong>₹{plan.maxPayout}</strong>
              </div>

              <div className="plan-features">
                {plan.features.map((feature, index) => (
                  <div key={index} className="feature-item">
                    <Check size={18} />
                    <span>{feature}</span>
                  </div>
                ))}
              </div>

              <button
                className={`btn-select ${selectedPlan === plan.id ? 'selected' : ''}`}
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedPlan(plan.id);
                }}
              >
                {selectedPlan === plan.id ? 'Selected' : 'Select Plan'}
              </button>
            </div>
          ))}
        </div>

        <div className="plan-footer">
          <button className="btn-continue" onClick={handleSelectPlan}>
            Continue with {plans.find(p => p.id === selectedPlan)?.name} Plan
          </button>
          <p className="plan-note">
            You can change or cancel your plan anytime. No hidden fees.
          </p>
        </div>
      </div>
    </div>
  );
};

export default SelectPlanPage;
