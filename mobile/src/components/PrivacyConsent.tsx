import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors, fonts } from '../theme';

// ⚠️ DRAFT — NOT reviewed by a lawyer. This exists so the consent checkbox
// in OnboardingScreen/ProfileScreen has real, honest content behind
// "kabul ediyorum" instead of an empty promise, but it must not be treated
// as an actual KVKK Aydınlatma Metni or relied on for real compliance before
// legal review. Whoever owns this app should have counsel review and
// replace this text before it's shown to real users whose data is actually
// being collected.
export const PRIVACY_POLICY_DRAFT = `PatiCare KVKK Aydınlatma Metni (TASLAK)

Bu metin, PatiCare'i geliştirirken onay kutusunun arkasında gerçek bir içerik olması için yazılmış bir TASLAKTIR. Bir avukat tarafından incelenip 6698 sayılı Kişisel Verilerin Korunması Kanunu'na (KVKK) uygun hale getirilmeden gerçek kullanıcılara sunulmamalıdır.

1. Veri Sorumlusu
PatiCare uygulamasını işleten geliştirici, kişisel verilerinin işlenmesi bakımından veri sorumlusudur.

2. İşlenen Kişisel Veriler
Hesap bilgilerin (e-posta, ad), evcil hayvan profillerin ve fotoğrafları, bakım/hatırlatıcı kayıtların, aşı ve sağlık kayıtların, ürün tarama geçmişin, fiyat notların, bildirim tercihlerin ve — izin verirsen — cihazının push bildirim token'ı.

3. İşleme Amaçları
Hesabını oluşturmak ve doğrulamak, evcil hayvan bakım kayıtlarını senin için saklamak, hatırlatıcı bildirimleri göndermek, uygulamayı iyileştirmek.

4. Aktarım
Verilerin, uygulamanın çalışması için zorunlu olan servis sağlayıcılar (ör. bildirim altyapısı, e-posta gönderim servisi) dışında üçüncü taraflarla paylaşılmaz ya da satılmaz.

5. Haklarin
KVKK'nın 11. maddesi kapsamında verilerinin işlenip işlenmediğini öğrenme, düzeltilmesini veya silinmesini isteme haklarına sahipsin. Profil > Gizlilik ve verilerim bölümünden hesabını ve tüm verilerini silebilirsin.

6. İletişim
Bu taslak metin gerçek bir iletişim adresi içermiyor — üretim ortamına geçmeden önce eklenmelidir.`;

export function PrivacyPolicyDraftBanner() {
  return (
    <View style={styles.draftBanner}>
      <MaterialCommunityIcons name="alert-outline" size={16} color={colors.destructive} />
      <Text style={styles.draftBannerText}>TASLAK — avukat onayı olmadan gerçek kullanıcılara sunulamaz</Text>
    </View>
  );
}

export function PrivacyConsentCheckbox({
  checked,
  onToggle,
  onOpenPolicy,
  testID,
}: {
  checked: boolean;
  onToggle: () => void;
  onOpenPolicy: () => void;
  testID?: string;
}) {
  return (
    <View style={styles.row}>
      <Pressable
        onPress={onToggle}
        hitSlop={8}
        testID={testID}
        accessibilityRole="checkbox"
        accessibilityState={{ checked }}
        accessibilityLabel="KVKK Aydınlatma Metni'ni kabul ediyorum"
      >
        <MaterialCommunityIcons
          name={checked ? 'checkbox-marked' : 'checkbox-blank-outline'}
          size={22}
          color={checked ? colors.primary : colors.mutedForeground}
        />
      </Pressable>
      <Text style={styles.consentText} onPress={onToggle}>
        <Text
          style={styles.consentLink}
          onPress={(e) => {
            e?.stopPropagation?.();
            onOpenPolicy();
          }}
        >
          KVKK Aydınlatma Metni
        </Text>
        {"'ni okudum, kabul ediyorum."}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { marginTop: 12, flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  consentText: { flex: 1, color: colors.mutedForeground, fontFamily: fonts.body, fontSize: 12, lineHeight: 18 },
  consentLink: { color: colors.primary, fontWeight: '800', textDecorationLine: 'underline' },
  draftBanner: {
    marginBottom: 14,
    padding: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.destructive,
    backgroundColor: '#FDECEC',
  },
  draftBannerText: { flex: 1, color: colors.destructive, fontFamily: fonts.body, fontSize: 11, fontWeight: '800' },
});
