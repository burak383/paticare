import { apiRequest } from './client';
import type { Preferences, User } from './types';

export async function updateProfile(patch: { name?: string; email?: string }) {
  const res = await apiRequest<{ user: User }>('/users/me', { method: 'PATCH', body: patch });
  return res.user;
}

export async function updatePreferences(patch: Partial<Preferences>) {
  const res = await apiRequest<{ user: User }>('/users/me/preferences', { method: 'PATCH', body: patch });
  return res.user;
}

export async function deleteAccount() {
  await apiRequest<{ success: boolean }>('/users/me', { method: 'DELETE' });
}

// Registers this device's Expo push token with the backend so
// reminderScheduler.js can push care-item reminders to it — see
// notifications.ts's registerForPushNotifications() for where the token
// itself comes from.
export async function registerPushToken(token: string) {
  const res = await apiRequest<{ user: User }>('/users/push-token', { method: 'POST', body: { token } });
  return res.user;
}

// Removes THIS device's token — called on logout so a signed-out device
// doesn't keep receiving reminders meant for the account that just left it,
// without touching any other device still signed into the same account
// (a user's account can have more than one registered token; see
// backend/src/routes/users.js). The backend requires the token explicitly
// for the same reason — there'd be no safe "clear everything" fallback.
export async function unregisterPushToken(token: string) {
  await apiRequest<{ user: User }>('/users/push-token', { method: 'DELETE', body: { token } });
}
