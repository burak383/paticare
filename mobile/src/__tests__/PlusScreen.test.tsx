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
// suite. jest.fn() wrappers (rather than fixed mock bodies) let individual
// tests below flip isRevenueCatConfigured()/hasPlusEntitlement() to exercise
// the real-purchase code path too, not just the demo-trial one.
// Plain jest.fn() (no inline implementation) — an inline arrow like
// `jest.fn(() => false)` pins the mock's inferred TS signature to zero
// arguments, which then fights the generic `(...args) => mockX(...args)`
// wrappers below. Defaults are set explicitly in beforeEach instead.
const mockIsRevenueCatConfigured = jest.fn();
const mockFetchPlusOfferings = jest.fn();
const mockGetPlusCustomerInfo = jest.fn();
const mockPurchasePlusPackage = jest.fn();
const mockRestorePurchases = jest.fn();
const mockHasPlusEntitlement = jest.fn();

jest.mock('../purchases', () => ({
  isRevenueCatConfigured: (...args: unknown[]) => mockIsRevenueCatConfigured(...args),
  configureRevenueCat: jest.fn(),
  fetchPlusOfferings: (...args: unknown[]) => mockFetchPlusOfferings(...args),
  getPlusCustomerInfo: (...args: unknown[]) => mockGetPlusCustomerInfo(...args),
  purchasePlusPackage: (...args: unknown[]) => mockPurchasePlusPackage(...args),
  restorePurchases: (...args: unknown[]) => mockRestorePurchases(...args),
  hasPlusEntitlement: (...args: unknown[]) => mockHasPlusEntitlement(...args),
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
    // clearAllMocks() wipes call history but not a previous test's
    // mockReturnValue/mockResolvedValue — reset explicitly so tests don't
    // depend on run order.
    mockIsRevenueCatConfigured.mockReturnValue(false);
    mockFetchPlusOfferings.mockResolvedValue([]);
    mockGetPlusCustomerInfo.mockResolvedValue(null);
    mockHasPlusEntitlement.mockReturnValue(false);
    mockPurchasePlusPackage.mockReset();
    mockRestorePurchases.mockReset();
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

  describe('gerçek RevenueCat modu (isRevenueCatConfigured() === true)', () => {
    beforeEach(() => {
      mockIsRevenueCatConfigured.mockReturnValue(true);
    });

    it('demo/deneme kutusunu hiç göstermez — gerçek satın alma modunda yanıltıcı olurdu', async () => {
      const { findByTestId, queryByText } = await render(<PlusScreen />);
      await findByTestId('restore-purchases-button');
      expect(queryByText('DEMO MODU')).toBeNull();
      expect(queryByText('start-trial-button')).toBeNull();
    });

    it('bir paket satın alındığında AuthContext kullanıcısını tazeler (regresyon: audit #1)', async () => {
      const pkg = { identifier: 'plus_monthly', product: { title: 'Aylık', priceString: '₺49,99' } } as any;
      mockFetchPlusOfferings.mockResolvedValue([pkg]);
      const activeInfo = { entitlements: { active: {} } } as any;
      mockPurchasePlusPackage.mockResolvedValue(activeInfo);
      const purchasedUser = baseUser({ plan: 'monthly', status: 'active' as any, trialEndsAt: null, canceledAt: null, trialUsed: true });
      mockFetchCurrentUser.mockResolvedValueOnce(baseUser()).mockResolvedValueOnce(purchasedUser);

      const { findByTestId } = await render(<PlusScreen />);
      const buyButton = await findByTestId('plus-purchase-plus_monthly');
      await fireEvent.press(buyButton);

      await waitFor(() => expect(mockPurchasePlusPackage).toHaveBeenCalledWith(pkg));
      await waitFor(() => expect(mockUpdateUser).toHaveBeenCalledWith(purchasedUser));
    });

    it('"Satın almaları geri yükle" bulduğu aktif aboneliği AuthContext\'e de yansıtır (regresyon: audit #2)', async () => {
      const restoredInfo = { entitlements: { active: { plus: {} } } } as any;
      mockRestorePurchases.mockResolvedValue(restoredInfo);
      mockHasPlusEntitlement.mockImplementation((info: unknown) => info === restoredInfo);
      const restoredUser = baseUser({ plan: 'yearly', status: 'active' as any, trialEndsAt: null, canceledAt: null, trialUsed: true });
      mockFetchCurrentUser.mockResolvedValueOnce(baseUser()).mockResolvedValueOnce(restoredUser);

      const { findByTestId } = await render(<PlusScreen />);
      const restoreButton = await findByTestId('restore-purchases-button');
      await fireEvent.press(restoreButton);

      await waitFor(() => expect(mockRestorePurchases).toHaveBeenCalledTimes(1));
      await waitFor(() => expect(mockUpdateUser).toHaveBeenCalledWith(restoredUser));
    });

    it('geri yüklenecek bir şey bulunamazsa AuthContext\'i tazelemeden kullanıcıyı bilgilendirir', async () => {
      mockRestorePurchases.mockResolvedValue({ entitlements: { active: {} } } as any);
      mockHasPlusEntitlement.mockReturnValue(false);
      const alertSpy = jest.spyOn(require('react-native').Alert, 'alert').mockImplementation(() => {});

      const { findByTestId } = await render(<PlusScreen />);
      const restoreButton = await findByTestId('restore-purchases-button');
      mockUpdateUser.mockClear();
      await fireEvent.press(restoreButton);

      await waitFor(() => expect(mockRestorePurchases).toHaveBeenCalledTimes(1));
      expect(alertSpy).toHaveBeenCalledWith('Bulunamadı', expect.any(String));
      expect(mockUpdateUser).not.toHaveBeenCalled();
      alertSpy.mockRestore();
    });
  });
});
