const express = require('express');
const bcrypt = require('bcryptjs');
const { nanoid } = require('nanoid');
const db = require('../db');
const { signToken, requireAuth } = require('../middleware/auth');
const { DEFAULT_SUBSCRIPTION, deriveSubscription } = require('../subscription');
const { sendPasswordResetEmail, isEmailConfigured } = require('../email');

const router = express.Router();

const DEFAULT_PREFERENCES = {
  medicationReminders: true,
  defaultReminderMorning: '09:00',
  defaultReminderEvening: '20:00',
  notificationSound: 'Nazik pati sesi',
  language: 'Türkçe',
};

const RESET_CODE_TTL_MS = 15 * 60 * 1000; // 15 minutes
const MIN_PASSWORD_LENGTH = 6;
// Deliberately simple (not RFC 5322): good enough to catch obvious typos like
// a missing "@" or domain without rejecting real addresses with a stricter regex.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function isValidEmail(email) {
  return EMAIL_RE.test(String(email).trim());
}

function publicUser(user) {
  const { passwordHash, resetCode, resetCodeExpires, pushTokens, ...rest } = user;
  return { ...rest, subscription: deriveSubscription(rest.subscription) };
}

function generateResetCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

router.post('/register', (req, res) => {
  const { email, password, name, privacyAccepted } = req.body || {};
  if (!email || !password) {
    return res.status(400).json({ error: 'E-posta ve şifre gerekli.' });
  }
  if (!isValidEmail(email)) {
    return res.status(400).json({ error: 'Geçerli bir e-posta adresi gir.' });
  }
  if (String(password).length < MIN_PASSWORD_LENGTH) {
    return res.status(400).json({ error: `Şifre en az ${MIN_PASSWORD_LENGTH} karakter olmalı.` });
  }
  // Mirrors the mobile app's consent checkbox (OnboardingScreen) — enforced
  // here too so the checkbox can't be bypassed by calling this endpoint
  // directly. NOTE: the KVKK/privacy text this refers to is currently a
  // DRAFT that hasn't had legal review — see PrivacyPolicyText in
  // OnboardingScreen.tsx for the "why" before relying on this for real
  // compliance.
  if (privacyAccepted !== true) {
    return res.status(400).json({ error: 'Devam etmek için KVKK Aydınlatma Metni\'ni kabul etmelisin.' });
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
    subscription: { ...DEFAULT_SUBSCRIPTION },
    privacyAcceptedAt: new Date().toISOString(),
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
    subscription: { ...DEFAULT_SUBSCRIPTION },
    createdAt: new Date().toISOString(),
  };
  db.insert('users', user);
  const token = signToken(user);
  res.status(201).json({ token, user: publicUser(user) });
});

// POST /api/auth/upgrade { email, password, name? } — requires an auth token.
// Turns the CALLER'S OWN guest account into a real, password-protected one by
// attaching credentials to the same user record (same id), instead of the app
// having the user log out and separately "register", which used to silently
// create a brand-new, empty account and abandon every pet/reminder/health
// record the guest had built up. Preserving the id is what keeps all of that
// data attached after the upgrade.
router.post('/upgrade', requireAuth, (req, res) => {
  const { email, password, name, privacyAccepted } = req.body || {};
  if (!email || !password) {
    return res.status(400).json({ error: 'E-posta ve şifre gerekli.' });
  }
  if (!isValidEmail(email)) {
    return res.status(400).json({ error: 'Geçerli bir e-posta adresi gir.' });
  }
  if (String(password).length < MIN_PASSWORD_LENGTH) {
    return res.status(400).json({ error: `Şifre en az ${MIN_PASSWORD_LENGTH} karakter olmalı.` });
  }
  // Same consent requirement as /register — this is the moment a guest
  // becomes a real, identifiable account, so it needs the same gate.
  if (privacyAccepted !== true) {
    return res.status(400).json({ error: 'Devam etmek için KVKK Aydınlatma Metni\'ni kabul etmelisin.' });
  }
  const user = db.find('users', (u) => u.id === req.userId);
  if (!user) return res.status(404).json({ error: 'Kullanıcı bulunamadı.' });
  if (!user.guest) {
    return res.status(400).json({ error: 'Bu hesap zaten e-posta ile kayıtlı.' });
  }
  const existing = db.find('users', (u) => u.id !== user.id && u.email.toLowerCase() === String(email).toLowerCase());
  if (existing) {
    return res.status(409).json({ error: 'Bu e-posta ile zaten bir hesap var.' });
  }
  const updated = db.update('users', user.id, {
    email,
    name: (name && name.trim()) || user.name,
    passwordHash: bcrypt.hashSync(password, 8),
    guest: false,
    authProvider: 'password',
    privacyAcceptedAt: new Date().toISOString(),
  });
  const token = signToken(updated);
  res.json({ token, user: publicUser(updated) });
});

