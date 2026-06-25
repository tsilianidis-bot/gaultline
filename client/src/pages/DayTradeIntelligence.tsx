/* ============================================================
   FAULTLINE — Day Trade Intelligence™
   Bloomberg/Trade Ideas style intraday trading terminal
   7 tabs: Overview · Scanner · Stocks · Crypto · Symbol · Active · Watchlist
   ============================================================ */
import React, { useState, useCallback, useRef } from "react";
import AppLayout from "@/components/AppLayout";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import {
  Target, RefreshCw, Search, Plus, Trash2, AlertTriangle,
  TrendingUp, TrendingDown, Minus, ChevronDown, ChevronUp,
  Activity, Zap, BarChart2, Shield, Clock, Bookmark,
  CheckCircle, XCircle, AlertCircle, Info, Layers,
} from "lucide-react";
import { toast } from "sonner";
import DataFreshnessBadge from "@/components/DataFreshnessBadge";

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
  score: number;
  label: string;
  regime: string;
  regimePressure: number;
  volatilityLevel: string;
  marketBreadth: string;
  bullishCount: number;
  bearishCount: number;
  highConfCount: number;
  topMovers: Array<{ symbol: string; changePercent: number; volume: number }>;
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
  isNoTrade(s as unknown as AnySetup) || s.setupType === "NO_TRADE";
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
                <div style={{ ...LABEL, marginBottom: 0 }}>Execution Score</div>
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

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      {DISCLAIMER}

      {/* Score hero */}
      <div style={{ ...CARD, background: "rgba(0,212,255,0.04)", borderColor: "rgba(0,212,255,0.2)", textAlign: "center", padding: "28px" }}>
        <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "11px", color: "#6B7280", letterSpacing: "0.15em", marginBottom: "8px" }}>
          TODAY'S DAY TRADE FAVORABILITY
        </div>
        <div style={{ fontFamily: "'Rajdhani', sans-serif", fontSize: "72px", fontWeight: 700, color: scoreColor(f.score), lineHeight: 1, marginBottom: "4px" }}>
          {f.score}
        </div>
        <div style={{ fontFamily: "'Rajdhani', sans-serif", fontSize: "20px", color: scoreColor(f.score), letterSpacing: "0.1em", marginBottom: "16px" }}>
          {f.label}
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
          { label: "Bullish Setups", value: String(f.bullishCount), color: "#00FF88" },
          { label: "Bearish Setups", value: String(f.bearishCount), color: "#FF6B6B" },
          { label: "High-Confidence", value: String(f.highConfCount), color: "#FFD700" },
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

  const setups = (data ?? []) as unknown as AnySetup[];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      {DISCLAIMER}

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

  const setups = (data ?? []) as unknown as AnySetup[];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      {DISCLAIMER}

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
  const setups = (data ?? []) as unknown as AnySetup[];
  const rgb = cap === "low" ? "245,158,11" : cap === "mid" ? "168,85,247" : "0,212,255";
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      {DISCLAIMER}
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

  const setups = (data ?? []) as unknown as AnySetup[];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      {DISCLAIMER}

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

  const setups = ((data ?? []) as unknown as AnySetup[]).filter(s => !isNoTrade(s)) as DayTradeSetup[];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      {DISCLAIMER}

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

function LoadingState({ label }: { label: string }) {
  return (
    <div style={{ textAlign: "center", padding: "48px 24px" }}>
      <div style={{ display: "inline-flex", alignItems: "center", gap: "10px" }}>
        <RefreshCw size={16} style={{ color: "#00D4FF", animation: "spin 1s linear infinite" }} />
        <span style={{ ...MONO_SM, color: "#6B7280" }}>{label}</span>
      </div>
    </div>
  );
}

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  const friendly = message.includes("UNAUTHORIZED") || message.includes("FORBIDDEN")
    ? "Core subscription required to access Day Trade Intelligence™."
    : message.includes("timeout") || message.includes("TIMEOUT")
    ? "AI analysis timeout. Please retry."
    : message.includes("rate") || message.includes("429")
    ? "Rate limit reached. Please wait a moment and retry."
    : message.includes("market data") || message.includes("data unavailable")
    ? "Live market data unavailable. Unable to generate a reliable intraday setup."
    : message;

  return (
    <div style={{
      ...CARD,
      borderColor: "rgba(255,107,107,0.2)",
      background: "rgba(255,107,107,0.04)",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      gap: "12px",
      padding: "32px",
      textAlign: "center",
    }}>
      <AlertCircle size={24} style={{ color: "#FF6B6B" }} />
      <div style={{ ...MONO_SM, color: "#FF6B6B", lineHeight: 1.6 }}>{friendly}</div>
      <button
        onClick={onRetry}
        style={{
          padding: "6px 16px",
          background: "rgba(255,107,107,0.08)",
          border: "1px solid rgba(255,107,107,0.25)",
          borderRadius: "4px",
          color: "#FF6B6B",
          ...MONO_SM,
          cursor: "pointer",
        }}
      >
        Retry
      </button>
    </div>
  );
}

