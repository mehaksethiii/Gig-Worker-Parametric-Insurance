# RideShield - AI-Powered Insurance for Gig Workers

An AI-enabled parametric insurance platform that automatically compensates delivery workers when disruption events occur (heavy rainfall, extreme heat, pollution, or local restrictions).

## 🎯 Problem Statement

Platform-based delivery workers from companies like Zomato and Swiggy frequently lose income due to external disruptions such as:
- Heavy rainfall and natural disasters
- Extreme heat
- Severe pollution
- Local restrictions and curfews

These events can cause 20-30% loss in weekly income, while gig workers currently have no protection against such uncontrollable disruptions.

## 💡 Solution

RideShield provides:
- Weekly subscription insurance plans
- Real-time disruption monitoring (weather, pollution, etc.)
- Automatic claim triggering when conditions are met
- Instant compensation for lost income
- No manual claim filing required

## 🏗️ Architecture

### Frontend
- React.js with modern UI/UX
- Real-time weather monitoring dashboard
- Responsive design with gradient themes
- Interactive charts and statistics

### Backend
- Node.js + Express
- MongoDB for data storage
- RESTful API architecture
- Automated cron jobs for weather monitoring

### AI/ML
- Python-based risk scoring model
- Historical weather data analysis
- Fraud detection algorithms

## 📋 Parametric Triggers

| Disruption | Trigger Threshold |
|------------|------------------|
| Heavy Rain | Rainfall > 50 mm |
| Extreme Heat | Temperature > 42°C |
| Severe Pollution | AQI > 400 |
| Curfew/Restrictions | Government restrictions |

## 💰 Pricing Plans

| Plan | Weekly Premium | Max Weekly Payout |
|------|---------------|-------------------|
| Basic | ₹199 | ₹500 |
| Standard | ₹299 | ₹750 |
| Premium | ₹399 | ₹1000 |

## 🚀 Getting Started

### Prerequisites

- Node.js (v14 or higher)
- MongoDB (local or Atlas)
- npm or yarn

### Installation

1. Clone the repository
```bash
git clone <repository-url>
cd gig-insurance-platform
```

2. Install all dependencies
```bash
npm run install-all
```

This will install dependencies for both frontend and backend.

### Configuration

1. Create a `.env` file in the `backend` directory:
```bash
cd backend
cp .env.example .env
```

2. Update the `.env` file with your credentials:
```env
PORT=5000
MONGODB_URI=mongodb://localhost:27017/gig-insurance
OPENWEATHER_API_KEY=your_api_key_here
AQICN_API_KEY=your_api_key_here
```

### Running the Application

#### Option 1: Run Everything Together (Recommended)
```bash
npm start
```

This will start both frontend and backend concurrently:
- Frontend: http://localhost:3000
- Backend: http://localhost:5000

#### Option 2: Run Separately

**Backend:**
```bash
cd backend
npm start
```

**Frontend:**
```bash
cd frontend
npm start
```

## 📱 Application Workflow

1. **Registration**: Rider registers with basic details (name, phone, city, working hours)
2. **Risk Assessment**: AI analyzes data and calculates risk score
3. **Plan Selection**: Rider selects and purchases a weekly insurance plan
4. **Monitoring**: Platform continuously monitors environmental data via APIs
5. **Auto Trigger**: When disruption thresholds are exceeded, claims activate automatically
6. **Payout**: System estimates lost income and transfers payout instantly

## 🎨 Features

### For Riders
- Simple onboarding process
- Real-time weather monitoring dashboard
- Automatic claim processing
- Instant payout notifications
- Weekly subscription model
- No manual paperwork

### For Platform
- AI-powered risk scoring
- Fraud detection system
- Automated payout processing
- Analytics dashboard
- Scalable architecture

## 🔌 API Endpoints

### Riders
- `POST /api/riders/register` - Register new rider
- `GET /api/riders/phone/:phone` - Get rider by phone
- `GET /api/riders` - Get all active riders
- `PUT /api/riders/:id/plan` - Update insurance plan

### Weather
- `GET /api/weather/current/:city` - Get current weather data
- `GET /api/weather/check-triggers` - Check triggers for all riders

### Payouts
- `GET /api/payouts/rider/:riderId` - Get rider's payout history
- `GET /api/payouts/stats/:riderId` - Get payout statistics
- `POST /api/payouts/create` - Create manual payout (testing)

## 🧪 Testing

### Test the Weather Monitoring
```bash
curl http://localhost:5000/api/weather/current/Mumbai
```

### Test Trigger System
```bash
curl http://localhost:5000/api/weather/check-triggers
```

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React.js, React Router, Recharts, Lucide Icons |
| Backend | Node.js, Express.js |
| Database | MongoDB |
| AI/ML | Python, Scikit-learn |
| APIs | OpenWeatherMap, AQICN |
| Payments | Razorpay (sandbox) |

## 📊 Project Structure

```
gig-insurance-platform/
├── frontend/
│   ├── public/
│   ├── src/
│   │   ├── pages/
│   │   │   ├── HomePage.js
│   │   │   ├── RegisterPage.js
│   │   │   ├── SelectPlanPage.js
│   │   │   └── DashboardPage.js
│   │   ├── App.js
│   │   └── index.js
│   └── package.json
├── backend/
│   ├── models/
│   │   ├── Rider.js
│   │   └── Payout.js
│   ├── routes/
│   │   ├── riders.js
│   │   ├── weather.js
│   │   └── payouts.js
│   ├── server.js
│   └── package.json
├── ml-model/
│   └── risk_model.py
└── package.json
```

## 🔐 Security Features

- Phone number validation
- Duplicate registration prevention
- GPS location validation (planned)
- Delivery activity verification (planned)
- Fraud detection algorithms

## 🌟 Future Enhancements

- Mobile app (React Native)
- Real API integration (OpenWeatherMap, AQICN)
- Payment gateway integration (Razorpay)
- Advanced ML models for risk prediction
- Multi-language support
- Push notifications
- Referral program
- Admin dashboard



Developed as part of AI-powered insurance platform for gig economy workers.

**Note**: This is a prototype demonstration. For production use, ensure proper API keys, security measures, and compliance with insurance regulations.
