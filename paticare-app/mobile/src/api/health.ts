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
