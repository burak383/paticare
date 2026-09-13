// PatiCare — Sign in with Apple kimlik jetonu doğrulaması.
//
// Google'ın basit tokeninfo endpoint'inden farklı olarak Apple kimlik
// doğrulama jetonu (identityToken) imzalı bir JWT — Apple'ın yayınladığı
// genel anahtarlarla (JWKS) imzasını, issuer'ı ve audience'ı elle
// doğrulamamız gerekiyor. Ekstra bir JWKS kütüphanesi eklemek yerine
// Node'un (18+) crypto.createPublicKey'in doğrudan desteklediği JWK
// formatını kullanıyoruz — bu backend zaten Node 22 üzerinde çalışıyor
// (bkz. Dockerfile).
//
// ÖNEMLİ: native (mobil) Sign In with Apple akışında identityToken'ın
// "aud" (audience) alanı her zaman uygulamanın BUNDLE IDENTIFIER'ıdır
// (örn. "app.paticare.mobile") — web tabanlı "Sign In with Apple" akışında
// kullanılan ayrı bir "Services ID" DEĞİL. APPLE_BUNDLE_ID ortam değişkeni
// bu yüzden doğrudan app.json'daki ios.bundleIdentifier ile aynı olmalı.

const crypto = require('crypto');
const jwt = require('jsonwebtoken');

const APPLE_KEYS_URL = 'https://appleid.apple.com/auth/keys';
const APPLE_ISSUER = 'https://appleid.apple.com';
const KEYS_CACHE_TTL_MS = 60 * 60 * 1000; // 1 saat — Apple anahtarları nadiren değişir

let cachedKeys = null;
let cachedAt = 0;

function isAppleAuthConfigured() {
  return Boolean(process.env.APPLE_BUNDLE_ID);
}

async function fetchAppleKeys() {
  const now = Date.now();
  if (cachedKeys && now - cachedAt < KEYS_CACHE_TTL_MS) return cachedKeys;

  const res = await fetch(APPLE_KEYS_URL);
  if (!res.ok) throw new Error(`Apple JWKS alınamadı (HTTP ${res.status}).`);
  const json = await res.json();
  if (!Array.isArray(json.keys) || json.keys.length === 0) {
    throw new Error('Apple JWKS yanıtı beklenmedik biçimde.');
  }
  cachedKeys = json.keys;
  cachedAt = now;
  return cachedKeys;
}

// idToken: expo-apple-authentication'ın signInAsync() çağrısından dönen
// credential.identityToken. Geçerliyse decoded JWT payload'ı (email, sub vb.)
// döner; geçersizse fırlatır.
async function verifyAppleIdToken(idToken) {
  const bundleId = process.env.APPLE_BUNDLE_ID;
  if (!bundleId) {
    throw new Error('APPLE_BUNDLE_ID ayarlanmadan Apple kimlik jetonu doğrulanamaz.');
  }

  const decoded = jwt.decode(idToken, { complete: true });
  if (!decoded || !decoded.header || !decoded.header.kid) {
    throw new Error('Geçersiz Apple kimlik jetonu (kid eksik).');
  }

  const keys = await fetchAppleKeys();
  const jwk = keys.find((k) => k.kid === decoded.header.kid);
  if (!jwk) {
    throw new Error('Apple kimlik jetonunu imzalayan anahtar bulunamadı.');
  }

  const publicKey = crypto.createPublicKey({ key: jwk, format: 'jwk' });

  // jwt.verify imzayı, "exp"i, issuer'ı ve audience'ı tek seferde doğrular —
  // herhangi biri tutmazsa fırlatır.
  const payload = jwt.verify(idToken, publicKey, {
    algorithms: ['RS256'],
    issuer: APPLE_ISSUER,
    audience: bundleId,
  });

  return payload;
}

module.exports = { isAppleAuthConfigured, verifyAppleIdToken };
