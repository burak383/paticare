import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { petsApi, type Pet } from '../api';
import { useAuth } from './AuthContext';

type PetContextValue = {
  pets: Pet[];
  selectedPet: Pet | null;
  loading: boolean;
  refreshPets: () => Promise<void>;
  selectPet: (id: string) => Promise<void>;
  addPet: (input: Partial<Pet>) => Promise<Pet>;
  updatePetLocal: (id: string, patch: Partial<Pet>) => void;
};

const PetContext = createContext<PetContextValue | undefined>(undefined);

export function PetProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const [pets, setPets] = useState<Pet[]>([]);
  const [loading, setLoading] = useState(false);

  // Keyed on userId (a primitive), not the `user` object: if `user` were ever
  // recreated with a new identity on an unrelated re-render, depending on the
  // object itself would re-create `refreshPets` every render, which would
  // re-fire the effect below on every render too — an infinite refresh loop.
  const refreshPets = useCallback(async () => {
    if (!userId) {
      setPets([]);
      return;
    }
    setLoading(true);
    try {
      const list = await petsApi.listPets();
      setPets(list);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    refreshPets();
  }, [refreshPets]);

  const selectPet = useCallback(async (id: string) => {
    setPets((prev) => prev.map((p) => ({ ...p, active: p.id === id })));
    try {
      await petsApi.activatePet(id);
    } catch (err) {
      // Revert on failure by re-syncing with the server.
      await refreshPets();
      throw err;
    }
  }, [refreshPets]);

  const addPet = useCallback(async (input: Partial<Pet>) => {
    const pet = await petsApi.createPet(input);
    setPets((prev) => [...prev, pet]);
    return pet;
  }, []);

  const updatePetLocal = useCallback((id: string, patch: Partial<Pet>) => {
    setPets((prev) => prev.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  }, []);

  const selectedPet = useMemo(() => pets.find((p) => p.active) ?? pets[0] ?? null, [pets]);

  const value = useMemo(
    () => ({ pets, selectedPet, loading, refreshPets, selectPet, addPet, updatePetLocal }),
    [pets, selectedPet, loading, refreshPets, selectPet, addPet, updatePetLocal],
  );

  return <PetContext.Provider value={value}>{children}</PetContext.Provider>;
}

export function usePets() {
  const ctx = useContext(PetContext);
  if (!ctx) throw new Error('usePets must be used within PetProvider');
  return ctx;
}
