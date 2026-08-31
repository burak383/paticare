import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as LocalAuthentication from 'expo-local-authentication';
import { authApi, usersApi, getToken, type User } from '../api';
import { getRegisteredPushToken } from '../notifications';

const BIOMETRIC_KEY = 'paticare_biometric_enabled';

type AuthContextValue = {
  user: User | null;
  loading: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<void>;
  // privacyAccepted must be true — the backend rejects account creation
  // otherwise. The UI (OnboardingScreen's checkbox) is expected to enforce
  // this BEFORE calling register(), so a false/omitted value here should
  // only ever happen if that gate was bypassed.
  register: (email: string, password: string, name: string | undefined, privacyAccepted: boolean) => Promise<void>;
  // Attaches real credentials to the CURRENT guest account (same id, same
  // data) instead of creating a separate account — see api/auth.ts. Also
  // requires privacyAccepted: true, for the same reason as register() above
  // — this is the moment a guest becomes a real, identifiable account.
  upgradeGuestAccount: (email: string, password: string, name: string | undefined, privacyAccepted: boolean) => Promise<void>;
  continueAsGuest: () => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  // Lightweight alternative to refreshUser(): patches the in-memory user
  // (e.g. after a PatiCare Plus trial start/cancel) without re-running the
  // token/biometric bootstrap, so it can't accidentally kick the user to the
  // Face ID lock screen mid-flow.
  updateUser: (user: User) => void;
  forgotPassword: (email: string) => Promise<{ message: string; devCode?: string }>;
  resetPassword: (email: string, code: string, newPassword: string) => Promise<void>;
  // While-logged-in password change (needs the current password) — distinct
  // from forgotPassword/resetPassword, which are for someone locked out.
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>;
  loginWithGoogle: (idToken: string) => Promise<void>;
  // Face ID / fingerprint quick-unlock. `locked` is true when a session token
  // already exists but biometric confirmation is required before it's used —
  // unlockWithBiometrics() clears it.
  biometricSupported: boolean;
  biometricEnabled: boolean;
  locked: boolean;
  setBiometricEnabled: (enabled: boolean) => Promise<void>;
  unlockWithBiometrics: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [biometricSupported, setBiometricSupportedState] = useState(false);
  const [biometricEnabled, setBiometricEnabledState] = useState(false);
  const [locked, setLocked] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const hasHardware = await LocalAuthentication.hasHardwareAsync();
        const isEnrolled = await LocalAuthentication.isEnrolledAsync();
        setBiometricSupportedState(hasHardware && isEnrolled);
      } catch {
        // Biometric APIs are unavailable (e.g. simulator/web) — degrade quietly.
        setBiometricSupportedState(false);
      }
    })();
  }, []);

  const bootstrap = useCallback(async () => {
    setLoading(true);
    try {
      const token = await getToken();
      if (!token) {
        setUser(null);
        return;
      }
      const enabled = (await AsyncStorage.getItem(BIOMETRIC_KEY)) === 'true';
      setBiometricEnabledState(enabled);
      if (enabled) {
        // A session exists but the user opted into a biometric gate — hold off
        // on restoring it until unlockWithBiometrics() confirms their identity.
        setLocked(true);
        return;
      }
      const me = await authApi.fetchCurrentUser();
      setUser(me);
    } catch (err) {
      // Stored token is invalid/expired — treat as logged out rather than crashing.
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    bootstrap();
  }, [bootstrap]);

  // bootstrap() only re-arms the Face ID gate on a cold app launch. Without
  // this, a user who enables "Face ID ile giriş", then just switches apps or
  // locks/unlocks their phone (not a full app restart), would come straight
  // back to whatever screen they were on — the lock the feature is supposed
  // to provide never fires again until the process is killed and relaunched.
  // Re-arm it the moment the app leaves the foreground instead.
  const appStateRef = useRef(AppState.currentState);
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState: AppStateStatus) => {
      if (appStateRef.current === 'active' && nextState === 'background' && biometricEnabled && user) {
        setLocked(true);
      }
      appStateRef.current = nextState;
    });
    return () => subscription.remove();
  }, [biometricEnabled, user]);

  const login = useCallback(async (email: string, password: string) => {
    setError(null);
    try {
      const u = await authApi.login(email, password);
      setUser(u);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Giriş başarısız.');
      throw err;
    }
  }, []);

  const register = useCallback(async (email: string, password: string, name: string | undefined, privacyAccepted: boolean) => {
    setError(null);
    try {
      const u = await authApi.register(email, password, name, privacyAccepted);
      setUser(u);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Kayıt başarısız.');
      throw err;
    }
  }, []);

  const upgradeGuestAccount = useCallback(async (email: string, password: string, name: string | undefined, privacyAccepted: boolean) => {
    setError(null);
    try {
      const u = await authApi.upgradeGuestAccount(email, password, name, privacyAccepted);
      setUser(u);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Hesap oluşturulamadı.');
      throw err;
    }
  }, []);

  const continueAsGuest = useCallback(async () => {
    setError(null);
    try {
      const u = await authApi.continueAsGuest();
      setUser(u);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Misafir girişi başarısız.');
      throw err;
    }
  }, []);

  const forgotPassword = useCallback(async (email: string) => {
    setError(null);
    try {
      return await authApi.forgotPassword(email);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sıfırlama kodu gönderilemedi.');
      throw err;
    }
  }, []);

  const resetPassword = useCallback(async (email: string, code: string, newPassword: string) => {
    setError(null);
    try {
      const u = await authApi.resetPassword(email, code, newPassword);
      setUser(u);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Şifre sıfırlanamadı.');
      throw err;
    }
  }, []);

  const changePassword = useCallback(async (currentPassword: string, newPassword: string) => {
    setError(null);
    try {
      const u = await authApi.changePassword(currentPassword, newPassword);
      setUser(u);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Şifre değiştirilemedi.');
      throw err;
    }
  }, []);

  const loginWithGoogle = useCallback(async (idToken: string) => {
    setError(null);
    try {
      const u = await authApi.loginWithGoogle(idToken);
      setUser(u);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Google girişi başarısız.');
      throw err;
    }
  }, []);

  const updateUser = useCallback((u: User) => {
    setUser(u);
  }, []);

  const logout = useCallback(async () => {
    // Best-effort, and BEFORE authApi.logout() clears the session token —
    // this call needs it to identify whose account to remove the token from.
    // A failure here (offline, server down) shouldn't block logging out
    // locally. Only unregisters THIS device's own token (skipped entirely if
    // this session never registered one — e.g. permission was denied) so a
    // second device still signed into the same account keeps its reminders;
    // see notifications.ts's getRegisteredPushToken().
    const pushToken = getRegisteredPushToken();
    if (pushToken) await usersApi.unregisterPushToken(pushToken).catch(() => {});
    await authApi.logout();
    setUser(null);
    setLocked(false);
  }, []);

  const setBiometricEnabled = useCallback(async (enabled: boolean) => {
    await AsyncStorage.setItem(BIOMETRIC_KEY, enabled ? 'true' : 'false');
    setBiometricEnabledState(enabled);
  }, []);

  const unlockWithBiometrics = useCallback(async () => {
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: "PatiCare'ye giriş yap",
      cancelLabel: 'Vazgeç',
      disableDeviceFallback: false,
    });
    if (!result.success) {
      throw new Error('Kimlik doğrulama başarısız veya iptal edildi.');
    }
    const me = await authApi.fetchCurrentUser();
    setUser(me);
    setLocked(false);
  }, []);

  const value = useMemo(
    () => ({
      user,
      loading,
      error,
      login,
      register,
      upgradeGuestAccount,
      continueAsGuest,
      logout,
      refreshUser: bootstrap,
      updateUser,
      forgotPassword,
      resetPassword,
      changePassword,
      loginWithGoogle,
      biometricSupported,
      biometricEnabled,
      locked,
      setBiometricEnabled,
      unlockWithBiometrics,
    }),
    [
      user,
      loading,
      error,
      login,
      register,
      upgradeGuestAccount,
      continueAsGuest,
      logout,
      bootstrap,
      updateUser,
      forgotPassword,
      resetPassword,
      changePassword,
      loginWithGoogle,
      biometricSupported,
      biometricEnabled,
      locked,
      setBiometricEnabled,
      unlockWithBiometrics,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
