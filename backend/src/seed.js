const bcrypt = require('bcryptjs');
const { nanoid } = require('nanoid');
const db = require('./db');

const IMG = 'https://fwtngjyirchhhysukjxi.supabase.co/storage/v1/object/public/project-images/bdc175db-7851-4139-9f11-a3216057da08';

function isoDaysFromNow(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function seed() {
  if (db.all('users').length > 0) {
    return; // already seeded
  }

  console.log('Veritabanı boş, örnek verilerle dolduruluyor (Ares, Luna, Mavi)...');

  const userId = nanoid();
  const user = {
    id: userId,
    email: 'deniz.kaya@email.com',
    name: "Deniz'in Patileri",
    passwordHash: bcrypt.hashSync('paticare123', 8),
    guest: false,
    preferences: {
      medicationReminders: true,
      defaultReminderMorning: '09:00',
      defaultReminderEvening: '20:00',
      notificationSound: 'Nazik pati sesi',
      language: 'Türkçe',
    },
    createdAt: new Date().toISOString(),
  };
  db.insert('users', user);

  const aresId = nanoid();
  const lunaId = nanoid();
  const maviId = nanoid();

  db.insert('pets', {
    id: aresId,
    ownerId: userId,
    name: 'Ares',
    species: 'Kedi',
    breed: 'European Shorthair',
    gender: 'Erkek',
    birthDate: '2023-05-14',
    weightKg: 4.0,
    neutered: true,
    avatarUrl: `${IMG}/1e5a5587-c930-4434-9cac-7f4fd7feffa4.png`,
    coverUrl: `${IMG}/620b4b2d-eb8e-48f0-832d-f10d41fa32d0.png`,
    active: true,
    createdAt: new Date().toISOString(),
  });
  db.insert('pets', {
    id: lunaId,
    ownerId: userId,
    name: 'Luna',
    species: 'Köpek',
    breed: 'Golden Retriever',
    gender: 'Dişi',
    birthDate: '2021-03-02',
    weightKg: 11.8,
    neutered: false,
    avatarUrl: null,
    coverUrl: null,
    active: false,
    createdAt: new Date().toISOString(),
  });
  db.insert('pets', {
    id: maviId,
    ownerId: userId,
    name: 'Mavi',
    species: 'Kuş',
    breed: 'Muhabbet kuşu',
    gender: 'Erkek',
    birthDate: '2024-01-10',
    weightKg: 0.4,
    neutered: false,
    avatarUrl: null,
    coverUrl: null,
    active: false,
    createdAt: new Date().toISOString(),
  });

  const today = new Date().toISOString().slice(0, 10);

  // Care items (today's tasks / calendar entries)
  db.insert('careItems', {
    id: nanoid(),
    petId: aresId,
    ownerId: userId,
    kind: 'medication',
    title: 'OmegaPet 3',
    description: '1 yumuşak kapsül',
    tag: '1 yumuşak kapsül',
    date: today,
    time: '09:00',
    recurrence: 'Her gün',
    notifyBefore: 15,
    status: 'done',
    completedAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
  });
  db.insert('careItems', {
    id: nanoid(),
    petId: aresId,
    ownerId: userId,
    kind: 'weight_check',
    title: 'Kilo kontrolü',
    description: 'Son kayıt: 4,0 kg',
    tag: null,
    date: today,
    time: '14:00',
    recurrence: 'Haftalık',
    notifyBefore: 15,
    status: 'pending',
    completedAt: null,
    createdAt: new Date().toISOString(),
  });
  db.insert('careItems', {
    id: nanoid(),
    petId: aresId,
    ownerId: userId,
    kind: 'medication',
    title: 'NexGard Combo',
    description: '1 pipet · 0,4 ml',
    tag: 'Bu akşam',
    date: today,
    time: '20:00',
    recurrence: 'Aylık',
    notifyBefore: 30,
    status: 'pending',
    completedAt: null,
    createdAt: new Date().toISOString(),
  });
  db.insert('careItems', {
    id: nanoid(),
    petId: lunaId,
    ownerId: userId,
    kind: 'vaccine',
    title: 'Yıllık kuduz aşısı',
    description: 'Klinik randevusu',
    tag: null,
    date: isoDaysFromNow(8),
    time: '11:00',
    recurrence: 'Yıllık',
    notifyBefore: 60,
    status: 'pending',
    completedAt: null,
    createdAt: new Date().toISOString(),
  });

  // Vaccines (health record)
  db.insert('vaccines', {
    id: nanoid(),
    petId: aresId,
    title: 'Kuduz',
    date: '2026-02-10',
    status: 'completed',
    clinic: 'Klinik kaydı doğrulandı',
  });
  db.insert('vaccines', {
    id: nanoid(),
    petId: aresId,
    title: 'FVRCP',
    date: '2026-02-10',
    status: 'completed',
    clinic: 'Klinik kaydı doğrulandı',
  });
  db.insert('vaccines', {
    id: nanoid(),
    petId: aresId,
    title: 'Kedi lösemi rapeli',
    date: isoDaysFromNow(6),
    status: 'upcoming',
    clinic: null,
  });

  // Weight history for Ares
  const weightPoints = [
    ['2026-03-01', 3.6],
    ['2026-04-01', 3.75],
    ['2026-05-01', 3.85],
    ['2026-06-01', 3.9],
    ['2026-07-01', 3.95],
    ['2026-08-18', 4.0],
  ];
  weightPoints.forEach(([date, weightKg]) => {
    db.insert('weightLogs', { id: nanoid(), petId: aresId, date, weightKg });
  });

  // Conditions
  db.insert('conditions', {
    id: nanoid(),
    petId: aresId,
    title: 'Hassas sindirim',
    note: 'OmegaPet 3 dikkat incelemesine bağlı',
    date: '2026-04-04',
  });

  // Vet notes
  db.insert('vetNotes', {
    id: nanoid(),
    petId: aresId,
    vetName: 'Dr. Elif Kaya',
    date: '2026-04-12',
    note: 'Balık yağına geçiş sırasında dışkı kıvamını takip edin.',
  });

  // Products (searchable + scan target + analysis detail)
  const omegaPetId = nanoid();
  const patiPlusId = nanoid();
  const nexgardId = nanoid();

  db.insert('products', {
    id: omegaPetId,
    barcode: '8690000000123',
    brand: 'VetLife',
    name: 'OmegaPet 3 Salmon Oil Softgels',
    category: 'Vitamin ve takviye',
    imageUrl: `${IMG}/d043cbd0-cfaf-4cd8-8866-95bee68ac2e0.png`,
    aiSummary:
      'Cilt, tüy ve eklem sağlığını desteklemek için tasarlanmış balık yağı takviyesidir.',
    doseTitle: 'Günde 1 yumuşak kapsül',
    doseNote: 'Mama ile birlikte',
    ingredients: [
      { name: 'Balık yağı', amount: '500 mg', omega3Mg: 150 },
      { name: 'EPA', amount: '90 mg', omega3Mg: 90 },
      { name: 'DHA', amount: '60 mg', omega3Mg: 60 },
      { name: 'E vitamini', amount: '2 IU', omega3Mg: 0 },
    ],
    warnings: [
      'Bazı hayvanlarda geçici sindirim rahatsızlığı, yumuşak dışkı veya kusma görülebilir.',
      'Geçmişinde pankreatit bulunan hayvanlarda kullanmadan önce veterinerinize danışın.',
    ],
    interactsWith: [
      {
        productName: 'PatiPlus Adult Salmon',
        note: "PatiPlus Adult Salmon da omega-3 içerir. İki ürünü birlikte vermeden önce toplam dozu veterinerinizle kontrol edin.",
        omega3PerDayMg: 120,
      },
    ],
  });

  db.insert('products', {
    id: patiPlusId,
    barcode: '8690000000456',
    brand: 'PatiPlus',
    name: 'PatiPlus Adult Salmon',
    category: 'Mama',
    imageUrl: `${IMG}/7b8bec40-b552-4e55-b47e-dde313fae310.png`,
    aiSummary: 'Somon bazlı yetişkin kedi/köpek maması. İçeriğinde doğal omega-3 bulunur.',
    doseTitle: 'Günlük önerilen porsiyon paket üzerindedir',
    doseNote: 'Ana öğün',
    ingredients: [
      { name: 'Somon unu', amount: '32%', omega3Mg: 0 },
      { name: 'Balık yağı', amount: '180 mg', omega3Mg: 180 },
    ],
    warnings: [],
    interactsWith: [],
  });

  db.insert('products', {
    id: nexgardId,
    barcode: '8690000000789',
    brand: 'Boehringer Ingelheim',
    name: 'NexGard Combo',
    category: 'Parazit koruması',
    imageUrl: `${IMG}/835a2c40-7f2c-4701-a2f5-112660366893.png`,
    aiSummary: 'Pire, kene ve iç parazitlere karşı aylık koruma sağlayan spot-on damla.',
    doseTitle: '1 pipet · 0,4 ml',
    doseNote: 'Ayda bir kez, ense derisine uygulanır',
    ingredients: [
      { name: 'Esafoksolaner', amount: '8.3 mg', omega3Mg: 0 },
      { name: 'Eprinomektin', amount: '0.4 mg', omega3Mg: 0 },
    ],
    warnings: ['Uygulamadan sonra 24 saat pipet bölgesine dokunulmamalıdır.'],
    interactsWith: [],
  });

  db.insert('scanHistory', {
    id: nanoid(),
    userId,
    petId: aresId,
    productId: omegaPetId,
    scannedAt: isoDaysFromNow(-5),
    resultSummary: 'Güvenlik sonucu hazır',
  });

  db.persistNow();
  console.log('Örnek veriler yüklendi.');
}

module.exports = seed;
