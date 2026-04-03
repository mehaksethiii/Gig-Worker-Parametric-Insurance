import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Shield, User, MapPin, Clock, Briefcase, Mail, Lock } from 'lucide-react';
import { saveAuth, isLoggedIn, getRider } from '../auth';
import './RegisterPage.css';

const OWM_KEY = '4835381b54e89e33e148457aed03e39d';

const RegisterPage = () => {
  const navigate = useNavigate();
  const [tab, setTab] = useState('register');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [reg, setReg] = useState({ name:'', email:'', password:'', phone:'', city:'', workingHours:'', deliveryType:'food', familyEmail:'', familyName:'', familyRelation:'Mother', upiId:'', bankName:'', accountNumber:'', ifscCode:'', preferredPaymentMode:'upi' });
  const [login, setLogin] = useState({ email:'', password:'' });
  const [cityInput, setCityInput] = useState('');
  const [citySuggestions, setCitySuggestions] = useState([]);
  const debounceRef = useRef(null);

  useEffect(() => {
    if (isLoggedIn()) {
      const rider = getRider();
      navigate(rider?.insurancePlan?.name ? '/dashboard' : '/select-plan');
    }
  }, [navigate]);

  useEffect(() => {
    if (cityInput.trim().length < 2) { setCitySuggestions([]); return; }
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`https://api.openweathermap.org/geo/1.0/direct?q=${encodeURIComponent(cityInput)},IN&limit=5&appid=${OWM_KEY}`);
        const data = await res.json();
        const seen = new Set();
        setCitySuggestions(data.filter(d => d.country === 'IN').filter(d => {
          const k = `${d.name}|${d.state}`;
          if (seen.has(k)) return false;
          seen.add(k); return true;
        }).map(d => ({ name: d.name, display: d.state ? `${d.name}, ${d.state}` : d.name })));
      } catch (_) {}
    }, 400);
  }, [cityInput]);

  const handleRegister = async (e) => {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(reg),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      saveAuth(data.token, data.rider);
      navigate('/select-plan');
    } catch (err) {
      localStorage.setItem('riderData', JSON.stringify(reg));
      navigate('/select-plan');
    } finally { setLoading(false); }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(login),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      saveAuth(data.token, data.rider);
      navigate(data.rider?.insurancePlan?.name ? '/dashboard' : '/select-plan');
    } catch (err) {
      setError(err.message || 'Login failed.');
    } finally { setLoading(false); }
  };

  return (
    <div className="register-page">
      <nav className="navbar">
        <div className="nav-container">
          <div className="logo" onClick={() => navigate('/')}><Shield size={32}/><span>RideShield</span></div>
        </div>
      </nav>
      <div className="register-container">
        <div className="register-card">
          <div className="auth-tabs">
            <button className={`auth-tab ${tab==='register'?'active':''}`} onClick={() => { setTab('register'); setError(''); }}>Sign Up</button>
            <button className={`auth-tab ${tab==='login'?'active':''}`} onClick={() => { setTab('login'); setError(''); }}>Log In</button>
          </div>
          {error && <div className="auth-error">{error}</div>}

          {tab === 'register' && (
            <>
              <div className="register-header"><h1>Join RideShield</h1><p>Get instant protection for your income</p></div>
              <form onSubmit={handleRegister} className="register-form">
                <div className="form-group"><label><User size={18}/> Full Name</label>
                  <input type="text" placeholder="Enter your full name" required value={reg.name} onChange={e => setReg({...reg, name: e.target.value})}/></div>
                <div className="form-group"><label><Mail size={18}/> Email</label>
                  <input type="email" placeholder="you@example.com" required value={reg.email} onChange={e => setReg({...reg, email: e.target.value})}/></div>
                <div className="form-group"><label><Lock size={18}/> Password</label>
                  <input type="password" placeholder="Min 6 characters" required minLength={6} value={reg.password} onChange={e => setReg({...reg, password: e.target.value})}/></div>
                <div className="form-group"><label><User size={18}/> Phone</label>
                  <input type="tel" placeholder="+91 XXXXX XXXXX" required value={reg.phone} onChange={e => setReg({...reg, phone: e.target.value})}/></div>
                <div className="form-group city-group"><label><MapPin size={18}/> City</label>
                  <input type="text" placeholder="Type your city..." value={cityInput} autoComplete="off" required
                    onChange={e => { setCityInput(e.target.value); setReg({...reg, city: ''}); }}/>
                  {citySuggestions.length > 0 && (
                    <ul className="city-dropdown">
                      {citySuggestions.map((s,i) => (
                        <li key={i} onClick={() => { setCityInput(s.display); setReg({...reg, city: s.name}); setCitySuggestions([]); }}>{s.display}</li>
                      ))}
                    </ul>
                  )}
                </div>
                <div className="form-group"><label><Clock size={18}/> Daily Working Hours</label>
                  <input type="number" placeholder="e.g., 8" min="1" max="16" required value={reg.workingHours} onChange={e => setReg({...reg, workingHours: e.target.value})}/></div>
                <div className="form-group"><label><Briefcase size={18}/> Delivery Type</label>
                  <select value={reg.deliveryType} onChange={e => setReg({...reg, deliveryType: e.target.value})}>
                    <option value="food">Food Delivery</option>
                    <option value="grocery">Grocery Delivery</option>
                    <option value="package">Package Delivery</option>
                    <option value="other">Other</option>
                  </select></div>

                <div className="family-section">
                  <div className="family-header">❤️ Family Assurance (Optional)</div>
                  <p className="family-desc">We'll notify your loved one when your coverage activates — so they never worry.</p>
                  <div className="form-group"><label>Family Member's Name</label>
                    <input type="text" placeholder="e.g., Priya (Mother)" value={reg.familyName} onChange={e => setReg({...reg, familyName: e.target.value})}/></div>
                  <div className="form-group"><label>Their Email</label>
                    <input type="email" placeholder="family@example.com" value={reg.familyEmail} onChange={e => setReg({...reg, familyEmail: e.target.value})}/></div>
                  <div className="form-group"><label>Relation</label>
                    <select value={reg.familyRelation} onChange={e => setReg({...reg, familyRelation: e.target.value})}>
                      <option>Mother</option><option>Father</option><option>Spouse</option><option>Sibling</option><option>Friend</option>
                    </select></div>
                </div>

                <div className="payment-section">
                  <div className="payment-header">💸 Payout Details</div>
                  <p className="payment-desc">Enter once — all approved claims are automatically sent here. No action needed from you.</p>
                  <div className="form-group"><label>Preferred Payment Mode</label>
                    <select value={reg.preferredPaymentMode} onChange={e => setReg({...reg, preferredPaymentMode: e.target.value})}>
                      <option value="upi">UPI (Instant)</option>
                      <option value="bank">Bank Transfer (IMPS)</option>
                    </select>
                  </div>
                  {reg.preferredPaymentMode === 'upi' && (
                    <div className="form-group"><label>UPI ID</label>
                      <input type="text" placeholder="yourname@upi or 9876543210@paytm" value={reg.upiId} onChange={e => setReg({...reg, upiId: e.target.value})}/>
                      <span className="field-hint">e.g. name@okaxis, phone@paytm, name@ybl</span>
                    </div>
                  )}
                  {reg.preferredPaymentMode === 'bank' && (<>
                    <div className="form-group"><label>Bank Name</label>
                      <input type="text" placeholder="e.g. State Bank of India" value={reg.bankName} onChange={e => setReg({...reg, bankName: e.target.value})}/></div>
                    <div className="form-group"><label>Account Number</label>
                      <input type="text" placeholder="Your bank account number" value={reg.accountNumber} onChange={e => setReg({...reg, accountNumber: e.target.value})}/></div>
                    <div className="form-group"><label>IFSC Code</label>
                      <input type="text" placeholder="e.g. SBIN0001234" value={reg.ifscCode} onChange={e => setReg({...reg, ifscCode: e.target.value.toUpperCase()})}/></div>
                  </>)}
                </div>
                <button type="submit" className="btn-submit" disabled={loading}>{loading ? 'Creating Account...' : 'Continue to Plans →'}</button>
              </form>
              <p className="register-footer">Already have an account? <span onClick={() => { setTab('login'); setError(''); }}>Log In</span></p>
            </>
          )}

          {tab === 'login' && (
            <>
              <div className="register-header"><h1>Welcome Back</h1><p>Log in to your RideShield account</p></div>
              <form onSubmit={handleLogin} className="register-form">
                <div className="form-group"><label><Mail size={18}/> Email</label>
                  <input type="email" placeholder="you@example.com" required value={login.email} onChange={e => setLogin({...login, email: e.target.value})}/></div>
                <div className="form-group"><label><Lock size={18}/> Password</label>
                  <input type="password" placeholder="Your password" required value={login.password} onChange={e => setLogin({...login, password: e.target.value})}/></div>
                <button type="submit" className="btn-submit" disabled={loading}>{loading ? 'Logging in...' : 'Log In →'}</button>
              </form>
              <p className="register-footer">New here? <span onClick={() => { setTab('register'); setError(''); }}>Create an account</span></p>
            </>
          )}
        </div>

        <div className="register-illustration">
          <div className="illustration-content">
            <h2>Why Choose RideShield?</h2>
            <div className="benefit-list">
              {[
                { title: 'Instant Payouts', desc: 'Get compensated within hours' },
                { title: 'AI-Powered Protection', desc: 'Smart monitoring 24/7' },
                { title: 'No Manual Claims', desc: 'Automatic activation' },
                { title: 'Works Offline', desc: 'Claims queued without internet' },
              ].map((b,i) => (
                <div key={i} className="benefit-item">
                  <div className="benefit-icon">✓</div>
                  <div><h3>{b.title}</h3><p>{b.desc}</p></div>
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
