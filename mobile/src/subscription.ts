import type { Subscription } from './api';

// Mirrors backend/src/subscription.js's hasPlusAccess(): the trial's
// trialEndsAt is checked by the backend on every read (see deriveSubscription
// there), so by the time a `subscription` reaches the app its `status` is
// already correctly lazily-expired — this just reads that status.
//
// 'active' MUST be included here (bug found in a pre-submission audit: this
// mirror was never updated when the backend added real RevenueCat purchases
// — without it, a paying customer's own subscription.status === 'active'
// read as "no Plus access" on ProfileScreen/ScanScreen even though the Plus
// screen correctly showed them as subscribed).
export function hasPlusAccess(subscription: Subscription | null | undefined): boolean {
  if (!subscription) return false;
  return subscription.status === 'trialing' || subscription.status === 'canceled' || subscription.status === 'active';
}
