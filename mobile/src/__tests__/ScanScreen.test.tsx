import React from 'react';
import { render, fireEvent, waitFor, act } from '@testing-library/react-native';
import ScanScreen from '../screens/ScanScreen';

const mockSearchProducts = jest.fn();
const mockScanProduct = jest.fn();
const mockFetchScanHistory = jest.fn();
const mockSetParams = jest.fn();
const mockUseRoute = jest.fn();
const mockNavigate = jest.fn();
const mockUseAuth = jest.fn();
const mockCaptureProductPhoto = jest.fn();

jest.mock('../media', () => ({
  captureProductPhoto: (...args: unknown[]) => mockCaptureProductPhoto(...args),
}));

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: mockNavigate, setParams: mockSetParams }),
  useRoute: () => mockUseRoute(),
  useFocusEffect: (callback: () => void | (() => void)) => {
    const ReactActual = require('react');
    ReactActual.useEffect(() => {
      const cleanup = callback();
      return cleanup as void;
    }, []);
  },
}));

jest.mock('../context/AuthContext', () => ({
  useAuth: () => mockUseAuth(),
}));

jest.mock('../api', () => ({
  productsApi: {
    searchProducts: (...args: unknown[]) => mockSearchProducts(...args),
    scanProduct: (...args: unknown[]) => mockScanProduct(...args),
    fetchScanHistory: (...args: unknown[]) => mockFetchScanHistory(...args),
    getProduct: jest.fn(),
    analyzeSafety: jest.fn(),
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

describe('ScanScreen — search and scan button', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    mockUseRoute.mockReturnValue({ params: undefined });
    mockUseAuth.mockReturnValue({ user: { id: 'user-1', subscription: { plan: null, status: 'none', trialEndsAt: null, canceledAt: null, trialUsed: false } } });
    mockFetchScanHistory.mockResolvedValue([]);
    mockSearchProducts.mockResolvedValue([
      { id: 'prod-1', brand: 'OmegaPet', name: 'OmegaPet 3', category: 'Vitamin ve takviye', imageUrl: '', aiSummary: '', doseTitle: '', doseNote: '', ingredients: [], warnings: [], interactsWith: [] },
    ]);
    mockScanProduct.mockResolvedValue({ id: 'prod-2', brand: 'PatiPlus', name: 'PatiPlus Adult Salmon' });
    mockCaptureProductPhoto.mockResolvedValue('data:image/jpeg;base64,fake');
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('debounces search-as-you-type and shows results from the backend', async () => {
    const { getByPlaceholderText, findByText } = await render(<ScanScreen />);

    // Mount fires an initial debounced search for the empty query — let that
    // settle first so we can isolate the debounce behavior for the typed query.
    await act(async () => {
      jest.advanceTimersByTime(300);
    });
    await waitFor(() => expect(mockSearchProducts).toHaveBeenCalledWith(''));
    mockSearchProducts.mockClear();

    const input = getByPlaceholderText('Ürün adıyla ara (örn. OmegaPet, PatiPlus)');
    await fireEvent(input, 'focus');
    await fireEvent.changeText(input, 'Omega');

    // Not called yet — still inside the 300ms debounce window.
    expect(mockSearchProducts).not.toHaveBeenCalled();

    await act(async () => {
      jest.advanceTimersByTime(300);
    });

    await waitFor(() => expect(mockSearchProducts).toHaveBeenCalledWith('Omega'));
    await findByText('OmegaPet 3');
  });

  it('pressing the scan button captures a real photo and calls productsApi.scanProduct with it', async () => {
    const { getByLabelText } = await render(<ScanScreen />);

    await waitFor(() => expect(mockFetchScanHistory).toHaveBeenCalled());
    await fireEvent.press(getByLabelText('Ürünü tara'));

    await waitFor(() => expect(mockCaptureProductPhoto).toHaveBeenCalled());
    await waitFor(() =>
      expect(mockScanProduct).toHaveBeenCalledWith({ petId: 'pet-1', image: 'data:image/jpeg;base64,fake' }),
    );
  });

  it('does nothing (no scanProduct call) when the user cancels the camera', async () => {
    mockCaptureProductPhoto.mockResolvedValue(null);
    const { getByLabelText } = await render(<ScanScreen />);

    await waitFor(() => expect(mockFetchScanHistory).toHaveBeenCalled());
    await fireEvent.press(getByLabelText('Ürünü tara'));

    await waitFor(() => expect(mockCaptureProductPhoto).toHaveBeenCalled());
    expect(mockScanProduct).not.toHaveBeenCalled();
  });
});

describe('ScanScreen — Güvenlik sekmesi', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    mockUseAuth.mockReturnValue({ user: { id: 'user-1', subscription: { plan: null, status: 'none', trialEndsAt: null, canceledAt: null, trialUsed: false } } });
    mockFetchScanHistory.mockResolvedValue([]);
    mockSearchProducts.mockResolvedValue([]);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('opens directly on the Güvenlik segment when navigated here with initialTab: security, and clears the param', async () => {
    mockUseRoute.mockReturnValue({ params: { initialTab: 'security' } });
    const { findByText } = await render(<ScanScreen />);

    await findByText('Güvenlik analizi');
    await waitFor(() => expect(mockSetParams).toHaveBeenCalledWith({ initialTab: undefined }));
  });

  it('switches to the Güvenlik segment when the security promo card is tapped', async () => {
    mockUseRoute.mockReturnValue({ params: undefined });
    const { getByTestId, findByText } = await render(<ScanScreen />);

    await waitFor(() => expect(mockFetchScanHistory).toHaveBeenCalled());
    await fireEvent.press(getByTestId('security-promo-card'));

    await findByText('Güvenlik analizi');
  });
});

function makeScanHistory(count: number) {
  return Array.from({ length: count }, (_, i) => ({
    id: `scan-${i}`,
    userId: 'user-1',
    petId: 'pet-1',
    productId: `prod-${i}`,
    scannedAt: new Date().toISOString(),
    resultSummary: 'Uygun',
    product: { id: `prod-${i}`, barcode: '', brand: 'OmegaPet', name: `Ürün ${i}`, category: '', imageUrl: '', aiSummary: '', doseTitle: '', doseNote: '', ingredients: [], warnings: [], interactsWith: [] },
  }));
}

describe('ScanScreen — PatiCare Plus tarama geçmişi', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    mockUseRoute.mockReturnValue({ params: undefined });
    mockSearchProducts.mockResolvedValue([]);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('caps free accounts at 3 recent scans and shows a Plus hint for the rest', async () => {
    mockUseAuth.mockReturnValue({ user: { id: 'user-1', subscription: { plan: null, status: 'none', trialEndsAt: null, canceledAt: null, trialUsed: false } } });
    mockFetchScanHistory.mockResolvedValue(makeScanHistory(5));

    const { getByTestId, findByText, queryByText } = await render(<ScanScreen />);

    await findByText('Ürün 0');
    expect(queryByText('Ürün 3')).toBeNull();
    await findByText('2 tarama daha var · Plus ile sınırsız geçmiş gör');

    await fireEvent.press(getByTestId('scan-history-plus-hint'));
    expect(mockNavigate).toHaveBeenCalledWith('PatiCarePlus');
  });

  it('shows unlimited scan history for a trialing Plus account, with no hint', async () => {
    mockUseAuth.mockReturnValue({
      user: { id: 'user-1', subscription: { plan: 'monthly', status: 'trialing', trialEndsAt: new Date(Date.now() + 86400000).toISOString(), canceledAt: null, trialUsed: true } },
    });
    mockFetchScanHistory.mockResolvedValue(makeScanHistory(5));

    const { findByText, queryByTestId } = await render(<ScanScreen />);

    await findByText('Ürün 4');
    expect(queryByTestId('scan-history-plus-hint')).toBeNull();
  });
});

describe('ScanScreen — pull-to-refresh', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseAuth.mockReturnValue({ user: { id: 'user-1', subscription: { plan: null, status: 'none', trialEndsAt: null, canceledAt: null, trialUsed: false } } });
    mockSearchProducts.mockResolvedValue([]);
    mockFetchScanHistory.mockResolvedValue([]);
  });

  it('refetches scan history when the list is pulled to refresh', async () => {
    const { getByTestId } = await render(<ScanScreen />);
    await waitFor(() => expect(mockFetchScanHistory).toHaveBeenCalled());
    mockFetchScanHistory.mockClear();

    await act(async () => {
      getByTestId('scan-scroll').props.refreshControl.props.onRefresh();
    });

    await waitFor(() => expect(mockFetchScanHistory).toHaveBeenCalled());
  });
});
