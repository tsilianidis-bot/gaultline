// ============================================================
// CryptoSignals.tsx
// Crypto trading signals page — mirrors the stock Signals page
// layout exactly: regime banner → crypto search → top signals
// row → summary bar → category tabs → filter panel → screener grid
// ============================================================

import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { useEngine } from "@/contexts/EngineContext";
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

type TradingAction = "BUY" | "SELL" | "HOLD" | "WATCH";

interface CryptoSignalResult {
  symbol: string;
  name: string;
  coinId: string;
  assetClass?: "CRYPTO";
  action: TradingAction;
  actionLabel?: string;        // precision label e.g. "Accumulation Zone"
  cryptoRegime?: "Bullish" | "Neutral" | "Defensive" | "Risk-Off";
  regimeConflict?: boolean;
  regimeConflictExplanation?: string | null;
  confidence: number;
  strength: "Strong" | "Moderate" | "Weak";
  timeframe: "Short-Term" | "Swing" | "Watch";
  rationale: string;
  technicals: {
    rsiEstimate: number;
    rsiLabel: "Overbought" | "Neutral" | "Oversold";
    rsiIsTrue: boolean;
    trend: "Uptrend" | "Downtrend" | "Sideways";
    volumeSignal: "Surge" | "Normal" | "Low";
    momentumScore: number;
    smaSignal: "Golden Cross" | "Death Cross" | "Neutral";
    smaIsTrue: boolean;
    macd: { macdLine: number; signalLine: number; histogram: number; signal: "Bullish" | "Bearish" | "Neutral" } | null;
    volatility24h: number;
    distanceFromAth: number;
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
    btcDominanceEffect: "Headwind" | "Neutral" | "Tailwind";
    volatilityRegime: "High" | "Normal" | "Low";
    athProximity: "Near ATH" | "Mid-Range" | "Deep Discount";
    liquidityScore: number;
  };
  computedAt: number;
}

interface ScreenerResponse {
  signals: CryptoSignalResult[];
  regime: { label: string; score: number };
  btcDominance: number;
  totalMarketCap: number;
  marketCapChange24h: number;
  computedAt: number;
}

// ── Constants ─────────────────────────────────────────────────

const ACTION_COLORS: Record<TradingAction, { text: string; bg: string; border: string }> = {
  BUY:   { text: "#00D4FF", bg: "rgba(0,212,255,0.12)",   border: "rgba(0,212,255,0.35)" },
  SELL:  { text: "#FF2D55", bg: "rgba(255,45,85,0.12)",   border: "rgba(255,45,85,0.35)" },
  HOLD:  { text: "#FFD700", bg: "rgba(255,215,0,0.10)",   border: "rgba(255,215,0,0.30)" },
  WATCH: { text: "#94A3B8", bg: "rgba(148,163,184,0.08)", border: "rgba(148,163,184,0.20)" },
};

const TREND_COLORS: Record<string, string> = {
  Uptrend:   "#00D4FF",
  Downtrend: "#FF2D55",
  Sideways:  "#FFD700",
};

const REGIME_CRYPTO_CONTEXT: Record<string, { headline: string; description: string; bullish: string; bearish: string }> = {
  "LOW RISK":      { headline: "RISK-ON CONDITIONS", description: "Liquidity expanding, volatility compressed. Conditions favour momentum and altcoin exposure.", bullish: "BTC, ETH, high-beta alts, DeFi", bearish: "Stablecoins, cash" },
  "MODERATE RISK": { headline: "MIXED CONDITIONS", description: "Macro pressure moderate. BTC dominance and liquidity signals are key. Selective exposure warranted.", bullish: "BTC, large-cap alts", bearish: "High-risk micro-caps, leverage" },
  "HIGH RISK":     { headline: "RISK-OFF CONDITIONS", description: "Elevated systemic pressure. Liquidity tightening. Favour capital preservation and BTC over alts.", bullish: "Stablecoins, BTC relative to alts", bearish: "Altcoins, DeFi, high-beta names" },
  "CRITICAL RISK": { headline: "DELEVERAGING RISK", description: "Systemic stress elevated. Crypto historically correlates with risk-off equity moves. Extreme caution.", bullish: "Cash, stablecoins", bearish: "All crypto, especially alts" },
};

