import { Lock, Zap, Shield, TrendingUp, Crown, LogIn, BarChart2 } from "lucide-react";
import { getLoginUrl } from "@/const";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";


// ─── Types ────────────────────────────────────────────────────────────────────

export type PremiumGateVariant =
  | "founding"       // "Founding Access Required"
  | "signals"        // "Advanced Signals Restricted" — Core tier
  | "portfolio"      // "Portfolio Monitor" — Core tier
  | "altRotation"    // "Alt Rotation" — Core tier
  | "risk"           // "Real-Time Risk Engine Locked" — Premium tier
  | "intelligence"   // "Premium Intelligence Locked" — Premium tier
  | "crypto"         // "Crypto Intelligence Locked" — Premium tier
  | "aftershock"     // "Aftershock Engine™ Locked" — Premium tier
  | "watchlist";     // "Watchlist Locked" — Premium tier

/** Which minimum tier is required to pass this gate */
export type GateTier = 'core' | 'premium';

interface PremiumGateConfig {
  title: string;
  subtitle: string;
  description: string;
  icon: React.ReactNode;
  accentColor: string;       // Tailwind text color class
  glowColor: string;         // CSS color for box-shadow glow
  ctaPrimary: string;
  ctaSecondary: string;
  features: string[];
  requiredTier: GateTier;    // minimum tier to unlock
}

const GATE_CONFIGS: Record<PremiumGateVariant, PremiumGateConfig> = {
  founding: {
    title: "Founding Access Required",
    subtitle: "EXCLUSIVE INTELLIGENCE PLATFORM",
    description:
      "This module is reserved for FAULTLINE founding members. Gain access to the full institutional intelligence suite — macro, signals, crypto, and systemic risk.",
    icon: <Shield className="w-8 h-8" />,
    accentColor: "text-cyan-400",
    glowColor: "rgba(34,211,238,0.15)",
    ctaPrimary: "Request Founding Access",
    ctaSecondary: "Join Early Access",
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
      "FAULTLINE's proprietary signal engine — RSI, MACD, SMA crossover, regime-weighted scoring, and AI classification. Unlock with Core at $9.99/mo.",
    icon: <TrendingUp className="w-8 h-8" />,
    accentColor: "text-cyan-400",
    glowColor: "rgba(34,211,238,0.15)",
    ctaPrimary: "Unlock Core — $9.99/mo",
    ctaSecondary: "Upgrade to Pro",
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
      "Track your positions with live P&L and regime-aware risk scoring. Available from Core at $9.99/mo. AI guidance requires Pro.",
    icon: <TrendingUp className="w-8 h-8" />,
    accentColor: "text-cyan-400",
    glowColor: "rgba(34,211,238,0.15)",
    ctaPrimary: "Unlock Core — $9.99/mo",
    ctaSecondary: "Upgrade to Pro",
    features: [
      "Live P&L tracking",
      "Real-time price quotes",
      "Regime-aware risk scoring",
      "AI guidance (Pro tier)",
    ],
    requiredTier: 'core',
  },
  altRotation: {
    title: "Alt Rotation Engine Locked",
    subtitle: "ALTERNATIVE ASSET ROTATION",
    description:
      "Monitor rotation signals across crypto, commodities, and alternative assets. Available from Core at $9.99/mo.",
    icon: <BarChart2 className="w-8 h-8" />,
    accentColor: "text-cyan-400",
    glowColor: "rgba(34,211,238,0.15)",
    ctaPrimary: "Unlock Core — $9.99/mo",
    ctaSecondary: "Upgrade to Pro",
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
    glowColor: "rgba(251,146,60,0.15)",
    ctaPrimary: "Unlock Pro — $59/mo",
    ctaSecondary: "Request Founding Access",
    features: [
      "FAULTLINE Pressure Index™",
      "Liquidity stress monitoring",
      "Treasury yield shock detection",
      "Volatility regime classification",
    ],
    requiredTier: 'premium',
  },
  intelligence: {
    title: "Premium Intelligence Locked",
    subtitle: "INSTITUTIONAL INTELLIGENCE SUITE",
    description:
      "Full access to FAULTLINE's institutional intelligence suite requires Pro membership. Preview limited metrics below.",
    icon: <Shield className="w-8 h-8" />,
    accentColor: "text-cyan-400",
    glowColor: "rgba(34,211,238,0.15)",
    ctaPrimary: "Unlock Pro — $59/mo",
    ctaSecondary: "Request Founding Access",
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
    glowColor: "rgba(96,165,250,0.15)",
    ctaPrimary: "Unlock Pro — $59/mo",
    ctaSecondary: "Request Founding Access",
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
    glowColor: "rgba(251,146,60,0.15)",
    ctaPrimary: "Unlock Pro — $59/mo",
    ctaSecondary: "Request Founding Access",
    features: [
      "Primary rupture detection",
      "Contagion chain mapping",
      "Delayed reaction signals",
      "Macro shockwave analysis",
    ],
    requiredTier: 'premium',
  },
  watchlist: {
    title: "Watchlist Locked",
    subtitle: "CRYPTO WATCHLIST & COMPARISON",
    description:
      "Save tokens, monitor live signal labels, and compare assets side-by-side. Available to Pro and Founding members.",
    icon: <Shield className="w-8 h-8" />,
    accentColor: "text-blue-400",
    glowColor: "rgba(96,165,250,0.15)",
    ctaPrimary: "Unlock Pro — $59/mo",
    ctaSecondary: "Request Founding Access",
    features: [
      "Save any crypto token",
      "Live signal label monitoring",
      "Side-by-side comparison (4 tokens)",
      "Signal score tracking",
    ],
    requiredTier: 'premium',
  },
};

