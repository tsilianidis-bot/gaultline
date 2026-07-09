/* ============================================================
   FAULTLINE Core — Crypto Signals Tab
   Top crypto signals with usage gate (5/day free/core,
   unlimited for pro/founding). Shows upgrade prompt when
   limit is reached.
   ============================================================ */
import { useState, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import {
  TrendingUp, TrendingDown, Minus, Lock, RefreshCw, Zap, Crown,
  ChevronRight, AlertTriangle, Activity, BarChart2,
} from "lucide-react";

// ── Helpers ───────────────────────────────────────────────────
function actionColor(action: string): string {
  if (action === "BUY")   return "#00D4FF";
  if (action === "SELL")  return "#FF2D55";
  if (action === "HOLD")  return "#22D3EE";
  return "#64748B"; // WATCH
}

function actionIcon(action: string) {
  if (action === "BUY")  return <TrendingUp size={13} />;
  if (action === "SELL") return <TrendingDown size={13} />;
  return <Minus size={13} />;
}

function confidenceBar(score: number, color: string) {
  return (
    <div className="w-full h-1 rounded-full bg-white/5 overflow-hidden">
      <div
        className="h-full rounded-full"
        style={{
          width: `${score}%`,
          background: color,
          boxShadow: `0 0 4px ${color}80`,
        }}
      />
    </div>
  );
}

function formatPrice(price: number): string {
  if (price >= 1000) return `$${price.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
  if (price >= 1)    return `$${price.toFixed(2)}`;
  if (price >= 0.01) return `$${price.toFixed(4)}`;
  return `$${price.toFixed(6)}`;
}

function formatChange(pct: number | null): string {
  if (pct === null || pct === undefined) return "—";
  const sign = pct >= 0 ? "+" : "";
  return `${sign}${pct.toFixed(2)}%`;
}

// ── SignalCard ────────────────────────────────────────────────
function SignalCard({
  signal,
  index,
}: {
  signal: {
    symbol: string;
    name: string;
    action: string;
    actionLabel: string;
    confidence: number;
    strength: string;
    timeframe: string;
    rationale: string;
  priceLevels: {
    entryZone: number;
    stopLoss: number;
    targetPrice: number;
    riskReward: number;
    support: number;
    resistance: number;
    atr: number;
  };
    technicals: {
      priceChange7d: number | null;
      trend: string;
      rsiEstimate: number;
      rsiLabel: string;
      momentumScore: number;
    };
    cryptoRegime: string;
  };
  index: number;
}) {
  const [expanded, setExpanded] = useState(false);
  const color = actionColor(signal.action);
  const currentPrice = signal.priceLevels.entryZone; // best proxy for current price

  return (
    <div
      className="rounded-xl overflow-hidden mb-3"
      style={{
        background: "rgba(255,255,255,0.025)",
        border: `1px solid ${color}20`,
        animationDelay: `${index * 60}ms`,
      }}
    >
      {/* Main row */}
      <button
        className="w-full px-4 py-3.5 text-left"
        onClick={() => setExpanded((v) => !v)}
      >
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <span className="text-[13px] font-bold text-white">{signal.symbol}</span>
            <span className="text-[10px] font-mono text-[#64748B] truncate max-w-[80px]">{signal.name}</span>
          </div>
          <div
            className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-bold"
            style={{ background: `${color}15`, border: `1px solid ${color}30`, color }}
          >
            {actionIcon(signal.action)}
            {signal.action}
          </div>
        </div>

        <div className="flex items-center justify-between mb-2">
          <span className="text-[12px] font-mono text-white">{formatPrice(currentPrice)}</span>
          <span
            className="text-[11px] font-mono"
            style={{ color: (signal.technicals.priceChange7d ?? 0) >= 0 ? "#00D4FF" : "#FF2D55" }}
          >
            {formatChange(signal.technicals.priceChange7d)} 7d
          </span>
        </div>

        {/* Confidence bar */}
        <div className="flex items-center gap-2">
          <div className="flex-1">{confidenceBar(signal.confidence, color)}</div>
          <span className="text-[9px] font-mono text-[#64748B]">{signal.confidence}%</span>
        </div>
      </button>

      {/* Expanded details */}
      {expanded && (
        <div className="px-4 pb-4 border-t border-white/5 pt-3 space-y-3">
          {/* Action label + timeframe */}
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-mono" style={{ color }}>{signal.actionLabel}</span>
            <span className="text-[10px] font-mono text-[#64748B]">{signal.timeframe} · {signal.strength}</span>
          </div>

          {/* Rationale */}
          <p className="text-[11px] text-[#A8B8CC] leading-relaxed">{signal.rationale}</p>

          {/* Price levels grid */}
          <div className="grid grid-cols-3 gap-2">
              <div className="rounded-lg p-2 text-center" style={{ background: "rgba(0,212,255,0.06)", border: "1px solid rgba(0,212,255,0.1)" }}>
                <div className="text-[8px] font-mono text-[#64748B] mb-0.5">ENTRY</div>
                <div className="text-[10px] font-mono text-[#00D4FF]">{formatPrice(signal.priceLevels.entryZone)}</div>
              </div>
              <div className="rounded-lg p-2 text-center" style={{ background: "rgba(255,45,85,0.06)", border: "1px solid rgba(255,45,85,0.1)" }}>
                <div className="text-[8px] font-mono text-[#64748B] mb-0.5">STOP</div>
                <div className="text-[10px] font-mono text-[#FF2D55]">{formatPrice(signal.priceLevels.stopLoss)}</div>
              </div>
              <div className="rounded-lg p-2 text-center" style={{ background: "rgba(34,197,94,0.06)", border: "1px solid rgba(34,197,94,0.1)" }}>
                <div className="text-[8px] font-mono text-[#64748B] mb-0.5">TARGET</div>
                <div className="text-[10px] font-mono text-[#22C55E]">{formatPrice(signal.priceLevels.targetPrice)}</div>
              </div>
            </div>

          {/* Technicals row */}
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-[9px] font-mono text-[#64748B]">
              RSI <span className="text-[#A8B8CC]">{signal.technicals.rsiEstimate.toFixed(0)}</span>
              <span className="ml-1 text-[#64748B]">({signal.technicals.rsiLabel})</span>
            </span>
            <span className="text-[9px] font-mono text-[#64748B]">
              TREND <span className="text-[#A8B8CC]">{signal.technicals.trend}</span>
            </span>
            <span className="text-[9px] font-mono text-[#64748B]">
              REGIME <span className="text-[#A8B8CC]">{signal.cryptoRegime}</span>
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Upgrade Gate Banner ───────────────────────────────────────
function UpgradeGate({ remaining, limit, isPaid }: { remaining: number; limit: number; isPaid: boolean }) {
  const isExhausted = remaining === 0;

  if (!isExhausted) return null;

  return (
    <div
      className="rounded-xl p-4 mb-4"
      style={{
        background: "linear-gradient(135deg, rgba(255,45,85,0.06) 0%, rgba(5,6,8,0.8) 100%)",
        border: "1px solid rgba(255,45,85,0.25)",
      }}
    >
      <div className="flex items-start gap-3">
        <AlertTriangle size={16} className="text-[#FF2D55] flex-shrink-0 mt-0.5" />
        <div className="flex-1">
          <div className="text-[12px] font-bold text-white mb-1">Daily limit reached</div>
          <div className="text-[11px] text-[#A8B8CC] mb-3">
            {isPaid
              ? `You've used all ${limit} crypto signal views today. Upgrade to Power for unlimited daily access.`
              : `Free tier includes ${limit} crypto signal views/day. Upgrade to Core or Pro for more.`}
          </div>
          <a
            href="/mobile/upgrade"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-mono font-bold tracking-widest"
            style={{ background: "#FF2D55", color: "#fff" }}
          >
            {isPaid ? <Zap size={12} /> : <Crown size={12} />}
            {isPaid ? "UPGRADE TO PRO" : "UPGRADE NOW"}
            <ChevronRight size={12} />
          </a>
        </div>
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────
export default function MobileCrypto() {
  const { user, loading: authLoading } = useAuth();
  const [viewed, setViewed] = useState(false);

  const gateQuery = trpc.mobileUsage.canUseFeature.useQuery(
    { feature: "cryptoSignals" },
    { enabled: !!user }
  );
  const logViewMut = trpc.mobileUsage.logCryptoSignalView.useMutation();

  // Only fetch screener if gate allows AND user has triggered it
  const screenerQuery = trpc.crypto.getScreener.useQuery(
    { limit: 10 },
    {
      enabled: !!user && (gateQuery.data?.allowed === true) && viewed,
      staleTime: 5 * 60 * 1000,
    }
  );

  const handleLoad = useCallback(async () => {
    if (!user) return;
    if (!gateQuery.data?.allowed) return;
    setViewed(true);
    // Log the view
    try { await logViewMut.mutateAsync(); } catch { /* non-critical */ }
  }, [user, gateQuery.data?.allowed, logViewMut]);

  // ── Not signed in ─────────────────────────────────────────
  if (!authLoading && !user) {
    return (
      <div className="flex flex-col items-center justify-center min-h-full px-6 py-12 text-center">
        <div className="w-16 h-16 rounded-full border-2 border-[#00D4FF]/30 flex items-center justify-center mb-6">
          <Activity size={28} className="text-[#00D4FF]" />
        </div>
        <div className="text-[10px] font-mono tracking-[0.3em] text-[#00D4FF]/60 mb-2">CRYPTO SIGNALS</div>
        <h2 className="text-xl font-bold text-white mb-3">Sign In Required</h2>
        <p className="text-[#A8B8CC] text-sm mb-8 leading-relaxed">
          Sign in to access live crypto trading signals.
        </p>
        <a
          href={getLoginUrl()}
          className="w-full max-w-xs py-3 text-center font-mono font-bold text-sm tracking-widest rounded-lg bg-[#00D4FF] text-[#050608]"
          style={{ boxShadow: "0 0 20px rgba(0,212,255,0.3)" }}
        >
          SIGN IN
        </a>
      </div>
    );
  }

  const isLoading = authLoading || gateQuery.isLoading;
  const gate = gateQuery.data;
  const remaining = gate?.remaining ?? 0;
  const limit = gate?.limit ?? 5;
  const isPaid = !!(gate && gate.limit !== null && (gate.limit ?? 0) > 2);
  const isExhausted = gate?.allowed === false;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-full">
        <RefreshCw size={20} className="text-[#00D4FF] animate-spin" />
      </div>
    );
  }

  const signals = screenerQuery.data?.signals ?? [];
  const regime  = screenerQuery.data?.regime;

  return (
    <div className="px-4 py-5 pb-8">

      {/* Header */}
      <div className="mb-4">
        <div className="text-[10px] font-mono tracking-[0.3em] text-[#00D4FF]/60 mb-1">CRYPTO SIGNALS</div>
        <div className="flex items-center justify-between">
          <h1 className="text-[18px] font-bold text-white">Top Crypto Signals</h1>
          {regime && (
            <div
              className="text-[9px] font-mono px-2 py-1 rounded-full"
              style={{
                background: "rgba(0,212,255,0.08)",
                border: "1px solid rgba(0,212,255,0.2)",
                color: "#00D4FF",
              }}
            >
              {regime.label}
            </div>
          )}
        </div>
        {/* Usage indicator */}
        {gate && gate.limit !== null && (
          <div className="flex items-center gap-2 mt-2">
            <div className="flex-1 h-1 rounded-full bg-white/5 overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${Math.min(100, ((limit - remaining) / limit) * 100)}%`,
                  background: isExhausted ? "#FF2D55" : "#00D4FF",
                }}
              />
            </div>
            <span className="text-[9px] font-mono text-[#64748B]">
              {isExhausted ? "0" : remaining}/{limit} remaining today
            </span>
          </div>
        )}
      </div>

      {/* Gate banner if exhausted */}
      <UpgradeGate remaining={remaining} limit={limit} isPaid={isPaid} />

      {/* Load signals button (not yet viewed) */}
      {!viewed && !isExhausted && (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <div
            className="w-16 h-16 rounded-full flex items-center justify-center mb-4"
            style={{ background: "rgba(0,212,255,0.08)", border: "1px solid rgba(0,212,255,0.2)" }}
          >
            <BarChart2 size={28} className="text-[#00D4FF]" />
          </div>
          <div className="text-[13px] text-[#A8B8CC] mb-6 leading-relaxed">
            Live crypto signals powered by FAULTLINE's<br />pressure engine and technical analysis.
          </div>
          <button
            onClick={handleLoad}
            className="px-6 py-3 rounded-lg font-mono font-bold text-[12px] tracking-widest text-[#050608] transition-all active:scale-95"
            style={{
              background: "#00D4FF",
              boxShadow: "0 0 20px rgba(0,212,255,0.3)",
            }}
          >
            LOAD SIGNALS
          </button>
          {gate?.limit !== null && (
            <div className="text-[9px] font-mono text-[#64748B] mt-3">
              Uses 1 of your {limit} daily crypto signal views
            </div>
          )}
        </div>
      )}

      {/* Loading screener */}
      {viewed && screenerQuery.isLoading && (
        <div className="flex items-center justify-center py-12">
          <RefreshCw size={20} className="text-[#00D4FF] animate-spin mr-2" />
          <span className="text-[12px] font-mono text-[#64748B]">Loading signals...</span>
        </div>
      )}

      {/* Error state */}
      {viewed && screenerQuery.isError && (
        <div className="text-center py-8">
          <AlertTriangle size={24} className="text-[#FF2D55] mx-auto mb-2" />
          <div className="text-[12px] font-mono text-[#FF2D55]">Failed to load signals</div>
          <button
            onClick={() => screenerQuery.refetch()}
            className="mt-3 text-[11px] font-mono text-[#00D4FF]"
          >
            Try again
          </button>
        </div>
      )}

      {/* Signal cards */}
      {viewed && !screenerQuery.isLoading && signals.length > 0 && (
        <>
          {/* Top 5 only for free/core; all for pro */}
          {(gate?.limit === null ? signals : signals.slice(0, 5)).map((signal, i) => (
            <SignalCard key={signal.symbol} signal={signal} index={i} />
          ))}

          {/* Soft upsell for non-pro to see more */}
          {gate?.limit !== null && signals.length > 5 && (
            <div
              className="rounded-xl p-4 text-center"
              style={{
                background: "rgba(255,255,255,0.02)",
                border: "1px solid rgba(255,255,255,0.06)",
              }}
            >
              <Lock size={16} className="text-[#64748B] mx-auto mb-2" />
              <div className="text-[12px] font-bold text-white mb-1">
                {signals.length - 5} more signals available
              </div>
              <div className="text-[11px] text-[#64748B] mb-3">
                Upgrade to Power for the full screener with unlimited access.
              </div>
              <a
                href="/mobile/upgrade"
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-[11px] font-mono font-bold tracking-widest"
                style={{ background: "rgba(0,212,255,0.1)", border: "1px solid rgba(0,212,255,0.25)", color: "#00D4FF" }}
              >
                <Zap size={12} /> UPGRADE TO PRO <ChevronRight size={12} />
              </a>
            </div>
          )}

          {/* Full platform link */}
          <div className="mt-3 text-center">
            <a
              href="/app/crypto"
              className="text-[10px] font-mono text-[#64748B] underline"
            >
              View full crypto intelligence on desktop →
            </a>
          </div>
        </>
      )}

      {/* Exhausted state — show blurred placeholder cards */}
      {isExhausted && (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div
              key={i}
              className="rounded-xl px-4 py-4 opacity-30"
              style={{
                background: "rgba(255,255,255,0.02)",
                border: "1px solid rgba(255,255,255,0.05)",
                filter: "blur(1px)",
              }}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="w-12 h-3 rounded bg-white/10" />
                <div className="w-10 h-3 rounded bg-white/10" />
              </div>
              <div className="w-full h-2 rounded bg-white/5" />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
