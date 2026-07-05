/* ============================================================
   FAULTLINE — Day Trade Intelligence™
   Bloomberg/Trade Ideas style intraday trading terminal
   7 tabs: Overview · Scanner · Stocks · Crypto · Symbol · Active · Watchlist
   ============================================================ */
import React, { useState, useCallback, useRef, useEffect, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { useSearch } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import NarrativeLoader from "@/components/NarrativeLoader";
import {
  Target, RefreshCw, Search, Plus, Trash2, AlertTriangle,
  TrendingUp, TrendingDown, Minus, ChevronDown, ChevronUp,
  Activity, Zap, BarChart2, Shield, Clock, Bookmark,
  CheckCircle, XCircle, AlertCircle, Info, Layers,
  Star, Bell, BookOpen, Wifi, WifiOff,
} from "lucide-react";
import { toast } from "sonner";
import DataFreshnessBadge from "@/components/DataFreshnessBadge";
import FaultlineTerm from "@/components/FaultlineTerm";
import { useEngine } from "@/contexts/EngineContext";
import { PremiumGateFull } from "@/components/PremiumGate";

// ── DataSourceBanner: shown when data is from snapshot or fallback ────────────
function DataSourceBanner({ source, snapshotAge }: { source: 'live' | 'snapshot' | 'fallback'; snapshotAge: number | null }) {
  if (source === 'live') return null;
  const isSnapshot = source === 'snapshot';
  const ageLabel = snapshotAge != null
    ? snapshotAge < 60_000 ? 'less than 1 min ago'
    : snapshotAge < 3_600_000 ? `${Math.round(snapshotAge / 60_000)} min ago`
    : `${Math.round(snapshotAge / 3_600_000)}h ago`
    : null;
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: '10px',
      padding: '8px 14px', marginBottom: '12px',
      background: isSnapshot ? 'rgba(255,215,0,0.06)' : 'rgba(255,107,107,0.06)',
      border: `1px solid ${isSnapshot ? 'rgba(255,215,0,0.25)' : 'rgba(255,107,107,0.25)'}`,
      borderRadius: '4px',
    }}>
      {isSnapshot ? <Clock size={12} style={{ color: '#FFD700', flexShrink: 0 }} /> : <WifiOff size={12} style={{ color: '#FF6B6B', flexShrink: 0 }} />}
      <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '10px', color: isSnapshot ? '#FFD700' : '#FF6B6B', letterSpacing: '0.06em' }}>
        {isSnapshot
          ? `SNAPSHOT DATA${ageLabel ? ` · captured ${ageLabel}` : ''} · live pipeline temporarily unavailable · auto-recovering`
          : 'INSTITUTIONAL FALLBACK MODE · live + snapshot data unavailable · guidance below is static · auto-recovering'}
      </span>
      <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '5px' }}>
        <div style={{ width: '5px', height: '5px', borderRadius: '50%', background: isSnapshot ? '#FFD700' : '#FF6B6B' }} />
        <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '9px', color: '#6B7280' }}>AUTO-RECOVERING</span>
      </div>
    </div>
  );
}

// ── Types (mirrors server dayTradeEngine.ts) ─────────────────
type DayTradeSetup = {
  symbol: string;
  name: string;
  assetType: "stock" | "crypto";
  currentPrice: number;
  changePercent: number;
  volume: number;
  relativeVolume: number | null;
  marketCap: number | null;
  capBucket: string;
  setupType: string;
  direction: "bullish" | "bearish";
  entryZoneLow: number;
  entryZoneHigh: number;
  target1: number;
  target2: number;
  stopLoss: number;
  invalidationLevel: number;
  expectedHoldMinutes: number;
  confidence: number;
  probabilityRating: number;
  riskRewardRatio: number;
  riskLevel: "Low" | "Medium" | "High" | "Very High";
  liquidityRating: "Low" | "Medium" | "High";
  executionScore: number;
  executionGrade: "A" | "B" | "C" | "D" | "F";
  catalyst: string;
  whyToday: string;
  reasonForRecommendation: string;
  regimeImpact: string;
  sectorStrength: string | null;
  generatedAt: number;
  // Extended fields from DayTradeReport (symbol search)
  intradayTrend?: string;
  marketContext?: string;
  vwapStatus?: string;
  momentumRating?: number;
  supportLevel?: number;
  resistanceLevel?: number;
  whyTradeExists?: string;
  whatCancelsThisTrade?: string;
  confidenceReasoning?: string;
  catalystSummary?: string;
  noTradeReason?: string;
  executionScoreBreakdown?: {
    macroCondition: number;
    technicalStructure: number;
    liquidityScore: number;
    volatilityScore: number;
    momentumScore: number;
    riskRewardScore: number;
  };
  bullCase?: string;
  bearCase?: string;
  primaryCatalyst?: string;
  largestRisk?: string;
  mostLikelyPath?: string;
  alternativePath?: string;
  recommendedTimeframe?: string;
  bestStrategy?: string;
};

type NoTradeResult = {
  symbol: string;
  name?: string;
  assetType: "stock" | "crypto";
  setupType: "NO_TRADE";
  direction: "no_trade";
  noTradeReason: string;
  generatedAt: number;
};

type AnySetup = DayTradeSetup | NoTradeResult;

type MarketFavorability = {
  overallScore: number;
  bullishOpportunities: number;
  bearishOpportunities: number;
  highConfidenceSetups: number;
  regime: string;
  regimePressure: number;
  volatilityLevel: string;
  marketBreadth: string;
  sectorLeadership: string;
  topMovers: Array<{ symbol: string; name: string; changePercent: number; assetType: string }>;
  topRelativeVolume: Array<{ symbol: string; name: string; relVol: number; assetType: string }>;
  aiSummary: string;
  generatedAt: number;
};

// ── Helpers ───────────────────────────────────────────────────
const fmt = (n: number, dec = 2) =>
  n >= 1000 ? `$${n.toLocaleString("en-US", { maximumFractionDigits: dec })}` : `$${n.toFixed(dec)}`;

const pct = (n: number) => `${n >= 0 ? "+" : ""}${n.toFixed(2)}%`;

const confColor = (c: number) =>
  c >= 75 ? "#00FF88" : c >= 55 ? "#FFD700" : "#FF6B6B";

const riskColor = (r: string) =>
  r === "Low" ? "#00FF88" : r === "Medium" ? "#FFD700" : "#FF6B6B";
const dirColor = (d: string) =>
  d === "bullish" ? "#00FF88" : d === "bearish" ? "#FF6B6B" : "#6B7280";
const isNoTrade = (s: AnySetup): s is NoTradeResult =>
  s.setupType === "NO_TRADE";
const fmtHold = (mins: number) =>
  mins < 60 ? `${mins} min` : `${(mins / 60).toFixed(1)}h`;
const DirIcon = ({ d }: { d: string }) =>
  d === "bullish" ? <TrendingUp size={12} style={{ color: "#00FF88" }} /> :
  d === "bearish" ? <TrendingDown size={12} style={{ color: "#FF6B6B" }} /> :
  <Minus size={12} style={{ color: "#6B7280" }} />;

// ── Shared styles ─────────────────────────────────────────────
const CARD: React.CSSProperties = {
  background: "rgba(10,12,16,0.95)",
  border: "1px solid rgba(0,212,255,0.12)",
  borderRadius: "6px",
  padding: "16px",
};

const LABEL: React.CSSProperties = {
  fontFamily: "'IBM Plex Mono', monospace",
  fontSize: "10px",
  color: "#6B7280",
  letterSpacing: "0.12em",
  textTransform: "uppercase" as const,
  marginBottom: "4px",
};

const VALUE: React.CSSProperties = {
  fontFamily: "'IBM Plex Mono', monospace",
  fontSize: "14px",
  color: "#F0F4FF",
  fontWeight: 600,
};

const MONO_SM: React.CSSProperties = {
  fontFamily: "'IBM Plex Mono', monospace",
  fontSize: "11px",
};

const DISCLAIMER = (
  <div style={{
    background: "rgba(255,170,0,0.06)",
    border: "1px solid rgba(255,170,0,0.2)",
    borderRadius: "4px",
    padding: "8px 12px",
    display: "flex",
    alignItems: "flex-start",
    gap: "8px",
    marginBottom: "16px",
  }}>
    <AlertTriangle size={12} style={{ color: "#FFAA00", marginTop: "2px", flexShrink: 0 }} />
    <span style={{ ...MONO_SM, color: "#FFAA00", lineHeight: 1.5 }}>
      Day Trade Intelligence™ is designed only for same-day trading. Typical holding period: 30 min – 3 hours.
      No overnight positions are recommended. If entry does not trigger today, the setup expires.
    </span>
  </div>
);

