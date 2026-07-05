import { Lock, Zap, Shield, TrendingUp, Crown, LogIn, BarChart2 } from "lucide-react";
import { getLoginUrl } from "@/const";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { trackUpgradeClick, trackStripeCheckoutStarted } from "@/hooks/useAnalytics";
import {
  tierMeetsRequirement,
  GATE_REQUIRED_TIER,
  PRICING_PLANS,
  type GateVariant,
  type AccessTier,
} from '../../../shared/tiers';


// ─── Types ────────────────────────────────────────────────────────────────────

export type PremiumGateVariant = GateVariant;

/** Which minimum tier is required to pass this gate */
export type GateTier = AccessTier;

interface PremiumGateConfig {
  title: string;
  subtitle: string;
  description: string;
  icon: React.ReactNode;
  accentColor: string;       // Tailwind text color class
  accentHex: string;         // Raw hex for CSS usage
  glowColor: string;         // CSS color for box-shadow glow
  ctaPrimary: string;
  ctaSecondary: string;
  features: string[];
  requiredTier: GateTier;    // minimum tier to unlock
}

const GATE_CONFIGS: Record<PremiumGateVariant, PremiumGateConfig> = {
  founding: {
    title: "Power Intelligence Required",
    subtitle: "INSTITUTIONAL INTELLIGENCE PLATFORM",
    description:
      "This module requires FAULTLINE Power or Founding Access. Unlock the full institutional intelligence suite — macro, signals, crypto, systemic risk, and AI diagnostics.",
    icon: <Shield className="w-8 h-8" />,
    accentColor: "text-cyan-400",
    accentHex: "#00D4FF",
    glowColor: "rgba(0,212,255,0.15)",
    ctaPrimary: `Unlock Power — ${PRICING_PLANS.premium.priceLabel}`,
    ctaSecondary: `Founding Access — ${PRICING_PLANS.founding.priceLabel} · Limited spots`,
    features: [
      "Full macro regime intelligence",
      "Advanced trading signals",
      "Crypto intelligence engine",
      "Systemic risk analytics",
    ],
    requiredTier: 'premium',
  },
  signals: {
    title: "Signals Engine Locked",
    subtitle: "CORE SIGNAL ENGINE",
    description:
      `FAULTLINE's proprietary signal engine — RSI, MACD, SMA crossover, regime-weighted scoring, and AI classification. Unlock with Trader at ${PRICING_PLANS.core.priceLabel}.`,
    icon: <TrendingUp className="w-8 h-8" />,
    accentColor: "text-cyan-400",
    accentHex: "#22D3EE",
    glowColor: "rgba(34,211,238,0.15)",
    ctaPrimary: `Unlock Trader — ${PRICING_PLANS.core.priceLabel}`,
    ctaSecondary: `Power Access — ${PRICING_PLANS.premium.priceLabel}`,
    features: [
      "True RSI / MACD / SMA signals",
      "AI signal classification",
      "Regime-weighted scoring",
      "BUY / SELL / HOLD / WATCH labels",
    ],
    requiredTier: 'core',
  },
  portfolio: {
    title: "Portfolio Monitor Locked",
    subtitle: "LIVE PORTFOLIO INTELLIGENCE",
    description:
      `Track your positions with live P&L and regime-aware risk scoring. Available from Trader at ${PRICING_PLANS.core.priceLabel}. AI guidance requires Power.`,
    icon: <TrendingUp className="w-8 h-8" />,
    accentColor: "text-cyan-400",
    accentHex: "#22D3EE",
    glowColor: "rgba(34,211,238,0.15)",
    ctaPrimary: `Unlock Trader — ${PRICING_PLANS.core.priceLabel}`,
    ctaSecondary: `Power Access — ${PRICING_PLANS.premium.priceLabel}`,
    features: [
      "Live P&L tracking",
      "Real-time price quotes",
      "Regime-aware risk scoring",
      "AI guidance (Power tier)",
    ],
    requiredTier: 'core',
  },
  altRotation: {
    title: "Alt Rotation Engine Locked",
    subtitle: "ALTERNATIVE ASSET ROTATION",
    description:
      `Monitor rotation signals across crypto, commodities, and alternative assets. Available from Trader at ${PRICING_PLANS.core.priceLabel}.`,
    icon: <BarChart2 className="w-8 h-8" />,
    accentColor: "text-cyan-400",
    accentHex: "#22D3EE",
    glowColor: "rgba(34,211,238,0.15)",
    ctaPrimary: `Unlock Trader — ${PRICING_PLANS.core.priceLabel}`,
    ctaSecondary: `Power Access — ${PRICING_PLANS.premium.priceLabel}`,
    features: [
      "Crypto rotation signals",
      "Commodity momentum tracking",
      "Regime-weighted allocation",
      "Cross-asset comparison",
    ],
    requiredTier: 'core',
  },
  risk: {
    title: "Real-Time Risk Engine Locked",
    subtitle: "SYSTEMIC RISK INTELLIGENCE",
    description:
      "The FAULTLINE Pressure Index™ and systemic risk engine analyze macro conditions, liquidity, Treasury stress, and volatility regimes in real time.",
    icon: <Zap className="w-8 h-8" />,
    accentColor: "text-orange-400",
    accentHex: "#FB923C",
    glowColor: "rgba(251,146,60,0.15)",
    ctaPrimary: `Unlock Power — ${PRICING_PLANS.premium.priceLabel}`,
    ctaSecondary: `Founding Access — ${PRICING_PLANS.founding.priceLabel} · Limited spots`,
    features: [
      "FAULTLINE Pressure Index™",
      "Liquidity stress monitoring",
      "Treasury yield shock detection",
      "Volatility regime classification",
    ],
    requiredTier: 'premium',
  },
  intelligence: {
    title: "Power Intelligence Locked",
    subtitle: "INSTITUTIONAL INTELLIGENCE SUITE",
    description:
      "Full access to FAULTLINE's institutional intelligence suite requires Power membership. Preview limited metrics below.",
    icon: <Shield className="w-8 h-8" />,
    accentColor: "text-cyan-400",
    accentHex: "#00D4FF",
    glowColor: "rgba(0,212,255,0.15)",
    ctaPrimary: `Unlock Power — ${PRICING_PLANS.premium.priceLabel}`,
    ctaSecondary: `Founding Access — ${PRICING_PLANS.founding.priceLabel} · Limited spots`,
    features: [
      "Diagnostic AI™ analysis",
      "Position Guidance™",
      "Full macro regime engine",
      "Historical signal analytics",
    ],
    requiredTier: 'premium',
  },
  crypto: {
    title: "Crypto Intelligence Locked",
    subtitle: "DIGITAL ASSET INTELLIGENCE",
    description:
      "FAULTLINE's crypto intelligence engine tracks digital asset risk, liquidity, momentum, and macro correlation across BTC, ETH, SOL, and hundreds of tokens.",
    icon: <Zap className="w-8 h-8" />,
    accentColor: "text-blue-400",
    accentHex: "#60A5FA",
    glowColor: "rgba(96,165,250,0.15)",
    ctaPrimary: `Unlock Power — ${PRICING_PLANS.premium.priceLabel}`,
    ctaSecondary: `Founding Access — ${PRICING_PLANS.founding.priceLabel} · Limited spots`,
    features: [
      "Crypto systemic risk score",
      "BTC macro correlation tracking",
      "AI narrative exposure signals",
      "Stablecoin liquidity monitoring",
    ],
    requiredTier: 'premium',
  },
  aftershock: {
    title: "Aftershock Engine™ Locked",
    subtitle: "MARKET CONTAGION INTELLIGENCE",
    description:
      "The Aftershock Engine™ detects primary market ruptures and identifies assets likely to experience delayed secondary reactions — sympathy momentum, sector echoes, and macro shockwaves.",
    icon: <Zap className="w-8 h-8" />,
    accentColor: "text-orange-400",
    accentHex: "#FB923C",
    glowColor: "rgba(251,146,60,0.15)",
    ctaPrimary: `Unlock Power — ${PRICING_PLANS.premium.priceLabel}`,
    ctaSecondary: `Founding Access — ${PRICING_PLANS.founding.priceLabel} · Limited spots`,
    features: [
      "Primary rupture detection",
      "Contagion chain mapping",
      "Delayed reaction signals",
      "Macro shockwave analysis",
    ],
    requiredTier: 'premium',
  },
  watchlist: {
    title: "Unlimited Watchlist Locked",
    subtitle: "PROFESSIONAL WATCHLIST",
    description:
      `Unlimited symbol watchlists with live signal labels, breach alerts, and side-by-side comparison. Upgrade to Trader at ${PRICING_PLANS.core.priceLabel} to unlock.`,
    icon: <Shield className="w-8 h-8" />,
    accentColor: "text-cyan-400",
    accentHex: "#22D3EE",
    glowColor: "rgba(34,211,238,0.15)",
    ctaPrimary: `Unlock Trader — ${PRICING_PLANS.core.priceLabel}`,
    ctaSecondary: `Power Access — ${PRICING_PLANS.premium.priceLabel}`,
    features: [
      "Unlimited symbol tracking",
      "Live signal label monitoring",
      "Breach alerts & notifications",
      "Side-by-side comparison",
    ],
    requiredTier: 'core',
  },
  // ── Trader-tier gates ──────────────────────────────────────────────────────
  symbolIntel: {
    title: "Symbol Intelligence Locked",
    subtitle: "DEEP SYMBOL ANALYSIS",
    description:
      `Full AI-powered symbol intelligence — regime fit, momentum score, signal classification, and factor breakdown. Unlock with Trader at ${PRICING_PLANS.core.priceLabel}.`,
    icon: <TrendingUp className="w-8 h-8" />,
    accentColor: "text-cyan-400",
    accentHex: "#22D3EE",
    glowColor: "rgba(34,211,238,0.15)",
    ctaPrimary: `Unlock Trader — ${PRICING_PLANS.core.priceLabel}`,
    ctaSecondary: `Power Access — ${PRICING_PLANS.premium.priceLabel}`,
    features: [
      "AI signal classification",
      "Regime fit scoring",
      "Momentum & factor breakdown",
      "Bullish/Bearish factor analysis",
    ],
    requiredTier: 'core',
  },
  opportunities: {
    title: "Opportunity Radar Locked",
    subtitle: "COMPLETE OPPORTUNITY RADAR",
    description:
      `Full access to FAULTLINE's Opportunity Radar — ranked opportunities, entry zones, and regime-weighted conviction scores. Unlock with Trader at ${PRICING_PLANS.core.priceLabel}.`,
    icon: <TrendingUp className="w-8 h-8" />,
    accentColor: "text-cyan-400",
    accentHex: "#22D3EE",
    glowColor: "rgba(34,211,238,0.15)",
    ctaPrimary: `Unlock Trader — ${PRICING_PLANS.core.priceLabel}`,
    ctaSecondary: `Power Access — ${PRICING_PLANS.premium.priceLabel}`,
    features: [
      "Ranked opportunity list",
      "Entry zone identification",
      "Regime-weighted conviction",
      "Risk/reward scoring",
    ],
    requiredTier: 'core',
  },
  tradeJournal: {
    title: "Trade Journal Locked",
    subtitle: "PROFESSIONAL TRADE JOURNAL",
    description:
      `Log trades, track performance, and identify patterns in your decision-making. Available with Trader at ${PRICING_PLANS.core.priceLabel}.`,
    icon: <BarChart2 className="w-8 h-8" />,
    accentColor: "text-cyan-400",
    accentHex: "#22D3EE",
    glowColor: "rgba(34,211,238,0.15)",
    ctaPrimary: `Unlock Trader — ${PRICING_PLANS.core.priceLabel}`,
    ctaSecondary: `Power Access — ${PRICING_PLANS.premium.priceLabel}`,
    features: [
      "Trade logging with context",
      "Win rate & P&L tracking",
      "Pattern analysis",
      "Regime-tagged entries",
    ],
    requiredTier: 'core',
  },
  socialIntel: {
    title: "Social Intelligence Locked",
    subtitle: "SOCIAL SIGNAL INTELLIGENCE",
    description:
      `Monitor social sentiment, narrative shifts, and crowd positioning across markets. Available with Trader at ${PRICING_PLANS.core.priceLabel}.`,
    icon: <Shield className="w-8 h-8" />,
    accentColor: "text-cyan-400",
    accentHex: "#22D3EE",
    glowColor: "rgba(34,211,238,0.15)",
    ctaPrimary: `Unlock Trader — ${PRICING_PLANS.core.priceLabel}`,
    ctaSecondary: `Power Access — ${PRICING_PLANS.premium.priceLabel}`,
    features: [
      "Social sentiment tracking",
      "Narrative shift detection",
      "Crowd positioning signals",
      "Viral momentum indicators",
    ],
    requiredTier: 'core',
  },
  insiderIntel: {
    title: "Insider Intelligence Locked",
    subtitle: "INSTITUTIONAL FLOW INTELLIGENCE",
    description:
      `Track institutional positioning, options flow, and insider activity signals. Available with Trader at ${PRICING_PLANS.core.priceLabel}.`,
    icon: <Shield className="w-8 h-8" />,
    accentColor: "text-cyan-400",
    accentHex: "#22D3EE",
    glowColor: "rgba(34,211,238,0.15)",
    ctaPrimary: `Unlock Trader — ${PRICING_PLANS.core.priceLabel}`,
    ctaSecondary: `Power Access — ${PRICING_PLANS.premium.priceLabel}`,
    features: [
      "Institutional flow tracking",
      "Options activity signals",
      "Dark pool indicators",
      "Insider transaction monitoring",
    ],
    requiredTier: 'core',
  },
  alerts: {
    title: "Advanced Alerts Locked",
    subtitle: "PROFESSIONAL ALERT SYSTEM",
    description:
      `Set unlimited price, signal, and regime-change alerts. Get notified the moment market conditions shift. Available with Trader at ${PRICING_PLANS.core.priceLabel}.`,
    icon: <Zap className="w-8 h-8" />,
    accentColor: "text-cyan-400",
    accentHex: "#22D3EE",
    glowColor: "rgba(34,211,238,0.15)",
    ctaPrimary: `Unlock Trader — ${PRICING_PLANS.core.priceLabel}`,
    ctaSecondary: `Power Access — ${PRICING_PLANS.premium.priceLabel}`,
    features: [
      "Unlimited price alerts",
      "Signal change notifications",
      "Regime-change alerts",
      "Push & email delivery",
    ],
    requiredTier: 'core',
  },
  // ── Power-tier gates ───────────────────────────────────────────────────────
  decisionEngine: {
    title: "Decision Engine Locked",
    subtitle: "INSTITUTIONAL DECISION INTELLIGENCE",
    description:
      "The FAULTLINE Decision Engine synthesizes regime, signals, risk, and macro context into a single actionable recommendation with conviction scoring.",
    icon: <Shield className="w-8 h-8" />,
    accentColor: "text-cyan-400",
    accentHex: "#00D4FF",
    glowColor: "rgba(0,212,255,0.15)",
    ctaPrimary: `Unlock Power — ${PRICING_PLANS.premium.priceLabel}`,
    ctaSecondary: `Founding Access — ${PRICING_PLANS.founding.priceLabel} · Limited spots`,
    features: [
      "Regime-aware recommendations",
      "Conviction scoring",
      "Multi-factor synthesis",
      "Actionable entry/exit guidance",
    ],
    requiredTier: 'premium',
  },
  signalOutlook: {
    title: "Signal Outlook Locked",
    subtitle: "FORWARD-LOOKING SIGNAL INTELLIGENCE",
    description:
      "Full access to FAULTLINE's Signal Outlook engine — forward-looking probability models, scenario analysis, and regime-weighted signal projections.",
    icon: <TrendingUp className="w-8 h-8" />,
    accentColor: "text-cyan-400",
    accentHex: "#00D4FF",
    glowColor: "rgba(0,212,255,0.15)",
    ctaPrimary: `Unlock Power — ${PRICING_PLANS.premium.priceLabel}`,
    ctaSecondary: `Founding Access — ${PRICING_PLANS.founding.priceLabel} · Limited spots`,
    features: [
      "Forward probability models",
      "Scenario analysis",
      "Regime-weighted projections",
      "Signal confidence intervals",
    ],
    requiredTier: 'premium',
  },
  preFlight: {
    title: "Market Preflight Locked",
    subtitle: "INSTITUTIONAL MARKET PREFLIGHT",
    description:
      "Run a full institutional-grade market preflight check before every trading session. Regime, liquidity, volatility, and risk conditions in one view.",
    icon: <Shield className="w-8 h-8" />,
    accentColor: "text-cyan-400",
    accentHex: "#00D4FF",
    glowColor: "rgba(0,212,255,0.15)",
    ctaPrimary: `Unlock Power — ${PRICING_PLANS.premium.priceLabel}`,
    ctaSecondary: `Founding Access — ${PRICING_PLANS.founding.priceLabel} · Limited spots`,
    features: [
      "Pre-session risk assessment",
      "Regime & liquidity check",
      "Volatility condition scan",
      "Go/No-go trading decision",
    ],
    requiredTier: 'premium',
  },
  dayTrade: {
    title: "Day Trade Intelligence Locked",
    subtitle: "INTRADAY INTELLIGENCE",
    description:
      "Institutional intraday intelligence — session bias, opening range analysis, key levels, and real-time regime shifts for active traders.",
    icon: <BarChart2 className="w-8 h-8" />,
    accentColor: "text-cyan-400",
    accentHex: "#00D4FF",
    glowColor: "rgba(0,212,255,0.15)",
    ctaPrimary: `Unlock Power — ${PRICING_PLANS.premium.priceLabel}`,
    ctaSecondary: `Founding Access — ${PRICING_PLANS.founding.priceLabel} · Limited spots`,
    features: [
      "Session bias analysis",
      "Opening range intelligence",
      "Key intraday levels",
      "Real-time regime shifts",
    ],
    requiredTier: 'premium',
  },
  marketCommandCenter: {
    title: "Market Command Center Locked",
    subtitle: "INSTITUTIONAL COMMAND CENTER",
    description:
      "The FAULTLINE Market Command Center — a unified institutional dashboard combining regime status, risk metrics, signal flow, and cross-market intelligence.",
    icon: <Shield className="w-8 h-8" />,
    accentColor: "text-cyan-400",
    accentHex: "#00D4FF",
    glowColor: "rgba(0,212,255,0.15)",
    ctaPrimary: `Unlock Power — ${PRICING_PLANS.premium.priceLabel}`,
    ctaSecondary: `Founding Access — ${PRICING_PLANS.founding.priceLabel} · Limited spots`,
    features: [
      "Unified regime dashboard",
      "Cross-market intelligence",
      "Live risk metrics",
      "Signal flow monitoring",
    ],
    requiredTier: 'premium',
  },
};

