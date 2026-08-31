import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import CalendarScreen from '../screens/CalendarScreen';

const mockListCareItems = jest.fn();
const mockCreateCareItem = jest.fn();

jest.mock('@react-navigation/native', () => ({
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
    createCareItem: (...args: unknown[]) => mockCreateCareItem(...args),
    completeCareItem: jest.fn(),
    skipCareItem: jest.fn(),
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
  scheduleCareItemReminder: jest.fn().mockResolvedValue(null),
  cancelCareItemReminder: jest.fn().mockResolvedValue(undefined),
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
    const { getByTestId, findByText } = render(<CalendarScreen />);

    await waitFor(() => expect(mockListCareItems).toHaveBeenCalled());

    fireEvent.press(getByTestId('add-reminder-button'));
    await findByText('Yeni hatırlatıcı');

    fireEvent.changeText(getByTestId('reminder-title-input'), 'Kalp ilacı');
    fireEvent.changeText(getByTestId('reminder-time-input'), '09:00');
    fireEvent.press(getByTestId('reminder-submit'));

    await waitFor(() => expect(mockCreateCareItem).toHaveBeenCalledTimes(1));
    expect(mockCreateCareItem).toHaveBeenCalledWith(
      expect.objectContaining({ petId: 'pet-1', title: 'Kalp ilacı', time: '09:00', kind: 'medication' }),
    );
  });

  it('rejects a malformed time instead of silently failing', async () => {
    const alertSpy = jest.spyOn(require('react-native').Alert, 'alert').mockImplementation(() => {});
    const { getByTestId, findByText } = render(<CalendarScreen />);

    await waitFor(() => expect(mockListCareItems).toHaveBeenCalled());
    fireEvent.press(getByTestId('add-reminder-button'));
    await findByText('Yeni hatırlatıcı');

    fireEvent.changeText(getByTestId('reminder-title-input'), 'Kalp ilacı');
    fireEvent.changeText(getByTestId('reminder-time-input'), 'sabah erken');
    fireEvent.press(getByTestId('reminder-submit'));

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
    const { findByText, getByTestId } = render(<CalendarScreen />);

    await findByText('Kuduz aşısı');
    fireEvent.press(getByTestId('upcoming-item-ci-upcoming'));

    await findByText('10 Eylül');
  });
});
