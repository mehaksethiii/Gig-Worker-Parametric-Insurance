import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Shield, FileCheck, Wallet, TrendingUp, X } from 'lucide-react';
import './HomePage.css';

const HomePage = () => {
  const navigate = useNavigate();
  const [showVideoModal, setShowVideoModal] = useState(false);

  return (
    <div className="home-page">
      {/* Video Modal */}
      {showVideoModal && (
        <div className="video-modal" onClick={() => setShowVideoModal(false)}>
          <div className="video-modal-content" onClick={(e) => e.stopPropagation()}>
            <button className="close-modal" onClick={() => setShowVideoModal(false)}>
              <X size={24} />
            </button>
            <video controls autoPlay className="demo-video">
              <source src={`${process.env.PUBLIC_URL}/gigworker_recording.mp4`} type="video/mp4" />
              Your browser does not support the video tag.
            </video>
          </div>
        </div>
      )}
      {/* Navigation */}
      <nav className="navbar">
        <div className="nav-container">
          <div className="logo">
            <Shield size={32} />
            <span>RideShield</span>
          </div>
          <div className="nav-links">
            <a href="#dashboard">Dashboard</a>
            <a href="#pricing">Pricing</a>
            <a href="#how-it-works">How It Works</a>
            <button className="btn-signup" onClick={() => navigate('/register')}>Sign Up</button>
            <button className="btn-login" onClick={() => navigate('/register')}>Log In</button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section 
        className="hero-section"
        style={{
          backgroundImage: `url(${process.env.PUBLIC_URL}/hero-delivery-rider.jpg.jpeg)`
        }}
      >
        <div className="hero-content">
          <h1>
            Protecting Gig <span className="highlight">Workers</span><br />
            from <span className="highlight">Income Loss</span>
          </h1>
          <p className="hero-subtitle">
            Instant Insurance Payouts for Delivery Drivers During Disruptions
          </p>
          <div className="hero-buttons">
            <button className="btn-primary" onClick={() => navigate('/register')}>
              Get Started
            </button>
            <button className="btn-secondary" onClick={() => setShowVideoModal(true)}>
              Watch Demo
            </button>
          </div>
        </div>
        <div className="hero-right">
          <div className="hero-badge">
            <h3>🛡️ Real-Time Protection</h3>
            <p>AI monitors weather conditions 24/7 to protect your income</p>
          </div>
        </div>
      </section>

      {/* Features Cards */}
      <section className="features-section">
        <div className="feature-card">
          <div 
            className="feature-icon weather with-bg-image"
            style={{
              backgroundImage: `url(${process.env.PUBLIC_URL}/weather-disruption.jpg.jpeg)`,
              backgroundSize: 'cover',
              backgroundPosition: 'center'
            }}
          >
            {/* Image as background */}
          </div>
          <h3>Weather Disruption</h3>
          <p>Protected during extreme heat, rain & floods</p>
        </div>
        <div className="feature-card">
          <div 
            className="feature-icon shutdown with-bg-image"
            style={{
              backgroundImage: `url(${process.env.PUBLIC_URL}/market-shutdown.jpg.jpeg)`,
              backgroundSize: 'cover',
              backgroundPosition: 'center'
            }}
          >
            {/* Image as background */}
          </div>
          <h3>Local Shutdowns</h3>
          <p>Covered for curfews, strikes, & zone closures</p>
        </div>
        <div className="feature-card">
          <div 
            className="feature-icon payout with-bg-image"
            style={{
              backgroundImage: `url(${process.env.PUBLIC_URL}/automatic-payouts.jpg.jpeg)`,
              backgroundSize: 'cover',
              backgroundPosition: 'center'
            }}
          >
            {/* Image as background */}
          </div>
          <h3>Automatic Payouts</h3>
          <p>Instant claims, quick payouts</p>
        </div>
      </section>

      {/* How It Works */}
      <section className="how-it-works" id="how-it-works">
        <h2>How RideShield Works</h2>
        <div className="steps-container">
          <div className="step-card">
            <div className="step-number" style={{ display: 'none' }}>1</div>
            <div 
              className="step-icon with-image"
              style={{
                backgroundImage: `url(${process.env.PUBLIC_URL}/smart-risk-monitoring.jpg.jpeg)`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                width: '180px',
                height: '180px'
              }}
            >
              {/* Image will show as background */}
            </div>
            <h3>Smart Risk Monitoring</h3>
            <p>AI tracks weather & local alerts</p>
          </div>
          <div className="step-card">
            <div className="step-number" style={{ display: 'none' }}>2</div>
            <div 
              className="step-icon with-image"
              style={{
                backgroundImage: `url(${process.env.PUBLIC_URL}/auto-claim-activation.jpg.jpeg)`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                width: '180px',
                height: '180px'
              }}
            >
              {/* Image will show as background */}
            </div>
            <h3>Auto Claim Activation</h3>
            <p>Disruption detected? Your claim starts live</p>
          </div>
          <div className="step-card">
            <div className="step-number" style={{ display: 'none' }}>3</div>
            <div 
              className="step-icon with-image"
              style={{
                backgroundImage: `url(${process.env.PUBLIC_URL}/instant-payout.jpg.jpeg)`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                width: '180px',
                height: '180px'
              }}
            >
              {/* Image will show as background */}
            </div>
            <h3>Instant Payout</h3>
            <p>Get paid within hours for lost income</p>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section className="pricing-section" id="pricing">
        <div className="pricing-banner">
          <h2>Weekly Plans Starting at <span className="price">₹199</span> Only</h2>
          <p>Affordable Protection Aligned with Your Earnings</p>
          <button className="btn-signup-now" onClick={() => navigate('/register')}>
            Sign Up Now
          </button>
        </div>
      </section>

      {/* Dashboard Preview */}
      <section className="dashboard-preview">
        <div className="preview-left">
          <h2>Earnings Dashboard</h2>
          <div className="dashboard-stats">
            <div className="stat-item">
              <div className="stat-icon active">
                <Shield size={24} />
              </div>
              <div className="stat-info">
                <span className="stat-label">Active Policy</span>
                <span className="stat-sublabel">Weekly Plan</span>
              </div>
              <span className="stat-value">₹199</span>
            </div>
            <div className="stat-item">
              <div className="stat-icon loss">
                <TrendingUp size={24} />
              </div>
              <div className="stat-info">
                <span className="stat-label">Income Loss Tracked</span>
                <span className="stat-sublabel">Insurance Payout</span>
              </div>
              <span className="stat-value">₹5,200</span>
            </div>
            <div className="stat-item">
              <div className="stat-icon claims">
                <FileCheck size={24} />
              </div>
              <div className="stat-info">
                <span className="stat-label">Claims Processed</span>
                <span className="stat-sublabel">Document</span>
              </div>
              <span className="stat-value">3 Claims</span>
            </div>
            <div className="stat-item">
              <div className="stat-icon payout">
                <Wallet size={24} />
              </div>
              <div className="stat-info">
                <span className="stat-label">Payouts Sent</span>
                <span className="stat-sublabel">Instantly Deposited</span>
              </div>
              <span className="stat-value">₹4,800</span>
            </div>
          </div>
        </div>
        <div className="preview-right">
          <h3>Income Protection Overview</h3>
          <div className="chart-placeholder">
            <div className="chart-bars">
              <div className="bar" style={{height: '60%'}}><span>Heavy Rain</span></div>
              <div className="bar" style={{height: '80%'}}><span>Shutdown</span></div>
              <div className="bar" style={{height: '40%'}}><span>Normal</span></div>
              <div className="bar" style={{height: '90%'}}><span>Instant Payouts</span></div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="footer">
        <div className="footer-links">
          <a href="#about">About Us</a>
          <a href="#faq">FAQ</a>
          <a href="#support">Support</a>
          <a href="#terms">Terms</a>
          <a href="#privacy">Privacy Policy</a>
        </div>
        <div className="footer-social">
          <a href="#facebook">📘</a>
          <a href="#twitter">🐦</a>
          <a href="#youtube">📺</a>
          <a href="#linkedin">💼</a>
        </div>
        <p className="footer-copyright">© 2026 RideShield. All rights reserved.</p>
      </footer>
    </div>
  );
};

export default HomePage;
