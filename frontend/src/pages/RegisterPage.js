import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Shield, User, MapPin, Clock, Briefcase } from 'lucide-react';
import './RegisterPage.css';

const RegisterPage = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    city: '',
    workingHours: '',
    deliveryType: 'food'
  });

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    localStorage.setItem('riderData', JSON.stringify(formData));
    navigate('/select-plan');
  };

  return (
    <div className="register-page">
      <nav className="navbar">
        <div className="nav-container">
          <div className="logo" onClick={() => navigate('/')}>
            <Shield size={32} />
            <span>RideShield</span>
          </div>
        </div>
      </nav>

      <div className="register-container">
        <div className="register-card">
          <div className="register-header">
            <h1>Join RideShield</h1>
            <p>Get instant protection for your income</p>
          </div>

          <form onSubmit={handleSubmit} className="register-form">
            <div className="form-group">
              <label>
                <User size={20} />
                Full Name
              </label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleChange}
                placeholder="Enter your full name"
                required
              />
            </div>

            <div className="form-group">
              <label>
                <User size={20} />
                Phone Number
              </label>
              <input
                type="tel"
                name="phone"
                value={formData.phone}
                onChange={handleChange}
                placeholder="+91 XXXXX XXXXX"
                required
              />
            </div>

            <div className="form-group">
              <label>
                <MapPin size={20} />
                City
              </label>
              <select
                name="city"
                value={formData.city}
                onChange={handleChange}
                required
              >
                <option value="">Select your city</option>
                <option value="Mumbai">Mumbai</option>
                <option value="Delhi">Delhi</option>
                <option value="Bangalore">Bangalore</option>
                <option value="Hyderabad">Hyderabad</option>
                <option value="Chennai">Chennai</option>
                <option value="Kolkata">Kolkata</option>
                <option value="Pune">Pune</option>
              </select>
            </div>

            <div className="form-group">
              <label>
                <Clock size={20} />
                Daily Working Hours
              </label>
              <input
                type="number"
                name="workingHours"
                value={formData.workingHours}
                onChange={handleChange}
                placeholder="e.g., 8"
                min="1"
                max="16"
                required
              />
            </div>

            <div className="form-group">
              <label>
                <Briefcase size={20} />
                Delivery Type
              </label>
              <select
                name="deliveryType"
                value={formData.deliveryType}
                onChange={handleChange}
                required
              >
                <option value="food">Food Delivery</option>
                <option value="grocery">Grocery Delivery</option>
                <option value="package">Package Delivery</option>
                <option value="other">Other</option>
              </select>
            </div>

            <button type="submit" className="btn-submit">
              Continue to Plans
            </button>
          </form>

          <p className="register-footer">
            Already have an account? <span onClick={() => navigate('/dashboard')}>Log In</span>
          </p>
        </div>

        <div className="register-illustration">
          <div className="illustration-content">
            <h2>Why Choose RideShield?</h2>
            <div className="benefit-list">
              <div className="benefit-item">
                <div className="benefit-icon">✓</div>
                <div>
                  <h3>Instant Payouts</h3>
                  <p>Get compensated within hours</p>
                </div>
              </div>
              <div className="benefit-item">
                <div className="benefit-icon">✓</div>
                <div>
                  <h3>AI-Powered Protection</h3>
                  <p>Smart monitoring 24/7</p>
                </div>
              </div>
              <div className="benefit-item">
                <div className="benefit-icon">✓</div>
                <div>
                  <h3>No Manual Claims</h3>
                  <p>Automatic activation</p>
                </div>
              </div>
              <div className="benefit-item">
                <div className="benefit-icon">✓</div>
                <div>
                  <h3>Affordable Plans</h3>
                  <p>Starting at ₹199/week</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RegisterPage;
