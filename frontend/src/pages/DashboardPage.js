import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Shield, CloudRain, Thermometer, Wind, Bell, CheckCircle, AlertTriangle, TrendingUp, FileCheck, Wallet } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import './DashboardPage.css';

const DashboardPage = () => {
  const navigate = useNavigate();
  const [insuranceData, setInsuranceData] = useState(null);
  const [weatherData, setWeatherData] = useState(null);
  const [weatherLoading, setWeatherLoading] = useState(true);
  const [weatherSource, setWeatherSource] = useState('');
  const [payoutHistory] = useState([
    { date: '2026-03-08', amount: 450, reason: 'Heavy Rainfall', status: 'completed' },
    { date: '2026-03-05', amount: 300, reason: 'Extreme Heat', status: 'completed' },
    { date: '2026-03-01', amount: 400, reason: 'Local Shutdown', status: 'completed' }
  ]);

  const fetchWeather = async (city) => {
    try {
      const res = await fetch(`http://localhost:5000/api/weather/current/${encodeURIComponent(city)}`);
      if (!res.ok) throw new Error('API error');
      const data = await res.json();
      setWeatherData(data);
      setWeatherSource(data.source);
    } catch (err) {
      // fallback to simulated data if backend is offline
      setWeatherData({
        rainfall:    Math.floor(Math.random() * 60),
        temperature: 30 + Math.floor(Math.random() * 15),
        aqi:         100 + Math.floor(Math.random() * 350),
        humidity:    65,
        windSpeed:   14,
        description: 'Partly cloudy',
        feelsLike:   34,
      });
      setWeatherSource('simulated');
    } finally {
      setWeatherLoading(false);
    }
  };

  useEffect(() => {
    const data = localStorage.getItem('insuranceData');
    if (!data) { navigate('/register'); return; }
    const parsed = JSON.parse(data);
    setInsuranceData(parsed);

    fetchWeather(parsed.city);
    // Refresh every 10 minutes
    const interval = setInterval(() => fetchWeather(parsed.city), 10 * 60 * 1000);
    return () => clearInterval(interval);
  }, [navigate]);

  const chartData = [
    { name: 'Heavy Rain', value: 60, color: '#4facfe' },
    { name: 'Shutdown', value: 80, color: '#fa709a' },
    { name: 'Normal', value: 40, color: '#48bb78' },
    { name: 'Instant Payouts', value: 90, color: '#ff6b35' }
  ];

  const isDisruption = weatherData && (weatherData.rainfall > 50 || weatherData.temperature > 42 || weatherData.aqi > 400);
  const totalPayouts = payoutHistory.reduce((sum, p) => sum + p.amount, 0);

  if (!insuranceData) return null;

  return (
    <div className="dashboard-page">
      <nav className="navbar">
        <div className="nav-container">
          <div className="logo">
            <Shield size={32} />
            <span>RideShield</span>
          </div>
          <div className="nav-user">
            <Bell size={24} />
            <div className="user-avatar">{insuranceData.name.charAt(0)}</div>
          </div>
        </div>
      </nav>

      <div className="dashboard-container">
        {/* Welcome Section */}
        <div className="welcome-section">
          <div>
            <h1>Welcome back, {insuranceData.name}!</h1>
            <p>Your income is protected 24/7</p>
          </div>
          <div className="plan-badge">
            <Shield size={20} />
            {insuranceData.plan} Plan
          </div>
        </div>

        {/* Alert Banner */}
        {isDisruption && (
          <div className="alert-banner">
            <AlertTriangle size={28} />
            <div>
              <strong>Disruption Detected!</strong>
              <p>Environmental conditions have triggered your insurance. Payout being processed.</p>
            </div>
          </div>
        )}

        {/* Main Grid */}
        <div className="main-grid">
          {/* Left Column - Stats */}
          <div className="left-column">
            <h2>Earnings Dashboard</h2>
            
            <div className="stat-card active-policy">
              <div className="stat-icon">
                <Shield size={28} />
              </div>
              <div className="stat-info">
                <span className="stat-label">Active Policy</span>
                <span className="stat-sublabel">Weekly Plan</span>
              </div>
              <span className="stat-value">₹{insuranceData.premium}</span>
            </div>

            <div className="stat-card income-loss">
              <div className="stat-icon">
                <TrendingUp size={28} />
              </div>
              <div className="stat-info">
                <span className="stat-label">Income Loss Tracked</span>
                <span className="stat-sublabel">Insurance Payout</span>
              </div>
              <span className="stat-value">₹{totalPayouts}</span>
            </div>

            <div className="stat-card claims-processed">
              <div className="stat-icon">
                <FileCheck size={28} />
              </div>
              <div className="stat-info">
                <span className="stat-label">Claims Processed</span>
                <span className="stat-sublabel">Document</span>
              </div>
              <span className="stat-value">{payoutHistory.length} Claims</span>
            </div>

            <div className="stat-card payouts-sent">
              <div className="stat-icon">
                <Wallet size={28} />
              </div>
              <div className="stat-info">
                <span className="stat-label">Payouts Sent</span>
                <span className="stat-sublabel">Instantly Deposited</span>
              </div>
              <span className="stat-value">₹{totalPayouts}</span>
            </div>
          </div>

          {/* Right Column - Chart */}
          <div className="right-column">
            <h2>Income Protection Overview</h2>
            <div className="chart-container">
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="name" stroke="#718096" />
                  <YAxis stroke="#718096" />
                  <Tooltip 
                    contentStyle={{ 
                      background: 'white', 
                      border: '1px solid #e2e8f0',
                      borderRadius: '8px'
                    }}
                  />
                  <Bar dataKey="value" fill="#667eea" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Environmental Monitoring */}
        <div className="monitoring-section">
          <h2>Real-Time Environmental Monitoring</h2>
          <p className="section-subtitle">
            Live conditions in {insuranceData.city}
            {weatherSource === 'live' && <span className="live-badge">● LIVE</span>}
            {weatherSource === 'simulated' && <span className="sim-badge">⚠ Simulated</span>}
          </p>

          {weatherLoading ? (
            <div className="weather-loading">Fetching live weather data...</div>
          ) : (
            <>
              <div className="monitoring-grid">
                <div className="monitor-card">
                  <div className="monitor-icon rainfall">
                    <CloudRain size={32} />
                  </div>
                  <div className="monitor-content">
                    <span className="monitor-label">Rainfall</span>
                    <span className="monitor-value">{weatherData.rainfall} mm</span>
                    <span className="monitor-threshold">Threshold: 50mm</span>
                  </div>
                  <div className="monitor-status">
                    {weatherData.rainfall > 50
                      ? <span className="status-badge danger">Alert</span>
                      : <span className="status-badge safe">Safe</span>}
                  </div>
                </div>

                <div className="monitor-card">
                  <div className="monitor-icon temperature">
                    <Thermometer size={32} />
                  </div>
                  <div className="monitor-content">
                    <span className="monitor-label">Temperature</span>
                    <span className="monitor-value">{weatherData.temperature}°C</span>
                    <span className="monitor-threshold">
                      Feels like {weatherData.feelsLike}°C · Humidity {weatherData.humidity}%
                    </span>
                  </div>
                  <div className="monitor-status">
                    {weatherData.temperature > 42
                      ? <span className="status-badge danger">Alert</span>
                      : <span className="status-badge safe">Safe</span>}
                  </div>
                </div>

                <div className="monitor-card">
                  <div className="monitor-icon aqi">
                    <Wind size={32} />
                  </div>
                  <div className="monitor-content">
                    <span className="monitor-label">Air Quality</span>
                    <span className="monitor-value">AQI {weatherData.aqi}</span>
                    <span className="monitor-threshold">Wind: {weatherData.windSpeed} km/h · PM2.5: {weatherData.pm25} µg/m³</span>
                  </div>
                  <div className="monitor-status">
                    {weatherData.aqi > 200
                      ? <span className="status-badge danger">Alert</span>
                      : <span className="status-badge safe">Safe</span>}
                  </div>
                </div>
              </div>

              {weatherData.description && (
                <p className="weather-description">
                  🌤 {weatherData.description.charAt(0).toUpperCase() + weatherData.description.slice(1)} in {insuranceData.city}
                </p>
              )}
            </>
          )}
        </div>

        {/* Payout History */}
        <div className="history-section">
          <h2>Recent Payouts</h2>
          <div className="history-list">
            {payoutHistory.map((payout, index) => (
              <div key={index} className="history-item">
                <div className="history-icon">
                  <CheckCircle size={24} />
                </div>
                <div className="history-info">
                  <span className="history-reason">{payout.reason}</span>
                  <span className="history-date">{new Date(payout.date).toLocaleDateString('en-IN')}</span>
                </div>
                <div className="history-amount">+₹{payout.amount}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default DashboardPage;
