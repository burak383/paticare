import React from 'react';
import { render, fireEvent, waitFor, act } from '@testing-library/react-native';
import HealthRecordScreen from '../screens/HealthRecordScreen';

const mockFetchPetHealth = jest.fn();
const mockAddVaccine = jest.fn();
const mockDeleteVaccine = jest.fn();
const mockAddCondition = jest.fn();
const mockUpdateCondition = jest.fn();
const mockDeleteCondition = jest.fn();
const mockAddVetNote = jest.fn();
const mockUpdateVetNote = jest.fn();
const mockDeleteVetNote = jest.fn();

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
    deleteVaccine: (...args: unknown[]) => mockDeleteVaccine(...args),
    addCondition: (...args: unknown[]) => mockAddCondition(...args),
    updateCondition: (...args: unknown[]) => mockUpdateCondition(...args),
    deleteCondition: (...args: unknown[]) => mockDeleteCondition(...args),
    addVetNote: (...args: unknown[]) => mockAddVetNote(...args),
    updateVetNote: (...args: unknown[]) => mockUpdateVetNote(...args),
    deleteVetNote: (...args: unknown[]) => mockDeleteVetNote(...args),
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
    mockAddCondition.mockResolvedValue({ id: 'cond-1', petId: 'pet-1', title: 'Mevsimsel alerji', note: '', date: '2026-08-28' });
    mockAddVetNote.mockResolvedValue({ id: 'note-1', petId: 'pet-1', vetName: 'Veteriner', date: '2026-08-28', note: 'Kontrol normal.' });
    mockDeleteVaccine.mockResolvedValue(undefined);
  });

  it('opens the add-vaccine modal and calls healthApi.addVaccine on submit', async () => {
    const { getByTestId, findByText } = await render(<HealthRecordScreen />);

    await waitFor(() => expect(mockFetchPetHealth).toHaveBeenCalledWith('pet-1'));

    await fireEvent.press(getByTestId('add-vaccine-button'));
    await findByText('Aşı kaydı ekle');

    await fireEvent.changeText(getByTestId('vaccine-title-input'), 'Kuduz rapeli');
    await fireEvent.changeText(getByTestId('vaccine-date-input'), '2026-09-01');
    await fireEvent.press(getByTestId('vaccine-submit'));

    await waitFor(() => expect(mockAddVaccine).toHaveBeenCalledTimes(1));
    expect(mockAddVaccine).toHaveBeenCalledWith('pet-1', { title: 'Kuduz rapeli', date: '2026-09-01', status: 'upcoming' });
  });

  it('rejects a malformed date instead of silently failing', async () => {
    const alertSpy = jest.spyOn(require('react-native').Alert, 'alert').mockImplementation(() => {});
    const { getByTestId, findByText } = await render(<HealthRecordScreen />);

    await waitFor(() => expect(mockFetchPetHealth).toHaveBeenCalled());
    await fireEvent.press(getByTestId('add-vaccine-button'));
    await findByText('Aşı kaydı ekle');

    await fireEvent.changeText(getByTestId('vaccine-title-input'), 'Kuduz rapeli');
    await fireEvent.changeText(getByTestId('vaccine-date-input'), '01 Eylül 2026');
    await fireEvent.press(getByTestId('vaccine-submit'));

    expect(alertSpy).toHaveBeenCalledWith('Tarih formatı hatalı', expect.any(String));
    expect(mockAddVaccine).not.toHaveBeenCalled();
    alertSpy.mockRestore();
  });
});

