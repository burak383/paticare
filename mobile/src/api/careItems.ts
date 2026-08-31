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

export async function updateCareItem(
  id: string,
  patch: Partial<Pick<CareItem, 'title' | 'description' | 'tag' | 'date' | 'time' | 'recurrence' | 'notifyBefore' | 'kind'>>,
) {
  const res = await apiRequest<{ careItem: CareItem }>(`/care-items/${id}`, { method: 'PATCH', body: patch });
  return res.careItem;
}

// For a recurring item, the backend also spawns and returns the next pending
// occurrence (same title/time, next date) — nextOccurrence is null for a
// one-off ('Bir kez') item. Callers that show/schedule reminders need to pick
// this up (add it to their list, schedule its notification); see CalendarScreen.
export async function completeCareItem(id: string) {
  const res = await apiRequest<{ careItem: CareItem; nextOccurrence: CareItem | null }>(`/care-items/${id}/complete`, {
    method: 'POST',
  });
  return { careItem: res.careItem, nextOccurrence: res.nextOccurrence };
}

export async function skipCareItem(id: string) {
  const res = await apiRequest<{ careItem: CareItem; nextOccurrence: CareItem | null }>(`/care-items/${id}/skip`, {
    method: 'POST',
  });
  return { careItem: res.careItem, nextOccurrence: res.nextOccurrence };
}

export async function undoCareItem(id: string) {
  const res = await apiRequest<{ careItem: CareItem }>(`/care-items/${id}/undo`, { method: 'POST' });
  return res.careItem;
}

export async function deleteCareItem(id: string) {
  await apiRequest<{ success: boolean }>(`/care-items/${id}`, { method: 'DELETE' });
}
