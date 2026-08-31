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

// privacyAccepted must be true — see backend/src/routes/auth.js's /register,
// which rejects the request otherwise. OnboardingScreen's consent checkbox
// is what should keep a false value from ever reaching here in practice.
export async function register(email: string, password: string, name: string | undefined, privacyAccepted: boolean) {
  const res = await apiRequest<AuthResponse>('/auth/register', {
    method: 'POST',
    body: { email, password, name, privacyAccepted },
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

// Turns the CURRENT (guest) session into a real, password-protected account
// in place — same user id, same pets/reminders/health records — instead of
// logging out and registering separately, which creates a brand-new empty
// account and abandons everything the guest built up. Also requires
// privacyAccepted: true, same as register() — this is the moment a guest
// becomes a real, identifiable account.
export async function upgradeGuestAccount(email: string, password: string, name: string | undefined, privacyAccepted: boolean) {
  const res = await apiRequest<AuthResponse>('/auth/upgrade', {
    method: 'POST',
    body: { email, password, name, privacyAccepted },
  });
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

// While-logged-in password change — distinct from forgot-password/reset-password
// (which are for someone locked out with no session). Requires the current
// password, not just the session token.
export async function changePassword(currentPassword: string, newPassword: string) {
  const res = await apiRequest<{ user: User }>('/auth/change-password', {
    method: 'POST',
    body: { currentPassword, newPassword },
  });
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