/** Returns true if the user's tier meets or exceeds the required tier */
function hasRequiredAccess(userTier: string, requiredTier: GateTier): boolean {
  if (userTier === 'founding' || userTier === 'premium') return true;
  if (requiredTier === 'core' && userTier === 'core') return true;
  return false;
}

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
  const hasAccess = isAuthenticated && hasRequiredAccess(tier, cfg.requiredTier);

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

      {/* Gate overlay */}
      <div className="relative z-10 flex items-center justify-center min-h-screen px-4 py-16">
        <div
          className="w-full max-w-2xl rounded-2xl border border-white/10 p-10 text-center"
          style={{
            background:
              "linear-gradient(135deg, rgba(10,14,26,0.97) 0%, rgba(15,20,35,0.97) 100%)",
            boxShadow: `0 0 80px ${cfg.glowColor}, 0 0 0 1px rgba(255,255,255,0.05)`,
          }}
        >
          {/* Icon */}
          <div
            className={`inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-6 ${cfg.accentColor}`}
            style={{
              background: cfg.glowColor,
              border: `1px solid ${cfg.glowColor.replace("0.15", "0.4")}`,
            }}
          >
            {cfg.icon}
          </div>

          {/* Subtitle */}
          <p
            className={`text-xs font-mono tracking-[0.2em] uppercase mb-3 ${cfg.accentColor}`}
          >
            {cfg.subtitle}
          </p>

          {/* Title */}
          <h1 className="text-3xl font-bold text-white mb-4 tracking-tight">
            {cfg.title}
          </h1>

          {/* Lock icon row */}
          <div className="flex items-center justify-center gap-2 mb-6">
            <Lock className="w-4 h-4 text-white/30" />
            <span className="text-white/40 text-sm font-mono tracking-widest uppercase">
              Restricted Access
            </span>
            <Lock className="w-4 h-4 text-white/30" />
          </div>

          {/* Description */}
          <p className="text-white/60 text-sm leading-relaxed mb-8 max-w-md mx-auto">
            {cfg.description}
          </p>

          {/* Feature list */}
          <div className="grid grid-cols-2 gap-3 mb-10 text-left">
            {cfg.features.map((f) => (
              <div
                key={f}
                className="flex items-center gap-2 rounded-lg px-3 py-2"
                style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}
              >
                <div
                  className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${cfg.accentColor.replace("text-", "bg-")}`}
                />
                <span className="text-white/50 text-xs font-mono">{f}</span>
              </div>
            ))}
          </div>

          {/* CTA buttons */}
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            {isLoggedIn ? (
              // Logged-in users: show Stripe upgrade buttons based on context
              <>
                {cfg.requiredTier === 'core' && !isCoreTier && (
                  <button
                    onClick={() => checkoutMutation.mutate({ planId: 'core', origin: window.location.origin })}
                    disabled={checkoutMutation.isPending}
                    className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-lg font-semibold text-sm transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed bg-cyan-500 text-black"
                    style={{ boxShadow: '0 0 20px rgba(34,211,238,0.4)' }}
                  >
                    <Zap className="w-4 h-4" />
                    {checkoutMutation.isPending ? 'Loading...' : 'Unlock Core — $9.99/mo'}
                  </button>
                )}
                <button
                  onClick={() => checkoutMutation.mutate({ planId: 'premium', origin: window.location.origin })}
                  disabled={checkoutMutation.isPending}
                  className={`inline-flex items-center justify-center gap-2 px-6 py-3 rounded-lg font-semibold text-sm transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed ${cfg.requiredTier === 'premium' ? 'bg-cyan-500 text-black' : 'text-white/70 hover:text-white'}`}
                  style={cfg.requiredTier === 'premium'
                    ? { boxShadow: `0 0 20px ${cfg.glowColor.replace('0.15', '0.4')}` }
                    : { background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}
                >
                  <Crown className="w-4 h-4" />
                  {checkoutMutation.isPending ? 'Loading...' : 'Upgrade to Pro — $59/mo'}
                </button>
                <button
                  onClick={() => checkoutMutation.mutate({ planId: 'founding', origin: window.location.origin })}
                  disabled={checkoutMutation.isPending}
                  className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-lg font-semibold text-sm text-[#FFD700]/80 hover:text-[#FFD700] transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed"
                  style={{ background: 'rgba(255,215,0,0.06)', border: '1px solid rgba(255,215,0,0.2)' }}
                >
                  Founding Member — $49/mo for life
                </button>
              </>
            ) : (
              // Unauthenticated: show login / sign up
              <>
                <a
                  href={loginUrl}
                  className={`inline-flex items-center justify-center gap-2 px-6 py-3 rounded-lg font-semibold text-sm transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] ${cfg.accentColor.replace("text-", "bg-").replace("-400", "-500")} text-black`}
                  style={{ boxShadow: `0 0 20px ${cfg.glowColor.replace("0.15", "0.4")}` }}
                >
                  <LogIn className="w-4 h-4" />
                  {cfg.ctaPrimary}
                </a>
                <a
                  href={loginUrl}
                  className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-lg font-semibold text-sm text-white/70 hover:text-white transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
                  style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" }}
                >
                  {cfg.ctaSecondary}
                </a>
              </>
            )}
          </div>

          {/* Footer note */}
          <p className="text-white/25 text-xs mt-8 font-mono">
            FAULTLINE — Institutional Market Intelligence Platform
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
        className="flex items-center justify-between rounded-lg px-4 py-3 gap-4"
        style={{
          background: "rgba(10,14,26,0.8)",
          border: "1px solid rgba(255,255,255,0.08)",
          backdropFilter: "blur(8px)",
        }}
      >
        <div className="flex items-center gap-3">
          <Lock className={`w-4 h-4 flex-shrink-0 ${cfg.accentColor}`} />
          <span className="text-white/60 text-sm font-mono">
            {label ?? cfg.title}
          </span>
        </div>
        <a
          href={loginUrl}
          className={`text-xs font-semibold px-3 py-1.5 rounded-md transition-all hover:scale-[1.02] whitespace-nowrap ${cfg.accentColor} hover:opacity-90`}
          style={{
            background: cfg.glowColor.replace("0.15", "0.2"),
            border: `1px solid ${cfg.glowColor.replace("0.15", "0.4")}`,
          }}
        >
          {cfg.ctaPrimary}
        </a>
      </div>
    );
  }

  return (
    <div
      className="relative rounded-xl overflow-hidden"
      style={{
        background: "rgba(10,14,26,0.9)",
        border: "1px solid rgba(255,255,255,0.08)",
        backdropFilter: "blur(12px)",
        boxShadow: `0 0 40px ${cfg.glowColor}`,
      }}
    >
      <div className="flex flex-col items-center text-center px-8 py-10">
        <div
          className={`inline-flex items-center justify-center w-12 h-12 rounded-xl mb-4 ${cfg.accentColor}`}
          style={{
            background: cfg.glowColor,
            border: `1px solid ${cfg.glowColor.replace("0.15", "0.4")}`,
          }}
        >
          <Lock className="w-5 h-5" />
        </div>

        <p className={`text-xs font-mono tracking-[0.15em] uppercase mb-2 ${cfg.accentColor}`}>
          {cfg.subtitle}
        </p>
        <h3 className="text-lg font-bold text-white mb-2">
          {label ?? cfg.title}
        </h3>
        <p className="text-white/50 text-sm leading-relaxed mb-6 max-w-xs">
          {cfg.description}
        </p>

        <a
          href={loginUrl}
          className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-lg font-semibold text-sm transition-all hover:scale-[1.02] active:scale-[0.98] ${cfg.accentColor.replace("text-", "bg-").replace("-400", "-500")} text-black`}
          style={{ boxShadow: `0 0 16px ${cfg.glowColor.replace("0.15", "0.35")}` }}
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
  children: React.ReactNode;
}

