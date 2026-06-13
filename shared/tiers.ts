/**
 * FAULTLINE — Canonical Tier & Pricing Definitions
 * ──────────────────────────────────────────────────
 * This is the SINGLE SOURCE OF TRUTH for all tier names, display labels,
 * pricing, Stripe plan IDs, access levels, and feature gates.
 *
 * All UI components, server middleware, Stripe product mapping, and
 * marketing copy MUST derive from this file. Do NOT hardcode tier names,
 * prices, or plan IDs anywhere else.
 *
 * PRICING NOTE (as of June 2026):
 * - The `founding` plan is a monthly subscription at $49/mo locked for life.
 * - The `lifetime` plan is a one-time payment of $1,200.
 * - Some UI surfaces previously showed "Founding Access — $199 one-time" —
 *   this was a mismatch. The Stripe product ($49/mo) is the source of truth.
 * - PremiumGate previously showed "$79/mo" for Operator — this was a stale
 *   marketing name. The canonical premium plan is $59/mo.
 */

// ─── Canonical Access Tier IDs ────────────────────────────────────────────────
// These match the `accessTier` enum in drizzle/schema.ts and server/db.ts.
export type AccessTier = 'free' | 'core' | 'premium' | 'founding';

// ─── Canonical Stripe Plan IDs ────────────────────────────────────────────────
// These match the planId enum in server/stripe/products.ts and billing router.
export type StripePlanId =
  | 'core'
  | 'core_annual'
  | 'premium'
  | 'premium_annual'
  | 'founding'
  | 'lifetime';

// ─── Tier Hierarchy ───────────────────────────────────────────────────────────
// Higher index = higher access. Used for >= comparisons.
export const TIER_HIERARCHY: AccessTier[] = ['free', 'core', 'premium', 'founding'];

/** Returns true if userTier meets or exceeds requiredTier */
export function tierMeetsRequirement(userTier: AccessTier, requiredTier: AccessTier): boolean {
  const userIdx = TIER_HIERARCHY.indexOf(userTier);
  const reqIdx  = TIER_HIERARCHY.indexOf(requiredTier);
  return userIdx >= reqIdx;
}

// ─── Tier Display Metadata ────────────────────────────────────────────────────
export interface TierMeta {
  /** Canonical DB/API tier ID */
  id: AccessTier;
  /** Short display label (e.g. "CORE") */
  label: string;
  /** Marketing display name (e.g. "Core") */
  displayName: string;
  /** One-line positioning copy */
  sublabel: string;
  /** Longer description for account/upgrade pages */
  description: string;
  /** Hex accent color */
  color: string;
  /** RGBA glow for backgrounds */
  glow: string;
  /** RGBA border color */
  border: string;
  /** Feature list for account/gate UI */
  features: { label: string; available: boolean }[];
}

