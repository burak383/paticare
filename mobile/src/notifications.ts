import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import type { CareItem } from './api';

// Without this, iOS/Android would swallow a notification silently while the
// app is in the foreground — this makes it show up like a normal push even
// while PatiCare is open. `shouldShowBanner` (iOS banner) / `shouldShowList`
// (iOS notification center) replaced the older single `shouldShowAlert` flag
// as of expo-notifications 0.31 — both are set true for the same "show it
// like a normal push" behavior on iOS; Android is governed separately by
// each notification's channel (see SOUND_FILES/ensureAndroidSoundChannel
// below).
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export type NotificationPermission = 'granted' | 'denied' | 'undetermined';

export async function getNotificationPermission(): Promise<NotificationPermission> {
  if (Platform.OS === 'web') return 'denied';
  const { status } = await Notifications.getPermissionsAsync();
  return status as NotificationPermission;
}

export async function ensureNotificationPermission(): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  const existing = await Notifications.getPermissionsAsync();
  if (existing.granted) return true;
  if (!existing.canAskAgain) return false;
  const requested = await Notifications.requestPermissionsAsync();
  return requested.granted;
}

function identifierFor(careItemId: string) {
  return `care-item-${careItemId}`;
}

// Mirrors ProfileScreen.tsx's SOUND_OPTIONS exactly — that screen is the only
// place a user picks one of these, so this type is the source of truth for
// what a stored `notificationSound` preference string can be.
export type SoundPreference = 'Varsayılan' | 'Nazik pati sesi' | 'Zil' | 'Ping' | 'Sessiz';

// Filenames registered in app.json's expo-notifications plugin `sounds`
// array, which is what actually bundles them into a native build. IMPORTANT:
// Expo Go has no way to play a custom sound at all — it always plays the
// system default regardless of what's passed here. These only take effect in
// a real EAS dev/production build (see README.md's "Bilinen sınırlar").
const SOUND_FILES: Partial<Record<SoundPreference, string>> = {
  'Nazik pati sesi': 'gentle-paw.wav',
  Zil: 'bell.wav',
  Ping: 'ping.wav',
};

// expo-notifications' content.sound accepts `true` (system default), a
// falsy value (silent), or a bundled filename string — but that filename
// form only has any effect on iOS. Android ignores content.sound entirely;
// its sound is fixed by whichever channel the notification is posted to
// (see ensureAndroidSoundChannel below), so this value is harmless-but-inert
// there rather than wrong.
function soundContentValue(pref?: string | null): boolean | string {
  if (pref === 'Sessiz') return false;
  const file = pref ? SOUND_FILES[pref as SoundPreference] : undefined;
  return file ?? true;
}

// Channels created so far this app session, so repeated reminders for the
// same sound preference don't redundantly recreate an already-existing
// channel. Not persisted — recreating a channel with the same id is a no-op
// on Android anyway, this purely avoids the redundant native call.
const ensuredAndroidChannels = new Set<string>();

function androidChannelIdFor(pref?: string | null): string {
  if (pref === 'Sessiz') return 'care-items-silent';
  const file = pref ? SOUND_FILES[pref as SoundPreference] : undefined;
  return file ? `care-items-${file.replace(/\.[^.]+$/, '')}` : 'care-items-default';
}

// Android has no per-notification sound — a channel's sound is fixed the
// moment the channel is created and can never be changed afterwards, so
// "use this sound for this reminder" has to mean "post to the channel that
// was created with this sound", one channel per distinct preference rather
// than one shared channel. Returns undefined on iOS/web, where this doesn't
// apply and content.sound (see above) is what actually governs playback.
async function ensureAndroidSoundChannel(pref?: string | null): Promise<string | undefined> {
  if (Platform.OS !== 'android') return undefined;
  const channelId = androidChannelIdFor(pref);
  if (ensuredAndroidChannels.has(channelId)) return channelId;
  const file = pref ? SOUND_FILES[pref as SoundPreference] : undefined;
  await Notifications.setNotificationChannelAsync(channelId, {
    name: pref === 'Sessiz' ? 'Hatırlatıcılar (sessiz)' : 'Hatırlatıcılar',
    importance: pref === 'Sessiz' ? Notifications.AndroidImportance.DEFAULT : Notifications.AndroidImportance.HIGH,
    sound: pref === 'Sessiz' ? null : file ?? 'default',
  });
  ensuredAndroidChannels.add(channelId);
  return channelId;
}