// hasRequiredAccess is now provided by shared/tiers.ts tierMeetsRequirement

// ─── Full-Page Gate ────────────────────────────────────────────────────────────

interface PremiumGateFullProps {
  variant?: PremiumGateVariant;
  /** Optional children rendered behind the gate as a blurred teaser */
  children?: React.ReactNode;
}

export function PremiumGateFull({
  variant = "founding",
  children,
}: PremiumGateFullProps) {
  const { isAuthenticated, loading } = useAuth();
  const checkoutMutation = trpc.billing.createCheckout.useMutation({
    onSuccess: (data) => {
      if (data.url) {
        toast.info('Redirecting to checkout...', { description: 'Opening Stripe secure payment page.' });
        window.open(data.url, '_blank');
      }
    },
    onMutate: (vars) => {
      trackUpgradeClick(vars.planId, 'premium_gate');
      const planPrices: Record<string, number> = {
        core: PRICING_PLANS.core.amountCents / 100,
        core_annual: (PRICING_PLANS.core_annual?.amountCents ?? 0) / 100,
        premium: PRICING_PLANS.premium.amountCents / 100,
        premium_annual: (PRICING_PLANS.premium_annual?.amountCents ?? 0) / 100,
        founding: PRICING_PLANS.founding.amountCents / 100,
        lifetime: (PRICING_PLANS.lifetime?.amountCents ?? 0) / 100,
      };
      trackStripeCheckoutStarted({
        plan: vars.planId,
        price: planPrices[vars.planId] ?? 0,
        currency: 'USD',
      });
    },
    onError: (err) => {
      toast.error('Checkout unavailable', { description: err.message });
    },
  });
  const tierQuery = trpc.user.getAccessTier.useQuery(undefined, {
    enabled: isAuthenticated,
    retry: false,
    staleTime: 60_000,
  });

  // While auth or tier is loading, show spinner
  if (loading || (isAuthenticated && tierQuery.isLoading)) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 border-2 border-cyan-500/30 border-t-cyan-400 rounded-full animate-spin" />
      </div>
    );
  }

  const tier = tierQuery.data?.tier ?? 'free';
  const cfg = GATE_CONFIGS[variant];
  const hasAccess = isAuthenticated && tierMeetsRequirement(tier as AccessTier, GATE_REQUIRED_TIER[variant]);

  // User has sufficient access — show full content
  if (hasAccess) {
    return <>{children}</>;
  }

  // Determine upgrade context
  const isLoggedIn = isAuthenticated;
  const isCoreTier = isLoggedIn && tier === 'core';
  const loginUrl = getLoginUrl();

  return (
    <div className="relative min-h-screen">
      {/* Blurred teaser behind the gate */}
      {children && (
        <div
          className="absolute inset-0 overflow-hidden pointer-events-none select-none"
          aria-hidden="true"
          style={{ filter: "blur(6px)", opacity: 0.25 }}
        >
          {children}
        </div>
      )}
      {/* Gradient overlay to fade the blurred content into the gate card */}
      {children && (
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: "radial-gradient(ellipse 60% 50% at 50% 50%, transparent 0%, rgba(5,6,8,0.7) 60%, rgba(5,6,8,0.95) 100%)",
          }}
        />
      )}

      {/* Ambient glow behind gate card */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: `radial-gradient(ellipse 50% 40% at 50% 50%, ${cfg.accentHex}08 0%, transparent 70%)`,
        }}
      />

      {/* Gate overlay */}
      <div className="relative z-10 flex items-center justify-center min-h-screen px-4 py-16">
        <div
          className="w-full max-w-2xl rounded-2xl p-10 text-center relative overflow-hidden"
          style={{
            background: "linear-gradient(135deg, rgba(10,14,26,0.97) 0%, rgba(15,20,35,0.97) 100%)",
            border: `1px solid ${cfg.accentHex}25`,
            boxShadow: `0 0 80px ${cfg.glowColor}, 0 0 160px ${cfg.glowColor.replace('0.15', '0.06')}, inset 0 1px 0 rgba(255,255,255,0.05)`,
          }}
        >
          {/* Top shimmer line */}
          <div
            className="absolute top-0 left-0 right-0 h-px"
            style={{ background: `linear-gradient(90deg, transparent, ${cfg.accentHex}50, transparent)` }}
          />

          {/* Icon */}
          <div
            className={`inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-6 ${cfg.accentColor}`}
            style={{
              background: `${cfg.accentHex}12`,
              border: `1px solid ${cfg.accentHex}35`,
              boxShadow: `0 0 24px ${cfg.accentHex}20`,
            }}
          >
            {cfg.icon}
          </div>

          {/* Subtitle */}
          <p className={`text-[10px] font-mono tracking-[0.3em] uppercase mb-3 ${cfg.accentColor}`}>
            {cfg.subtitle}
          </p>

          {/* Title */}
          <h1 className="text-3xl font-bold text-white mb-4 tracking-tight">
            {cfg.title}
          </h1>

          {/* Lock icon row */}
          <div className="flex items-center justify-center gap-2 mb-6">
            <Lock className="w-3.5 h-3.5 text-white/20" />
            <span className="text-white/30 text-xs font-mono tracking-[0.25em] uppercase">
              Intelligence Locked
            </span>
            <Lock className="w-3.5 h-3.5 text-white/20" />
          </div>

          {/* Description */}
          <p className="text-white/50 text-sm leading-relaxed mb-8 max-w-md mx-auto">
            {cfg.description}
          </p>

          {/* Feature list — glass cards */}
          <div className="grid grid-cols-2 gap-2.5 mb-10 text-left">
            {cfg.features.map((f) => (
              <div
                key={f}
                className="flex items-center gap-2.5 rounded-xl px-3.5 py-2.5"
                style={{
                  background: `${cfg.accentHex}06`,
                  border: `1px solid ${cfg.accentHex}18`,
                  backdropFilter: "blur(8px)",
                }}
              >
                <div
                  className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                  style={{ background: cfg.accentHex, boxShadow: `0 0 6px ${cfg.accentHex}` }}
                />
                <span className="text-white/50 text-xs font-mono">{f}</span>
              </div>
            ))}
          </div>

          {/* Founding urgency banner (only for premium/founding gates) */}
          {(GATE_REQUIRED_TIER[variant] === 'premium') && (
            <>
              <div
                className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg mb-2 text-center"
                style={{ background: 'rgba(255,215,0,0.06)', border: '1px solid rgba(255,215,0,0.2)' }}
              >
                <div className="relative flex items-center justify-center">
                  <div className="w-1.5 h-1.5 rounded-full bg-[#FFD700]" />
                  <div className="absolute w-3 h-3 rounded-full bg-[#FFD700]/20 animate-ping" />
                </div>
                <span className="text-[10px] font-mono tracking-[0.25em] text-[#FFD700]/80">
                  FOUNDING ACCESS OPEN — LIMITED AVAILABILITY
                </span>
              </div>
              <p className="text-[9px] font-mono text-[#FFD700]/50 text-center mb-6 tracking-widest">
                FOUNDING COHORT IS LIMITED. SPOTS CLOSE WITHOUT NOTICE.
              </p>
            </>
          )}

          {/* Tier separator */}
          <div className="flex items-center gap-3 mb-6">
            <div className="flex-1 h-px" style={{ background: `linear-gradient(90deg, transparent, ${cfg.accentHex}20)` }} />
            <span className="text-[9px] font-mono tracking-[0.3em] text-white/20">UPGRADE TO UNLOCK</span>
            <div className="flex-1 h-px" style={{ background: `linear-gradient(90deg, ${cfg.accentHex}20, transparent)` }} />
          </div>

          {/* CTA buttons */}
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            {isLoggedIn ? (
              // Logged-in users: show Stripe upgrade buttons based on context
              <>
                {GATE_REQUIRED_TIER[variant] === 'core' && !isCoreTier && (
                  <button
                    onClick={() => checkoutMutation.mutate({ planId: 'core', origin: window.location.origin })}
                    disabled={checkoutMutation.isPending}
                    className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-bold text-sm tracking-widest transition-all duration-200 hover:scale-[1.02] active:scale-[0.97] disabled:opacity-60 disabled:cursor-not-allowed"
                    style={{
                      background: "#22D3EE",
                      color: "#050608",
                      boxShadow: "0 0 24px rgba(34,211,238,0.45)",
                    }}
                  >
                    <Zap className="w-4 h-4" />
                    {checkoutMutation.isPending ? 'Loading...' : `Unlock Trader — ${PRICING_PLANS.core.priceLabel}`}
                  </button>
                )}
                <button
                  onClick={() => checkoutMutation.mutate({ planId: 'premium', origin: window.location.origin })}
                  disabled={checkoutMutation.isPending}
                  className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-bold text-sm tracking-widest transition-all duration-200 hover:scale-[1.02] active:scale-[0.97] disabled:opacity-60 disabled:cursor-not-allowed"
                  style={GATE_REQUIRED_TIER[variant] === 'premium'
                    ? { background: "#00D4FF", color: "#050608", boxShadow: "0 0 24px rgba(0,212,255,0.45)" }
                    : { background: "rgba(0,212,255,0.08)", border: "1px solid rgba(0,212,255,0.25)", color: "#00D4FF" }}
                >
                  <Crown className="w-4 h-4" />
                  {checkoutMutation.isPending ? 'Loading...' : `Unlock Power — ${PRICING_PLANS.premium.priceLabel}`}
                </button>
                <button
                  onClick={() => checkoutMutation.mutate({ planId: 'founding', origin: window.location.origin })}
                  disabled={checkoutMutation.isPending}
                  className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-bold text-sm tracking-widest transition-all duration-200 hover:scale-[1.02] active:scale-[0.97] disabled:opacity-60 disabled:cursor-not-allowed"
                  style={{
                    background: "rgba(255,215,0,0.08)",
                    border: "1px solid rgba(255,215,0,0.25)",
                    color: "#FFD700",
                  }}
                >
                  <Shield className="w-4 h-4" />
                  {checkoutMutation.isPending ? 'Loading...' : `Founding Access — ${PRICING_PLANS.founding.priceLabel}`}
                </button>
              </>
            ) : (
              // Unauthenticated: show login / sign up
              <>
                <a
                  href={loginUrl}
                  className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-bold text-sm tracking-widest transition-all duration-200 hover:scale-[1.02] active:scale-[0.97]"
                  style={{
                    background: cfg.accentHex,
                    color: "#050608",
                    boxShadow: `0 0 24px ${cfg.accentHex}45`,
                  }}
                >
                  <LogIn className="w-4 h-4" />
                  {cfg.ctaPrimary}
                </a>
                <a
                  href={loginUrl}
                  className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-bold text-sm tracking-widest text-white/50 hover:text-white transition-all duration-200 hover:scale-[1.02] active:scale-[0.97]"
                  style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}
                >
                  {cfg.ctaSecondary}
                </a>
              </>
            )}
          </div>

          {/* Footer note */}
          <p className="text-white/20 text-[10px] mt-6 font-mono tracking-widest">
            FAULTLINE — INSTITUTIONAL MARKET INTELLIGENCE PLATFORM
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── Inline Card Gate (for partial section locking) ───────────────────────────

