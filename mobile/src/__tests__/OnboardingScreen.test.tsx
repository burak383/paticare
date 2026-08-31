import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import OnboardingScreen from '../screens/OnboardingScreen';

const mockLogin = jest.fn();
const mockRegister = jest.fn();
const mockContinueAsGuest = jest.fn();
const mockForgotPassword = jest.fn();
const mockResetPassword = jest.fn();
const mockLoginWithGoogle = jest.fn();
const mockSetBiometricEnabled = jest.fn();
const mockPromptGoogleAsync = jest.fn();
const mockAddPet = jest.fn();
const mockUseAuth = jest.fn();
const mockPickAndPreparePetPhoto = jest.fn();

jest.mock('../media', () => ({
  pickAndPreparePetPhoto: (...args: unknown[]) => mockPickAndPreparePetPhoto(...args),
}));

jest.mock('expo-web-browser', () => ({
  maybeCompleteAuthSession: jest.fn(),
}));

jest.mock('expo-auth-session/providers/google', () => ({
  useIdTokenAuthRequest: () => [{}, null, (...args: unknown[]) => mockPromptGoogleAsync(...args)],
}));

jest.mock('../context/AuthContext', () => ({
  useAuth: () => mockUseAuth(),
}));

jest.mock('../context/PetContext', () => ({
  usePets: () => ({ addPet: (...args: unknown[]) => mockAddPet(...args) }),
}));

const baseAuthValue = {
  user: null,
  login: (...args: unknown[]) => mockLogin(...args),
  register: (...args: unknown[]) => mockRegister(...args),
  continueAsGuest: (...args: unknown[]) => mockContinueAsGuest(...args),
  error: null as string | null,
  forgotPassword: (...args: unknown[]) => mockForgotPassword(...args),
  resetPassword: (...args: unknown[]) => mockResetPassword(...args),
  loginWithGoogle: (...args: unknown[]) => mockLoginWithGoogle(...args),
  biometricSupported: false,
  setBiometricEnabled: (...args: unknown[]) => mockSetBiometricEnabled(...args),
};

async function switchToLoginForm(getByText: (text: string) => unknown) {
  await fireEvent.press(getByText('E-posta ile devam et') as never);
  await fireEvent.press(getByText('Giriş yap') as never);
}

describe('OnboardingScreen — şifremi unuttum', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseAuth.mockReturnValue(baseAuthValue);
    mockForgotPassword.mockResolvedValue({ message: 'ok', devCode: '654321' });
    mockResetPassword.mockResolvedValue(undefined);
  });

  it('requests a reset code by email, then resets the password with it', async () => {
    const { getByText, getByTestId, findByText, queryByText } = await render(<OnboardingScreen />);

    await switchToLoginForm(getByText);
    await fireEvent.press(getByTestId('forgot-password-link'));

    await findByText('Hesabına kayıtlı e-postayı gir, sana bir sıfırlama kodu oluşturalım.');
    await fireEvent.changeText(getByTestId('forgot-email-input'), 'deniz.kaya@email.com');
    await fireEvent.press(getByTestId('forgot-email-submit'));

    await waitFor(() => expect(mockForgotPassword).toHaveBeenCalledWith('deniz.kaya@email.com'));

    // Demo-mode code is shown inline since there's no real email provider.
    await findByText('654321');

    await fireEvent.changeText(getByTestId('reset-code-input'), '654321');
    await fireEvent.changeText(getByTestId('new-password-input'), 'yenisifre123');
    await fireEvent.press(getByTestId('reset-password-submit'));

    await waitFor(() => expect(mockResetPassword).toHaveBeenCalledWith('deniz.kaya@email.com', '654321', 'yenisifre123'));
    await waitFor(() => expect(queryByText('Kodu gir, şifreni değiştir')).toBeNull());
  });
});