// Schedules (or replaces) a local reminder for a pending care item, firing
// `item.notifyBefore` minutes before its date+time (0 if unset — fires right
// at the scheduled moment). This mirrors backend/src/reminderScheduler.js's
// lead time, which does the same offset for server-triggered push — the two
// used to disagree (this one ignored notifyBefore entirely and always fired
// exactly on time), which meant a user with both enabled could get two
// notifications for the same reminder at two different moments.
// Returns the notification identifier, or null if nothing was scheduled —
// because the moment has already passed, permission was refused, or local
// scheduling isn't supported on this platform (web). The care item itself
// still works without this; it just won't buzz the phone.
export async function scheduleCareItemReminder(
  item: CareItem,
  petName: string,
  soundPreference?: string | null,
): Promise<string | null> {
  if (Platform.OS === 'web') return null;
  if (item.status !== 'pending') return null;

  const granted = await ensureNotificationPermission();
  if (!granted) return null;

  const [hours, minutes] = item.time.split(':').map((n) => Number(n));
  const target = new Date(`${item.date}T00:00:00`);
  target.setHours(Number.isFinite(hours) ? hours : 0, Number.isFinite(minutes) ? minutes : 0, 0, 0);
  const leadMs = (typeof item.notifyBefore === 'number' ? item.notifyBefore : 0) * 60 * 1000;
  const trigger = new Date(target.getTime() - leadMs);
  if (trigger.getTime() <= Date.now()) return null;

  const identifier = identifierFor(item.id);
  const channelId = await ensureAndroidSoundChannel(soundPreference);
  await Notifications.cancelScheduledNotificationAsync(identifier).catch(() => {});
  await Notifications.scheduleNotificationAsync({
    identifier,
    content: {
      title: `${petName} için hatırlatıcı`,
      // When it fires early, the body spells out the actual scheduled time so
      // the notification doesn't read as arriving "for no reason".
      body: leadMs > 0 ? `${item.title} — saat ${item.time}` : item.title,
      sound: soundContentValue(soundPreference),
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: trigger,
      ...(channelId ? { channelId } : {}),
    },
  });
  return identifier;
}

// Cancels a scheduled reminder — call this once a care item is completed,
// skipped, or deleted so a stale notification doesn't fire after the fact.
export async function cancelCareItemReminder(careItemId: string): Promise<void> {
  if (Platform.OS === 'web') return;
  await Notifications.cancelScheduledNotificationAsync(identifierFor(careItemId)).catch(() => {});
}

// Called when the user switches "İlaç hatırlatıcıları" off in Profil — clears
// every pending local notification so nothing buzzes after they've opted out.
export async function cancelAllReminders(): Promise<void> {
  if (Platform.OS === 'web') return;
  await Notifications.cancelAllScheduledNotificationsAsync().catch(() => {});
}

// Holds whatever token THIS app session last successfully registered, purely
// in memory (never persisted — a fresh process starts with this null again,
// same as api/client.ts's inMemoryToken pattern). AuthContext.logout() reads
// it via getRegisteredPushToken() to unregister exactly this device's token
// server-side, without touching any other device signed into the same
// account — see routes/users.js's push-token routes for why that matters.
let registeredPushToken: string | null = null;

export function getRegisteredPushToken(): string | null {
  return registeredPushToken;
}

// Gets this device's Expo push token, for the SERVER (backend/src/reminderScheduler.js)
// to push reminders to — distinct from scheduleCareItemReminder above, which
// schedules a purely on-device notification that never touches the network.
// This is the one that still reaches the user if the app was force-quit or
// reinstalled since the local notification was scheduled.
//
// Requires an EAS project id (app.json's `extra.eas.projectId`, set by
// running `eas init` in the mobile/ folder) — Expo has no project to issue a
// token under without one. Returns null (and just logs a warning) rather
// than throwing when that's missing, on web, or if permission is refused —
// local reminders keep working regardless either way.
export async function registerForPushNotifications(): Promise<string | null> {
  if (Platform.OS === 'web') return null;
  const granted = await ensureNotificationPermission();
  if (!granted) return null;

  const projectId =
    Constants.expoConfig?.extra?.eas?.projectId ?? (Constants as unknown as { easConfig?: { projectId?: string } }).easConfig?.projectId;
  if (!projectId) {
    console.warn(
      '[PatiCare] Push bildirimi token’ı alınamadı: EAS proje kimliği eksik (app.json > expo.extra.eas.projectId). "eas init" çalıştırman gerekiyor.',
    );
    return null;
  }

  try {
    const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
    registeredPushToken = token;
    return token;
  } catch (err) {
    console.warn('[PatiCare] Push bildirimi token’ı alınamadı:', err);
    return null;
  }
}

// Fires an immediate local notification so the user can confirm PatiCare's
// reminders actually reach their device (used by the "Bildirimi test et"
// button in Gelişmiş ayarlar). Returns false if permission wasn't granted.
export async function sendTestNotification(soundPreference?: string | null): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  const granted = await ensureNotificationPermission();
  if (!granted) return false;
  const channelId = await ensureAndroidSoundChannel(soundPreference);
  await Notifications.scheduleNotificationAsync({
    content: { title: 'PatiCare', body: 'Bildirimler çalışıyor. 🐾', sound: soundContentValue(soundPreference) },
    trigger: channelId ? { channelId } : null,
  });
  return true;
}
