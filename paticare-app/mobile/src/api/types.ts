export type Preferences = {
  medicationReminders: boolean;
  defaultReminderMorning: string;
  defaultReminderEvening: string;
  notificationSound: string;
  language: string;
};

export type User = {
  id: string;
  email: string;
  name: string;
  guest: boolean;
  authProvider?: 'password' | 'guest' | 'google';
  avatarUrl?: string | null;
  preferences: Preferences;
  createdAt: string;
};

export type Pet = {
  id: string;
  ownerId: string;
  name: string;
  species: string;
  breed: string | null;
  gender: string | null;
  birthDate: string | null;
  weightKg: number | null;
  neutered: boolean;
  avatarUrl: string | null;
  coverUrl: string | null;
  active: boolean;
  createdAt: string;
};

export type CareItemKind = 'medication' | 'weight_check' | 'vaccine' | 'other';
export type CareItemStatus = 'pending' | 'done' | 'skipped';

export type CareItem = {
  id: string;
  petId: string;
  ownerId: string;
  kind: CareItemKind;
  title: string;
  description: string;
  tag: string | null;
  date: string;
  time: string;
  recurrence: string;
  notifyBefore: number;
  status: CareItemStatus;
  completedAt: string | null;
  createdAt: string;
};

export type Vaccine = {
  id: string;
  petId: string;
  title: string;
  date: string;
  status: 'completed' | 'upcoming';
  clinic: string | null;
};

export type WeightLog = {
  id: string;
  petId: string;
  date: string;
  weightKg: number;
};

export type Condition = {
  id: string;
  petId: string;
  title: string;
  note: string;
  date: string;
};

export type VetNote = {
  id: string;
  petId: string;
  vetName: string;
  date: string;
  note: string;
};

export type ProductIngredient = {
  name: string;
  amount: string;
  omega3Mg?: number;
};

export type ProductInteraction = {
  productName: string;
  note: string;
  omega3PerDayMg?: number;
};

export type Product = {
  id: string;
  barcode: string;
  brand: string;
  name: string;
  category: string;
  imageUrl: string;
  aiSummary: string;
  doseTitle: string;
  doseNote: string;
  ingredients: ProductIngredient[];
  warnings: string[];
  interactsWith: ProductInteraction[];
};

export type ScanHistoryEntry = {
  id: string;
  userId: string;
  petId: string;
  productId: string;
  scannedAt: string;
  resultSummary: string;
  product: Product | null;
};

export type PriceNote = {
  id: string;
  productId: string;
  userId: string;
  store: string;
  price: number;
  date: string;
  note: string;
  createdAt: string;
};

export type SafetyAnalysis = {
  petId: string;
  contributions: { productId: string; name: string; omega3Mg: number }[];
  totalMg: number;
  threshold: number;
  risk: 'low' | 'medium' | 'high';
  recommendation: string;
};
