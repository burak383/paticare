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

  seedExtraCatalog();

  db.persistNow();
  console.log('Örnek veriler yüklendi.');
}

// Yukarıdaki 3 ürün (OmegaPet 3, PatiPlus Adult Salmon, NexGard Combo) gerçek
// bir görsele sahip — bu genişletilmiş katalogdaki ürünlerin görseli yok
// (bkz. mobile/src/components/ProductImage.tsx'teki not: gerçek marka
// fotoğraflarını izinsiz kullanmamak için kategoriye göre ikon gösteriliyor).
// Dozaj/etken madde bilgileri genel bilinen, kamuya açık bilgilere dayanıyor
// ve genel bir rehber niteliğinde — gerçek kullanım için her zaman ürün
// ambalajı/veteriner önerisi esas alınmalı (bkz. aşağıdaki genel uyarı).
const VET_GUIDANCE_WARNING =
  'Bu bilgi genel bir rehber niteliğindedir; gerçek dozaj için ürün ambalajını ve veteriner hekiminizin önerisini esas alın.';

function seedExtraCatalog() {
  let barcodeSeq = 1000;
  const nextBarcode = () => `869${String(barcodeSeq++).padStart(10, '0')}`;

  const catFood = [
    ['Royal Canin', 'Indoor Adult Kedi Maması', 'Ev kedileri için düşük kalorili, hairball kontrollü kuru mama.'],
    ['Royal Canin', 'Kitten Yavru Kedi Maması', '4-12 aylık yavru kediler için büyüme dönemine özel formül.'],
    ["Hill's Science Diet", 'Adult Kedi Maması', 'Dengeli protein ve lif içeren yetişkin kedi maması.'],
    ['Purina Pro Plan', 'Adult Sterilised Kedi Maması', 'Kısırlaştırılmış kediler için kilo kontrolüne destek formülü.'],
    ['Purina ONE', 'Adult Kedi Maması', 'Tavuklu, günlük beslenme için dengeli kuru mama.'],
    ['Whiskas', 'Adult Kuru Kedi Maması', 'Somonlu, yetişkin kediler için günlük kuru mama.'],
    ['Felix', 'Kuru Kedi Maması', 'Ekonomik, günlük besleme için karışık lezzetli kuru mama.'],
    ['Proline', 'Adult Cat Kuru Mama', 'Yerli üretim, tavuklu yetişkin kedi maması.'],
    ['N&D', 'Natural & Delicious Cat', 'Tahılsız, düşük glisemik kuru kedi maması.'],
    ['Acana', 'Wild Prairie Cat', 'Yüksek et oranlı, tahılsız kuru kedi maması.'],
  ];

  const dogFood = [
    ['Royal Canin', 'Medium Adult Köpek Maması', 'Orta ırk yetişkin köpekler için eklem desteği içeren formül.'],
    ['Royal Canin', 'Puppy Yavru Köpek Maması', 'Yavru köpeklerin büyüme dönemine özel dengeli formül.'],
    ["Hill's Science Diet", 'Adult Köpek Maması', 'Kas kütlesini korumaya destek dengeli protein formülü.'],
    ['Purina Pro Plan', 'Adult Medium Köpek Maması', 'Sindirim sağlığını destekleyen prebiyotik içerikli formül.'],
    ['Purina ONE', 'Adult Köpek Maması', 'Tavuklu, günlük beslenme için dengeli kuru mama.'],
    ['Pedigree', 'Adult Kuru Köpek Maması', 'Yetişkin köpekler için günlük dengeli besleme.'],
    ['Proline', 'Adult Dog Kuru Mama', 'Yerli üretim, tavuklu yetişkin köpek maması.'],
    ['N&D', 'Natural & Delicious Dog', 'Tahılsız, düşük glisemik kuru köpek maması.'],
    ['Acana', 'Heritage Adult Dog', 'Yüksek et oranlı, tahılsız kuru köpek maması.'],
    ['Brit Care', 'Adult Dog Lamb & Rice', 'Kuzu etli, hassas mideler için hipoalerjenik formül.'],
  ];

  const wetFood = [
    ['Whiskas', 'Yaş Mama Pouch Somon', 'Sos içinde somonlu yaş kedi maması.'],
    ['Felix', 'Yaş Mama Kutu Karışık', 'Jöle içinde karışık etli yaş kedi maması.'],
    ['Royal Canin', 'Yaş Mama Pouch Kitten', 'Yavru kediler için sos içinde yaş mama.'],
    ['Pedigree', 'Yaş Mama Pouch Köpek', 'Sos içinde etli parçalar halinde yaş köpek maması.'],
    ["Hill's Science Diet", 'Yaş Mama Konserve Köpek', 'Dengeli, yumuşak dokulu yaş köpek maması.'],
    ['Purina Pro Plan', 'Yaş Mama Pouch Kedi', 'Sos içinde parçalar halinde yaş kedi maması.'],
  ];

  const treats = [
    ['Pedigree', 'Dentastix Günlük Diş Bakım Ödülü', 'Diş taşı oluşumunu azaltmaya yardımcı çiğneme ödülü.'],
    ['Purina', 'Dentalife Kedi Ödülü', 'Ağız sağlığını destekleyen çıtır ödül.'],
    ['Whiskas', 'Temptations Kedi Ödülü', 'Çıtır dış, yumuşak iç dokulu ödül maması.'],
    ['Royal Canin', 'Eğitim Ödülü Köpek', 'Düşük kalorili, eğitim sırasında kullanılabilecek ödül.'],
    ['Trixie', 'Doğal Tavuk Şeridi Köpek Ödülü', 'Tek içerikli, katkısız doğal tavuk ödülü.'],
  ];

  const supplements = [
    ['VetLife', 'JointCare Glucosamine Tablet', 'Eklem sağlığını desteklemek için glukozamin/kondroitin takviyesi.', [
      { name: 'Glukozamin', amount: '250 mg', omega3Mg: 0 },
      { name: 'Kondroitin sülfat', amount: '200 mg', omega3Mg: 0 },
    ]],
    ['8in1', 'Excel Multi Vitamin Köpek', 'Günlük vitamin-mineral ihtiyacını desteklemeye yönelik tablet.', [
      { name: 'A vitamini', amount: '500 IU', omega3Mg: 0 },
      { name: 'D3 vitamini', amount: '50 IU', omega3Mg: 0 },
    ]],
    ['Beaphar', 'Kedi Otu Vitamin Macunu', 'Tüy yumağı ve iştah desteği için vitaminli macun.', [
      { name: 'Malt ekstresi', amount: '1 g', omega3Mg: 0 },
      { name: 'Taurin', amount: '20 mg', omega3Mg: 0 },
    ]],
    ['Nutri-Vet', 'Salmon Oil Balık Yağı', 'Cilt ve tüy sağlığı için sıvı somon yağı takviyesi.', [
      { name: 'Somon yağı', amount: '1 ml', omega3Mg: 220 },
      { name: 'EPA', amount: '80 mg', omega3Mg: 80 },
    ]],
    ['Zesty Paws', 'Probiotic Bites Köpek', 'Sindirim florasını desteklemeye yönelik probiyotik çiğneme tableti.', [
      { name: 'Probiyotik kültür karışımı', amount: '1 milyar CFU', omega3Mg: 0 },
      { name: 'Prebiyotik lif', amount: '150 mg', omega3Mg: 0 },
    ]],
    ['VetLife', 'CalciBoost Kalsiyum Tableti', 'Büyüme dönemindeki yavrular için kalsiyum-fosfor desteği.', [
      { name: 'Kalsiyum', amount: '300 mg', omega3Mg: 0 },
      { name: 'Fosfor', amount: '150 mg', omega3Mg: 0 },
    ]],
  ];

  const parasitics = [
    ['Boehringer Ingelheim', 'Frontline Combo Kedi', 'Pire ve kenelere karşı aylık spot-on damla.', [
      { name: 'Fipronil', amount: '50 mg', omega3Mg: 0 },
      { name: 'S-metopren', amount: '60 mg', omega3Mg: 0 },
    ]],
    ['MSD Animal Health', 'Bravecto Çiğnenebilir Tablet Köpek', '12 haftaya kadar pire/kene koruması sağlayan çiğneme tableti.', [
      { name: 'Fluralaner', amount: '250 mg', omega3Mg: 0 },
    ]],
    ['Elanco', 'Advantix Spot-On Köpek', 'Pire, kene ve sivrisineklere karşı aylık damla.', [
      { name: 'İmidakloprid', amount: '100 mg', omega3Mg: 0 },
      { name: 'Permetrin', amount: '500 mg', omega3Mg: 0 },
    ]],
    ['Elanco', 'Milbemax Tablet Kedi', 'İç parazitlere (yuvarlak/şerit kurt) karşı tablet.', [
      { name: 'Milbemisin oksim', amount: '16 mg', omega3Mg: 0 },
      { name: 'Prazikuantel', amount: '40 mg', omega3Mg: 0 },
    ]],
    ['Bayer', 'Drontal Plus Tablet Köpek', 'Geniş spektrumlu iç parazit (solucan) tableti.', [
      { name: 'Prazikuantel', amount: '50 mg', omega3Mg: 0 },
      { name: 'Pirantel', amount: '144 mg', omega3Mg: 0 },
    ]],
    ['Boehringer Ingelheim', 'NexGard Spectra Köpek', 'Pire, kene ve kalp kurduna karşı aylık çiğneme tableti.', [
      { name: 'Afoksolaner', amount: '11.3 mg', omega3Mg: 0 },
      { name: 'Milbemisin oksim', amount: '2.25 mg', omega3Mg: 0 },
    ]],
  ];

  const simpleFood = (brand, name, summary) => ({
    brand,
    name,
    category: 'Mama',
    aiSummary: summary,
    doseTitle: 'Günlük önerilen porsiyon ambalaj üzerindeki tabloya göre',
    doseNote: 'Ana öğün',
    ingredients: [],
    warnings: [],
    interactsWith: [],
  });

  const simpleTreat = (brand, name, summary) => ({
    brand,
    name,
    category: 'Ödül',
    aiSummary: summary,
    doseTitle: 'Günlük ödül payının bir parçası olarak',
    doseNote: 'Ana öğünün yerine geçmez',
    ingredients: [],
    warnings: ['Günlük kalori ihtiyacının küçük bir bölümünü oluşturmalı, ana beslenmenin yerini almamalıdır.'],
    interactsWith: [],
  });

  const supplementProduct = (brand, name, summary, ingredients) => ({
    brand,
    name,
    category: 'Vitamin ve takviye',
    aiSummary: summary,
    doseTitle: 'Ambalaj üzerindeki kiloya göre dozaj tablosuna bakın',
    doseNote: 'Mama ile birlikte',
    ingredients,
    warnings: [VET_GUIDANCE_WARNING],
    interactsWith: [],
  });

  const parasiticProduct = (brand, name, summary, ingredients) => ({
    brand,
    name,
    category: 'Parazit koruması',
    aiSummary: summary,
    doseTitle: 'Kiloya göre dozaj için ambalajı kontrol edin',
    doseNote: 'Veteriner önerisiyle düzenli aralıklarla uygulanır',
    ingredients,
    warnings: [VET_GUIDANCE_WARNING, 'Gebe/emzikli hayvanlarda ve hasta bireylerde kullanmadan önce veterinerinize danışın.'],
    interactsWith: [],
  });

  const all = [
    ...catFood.map(([b, n, s]) => simpleFood(b, n, s)),
    ...dogFood.map(([b, n, s]) => simpleFood(b, n, s)),
    ...wetFood.map(([b, n, s]) => ({ ...simpleFood(b, n, s), category: 'Yaş mama' })),
    ...treats.map(([b, n, s]) => simpleTreat(b, n, s)),
    ...supplements.map(([b, n, s, ing]) => supplementProduct(b, n, s, ing)),
    ...parasitics.map(([b, n, s, ing]) => parasiticProduct(b, n, s, ing)),
  ];

  all.forEach((product) => {
    db.insert('products', { id: nanoid(), barcode: nextBarcode(), ...product });
  });
}

module.exports = seed;
