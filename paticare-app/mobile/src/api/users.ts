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
