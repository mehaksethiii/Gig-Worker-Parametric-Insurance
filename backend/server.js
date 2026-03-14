const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const cron = require('node-cron');
require('dotenv').config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// MongoDB Connection
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/gig-insurance';

mongoose.connect(MONGODB_URI)
  .then(() => console.log('✅ MongoDB Connected'))
  .catch(err => console.error('❌ MongoDB Connection Error:', err));

// Import Routes
const riderRoutes = require('./routes/riders');
const weatherRoutes = require('./routes/weather');
const payoutRoutes = require('./routes/payouts');

// Use Routes
app.use('/api/riders', riderRoutes);
app.use('/api/weather', weatherRoutes);
app.use('/api/payouts', payoutRoutes);

// Health Check
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'Server is running' });
});

// Cron Job - Check weather every 30 minutes
cron.schedule('*/30 * * * *', async () => {
  console.log('🔄 Running weather check...');
  try {
    const axios = require('axios');
    const response = await axios.get('http://localhost:5000/api/weather/check-triggers');
    console.log('✅ Weather check completed:', response.data);
  } catch (error) {
    console.error('❌ Weather check failed:', error.message);
  }
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📊 Dashboard: http://localhost:${PORT}/api/health`);
});
