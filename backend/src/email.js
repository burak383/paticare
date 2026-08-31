// Sends transactional email through Resend's API (https://resend.com).
// Same "plain fetch, no SDK" choice as push.js — Node 18+ has fetch built
// in, so this stays a single small file with no new dependency to install.
//
// NOTE for whoever deploys this: this sandbox has no outbound network access
// to api.resend.com, so the actual HTTP call has NOT been exercised
// end-to-end here — only unit-tested with a mocked fetch (see
// __tests__/email logic covered indirectly through routes/auth.js's
// forgot-password smoke test). Send yourself a real test reset email after
// deploying to confirm delivery.
const RESEND_API_URL = 'https://api.resend.com/emails';

function isEmailConfigured() {
  return Boolean(process.env.RESEND_API_KEY);
}

// Best-effort — returns true/false rather than throwing, so a flaky email
// provider can never turn a password-reset request into a 500.
async function sendEmail({ to, subject, html, text }) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return false;
  const from = process.env.RESEND_FROM_EMAIL || 'PatiCare <onboarding@resend.dev>';

  try {
    const res = await fetch(RESEND_API_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ from, to, subject, html, text }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      console.error(`[PatiCare] Resend e-posta isteği başarısız (HTTP ${res.status}):`, body);
      return false;
    }
    return true;
  } catch (err) {
    console.error('[PatiCare] Resend e-posta isteği gönderilemedi:', err.message);
    return false;
  }
}

async function sendPasswordResetEmail(toEmail, code) {
  return sendEmail({
    to: toEmail,
    subject: 'PatiCare şifre sıfırlama kodun',
    text: `PatiCare şifre sıfırlama kodun: ${code}\n\nBu kod 15 dakika içinde geçerliliğini yitirecek. Bu isteği sen yapmadıysan bu e-postayı yok sayabilirsin.`,
    html: `<p>PatiCare şifre sıfırlama kodun:</p><p style="font-size:24px;font-weight:700;letter-spacing:4px;">${code}</p><p>Bu kod 15 dakika içinde geçerliliğini yitirecek. Bu isteği sen yapmadıysan bu e-postayı yok sayabilirsin.</p>`,
  });
}

module.exports = { sendEmail, sendPasswordResetEmail, isEmailConfigured };
