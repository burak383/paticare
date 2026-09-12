import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { colors, fonts } from '../theme';
import { useAuth } from '../context/AuthContext';
import { usePets } from '../context/PetContext';
import { usersApi, petsApi, API_BASE_URL, type Pet, type Preferences } from '../api';
import { PrivacyConsentCheckbox, PrivacyPolicyDraftBanner, PRIVACY_POLICY_DRAFT } from '../components/PrivacyConsent';
import { pickAndPreparePetPhoto } from '../media';
import { hasPlusAccess } from '../subscription';
import type { RootStackParamList } from '../navigation/types';
import {
  ensureNotificationPermission,
  cancelAllReminders,
  getNotificationPermission,
  sendTestNotification,
  type NotificationPermission,
} from '../notifications';

const APP_VERSION = Constants.expoConfig?.version ?? '1.0.0';

const Icon = ({ name, size = 20, color = colors.foreground }: { name: React.ComponentProps<typeof MaterialCommunityIcons>['name']; size?: number; color?: string }) => (
  <MaterialCommunityIcons name={name} size={size} color={color} />
);

// Matches src/notifications.ts's SoundPreference type exactly — that's where
// each of these actually maps to a bundled sound file (or silence). Picking
// one here only changes playback in a real EAS dev/production build; Expo Go
// always plays the system default sound regardless of this setting.
const SOUND_OPTIONS = ['Varsayılan', 'Nazik pati sesi', 'Zil', 'Ping', 'Sessiz'];

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