interface PremiumGateCardProps {
  variant?: PremiumGateVariant;
  label?: string;
  compact?: boolean;
}

export function PremiumGateCard({
  variant = "founding",
  label,
  compact = false,
}: PremiumGateCardProps) {
  const cfg = GATE_CONFIGS[variant];
  const loginUrl = getLoginUrl();

  if (compact) {
    return (
      <div
        className="flex items-center justify-between rounded-xl px-4 py-3 gap-4"
        style={{
          background: `${cfg.accentHex}06`,
          border: `1px solid ${cfg.accentHex}20`,
          backdropFilter: "blur(8px)",
        }}
      >
        <div className="flex items-center gap-3">
          <Lock className={`w-4 h-4 flex-shrink-0 ${cfg.accentColor}`} />
          <span className="text-white/50 text-sm font-mono">
            {label ?? cfg.title}
          </span>
        </div>
        <a
          href={loginUrl}
          className="text-xs font-bold px-3 py-1.5 rounded-lg transition-all hover:scale-[1.02] whitespace-nowrap"
          style={{
            background: `${cfg.accentHex}15`,
            border: `1px solid ${cfg.accentHex}35`,
            color: cfg.accentHex,
          }}
        >
          {cfg.ctaPrimary}
        </a>
      </div>
    );
  }

  return (
    <div
      className="relative rounded-2xl overflow-hidden"
      style={{
        background: "linear-gradient(135deg, rgba(10,14,26,0.95) 0%, rgba(15,20,35,0.95) 100%)",
        border: `1px solid ${cfg.accentHex}20`,
        backdropFilter: "blur(12px)",
        boxShadow: `0 0 40px ${cfg.glowColor}, inset 0 1px 0 rgba(255,255,255,0.04)`,
      }}
    >
      {/* Top shimmer */}
      <div
        className="absolute top-0 left-0 right-0 h-px"
        style={{ background: `linear-gradient(90deg, transparent, ${cfg.accentHex}40, transparent)` }}
      />

      <div className="flex flex-col items-center text-center px-8 py-10">
        <div
          className={`inline-flex items-center justify-center w-12 h-12 rounded-xl mb-4 ${cfg.accentColor}`}
          style={{
            background: `${cfg.accentHex}10`,
            border: `1px solid ${cfg.accentHex}30`,
            boxShadow: `0 0 20px ${cfg.accentHex}15`,
          }}
        >
          <Lock className="w-5 h-5" />
        </div>

        <p className={`text-[10px] font-mono tracking-[0.25em] uppercase mb-2 ${cfg.accentColor}`}>
          {cfg.subtitle}
        </p>
        <h3 className="text-lg font-bold text-white mb-2">
          {label ?? cfg.title}
        </h3>
        <p className="text-white/40 text-sm leading-relaxed mb-6 max-w-xs">
          {cfg.description}
        </p>

        <a
          href={loginUrl}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm tracking-widest transition-all hover:scale-[1.02] active:scale-[0.97]"
          style={{
            background: cfg.accentHex,
            color: "#050608",
            boxShadow: `0 0 20px ${cfg.accentHex}40`,
          }}
        >
          <Zap className="w-4 h-4" />
          {cfg.ctaPrimary}
        </a>
      </div>
    </div>
  );
}

