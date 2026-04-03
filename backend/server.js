const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const cron = require('node-cron');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/gig-insurance')
  .then(() => console.log('✅ MongoDB Connected'))
  .catch(err => console.error('❌ MongoDB Error:', err));

app.use('/api/riders',     require('./routes/riders'));
app.use('/api/weather',    require('./routes/weather'));
app.use('/api/payouts',    require('./routes/payouts'));
app.use('/api/auth',       require('./routes/auth'));
app.use('/api/premium',    require('./routes/premium'));
app.use('/api/claims',     require('./routes/claims'));
app.use('/api/notify',     require('./routes/notify'));
app.use('/api/settlement', require('./routes/settlement'));

app.get('/api/health', (_, res) => res.json({ status: 'OK' }));

// Auto-trigger claims every 30 min
cron.schedule('*/30 * * * *', async () => {
  try {
    const axios = require('axios');
    await axios.get('http://localhost:5000/api/weather/check-triggers');
    console.log('✅ Weather check done');
  } catch (e) {
    console.error('❌ Weather check failed:', e.message);
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Server on port ${PORT}`));
