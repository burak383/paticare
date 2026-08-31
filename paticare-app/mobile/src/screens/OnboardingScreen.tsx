import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';
import { colors, fonts } from '../theme';
import { useAuth } from '../context/AuthContext';
import { usePets } from '../context/PetContext';
import { pickAndPreparePetPhoto } from '../media';

// Required once per app so the OAuth browser tab closes itself and hands
// control back to the app after Google redirects with the result.
WebBrowser.maybeCompleteAuthSession();

// Real Google sign-in needs an OAuth client registered in Google Cloud
// Console — that's tied to a specific developer account and can't be
// fabricated here. Set EXPO_PUBLIC_GOOGLE_CLIENT_ID (and the backend's
// GOOGLE_CLIENT_ID, which must match) to turn this on; until then the button
// tells the user clearly why it can't proceed instead of failing silently.
const GOOGLE_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID;

const heroImage =
  'https://fwtngjyirchhhysukjxi.supabase.co/storage/v1/object/public/project-images/bdc175db-7851-4139-9f11-a3216057da08/e2cbc572-9106-406f-8bdf-df1040e1b205.png';
const aresImage =
  'https://fwtngjyirchhhysukjxi.supabase.co/storage/v1/object/public/project-images/bdc175db-7851-4139-9f11-a3216057da08/de8f1f77-c720-4a7e-b838-ab2cc1bf2902.png';

type IconName = React.ComponentProps<typeof MaterialCommunityIcons>['name'];

function Icon({ name, size = 20, color = colors.foreground }: { name: IconName; size?: number; color?: string }) {
  return <MaterialCommunityIcons name={name} size={size} color={color} />;
}

function RoundedButton({
  children,
  style,
  onPress,
  disabled,
  testID,
}: {
  children: React.ReactNode;
  style?: object;
  onPress?: () => void;
  disabled?: boolean;
  testID?: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      testID={testID}
      style={({ pressed }) => [styles.roundedButton, style, (pressed || disabled) && { opacity: 0.7 }]}
    >
      {children}
    </Pressable>
  );
}

function FeatureCard({
  icon,
  title,
  description,
  iconBackground,
  iconColor,
}: {
  icon: IconName;
  title: string;
  description: string;
  iconBackground: string;
  iconColor: string;
}) {
  return (
    <View style={styles.featureCard}>
      <View style={[styles.featureIcon, { backgroundColor: iconBackground }]}>
        <Icon name={icon} size={20} color={iconColor} />
      </View>
      <Text style={[styles.featureTitle, { color: iconColor }]}>{title}</Text>
      <Text style={styles.featureDescription}>{description}</Text>
    </View>
  );
}

function DetailField({
  label,
  value,
  onChangeText,
  suffix,
  keyboardType,
}: {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  suffix?: string;
  keyboardType?: 'default' | 'numeric';
}) {
  return (
    <View style={styles.detailField}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View style={styles.fieldValue}>
        <TextInput
          style={styles.fieldText}
          value={value}
          onChangeText={onChangeText}
          placeholder="—"
          placeholderTextColor={colors.mutedForeground}
          keyboardType={keyboardType}
        />
        {suffix ? <Text style={styles.fieldSuffix}>{suffix}</Text> : null}
      </View>
    </View>
  );
}

const SPECIES_OPTIONS: { key: string; icon: IconName; label: string }[] = [
  { key: 'Kedi', icon: 'cat', label: 'Kedi' },
  { key: 'Köpek', icon: 'dog', label: 'Köpek' },
  { key: 'Kuş', icon: 'bird', label: 'Kuş' },
  { key: 'Diğer', icon: 'dots-horizontal', label: 'Diğer' },
];

