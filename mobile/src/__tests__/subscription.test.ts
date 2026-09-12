import { hasPlusAccess } from '../subscription';
import type { Subscription } from '../api';

function sub(overrides: Partial<Subscription>): Subscription {
  return { plan: null, status: 'none', trialEndsAt: null, canceledAt: null, trialUsed: false, ...overrides };
}

describe('hasPlusAccess', () => {
  it('grants access during an active trial', () => {
    expect(hasPlusAccess(sub({ status: 'trialing' }))).toBe(true);
  });

  it('grants access after canceling (until the period ends server-side)', () => {
    expect(hasPlusAccess(sub({ status: 'canceled' }))).toBe(true);
  });

  // Regression: a pre-submission audit found this mirror of
  // backend/src/subscription.js's hasPlusAccess() had never been updated
  // when the backend added real RevenueCat purchases (status: 'active') —
  // without this case, a paying customer's own subscription read as "no
  // Plus access" everywhere except the Plus screen itself (which checks
  // RevenueCat's own customerInfo, not this function).
  it('grants access for a real RevenueCat subscription (status: active)', () => {
    expect(hasPlusAccess(sub({ status: 'active' }))).toBe(true);
  });

  it('denies access once expired', () => {
    expect(hasPlusAccess(sub({ status: 'expired' }))).toBe(false);
  });

  it('denies access with no subscription at all', () => {
    expect(hasPlusAccess(null)).toBe(false);
    expect(hasPlusAccess(undefined)).toBe(false);
  });
});
