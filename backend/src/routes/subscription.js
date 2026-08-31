const express = require('express');
const db = require('../db');
const { requireAuth } = require('../middleware/auth');
const { TRIAL_DAYS, PLANS, deriveSubscription, planIdForProductId } = require('../subscription');

const router = express.Router();

function publicUser(user) {
  const { passwordHash, resetCode, resetCodeExpires, ...rest } = user;
  return { ...rest, subscription: deriveSubscription(rest.subscription) };
}

// POST /api/subscription/revenuecat-webhook — RevenueCat, PatiCare Plus için
// gerçek satın alma/yenileme/iptal olduğunda burayı çağırır (bkz.
// mobile/src/purchases.ts ve backend/src/subscription.js'teki üstteki not).
// requireAuth'tan ÖNCE tanımlandığı için (router.use(requireAuth) aşağıda)
// bu route kullanıcı JWT'si DEĞİL, aşağıdaki paylaşılan sır ile doğrulanıyor.
//
// UYARI: bu endpoint YAZILDI ama TEST EDİLEMEDİ — gerçek bir RevenueCat
// webhook eventi olmadan bu ortamda doğrulanamaz; RevenueCat panelinde
// Project settings > Webhooks altında bu backend'in genel (public) adresi +
// /api/subscription/revenuecat-webhook eklenip "Authorization header value"
// alanına REVENUECAT_WEBHOOK_AUTH_HEADER ile aynı değer yazılmalı.
router.post('/revenuecat-webhook', (req, res) => {
  const expected = process.env.REVENUECAT_WEBHOOK_AUTH_HEADER;
  if (!expected) {
    return res.status(503).json({ error: 'RevenueCat webhook yapılandırılmadı (REVENUECAT_WEBHOOK_AUTH_HEADER eksik).' });
  }
  if (req.headers.authorization !== expected) {
    return res.status(401).json({ error: 'Yetkisiz.' });
  }

  const event = req.body && req.body.event;
  if (!event || typeof event.app_user_id !== 'string') {
    return res.status(400).json({ error: 'Geçersiz webhook gövdesi.' });
  }

  // app_user_id, mobil tarafta Purchases.logIn(user.id) ile bizim kendi
  // db.users id'imizle aynı tutuluyor (bkz. mobile/src/purchases.ts) — bu
  // yüzden burada ayrı bir eşleme tablosuna gerek yok.
  const user = db.find('users', (u) => u.id === event.app_user_id);
  if (!user) {
    // Tanımadığımız bir appUserID (ör. RevenueCat'in kendi test/anonim
    // kullanıcısı) — sessizce 200 dönüyoruz ki RevenueCat aynı eventi
    // tekrar tekrar denemesin.
    return res.json({ ok: true, ignored: true });
  }

  const ACTIVE_TYPES = new Set(['INITIAL_PURCHASE', 'RENEWAL', 'PRODUCT_CHANGE', 'UNCANCELLATION']);
  const CANCEL_TYPES = new Set(['CANCELLATION']);
  const INACTIVE_TYPES = new Set(['EXPIRATION', 'BILLING_ISSUE']);

  let subscription = user.subscription;
  if (ACTIVE_TYPES.has(event.type)) {
    subscription = {
      ...subscription,
      plan: planIdForProductId(event.product_id) || (subscription && subscription.plan) || null,
      status: 'active',
      store: event.store === 'APP_STORE' ? 'apple' : event.store === 'PLAY_STORE' ? 'google' : (event.store || '').toLowerCase() || null,
      productId: event.product_id || null,
      expiresAt: event.expiration_at_ms ? new Date(event.expiration_at_ms).toISOString() : null,
      canceledAt: null,
      trialUsed: true,
    };
  } else if (CANCEL_TYPES.has(event.type)) {
    subscription = { ...subscription, status: 'canceled', canceledAt: new Date().toISOString() };
  } else if (INACTIVE_TYPES.has(event.type)) {
    subscription = { ...subscription, status: 'expired' };
  }
  // Diğer event tipleri (TRANSFER, SUBSCRIPTION_PAUSED, TEST vb.) şimdilik
  // yok sayılıyor — kapsam dışı bırakıldı, gerekirse genişletilebilir.

  db.update('users', user.id, { subscription });
  res.json({ ok: true });
});

router.use(requireAuth);

// GET /api/subscription/plans — pricing info the mobile app renders on the
// PatiCare Plus screen. Not behind requireAuth conceptually, but there's no
// harm keeping it consistent with the rest of this router.
router.get('/plans', (req, res) => {
  res.json({ plans: Object.values(PLANS), trialDays: TRIAL_DAYS });
});

// POST /api/subscription/start-trial { plan: 'monthly' | 'yearly' }
router.post('/start-trial', (req, res) => {
  const { plan } = req.body || {};
  if (!PLANS[plan]) {
    return res.status(400).json({ error: 'Geçersiz plan. "monthly" ya da "yearly" seçmelisin.' });
  }
  const user = db.find('users', (u) => u.id === req.userId);
  if (!user) return res.status(404).json({ error: 'Kullanıcı bulunamadı.' });

  const current = deriveSubscription(user.subscription);
  if (current.status === 'trialing') {
    return res.status(409).json({ error: 'Zaten aktif bir deneme sürümün var.' });
  }
  if (current.status === 'active') {
    return res.status(409).json({ error: 'Zaten aktif (gerçek) bir aboneliğin var.' });
  }
  if (current.trialUsed) {
    return res.status(409).json({ error: 'Ücretsiz deneme hakkını daha önce kullandın.' });
  }

  const trialEndsAt = new Date(Date.now() + TRIAL_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const subscription = { plan, status: 'trialing', trialEndsAt, canceledAt: null, trialUsed: true };
  const updated = db.update('users', user.id, { subscription });
  res.json({ user: publicUser(updated) });
});

// POST /api/subscription/cancel — cancels a trial in progress. Access stays
// on until the trial's original end date; it just won't auto-renew (moot
// here since nothing bills automatically anyway, but this mirrors how real
// subscription cancellation behaves).
router.post('/cancel', (req, res) => {
  const user = db.find('users', (u) => u.id === req.userId);
  if (!user) return res.status(404).json({ error: 'Kullanıcı bulunamadı.' });

  const current = deriveSubscription(user.subscription);
  if (current.status !== 'trialing') {
    return res.status(409).json({ error: 'İptal edilecek aktif bir deneme yok.' });
  }
  const subscription = { ...user.subscription, status: 'canceled', canceledAt: new Date().toISOString() };
  const updated = db.update('users', user.id, { subscription });
  res.json({ user: publicUser(updated) });
});

module.exports = router;
