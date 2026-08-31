// PatiCare Plus — trial/subscription state helpers, shared by the auth and
// subscription routes.
//
// Bu demo, başta hiçbir ödeme sağlayıcısına bağlı değildi (ne App
// Store/Play Store IAP, ne Stripe/RevenueCat) — deneme başlatmak kart bilgisi
// istemiyordu ve hiçbir zaman gerçek ücretlendirme yapmıyordu. Görev #52
// kapsamında RevenueCat (react-native-purchases) üzerinden gerçek satın alma
// eklendi (bkz. mobile/src/purchases.ts ve aşağıdaki 'active' durumu +
// routes/subscription.js'teki /revenuecat-webhook). Bu YAZILDI ama UÇTAN UCA
// TEST EDİLEMEDİ — gerçek bir mağaza makbuzu/webhook eventi olmadan bu ortamda
// doğrulanamaz. RevenueCat API anahtarları boş bırakıldığı sürece (varsayılan)
// istemci tarafı bu koda hiç girmez ve eski "sadece ücretsiz deneme" davranışı
// aynen sürer.

const TRIAL_DAYS = 7;

// productId'ler mobile/src/purchases.ts'teki PLUS_PRODUCT_IDS ile BİREBİR
// eşleşmeli — App Store Connect / Google Play Console'da da bu kimliklerle
// abonelik ürünleri oluşturulmuş olmalı.
const PLANS = {
  monthly: { id: 'monthly', label: 'Aylık', priceLabel: '₺49,99/ay', productId: 'com.paticare.app.plus.monthly' },
  yearly: {
    id: 'yearly',
    label: 'Yıllık',
    priceLabel: '₺399,99/yıl',
    badgeLabel: '%33 tasarruf',
    productId: 'com.paticare.app.plus.yearly',
  },
};

function planIdForProductId(productId) {
  const plan = Object.values(PLANS).find((p) => p.productId === productId);
  return plan ? plan.id : null;
}

const DEFAULT_SUBSCRIPTION = {
  plan: null,
  status: 'none', // 'none' | 'trialing' | 'canceled' | 'active' | 'expired'
  trialEndsAt: null,
  // Aşağıdaki üçü yalnızca gerçek (RevenueCat) satın almalarda dolar — demo
  // deneme akışı hiçbirine dokunmaz.
  store: null, // 'apple' | 'google' | null
  productId: null,
  expiresAt: null,
  canceledAt: null,
  trialUsed: false,
};

// Trial/subscription expiry is checked lazily (same pattern as the
// password-reset code TTL in auth.js) instead of via a background job —
// cheap, and correct as long as every read goes through this function.
// expiresAt (gerçek satın alma) varsa onu, yoksa trialEndsAt'i (demo deneme)
// kullanır — ikisi asla aynı anda dolu olmaz.
function deriveSubscription(sub) {
  if (!sub || sub.status === 'none') return { ...DEFAULT_SUBSCRIPTION, ...(sub || {}) };
  const expiryIso = sub.expiresAt || sub.trialEndsAt;
  if (
    (sub.status === 'trialing' || sub.status === 'canceled' || sub.status === 'active') &&
    expiryIso &&
    Date.now() > new Date(expiryIso).getTime()
  ) {
    return { ...sub, status: 'expired' };
  }
  return sub;
}

// Whether the derived subscription currently grants Plus features — true
// during an active trial or a real active subscription, and still true after
// canceling until the current period's end date (so canceling doesn't cut
// access short).
function hasPlusAccess(sub) {
  const derived = deriveSubscription(sub);
  return derived.status === 'trialing' || derived.status === 'canceled' || derived.status === 'active';
}

module.exports = { TRIAL_DAYS, PLANS, DEFAULT_SUBSCRIPTION, deriveSubscription, hasPlusAccess, planIdForProductId };
