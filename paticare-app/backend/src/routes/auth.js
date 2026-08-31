const express = require('express');
const bcrypt = require('bcryptjs');
const { nanoid } = require('nanoid');
const db = require('../db');
const { signToken, requireAuth } = require('../middleware/auth');

const router = express.Router();

const DEFAULT_PREFERENCES = {
  medicationReminders: true,
  defaultReminderMorning: '09:00',
  defaultReminderEvening: '20:00',
  notificationSound: 'Nazik pati sesi',
  language: 'Türkçe',
};

const RESET_CODE_TTL_MS = 15 * 60 * 1000; // 15 minutes

function publicUser(user) {
  const { passwordHash, resetCode, resetCodeExpires, ...rest } = user;
  return rest;
}

function generateResetCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

router.post('/register', (req, res) => {
  const { email, password, name } = req.body || {};
  if (!email || !password) {
    return res.status(400).json({ error: 'E-posta ve şifre gerekli.' });
  }
  const existing = db.find('users', (u) => u.email.toLowerCase() === String(email).toLowerCase());
  if (existing) {
    return res.status(409).json({ error: 'Bu e-posta ile zaten bir hesap var.' });
  }
  const user = {
    id: nanoid(),
    email,
    name: name || email.split('@')[0],
    passwordHash: bcrypt.hashSync(password, 8),
    guest: false,
    authProvider: 'password',
    avatarUrl: null,
    preferences: { ...DEFAULT_PREFERENCES },
    createdAt: new Date().toISOString(),
  };
  db.insert('users', user);
  const token = signToken(user);
  res.status(201).json({ token, user: publicUser(user) });
});

router.post('/login', (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) {
    return res.status(400).json({ error: 'E-posta ve şifre gerekli.' });
  }
  const user = db.find('users', (u) => u.email.toLowerCase() === String(email).toLowerCase());
  if (!user || user.guest || !bcrypt.compareSync(password, user.passwordHash || '')) {
    return res.status(401).json({ error: 'E-posta veya şifre hatalı.' });
  }
  const token = signToken(user);
  res.json({ token, user: publicUser(user) });
});

router.post('/guest', (req, res) => {
  const user = {
    id: nanoid(),
    email: `misafir-${nanoid(6)}@paticare.local`,
    name: 'Misafir Kullanıcı',
    passwordHash: null,
    guest: true,
    authProvider: 'guest',
    avatarUrl: null,
    preferences: { ...DEFAULT_PREFERENCES },
    createdAt: new Date().toISOString(),
  };
  db.insert('users', user);
  const token = signToken(user);
  res.status(201).json({ token, user: publicUser(user) });
});

// POST /api/auth/forgot-password { email }
// Generates a short-lived reset code. This demo backend has no real email/SMS
// provider wired up, so the code is returned directly in the response (and
// logged) instead of being sent out-of-band. A production build MUST remove
// the `devCode` field and deliver the code over email/SMS instead.
router.post('/forgot-password', (req, res) => {
  const { email } = req.body || {};
  if (!email) return res.status(400).json({ error: 'E-posta gerekli.' });

  const user = db.find('users', (u) => u.email.toLowerCase() === String(email).toLowerCase());
  const generic = { message: 'Bu e-posta kayıtlıysa bir sıfırlama kodu oluşturuldu.' };

  // Don't leak whether an email is registered, and guest accounts have no
  // password to reset — both respond identically to a legitimate request.
  if (!user || user.guest) {
    return res.json(generic);
  }

  const code = generateResetCode();
  db.update('users', user.id, { resetCode: code, resetCodeExpires: Date.now() + RESET_CODE_TTL_MS });
  console.log(`[PatiCare] Şifre sıfırlama kodu (${user.email}): ${code}`);

  res.json({ ...generic, devCode: code });
});

// POST /api/auth/reset-password { email, code, newPassword }
router.post('/reset-password', (req, res) => {
  const { email, code, newPassword } = req.body || {};
  if (!email || !code || !newPassword) {
    return res.status(400).json({ error: 'E-posta, kod ve yeni şifre gerekli.' });
  }
  if (String(newPassword).length < 6) {
    return res.status(400).json({ error: 'Şifre en az 6 karakter olmalı.' });
  }
  const user = db.find('users', (u) => u.email.toLowerCase() === String(email).toLowerCase());
  if (!user || !user.resetCode || user.resetCode !== String(code).trim()) {
    return res.status(400).json({ error: 'Kod geçersiz.' });
  }
  if (!user.resetCodeExpires || Date.now() > user.resetCodeExpires) {
    return res.status(400).json({ error: 'Kodun süresi dolmuş. Yeni bir kod iste.' });
  }

  const passwordHash = bcrypt.hashSync(newPassword, 8);
  const updated = db.update('users', user.id, { passwordHash, resetCode: null, resetCodeExpires: null });
  const token = signToken(updated);
  res.json({ token, user: publicUser(updated) });
});

// POST /api/auth/social { provider: 'google', idToken }
// Verifies a Google ID token against Google's tokeninfo endpoint and logs the
// user in (creating an account on first sign-in). Requires GOOGLE_CLIENT_ID to
// be set in the backend's .env to the OAuth client ID from Google Cloud
// Console — without it there is no client to verify the token against, so the
// endpoint responds with a clear setup error instead of silently failing.
router.post('/social', async (req, res) => {
  const { provider, idToken } = req.body || {};
  if (provider !== 'google') {
    return res.status(400).json({ error: 'Desteklenmeyen sağlayıcı.' });
  }
  if (!idToken) {
    return res.status(400).json({ error: 'idToken gerekli.' });
  }
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) {
    return res.status(501).json({
      error:
        'Google girişi backend tarafında yapılandırılmamış. Google Cloud Console\'dan bir OAuth istemci kimliği oluşturup backend/.env dosyasına GOOGLE_CLIENT_ID olarak eklemelisin.',
    });
  }

  let payload;
  try {
    const verifyRes = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`);
    if (!verifyRes.ok) throw new Error('invalid token');
    payload = await verifyRes.json();
  } catch (err) {
    return res.status(401).json({ error: 'Google kimlik doğrulaması başarısız.' });
  }

  if (payload.aud !== clientId) {
    return res.status(401).json({ error: 'Google kimlik doğrulaması başarısız (istemci kimliği uyuşmuyor).' });
  }
  const email = payload.email;
  if (!email) {
    return res.status(401).json({ error: 'Google hesabında e-posta bulunamadı.' });
  }

  let user = db.find('users', (u) => u.email.toLowerCase() === email.toLowerCase());
  if (!user) {
    user = {
      id: nanoid(),
      email,
      name: payload.name || email.split('@')[0],
      passwordHash: null,
      guest: false,
      authProvider: 'google',
      avatarUrl: payload.picture || null,
      preferences: { ...DEFAULT_PREFERENCES },
      createdAt: new Date().toISOString(),
    };
    db.insert('users', user);
  }

  const token = signToken(user);
  res.json({ token, user: publicUser(user) });
});

router.get('/me', requireAuth, (req, res) => {
  const user = db.find('users', (u) => u.id === req.userId);
  if (!user) return res.status(404).json({ error: 'Kullanıcı bulunamadı.' });
  res.json({ user: publicUser(user) });
});

module.exports = router;