// POST /api/auth/forgot-password { email }
// Generates a short-lived reset code. When RESEND_API_KEY is configured
// (see email.js), the code is emailed to the user and NOT included in the
// response. Without it, this falls back to the original demo behavior — the
// code comes back directly in the response (and is logged) so local
// development still works without setting up a real email provider. A
// production deploy MUST have RESEND_API_KEY set; devCode should never be
// reachable there.
router.post('/forgot-password', async (req, res) => {
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

  if (isEmailConfigured()) {
    const sent = await sendPasswordResetEmail(user.email, code);
    if (!sent) {
      // The email provider failed (bad API key, Resend down, etc). Still
      // don't leak the code into the response in this configuration — that
      // would defeat the point of switching to real email — but do log it
      // server-side so the account isn't completely locked out while the
      // provider issue gets fixed.
      console.error(`[PatiCare] Sıfırlama e-postası gönderilemedi (${user.email}); kod: ${code}`);
    }
    return res.json(generic);
  }

  console.log(`[PatiCare] Şifre sıfırlama kodu (${user.email}): ${code}`);
  res.json({ ...generic, devCode: code });
});

// POST /api/auth/reset-password { email, code, newPassword }
router.post('/reset-password', (req, res) => {
  const { email, code, newPassword } = req.body || {};
  if (!email || !code || !newPassword) {
    return res.status(400).json({ error: 'E-posta, kod ve yeni şifre gerekli.' });
  }
  if (String(newPassword).length < MIN_PASSWORD_LENGTH) {
    return res.status(400).json({ error: `Şifre en az ${MIN_PASSWORD_LENGTH} karakter olmalı.` });
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

// POST /api/auth/change-password { currentPassword, newPassword } — requires
// an auth token. This is the "I'm already logged in and just want to change
// my password" flow, distinct from forgot-password/reset-password (which are
// for someone who's LOCKED OUT and has no session). Requiring the current
// password here (rather than just the session token) stops someone who grabs
// an unlocked phone from silently locking the real owner out.
router.post('/change-password', requireAuth, (req, res) => {
  const { currentPassword, newPassword } = req.body || {};
  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: 'Mevcut şifre ve yeni şifre gerekli.' });
  }
  if (String(newPassword).length < MIN_PASSWORD_LENGTH) {
    return res.status(400).json({ error: `Yeni şifre en az ${MIN_PASSWORD_LENGTH} karakter olmalı.` });
  }
  const user = db.find('users', (u) => u.id === req.userId);
  if (!user) return res.status(404).json({ error: 'Kullanıcı bulunamadı.' });
  if (user.guest || !user.passwordHash) {
    return res.status(400).json({ error: 'Bu hesabın şifresi yok. Önce Profil sekmesinden bir hesap oluştur.' });
  }
  if (!bcrypt.compareSync(currentPassword, user.passwordHash)) {
    return res.status(401).json({ error: 'Mevcut şifre hatalı.' });
  }
  const passwordHash = bcrypt.hashSync(newPassword, 8);
  const updated = db.update('users', user.id, { passwordHash });
  res.json({ user: publicUser(updated) });
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
      subscription: { ...DEFAULT_SUBSCRIPTION },
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
