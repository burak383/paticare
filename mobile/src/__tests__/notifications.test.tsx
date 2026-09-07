// Focused unit coverage for registerForPushNotifications() — the one piece
// of notifications.ts with real branching logic (missing EAS project id,
// permission refused, token fetch failing) rather than a thin wrapper around
// a single expo-notifications call. The rest of notifications.ts is already
// exercised indirectly through CalendarScreen/HomeScreen's mocked-notification
// tests.
const mockGetPermissionsAsync = jest.fn();
const mockRequestPermissionsAsync = jest.fn();
const mockGetExpoPushTokenAsync = jest.fn();
const mockScheduleNotificationAsync = jest.fn();
const mockCancelScheduledNotificationAsync = jest.fn();
const mockSetNotificationChannelAsync = jest.fn();

jest.mock('expo-notifications', () => ({
  setNotificationHandler: jest.fn(),
  getPermissionsAsync: (...args: unknown[]) => mockGetPermissionsAsync(...args),
  requestPermissionsAsync: (...args: unknown[]) => mockRequestPermissionsAsync(...args),
  getExpoPushTokenAsync: (...args: unknown[]) => mockGetExpoPushTokenAsync(...args),
  scheduleNotificationAsync: (...args: unknown[]) => mockScheduleNotificationAsync(...args),
  cancelScheduledNotificationAsync: (...args: unknown[]) => mockCancelScheduledNotificationAsync(...args),
  cancelAllScheduledNotificationsAsync: jest.fn(),
  setNotificationChannelAsync: (...args: unknown[]) => mockSetNotificationChannelAsync(...args),
  SchedulableTriggerInputTypes: { DATE: 'date' },
  AndroidImportance: { DEFAULT: 3, HIGH: 6 },
}));

let mockExpoConfig: { extra?: { eas?: { projectId?: string } } } | undefined;
jest.mock('expo-constants', () => ({
  __esModule: true,
  default: {
    get expoConfig() {
      return mockExpoConfig;
    },
  },
}));

import { Platform } from 'react-native';
import {
  registerForPushNotifications,
  getRegisteredPushToken,
  scheduleCareItemReminder,
  sendTestNotification,
} from '../notifications';
import type { CareItem } from '../api';

describe('registerForPushNotifications', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockExpoConfig = { extra: { eas: { projectId: 'test-project-id' } } };
    mockGetPermissionsAsync.mockResolvedValue({ granted: true, canAskAgain: true, status: 'granted' });
  });

  it('returns the Expo push token when permission is granted and a project id is configured, and remembers it for getRegisteredPushToken()', async () => {
    mockGetExpoPushTokenAsync.mockResolvedValue({ data: 'ExponentPushToken[abc123]' });

    const token = await registerForPushNotifications();

    expect(mockGetExpoPushTokenAsync).toHaveBeenCalledWith({ projectId: 'test-project-id' });
    expect(token).toBe('ExponentPushToken[abc123]');
    // AuthContext.logout() reads this to unregister exactly this device's
    // token, not every token the account has — see AuthContext.test.tsx.
    expect(getRegisteredPushToken()).toBe('ExponentPushToken[abc123]');
  });

  it('returns null without calling Expo when notification permission is refused', async () => {
    mockGetPermissionsAsync.mockResolvedValue({ granted: false, canAskAgain: false, status: 'denied' });

    const token = await registerForPushNotifications();

    expect(token).toBeNull();
    expect(mockGetExpoPushTokenAsync).not.toHaveBeenCalled();
  });

  it('returns null instead of throwing when no EAS project id is configured (app.json extra.eas.projectId missing)', async () => {
    mockExpoConfig = { extra: {} };

    const token = await registerForPushNotifications();

    expect(token).toBeNull();
    expect(mockGetExpoPushTokenAsync).not.toHaveBeenCalled();
  });

  it('returns null instead of throwing when Expo\'s token endpoint rejects', async () => {
    mockGetExpoPushTokenAsync.mockRejectedValue(new Error('network error'));

    const token = await registerForPushNotifications();

    expect(token).toBeNull();
  });
});

