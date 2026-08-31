import React from 'react';
import { render, fireEvent, waitFor, act } from '@testing-library/react-native';
import ProfileScreen from '../screens/ProfileScreen';

const mockUpdatePet = jest.fn();
const mockDeletePet = jest.fn();
const mockAddPet = jest.fn();
const mockUpdatePetLocal = jest.fn();
const mockRefreshPets = jest.fn();
const mockUpdatePreferences = jest.fn();
const mockDeleteAccount = jest.fn();
const mockUpgradeGuestAccount = jest.fn();
const mockChangePassword = jest.fn();
const mockEnsureNotificationPermission = jest.fn();
const mockCancelAllReminders = jest.fn();
const mockGetNotificationPermission = jest.fn();
const mockSendTestNotification = jest.fn();
const mockNavigate = jest.fn();

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: mockNavigate }),
}));

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
  avatarUrl: null as string | null,
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
  upgradeGuestAccount: (...args: unknown[]) => mockUpgradeGuestAccount(...args),
  changePassword: (...args: unknown[]) => mockChangePassword(...args),
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
    const { getByTestId, getByText, queryByText } = await render(<ProfileScreen />);

    // Modal content shouldn't exist yet.
    expect(queryByText('Ares profilini düzenle')).toBeNull();

    await fireEvent.press(getByTestId('edit-pet-pet-1'));

    await waitFor(() => getByText('Ares profilini düzenle'));

    await fireEvent.changeText(getByTestId('edit-pet-name-input'), 'Ares Güncel');
    await fireEvent.changeText(getByTestId('edit-pet-weight-input'), '4,2');
    await fireEvent.press(getByTestId('edit-pet-submit'));

    await waitFor(() => expect(mockUpdatePet).toHaveBeenCalledTimes(1));
    expect(mockUpdatePet).toHaveBeenCalledWith('pet-1', expect.objectContaining({ name: 'Ares Güncel', weightKg: 4.2 }));
    await waitFor(() => expect(mockUpdatePetLocal).toHaveBeenCalledTimes(1));

    // Modal should close after a successful save.
    await waitFor(() => expect(queryByText('Ares profilini düzenle')).toBeNull());
  });

  it('opens the add-pet modal, submits, and calls PetContext.addPet', async () => {
    const { getByTestId, getByText, queryByText } = await render(<ProfileScreen />);

    expect(queryByText('Yeni evcil hayvan ekle', { exact: false })).not.toBeNull(); // row label always visible
    await fireEvent.press(getByTestId('add-pet-row'));

    await waitFor(() => getByTestId('add-pet-name-input'));
    await fireEvent.changeText(getByTestId('add-pet-name-input'), 'Zeytin');
    await fireEvent.press(getByTestId('add-pet-submit'));

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
    const { getByTestId, queryByText } = await render(<ProfileScreen />);

    await fireEvent.press(getByTestId('edit-pet-pet-1'));
    await waitFor(() => getByTestId('delete-pet-button'));
    await fireEvent.press(getByTestId('delete-pet-button'));

    await waitFor(() => expect(mockDeletePet).toHaveBeenCalledWith('pet-1'));
    await waitFor(() => expect(mockRefreshPets).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(queryByText('Ares profilini düzenle')).toBeNull());

    alertSpy.mockRestore();
  });

  it('hides the Face ID row when the device does not support biometrics', async () => {
    const { queryByTestId } = await render(<ProfileScreen />);
    expect(queryByTestId('biometric-toggle')).toBeNull();
  });

  it('toggles Face ID login when the device supports biometrics', async () => {
    mockUseAuth.mockReturnValue({ ...baseAuthValue, biometricSupported: true, biometricEnabled: false });
    const { getByTestId } = await render(<ProfileScreen />);

    await fireEvent(getByTestId('biometric-toggle'), 'valueChange', true);

    expect(mockSetBiometricEnabled).toHaveBeenCalledWith(true);
  });

  it('shows an alert and does not call addPet when the name is empty', async () => {
    const alertSpy = jest.spyOn(require('react-native').Alert, 'alert').mockImplementation(() => {});
    const { getByTestId } = await render(<ProfileScreen />);

    await fireEvent.press(getByTestId('add-pet-row'));
    await waitFor(() => getByTestId('add-pet-submit'));
    await fireEvent.press(getByTestId('add-pet-submit'));

    expect(alertSpy).toHaveBeenCalledWith('İsim gerekli');
    expect(mockAddPet).not.toHaveBeenCalled();
    alertSpy.mockRestore();
  });

  it('edits the default reminder times and saves them', async () => {
    mockUpdatePreferences.mockResolvedValue({});
    const { getByTestId } = await render(<ProfileScreen />);

    await fireEvent.press(getByTestId('reminder-times-row'));
    await waitFor(() => getByTestId('reminder-time-morning-input'));

    await fireEvent.changeText(getByTestId('reminder-time-morning-input'), '08:30');
    await fireEvent.changeText(getByTestId('reminder-time-evening-input'), '21:15');
    await fireEvent.press(getByTestId('reminder-times-submit'));

    await waitFor(() =>
      expect(mockUpdatePreferences).toHaveBeenCalledWith({
        defaultReminderMorning: '08:30',
        defaultReminderEvening: '21:15',
      }),
    );
  });

  it('rejects an invalid reminder time instead of saving it', async () => {
    const alertSpy = jest.spyOn(require('react-native').Alert, 'alert').mockImplementation(() => {});
    const { getByTestId } = await render(<ProfileScreen />);

    await fireEvent.press(getByTestId('reminder-times-row'));
    await waitFor(() => getByTestId('reminder-time-morning-input'));

    await fireEvent.changeText(getByTestId('reminder-time-morning-input'), 'not-a-time');
    await fireEvent.press(getByTestId('reminder-times-submit'));

    expect(alertSpy).toHaveBeenCalledWith('Geçersiz saat', expect.any(String));
    expect(mockUpdatePreferences).not.toHaveBeenCalled();
    alertSpy.mockRestore();
  });

  it('picks a notification sound and saves it', async () => {
    mockUpdatePreferences.mockResolvedValue({});
    const { getByTestId } = await render(<ProfileScreen />);

    await fireEvent.press(getByTestId('notification-sound-row'));
    await waitFor(() => getByTestId('sound-option-Zil'));

    await fireEvent.press(getByTestId('sound-option-Zil'));

    await waitFor(() => expect(mockUpdatePreferences).toHaveBeenCalledWith({ notificationSound: 'Zil' }));
  });

  it('cancels every scheduled reminder when medication reminders are turned off', async () => {
    const { getByTestId } = await render(<ProfileScreen />);

    await fireEvent(getByTestId('medication-reminders-toggle'), 'valueChange', false);

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

    const { getByTestId } = await render(<ProfileScreen />);
    await fireEvent(getByTestId('medication-reminders-toggle'), 'valueChange', true);

    await waitFor(() => expect(mockEnsureNotificationPermission).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(alertSpy).toHaveBeenCalledWith('Bildirim izni gerekli', expect.any(String)));

    alertSpy.mockRestore();
  });

  it('opens Gelişmiş ayarlar and requests notification permission when not granted', async () => {
    mockGetNotificationPermission.mockResolvedValue('undetermined');
    mockEnsureNotificationPermission.mockResolvedValue(true);
    const { getByTestId } = await render(<ProfileScreen />);

    await fireEvent.press(getByTestId('advanced-settings-button'));
    await waitFor(() => expect(getByTestId('notification-permission-status').props.children).toBe('Sorulmadı'));

    await fireEvent.press(getByTestId('request-notification-permission'));
    await waitFor(() => expect(mockEnsureNotificationPermission).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(getByTestId('notification-permission-status').props.children).toBe('Verildi'));
  });

  it('sends a test notification once permission is already granted', async () => {
    mockGetNotificationPermission.mockResolvedValue('granted');
    const { getByTestId } = await render(<ProfileScreen />);

    await fireEvent.press(getByTestId('advanced-settings-button'));
    await waitFor(() => getByTestId('send-test-notification'));

    await fireEvent.press(getByTestId('send-test-notification'));
    await waitFor(() => expect(mockSendTestNotification).toHaveBeenCalledTimes(1));
  });

  it('opens Hakkında and jumps to Gizlilik ve verilerim from there', async () => {
    const { getByTestId, findByText } = await render(<ProfileScreen />);

    await fireEvent.press(getByTestId('about-row'));
    await findByText('Sürüm 1.0.0');

    await fireEvent.press(getByTestId('about-privacy-link'));
    await findByText('Ne saklıyoruz');
  });

  it('opens Verilerim ve gizlilik directly from its row', async () => {
    const { getByTestId, findByText } = await render(<ProfileScreen />);

    await fireEvent.press(getByTestId('privacy-row'));
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
    const { getByTestId } = await render(<ProfileScreen />);

    await fireEvent.press(getByTestId('privacy-row'));
    await waitFor(() => getByTestId('privacy-delete-account-button'));
    await fireEvent.press(getByTestId('privacy-delete-account-button'));

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
    const { getByTestId } = await render(<ProfileScreen />);

    await fireEvent.press(getByTestId('delete-account-button'));

    await waitFor(() => expect(mockDeleteAccount).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(baseAuthValue.logout).toHaveBeenCalledTimes(1));

    alertSpy.mockRestore();
  });

  it('opens PatiCare Plus from the Plus card', async () => {
    const { getByTestId } = await render(<ProfileScreen />);

    await fireEvent.press(getByTestId('plus-card'));
    expect(mockNavigate).toHaveBeenCalledWith('PatiCarePlus');
  });

  it('shows the trial-active badge on the Plus card when a trial is running', async () => {
    mockUseAuth.mockReturnValue({
      ...baseAuthValue,
      user: {
        ...baseAuthValue.user,
        subscription: { plan: 'monthly', status: 'trialing', trialEndsAt: new Date(Date.now() + 86400000).toISOString(), canceledAt: null, trialUsed: true },
      },
    });
    const { getByText } = await render(<ProfileScreen />);

    expect(getByText('DENEME AKTİF')).toBeTruthy();
  });
});

