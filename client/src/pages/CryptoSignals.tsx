// ============================================================
// CryptoSignals.tsx
// Crypto trading signals page — mirrors the stock Signals page
// layout exactly: regime banner → crypto search → top signals
// row → summary bar → category tabs → filter panel → screener grid
// ============================================================

import { useState, useMemo, useCallback, useRef } from "react";
import { score100Value } from "@/lib/displayFallbacks";
import { formatObservedFixed } from "@/lib/nullableFormat";
import { trpc } from "@/lib/trpc";
import { CONFIDENCE_NOT_ESTABLISHED } from "@/lib/confidenceDisplay";
import { evidenceStatusLabel } from "../../../shared/evidenceStatus";
import { MOMENTUM_FILTERS, observedDirection, observedDirectionSentence } from "@shared/surfaceClaims";
import { useEngine } from "@/contexts/EngineContext";
import { canonicalRegimeDisplayColor } from "@/lib/marketStateProjection";
import { useAuth } from "@/_core/hooks/useAuth";
import { Link } from "wouter";
import { RecoveryStatusBadge, AftershockRiskInline } from "@/components/RecoveryStatus";
import { PremiumGateFull } from "@/components/PremiumGate";
import { useSEO, PAGE_SEO } from "@/hooks/useSEO";
import { ShareReportButton } from "@/components/ShareReportButton";
import { SizingCalculator } from "@/components/SizingCalculator";
import { trackCryptoSignalViewed } from "@/hooks/useAnalytics";
import { TickerChip } from "@/components/TickerActionMenu";
import { TickerContext } from "@/components/TickerContext";
import { UniversalTickerHeader } from "@/components/UniversalTickerHeader";

// ── Types ─────────────────────────────────────────────────────

type TradingAction = string;

function signalClass(sig: { action?: string; direction?: string }): string {
  return sig.direction || sig.action || "";
}

interface CryptoSignalResult {
  symbol: string;
  name: string;
  coinId: string;
  assetClass?: "CRYPTO";
  action?: TradingAction;
  direction?: string;
  actionLabel?: string;        // precision label e.g. "Accumulation Zone"
  cryptoRegime?: string;
  regimeConflict?: boolean;
  regimeConflictExplanation?: string | null;
  // Launch fix-up: the server withholds the formula confidence (always null).
  confidence: number | null;
  // Ordinal ordering position from the screener (1 = first). Never displayed.
  strengthRank?: number;
  strength: "Strong" | "Moderate" | "Weak";
  timeframe: "Short-Term" | "Swing" | "Watch";
  rationale: string;
  technicals: {
    rsiEstimate: number | null;
    rsiLabel: "Overbought" | "Neutral" | "Oversold";
    rsiIsTrue: boolean;
    trend: "Uptrend" | "Downtrend" | "Sideways";
    volumeSignal: "Surge" | "Normal" | "Low" | "Unavailable";
    momentumScore: number | null;
    smaSignal: "Golden Cross" | "Death Cross" | "Neutral";
    smaIsTrue: boolean;
    macd: { macdLine: number; signalLine: number; histogram: number; signal: "Bullish" | "Bearish" | "Neutral" } | null;
    volatility24h: number | null;
    distanceFromAth: number | null;
    priceChange7d: number | null;
    priceChange30d: number | null;
  };
  priceLevels: {
    entryZone: number;
    stopLoss: number;
    targetPrice: number;
    riskReward: number;
    support: number;
    resistance: number;
    atr: number;
  };
  regimeAlignment: "Aligned" | "Neutral" | "Counter-Trend";
  regimeAlignmentScore: number;
  cryptoFactors: {
    btcDominanceEffect: "Headwind" | "Neutral" | "Tailwind" | "Unavailable";
    volatilityRegime: "High" | "Normal" | "Low" | "Unavailable";
    athProximity: "Near ATH" | "Mid-Range" | "Deep Discount" | "Unavailable";
    liquidityScore: number | null;
  };
  computedAt: number;
}

interface ScreenerResponse {
  signals: CryptoSignalResult[];
  regime: { label: string; score: number };
  btcDominance: number | null;
  totalMarketCap: number | null;
  marketCapChange24h: number | null;
  marketObservedAtMs?: number | null;
  computedAt: number;
}

/** Header and footer dominance figure. A missing observation renders Unavailable. */
export function BtcDominanceReadout({ btcDominance }: { btcDominance: number | null | undefined }) {
  const dominance = btcDominance;
  const text = typeof dominance === "number" && Number.isFinite(dominance) ? `${dominance.toFixed(1)}%` : "Unavailable";
  return <span data-btc-dominance={text === "Unavailable" ? "unavailable" : "value"}>{text}</span>;
}

/** Finite momentum scores sort descending. Missing scores stay in `unavailable` and never become the leader. */
export function rankMomentumSignals<T extends { symbol: string; technicals: { momentumScore: number | null } }>(signals: T[]) {
  const ranked: T[] = [];
  const unavailable: T[] = [];
  for (const signal of signals) {
    const score = signal.technicals.momentumScore;
    if (typeof score === "number" && Number.isFinite(score)) ranked.push(signal);
    else unavailable.push(signal);
  }
  ranked.sort((a, b) => (b.technicals.momentumScore as number) - (a.technicals.momentumScore as number));
  return { leader: ranked[0] ?? null, ranked, unavailable };
}

export function MomentumLeaderReadout({
  signal,
}: {
  signal: { symbol: string; technicals: { momentumScore: number | null } } | null;
}) {
  if (!signal || signal.technicals.momentumScore == null || !Number.isFinite(signal.technicals.momentumScore)) {
    return <span data-momentum-leader="unavailable">Unavailable</span>;
  }
  return <span data-momentum-leader={signal.symbol}>{signal.symbol}</span>;
}

export function CryptoScreenerFreshnessBadge({
  observedAtMs,
  nowMs,
  sourceStatus,
  refreshing,
}: {
  observedAtMs?: number | null;
  nowMs?: number;
  sourceStatus?: string | null;
  refreshing?: boolean;
}) {
  if (refreshing) return <span data-crypto-screener-status="REFRESHING">REFRESHING...</span>;
  const hasObservation = typeof observedAtMs === "number" && Number.isFinite(observedAtMs);
  const label = evidenceStatusLabel({
    observedAtMs,
    nowMs,
    sourceStatus: sourceStatus ?? (hasObservation ? "live" : "unavailable"),
    hasObservation,
  });
  return <span data-crypto-screener-status={label}>{label}</span>;
}

// ── Constants ─────────────────────────────────────────────────

const ACTION_COLORS: Record<string, { text: string; bg: string; border: string }> = {
  positive: { text: "#00D4FF", bg: "rgba(0,212,255,0.12)", border: "rgba(0,212,255,0.35)" },
  negative: { text: "#FF2D55", bg: "rgba(255,45,85,0.12)", border: "rgba(255,45,85,0.35)" },
  mixed: { text: "#FFD700", bg: "rgba(255,215,0,0.10)", border: "rgba(255,215,0,0.30)" },
  unestablished: { text: "#94A3B8", bg: "rgba(148,163,184,0.08)", border: "rgba(148,163,184,0.20)" },
};

const TREND_COLORS: Record<string, string> = {
  Uptrend:   "#00D4FF",
  Downtrend: "#FF2D55",
  Sideways:  "#FFD700",
};

const UNAVAILABLE_CRYPTO_CONTEXT = { headline: "REGIME UNAVAILABLE", description: "The canonical market state is unavailable, so crypto regime context is withheld.", bullish: "Unavailable", bearish: "Unavailable" };