const CRYPTO_CATEGORIES = ["All", "Large Cap", "Mid Cap", "DeFi", "Layer-1", "Layer-2", "AI/Data", "Gaming/NFT", "Meme"] as const;
type CryptoCategory = typeof CRYPTO_CATEGORIES[number];

// ── Helpers ───────────────────────────────────────────────────

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

function ActionBadge({ action, strength, actionLabel }: { action: TradingAction; strength: string; actionLabel?: string }) {
  const c = ACTION_COLORS[action];
  const CRYPTO_LABELS: Record<TradingAction, string> = { BUY: 'Accumulation Zone', SELL: 'Avoid New Entry', HOLD: 'Hold', WATCH: 'Watch' };
  const displayLabel = actionLabel ?? CRYPTO_LABELS[action];
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
      {action === 'BUY' && '▲ '}
      {action === 'SELL' && '▼ '}
      {action === 'HOLD' && '◆ '}
      {action === 'WATCH' && '◎ '}
      {displayLabel}
      {strength === "Strong" && (
        <span style={{ fontSize: "7px", color: c.text, opacity: 0.8 }}>★</span>
      )}
    </div>
  );
}

// ── RSI Bar ───────────────────────────────────────────────────

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
  const c = ACTION_COLORS[sig.action];
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
            <ActionBadge action={sig.action} strength={sig.strength} actionLabel={sig.actionLabel} />
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

      {/* RSI bar */}
      <div style={{ marginBottom: "8px" }}>
        <RSIBar value={sig.technicals.rsiEstimate} label={sig.technicals.rsiLabel} />
      </div>

      {/* Key metrics row */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "4px", marginBottom: "8px" }}>
        {[
          { label: "TREND", value: sig.technicals.trend.toUpperCase(), color: TREND_COLORS[sig.technicals.trend] },
          { label: "MOMENTUM", value: `${sig.technicals.momentumScore}`, color: sig.technicals.momentumScore >= 60 ? "#00D4FF" : sig.technicals.momentumScore <= 40 ? "#FF2D55" : "#FFD700" },
          { label: "CONFIDENCE", value: `${sig.confidence}%`, color: sig.confidence >= 70 ? "#00D4FF" : sig.confidence >= 50 ? "#FFD700" : "#94A3B8" },
        ].map(({ label, value, color }) => (
          <div key={label} style={{ background: "rgba(255,255,255,0.02)", borderRadius: "2px", padding: "4px 6px" }}>
            <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "6px", color: "rgba(100,116,139,0.5)", letterSpacing: "0.1em", marginBottom: "2px" }}>{label}</div>
            <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "9px", fontWeight: 700, color }}>{value}</div>
          </div>
        ))}
      </div>

      {/* Regime alignment */}
      <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "6px" }}>
        <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "7px", color: "rgba(100,116,139,0.5)", letterSpacing: "0.08em" }}>REGIME:</span>
        <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "7px", fontWeight: 700, color: regimeAlignColor }}>{sig.regimeAlignment.toUpperCase()}</span>
        <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "7px", color: "rgba(100,116,139,0.4)" }}>({sig.regimeAlignmentScore}/10)</span>
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
                { label: "ENTRY", value: `$${fmt(sig.priceLevels.entryZone)}`, color: c.text, sub: sig.action === "BUY" ? "BUY ZONE" : sig.action === "SELL" ? "SHORT ZONE" : "LEVEL" },
                { label: "STOP LOSS", value: `$${fmt(sig.priceLevels.stopLoss)}`, color: "#FF2D55", sub: "ATR ×1.5" },
                { label: "TARGET", value: `$${fmt(sig.priceLevels.targetPrice)}`, color: "#00D4FF", sub: "2:1 R:R" },
                { label: "RISK/REWARD", value: `${sig.priceLevels.riskReward}:1`, color: sig.priceLevels.riskReward >= 2 ? "#22C55E" : sig.priceLevels.riskReward >= 1.5 ? "#FFD700" : "#FF9500", sub: `ATR $${fmt(sig.priceLevels.atr)}` },
              ].map(({ label, value, color, sub }) => (
                <div key={label} style={{ textAlign: "center", background: "rgba(255,255,255,0.02)", borderRadius: "2px", padding: "5px 4px", borderTop: `2px solid ${color}30` }}>
                  <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "6px", color: "rgba(100,116,139,0.5)", letterSpacing: "0.08em", marginBottom: "2px" }}>{label}</div>
                  <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "10px", fontWeight: 700, color }}>{value}</div>
                  <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "6px", color: "rgba(100,116,139,0.4)", marginTop: "1px" }}>{sub}</div>
                </div>
              ))}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "4px" }}>
              {[
                { label: "SUPPORT", value: sig.priceLevels.support, color: "#22C55E" },
                { label: "RESISTANCE", value: sig.priceLevels.resistance, color: "#FF9500" },
              ].map(({ label, value, color }) => (
                <div key={label} style={{ textAlign: "center", background: "rgba(255,255,255,0.02)", borderRadius: "2px", padding: "4px" }}>
                  <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "6px", color: "rgba(100,116,139,0.5)", letterSpacing: "0.08em", marginBottom: "2px" }}>{label}</div>
                  <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "9px", fontWeight: 700, color }}>${fmt(value)}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Technical indicators */}
          <div style={{ marginBottom: "10px", display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "4px" }}>
            {[
              { label: sig.technicals.rsiIsTrue ? "RSI(14)" : "RSI~", value: `${sig.technicals.rsiEstimate.toFixed(0)} ${sig.technicals.rsiLabel.toUpperCase()}`, color: sig.technicals.rsiLabel === "Overbought" ? "#FF2D55" : sig.technicals.rsiLabel === "Oversold" ? "#00D4FF" : "#94A3B8", badge: sig.technicals.rsiIsTrue ? "TRUE" : undefined },
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
                { label: "LIQUIDITY SCORE", value: `${sig.cryptoFactors.liquidityScore.toFixed(1)}/10`, color: sig.cryptoFactors.liquidityScore >= 7 ? "#00D4FF" : sig.cryptoFactors.liquidityScore >= 4 ? "#FFD700" : "#FF2D55" },
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
              { label: "ATH DISTANCE", value: `${sig.technicals.distanceFromAth.toFixed(1)}%` },
              { label: "VOLATILITY 24H", value: `${sig.technicals.volatility24h.toFixed(2)}%` },
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
              defaultEntry={sig.priceLevels.entryZone}
              defaultStop={sig.priceLevels.stopLoss}
              defaultTarget={sig.priceLevels.targetPrice}
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
    const c = { BUY: 0, SELL: 0, HOLD: 0, WATCH: 0 };
    for (const s of signals) c[s.action]++;
    return c;
  }, [signals]);

  const total = signals.length;
  if (total === 0) return null;

  const strongBuys  = signals.filter(s => s.action === "BUY"  && s.strength === "Strong").length;
  const strongSells = signals.filter(s => s.action === "SELL" && s.strength === "Strong").length;
  const avgConf = Math.round(signals.reduce((s, v) => s + v.confidence, 0) / signals.length);

  const sentiment = counts.BUY > counts.SELL + counts.HOLD
    ? { label: "BULLISH BIAS", color: "#00D4FF" }
    : counts.SELL > counts.BUY + counts.HOLD
    ? { label: "BEARISH BIAS", color: "#FF2D55" }
    : { label: "MIXED / NEUTRAL", color: "#FFD700" };

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
        <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "8px", color: "rgba(100,116,139,0.4)" }}>AVG CONFIDENCE: <span style={{ color: "#94A3B8" }}>{avgConf}%</span></span>
      </div>
      <div style={{ display: "flex", gap: "8px", marginBottom: "10px", flexWrap: "wrap" }}>
        {(["BUY","SELL","HOLD","WATCH"] as TradingAction[]).map(action => {
          const col = ACTION_COLORS[action];
          const count = counts[action];
          const strong = action === "BUY" ? strongBuys : action === "SELL" ? strongSells : 0;
          return (
            <div key={action} style={{ display: "flex", alignItems: "center", gap: "6px", padding: "5px 10px", background: count > 0 ? `${col.text}10` : "rgba(255,255,255,0.02)", border: `1px solid ${count > 0 ? col.border : "rgba(255,255,255,0.05)"}`, borderRadius: "3px" }}>
              <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "9px", fontWeight: 700, color: count > 0 ? col.text : "rgba(100,116,139,0.3)", letterSpacing: "0.1em" }}>{action}</span>
              <span style={{ fontFamily: "'Rajdhani', sans-serif", fontSize: "18px", fontWeight: 700, color: count > 0 ? col.text : "rgba(100,116,139,0.2)", lineHeight: 1 }}>{count}</span>
              {strong > 0 && <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "7px", color: col.text, background: `${col.text}15`, padding: "1px 4px", borderRadius: "2px" }}>{strong} STRONG</span>}
            </div>
          );
        })}
      </div>
      <div style={{ height: "4px", display: "flex", borderRadius: "2px", overflow: "hidden", gap: "1px" }}>
        {(["BUY","SELL","HOLD","WATCH"] as TradingAction[]).map(action => {
          const pct = total > 0 ? (counts[action] / total) * 100 : 0;
          if (pct === 0) return null;
          return <div key={action} style={{ height: "100%", width: `${pct}%`, background: ACTION_COLORS[action].text, opacity: 0.8, transition: "width 0.6s cubic-bezier(0.23,1,0.32,1)" }} />;
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

  const regimeKey = useMemo(() => mapRegimeToKey(engine?.output?.regime?.label ?? "MODERATE RISK"), [engine?.output?.regime?.label]);
  const regimeCtx = REGIME_CRYPTO_CONTEXT[regimeKey];
  const regimeColor = engine?.output?.regime?.color ?? "#00D4FF";

  const [activeCategory, setActiveCategory] = useState<CryptoCategory>("All");
  const [filterAction, setFilterAction] = useState<TradingAction | "All">("All");
  const [screenerLimit] = useState(30);
  const [lastRefresh, setLastRefresh] = useState<string | null>(null);

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

  useEffect(() => {
    if (screenerData) setLastRefresh(new Date(screenerData.computedAt).toLocaleTimeString());
  }, [screenerData]);

  // ── Filter and sort ────────────────────────────────────────
  const displayedSignals = useMemo(() => {
    if (!screenerData?.signals) return [];
    return screenerData.signals
      .filter(sig => {
        if (activeCategory !== "All" && classifyCategory(sig) !== activeCategory) return false;
        if (filterAction !== "All" && sig.action !== filterAction) return false;
        return true;
      })
      .sort((a, b) => b.confidence - a.confidence);
  }, [screenerData, activeCategory, filterAction]);

  // ── Top signals ────────────────────────────────────────────
  const topSignals = useMemo(() => {
    if (!screenerData?.signals || screenerData.signals.length === 0) return null;
    const sigs = screenerData.signals;
    const buys  = sigs.filter(s => s.action === "BUY").sort((a, b) => b.confidence - a.confidence);
    const sells = sigs.filter(s => s.action === "SELL").sort((a, b) => b.confidence - a.confidence);
    const momentum = [...sigs].sort((a, b) => b.technicals.momentumScore - a.technicals.momentumScore);
    const volatile = [...sigs].sort((a, b) => b.technicals.volatility24h - a.technicals.volatility24h);
    return {
      topBullish: buys[0] ?? sigs[0],
      topBearish: sells[0] ?? sigs[sigs.length - 1],
      highestMomentum: momentum[0] ?? sigs[0],
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
              <div style={{ width: "6px", height: "6px", borderRadius: "50%", background: regimeColor, boxShadow: `0 0 8px ${regimeColor}`, animation: "fl-pulse 2s ease-in-out infinite" }} />
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
                  signals: screenerData.signals?.slice(0, 15).map((s: { symbol: string; action: string; actionLabel?: string; cryptoRegime?: string; regimeConflict?: boolean; confidence?: number }) => ({
                    symbol: s.symbol,
                    action: s.action,
                    actionLabel: s.actionLabel,
                    cryptoRegime: s.cryptoRegime,
                    regimeConflict: s.regimeConflict,
                    confidence: s.confidence,
                  }))
                }}
                size="sm"
                variant="ghost"
              />
            )}
            <div>
              <div style={{ fontSize: "8px", color: "rgba(100,116,139,0.5)", marginBottom: "2px" }}>REGIME SCORE</div>
              <div style={{ fontFamily: "'Rajdhani', sans-serif", fontWeight: 700, fontSize: "22px", color: regimeColor }}>
                {engine?.output?.overall?.score?.toFixed(1) ?? "—"}<span style={{ fontSize: "12px", color: "rgba(100,116,139,0.5)" }}>/10</span>
              </div>
            </div>
          </div>
        </div>

        <div style={{ display: "flex", gap: "12px", marginTop: "10px", flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <span style={{ fontSize: "8px", color: "rgba(100,116,139,0.5)", letterSpacing: "0.1em" }}>FAVORS:</span>
            <span style={{ fontSize: "9px", color: "#00D4FF" }}>{regimeCtx.bullish}</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <span style={{ fontSize: "8px", color: "rgba(100,116,139,0.5)", letterSpacing: "0.1em" }}>AVOIDS:</span>
            <span style={{ fontSize: "9px", color: "#FF2D55" }}>{regimeCtx.bearish}</span>
          </div>
          {screenerData && (
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <span style={{ fontSize: "8px", color: "rgba(100,116,139,0.5)", letterSpacing: "0.1em" }}>BTC DOM:</span>
              <span style={{ fontSize: "9px", color: "#FFD700" }}>{screenerData.btcDominance.toFixed(1)}%</span>
            </div>
          )}
          {screenerData && (
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <span style={{ fontSize: "8px", color: "rgba(100,116,139,0.5)", letterSpacing: "0.1em" }}>TOTAL MCAP:</span>
              <span style={{ fontSize: "9px", color: "#94A3B8" }}>{fmtCap(screenerData.totalMarketCap)}</span>
              <span style={{ fontSize: "9px", color: screenerData.marketCapChange24h >= 0 ? "#00D4FF" : "#FF2D55" }}>
                {screenerData.marketCapChange24h >= 0 ? "+" : ""}{screenerData.marketCapChange24h.toFixed(2)}%
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
          <div style={{ width: "6px", height: "6px", borderRadius: "50%", background: screenerQuery.isFetching ? "#FFD700" : "#00D4FF", boxShadow: `0 0 6px ${screenerQuery.isFetching ? "#FFD700" : "#00D4FF"}`, animation: "fl-pulse 2s ease-in-out infinite" }} />
          <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "8px", letterSpacing: "0.1em", color: screenerQuery.isFetching ? "#FFD700" : "#00D4FF" }}>
            {screenerQuery.isFetching ? "REFRESHING..." : "COINGECKO LIVE"}
          </span>
          {lastRefresh && (
            <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "8px", color: "rgba(100,116,139,0.4)" }}>UPDATED: {lastRefresh}</span>
          )}
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
            <TopSignalCard label="Momentum" sig={topSignals.highestMomentum} color="#FFD700" icon="⚡" />
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
          {(["All","BUY","SELL","HOLD","WATCH"] as const).map(action => {
            const isActive = filterAction === action;
            const col = action !== "All" ? ACTION_COLORS[action] : null;
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
              >{action}</button>
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
          <Link href="/crypto-search" style={{ textDecoration: "none" }}>
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
          <span style={{ color: "#00D4FF" }}>LIVE DATA</span> — CoinGecko market data via secure backend proxy.
          {screenerData && <> Assets: <span style={{ color: "rgba(100,116,139,0.7)" }}>{screenerData.signals.length}</span> · BTC Dominance: <span style={{ color: "rgba(100,116,139,0.7)" }}>{screenerData.btcDominance.toFixed(1)}%</span></>}
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
