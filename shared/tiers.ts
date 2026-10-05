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
 * TIER NAMES (as of July 2026):
 * - free     → "Free"           — existing free daily market awareness
 * - core     → "Trader"         — core market intelligence
 * - premium  → "Power"          — deepest professional toolset
 * - founding → "Founding"       — founding membership
 *
 * PRICING NOTE:
 * - Paid plans are NOT on sale. Every user-facing price string (`priceLabel`)
 *   reads PLAN_NOT_ON_SALE_LABEL and upgrade-to-buy CTAs are hidden while
 *   PAID_PLANS_ON_SALE is false. This is display-only: `amountCents`, plan IDs,
 *   `available`, tier gating and the Stripe verification path are unchanged.
 */

/** Display-only switch: paid plans are not on sale. Does not affect checkout logic. */
export const PAID_PLANS_ON_SALE: boolean = false;
/** Short label shown wherever a plan price used to be displayed. */
export const PLAN_NOT_ON_SALE_LABEL = 'Not on sale yet';
/** Sentence used in app/email/chat copy while paid plans are not on sale. */
export const PAID_PLANS_NOT_ON_SALE_COPY = 'Paid plans are not on sale yet.';

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
  /** Short display label (e.g. "TRADER") */
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
    label: 'FREE',
    displayName: 'Free',
    sublabel: 'Free Market Awareness',
    description: 'Open FAULTLINE every morning and immediately understand the state of the market. No credit card required.',
    color: '#6B7280',
    glow: 'rgba(107,114,128,0.2)',
    border: 'rgba(107,114,128,0.3)',
    features: [
      { label: 'Live FAULTLINE Pressure Index™', available: true },
      { label: 'Current Stock Market Regime', available: true },
      { label: 'Current Crypto Market Regime', available: true },
      { label: 'Cross-Market Intelligence summary', available: true },
      { label: 'Risk-On / Mixed / Risk-Off reading', available: true },
      { label: 'Daily Intelligence Brief (summary)', available: true },
      { label: 'Bull/Bear probabilities', available: true },
      { label: 'Top 3 Opportunity Radar', available: true },
      { label: 'Limited Ask Intelligence (10/day)', available: true },
      { label: 'Limited Watchlist (3 symbols)', available: true },
      { label: 'Unlimited Ask Intelligence', available: false },
      { label: 'Full Signal Outlook & Decision Engine', available: false },
      { label: 'Portfolio Intelligence', available: false },
      { label: 'Institutional dashboards', available: false },
    ],
  },
  core: {
    id: 'core',
    label: 'TRADER',
    displayName: 'Trader',
    sublabel: 'Core Market Intelligence',
    description: 'The primary investor experience for market intelligence, monitoring, signals, watch tools, interpretation, and decision support.',
    color: '#22D3EE',
    glow: 'rgba(34,211,238,0.2)',
    border: 'rgba(34,211,238,0.3)',
    features: [
      { label: 'Everything in Observer', available: true },
      { label: 'Unlimited Ask Intelligence', available: true },
      { label: 'Complete Symbol Intelligence', available: true },
      { label: 'Full Signal Outlook', available: true },
      { label: 'Unlimited Watchlists', available: true },
      { label: 'Portfolio Intelligence', available: true },
      { label: 'Complete Opportunity Radar', available: true },
      { label: 'Entry/Exit analysis', available: true },
      { label: 'Sector Intelligence', available: true },
      { label: 'Advanced Alerts', available: true },
      { label: 'Trade Journal', available: true },
      { label: 'Full Daily Intelligence Report', available: true },
      { label: 'Situation Room', available: false },
      { label: 'Institutional dashboards', available: false },
    ],
  },
  premium: {
    id: 'premium',
    label: 'POWER',
    displayName: 'Power',
    sublabel: 'Professional Intelligence Toolset',
    description: 'The deepest FAULTLINE intelligence experience, with advanced analysis, expanded research, and the full professional toolset.',
    color: '#00D4FF',
    glow: 'rgba(0,212,255,0.2)',
    border: 'rgba(0,212,255,0.35)',
    features: [
      { label: 'Everything in Trader', available: true },
      { label: 'Situation Room', available: true },
      { label: 'Institutional dashboards', available: true },
      { label: 'Historical analog engine', available: true },
      { label: 'Deep macro intelligence', available: true },
      { label: 'Scenario modeling', available: true },
      { label: 'Advanced probability models', available: true },
      { label: 'Priority data refreshes', available: true },
      { label: 'Premium notifications', available: true },
      { label: 'Full Crypto Intelligence suite', available: true },
      { label: 'Decision Engine', available: true },
    ],
  },
  founding: {
    id: 'founding',
    label: 'FOUNDING',
    displayName: 'Founding',
    sublabel: 'Founding Access',
    description: 'Everything in Pro. Founding membership is not on sale yet.',
    color: '#FFD700',
    glow: 'rgba(255,215,0,0.2)',
    border: 'rgba(255,215,0,0.4)',
    features: [
      { label: 'Everything in Pro', available: true },
      { label: 'Founding membership — not on sale yet', available: true },
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
  /** User-facing price string. PLAN_NOT_ON_SALE_LABEL while paid plans are not on sale. */
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
    name: 'FAULTLINE Trader',
    amountCents: 5900,
    priceLabel: PLAN_NOT_ON_SALE_LABEL,
    interval: 'month',
    description: 'Core market intelligence, monitoring, signals, watch tools, interpretation, and decision support.',
    available: true,
  },
  core_annual: {
    planId: 'core_annual',
    tier: 'core',
    name: 'FAULTLINE Trader (Annual)',
    amountCents: 0,
    priceLabel: 'Annual pricing unavailable',
    interval: 'year',
    description: 'Legacy annual subscription support only. Not offered publicly unless separately verified.',
    available: false,
  },
  premium: {
    planId: 'premium',
    tier: 'premium',
    name: 'FAULTLINE Power',
    amountCents: 9900,
    priceLabel: PLAN_NOT_ON_SALE_LABEL,
    interval: 'month',
    description: 'Advanced analysis, expanded research capabilities, and the full professional FAULTLINE toolset.',
    available: true,
  },
  premium_annual: {
    planId: 'premium_annual',
    tier: 'premium',
    name: 'FAULTLINE Power (Annual)',
    amountCents: 0,
    priceLabel: 'Annual pricing unavailable',
    interval: 'year',
    description: 'Legacy annual subscription support only. Not offered publicly unless separately verified.',
    available: false,
  },
  founding: {
    planId: 'founding',
    tier: 'founding',
    name: 'FAULTLINE Founding Member',
    amountCents: 4900,
    priceLabel: PLAN_NOT_ON_SALE_LABEL,
    interval: 'month',
    description: 'Founding membership. Not on sale yet.',
    available: true,
  },
  lifetime: {
    planId: 'lifetime',
    tier: 'founding',
    name: 'FAULTLINE Founding Lifetime (Legacy)',
    amountCents: 29900,
    priceLabel: PLAN_NOT_ON_SALE_LABEL,
    interval: 'one_time',
    description: 'One-time payment — full founding access forever. No monthly charges, no renewals.',
    available: false,
  },
};