describe('HealthRecordScreen — Rahatsızlıklar (conditions)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFetchPetHealth.mockResolvedValue({ pet: mockPet, vaccines: [], weightLogs: [], conditions: [], vetNotes: [] });
    mockAddCondition.mockResolvedValue({ id: 'cond-1', petId: 'pet-1', title: 'Mevsimsel alerji', note: 'Bahar aylarında kaşınma.', date: '2026-08-28' });
  });

  it('opens the add-condition modal and calls healthApi.addCondition on submit', async () => {
    const { getByTestId, getByText, findByText } = await render(<HealthRecordScreen />);

    await waitFor(() => expect(mockFetchPetHealth).toHaveBeenCalledWith('pet-1'));
    await fireEvent.press(getByText('Rahatsızlıklar'));

    await fireEvent.press(getByTestId('add-condition-button'));
    await findByText('Rahatsızlık ekle');

    await fireEvent.changeText(getByTestId('condition-title-input'), 'Mevsimsel alerji');
    await fireEvent.changeText(getByTestId('condition-note-input'), 'Bahar aylarında kaşınma.');
    await fireEvent.press(getByTestId('condition-submit'));

    await waitFor(() => expect(mockAddCondition).toHaveBeenCalledTimes(1));
    expect(mockAddCondition).toHaveBeenCalledWith('pet-1', { title: 'Mevsimsel alerji', note: 'Bahar aylarında kaşınma.' });
    await findByText('Mevsimsel alerji');
  });

  it('rejects an empty title instead of silently failing', async () => {
    const alertSpy = jest.spyOn(require('react-native').Alert, 'alert').mockImplementation(() => {});
    const { getByTestId, getByText, findByText } = await render(<HealthRecordScreen />);

    await waitFor(() => expect(mockFetchPetHealth).toHaveBeenCalled());
    await fireEvent.press(getByText('Rahatsızlıklar'));
    await fireEvent.press(getByTestId('add-condition-button'));
    await findByText('Rahatsızlık ekle');

    await fireEvent.press(getByTestId('condition-submit'));

    expect(alertSpy).toHaveBeenCalledWith('Eksik bilgi', expect.any(String));
    expect(mockAddCondition).not.toHaveBeenCalled();
    alertSpy.mockRestore();
  });
});

describe('HealthRecordScreen — Veteriner notları (vet notes)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFetchPetHealth.mockResolvedValue({ pet: mockPet, vaccines: [], weightLogs: [], conditions: [], vetNotes: [] });
    mockAddVetNote.mockResolvedValue({ id: 'note-1', petId: 'pet-1', vetName: 'Dr. Ayşe Yıldız', date: '2026-08-28', note: 'Kontrol normal.' });
  });

  it('opens the add-vet-note modal and calls healthApi.addVetNote on submit', async () => {
    const { getByTestId, getByText, findByText } = await render(<HealthRecordScreen />);

    await waitFor(() => expect(mockFetchPetHealth).toHaveBeenCalledWith('pet-1'));
    await fireEvent.press(getByText('Veteriner notları'));

    await fireEvent.press(getByTestId('add-vet-note-button'));
    await findByText('Veteriner notu ekle');

    await fireEvent.changeText(getByTestId('vet-note-name-input'), 'Dr. Ayşe Yıldız');
    await fireEvent.changeText(getByTestId('vet-note-text-input'), 'Kontrol normal.');
    await fireEvent.press(getByTestId('vet-note-submit'));

    await waitFor(() => expect(mockAddVetNote).toHaveBeenCalledTimes(1));
    expect(mockAddVetNote).toHaveBeenCalledWith('pet-1', { vetName: 'Dr. Ayşe Yıldız', note: 'Kontrol normal.' });
    await findByText('Dr. Ayşe Yıldız');
  });

  it('rejects an empty note instead of silently failing', async () => {
    const alertSpy = jest.spyOn(require('react-native').Alert, 'alert').mockImplementation(() => {});
    const { getByTestId, getByText, findByText } = await render(<HealthRecordScreen />);

    await waitFor(() => expect(mockFetchPetHealth).toHaveBeenCalled());
    await fireEvent.press(getByText('Veteriner notları'));
    await fireEvent.press(getByTestId('add-vet-note-button'));
    await findByText('Veteriner notu ekle');

    await fireEvent.press(getByTestId('vet-note-submit'));

    expect(alertSpy).toHaveBeenCalledWith('Eksik bilgi', expect.any(String));
    expect(mockAddVetNote).not.toHaveBeenCalled();
    alertSpy.mockRestore();
  });
});

