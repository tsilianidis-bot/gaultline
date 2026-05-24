/**
 * FAULTLINE Stripe product/price definitions.
 * These are the price IDs from the Stripe dashboard.
 * In test mode, create products manually in the Stripe dashboard and paste the price IDs here.
 * In production, replace with live price IDs.
 */

export type PlanId = 'premium' | 'founding';

export interface Plan {
  id: PlanId;
  name: string;
  description: string;
  priceId: string | null; // null = not yet configured
  amount: number;         // in cents
  interval: 'month' | 'year' | 'one_time';
  tier: 'premium' | 'founding';
}

export const PLANS: Record<PlanId, Plan> = {
  premium: {
    id: 'premium',
    name: 'FAULTLINE Premium',
    description: 'Full access to all intelligence features, signals, and engines.',
    priceId: process.env.STRIPE_PREMIUM_PRICE_ID ?? null,
    amount: 5900, // $59/month
    interval: 'month',
    tier: 'premium',
  },
  founding: {
    id: 'founding',
    name: 'FAULTLINE Founding Member',
    description: 'Founding member rate — all premium features locked at $49/mo for life.',
    priceId: process.env.STRIPE_FOUNDING_PRICE_ID ?? null,
    amount: 4900, // $49/month (founding rate, locked for life)
    interval: 'month',
    tier: 'founding',
  },
};

export function getPlanByPriceId(priceId: string): Plan | undefined {
  return Object.values(PLANS).find(p => p.priceId === priceId);
}
