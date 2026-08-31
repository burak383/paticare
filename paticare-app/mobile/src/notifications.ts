import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import type { CareItem } from './api';

// Without this, iOS/Android would swallow a notification silently while the
// app is in the foreground — this makes it show up like a normal push even
// while PatiCare is open.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
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

// Schedules (or replaces) a local reminder for a pending care item at its
// date+time. Returns the notification identifier, or null if nothing was
// scheduled — because the moment has already passed, permission was
// refused, or local scheduling isn't supported on this platform (web).
// The care item itself still works without this; it just won't buzz the phone.
export async function scheduleCareItemReminder(item: CareItem, petName: string): Promise<string | null> {
  if (Platform.OS === 'web') return null;
  if (item.status !== 'pending') return null;

  const granted = await ensureNotificationPermission();
  if (!granted) return null;

  const [hours, minutes] = item.time.split(':').map((n) => Number(n));
  const trigger = new Date(`${item.date}T00:00:00`);
  trigger.setHours(Number.isFinite(hours) ? hours : 0, Number.isFinite(minutes) ? minutes : 0, 0, 0);
  if (trigger.getTime() <= Date.now()) return null;

  const identifier = identifierFor(item.id);
  await Notifications.cancelScheduledNotificationAsync(identifier).catch(() => {});
  await Notifications.scheduleNotificationAsync({
    identifier,
    content: {
      title: `${petName} için hatırlatıcı`,
      body: item.title,
      sound: true,
    },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: trigger },
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

// Fires an immediate local notification so the user can confirm PatiCare's
// reminders actually reach their device (used by the "Bildirimi test et"
// button in Gelişmiş ayarlar). Returns false if permission wasn't granted.
export async function sendTestNotification(): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  const granted = await ensureNotificationPermission();
  if (!granted) return false;
  await Notifications.scheduleNotificationAsync({
    content: { title: 'PatiCare', body: 'Bildirimler çalışıyor. 🐾', sound: true },
    trigger: null,
  });
  return true;
}