// ── Setup Card ────────────────────────────────────────────────
function SetupCard({ s, onSearch }: { s: AnySetup; onSearch?: (sym: string, type: "stock" | "crypto") => void }) {
  const [expanded, setExpanded] = useState(false);
  const noTrade = isNoTrade(s);
  const ds = noTrade ? null : (s as DayTradeSetup);

  return (
    <div style={{
      ...CARD,
      borderColor: noTrade ? "rgba(107,114,128,0.3)" : s.direction === "bullish" ? "rgba(0,255,136,0.2)" : "rgba(255,107,107,0.2)",
      cursor: "pointer",
      transition: "border-color 0.15s",
    }}>
      {/* Header row */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "10px" }}
           onClick={() => setExpanded(e => !e)}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
            <DirIcon d={s.direction} />
            <span style={{ fontFamily: "'Rajdhani', sans-serif", fontWeight: 700, fontSize: "16px", color: dirColor(s.direction) }}>
              {s.symbol}
            </span>
          </div>
          <span style={{ ...MONO_SM, color: "#6B7280", maxWidth: "120px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {s.name}
          </span>
          <span style={{
            ...MONO_SM, fontSize: "9px",
            background: s.assetType === "crypto" ? "rgba(153,102,255,0.15)" : "rgba(0,212,255,0.1)",
            color: s.assetType === "crypto" ? "#9966FF" : "#00D4FF",
            border: `1px solid ${s.assetType === "crypto" ? "rgba(153,102,255,0.3)" : "rgba(0,212,255,0.2)"}`,
            borderRadius: "3px", padding: "1px 5px", letterSpacing: "0.08em",
          }}>
            {s.assetType.toUpperCase()}
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          {ds && (
            <div style={{ textAlign: "right" }}>
              <div style={{ ...MONO_SM, color: "#F0F4FF", fontWeight: 600 }}>{fmt(ds.currentPrice)}</div>
              <div style={{ ...MONO_SM, fontSize: "10px", color: ds.changePercent >= 0 ? "#00FF88" : "#FF6B6B" }}>
                {pct(ds.changePercent)}
              </div>
            </div>
          )}
          {ds && (
            <div style={{ textAlign: "center" }}>
              <div style={{ ...MONO_SM, fontSize: "10px", color: "#6B7280" }}>CONF</div>
              <div style={{ ...MONO_SM, fontWeight: 700, color: confColor(ds.confidence) }}>{ds.confidence}</div>
            </div>
          )}
          {ds && (
            <div style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: "28px",
              height: "28px",
              borderRadius: "4px",
              background: ds.executionGrade === "A" ? "rgba(0,255,136,0.15)" : ds.executionGrade === "B" ? "rgba(0,212,255,0.12)" : ds.executionGrade === "C" ? "rgba(255,215,0,0.12)" : ds.executionGrade === "D" ? "rgba(255,149,0,0.12)" : "rgba(255,107,107,0.12)",
              border: `1px solid ${ds.executionGrade === "A" ? "rgba(0,255,136,0.4)" : ds.executionGrade === "B" ? "rgba(0,212,255,0.35)" : ds.executionGrade === "C" ? "rgba(255,215,0,0.35)" : ds.executionGrade === "D" ? "rgba(255,149,0,0.35)" : "rgba(255,107,107,0.35)"}`,
            }}>
              <span style={{
                fontFamily: "'Rajdhani', sans-serif",
                fontWeight: 800,
                fontSize: "14px",
                color: ds.executionGrade === "A" ? "#00FF88" : ds.executionGrade === "B" ? "#00D4FF" : ds.executionGrade === "C" ? "#FFD700" : ds.executionGrade === "D" ? "#FF9500" : "#FF6B6B",
              }}>{ds.executionGrade}</span>
            </div>
          )}
          {expanded ? <ChevronUp size={14} style={{ color: "#6B7280" }} /> : <ChevronDown size={14} style={{ color: "#6B7280" }} />}
        </div>
      </div>

      {/* Setup type + key metrics row */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginBottom: expanded ? "12px" : "0" }}>
        <span style={{
          ...MONO_SM, fontSize: "10px",
          background: noTrade ? "rgba(107,114,128,0.1)" : s.direction === "bullish" ? "rgba(0,255,136,0.1)" : "rgba(255,107,107,0.1)",
          color: noTrade ? "#6B7280" : s.direction === "bullish" ? "#00FF88" : "#FF6B6B",
          border: `1px solid ${noTrade ? "rgba(107,114,128,0.2)" : s.direction === "bullish" ? "rgba(0,255,136,0.2)" : "rgba(255,107,107,0.2)"}`,
          borderRadius: "3px", padding: "2px 8px",
        }}>
          {s.setupType}
        </span>
        {ds && (
          <>
            <span style={{ ...MONO_SM, fontSize: "10px", color: "#94A3B8" }}>R/R: <strong style={{ color: "#F0F4FF" }}>{ds.riskRewardRatio.toFixed(1)}:1</strong></span>
            <span style={{ ...MONO_SM, fontSize: "10px", color: "#94A3B8" }}>Hold: <strong style={{ color: "#F0F4FF" }}>{fmtHold(ds.expectedHoldMinutes)}</strong></span>
            <span style={{ ...MONO_SM, fontSize: "10px", color: "#94A3B8" }}>Risk: <strong style={{ color: riskColor(ds.riskLevel) }}>{ds.riskLevel}</strong></span>
            <span style={{ ...MONO_SM, fontSize: "10px", color: "#94A3B8" }}>Prob: <strong style={{ color: confColor(ds.probabilityRating) }}>{ds.probabilityRating}%</strong></span>
          </>
        )}
      </div>

      {/* Expanded detail */}
      {expanded && (
        <div style={{ borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: "12px" }}>
                    {noTrade ? (
            <div style={{ ...MONO_SM, color: "#FF6B6B", lineHeight: 1.6 }}>
              <strong style={{ color: "#FF6B6B" }}>NO TRADE</strong> — {(s as NoTradeResult).noTradeReason ?? "No valid intraday setup detected for this symbol."}
            </div>
          ) : ds ? (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: "12px" }}>
              <div>
                <div style={LABEL}>Entry Zone</div>
                <div style={VALUE}>{fmt(ds.entryZoneLow)} – {fmt(ds.entryZoneHigh)}</div>
              </div>
              <div>
                <div style={LABEL}>Target 1</div>
                <div style={{ ...VALUE, color: "#00FF88" }}>{fmt(ds.target1)}</div>
              </div>
              <div>
                <div style={LABEL}>Target 2</div>
                <div style={{ ...VALUE, color: "#00D4FF" }}>{fmt(ds.target2)}</div>
              </div>
              <div>
                <div style={LABEL}>Stop Loss</div>
                <div style={{ ...VALUE, color: "#FF6B6B" }}>{fmt(ds.stopLoss)}</div>
              </div>
              <div>
                <div style={LABEL}>Invalidation</div>
                <div style={{ ...VALUE, color: "#FF9500" }}>{fmt(ds.invalidationLevel)}</div>
              </div>
              <div>
                <div style={LABEL}>Rel. Volume</div>
                <div style={VALUE}>{ds.relativeVolume != null ? `${ds.relativeVolume.toFixed(1)}x` : "N/A"}</div>
              </div>
            </div>
          ) : null}
          {ds && ds.executionScore > 0 && (
            <div style={{ marginTop: "12px", padding: "10px 12px", background: "rgba(0,0,0,0.3)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: "4px" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "8px" }}>
                <div style={{ ...LABEL, marginBottom: 0 }}><FaultlineTerm id="execution-score">Execution Score</FaultlineTerm></div>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <div style={{
                    fontFamily: "'Rajdhani', sans-serif", fontWeight: 800, fontSize: "18px",
                    color: ds.executionGrade === "A" ? "#00FF88" : ds.executionGrade === "B" ? "#00D4FF" : ds.executionGrade === "C" ? "#FFD700" : ds.executionGrade === "D" ? "#FF9500" : "#FF6B6B",
                  }}>{ds.executionGrade}</div>
                  <div style={{ ...MONO_SM, color: "#94A3B8" }}>{ds.executionScore}/100</div>
                </div>
              </div>
              {ds.executionScoreBreakdown && (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "6px" }}>
                  {([
                    ["Macro", ds.executionScoreBreakdown.macroCondition, 20],
                    ["Technical", ds.executionScoreBreakdown.technicalStructure, 20],
                    ["Liquidity", ds.executionScoreBreakdown.liquidityScore, 15],
                    ["Volatility", ds.executionScoreBreakdown.volatilityScore, 15],
                    ["Momentum", ds.executionScoreBreakdown.momentumScore, 15],
                    ["R/R", ds.executionScoreBreakdown.riskRewardScore, 15],
                  ] as [string, number, number][]).map(([label, val, max]) => (
                    <div key={label} style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                      <div style={{ display: "flex", justifyContent: "space-between" }}>
                        <span style={{ ...MONO_SM, fontSize: "9px", color: "#6B7280" }}>{label}</span>
                        <span style={{ ...MONO_SM, fontSize: "9px", color: "#94A3B8" }}>{val}/{max}</span>
                      </div>
                      <div style={{ height: "3px", background: "rgba(255,255,255,0.08)", borderRadius: "2px", overflow: "hidden" }}>
                        <div style={{ height: "100%", width: `${(val / max) * 100}%`, background: val / max >= 0.7 ? "#00FF88" : val / max >= 0.4 ? "#FFD700" : "#FF6B6B", borderRadius: "2px", transition: "width 0.3s" }} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
          {ds && (
            <div style={{ marginTop: "12px", display: "flex", flexDirection: "column", gap: "8px" }}>
              {(ds.catalystSummary ?? ds.catalyst) && (
                <div>
                  <div style={LABEL}>Catalyst</div>
                  <div style={{ ...MONO_SM, color: "#94A3B8", lineHeight: 1.5 }}>{ds.catalystSummary ?? ds.catalyst}</div>
                </div>
              )}
              <div>
                <div style={LABEL}>Why This Trade</div>
                <div style={{ ...MONO_SM, color: "#94A3B8", lineHeight: 1.5 }}>{ds.whyTradeExists ?? ds.reasonForRecommendation}</div>
              </div>
              {ds.whatCancelsThisTrade && (
                <div>
                  <div style={LABEL}>What Cancels It</div>
                  <div style={{ ...MONO_SM, color: "#FF9500", lineHeight: 1.5 }}>{ds.whatCancelsThisTrade}</div>
                </div>
              )}
              <div>
                <div style={LABEL}>Regime Impact</div>
                <div style={{ ...MONO_SM, color: "#94A3B8", lineHeight: 1.5 }}>{ds.regimeImpact}</div>
              </div>
              {ds.confidenceReasoning && (
                <div>
                  <div style={LABEL}>Confidence Reasoning</div>
                  <div style={{ ...MONO_SM, color: "#94A3B8", lineHeight: 1.5 }}>{ds.confidenceReasoning}</div>
                </div>
              )}
            </div>
          )}

          {onSearch && (
            <button
              onClick={() => onSearch(s.symbol, s.assetType)}
              style={{
                marginTop: "12px",
                padding: "6px 14px",
                background: "rgba(0,212,255,0.08)",
                border: "1px solid rgba(0,212,255,0.25)",
                borderRadius: "4px",
                color: "#00D4FF",
                ...MONO_SM,
                cursor: "pointer",
                letterSpacing: "0.08em",
              }}
            >
              Full Report →
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ── Overview Tab ──────────────────────────────────────────────
function OverviewTab() {
  const { data: fav, isLoading, error, refetch, isFetching } = trpc.dayTrade.getFavorability.useQuery(undefined, {
    staleTime: 5 * 60 * 1000,
    refetchInterval: 10 * 60 * 1000,
  });

  const scoreColor = (s: number) => s >= 70 ? "#00FF88" : s >= 45 ? "#FFD700" : "#FF6B6B";

  if (isLoading) return <LoadingState label="Loading market favorability..." />;
  if (error) return <ErrorState message={error.message} onRetry={() => refetch()} />;
  if (!fav) return <ErrorState message="Market data unavailable." onRetry={() => refetch()} />;

  const f = fav as unknown as MarketFavorability;
  const favLabel = f.overallScore >= 70 ? "FAVORABLE" : f.overallScore >= 45 ? "NEUTRAL" : "UNFAVORABLE";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      {DISCLAIMER}

      {/* Score hero */}
      <div style={{ ...CARD, background: "rgba(0,212,255,0.04)", borderColor: "rgba(0,212,255,0.2)", textAlign: "center", padding: "28px" }}>
        <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "11px", color: "#6B7280", letterSpacing: "0.15em", marginBottom: "8px" }}>
          TODAY'S DAY TRADE FAVORABILITY
        </div>
        <div style={{ fontFamily: "'Rajdhani', sans-serif", fontSize: "72px", fontWeight: 700, color: scoreColor(f.overallScore), lineHeight: 1, marginBottom: "4px" }}>
          {f.overallScore}
        </div>
        <div style={{ fontFamily: "'Rajdhani', sans-serif", fontSize: "20px", color: scoreColor(f.overallScore), letterSpacing: "0.1em", marginBottom: "16px" }}>
          {favLabel}
        </div>
        <div style={{ ...MONO_SM, color: "#94A3B8", lineHeight: 1.6, maxWidth: "640px", margin: "0 auto" }}>
          {f.aiSummary}
        </div>
        <button
          onClick={() => refetch()}
          disabled={isFetching}
          style={{
            marginTop: "16px",
            padding: "6px 16px",
            background: "rgba(0,212,255,0.08)",
            border: "1px solid rgba(0,212,255,0.25)",
            borderRadius: "4px",
            color: "#00D4FF",
            ...MONO_SM,
            cursor: "pointer",
            display: "inline-flex",
            alignItems: "center",
            gap: "6px",
          }}
        >
          <RefreshCw size={11} style={{ animation: isFetching ? "spin 1s linear infinite" : "none" }} />
          Refresh
        </button>
      </div>

      {/* Metrics grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: "12px" }}>
        {[
          { label: "Market Regime", value: f.regime, color: "#00D4FF" },
          { label: "Regime Pressure", value: `${f.regimePressure}/100`, color: f.regimePressure > 65 ? "#FF6B6B" : "#FFD700" },
          { label: "Volatility", value: f.volatilityLevel, color: "#F0F4FF" },
          { label: "Market Breadth", value: f.marketBreadth, color: "#F0F4FF" },
          { label: "Bullish Setups", value: String(f.bullishOpportunities), color: "#00FF88" },
          { label: "Bearish Setups", value: String(f.bearishOpportunities), color: "#FF6B6B" },
          { label: "High-Confidence", value: String(f.highConfidenceSetups), color: "#FFD700" },
        ].map(m => (
          <div key={m.label} style={CARD}>
            <div style={LABEL}>{m.label}</div>
            <div style={{ ...VALUE, color: m.color }}>{m.value}</div>
          </div>
        ))}
      </div>

      {/* Top movers */}
      {f.topMovers.length > 0 && (
        <div style={CARD}>
          <div style={{ ...LABEL, marginBottom: "12px" }}>Top Movers Today</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
            {f.topMovers.map(m => (
              <div key={m.symbol} style={{
                padding: "6px 12px",
                background: m.changePercent >= 0 ? "rgba(0,255,136,0.08)" : "rgba(255,107,107,0.08)",
                border: `1px solid ${m.changePercent >= 0 ? "rgba(0,255,136,0.2)" : "rgba(255,107,107,0.2)"}`,
                borderRadius: "4px",
              }}>
                <span style={{ ...MONO_SM, fontWeight: 700, color: "#F0F4FF" }}>{m.symbol} </span>
                <span style={{ ...MONO_SM, color: m.changePercent >= 0 ? "#00FF88" : "#FF6B6B" }}>
                  {pct(m.changePercent)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "10px", flexWrap: "wrap" }}>
        <DataFreshnessBadge source="Market Favorability" generatedAt={f.generatedAt} isRefreshing={isFetching} thresholds={[5, 15, 60]} />
        <span style={{ ...MONO_SM, fontSize: "10px", color: "#374151" }}>Refreshes every 10 min</span>
      </div>
    </div>
  );
}

// ── Scanner Tab ───────────────────────────────────────────────
function ScannerTab({ onSearch }: { onSearch: (sym: string, type: "stock" | "crypto") => void }) {
  const [filters, setFilters] = useState({
    assetType: "both" as "stock" | "crypto" | "both",
    capBucket: "mixed" as "low" | "mid" | "large" | "mixed",
    direction: "both" as "bullish" | "bearish" | "both",
    riskProfile: "balanced" as "aggressive" | "balanced" | "conservative",
    maxResults: 12,
  });

  const { data, isLoading, error, refetch, isFetching } = trpc.dayTrade.scan.useQuery(filters, {
    staleTime: 5 * 60 * 1000,
    refetchInterval: 10 * 60 * 1000,
  });

    const setups = ((data?.data ?? []) as unknown as AnySetup[]);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      {DISCLAIMER}
      {data && data.source !== 'live' && <DataSourceBanner source={data.source} snapshotAge={data.snapshotAge} />}
      {/* Filter bar */}
      <div style={{ ...CARD, display: "flex", flexWrap: "wrap", gap: "12px", alignItems: "center" }}>
        <FilterSelect
          label="Asset"
          value={filters.assetType}
          options={[["both", "Both"], ["stock", "Stocks"], ["crypto", "Crypto"]]}
          onChange={v => setFilters(f => ({ ...f, assetType: v as typeof filters.assetType }))}
        />
        <FilterSelect
          label="Cap"
          value={filters.capBucket}
          options={[["mixed", "Mixed"], ["large", "Large Cap"], ["mid", "Mid Cap"], ["low", "Low Cap"]]}
          onChange={v => setFilters(f => ({ ...f, capBucket: v as typeof filters.capBucket }))}
        />
        <FilterSelect
          label="Direction"
          value={filters.direction}
          options={[["both", "Both"], ["bullish", "Bullish"], ["bearish", "Bearish"]]}
          onChange={v => setFilters(f => ({ ...f, direction: v as typeof filters.direction }))}
        />
        <FilterSelect
          label="Risk"
          value={filters.riskProfile}
          options={[["balanced", "Balanced"], ["conservative", "Conservative"], ["aggressive", "Aggressive"]]}
          onChange={v => setFilters(f => ({ ...f, riskProfile: v as typeof filters.riskProfile }))}
        />
        <button
          onClick={() => refetch()}
          disabled={isFetching}
          style={{
            padding: "6px 14px",
            background: "rgba(0,212,255,0.08)",
            border: "1px solid rgba(0,212,255,0.25)",
            borderRadius: "4px",
            color: "#00D4FF",
            ...MONO_SM,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: "6px",
            marginLeft: "auto",
          }}
        >
          <RefreshCw size={11} style={{ animation: isFetching ? "spin 1s linear infinite" : "none" }} />
          {isFetching ? "Scanning..." : "Refresh Scan"}
        </button>
      </div>

      {/* Results */}
      {isLoading ? (
        <LoadingState label="Scanning market for intraday setups..." />
      ) : error ? (
        <ErrorState message={error.message} onRetry={() => refetch()} />
      ) : setups.length === 0 ? (
        <EmptyState
          icon={<Shield size={32} style={{ color: "#6B7280" }} />}
          title="No Setups Found"
          message="No high-quality intraday setups match your current filters. Adjust filters or check back when market conditions improve."
        />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          <div style={{ ...MONO_SM, color: "#6B7280" }}>
            {setups.length} setup{setups.length !== 1 ? "s" : ""} found · Auto-refreshes every 10 min
          </div>
          {setups.map(s => (
            <SetupCard key={s.symbol} s={s} onSearch={onSearch} />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Stock Screener Tab ────────────────────────────────────────
function StockScreenerTab({ onSearch }: { onSearch: (sym: string, type: "stock" | "crypto") => void }) {
  const [capBucket, setCapBucket] = useState<"low" | "mid" | "large" | "mixed">("mixed");
  const [direction, setDirection] = useState<"bullish" | "bearish" | "both">("both");

  const { data, isLoading, error, refetch, isFetching } = trpc.dayTrade.scan.useQuery({
    assetType: "stock",
    capBucket,
    direction,
    riskProfile: "balanced",
    maxResults: 15,
  }, {
    staleTime: 5 * 60 * 1000,
    refetchInterval: 10 * 60 * 1000,
  });

    const setups = ((data?.data ?? []) as unknown as AnySetup[]);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      {DISCLAIMER}
      {data && data.source !== 'live' && <DataSourceBanner source={data.source} snapshotAge={data.snapshotAge} />}
      <div style={{ ...CARD, display: "flex", flexWrap: "wrap", gap: "12px", alignItems: "center" }}>
        <div style={{ ...MONO_SM, color: "#00D4FF", fontWeight: 600, letterSpacing: "0.1em" }}>STOCK SCREENER</div>
        <FilterSelect
          label="Cap Size"
          value={capBucket}
          options={[["mixed", "Mixed"], ["large", "Large Cap"], ["mid", "Mid Cap"], ["low", "Low Cap"]]}
          onChange={v => setCapBucket(v as typeof capBucket)}
        />
        <FilterSelect
          label="Direction"
          value={direction}
          options={[["both", "Both"], ["bullish", "Bullish"], ["bearish", "Bearish"]]}
          onChange={v => setDirection(v as typeof direction)}
        />
        <button
          onClick={() => refetch()}
          disabled={isFetching}
          style={{
            padding: "6px 14px",
            background: "rgba(0,212,255,0.08)",
            border: "1px solid rgba(0,212,255,0.25)",
            borderRadius: "4px",
            color: "#00D4FF",
            ...MONO_SM,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: "6px",
            marginLeft: "auto",
          }}
        >
          <RefreshCw size={11} style={{ animation: isFetching ? "spin 1s linear infinite" : "none" }} />
          Refresh
        </button>
      </div>

      {/* Screener criteria legend */}
      <div style={{ ...CARD, background: "rgba(0,212,255,0.03)" }}>
        <div style={{ ...LABEL, marginBottom: "8px" }}>Screener Criteria</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
          {["Relative Volume", "Volume vs Avg", "Gap %", "VWAP", "Momentum", "Support/Resistance", "ATR", "Liquidity", "Sector Strength", "Market Regime"].map(c => (
            <span key={c} style={{
              ...MONO_SM, fontSize: "9px",
              background: "rgba(0,212,255,0.08)",
              color: "#00D4FF",
              border: "1px solid rgba(0,212,255,0.15)",
              borderRadius: "3px",
              padding: "2px 6px",
            }}>{c}</span>
          ))}
        </div>
      </div>

      {isLoading ? (
        <LoadingState label="Screening stocks for intraday setups..." />
      ) : error ? (
        <ErrorState message={error.message} onRetry={() => refetch()} />
      ) : setups.length === 0 ? (
        <EmptyState
          icon={<BarChart2 size={32} style={{ color: "#6B7280" }} />}
          title="No Stock Setups"
          message="No high-quality stock setups found. Market conditions may not support intraday trading right now."
        />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          <div style={{ ...MONO_SM, color: "#6B7280" }}>{setups.length} stock setup{setups.length !== 1 ? "s" : ""} · Stocks only</div>
          {setups.map(s => <SetupCard key={s.symbol} s={s} onSearch={onSearch} />)}
        </div>
      )}
    </div>
  );
}

// ── Cap-Size Dedicated Scanner Tab ──────────────────────────────────────────
// Dedicated scanner for Low / Mid / Large cap stocks with cap-specific criteria
const CAP_META: Record<"low" | "mid" | "large", { label: string; color: string; desc: string; criteria: string[] }> = {
  low:   { label: "Low Cap",   color: "#F59E0B", desc: "Micro & small-cap stocks with high asymmetric potential",  criteria: ["Rel. Volume >3x", "Gap >3%", "Float <50M", "Price >$1", "Momentum", "Catalyst"] },
  mid:   { label: "Mid Cap",   color: "#A855F7", desc: "Mid-cap stocks with institutional participation",          criteria: ["Rel. Volume >2x", "Gap >2%", "VWAP Position", "Sector Strength", "Momentum", "Regime Fit"] },
  large: { label: "Large Cap", color: "#00D4FF", desc: "Large-cap stocks with high liquidity and tight spreads",   criteria: ["Rel. Volume >1.5x", "Options Flow", "VWAP", "Support/Resistance", "Regime Fit", "Sector Leader"] },
};
function CapScannerTab({ cap, onSearch }: { cap: "low" | "mid" | "large"; onSearch: (sym: string, type: "stock" | "crypto") => void }) {
  const meta = CAP_META[cap];
  const [direction, setDirection] = useState<"bullish" | "bearish" | "both">("both");
  const { data, isLoading, error, refetch, isFetching } = trpc.dayTrade.scan.useQuery({
    assetType: "stock",
    capBucket: cap,
    direction,
    riskProfile: cap === "low" ? "aggressive" : cap === "mid" ? "balanced" : "conservative",
    maxResults: 15,
  }, { staleTime: 5 * 60 * 1000, refetchInterval: 10 * 60 * 1000 });
  const setups = ((data?.data ?? []) as unknown as AnySetup[]);
  const rgb = cap === "low" ? "245,158,11" : cap === "mid" ? "168,85,247" : "0,212,255";
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      {DISCLAIMER}
      {data && data.source !== 'live' && <DataSourceBanner source={data.source} snapshotAge={data.snapshotAge} />}
      <div style={{ ...CARD, display: "flex", flexWrap: "wrap", gap: "12px", alignItems: "center" }}>
        <div style={{ ...MONO_SM, color: meta.color, fontWeight: 600, letterSpacing: "0.1em" }}>{meta.label.toUpperCase()} SCANNER</div>
        <div style={{ ...MONO_SM, color: "#6B7280", fontSize: "9px", flex: 1 }}>{meta.desc}</div>
        <FilterSelect label="Direction" value={direction} options={[["both", "Both"], ["bullish", "Bullish"], ["bearish", "Bearish"]]} onChange={v => setDirection(v as typeof direction)} />
        <button onClick={() => refetch()} disabled={isFetching} style={{ padding: "6px 14px", background: `rgba(${rgb},0.08)`, border: `1px solid rgba(${rgb},0.25)`, borderRadius: "4px", color: meta.color, ...MONO_SM, cursor: "pointer", display: "flex", alignItems: "center", gap: "6px", marginLeft: "auto" }}>
          <RefreshCw size={11} style={{ animation: isFetching ? "spin 1s linear infinite" : "none" }} />Refresh
        </button>
      </div>
      <div style={{ ...CARD, background: `rgba(${rgb},0.03)` }}>
        <div style={{ ...LABEL, marginBottom: "8px" }}>{meta.label} Screening Criteria</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
          {meta.criteria.map(c => (<span key={c} style={{ ...MONO_SM, fontSize: "9px", background: `rgba(${rgb},0.08)`, color: meta.color, border: `1px solid rgba(${rgb},0.15)`, borderRadius: "3px", padding: "2px 6px" }}>{c}</span>))}
        </div>
      </div>
      {isLoading ? (
        <LoadingState label={`Scanning ${meta.label} stocks...`} />
      ) : error ? (
        <ErrorState message={error.message} onRetry={() => refetch()} />
      ) : setups.length === 0 ? (
        <EmptyState icon={<Layers size={32} style={{ color: "#6B7280" }} />} title={`No ${meta.label} Setups`} message={`No high-quality ${meta.label.toLowerCase()} setups found. Market conditions may not support intraday trading right now.`} />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          <div style={{ ...MONO_SM, color: "#6B7280" }}>{setups.length} {meta.label.toLowerCase()} setup{setups.length !== 1 ? "s" : ""}</div>
          {setups.map(s => <SetupCard key={s.symbol} s={s} onSearch={onSearch} />)}
        </div>
      )}
    </div>
  );
}

// ── Crypto Screener Tab ───────────────────────────────────────
function CryptoScreenerTab({ onSearch }: { onSearch: (sym: string, type: "stock" | "crypto") => void }) {
  const [direction, setDirection] = useState<"bullish" | "bearish" | "both">("both");

  const { data, isLoading, error, refetch, isFetching } = trpc.dayTrade.scan.useQuery({
    assetType: "crypto",
    capBucket: "mixed",
    direction,
    riskProfile: "balanced",
    maxResults: 15,
  }, {
    staleTime: 5 * 60 * 1000,
    refetchInterval: 10 * 60 * 1000,
  });

    const setups = ((data?.data ?? []) as unknown as AnySetup[]);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      {DISCLAIMER}
      {data && data.source !== 'live' && <DataSourceBanner source={data.source} snapshotAge={data.snapshotAge} />}
      <div style={{ ...CARD, display: "flex", flexWrap: "wrap", gap: "12px", alignItems: "center" }}>
        <div style={{ ...MONO_SM, color: "#9966FF", fontWeight: 600, letterSpacing: "0.1em" }}>CRYPTO SCREENER</div>
        <FilterSelect
          label="Direction"
          value={direction}
          options={[["both", "Both"], ["bullish", "Bullish"], ["bearish", "Bearish"]]}
          onChange={v => setDirection(v as typeof direction)}
        />
        <button
          onClick={() => refetch()}
          disabled={isFetching}
          style={{
            padding: "6px 14px",
            background: "rgba(153,102,255,0.08)",
            border: "1px solid rgba(153,102,255,0.25)",
            borderRadius: "4px",
            color: "#9966FF",
            ...MONO_SM,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: "6px",
            marginLeft: "auto",
          }}
        >
          <RefreshCw size={11} style={{ animation: isFetching ? "spin 1s linear infinite" : "none" }} />
          Refresh
        </button>
      </div>

      {/* Crypto screener criteria */}
      <div style={{ ...CARD, background: "rgba(153,102,255,0.03)", borderColor: "rgba(153,102,255,0.15)" }}>
        <div style={{ ...LABEL, marginBottom: "8px" }}>Crypto Criteria (Separate Logic)</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
          {["Trend", "Momentum", "Liquidity", "Volume", "Support/Resistance", "VWAP", "Relative Strength", "Catalyst", "Expected Hold Time", "Confidence"].map(c => (
            <span key={c} style={{
              ...MONO_SM, fontSize: "9px",
              background: "rgba(153,102,255,0.08)",
              color: "#9966FF",
              border: "1px solid rgba(153,102,255,0.2)",
              borderRadius: "3px",
              padding: "2px 6px",
            }}>{c}</span>
          ))}
        </div>
        <div style={{ ...MONO_SM, fontSize: "10px", color: "#6B7280", marginTop: "8px" }}>
          Supported: BTC · ETH · SOL · TAO · ONDO · LINK · RNDR · DOGE · BONK · and all searchable crypto
        </div>
      </div>

      {isLoading ? (
        <LoadingState label="Screening crypto for intraday setups..." />
      ) : error ? (
        <ErrorState message={error.message} onRetry={() => refetch()} />
      ) : setups.length === 0 ? (
        <EmptyState
          icon={<Activity size={32} style={{ color: "#6B7280" }} />}
          title="No Crypto Setups"
          message="No high-quality crypto setups found. Crypto markets may be consolidating or conditions are unfavorable for intraday trading."
        />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          <div style={{ ...MONO_SM, color: "#6B7280" }}>{setups.length} crypto setup{setups.length !== 1 ? "s" : ""} · Crypto only</div>
          {setups.map(s => <SetupCard key={s.symbol} s={s} onSearch={onSearch} />)}
        </div>
      )}
    </div>
  );
}

// ── Symbol Search Tab ─────────────────────────────────────────
function SymbolSearchTab() {
  const [query, setQuery] = useState("");
  const [submitted, setSubmitted] = useState<{ symbol: string; assetType: "stock" | "crypto" } | null>(null);
  const [assetType, setAssetType] = useState<"stock" | "crypto">("stock");
  const inputRef = useRef<HTMLInputElement>(null);

  const { data, isLoading, error, refetch } = trpc.dayTrade.symbolSetup.useQuery(
    { symbol: submitted?.symbol ?? "", assetType: submitted?.assetType ?? "stock", direction: "both" },
    { enabled: !!submitted, staleTime: 5 * 60 * 1000 }
  );

  const setup = data as DayTradeSetup | null | undefined;

  const handleSearch = useCallback(() => {
    const sym = query.trim().toUpperCase();
    if (!sym) return;
    setSubmitted({ symbol: sym, assetType });
  }, [query, assetType]);

  const QUICK_STOCKS = ["SPY", "NVDA", "PLTR", "TSLA", "AAPL", "META", "AMD"];
  const QUICK_CRYPTO = ["BTC", "ETH", "SOL", "TAO", "ONDO", "DOGE"];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      {DISCLAIMER}

      {/* Search input */}
      <div style={CARD}>
        <div style={{ display: "flex", gap: "8px", marginBottom: "12px" }}>
          <FilterSelect
            label="Type"
            value={assetType}
            options={[["stock", "Stock"], ["crypto", "Crypto"]]}
            onChange={v => setAssetType(v as "stock" | "crypto")}
          />
          <div style={{ flex: 1, display: "flex", gap: "8px" }}>
            <input
              ref={inputRef}
              value={query}
              onChange={e => setQuery(e.target.value.toUpperCase())}
              onKeyDown={e => e.key === "Enter" && handleSearch()}
              placeholder={assetType === "stock" ? "NVDA, SPY, PLTR..." : "BTC, ETH, SOL..."}
              style={{
                flex: 1,
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(0,212,255,0.2)",
                borderRadius: "4px",
                padding: "8px 12px",
                color: "#F0F4FF",
                fontFamily: "'IBM Plex Mono', monospace",
                fontSize: "13px",
                outline: "none",
              }}
            />
            <button
              onClick={handleSearch}
              style={{
                padding: "8px 20px",
                background: "rgba(0,212,255,0.12)",
                border: "1px solid rgba(0,212,255,0.35)",
                borderRadius: "4px",
                color: "#00D4FF",
                ...MONO_SM,
                cursor: "pointer",
                fontWeight: 600,
                display: "flex",
                alignItems: "center",
                gap: "6px",
              }}
            >
              <Search size={13} />
              Analyze
            </button>
          </div>
        </div>

        {/* Quick picks */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
          <span style={{ ...MONO_SM, fontSize: "10px", color: "#6B7280", marginRight: "4px" }}>Quick:</span>
          {(assetType === "stock" ? QUICK_STOCKS : QUICK_CRYPTO).map(sym => (
            <button
              key={sym}
              onClick={() => { setQuery(sym); setSubmitted({ symbol: sym, assetType }); }}
              style={{
                padding: "2px 8px",
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: "3px",
                color: "#94A3B8",
                ...MONO_SM,
                fontSize: "10px",
                cursor: "pointer",
              }}
            >
              {sym}
            </button>
          ))}
        </div>
      </div>

      {/* Results */}
      {!submitted ? (
        <EmptyState
          icon={<Search size={32} style={{ color: "#6B7280" }} />}
          title="Search Any Symbol"
          message="Enter a stock or crypto symbol to generate a complete Day Trade Intelligence Report with entry zones, targets, stops, and AI analysis."
        />
      ) : isLoading ? (
        <LoadingState label={`Generating Day Trade Intelligence Report for ${submitted.symbol}...`} />
      ) : error ? (
        <ErrorState message={error.message} onRetry={() => refetch()} />
      ) : !setup ? (
        <ErrorState message="Live market data unavailable. Unable to generate a reliable intraday setup." onRetry={() => refetch()} />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          <div style={{ ...MONO_SM, color: "#6B7280" }}>
            Day Trade Intelligence Report · {submitted.symbol} · Generated {new Date(setup.generatedAt).toLocaleTimeString()}
          </div>
          <SetupCard s={setup} />

          {/* Full detail panel for symbol search */}
          {!isNoTrade(setup as unknown as AnySetup) && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
              <div style={CARD}>
                <div style={{ ...LABEL, marginBottom: "8px" }}>Intraday Trend</div>
                <div style={{ ...VALUE, color: dirColor(setup.direction) }}>{setup.intradayTrend}</div>
                <div style={{ ...MONO_SM, color: "#94A3B8", marginTop: "6px", lineHeight: 1.5 }}>{setup.marketContext}</div>
              </div>
              <div style={CARD}>
                <div style={{ ...LABEL, marginBottom: "8px" }}>Sector Strength</div>
                <div style={{ ...MONO_SM, color: "#94A3B8", lineHeight: 1.5 }}>{setup.sectorStrength}</div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Active Setups Tab ─────────────────────────────────────────
function ActiveSetupsTab({ onSearch }: { onSearch: (sym: string, type: "stock" | "crypto") => void }) {
  const { data, isLoading, error, refetch, isFetching } = trpc.dayTrade.scan.useQuery({
    assetType: "both",
    capBucket: "mixed",
    direction: "both",
    riskProfile: "balanced",
    maxResults: 20,
  }, {
    staleTime: 5 * 60 * 1000,
    refetchInterval: 5 * 60 * 1000,
  });

    const setups = ((data?.data ?? []) as unknown as AnySetup[]).filter(s => !isNoTrade(s)) as DayTradeSetup[];
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      {DISCLAIMER}
      {data && data.source !== 'live' && <DataSourceBanner source={data.source} snapshotAge={data.snapshotAge} />}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <div style={{ fontFamily: "'Rajdhani', sans-serif", fontWeight: 700, fontSize: "18px", color: "#F0F4FF" }}>
            Active Setups
          </div>
          <div style={{ ...MONO_SM, color: "#6B7280" }}>All currently active intraday setups meeting FAULTLINE requirements</div>
        </div>
        <button
          onClick={() => refetch()}
          disabled={isFetching}
          style={{
            padding: "6px 14px",
            background: "rgba(0,212,255,0.08)",
            border: "1px solid rgba(0,212,255,0.25)",
            borderRadius: "4px",
            color: "#00D4FF",
            ...MONO_SM,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: "6px",
          }}
        >
          <RefreshCw size={11} style={{ animation: isFetching ? "spin 1s linear infinite" : "none" }} />
          Refresh
        </button>
      </div>

      {isLoading ? (
        <LoadingState label="Loading active setups..." />
      ) : error ? (
        <ErrorState message={error.message} onRetry={() => refetch()} />
      ) : setups.length === 0 ? (
        <EmptyState
          icon={<CheckCircle size={32} style={{ color: "#6B7280" }} />}
          title="No Active Setups"
          message="No high-confidence intraday setups are active right now. Check back when market conditions improve or adjust your scanner filters."
        />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          {/* Status summary */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
            {[
              { label: "OPEN", count: setups.length, color: "#00FF88", icon: <CheckCircle size={11} /> },
              { label: "BULLISH", count: setups.filter(s => s.direction === "bullish").length, color: "#00FF88", icon: <TrendingUp size={11} /> },
              { label: "BEARISH", count: setups.filter(s => s.direction === "bearish").length, color: "#FF6B6B", icon: <TrendingDown size={11} /> },
              { label: "HIGH CONF", count: setups.filter(s => s.confidence >= 75).length, color: "#FFD700", icon: <Zap size={11} /> },
            ].map(stat => (
              <div key={stat.label} style={{
                ...CARD,
                padding: "8px 14px",
                display: "flex",
                alignItems: "center",
                gap: "6px",
                borderColor: `${stat.color}33`,
              }}>
                <span style={{ color: stat.color }}>{stat.icon}</span>
                <span style={{ ...MONO_SM, fontSize: "10px", color: "#6B7280" }}>{stat.label}</span>
                <span style={{ ...MONO_SM, fontWeight: 700, color: stat.color }}>{stat.count}</span>
              </div>
            ))}
          </div>

          {setups.map(s => (
            <div key={s.symbol} style={{ position: "relative" }}>
              <div style={{
                position: "absolute",
                top: "8px",
                right: "8px",
                ...MONO_SM,
                fontSize: "9px",
                color: "#00FF88",
                background: "rgba(0,255,136,0.08)",
                border: "1px solid rgba(0,255,136,0.2)",
                borderRadius: "3px",
                padding: "1px 6px",
                zIndex: 1,
              }}>
                OPEN · {new Date(s.generatedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </div>
              <SetupCard s={s} onSearch={onSearch} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Watchlist Tab ─────────────────────────────────────────────
function WatchlistTab({ onSearch }: { onSearch: (sym: string, type: "stock" | "crypto") => void }) {
  const utils = trpc.useUtils();
  const { data: watchlist, isLoading } = trpc.dayTrade.getWatchlist.useQuery();
  const [addSym, setAddSym] = useState("");
  const [addType, setAddType] = useState<"stock" | "crypto">("stock");

  const addMut = trpc.dayTrade.addToWatchlist.useMutation({
    onSuccess: () => {
      utils.dayTrade.getWatchlist.invalidate();
      setAddSym("");
      toast.success("Added to Day Trade watchlist");
    },
    onError: (e) => toast.error(e.message),
  });

  const removeMut = trpc.dayTrade.removeFromWatchlist.useMutation({
    onSuccess: () => { utils.dayTrade.getWatchlist.invalidate(); toast.success("Removed from watchlist"); },
    onError: (e) => toast.error(e.message),
  });

  const items = watchlist ?? [];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      {DISCLAIMER}

      {/* Add form */}
      <div style={CARD}>
        <div style={{ ...LABEL, marginBottom: "10px" }}>Add to Day Trade Watchlist</div>
        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
          <FilterSelect
            label="Type"
            value={addType}
            options={[["stock", "Stock"], ["crypto", "Crypto"]]}
            onChange={v => setAddType(v as "stock" | "crypto")}
          />
          <input
            value={addSym}
            onChange={e => setAddSym(e.target.value.toUpperCase())}
            onKeyDown={e => e.key === "Enter" && addSym.trim() && addMut.mutate({ symbol: addSym.trim(), assetType: addType })}
            placeholder="NVDA, BTC, SOL..."
            style={{
              flex: 1,
              minWidth: "120px",
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(0,212,255,0.2)",
              borderRadius: "4px",
              padding: "7px 12px",
              color: "#F0F4FF",
              fontFamily: "'IBM Plex Mono', monospace",
              fontSize: "13px",
              outline: "none",
            }}
          />
          <button
            onClick={() => addSym.trim() && addMut.mutate({ symbol: addSym.trim(), assetType: addType })}
            disabled={addMut.isPending || !addSym.trim()}
            style={{
              padding: "7px 16px",
              background: "rgba(0,255,136,0.08)",
              border: "1px solid rgba(0,255,136,0.25)",
              borderRadius: "4px",
              color: "#00FF88",
              ...MONO_SM,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "6px",
            }}
          >
            <Plus size={13} />
            Add
          </button>
        </div>
        <div style={{ ...MONO_SM, fontSize: "10px", color: "#6B7280", marginTop: "8px" }}>
          When a saved symbol becomes a valid day trade, it will appear with entry, targets, stop, and confidence.
        </div>
      </div>

      {/* Watchlist items */}
      {isLoading ? (
        <LoadingState label="Loading watchlist..." />
      ) : items.length === 0 ? (
        <EmptyState
          icon={<Bookmark size={32} style={{ color: "#6B7280" }} />}
          title="Watchlist Empty"
          message="Add stocks or crypto symbols to monitor them for intraday setups. You'll see alerts when a saved symbol becomes a valid day trade."
        />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          <div style={{ ...MONO_SM, color: "#6B7280" }}>{items.length} symbol{items.length !== 1 ? "s" : ""} monitored</div>
          {items.map((item: { id: number; symbol: string; assetType: string; addedAt: Date | null }) => (
            <div key={item.id} style={{
              ...CARD,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "12px 16px",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                <span style={{
                  ...MONO_SM, fontSize: "9px",
                  background: item.assetType === "crypto" ? "rgba(153,102,255,0.15)" : "rgba(0,212,255,0.1)",
                  color: item.assetType === "crypto" ? "#9966FF" : "#00D4FF",
                  border: `1px solid ${item.assetType === "crypto" ? "rgba(153,102,255,0.3)" : "rgba(0,212,255,0.2)"}`,
                  borderRadius: "3px", padding: "1px 5px",
                }}>
                  {item.assetType.toUpperCase()}
                </span>
                <span style={{ fontFamily: "'Rajdhani', sans-serif", fontWeight: 700, fontSize: "16px", color: "#F0F4FF" }}>
                  {item.symbol}
                </span>
                <span style={{ ...MONO_SM, fontSize: "10px", color: "#6B7280" }}>
                  Added {item.addedAt ? new Date(item.addedAt).toLocaleDateString() : "—"}
                </span>
              </div>
              <div style={{ display: "flex", gap: "8px" }}>
                <button
                  onClick={() => onSearch(item.symbol, item.assetType as "stock" | "crypto")}
                  style={{
                    padding: "4px 10px",
                    background: "rgba(0,212,255,0.06)",
                    border: "1px solid rgba(0,212,255,0.2)",
                    borderRadius: "3px",
                    color: "#00D4FF",
                    ...MONO_SM,
                    fontSize: "10px",
                    cursor: "pointer",
                  }}
                >
                  Analyze
                </button>
                <button
                  onClick={() => removeMut.mutate({ symbol: item.symbol })}
                  disabled={removeMut.isPending}
                  style={{
                    padding: "4px 8px",
                    background: "rgba(255,107,107,0.06)",
                    border: "1px solid rgba(255,107,107,0.2)",
                    borderRadius: "3px",
                    color: "#FF6B6B",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                  }}
                >
                  <Trash2 size={11} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Shared UI components ──────────────────────────────────────
function FilterSelect({ label, value, options, onChange }: {
  label: string;
  value: string;
  options: [string, string][];
  onChange: (v: string) => void;
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
      <span style={{ ...MONO_SM, fontSize: "10px", color: "#6B7280", letterSpacing: "0.08em" }}>{label}:</span>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        style={{
          background: "rgba(255,255,255,0.04)",
          border: "1px solid rgba(0,212,255,0.2)",
          borderRadius: "4px",
          padding: "5px 8px",
          color: "#F0F4FF",
          fontFamily: "'IBM Plex Mono', monospace",
          fontSize: "11px",
          outline: "none",
          cursor: "pointer",
        }}
      >
        {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
    </div>
  );
}

function LoadingState({ label: _label }: { label: string }) {
  return <NarrativeLoader variant="day-trade" />;
}

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  const isAuth = message.includes("UNAUTHORIZED") || message.includes("FORBIDDEN");
  const isDataFail = message.includes("market data") || message.includes("data unavailable") || message.includes("transform") || message.includes("Unable to");

  if (isAuth) {
    return (
      <div style={{ ...CARD, borderColor: "rgba(255,107,107,0.2)", background: "rgba(255,107,107,0.04)", display: "flex", flexDirection: "column", alignItems: "center", gap: "12px", padding: "32px", textAlign: "center" }}>
        <AlertCircle size={24} style={{ color: "#FF6B6B" }} />
        <div style={{ fontFamily: "'Rajdhani', sans-serif", fontWeight: 700, fontSize: "18px", color: "#FF6B6B" }}>SUBSCRIPTION REQUIRED</div>
        <div style={{ ...MONO_SM, color: "#94A3B8", lineHeight: 1.6, maxWidth: "400px" }}>Trader subscription required to access Day Trade Intelligence™.</div>
      </div>
    );
  }

  return (
    <div style={{ ...CARD, borderColor: "rgba(255,165,0,0.2)", background: "rgba(255,165,0,0.04)", display: "flex", flexDirection: "column", gap: "16px", padding: "32px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
        <AlertCircle size={20} style={{ color: "#FFA500", flexShrink: 0 }} />
        <div style={{ fontFamily: "'Rajdhani', sans-serif", fontWeight: 700, fontSize: "16px", color: "#FFA500" }}>
          {isDataFail ? "LIVE DAY TRADE INTELLIGENCE TEMPORARILY UNAVAILABLE" : "INTELLIGENCE ENGINE UNAVAILABLE"}
        </div>
      </div>
      <div style={{ ...MONO_SM, color: "#94A3B8", lineHeight: 1.6 }}>
        {isDataFail
          ? "Live market data pipelines are temporarily offline. FAULTLINE requires real-time data to generate reliable intraday setups — no analysis will be shown until data is restored."
          : "The intelligence engine encountered an issue. This is typically resolved within seconds."}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
        <div style={{ ...MONO_SM, color: "#6B7280", fontSize: "10px" }}>AUTOMATIC RETRY ACTIVE — checking every 60 seconds</div>
        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
          <button
            onClick={onRetry}
            style={{ padding: "6px 16px", background: "rgba(0,212,255,0.08)", border: "1px solid rgba(0,212,255,0.25)", borderRadius: "4px", color: "#00D4FF", ...MONO_SM, cursor: "pointer", display: "flex", alignItems: "center", gap: "6px" }}
          >
            <RefreshCw size={11} /> Retry Now
          </button>
        </div>
      </div>
      <div style={{ borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: "16px" }}>
        <div style={{ ...MONO_SM, color: "#6B7280", marginBottom: "8px" }}>SECTORS WORTH MONITORING WHILE DATA RESTORES</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
          {["Technology (XLK)", "Semiconductors (SOXX)", "Financials (XLF)", "Energy (XLE)", "Bitcoin (BTC)", "Ethereum (ETH)"].map(s => (
            <span key={s} style={{ padding: "3px 10px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "3px", ...MONO_SM, color: "#94A3B8", fontSize: "10px" }}>{s}</span>
          ))}
        </div>
      </div>
    </div>
  );
}

function EmptyState({ icon: _icon, title, message }: { icon: React.ReactNode; title: string; message: string }) {
  const isNoTrades = title.toLowerCase().includes("no") || message.toLowerCase().includes("no");
  return (
    <div style={{ ...CARD, display: "flex", flexDirection: "column", gap: "16px", padding: "32px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
        <Target size={18} style={{ color: "#6B7280", flexShrink: 0 }} />
        <div style={{ fontFamily: "'Rajdhani', sans-serif", fontWeight: 700, fontSize: "16px", color: "#94A3B8" }}>
          {isNoTrades ? "NO HIGH-CONVICTION SETUPS IDENTIFIED" : title}
        </div>
      </div>
      <div style={{ ...MONO_SM, color: "#6B7280", lineHeight: 1.6 }}>
        {isNoTrades
          ? "No high-conviction day trades currently meet FAULTLINE requirements. Current market conditions do not present a clear intraday edge that justifies the risk."
          : message}
      </div>
      {isNoTrades && (
        <>
          <div style={{ borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: "16px" }}>
            <div style={{ ...MONO_SM, color: "#6B7280", marginBottom: "8px" }}>WATCHLIST CANDIDATES FOR NEXT OPPORTUNITY</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
              {["NVDA", "AAPL", "TSLA", "MSFT", "BTC", "ETH", "AMD", "META"].map(s => (
                <span key={s} style={{ padding: "3px 10px", background: "rgba(0,212,255,0.06)", border: "1px solid rgba(0,212,255,0.15)", borderRadius: "3px", ...MONO_SM, color: "#00D4FF", fontSize: "10px" }}>{s}</span>
              ))}
            </div>
          </div>
          <div style={{ borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: "16px" }}>
            <div style={{ ...MONO_SM, color: "#6B7280", marginBottom: "8px" }}>SECTORS WORTH MONITORING</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
              {["Technology (XLK)", "Semiconductors (SOXX)", "Financials (XLF)", "Energy (XLE)"].map(s => (
                <span key={s} style={{ padding: "3px 10px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "3px", ...MONO_SM, color: "#94A3B8", fontSize: "10px" }}>{s}</span>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function InstitutionalFallback({ message, onRetry }: { message: string; onRetry: () => void }) {
  const { output, isLive, lastUpdated } = useEngine();
  const [showSectors, setShowSectors] = useState(true);
  const [showPlaybook, setShowPlaybook] = useState(true);
  const [showWatchlist, setShowWatchlist] = useState(true);
  const [showRisk, setShowRisk] = useState(false);
  const [showMacro, setShowMacro] = useState(false);

  const isAuth = message.includes("UNAUTHORIZED") || message.includes("FORBIDDEN");
  if (isAuth) {
    return (
      <div style={{ ...CARD, borderColor: "rgba(255,107,107,0.2)", background: "rgba(255,107,107,0.04)", display: "flex", flexDirection: "column", alignItems: "center", gap: "12px", padding: "32px", textAlign: "center" }}>
        <AlertCircle size={24} style={{ color: "#FF6B6B" }} />
        <div style={{ fontFamily: "'Rajdhani', sans-serif", fontWeight: 700, fontSize: "18px", color: "#FF6B6B" }}>SUBSCRIPTION REQUIRED</div>
        <div style={{ ...MONO_SM, color: "#94A3B8", lineHeight: 1.6, maxWidth: "400px" }}>Trader subscription required to access Day Trade Intelligence.</div>
      </div>
    );
  }

  const regimeLabel = output?.regime?.label ?? "Unknown";
  const regimeColor = output?.regime?.color ?? "#94A3B8";
  const pressure = output?.overall?.score ?? 0;
  const bullProb = output?.probability?.bullProbability ?? 50;
  const lastUpdatedStr = lastUpdated ? lastUpdated.toLocaleTimeString() : "Not available";

  const SECTORS_DATA = [
    { name: "Technology (XLK)",      bias: "Monitor",  note: "High beta; avoid during data outages" },
    { name: "Semiconductors (SOXX)", bias: "Monitor",  note: "Momentum-driven; wait for data restore" },
    { name: "Financials (XLF)",      bias: "Neutral",  note: "Rate-sensitive; watch Fed signals" },
    { name: "Energy (XLE)",          bias: "Neutral",  note: "Commodity-linked; check oil levels" },
    { name: "Bitcoin (BTC)",         bias: "Monitor",  note: "24/7 liquidity; crypto data may differ" },
    { name: "Ethereum (ETH)",        bias: "Monitor",  note: "Protocol risk; watch BTC correlation" },
  ];

  const PLAYBOOK_DATA = [
    { rule: "Wait for data confirmation", detail: "Never enter a position without confirmed live price and volume data." },
    { rule: "Reduce position size by 50%", detail: "During data outages, cut all position sizes in half to manage unknown risk." },
    { rule: "Widen stops by 1.5x",         detail: "Spread widens during data gaps. Use 1.5x normal stop distance." },
    { rule: "Avoid momentum setups",        detail: "Momentum trades require real-time tape reading. Skip until data restores." },
    { rule: "Focus on mean-reversion",      detail: "If you must trade, mean-reversion setups are less data-dependent." },
    { rule: "Check pre-market levels",      detail: "Use last known support/resistance levels from prior session as reference." },
  ];

  const WATCHLIST_DATA = [
    { sym: "NVDA", type: "stock",  note: "AI leader; high conviction when data restores" },
    { sym: "AAPL", type: "stock",  note: "Liquid; tight spreads; good for data-gap trading" },
    { sym: "TSLA", type: "stock",  note: "High volatility; wait for clear setup" },
    { sym: "SPY",  type: "stock",  note: "Index ETF; macro proxy; always liquid" },
    { sym: "BTC",  type: "crypto", note: "24/7 market; independent data source" },
    { sym: "ETH",  type: "crypto", note: "Protocol activity; check on-chain" },
    { sym: "AMD",  type: "stock",  note: "Semiconductor proxy; correlated to NVDA" },
    { sym: "META", type: "stock",  note: "Ad revenue proxy; stable fundamentals" },
  ];

  const RISK_DATA = [
    { title: "Maximum Risk Per Trade", value: "0.5% of portfolio", detail: "During data outages, cut normal risk per trade by 50%." },
    { title: "Daily Loss Limit",       value: "1.5% of portfolio", detail: "Stop trading for the day if this threshold is hit." },
    { title: "Correlation Check",      value: "Required",          detail: "Avoid holding correlated positions when data is incomplete." },
    { title: "Leverage",               value: "Reduce to 1:1",     detail: "No leverage during data outages. Spot only." },
  ];

  const MACRO_DATA = [
    { label: "Market Regime",    value: regimeLabel,                       color: regimeColor },
    { label: "Pressure Score",   value: `${pressure.toFixed(1)}/10`,       color: pressure >= 6.5 ? "#FF6B6B" : pressure >= 4.0 ? "#FFD700" : "#00FF88" },
    { label: "Bull Probability", value: `${bullProb}%`,                    color: bullProb >= 60 ? "#00FF88" : bullProb >= 40 ? "#FFD700" : "#FF6B6B" },
    { label: "Data Source",      value: isLive ? "LIVE (FRED)" : "CACHED", color: isLive ? "#00FF88" : "#FFD700" },
    { label: "Last Updated",     value: lastUpdatedStr,                    color: "#94A3B8" },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
      <div style={{ ...CARD, borderColor: "rgba(255,165,0,0.25)", background: "rgba(255,165,0,0.04)", padding: "16px 20px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "10px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <WifiOff size={16} style={{ color: "#FFA500", flexShrink: 0 }} />
            <div>
              <div style={{ fontFamily: "'Rajdhani', sans-serif", fontWeight: 700, fontSize: "15px", color: "#FFA500" }}>LIVE DAY TRADE DATA TEMPORARILY UNAVAILABLE</div>
              <div style={{ ...MONO_SM, color: "#94A3B8", fontSize: "10px", marginTop: "2px" }}>FAULTLINE requires real-time market data to generate reliable intraday setups. Institutional guidance below remains valid.</div>
            </div>
          </div>
          <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
            <div style={{ ...MONO_SM, fontSize: "9px", color: "#6B7280" }}>AUTO-RETRY ACTIVE</div>
            <button onClick={onRetry} style={{ padding: "6px 14px", background: "rgba(0,212,255,0.08)", border: "1px solid rgba(0,212,255,0.25)", borderRadius: "4px", color: "#00D4FF", ...MONO_SM, cursor: "pointer", display: "flex", alignItems: "center", gap: "6px" }}>
              <RefreshCw size={10} /> Retry Now
            </button>
          </div>
        </div>
      </div>

      <div style={CARD}>
        <button onClick={() => setShowMacro(v => !v)} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%", background: "none", border: "none", cursor: "pointer", padding: 0, marginBottom: showMacro ? "12px" : 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <Activity size={12} style={{ color: "#00D4FF" }} />
            <span style={{ ...MONO_SM, color: "#00D4FF", letterSpacing: "0.1em" }}>MACRO SNAPSHOT (FAULTLINE ENGINE)</span>
          </div>
          {showMacro ? <ChevronUp size={12} style={{ color: "#6B7280" }} /> : <ChevronDown size={12} style={{ color: "#6B7280" }} />}
        </button>
        {showMacro && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: "8px" }}>
            {MACRO_DATA.map(s => (
              <div key={s.label} style={{ padding: "8px 10px", background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: "4px" }}>
                <div style={LABEL}>{s.label}</div>
                <div style={{ ...VALUE, color: s.color, fontSize: "12px" }}>{s.value}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={CARD}>
        <button onClick={() => setShowSectors(v => !v)} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%", background: "none", border: "none", cursor: "pointer", padding: 0, marginBottom: showSectors ? "12px" : 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <BarChart2 size={12} style={{ color: "#FFD700" }} />
            <span style={{ ...MONO_SM, color: "#FFD700", letterSpacing: "0.1em" }}>SECTORS WORTH MONITORING</span>
          </div>
          {showSectors ? <ChevronUp size={12} style={{ color: "#6B7280" }} /> : <ChevronDown size={12} style={{ color: "#6B7280" }} />}
        </button>
        {showSectors && (
          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            {SECTORS_DATA.map(s => (
              <div key={s.name} style={{ display: "flex", alignItems: "center", gap: "10px", padding: "8px 10px", background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: "4px" }}>
                <span style={{ ...MONO_SM, fontWeight: 700, color: "#F0F4FF", minWidth: "170px" }}>{s.name}</span>
                <span style={{ ...MONO_SM, fontSize: "9px", padding: "2px 6px", background: "rgba(255,215,0,0.08)", border: "1px solid rgba(255,215,0,0.2)", borderRadius: "3px", color: "#FFD700" }}>{s.bias}</span>
                <span style={{ ...MONO_SM, color: "#6B7280", fontSize: "10px" }}>{s.note}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={CARD}>
        <button onClick={() => setShowPlaybook(v => !v)} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%", background: "none", border: "none", cursor: "pointer", padding: 0, marginBottom: showPlaybook ? "12px" : 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <BookOpen size={12} style={{ color: "#00FF88" }} />
            <span style={{ ...MONO_SM, color: "#00FF88", letterSpacing: "0.1em" }}>INSTITUTIONAL PLAYBOOK - DATA OUTAGE PROTOCOL</span>
          </div>
          {showPlaybook ? <ChevronUp size={12} style={{ color: "#6B7280" }} /> : <ChevronDown size={12} style={{ color: "#6B7280" }} />}
        </button>
        {showPlaybook && (
          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            {PLAYBOOK_DATA.map((p, i) => (
              <div key={i} style={{ display: "flex", gap: "10px", padding: "8px 10px", background: "rgba(0,255,136,0.02)", border: "1px solid rgba(0,255,136,0.08)", borderRadius: "4px" }}>
                <div style={{ ...MONO_SM, fontSize: "9px", color: "#00FF88", fontWeight: 700, minWidth: "20px", paddingTop: "1px" }}>{String(i + 1).padStart(2, "0")}</div>
                <div>
                  <div style={{ ...MONO_SM, color: "#F0F4FF", fontWeight: 600, marginBottom: "2px" }}>{p.rule}</div>
                  <div style={{ ...MONO_SM, color: "#6B7280", fontSize: "10px", lineHeight: 1.5 }}>{p.detail}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={CARD}>
        <button onClick={() => setShowWatchlist(v => !v)} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%", background: "none", border: "none", cursor: "pointer", padding: 0, marginBottom: showWatchlist ? "12px" : 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <Star size={12} style={{ color: "#00D4FF" }} />
            <span style={{ ...MONO_SM, color: "#00D4FF", letterSpacing: "0.1em" }}>WATCHLIST CANDIDATES FOR NEXT OPPORTUNITY</span>
          </div>
          {showWatchlist ? <ChevronUp size={12} style={{ color: "#6B7280" }} /> : <ChevronDown size={12} style={{ color: "#6B7280" }} />}
        </button>
        {showWatchlist && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: "6px" }}>
            {WATCHLIST_DATA.map(w => (
              <div key={w.sym} style={{ padding: "8px 10px", background: "rgba(0,212,255,0.03)", border: "1px solid rgba(0,212,255,0.1)", borderRadius: "4px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "3px" }}>
                  <span style={{ ...MONO_SM, fontWeight: 700, color: "#F0F4FF", fontSize: "13px" }}>{w.sym}</span>
                  <span style={{ ...MONO_SM, fontSize: "8px", padding: "1px 5px", background: w.type === "crypto" ? "rgba(153,102,255,0.12)" : "rgba(0,212,255,0.08)", border: `1px solid ${w.type === "crypto" ? "rgba(153,102,255,0.25)" : "rgba(0,212,255,0.2)"}`, borderRadius: "3px", color: w.type === "crypto" ? "#9966FF" : "#00D4FF" }}>{w.type.toUpperCase()}</span>
                </div>
                <div style={{ ...MONO_SM, color: "#6B7280", fontSize: "10px", lineHeight: 1.4 }}>{w.note}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={CARD}>
        <button onClick={() => setShowRisk(v => !v)} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%", background: "none", border: "none", cursor: "pointer", padding: 0, marginBottom: showRisk ? "12px" : 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <Shield size={12} style={{ color: "#FF9500" }} />
            <span style={{ ...MONO_SM, color: "#FF9500", letterSpacing: "0.1em" }}>RISK MANAGEMENT - OUTAGE PROTOCOL</span>
          </div>
          {showRisk ? <ChevronUp size={12} style={{ color: "#6B7280" }} /> : <ChevronDown size={12} style={{ color: "#6B7280" }} />}
        </button>
        {showRisk && (
          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            {RISK_DATA.map((r, i) => (
              <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: "12px", padding: "8px 10px", background: "rgba(255,149,0,0.03)", border: "1px solid rgba(255,149,0,0.1)", borderRadius: "4px" }}>
                <div style={{ flex: 1 }}>
                  <div style={{ ...MONO_SM, color: "#F0F4FF", fontWeight: 600, marginBottom: "2px" }}>{r.title}</div>
                  <div style={{ ...MONO_SM, color: "#6B7280", fontSize: "10px", lineHeight: 1.5 }}>{r.detail}</div>
                </div>
                <div style={{ ...MONO_SM, fontWeight: 700, color: "#FF9500", fontSize: "12px", flexShrink: 0, paddingTop: "1px" }}>{r.value}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={{ ...CARD, borderColor: "rgba(255,255,255,0.06)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "10px" }}>
          <Wifi size={11} style={{ color: "#6B7280" }} />
          <span style={{ ...MONO_SM, color: "#6B7280", letterSpacing: "0.1em" }}>DATA PIPELINE STATUS</span>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
          {[
            { label: "Market Price Feed",  status: "OFFLINE",                      color: "#FF6B6B" },
            { label: "Volume Data",         status: "OFFLINE",                      color: "#FF6B6B" },
            { label: "Options Flow",        status: "OFFLINE",                      color: "#FF6B6B" },
            { label: "FRED Macro Data",     status: isLive ? "ONLINE" : "CACHED",   color: isLive ? "#00FF88" : "#FFD700" },
            { label: "AI Analysis Engine",  status: "STANDBY",                      color: "#FFD700" },
          ].map(item => (
            <div key={item.label} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "5px 8px", background: "rgba(255,255,255,0.01)", borderRadius: "3px" }}>
              <span style={{ ...MONO_SM, color: "#94A3B8", fontSize: "10px" }}>{item.label}</span>
              <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
                <div style={{ width: "5px", height: "5px", borderRadius: "50%", background: item.color }} />
                <span style={{ ...MONO_SM, fontSize: "9px", color: item.color }}>{item.status}</span>
              </div>
            </div>
          ))}
        </div>
        <div style={{ ...MONO_SM, fontSize: "9px", color: "#374151", marginTop: "8px" }}>AUTOMATIC RETRY ACTIVE - checking every 60 seconds</div>
      </div>
    </div>
  );
}

function Top10RankedTab({ onSearch }: { onSearch: (sym: string, type: "stock" | "crypto") => void }) {
  const { data, isLoading, error, refetch, isFetching } = trpc.dayTrade.scan.useQuery({
    assetType: "both",
    capBucket: "mixed",
    direction: "both",
    riskProfile: "balanced",
    maxResults: 10,
  }, {
    staleTime: 5 * 60 * 1000,
    refetchInterval: 10 * 60 * 1000,
  });

    const setups = ((data?.data ?? []) as unknown as AnySetup[]).filter(s => !isNoTrade(s)).slice(0, 10) as DayTradeSetup[];
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
      {DISCLAIMER}
      {data && data.source !== 'live' && <DataSourceBanner source={data.source} snapshotAge={data.snapshotAge} />}

      <div style={{ ...CARD, background: "rgba(0,212,255,0.03)", borderColor: "rgba(0,212,255,0.18)", padding: "14px 18px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "10px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <Star size={14} style={{ color: "#FFD700" }} />
            <div>
              <div style={{ fontFamily: "'Rajdhani', sans-serif", fontWeight: 700, fontSize: "16px", color: "#F0F4FF", letterSpacing: "0.06em" }}>TOP 10 RANKED INTRADAY SETUPS</div>
              <div style={{ ...MONO_SM, color: "#6B7280", fontSize: "10px" }}>Ranked by Execution Score - All asset classes - Auto-refreshes every 10 min</div>
            </div>
          </div>
          <button onClick={() => refetch()} disabled={isFetching} style={{ padding: "6px 14px", background: "rgba(0,212,255,0.08)", border: "1px solid rgba(0,212,255,0.25)", borderRadius: "4px", color: "#00D4FF", ...MONO_SM, cursor: "pointer", display: "flex", alignItems: "center", gap: "6px" }}>
            <RefreshCw size={11} style={{ animation: isFetching ? "spin 1s linear infinite" : "none" }} />
            {isFetching ? "Scanning..." : "Refresh"}
          </button>
        </div>
      </div>

      {isLoading ? (
        <LoadingState label="Scanning for top 10 setups..." />
      ) : error ? (
        <InstitutionalFallback message={error.message} onRetry={() => refetch()} />
      ) : setups.length === 0 ? (
        <InstitutionalFallback message="No high-conviction setups identified" onRetry={() => refetch()} />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          {setups.map((s, i) => {
            const gradeColor = s.executionGrade === "A" ? "#00FF88" : s.executionGrade === "B" ? "#00D4FF" : s.executionGrade === "C" ? "#FFD700" : s.executionGrade === "D" ? "#FF9500" : "#FF6B6B";
            const rankMedal = i === 0 ? "#FFD700" : i === 1 ? "#C0C0C0" : i === 2 ? "#CD7F32" : "rgba(255,255,255,0.2)";
            return (
              <div key={s.symbol} style={{ ...CARD, padding: "0", overflow: "hidden", borderColor: s.direction === "bullish" ? "rgba(0,255,136,0.15)" : "rgba(255,107,107,0.15)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "10px", padding: "10px 14px", flexWrap: "wrap" }}>
                  <div style={{ width: "22px", height: "22px", borderRadius: "50%", background: `${rankMedal}18`, border: `1px solid ${rankMedal}40`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "10px", fontWeight: 700, color: rankMedal }}>#{i + 1}</span>
                  </div>
                  <div style={{ flex: 1, minWidth: "120px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
                      <span style={{ fontFamily: "'Rajdhani', sans-serif", fontWeight: 700, fontSize: "15px", color: s.direction === "bullish" ? "#00FF88" : "#FF6B6B" }}>{s.symbol}</span>
                      <span style={{ ...MONO_SM, fontSize: "9px", color: "#6B7280", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "100px" }}>{s.name}</span>
                      <span style={{ ...MONO_SM, fontSize: "8px", padding: "1px 4px", background: s.assetType === "crypto" ? "rgba(153,102,255,0.1)" : "rgba(0,212,255,0.08)", border: `1px solid ${s.assetType === "crypto" ? "rgba(153,102,255,0.2)" : "rgba(0,212,255,0.15)"}`, borderRadius: "2px", color: s.assetType === "crypto" ? "#9966FF" : "#00D4FF" }}>{s.assetType.toUpperCase()}</span>
                    </div>
                    <div style={{ ...MONO_SM, fontSize: "9px", color: "#374151", marginTop: "1px" }}>{s.setupType} - {fmtHold(s.expectedHoldMinutes)} hold</div>
                  </div>
                  <div style={{ textAlign: "right", flexShrink: 0 }}>
                    <div style={{ ...MONO_SM, fontWeight: 600, color: "#F0F4FF", fontSize: "12px" }}>{fmt(s.currentPrice)}</div>
                    <div style={{ ...MONO_SM, fontSize: "10px", color: s.changePercent >= 0 ? "#00FF88" : "#FF6B6B" }}>{pct(s.changePercent)}</div>
                  </div>
                  <div style={{ flexShrink: 0 }}><DirIcon d={s.direction} /></div>
                  <div style={{ textAlign: "center", flexShrink: 0 }}>
                    <div style={{ ...MONO_SM, fontSize: "9px", color: "#374151" }}>CONF</div>
                    <div style={{ ...MONO_SM, fontWeight: 700, color: confColor(s.confidence), fontSize: "13px" }}>{s.confidence}</div>
                  </div>
                  <div style={{ width: "26px", height: "26px", borderRadius: "3px", background: `${gradeColor}15`, border: `1px solid ${gradeColor}35`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <span style={{ fontFamily: "'Rajdhani', sans-serif", fontWeight: 800, fontSize: "13px", color: gradeColor }}>{s.executionGrade}</span>
                  </div>
                  <div style={{ textAlign: "right", flexShrink: 0 }}>
                    <div style={{ ...MONO_SM, fontSize: "9px", color: "#374151" }}>R/R</div>
                    <div style={{ ...MONO_SM, fontWeight: 600, color: "#F0F4FF", fontSize: "11px" }}>{s.riskRewardRatio.toFixed(1)}:1</div>
                  </div>
                  <button onClick={() => onSearch(s.symbol, s.assetType)} style={{ padding: "4px 10px", background: "rgba(0,212,255,0.06)", border: "1px solid rgba(0,212,255,0.2)", borderRadius: "3px", color: "#00D4FF", ...MONO_SM, fontSize: "9px", cursor: "pointer", flexShrink: 0 }}>Report</button>
                </div>
                <div style={{ display: "flex", borderTop: "1px solid rgba(255,255,255,0.04)", background: "rgba(0,0,0,0.2)", flexWrap: "wrap" }}>
                  {[
                    { label: "ENTRY",   value: `${fmt(s.entryZoneLow)}-${fmt(s.entryZoneHigh)}`, color: "#00D4FF" },
                    { label: "T1",      value: fmt(s.target1),            color: "#00FF88" },
                    { label: "T2",      value: fmt(s.target2),            color: "#7CFF7C" },
                    { label: "STOP",    value: fmt(s.stopLoss),           color: "#FF6B6B" },
                    { label: "PROB",    value: `${s.probabilityRating}%`, color: confColor(s.probabilityRating) },
                    { label: "RISK",    value: s.riskLevel,               color: riskColor(s.riskLevel) },
                    { label: "REL-VOL", value: s.relativeVolume != null ? `${s.relativeVolume.toFixed(1)}x` : "N/A", color: s.relativeVolume != null && s.relativeVolume >= 1.5 ? "#00FF88" : "#94A3B8" },
                  ].map(kv => (
                    <div key={kv.label} style={{ flex: 1, padding: "5px 8px", borderRight: "1px solid rgba(255,255,255,0.04)", minWidth: "60px" }}>
                      <div style={{ ...MONO_SM, fontSize: "8px", color: "#374151", marginBottom: "1px" }}>{kv.label}</div>
                      <div style={{ ...MONO_SM, fontSize: "10px", fontWeight: 600, color: kv.color, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{kv.value}</div>
                    </div>
                  ))}
                </div>
                {s.catalyst && (
                  <div style={{ padding: "5px 14px", borderTop: "1px solid rgba(255,255,255,0.04)", background: "rgba(0,0,0,0.15)" }}>
                    <span style={{ ...MONO_SM, fontSize: "9px", color: "#374151" }}>CATALYST: </span>
                    <span style={{ ...MONO_SM, fontSize: "9px", color: "#6B7280" }}>{s.catalyst}</span>
                  </div>
                )}
              </div>
            );
          })}
          <DataFreshnessBadge source="Top 10 Ranked" generatedAt={setups[0]?.generatedAt ?? Date.now()} isRefreshing={isFetching} thresholds={[5, 15, 60]} />
        </div>
      )}
    </div>
  );
}

// ── Pipeline Health Tab ──────────────────────────────────────
function PipelineHealthTab() {
  const { data, isLoading, refetch, isFetching } = trpc.pipelineHealth.logs.useQuery(
    { limit: 50 },
    { staleTime: 30_000, refetchInterval: 60_000 }
  );
  const { data: statsData } = trpc.pipelineHealth.summary.useQuery(
    undefined,
    { staleTime: 30_000, refetchInterval: 60_000 }
  );

  const logs = data ?? [];
  const stats = statsData ?? {};

  const providerColor = (provider: string) => {
    if (provider === 'polygon') return '#00D4FF';
    if (provider === 'yahoo') return '#00FF88';
    if (provider === 'coingecko') return '#9966FF';
    if (provider === 'fred') return '#FFD700';
    return '#94A3B8';
  };

  const statusColor = (status: string) => {
    if (status === 'recovered') return '#00FF88';
    if (status === 'active') return '#FF6B6B';
    return '#FFD700';
  };

  const statusDot = (status: string) => (
    <div style={{ width: 7, height: 7, borderRadius: '50%', background: statusColor(status), flexShrink: 0,
      boxShadow: status === 'active' ? `0 0 6px ${statusColor(status)}` : 'none' }} />
  );

  const fmtLatency = (ms: number | null) => ms != null ? `${ms}ms` : '—';
  const fmtTime = (ts: number) => new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

  const PROVIDERS = ['polygon', 'yahoo', 'coingecko', 'fred', 'engine'];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Provider summary grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '10px' }}>
        {PROVIDERS.map(p => {
          const s = (stats as Record<string, { total: number; failures: number; avgLatency: number | null; lastFailure: number | null }>)[p];
          const failRate = s && s.total > 0 ? ((s.failures / s.total) * 100).toFixed(0) : '0';
          const isHealthy = !s || s.failures === 0;
          const isWarning = s && s.failures > 0 && s.failures / s.total < 0.2;
          const color = isHealthy ? '#00FF88' : isWarning ? '#FFD700' : '#FF6B6B';
          return (
            <div key={p} style={{ ...CARD, padding: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '10px', color: providerColor(p), letterSpacing: '0.1em', textTransform: 'uppercase' }}>{p}</span>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: color, boxShadow: `0 0 6px ${color}` }} />
              </div>
              <div style={{ fontFamily: "'Rajdhani', sans-serif", fontWeight: 700, fontSize: '20px', color }}>
                {isHealthy ? 'LIVE' : isWarning ? 'DEGRADED' : 'DOWN'}
              </div>
              {s && (
                <div style={{ marginTop: '6px', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                  <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '9px', color: '#6B7280' }}>
                    Fail rate: <span style={{ color }}>{failRate}%</span>
                  </div>
                  <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '9px', color: '#6B7280' }}>
                    Avg latency: <span style={{ color: '#94A3B8' }}>{fmtLatency(s.avgLatency)}</span>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Recent failure log */}
      <div style={CARD}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
          <div style={{ fontFamily: "'Rajdhani', sans-serif", fontWeight: 700, fontSize: '15px', color: '#F0F4FF' }}>Recent Pipeline Events</div>
          <button onClick={() => refetch()} disabled={isFetching} style={{ padding: '4px 10px', background: 'rgba(0,212,255,0.08)', border: '1px solid rgba(0,212,255,0.2)', borderRadius: '4px', color: '#00D4FF', fontFamily: "'IBM Plex Mono', monospace", fontSize: '10px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px' }}>
            <RefreshCw size={10} style={{ animation: isFetching ? 'spin 1s linear infinite' : 'none' }} /> Refresh
          </button>
        </div>
        {isLoading ? (
          <LoadingState label="Loading pipeline events..." />
        ) : logs.length === 0 ? (
          <EmptyState icon={<CheckCircle size={28} style={{ color: '#00FF88' }} />} title="All Systems Operational" message="No pipeline failures recorded in the last 50 events. Live data is flowing normally." />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {logs.map((log: { id: number; provider: string; endpoint: string; failureReason: string | null; responseCode: number | null; latencyMs: number | null; retryAttempts: number; recoveryStatus: string | null; resolutionTimeMs: number | null; autoRecovered: boolean; createdAt: Date }) => {
              const status = log.recoveryStatus ?? 'active';
              const createdMs = log.createdAt instanceof Date ? log.createdAt.getTime() : Number(log.createdAt);
              return (
                <div key={log.id} style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', padding: '8px 10px', background: 'rgba(0,0,0,0.3)', border: `1px solid ${statusColor(status)}22`, borderRadius: '4px' }}>
                  {statusDot(status)}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center', marginBottom: '3px' }}>
                      <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '10px', color: providerColor(log.provider), letterSpacing: '0.06em' }}>{log.provider.toUpperCase()}</span>
                      <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '9px', color: '#6B7280' }}>{log.endpoint}</span>
                      {log.responseCode && <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '9px', color: '#FF6B6B' }}>HTTP {log.responseCode}</span>}
                      <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '9px', color: '#6B7280', marginLeft: 'auto' }}>{fmtTime(createdMs)}</span>
                    </div>
                    <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '10px', color: '#94A3B8', lineHeight: 1.4 }}>{log.failureReason ?? 'Unknown error'}</div>
                    <div style={{ display: 'flex', gap: '12px', marginTop: '4px' }}>
                      <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '9px', color: '#6B7280' }}>Retries: {log.retryAttempts}</span>
                      <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '9px', color: '#6B7280' }}>Latency: {fmtLatency(log.latencyMs)}</span>
                      {log.resolutionTimeMs != null && <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '9px', color: '#00FF88' }}>Resolved in {log.resolutionTimeMs}ms</span>}
                      {log.autoRecovered && <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '9px', color: '#00D4FF' }}>⚡ AUTO</span>}
                      <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '9px', color: statusColor(status), textTransform: 'uppercase' }}>{status}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '9px', color: '#4B5563', textAlign: 'center' }}>
        Auto-refreshes every 60s · Events are logged server-side on every pipeline failure · Resolved when live data resumes
      </div>
    </div>
  );
}

const TABS = [
  { id: "overview",  label: "Overview",       icon: <Target size={13} /> },
  { id: "top10",     label: "Top 10 Ranked",  icon: <Star size={13} /> },
  { id: "scanner",   label: "Market Scanner", icon: <Activity size={13} /> },
  { id: "stocks",    label: "Stock Screener", icon: <BarChart2 size={13} /> },
  { id: "lowcap",    label: "Low Cap",         icon: <Layers size={13} /> },
  { id: "midcap",    label: "Mid Cap",         icon: <Layers size={13} /> },
  { id: "largecap",  label: "Large Cap",       icon: <Layers size={13} /> },
  { id: "crypto",    label: "Crypto Screener",icon: <Zap size={13} /> },
  { id: "symbol",    label: "Symbol Search",  icon: <Search size={13} /> },
  { id: "active",    label: "Active Setups",  icon: <CheckCircle size={13} /> },
  { id: "watchlist", label: "Watchlist",      icon: <Bookmark size={13} /> },
  { id: "pipeline",  label: "Pipeline Health", icon: <Wifi size={13} /> },
];

// ── Main Page ─────────────────────────────────────────────────
function DayTradeIntelligenceInner() {
  const { user, loading: authLoading } = useAuth();
  void authLoading; // used below
  const searchStr = useSearch();
  const urlParams = useMemo(() => new URLSearchParams(searchStr), [searchStr]);
  const urlSymbol = urlParams.get("symbol")?.toUpperCase() ?? null;
  const urlType = (urlParams.get("type") === "crypto" ? "crypto" : "stock") as "stock" | "crypto";
  const urlAutorun = urlParams.get("autorun") === "1";

    const [activeTab, setActiveTab] = useState(urlSymbol && urlAutorun ? "symbol" : "overview");
  const [, navigate] = useState<string>("");
  // Auto-recovery: track last known data source across all scan queries
  const [lastDataSource, setLastDataSource] = useState<'live' | 'snapshot' | 'fallback'>('live');
  const [recoveryCountdown, setRecoveryCountdown] = useState(0);
  const recoveryIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Probe the pipeline every 30s when not live; seamlessly restore when live returns
  useEffect(() => {
    if (lastDataSource === 'live') {
      if (recoveryIntervalRef.current) {
        clearInterval(recoveryIntervalRef.current);
        recoveryIntervalRef.current = null;
      }
      setRecoveryCountdown(0);
      return;
    }
    setRecoveryCountdown(30);
    const tick = setInterval(() => {
      setRecoveryCountdown(c => {
        if (c <= 1) {
          // Trigger a refetch by dispatching a custom event that tabs can listen to
          window.dispatchEvent(new CustomEvent('dt-auto-recovery'));
          return 30;
        }
        return c - 1;
      });
    }, 1000);
    recoveryIntervalRef.current = tick;
    return () => clearInterval(tick);
  }, [lastDataSource]);

  // Auto-dispatch when navigated from Smart Discovery
  useEffect(() => {
    if (urlSymbol && urlAutorun) {
      setActiveTab("symbol");
      window.dispatchEvent(new CustomEvent("dt-search", { detail: { symbol: urlSymbol, assetType: urlType } }));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlSymbol, urlType, urlAutorun]);

  const handleSearch = useCallback((sym: string, type: "stock" | "crypto") => {
    setActiveTab("symbol");
    // Trigger search via URL-like state — SymbolSearchTab handles this via its own state
    // We use a global event approach for simplicity
    window.dispatchEvent(new CustomEvent("dt-search", { detail: { symbol: sym, assetType: type } }));
  }, []);

  if (authLoading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "60vh" }}>
        <LoadingState label="Loading..." />
      </div>
    );
  }

  if (!user) {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "60vh", gap: "16px" }}>
          <Target size={40} style={{ color: "#00D4FF" }} />
          <div style={{ fontFamily: "'Rajdhani', sans-serif", fontWeight: 700, fontSize: "24px", color: "#F0F4FF" }}>
            Day Trade Intelligence™
          </div>
          <div style={{ ...MONO_SM, color: "#6B7280", textAlign: "center", maxWidth: "400px", lineHeight: 1.6 }}>
            Sign in to access the institutional-grade intraday trading terminal.
          </div>
          <a
            href={getLoginUrl()}
            style={{
              padding: "10px 24px",
              background: "rgba(0,212,255,0.12)",
              border: "1px solid rgba(0,212,255,0.35)",
              borderRadius: "4px",
              color: "#00D4FF",
              fontFamily: "'IBM Plex Mono', monospace",
              fontSize: "12px",
              letterSpacing: "0.1em",
              textDecoration: "none",
              fontWeight: 600,
            }}
          >
            Sign In
          </a>
      </div>
    );
  }

  return (
    <>
      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        select option { background: #0A0C10; color: #F0F4FF; }
      `}</style>

      <div style={{ maxWidth: "1200px", margin: "0 auto", padding: "20px 16px 80px" }}>
        {/* Page header */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "20px", flexWrap: "wrap", gap: "12px" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "4px" }}>
              <Target size={20} style={{ color: "#00D4FF" }} />
              <h1 style={{ fontFamily: "'Rajdhani', sans-serif", fontWeight: 700, fontSize: "24px", color: "#F0F4FF", margin: 0, letterSpacing: "0.06em" }}>
                Day Trade Intelligence™
              </h1>
              <span style={{
                ...MONO_SM, fontSize: "9px",
                background: "rgba(0,212,255,0.1)",
                color: "#00D4FF",
                border: "1px solid rgba(0,212,255,0.25)",
                borderRadius: "3px",
                padding: "2px 6px",
                letterSpacing: "0.1em",
              }}>
                INTRADAY
              </span>
            </div>
            <div style={{ ...MONO_SM, color: "#6B7280" }}>
              Tactical execution center for same-day trading · 30 min – 3 hour holds · No overnight positions
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <div style={{
              width: "6px", height: "6px", borderRadius: "50%",
              background: "#00FF88",
              boxShadow: "0 0 6px #00FF88",
              animation: "pulse 2s infinite",
            }} />
            <span style={{ ...MONO_SM, fontSize: "10px", color: "#00FF88" }}>LIVE</span>
          </div>
        </div>

        {/* Auto-recovery countdown banner — shown only when not live */}
        {lastDataSource !== 'live' && recoveryCountdown > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 14px', background: 'rgba(255,165,0,0.08)', border: '1px solid rgba(255,165,0,0.25)', borderRadius: '6px', marginBottom: '12px' }}>
            <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#FFA500', boxShadow: '0 0 6px #FFA500', animation: 'pulse 1.5s ease-in-out infinite', flexShrink: 0 }} />
            <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '10px', color: '#FFA500', letterSpacing: '0.06em' }}>
              {lastDataSource === 'snapshot' ? 'SNAPSHOT DATA' : 'FALLBACK MODE'} · Auto-recovery probe in {recoveryCountdown}s
            </span>
            <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '9px', color: '#6B7280', marginLeft: 'auto' }}>
              Live data will resume automatically when available
            </span>
          </div>
        )}

        {/* Tab bar — horizontally scrollable on mobile */}
        <div style={{
          display: "flex",
          gap: "2px",
          marginBottom: "20px",
          background: "rgba(10,12,16,0.8)",
          border: "1px solid rgba(0,212,255,0.1)",
          borderRadius: "6px",
          padding: "4px",
          overflowX: "auto",
          scrollbarWidth: "none",          /* Firefox */
          WebkitOverflowScrolling: "touch", /* iOS momentum scroll */
          scrollSnapType: "x mandatory",
        } as React.CSSProperties}>
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "6px",
                padding: "7px 14px",
                borderRadius: "4px",
                border: "none",
                background: activeTab === tab.id ? "rgba(0,212,255,0.12)" : "transparent",
                color: activeTab === tab.id ? "#00D4FF" : "#6B7280",
                fontFamily: "'IBM Plex Mono', monospace",
                fontSize: "11px",
                letterSpacing: "0.06em",
                cursor: "pointer",
                whiteSpace: "nowrap",
                transition: "all 0.15s",
                borderBottom: activeTab === tab.id ? "1px solid rgba(0,212,255,0.4)" : "1px solid transparent",
              }}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        {activeTab === "overview"  && <OverviewTab />}
        {activeTab === "top10"     && <Top10RankedTab onSearch={handleSearch} />}
        {activeTab === "scanner"   && <ScannerTab onSearch={handleSearch} />}
        {activeTab === "stocks"    && <StockScreenerTab onSearch={handleSearch} />}
        {activeTab === "lowcap"    && <CapScannerTab cap="low"   onSearch={handleSearch} />}
        {activeTab === "midcap"    && <CapScannerTab cap="mid"   onSearch={handleSearch} />}
        {activeTab === "largecap"  && <CapScannerTab cap="large" onSearch={handleSearch} />}
        {activeTab === "crypto"    && <CryptoScreenerTab onSearch={handleSearch} />}
        {activeTab === "symbol"    && <SymbolSearchTabWithEvent />}
        {activeTab === "active"    && <ActiveSetupsTab onSearch={handleSearch} />}
        {activeTab === "watchlist" && <WatchlistTab onSearch={handleSearch} />}
        {activeTab === "pipeline" && <PipelineHealthTab />}
      </div>
    </>
  );
}

// ── Symbol Search with event listener (for cross-tab navigation) ──
function SymbolSearchTabWithEvent() {
  const [query, setQuery] = useState("");
  const [submitted, setSubmitted] = useState<{ symbol: string; assetType: "stock" | "crypto" } | null>(null);
  const [assetType, setAssetType] = useState<"stock" | "crypto">("stock");

  // Listen for cross-tab search events
  useState(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail as { symbol: string; assetType: "stock" | "crypto" };
      setQuery(detail.symbol);
      setAssetType(detail.assetType);
      setSubmitted({ symbol: detail.symbol, assetType: detail.assetType });
    };
    window.addEventListener("dt-search", handler);
    return () => window.removeEventListener("dt-search", handler);
  });

  const { data, isLoading, error, refetch } = trpc.dayTrade.symbolSetup.useQuery(
    { symbol: submitted?.symbol ?? "", assetType: submitted?.assetType ?? "stock", direction: "both" },
    { enabled: !!submitted, staleTime: 5 * 60 * 1000 }
  );

  const setup = data as DayTradeSetup | null | undefined;

  const handleSearch = useCallback(() => {
    const sym = query.trim().toUpperCase();
    if (!sym) return;
    setSubmitted({ symbol: sym, assetType });
  }, [query, assetType]);

  const QUICK_STOCKS = ["SPY", "NVDA", "PLTR", "TSLA", "AAPL", "META", "AMD"];
  const QUICK_CRYPTO = ["BTC", "ETH", "SOL", "TAO", "ONDO", "DOGE"];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      {DISCLAIMER}

      <div style={CARD}>
        <div style={{ display: "flex", gap: "8px", marginBottom: "12px" }}>
          <FilterSelect
            label="Type"
            value={assetType}
            options={[["stock", "Stock"], ["crypto", "Crypto"]]}
            onChange={v => setAssetType(v as "stock" | "crypto")}
          />
          <div style={{ flex: 1, display: "flex", gap: "8px" }}>
            <input
              value={query}
              onChange={e => setQuery(e.target.value.toUpperCase())}
              onKeyDown={e => e.key === "Enter" && handleSearch()}
              placeholder={assetType === "stock" ? "NVDA, SPY, PLTR..." : "BTC, ETH, SOL..."}
              style={{
                flex: 1,
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(0,212,255,0.2)",
                borderRadius: "4px",
                padding: "8px 12px",
                color: "#F0F4FF",
                fontFamily: "'IBM Plex Mono', monospace",
                fontSize: "13px",
                outline: "none",
              }}
            />
            <button
              onClick={handleSearch}
              style={{
                padding: "8px 20px",
                background: "rgba(0,212,255,0.12)",
                border: "1px solid rgba(0,212,255,0.35)",
                borderRadius: "4px",
                color: "#00D4FF",
                ...MONO_SM,
                cursor: "pointer",
                fontWeight: 600,
                display: "flex",
                alignItems: "center",
                gap: "6px",
              }}
            >
              <Search size={13} />
              Analyze
            </button>
          </div>
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
          <span style={{ ...MONO_SM, fontSize: "10px", color: "#6B7280", marginRight: "4px" }}>Quick:</span>
          {(assetType === "stock" ? QUICK_STOCKS : QUICK_CRYPTO).map(sym => (
            <button
              key={sym}
              onClick={() => { setQuery(sym); setSubmitted({ symbol: sym, assetType }); }}
              style={{
                padding: "2px 8px",
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: "3px",
                color: "#94A3B8",
                ...MONO_SM,
                fontSize: "10px",
                cursor: "pointer",
              }}
            >
              {sym}
            </button>
          ))}
        </div>
      </div>

      {!submitted ? (
        <EmptyState
          icon={<Search size={32} style={{ color: "#6B7280" }} />}
          title="Search Any Symbol"
          message="Enter a stock or crypto symbol to generate a complete Day Trade Intelligence Report with entry zones, targets, stops, and AI analysis."
        />
      ) : isLoading ? (
        <LoadingState label={`Generating Day Trade Intelligence Report for ${submitted.symbol}...`} />
      ) : error ? (
        <ErrorState message={error.message} onRetry={() => refetch()} />
      ) : !setup ? (
        <ErrorState message="Live market data unavailable. Unable to generate a reliable intraday setup." onRetry={() => refetch()} />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
            <span style={{ ...MONO_SM, color: "#6B7280" }}>Day Trade Intelligence Report · {submitted.symbol}</span>
            <DataFreshnessBadge source="DTI" generatedAt={setup.generatedAt} thresholds={[3, 10, 30]} />
          </div>
          <SetupCard s={setup} />
          {!isNoTrade(setup as unknown as AnySetup) && (
            <>
              {/* Intraday trend + sector */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                <div style={CARD}>
                  <div style={{ ...LABEL, marginBottom: "8px" }}>Intraday Trend</div>
                  <div style={{ ...VALUE, color: dirColor(setup.direction) }}>{setup.intradayTrend}</div>
                  <div style={{ ...MONO_SM, color: "#94A3B8", marginTop: "6px", lineHeight: 1.5 }}>{setup.marketContext}</div>
                </div>
                <div style={CARD}>
                  <div style={{ ...LABEL, marginBottom: "8px" }}>Sector Strength</div>
                  <div style={{ ...MONO_SM, color: "#94A3B8", lineHeight: 1.5 }}>{setup.sectorStrength}</div>
                </div>
              </div>

              {/* Bull / Bear Case side-by-side */}
              {(setup.bullCase || setup.bearCase) && (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                  <div style={{ ...CARD, borderColor: "rgba(0,255,136,0.2)" }}>
                    <div style={{ ...LABEL, marginBottom: "8px", color: "#00FF88" }}>Bull Case</div>
                    <div style={{ ...MONO_SM, color: "#94A3B8", lineHeight: 1.6 }}>{setup.bullCase}</div>
                  </div>
                  <div style={{ ...CARD, borderColor: "rgba(255,107,107,0.2)" }}>
                    <div style={{ ...LABEL, marginBottom: "8px", color: "#FF6B6B" }}>Bear Case</div>
                    <div style={{ ...MONO_SM, color: "#94A3B8", lineHeight: 1.6 }}>{setup.bearCase}</div>
                  </div>
                </div>
              )}

              {/* Most Likely Path + Alternative Path */}
              {(setup.mostLikelyPath || setup.alternativePath) && (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                  <div style={CARD}>
                    <div style={{ ...LABEL, marginBottom: "8px" }}>Most Likely Path</div>
                    <div style={{ ...MONO_SM, color: "#94A3B8", lineHeight: 1.6 }}>{setup.mostLikelyPath}</div>
                  </div>
                  <div style={CARD}>
                    <div style={{ ...LABEL, marginBottom: "8px" }}>Alternative Path</div>
                    <div style={{ ...MONO_SM, color: "#94A3B8", lineHeight: 1.6 }}>{setup.alternativePath}</div>
                  </div>
                </div>
              )}

              {/* Recommended Timeframe + Best Strategy */}
              {(setup.recommendedTimeframe || setup.bestStrategy) && (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                  <div style={CARD}>
                    <div style={{ ...LABEL, marginBottom: "8px" }}>Recommended Timeframe</div>
                    <div style={{ ...MONO_SM, color: "#00D4FF", lineHeight: 1.5 }}>{setup.recommendedTimeframe}</div>
                  </div>
                  <div style={CARD}>
                    <div style={{ ...LABEL, marginBottom: "8px" }}>Best Strategy</div>
                    <div style={{ ...MONO_SM, color: "#FFD700", lineHeight: 1.5 }}>{setup.bestStrategy}</div>
                  </div>
                </div>
              )}

              {/* Primary Catalyst + Largest Risk */}
              {(setup.primaryCatalyst || setup.largestRisk) && (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                  <div style={CARD}>
                    <div style={{ ...LABEL, marginBottom: "8px" }}>Primary Catalyst</div>
                    <div style={{ ...MONO_SM, color: "#94A3B8", lineHeight: 1.5 }}>{setup.primaryCatalyst}</div>
                  </div>
                  <div style={{ ...CARD, borderColor: "rgba(255,149,0,0.2)" }}>
                    <div style={{ ...LABEL, marginBottom: "8px", color: "#FF9500" }}>Largest Risk</div>
                    <div style={{ ...MONO_SM, color: "#94A3B8", lineHeight: 1.5 }}>{setup.largestRisk}</div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

export default function DayTradeIntelligence() {
  return (
    <PremiumGateFull variant="dayTrade">
      <DayTradeIntelligenceInner />
    </PremiumGateFull>
  );
}
