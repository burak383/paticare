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

router.get('/', (req, res) => {
  const pets = db.filter('pets', (p) => p.ownerId === req.userId);
  res.json({ pets });
});

router.post('/', (req, res) => {
  const { name, species, breed, gender, birthDate, weightKg, neutered, avatarUrl } = req.body || {};
  if (!name || !species) {
    return res.status(400).json({ error: 'İsim ve tür gerekli.' });
  }
  const existingPets = db.filter('pets', (p) => p.ownerId === req.userId);
  const pet = {
    id: nanoid(),
    ownerId: req.userId,
    name,
    species,
    breed: breed || null,
    gender: gender || null,
    birthDate: birthDate || null,
    weightKg: typeof weightKg === 'number' ? weightKg : null,
    neutered: Boolean(neutered),
    avatarUrl: avatarUrl || null,
    coverUrl: null,
    active: existingPets.length === 0, // first pet becomes active automatically
    createdAt: new Date().toISOString(),
  };
  db.insert('pets', pet);
  res.status(201).json({ pet });
});

router.get('/:id', (req, res) => {
  const pet = ownedPet(req, req.params.id);
  if (!pet) return res.status(404).json({ error: 'Evcil hayvan bulunamadı.' });
  res.json({ pet });
});

router.patch('/:id', (req, res) => {
  const pet = ownedPet(req, req.params.id);
  if (!pet) return res.status(404).json({ error: 'Evcil hayvan bulunamadı.' });
  const allowed = ['name', 'species', 'breed', 'gender', 'birthDate', 'weightKg', 'neutered', 'avatarUrl', 'coverUrl'];
  const patch = {};
  allowed.forEach((key) => {
    if (key in (req.body || {})) patch[key] = req.body[key];
  });
  const updated = db.update('pets', pet.id, patch);

  // If weight changed, also log it in weight history so the Karnem chart stays accurate.
  if (typeof patch.weightKg === 'number') {
    db.insert('weightLogs', {
      id: nanoid(),
      petId: pet.id,
      date: new Date().toISOString().slice(0, 10),
      weightKg: patch.weightKg,
    });
  }
  res.json({ pet: updated });
});

router.patch('/:id/activate', (req, res) => {
  const pet = ownedPet(req, req.params.id);
  if (!pet) return res.status(404).json({ error: 'Evcil hayvan bulunamadı.' });
  const petsOfOwner = db.filter('pets', (p) => p.ownerId === req.userId);
  petsOfOwner.forEach((p) => db.update('pets', p.id, { active: p.id === pet.id }));
  res.json({ pet: db.find('pets', (p) => p.id === pet.id) });
});

router.delete('/:id', (req, res) => {
  const pet = ownedPet(req, req.params.id);
  if (!pet) return res.status(404).json({ error: 'Evcil hayvan bulunamadı.' });
  db.remove('pets', pet.id);
  db.removeWhere('careItems', (c) => c.petId === pet.id);
  db.removeWhere('vaccines', (v) => v.petId === pet.id);
  db.removeWhere('weightLogs', (w) => w.petId === pet.id);
  db.removeWhere('conditions', (c) => c.petId === pet.id);
  db.removeWhere('vetNotes', (n) => n.petId === pet.id);
  res.json({ success: true });
});

module.exports = router;
