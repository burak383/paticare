export type Preferences = {
  medicationReminders: boolean;
  defaultReminderMorning: string;
  defaultReminderEvening: string;
  notificationSound: string;
  language: string;
};

export type SubscriptionPlanId = 'monthly' | 'yearly';
// 'active' = gerçek bir RevenueCat satın alması (bkz.
// backend/src/routes/subscription.js'teki /revenuecat-webhook) — demo deneme
// akışı buraya hiç ulaşmaz, sadece 'trialing'/'canceled'/'expired' üretir.
export type SubscriptionStatus = 'none' | 'trialing' | 'canceled' | 'active' | 'expired';

export type Subscription = {
  plan: SubscriptionPlanId | null;
  status: SubscriptionStatus;
  trialEndsAt: string | null;
  canceledAt: string | null;
  trialUsed: boolean;
  // Yalnızca gerçek (RevenueCat) satın almalarda dolu — bkz.
  // backend/src/subscription.js'teki DEFAULT_SUBSCRIPTION yorumu.
  store?: 'apple' | 'google' | null;
  productId?: string | null;
  expiresAt?: string | null;
};

export type SubscriptionPlan = {
  id: SubscriptionPlanId;
  label: string;
  priceLabel: string;
  badgeLabel?: string;
};

export type User = {
  id: string;
  email: string;
  name: string;
  guest: boolean;
  authProvider?: 'password' | 'guest' | 'google';
  avatarUrl?: string | null;
  preferences: Preferences;
  subscription: Subscription;
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