describe('OnboardingScreen — kayıt doğrulama (email format + password length)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseAuth.mockReturnValue(baseAuthValue);
    mockRegister.mockResolvedValue(undefined);
  });

  it('rejects a malformed email instead of calling register', async () => {
    const alertSpy = jest.spyOn(require('react-native').Alert, 'alert').mockImplementation(() => {});
    const { getByText, getByPlaceholderText, getByTestId } = await render(<OnboardingScreen />);

    await fireEvent.press(getByText('E-posta ile devam et'));
    // Default authMode is 'register', so no extra toggle press is needed.
    await fireEvent.changeText(getByPlaceholderText('E-posta'), 'gecersiz-eposta');
    await fireEvent.changeText(getByPlaceholderText('Şifre'), 'paticare123');
    await fireEvent.press(getByTestId('auth-submit-button'));

    expect(alertSpy).toHaveBeenCalledWith('E-posta hatalı', expect.any(String));
    expect(mockRegister).not.toHaveBeenCalled();
    alertSpy.mockRestore();
  });

  it('rejects a password shorter than 6 characters on register', async () => {
    const alertSpy = jest.spyOn(require('react-native').Alert, 'alert').mockImplementation(() => {});
    const { getByText, getByPlaceholderText, getByTestId } = await render(<OnboardingScreen />);

    await fireEvent.press(getByText('E-posta ile devam et'));
    await fireEvent.changeText(getByPlaceholderText('E-posta'), 'deniz.kaya@email.com');
    await fireEvent.changeText(getByPlaceholderText('Şifre'), '123');
    await fireEvent.press(getByTestId('auth-submit-button'));

    expect(alertSpy).toHaveBeenCalledWith('Şifre çok kısa', expect.any(String));
    expect(mockRegister).not.toHaveBeenCalled();
    alertSpy.mockRestore();
  });

  it('rejects registration when the KVKK consent checkbox is not checked', async () => {
    const alertSpy = jest.spyOn(require('react-native').Alert, 'alert').mockImplementation(() => {});
    const { getByText, getByPlaceholderText, getByTestId } = await render(<OnboardingScreen />);

    await fireEvent.press(getByText('E-posta ile devam et'));
    await fireEvent.changeText(getByPlaceholderText('E-posta'), 'deniz.kaya@email.com');
    await fireEvent.changeText(getByPlaceholderText('Şifre'), 'paticare123');
    await fireEvent.press(getByTestId('auth-submit-button'));

    expect(alertSpy).toHaveBeenCalledWith('Onay gerekli', expect.any(String));
    expect(mockRegister).not.toHaveBeenCalled();
    alertSpy.mockRestore();
  });

  it('opens the KVKK policy text when the consent link is pressed', async () => {
    const { getByText, getByTestId, findByText } = await render(<OnboardingScreen />);

    await fireEvent.press(getByText('E-posta ile devam et'));
    await fireEvent.press(getByText('KVKK Aydınlatma Metni'));

    await findByText(/avukat onayı olmadan/);
    await fireEvent.press(getByTestId('privacy-policy-close'));
  });

  it('allows registering with a valid email, a 6+ character password, and consent checked', async () => {
    const { getByText, getByPlaceholderText, getByTestId } = await render(<OnboardingScreen />);

    await fireEvent.press(getByText('E-posta ile devam et'));
    await fireEvent.changeText(getByPlaceholderText('E-posta'), 'deniz.kaya@email.com');
    await fireEvent.changeText(getByPlaceholderText('Şifre'), 'paticare123');
    await fireEvent.press(getByTestId('privacy-consent-checkbox'));
    await fireEvent.press(getByTestId('auth-submit-button'));

    await waitFor(() =>
      expect(mockRegister).toHaveBeenCalledWith('deniz.kaya@email.com', 'paticare123', undefined, true)
    );
  });
});

describe('OnboardingScreen — Google ile giriş', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseAuth.mockReturnValue(baseAuthValue);
  });

  it('tells the user Google sign-in needs a configured client ID instead of failing silently', async () => {
    const alertSpy = jest.spyOn(require('react-native').Alert, 'alert').mockImplementation(() => {});
    const { getByTestId } = await render(<OnboardingScreen />);

    await fireEvent.press(getByTestId('google-signin-button'));

    expect(alertSpy).toHaveBeenCalledWith('Google girişi yapılandırılmadı', expect.any(String));
    expect(mockPromptGoogleAsync).not.toHaveBeenCalled();

    alertSpy.mockRestore();
  });
});

