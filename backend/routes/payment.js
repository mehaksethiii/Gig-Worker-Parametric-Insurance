const express = require('express');
const Razorpay = require('razorpay');
const crypto = require('crypto');
const router = express.Router();

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

// POST /api/payment/create-order
router.post('/create-order', async (req, res) => {
  try {
    const { amount, planName } = req.body; // amount in rupees

    const order = await razorpay.orders.create({
      amount: amount * 100, // convert to paise
      currency: 'INR',
      receipt: `receipt_${Date.now()}`,
      notes: { plan: planName },
    });

    res.json({
      success: true,
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      keyId: process.env.RAZORPAY_KEY_ID,
    });
  } catch (err) {
    console.error('Razorpay order error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/payment/verify
router.post('/verify', (req, res) => {
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

  const body = razorpay_order_id + '|' + razorpay_payment_id;
  const expectedSignature = crypto
    .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
    .update(body)
    .digest('hex');

  if (expectedSignature === razorpay_signa
ture) {
    res.json({ success: true, message: 'Payment verified' });
  } else {
    res.status(400).json({ success: false, message: 'Invalid signature' });
  }
});

// GET /api/payment/test — verify Razorpay keys are working
router.get('/test', async (req, res) => {
  try {
    // Create a ₹1 test order — if keys are wrong this will throw
    const order = await razorpay.orders.create({
      amount: 100, // ₹1 in paise
      currency: 'INR',
      receipt: `test_${Date.now()}`,
    });
    res.json({
      success: true,
      message: '✅ Razorpay is live and working!',
      orderId: order.id,
      keyId: process.env.RAZORPAY_KEY_ID,
      mode: process.env.RAZORPAY_KEY_ID?.startsWith('rzp_test_') ? 'TEST' : 'LIVE',
    });
  } catch (err) {
    res.status(500).json({ success: false, message: `❌ Razorpay error: ${err.message}` });
  }
});

module.exports = router;
