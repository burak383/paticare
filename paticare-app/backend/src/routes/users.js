const express = require('express');
const db = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

function publicUser(user) {
  const { passwordHash, ...rest } = user;
  return rest;
}

router.get('/me', (req, res) => {
  const user = db.find('users', (u) => u.id === req.userId);
  if (!user) return res.status(404).json({ error: 'Kullanıcı bulunamadı.' });
  res.json({ user: publicUser(user) });
});

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
