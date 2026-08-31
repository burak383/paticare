const express = require('express');
const { nanoid } = require('nanoid');
const db = require('../db');
const { requireAuth } = require('../middleware/auth');
const { isVisionConfigured, detectProductLabels } = require('../vision');

const router = express.Router();
router.use(requireAuth);

function normalize(str) {
  return String(str || '')
    .toLocaleLowerCase('tr-TR')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
}

// Google Cloud Vision'dan gelen serbest metin/etiket/logo çıktısını demo ürün
// veritabanımızla eşleştirmeye çalışan basit bir sezgisel yöntem — kapsam
// dışı bırakıldı, gerçek anahtarla test edilip iyileştirilmesi gerekiyor
// (bkz. src/vision.js'teki üstteki not). Bir ürünün hem markası hem de
// isminin ilk kelimesi okunan metinde geçiyorsa eşleşme sayılır; sadece
// marka ya da sadece ürün adı yeterli değil (yanlış pozitifi azaltmak için).
function matchProductFromVisionDetection(detection) {
  const haystack = normalize(`${detection.text} ${detection.labels.join(' ')} ${detection.logos.join(' ')}`);
  if (!haystack) return null;

  const products = db.all('products');
  for (const product of products) {
    const brand = normalize(product.brand);
    const firstNameWord = normalize(product.name).split(' ')[0];
    if (brand && firstNameWord && haystack.includes(brand) && haystack.includes(firstNameWord)) {
      return product;
    }
  }
  // Marka+isim eşleşmesi yoksa, ürünün tam adı geçiyor mu diye tek başına da bak.
  return products.find((p) => haystack.includes(normalize(p.name))) || null;
}

// GET /api/products/search?q=omega  -> the search feature backing the "Ara" tab on Tara
router.get('/search', (req, res) => {
  const q = normalize(req.query.q);
  const all = db.all('products');
  if (!q) {
    // No query yet: surface everything so the search screen isn't empty on open.
    return res.json({ products: all.slice(0, 20) });
  }
  const results = all.filter((p) => {
    const haystack = normalize(`${p.brand} ${p.name} ${p.category} ${(p.ingredients || []).map((i) => i.name).join(' ')}`);
    return haystack.includes(q);
  });
  res.json({ products: results });
});

router.get('/:id', (req, res) => {
  const product = db.find('products', (p) => p.id === req.params.id);
  if (!product) return res.status(404).json({ error: 'Ürün bulunamadı.' });
  res.json({ product });
});

// POST /api/products/scan { barcode?, name?, image?, petId? }
// barcode/name: matches directly against the demo product database (manual
// entry / existing behavior, unchanged). image (data URI, from a real camera
// capture — see mobile/src/media.ts's captureProductPhoto): when
// GOOGLE_VISION_API_KEY is configured, this is sent to Google Cloud Vision
// for real text/label/logo recognition (see ../vision.js) and matched
// against the demo product database — this is written but NOT verified
// end-to-end with a real Vision key (see vision.js's note). When Vision
// isn't configured, or no image/barcode/name was sent at all, falls back to
// the original demo behavior (first product in the catalog) so the "tara"
// button always shows something.
router.post('/scan', async (req, res) => {
  const { barcode, name, image, petId } = req.body || {};
  let product = null;
  if (barcode) {
    product = db.find('products', (p) => p.barcode === barcode);
  }
  if (!product && name) {
    const q = normalize(name);
    product = db.find('products', (p) => normalize(p.name).includes(q) || normalize(p.brand).includes(q));
  }

  let visionAttempted = false;
  if (!product && image && isVisionConfigured()) {
    visionAttempted = true;
    try {
      const detection = await detectProductLabels(image);
      product = matchProductFromVisionDetection(detection);
    } catch (err) {
      console.error('[PatiCare] Vision API hatası:', err.message);
      // Aşağıda visionAttempted true olduğu için demo fallback'e DÜŞMÜYOR —
      // gerçek bir tanıma denendi ve başarısız oldu, sahte bir eşleşme
      // göstermek yanıltıcı olur.
    }
  }

  if (!product) {
    if (visionAttempted) {
      return res.status(404).json({ error: 'Ürün tanınamadı. Etiketi daha net bir açıyla tekrar dene ya da elle ara.' });
    }
    // Demo fallback: görsel tanıma yapılandırılmamış (ya da hiç görsel
    // gönderilmemiş) — "tara" butonu her zaman bir şey göstersin diye.
    product = db.all('products')[0] || null;
  }
  if (!product) return res.status(404).json({ error: 'Ürün tanınamadı.' });

  if (petId) {
    db.insert('scanHistory', {
      id: nanoid(),
      userId: req.userId,
      petId,
      productId: product.id,
      scannedAt: new Date().toISOString(),
      resultSummary: 'Güvenlik sonucu hazır',
    });
  }

  res.json({ product });
});

