import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import ProductAnalysisScreen from '../screens/ProductAnalysisScreen';

const mockGetProduct = jest.fn();
const mockCreateCareItem = jest.fn();
const mockListPriceNotes = jest.fn();
const mockAddPriceNote = jest.fn();
const mockDeletePriceNote = jest.fn();

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: jest.fn(), goBack: jest.fn() }),
  useRoute: () => ({ params: { productId: 'prod-1' } }),
}));

jest.mock('../api', () => ({
  productsApi: {
    getProduct: (...args: unknown[]) => mockGetProduct(...args),
    listPriceNotes: (...args: unknown[]) => mockListPriceNotes(...args),
    addPriceNote: (...args: unknown[]) => mockAddPriceNote(...args),
    deletePriceNote: (...args: unknown[]) => mockDeletePriceNote(...args),
  },
  careItemsApi: {
    createCareItem: (...args: unknown[]) => mockCreateCareItem(...args),
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

const mockProduct = {
  id: 'prod-1',
  brand: 'OmegaPet',
  name: 'OmegaPet 3',
  category: 'Vitamin ve takviye',
  imageUrl: '',
  aiSummary: 'Balık yağı takviyesi.',
  doseTitle: 'Günde 1 ölçek',
  doseNote: 'Yemeğe karıştırın.',
  ingredients: [],
  warnings: [],
  interactsWith: [],
};

jest.mock('../context/PetContext', () => ({
  usePets: () => ({ pets: [mockPet], selectedPet: mockPet, loading: false, refreshPets: jest.fn(), selectPet: jest.fn(), addPet: jest.fn(), updatePetLocal: jest.fn() }),
}));

describe('ProductAnalysisScreen — Takvime ekle button', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetProduct.mockResolvedValue(mockProduct);
    mockCreateCareItem.mockResolvedValue({ id: 'ci-1' });
    mockListPriceNotes.mockResolvedValue([]);
  });

  it('calls careItemsApi.createCareItem with the product and selected pet', async () => {
    const { findByText, getByText } = render(<ProductAnalysisScreen />);

    await findByText('OmegaPet 3');
    fireEvent.press(getByText('Takvime ekle'));

    await waitFor(() => expect(mockCreateCareItem).toHaveBeenCalledTimes(1));
    expect(mockCreateCareItem).toHaveBeenCalledWith(
      expect.objectContaining({ petId: 'pet-1', title: 'OmegaPet 3', kind: 'medication' }),
    );
  });
});

describe('ProductAnalysisScreen — fiyat notları', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetProduct.mockResolvedValue(mockProduct);
    mockListPriceNotes.mockResolvedValue([]);
    mockAddPriceNote.mockResolvedValue({
      id: 'note-1',
      productId: 'prod-1',
      userId: 'user-1',
      store: 'Petshop XYZ',
      price: 249.9,
      date: '2026-08-20',
      note: '',
      createdAt: new Date().toISOString(),
    });
    mockDeletePriceNote.mockResolvedValue(undefined);
  });

  it('adds a price note the user logged and shows it in the list', async () => {
    const { findByText, getByTestId } = render(<ProductAnalysisScreen />);

    await findByText('OmegaPet 3');
    fireEvent.press(getByTestId('price-note-add-button'));

    fireEvent.changeText(getByTestId('price-note-store-input'), 'Petshop XYZ');
    fireEvent.changeText(getByTestId('price-note-price-input'), '249,90');
    fireEvent.press(getByTestId('price-note-submit'));

    await waitFor(() =>
      expect(mockAddPriceNote).toHaveBeenCalledWith('prod-1', expect.objectContaining({ store: 'Petshop XYZ', price: 249.9 })),
    );
    await waitFor(() => getByTestId('price-note-note-1'));
  });

  it('rejects an empty store name instead of saving a blank note', async () => {
    const alertSpy = jest.spyOn(require('react-native').Alert, 'alert').mockImplementation(() => {});
    const { findByText, getByTestId } = render(<ProductAnalysisScreen />);

    await findByText('OmegaPet 3');
    fireEvent.press(getByTestId('price-note-add-button'));
    fireEvent.changeText(getByTestId('price-note-price-input'), '100');
    fireEvent.press(getByTestId('price-note-submit'));

    expect(alertSpy).toHaveBeenCalledWith('Mağaza adı gerekli', expect.any(String));
    expect(mockAddPriceNote).not.toHaveBeenCalled();
    alertSpy.mockRestore();
  });

  it('shows an alert instead of failing silently when sharing fails', async () => {
    const alertSpy = jest.spyOn(require('react-native').Alert, 'alert').mockImplementation(() => {});
    const shareSpy = jest.spyOn(require('react-native').Share, 'share').mockRejectedValue(new Error('Paylaşım iptal edildi.'));
    const { findByText, getByLabelText } = render(<ProductAnalysisScreen />);

    await findByText('OmegaPet 3');
    fireEvent.press(getByLabelText('Paylaş'));

    await waitFor(() => expect(alertSpy).toHaveBeenCalledWith('Paylaşılamadı', 'Paylaşım iptal edildi.'));

    alertSpy.mockRestore();
    shareSpy.mockRestore();
  });

  it('deletes an existing price note', async () => {
    mockListPriceNotes.mockResolvedValue([
      { id: 'note-1', productId: 'prod-1', userId: 'user-1', store: 'Petshop XYZ', price: 249.9, date: '2026-08-20', note: '', createdAt: new Date().toISOString() },
    ]);
    const { findByText, getByTestId, queryByTestId } = render(<ProductAnalysisScreen />);

    await findByText('OmegaPet 3');
    await waitFor(() => getByTestId('price-note-note-1'));

    fireEvent.press(getByTestId('price-note-delete-note-1'));

    await waitFor(() => expect(mockDeletePriceNote).toHaveBeenCalledWith('prod-1', 'note-1'));
    await waitFor(() => expect(queryByTestId('price-note-note-1')).toBeNull());
  });
});
