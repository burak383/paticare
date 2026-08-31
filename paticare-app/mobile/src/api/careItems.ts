import { apiRequest } from './client';
import type { CareItem } from './types';

export async function listCareItems(params: { petId?: string; date?: string; from?: string; to?: string } = {}) {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value) query.set(key, value);
  });
  const qs = query.toString();
  const res = await apiRequest<{ careItems: CareItem[] }>(`/care-items${qs ? `?${qs}` : ''}`);
  return res.careItems;
}

export async function createCareItem(input: {
  petId: string;
  kind: CareItem['kind'];
  title: string;
  description?: string;
  tag?: string | null;
  date: string;
  time: string;
  recurrence?: string;
  notifyBefore?: number;
}) {
  const res = await apiRequest<{ careItem: CareItem }>('/care-items', { method: 'POST', body: input });
  return res.careItem;
}

export async function completeCareItem(id: string) {
  const res = await apiRequest<{ careItem: CareItem }>(`/care-items/${id}/complete`, { method: 'POST' });
  return res.careItem;
}

export async function skipCareItem(id: string) {
  const res = await apiRequest<{ careItem: CareItem }>(`/care-items/${id}/skip`, { method: 'POST' });
  return res.careItem;
}

export async function undoCareItem(id: string) {
  const res = await apiRequest<{ careItem: CareItem }>(`/care-items/${id}/undo`, { method: 'POST' });
  return res.careItem;
}

export async function deleteCareItem(id: string) {
  await apiRequest<{ success: boolean }>(`/care-items/${id}`, { method: 'DELETE' });
}
