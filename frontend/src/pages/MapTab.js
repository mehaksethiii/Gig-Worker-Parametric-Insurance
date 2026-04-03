import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix default marker icons broken by webpack
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: require('leaflet/dist/images/marker-icon-2x.png'),
  iconUrl:       require('leaflet/dist/images/marker-icon.png'),
  shadowUrl:     require('leaflet/dist/images/marker-shadow.png'),
});

const OWM_KEY = '4835381b54e89e33e148457aed03e39d';

const CITY_COORDS = {
  Mumbai: { lat: 19.0760, lon: 72.8777 }, Delhi: { lat: 28.6139, lon: 77.2090 },
  Bangalore: { lat: 12.9716, lon: 77.5946 }, Hyderabad: { lat: 17.3850, lon: 78.4867 },
  Chennai: { lat: 13.0827, lon: 80.2707 }, Kolkata: { lat: 22.5726, lon: 88.3639 },
  Pune: { lat: 18.5204, lon: 73.8567 },
};

const NAMES = ['Ravi','Sunita','Arjun','Meena','Deepak','Priya','Suresh','Kavita'];
const PLATFORMS = ['Zomato','Swiggy','Blinkit','Dunzo','Zepto'];

const genRiders = (lat, lon) => NAMES.map((name, i) => ({
  id: i, name, platform: PLATFORMS[i % PLATFORMS.length],
  status: i % 4 === 3 ? 'disrupted' : 'active',
  lat: lat + (Math.random() - 0.5) * 0.04,
  lon: lon + (Math.random() - 0.5) * 0.04,
  earnings: Math.floor(Math.random() * 400) + 200,
}));

const getDistanceKm = (lat1, lon1, lat2, lon2) => {
  if (!lat2 || !lon2) return 9999;
  const R = 6371, dLat = (lat2-lat1)*Math.PI/180, dLon = (lon2-lon1)*Math.PI/180;
  const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLon/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
};

