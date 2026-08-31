import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import HomeScreen from '../screens/HomeScreen';

const mockListCareItems = jest.fn();
const mockCompleteCareItem = jest.fn();
const mockSkipCareItem = jest.fn();
const mockNavigate = jest.fn();
const mockSelectPet = jest.fn();
const mockCancelCareItemReminder = jest.fn();
const mockScheduleCareItemReminder = jest.fn();

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: mockNavigate }),
  useFocusEffect: (callback: () => void | (() => void)) => {
    const ReactActual = require('react');
    ReactActual.useEffect(() => {
      const cleanup = callback();
      return cleanup as void;
    }, []);
  },
}));

jest.mock('../api', () => ({
  careItemsApi: {
    listCareItems: (...args: unknown[]) => mockListCareItems(...args),
    completeCareItem: (...args: unknown[]) => mockCompleteCareItem(...args),
    skipCareItem: (...args: unknown[]) => mockSkipCareItem(...args),
  },
}));

jest.mock('../notifications', () => ({
  cancelCareItemReminder: (...args: unknown[]) => mockCancelCareItemReminder(...args),
  scheduleCareItemReminder: (...args: unknown[]) => mockScheduleCareItemReminder(...args),
}));

jest.mock('../context/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'user-1', preferences: { medicationReminders: true } } }),
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
  usePets: () => ({
    pets: [mockPet],
    selectedPet: mockPet,
    loading: false,
    refreshPets: jest.fn(),
    selectPet: mockSelectPet,
    addPet: jest.fn(),
    updatePetLocal: jest.fn(),
  }),
}));

const pendingItem = {
  id: 'ci-1',
  petId: 'pet-1',
  ownerId: 'user-1',
  kind: 'medication' as const,
  title: 'Kalp ilacı',
  description: '1 tablet',
  tag: null,
  date: new Date().toISOString().slice(0, 10),
  time: '09:00',
  recurrence: 'Bir kez',
  notifyBefore: 15,
  status: 'pending' as const,
  completedAt: null,
  createdAt: new Date().toISOString(),
};

describe('HomeScreen — bugünün görevleri', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockListCareItems.mockResolvedValue([]);
  });

  it('shows the empty state when there are no tasks today', async () => {
    const { findByText } = await render(<HomeScreen />);
    await findByText('Bugün için planlanmış görev yok.');
  });

  it('loads and renders today’s tasks for the selected pet', async () => {
    mockListCareItems.mockResolvedValue([pendingItem]);
    const { findByText } = await render(<HomeScreen />);

    await waitFor(() => expect(mockListCareItems).toHaveBeenCalledWith({ petId: 'pet-1', date: expect.any(String) }));
    await findByText('Kalp ilacı');
    await findByText('1 görev');
  });

  it('completing a task calls careItemsApi.completeCareItem and cancels its reminder', async () => {
    mockListCareItems.mockResolvedValue([pendingItem]);
    mockCompleteCareItem.mockResolvedValue({
      careItem: { ...pendingItem, status: 'done', completedAt: new Date().toISOString() },
      nextOccurrence: null,
    });
    mockCancelCareItemReminder.mockResolvedValue(undefined);

    const { findByLabelText } = await render(<HomeScreen />);
    const completeButton = await findByLabelText('Kalp ilacı tamamla');
    await fireEvent.press(completeButton);

    await waitFor(() => expect(mockCompleteCareItem).toHaveBeenCalledWith('ci-1'));
    await waitFor(() => expect(mockCancelCareItemReminder).toHaveBeenCalledWith('ci-1'));
    // A one-off item's nextOccurrence is null — nothing to schedule.
    expect(mockScheduleCareItemReminder).not.toHaveBeenCalled();
  });

  it('completing a recurring task schedules a reminder for the spawned next occurrence', async () => {
    const recurringItem = { ...pendingItem, recurrence: 'Her gün' };
    const nextOccurrence = { ...recurringItem, id: 'ci-2', date: '2099-01-02', status: 'pending' as const };
    mockListCareItems.mockResolvedValue([recurringItem]);
    mockCompleteCareItem.mockResolvedValue({
      careItem: { ...recurringItem, status: 'done', completedAt: new Date().toISOString() },
      nextOccurrence,
    });
    mockCancelCareItemReminder.mockResolvedValue(undefined);
    mockScheduleCareItemReminder.mockResolvedValue('notif-id');

    const { findByLabelText } = await render(<HomeScreen />);
    const completeButton = await findByLabelText('Kalp ilacı tamamla');
    await fireEvent.press(completeButton);

    await waitFor(() => expect(mockScheduleCareItemReminder).toHaveBeenCalledWith(nextOccurrence, 'Ares', undefined));
  });

  it('skipping a task calls careItemsApi.skipCareItem', async () => {
    mockListCareItems.mockResolvedValue([pendingItem]);
    mockSkipCareItem.mockResolvedValue({ careItem: { ...pendingItem, status: 'skipped' }, nextOccurrence: null });

    const { findByText } = await render(<HomeScreen />);
    const skipButton = await findByText('Atla');
    await fireEvent.press(skipButton);

    await waitFor(() => expect(mockSkipCareItem).toHaveBeenCalledWith('ci-1'));
  });

  it('shows an alert when loading tasks fails instead of leaving a blank screen', async () => {
    mockListCareItems.mockRejectedValueOnce(new Error('Sunucuya ulaşılamadı.'));
    const alertSpy = jest.spyOn(require('react-native').Alert, 'alert').mockImplementation(() => {});

    await render(<HomeScreen />);

    await waitFor(() => expect(alertSpy).toHaveBeenCalledWith('Hata', 'Sunucuya ulaşılamadı.'));
    alertSpy.mockRestore();
  });

  it('tapping "Ürün tara" navigates to the Tara tab', async () => {
    const { findByText } = await render(<HomeScreen />);
    const scanAction = await findByText('Ürün tara');
    await fireEvent.press(scanAction);

    expect(mockNavigate).toHaveBeenCalledWith('MainTabs', { screen: 'Tara' });
  });

  it('tapping "Ekle" in the pet strip navigates to the Profil tab', async () => {
    const { findByLabelText } = await render(<HomeScreen />);
    const addPet = await findByLabelText('Yeni evcil hayvan ekle');
    await fireEvent.press(addPet);

    expect(mockNavigate).toHaveBeenCalledWith('MainTabs', { screen: 'Profil' });
  });

  it('selecting a pet card calls selectPet', async () => {
    const { findByLabelText } = await render(<HomeScreen />);
    const petCard = await findByLabelText('Ares seç');
    await fireEvent.press(petCard);

    expect(mockSelectPet).toHaveBeenCalledWith('pet-1');
  });
});
