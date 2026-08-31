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

// Advances `date` by `months` calendar months IN PLACE, clamping the day to
// the target month's last day when the original day doesn't exist there —
// e.g. 31 Ağustos + 1 ay lands on 30 Eylül, not 1 Ekim. Plain
// `date.setMonth(date.getMonth() + months)` doesn't do this: setting the
// month while the date object still holds day 31 overflows into whichever
// day of the FOLLOWING month day 31 minus that month's length lands on
// (August has 31 days, September only 30, so it rolls over to October 1st)
// — silently skipping a whole calendar month for anyone whose reminder falls
// on the 29th–31st. Stepping to day 1 first avoids the overflow while the
// month advances, then the day is set back to min(original day, days in the
// target month). This also fixes the same overflow for a 29 Şubat "Yıllık"
// reminder landing on a non-leap year (28 Şubat, not 1 Mart) since +12
// months goes through this same path.
function addMonthsClamped(date, months) {
  const originalDay = date.getDate();
  date.setDate(1);
  date.setMonth(date.getMonth() + months);
  const daysInTargetMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  date.setDate(Math.min(originalDay, daysInTargetMonth));
}

// Computes the next occurrence's date (YYYY-MM-DD) for a recurring care item,
// or null for a one-off ('Bir kez') or unrecognized recurrence value. Uses
// local calendar-date arithmetic (never Date#toISOString) so this stays
// correct for Turkey (UTC+3, no DST) the same way mobile/src/dateUtils.ts does.
function nextOccurrenceDate(dateStr, recurrence) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const next = new Date(y, m - 1, d);
  switch (recurrence) {
    case 'Her gün':
      next.setDate(next.getDate() + 1);
      break;
    case 'Haftalık':
      next.setDate(next.getDate() + 7);
      break;
    case 'Aylık':
      addMonthsClamped(next, 1);
      break;
    case 'Yıllık':
      addMonthsClamped(next, 12);
      break;
    default:
      return null;
  }
  const yyyy = next.getFullYear();
  const mm = String(next.getMonth() + 1).padStart(2, '0');
  const dd = String(next.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

// When a recurring care item is completed or skipped, spawns the next pending
// occurrence (same pet/title/time/etc., new id, new date) so the recurrence
// keeps going. Returns the new item, or null for a one-off item. Deliberately
// NOT called from /:id/undo — undoing a completion/skip restores the item the
// user is looking at, but doesn't retract the occurrence already spawned from
// it; that occurrence is independent from this point on.
function spawnNextOccurrence(item) {
  const nextDate = nextOccurrenceDate(item.date, item.recurrence);
  if (!nextDate) return null;
  const next = {
    id: nanoid(),
    petId: item.petId,
    ownerId: item.ownerId,
    kind: item.kind,
    title: item.title,
    description: item.description,
    tag: item.tag,
    date: nextDate,
    time: item.time,
    recurrence: item.recurrence,
    notifyBefore: item.notifyBefore,
    status: 'pending',
    completedAt: null,
    pushSentAt: null,
    createdAt: new Date().toISOString(),
  };
  db.insert('careItems', next);
  return next;
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
    // Set once the reminderScheduler (backend/src/reminderScheduler.js) has
    // sent — or attempted to send — a push for this item, so it's checked
    // exactly once instead of on every polling tick.
    pushSentAt: null,
    createdAt: new Date().toISOString(),
  };
  db.insert('careItems', item);
  res.status(201).json({ careItem: item });
});

router.patch('/:id', (req, res) => {
  const item = ownedItem(req, req.params.id);
  if (!item) return res.status(404).json({ error: 'Kayıt bulunamadı.' });
  const allowed = ['title', 'description', 'tag', 'date', 'time', 'recurrence', 'notifyBefore', 'status', 'kind'];
  const patch = {};
  allowed.forEach((key) => {
    if (key in (req.body || {})) patch[key] = req.body[key];
  });
  if (patch.status === 'done') patch.completedAt = new Date().toISOString();
  if (patch.status === 'pending') patch.completedAt = null;
  // The item's due time just changed (or it's pending again) — clear
  // pushSentAt so the reminder scheduler re-evaluates it against the new
  // date/time instead of treating it as already handled at the old one.
  if ('date' in patch || 'time' in patch || patch.status === 'pending') patch.pushSentAt = null;
  const updated = db.update('careItems', item.id, patch);
  res.json({ careItem: updated });
});

// Convenience actions matching the UI buttons directly.
router.post('/:id/complete', (req, res) => {
  const item = ownedItem(req, req.params.id);
  if (!item) return res.status(404).json({ error: 'Kayıt bulunamadı.' });
  const updated = db.update('careItems', item.id, { status: 'done', completedAt: new Date().toISOString() });
  const nextOccurrence = spawnNextOccurrence(updated);
  res.json({ careItem: updated, nextOccurrence });
});

router.post('/:id/skip', (req, res) => {
  const item = ownedItem(req, req.params.id);
  if (!item) return res.status(404).json({ error: 'Kayıt bulunamadı.' });
  const updated = db.update('careItems', item.id, { status: 'skipped', completedAt: null });
  const nextOccurrence = spawnNextOccurrence(updated);
  res.json({ careItem: updated, nextOccurrence });
});

router.post('/:id/undo', (req, res) => {
  const item = ownedItem(req, req.params.id);
  if (!item) return res.status(404).json({ error: 'Kayıt bulunamadı.' });
  // Back to pending — re-arm the push scheduler for it too (it was marked
  // sent when it was originally completed/skipped).
  const updated = db.update('careItems', item.id, { status: 'pending', completedAt: null, pushSentAt: null });
  res.json({ careItem: updated });
});

router.delete('/:id', (req, res) => {
  const item = ownedItem(req, req.params.id);
  if (!item) return res.status(404).json({ error: 'Kayıt bulunamadı.' });
  db.remove('careItems', item.id);
  res.json({ success: true });
});

module.exports = router;
