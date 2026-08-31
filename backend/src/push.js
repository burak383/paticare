// Sends push notifications through Expo's push API (https://exp.host).
// Deliberately implemented with plain `fetch` (Node 18+ has it built in —
// see routes/auth.js's Google token verification for the same pattern)
// rather than adding the `expo-server-sdk` dependency, to keep this a single
// small file with no new package to install.
//
// NOTE for whoever deploys this: this sandbox has no outbound network access
// to exp.host in theory, but it turns out it actually does — sendExpoPushMessages
// was smoke-tested against the real endpoint with a fake token and got back a
// real HTTP response (403, as expected for a bogus token). Still, run a real
// end-to-end test with a genuine device token after deploying — a fake token
// can't confirm the success path or the DeviceNotRegistered cleanup below.
const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
// Expo rejects a single request with more than 100 messages.
const EXPO_PUSH_CHUNK_SIZE = 100;

function chunk(list, size) {
  const chunks = [];
  for (let i = 0; i < list.length; i += size) chunks.push(list.slice(i, i + size));
  return chunks;
}

// messages: [{ to, title, body, sound?, data? }, ...]
// Best-effort — logs failures instead of throwing, so a flaky push endpoint
// can never take down the reminder scheduler that calls this.
//
// Returns { invalidTokens: string[] } — the `to` values Expo told us are
// dead (status "error", details.error === "DeviceNotRegistered": the app
// was uninstalled, or the token was revoked). The caller (reminderScheduler.js)
// removes these from whichever user record holds them, so a stale token
// doesn't sit there failing silently on every tick forever. Other error
// kinds (rate limits, malformed message, etc.) are logged but NOT treated as
// dead tokens — only DeviceNotRegistered means "this will never work again".
async function sendExpoPushMessages(messages) {
  const list = (messages || []).filter((m) => m && m.to);
  const invalidTokens = [];
  if (!list.length) return { invalidTokens };

  for (const batch of chunk(list, EXPO_PUSH_CHUNK_SIZE)) {
    try {
      const res = await fetch(EXPO_PUSH_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(batch.map((m) => ({ to: m.to, title: m.title, body: m.body, sound: m.sound || 'default', data: m.data }))),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        console.error(`[PatiCare] Expo push isteği başarısız (HTTP ${res.status}):`, json);
        continue;
      }
      // Expo's response `data` array is positionally aligned with the
      // request batch — entry i corresponds to batch[i]'s `to`.
      const entries = json?.data || [];
      const errors = [];
      entries.forEach((entry, i) => {
        if (entry?.status !== 'error') return;
        errors.push(entry);
        if (entry?.details?.error === 'DeviceNotRegistered' && batch[i]) {
          invalidTokens.push(batch[i].to);
        }
      });
      if (errors.length) {
        console.error('[PatiCare] Expo push bazı hedeflere gönderilemedi:', errors);
      }
    } catch (err) {
      console.error('[PatiCare] Expo push isteği gönderilemedi:', err.message);
    }
  }
  return { invalidTokens };
}

module.exports = { sendExpoPushMessages, EXPO_PUSH_URL };