// ─── Blur Overlay (wraps any content with a glass gate) ───────────────────────

interface PremiumBlurOverlayProps {
  variant?: PremiumGateVariant;
  label?: string;
  /** When true, also gates on tier (not just auth). Default: false. */
  tierAware?: boolean;
  children: React.ReactNode;
}

export function PremiumBlurOverlay({
  variant = "founding",
  label,
  tierAware = false,
  children,
}: PremiumBlurOverlayProps) {
  const { isAuthenticated, loading } = useAuth();
  const tierQuery = trpc.user.getAccessTier.useQuery(undefined, {
    enabled: tierAware && isAuthenticated,
    staleTime: 60_000,
  });

  const cfg = GATE_CONFIGS[variant];
  const loginUrl = getLoginUrl();
  const tier = (tierQuery.data?.tier ?? 'free') as AccessTier;

  // Still loading — show content unblurred to avoid flash
  if (loading || (tierAware && isAuthenticated && tierQuery.isLoading)) return <>{children}</>;

  // Auth-only mode: pass if logged in
  if (!tierAware && isAuthenticated) return <>{children}</>;
  // Tier-aware mode: pass if tier meets requirement
  if (tierAware && isAuthenticated && tierMeetsRequirement(tier, GATE_REQUIRED_TIER[variant])) return <>{children}</>;

  const isLoggedIn = isAuthenticated;

  return (
    <div className="relative rounded-xl overflow-hidden">
      {/* Blurred content */}
      <div
        className="pointer-events-none select-none"
        style={{ filter: "blur(6px)", opacity: 0.2 }}
        aria-hidden="true"
      >
        {children}
      </div>

      {/* Glass overlay */}
      <div
        className="absolute inset-0 flex flex-col items-center justify-center gap-3 rounded-xl px-4"
        style={{
          background: `linear-gradient(135deg, rgba(8,12,22,0.88) 0%, rgba(12,16,28,0.92) 100%)`,
          backdropFilter: "blur(4px)",
          border: `1px solid ${cfg.accentHex}15`,
        }}
      >
        <div
          className="w-10 h-10 rounded-full flex items-center justify-center"
          style={{
            background: `${cfg.accentHex}12`,
            border: `1px solid ${cfg.accentHex}30`,
          }}
        >
          <Lock className={`w-5 h-5 ${cfg.accentColor}`} />
        </div>
        <p className="text-white/60 text-sm font-semibold text-center">
          {label ?? cfg.title}
        </p>
        {isLoggedIn ? (
          // Logged in but wrong tier — show upgrade CTA
          <BlurUpgradeCTA variant={variant} cfg={cfg} />
        ) : (
          // Not logged in — show login CTA
          <a
            href={loginUrl}
            className="text-xs font-bold px-4 py-2 rounded-lg transition-all hover:scale-[1.02]"
            style={{
              background: cfg.accentHex,
              color: "#050608",
              boxShadow: `0 0 16px ${cfg.accentHex}35`,
            }}
          >
            Sign In to Unlock
          </a>
        )}
      </div>
    </div>
  );
}