// ─── Gate Access Requirements ─────────────────────────────────────────────────
// Maps each PremiumGate variant to the minimum required tier.
// Trader tier = 'core', Power tier = 'premium'
export type GateVariant =
  | 'founding'
  | 'signals'
  | 'portfolio'
  | 'altRotation'
  | 'risk'
  | 'intelligence'
  | 'crypto'
  | 'aftershock'
  | 'watchlist'
  // New Trader-tier gates
  | 'symbolIntel'
  | 'opportunities'
  | 'tradeJournal'
  | 'socialIntel'
  | 'insiderIntel'
  | 'alerts'
  // New Power-tier gates
  | 'decisionEngine'
  | 'signalOutlook'
  | 'preFlight'
  | 'dayTrade'
  | 'marketCommandCenter';

export const GATE_REQUIRED_TIER: Record<GateVariant, AccessTier> = {
  // Core tier (core)
  signals:            'core',
  portfolio:          'core',
  altRotation:        'core',
  symbolIntel:        'core',
  opportunities:      'core',
  tradeJournal:       'core',
  socialIntel:        'core',
  insiderIntel:       'core',
  alerts:             'core',
  watchlist:          'core',  // unlimited watchlist requires core; free gets 3 symbols
  // Pro tier (premium)
  founding:           'premium',
  risk:               'premium',
  intelligence:       'premium',
  crypto:             'premium',
  aftershock:         'premium',
  decisionEngine:     'premium',
  signalOutlook:      'premium',
  preFlight:          'premium',
  dayTrade:           'premium',
  marketCommandCenter: 'premium',
};

// ─── CTA Label Helpers ────────────────────────────────────────────────────────
/** Returns the primary upgrade CTA label for a given gate */
export function getGatePrimaryCtaLabel(variant: GateVariant): string {
  const tier = GATE_REQUIRED_TIER[variant];
  if (tier === 'core') return `Get Trader — ${PRICING_PLANS.core.priceLabel}`;
  return `Get Power — ${PRICING_PLANS.premium.priceLabel}`;
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
    tier: 'core',
    planId: 'core',
    marketingName: 'Trader',
    price: PRICING_PLANS.core.priceLabel,
    tagline: 'The primary full investor experience',
    color: '#22D3EE',
    badge: 'NOT ON SALE YET',
    features: [
      'Unlimited Ask Intelligence',
      'Complete Symbol Intelligence',
      'Full Signal Outlook',
      'Unlimited Watchlists',
      'Portfolio Intelligence',
      'Complete Opportunity Radar',
      'Entry/Exit analysis',
      'Advanced Alerts & Trade Journal',
      'Full Daily Intelligence Report',
    ],
    ctaLabel: 'NOT ON SALE YET',
  },
  {
    tier: 'premium',
    planId: 'premium',
    marketingName: 'Power',
    price: PRICING_PLANS.premium.priceLabel,
    tagline: 'The deepest advanced intelligence experience',
    color: '#00D4FF',
    badge: 'NOT ON SALE YET',
    features: [
      'Everything in Trader',
      'Situation Room',
      'Institutional dashboards',
      'Historical analog engine',
      'Deep macro intelligence',
      'Scenario modeling',
      'Advanced probability models',
      'Full Crypto Intelligence suite',
    ],
    ctaLabel: 'NOT ON SALE YET',
  },
  {
    tier: 'founding',
    planId: 'founding',
    marketingName: 'Founding Member',
    price: PRICING_PLANS.founding.priceLabel,
    tagline: 'Founding membership',
    color: '#FFD700',
    badge: 'NOT ON SALE YET',
    features: [
      'Everything in Power',
      'Founding member badge',
      'Future feature grandfathering',
      'Early beta access',
    ],
    ctaLabel: 'NOT ON SALE YET',
  },
];
