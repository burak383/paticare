import React from 'react';
import { render, fireEvent, waitFor, act } from '@testing-library/react-native';
import ScanScreen from '../screens/ScanScreen';

const mockSearchProducts = jest.fn();
const mockScanProduct = jest.fn();
const mockFetchScanHistory = jest.fn();
const mockSetParams = jest.fn();
const mockUseRoute = jest.fn();

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: jest.fn(), setParams: mockSetParams }),
  useRoute: () => mockUseRoute(),
  useFocusEffect: (callback: () => void | (() => void)) => {
    const ReactActual = require('react');
    ReactActual.useEffect(() => {
      const cleanup = callback();
      return cleanup as void;
    }, []);
  },
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
    mockFetchScanHistory.mockResolvedValue([]);
    mockSearchProducts.mockResolvedValue([
      { id: 'prod-1', brand: 'OmegaPet', name: 'OmegaPet 3', category: 'Vitamin ve takviye', imageUrl: '', aiSummary: '', doseTitle: '', doseNote: '', ingredients: [], warnings: [], interactsWith: [] },
    ]);
    mockScanProduct.mockResolvedValue({ id: 'prod-2', brand: 'PatiPlus', name: 'PatiPlus Adult Salmon' });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('debounces search-as-you-type and shows results from the backend', async () => {
    const { getByPlaceholderText, findByText } = render(<ScanScreen />);

    // Mount fires an initial debounced search for the empty query — let that
    // settle first so we can isolate the debounce behavior for the typed query.
    await act(async () => {
      jest.advanceTimersByTime(300);
    });
    await waitFor(() => expect(mockSearchProducts).toHaveBeenCalledWith(''));
    mockSearchProducts.mockClear();

    const input = getByPlaceholderText('Ürün adıyla ara (örn. OmegaPet, PatiPlus)');
    fireEvent(input, 'focus');
    fireEvent.changeText(input, 'Omega');

    // Not called yet — still inside the 300ms debounce window.
    expect(mockSearchProducts).not.toHaveBeenCalled();

    await act(async () => {
      jest.advanceTimersByTime(300);
    });

    await waitFor(() => expect(mockSearchProducts).toHaveBeenCalledWith('Omega'));
    await findByText('OmegaPet 3');
  });

  it('pressing the scan button calls productsApi.scanProduct', async () => {
    const { getByLabelText } = render(<ScanScreen />);

    await waitFor(() => expect(mockFetchScanHistory).toHaveBeenCalled());
    fireEvent.press(getByLabelText('Ürünü tara'));

    await waitFor(() => expect(mockScanProduct).toHaveBeenCalledWith({ petId: 'pet-1' }));
  });
});

describe('ScanScreen — Güvenlik sekmesi', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    mockFetchScanHistory.mockResolvedValue([]);
    mockSearchProducts.mockResolvedValue([]);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('opens directly on the Güvenlik segment when navigated here with initialTab: security, and clears the param', async () => {
    mockUseRoute.mockReturnValue({ params: { initialTab: 'security' } });
    const { findByText } = render(<ScanScreen />);

    await findByText('Güvenlik analizi');
    await waitFor(() => expect(mockSetParams).toHaveBeenCalledWith({ initialTab: undefined }));
  });

  it('switches to the Güvenlik segment when the security promo card is tapped', async () => {
    mockUseRoute.mockReturnValue({ params: undefined });
    const { getByTestId, findByText } = render(<ScanScreen />);

    await waitFor(() => expect(mockFetchScanHistory).toHaveBeenCalled());
    fireEvent.press(getByTestId('security-promo-card'));

    await findByText('Güvenlik analizi');
  });
});
