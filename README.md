# 🛡️ RideShield — AI-Powered Parametric Insurance for Gig Workers

> Zero-touch insurance that pays out automatically when disruption hits. No forms. No waiting. Just protection.

**Live Demo:** https://mehaksethiii.github.io/Gig-Worker-Parametric-Insurance

---

## Problem

Platform-based delivery workers (Zomato, Swiggy, Blinkit) lose 20–30% of weekly income due to uncontrollable disruptions — heavy rain, extreme heat, curfews, strikes. They have no safety net.

## Solution

RideShield is a parametric insurance platform that:
- Monitors weather and disruption conditions in real time
- Automatically triggers claims when thresholds are crossed
- Sends instant UPI payouts — zero manual steps
- Notifies the rider's family when coverage activates

---

## ✨ Features

### For Riders
- **6 Insurance Plans** — From ₹99 Starter to ₹999 Enterprise, each with increasing payout limits and coverage types
- **AI Risk Scoring** — Dynamically adjusts your premium based on your city's weather history, working hours, and delivery type
- **Voice Claims** — Say "baarish ho rahi hai" or "there is a strike" — AI detects the disruption and files the claim instantly
- **Disaster Report** — Tap any disaster type (flood, curfew, earthquake etc.) and the system validates + pays out automatically
- **Auto Weather Trigger** — Backend monitors weather every 30 mins; if thresholds are crossed, payout fires without any rider action
- **Daily Claim Limit** — Max 2 claims per day per rider to prevent abuse, with a clear fair-usage policy popup
- **Payout Receipt** — After every payout, a branded receipt pops up with a download button that saves as a printable PDF
- **Offline Mode** — Claims made without internet are queued locally and synced automatically when connection restores
- **Voice Response** — System speaks back in Hindi or English confirming the claim, amount, and status
- **Family Assurance** — Real email sent to the rider's registered family contact the moment coverage activates
- **Loyalty Rewards** — Earn Diamond/Gold/Silver/Bronze tier badges based on trust score, with game-style visuals
- **Trust Score** — Builds with every honest claim; higher score = faster payouts, higher limits, premium discounts
- **Live Map** — Real GPS map showing your location, nearby riders, and active disruption zones
- **Story of the Day** — Real stories from gig workers in affected cities, rotating daily

### AI Defense Engine
- **Multi-signal Fraud Detection** — Combines GPS, accelerometer, network quality, weather, and peer reports to verify every claim
- **Zero Trust Processing** — Every claim must pass 8 independent checks before any payout is released
- **Geo-fencing** — City divided into risk zones; only riders inside eligible zones get auto-coverage
- **Anomaly Heatmap** — Visual map of India showing fraud risk vs genuine disruption per city with pie chart breakdown
- **Real-time Risk Stream** — Live risk score updating every 2 seconds based on current conditions
- **XAI (Explainable AI)** — Shows exactly which signals approved or flagged a claim, in plain language
- **Sensor Fusion** — Cross-checks GPS speed against phone motion sensors to catch GPS spoofing

### Admin Dashboard (`/admin`)
- **Live Stats** — Real-time counts of riders, claims today, total payouts sent, and fraud flags
- **Riders Table** — View all registered riders with their plan, city, UPI ID, and risk level
- **Claims Management** — Approve or reject any claim with one click, with fraud flags highlighted
- **Payouts History** — Full settlement log with transaction IDs, channels, and amounts
- Password: `rideshield_admin_2026`

### Settlement Pipeline (matches DEVTrails slide)
1. Trigger confirmed (weather API)
2. Eligibility check (active policy, no duplicate)
3. Payout calculated (hours × severity)
4. Transfer initiated — UPI → IMPS → Sandbox fallback
5. Record updated (BillingCenter reconciled)

---

## 💰 Pricing Plans

| Plan | Weekly Premium | Max Payout |
|---|---|---|
| Starter | ₹99 | ₹250 |
| Basic | ₹199 | ₹500 |
| Standard | ₹299 | ₹750 |
| Premium | ₹399 | ₹1,200 |
| Pro | ₹599 | ₹2,000 |
| Enterprise | ₹999 | ₹5,000 |

---

## 📋 Parametric Triggers

| Disruption | Threshold |
|---|---|
| Heavy Rain | Rainfall > 50mm |
| Extreme Heat | Temperature > 42°C |
| Air Pollution | AQI > 200 |
| Flood / Cyclone / Earthquake | Rider report + GPS validation |
| Curfew / Strike / Bandh | Rider report + crowd corroboration |

---