describe('ProfileScreen — pull-to-refresh', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseAuth.mockReturnValue(baseAuthValue);
    mockRefreshPets.mockResolvedValue(undefined);
  });

  it('calls refreshPets when the list is pulled to refresh', async () => {
    const { getByTestId } = await render(<ProfileScreen />);

    await act(async () => {
      getByTestId('profile-scroll').props.refreshControl.props.onRefresh();
    });

    await waitFor(() => expect(mockRefreshPets).toHaveBeenCalledTimes(1));
  });
});

describe('ProfileScreen — evcil hayvan fotoğrafını kaldır (remove pet photo)', () => {
  const originalAvatarUrl = mockPet.avatarUrl;

  beforeEach(() => {
    jest.clearAllMocks();
    mockPet.avatarUrl = 'https://example.com/ares.jpg';
    mockUpdatePet.mockResolvedValue({ ...mockPet, avatarUrl: null });
    mockUpdatePetLocal.mockReturnValue(undefined);
    mockUseAuth.mockReturnValue(baseAuthValue);
  });

  afterEach(() => {
    mockPet.avatarUrl = originalAvatarUrl;
  });

  it('shows a remove button only when the pet has a photo, and clears it on save', async () => {
    const { getByTestId, queryByTestId, getByText } = await render(<ProfileScreen />);

    await fireEvent.press(getByTestId('edit-pet-pet-1'));
    await waitFor(() => getByText('Ares profilini düzenle'));

    expect(queryByTestId('remove-pet-photo-button')).not.toBeNull();

    await fireEvent.press(getByTestId('remove-pet-photo-button'));

    // Removing hides the button again — nothing left to remove.
    expect(queryByTestId('remove-pet-photo-button')).toBeNull();

    await fireEvent.press(getByTestId('edit-pet-submit'));

    await waitFor(() => expect(mockUpdatePet).toHaveBeenCalledTimes(1));
    expect(mockUpdatePet).toHaveBeenCalledWith('pet-1', expect.objectContaining({ avatarUrl: null }));
  });

  it('does not show a remove button for a pet with no photo', async () => {
    mockPet.avatarUrl = null;
    const { getByTestId, queryByTestId } = await render(<ProfileScreen />);

    await fireEvent.press(getByTestId('edit-pet-pet-1'));

    expect(queryByTestId('remove-pet-photo-button')).toBeNull();
  });
});

