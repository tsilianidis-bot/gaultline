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
 * - free     → "Free"           — free daily market awareness
 * - core     → "Core"           — market intelligence anywhere ($9.99/mo)
 * - premium  → "Pro"            — institutional-grade intelligence suite ($59/mo)
 * - founding → "Founding"       — rate locked for life ($49/mo)
 *
 * PRICING NOTE:
 * - The `founding` plan is a monthly subscription at $49/mo locked for life.
 * - The `lifetime` plan is a one-time payment of $299.
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
    label: 'CORE',
    displayName: 'Core',
    sublabel: 'Market Intelligence Anywhere',
    description: 'The easiest way to experience FAULTLINE. Unlimited signals, portfolio tracking, AI-guided decisions, and the full Core mobile companion — for $9.99/month.',
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
      { label: 'Situation Room & Market Preflight', available: false },
      { label: 'Institutional dashboards', available: false },
    ],
  },
  premium: {
    id: 'premium',
    label: 'PRO',
    displayName: 'Pro',
    sublabel: 'Institutional-Grade Intelligence',
    description: 'How would an institutional investment committee analyze today\'s market? Every engine, every signal, every edge — fully unlocked.',
    color: '#00D4FF',
    glow: 'rgba(0,212,255,0.2)',
    border: 'rgba(0,212,255,0.35)',
    features: [
      { label: 'Everything in Trader', available: true },
      { label: 'Situation Room', available: true },
      { label: 'Market Preflight', available: true },
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
    sublabel: 'Early Institutional Access — Rate Locked Forever',
    description: 'Everything in Pro at the founding rate. Locked forever. Never increases. Limited cohort.',
    color: '#FFD700',
    glow: 'rgba(255,215,0,0.2)',
    border: 'rgba(255,215,0,0.4)',
    features: [
      { label: 'Everything in Pro', available: true },
      { label: 'Founding rate $49/mo — locked for life', available: true },
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
    description: 'Signals screener, Portfolio tracker, Symbol Intelligence, and the full decision toolkit.',
    available: true,
  },
  core_annual: {
    planId: 'core_annual',
    tier: 'core',
    name: 'FAULTLINE Core (Annual)',
    amountCents: 9588,
    priceLabel: '$7.99/mo (billed $95.88/yr)',
    interval: 'year',
    description: 'Trader toolkit billed annually — save 20% vs monthly.',
    available: false, // configure STRIPE_CORE_ANNUAL_PRICE_ID to enable
  },
  premium: {
    planId: 'premium',
    tier: 'premium',
    name: 'FAULTLINE Pro',
    amountCents: 5900,
    priceLabel: '$59/mo',
    interval: 'month',
    description: 'Full institutional intelligence — Situation Room, Market Preflight, historical analogs, and all advanced engines.',
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
    description: 'Founding member rate — all Power features locked at $49/mo forever.',
    available: true,
  },
  lifetime: {
    planId: 'lifetime',
    tier: 'founding',
    name: 'FAULTLINE Founding Lifetime',
    amountCents: 29900,
    priceLabel: '$299 one-time',
    interval: 'one_time',
    description: 'One-time payment — full founding access forever. No monthly charges, no renewals.',
    available: true,
  },
};

// ─── Gate Access Requirements ─────────────────────────────────────────────────
// Maps each PremiumGate variant to the minimum required tier.
// Core tier = 'core', Pro tier = 'premium'
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
    planId: 'core', // CTA upgrades to Trader
    marketingName: 'Free',
    price: 'Free',
    tagline: 'No credit card required',
    color: '#6B7280',
    features: [
      'Live FAULTLINE Pressure Index™',
      'Stock & Crypto Market Regimes',
      'Risk-On / Mixed / Risk-Off reading',
      'Daily Intelligence Brief',
      'Bull/Bear probabilities',
      'Top 3 Opportunity Radar',
      'Ask Intelligence (10/day)',
      'Watchlist (3 symbols)',
    ],
    ctaLabel: 'Start Free — No Card Required',
  },
  {
    tier: 'core',
    planId: 'core',
    marketingName: 'Core',
    price: PRICING_PLANS.core.priceLabel,
    tagline: 'Market Intelligence Anywhere — $9.99/month',
    color: '#22D3EE',
    badge: 'MOST POPULAR',
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
    ctaLabel: `Unlock Core — ${PRICING_PLANS.core.priceLabel}`,
  },
  {
    tier: 'premium',
    planId: 'premium',
    marketingName: 'Pro',
    price: PRICING_PLANS.premium.priceLabel,
    tagline: 'Institutional investment committee intelligence',
    color: '#00D4FF',
    badge: 'INSTITUTIONAL',
    features: [
      'Everything in Trader',
      'Situation Room',
      'Market Preflight',
      'Institutional dashboards',
      'Historical analog engine',
      'Deep macro intelligence',
      'Scenario modeling',
      'Advanced probability models',
      'Full Crypto Intelligence suite',
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
      'Founding member badge',
      'Future feature grandfathering',
      'Early beta access',
    ],
    ctaLabel: `Lock In Founding — ${PRICING_PLANS.founding.priceLabel}`,
  },
];