describe('HealthRecordScreen — aşı kaydını sil (delete vaccine)', () => {
  const mockVaccine = { id: 'vac-1', petId: 'pet-1', title: 'Kuduz rapeli', date: '2026-09-01', status: 'upcoming' as const, clinic: null };

  beforeEach(() => {
    jest.clearAllMocks();
    mockFetchPetHealth.mockResolvedValue({ pet: mockPet, vaccines: [mockVaccine], weightLogs: [], conditions: [], vetNotes: [] });
    mockDeleteVaccine.mockResolvedValue(undefined);
  });

  it('confirms and calls healthApi.deleteVaccine, removing the row', async () => {
    const alertSpy = jest.spyOn(require('react-native').Alert, 'alert').mockImplementation((...args: unknown[]) => {
      const buttons = args[2] as Array<{ text: string; onPress?: () => void }> | undefined;
      const destructive = buttons?.find((b) => b.text === 'Sil');
      destructive?.onPress?.();
    });
    const { getByTestId, findByText, queryByText } = await render(<HealthRecordScreen />);

    await findByText('Kuduz rapeli');
    await fireEvent.press(getByTestId('delete-vaccine-vac-1'));

    await waitFor(() => expect(mockDeleteVaccine).toHaveBeenCalledWith('vac-1'));
    await waitFor(() => expect(queryByText('Kuduz rapeli')).toBeNull());
    alertSpy.mockRestore();
  });
});

describe('HealthRecordScreen — rahatsızlığı düzenle/sil (edit/delete condition)', () => {
  const mockCondition = { id: 'cond-1', petId: 'pet-1', title: 'Mevsimsel alerji', note: 'Bahar aylarında kaşınma.', date: '2026-08-28' };

  beforeEach(() => {
    jest.clearAllMocks();
    mockFetchPetHealth.mockResolvedValue({ pet: mockPet, vaccines: [], weightLogs: [], conditions: [mockCondition], vetNotes: [] });
    mockUpdateCondition.mockResolvedValue({ ...mockCondition, title: 'Mevsimsel alerji (güncel)', note: 'Kontrol altında.' });
    mockDeleteCondition.mockResolvedValue(undefined);
  });

  it('opens the edit modal pre-filled and calls healthApi.updateCondition on submit', async () => {
    const { getByTestId, getByText, findByText, findByDisplayValue } = await render(<HealthRecordScreen />);

    await waitFor(() => expect(mockFetchPetHealth).toHaveBeenCalledWith('pet-1'));
    await fireEvent.press(getByText('Rahatsızlıklar'));
    await findByText('Mevsimsel alerji');

    await fireEvent.press(getByTestId('edit-condition-cond-1'));
    await findByText('Rahatsızlığı düzenle');
    await findByDisplayValue('Mevsimsel alerji');

    await fireEvent.changeText(getByTestId('condition-title-input'), 'Mevsimsel alerji (güncel)');
    await fireEvent.changeText(getByTestId('condition-note-input'), 'Kontrol altında.');
    await fireEvent.press(getByTestId('condition-submit'));

    await waitFor(() => expect(mockUpdateCondition).toHaveBeenCalledTimes(1));
    expect(mockUpdateCondition).toHaveBeenCalledWith('cond-1', { title: 'Mevsimsel alerji (güncel)', note: 'Kontrol altında.' });
    expect(mockAddCondition).not.toHaveBeenCalled();
    await findByText('Mevsimsel alerji (güncel)');
  });

  it('confirms and calls healthApi.deleteCondition, removing the row', async () => {
    const alertSpy = jest.spyOn(require('react-native').Alert, 'alert').mockImplementation((...args: unknown[]) => {
      const buttons = args[2] as Array<{ text: string; onPress?: () => void }> | undefined;
      const destructive = buttons?.find((b) => b.text === 'Sil');
      destructive?.onPress?.();
    });
    const { getByTestId, getByText, findByText, queryByText } = await render(<HealthRecordScreen />);

    await waitFor(() => expect(mockFetchPetHealth).toHaveBeenCalledWith('pet-1'));
    await fireEvent.press(getByText('Rahatsızlıklar'));
    await findByText('Mevsimsel alerji');

    await fireEvent.press(getByTestId('delete-condition-cond-1'));

    await waitFor(() => expect(mockDeleteCondition).toHaveBeenCalledWith('cond-1'));
    await waitFor(() => expect(queryByText('Mevsimsel alerji')).toBeNull());
    alertSpy.mockRestore();
  });
});

