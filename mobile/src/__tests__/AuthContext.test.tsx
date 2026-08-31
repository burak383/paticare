import React from 'react';
import { render, act } from '@testing-library/react-native';
import { Text } from 'react-native';
import { AuthProvider, useAuth } from '../context/AuthContext';

// AuthContext is normally mocked wholesale by every screen test in this
// project (see e.g. CalendarScreen.test.tsx) — this file is the one place
// that renders the REAL provider, specifically to cover logout()'s new
// push-token cleanup (added alongside server push notifications): a signed-
// out device must stop receiving reminders meant for the account that just
// left it, and that cleanup must not block logging out locally if it fails.
const mockLogout = jest.fn();
const mockUnregisterPushToken = jest.fn();
const mockFetchCurrentUser = jest.fn();
const mockGetToken = jest.fn();
const mockGetRegisteredPushToken = jest.fn();

jest.mock('../api', () => ({
  authApi: {
    logout: (...args: unknown[]) => mockLogout(...args),
    fetchCurrentUser: (...args: unknown[]) => mockFetchCurrentUser(...args),
  },
  usersApi: {
    unregisterPushToken: (...args: unknown[]) => mockUnregisterPushToken(...args),
  },
  getToken: (...args: unknown[]) => mockGetToken(...args),
}));

// Only this device's own registered token should be unregistered (never a
// blanket "clear everything") — see notifications.ts's getRegisteredPushToken()
// and routes/users.js's push-token routes for why: a second device signed
// into the same account must keep receiving reminders after this one logs out.
jest.mock('../notifications', () => ({
  getRegisteredPushToken: (...args: unknown[]) => mockGetRegisteredPushToken(...args),
}));

jest.mock('expo-local-authentication', () => ({
  hasHardwareAsync: jest.fn().mockResolvedValue(false),
  isEnrolledAsync: jest.fn().mockResolvedValue(false),
  authenticateAsync: jest.fn(),
}));

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn().mockResolvedValue(null),
  setItem: jest.fn().mockResolvedValue(undefined),
  removeItem: jest.fn().mockResolvedValue(undefined),
}));

let logoutFn: (() => Promise<void>) | null = null;
function Consumer() {
  const { logout, user, loading } = useAuth();
  logoutFn = logout;
  if (loading) return null;
  return <Text>{user ? 'logged-in' : 'logged-out'}</Text>;
}

describe('AuthContext — logout() unregisters the device push token', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetToken.mockResolvedValue('existing-token');
    mockFetchCurrentUser.mockResolvedValue({ id: 'user-1', guest: false, preferences: {} });
    mockLogout.mockResolvedValue(undefined);
    mockUnregisterPushToken.mockResolvedValue(undefined);
    mockGetRegisteredPushToken.mockReturnValue('ExponentPushToken[this-device]');
  });

  it('calls usersApi.unregisterPushToken with this device’s own token before clearing the local session', async () => {
    const { findByText } = await render(
      <AuthProvider>
        <Consumer />
      </AuthProvider>,
    );
    await findByText('logged-in');

    await act(async () => {
      await logoutFn!();
    });

    expect(mockUnregisterPushToken).toHaveBeenCalledWith('ExponentPushToken[this-device]');
    expect(mockLogout).toHaveBeenCalledTimes(1);
    await findByText('logged-out');
  });

  it('still logs out locally even if unregistering the push token fails (e.g. offline)', async () => {
    mockUnregisterPushToken.mockRejectedValue(new Error('network error'));
    const { findByText } = await render(
      <AuthProvider>
        <Consumer />
      </AuthProvider>,
    );
    await findByText('logged-in');

    await act(async () => {
      await logoutFn!();
    });

    expect(mockLogout).toHaveBeenCalledTimes(1);
    await findByText('logged-out');
  });

  it('skips unregisterPushToken entirely when this session never registered a token (e.g. permission was denied)', async () => {
    mockGetRegisteredPushToken.mockReturnValue(null);
    const { findByText } = await render(
      <AuthProvider>
        <Consumer />
      </AuthProvider>,
    );
    await findByText('logged-in');

    await act(async () => {
      await logoutFn!();
    });

    expect(mockUnregisterPushToken).not.toHaveBeenCalled();
    expect(mockLogout).toHaveBeenCalledTimes(1);
    await findByText('logged-out');
  });
});
