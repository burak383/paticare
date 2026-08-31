import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import HealthRecordScreen from '../screens/HealthRecordScreen';

const mockFetchPetHealth = jest.fn();
const mockAddVaccine = jest.fn();

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
  healthApi: {
    fetchPetHealth: (...args: unknown[]) => mockFetchPetHealth(...args),
    addVaccine: (...args: unknown[]) => mockAddVaccine(...args),
    updateVaccine: jest.fn(),
    exportHealthReport: jest.fn(),
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

describe('HealthRecordScreen — Kayıt ekle (add vaccine) button', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFetchPetHealth.mockResolvedValue({ pet: mockPet, vaccines: [], weightLogs: [], conditions: [], vetNotes: [] });
    mockAddVaccine.mockResolvedValue({ id: 'vac-1', petId: 'pet-1', title: 'Kuduz rapeli', date: '2026-09-01', status: 'upcoming', clinic: null });
  });

  it('opens the add-vaccine modal and calls healthApi.addVaccine on submit', async () => {
    const { getByTestId, findByText } = render(<HealthRecordScreen />);

    await waitFor(() => expect(mockFetchPetHealth).toHaveBeenCalledWith('pet-1'));

    fireEvent.press(getByTestId('add-vaccine-button'));
    await findByText('Aşı kaydı ekle');

    fireEvent.changeText(getByTestId('vaccine-title-input'), 'Kuduz rapeli');
    fireEvent.changeText(getByTestId('vaccine-date-input'), '2026-09-01');
    fireEvent.press(getByTestId('vaccine-submit'));

    await waitFor(() => expect(mockAddVaccine).toHaveBeenCalledTimes(1));
    expect(mockAddVaccine).toHaveBeenCalledWith('pet-1', { title: 'Kuduz rapeli', date: '2026-09-01', status: 'upcoming' });
  });

  it('rejects a malformed date instead of silently failing', async () => {
    const alertSpy = jest.spyOn(require('react-native').Alert, 'alert').mockImplementation(() => {});
    const { getByTestId, findByText } = render(<HealthRecordScreen />);

    await waitFor(() => expect(mockFetchPetHealth).toHaveBeenCalled());
    fireEvent.press(getByTestId('add-vaccine-button'));
    await findByText('Aşı kaydı ekle');

    fireEvent.changeText(getByTestId('vaccine-title-input'), 'Kuduz rapeli');
    fireEvent.changeText(getByTestId('vaccine-date-input'), '01 Eylül 2026');
    fireEvent.press(getByTestId('vaccine-submit'));

    expect(alertSpy).toHaveBeenCalledWith('Tarih formatı hatalı', expect.any(String));
    expect(mockAddVaccine).not.toHaveBeenCalled();
    alertSpy.mockRestore();
  });
});