describe('HealthRecordScreen — veteriner notunu düzenle/sil (edit/delete vet note)', () => {
  const mockVetNote = { id: 'note-1', petId: 'pet-1', vetName: 'Dr. Ayşe Yıldız', date: '2026-08-28', note: 'Kontrol normal.' };

  beforeEach(() => {
    jest.clearAllMocks();
    mockFetchPetHealth.mockResolvedValue({ pet: mockPet, vaccines: [], weightLogs: [], conditions: [], vetNotes: [mockVetNote] });
    mockUpdateVetNote.mockResolvedValue({ ...mockVetNote, note: 'Takipte, iyileşiyor.' });
    mockDeleteVetNote.mockResolvedValue(undefined);
  });

  it('opens the edit modal pre-filled and calls healthApi.updateVetNote on submit', async () => {
    const { getByTestId, getByText, findByText, findByDisplayValue } = await render(<HealthRecordScreen />);

    await waitFor(() => expect(mockFetchPetHealth).toHaveBeenCalledWith('pet-1'));
    await fireEvent.press(getByText('Veteriner notları'));
    await findByText('Dr. Ayşe Yıldız');

    await fireEvent.press(getByTestId('edit-vet-note-note-1'));
    await findByText('Veteriner notunu düzenle');
    await findByDisplayValue('Dr. Ayşe Yıldız');

    await fireEvent.changeText(getByTestId('vet-note-text-input'), 'Takipte, iyileşiyor.');
    await fireEvent.press(getByTestId('vet-note-submit'));

    await waitFor(() => expect(mockUpdateVetNote).toHaveBeenCalledTimes(1));
    expect(mockUpdateVetNote).toHaveBeenCalledWith('note-1', { vetName: 'Dr. Ayşe Yıldız', note: 'Takipte, iyileşiyor.' });
    expect(mockAddVetNote).not.toHaveBeenCalled();
    // The note is rendered as `&ldquo;{note}&rdquo;` — three sibling text
    // nodes inside one <Text>, so its full content is the quote marks glued
    // directly onto the note text with no exact-match-friendly boundary.
    // A regex substring matches; a plain (content, element) => boolean
    // function matcher does not work with this RNTL version's getByText.
    await findByText(/Takipte, iyileşiyor\./);
  });

  it('confirms and calls healthApi.deleteVetNote, removing the row', async () => {
    const alertSpy = jest.spyOn(require('react-native').Alert, 'alert').mockImplementation((...args: unknown[]) => {
      const buttons = args[2] as Array<{ text: string; onPress?: () => void }> | undefined;
      const destructive = buttons?.find((b) => b.text === 'Sil');
      destructive?.onPress?.();
    });
    const { getByTestId, getByText, findByText, queryByText } = await render(<HealthRecordScreen />);

    await waitFor(() => expect(mockFetchPetHealth).toHaveBeenCalledWith('pet-1'));
    await fireEvent.press(getByText('Veteriner notları'));
    await findByText('Dr. Ayşe Yıldız');

    await fireEvent.press(getByTestId('delete-vet-note-note-1'));

    await waitFor(() => expect(mockDeleteVetNote).toHaveBeenCalledWith('note-1'));
    await waitFor(() => expect(queryByText('Dr. Ayşe Yıldız')).toBeNull());
    alertSpy.mockRestore();
  });
});

describe('HealthRecordScreen — pull-to-refresh', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFetchPetHealth.mockResolvedValue({ pet: mockPet, vaccines: [], weightLogs: [], conditions: [], vetNotes: [] });
  });

  it('refetches the health record when the list is pulled to refresh', async () => {
    const { getByTestId } = await render(<HealthRecordScreen />);
    await waitFor(() => expect(mockFetchPetHealth).toHaveBeenCalledWith('pet-1'));
    mockFetchPetHealth.mockClear();

    await act(async () => {
      getByTestId('health-record-scroll').props.refreshControl.props.onRefresh();
    });

    await waitFor(() => expect(mockFetchPetHealth).toHaveBeenCalledWith('pet-1'));
  });
});
