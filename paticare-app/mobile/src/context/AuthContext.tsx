import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as LocalAuthentication from 'expo-local-authentication';
import { authApi, getToken, type User } from '../api';

const BIOMETRIC_KEY = 'paticare_biometric_enabled';

type AuthContextValue = {
  user: User | null;
  loading: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name?: string) => Promise<void>;
  continueAsGuest: () => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  forgotPassword: (email: string) => Promise<{ message: string; devCode?: string }>;
  resetPassword: (email: string, code: string, newPassword: string) => Promise<void>;
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

  const register = useCallback(async (email: string, password: string, name?: string) => {
    setError(null);
    try {
      const u = await authApi.register(email, password, name);
      setUser(u);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Kayıt başarısız.');
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

  const logout = useCallback(async () => {
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
      continueAsGuest,
      logout,
      refreshUser: bootstrap,
      forgotPassword,
      resetPassword,
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
      continueAsGuest,
      logout,
      bootstrap,
      forgotPassword,
      resetPassword,
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
