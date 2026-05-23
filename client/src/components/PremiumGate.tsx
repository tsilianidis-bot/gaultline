import { Lock, Zap, Shield, TrendingUp, Crown, LogIn } from "lucide-react";
import { getLoginUrl } from "@/const";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";


// ─── Types ────────────────────────────────────────────────────────────────────

export type PremiumGateVariant =
  | "founding"       // "Founding Access Required"
  | "signals"        // "Advanced Signals Restricted"
  | "risk"           // "Real-Time Risk Engine Locked"
  | "intelligence"   // "Premium Intelligence Locked"
  | "crypto"         // "Crypto Intelligence Locked"
  | "aftershock"     // "Aftershock Engine™ Locked"
  | "portfolio"      // "Portfolio Monitor Locked"
  | "watchlist";     // "Watchlist Locked"

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
  },
  signals: {
    title: "Advanced Signals Restricted",
    subtitle: "PREMIUM SIGNAL ENGINE",
    description:
      "FAULTLINE's proprietary signal engine — RSI, MACD, SMA crossover, regime-weighted scoring, and AI classification — is available to founding members.",
    icon: <TrendingUp className="w-8 h-8" />,
    accentColor: "text-cyan-400",
    glowColor: "rgba(34,211,238,0.15)",
    ctaPrimary: "Unlock Full Intelligence",
    ctaSecondary: "Request Founding Access",
    features: [
      "True RSI / MACD / SMA signals",
      "AI signal classification",
      "Regime-weighted scoring",
      "BUY / SELL / HOLD / WATCH labels",
    ],
  },
  risk: {
    title: "Real-Time Risk Engine Locked",
    subtitle: "SYSTEMIC RISK INTELLIGENCE",
    description:
      "The FAULTLINE Pressure Index™ and systemic risk engine analyze macro conditions, liquidity, Treasury stress, and volatility regimes in real time.",
    icon: <Zap className="w-8 h-8" />,
    accentColor: "text-orange-400",
    glowColor: "rgba(251,146,60,0.15)",
    ctaPrimary: "Unlock Full Intelligence",
    ctaSecondary: "Join Early Access",
    features: [
      "FAULTLINE Pressure Index™",
      "Liquidity stress monitoring",
      "Treasury yield shock detection",
      "Volatility regime classification",
    ],
  },
  intelligence: {
    title: "Premium Intelligence Locked",
    subtitle: "INSTITUTIONAL INTELLIGENCE SUITE",
    description:
      "Full access to FAULTLINE's institutional intelligence suite requires founding membership. Preview limited metrics below.",
    icon: <Shield className="w-8 h-8" />,
    accentColor: "text-cyan-400",
    glowColor: "rgba(34,211,238,0.15)",
    ctaPrimary: "Request Founding Access",
    ctaSecondary: "Join Early Access",
    features: [
      "Diagnostic AI™ analysis",
      "Position Guidance™",
      "Full macro regime engine",
      "Historical signal analytics",
    ],
  },
  crypto: {
    title: "Crypto Intelligence Locked",
    subtitle: "DIGITAL ASSET INTELLIGENCE",
    description:
      "FAULTLINE's crypto intelligence engine tracks digital asset risk, liquidity, momentum, and macro correlation across BTC, ETH, SOL, and hundreds of tokens.",
    icon: <Zap className="w-8 h-8" />,
    accentColor: "text-blue-400",
    glowColor: "rgba(96,165,250,0.15)",
    ctaPrimary: "Unlock Full Intelligence",
    ctaSecondary: "Request Founding Access",
    features: [
      "Crypto systemic risk score",
      "BTC macro correlation tracking",
      "AI narrative exposure signals",
      "Stablecoin liquidity monitoring",
    ],
  },
  aftershock: {
    title: "Aftershock Engine™ Locked",
    subtitle: "MARKET CONTAGION INTELLIGENCE",
    description:
      "The Aftershock Engine™ detects primary market ruptures and identifies assets likely to experience delayed secondary reactions — sympathy momentum, sector echoes, and macro shockwaves.",
    icon: <Zap className="w-8 h-8" />,
    accentColor: "text-orange-400",
    glowColor: "rgba(251,146,60,0.15)",
    ctaPrimary: "Unlock Full Intelligence",
    ctaSecondary: "Request Founding Access",
    features: [
      "Primary rupture detection",
      "Contagion chain mapping",
      "Delayed reaction signals",
      "Macro shockwave analysis",
    ],
  },
  portfolio: {
    title: "Portfolio Monitor Locked",
    subtitle: "LIVE PORTFOLIO INTELLIGENCE",
    description:
      "Track your positions with live P&L, AI-driven action guidance, and regime-aware risk scoring. Requires founding membership.",
    icon: <TrendingUp className="w-8 h-8" />,
    accentColor: "text-cyan-400",
    glowColor: "rgba(34,211,238,0.15)",
    ctaPrimary: "Request Founding Access",
    ctaSecondary: "Join Early Access",
    features: [
      "Live P&L tracking",
      "AI position guidance",
      "Regime-aware risk scoring",
      "Add / Hold / Trim / Exit labels",
    ],
  },
  watchlist: {
    title: "Watchlist Locked",
    subtitle: "CRYPTO WATCHLIST & COMPARISON",
    description:
      "Save tokens, monitor live signal labels, and compare assets side-by-side. Available to founding members.",
    icon: <Shield className="w-8 h-8" />,
    accentColor: "text-blue-400",
    glowColor: "rgba(96,165,250,0.15)",
    ctaPrimary: "Request Founding Access",
    ctaSecondary: "Join Early Access",
    features: [
      "Save any crypto token",
      "Live signal label monitoring",
      "Side-by-side comparison (4 tokens)",
      "Signal score tracking",
    ],
  },
};

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
  const hasPremiumAccess = isAuthenticated && (tier === 'premium' || tier === 'founding');

  // Premium / founding users see full content
  if (hasPremiumAccess) {
    return <>{children}</>;
  }

  // Free-tier logged-in users: show upgrade gate (not login gate)
  const isFreeTier = isAuthenticated && tier === 'free';

  const cfg = GATE_CONFIGS[variant];
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

          {/* CTA buttons — different for free-tier vs unauthenticated */}
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            {isFreeTier ? (
              // Free-tier logged-in: show upgrade / account link
              <>
                <a
                  href="/account"
                  className={`inline-flex items-center justify-center gap-2 px-6 py-3 rounded-lg font-semibold text-sm transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] ${cfg.accentColor.replace("text-", "bg-").replace("-400", "-500")} text-black`}
                  style={{ boxShadow: `0 0 20px ${cfg.glowColor.replace("0.15", "0.4")}` }}
                >
                  <Crown className="w-4 h-4" />
                  Request Founding Access
                </a>
                <a
                  href="/account"
                  className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-lg font-semibold text-sm text-white/70 hover:text-white transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
                  style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" }}
                >
                  View My Account
                </a>
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
