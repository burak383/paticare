import { apiRequest } from './client';
import type { Pet } from './types';

export async function listPets() {
  const res = await apiRequest<{ pets: Pet[] }>('/pets');
  return res.pets;
}

export async function createPet(input: Partial<Pet>) {
  const res = await apiRequest<{ pet: Pet }>('/pets', { method: 'POST', body: input });
  return res.pet;
}

export async function updatePet(id: string, patch: Partial<Pet>) {
  const res = await apiRequest<{ pet: Pet }>(`/pets/${id}`, { method: 'PATCH', body: patch });
  return res.pet;
}

export async function activatePet(id: string) {
  const res = await apiRequest<{ pet: Pet }>(`/pets/${id}/activate`, { method: 'PATCH' });
  return res.pet;
}

export async function deletePet(id: string) {
  await apiRequest<{ success: boolean }>(`/pets/${id}`, { method: 'DELETE' });
}
