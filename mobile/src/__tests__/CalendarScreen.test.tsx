import React from 'react';
import { render, fireEvent, waitFor, act } from '@testing-library/react-native';
import CalendarScreen from '../screens/CalendarScreen';

const mockListCareItems = jest.fn();
const mockCreateCareItem = jest.fn();
const mockUpdateCareItem = jest.fn();
const mockCompleteCareItem = jest.fn();
const mockSkipCareItem = jest.fn();
// jest.clearAllMocks() (used throughout this file's beforeEach blocks) only
// clears call history, not an already-set mockResolvedValue — so setting the
// default resolution here, once, keeps every existing test's fire-and-forget
// `scheduleCareItemReminder(...).catch(...)` / `cancelCareItemReminder(...).catch(...)`
// calls working without each test having to stub these itself.
const mockScheduleCareItemReminder = jest.fn().mockResolvedValue(null);
const mockCancelCareItemReminder = jest.fn().mockResolvedValue(undefined);

jest.mock('@react-navigation/native', () => ({
  // Deps on [callback] (not []) so this re-fires whenever the screen's own
  // `load` identity changes (e.g. selectedDate changes after tapping a day
  // cell) — matching real useFocusEffect's behavior of re-running when its
  // callback changes while the screen stays focused. A hardcoded []
  // dependency would only ever run this once on mount and silently hide any
  // bug in code that's supposed to refetch after a state change.
  useFocusEffect: (callback: () => void | (() => void)) => {
    const ReactActual = require('react');
    ReactActual.useEffect(() => {
      const cleanup = callback();
      return cleanup as void;
    }, [callback]);
  },
}));

jest.mock('../api', () => ({
  careItemsApi: {
    listCareItems: (...args: unknown[]) => mockListCareItems(...args),
    createCareItem: (...args: unknown[]) => mockCreateCareItem(...args),
    updateCareItem: (...args: unknown[]) => mockUpdateCareItem(...args),
    completeCareItem: (...args: unknown[]) => mockCompleteCareItem(...args),
    skipCareItem: (...args: unknown[]) => mockSkipCareItem(...args),
    undoCareItem: jest.fn(),
  },
}));

const mockPet = {
  id: 'pet-1',
  ownerId: 'user-1',
  name: 'Ares',
  species: 'Kedi',
  breed: 'European Shorthair',
  gender: 'Erkek',
  birthDate: '2023-05-14',
  weightKg: 4,
  neutered: true,
  avatarUrl: null,
  coverUrl: null,
  active: true,
  createdAt: new Date().toISOString(),
};

jest.mock('../context/PetContext', () => ({
  usePets: () => ({ pets: [mockPet], selectedPet: mockPet, loading: false, refreshPets: jest.fn(), selectPet: jest.fn(), addPet: jest.fn(), updatePetLocal: jest.fn() }),
}));

jest.mock('../context/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'user-1', preferences: { medicationReminders: true } } }),
}));

jest.mock('../notifications', () => ({
  scheduleCareItemReminder: (...args: unknown[]) => mockScheduleCareItemReminder(...args),
  cancelCareItemReminder: (...args: unknown[]) => mockCancelCareItemReminder(...args),
}));