describe('ProfileScreen — misafir hesabını oluştur (upgrade guest account)', () => {
  const guestAuthValue = {
    ...baseAuthValue,
    user: { ...baseAuthValue.user, guest: true, email: 'misafir-ab12cd@paticare.local', name: 'Misafir Kullanıcı' },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockUpgradeGuestAccount.mockResolvedValue(undefined);
  });

  it('shows the upgrade CTA for a guest account and calls upgradeGuestAccount on submit', async () => {
    mockUseAuth.mockReturnValue(guestAuthValue);
    const { getByTestId, findByText } = await render(<ProfileScreen />);

    // "Hesabını oluştur" appears both as the CTA row's own title and as the
    // modal title once open, so it can't disambiguate which is on screen —
    // wait for a modal-only element instead.
    await fireEvent.press(getByTestId('upgrade-account-row'));
    await waitFor(() => getByTestId('upgrade-email-input'));

    await fireEvent.changeText(getByTestId('upgrade-email-input'), 'deniz.kaya@email.com');
    await fireEvent.changeText(getByTestId('upgrade-password-input'), 'yenisifre123');
    await fireEvent.press(getByTestId('upgrade-privacy-consent-checkbox'));
    await fireEvent.press(getByTestId('upgrade-account-submit'));

    await waitFor(() =>
      expect(mockUpgradeGuestAccount).toHaveBeenCalledWith('deniz.kaya@email.com', 'yenisifre123', undefined, true)
    );
  });

  it('rejects submission when the KVKK consent checkbox is not checked', async () => {
    mockUseAuth.mockReturnValue(guestAuthValue);
    const alertSpy = jest.spyOn(require('react-native').Alert, 'alert').mockImplementation(() => {});
    const { getByTestId } = await render(<ProfileScreen />);

    await fireEvent.press(getByTestId('upgrade-account-row'));
    await waitFor(() => getByTestId('upgrade-email-input'));

    await fireEvent.changeText(getByTestId('upgrade-email-input'), 'deniz.kaya@email.com');
    await fireEvent.changeText(getByTestId('upgrade-password-input'), 'yenisifre123');
    await fireEvent.press(getByTestId('upgrade-account-submit'));

    expect(alertSpy).toHaveBeenCalledWith('Onay gerekli', expect.any(String));
    expect(mockUpgradeGuestAccount).not.toHaveBeenCalled();
    alertSpy.mockRestore();
  });

  it('opens the KVKK policy text when the consent link is pressed', async () => {
    mockUseAuth.mockReturnValue(guestAuthValue);
    const { getByTestId, getByText, findByText } = await render(<ProfileScreen />);

    await fireEvent.press(getByTestId('upgrade-account-row'));
    await waitFor(() => getByTestId('upgrade-email-input'));

    await fireEvent.press(getByText('KVKK Aydınlatma Metni'));
    await findByText(/avukat onayı olmadan/);
    await fireEvent.press(getByTestId('upgrade-privacy-policy-close'));
  });

  it('rejects a malformed email instead of calling upgradeGuestAccount', async () => {
    mockUseAuth.mockReturnValue(guestAuthValue);
    const alertSpy = jest.spyOn(require('react-native').Alert, 'alert').mockImplementation(() => {});
    const { getByTestId, findByText } = await render(<ProfileScreen />);

    // "Hesabını oluştur" appears both as the CTA row's own title and as the
    // modal title once open, so it can't disambiguate which is on screen —
    // wait for a modal-only element instead.
    await fireEvent.press(getByTestId('upgrade-account-row'));
    await waitFor(() => getByTestId('upgrade-email-input'));

    await fireEvent.changeText(getByTestId('upgrade-email-input'), 'gecersiz');
    await fireEvent.changeText(getByTestId('upgrade-password-input'), 'yenisifre123');
    await fireEvent.press(getByTestId('upgrade-account-submit'));

    expect(alertSpy).toHaveBeenCalledWith('E-posta hatalı', expect.any(String));
    expect(mockUpgradeGuestAccount).not.toHaveBeenCalled();
    alertSpy.mockRestore();
  });

  it('does not show the upgrade CTA for an already-registered account', async () => {
    mockUseAuth.mockReturnValue(baseAuthValue);
    const { queryByTestId } = await render(<ProfileScreen />);

    expect(queryByTestId('upgrade-account-row')).toBeNull();
  });
});