function SectionTitle({ children, action, onAction }: { children: string; action?: string; onAction?: () => void }) {
  return (
    <View style={styles.sectionTitle}>
      <Text style={styles.sectionHeading}>{children}</Text>
      {action ? (
        <Pressable onPress={onAction}>
          <Text style={styles.sectionAction}>{action}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function PreferenceRow({
  icon,
  title,
  description,
  iconColor = colors.primary,
  iconBackground = colors.muted,
  last = false,
  trailing,
  onPress,
  testID,
}: {
  icon: React.ComponentProps<typeof MaterialCommunityIcons>['name'];
  title: string;
  description: string;
  iconColor?: string;
  iconBackground?: string;
  last?: boolean;
  trailing?: React.ReactNode;
  onPress?: () => void;
  testID?: string;
}) {
  const content = (
    <View style={[styles.preferenceRow, !last && styles.rowBorder]}>
      <View style={[styles.preferenceIcon, { backgroundColor: iconBackground }]}>
        <Icon name={icon} size={19} color={iconColor} />
      </View>
      <View style={styles.rowCopy}>
        <Text style={styles.rowTitle}>{title}</Text>
        <Text style={styles.rowDescription}>{description}</Text>
      </View>
      {trailing ?? (onPress ? <Icon name="chevron-right" size={23} color={colors.mutedForeground} /> : null)}
    </View>
  );
  if (!onPress) return content;
  return (
    <Pressable onPress={onPress} testID={testID}>
      {content}
    </Pressable>
  );
}

export default function ProfileScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { user, logout, upgradeGuestAccount, changePassword, biometricSupported, biometricEnabled, setBiometricEnabled } = useAuth();
  const { pets, addPet, updatePetLocal, refreshPets } = usePets();

  const [prefs, setPrefs] = useState<Preferences | null>(user?.preferences ?? null);
  // Keyed on user?.id rather than the `user` object itself: AuthContext's `user`
  // is a stable reference in production, but keying on the object would re-run
  // this effect (and re-render) on every render if a context value or a test
  // mock ever returns a fresh `user` object each call — which turns this into
  // an infinite render loop (setPrefs -> re-render -> new user ref -> effect
  // fires again -> ...). Keying on the id makes it robust either way.
  useEffect(() => setPrefs(user?.preferences ?? null), [user?.id]);

  const [addPetVisible, setAddPetVisible] = useState(false);
  const [newPetName, setNewPetName] = useState('');
  const [newPetSpecies, setNewPetSpecies] = useState('Kedi');
  const [savingPet, setSavingPet] = useState(false);

  const [editingPet, setEditingPet] = useState<Pet | null>(null);
  const [editName, setEditName] = useState('');
  const [editWeight, setEditWeight] = useState('');
  const [editAvatarUri, setEditAvatarUri] = useState<string | null>(null);
  // editAvatarUri alone can't tell "no change" apart from "remove the
  // existing photo" — both look like "nothing picked yet". This flag is the
  // difference: true means the save should clear avatarUrl instead of
  // leaving it untouched.
  const [avatarRemoved, setAvatarRemoved] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);
  const [deletingPet, setDeletingPet] = useState(false);
  const [pickingEditPhoto, setPickingEditPhoto] = useState(false);

  const [timeEditorVisible, setTimeEditorVisible] = useState(false);
  const [editMorning, setEditMorning] = useState('');
  const [editEvening, setEditEvening] = useState('');
  const [savingTimes, setSavingTimes] = useState(false);

  const [soundPickerVisible, setSoundPickerVisible] = useState(false);
  const [savingSound, setSavingSound] = useState(false);

  const [advancedVisible, setAdvancedVisible] = useState(false);
  const [notifPermission, setNotifPermission] = useState<NotificationPermission | null>(null);
  const [requestingPermission, setRequestingPermission] = useState(false);
  const [sendingTest, setSendingTest] = useState(false);

  const [aboutVisible, setAboutVisible] = useState(false);
  const [privacyVisible, setPrivacyVisible] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);

  const [upgradeVisible, setUpgradeVisible] = useState(false);
  const [upgradeEmail, setUpgradeEmail] = useState('');
  const [upgradePassword, setUpgradePassword] = useState('');
  const [upgradingAccount, setUpgradingAccount] = useState(false);
  // Same consent requirement as OnboardingScreen's register flow — this is
  // the moment the guest becomes a real, identifiable account.
  const [upgradePrivacyAccepted, setUpgradePrivacyAccepted] = useState(false);
  const [upgradePrivacyModalVisible, setUpgradePrivacyModalVisible] = useState(false);

  function closeUpgradeModal() {
    setUpgradeVisible(false);
    setUpgradeEmail('');
    setUpgradePassword('');
    setUpgradePrivacyAccepted(false);
  }

  async function handleUpgradeAccount() {
    if (!upgradeEmail.trim() || !upgradePassword) {
      Alert.alert('Eksik bilgi', 'E-posta ve şifre gerekli.');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(upgradeEmail.trim())) {
      Alert.alert('E-posta hatalı', 'Geçerli bir e-posta adresi gir.');
      return;
    }
    if (upgradePassword.length < 6) {
      Alert.alert('Şifre çok kısa', 'Şifre en az 6 karakter olmalı.');
      return;
    }
    if (!upgradePrivacyAccepted) {
      Alert.alert('Onay gerekli', 'Devam etmek için KVKK Aydınlatma Metni\'ni kabul etmelisin.');
      return;
    }
    setUpgradingAccount(true);
    try {
      await upgradeGuestAccount(upgradeEmail.trim(), upgradePassword, undefined, upgradePrivacyAccepted);
      closeUpgradeModal();
      Alert.alert('Hesabın oluşturuldu', 'Artık bu e-posta ve şifreyle her cihazdan giriş yapabilirsin. Tüm evcil hayvanların ve kayıtların korundu.');
    } catch (err) {
      Alert.alert('Hata', err instanceof Error ? err.message : 'Hesap oluşturulamadı.');
    } finally {
      setUpgradingAccount(false);
    }
  }

  const [changePasswordVisible, setChangePasswordVisible] = useState(false);
  const [currentPasswordInput, setCurrentPasswordInput] = useState('');
  const [newPasswordInput, setNewPasswordInput] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);

  function closeChangePasswordModal() {
    setChangePasswordVisible(false);
    setCurrentPasswordInput('');
    setNewPasswordInput('');
  }

  async function handleChangePassword() {
    if (!currentPasswordInput || !newPasswordInput) {
      Alert.alert('Eksik bilgi', 'Mevcut şifre ve yeni şifre gerekli.');
      return;
    }
    if (newPasswordInput.length < 6) {
      Alert.alert('Şifre çok kısa', 'Yeni şifre en az 6 karakter olmalı.');
      return;
    }
    setChangingPassword(true);
    try {
      await changePassword(currentPasswordInput, newPasswordInput);
      closeChangePasswordModal();
      Alert.alert('Şifren değişti', 'Yeni şifrenle bir sonraki girişte bu şifreyi kullanabilirsin.');
    } catch (err) {
      Alert.alert('Hata', err instanceof Error ? err.message : 'Şifre değiştirilemedi.');
    } finally {
      setChangingPassword(false);
    }
  }

  const [refreshing, setRefreshing] = useState(false);
  async function handleRefresh() {
    setRefreshing(true);
    try {
      await refreshPets();
    } finally {
      setRefreshing(false);
    }
  }

  async function togglePreference(key: keyof Preferences, value: boolean) {
    if (!prefs) return;
    const next = { ...prefs, [key]: value };
    setPrefs(next);
    try {
      await usersApi.updatePreferences({ [key]: value });
      if (key === 'medicationReminders') {
        if (value) {
          // Ask now rather than waiting for the first reminder to silently
          // fail to schedule — if it's refused, CalendarScreen/HomeScreen
          // reminders just won't be able to fire until it's granted later.
          const granted = await ensureNotificationPermission();
          if (!granted) {
            Alert.alert(
              'Bildirim izni gerekli',
              'Hatırlatıcıların telefonuna bildirim gönderebilmesi için Ayarlar\'dan PatiCare\'ye bildirim izni vermen gerekiyor.',
            );
          }
        } else {
          cancelAllReminders().catch(() => {});
        }
      }
    } catch (err) {
      setPrefs(prefs); // revert
      Alert.alert('Hata', err instanceof Error ? err.message : 'Tercih güncellenemedi.');
    }
  }

  function openTimeEditor() {
    setEditMorning(prefs?.defaultReminderMorning ?? '09:00');
    setEditEvening(prefs?.defaultReminderEvening ?? '20:00');
    setTimeEditorVisible(true);
  }

  async function saveTimeEditor() {
    if (!TIME_RE.test(editMorning) || !TIME_RE.test(editEvening)) {
      Alert.alert('Geçersiz saat', "Saatleri SS:DD biçiminde gir, örn. 09:00.");
      return;
    }
    if (!prefs) return;
    const previous = prefs;
    const patch = { defaultReminderMorning: editMorning, defaultReminderEvening: editEvening };
    setPrefs({ ...prefs, ...patch });
    setSavingTimes(true);
    try {
      await usersApi.updatePreferences(patch);
      setTimeEditorVisible(false);
    } catch (err) {
      setPrefs(previous);
      Alert.alert('Hata', err instanceof Error ? err.message : 'Hatırlatma saatleri güncellenemedi.');
    } finally {
      setSavingTimes(false);
    }
  }

  async function selectSound(sound: string) {
    if (!prefs) return;
    const previous = prefs;
    setPrefs({ ...prefs, notificationSound: sound });
    setSavingSound(true);
    try {
      await usersApi.updatePreferences({ notificationSound: sound });
      setSoundPickerVisible(false);
    } catch (err) {
      setPrefs(previous);
      Alert.alert('Hata', err instanceof Error ? err.message : 'Bildirim sesi güncellenemedi.');
    } finally {
      setSavingSound(false);
    }
  }

  async function openAdvancedSettings() {
    setAdvancedVisible(true);
    try {
      const status = await getNotificationPermission();
      setNotifPermission(status);
    } catch {
      setNotifPermission(null);
    }
  }

  async function handleRequestPermission() {
    setRequestingPermission(true);
    try {
      const granted = await ensureNotificationPermission();
      setNotifPermission(granted ? 'granted' : 'denied');
      if (!granted) {
        Alert.alert(
          'İzin verilmedi',
          "Bildirim izni reddedildiyse Ayarlar uygulamasından PatiCare için elle açman gerekir.",
        );
      }
    } catch (err) {
      Alert.alert('Hata', err instanceof Error ? err.message : 'Bildirim izni sorgulanamadı.');
    } finally {
      setRequestingPermission(false);
    }
  }

  async function handleSendTestNotification() {
    setSendingTest(true);
    try {
      const sent = await sendTestNotification(prefs?.notificationSound);
      if (sent) {
        Alert.alert('Gönderildi', 'Birkaç saniye içinde test bildirimini görmelisin.');
      } else {
        Alert.alert('Gönderilemedi', 'Bildirim izni verilmediği için test bildirimi gönderilemedi.');
      }
      setNotifPermission(await getNotificationPermission());
    } catch (err) {
      Alert.alert('Hata', err instanceof Error ? err.message : 'Test bildirimi gönderilemedi.');
    } finally {
      setSendingTest(false);
    }
  }

  async function handleAddPet() {
    if (!newPetName.trim()) {
      Alert.alert('İsim gerekli');
      return;
    }
    setSavingPet(true);
    try {
      await addPet({ name: newPetName.trim(), species: newPetSpecies });
      setAddPetVisible(false);
      setNewPetName('');
      setNewPetSpecies('Kedi');
    } catch (err) {
      Alert.alert('Hata', err instanceof Error ? err.message : 'Evcil hayvan eklenemedi.');
    } finally {
      setSavingPet(false);
    }
  }

  function openEdit(pet: Pet) {
    setEditingPet(pet);
    setEditName(pet.name);
    setEditWeight(pet.weightKg != null ? String(pet.weightKg).replace('.', ',') : '');
    setEditAvatarUri(null);
    setAvatarRemoved(false);
  }

  async function handleChangeEditPhoto() {
    setPickingEditPhoto(true);
    try {
      const uri = await pickAndPreparePetPhoto();
      if (uri) {
        setEditAvatarUri(uri);
        setAvatarRemoved(false);
      }
    } catch (err) {
      Alert.alert('Fotoğraf eklenemedi', err instanceof Error ? err.message : 'Bilinmeyen hata.');
    } finally {
      setPickingEditPhoto(false);
    }
  }

  function handleRemoveEditPhoto() {
    setEditAvatarUri(null);
    setAvatarRemoved(true);
  }

  async function saveEdit() {
    if (!editingPet) return;
    setSavingEdit(true);
    try {
      const weightNum = Number(editWeight.replace(',', '.'));
      const patch: Partial<Pet> = { name: editName.trim() || editingPet.name };
      if (Number.isFinite(weightNum) && editWeight.trim()) patch.weightKg = weightNum;
      if (avatarRemoved) patch.avatarUrl = null;
      else if (editAvatarUri) patch.avatarUrl = editAvatarUri;
      const updated = await petsApi.updatePet(editingPet.id, patch);
      updatePetLocal(updated.id, updated);
      setEditingPet(null);
    } catch (err) {
      Alert.alert('Hata', err instanceof Error ? err.message : 'Güncellenemedi.');
    } finally {
      setSavingEdit(false);
    }
  }

  function handleDeletePet() {
    if (!editingPet) return;
    const pet = editingPet;
    Alert.alert(
      `${pet.name} kaydını sil`,
      'Bu evcil hayvana ait tüm görevler, aşı kayıtları ve sağlık geçmişi de silinecek. Bu işlem geri alınamaz.',
      [
        { text: 'Vazgeç', style: 'cancel' },
        {
          text: 'Sil',
          style: 'destructive',
          onPress: async () => {
            setDeletingPet(true);
            try {
              await petsApi.deletePet(pet.id);
              await refreshPets();
              setEditingPet(null);
            } catch (err) {
              Alert.alert('Hata', err instanceof Error ? err.message : 'Evcil hayvan silinemedi.');
            } finally {
              setDeletingPet(false);
            }
          },
        },
      ],
    );
  }

  function handleLogout() {
    Alert.alert('Çıkış yap', 'Oturumu kapatmak istediğine emin misin?', [
      { text: 'Vazgeç', style: 'cancel' },
      { text: 'Çıkış yap', style: 'destructive', onPress: logout },
    ]);
  }

  function handleDeleteAccount() {
    Alert.alert(
      'Hesabı ve tüm verileri sil',
      'Bu işlem geri alınamaz. Evcil hayvan profillerin ve fotoğrafların, bakım görevlerin, aşı ve sağlık geçmişin, tarama geçmişin, fiyat notların ve tercihlerin kalıcı olarak silinecek.',
      [
        { text: 'Vazgeç', style: 'cancel' },
        {
          text: 'Sil',
          style: 'destructive',
          onPress: async () => {
            setDeletingAccount(true);
            try {
              await usersApi.deleteAccount();
              await logout();
            } catch (err) {
              Alert.alert('Hata', err instanceof Error ? err.message : 'Hesap silinemedi.');
            } finally {
              setDeletingAccount(false);
            }
          },
        },
      ],
    );
  }

  const plusStatus = user?.subscription?.status ?? 'none';
  const plusActive = hasPlusAccess(user?.subscription);
  const plusBadgeLabel =
    plusStatus === 'active'
      ? 'PLUS AKTİF'
      : plusStatus === 'trialing'
        ? 'DENEME AKTİF'
        : plusStatus === 'canceled'
          ? 'İPTAL EDİLDİ'
          : plusStatus === 'expired'
            ? 'SONA ERDİ'
            : 'YENİ';
  const plusDescription = plusActive
    ? 'Sınırsız tarama geçmişin açık. Durumunu ve iptal seçeneğini görmek için dokun.'
    : 'Sınırsız tarama geçmişi. 7 gün ücretsiz dene, istediğin zaman vazgeç.';

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        testID="profile-scroll"
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl testID="profile-refresh-control" refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.primary} />}
      >
        <View style={styles.header}>
          <View style={styles.headerCopy}>
            <Text style={styles.eyebrow}>HESABIM</Text>
            <Text style={styles.title}>Profil</Text>
            <Text style={styles.subtitle}>Evindeki tüm patiler için tek bakım alanı.</Text>
          </View>
          <Pressable
            style={styles.settingsButton}
            accessibilityLabel="Profil ayarları"
            testID="advanced-settings-button"
            onPress={openAdvancedSettings}
          >
            <Icon name="tune-variant" size={21} />
          </Pressable>
        </View>

        <View style={styles.profileCard}>
          <View style={styles.connectedBadge}>
            <Icon name="check-circle-outline" size={15} color={colors.success} />
            <Text style={styles.connectedText}>{user?.guest ? 'Misafir hesap' : 'Hesap bağlı'}</Text>
          </View>

          <View style={styles.profileBody}>
            <View style={styles.profileTopLine}>
              <Text style={styles.petCount}>{pets.length} evcil hayvan</Text>
            </View>

            <Text style={styles.profileName}>{user?.name ?? 'Kullanıcı'}</Text>
            <View style={styles.emailLine}>
              <Icon name="email-outline" size={15} color={colors.mutedForeground} />
              <Text style={styles.email}>{user?.email ?? ''}</Text>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <SectionTitle>Evcil hayvanlarım</SectionTitle>
          <View style={styles.card}>
            {pets.map((pet, index) => (
              <View key={pet.id} style={[styles.petRow, index < pets.length - 1 && styles.rowBorder]}>
                <View style={[styles.petAvatar, { backgroundColor: colors.muted }]}>
                  {pet.avatarUrl ? <Image source={{ uri: pet.avatarUrl }} style={styles.petImage} resizeMode="contain" /> : <Icon name="paw" size={20} color={colors.primary} />}
                </View>
                <View style={styles.rowCopy}>
                  <Text style={styles.rowTitle}>{pet.name}</Text>
                  <Text style={styles.rowDescription}>
                    {pet.species}
                    {pet.weightKg ? ` · ${pet.weightKg.toString().replace('.', ',')} kg` : ''}
                    {pet.active ? ' · Aktif bakım dosyası' : ''}
                  </Text>
                </View>
                <Pressable
                  style={styles.editButton}
                  accessibilityLabel={`${pet.name} profilini düzenle`}
                  testID={`edit-pet-${pet.id}`}
                  onPress={() => openEdit(pet)}
                >
                  <Icon name="pencil-outline" size={17} color={colors.mutedForeground} />
                </Pressable>
              </View>
            ))}
            <Pressable
              style={[styles.addPetRow, pets.length > 0 && styles.rowBorder]}
              testID="add-pet-row"
              onPress={() => setAddPetVisible(true)}
            >
              <View style={styles.addIcon}>
                <Icon name="plus" size={22} color={colors.accent} />
              </View>
              <View style={styles.rowCopy}>
                <Text style={styles.addTitle}>Yeni evcil hayvan ekle</Text>
                <Text style={styles.rowDescription}>Bakım planını birlikte oluşturalım</Text>
              </View>
              <Icon name="chevron-right" size={23} color={colors.mutedForeground} />
            </Pressable>
          </View>
        </View>

        <View style={styles.section}>
          <SectionTitle>Bildirimler ve tercihler</SectionTitle>
          <View style={styles.card}>
            <PreferenceRow
              icon="bell-ring-outline"
              title="İlaç hatırlatıcıları"
              description={prefs?.medicationReminders ? 'Açık · zamanında bakım için' : 'Kapalı'}
              trailing={
                <Switch
                  testID="medication-reminders-toggle"
                  value={!!prefs?.medicationReminders}
                  onValueChange={(v) => togglePreference('medicationReminders', v)}
                  trackColor={{ false: colors.border, true: colors.primary }}
                  thumbColor={colors.primaryForeground}
                />
              }
            />
            <PreferenceRow
              icon="clock-outline"
              title="Varsayılan hatırlatma saatleri"
              description={`Sabah ${prefs?.defaultReminderMorning ?? '09:00'} · Akşam ${prefs?.defaultReminderEvening ?? '20:00'}`}
              iconColor={colors.secondaryForeground}
              iconBackground={colors.secondary}
              onPress={openTimeEditor}
              testID="reminder-times-row"
            />
            <PreferenceRow
              icon="volume-high"
              title="Bildirim sesi"
              description={prefs?.notificationSound ?? 'Varsayılan'}
              iconColor={colors.mutedForeground}
              onPress={() => setSoundPickerVisible(true)}
              testID="notification-sound-row"
            />
            <PreferenceRow
              icon="translate"
              title="Dil"
              description={prefs?.language ?? 'Türkçe'}
              iconColor={colors.mutedForeground}
              last
              onPress={() => Alert.alert('Yakında', 'Uygulama şu an yalnızca Türkçe destekliyor.')}
            />
          </View>
        </View>

        <Pressable style={styles.plusCard} onPress={() => navigation.navigate('PatiCarePlus')} testID="plus-card">
          <View style={styles.plusIcon}>
            <Icon name="creation" size={22} color={colors.primaryForeground} />
          </View>
          <View style={styles.plusCopy}>
            <View style={styles.plusTitleLine}>
              <Text style={styles.plusTitle}>PatiCare Plus</Text>
              <Text style={styles.newBadge}>{plusBadgeLabel}</Text>
            </View>
            <Text style={styles.plusDescription}>{plusDescription}</Text>
            <View style={styles.discoverButton}>
              <Text style={styles.discoverText}>Plus&apos;ı keşfet</Text>
              <Icon name="arrow-top-right" size={16} color={colors.primary} />
            </View>
          </View>
        </Pressable>

        <View style={styles.section}>
          <SectionTitle>Hesap ve gizlilik</SectionTitle>
          <View style={styles.card}>
            <PreferenceRow
              icon="information-outline"
              title="Hakkında"
              description={`PatiCare · sürüm ${APP_VERSION}`}
              onPress={() => setAboutVisible(true)}
              testID="about-row"
            />
            <PreferenceRow
              icon="login"
              title="Giriş yöntemleri"
              description={user?.guest ? 'Misafir modu · bu cihaza özel' : `E-posta ile bağlı · ${user?.email ?? ''}`}
            />
            {user?.guest ? (
              <PreferenceRow
                icon="account-plus-outline"
                title="Hesabını oluştur"
                description="E-posta ve şifre ekle, verilerini kaybetmeden başka cihazlardan da giriş yap"
                iconColor={colors.primary}
                onPress={() => setUpgradeVisible(true)}
                testID="upgrade-account-row"
              />
            ) : (
              <PreferenceRow
                icon="lock-reset"
                title="Şifreni değiştir"
                description="Mevcut şifreni onaylayıp yeni bir şifre belirle"
                onPress={() => setChangePasswordVisible(true)}
                testID="change-password-row"
              />
            )}
            {biometricSupported ? (
              <PreferenceRow
                icon="face-recognition"
                title="Face ID ile giriş"
                description={biometricEnabled ? 'Açık · uygulama açılışında kimlik doğrulama ister' : 'Kapalı'}
                iconColor={colors.primary}
                trailing={
                  <Switch
                    testID="biometric-toggle"
                    value={biometricEnabled}
                    onValueChange={(v) => setBiometricEnabled(v)}
                    trackColor={{ false: colors.border, true: colors.primary }}
                    thumbColor={colors.primaryForeground}
                  />
                }
              />
            ) : null}
            <PreferenceRow
              icon="database-outline"
              title="Verilerim ve gizlilik"
              description="Hangi verilerin tutulduğunu gör, hesabını sil"
              iconColor={colors.secondaryForeground}
              iconBackground={colors.secondary}
              onPress={() => setPrivacyVisible(true)}
              testID="privacy-row"
              last
            />
          </View>
        </View>

        <View style={styles.footerActions}>
          <Pressable style={styles.logoutButton} onPress={handleLogout}>
            <Icon name="logout" size={19} />
            <Text style={styles.logoutText}>Çıkış yap</Text>
          </Pressable>
          <Pressable onPress={handleDeleteAccount} disabled={deletingAccount} testID="delete-account-button">
            {deletingAccount ? (
              <ActivityIndicator color={colors.destructive} />
            ) : (
              <Text style={styles.deleteText}>Hesabı ve tüm verileri sil</Text>
            )}
          </Pressable>
          <Text style={styles.disclaimer}>PatiCare, veteriner hekiminizin yerini tutmaz.</Text>
        </View>
      </ScrollView>

      <Modal visible={addPetVisible} transparent animationType="slide" onRequestClose={() => setAddPetVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Yeni evcil hayvan ekle</Text>
            <Text style={styles.modalLabel}>İsim</Text>
            <TextInput
              style={styles.modalInput}
              value={newPetName}
              onChangeText={setNewPetName}
              placeholder="Örn. Zeytin"
              placeholderTextColor={colors.mutedForeground}
              testID="add-pet-name-input"
            />
            <Text style={styles.modalLabel}>Tür</Text>
            <View style={styles.speciesRow}>
              {['Kedi', 'Köpek', 'Kuş', 'Diğer'].map((s) => (
                <Pressable key={s} onPress={() => setNewPetSpecies(s)} style={[styles.speciesChip, newPetSpecies === s && styles.speciesChipActive]}>
                  <Text style={[styles.speciesChipText, newPetSpecies === s && styles.speciesChipTextActive]}>{s}</Text>
                </Pressable>
              ))}
            </View>
            <View style={styles.modalActions}>
              <Pressable style={styles.modalCancel} onPress={() => setAddPetVisible(false)}>
                <Text style={styles.modalCancelText}>Vazgeç</Text>
              </Pressable>
              <Pressable style={styles.modalSubmit} onPress={handleAddPet} disabled={savingPet} testID="add-pet-submit">
                {savingPet ? <ActivityIndicator color={colors.primaryForeground} /> : <Text style={styles.modalSubmitText}>Ekle</Text>}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={!!editingPet} transparent animationType="slide" onRequestClose={() => setEditingPet(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>{editingPet?.name} profilini düzenle</Text>

            <View style={styles.editPhotoRow}>
              <Pressable style={styles.editPhotoTapArea} onPress={handleChangeEditPhoto} disabled={pickingEditPhoto} testID="edit-pet-photo-button">
                <View style={styles.editPhotoAvatar}>
                  {!avatarRemoved && (editAvatarUri || editingPet?.avatarUrl) ? (
                    <Image source={{ uri: editAvatarUri ?? editingPet?.avatarUrl ?? undefined }} style={styles.editPhotoImage} resizeMode="cover" />
                  ) : (
                    <Icon name="paw" size={20} color={colors.primary} />
                  )}
                </View>
                {pickingEditPhoto ? (
                  <ActivityIndicator color={colors.primary} />
                ) : (
                  <Text style={styles.editPhotoText}>Fotoğrafı değiştir</Text>
                )}
              </Pressable>
              {!avatarRemoved && (editAvatarUri || editingPet?.avatarUrl) ? (
                <Pressable onPress={handleRemoveEditPhoto} disabled={pickingEditPhoto} testID="remove-pet-photo-button" hitSlop={8}>
                  <Text style={styles.editPhotoRemoveText}>Kaldır</Text>
                </Pressable>
              ) : null}
            </View>

            <Text style={styles.modalLabel}>İsim</Text>
            <TextInput
              style={styles.modalInput}
              value={editName}
              onChangeText={setEditName}
              placeholderTextColor={colors.mutedForeground}
              testID="edit-pet-name-input"
            />
            <Text style={styles.modalLabel}>Kilo (kg)</Text>
            <TextInput
              style={styles.modalInput}
              value={editWeight}
              onChangeText={setEditWeight}
              keyboardType="numeric"
              placeholderTextColor={colors.mutedForeground}
              testID="edit-pet-weight-input"
            />
            <View style={styles.modalActions}>
              <Pressable style={styles.modalCancel} onPress={() => setEditingPet(null)}>
                <Text style={styles.modalCancelText}>Vazgeç</Text>
              </Pressable>
              <Pressable style={styles.modalSubmit} onPress={saveEdit} disabled={savingEdit} testID="edit-pet-submit">
                {savingEdit ? <ActivityIndicator color={colors.primaryForeground} /> : <Text style={styles.modalSubmitText}>Kaydet</Text>}
              </Pressable>
            </View>
            <Pressable
              style={styles.deletePetButton}
              onPress={handleDeletePet}
              disabled={deletingPet}
              testID="delete-pet-button"
            >
              {deletingPet ? (
                <ActivityIndicator color={colors.destructive} />
              ) : (
                <Text style={styles.deletePetText}>{editingPet?.name} kaydını sil</Text>
              )}
            </Pressable>
          </View>
        </View>
      </Modal>

      <Modal visible={timeEditorVisible} transparent animationType="slide" onRequestClose={() => setTimeEditorVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Varsayılan hatırlatma saatleri</Text>
            <Text style={styles.modalLabel}>Sabah</Text>
            <TextInput
              style={styles.modalInput}
              value={editMorning}
              onChangeText={setEditMorning}
              placeholder="09:00"
              placeholderTextColor={colors.mutedForeground}
              keyboardType="numbers-and-punctuation"
              testID="reminder-time-morning-input"
            />
            <Text style={styles.modalLabel}>Akşam</Text>
            <TextInput
              style={styles.modalInput}
              value={editEvening}
              onChangeText={setEditEvening}
              placeholder="20:00"
              placeholderTextColor={colors.mutedForeground}
              keyboardType="numbers-and-punctuation"
              testID="reminder-time-evening-input"
            />
            <View style={styles.modalActions}>
              <Pressable style={styles.modalCancel} onPress={() => setTimeEditorVisible(false)}>
                <Text style={styles.modalCancelText}>Vazgeç</Text>
              </Pressable>
              <Pressable style={styles.modalSubmit} onPress={saveTimeEditor} disabled={savingTimes} testID="reminder-times-submit">
                {savingTimes ? <ActivityIndicator color={colors.primaryForeground} /> : <Text style={styles.modalSubmitText}>Kaydet</Text>}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={soundPickerVisible} transparent animationType="slide" onRequestClose={() => setSoundPickerVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Bildirim sesi</Text>
            <View style={styles.soundList}>
              {SOUND_OPTIONS.map((sound) => {
                const selected = (prefs?.notificationSound ?? 'Varsayılan') === sound;
                return (
                  <Pressable
                    key={sound}
                    style={[styles.soundOption, selected && styles.soundOptionSelected]}
                    onPress={() => selectSound(sound)}
                    disabled={savingSound}
                    testID={`sound-option-${sound}`}
                  >
                    <Text style={[styles.soundOptionText, selected && styles.soundOptionTextSelected]}>{sound}</Text>
                    {selected ? <Icon name="check" size={18} color={colors.primary} /> : null}
                  </Pressable>
                );
              })}
            </View>
            <Pressable style={styles.modalCancel} onPress={() => setSoundPickerVisible(false)}>
              <Text style={styles.modalCancelText}>Kapat</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      <Modal visible={advancedVisible} transparent animationType="slide" onRequestClose={() => setAdvancedVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Gelişmiş ayarlar</Text>

            <View style={styles.advancedRow}>
              <Text style={styles.advancedLabel}>Uygulama sürümü</Text>
              <Text style={styles.advancedValue}>{APP_VERSION}</Text>
            </View>
            <View style={styles.advancedRow}>
              <Text style={styles.advancedLabel}>Backend adresi</Text>
              <Text style={styles.advancedValue} numberOfLines={1}>{API_BASE_URL}</Text>
            </View>
            <View style={styles.advancedRow}>
              <Text style={styles.advancedLabel}>Bildirim izni</Text>
              <Text style={styles.advancedValue} testID="notification-permission-status">
                {notifPermission === 'granted' ? 'Verildi' : notifPermission === 'denied' ? 'Reddedildi' : notifPermission === 'undetermined' ? 'Sorulmadı' : '—'}
              </Text>
            </View>

            {notifPermission !== 'granted' ? (
              <Pressable
                style={styles.advancedActionButton}
                onPress={handleRequestPermission}
                disabled={requestingPermission}
                testID="request-notification-permission"
              >
                {requestingPermission ? (
                  <ActivityIndicator color={colors.primaryForeground} />
                ) : (
                  <Text style={styles.advancedActionText}>Bildirim izni iste</Text>
                )}
              </Pressable>
            ) : (
              <Pressable
                style={styles.advancedActionButton}
                onPress={handleSendTestNotification}
                disabled={sendingTest}
                testID="send-test-notification"
              >
                {sendingTest ? (
                  <ActivityIndicator color={colors.primaryForeground} />
                ) : (
                  <Text style={styles.advancedActionText}>Bildirimi test et</Text>
                )}
              </Pressable>
            )}

            <Pressable style={styles.modalCancel} onPress={() => setAdvancedVisible(false)}>
              <Text style={styles.modalCancelText}>Kapat</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      <Modal visible={aboutVisible} transparent animationType="slide" onRequestClose={() => setAboutVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.aboutBrandRow}>
              <View style={styles.aboutBrandMark}>
                <Icon name="paw" size={22} color={colors.primaryForeground} />
              </View>
              <View>
                <Text style={styles.modalTitle}>PatiCare</Text>
                <Text style={styles.advancedLabel}>Sürüm {APP_VERSION}</Text>
              </View>
            </View>

            <Text style={styles.privacyText}>
              PatiCare, evcil hayvanlarının bakım takvimini, aşılarını, kilosunu ve kullandığın ürünleri tek yerden
              takip etmeni sağlayan bir bakım asistanıdır.
            </Text>
            <Text style={styles.privacyText}>PatiCare, veteriner hekiminizin yerini tutmaz.</Text>

            <Pressable
              style={styles.aboutPrivacyLink}
              onPress={() => {
                setAboutVisible(false);
                setPrivacyVisible(true);
              }}
              testID="about-privacy-link"
            >
              <Icon name="shield-check-outline" size={18} color={colors.primary} />
              <Text style={styles.aboutPrivacyLinkText}>Gizlilik ve verilerim</Text>
              <Icon name="chevron-right" size={18} color={colors.primary} />
            </Pressable>

            <Pressable style={styles.modalCancel} onPress={() => setAboutVisible(false)}>
              <Text style={styles.modalCancelText}>Kapat</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      <Modal visible={privacyVisible} transparent animationType="slide" onRequestClose={() => setPrivacyVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Gizlilik ve verilerim</Text>

            <Text style={styles.privacySectionTitle}>Ne saklıyoruz</Text>
            <Text style={styles.privacyText}>
              Hesap bilgilerin (e-posta, ad), evcil hayvan profillerin ve yüklediğin fotoğraflar, bakım görevlerin,
              aşı ve sağlık kayıtların, ürün tarama geçmişin, fiyat notların ve bildirim tercihlerin — hepsi yalnızca
              senin hesabına bağlı olarak saklanır.
            </Text>

            <Text style={styles.privacySectionTitle}>Kiminle paylaşıyoruz</Text>
            <Text style={styles.privacyText}>
              Verilerin üçüncü taraflarla paylaşılmaz ya da satılmaz. Bildirim izni yalnızca cihazında yerel
              hatırlatıcılar göstermek için kullanılır.
            </Text>

            <Text style={styles.privacySectionTitle}>Verilerini dışa aktar</Text>
            <Text style={styles.privacyText}>
              Karnem sekmesinden evcil hayvanın için bir sağlık raporu oluşturup paylaşabilirsin.
            </Text>

            <Pressable
              style={styles.privacyDeleteButton}
              onPress={() => {
                setPrivacyVisible(false);
                handleDeleteAccount();
              }}
              testID="privacy-delete-account-button"
            >
              <Icon name="trash-can-outline" size={18} color={colors.destructive} />
              <Text style={styles.privacyDeleteText}>Hesabımı ve tüm verilerimi sil</Text>
            </Pressable>

            <Pressable style={styles.modalCancel} onPress={() => setPrivacyVisible(false)}>
              <Text style={styles.modalCancelText}>Kapat</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      <Modal visible={upgradeVisible} transparent animationType="slide" onRequestClose={closeUpgradeModal}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Hesabını oluştur</Text>
            <Text style={styles.privacyText}>
              Bir e-posta ve şifre ekle. Aynı hesap devam eder — evcil hayvanların, hatırlatıcıların ve sağlık
              kayıtların olduğu gibi kalır, sadece artık başka bir cihazdan da giriş yapabilirsin.
            </Text>

            <Text style={styles.modalLabel}>E-posta</Text>
            <TextInput
              style={styles.modalInput}
              value={upgradeEmail}
              onChangeText={setUpgradeEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              placeholder="ornek@eposta.com"
              placeholderTextColor={colors.mutedForeground}
              testID="upgrade-email-input"
            />
            <Text style={styles.modalLabel}>Şifre</Text>
            <TextInput
              style={styles.modalInput}
              value={upgradePassword}
              onChangeText={setUpgradePassword}
              secureTextEntry
              placeholder="En az 6 karakter"
              placeholderTextColor={colors.mutedForeground}
              testID="upgrade-password-input"
            />

            <PrivacyConsentCheckbox
              checked={upgradePrivacyAccepted}
              onToggle={() => setUpgradePrivacyAccepted((v) => !v)}
              onOpenPolicy={() => setUpgradePrivacyModalVisible(true)}
              testID="upgrade-privacy-consent-checkbox"
            />

            <View style={styles.modalActions}>
              <Pressable style={styles.modalCancel} onPress={closeUpgradeModal}>
                <Text style={styles.modalCancelText}>Vazgeç</Text>
              </Pressable>
              <Pressable style={styles.modalSubmit} onPress={handleUpgradeAccount} disabled={upgradingAccount} testID="upgrade-account-submit">
                {upgradingAccount ? <ActivityIndicator color={colors.primaryForeground} /> : <Text style={styles.modalSubmitText}>Hesap oluştur</Text>}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={upgradePrivacyModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setUpgradePrivacyModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>KVKK Aydınlatma Metni</Text>
            <PrivacyPolicyDraftBanner />
            <ScrollView style={styles.privacyScroll}>
              <Text style={styles.privacyPolicyText}>{PRIVACY_POLICY_DRAFT}</Text>
            </ScrollView>
            <Pressable
              style={styles.modalCancel}
              onPress={() => setUpgradePrivacyModalVisible(false)}
              testID="upgrade-privacy-policy-close"
            >
              <Text style={styles.modalCancelText}>Kapat</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      <Modal visible={changePasswordVisible} transparent animationType="slide" onRequestClose={closeChangePasswordModal}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Şifreni değiştir</Text>

            <Text style={styles.modalLabel}>Mevcut şifre</Text>
            <TextInput
              style={styles.modalInput}
              value={currentPasswordInput}
              onChangeText={setCurrentPasswordInput}
              secureTextEntry
              placeholderTextColor={colors.mutedForeground}
              testID="current-password-input"
            />
            <Text style={styles.modalLabel}>Yeni şifre</Text>
            <TextInput
              style={styles.modalInput}
              value={newPasswordInput}
              onChangeText={setNewPasswordInput}
              secureTextEntry
              placeholder="En az 6 karakter"
              placeholderTextColor={colors.mutedForeground}
              testID="new-password-change-input"
            />

            <View style={styles.modalActions}>
              <Pressable style={styles.modalCancel} onPress={closeChangePasswordModal}>
                <Text style={styles.modalCancelText}>Vazgeç</Text>
              </Pressable>
              <Pressable style={styles.modalSubmit} onPress={handleChangePassword} disabled={changingPassword} testID="change-password-submit">
                {changingPassword ? <ActivityIndicator color={colors.primaryForeground} /> : <Text style={styles.modalSubmitText}>Kaydet</Text>}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: 20, paddingTop: 24, paddingBottom: 126 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  headerCopy: { flex: 1 },
  eyebrow: { color: colors.mutedForeground, fontFamily: fonts.body, fontSize: 12, fontWeight: '800', letterSpacing: 1.8 },
  title: { marginTop: 3, color: colors.foreground, fontFamily: fonts.heading, fontSize: 32, fontWeight: '800' },
  subtitle: { marginTop: 3, color: colors.mutedForeground, fontFamily: fonts.body, fontSize: 14 },
  settingsButton: { width: 44, height: 44, marginLeft: 16, alignItems: 'center', justifyContent: 'center', borderRadius: 22, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card },
  profileCard: { marginTop: 24, overflow: 'hidden', borderRadius: 16, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card },
  connectedBadge: { margin: 16, marginBottom: 0, alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, backgroundColor: colors.muted },
  connectedText: { color: colors.success, fontFamily: fonts.body, fontSize: 12, fontWeight: '800' },
  profileBody: { padding: 16 },
  profileTopLine: { minHeight: 28, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'flex-end' },
  petCount: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 18, backgroundColor: colors.muted, color: colors.mutedForeground, fontFamily: fonts.body, fontSize: 11, fontWeight: '700' },
  profileName: { marginTop: 12, color: colors.foreground, fontFamily: fonts.heading, fontSize: 21, fontWeight: '800' },
  emailLine: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  email: { color: colors.mutedForeground, fontFamily: fonts.body, fontSize: 12 },
  section: { marginTop: 24 },
  sectionTitle: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  sectionHeading: { color: colors.foreground, fontFamily: fonts.heading, fontSize: 21, fontWeight: '800' },
  sectionAction: { color: colors.primary, fontFamily: fonts.body, fontSize: 12, fontWeight: '800' },
  card: { overflow: 'hidden', borderRadius: 16, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card },
  petRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16 },
  petAvatar: { width: 44, height: 44, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', borderRadius: 22 },
  petImage: { width: '100%', height: '100%' },
  rowCopy: { flex: 1, minWidth: 0 },
  rowTitle: { color: colors.foreground, fontFamily: fonts.body, fontSize: 14, fontWeight: '800' },
  rowDescription: { marginTop: 3, color: colors.mutedForeground, fontFamily: fonts.body, fontSize: 12, lineHeight: 17 },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: colors.border },
  editButton: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center', borderRadius: 18, backgroundColor: colors.muted },
  addPetRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16 },
  addIcon: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 20, backgroundColor: colors.accent },
  addTitle: { color: colors.accent, fontFamily: fonts.body, fontSize: 14, fontWeight: '800' },
  preferenceRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16 },
  preferenceIcon: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 20 },
  plusCard: { flexDirection: 'row', gap: 12, marginTop: 24, padding: 16, borderRadius: 16, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.muted },
  plusIcon: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 22, backgroundColor: colors.primary },
  plusCopy: { flex: 1 },
  plusTitleLine: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  plusTitle: { color: colors.foreground, fontFamily: fonts.heading, fontSize: 19, fontWeight: '800' },
  newBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10, backgroundColor: colors.accent, color: colors.accentForeground, fontFamily: fonts.body, fontSize: 10, fontWeight: '800' },
  plusDescription: { marginTop: 4, color: colors.mutedForeground, fontFamily: fonts.body, fontSize: 12, lineHeight: 20 },
  discoverButton: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', marginTop: 10 },
  discoverText: { color: colors.primary, fontFamily: fonts.body, fontSize: 12, fontWeight: '800' },
  footerActions: { gap: 8, marginTop: 24, paddingBottom: 8 },
  logoutButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 13, borderRadius: 16, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card },
  logoutText: { color: colors.foreground, fontFamily: fonts.body, fontSize: 14, fontWeight: '800' },
  deleteText: { paddingVertical: 12, color: colors.destructive, fontFamily: fonts.body, fontSize: 12, fontWeight: '700', textAlign: 'center' },
  disclaimer: { color: colors.mutedForeground, fontFamily: fonts.body, fontSize: 11, lineHeight: 16, textAlign: 'center' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(23,53,44,0.45)', justifyContent: 'flex-end' },
  modalCard: { backgroundColor: colors.card, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: 36, gap: 6 },
  modalTitle: { color: colors.foreground, fontFamily: fonts.heading, fontSize: 20, fontWeight: '900' },
  modalLabel: { color: colors.mutedForeground, fontFamily: fonts.body, fontSize: 11, fontWeight: '800', marginTop: 10, marginBottom: 6 },
  modalInput: { height: 46, borderRadius: 14, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.input, paddingHorizontal: 14, color: colors.foreground, fontFamily: fonts.body, fontSize: 14 },
  speciesRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  speciesChip: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 14, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.muted },
  speciesChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  speciesChipText: { color: colors.mutedForeground, fontFamily: fonts.body, fontSize: 11, fontWeight: '800' },
  speciesChipTextActive: { color: colors.primaryForeground },
  modalActions: { flexDirection: 'row', gap: 10, marginTop: 18 },
  modalCancel: { flex: 1, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.border },
  modalCancelText: { color: colors.mutedForeground, fontFamily: fonts.body, fontSize: 13, fontWeight: '800' },
  privacyScroll: { maxHeight: 360, marginTop: 4 },
  privacyPolicyText: { color: colors.foreground, fontFamily: fonts.body, fontSize: 12, lineHeight: 19 },
  modalSubmit: { flex: 1, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primary },
  modalSubmitText: { color: colors.primaryForeground, fontFamily: fonts.body, fontSize: 13, fontWeight: '800' },
  deletePetButton: { marginTop: 14, height: 44, alignItems: 'center', justifyContent: 'center' },
  deletePetText: { color: colors.destructive, fontFamily: fonts.body, fontSize: 12, fontWeight: '700' },
  editPhotoRow: { marginTop: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  editPhotoTapArea: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  editPhotoAvatar: { width: 56, height: 56, borderRadius: 28, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', backgroundColor: colors.muted },
  editPhotoImage: { width: 56, height: 56 },
  editPhotoText: { color: colors.primary, fontFamily: fonts.body, fontSize: 13, fontWeight: '800' },
  editPhotoRemoveText: { color: colors.destructive, fontFamily: fonts.body, fontSize: 12, fontWeight: '800' },
  soundList: { marginTop: 8, gap: 8 },
  soundOption: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, paddingVertical: 13, borderRadius: 14, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.input },
  soundOptionSelected: { borderColor: colors.primary, backgroundColor: colors.muted },
  soundOptionText: { color: colors.foreground, fontFamily: fonts.body, fontSize: 14, fontWeight: '700' },
  soundOptionTextSelected: { color: colors.primary },
  advancedRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.border },
  advancedLabel: { color: colors.mutedForeground, fontFamily: fonts.body, fontSize: 12, fontWeight: '700' },
  advancedValue: { flexShrink: 1, marginLeft: 12, color: colors.foreground, fontFamily: fonts.body, fontSize: 12, fontWeight: '800' },
  advancedActionButton: { marginTop: 16, height: 46, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primary },
  advancedActionText: { color: colors.primaryForeground, fontFamily: fonts.body, fontSize: 13, fontWeight: '800' },
  aboutBrandRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  aboutBrandMark: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primary },
  privacySectionTitle: { marginTop: 14, color: colors.foreground, fontFamily: fonts.body, fontSize: 13, fontWeight: '800' },
  privacyText: { marginTop: 6, color: colors.mutedForeground, fontFamily: fonts.body, fontSize: 13, lineHeight: 20 },
  aboutPrivacyLink: { marginTop: 18, flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 12, paddingHorizontal: 14, borderRadius: 14, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.muted },
  aboutPrivacyLinkText: { flex: 1, color: colors.primary, fontFamily: fonts.body, fontSize: 13, fontWeight: '800' },
  privacyDeleteButton: { marginTop: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 48, borderRadius: 14, borderWidth: 1, borderColor: colors.destructive },
  privacyDeleteText: { color: colors.destructive, fontFamily: fonts.body, fontSize: 13, fontWeight: '800' },
});
