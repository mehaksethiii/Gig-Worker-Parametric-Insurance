import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Shield, User, MapPin, Clock, Briefcase, CheckCircle, XCircle, Loader } from 'lucide-react';
import './RegisterPage.css';

const RegisterPage = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    name: '', phone: '', city: '', workingHours: '', deliveryType: 'food'
  });

  // City search state
  const [cityInput, setCityInput]       = useState('');
  const [citySuggestions, setCitySuggestions] = useState([]);
  const [cityStatus, setCityStatus]     = useState('idle'); // idle | loading | valid | invalid
  const [cityError, setCityError]       = useState('');
  const debounceRef = useRef(null);

  // Phone validation state
  const [phoneError, setPhoneError]     = useState('');

  // ── Phone validation ──────────────────────────────────────────
  const validatePhone = (value) => {
    // Strip leading +91 or 91 if present
    const digits = value.replace(/^\+?91/, '').replace(/\D/g, '');
    if (digits.length === 0) { setPhoneError(''); return; }
    if (digits.length < 10) { setPhoneError('Phone number must be 10 digits'); return; }
    if (digits.length > 10) { setPhoneError('Phone number cannot exceed 10 digits'); return; }
    if (!/^[6-9]/.test(digits)) { setPhoneError('Enter a valid Indian mobile number'); return; }
    setPhoneError('');
  };

  const handlePhoneChange = (e) => {
    const val = e.target.value;
    setFormData(f => ({ ...f, phone: val }));
    validatePhone(val);
  };

  // ── City search via OpenWeatherMap geocoding ──────────────────
  useEffect(() => {
    if (cityInput.trim().length < 2) {
      setCitySuggestions([]);
      setCityStatus('idle');
      return;
    }
    setCityStatus('loading');
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      try {
        const OWM_KEY = '4835381b54e89e33e148457aed03e39d';

        // Primary: search with India country code
        let res  = await fetch(`https://api.openweathermap.org/geo/1.0/direct?q=${encodeURIComponent(cityInput)},IN&limit=5&appid=${OWM_KEY}`);
        let data = await res.json();
        let indian = data.filter(d => d.country === 'IN');

        // Fallback: search without country code and filter to IN
        if (!indian.length) {
          res    = await fetch(`https://api.openweathermap.org/geo/1.0/direct?q=${encodeURIComponent(cityInput)}&limit=10&appid=${OWM_KEY}`);
          data   = await res.json();
          indian = data.filter(d => d.country === 'IN');
        }

        if (indian.length > 0) {
          // Deduplicate by name+state
          const seen = new Set();
          const unique = indian.filter(d => {
            const key = `${d.name}|${d.state}`;
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
          });
          setCitySuggestions(unique.map(d => ({
            name: d.name,
            state: d.state,
            display: d.state ? `${d.name}, ${d.state}` : d.name,
          })));
          setCityStatus('idle');
        } else {
          setCitySuggestions([]);
          setCityStatus('invalid');
          setCityError('City not found in India. Check the spelling or try a nearby major city.');
        }
      } catch {
        setCityStatus('idle');
        setCityError('');
      }
    }, 400);
  }, [cityInput]);

  const selectCity = (suggestion) => {
    setCityInput(suggestion.display);
    setFormData(f => ({ ...f, city: suggestion.name }));
    setCitySuggestions([]);
    setCityStatus('valid');
    setCityError('');
  };

  const handleCityInputChange = (e) => {
    setCityInput(e.target.value);
    setFormData(f => ({ ...f, city: '' })); // reset until a suggestion is picked
    setCityStatus('idle');
    setCityError('');
  };

  // ── Submit ────────────────────────────────────────────────────
  const handleChange = (e) => setFormData(f => ({ ...f, [e.target.name]: e.target.value }));

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.city) { setCityError('Please select a city from the suggestions'); return; }
    if (phoneError) return;
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

            {/* Full Name */}
            <div className="form-group">
              <label><User size={20} />Full Name</label>
              <input
                type="text" name="name" value={formData.name}
                onChange={handleChange} placeholder="Enter your full name" required
              />
            </div>

            {/* Phone */}
            <div className="form-group">
              <label><User size={20} />Phone Number</label>
              <div className="phone-input-wrap">
                <span className="phone-prefix">+91</span>
                <input
                  type="tel" name="phone"
                  value={formData.phone}
                  onChange={handlePhoneChange}
                  placeholder="XXXXX XXXXX"
                  maxLength={10}
                  pattern="[6-9][0-9]{9}"
                  required
                />
              </div>
              {phoneError && <span className="field-error">{phoneError}</span>}
            </div>

            {/* City — searchable */}
            <div className="form-group city-group">
              <label><MapPin size={20} />City</label>
              <div className={`city-input-wrap ${cityStatus}`}>
                <input
                  type="text"
                  value={cityInput}
                  onChange={handleCityInputChange}
                  placeholder="Type your city name..."
                  autoComplete="off"
                  required
                />
                <span className="city-status-icon">
                  {cityStatus === 'loading' && <Loader size={16} className="spin" />}
                  {cityStatus === 'valid'   && <CheckCircle size={16} color="#22c55e" />}
                  {cityStatus === 'invalid' && <XCircle size={16} color="#ef4444" />}
                </span>
              </div>
              {citySuggestions.length > 0 && (
                <ul className="city-suggestions">
                  {citySuggestions.map((s, i) => (
                    <li key={i} onClick={() => selectCity(s)}>
                      <MapPin size={14} />
                      {s.display}
                    </li>
                  ))}
                </ul>
              )}
              {cityError && <span className="field-error">{cityError}</span>}
            </div>

            {/* Working Hours */}
            <div className="form-group">
              <label><Clock size={20} />Daily Working Hours</label>
              <input
                type="number" name="workingHours" value={formData.workingHours}
                onChange={handleChange} placeholder="e.g., 8" min="1" max="16" required
              />
            </div>

            {/* Delivery Type */}
            <div className="form-group">
              <label><Briefcase size={20} />Delivery Type</label>
              <select name="deliveryType" value={formData.deliveryType} onChange={handleChange} required>
                <option value="food">Food Delivery</option>
                <option value="grocery">Grocery Delivery</option>
                <option value="package">Package Delivery</option>
                <option value="other">Other</option>
              </select>
            </div>

            <button type="submit" className="btn-submit">Continue to Plans</button>
          </form>

          <p className="register-footer">
            Already have an account? <span onClick={() => navigate('/dashboard')}>Log In</span>
          </p>
        </div>

        <div className="register-illustration">
          <div className="illustration-content">
            <h2>Why Choose RideShield?</h2>
            <div className="benefit-list">
              {[
                ['Instant Payouts',        'Get compensated within hours'],
                ['AI-Powered Protection',  'Smart monitoring 24/7'],
                ['No Manual Claims',       'Automatic activation'],
                ['Affordable Plans',       'Starting at ₹199/week'],
              ].map(([title, desc]) => (
                <div className="benefit-item" key={title}>
                  <div className="benefit-icon">✓</div>
                  <div><h3>{title}</h3><p>{desc}</p></div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RegisterPage;
