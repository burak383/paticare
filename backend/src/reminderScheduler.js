// Server-triggered push notifications for care-item reminders — a companion
// to the phone-local notifications scheduled on-device (mobile/src/notifications.ts).
// Local notifications only fire if the app has scheduled them AND the OS
// process that owns them hasn't been reset (reinstall, notification
// permission revoked and re-granted, etc.); this scheduler is the backstop
// that reaches the device even then, as long as it holds a valid Expo push
// token for the user.
const db = require('./db');
const { sendExpoPushMessages } = require('./push');

const CHECK_INTERVAL_MS = 60 * 1000;
// If a due reminder is somehow missed for longer than this (server was
// down, or — as happens often in this sandbox — restarted), don't fire a
// stale push hours later; just drop it silently.
const CATCH_UP_WINDOW_MS = 5 * 60 * 1000;

// True once `item`'s notifyBefore lead time has passed but not by more than
// CATCH_UP_WINDOW_MS. Uses local calendar-date arithmetic (never
// Date#toISOString), matching the timezone-safety convention used
// throughout this backend (see nextOccurrenceDate in routes/careItems.js) —
// item.date/time are Turkey (UTC+3, no DST) local wall-clock values.
function isDueNow(item, now = Date.now()) {
  const [y, m, d] = item.date.split('-').map(Number);
  const [hh, mm] = item.time.split(':').map(Number);
  const target = new Date(y, (m || 1) - 1, d || 1, hh || 0, mm || 0, 0, 0).getTime();
  const notifyAt = target - (typeof item.notifyBefore === 'number' ? item.notifyBefore : 0) * 60 * 1000;
  return notifyAt <= now && now - notifyAt < CATCH_UP_WINDOW_MS;
}

async function tick() {
  try {
    const now = Date.now();
    const candidates = db.filter('careItems', (c) => c.status === 'pending' && !c.pushSentAt);
    const due = candidates.filter((item) => isDueNow(item, now));
    if (!due.length) return;

    const messages = [];
    for (const item of due) {
      const user = db.find('users', (u) => u.id === item.ownerId);
      // No token registered yet, or the user turned reminders off — mark it
      // sent anyway so this item isn't re-checked every tick forever; there's
      // nothing actionable to retry here (no token appearing later would
      // retroactively make a past reminder time correct to push).
      db.update('careItems', item.id, { pushSentAt: new Date().toISOString() });
      const tokens = Array.isArray(user?.pushTokens) ? user.pushTokens : [];
      if (!tokens.length) continue;
      if (user.preferences && user.preferences.medicationReminders === false) continue;

      const pet = db.find('pets', (p) => p.id === item.petId);
      const firesEarly = (item.notifyBefore || 0) > 0;
      // One message per registered device — a user signed in on more than
      // one phone should get the reminder on all of them, not just whichever
      // registered last (see routes/users.js's push-token routes).
      for (const token of tokens) {
        messages.push({
          to: token,
          title: `${pet ? pet.name : 'Evcil hayvanın'} için hatırlatıcı`,
          // When notifyBefore sends this ahead of the actual time (the usual
          // case), say so — matches the on-device local notification's body
          // (mobile/src/notifications.ts's scheduleCareItemReminder), so a
          // user with both enabled sees a consistent message either way.
          body: firesEarly ? `${item.title} — saat ${item.time}` : item.title,
          data: { careItemId: item.id, petId: item.petId },
        });
      }
    }
    if (!messages.length) return;
    const { invalidTokens } = await sendExpoPushMessages(messages);
    if (invalidTokens && invalidTokens.length) removeDeadTokens(invalidTokens);
  } catch (err) {
    console.error('[PatiCare] Hatırlatıcı push kontrolü başarısız:', err);
  }
}

// Expo told us these tokens will never work again (app uninstalled, token
// revoked) — strip them out of whichever user record(s) hold them so this
// scheduler stops trying, and so a fresh registration from the same physical
// device later doesn't end up alongside a dead duplicate. Scans every user
// rather than looking the token up by the message's original owner, because
// by the time the async push request resolves the item/user pairing from
// this tick is no longer at hand — and it's cheap: this JSON "database" is
// never large enough for a full scan here to matter.
function removeDeadTokens(deadTokens) {
  const dead = new Set(deadTokens);
  for (const user of db.all('users')) {
    if (!Array.isArray(user.pushTokens) || !user.pushTokens.some((t) => dead.has(t))) continue;
    db.update('users', user.id, { pushTokens: user.pushTokens.filter((t) => !dead.has(t)) });
  }
}

// Returns the interval handle so callers (tests, graceful shutdown) can
// clearInterval() it — index.js doesn't currently need to, but not leaking
// the handle would make that impossible to add later.
function startReminderScheduler() {
  tick();
  return setInterval(tick, CHECK_INTERVAL_MS);
}

module.exports = { startReminderScheduler, isDueNow, tick };