const MapTab = ({ insuranceData }) => {
  const mapRef      = useRef(null);
  const mapInstance = useRef(null);
  const [weather, setWeather]           = useState(null);
  const [riders, setRiders]             = useState([]);
  const [gpsNote, setGpsNote]           = useState('');
  const [loading, setLoading]           = useState(true);
  const [locationFraud, setLocationFraud] = useState(null);

  const fetchWeather = async (lat, lon) => {
    try {
      const res = await fetch(`https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${OWM_KEY}&units=metric`);
      const d = await res.json();
      setWeather({ temp: Math.round(d.main.temp), desc: d.weather[0].description, rain: d.rain?.['1h']||0, humidity: d.main.humidity, wind: Math.round(d.wind.speed*3.6), icon: d.weather[0].icon });
    } catch (_) {}
  };

  const checkFraud = async (lat, lon) => {
    try {
      const res = await fetch(`https://api.openweathermap.org/geo/1.0/reverse?lat=${lat}&lon=${lon}&limit=1&appid=${OWM_KEY}`);
      const data = await res.json();
      if (!data.length) return;
      const actualCity = data[0].name;
      const reg = (insuranceData?.city || '').toLowerCase();
      const act = actualCity.toLowerCase();
      const dist = getDistanceKm(lat, lon, CITY_COORDS[insuranceData?.city]?.lat, CITY_COORDS[insuranceData?.city]?.lon);
      const match = act.includes(reg) || reg.includes(act) || dist < 50;
      if (!match) {
        const fd = { actualCity, registeredCity: insuranceData?.city, distanceKm: Math.round(dist), detectedAt: new Date().toISOString() };
        setLocationFraud(fd);
        localStorage.setItem('locationFraud', JSON.stringify(fd));
      } else {
        setLocationFraud({ verified: true, actualCity });
        localStorage.removeItem('locationFraud');
      }
    } catch (_) {}
  };

  const buildMap = (lat, lon) => {
    if (mapInstance.current) { mapInstance.current.remove(); mapInstance.current = null; }
    if (!mapRef.current) return;

    const map = L.map(mapRef.current).setView([lat, lon], 14);
    mapInstance.current = map;

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap', maxZoom: 19,
    }).addTo(map);

    // You marker
    const youIcon = L.divIcon({
      className: '',
      html: `<div style="position:relative;width:50px;height:50px;display:flex;align-items:center;justify-content:center;font-size:1.8rem;filter:drop-shadow(0 4px 8px rgba(0,0,0,0.3))">
               <div style="position:absolute;width:50px;height:50px;border-radius:50%;background:rgba(79,172,254,0.35);animation:mapPulse 2s ease-out infinite"></div>🛵
             </div>`,
      iconSize: [50, 50], iconAnchor: [25, 25],
    });
    L.marker([lat, lon], { icon: youIcon }).addTo(map)
      .bindPopup(`<b>📍 You</b><br/>${insuranceData?.name || 'Rider'}<br/>${insuranceData?.plan || ''} Plan`)
      .openPopup();

    L.circle([lat, lon], { color: '#4facfe', fillColor: '#4facfe', fillOpacity: 0.07, radius: 1500 })
      .addTo(map).bindTooltip('Your coverage zone');

    const nearby = genRiders(lat, lon);
    setRiders(nearby);
    nearby.forEach(r => {
      const icon = L.divIcon({
        className: '',
        html: `<div style="width:34px;height:34px;background:${r.status==='disrupted'?'#fff5f5':'white'};border:2px solid ${r.status==='disrupted'?'#fc8181':'#48bb78'};border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:1.1rem;box-shadow:0 2px 6px rgba(0,0,0,0.2)">${r.status==='disrupted'?'⚠️':'🛵'}</div>`,
        iconSize: [34, 34], iconAnchor: [17, 17],
      });
      L.marker([r.lat, r.lon], { icon }).addTo(map)
        .bindPopup(`<b>${r.name}</b><br/>${r.platform}<br/>${r.status==='disrupted'?'⚠️ Disrupted':'✅ Active'}<br/>₹${r.earnings}`);
    });

    setTimeout(() => map.invalidateSize(), 200);
  };

  useEffect(() => {
    const fallback = () => {
      const city = insuranceData?.city || 'Mumbai';
      const c = CITY_COORDS[city] || CITY_COORDS.Mumbai;
      setGpsNote(`📍 Showing ${city} center`);
      setLoading(false);
      setTimeout(() => { buildMap(c.lat, c.lon); fetchWeather(c.lat, c.lon); }, 100);
    };

    if (!navigator.geolocation) return fallback();
    navigator.geolocation.getCurrentPosition(
      pos => {
        const { latitude: lat, longitude: lon } = pos.coords;
        setGpsNote('📍 Your real GPS location');
        setLoading(false);
        setTimeout(() => { buildMap(lat, lon); fetchWeather(lat, lon); checkFraud(lat, lon); }, 100);
      },
      fallback,
      { enableHighAccuracy: true, timeout: 8000 }
    );

    return () => { if (mapInstance.current) { mapInstance.current.remove(); mapInstance.current = null; } };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const isDisruption = weather && (weather.rain > 50 || weather.temp > 42);

  return (
    <div className="map-tab">
      <h2>🗺️ Live Rider Map</h2>
      <p className="section-subtitle">Your real-time GPS location + nearby riders in your city</p>

      {weather && (
        <div className={`map-weather-strip ${isDisruption ? 'disruption' : ''}`}>
          <img src={`https://openweathermap.org/img/wn/${weather.icon}.png`} alt="" width={36}/>
          <span><strong>{weather.temp}°C</strong> · {weather.desc}</span>
          <span>💧 {weather.humidity}%</span>
          <span>💨 {weather.wind} km/h</span>
          {weather.rain > 0 && <span>🌧️ {weather.rain}mm</span>}
          {isDisruption && <span className="map-alert-tag">⚠️ Disruption Zone</span>}
        </div>
      )}

      {locationFraud && !locationFraud.verified && (
        <div className="location-fraud-alert">
          <div className="lfa-icon">🚨</div>
          <div className="lfa-content">
            <strong>Location Mismatch Detected!</strong>
            <p>GPS shows <strong>{locationFraud.actualCity}</strong> but registered city is <strong>{locationFraud.registeredCity}</strong>{locationFraud.distanceKm ? ` (${locationFraud.distanceKm} km apart)` : ''}.</p>
            <p className="lfa-note">Claims from this location will be automatically flagged.</p>
          </div>
        </div>
      )}
      {locationFraud?.verified && <div className="location-verified">✅ Location verified — GPS matches {locationFraud.actualCity}</div>}
      {gpsNote && <div className="map-gps-note">{gpsNote}</div>}

      {loading ? <div className="map-loading">📡 Getting your location...</div> : (
        <div className="map-layout">
          <div ref={mapRef} className="map-container" style={{ height: '520px', width: '100%', borderRadius: '16px', zIndex: 1 }}/>
          <div className="map-riders-panel">
            <h3>👥 Nearby Riders Online</h3>
            <div className="map-riders-list">
              {riders.map(r => (
                <div key={r.id} className={`map-rider-item ${r.status==='disrupted'?'disrupted':''}`}>
                  <div className="mri-avatar">{r.name[0]}</div>
                  <div className="mri-info"><span className="mri-name">{r.name}</span><span className="mri-platform">{r.platform}</span></div>
                  <span className="mri-status">{r.status==='disrupted'?'⚠️':'🟢'}</span>
                </div>
              ))}
            </div>
            <div className="map-stats-row">
              <div className="map-stat"><span>{riders.filter(r=>r.status==='active').length}</span><p>Active</p></div>
              <div className="map-stat disrupted"><span>{riders.filter(r=>r.status==='disrupted').length}</span><p>Disrupted</p></div>
              <div className="map-stat"><span>{riders.length}</span><p>Online</p></div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MapTab;
