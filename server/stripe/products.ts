/**
 * FAULTLINE Stripe product/price definitions.
 * Pricing metadata is sourced from shared/tiers.ts (single source of truth).
 * Only Stripe-specific fields (priceId from env) are added here.
 */
import { PRICING_PLANS, type StripePlanId, type AccessTier } from '../../shared/tiers';

export type PlanId = StripePlanId;

export interface Plan {
  id: PlanId;
  name: string;
  description: string;
  priceId: string | null; // null = not yet configured
  amount: number;         // in cents
  interval: 'month' | 'year' | 'one_time';
  tier: AccessTier;
}

// Map env var names to plan IDs
const PRICE_ID_ENV: Record<StripePlanId, string | undefined> = {
  core:            process.env.STRIPE_CORE_PRICE_ID,
  core_annual:     process.env.STRIPE_CORE_ANNUAL_PRICE_ID,
  premium:         process.env.STRIPE_PREMIUM_PRICE_ID,
  premium_annual:  process.env.STRIPE_PREMIUM_ANNUAL_PRICE_ID,
  founding:        process.env.STRIPE_FOUNDING_PRICE_ID,
  lifetime:        process.env.STRIPE_LIFETIME_PRICE_ID,
};

export const PLANS: Record<PlanId, Plan> = Object.fromEntries(
  Object.entries(PRICING_PLANS).map(([id, p]) => [
    id,
    {
      id: p.planId,
      name: p.name,
      description: p.description,
      priceId: PRICE_ID_ENV[p.planId] ?? null,
      amount: p.amountCents,
      interval: p.interval,
      tier: p.tier,
    } satisfies Plan,
  ])
) as Record<PlanId, Plan>;

export function getPlanByPriceId(priceId: string): Plan | undefined {
  return Object.values(PLANS).find(p => p.priceId === priceId);
}