export function PremiumBlurOverlay({
  variant = "founding",
  label,
  children,
}: PremiumBlurOverlayProps) {
  const { isAuthenticated, loading } = useAuth();

  if (loading || isAuthenticated) return <>{children}</>;

  const cfg = GATE_CONFIGS[variant];
  const loginUrl = getLoginUrl();

  return (
    <div className="relative rounded-xl overflow-hidden">
      {/* Blurred content */}
      <div
        className="pointer-events-none select-none"
        style={{ filter: "blur(4px)", opacity: 0.3 }}
        aria-hidden="true"
      >
        {children}
      </div>

      {/* Overlay */}
      <div
        className="absolute inset-0 flex flex-col items-center justify-center gap-3 rounded-xl"
        style={{
          background: "rgba(8,12,22,0.75)",
          backdropFilter: "blur(2px)",
          border: "1px solid rgba(255,255,255,0.07)",
        }}
      >
        <Lock className={`w-6 h-6 ${cfg.accentColor}`} />
        <p className="text-white/70 text-sm font-semibold">
          {label ?? cfg.title}
        </p>
        <a
          href={loginUrl}
          className={`text-xs font-semibold px-4 py-2 rounded-lg transition-all hover:scale-[1.02] ${cfg.accentColor.replace("text-", "bg-").replace("-400", "-500")} text-black`}
        >
          {cfg.ctaPrimary}
        </a>
      </div>
    </div>
  );
}
