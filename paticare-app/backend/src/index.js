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
app.use('/api', healthRoutes); // /api/pets/:petId/health...
app.use('/api/products', productRoutes);
app.use('/api/users', userRoutes);

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
});