export const TIER_META: Record<AccessTier, TierMeta> = {
  free: {
    id: 'free',
    label: 'PREVIEW',
    displayName: 'Preview Access',
    sublabel: 'Preview Access',
    description: 'Start monitoring systemic pressure. Discover what institutional intelligence feels like.',
    color: '#6B7280',
    glow: 'rgba(107,114,128,0.2)',
    border: 'rgba(107,114,128,0.3)',
    features: [
      { label: 'FAULTLINE Pressure Index™ (live preview)', available: true },
      { label: 'Limited stock intelligence previews', available: true },
      { label: 'Limited crypto signal previews', available: true },
      { label: 'Daily macro snapshot', available: true },
      { label: 'Signals screener (full)', available: false },
      { label: 'Portfolio tracker', available: false },
      { label: 'AI intelligence engines', available: false },
      { label: 'Premium dashboards', available: false },
    ],
  },
  core: {
    id: 'core',
    label: 'CORE',
    displayName: 'Core',
    sublabel: 'Mobile-first Market Intelligence',
    description: 'Fast, intelligent, connected. Built for traders who want institutional signals without the institutional price.',
    color: '#22D3EE',
    glow: 'rgba(34,211,238,0.2)',
    border: 'rgba(34,211,238,0.3)',
    features: [
      { label: 'Limited stock signals (BUY/SELL/HOLD)', available: true },
      { label: 'Limited crypto signals', available: true },
      { label: 'Portfolio tracker with live P&L', available: true },
      { label: 'Alt Rotation tracking', available: true },
      { label: 'Daily market briefings', available: true },
      { label: 'Volatility monitoring & push alerts', available: true },
      { label: 'AI position guidance', available: false },
      { label: 'Diagnostic AI™', available: false },
    ],
  },
  premium: {
    id: 'premium',
    label: 'PRO',
    displayName: 'Pro',
    sublabel: 'Institutional-grade Intelligence',
    description: 'The complete intelligence suite. Every engine, every signal, every edge — fully unlocked.',
    color: '#00D4FF',
    glow: 'rgba(0,212,255,0.2)',
    border: 'rgba(0,212,255,0.35)',
    features: [
      { label: 'Everything in Core', available: true },
      { label: 'AI Diagnostic Intelligence™', available: true },
      { label: 'Full crypto intelligence engine', available: true },
      { label: 'Advanced Aftershock Engine™', available: true },
      { label: 'Full systemic risk analytics', available: true },
      { label: 'Macro regime analysis', available: true },
      { label: 'Advanced watchlists & alerts', available: true },
      { label: 'Historical analog engine', available: true },
    ],
  },
  founding: {
    id: 'founding',
    label: 'FOUNDING',
    displayName: 'Founding Member',
    sublabel: 'Early Institutional Access',
    description: 'Everything in Pro at the founding rate. Locked forever. Never increases. Limited cohort.',
    color: '#FFD700',
    glow: 'rgba(255,215,0,0.2)',
    border: 'rgba(255,215,0,0.4)',
    features: [
      { label: 'Everything in Pro', available: true },
      { label: 'Permanent founding rate ($49/mo locked)', available: true },
      { label: 'Founding member badge', available: true },
      { label: 'Future feature grandfathering', available: true },
      { label: 'Roadmap previews & early beta', available: true },
      { label: 'Priority feature access', available: true },
      { label: 'Exclusive founder-only tools', available: true },
      { label: 'Direct feedback channel', available: true },
    ],
  },
};

// ─── Stripe Plan Pricing ──────────────────────────────────────────────────────
export interface PricingPlan {
  planId: StripePlanId;
  /** Canonical access tier this plan grants */
  tier: AccessTier;
  /** Marketing display name */
  name: string;
  /** Price in cents */
  amountCents: number;
  /** Human-readable price string (e.g. "$9.99/mo") */
  priceLabel: string;
  /** Billing interval */
  interval: 'month' | 'year' | 'one_time';
  /** Short description for checkout/marketing */
  description: string;
  /** Whether this plan is currently available for purchase */
  available: boolean;
}

export const PRICING_PLANS: Record<StripePlanId, PricingPlan> = {
  core: {
    planId: 'core',
    tier: 'core',
    name: 'FAULTLINE Core',
    amountCents: 999,
    priceLabel: '$9.99/mo',
    interval: 'month',
    description: 'Signals screener, Portfolio tracker, and Alt Rotation — the essential toolkit.',
    available: true,
  },
  core_annual: {
    planId: 'core_annual',
    tier: 'core',
    name: 'FAULTLINE Core (Annual)',
    amountCents: 9588,
    priceLabel: '$7.99/mo (billed $95.88/yr)',
    interval: 'year',
    description: 'Core toolkit billed annually — save 20% vs monthly.',
    available: false, // configure STRIPE_CORE_ANNUAL_PRICE_ID to enable
  },
  premium: {
    planId: 'premium',
    tier: 'premium',
    name: 'FAULTLINE Pro',
    amountCents: 5900,
    priceLabel: '$59/mo',
    interval: 'month',
    description: 'Full intelligence platform — AI guidance, Diagnostic AI, Crypto signals, and all advanced engines.',
    available: true,
  },
  premium_annual: {
    planId: 'premium_annual',
    tier: 'premium',
    name: 'FAULTLINE Pro (Annual)',
    amountCents: 56400,
    priceLabel: '$47/mo (billed $564/yr)',
    interval: 'year',
    description: 'Full intelligence platform billed annually — save 20% vs monthly.',
    available: false, // configure STRIPE_PREMIUM_ANNUAL_PRICE_ID to enable
  },
  founding: {
    planId: 'founding',
    tier: 'founding',
    name: 'FAULTLINE Founding Member',
    amountCents: 4900,
    priceLabel: '$49/mo (locked for life)',
    interval: 'month',
    description: 'Founding member rate — all Pro features locked at $49/mo forever.',
    available: true,
  },
  lifetime: {
    planId: 'lifetime',
    tier: 'founding',
    name: 'FAULTLINE Founding Lifetime',
    amountCents: 120000,
    priceLabel: '$1,200 one-time',
    interval: 'one_time',
    description: 'One-time payment — full founding access forever. No monthly charges, no renewals.',
    available: true,
  },
};

