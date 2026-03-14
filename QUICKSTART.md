# 🚀 Quick Start Guide - RideShield

Get up and running in 5 minutes!

## Step 1: Install Dependencies

```bash
npm run install-all
```

This installs everything you need for both frontend and backend.

## Step 2: Start MongoDB (if using local)

Make sure MongoDB is running on your system:

```bash
# Windows (if MongoDB is installed as a service)
net start MongoDB

# Mac/Linux
mongod
```

Or use MongoDB Atlas (cloud) - just update the connection string in `backend/.env`

## Step 3: Configure Environment (Optional)

The app works with demo data out of the box, but for real weather data:

```bash
cd backend
cp .env.example .env
# Edit .env and add your API keys
```

## Step 4: Start the Application

From the root directory:

```bash
npm start
```

This starts both servers:
- ✅ Frontend: http://localhost:3000
- ✅ Backend: http://localhost:5000

## Step 5: Test the Application

1. Open http://localhost:3000 in your browser
2. Click "Get Started" or "Sign Up"
3. Fill in the registration form:
   - Name: Test Rider
   - Phone: +91 9876543210
   - City: Mumbai
   - Working Hours: 8
   - Delivery Type: Food Delivery
4. Click "Continue to Plans"
5. Select a plan (Standard is recommended)
6. Click "Continue with Standard Plan"
7. You'll see the dashboard with:
   - Real-time weather monitoring
   - Income protection stats
   - Payout history
   - Live environmental data

## 🎯 What to Explore

### Homepage
- Modern landing page with SafeGig-inspired design
- Feature cards showing protection benefits
- How it works section
- Pricing information
- Dashboard preview

### Registration
- Clean form with validation
- Benefits sidebar
- Smooth navigation

### Plan Selection
- Three tier plans (Basic, Standard, Premium)
- Interactive card selection
- Feature comparison

### Dashboard
- Real-time weather monitoring
- Earnings statistics
- Income protection chart
- Payout history
- Alert system when disruptions occur

## 🧪 Testing Features

### Test Weather Alerts
The dashboard simulates weather changes every 8 seconds. Watch for:
- Rainfall > 50mm triggers alert
- Temperature > 42°C triggers alert
- AQI > 400 triggers alert

### Test Backend API
```bash
# Check server health
curl http://localhost:5000/api/health

# Get weather data for Mumbai
curl http://localhost:5000/api/weather/current/Mumbai

# Check triggers (creates payouts if conditions met)
curl http://localhost:5000/api/weather/check-triggers
```

## 🎨 Design Features

The new design includes:
- ✨ Modern gradient backgrounds
- 🎯 Clean, professional layout
- 📱 Fully responsive design
- 🎭 Smooth animations and transitions
- 🌈 Color-coded status indicators
- 📊 Interactive charts
- 🔔 Real-time alerts

## 🛠️ Troubleshooting

### Port Already in Use
```bash
# Kill process on port 3000 (frontend)
npx kill-port 3000

# Kill process on port 5000 (backend)
npx kill-port 5000
```

### MongoDB Connection Error
- Make sure MongoDB is running
- Check connection string in `backend/.env`
- Try using MongoDB Atlas (cloud) instead

### Module Not Found
```bash
# Reinstall dependencies
npm run install-all
```

### Frontend Not Loading
```bash
cd frontend
npm install
npm start
```

### Backend Not Starting
```bash
cd backend
npm install
npm start
```

## 📱 User Flow

1. **Landing Page** → Click "Get Started"
2. **Registration** → Fill form → "Continue to Plans"
3. **Plan Selection** → Choose plan → "Continue with [Plan]"
4. **Dashboard** → View real-time data and protection status

## 🎯 Key Features to Demo

1. **Automatic Monitoring**: Weather data updates every 8 seconds
2. **Alert System**: Red banner appears when disruption detected
3. **Payout History**: Shows past compensations
4. **Income Chart**: Visual representation of protection
5. **Status Badges**: Safe/Alert indicators for each metric

## 💡 Tips

- Use Chrome DevTools to see responsive design
- Check browser console for any errors
- MongoDB is optional for frontend demo (uses localStorage)
- Backend APIs work independently

## 🚀 Next Steps

- Integrate real weather APIs (OpenWeatherMap, AQICN)
- Add payment gateway (Razorpay)
- Implement user authentication
- Add admin dashboard
- Deploy to production

## 📞 Need Help?

- Check the main README.md for detailed documentation
- Review API endpoints in backend/routes/
- Inspect component code in frontend/src/pages/

---

**Enjoy building with RideShield! 🛡️**