router.get('/history/:petId', (req, res) => {
  const history = db
    .filter('scanHistory', (s) => s.userId === req.userId && s.petId === req.params.petId)
    .sort((a, b) => b.scannedAt.localeCompare(a.scannedAt))
    .map((entry) => ({
      ...entry,
      product: db.find('products', (p) => p.id === entry.productId) || null,
    }));
  res.json({ history });
});

// POST /api/products/analyze-safety { petId, productIds: [id, id] }
// Combines omega-3 (or generically: interacting ingredient) contributions across products
// and flags whether the combined daily amount is risky — powers the "Analiz et" button.
router.post('/analyze-safety', (req, res) => {
  const { petId, productIds } = req.body || {};
  if (!petId || !Array.isArray(productIds) || productIds.length === 0) {
    return res.status(400).json({ error: 'petId ve en az bir productId gerekli.' });
  }
  const pet = db.find('pets', (p) => p.id === petId && p.ownerId === req.userId);
  if (!pet) return res.status(404).json({ error: 'Evcil hayvan bulunamadı.' });

  const products = productIds
    .map((id) => db.find('products', (p) => p.id === id))
    .filter(Boolean);

  const contributions = products.map((p) => {
    const totalOmega3 = (p.ingredients || []).reduce((sum, ing) => sum + (ing.omega3Mg || 0), 0);
    return { productId: p.id, name: p.name, omega3Mg: totalOmega3 };
  });
  const totalMg = contributions.reduce((sum, c) => sum + c.omega3Mg, 0);

  // Simple demo threshold: > 250mg/day combined omega-3 for a cat/small dog is flagged.
  const threshold = 250;
  const risk = totalMg > threshold ? 'high' : totalMg > threshold * 0.6 ? 'medium' : 'low';

  res.json({
    petId,
    contributions,
    totalMg,
    threshold,
    risk,
    recommendation:
      risk === 'high'
        ? 'Takviyeyi başlatmadan önce mevcut mamayla birlikte günlük dozu veterinerinizle doğrulayın.'
        : risk === 'medium'
          ? 'Hedef aralığa yakın; birkaç gün gözlemleyip veterinerinize danışmanız önerilir.'
          : 'Hedef aralık içinde; planınıza devam edebilirsiniz.',
  });
});

// --- Price notes -----------------------------------------------------------
// There's no real retailer/price-comparison data anywhere in this demo (no
// pricing feed, no affiliate integration) — fabricating "other stores'
// prices" would just be made-up numbers presented as real ones. Instead this
// is an honest, user-maintained price log: the user logs where *they* saw or
// paid a price for a product, and can look back at their own history later.

router.get('/:id/price-notes', (req, res) => {
  const product = db.find('products', (p) => p.id === req.params.id);
  if (!product) return res.status(404).json({ error: 'Ürün bulunamadı.' });
  const notes = db
    .filter('priceNotes', (n) => n.productId === product.id && n.userId === req.userId)
    .sort((a, b) => b.date.localeCompare(a.date));
  res.json({ priceNotes: notes });
});

router.post('/:id/price-notes', (req, res) => {
  const product = db.find('products', (p) => p.id === req.params.id);
  if (!product) return res.status(404).json({ error: 'Ürün bulunamadı.' });
  const { store, price, date, note } = req.body || {};
  if (!store || typeof price !== 'number' || price <= 0) {
    return res.status(400).json({ error: 'Mağaza adı ve geçerli bir fiyat gerekli.' });
  }
  const entry = {
    id: nanoid(),
    productId: product.id,
    userId: req.userId,
    store,
    price,
    date: date || new Date().toISOString().slice(0, 10),
    note: note || '',
    createdAt: new Date().toISOString(),
  };
  db.insert('priceNotes', entry);
  res.status(201).json({ priceNote: entry });
});

router.delete('/:id/price-notes/:noteId', (req, res) => {
  const note = db.find('priceNotes', (n) => n.id === req.params.noteId && n.productId === req.params.id);
  if (!note || note.userId !== req.userId) return res.status(404).json({ error: 'Kayıt bulunamadı.' });
  db.remove('priceNotes', note.id);
  res.json({ success: true });
});

module.exports = router;
