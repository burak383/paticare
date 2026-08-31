require('dotenv').config();
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');

const seed = require('./seed');
const authRoutes = require('./routes/auth');
const petRoutes = require('./routes/pets');
const careItemRoutes = require('./routes/careItems');
const healthRoutes = require('./routes/health');
const productRoutes = require('./routes/products');
const userRoutes = require('./routes/users');
const subscriptionRoutes = require('./routes/subscription');
const { startReminderScheduler } = require('./reminderScheduler');

seed();

const app = express();
// CORS_ORIGIN restricts which web origins may call this API — leave unset in
// local dev (defaults to allowing all origins, which is what a phone/simulator
// hitting an IP-based URL needs), but set it to your app's real domain(s)
// before deploying somewhere public.
app.use(cors({ origin: process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',') : true }));
app.use(express.json({ limit: '5mb' }));
app.use(morgan('dev'));

app.get('/api/health-check', (req, res) => {
  res.json({ ok: true, service: 'paticare-backend', time: new Date().toISOString() });
});

app.use('/api/auth', authRoutes);
app.use('/api/pets', petRoutes);
app.use('/api/care-items', careItemRoutes);
app.use('/api/products', productRoutes);
app.use('/api/users', userRoutes);
app.use('/api/subscription', subscriptionRoutes);
// healthRoutes is mounted at the bare '/api' prefix (its own routes mix
// '/pets/:petId/health...' and '/health/...' paths, so it can't use a
// narrower prefix) with an unconditional router.use(requireAuth) inside —
// that means it would silently intercept ANY /api/* request registered
// after it, including unauthenticated ones like
// /api/subscription/revenuecat-webhook, before the intended router ever
// sees it (Express matches app.use() by path prefix in registration order;
// once healthRoutes' requireAuth responds without calling next(), later
// app.use() calls are never reached). This was invisible as long as every
// route mounted after it already required auth anyway — it stopped being
// invisible the moment task #52 added a real unauthenticated route. Keeping
// this mounted LAST (right before the 404 handler) means every other,
// more specific router always gets first chance to match.
app.use('/api', healthRoutes); // /api/pets/:petId/health..., /api/health/...

app.use((req, res) => {
  res.status(404).json({ error: 'Bulunamadı: ' + req.method + ' ' + req.path });
});

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Sunucu hatası.' });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`PatiCare backend http://localhost:${PORT} adresinde çalışıyor.`);
  // Checks every minute for due care-item reminders and pushes them to
  // whichever users have a registered Expo push token — see
  // reminderScheduler.js. Skipped under `npm test`-style runs where
  // NODE_ENV=test, so a test process doesn't sit there polling forever.
  if (process.env.NODE_ENV !== 'test') {
    startReminderScheduler();
  }
});
