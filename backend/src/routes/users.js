const express = require('express');
const db = require('../db');
const { requireAuth } = require('../middleware/auth');
const { deriveSubscription } = require('../subscription');

const router = express.Router();
router.use(requireAuth);

function publicUser(user) {
  const { passwordHash, resetCode, resetCodeExpires, pushTokens, ...rest } = user;
  return { ...rest, subscription: deriveSubscription(rest.subscription) };
}

// Note: GET /me lives in routes/auth.js (mounted at /api/auth/me) — that's the
// one the mobile app actually calls. This router only needs the mutating routes.
router.patch('/me', (req, res) => {
  const user = db.find('users', (u) => u.id === req.userId);
  if (!user) return res.status(404).json({ error: 'Kullanıcı bulunamadı.' });
  const allowed = ['name', 'email'];
  const patch = {};
  allowed.forEach((key) => {
    if (key in (req.body || {})) patch[key] = req.body[key];
  });
  const updated = db.update('users', user.id, patch);
  res.json({ user: publicUser(updated) });
});

router.patch('/me/preferences', (req, res) => {
  const user = db.find('users', (u) => u.id === req.userId);
  if (!user) return res.status(404).json({ error: 'Kullanıcı bulunamadı.' });
  const nextPreferences = { ...(user.preferences || {}), ...(req.body || {}) };
  const updated = db.update('users', user.id, { preferences: nextPreferences });
  res.json({ user: publicUser(updated) });
});

// POST /api/users/push-token { token }
// Adds this device's Expo push token to the user's token list, so the
// reminder scheduler (reminderScheduler.js) can push care-item reminders to
// it. Called from the mobile app right after login/app-open, once
// notification permission is granted — see mobile/src/notifications.ts's
// registerForPushNotifications(). A guest account can register a token too
// (guests still get reminders); nothing here depends on real credentials.
//
// Stored as an ARRAY (pushTokens), not a single field — a user can be signed
// into the same account on more than one device (phone + a second phone,
// old device kept alongside a new one, etc.), and each needs its own working
// reminder. A single field would let the second device's registration
// silently overwrite the first's token, which then just stops receiving
// pushes with no error anywhere.
router.post('/push-token', (req, res) => {
  const { token } = req.body || {};
  if (!token || typeof token !== 'string') {
    return res.status(400).json({ error: 'token gerekli.' });
  }
  const user = db.find('users', (u) => u.id === req.userId);
  if (!user) return res.status(404).json({ error: 'Kullanıcı bulunamadı.' });
  const existing = Array.isArray(user.pushTokens) ? user.pushTokens : [];
  const pushTokens = existing.includes(token) ? existing : [...existing, token];
  const updated = db.update('users', user.id, { pushTokens });
  res.json({ user: publicUser(updated) });
});

// DELETE /api/users/push-token { token }
// Removes just THIS device's token from the list — called on logout, so a
// signed-out device doesn't keep receiving reminders for whoever's account
// was on it, WITHOUT also cutting off any other device still signed in on
// the same account. That's why `token` is required here rather than
// clearing everything: the caller (AuthContext.logout, see
// mobile/src/notifications.ts's getRegisteredPushToken()) always knows its
// own token when it has one registered, and simply skips this call
// otherwise — there'd be nothing correct to remove.
router.delete('/push-token', (req, res) => {
  const { token } = req.body || {};
  if (!token || typeof token !== 'string') {
    return res.status(400).json({ error: 'token gerekli.' });
  }
  const user = db.find('users', (u) => u.id === req.userId);
  if (!user) return res.status(404).json({ error: 'Kullanıcı bulunamadı.' });
  const pushTokens = (Array.isArray(user.pushTokens) ? user.pushTokens : []).filter((t) => t !== token);
  const updated = db.update('users', user.id, { pushTokens });
  res.json({ user: publicUser(updated) });
});

router.delete('/me', (req, res) => {
  const user = db.find('users', (u) => u.id === req.userId);
  if (!user) return res.status(404).json({ error: 'Kullanıcı bulunamadı.' });

  const pets = db.filter('pets', (p) => p.ownerId === req.userId);
  pets.forEach((pet) => {
    db.removeWhere('careItems', (c) => c.petId === pet.id);
    db.removeWhere('vaccines', (v) => v.petId === pet.id);
    db.removeWhere('weightLogs', (w) => w.petId === pet.id);
    db.removeWhere('conditions', (c) => c.petId === pet.id);
    db.removeWhere('vetNotes', (n) => n.petId === pet.id);
  });
  db.removeWhere('pets', (p) => p.ownerId === req.userId);
  db.removeWhere('scanHistory', (s) => s.userId === req.userId);
  // Added with the price-notes feature after this route was first written —
  // without this, "hesabını ve tüm verilerini sil" was not actually true.
  db.removeWhere('priceNotes', (n) => n.userId === req.userId);
  db.remove('users', user.id);

  res.json({ success: true });
});

module.exports = router;
