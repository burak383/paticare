import { apiRequest } from './client';
import type { Condition, Pet, VetNote, Vaccine, WeightLog } from './types';

export type PetHealth = {
  pet: Pet;
  vaccines: Vaccine[];
  weightLogs: WeightLog[];
  conditions: Condition[];
  vetNotes: VetNote[];
};

export async function fetchPetHealth(petId: string) {
  return apiRequest<PetHealth>(`/pets/${petId}/health`);
}

export async function addVaccine(petId: string, input: { title: string; date: string; status?: 'completed' | 'upcoming'; clinic?: string }) {
  const res = await apiRequest<{ vaccine: Vaccine }>(`/pets/${petId}/health/vaccines`, { method: 'POST', body: input });
  return res.vaccine;
}

export async function updateVaccine(id: string, patch: Partial<Vaccine>) {
  const res = await apiRequest<{ vaccine: Vaccine }>(`/health/vaccines/${id}`, { method: 'PATCH', body: patch });
  return res.vaccine;
}

export async function deleteVaccine(id: string) {
  await apiRequest<{ success: boolean }>(`/health/vaccines/${id}`, { method: 'DELETE' });
}

export async function addCondition(petId: string, input: { title: string; note?: string }) {
  const res = await apiRequest<{ condition: Condition }>(`/pets/${petId}/health/conditions`, { method: 'POST', body: input });
  return res.condition;
}

export async function updateCondition(id: string, patch: Partial<Pick<Condition, 'title' | 'note'>>) {
  const res = await apiRequest<{ condition: Condition }>(`/health/conditions/${id}`, { method: 'PATCH', body: patch });
  return res.condition;
}

export async function deleteCondition(id: string) {
  await apiRequest<{ success: boolean }>(`/health/conditions/${id}`, { method: 'DELETE' });
}

export async function addVetNote(petId: string, input: { vetName?: string; note: string; date?: string }) {
  const res = await apiRequest<{ vetNote: VetNote }>(`/pets/${petId}/health/vet-notes`, { method: 'POST', body: input });
  return res.vetNote;
}

export async function updateVetNote(id: string, patch: Partial<Pick<VetNote, 'vetName' | 'note' | 'date'>>) {
  const res = await apiRequest<{ vetNote: VetNote }>(`/health/vet-notes/${id}`, { method: 'PATCH', body: patch });
  return res.vetNote;
}

export async function deleteVetNote(id: string) {
  await apiRequest<{ success: boolean }>(`/health/vet-notes/${id}`, { method: 'DELETE' });
}

export async function addWeightLog(petId: string, weightKg: number, date?: string) {
  const res = await apiRequest<{ weightLog: WeightLog }>(`/pets/${petId}/health/weight`, {
    method: 'POST',
    body: { weightKg, date },
  });
  return res.weightLog;
}

export async function exportHealthReport(petId: string) {
  return apiRequest<{ fileName: string; text: string }>(`/pets/${petId}/health/export`);
}