function BlurUpgradeCTA({ variant, cfg }: { variant: PremiumGateVariant; cfg: PremiumGateConfig }) {
  const checkoutMutation = trpc.billing.createCheckout.useMutation({
    onSuccess: (data) => {
      if (data.url) {
        toast.info('Redirecting to checkout...', { description: 'Opening Stripe secure payment page.' });
        window.open(data.url, '_blank');
      }
    },
    onError: (err) => toast.error('Checkout unavailable', { description: err.message }),
  });
  const planId = GATE_REQUIRED_TIER[variant] === 'core' ? 'core' : 'premium';
  return (
    <button
      onClick={() => {
        trackUpgradeClick(variant, 'blur_overlay');
        checkoutMutation.mutate({ planId, origin: window.location.origin });
      }}
      disabled={checkoutMutation.isPending}
      className="text-xs font-bold px-4 py-2 rounded-lg transition-all hover:scale-[1.02] disabled:opacity-60"
      style={{
        background: cfg.accentHex,
        color: "#050608",
        boxShadow: `0 0 16px ${cfg.accentHex}35`,
        cursor: checkoutMutation.isPending ? 'not-allowed' : 'pointer',
      }}
    >
      {checkoutMutation.isPending ? 'Loading...' : cfg.ctaPrimary}
    </button>
  );
}
