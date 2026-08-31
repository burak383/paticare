import { apiRequest } from './client';
import type { SubscriptionPlan, SubscriptionPlanId, User } from './types';

export async function getPlans() {
  return apiRequest<{ plans: SubscriptionPlan[]; trialDays: number }>('/subscription/plans');
}

export async function startTrial(plan: SubscriptionPlanId) {
  const res = await apiRequest<{ user: User }>('/subscription/start-trial', {
    method: 'POST',
    body: { plan },
  });
  return res.user;
}

export async function cancelTrial() {
  const res = await apiRequest<{ user: User }>('/subscription/cancel', { method: 'POST' });
  return res.user;
}
