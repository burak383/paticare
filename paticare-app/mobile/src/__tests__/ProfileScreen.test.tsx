import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import ProfileScreen from '../screens/ProfileScreen';

const mockUpdatePet = jest.fn();
const mockDeletePet = jest.fn();
const mockAddPet = jest.fn();
const mockUpdatePetLocal = jest.fn();
const mockRefreshPets = jest.fn();
const mockUpdatePreferences = jest.fn();
const mockDeleteAccount = jest.fn();
const mockEnsureNotificationPermission = jest.fn();
const mockCancelAllReminders = jest.fn();
const mockGetNotificationPermission = jest.fn();
const mockSendTestNotification = jest.fn();

jest.mock('../notifications', () => ({
  ensureNotificationPermission: (...args: unknown[]) => mockEnsureNotificationPermission(...args),
  cancelAllReminders: (...args: unknown[]) => mockCancelAllReminders(...args),
  getNotificationPermission: (...args: unknown[]) => mockGetNotificationPermission(...args),
  sendTestNotification: (...args: unknown[]) => mockSendTestNotification(...args),
}));

jest.mock('../api', () => ({
  usersApi: {
    updatePreferences: (...args: unknown[]) => mockUpdatePreferences(...args),
    deleteAccount: (...args: unknown[]) => mockDeleteAccount(...args),
  },
  petsApi: {
    updatePet: (...args: unknown[]) => mockUpdatePet(...args),
    deletePet: (...args: unknown[]) => mockDeletePet(...args),
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

const mockSetBiometricEnabled = jest.fn();
const mockUseAuth = jest.fn();

jest.mock('../context/AuthContext', () => ({
  useAuth: () => mockUseAuth(),
}));

const baseAuthValue = {
  user: {
    id: 'user-1',
    email: 'deniz.kaya@email.com',
    name: "Deniz'in Patileri",
    guest: false,
    preferences: {
      medicationReminders: true,
      defaultReminderMorning: '09:00',
      defaultReminderEvening: '20:00',
      notificationSound: 'Nazik pati sesi',
      language: 'Türkçe',
    },
    createdAt: new Date().toISOString(),
  },
  logout: jest.fn(),
  biometricSupported: false,
  biometricEnabled: false,
  setBiometricEnabled: (...args: unknown[]) => mockSetBiometricEnabled(...args),
};

jest.mock('../context/PetContext', () => ({
  usePets: () => ({
    pets: [mockPet],
    selectedPet: mockPet,
    loading: false,
    refreshPets: (...args: unknown[]) => mockRefreshPets(...args),
    selectPet: jest.fn(),
    addPet: (...args: unknown[]) => mockAddPet(...args),
    updatePetLocal: (...args: unknown[]) => mockUpdatePetLocal(...args),
  }),
}));

describe('ProfileScreen — edit and add buttons', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUpdatePet.mockResolvedValue({ ...mockPet, name: 'Ares Güncel', weightKg: 4.2 });
    mockAddPet.mockResolvedValue({ ...mockPet, id: 'pet-2', name: 'Zeytin' });
    mockDeletePet.mockResolvedValue(undefined);
    mockRefreshPets.mockResolvedValue(undefined);
    mockUseAuth.mockReturnValue(baseAuthValue);
    mockUpdatePreferences.mockResolvedValue({});
    mockEnsureNotificationPermission.mockResolvedValue(true);
    mockCancelAllReminders.mockResolvedValue(undefined);
    mockGetNotificationPermission.mockResolvedValue('undetermined');
    mockSendTestNotification.mockResolvedValue(true);
  });

  it('opens the edit modal, submits, and calls petsApi.updatePet', async () => {
    const { getByTestId, getByText, queryByText } = render(<ProfileScreen />);

    // Modal content shouldn't exist yet.
    expect(queryByText('Ares profilini düzenle')).toBeNull();

    fireEvent.press(getByTestId('edit-pet-pet-1'));

    await waitFor(() => getByText('Ares profilini düzenle'));

    fireEvent.changeText(getByTestId('edit-pet-name-input'), 'Ares Güncel');
    fireEvent.changeText(getByTestId('edit-pet-weight-input'), '4,2');
    fireEvent.press(getByTestId('edit-pet-submit'));

    await waitFor(() => expect(mockUpdatePet).toHaveBeenCalledTimes(1));
    expect(mockUpdatePet).toHaveBeenCalledWith('pet-1', expect.objectContaining({ name: 'Ares Güncel', weightKg: 4.2 }));
    await waitFor(() => expect(mockUpdatePetLocal).toHaveBeenCalledTimes(1));

    // Modal should close after a successful save.
    await waitFor(() => expect(queryByText('Ares profilini düzenle')).toBeNull());
  });

  it('opens the add-pet modal, submits, and calls PetContext.addPet', async () => {
    const { getByTestId, getByText, queryByText } = render(<ProfileScreen />);

    expect(queryByText('Yeni evcil hayvan ekle', { exact: false })).not.toBeNull(); // row label always visible
    fireEvent.press(getByTestId('add-pet-row'));

    await waitFor(() => getByTestId('add-pet-name-input'));
    fireEvent.changeText(getByTestId('add-pet-name-input'), 'Zeytin');
    fireEvent.press(getByTestId('add-pet-submit'));

    await waitFor(() => expect(mockAddPet).toHaveBeenCalledTimes(1));
    expect(mockAddPet).toHaveBeenCalledWith(expect.objectContaining({ name: 'Zeytin', species: 'Kedi' }));
  });

  it('deletes a pet from the edit modal after confirmation', async () => {
    const alertSpy = jest.spyOn(require('react-native').Alert, 'alert').mockImplementation(
      (...args: unknown[]) => {
        const buttons = args[2] as Array<{ text: string; onPress?: () => void }> | undefined;
        const destructive = buttons?.find((b) => b.text === 'Sil');
        destructive?.onPress?.();
      },
    );
    const { getByTestId, queryByText } = render(<ProfileScreen />);

    fireEvent.press(getByTestId('edit-pet-pet-1'));
    await waitFor(() => getByTestId('delete-pet-button'));
    fireEvent.press(getByTestId('delete-pet-button'));

    await waitFor(() => expect(mockDeletePet).toHaveBeenCalledWith('pet-1'));
    await waitFor(() => expect(mockRefreshPets).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(queryByText('Ares profilini düzenle')).toBeNull());

    alertSpy.mockRestore();
  });

  it('hides the Face ID row when the device does not support biometrics', () => {
    const { queryByTestId } = render(<ProfileScreen />);
    expect(queryByTestId('biometric-toggle')).toBeNull();
  });

  it('toggles Face ID login when the device supports biometrics', () => {
    mockUseAuth.mockReturnValue({ ...baseAuthValue, biometricSupported: true, biometricEnabled: false });
    const { getByTestId } = render(<ProfileScreen />);

    fireEvent(getByTestId('biometric-toggle'), 'valueChange', true);

    expect(mockSetBiometricEnabled).toHaveBeenCalledWith(true);
  });

  it('shows an alert and does not call addPet when the name is empty', async () => {
    const alertSpy = jest.spyOn(require('react-native').Alert, 'alert').mockImplementation(() => {});
    const { getByTestId } = render(<ProfileScreen />);

    fireEvent.press(getByTestId('add-pet-row'));
    await waitFor(() => getByTestId('add-pet-submit'));
    fireEvent.press(getByTestId('add-pet-submit'));

    expect(alertSpy).toHaveBeenCalledWith('İsim gerekli');
    expect(mockAddPet).not.toHaveBeenCalled();
    alertSpy.mockRestore();
  });

  it('edits the default reminder times and saves them', async () => {
    mockUpdatePreferences.mockResolvedValue({});
    const { getByTestId } = render(<ProfileScreen />);

    fireEvent.press(getByTestId('reminder-times-row'));
    await waitFor(() => getByTestId('reminder-time-morning-input'));

    fireEvent.changeText(getByTestId('reminder-time-morning-input'), '08:30');
    fireEvent.changeText(getByTestId('reminder-time-evening-input'), '21:15');
    fireEvent.press(getByTestId('reminder-times-submit'));

    await waitFor(() =>
      expect(mockUpdatePreferences).toHaveBeenCalledWith({
        defaultReminderMorning: '08:30',
        defaultReminderEvening: '21:15',
      }),
    );
  });

  it('rejects an invalid reminder time instead of saving it', async () => {
    const alertSpy = jest.spyOn(require('react-native').Alert, 'alert').mockImplementation(() => {});
    const { getByTestId } = render(<ProfileScreen />);

    fireEvent.press(getByTestId('reminder-times-row'));
    await waitFor(() => getByTestId('reminder-time-morning-input'));

    fireEvent.changeText(getByTestId('reminder-time-morning-input'), 'not-a-time');
    fireEvent.press(getByTestId('reminder-times-submit'));

    expect(alertSpy).toHaveBeenCalledWith('Geçersiz saat', expect.any(String));
    expect(mockUpdatePreferences).not.toHaveBeenCalled();
    alertSpy.mockRestore();
  });

  it('picks a notification sound and saves it', async () => {
    mockUpdatePreferences.mockResolvedValue({});
    const { getByTestId } = render(<ProfileScreen />);

    fireEvent.press(getByTestId('notification-sound-row'));
    await waitFor(() => getByTestId('sound-option-Zil'));

    fireEvent.press(getByTestId('sound-option-Zil'));

    await waitFor(() => expect(mockUpdatePreferences).toHaveBeenCalledWith({ notificationSound: 'Zil' }));
  });

  it('cancels every scheduled reminder when medication reminders are turned off', async () => {
    const { getByTestId } = render(<ProfileScreen />);

    fireEvent(getByTestId('medication-reminders-toggle'), 'valueChange', false);

    await waitFor(() => expect(mockUpdatePreferences).toHaveBeenCalledWith({ medicationReminders: false }));
    await waitFor(() => expect(mockCancelAllReminders).toHaveBeenCalledTimes(1));
  });

  it('warns when notification permission is refused after turning reminders on', async () => {
    mockUseAuth.mockReturnValue({
      ...baseAuthValue,
      user: { ...baseAuthValue.user, preferences: { ...baseAuthValue.user.preferences, medicationReminders: false } },
    });
    mockEnsureNotificationPermission.mockResolvedValue(false);
    const alertSpy = jest.spyOn(require('react-native').Alert, 'alert').mockImplementation(() => {});

    const { getByTestId } = render(<ProfileScreen />);
    fireEvent(getByTestId('medication-reminders-toggle'), 'valueChange', true);

    await waitFor(() => expect(mockEnsureNotificationPermission).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(alertSpy).toHaveBeenCalledWith('Bildirim izni gerekli', expect.any(String)));

    alertSpy.mockRestore();
  });

  it('opens Gelişmiş ayarlar and requests notification permission when not granted', async () => {
    mockGetNotificationPermission.mockResolvedValue('undetermined');
    mockEnsureNotificationPermission.mockResolvedValue(true);
    const { getByTestId } = render(<ProfileScreen />);

    fireEvent.press(getByTestId('advanced-settings-button'));
    await waitFor(() => expect(getByTestId('notification-permission-status').props.children).toBe('Sorulmadı'));

    fireEvent.press(getByTestId('request-notification-permission'));
    await waitFor(() => expect(mockEnsureNotificationPermission).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(getByTestId('notification-permission-status').props.children).toBe('Verildi'));
  });

  it('sends a test notification once permission is already granted', async () => {
    mockGetNotificationPermission.mockResolvedValue('granted');
    const { getByTestId } = render(<ProfileScreen />);

    fireEvent.press(getByTestId('advanced-settings-button'));
    await waitFor(() => getByTestId('send-test-notification'));

    fireEvent.press(getByTestId('send-test-notification'));
    await waitFor(() => expect(mockSendTestNotification).toHaveBeenCalledTimes(1));
  });

  it('opens Hakkında and jumps to Gizlilik ve verilerim from there', async () => {
    const { getByTestId, findByText } = render(<ProfileScreen />);

    fireEvent.press(getByTestId('about-row'));
    await findByText('Sürüm 1.0.0');

    fireEvent.press(getByTestId('about-privacy-link'));
    await findByText('Ne saklıyoruz');
  });

  it('opens Verilerim ve gizlilik directly from its row', async () => {
    const { getByTestId, findByText } = render(<ProfileScreen />);

    fireEvent.press(getByTestId('privacy-row'));
    await findByText('Kiminle paylaşıyoruz');
  });

  it('deletes the account and logs out after confirming from Gizlilik ve verilerim', async () => {
    mockDeleteAccount.mockResolvedValue(undefined);
    const alertSpy = jest.spyOn(require('react-native').Alert, 'alert').mockImplementation(
      (...args: unknown[]) => {
        const buttons = args[2] as Array<{ text: string; onPress?: () => void }> | undefined;
        const destructive = buttons?.find((b) => b.text === 'Sil');
        destructive?.onPress?.();
      },
    );
    const { getByTestId } = render(<ProfileScreen />);

    fireEvent.press(getByTestId('privacy-row'));
    await waitFor(() => getByTestId('privacy-delete-account-button'));
    fireEvent.press(getByTestId('privacy-delete-account-button'));

    await waitFor(() => expect(mockDeleteAccount).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(baseAuthValue.logout).toHaveBeenCalledTimes(1));

    alertSpy.mockRestore();
  });

  it('deletes the account from the footer button as well', async () => {
    mockDeleteAccount.mockResolvedValue(undefined);
    const alertSpy = jest.spyOn(require('react-native').Alert, 'alert').mockImplementation(
      (...args: unknown[]) => {
        const buttons = args[2] as Array<{ text: string; onPress?: () => void }> | undefined;
        const destructive = buttons?.find((b) => b.text === 'Sil');
        destructive?.onPress?.();
      },
    );
    const { getByTestId } = render(<ProfileScreen />);

    fireEvent.press(getByTestId('delete-account-button'));

    await waitFor(() => expect(mockDeleteAccount).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(baseAuthValue.logout).toHaveBeenCalledTimes(1));

    alertSpy.mockRestore();
  });
});
