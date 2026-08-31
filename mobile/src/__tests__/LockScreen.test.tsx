import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import LockScreen from '../screens/LockScreen';

const mockUnlockWithBiometrics = jest.fn();
const mockLogout = jest.fn();

jest.mock('../context/AuthContext', () => ({
  useAuth: () => ({ unlockWithBiometrics: mockUnlockWithBiometrics, logout: mockLogout }),
}));

describe('LockScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUnlockWithBiometrics.mockResolvedValue(undefined);
  });

  it('attempts biometric unlock automatically on mount', async () => {
    await render(<LockScreen />);
    await waitFor(() => expect(mockUnlockWithBiometrics).toHaveBeenCalledTimes(1));
  });

  it('retries unlock when the "Face ID ile aç" button is pressed', async () => {
    const { getByTestId } = await render(<LockScreen />);
    await waitFor(() => expect(mockUnlockWithBiometrics).toHaveBeenCalledTimes(1));

    await fireEvent.press(getByTestId('unlock-button'));
    await waitFor(() => expect(mockUnlockWithBiometrics).toHaveBeenCalledTimes(2));
  });

  it('shows an alert when biometric unlock fails instead of silently doing nothing', async () => {
    mockUnlockWithBiometrics.mockRejectedValueOnce(new Error('Yüz tanınamadı.'));
    const alertSpy = jest.spyOn(require('react-native').Alert, 'alert').mockImplementation(() => {});

    await render(<LockScreen />);

    await waitFor(() => expect(alertSpy).toHaveBeenCalledWith('Kilit açılamadı', 'Yüz tanınamadı.'));
    alertSpy.mockRestore();
  });

  it('logs out only after confirming "Başka bir hesapla giriş yap"', async () => {
    const alertSpy = jest.spyOn(require('react-native').Alert, 'alert').mockImplementation((...args: unknown[]) => {
      const buttons = args[2] as Array<{ text: string; onPress?: () => void }> | undefined;
      const destructive = buttons?.find((b) => b.text === 'Çıkış yap');
      destructive?.onPress?.();
    });
    const { getByTestId } = await render(<LockScreen />);
    await waitFor(() => expect(mockUnlockWithBiometrics).toHaveBeenCalledTimes(1));

    await fireEvent.press(getByTestId('use-another-account'));

    expect(alertSpy).toHaveBeenCalledWith(
      'Çıkış yap',
      'Face ID yerine başka bir hesapla mı giriş yapmak istiyorsun?',
      expect.any(Array),
    );
    expect(mockLogout).toHaveBeenCalledTimes(1);
    alertSpy.mockRestore();
  });
});
