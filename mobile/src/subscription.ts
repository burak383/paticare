import type { Subscription } from './api';

// Mirrors backend/src/subscription.js's hasPlusAccess(): the trial's
// trialEndsAt is checked by the backend on every read (see deriveSubscription
// there), so by the time a `subscription` reaches the app its `status` is
// already correctly lazily-expired — this just reads that status.
export function hasPlusAccess(subscription: Subscription | null | undefined): boolean {
  if (!subscription) return false;
  return subscription.status === 'trialing' || subscription.status === 'canceled';
}