function EmptyState({ icon, title, message }: { icon: React.ReactNode; title: string; message: string }) {
  return (
    <div style={{
      ...CARD,
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      gap: "12px",
      padding: "48px 24px",
      textAlign: "center",
    }}>
      {icon}
      <div style={{ fontFamily: "'Rajdhani', sans-serif", fontWeight: 600, fontSize: "16px", color: "#94A3B8" }}>{title}</div>
      <div style={{ ...MONO_SM, color: "#6B7280", maxWidth: "400px", lineHeight: 1.6 }}>{message}</div>
    </div>
  );
}

// ── Tab definitions ───────────────────────────────────────────
const TABS = [
  { id: "overview",  label: "Overview",       icon: <Target size={13} /> },
  { id: "scanner",   label: "Market Scanner", icon: <Activity size={13} /> },
  { id: "stocks",    label: "Stock Screener", icon: <BarChart2 size={13} /> },
  { id: "lowcap",    label: "Low Cap",         icon: <Layers size={13} /> },
  { id: "midcap",    label: "Mid Cap",         icon: <Layers size={13} /> },
  { id: "largecap",  label: "Large Cap",       icon: <Layers size={13} /> },
  { id: "crypto",    label: "Crypto Screener",icon: <Zap size={13} /> },
  { id: "symbol",    label: "Symbol Search",  icon: <Search size={13} /> },
  { id: "active",    label: "Active Setups",  icon: <CheckCircle size={13} /> },
  { id: "watchlist", label: "Watchlist",      icon: <Bookmark size={13} /> },
];

// ── Main Page ─────────────────────────────────────────────────
export default function DayTradeIntelligence() {
  const { user, loading: authLoading } = useAuth();
  void authLoading; // used below
  const [activeTab, setActiveTab] = useState("overview");
  const [, navigate] = useState<string>("");

  const handleSearch = useCallback((sym: string, type: "stock" | "crypto") => {
    setActiveTab("symbol");
    // Trigger search via URL-like state — SymbolSearchTab handles this via its own state
    // We use a global event approach for simplicity
    window.dispatchEvent(new CustomEvent("dt-search", { detail: { symbol: sym, assetType: type } }));
  }, []);

  if (authLoading) {
    return (
      <AppLayout>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "60vh" }}>
          <LoadingState label="Loading..." />
        </div>
      </AppLayout>
    );
  }

  if (!user) {
    return (
      <AppLayout>
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
      </AppLayout>
    );
  }

  return (
    <AppLayout>
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
        {activeTab === "scanner"   && <ScannerTab onSearch={handleSearch} />}
        {activeTab === "stocks"    && <StockScreenerTab onSearch={handleSearch} />}
        {activeTab === "lowcap"    && <CapScannerTab cap="low"   onSearch={handleSearch} />}
        {activeTab === "midcap"    && <CapScannerTab cap="mid"   onSearch={handleSearch} />}
        {activeTab === "largecap"  && <CapScannerTab cap="large" onSearch={handleSearch} />}
        {activeTab === "crypto"    && <CryptoScreenerTab onSearch={handleSearch} />}
        {activeTab === "symbol"    && <SymbolSearchTabWithEvent />}
        {activeTab === "active"    && <ActiveSetupsTab onSearch={handleSearch} />}
        {activeTab === "watchlist" && <WatchlistTab onSearch={handleSearch} />}
      </div>
    </AppLayout>
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
