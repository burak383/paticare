import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { colors, fonts } from '../theme';
import { useAuth } from '../context/AuthContext';

// Shown instead of the app when a session token already exists but the user
// opted into a Face ID / fingerprint gate (see AuthContext's `locked` state).
// The token itself was never removed — this screen just withholds using it
// until biometrics confirm it's really them holding the phone.
export default function LockScreen() {
  const { unlockWithBiometrics, logout } = useAuth();
  const [unlocking, setUnlocking] = useState(false);

  const attemptUnlock = useCallback(async () => {
    setUnlocking(true);
    try {
      await unlockWithBiometrics();
    } catch (err) {
      Alert.alert('Kilit açılamadı', err instanceof Error ? err.message : 'Bilinmeyen hata.');
    } finally {
      setUnlocking(false);
    }
  }, [unlockWithBiometrics]);

  // Prompt automatically on mount so the user doesn't have to tap twice.
  useEffect(() => {
    attemptUnlock();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleUseAnotherAccount() {
    Alert.alert('Çıkış yap', 'Face ID yerine başka bir hesapla mı giriş yapmak istiyorsun?', [
      { text: 'Vazgeç', style: 'cancel' },
      { text: 'Çıkış yap', style: 'destructive', onPress: logout },
    ]);
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.content}>
        <View style={styles.iconCircle}>
          <MaterialCommunityIcons name="face-recognition" size={40} color={colors.primary} />
        </View>
        <Text style={styles.title}>PatiCare kilitli</Text>
        <Text style={styles.subtitle}>Devam etmek için Face ID ile kimliğini doğrula.</Text>

        <Pressable style={styles.unlockButton} onPress={attemptUnlock} disabled={unlocking} testID="unlock-button">
          {unlocking ? (
            <ActivityIndicator color={colors.primaryForeground} />
          ) : (
            <>
              <MaterialCommunityIcons name="face-recognition" size={19} color={colors.primaryForeground} />
              <Text style={styles.unlockText}>Face ID ile aç</Text>
            </>
          )}
        </Pressable>

        <Pressable onPress={handleUseAnotherAccount} testID="use-another-account">
          <Text style={styles.switchAccountText}>Başka bir hesapla giriş yap</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  content: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
  iconCircle: {
    width: 84,
    height: 84,
    borderRadius: 42,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.muted,
    marginBottom: 20,
  },
  title: { color: colors.foreground, fontFamily: fonts.heading, fontSize: 22, fontWeight: '800' },
  subtitle: {
    marginTop: 8,
    color: colors.mutedForeground,
    fontFamily: fonts.body,
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 20,
  },
  unlockButton: {
    marginTop: 28,
    height: 52,
    minWidth: 220,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.primary,
  },
  unlockText: { color: colors.primaryForeground, fontFamily: fonts.body, fontSize: 14, fontWeight: '800' },
  switchAccountText: {
    marginTop: 18,
    color: colors.mutedForeground,
    fontFamily: fonts.body,
    fontSize: 12,
    fontWeight: '700',
  },
});