describe('CalendarScreen — add reminder (+) button', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockListCareItems.mockResolvedValue([]);
    mockCreateCareItem.mockResolvedValue({
      id: 'ci-1',
      petId: 'pet-1',
      ownerId: 'user-1',
      kind: 'medication',
      title: 'Kalp ilacı',
      description: '',
      tag: null,
      date: new Date().toISOString().slice(0, 10),
      time: '09:00',
      recurrence: 'Bir kez',
      notifyBefore: 15,
      status: 'pending',
      completedAt: null,
      createdAt: new Date().toISOString(),
    });
  });

  it('opens the reminder modal and calls careItemsApi.createCareItem on submit', async () => {
    const { getByTestId, findByText } = await render(<CalendarScreen />);

    await waitFor(() => expect(mockListCareItems).toHaveBeenCalled());

    await fireEvent.press(getByTestId('add-reminder-button'));
    await findByText('Yeni hatırlatıcı');

    await fireEvent.changeText(getByTestId('reminder-title-input'), 'Kalp ilacı');
    await fireEvent.changeText(getByTestId('reminder-time-input'), '09:00');
    await fireEvent.press(getByTestId('reminder-submit'));

    await waitFor(() => expect(mockCreateCareItem).toHaveBeenCalledTimes(1));
    expect(mockCreateCareItem).toHaveBeenCalledWith(
      expect.objectContaining({ petId: 'pet-1', title: 'Kalp ilacı', time: '09:00', kind: 'medication' }),
    );
  });

  it('defaults to "Bir kez" and sends the selected recurrence chip on create', async () => {
    const { getByTestId, findByText } = await render(<CalendarScreen />);

    await waitFor(() => expect(mockListCareItems).toHaveBeenCalled());
    await fireEvent.press(getByTestId('add-reminder-button'));
    await findByText('Yeni hatırlatıcı');

    await fireEvent.changeText(getByTestId('reminder-title-input'), 'Kalp ilacı');
    await fireEvent.changeText(getByTestId('reminder-time-input'), '09:00');
    await fireEvent.press(getByTestId('recurrence-chip-Her gün'));
    await fireEvent.press(getByTestId('reminder-submit'));

    await waitFor(() => expect(mockCreateCareItem).toHaveBeenCalledTimes(1));
    expect(mockCreateCareItem).toHaveBeenCalledWith(expect.objectContaining({ recurrence: 'Her gün' }));
  });

  it('rejects a malformed time instead of silently failing', async () => {
    const alertSpy = jest.spyOn(require('react-native').Alert, 'alert').mockImplementation(() => {});
    const { getByTestId, findByText } = await render(<CalendarScreen />);

    await waitFor(() => expect(mockListCareItems).toHaveBeenCalled());
    await fireEvent.press(getByTestId('add-reminder-button'));
    await findByText('Yeni hatırlatıcı');

    await fireEvent.changeText(getByTestId('reminder-title-input'), 'Kalp ilacı');
    await fireEvent.changeText(getByTestId('reminder-time-input'), 'sabah erken');
    await fireEvent.press(getByTestId('reminder-submit'));

    expect(alertSpy).toHaveBeenCalledWith('Saat formatı hatalı', expect.any(String));
    expect(mockCreateCareItem).not.toHaveBeenCalled();
    alertSpy.mockRestore();
  });
});

describe('CalendarScreen — Yaklaşanlar rows', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockListCareItems.mockImplementation((params: { from?: string }) => {
      if (params?.from) {
        return Promise.resolve([
          {
            id: 'ci-upcoming',
            petId: 'pet-1',
            ownerId: 'user-1',
            kind: 'vaccine',
            title: 'Kuduz aşısı',
            description: '',
            tag: null,
            date: '2026-09-10',
            time: '10:00',
            recurrence: 'Bir kez',
            notifyBefore: 15,
            status: 'pending',
            completedAt: null,
            createdAt: new Date().toISOString(),
          },
        ]);
      }
      return Promise.resolve([]);
    });
  });

  it('jumps the day plan to that date when an upcoming item is tapped — it used to do nothing', async () => {
    const { findByText, getByTestId } = await render(<CalendarScreen />);

    await findByText('Kuduz aşısı');
    await fireEvent.press(getByTestId('upcoming-item-ci-upcoming'));

    await findByText('10 Eylül');
  });
});