## 🏗️ Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React.js, React Router, Recharts, Leaflet, Lucide Icons |
| Backend | Node.js, Express.js |
| Database | MongoDB Atlas |
| Payments | Cashfree Payouts API (UPI/IMPS) + Razorpay |
| Email | Nodemailer + Gmail SMTP |
| Weather | OpenWeatherMap API |
| AI/ML | Python, Scikit-learn |
| Deployment | GitHub Pages (frontend) |
| Mobile | PWA — installable on Android/iOS |

---

## 🚀 Getting Started

### Prerequisites
- Node.js v14+
- MongoDB Atlas account (or local MongoDB)

### Installation

```bash
git clone https://github.com/mehaksethiii/Gig-Worker-Parametric-Insurance
cd Gig-Worker-Parametric-Insurance

# Install backend dependencies
cd backend && npm install

# Install frontend dependencies
cd ../frontend && npm install
```

### Configuration

Create `backend/.env`:

```env
PORT=5000
MONGODB_URI=your_mongodb_atlas_uri
JWT_SECRET=your_secret_key
OPENWEATHER_API_KEY=your_openweather_key

# Real email (Gmail App Password)
EMAIL_USER=your_gmail@gmail.com
EMAIL_PASS=your_16char_app_password

# Cashfree Payouts (UPI transfers)
CASHFREE_CLIENT_ID=your_cashfree_client_id
CASHFREE_CLIENT_SECRET=your_cashfree_secret
CASHFREE_ENV=TEST

# Razorpay
RAZORPAY_KEY_ID=your_razorpay_key
RAZORPAY_KEY_SECRET=your_razorpay_secret

# Admin
ADMIN_SECRET=rideshield_admin_2026
```

### Run

```bash
# Terminal 1 — Backend
cd backend && npm start

# Terminal 2 — Frontend
cd frontend && npm start
```

- Frontend: http://localhost:3000
- Backend: http://localhost:5000
- Admin: http://localhost:3000/admin

---

## 🔌 API Endpoints

### Auth
- `POST /api/auth/register` — Register rider
- `POST /api/auth/login` — Login
- `PUT /api/auth/update-plan` — Update insurance plan

### Weather
- `GET /api/weather/current/:city` — Live weather data
- `GET /api/weather/check-triggers` — Auto-trigger check for all riders
- `POST /api/weather/validate-disaster` — Validate disaster report

### Claims
- `POST /api/claims/submit` — Submit a claim
- `POST /api/claims/report-disaster` — Report disaster with GPS
- `GET /api/claims/my` — Get rider's claims
- `POST /api/claims/sync-offline` — Sync offline queue

### Settlement
- `POST /api/settlement/initiate` — Start 5-step payout pipeline
- `GET /api/settlement/status/:id` — Poll settlement status
- `GET /api/settlement/history` — Payout history
- `PUT /api/settlement/payment-details` — Save UPI/bank details

### Notifications
- `POST /api/notify/family` — Send family assurance email
- `GET /api/notify/test` — Test email setup

### Admin
- `GET /api/admin/stats` — Overview stats
- `GET /api/admin/riders` — All riders
- `GET /api/admin/claims` — All claims
- `GET /api/admin/payouts` — All payouts
- `PUT /api/admin/claims/:id` — Approve/reject claim

---

## 📁 Project Structure

```
Gig-Worker-Parametric-Insurance/
├── frontend/
│   ├── public/
│   │   ├── manifest.json       # PWA manifest
│   │   ├── sw.js               # Service worker
│   │   └── logo192/512.png     # App icons
│   └── src/
│       ├── pages/
│       │   ├── HomePage.js
│       │   ├── RegisterPage.js
│       │   ├── SelectPlanPage.js
│       │   ├── DashboardPage.js
│       │   ├── AdminPage.js
│       │   ├── AIDefenseEngine.js
│       │   ├── MapTab.js
│       │   └── RedFlagAlert.js
│       ├── auth.js
│       ├── fraudRegistry.js
│       └── offlineQueue.js
├── backend/
│   ├── models/
│   │   ├── Rider.js
│   │   ├── Claim.js
│   │   └── Payout.js
│   ├── routes/
│   │   ├── auth.js
│   │   ├── weather.js
│   │   ├── claims.js
│   │   ├── settlement.js
│   │   ├── notify.js
│   │   ├── payment.js
│   │   ├── premium.js
│   │   └── admin.js
│   ├── services/
│   │   ├── cashfreePayout.js
│   │   └── payoutRouter.js
│   └── server.js
└── ml-model/
    └── risk_model.py
```

---

## 🔐 Security

- JWT authentication for all rider routes
- Admin routes protected by separate secret key
- Daily claim limit (max 2/day) enforced on both frontend and backend
- Fraud detection before every payout
- GPS + sensor + peer verification (Zero Trust)
- Duplicate claim prevention per day per reason

---

Developed for DEVTrails Hackathon — AI-powered insurance for the gig economy.
