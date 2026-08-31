const jwt = require('jsonwebtoken');

const DEFAULT_DEV_SECRET = 'paticare-dev-secret-change-me';
const JWT_SECRET = process.env.JWT_SECRET || DEFAULT_DEV_SECRET;

// Running with the default, publicly-known secret is fine for local
// development but would let anyone forge a valid login token in production.
// Fail fast there instead of silently shipping a broken lock.
if (JWT_SECRET === DEFAULT_DEV_SECRET && process.env.NODE_ENV === 'production') {
  throw new Error(
    'JWT_SECRET .env dosyasında ayarlanmadan production modunda çalıştırılamaz. ' +
      'Rastgele, gizli bir değer üretip (örn. `openssl rand -hex 32`) JWT_SECRET olarak ayarla.',
  );
}

function signToken(user) {
  return jwt.sign({ sub: user.id, email: user.email }, JWT_SECRET, { expiresIn: '30d' });
}

function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) {
    return res.status(401).json({ error: 'Oturum bulunamadı. Lütfen giriş yapın.' });
  }
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.userId = payload.sub;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Oturum geçersiz veya süresi dolmuş.' });
  }
}

module.exports = { signToken, requireAuth, JWT_SECRET };
