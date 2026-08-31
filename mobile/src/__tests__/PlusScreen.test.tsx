import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import PlusScreen from '../screens/PlusScreen';
import type { Subscription } from '../api';

const mockGoBack = jest.fn();
const mockUseAuth = jest.fn();
const mockUpdateUser = jest.fn();
const mockFetchCurrentUser = jest.fn();
const mockGetPlans = jest.fn();
const mockStartTrial = jest.fn();
const mockCancelTrial = jest.fn();

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ goBack: mockGoBack }),
}));

jest.mock('../context/AuthContext', () => ({
  useAuth: () => mockUseAuth(),
}));

jest.mock('../api', () => ({
  authApi: {
    fetchCurrentUser: (...args: unknown[]) => mockFetchCurrentUser(...args),
  },
  subscriptionApi: {
    getPlans: (...args: unknown[]) => mockGetPlans(...args),
    startTrial: (...args: unknown[]) => mockStartTrial(...args),
    cancelTrial: (...args: unknown[]) => mockCancelTrial(...args),
  },
}));

// react-native-purchases (RevenueCat) ships an ESM web-billing bundle deep in
// its dependency tree that Jest can't parse, and it's a real native module
// anyway — same reasoning as mocking expo-notifications elsewhere in this
// suite. isRevenueCatConfigured() returning false here means PlusScreen
// takes its existing demo-trial code path, unaffected by task #52's
// RevenueCat wiring (see mobile/src/purchases.ts — the real API keys are
// blank until task #52's setup is done, so this mock mirrors production
// behavior today, not just test behavior).
jest.mock('../purchases', () => ({
  isRevenueCatConfigured: () => false,
  configureRevenueCat: jest.fn(),
  fetchPlusOfferings: jest.fn().mockResolvedValue([]),
  getPlusCustomerInfo: jest.fn().mockResolvedValue(null),
  purchasePlusPackage: jest.fn(),
  hasPlusEntitlement: () => false,
  addPlusUpdateListener: () => () => {},
  PLUS_ENTITLEMENT_ID: 'plus',
}));

const NONE_SUBSCRIPTION: Subscription = { plan: null, status: 'none', trialEndsAt: null, canceledAt: null, trialUsed: false };
const PLANS = [
  { id: 'monthly' as const, label: 'Aylık', priceLabel: '₺49,99/ay' },
  { id: 'yearly' as const, label: 'Yıllık', priceLabel: '₺399,99/yıl', badgeLabel: '%33 tasarruf' },
];

function baseUser(subscription: Subscription = NONE_SUBSCRIPTION) {
  return {
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
    subscription,
    createdAt: new Date().toISOString(),
  };
}

describe('PlusScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseAuth.mockReturnValue({ user: baseUser(), updateUser: mockUpdateUser });
    mockGetPlans.mockResolvedValue({ plans: PLANS, trialDays: 7 });
    mockFetchCurrentUser.mockResolvedValue(baseUser());
  });

  it('goes back when the back button is pressed', async () => {
    const { getByTestId } = await render(<PlusScreen />);
    await waitFor(() => expect(mockGetPlans).toHaveBeenCalledTimes(1));

    await fireEvent.press(getByTestId('plus-back-button'));
    expect(mockGoBack).toHaveBeenCalledTimes(1);
  });

  it('shows the plan picker and always shows the demo-mode disclaimer', async () => {
    const { findByTestId, findByText } = await render(<PlusScreen />);

    await findByTestId('plan-toggle-monthly');
    await findByTestId('plan-toggle-yearly');
    await findByText('DEMO MODU');
    await findByText(/gerçek bir ödeme sağlayıcısına/);
  });

  it('starts a trial with the selected plan and shows the trialing status', async () => {
    const trialingUser = baseUser({ plan: 'monthly', status: 'trialing', trialEndsAt: new Date(Date.now() + 6 * 86400000).toISOString(), canceledAt: null, trialUsed: true });
    mockStartTrial.mockResolvedValue(trialingUser);
    const { findByTestId, getByTestId } = await render(<PlusScreen />);

    await findByTestId('plan-toggle-monthly');
    await fireEvent.press(getByTestId('plan-toggle-monthly'));
    await fireEvent.press(getByTestId('start-trial-button'));

    await waitFor(() => expect(mockStartTrial).toHaveBeenCalledWith('monthly'));
    await findByTestId('plus-status-trialing');

    // Regression check: AuthContext's user must be patched too, otherwise
    // ProfileScreen/ScanScreen (which read subscription straight from
    // AuthContext) would keep showing "no Plus access" after this screen
    // reports the trial as active.
    await waitFor(() => expect(mockUpdateUser).toHaveBeenCalledWith(trialingUser));
  });

  it('cancels an active trial after confirming, and shows the canceled status', async () => {
    mockUseAuth.mockReturnValue({
      user: baseUser({ plan: 'yearly', status: 'trialing', trialEndsAt: new Date(Date.now() + 3 * 86400000).toISOString(), canceledAt: null, trialUsed: true }),
      updateUser: mockUpdateUser,
    });
    mockFetchCurrentUser.mockResolvedValue(
      baseUser({ plan: 'yearly', status: 'trialing', trialEndsAt: new Date(Date.now() + 3 * 86400000).toISOString(), canceledAt: null, trialUsed: true }),
    );
    mockCancelTrial.mockResolvedValue(
      baseUser({ plan: 'yearly', status: 'canceled', trialEndsAt: new Date(Date.now() + 3 * 86400000).toISOString(), canceledAt: new Date().toISOString(), trialUsed: true }),
    );
    const alertSpy = jest.spyOn(require('react-native').Alert, 'alert').mockImplementation((...args: unknown[]) => {
      const buttons = args[2] as Array<{ text: string; onPress?: () => void }> | undefined;
      const destructive = buttons?.find((b) => b.text === 'İptal et');
      destructive?.onPress?.();
    });

    const { findByTestId, getByTestId } = await render(<PlusScreen />);
    await findByTestId('plus-status-trialing');

    await fireEvent.press(getByTestId('cancel-trial-button'));

    await waitFor(() => expect(mockCancelTrial).toHaveBeenCalledTimes(1));
    await findByTestId('plus-status-canceled');

    alertSpy.mockRestore();
  });

  it('shows the expired state and no plan picker once the trial is used up and over', async () => {
    mockUseAuth.mockReturnValue({
      user: baseUser({ plan: 'monthly', status: 'expired', trialEndsAt: new Date(Date.now() - 86400000).toISOString(), canceledAt: null, trialUsed: true }),
      updateUser: mockUpdateUser,
    });
    mockFetchCurrentUser.mockResolvedValue(
      baseUser({ plan: 'monthly', status: 'expired', trialEndsAt: new Date(Date.now() - 86400000).toISOString(), canceledAt: null, trialUsed: true }),
    );

    const { findByTestId, queryByTestId } = await render(<PlusScreen />);

    await findByTestId('plus-status-expired');
    expect(queryByTestId('start-trial-button')).toBeNull();
  });
});