describe('OnboardingScreen — Face ID opt-in', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockLogin.mockResolvedValue(undefined);
  });

  it('offers to enable Face ID after a successful login on supported hardware', async () => {
    mockUseAuth.mockReturnValue({ ...baseAuthValue, biometricSupported: true });
    const alertSpy = jest.spyOn(require('react-native').Alert, 'alert').mockImplementation(
      (...args: unknown[]) => {
        const buttons = args[2] as Array<{ text: string; onPress?: () => void }> | undefined;
        const enable = buttons?.find((b) => b.text === 'Etkinleştir');
        enable?.onPress?.();
      },
    );

    const { getByText, getByPlaceholderText, getByTestId } = await render(<OnboardingScreen />);
    await switchToLoginForm(getByText);
    await fireEvent.changeText(getByPlaceholderText('E-posta'), 'deniz.kaya@email.com');
    await fireEvent.changeText(getByPlaceholderText('Şifre'), 'paticare123');
    await fireEvent.press(getByTestId('auth-submit-button'));

    await waitFor(() => expect(mockLogin).toHaveBeenCalledWith('deniz.kaya@email.com', 'paticare123'));
    await waitFor(() => expect(mockSetBiometricEnabled).toHaveBeenCalledWith(true));

    alertSpy.mockRestore();
  });

  it('does not offer Face ID when the device does not support it', async () => {
    mockUseAuth.mockReturnValue({ ...baseAuthValue, biometricSupported: false });
    const alertSpy = jest.spyOn(require('react-native').Alert, 'alert').mockImplementation(() => {});

    const { getByText, getByPlaceholderText, getByTestId } = await render(<OnboardingScreen />);
    await switchToLoginForm(getByText);
    await fireEvent.changeText(getByPlaceholderText('E-posta'), 'deniz.kaya@email.com');
    await fireEvent.changeText(getByPlaceholderText('Şifre'), 'paticare123');
    await fireEvent.press(getByTestId('auth-submit-button'));

    await waitFor(() => expect(mockLogin).toHaveBeenCalledTimes(1));
    expect(alertSpy).not.toHaveBeenCalledWith('Face ID ile hızlı giriş', expect.any(String), expect.any(Array));
    expect(mockSetBiometricEnabled).not.toHaveBeenCalled();

    alertSpy.mockRestore();
  });
});

describe('OnboardingScreen — portre ekle', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseAuth.mockReturnValue(baseAuthValue);
    mockContinueAsGuest.mockResolvedValue(undefined);
    mockAddPet.mockResolvedValue({ id: 'pet-1', name: 'Ares' });
  });

  it('picks a real photo and creates the pet with it instead of the placeholder image', async () => {
    mockPickAndPreparePetPhoto.mockResolvedValue('data:image/jpeg;base64,ZmFrZS1waG90bw==');
    const { getByTestId, findByText } = await render(<OnboardingScreen />);

    await fireEvent.press(getByTestId('onboarding-pick-portrait'));
    await waitFor(() => expect(mockPickAndPreparePetPhoto).toHaveBeenCalledTimes(1));
    await findByText('Portre eklendi');

    // petName state defaults to 'Ares', so the submit button is already enabled.
    await fireEvent.press(getByTestId('create-care-file-button'));

    await waitFor(() => expect(mockAddPet).toHaveBeenCalledTimes(1));
    expect(mockAddPet.mock.calls[0][0]).toEqual(
      expect.objectContaining({ avatarUrl: 'data:image/jpeg;base64,ZmFrZS1waG90bw==' }),
    );
  });

  it('shows an alert instead of crashing when photo access is denied', async () => {
    const alertSpy = jest.spyOn(require('react-native').Alert, 'alert').mockImplementation(() => {});
    mockPickAndPreparePetPhoto.mockRejectedValue(new Error('Fotoğraflara erişim izni verilmedi.'));

    const { getByTestId } = await render(<OnboardingScreen />);
    await fireEvent.press(getByTestId('onboarding-pick-portrait'));

    await waitFor(() => expect(alertSpy).toHaveBeenCalledWith('Fotoğraf eklenemedi', 'Fotoğraflara erişim izni verilmedi.'));

    alertSpy.mockRestore();
  });
});
