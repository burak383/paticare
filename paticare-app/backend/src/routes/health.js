const express = require('express');
const { nanoid } = require('nanoid');
const db = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

function ownedPet(req, petId) {
  const pet = db.find('pets', (p) => p.id === petId);
  if (!pet || pet.ownerId !== req.userId) return null;
  return pet;
}

// GET /api/pets/:petId/health  -> everything Karnem needs in one call
router.get('/pets/:petId/health', (req, res) => {
  const pet = ownedPet(req, req.params.petId);
  if (!pet) return res.status(404).json({ error: 'Evcil hayvan bulunamadı.' });

  const vaccines = db.filter('vaccines', (v) => v.petId === pet.id);
  const weightLogs = db
    .filter('weightLogs', (w) => w.petId === pet.id)
    .sort((a, b) => a.date.localeCompare(b.date));
  const conditions = db.filter('conditions', (c) => c.petId === pet.id);
  const vetNotes = db.filter('vetNotes', (n) => n.petId === pet.id);

  res.json({ pet, vaccines, weightLogs, conditions, vetNotes });
});

router.post('/pets/:petId/health/vaccines', (req, res) => {
  const pet = ownedPet(req, req.params.petId);
  if (!pet) return res.status(404).json({ error: 'Evcil hayvan bulunamadı.' });
  const { title, date, status, clinic } = req.body || {};
  if (!title || !date) return res.status(400).json({ error: 'title ve date gerekli.' });
  const record = {
    id: nanoid(),
    petId: pet.id,
    title,
    date,
    status: status === 'completed' ? 'completed' : 'upcoming',
    clinic: clinic || null,
  };
  db.insert('vaccines', record);
  res.status(201).json({ vaccine: record });
});

router.patch('/health/vaccines/:id', (req, res) => {
  const record = db.find('vaccines', (v) => v.id === req.params.id);
  if (!record) return res.status(404).json({ error: 'Aşı kaydı bulunamadı.' });
  const pet = ownedPet(req, record.petId);
  if (!pet) return res.status(404).json({ error: 'Aşı kaydı bulunamadı.' });
  const allowed = ['title', 'date', 'status', 'clinic'];
  const patch = {};
  allowed.forEach((key) => {
    if (key in (req.body || {})) patch[key] = req.body[key];
  });
  const updated = db.update('vaccines', record.id, patch);
  res.json({ vaccine: updated });
});

router.delete('/health/vaccines/:id', (req, res) => {
  const record = db.find('vaccines', (v) => v.id === req.params.id);
  if (!record) return res.status(404).json({ error: 'Aşı kaydı bulunamadı.' });
  const pet = ownedPet(req, record.petId);
  if (!pet) return res.status(404).json({ error: 'Aşı kaydı bulunamadı.' });
  db.remove('vaccines', record.id);
  res.json({ success: true });
});

router.post('/pets/:petId/health/weight', (req, res) => {
  const pet = ownedPet(req, req.params.petId);
  if (!pet) return res.status(404).json({ error: 'Evcil hayvan bulunamadı.' });
  const { weightKg, date } = req.body || {};
  if (typeof weightKg !== 'number') return res.status(400).json({ error: 'weightKg sayısal olmalı.' });
  const entry = {
    id: nanoid(),
    petId: pet.id,
    date: date || new Date().toISOString().slice(0, 10),
    weightKg,
  };
  db.insert('weightLogs', entry);
  db.update('pets', pet.id, { weightKg });
  res.status(201).json({ weightLog: entry });
});

router.post('/pets/:petId/health/conditions', (req, res) => {
  const pet = ownedPet(req, req.params.petId);
  if (!pet) return res.status(404).json({ error: 'Evcil hayvan bulunamadı.' });
  const { title, note } = req.body || {};
  if (!title) return res.status(400).json({ error: 'title gerekli.' });
  const entry = {
    id: nanoid(),
    petId: pet.id,
    title,
    note: note || '',
    date: new Date().toISOString().slice(0, 10),
  };
  db.insert('conditions', entry);
  res.status(201).json({ condition: entry });
});

router.post('/pets/:petId/health/vet-notes', (req, res) => {
  const pet = ownedPet(req, req.params.petId);
  if (!pet) return res.status(404).json({ error: 'Evcil hayvan bulunamadı.' });
  const { vetName, note, date } = req.body || {};
  if (!note) return res.status(400).json({ error: 'note gerekli.' });
  const entry = {
    id: nanoid(),
    petId: pet.id,
    vetName: vetName || 'Veteriner',
    date: date || new Date().toISOString().slice(0, 10),
    note,
  };
  db.insert('vetNotes', entry);
  res.status(201).json({ vetNote: entry });
});

// GET /api/pets/:petId/health/export -> plain-text summary the app can share/save.
router.get('/pets/:petId/health/export', (req, res) => {
  const pet = ownedPet(req, req.params.petId);
  if (!pet) return res.status(404).json({ error: 'Evcil hayvan bulunamadı.' });

  const vaccines = db.filter('vaccines', (v) => v.petId === pet.id);
  const weightLogs = db.filter('weightLogs', (w) => w.petId === pet.id).sort((a, b) => a.date.localeCompare(b.date));
  const conditions = db.filter('conditions', (c) => c.petId === pet.id);
  const vetNotes = db.filter('vetNotes', (n) => n.petId === pet.id);
  const latestWeight = weightLogs[weightLogs.length - 1];

  const lines = [];
  lines.push(`PatiCare Sağlık Karnesi — ${pet.name}`);
  lines.push(`Tür: ${pet.species}${pet.breed ? ' · ' + pet.breed : ''}`);
  if (pet.birthDate) lines.push(`Doğum tarihi: ${pet.birthDate}`);
  if (latestWeight) lines.push(`Güncel kilo: ${latestWeight.weightKg} kg (${latestWeight.date})`);
  lines.push('');
  lines.push('AŞI TAKİBİ');
  vaccines.forEach((v) => {
    lines.push(`- ${v.title}: ${v.status === 'completed' ? 'Tamamlandı' : 'Yaklaşıyor'} (${v.date})`);
  });
  lines.push('');
  lines.push('AĞIRLIK GEÇMİŞİ');
  weightLogs.forEach((w) => lines.push(`- ${w.date}: ${w.weightKg} kg`));
  lines.push('');
  lines.push('RAHATSIZLIKLAR');
  if (conditions.length === 0) lines.push('- Kayıt yok');
  conditions.forEach((c) => lines.push(`- ${c.title} (${c.date}): ${c.note}`));
  lines.push('');
  lines.push('VETERİNER NOTLARI');
  if (vetNotes.length === 0) lines.push('- Kayıt yok');
  vetNotes.forEach((n) => lines.push(`- ${n.vetName}, ${n.date}: "${n.note}"`));
  lines.push('');
  lines.push('Bu rapor PatiCare tarafından oluşturulmuştur ve veteriner hekim tavsiyesinin yerini tutmaz.');

  const text = lines.join('\n');
  res.json({ fileName: `${pet.name}-saglik-karnesi.txt`, text });
});

module.exports = router;
