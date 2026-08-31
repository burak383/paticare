import { apiRequest, setToken } from './client';
import type { User } from './types';

type AuthResponse = { token: string; user: User };

export async function login(email: string, password: string) {
  const res = await apiRequest<AuthResponse>('/auth/login', {
    method: 'POST',
    body: { email, password },
    auth: false,
  });
  await setToken(res.token);
  return res.user;
}

export async function register(email: string, password: string, name?: string) {
  const res = await apiRequest<AuthResponse>('/auth/register', {
    method: 'POST',
    body: { email, password, name },
    auth: false,
  });
  await setToken(res.token);
  return res.user;
}

export async function continueAsGuest() {
  const res = await apiRequest<AuthResponse>('/auth/guest', { method: 'POST', auth: false });
  await setToken(res.token);
  return res.user;
}

export async function fetchCurrentUser() {
  const res = await apiRequest<{ user: User }>('/auth/me');
  return res.user;
}

export async function logout() {
  await setToken(null);
}

export async function forgotPassword(email: string) {
  // devCode is only present because this demo backend has no real email/SMS
  // provider — see backend/src/routes/auth.js for details.
  return apiRequest<{ message: string; devCode?: string }>('/auth/forgot-password', {
    method: 'POST',
    body: { email },
    auth: false,
  });
}

export async function resetPassword(email: string, code: string, newPassword: string) {
  const res = await apiRequest<AuthResponse>('/auth/reset-password', {
    method: 'POST',
    body: { email, code, newPassword },
    auth: false,
  });
  await setToken(res.token);
  return res.user;
}

export async function loginWithGoogle(idToken: string) {
  const res = await apiRequest<AuthResponse>('/auth/social', {
    method: 'POST',
    body: { provider: 'google', idToken },
    auth: false,
  });
  await setToken(res.token);
  return res.user;
}
