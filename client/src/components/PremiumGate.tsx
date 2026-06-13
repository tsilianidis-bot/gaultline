import { Lock, Zap, Shield, TrendingUp, Crown, LogIn, BarChart2 } from "lucide-react";
import { getLoginUrl } from "@/const";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { trackUpgradeClick } from "@/hooks/useAnalytics";


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
  accentHex: string;         // Raw hex for CSS usage
  glowColor: string;         // CSS color for box-shadow glow
  ctaPrimary: string;
  ctaSecondary: string;
  features: string[];
  requiredTier: GateTier;    // minimum tier to unlock
}

const GATE_CONFIGS: Record<PremiumGateVariant, PremiumGateConfig> = {
  founding: {
    title: "Pro Intelligence Required",
    subtitle: "INSTITUTIONAL INTELLIGENCE PLATFORM",
    description:
      "This module requires FAULTLINE Pro or Founding Access. Unlock the full institutional intelligence suite — macro, signals, crypto, systemic risk, and AI diagnostics.",
    icon: <Shield className="w-8 h-8" />,
    accentColor: "text-cyan-400",
    accentHex: "#00D4FF",
    glowColor: "rgba(0,212,255,0.15)",
    ctaPrimary: "Unlock Operator — $79/mo",
    ctaSecondary: "Founding Access — $199 one-time",
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
    accentHex: "#22D3EE",
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
    accentHex: "#22D3EE",
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
    accentHex: "#22D3EE",
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
    accentHex: "#FB923C",
    glowColor: "rgba(251,146,60,0.15)",
    ctaPrimary: "Unlock Operator — $79/mo",
    ctaSecondary: "Founding Access — $199 one-time",
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
    accentHex: "#00D4FF",
    glowColor: "rgba(0,212,255,0.15)",
    ctaPrimary: "Unlock Operator — $79/mo",
    ctaSecondary: "Founding Access — $199 one-time",
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
    ctaPrimary: "Unlock Operator — $79/mo",
    ctaSecondary: "Founding Access — $199 one-time",
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
    ctaPrimary: "Unlock Operator — $79/mo",
    ctaSecondary: "Founding Access — $199 one-time",
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
    accentHex: "#60A5FA",
    glowColor: "rgba(96,165,250,0.15)",
    ctaPrimary: "Unlock Operator — $79/mo",
    ctaSecondary: "Founding Access — $199 one-time",
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
    onMutate: (vars) => {
      trackUpgradeClick(vars.planId, 'premium_gate');
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
          {(cfg.requiredTier === 'premium') && (
            <div
              className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg mb-6 text-center"
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
                {cfg.requiredTier === 'core' && !isCoreTier && (
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
                    {checkoutMutation.isPending ? 'Loading...' : 'Unlock Core — $9.99/mo'}
                  </button>
                )}
                <button
                  onClick={() => checkoutMutation.mutate({ planId: 'premium', origin: window.location.origin })}
                  disabled={checkoutMutation.isPending}
                  className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-bold text-sm tracking-widest transition-all duration-200 hover:scale-[1.02] active:scale-[0.97] disabled:opacity-60 disabled:cursor-not-allowed"
                  style={cfg.requiredTier === 'premium'
                    ? { background: "#00D4FF", color: "#050608", boxShadow: "0 0 24px rgba(0,212,255,0.45)" }
                    : { background: "rgba(0,212,255,0.08)", border: "1px solid rgba(0,212,255,0.25)", color: "#00D4FF" }}
                >
                  <Crown className="w-4 h-4" />
                  {checkoutMutation.isPending ? 'Loading...' : 'Unlock Analyst — $39/mo'}
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
                  {checkoutMutation.isPending ? 'Loading...' : 'Founding Access — $199 one-time'}
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
          <p className="text-white/20 text-[10px] mt-8 font-mono tracking-widest">
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
        style={{ filter: "blur(5px)", opacity: 0.25 }}
        aria-hidden="true"
      >
        {children}
      </div>

      {/* Glass overlay */}
      <div
        className="absolute inset-0 flex flex-col items-center justify-center gap-3 rounded-xl"
        style={{
          background: `linear-gradient(135deg, rgba(8,12,22,0.85) 0%, rgba(12,16,28,0.9) 100%)`,
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
        <p className="text-white/60 text-sm font-semibold">
          {label ?? cfg.title}
        </p>
        <a
          href={loginUrl}
          className="text-xs font-bold px-4 py-2 rounded-lg transition-all hover:scale-[1.02]"
          style={{
            background: cfg.accentHex,
            color: "#050608",
            boxShadow: `0 0 16px ${cfg.accentHex}35`,
          }}
        >
          {cfg.ctaPrimary}
        </a>
      </div>
    </div>
  );
}