const REGIME_CRYPTO_CONTEXT: Record<string, { headline: string; description: string; bullish: string; bearish: string }> = {
  "LOW RISK":      { headline: "LOWEST PRESSURE BAND", description: "The Pressure Index is in its lowest stress class. This is the current reading, not an instruction. Freshness follows the canonical timestamp.", bullish: "No position list", bearish: "No position list" },
  "MODERATE RISK": { headline: "MODERATE PRESSURE BAND", description: "The Pressure Index is in the moderate class. Inputs are mixed. This is not an instruction. Freshness follows the canonical timestamp.", bullish: "No position list", bearish: "No position list" },
  "HIGH RISK":     { headline: "ELEVATED PRESSURE BAND", description: "The Pressure Index is above the moderate class. This is the current reading, not an instruction. Freshness follows the canonical timestamp.", bullish: "No position list", bearish: "No position list" },
  "CRITICAL RISK": { headline: "HIGHEST STRESS BAND", description: "The Pressure Index is in its highest stress class. Crypto has historically moved with stressed equity regimes. That is a comparison, not an instruction.", bullish: "No position list", bearish: "No position list" },
};

const CRYPTO_CATEGORIES = ["All", "Large Cap", "Mid Cap", "DeFi", "Layer-1", "Layer-2", "AI/Data", "Gaming/NFT", "Meme"] as const;
type CryptoCategory = typeof CRYPTO_CATEGORIES[number];

// ── Helpers ───────────────────────────────────────────────────

// Launch fix-up: screener rows are ordered by the server's ordinal
// strengthRank (1 = first); rows without a rank keep their server order.
function byStrengthRank(a: CryptoSignalResult, b: CryptoSignalResult): number {
  return (a.strengthRank ?? Number.MAX_SAFE_INTEGER) - (b.strengthRank ?? Number.MAX_SAFE_INTEGER);
}

function fmt(n: number, decimals = 2): string {
  if (n === 0) return "0.00";
  if (n >= 1000) return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (n >= 1) return n.toFixed(decimals);
  if (n >= 0.01) return n.toFixed(4);
  return n.toFixed(6);
}

function fmtCap(n: number): string {
  if (n >= 1e12) return `$${(n / 1e12).toFixed(2)}T`;
  if (n >= 1e9)  return `$${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6)  return `$${(n / 1e6).toFixed(2)}M`;
  return `$${n.toLocaleString()}`;
}

function mapRegimeToKey(label: string): string {
  const l = label.toUpperCase();
  if (l.includes("CRITICAL")) return "CRITICAL RISK";
  if (l.includes("HIGH"))     return "HIGH RISK";
  if (l.includes("LOW"))      return "LOW RISK";
  return "MODERATE RISK";
}

function classifyCategory(sig: CryptoSignalResult): CryptoCategory {
  const sym = sig.symbol.toUpperCase();
  const name = sig.name.toLowerCase();
  // Large cap by market cap rank (approximated from symbol)
  if (["BTC", "ETH", "BNB", "SOL", "XRP", "ADA", "AVAX", "DOT"].includes(sym)) return "Large Cap";
  if (["MATIC", "LINK", "UNI", "AAVE", "MKR", "CRV", "COMP", "SNX"].includes(sym)) return "DeFi";
  if (["ARB", "OP", "MATIC", "IMX", "ZK", "STRK", "MANTA"].includes(sym)) return "Layer-2";
  if (["RNDR", "FET", "TAO", "OCEAN", "GRT", "AGIX", "NMR"].includes(sym)) return "AI/Data";
  if (["AXS", "SAND", "MANA", "GALA", "APE", "ENJ", "ILV"].includes(sym)) return "Gaming/NFT";
  if (["DOGE", "SHIB", "PEPE", "FLOKI", "BONK", "WIF", "BOME"].includes(sym)) return "Meme";
  if (name.includes("layer") || name.includes("protocol") || name.includes("network")) return "Layer-1";
  return "Mid Cap";
}

// ── Sparkline ─────────────────────────────────────────────────

function Sparkline({ data, positive }: { data: number[]; positive: boolean }) {
  if (!data || data.length < 2) return null;
  const w = 80, h = 28;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * w;
    const y = h - ((v - min) / range) * (h - 4) - 2;
    return `${x},${y}`;
  }).join(" ");
  const color = positive ? "#00D4FF" : "#FF2D55";
  return (
    <svg width={w} height={h} style={{ display: "block" }}>
      <defs>
        <linearGradient id={`sg-${positive}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={0.3} />
          <stop offset="100%" stopColor={color} stopOpacity={0} />
        </linearGradient>
      </defs>
      <polyline points={pts} fill="none" stroke={color} strokeWidth={1.5} strokeLinejoin="round" />
    </svg>
  );
}

// ── Signal Badge ──────────────────────────────────────────────

function ActionBadge({ action, strength }: { action: TradingAction; strength: string; actionLabel?: string }) {
  const direction = observedDirection(action);
  const c = ACTION_COLORS[direction] ?? ACTION_COLORS.unestablished;
  return (
    <div style={{
      display: "inline-flex", alignItems: "center", gap: "4px",
      padding: "3px 8px",
      background: c.bg, border: `1px solid ${c.border}`,
      borderRadius: "2px",
      fontFamily: "'IBM Plex Mono', monospace",
      fontSize: "9px", fontWeight: 700, letterSpacing: "0.12em",
      color: c.text,
    }}>
      {observedDirectionSentence(action)}
      {strength === "Strong" && (
        <span style={{ fontSize: "7px", color: c.text, opacity: 0.8 }}>★</span>
      )}
    </div>
  );
}

// ── RSI Bar ───────────────────────────────────────────────────

export function CryptoRsiReadout({
  rsiEstimate,
  rsiLabel,
  rsiIsTrue,
  actionLabel,
}: {
  rsiEstimate: number | null;
  rsiLabel: string;
  rsiIsTrue: boolean;
  actionLabel: string;
}) {
  if (actionLabel === "Unavailable" || rsiEstimate == null || !rsiIsTrue) return null;
  return (
    <div data-crypto-rsi="shown">
      <RSIBar value={rsiEstimate} label={rsiLabel} />
      <span>RSI(14)</span>
      <span>{rsiEstimate.toFixed(0)}</span>
    </div>
  );
}