// notifyBefore used to be silently ignored here — a care item always fired
// its local notification exactly on time, no matter what notifyBefore said.
// The backend's reminderScheduler.js DOES honor it for server push, so a
// user with both enabled could get two notifications for the same reminder
// at two different moments. This coverage locks in the fix: the local
// notification now fires notifyBefore minutes early too, same as the server.
describe('scheduleCareItemReminder — honors notifyBefore lead time', () => {
  const baseItem: CareItem = {
    id: 'ci-1',
    petId: 'pet-1',
    ownerId: 'user-1',
    kind: 'medication',
    title: 'Kalp ilacı',
    description: '',
    tag: null,
    date: '2026-08-29',
    time: '09:30',
    recurrence: 'Bir kez',
    notifyBefore: 0,
    status: 'pending',
    completedAt: null,
    createdAt: new Date().toISOString(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockGetPermissionsAsync.mockResolvedValue({ granted: true, canAskAgain: true, status: 'granted' });
    mockCancelScheduledNotificationAsync.mockResolvedValue(undefined);
    mockScheduleNotificationAsync.mockResolvedValue(undefined);
    // "Now" = 2026-08-29 09:00 local — every case below is expressed
    // relative to this fixed instant.
    jest.useFakeTimers().setSystemTime(new Date(2026, 7, 29, 9, 0, 0, 0));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('fires exactly at the item’s time when notifyBefore is 0', async () => {
    const id = await scheduleCareItemReminder(baseItem, 'Ares');

    expect(id).toBe('care-item-ci-1');
    expect(mockScheduleNotificationAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        content: expect.objectContaining({ body: 'Kalp ilacı' }),
        trigger: { type: 'date', date: new Date(2026, 7, 29, 9, 30, 0, 0) },
      }),
    );
  });

  it('fires notifyBefore minutes early, and says the actual time in the body', async () => {
    const id = await scheduleCareItemReminder({ ...baseItem, notifyBefore: 15 }, 'Ares');

    expect(id).toBe('care-item-ci-1');
    expect(mockScheduleNotificationAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        content: expect.objectContaining({ body: 'Kalp ilacı — saat 09:30' }),
        trigger: { type: 'date', date: new Date(2026, 7, 29, 9, 15, 0, 0) },
      }),
    );
  });

  it('does not schedule when the lead-adjusted trigger has already passed, even though the item’s own time is still ahead', async () => {
    // Item is at 09:10 (still in the future relative to "now" = 09:00), but a
    // 15-minute lead time pushes the trigger back to 08:55 — already past.
    const id = await scheduleCareItemReminder({ ...baseItem, time: '09:10', notifyBefore: 15 }, 'Ares');

    expect(id).toBeNull();
    expect(mockScheduleNotificationAsync).not.toHaveBeenCalled();
  });
});