// Reassigning process.env.TZ from inside a running Node process does NOT
// reliably change what Date/Intl resolve as "local" here (V8/ICU pick up TZ
// once at process start) — verified empirically in this sandbox. So this
// suite's actual timezone coverage comes from the outside: `npm test` runs
// `cross-env TZ=Europe/Istanbul jest` (see mobile/package.json). Running
// `jest` directly (bypassing the npm script) needs the same env var set
// beforehand, e.g. `TZ=Europe/Istanbul npx jest`, or these tests silently
// run under whatever timezone the shell already has (UTC has no offset to
// get wrong, so the regression wouldn't be caught).
describe('CalendarScreen — timezone regression (UTC+ offsets, e.g. Türkiye)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockListCareItems.mockResolvedValue([]);
  });

  it('tapping a day cell must not shift the date sent to the API by a day', async () => {
    const { getByTestId } = await render(<CalendarScreen />);
    await waitFor(() => expect(mockListCareItems).toHaveBeenCalled());
    mockListCareItems.mockClear();

    // Local "today" and its Monday-first index within the visible week —
    // computed independently of the screen's own date-formatting code (day
    // cells are keyed by array index, not by a formatted string) so this
    // test can't accidentally launder the same bug it's meant to catch.
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const localToday = `${year}-${month}-${day}`;
    const jsWeekday = now.getDay(); // 0 = Sunday .. 6 = Saturday
    const todayIndex = jsWeekday === 0 ? 6 : jsWeekday - 1; // Monday-first index

    // This is the cell already shown as "active" (today) — pressing it should
    // be a no-op in terms of which date gets queried.
    await fireEvent.press(getByTestId(`day-cell-${todayIndex}`));

    await waitFor(() =>
      expect(mockListCareItems).toHaveBeenCalledWith(expect.objectContaining({ date: localToday })),
    );
  });
});

describe('CalendarScreen — edit reminder (pencil) button', () => {
  const todayStr = new Date().toISOString().slice(0, 10);
  const existingItem = {
    id: 'ci-1',
    petId: 'pet-1',
    ownerId: 'user-1',
    kind: 'medication' as const,
    title: 'Kalp ilacı',
    description: '1 tablet',
    tag: null,
    date: todayStr,
    time: '09:00',
    recurrence: 'Bir kez',
    notifyBefore: 15,
    status: 'pending' as const,
    completedAt: null,
    createdAt: new Date().toISOString(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockListCareItems.mockImplementation((params: { from?: string }) =>
      Promise.resolve(params?.from ? [] : [existingItem]),
    );
    mockUpdateCareItem.mockResolvedValue({ ...existingItem, title: 'Kalp ilacı (güncel)', time: '10:30' });
  });

  it('opens the edit modal pre-filled and calls careItemsApi.updateCareItem on submit', async () => {
    const { getByTestId, findByText, findByDisplayValue } = await render(<CalendarScreen />);

    await findByText('Kalp ilacı');
    await fireEvent.press(getByTestId('edit-reminder-ci-1'));
    await findByText('Hatırlatıcıyı düzenle');
    await findByDisplayValue('Kalp ilacı');

    await fireEvent.changeText(getByTestId('reminder-title-input'), 'Kalp ilacı (güncel)');
    await fireEvent.changeText(getByTestId('reminder-time-input'), '10:30');
    await fireEvent.press(getByTestId('reminder-submit'));

    await waitFor(() => expect(mockUpdateCareItem).toHaveBeenCalledTimes(1));
    expect(mockUpdateCareItem).toHaveBeenCalledWith(
      'ci-1',
      expect.objectContaining({ title: 'Kalp ilacı (güncel)', time: '10:30' }),
    );
    expect(mockCreateCareItem).not.toHaveBeenCalled();
    await findByText('Kalp ilacı (güncel)');
  });

  it('keeps the item’s existing recurrence on submit when the picker isn’t touched, even for a value with no chip (e.g. "Yıllık")', async () => {
    mockListCareItems.mockImplementation((params: { from?: string }) =>
      Promise.resolve(params?.from ? [] : [{ ...existingItem, recurrence: 'Yıllık' }]),
    );
    mockUpdateCareItem.mockResolvedValue({ ...existingItem, recurrence: 'Yıllık', time: '10:30' });

    const { getByTestId, findByText } = await render(<CalendarScreen />);
    await findByText('Kalp ilacı');
    await fireEvent.press(getByTestId('edit-reminder-ci-1'));
    await findByText('Hatırlatıcıyı düzenle');

    await fireEvent.changeText(getByTestId('reminder-time-input'), '10:30');
    await fireEvent.press(getByTestId('reminder-submit'));

    await waitFor(() => expect(mockUpdateCareItem).toHaveBeenCalledTimes(1));
    expect(mockUpdateCareItem).toHaveBeenCalledWith('ci-1', expect.objectContaining({ recurrence: 'Yıllık' }));
  });
});

