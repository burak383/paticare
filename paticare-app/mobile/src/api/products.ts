import { apiRequest } from './client';
import type { PriceNote, Product, SafetyAnalysis, ScanHistoryEntry } from './types';

export async function searchProducts(query: string) {
  const res = await apiRequest<{ products: Product[] }>(`/products/search?q=${encodeURIComponent(query)}`);
  return res.products;
}

export async function getProduct(id: string) {
  const res = await apiRequest<{ product: Product }>(`/products/${id}`);
  return res.product;
}

export async function scanProduct(input: { barcode?: string; name?: string; petId?: string }) {
  const res = await apiRequest<{ product: Product }>('/products/scan', { method: 'POST', body: input });
  return res.product;
}

export async function fetchScanHistory(petId: string) {
  const res = await apiRequest<{ history: ScanHistoryEntry[] }>(`/products/history/${petId}`);
  return res.history;
}

export async function analyzeSafety(petId: string, productIds: string[]) {
  return apiRequest<SafetyAnalysis>('/products/analyze-safety', {
    method: 'POST',
    body: { petId, productIds },
  });
}

// Fiyat notları — kullanıcının kendi gördüğü/ödediği fiyatları kaydettiği,
// gerçek olmayan "rakip mağaza fiyatları" içermeyen dürüst bir günlük.
export async function listPriceNotes(productId: string) {
  const res = await apiRequest<{ priceNotes: PriceNote[] }>(`/products/${productId}/price-notes`);
  return res.priceNotes;
}

export async function addPriceNote(productId: string, input: { store: string; price: number; date?: string; note?: string }) {
  const res = await apiRequest<{ priceNote: PriceNote }>(`/products/${productId}/price-notes`, {
    method: 'POST',
    body: input,
  });
  return res.priceNote;
}

export async function deletePriceNote(productId: string, noteId: string) {
  await apiRequest<{ success: boolean }>(`/products/${productId}/price-notes/${noteId}`, { method: 'DELETE' });
}