// ─── Gate Access Requirements ─────────────────────────────────────────────────
// Maps each PremiumGate variant to the minimum required tier.
export type GateVariant =
  | 'founding'
  | 'signals'
  | 'portfolio'
  | 'altRotation'
  | 'risk'
  | 'intelligence'
  | 'crypto'
  | 'aftershock'
  | 'watchlist';

export const GATE_REQUIRED_TIER: Record<GateVariant, AccessTier> = {
  signals:      'core',
  portfolio:    'core',
  altRotation:  'core',
  founding:     'premium',
  risk:         'premium',
  intelligence: 'premium',
  crypto:       'premium',
  aftershock:   'premium',
  watchlist:    'premium',
};

// ─── CTA Label Helpers ────────────────────────────────────────────────────────
/** Returns the primary upgrade CTA label for a given gate */
export function getGatePrimaryCtaLabel(variant: GateVariant): string {
  const tier = GATE_REQUIRED_TIER[variant];
  if (tier === 'core') return `Unlock Core — ${PRICING_PLANS.core.priceLabel}`;
  return `Unlock Pro — ${PRICING_PLANS.premium.priceLabel}`;
}

/** Returns the secondary upgrade CTA label (founding upsell) */
export function getGateSecondaryCtaLabel(): string {
  return `Founding Access — ${PRICING_PLANS.founding.priceLabel}`;
}

// ─── Marketing Tier Cards ─────────────────────────────────────────────────────
// Used by MarketingSite.tsx and PressureIndex.tsx pricing sections.
export interface MarketingTierCard {
  tier: AccessTier;
  planId: StripePlanId;
  marketingName: string;   // Display name on marketing page
  price: string;
  tagline: string;
  color: string;
  badge?: string;
  features: string[];
  ctaLabel: string;
}

export const MARKETING_TIER_CARDS: MarketingTierCard[] = [
  {
    tier: 'free',
    planId: 'core', // CTA upgrades to core
    marketingName: 'Preview',
    price: 'Free',
    tagline: 'No credit card required',
    color: '#6B7280',
    features: [
      'FAULTLINE Pressure Index™',
      'Limited stock previews',
      'Limited crypto previews',
      'Daily macro snapshot',
    ],
    ctaLabel: 'Start Free',
  },
  {
    tier: 'core',
    planId: 'core',
    marketingName: 'Core',
    price: PRICING_PLANS.core.priceLabel,
    tagline: 'Mobile-first intelligence',
    color: '#22D3EE',
    badge: 'MOST POPULAR ENTRY',
    features: [
      'Signals screener',
      'Portfolio tracker',
      'Alt Rotation',
      'Mobile PWA',
    ],
    ctaLabel: `Get Core — ${PRICING_PLANS.core.priceLabel}`,
  },
  {
    tier: 'premium',
    planId: 'premium',
    marketingName: 'Pro',
    price: PRICING_PLANS.premium.priceLabel,
    tagline: 'Institutional-grade suite',
    color: '#00D4FF',
    badge: 'RECOMMENDED',
    features: [
      'AI Diagnostic™',
      'Crypto intelligence',
      'Aftershock Engine™',
      'Full macro suite',
    ],
    ctaLabel: `Unlock Pro — ${PRICING_PLANS.premium.priceLabel}`,
  },
  {
    tier: 'founding',
    planId: 'founding',
    marketingName: 'Founding Member',
    price: PRICING_PLANS.founding.priceLabel,
    tagline: 'Rate locked for life',
    color: '#FFD700',
    badge: 'LIMITED',
    features: [
      'Everything in Pro',
      'Rate locked forever',
      'Founder badge',
      'Early beta access',
    ],
    ctaLabel: `Lock In Founding — ${PRICING_PLANS.founding.priceLabel}`,
  },
];
