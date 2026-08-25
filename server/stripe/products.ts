/**
 * FAULTLINE Stripe product/price definitions.
 * Pricing metadata is sourced from shared/tiers.ts (single source of truth).
 * Only Stripe-specific fields (priceId from env) are added here.
 */
import { PRICING_PLANS, type StripePlanId, type AccessTier } from '../../shared/tiers';
import { stripe } from './client';

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

export async function verifyStripePlanConfiguration(plan: Plan): Promise<{ verified: true } | { verified: false; reason: string }> {
  if (!plan.priceId) return { verified: false, reason: 'A Stripe price ID has not been configured for this membership.' };
  if (plan.amount <= 0) return { verified: false, reason: 'This legacy plan is not available for new checkout.' };

  try {
    const price = await stripe.prices.retrieve(plan.priceId, { expand: ['product'] });
    const product = typeof price.product === 'string' ? null : price.product;
    const expectedType = plan.interval === 'one_time' ? 'one_time' : 'recurring';
    const expectedInterval = plan.interval === 'one_time' ? null : plan.interval;
    const valid = price.active
      && price.currency === 'usd'
      && price.unit_amount === plan.amount
      && price.type === expectedType
      && (expectedInterval === null || price.recurring?.interval === expectedInterval)
      && product?.name === plan.name;

    if (!valid) {
      return { verified: false, reason: 'The configured Stripe price does not exactly match the current public plan name, amount, currency, or billing interval.' };
    }
    return { verified: true };
  } catch {
    return { verified: false, reason: 'The configured Stripe price could not be verified.' };
  }
}
