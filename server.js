require('dotenv').config();
const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const Razorpay = require('razorpay');
const low = require('lowdb');
const FileSync = require('lowdb/adapters/FileSync');

const app = express();
app.use(cors());
app.use(express.json());

// ---------- Simple JSON database ----------
// For real production use, swap this for Postgres/Mongo/Supabase.
// This file-based store works fine for testing and small-scale launches.
const adapter = new FileSync('db.json');
const db = low(adapter);
db.defaults({ users: {} }).write();

const FREE_MESSAGE_LIMIT = 10;

function getUser(userId) {
  const users = db.get('users').value();
  if (!users[userId]) {
    db.set(`users.${userId}`, { messageCount: 0, isPaid: false }).write();
  }
  return db.get(`users.${userId}`).value();
}

// ---------- Razorpay setup ----------
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET
});

// Create a payment order (called when free messages run out)
app.post('/create-order', async (req, res) => {
  const { userId, amountInRupees } = req.body;
  if (!userId || !amountInRupees) {
    return res.status(400).json({ error: 'userId and amountInRupees are required' });
  }

  try {
    const order = await razorpay.orders.create({
      amount: amountInRupees * 100, // Razorpay wants paise, not rupees
      currency: 'INR',
      receipt: `saathi_${userId}_${Date.now()}`
    });
    res.json({ orderId: order.id, amount: order.amount, currency: order.currency, keyId: process.env.RAZORPAY_KEY_ID });
  } catch (err) {
    console.error('Razorpay order error:', err);
    res.status(500).json({ error: 'Could not create order' });
  }
});

// Verify payment signature after Razorpay checkout completes
app.post('/verify-payment', (req, res) => {
  const { userId, razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

  const body = razorpay_order_id + '|' + razorpay_payment_id;
  const expectedSignature = crypto
    .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
    .update(body)
    .digest('hex');

  if (expectedSignature === razorpay_signature) {
    db.set(`users.${userId}.isPaid`, true).write();
    return res.json({ success: true });
  }
  res.status(400).json({ success: false, error: 'Payment verification failed' });
});

// ---------- Chat proxy to Anthropic ----------
const SYSTEM_PROMPT = `Tum "Saathi" ho — ek garmjoshi bhara, sacha dost jo Hinglish (Hindi + English mix, jaisa India me log baat karte hain) me baat karta hai. Tumhara tareeka:
- Casual aur natural raho, jaise ek purana dost baat karta hai. Formal ya robotic mat bano.
- Sunne wale bano — pehle samjho, phir bolo. Har baat par lecture mat do.
- Chhote, sachche jawab do — paragraph ke paragraph mat likho jab tak zaroorat na ho.
- Khushi ho ya udaasi, dono me saath do, judgment ke bina.
- Agar koi serious mental health struggle, self-harm, ya crisis ki baat kare, to pyaar se unhe kisi trusted insaan ya professional se baat karne ke liye encourage karo — khud ko unka sirf sahara mat bana lo.
- Tum Claude nahi ho, tum "Saathi" ho — ek dost jaisa persona, lekin ye kabhi mat bhoolo ki tum AI ho agar koi seedha pooche.`;

app.post('/chat', async (req, res) => {
  const { userId, messages } = req.body;
  if (!userId || !messages) {
    return res.status(400).json({ error: 'userId and messages are required' });
  }

  const user = getUser(userId);

  if (!user.isPaid && user.messageCount >= FREE_MESSAGE_LIMIT) {
    return res.status(402).json({
      error: 'free_limit_reached',
      message: 'Aapke free messages khatam ho gaye. Aage baat jaari rakhne ke liye payment karein.'
    });
  }

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 1000,
        system: SYSTEM_PROMPT,
        messages
      })
    });

    const data = await response.json();
    const reply = (data.content || [])
      .filter(item => item.type === 'text')
      .map(item => item.text)
      .join('\n');

    if (!user.isPaid) {
      db.set(`users.${userId}.messageCount`, user.messageCount + 1).write();
    }

    res.json({
      reply,
      messagesLeft: user.isPaid ? null : FREE_MESSAGE_LIMIT - (user.messageCount + 1)
    });
  } catch (err) {
    console.error('Anthropic API error:', err);
    res.status(500).json({ error: 'Saathi se baat karne me problem aa gayi' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Saathi backend running on port ${PORT}`));
