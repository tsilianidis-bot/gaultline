/**
 * FAULTLINE Stripe product/price definitions.
 * These are the price IDs from the Stripe dashboard.
 * In test mode, create products manually in the Stripe dashboard and paste the price IDs here.
 * In production, replace with live price IDs.
 */

export type PlanId = 'core' | 'core_annual' | 'premium' | 'premium_annual' | 'founding' | 'lifetime';

export interface Plan {
  id: PlanId;
  name: string;
  description: string;
  priceId: string | null; // null = not yet configured
  amount: number;         // in cents
  interval: 'month' | 'year' | 'one_time';
  tier: 'core' | 'premium' | 'founding';
}

export const PLANS: Record<PlanId, Plan> = {
  core: {
    id: 'core',
    name: 'FAULTLINE Core',
    description: 'Signals screener, Portfolio tracker, and Alt Rotation — the essential toolkit.',
    priceId: process.env.STRIPE_CORE_PRICE_ID ?? null,
    amount: 999, // $9.99/month
    interval: 'month',
    tier: 'core',
  },
  core_annual: {
    id: 'core_annual',
    name: 'FAULTLINE Core (Annual)',
    description: 'Core toolkit billed annually — save 20% vs monthly.',
    priceId: process.env.STRIPE_CORE_ANNUAL_PRICE_ID ?? null,
    amount: 9588, // $95.88/year ($7.99/mo)
    interval: 'year',
    tier: 'core',
  },
  premium: {
    id: 'premium',
    name: 'FAULTLINE Pro',
    description: 'Full intelligence platform — AI guidance, Diagnostic AI, Crypto signals, and all advanced engines.',
    priceId: process.env.STRIPE_PREMIUM_PRICE_ID ?? null,
    amount: 5900, // $59/month
    interval: 'month',
    tier: 'premium',
  },
  premium_annual: {
    id: 'premium_annual',
    name: 'FAULTLINE Pro (Annual)',
    description: 'Full intelligence platform billed annually — save 20% vs monthly.',
    priceId: process.env.STRIPE_PREMIUM_ANNUAL_PRICE_ID ?? null,
    amount: 56400, // $564/year ($47/mo)
    interval: 'year',
    tier: 'premium',
  },
  founding: {
    id: 'founding',
    name: 'FAULTLINE Founding Member',
    description: 'Founding member rate — all Pro features locked at $49/mo for life.',
    priceId: process.env.STRIPE_FOUNDING_PRICE_ID ?? null,
    amount: 4900, // $49/month (founding rate, locked for life)
    interval: 'month',
    tier: 'founding',
  },
  lifetime: {
    id: 'lifetime',
    name: 'FAULTLINE Founding Lifetime',
    description: 'One-time payment — full founding access forever. No monthly charges, no renewals.',
    priceId: process.env.STRIPE_LIFETIME_PRICE_ID ?? null,
    amount: 120000, // $1,200 one-time
    interval: 'one_time',
    tier: 'founding',
  },
};

export function getPlanByPriceId(priceId: string): Plan | undefined {
  return Object.values(PLANS).find(p => p.priceId === priceId);
}