describe('CalendarScreen — recurring reminders (complete/skip spawns next occurrence)', () => {
  const todayStr = new Date().toISOString().slice(0, 10);
  const dailyItem = {
    id: 'ci-daily',
    petId: 'pet-1',
    ownerId: 'user-1',
    kind: 'medication' as const,
    title: 'Günlük ilaç',
    description: '',
    tag: null,
    date: todayStr,
    time: '09:00',
    recurrence: 'Her gün',
    notifyBefore: 15,
    status: 'pending' as const,
    completedAt: null,
    createdAt: new Date().toISOString(),
  };
  const onceItem = { ...dailyItem, id: 'ci-once', title: 'Tek seferlik', recurrence: 'Bir kez' };

  beforeEach(() => {
    jest.clearAllMocks();
    mockScheduleCareItemReminder.mockResolvedValue(null);
    mockCancelCareItemReminder.mockResolvedValue(undefined);
  });

  it('completing a recurring item schedules a reminder for the spawned next occurrence returned by the API', async () => {
    mockListCareItems.mockImplementation((params: { from?: string }) =>
      Promise.resolve(params?.from ? [] : [dailyItem]),
    );
    const nextOccurrence = { ...dailyItem, id: 'ci-daily-next', date: '2099-01-02' };
    mockCompleteCareItem.mockResolvedValue({
      careItem: { ...dailyItem, status: 'done', completedAt: new Date().toISOString() },
      nextOccurrence,
    });

    const { findByText } = await render(<CalendarScreen />);
    await findByText('Günlük ilaç');
    await fireEvent.press(await findByText('Verildi'));

    await waitFor(() => expect(mockCompleteCareItem).toHaveBeenCalledWith('ci-daily'));
    await waitFor(() => expect(mockScheduleCareItemReminder).toHaveBeenCalledWith(nextOccurrence, 'Ares', undefined));
  });

  it('completing a one-off ("Bir kez") item does not spawn or schedule anything', async () => {
    mockListCareItems.mockImplementation((params: { from?: string }) =>
      Promise.resolve(params?.from ? [] : [onceItem]),
    );
    mockCompleteCareItem.mockResolvedValue({
      careItem: { ...onceItem, status: 'done', completedAt: new Date().toISOString() },
      nextOccurrence: null,
    });

    const { findByText } = await render(<CalendarScreen />);
    await findByText('Tek seferlik');
    await fireEvent.press(await findByText('Verildi'));

    await waitFor(() => expect(mockCompleteCareItem).toHaveBeenCalledWith('ci-once'));
    expect(mockScheduleCareItemReminder).not.toHaveBeenCalled();
  });

  it('skipping a recurring item also schedules a reminder for the spawned next occurrence', async () => {
    mockListCareItems.mockImplementation((params: { from?: string }) =>
      Promise.resolve(params?.from ? [] : [dailyItem]),
    );
    const nextOccurrence = { ...dailyItem, id: 'ci-daily-next', date: '2099-01-02' };
    mockSkipCareItem.mockResolvedValue({
      careItem: { ...dailyItem, status: 'skipped', completedAt: null },
      nextOccurrence,
    });

    const { findByText } = await render(<CalendarScreen />);
    await findByText('Günlük ilaç');
    await fireEvent.press(await findByText('Atlandı'));

    await waitFor(() => expect(mockSkipCareItem).toHaveBeenCalledWith('ci-daily'));
    await waitFor(() => expect(mockScheduleCareItemReminder).toHaveBeenCalledWith(nextOccurrence, 'Ares', undefined));
  });
});

describe('CalendarScreen — pull-to-refresh', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockListCareItems.mockResolvedValue([]);
  });

  it('refetches the day plan when the list is pulled to refresh', async () => {
    // Pulling isn't a simulatable gesture here, so pull-to-refresh is
    // exercised by invoking the RefreshControl element's onRefresh directly
    // (found via its own testID, see CalendarScreen.tsx) — the same function
    // the OS invokes when the user actually pulls down.
    const { getByTestId } = await render(<CalendarScreen />);
    await waitFor(() => expect(mockListCareItems).toHaveBeenCalled());
    mockListCareItems.mockClear();

    await act(async () => {
      getByTestId('calendar-scroll').props.refreshControl.props.onRefresh();
    });

    await waitFor(() => expect(mockListCareItems).toHaveBeenCalled());
  });
});
