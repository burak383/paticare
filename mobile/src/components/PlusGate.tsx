import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { colors, fonts, radius } from '../theme';

// Kullanıcı `subscription.ts`'in hasPlusAccess()'ine göre Plus erişimine
// sahip değilse (deneme/gerçek abonelik yok ya da süresi dolmuş) her ana
// sekmenin (Ana Sayfa/Takvim/Tara/Karnem) TÜM içeriğinin yerine bu ekran
// gösteriliyor — alt sekme çubuğu (BottomNav, Tab.Navigator tarafından
// render ediliyor) görünür kalıyor, yalnızca ekran içeriği kilitleniyor.
// Profil sekmesi ve bu ekranın yönlendirdiği PatiCarePlus ekranı bilerek
// kilitlenmiyor — aksi halde kullanıcı abone olacağı yere hiç ulaşamazdı.
export default function PlusGate({
  onUpgrade,
  title = "Bu özellik PatiCare Plus'a özel",
  description = "Devam etmek için PatiCare Plus'a geç. 7 gün ücretsiz dene, istediğin zaman iptal et.",
  testID = 'plus-gate',
}: {
  onUpgrade: () => void;
  title?: string;
  description?: string;
  testID?: string;
}) {
  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.content} testID={testID}>
        <View style={styles.iconCircle}>
          <Feather name="lock" size={28} color={colors.primary} />
        </View>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.description}>{description}</Text>
        <Pressable style={styles.button} onPress={onUpgrade} testID="plus-gate-upgrade-button">
          <Feather name="zap" size={17} color={colors.primaryForeground} />
          <Text style={styles.buttonText}>PatiCare Plus'a geç</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  content: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.muted,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  title: {
    color: colors.foreground,
    fontFamily: fonts.heading,
    fontSize: 20,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 8,
  },
  description: {
    color: colors.mutedForeground,
    fontFamily: fonts.body,
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center',
    marginBottom: 24,
    maxWidth: 300,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.primary,
    borderRadius: radius,
    height: 50,
    paddingHorizontal: 24,
  },
  buttonText: { color: colors.primaryForeground, fontFamily: fonts.body, fontSize: 15, fontWeight: '800' },
});