// Covers the sound-preference mapping added for the "Bildirim sesi" setting
// in Profil — previously every reminder hardcoded `sound: true` no matter
// what the user picked there. iOS/web resolve sound purely through
// content.sound; Android additionally needs a matching notification channel
// (a channel's sound can't change after creation, so a distinct channel is
// created per distinct preference).
describe('scheduleCareItemReminder and sendTestNotification — sound preference', () => {
  const originalPlatformOS = Platform.OS;
  const baseItem: CareItem = {
    id: 'ci-2',
    petId: 'pet-1',
    ownerId: 'user-1',
    kind: 'medication',
    title: 'Kalp ilacı',
    description: '',
    tag: null,
    date: '2026-08-29',
    time: '09:30',
    recurrence: 'Bir kez',
    notifyBefore: 0,
    status: 'pending',
    completedAt: null,
    createdAt: new Date().toISOString(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockGetPermissionsAsync.mockResolvedValue({ granted: true, canAskAgain: true, status: 'granted' });
    mockCancelScheduledNotificationAsync.mockResolvedValue(undefined);
    mockScheduleNotificationAsync.mockResolvedValue(undefined);
    mockSetNotificationChannelAsync.mockResolvedValue(undefined);
    jest.useFakeTimers().setSystemTime(new Date(2026, 7, 29, 9, 0, 0, 0));
  });

  afterEach(() => {
    jest.useRealTimers();
    Platform.OS = originalPlatformOS;
  });

  it('on iOS, maps a named preset to its bundled filename via content.sound and never touches notification channels', async () => {
    Platform.OS = 'ios';
    await scheduleCareItemReminder(baseItem, 'Ares', 'Zil');

    expect(mockScheduleNotificationAsync).toHaveBeenCalledWith(
      expect.objectContaining({ content: expect.objectContaining({ sound: 'bell.wav' }) }),
    );
    expect(mockSetNotificationChannelAsync).not.toHaveBeenCalled();
  });

  it('on iOS, "Sessiz" resolves to sound: false and "Varsayılan" (or no preference) resolves to sound: true', async () => {
    Platform.OS = 'ios';
    await scheduleCareItemReminder(baseItem, 'Ares', 'Sessiz');
    expect(mockScheduleNotificationAsync).toHaveBeenLastCalledWith(
      expect.objectContaining({ content: expect.objectContaining({ sound: false }) }),
    );

    await scheduleCareItemReminder(baseItem, 'Ares', 'Varsayılan');
    expect(mockScheduleNotificationAsync).toHaveBeenLastCalledWith(
      expect.objectContaining({ content: expect.objectContaining({ sound: true }) }),
    );

    await scheduleCareItemReminder(baseItem, 'Ares');
    expect(mockScheduleNotificationAsync).toHaveBeenLastCalledWith(
      expect.objectContaining({ content: expect.objectContaining({ sound: true }) }),
    );
  });

  it('on Android, creates (once) a channel matching the preference and schedules against it — a repeat preference reuses the channel', async () => {
    Platform.OS = 'android';
    await scheduleCareItemReminder(baseItem, 'Ares', 'Ping');

    expect(mockSetNotificationChannelAsync).toHaveBeenCalledWith(
      'care-items-ping',
      expect.objectContaining({ sound: 'ping.wav', importance: 6 }),
    );
    expect(mockScheduleNotificationAsync).toHaveBeenCalledWith(
      expect.objectContaining({ trigger: expect.objectContaining({ channelId: 'care-items-ping' }) }),
    );

    mockSetNotificationChannelAsync.mockClear();
    await scheduleCareItemReminder({ ...baseItem, id: 'ci-3' }, 'Ares', 'Ping');
    expect(mockSetNotificationChannelAsync).not.toHaveBeenCalled();
  });

  it('on Android, "Sessiz" creates a distinct low-importance channel with no sound', async () => {
    Platform.OS = 'android';
    await scheduleCareItemReminder(baseItem, 'Ares', 'Sessiz');

    expect(mockSetNotificationChannelAsync).toHaveBeenCalledWith(
      'care-items-silent',
      expect.objectContaining({ sound: null, importance: 3 }),
    );
  });

  it('sendTestNotification applies the same sound preference and fires immediately', async () => {
    Platform.OS = 'ios';
    const sent = await sendTestNotification('Nazik pati sesi');

    expect(sent).toBe(true);
    expect(mockScheduleNotificationAsync).toHaveBeenCalledWith({
      content: expect.objectContaining({ sound: 'gentle_paw.wav' }),
      trigger: null,
    });
  });

  it('sendTestNotification on Android fires against the matching channel instead of trigger: null', async () => {
    Platform.OS = 'android';
    await sendTestNotification('Zil');

    expect(mockScheduleNotificationAsync).toHaveBeenCalledWith(
      expect.objectContaining({ trigger: { channelId: 'care-items-bell' } }),
    );
  });
});