describe('ProfileScreen — şifreni değiştir (in-app change password)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockChangePassword.mockResolvedValue(undefined);
  });

  it('shows the change-password row for a registered account and calls changePassword on submit', async () => {
    mockUseAuth.mockReturnValue(baseAuthValue);
    const { getByTestId } = await render(<ProfileScreen />);

    await fireEvent.press(getByTestId('change-password-row'));
    await waitFor(() => getByTestId('current-password-input'));

    await fireEvent.changeText(getByTestId('current-password-input'), 'paticare123');
    await fireEvent.changeText(getByTestId('new-password-change-input'), 'yenisifre123');
    await fireEvent.press(getByTestId('change-password-submit'));

    await waitFor(() => expect(mockChangePassword).toHaveBeenCalledWith('paticare123', 'yenisifre123'));
  });

  it('rejects a new password shorter than 6 characters instead of calling changePassword', async () => {
    mockUseAuth.mockReturnValue(baseAuthValue);
    const alertSpy = jest.spyOn(require('react-native').Alert, 'alert').mockImplementation(() => {});
    const { getByTestId } = await render(<ProfileScreen />);

    await fireEvent.press(getByTestId('change-password-row'));
    await waitFor(() => getByTestId('current-password-input'));

    await fireEvent.changeText(getByTestId('current-password-input'), 'paticare123');
    await fireEvent.changeText(getByTestId('new-password-change-input'), '123');
    await fireEvent.press(getByTestId('change-password-submit'));

    expect(alertSpy).toHaveBeenCalledWith('Şifre çok kısa', expect.any(String));
    expect(mockChangePassword).not.toHaveBeenCalled();
    alertSpy.mockRestore();
  });

  it('surfaces a wrong-current-password error from the backend instead of failing silently', async () => {
    mockUseAuth.mockReturnValue(baseAuthValue);
    mockChangePassword.mockRejectedValue(new Error('Mevcut şifre hatalı.'));
    const alertSpy = jest.spyOn(require('react-native').Alert, 'alert').mockImplementation(() => {});
    const { getByTestId } = await render(<ProfileScreen />);

    await fireEvent.press(getByTestId('change-password-row'));
    await waitFor(() => getByTestId('current-password-input'));

    await fireEvent.changeText(getByTestId('current-password-input'), 'yanlisSifre');
    await fireEvent.changeText(getByTestId('new-password-change-input'), 'yenisifre123');
    await fireEvent.press(getByTestId('change-password-submit'));

    await waitFor(() => expect(alertSpy).toHaveBeenCalledWith('Hata', 'Mevcut şifre hatalı.'));
    alertSpy.mockRestore();
  });

  it('does not show the change-password row for a guest account', async () => {
    mockUseAuth.mockReturnValue({ ...baseAuthValue, user: { ...baseAuthValue.user, guest: true } });
    const { queryByTestId } = await render(<ProfileScreen />);

    expect(queryByTestId('change-password-row')).toBeNull();
  });
});
