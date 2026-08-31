const express = require('express');
const { nanoid } = require('nanoid');
const db = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

function ownedItem(req, id) {
  const item = db.find('careItems', (c) => c.id === id);
  if (!item || item.ownerId !== req.userId) return null;
  return item;
}

// GET /api/care-items?petId=&date=YYYY-MM-DD&from=&to=
router.get('/', (req, res) => {
  const { petId, date, from, to } = req.query;
  let items = db.filter('careItems', (c) => c.ownerId === req.userId);
  if (petId) items = items.filter((c) => c.petId === petId);
  if (date) items = items.filter((c) => c.date === date);
  if (from) items = items.filter((c) => c.date >= from);
  if (to) items = items.filter((c) => c.date <= to);
  items.sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
  res.json({ careItems: items });
});

router.post('/', (req, res) => {
  const { petId, kind, title, description, tag, date, time, recurrence, notifyBefore } = req.body || {};
  if (!petId || !title || !date || !time) {
    return res.status(400).json({ error: 'petId, title, date ve time alanları gerekli.' });
  }
  const pet = db.find('pets', (p) => p.id === petId && p.ownerId === req.userId);
  if (!pet) return res.status(404).json({ error: 'Evcil hayvan bulunamadı.' });

  const item = {
    id: nanoid(),
    petId,
    ownerId: req.userId,
    kind: kind || 'other',
    title,
    description: description || '',
    tag: tag || null,
    date,
    time,
    recurrence: recurrence || 'Bir kez',
    notifyBefore: typeof notifyBefore === 'number' ? notifyBefore : 15,
    status: 'pending',
    completedAt: null,
    createdAt: new Date().toISOString(),
  };
  db.insert('careItems', item);
  res.status(201).json({ careItem: item });
});

router.patch('/:id', (req, res) => {
  const item = ownedItem(req, req.params.id);
  if (!item) return res.status(404).json({ error: 'Kayıt bulunamadı.' });
  const allowed = ['title', 'description', 'tag', 'date', 'time', 'recurrence', 'notifyBefore', 'status'];
  const patch = {};
  allowed.forEach((key) => {
    if (key in (req.body || {})) patch[key] = req.body[key];
  });
  if (patch.status === 'done') patch.completedAt = new Date().toISOString();
  if (patch.status === 'pending') patch.completedAt = null;
  const updated = db.update('careItems', item.id, patch);
  res.json({ careItem: updated });
});

// Convenience actions matching the UI buttons directly.
router.post('/:id/complete', (req, res) => {
  const item = ownedItem(req, req.params.id);
  if (!item) return res.status(404).json({ error: 'Kayıt bulunamadı.' });
  const updated = db.update('careItems', item.id, { status: 'done', completedAt: new Date().toISOString() });
  res.json({ careItem: updated });
});

router.post('/:id/skip', (req, res) => {
  const item = ownedItem(req, req.params.id);
  if (!item) return res.status(404).json({ error: 'Kayıt bulunamadı.' });
  const updated = db.update('careItems', item.id, { status: 'skipped', completedAt: null });
  res.json({ careItem: updated });
});

router.post('/:id/undo', (req, res) => {
  const item = ownedItem(req, req.params.id);
  if (!item) return res.status(404).json({ error: 'Kayıt bulunamadı.' });
  const updated = db.update('careItems', item.id, { status: 'pending', completedAt: null });
  res.json({ careItem: updated });
});

router.delete('/:id', (req, res) => {
  const item = ownedItem(req, req.params.id);
  if (!item) return res.status(404).json({ error: 'Kayıt bulunamadı.' });
  db.remove('careItems', item.id);
  res.json({ success: true });
});

module.exports = router;