export default function OnboardingScreen() {
  const {
    user,
    login,
    register,
    continueAsGuest,
    error: authError,
    forgotPassword,
    resetPassword,
    loginWithGoogle,
    biometricSupported,
    setBiometricEnabled,
  } = useAuth();
  const { addPet } = usePets();

  const [showEmailForm, setShowEmailForm] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('register');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authBusy, setAuthBusy] = useState(false);

  const [forgotVisible, setForgotVisible] = useState(false);
  const [forgotStep, setForgotStep] = useState<'email' | 'reset'>('email');
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotDevCode, setForgotDevCode] = useState<string | null>(null);
  const [resetCode, setResetCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [forgotBusy, setForgotBusy] = useState(false);

  const [googleRequest, googleResponse, promptGoogleAsync] = Google.useIdTokenAuthRequest({
    clientId: GOOGLE_CLIENT_ID || 'not-configured',
  });

  const [petName, setPetName] = useState('Ares');
  const [species, setSpecies] = useState('Kedi');
  const [breed, setBreed] = useState('European Shorthair');
  const [birthDate, setBirthDate] = useState('14 Mayıs 2023');
  const [weight, setWeight] = useState('4,0');
  const [gender, setGender] = useState('Erkek');
  const [neutered, setNeutered] = useState(true);
  const [creating, setCreating] = useState(false);
  const [petAvatarUri, setPetAvatarUri] = useState<string | null>(null);
  const [pickingPhoto, setPickingPhoto] = useState(false);

  // After a real (non-guest) sign-in, offer to gate future launches behind
  // Face ID — only once, and only on hardware that actually supports it.
  function maybeOfferBiometrics() {
    if (!biometricSupported) return;
    Alert.alert(
      'Face ID ile hızlı giriş',
      'Bir dahaki sefere PatiCare\'yi Face ID ile açmak ister misin?',
      [
        { text: 'Hayır, teşekkürler', style: 'cancel' },
        { text: 'Etkinleştir', onPress: () => setBiometricEnabled(true) },
      ],
    );
  }

  async function handleAuthSubmit() {
    if (!email.trim() || !password) {
      Alert.alert('Eksik bilgi', 'E-posta ve şifre gerekli.');
      return;
    }
    setAuthBusy(true);
    try {
      if (authMode === 'register') {
        await register(email.trim(), password);
      } else {
        await login(email.trim(), password);
      }
      // RootNavigator swaps to MainTabs automatically once `user` is set.
      maybeOfferBiometrics();
    } catch (err) {
      Alert.alert('Giriş başarısız', err instanceof Error ? err.message : 'Bilinmeyen hata.');
    } finally {
      setAuthBusy(false);
    }
  }

  async function handleSocialPress(provider: string) {
    Alert.alert(
      'Yakında',
      `${provider} ile giriş şu anda demo backend'de desteklenmiyor. Şimdilik e-posta ya da misafir modunu kullanabilirsin.`,
    );
  }

  async function handleGooglePress() {
    if (!GOOGLE_CLIENT_ID) {
      Alert.alert(
        'Google girişi yapılandırılmadı',
        'Bunun çalışması için Google Cloud Console\'da bir OAuth istemcisi oluşturup EXPO_PUBLIC_GOOGLE_CLIENT_ID (mobil) ve GOOGLE_CLIENT_ID (backend/.env) değerlerini eşleşecek şekilde ayarlaman gerekiyor.',
      );
      return;
    }
    try {
      await promptGoogleAsync();
    } catch (err) {
      Alert.alert('Google girişi başarısız', err instanceof Error ? err.message : 'Bilinmeyen hata.');
    }
  }

  useEffect(() => {
    if (googleResponse?.type === 'success' && googleResponse.params.id_token) {
      setAuthBusy(true);
      loginWithGoogle(googleResponse.params.id_token)
        .then(() => maybeOfferBiometrics())
        .catch((err) => Alert.alert('Google girişi başarısız', err instanceof Error ? err.message : 'Bilinmeyen hata.'))
        .finally(() => setAuthBusy(false));
    } else if (googleResponse?.type === 'error') {
      Alert.alert('Google girişi başarısız', googleResponse.error?.message ?? 'Bilinmeyen hata.');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [googleResponse]);

  async function handleForgotPasswordRequest() {
    if (!forgotEmail.trim()) {
      Alert.alert('E-posta gerekli');
      return;
    }
    setForgotBusy(true);
    try {
      const res = await forgotPassword(forgotEmail.trim());
      setForgotDevCode(res.devCode ?? null);
      setForgotStep('reset');
    } catch (err) {
      Alert.alert('Hata', err instanceof Error ? err.message : 'Kod gönderilemedi.');
    } finally {
      setForgotBusy(false);
    }
  }

  async function handleResetPasswordSubmit() {
    if (!resetCode.trim() || !newPassword) {
      Alert.alert('Eksik bilgi', 'Kod ve yeni şifre gerekli.');
      return;
    }
    setForgotBusy(true);
    try {
      await resetPassword(forgotEmail.trim(), resetCode.trim(), newPassword);
      setForgotVisible(false);
      setForgotStep('email');
      setForgotEmail('');
      setForgotDevCode(null);
      setResetCode('');
      setNewPassword('');
      // RootNavigator swaps to MainTabs automatically once `user` is set.
    } catch (err) {
      Alert.alert('Hata', err instanceof Error ? err.message : 'Şifre sıfırlanamadı.');
    } finally {
      setForgotBusy(false);
    }
  }

  function closeForgotModal() {
    setForgotVisible(false);
    setForgotStep('email');
    setForgotDevCode(null);
    setResetCode('');
    setNewPassword('');
  }

  async function handleGuestPress() {
    setAuthBusy(true);
    try {
      await continueAsGuest();
    } catch (err) {
      Alert.alert('Hata', err instanceof Error ? err.message : 'Misafir girişi başarısız.');
    } finally {
      setAuthBusy(false);
    }
  }

  async function handlePickPortrait() {
    setPickingPhoto(true);
    try {
      const uri = await pickAndPreparePetPhoto();
      if (uri) setPetAvatarUri(uri);
    } catch (err) {
      Alert.alert('Fotoğraf eklenemedi', err instanceof Error ? err.message : 'Bilinmeyen hata.');
    } finally {
      setPickingPhoto(false);
    }
  }

  async function handleCreateCareFile() {
    if (!petName.trim()) {
      Alert.alert('İsim gerekli', `${species} dostunun adını girer misin?`);
      return;
    }
    setCreating(true);
    try {
      if (!user) {
        // No session yet (user skipped the auth buttons entirely) — start as guest
        // so the pet record has an owner. If they already logged in/registered or
        // continued as guest above, `user` is already set and we keep that session.
        await continueAsGuest();
      }
      const numericWeight = Number(weight.replace(',', '.'));
      await addPet({
        name: petName.trim(),
        species,
        breed: breed.trim() || null,
        birthDate: birthDate.trim() || null,
        weightKg: Number.isFinite(numericWeight) ? numericWeight : null,
        gender: gender.trim() || null,
        neutered,
        // Falls back to the onboarding illustration only if the user skipped
        // adding a real photo — "Portre ekle" below sets petAvatarUri.
        avatarUrl: petAvatarUri ?? aresImage,
      });
      // Successful creation + an authenticated session moves us into MainTabs.
    } catch (err) {
      Alert.alert('Bir şeyler ters gitti', err instanceof Error ? err.message : 'Bakım dosyası oluşturulamadı.');
    } finally {
      setCreating(false);
    }
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <View style={{ width: 40 }} />
          <View style={styles.brand}>
            <View style={styles.brandMark}>
              <Icon name="paw" size={18} color={colors.primaryForeground} />
            </View>
            <Text style={styles.brandName}>PatiCare</Text>
          </View>
          <Pressable style={styles.skipButton} onPress={handleGuestPress} disabled={authBusy}>
            <Text style={styles.skipText}>Atla</Text>
          </Pressable>
        </View>

        <View style={styles.heroSection}>
          <View style={styles.titleRow}>
            <View style={styles.titleCopy}>
              <Text style={styles.eyebrow}>SENİN BAKIM ASİSTANIN</Text>
              <Text style={styles.heroTitle}>Her pati için daha güvenli bakım.</Text>
            </View>
            <Text style={styles.stepText}>1 / 3</Text>
          </View>

          <View style={styles.heroCard}>
            <Image source={{ uri: heroImage }} style={styles.heroImage} />
            <View style={styles.heroOverlay}>
              <View style={styles.heroLabelRow}>
                <View style={styles.heroLabelIcon}>
                  <Icon name="line-scan" size={18} color={colors.primary} />
                </View>
                <Text style={styles.heroLabel}>AI İLE ÜRÜN TARA</Text>
              </View>
              <Text style={styles.heroDescription}>
                Bir ürünün içeriğini saniyeler içinde anlayın, dostun için doğru kararı verin.
              </Text>
            </View>
          </View>

          <View style={styles.pagination}>
            <View style={styles.activeDot} />
            <View style={styles.dot} />
            <View style={styles.dot} />
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.features}>
            <FeatureCard
              icon="calendar-heart"
              title="Aşı ve ilaç takvimini unutma"
              description="Her hayvanın zamanı geldiğinde sakin bir hatırlatma al."
              iconBackground={colors.secondary}
              iconColor={colors.secondaryForeground}
            />
            <FeatureCard
              icon="shield-alert-outline"
              title="Aşırı doz riskini önle"
              description="Etkileşimleri kontrol edin, doz kararlarını güvenle verin."
              iconBackground={colors.muted}
              iconColor={colors.primary}
            />
          </ScrollView>
        </View>

        <View style={styles.card}>
          <View style={styles.accountHeader}>
            <View style={styles.accountCopy}>
              <Text style={styles.mutedEyebrow}>BAŞLAMAK İÇİN</Text>
              <Text style={styles.sectionTitle}>Önce hesabını oluşturalım</Text>
              <Text style={styles.supportingText}>
                Bakım kayıtların tüm cihazlarında güvende, evcil hayvanlarına özel.
              </Text>
            </View>
            <View style={styles.circleIcon}>
              <Icon name="lock-outline" size={19} color={colors.primary} />
            </View>
          </View>

          {showEmailForm ? (
            <View style={styles.authButtons}>
              <View style={styles.emailFormToggle}>
                <Pressable onPress={() => setAuthMode('register')} style={[styles.modeChip, authMode === 'register' && styles.modeChipActive]}>
                  <Text style={[styles.modeChipText, authMode === 'register' && styles.modeChipTextActive]}>Hesap oluştur</Text>
                </Pressable>
                <Pressable onPress={() => setAuthMode('login')} style={[styles.modeChip, authMode === 'login' && styles.modeChipActive]}>
                  <Text style={[styles.modeChipText, authMode === 'login' && styles.modeChipTextActive]}>Giriş yap</Text>
                </Pressable>
              </View>
              <TextInput
                style={styles.textInput}
                placeholder="E-posta"
                placeholderTextColor={colors.mutedForeground}
                autoCapitalize="none"
                keyboardType="email-address"
                value={email}
                onChangeText={setEmail}
              />
              <TextInput
                style={styles.textInput}
                placeholder="Şifre"
                placeholderTextColor={colors.mutedForeground}
                secureTextEntry
                value={password}
                onChangeText={setPassword}
              />
              {authError ? <Text style={styles.authErrorText}>{authError}</Text> : null}
              <RoundedButton style={styles.primaryButton} onPress={handleAuthSubmit} disabled={authBusy} testID="auth-submit-button">
                {authBusy ? (
                  <ActivityIndicator color={colors.primaryForeground} />
                ) : (
                  <Text style={styles.primaryButtonText}>
                    {authMode === 'register' ? 'Hesap oluştur' : 'Giriş yap'}
                  </Text>
                )}
              </RoundedButton>
              {authMode === 'login' ? (
                <Pressable
                  style={styles.forgotPasswordButton}
                  onPress={() => {
                    setForgotEmail(email);
                    setForgotVisible(true);
                  }}
                  testID="forgot-password-link"
                >
                  <Text style={styles.forgotPasswordText}>Şifremi unuttum</Text>
                </Pressable>
              ) : null}
            </View>
          ) : (
            <View style={styles.authButtons}>
              <RoundedButton style={styles.primaryButton} onPress={() => setShowEmailForm(true)}>
                <Icon name="email-outline" size={19} color={colors.primaryForeground} />
                <Text style={styles.primaryButtonText}>E-posta ile devam et</Text>
              </RoundedButton>

              <RoundedButton style={styles.outlineButton} onPress={handleGooglePress} disabled={authBusy || !googleRequest} testID="google-signin-button">
                <Icon name="google" size={17} color={colors.foreground} />
                <Text style={styles.outlineButtonText}>Google ile devam et</Text>
              </RoundedButton>

              <RoundedButton style={styles.outlineButton} onPress={() => handleSocialPress('Apple')}>
                <Icon name="apple" size={18} color={colors.foreground} />
                <Text style={styles.outlineButtonText}>Apple ile devam et</Text>
              </RoundedButton>
            </View>
          )}

          <RoundedButton style={styles.guestButton} onPress={handleGuestPress} disabled={authBusy}>
            <Icon name="cellphone" size={17} color={colors.mutedForeground} />
            <Text style={styles.guestText}>Misafir olarak devam et</Text>
          </RoundedButton>

          <View style={styles.infoBox}>
            <Icon name="information-outline" size={16} color={colors.secondaryForeground} />
            <Text style={styles.infoText}>
              Misafir modunda kayıtların yalnızca bu cihazda tutulur. Daha sonra istediğin zaman hesap
              oluşturabilirsin.
            </Text>
          </View>
        </View>

        <View style={styles.profileCard}>
          <View style={styles.profileHeader}>
            <View>
              <Text style={styles.profileEyebrow}>İLK BAKIM DOSYASI</Text>
              <Text style={styles.sectionTitle}>Dostunu tanıyalım</Text>
            </View>
            <View style={styles.counter}>
              <Text style={styles.counterText}>2 / 3</Text>
            </View>
          </View>

          <View style={styles.petSummary}>
            <Pressable style={styles.petImageWrap} onPress={handlePickPortrait} testID="onboarding-portrait-preview">
              <Image source={{ uri: petAvatarUri ?? aresImage }} style={styles.petImage} />
            </Pressable>
            <View style={styles.petCopy}>
              <TextInput
                style={styles.petNameInput}
                value={petName}
                onChangeText={setPetName}
                placeholder="İsim"
                placeholderTextColor={colors.mutedForeground}
              />
              <Text style={styles.petDescription}>Bakım bilgileri yalnızca {petName || 'dostuna'} aittir</Text>
            </View>
            {petName.trim() ? <Icon name="check-circle" size={21} color={colors.success} /> : null}
          </View>

          <Text style={styles.selectionLabel}>Türünü seç</Text>
          <View style={styles.speciesGrid}>
            {SPECIES_OPTIONS.map((option) => {
              const selected = species === option.key;
              return (
                <Pressable
                  key={option.key}
                  style={[styles.speciesButton, selected && styles.selectedSpecies]}
                  onPress={() => setSpecies(option.key)}
                >
                  <Icon name={option.icon} size={21} color={selected ? colors.primary : colors.mutedForeground} />
                  <Text style={[styles.speciesText, { color: selected ? colors.primary : colors.mutedForeground }]}>
                    {option.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <View style={styles.fieldsGrid}>
            <DetailField label="Irk" value={breed} onChangeText={setBreed} />
            <DetailField label="Doğum tarihi" value={birthDate} onChangeText={setBirthDate} />
            <DetailField label="Kilo" value={weight} onChangeText={setWeight} suffix="kg" keyboardType="numeric" />
            <DetailField label="Cinsiyet" value={gender} onChangeText={setGender} />
          </View>

          <View style={styles.neuteredRow}>
            <View>
              <Text style={styles.neuteredTitle}>Kısırlaştırıldı</Text>
              <Text style={styles.neuteredDescription}>İlaç önerilerini kişiselleştirir</Text>
            </View>
            <Switch
              value={neutered}
              onValueChange={setNeutered}
              trackColor={{ false: colors.border, true: colors.primary }}
              thumbColor={colors.primaryForeground}
            />
          </View>

          <Pressable style={styles.portraitButton} onPress={handlePickPortrait} disabled={pickingPhoto} testID="onboarding-pick-portrait">
            <View style={styles.smallCircleIcon}>
              {pickingPhoto ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                <Icon name={petAvatarUri ? 'check' : 'camera-outline'} size={18} color={petAvatarUri ? colors.success : colors.primary} />
              )}
            </View>
            <View style={styles.portraitCopy}>
              <Text style={styles.portraitTitle}>{petAvatarUri ? 'Portre eklendi' : 'Portre ekle'}</Text>
              <Text style={styles.portraitDescription}>
                {petAvatarUri ? 'Değiştirmek için tekrar dokun' : 'İsteğe bağlı · dostunu daha kolay tanı'}
              </Text>
            </View>
            <Icon name={petAvatarUri ? 'pencil-outline' : 'plus'} size={19} color={colors.mutedForeground} />
          </Pressable>
        </View>

        <View style={styles.card}>
          <View style={styles.readyHeader}>
            <View style={styles.readyIcon}>
              <Icon name="clipboard-check-outline" size={21} color={colors.secondaryForeground} />
            </View>
            <View style={styles.readyCopy}>
              <Text style={styles.readyTitle}>{petName || 'Dostunun'} dosyası hazırlanıyor</Text>
              <Text style={styles.supportingText}>
                Dosyayı oluşturduktan sonra ilk hatırlatıcılarını Takvim sekmesinden ekleyebilirsin.
              </Text>
            </View>
          </View>
          <Text style={styles.bottomNote}>
            Diğer evcil hayvanlarını Profil sekmesindeki &quot;Yeni evcil hayvan ekle&quot; ile ekleyebilirsin.
          </Text>
        </View>
      </ScrollView>

      <View style={styles.bottomBar}>
        <RoundedButton style={styles.createButton} onPress={handleCreateCareFile} disabled={creating} testID="create-care-file-button">
          {creating ? (
            <ActivityIndicator color={colors.primaryForeground} />
          ) : (
            <>
              <Text style={styles.createButtonText}>{petName || 'Dostunun'} bakım dosyasını oluştur</Text>
              <Icon name="arrow-right" size={19} color={colors.primaryForeground} />
            </>
          )}
        </RoundedButton>
        <Text style={styles.nextStep}>Sonraki adımda Ana Sayfa&apos;ya geçeceksin</Text>
      </View>

      <Modal visible={forgotVisible} transparent animationType="slide" onRequestClose={closeForgotModal}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            {forgotStep === 'email' ? (
              <>
                <Text style={styles.modalTitle}>Şifremi unuttum</Text>
                <Text style={styles.modalSubtitle}>Hesabına kayıtlı e-postayı gir, sana bir sıfırlama kodu oluşturalım.</Text>
                <Text style={styles.modalLabel}>E-posta</Text>
                <TextInput
                  style={styles.modalInput}
                  value={forgotEmail}
                  onChangeText={setForgotEmail}
                  placeholder="ornek@eposta.com"
                  placeholderTextColor={colors.mutedForeground}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  testID="forgot-email-input"
                />
                <View style={styles.modalActions}>
                  <Pressable style={styles.modalCancel} onPress={closeForgotModal}>
                    <Text style={styles.modalCancelText}>Vazgeç</Text>
                  </Pressable>
                  <Pressable style={styles.modalSubmit} onPress={handleForgotPasswordRequest} disabled={forgotBusy} testID="forgot-email-submit">
                    {forgotBusy ? <ActivityIndicator color={colors.primaryForeground} /> : <Text style={styles.modalSubmitText}>Kod gönder</Text>}
                  </Pressable>
                </View>
              </>
            ) : (
              <>
                <Text style={styles.modalTitle}>Kodu gir, şifreni değiştir</Text>
                <Text style={styles.modalSubtitle}>{forgotEmail} adresine ait sıfırlama kodu.</Text>
                {forgotDevCode ? (
                  <View style={styles.devCodeBox}>
                    <Text style={styles.devCodeLabel}>DEMO MODU · normalde e-posta ile gönderilir</Text>
                    <Text style={styles.devCodeValue}>{forgotDevCode}</Text>
                  </View>
                ) : null}
                <Text style={styles.modalLabel}>Kod</Text>
                <TextInput
                  style={styles.modalInput}
                  value={resetCode}
                  onChangeText={setResetCode}
                  placeholder="123456"
                  placeholderTextColor={colors.mutedForeground}
                  keyboardType="number-pad"
                  testID="reset-code-input"
                />
                <Text style={styles.modalLabel}>Yeni şifre</Text>
                <TextInput
                  style={styles.modalInput}
                  value={newPassword}
                  onChangeText={setNewPassword}
                  placeholder="En az 6 karakter"
                  placeholderTextColor={colors.mutedForeground}
                  secureTextEntry
                  testID="new-password-input"
                />
                <View style={styles.modalActions}>
                  <Pressable style={styles.modalCancel} onPress={closeForgotModal}>
                    <Text style={styles.modalCancelText}>Vazgeç</Text>
                  </Pressable>
                  <Pressable style={styles.modalSubmit} onPress={handleResetPasswordSubmit} disabled={forgotBusy} testID="reset-password-submit">
                    {forgotBusy ? <ActivityIndicator color={colors.primaryForeground} /> : <Text style={styles.modalSubmitText}>Şifreyi değiştir</Text>}
                  </Pressable>
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 150 },
  header: { height: 42, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  roundedButton: { borderRadius: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  brandMark: {
    width: 32,
    height: 32,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
  },
  brandName: { color: colors.foreground, fontFamily: fonts.heading, fontSize: 16, fontWeight: '800' },
  skipButton: { paddingHorizontal: 8, paddingVertical: 8 },
  skipText: { color: colors.mutedForeground, fontFamily: fonts.body, fontSize: 12, fontWeight: '800' },
  heroSection: { marginTop: 28 },
  titleRow: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 16 },
  titleCopy: { flex: 1 },
  eyebrow: { color: colors.primary, fontFamily: fonts.body, fontSize: 12, fontWeight: '800', letterSpacing: 1.5 },
  heroTitle: {
    maxWidth: 290,
    marginTop: 8,
    color: colors.foreground,
    fontFamily: fonts.heading,
    fontSize: 29,
    fontWeight: '800',
    lineHeight: 32,
  },
  stepText: { marginBottom: 4, color: colors.mutedForeground, fontFamily: fonts.body, fontSize: 12, fontWeight: '800' },
  heroCard: { height: 300, overflow: 'hidden', borderRadius: 16, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.muted },
  heroImage: { width: '100%', height: 238 },
  heroOverlay: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    left: 0,
    paddingHorizontal: 20,
    paddingTop: 62,
    paddingBottom: 18,
    backgroundColor: colors.muted,
  },
  heroLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  heroLabelIcon: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.card },
  heroLabel: { color: colors.primary, fontFamily: fonts.body, fontSize: 12, fontWeight: '800', letterSpacing: 1 },
  heroDescription: { maxWidth: 275, marginTop: 8, color: colors.foreground, fontFamily: fonts.body, fontSize: 14, fontWeight: '700', lineHeight: 20 },
  pagination: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8, marginTop: 16 },
  activeDot: { width: 24, height: 8, borderRadius: 4, backgroundColor: colors.primary },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.border },
  features: { gap: 12, paddingTop: 16, paddingBottom: 4 },
  featureCard: { width: 210, minHeight: 164, padding: 16, borderRadius: 16, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card },
  featureIcon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  featureTitle: { marginTop: 16, fontFamily: fonts.body, fontSize: 12, fontWeight: '800', letterSpacing: 1 },
  featureDescription: { marginTop: 8, color: colors.mutedForeground, fontFamily: fonts.body, fontSize: 12, lineHeight: 20 },
  card: { marginTop: 32, padding: 20, borderRadius: 16, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card },
  accountHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 16 },
  accountCopy: { flex: 1 },
  mutedEyebrow: { color: colors.mutedForeground, fontFamily: fonts.body, fontSize: 12, fontWeight: '800', letterSpacing: 1.4 },
  sectionTitle: { marginTop: 4, color: colors.foreground, fontFamily: fonts.heading, fontSize: 20, fontWeight: '800' },
  supportingText: { marginTop: 8, color: colors.mutedForeground, fontFamily: fonts.body, fontSize: 12, lineHeight: 20 },
  circleIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.muted },
  authButtons: { gap: 10, marginTop: 20 },
  emailFormToggle: { flexDirection: 'row', gap: 8, marginBottom: 4 },
  modeChip: { flex: 1, paddingVertical: 10, borderRadius: 12, alignItems: 'center', backgroundColor: colors.muted },
  modeChipActive: { backgroundColor: colors.primary },
  modeChipText: { color: colors.mutedForeground, fontFamily: fonts.body, fontSize: 12, fontWeight: '800' },
  modeChipTextActive: { color: colors.primaryForeground },
  textInput: {
    height: 48,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.input,
    paddingHorizontal: 16,
    color: colors.foreground,
    fontFamily: fonts.body,
    fontSize: 14,
  },
  authErrorText: { color: colors.destructive, fontFamily: fonts.body, fontSize: 12, fontWeight: '700' },
  primaryButton: { height: 48, gap: 8, backgroundColor: colors.primary },
  primaryButtonText: { color: colors.primaryForeground, fontFamily: fonts.body, fontSize: 14, fontWeight: '800' },
  outlineButton: { height: 48, gap: 8, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card },
  outlineButtonText: { color: colors.cardForeground, fontFamily: fonts.body, fontSize: 14, fontWeight: '800' },
  guestButton: { height: 44, gap: 8, marginTop: 16, backgroundColor: colors.muted },
  guestText: { color: colors.mutedForeground, fontFamily: fonts.body, fontSize: 12, fontWeight: '800' },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginTop: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: colors.secondary,
  },
  infoText: { flex: 1, color: colors.secondaryForeground, fontFamily: fonts.body, fontSize: 11, fontWeight: '600', lineHeight: 16 },
  profileCard: { marginTop: 24, padding: 20, borderRadius: 16, borderWidth: 1, borderColor: colors.primary, backgroundColor: colors.muted },
  profileHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  profileEyebrow: { color: colors.primary, fontFamily: fonts.body, fontSize: 12, fontWeight: '800', letterSpacing: 1.4 },
  counter: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, backgroundColor: colors.card },
  counterText: { color: colors.primary, fontFamily: fonts.body, fontSize: 11, fontWeight: '800' },
  petSummary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 20,
    padding: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  petImageWrap: { width: 56, height: 56, overflow: 'hidden', borderRadius: 28, backgroundColor: colors.muted },
  petImage: { width: 56, height: 56 },
  petCopy: { flex: 1 },
  petNameInput: { padding: 0, color: colors.foreground, fontFamily: fonts.body, fontSize: 14, fontWeight: '800' },
  petDescription: { marginTop: 4, color: colors.mutedForeground, fontFamily: fonts.body, fontSize: 12, fontWeight: '500' },
  selectionLabel: { marginTop: 20, color: colors.foreground, fontFamily: fonts.body, fontSize: 12, fontWeight: '800' },
  speciesGrid: { flexDirection: 'row', gap: 8, marginTop: 8 },
  speciesButton: {
    flex: 1,
    alignItems: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  selectedSpecies: { borderWidth: 2, borderColor: colors.primary },
  speciesText: { fontFamily: fonts.body, fontSize: 11, fontWeight: '800' },
  fieldsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 16 },
  detailField: { width: '47%' },
  fieldLabel: { color: colors.mutedForeground, fontFamily: fonts.body, fontSize: 11, fontWeight: '800' },
  fieldValue: {
    height: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
    paddingHorizontal: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.input,
  },
  fieldText: { flex: 1, color: colors.foreground, fontFamily: fonts.body, fontSize: 12, fontWeight: '700', padding: 0 },
  fieldSuffix: { color: colors.mutedForeground, fontFamily: fonts.body, fontSize: 12, fontWeight: '700' },
  neuteredRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  neuteredTitle: { color: colors.foreground, fontFamily: fonts.body, fontSize: 12, fontWeight: '800' },
  neuteredDescription: { marginTop: 4, color: colors.mutedForeground, fontFamily: fonts.body, fontSize: 11 },
  portraitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  smallCircleIcon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.muted },
  portraitCopy: { flex: 1 },
  portraitTitle: { color: colors.foreground, fontFamily: fonts.body, fontSize: 12, fontWeight: '800' },
  portraitDescription: { marginTop: 4, color: colors.mutedForeground, fontFamily: fonts.body, fontSize: 11 },
  readyHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  readyIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.secondary },
  readyCopy: { flex: 1 },
  readyTitle: { color: colors.foreground, fontFamily: fonts.heading, fontSize: 18, fontWeight: '800' },
  bottomNote: { marginTop: 12, color: colors.mutedForeground, textAlign: 'center', fontFamily: fonts.body, fontSize: 11, fontWeight: '600', lineHeight: 16 },
  bottomBar: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    left: 0,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 20,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.background,
  },
  createButton: { height: 56, gap: 8, backgroundColor: colors.primary },
  createButtonText: { color: colors.primaryForeground, fontFamily: fonts.body, fontSize: 14, fontWeight: '800' },
  nextStep: { marginTop: 8, color: colors.mutedForeground, textAlign: 'center', fontFamily: fonts.body, fontSize: 10, fontWeight: '600' },
  forgotPasswordButton: { marginTop: 4, alignItems: 'center', paddingVertical: 6 },
  forgotPasswordText: { color: colors.primary, fontFamily: fonts.body, fontSize: 12, fontWeight: '800' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(23,53,44,0.45)', justifyContent: 'flex-end' },
  modalCard: { backgroundColor: colors.card, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: 36, gap: 6 },
  modalTitle: { color: colors.foreground, fontFamily: fonts.heading, fontSize: 20, fontWeight: '900' },
  modalSubtitle: { marginTop: 4, color: colors.mutedForeground, fontFamily: fonts.body, fontSize: 12, lineHeight: 18 },
  modalLabel: { color: colors.mutedForeground, fontFamily: fonts.body, fontSize: 11, fontWeight: '800', marginTop: 10, marginBottom: 6 },
  modalInput: { height: 46, borderRadius: 14, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.input, paddingHorizontal: 14, color: colors.foreground, fontFamily: fonts.body, fontSize: 14 },
  modalActions: { flexDirection: 'row', gap: 10, marginTop: 18 },
  modalCancel: { flex: 1, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.border },
  modalCancelText: { color: colors.mutedForeground, fontFamily: fonts.body, fontSize: 13, fontWeight: '800' },
  modalSubmit: { flex: 1, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primary },
  modalSubmitText: { color: colors.primaryForeground, fontFamily: fonts.body, fontSize: 13, fontWeight: '800' },
  devCodeBox: { marginTop: 12, padding: 12, borderRadius: 12, backgroundColor: colors.muted, alignItems: 'center' },
  devCodeLabel: { color: colors.mutedForeground, fontFamily: fonts.body, fontSize: 9, fontWeight: '800', letterSpacing: 0.5, textAlign: 'center' },
  devCodeValue: { marginTop: 4, color: colors.primary, fontFamily: fonts.heading, fontSize: 24, fontWeight: '900', letterSpacing: 4 },
});