function RSIBar({ value, label }: { value: number; label: string }) {
  const color = label === "Overbought" ? "#FF2D55" : label === "Oversold" ? "#00D4FF" : "#FFD700";
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "2px" }}>
        <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "7px", color: "rgba(100,116,139,0.5)", letterSpacing: "0.08em" }}>RSI</span>
        <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "7px", color }}>{value.toFixed(0)} {label.toUpperCase()}</span>
      </div>
      <div style={{ height: "3px", background: "rgba(255,255,255,0.06)", borderRadius: "2px", overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${value}%`, background: color, borderRadius: "2px", transition: "width 0.5s ease" }} />
      </div>
    </div>
  );
}

// ── Crypto Signal Card ────────────────────────────────────────

function CryptoSignalCard({ sig, regimeScore }: { sig: CryptoSignalResult; regimeScore: number }) {
  const [expanded, setExpanded] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);
  const signalViewFired = useRef(false);

  // Lazy-load coin info only when the INFO panel is opened
  const { data: coinInfo, isFetching: infoLoading } = trpc.crypto.getCoinInfo.useQuery(
    { symbol: sig.symbol },
    { enabled: infoOpen, staleTime: 30 * 60 * 1000 }
  );
  const c = ACTION_COLORS[observedDirection(signalClass(sig))] ?? ACTION_COLORS.unestablished;
  const positive = (sig.technicals.priceChange7d ?? 0) >= 0;
  const sparklineData = sig.technicals.priceChange7d !== null
    ? Array.from({ length: 10 }, (_, i) => {
        const progress = i / 9;
        return 50 + (sig.technicals.priceChange7d! * progress * 0.5);
      })
    : [];

  const regimeAlignColor = sig.regimeAlignment === "Aligned" ? "#00D4FF" : sig.regimeAlignment === "Counter-Trend" ? "#FF2D55" : "#FFD700";

  return (
    <div
      onClick={() => {
        const next = !expanded;
        setExpanded(next);
        if (next && !signalViewFired.current) {
          signalViewFired.current = true;
          trackCryptoSignalViewed(sig.symbol, 'daily');
        }
      }}
      style={{
        background: "rgba(8,10,14,0.9)",
        border: `1px solid ${c.border}`,
        borderRadius: "4px",
        padding: "12px",
        cursor: "pointer",
        transition: "border-color 0.15s ease, box-shadow 0.15s ease",
        boxShadow: expanded ? `0 0 16px ${c.text}12` : "none",
        position: "relative", overflow: "hidden",
      }}
    >
      {/* Top accent bar */}
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "2px", background: c.text, opacity: 0.6 }} />

      {/* Asset-class header */}
      <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "9px", letterSpacing: "0.14em", color: "rgba(100,116,139,0.45)", marginBottom: "4px" }}>
        CRYPTO SIGNAL — {sig.symbol}{sig.cryptoRegime ? ` · REGIME: ${sig.cryptoRegime.toUpperCase()}` : ""}
      </div>

      {/* Regime conflict warning */}
      {sig.regimeConflict && sig.regimeConflictExplanation && (
        <div style={{
          marginBottom: "6px", padding: "5px 8px",
          background: "rgba(255,215,0,0.07)", border: "1px solid rgba(255,215,0,0.2)",
          borderRadius: "3px",
          fontFamily: "'IBM Plex Mono', monospace", fontSize: "9px",
          color: "rgba(255,215,0,0.8)", lineHeight: 1.4,
        }}>
          ⚠ SIGNAL vs REGIME CONFLICT: {sig.regimeConflictExplanation}
        </div>
      )}

      {/* Header row */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "8px" }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "2px" }}>
            <TickerChip ticker={sig.symbol} name={sig.name} assetType="crypto" />
            <ActionBadge action={signalClass(sig)} strength={sig.strength} actionLabel={sig.actionLabel} />
          </div>
          <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "8px", color: "rgba(100,116,139,0.6)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {sig.name}
          </div>
        </div>
        <div style={{ textAlign: "right", flexShrink: 0 }}>
          <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "11px", fontWeight: 700, color: "#F0F4FF" }}>
            {/* Price shown from 7d change direction */}
          </div>
          {sig.technicals.priceChange7d !== null && (
            <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "10px", fontWeight: 700, color: positive ? "#00D4FF" : "#FF2D55" }}>
              {positive ? "+" : ""}{sig.technicals.priceChange7d.toFixed(2)}% 7D
            </div>
          )}
        </div>
      </div>

      {/* Sparkline */}
      {sparklineData.length > 0 && (
        <div style={{ marginBottom: "8px" }}>
          <Sparkline data={sparklineData} positive={positive} />
        </div>
      )}

      <div style={{ marginBottom: "8px" }}>
        <CryptoRsiReadout
          rsiEstimate={sig.technicals.rsiEstimate}
          rsiLabel={sig.technicals.rsiLabel}
          rsiIsTrue={sig.technicals.rsiIsTrue}
          actionLabel={sig.actionLabel ?? "Unavailable"}
        />
      </div>

      {/* Key metrics row */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "4px", marginBottom: "8px" }}>
        {[
          { label: "TREND", value: sig.technicals.trend.toUpperCase(), color: TREND_COLORS[sig.technicals.trend] },
          { label: "MOMENTUM", value: sig.technicals.momentumScore == null ? "Unavailable" : `${sig.technicals.momentumScore}`, color: sig.technicals.momentumScore == null ? "#94A3B8" : sig.technicals.momentumScore >= 60 ? "#00D4FF" : sig.technicals.momentumScore <= 40 ? "#FF2D55" : "#FFD700" },
          // QA r13 B14: signal "confidence" is min(95, 55 + |score| × 5) — a formula, not calibrated.
          { label: "CONFIDENCE", value: CONFIDENCE_NOT_ESTABLISHED, color: "#94A3B8" },
        ].map(({ label, value, color }) => (
          <div key={label} style={{ background: "rgba(255,255,255,0.02)", borderRadius: "2px", padding: "4px 6px" }}>
            <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "6px", color: "rgba(100,116,139,0.5)", letterSpacing: "0.1em", marginBottom: "2px" }}>{label}</div>
            <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "9px", fontWeight: 700, color }}>{value}</div>
          </div>
        ))}
      </div>

      {/* Regime alignment */}
      <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "6px" }}>
        <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "7px", color: "rgba(100,116,139,0.5)", letterSpacing: "0.08em" }}>REGIME ALIGNMENT:</span>
        <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "7px", fontWeight: 700, color: regimeAlignColor }}>{sig.regimeAlignment.toUpperCase()}</span>
        <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "7px", color: "rgba(100,116,139,0.4)" }}>Label only. The numeric tier restates this word and is not shown.</span>
      </div>

      {/* Rationale */}
      <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "8px", color: "rgba(100,116,139,0.7)", lineHeight: 1.5, marginBottom: "6px" }}>
        {sig.rationale}
      </div>

      {/* Expand indicator */}
      <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "7px", color: "rgba(100,116,139,0.4)", letterSpacing: "0.1em", textAlign: "right" }}>
        {expanded ? "▲ COLLAPSE" : "▼ DETAILS"}
      </div>

      {/* ── Expanded details ───────────────────────────────── */}
      {expanded && (
        <div style={{ borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: "10px", marginTop: "6px" }}>

          {/* Key Price Levels */}
          <div style={{ marginBottom: "10px", padding: "8px", background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)", borderRadius: "3px" }}>
            <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "7px", letterSpacing: "0.15em", color: "rgba(100,116,139,0.5)", marginBottom: "6px" }}>KEY PRICE LEVELS</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "4px", marginBottom: "6px" }}>
              {[
                { label: "LAST", value: `$${fmt(sig.priceLevels.entryZone)}`, color: c.text, sub: "latest quote used" },
                { label: "NOT PUBLISHED", value: "—", color: "#94A3B8", sub: "calculated trade levels are omitted" },
              ].map(({ label, value, color, sub }) => (
                <div key={label} style={{ textAlign: "center", background: "rgba(255,255,255,0.02)", borderRadius: "2px", padding: "5px 4px", borderTop: `2px solid ${color}30` }}>
                  <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "6px", color: "rgba(100,116,139,0.5)", letterSpacing: "0.08em", marginBottom: "2px" }}>{label}</div>
                  <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "10px", fontWeight: 700, color }}>{value}</div>
                  <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "6px", color: "rgba(100,116,139,0.4)", marginTop: "1px" }}>{sub}</div>
                </div>
              ))}
            </div>
            <p style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "7px", color: "rgba(100,116,139,0.6)", lineHeight: 1.5 }}>
              Prior highs and lows are not published as trade levels. The last quote above is the observation. Freshness is the quote timestamp when the source provides one.
            </p>
          </div>

          {/* Technical indicators */}
          <div style={{ marginBottom: "10px", display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "4px" }}>
            {[
              ...(sig.technicals.rsiEstimate == null || !sig.technicals.rsiIsTrue ? [] : [{ label: "RSI(14)", value: `${sig.technicals.rsiEstimate.toFixed(0)} ${sig.technicals.rsiLabel.toUpperCase()}`, color: sig.technicals.rsiLabel === "Overbought" ? "#FF2D55" : sig.technicals.rsiLabel === "Oversold" ? "#00D4FF" : "#94A3B8", badge: "TRUE" as string | undefined }]),
              { label: sig.technicals.smaIsTrue ? "SMA CROSS" : "SMA~", value: sig.technicals.smaSignal.toUpperCase(), color: sig.technicals.smaSignal === "Golden Cross" ? "#00D4FF" : sig.technicals.smaSignal === "Death Cross" ? "#FF2D55" : "#94A3B8", badge: sig.technicals.smaIsTrue ? "TRUE" : undefined },
              { label: "VOLUME", value: sig.technicals.volumeSignal.toUpperCase(), color: sig.technicals.volumeSignal === "Surge" ? "#FFD700" : sig.technicals.volumeSignal === "Low" ? "#FF2D55" : "#94A3B8", badge: undefined },
            ].map(({ label, value, color, badge }) => (
              <div key={label} style={{ background: "rgba(255,255,255,0.03)", borderRadius: "2px", padding: "4px 6px" }}>
                <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "7px", color: "rgba(100,116,139,0.5)", letterSpacing: "0.1em", display: "flex", alignItems: "center", gap: "3px" }}>
                  {label}
                  {badge && <span style={{ fontSize: "5px", color: "#22C55E", background: "rgba(34,197,94,0.15)", padding: "0 3px", borderRadius: "2px" }}>{badge}</span>}
                </div>
                <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "9px", fontWeight: 700, color }}>{value}</div>
              </div>
            ))}
            {sig.technicals.macd && (
              <div style={{ background: "rgba(255,255,255,0.03)", borderRadius: "2px", padding: "4px 6px", gridColumn: "1 / -1" }}>
                <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "7px", color: "rgba(100,116,139,0.5)", letterSpacing: "0.1em", display: "flex", alignItems: "center", gap: "3px", marginBottom: "2px" }}>
                  MACD (12/26/9)
                  <span style={{ fontSize: "5px", color: "#22C55E", background: "rgba(34,197,94,0.15)", padding: "0 3px", borderRadius: "2px" }}>TRUE</span>
                </div>
                <div style={{ display: "flex", gap: "10px" }}>
                  {[
                    { label: "MACD", value: sig.technicals.macd.macdLine.toFixed(4) },
                    { label: "SIGNAL", value: sig.technicals.macd.signalLine.toFixed(4) },
                    { label: "HIST", value: sig.technicals.macd.histogram.toFixed(4), color: sig.technicals.macd.histogram > 0 ? "#00D4FF" : "#FF2D55" },
                    { label: "TREND", value: sig.technicals.macd.signal.toUpperCase(), color: sig.technicals.macd.signal === "Bullish" ? "#00D4FF" : sig.technicals.macd.signal === "Bearish" ? "#FF2D55" : "#94A3B8" },
                  ].map(({ label, value, color: mc }) => (
                    <div key={label}>
                      <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "6px", color: "rgba(100,116,139,0.4)" }}>{label}</div>
                      <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "9px", fontWeight: 700, color: mc ?? "#94A3B8" }}>{value}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Crypto-specific factors */}
          <div style={{ marginBottom: "10px", padding: "8px", background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.04)", borderRadius: "3px" }}>
            <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "7px", letterSpacing: "0.15em", color: "rgba(100,116,139,0.5)", marginBottom: "6px" }}>CRYPTO FACTORS</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "6px" }}>
              {[
                { label: "BTC DOMINANCE", value: sig.cryptoFactors.btcDominanceEffect, color: sig.cryptoFactors.btcDominanceEffect === "Tailwind" ? "#00D4FF" : sig.cryptoFactors.btcDominanceEffect === "Headwind" ? "#FF2D55" : "#94A3B8" },
                { label: "VOLATILITY", value: sig.cryptoFactors.volatilityRegime, color: sig.cryptoFactors.volatilityRegime === "High" ? "#FF9500" : sig.cryptoFactors.volatilityRegime === "Low" ? "#00D4FF" : "#94A3B8" },
                { label: "ATH PROXIMITY", value: sig.cryptoFactors.athProximity, color: sig.cryptoFactors.athProximity === "Near ATH" ? "#FF9500" : sig.cryptoFactors.athProximity === "Deep Discount" ? "#00D4FF" : "#94A3B8" },
                { label: "VOLUME / CAP", value: "Not shown", color: "#94A3B8" },
              ].map(({ label, value, color }) => (
                <div key={label}>
                  <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "7px", color: "rgba(100,116,139,0.5)", letterSpacing: "0.1em" }}>{label}</div>
                  <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "9px", color }}>{value.toUpperCase()}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Additional price metrics */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px", marginBottom: "8px" }}>
            {[
              { label: "ATH DISTANCE", value: formatObservedFixed(sig.technicals.distanceFromAth, 1, "%") },
              { label: "VOLATILITY 24H", value: formatObservedFixed(sig.technicals.volatility24h, 2, "%") },
              ...(sig.technicals.priceChange30d !== null ? [{ label: "30D CHANGE", value: `${sig.technicals.priceChange30d > 0 ? "+" : ""}${sig.technicals.priceChange30d.toFixed(2)}%` }] : []),
              { label: "TIMEFRAME", value: sig.timeframe },
            ].map(({ label, value }) => (
              <div key={label}>
                <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "7px", color: "rgba(100,116,139,0.5)", letterSpacing: "0.1em" }}>{label}</div>
                <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "10px", color: "#94A3B8" }}>{value}</div>
              </div>
            ))}
          </div>

          {/* ── ASSET INFO PANEL ─────────────────────────────── */}
          <div
            onClick={e => { e.stopPropagation(); setInfoOpen(o => !o); }}
            style={{
              marginBottom: '8px',
              padding: '5px 7px',
              background: infoOpen ? 'rgba(0,212,255,0.04)' : 'rgba(255,255,255,0.02)',
              border: `1px solid ${infoOpen ? 'rgba(0,212,255,0.15)' : 'rgba(255,255,255,0.06)'}`,
              borderRadius: '3px',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '8px', letterSpacing: '0.15em', color: infoOpen ? '#00D4FF' : 'rgba(100,116,139,0.65)' }}>
                ℹ ASSET INFO
              </span>
              <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '7px', color: 'rgba(100,116,139,0.4)' }}>
                {infoOpen ? '▲' : '▼'}
              </span>
            </div>
            {infoOpen && (
              <div style={{ marginTop: '7px' }}>
                {infoLoading ? (
                  <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '8px', color: 'rgba(100,116,139,0.4)', letterSpacing: '0.08em' }}>LOADING...</div>
                ) : (
                  <>
                    {/* Sector + Category badges */}
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginBottom: '6px' }}>
                      {(coinInfo?.sector || classifyCategory(sig)) && (
                        <span style={{
                          fontFamily: "'IBM Plex Mono', monospace",
                          fontSize: '7px', letterSpacing: '0.1em',
                          color: '#00D4FF', background: 'rgba(0,212,255,0.08)',
                          padding: '2px 5px', borderRadius: '2px',
                          border: '1px solid rgba(0,212,255,0.2)',
                        }}>{coinInfo?.sector || classifyCategory(sig)}</span>
                      )}
                      {(coinInfo?.categories ?? []).slice(0, 3).map((cat: string) => (
                        <span key={cat} style={{
                          fontFamily: "'IBM Plex Mono', monospace",
                          fontSize: '7px', letterSpacing: '0.08em',
                          color: '#94A3B8', background: 'rgba(148,163,184,0.06)',
                          padding: '2px 5px', borderRadius: '2px',
                          border: '1px solid rgba(148,163,184,0.12)',
                        }}>{cat}</span>
                      ))}
                    </div>
                    {/* Description */}
                    {coinInfo?.description ? (
                      <div style={{
                        fontFamily: "'IBM Plex Mono', monospace",
                        fontSize: '8px', color: 'rgba(100,116,139,0.75)',
                        lineHeight: 1.6,
                        borderTop: '1px solid rgba(255,255,255,0.04)',
                        paddingTop: '5px',
                      }}>
                        {coinInfo.description.slice(0, 380)}{coinInfo.description.length > 380 ? '…' : ''}
                      </div>
                    ) : (
                      <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '8px', color: 'rgba(100,116,139,0.35)', letterSpacing: '0.08em' }}>
                        {sig.name} · {classifyCategory(sig)}
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </div>

          {/* Sizing Calculator — pre-seeded from signal price levels */}
          <div style={{ marginBottom: '8px' }}>
            <SizingCalculator
              ticker={sig.symbol}
              assetType="CRYPTO"
              defaultFill={sig.priceLevels.entryZone}
              defaultLower={sig.priceLevels.stopLoss}
              defaultUpper={sig.priceLevels.targetPrice}
              defaultExpanded={false}
            />
          </div>

          {/* Open Signal Outlook Center */}
          <Link
            href={`/app/signal-outlook?symbol=${sig.symbol}&type=crypto`}
            onClick={e => e.stopPropagation()}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '8px 12px',
              marginBottom: '8px',
              borderRadius: '4px',
              background: 'rgba(0,212,255,0.04)',
              border: '1px solid rgba(0,212,255,0.12)',
              textDecoration: 'none',
              cursor: 'pointer',
              transition: 'background 0.15s ease, border-color 0.15s ease',
            }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLAnchorElement).style.background = 'rgba(0,212,255,0.09)';
              (e.currentTarget as HTMLAnchorElement).style.borderColor = 'rgba(0,212,255,0.28)';
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLAnchorElement).style.background = 'rgba(0,212,255,0.04)';
              (e.currentTarget as HTMLAnchorElement).style.borderColor = 'rgba(0,212,255,0.12)';
            }}
          >
            <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '10px', color: '#00D4FF', letterSpacing: '0.1em' }}>
              🔭 SIGNAL OUTLOOK — {sig.symbol}
            </span>
            <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '12px', color: '#00D4FF' }}>→</span>
          </Link>

          {/* Data source */}
          <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "7px", color: "rgba(55,65,81,0.6)", letterSpacing: "0.08em" }}>
            SOURCE: COINGECKO · SIGNALS: FAULTLINE ENGINE
          </div>
        </div>
      )}
    </div>
  );
}

// ── Skeleton Card ─────────────────────────────────────────────

function SkeletonCard() {
  return (
    <div style={{ background: "rgba(8,10,14,0.9)", border: "1px solid rgba(255,255,255,0.04)", borderRadius: "4px", padding: "12px", height: "180px" }}>
      {[80, 60, 100, 40].map((w, i) => (
        <div key={i} style={{ height: "10px", width: `${w}%`, background: "rgba(255,255,255,0.04)", borderRadius: "2px", marginBottom: "8px", animation: "fl-pulse 1.5s ease-in-out infinite" }} />
      ))}
    </div>
  );
}

// ── Top Signal Card ───────────────────────────────────────────

function TopSignalCard({ label, sig, color, icon }: { label: string; sig: CryptoSignalResult; color: string; icon: string }) {
  const positive = (sig.technicals.priceChange7d ?? 0) >= 0;
  return (
    <div style={{ background: "rgba(8,10,14,0.9)", border: `1px solid ${color}25`, borderRadius: "4px", padding: "12px", flex: "1 1 140px", minWidth: "130px" }}>
      <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "8px", letterSpacing: "0.12em", color: "rgba(100,116,139,0.6)", marginBottom: "6px", textTransform: "uppercase" }}>{icon} {label}</div>
      <div style={{ fontFamily: "'Rajdhani', sans-serif", fontWeight: 700, fontSize: "18px", color: "#F0F4FF", letterSpacing: "0.05em", marginBottom: "2px" }}>{sig.symbol}</div>
      <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "9px", color: "rgba(100,116,139,0.7)", marginBottom: "4px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{sig.name}</div>
      {sig.technicals.priceChange7d !== null && (
        <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "12px", fontWeight: 700, color: positive ? "#00D4FF" : "#FF2D55" }}>
          {positive ? "+" : ""}{sig.technicals.priceChange7d.toFixed(2)}% 7D
        </div>
      )}
    </div>
  );
}

// ── Summary Bar ───────────────────────────────────────────────

function SignalsSummaryBar({ signals }: { signals: CryptoSignalResult[] }) {
  const counts = useMemo(() => {
    const c = { positive: 0, negative: 0, mixed: 0, unestablished: 0 };
    for (const s of signals) c[observedDirection(signalClass(s))] += 1;
    return c;
  }, [signals]);

  const total = signals.length;
  if (total === 0) return null;

  const strongPositive = signals.filter(s => observedDirection(signalClass(s)) === "positive" && s.strength === "Strong").length;
  const strongNegative = signals.filter(s => observedDirection(signalClass(s)) === "negative" && s.strength === "Strong").length;

  const sentiment = counts.positive > counts.negative + counts.mixed
    ? { label: "MORE POSITIVE THAN MIXED", color: "#00D4FF" }
    : counts.negative > counts.positive + counts.mixed
    ? { label: "MORE NEGATIVE THAN MIXED", color: "#FF2D55" }
    : { label: "MIXED OBSERVATIONS", color: "#FFD700" };

  return (
    <div style={{ margin: "12px 16px 0", padding: "12px 14px", background: "rgba(8,10,14,0.95)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: "4px", position: "relative", overflow: "hidden" }}>
      {/* Corner brackets */}
      {[["top","left"],["top","right"],["bottom","left"],["bottom","right"]].map(([v,h]) => (
        <div key={`${v}${h}`} style={{ position: "absolute", [v]: "4px", [h]: "4px", width: "8px", height: "8px", [`border${v.charAt(0).toUpperCase()+v.slice(1)}`]: "1px solid rgba(0,212,255,0.3)", [`border${h.charAt(0).toUpperCase()+h.slice(1)}`]: "1px solid rgba(0,212,255,0.3)" }} />
      ))}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "9px", letterSpacing: "0.2em", color: "rgba(100,116,139,0.5)" }}>CRYPTO SIGNALS</span>
          <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "9px", fontWeight: 700, color: sentiment.color, letterSpacing: "0.1em" }}>{sentiment.label}</span>
        </div>
        <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "8px", color: "rgba(100,116,139,0.4)" }}>CONFIDENCE: <span style={{ color: "#94A3B8" }}>{CONFIDENCE_NOT_ESTABLISHED}</span></span>
      </div>
      <div style={{ display: "flex", gap: "8px", marginBottom: "10px", flexWrap: "wrap" }}>
        {MOMENTUM_FILTERS.filter(filter => filter.id !== "All").map(filter => {
          const direction = observedDirection(filter.id);
          const col = ACTION_COLORS[direction] ?? ACTION_COLORS.unestablished;
          const count = counts[direction];
          const strong = direction === "positive" ? strongPositive : direction === "negative" ? strongNegative : 0;
          return (
            <div key={filter.id} style={{ display: "flex", alignItems: "center", gap: "6px", padding: "5px 10px", background: count > 0 ? `${col.text}10` : "rgba(255,255,255,0.02)", border: `1px solid ${count > 0 ? col.border : "rgba(255,255,255,0.05)"}`, borderRadius: "3px" }}>
              <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "9px", fontWeight: 700, color: count > 0 ? col.text : "rgba(100,116,139,0.3)", letterSpacing: "0.1em" }}>{filter.label}</span>
              <span style={{ fontFamily: "'Rajdhani', sans-serif", fontSize: "18px", fontWeight: 700, color: count > 0 ? col.text : "rgba(100,116,139,0.2)", lineHeight: 1 }}>{count}</span>
              {strong > 0 && <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "7px", color: col.text, background: `${col.text}15`, padding: "1px 4px", borderRadius: "2px" }}>{strong} STRONG</span>}
            </div>
          );
        })}
      </div>
      <div style={{ height: "4px", display: "flex", borderRadius: "2px", overflow: "hidden", gap: "1px" }}>
        {MOMENTUM_FILTERS.filter(filter => filter.id !== "All").map(filter => {
          const direction = observedDirection(filter.id);
          const pct = total > 0 ? (counts[direction] / total) * 100 : 0;
          if (pct === 0) return null;
          return <div key={filter.id} style={{ height: "100%", width: `${pct}%`, background: (ACTION_COLORS[direction] ?? ACTION_COLORS.unestablished).text, opacity: 0.8, transition: "width 0.6s cubic-bezier(0.23,1,0.32,1)" }} />;
        })}
      </div>
    </div>
  );
}

// ── Quick Search ──────────────────────────────────────────────

function CryptoQuickSearch() {
  const [query, setQuery] = useState("");
  const [submitted, setSubmitted] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const { data, isLoading, error } = trpc.crypto.getSignal.useQuery(
    { idOrSymbol: submitted },
    { enabled: submitted.length > 0, retry: 1, refetchInterval: 90_000, staleTime: 60_000 }
  );

  const handleSearch = useCallback(() => {
    const q = query.trim().toUpperCase();
    if (q.length > 0) setSubmitted(q);
  }, [query]);

  return (
    <div style={{ background: "rgba(8,10,14,0.9)", border: "1px solid rgba(0,212,255,0.12)", borderRadius: "4px", padding: "14px" }}>
      <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "8px", letterSpacing: "0.2em", color: "rgba(100,116,139,0.5)", marginBottom: "8px" }}>
        CRYPTO SIGNAL LOOKUP
      </div>
      <div style={{ display: "flex", gap: "8px", marginBottom: "10px" }}>
        <input
          ref={inputRef}
          value={query}
          onChange={e => setQuery(e.target.value.toUpperCase())}
          onKeyDown={e => e.key === "Enter" && handleSearch()}
          placeholder="BTC, ETH, SOL, RNDR..."
          style={{
            flex: 1,
            fontFamily: "'IBM Plex Mono', monospace",
            fontSize: "12px", letterSpacing: "0.08em",
            background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: "2px",
            color: "#F0F4FF",
            padding: "8px 12px",
            outline: "none",
          }}
        />
        <button
          onClick={handleSearch}
          disabled={isLoading}
          style={{
            fontFamily: "'IBM Plex Mono', monospace",
            fontSize: "9px", letterSpacing: "0.1em",
            padding: "8px 16px",
            background: isLoading ? "rgba(0,212,255,0.05)" : "rgba(0,212,255,0.12)",
            border: "1px solid rgba(0,212,255,0.3)",
            borderRadius: "2px",
            color: isLoading ? "rgba(0,212,255,0.4)" : "#00D4FF",
            cursor: isLoading ? "default" : "pointer",
          }}
        >
          {isLoading ? "SCANNING..." : "GET SIGNAL"}
        </button>
      </div>

      {/* Quick chips */}
      <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
        {["BTC","ETH","SOL","BNB","RNDR","SEI","HYPE","TAO"].map(sym => (
          <button
            key={sym}
            onClick={() => { setQuery(sym); setSubmitted(sym); }}
            style={{
              fontFamily: "'IBM Plex Mono', monospace",
              fontSize: "8px", letterSpacing: "0.08em",
              padding: "3px 8px",
              background: submitted === sym ? "rgba(0,212,255,0.12)" : "rgba(255,255,255,0.03)",
              border: `1px solid ${submitted === sym ? "rgba(0,212,255,0.3)" : "rgba(255,255,255,0.07)"}`,
              borderRadius: "2px",
              color: submitted === sym ? "#00D4FF" : "rgba(100,116,139,0.7)",
              cursor: "pointer",
            }}
          >{sym}</button>
        ))}
      </div>

      {/* UniversalTickerHeader — live price, change, volume, opportunity score */}
      {submitted && (
        <div style={{ marginTop: "10px" }}>
          <UniversalTickerHeader
            symbol={submitted}
            assetType="crypto"
          />
        </div>
      )}

      {/* Result */}
      {error && (
        <div style={{ marginTop: "10px", padding: "8px", background: "rgba(255,45,85,0.06)", border: "1px solid rgba(255,45,85,0.15)", borderRadius: "3px", fontFamily: "'IBM Plex Mono', monospace", fontSize: "9px", color: "rgba(255,45,85,0.8)" }}>
          ⚠ {error.message || "Asset not found — try a different symbol"}
        </div>
      )}
      {data && !isLoading && (
        <div style={{ marginTop: "12px" }}>
          <CryptoSignalCard sig={data} regimeScore={data.regimeAlignmentScore} />
        </div>
      )}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────

function CryptoSignalsInner() {
  useSEO(PAGE_SEO.cryptoSignals);
  const engine = useEngine();
  const { user } = useAuth();

  // Without MarketState the engine regime/score are the demo baseline: the canonical
  // regime and pressure are used instead, or the context reads "Unavailable".
  const degraded = engine?.marketMode === "deterministic-fallback";
  const canonicalPressure = engine?.canonicalState?.pressureIndex;
  const canonicalPressure100 = typeof canonicalPressure === "number" && Number.isFinite(canonicalPressure) ? canonicalPressure : null;
  const regimeSourceLabel = degraded ? (engine?.canonicalState?.regime ?? null) : (engine?.output?.regime?.label ?? "MODERATE RISK");
  const regimeKey = useMemo(() => (regimeSourceLabel ? mapRegimeToKey(regimeSourceLabel) : null), [regimeSourceLabel]);
  const regimeCtx = regimeKey ? REGIME_CRYPTO_CONTEXT[regimeKey] : UNAVAILABLE_CRYPTO_CONTEXT;
  const regimeColor = degraded
    ? canonicalRegimeDisplayColor(canonicalPressure100, engine?.canonicalState?.regime)
    : (engine?.output?.regime?.color ?? "#00D4FF");
  // REGIME SCORE on 0–100: the canonical Pressure Index when degraded, else the engine composite.
  const regimeScoreText = degraded
    ? (canonicalPressure100 === null ? score100Value(null) : String(Math.round(canonicalPressure100)))
    : score100Value(engine?.output?.overall?.score);

  const [activeCategory, setActiveCategory] = useState<CryptoCategory>("All");
  const [filterAction, setFilterAction] = useState<TradingAction | "All">("All");
  const [screenerLimit] = useState(30);

  // ── BTC market recovery (compact panel in regime banner) ──
  const { data: btcRecovery } = trpc.recovery.getMarketRecovery.useQuery(
    undefined,
    { staleTime: 90_000, refetchOnWindowFocus: false }
  );

  // ── Screener query ─────────────────────────────────────────
  const screenerQuery = trpc.crypto.getScreener.useQuery(
    { limit: screenerLimit },
    { refetchInterval: 90 * 1000, staleTime: 60 * 1000 }
  );

  const screenerData = screenerQuery.data as ScreenerResponse | undefined;

  // ── Filter and sort ────────────────────────────────────────
  // Launch fix-up: rows keep the screener's ordinal strengthRank order (the
  // confidence number itself is no longer sent).
  const displayedSignals = useMemo(() => {
    if (!screenerData?.signals) return [];
    return screenerData.signals
      .filter(sig => {
        if (activeCategory !== "All" && classifyCategory(sig) !== activeCategory) return false;
        if (filterAction !== "All" && observedDirection(signalClass(sig)) !== observedDirection(filterAction)) return false;
        return true;
      })
      .sort(byStrengthRank);
  }, [screenerData, activeCategory, filterAction]);

  // ── Top signals ────────────────────────────────────────────
  const topSignals = useMemo(() => {
    if (!screenerData?.signals || screenerData.signals.length === 0) return null;
    const sigs = screenerData.signals;
    const buys  = sigs.filter(s => observedDirection(signalClass(s)) === "positive").sort(byStrengthRank);
    const sells = sigs.filter(s => observedDirection(signalClass(s)) === "negative").sort(byStrengthRank);
    const momentum = rankMomentumSignals(sigs);
    const volatile = [...sigs].sort((a, b) => (b.technicals.volatility24h ?? -1) - (a.technicals.volatility24h ?? -1));
    return {
      topBullish: buys[0] ?? sigs[0],
      topBearish: sells[0] ?? sigs[sigs.length - 1],
      highestMomentum: momentum.leader,
      mostVolatile: volatile[0] ?? sigs[0],
    };
  }, [screenerData]);

  return (
    <div style={{ minHeight: "100vh", background: "#020305", padding: "0 0 120px 0", fontFamily: "'IBM Plex Mono', monospace" }}>

      {/* ── Regime Banner ────────────────────────────────── */}
      <div style={{
        background: "linear-gradient(135deg, rgba(8,10,14,0.98), rgba(12,16,22,0.95))",
        borderBottom: `1px solid ${regimeColor}20`,
        padding: "16px 16px 14px",
        position: "relative", overflow: "hidden",
      }}>
        <div style={{ position: "absolute", top: "-40px", right: "-40px", width: "200px", height: "200px", background: `radial-gradient(circle, ${regimeColor}08 0%, transparent 70%)`, pointerEvents: "none" }} />
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "12px" }}>
          <div style={{ flex: 1 }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
              <div style={{ width: "6px", height: "6px", borderRadius: "50%", background: regimeColor, boxShadow: `0 0 8px ${regimeColor}`, animation: "fl-pulse 5s ease-in-out infinite" }} />
              <span style={{ fontFamily: "'Rajdhani', sans-serif", fontWeight: 700, fontSize: "13px", color: regimeColor, letterSpacing: "0.1em", textTransform: "uppercase" }}>
                CRYPTO SIGNALS — {regimeCtx.headline}
              </span>
            </div>
            <p style={{ fontSize: "10px", color: "rgba(100,116,139,0.8)", lineHeight: 1.5, margin: 0, maxWidth: "500px" }}>{regimeCtx.description}</p>
          </div>
          <div style={{ textAlign: "right", flexShrink: 0, display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "6px" }}>
            {screenerData && (
              <ShareReportButton
                reportType="crypto_intelligence"
                subject={`Crypto Signals — ${screenerData.signals?.length ?? 0} assets · ${regimeCtx.headline}`}
                snapshotData={{
                  regime: regimeCtx.headline,
                  btcDominance: screenerData.btcDominance,
                  totalMarketCap: screenerData.totalMarketCap,
                  signals: screenerData.signals?.slice(0, 15).map((s: { symbol: string; action?: string; direction?: string; actionLabel?: string; cryptoRegime?: string; regimeConflict?: boolean }) => ({
                    symbol: s.symbol,
                    direction: signalClass(s),
                    actionLabel: s.actionLabel,
                    cryptoRegime: s.cryptoRegime,
                    regimeConflict: s.regimeConflict,
                    // QA r13 B14: no signal confidence in new share snapshots.
                  }))
                }}
                size="sm"
                variant="ghost"
              />
            )}
            <div>
              <div style={{ fontSize: "8px", color: "rgba(100,116,139,0.5)", marginBottom: "2px" }}>REGIME SCORE</div>
              <div style={{ fontFamily: "'Rajdhani', sans-serif", fontWeight: 700, fontSize: "22px", color: regimeColor }}>
                {regimeScoreText}<span style={{ fontSize: "12px", color: "rgba(100,116,139,0.5)" }}>/100</span>
              </div>
            </div>
          </div>
        </div>

        <div style={{ display: "flex", gap: "12px", marginTop: "10px", flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <span style={{ fontSize: "8px", color: "rgba(100,116,139,0.5)", letterSpacing: "0.1em" }}>READING:</span>
            <span style={{ fontSize: "9px", color: "#00D4FF" }}>{regimeCtx.description}</span>
          </div>
          {screenerData && (
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <span style={{ fontSize: "8px", color: "rgba(100,116,139,0.5)", letterSpacing: "0.1em" }}>BTC DOM:</span>
              <span style={{ fontSize: "9px", color: "#FFD700" }}><BtcDominanceReadout btcDominance={screenerData.btcDominance} /></span>
            </div>
          )}
          {screenerData && (
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <span style={{ fontSize: "8px", color: "rgba(100,116,139,0.5)", letterSpacing: "0.1em" }}>TOTAL MCAP:</span>
              <span style={{ fontSize: "9px", color: "#94A3B8" }}>{typeof screenerData.totalMarketCap === "number" ? fmtCap(screenerData.totalMarketCap) : "Unavailable"}</span>
              <span style={{ fontSize: "9px", color: typeof screenerData.marketCapChange24h === "number" && screenerData.marketCapChange24h < 0 ? "#FF2D55" : "#00D4FF" }}>
                {typeof screenerData.marketCapChange24h === "number"
                  ? `${screenerData.marketCapChange24h >= 0 ? "+" : ""}${formatObservedFixed(screenerData.marketCapChange24h, 2, "%")}`
                  : formatObservedFixed(screenerData.marketCapChange24h, 2, "%")}
              </span>
            </div>
          )}
        </div>

        {/* BTC Recovery Status compact row */}
        {btcRecovery && (
          <div style={{ marginTop: "10px", paddingTop: "8px", borderTop: "1px solid rgba(255,255,255,0.04)", display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
            <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "8px", color: "rgba(100,116,139,0.5)", letterSpacing: "0.1em" }}>BTC RECOVERY:</span>
            <RecoveryStatusBadge status={btcRecovery.status} color={btcRecovery.statusColor} confidence={btcRecovery.recoveryConfidence} />
            <AftershockRiskInline risk={btcRecovery.aftershockRisk} />
          </div>
        )}

        {/* Data freshness */}
        <div style={{ marginTop: "10px", paddingTop: "8px", borderTop: "1px solid rgba(255,255,255,0.04)", display: "flex", alignItems: "center", gap: "6px" }}>
          <div style={{ width: "6px", height: "6px", borderRadius: "50%", background: screenerQuery.isFetching ? "#FFD700" : "#00D4FF", boxShadow: `0 0 6px ${screenerQuery.isFetching ? "#FFD700" : "#00D4FF"}`, animation: "fl-pulse 5s ease-in-out infinite" }} />
          <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "8px", letterSpacing: "0.1em", color: "#00D4FF" }}>
            <CryptoScreenerFreshnessBadge
              refreshing={screenerQuery.isFetching}
              observedAtMs={screenerData?.marketObservedAtMs}
              sourceStatus={screenerData?.marketObservedAtMs != null ? "live" : "unavailable"}
            />
          </span>
          <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "8px", color: "rgba(100,116,139,0.4)" }}>
            {screenerData?.marketObservedAtMs != null ? `AS OF ${new Date(screenerData.marketObservedAtMs).toISOString()}` : "AS OF UNAVAILABLE"}
          </span>
          <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "8px", color: "rgba(100,116,139,0.4)" }}>· AUTO-REFRESH 90s</span>
        </div>
      </div>

      {/* ── Crypto Signal Lookup ──────────────────────── */}
      <div style={{ padding: "16px 16px 0" }}>
        <CryptoQuickSearch />
      </div>

      <div style={{ margin: "4px 16px 0", height: "1px", background: "rgba(255,255,255,0.04)" }} />

      {/* ── Today's Top Signals ───────────────────────── */}
      {topSignals && (
        <div style={{ padding: "16px 16px 0" }}>
          <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "9px", letterSpacing: "0.2em", color: "rgba(100,116,139,0.5)", textTransform: "uppercase", marginBottom: "10px" }}>
            TODAY'S TOP SIGNALS
          </div>
          <div style={{ display: "flex", gap: "8px", overflowX: "auto", paddingBottom: "4px" }}>
            <TopSignalCard label="Top Bullish" sig={topSignals.topBullish} color="#00D4FF" icon="▲" />
            <TopSignalCard label="Top Bearish" sig={topSignals.topBearish} color="#FF2D55" icon="▼" />
            {topSignals.highestMomentum
              ? <TopSignalCard label="Momentum" sig={topSignals.highestMomentum} color="#FFD700" icon="⚡" />
              : <MomentumLeaderReadout signal={null} />}
            <TopSignalCard label="Most Volatile" sig={topSignals.mostVolatile} color="#FF9500" icon="⚠" />
          </div>
        </div>
      )}

      {/* ── Summary Bar ───────────────────────────────── */}
      {screenerData && screenerData.signals.length > 0 && (
        <SignalsSummaryBar signals={screenerData.signals} />
      )}

      {/* ── Category Tabs ─────────────────────────────── */}
      <div style={{ padding: "16px 16px 0" }}>
        <div style={{ display: "flex", gap: "6px", overflowX: "auto", paddingBottom: "4px" }}>
          {CRYPTO_CATEGORIES.map(cat => {
            const isActive = activeCategory === cat;
            return (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                style={{
                  fontFamily: "'IBM Plex Mono', monospace",
                  fontSize: "9px", letterSpacing: "0.08em",
                  padding: "6px 12px",
                  borderRadius: "2px",
                  border: isActive ? `1px solid ${regimeColor}60` : "1px solid rgba(255,255,255,0.06)",
                  background: isActive ? `${regimeColor}15` : "rgba(255,255,255,0.02)",
                  color: isActive ? regimeColor : "rgba(100,116,139,0.7)",
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                  transition: "all 0.15s ease",
                  flexShrink: 0,
                }}
              >{cat.toUpperCase()}</button>
            );
          })}
        </div>
      </div>

      {/* ── Action Filter + Controls ───────────────────── */}
      <div style={{ padding: "12px 16px 0", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "8px" }}>
        <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
          <span style={{ fontSize: "8px", color: "rgba(100,116,139,0.5)", letterSpacing: "0.1em" }}>FILTER:</span>
          {MOMENTUM_FILTERS.map(filter => {
            const action = filter.id;
            const isActive = filterAction === action;
            const col = action !== "All" ? (ACTION_COLORS[observedDirection(action)] ?? ACTION_COLORS.unestablished) : null;
            return (
              <button
                key={action}
                onClick={() => setFilterAction(action)}
                style={{
                  fontFamily: "'IBM Plex Mono', monospace",
                  fontSize: "8px", letterSpacing: "0.08em",
                  padding: "4px 8px",
                  borderRadius: "2px",
                  border: isActive ? `1px solid ${col?.border ?? "rgba(0,212,255,0.3)"}` : "1px solid rgba(255,255,255,0.06)",
                  background: isActive ? (col?.bg ?? "rgba(0,212,255,0.1)") : "rgba(255,255,255,0.02)",
                  color: isActive ? (col?.text ?? "#00D4FF") : "rgba(100,116,139,0.6)",
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                }}
              >{filter.label}</button>
            );
          })}
        </div>
        <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
          <span style={{ fontSize: "8px", color: "rgba(100,116,139,0.5)", letterSpacing: "0.1em" }}>
            {screenerQuery.isLoading ? "LOADING..." : `${displayedSignals.length} SIGNALS`}
          </span>
          <button
            onClick={() => screenerQuery.refetch()}
            disabled={screenerQuery.isFetching}
            style={{
              fontFamily: "'IBM Plex Mono', monospace",
              fontSize: "8px", letterSpacing: "0.1em",
              padding: "4px 8px",
              border: "1px solid rgba(0,212,255,0.15)",
              borderRadius: "2px",
              background: "rgba(0,212,255,0.05)",
              color: screenerQuery.isFetching ? "rgba(100,116,139,0.3)" : "#00D4FF",
              cursor: screenerQuery.isFetching ? "default" : "pointer",
            }}
          >↻ REFRESH</button>
          <Link href="/app/crypto-search" style={{ textDecoration: "none" }}>
            <button style={{
              fontFamily: "'IBM Plex Mono', monospace",
              fontSize: "8px", letterSpacing: "0.1em",
              padding: "4px 8px",
              border: "1px solid rgba(0,212,255,0.15)",
              borderRadius: "2px",
              background: "rgba(0,212,255,0.05)",
              color: "#00D4FF",
              cursor: "pointer",
            }}>⬡ DEEP ANALYSIS</button>
          </Link>
        </div>
      </div>

      {/* ── Error Banner ──────────────────────────────── */}
      {screenerQuery.error && (
        <div style={{ margin: "10px 16px", padding: "10px 12px", background: "rgba(255,45,85,0.06)", border: "1px solid rgba(255,45,85,0.15)", borderRadius: "4px", fontSize: "9px", color: "rgba(255,45,85,0.8)", letterSpacing: "0.08em" }}>
          ⚠ MARKET DATA ERROR: {screenerQuery.error.message} — Retrying...
        </div>
      )}

      {/* ── Screener Grid ─────────────────────────────── */}
      <div style={{ padding: "12px 16px 0" }}>
        {screenerQuery.isLoading ? (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: "8px" }}>
            {Array.from({ length: 8 }).map((_, i) => <SkeletonCard key={i} />)}
          </div>
        ) : displayedSignals.length === 0 ? (
          <div style={{ textAlign: "center", padding: "48px 24px", color: "rgba(100,116,139,0.4)", fontSize: "11px", letterSpacing: "0.1em" }}>
            NO SIGNALS MATCH CURRENT FILTERS
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: "8px" }}>
            {displayedSignals.map(sig => (
              <CryptoSignalCard key={sig.symbol} sig={sig} regimeScore={sig.regimeAlignmentScore} />
            ))}
          </div>
        )}
      </div>

      {/* ── Data Source Panel ─────────────────────────── */}
      <div style={{ margin: "24px 16px 0", padding: "12px", background: "rgba(0,212,255,0.03)", border: "1px solid rgba(0,212,255,0.08)", borderRadius: "4px" }}>
        <div style={{ fontSize: "8px", letterSpacing: "0.12em", color: "rgba(100,116,139,0.5)", lineHeight: 1.6 }}>
          <CryptoScreenerFreshnessBadge observedAtMs={screenerData?.marketObservedAtMs} sourceStatus={screenerData?.marketObservedAtMs != null ? "live" : "unavailable"} /> — CoinGecko market data via secure backend proxy.
          {screenerData && <> Assets: <span style={{ color: "rgba(100,116,139,0.7)" }}>{screenerData.signals.length}</span> · BTC Dominance: <span style={{ color: "rgba(100,116,139,0.7)" }}><BtcDominanceReadout btcDominance={screenerData.btcDominance} /></span></>}
          {" "}· <span style={{ color: "#00D4FF" }}>TRADING SIGNALS</span> — FAULTLINE Engine · RSI, SMA, MACD, regime pressure. Refreshes every 90 seconds.
        </div>
      </div>

      {/* ── Disclaimer ────────────────────────────────── */}
      <div style={{ margin: "16px 16px 0", fontSize: "8px", letterSpacing: "0.08em", color: "rgba(55,65,81,0.5)", textAlign: "center", lineHeight: 1.5 }}>
        Probabilistic macro-regime intelligence. Not financial advice. Crypto signals are algorithmic estimates only — not investment recommendations. Digital assets are highly volatile. Past performance does not guarantee future results.
      </div>
    </div>
  );
}

// ── Premium Gate Wrapper ──────────────────────────────────────
export default function CryptoSignals() {
  return (
    <PremiumGateFull variant="crypto">
      <CryptoSignalsInner />
    </PremiumGateFull>
  );
}
