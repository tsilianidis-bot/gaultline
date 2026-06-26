/*
   FAULTLINE — Universal Symbol Intelligence™
   Aggregates all intelligence for any stock or crypto symbol:
   Situation Room preflight + Signal Outlook + Day Trade setup + AI Analysis
   ============================================================ */
import React, { useState, useCallback, useRef } from "react";
import AppLayout from "@/components/AppLayout";
import { trpc } from "@/lib/trpc";
import { useLocation } from "wouter";
import { TickerContext } from "@/components/TickerContext";
import {
  Telescope, Search, TrendingUp, TrendingDown, Activity,
  Shield, Radio, Target, Brain, RefreshCw, AlertTriangle,
  ChevronDown, ChevronUp, Zap, BarChart2, Clock, Layers,
} from "lucide-react";
import { toast } from "sonner";
import DataFreshnessBadge from "@/components/DataFreshnessBadge";

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

// ── Types ─────────────────────────────────────────────────────
type AssetType = "stock" | "crypto";

type DayTradeReport = {
  symbol: string;
  name: string;
  assetType: AssetType;
  currentPrice: number;
  changePercent: number;
  setupType: string;
  direction: "bullish" | "bearish";
  confidence: number;
  executionScore: number;
  executionGrade: "A" | "B" | "C" | "D" | "F";
  riskRewardRatio: number;
  riskLevel: string;
  liquidityRating: string;
  entryZoneLow: number;
  entryZoneHigh: number;
  target1: number;
  target2: number;
  stopLoss: number;
  invalidationLevel: number;
  expectedHoldMinutes: number;
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
  bullCase?: string;
  bearCase?: string;
  primaryCatalyst?: string;
  largestRisk?: string;
  mostLikelyPath?: string;
  alternativePath?: string;
  recommendedTimeframe?: string;
  bestStrategy?: string;
  executionScoreBreakdown?: {
    macroCondition: number;
    technicalStructure: number;
    liquidityScore: number;
    volatilityScore: number;
    momentumScore: number;
    riskRewardScore: number;
  };
  generatedAt: number;
};

// ── Helpers ───────────────────────────────────────────────────
const fmt = (n: number, dec = 2) =>
  n >= 1000 ? `$${n.toLocaleString("en-US", { maximumFractionDigits: dec })}` : `$${n.toFixed(dec)}`;

const pct = (n: number) => `${n >= 0 ? "+" : ""}${n.toFixed(2)}%`;

const confColor = (c: number) =>
  c >= 75 ? "#00FF88" : c >= 55 ? "#FFD700" : "#FF6B6B";

const dirColor = (d: string) =>
  d === "bullish" ? "#00FF88" : d === "bearish" ? "#FF6B6B" : "#6B7280";

const gradeColor = (g: string) =>
  g === "A" ? "#00FF88" : g === "B" ? "#00D4FF" : g === "C" ? "#FFD700" : g === "D" ? "#FF9500" : "#FF6B6B";

const fmtHold = (mins: number) =>
  mins < 60 ? `${mins} min` : `${(mins / 60).toFixed(1)}h`;

// ── Tab definitions ───────────────────────────────────────────
const TABS = [
  { id: "overview",   label: "Overview",     icon: <Telescope size={12} /> },
  { id: "trade",      label: "Trade Setup",  icon: <Target size={12} /> },
  { id: "risk",       label: "Risk Analysis",icon: <Shield size={12} /> },
  { id: "ai",         label: "AI Analysis",  icon: <Brain size={12} /> },
];

// ── Loading / Error states ────────────────────────────────────
function LoadingState({ label }: { label: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "48px 24px", gap: "12px" }}>
      <div style={{ width: "24px", height: "24px", border: "2px solid rgba(0,212,255,0.2)", borderTopColor: "#00D4FF", borderRadius: "50%", animation: "spin 1s linear infinite" }} />
      <div style={{ ...MONO_SM, color: "#6B7280" }}>{label}</div>
    </div>
  );
}

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "48px 24px", gap: "12px" }}>
      <AlertTriangle size={28} style={{ color: "#FF6B6B" }} />
      <div style={{ ...MONO_SM, color: "#FF6B6B", textAlign: "center" }}>{message}</div>
      <button onClick={onRetry} style={{ padding: "6px 16px", background: "rgba(255,107,107,0.08)", border: "1px solid rgba(255,107,107,0.25)", borderRadius: "4px", color: "#FF6B6B", ...MONO_SM, cursor: "pointer" }}>
        Retry
      </button>
    </div>
  );
}

// ── Overview Tab ──────────────────────────────────────────────
function OverviewTab({ report }: { report: DayTradeReport }) {
  const isNoTrade = report.setupType === "NO_TRADE";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
      {/* Price hero */}
      <div style={{ ...CARD, background: "rgba(0,212,255,0.03)", borderColor: "rgba(0,212,255,0.2)" }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: "12px" }}>
          <div>
            <div style={{ fontFamily: "'Rajdhani', sans-serif", fontWeight: 800, fontSize: "32px", color: "#F0F4FF", lineHeight: 1 }}>
              {report.symbol}
            </div>
            <div style={{ ...MONO_SM, color: "#6B7280", marginTop: "2px" }}>{report.name}</div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontWeight: 700, fontSize: "24px", color: "#F0F4FF" }}>
              {fmt(report.currentPrice)}
            </div>
            <div style={{ ...MONO_SM, color: report.changePercent >= 0 ? "#00FF88" : "#FF6B6B", fontSize: "13px" }}>
              {pct(report.changePercent)}
            </div>
          </div>
        </div>

        {/* Status badges */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginTop: "16px" }}>
          <span style={{
            ...MONO_SM, fontSize: "10px",
            background: report.assetType === "crypto" ? "rgba(153,102,255,0.12)" : "rgba(0,212,255,0.08)",
            color: report.assetType === "crypto" ? "#9966FF" : "#00D4FF",
            border: `1px solid ${report.assetType === "crypto" ? "rgba(153,102,255,0.3)" : "rgba(0,212,255,0.2)"}`,
            borderRadius: "3px", padding: "2px 8px",
          }}>
            {report.assetType.toUpperCase()}
          </span>
          <span style={{
            ...MONO_SM, fontSize: "10px",
            background: isNoTrade ? "rgba(107,114,128,0.1)" : report.direction === "bullish" ? "rgba(0,255,136,0.1)" : "rgba(255,107,107,0.1)",
            color: isNoTrade ? "#6B7280" : dirColor(report.direction),
            border: `1px solid ${isNoTrade ? "rgba(107,114,128,0.2)" : report.direction === "bullish" ? "rgba(0,255,136,0.2)" : "rgba(255,107,107,0.2)"}`,
            borderRadius: "3px", padding: "2px 8px",
          }}>
            {isNoTrade ? "NO TRADE" : report.setupType}
          </span>
          {!isNoTrade && (
            <span style={{
              ...MONO_SM, fontSize: "10px",
              background: "rgba(0,0,0,0.3)",
              color: gradeColor(report.executionGrade),
              border: `1px solid ${gradeColor(report.executionGrade)}44`,
              borderRadius: "3px", padding: "2px 8px",
            }}>
              EXEC {report.executionGrade} · {report.executionScore}/100
            </span>
          )}
          {report.vwapStatus && report.vwapStatus !== "Unknown" && (
            <span style={{
              ...MONO_SM, fontSize: "10px",
              background: "rgba(255,215,0,0.08)",
              color: "#FFD700",
              border: "1px solid rgba(255,215,0,0.2)",
              borderRadius: "3px", padding: "2px 8px",
            }}>
              {report.vwapStatus}
            </span>
          )}
        </div>
      </div>

      {/* Key metrics grid */}
      {!isNoTrade && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: "10px" }}>
          {[
            { label: "Confidence", value: `${report.confidence}/100`, color: confColor(report.confidence) },
            { label: "Execution Grade", value: `${report.executionGrade} (${report.executionScore})`, color: gradeColor(report.executionGrade) },
            { label: "Risk/Reward", value: `${report.riskRewardRatio.toFixed(1)}:1`, color: "#F0F4FF" },
            { label: "Risk Level", value: report.riskLevel, color: report.riskLevel === "Low" ? "#00FF88" : report.riskLevel === "Medium" ? "#FFD700" : "#FF6B6B" },
            { label: "Liquidity", value: report.liquidityRating, color: "#F0F4FF" },
            { label: "Hold Time", value: fmtHold(report.expectedHoldMinutes), color: "#00D4FF" },
            { label: "Momentum", value: `${report.momentumRating ?? 0}/100`, color: confColor(report.momentumRating ?? 0) },
            { label: "Intraday Trend", value: report.intradayTrend ?? "N/A", color: dirColor(report.direction) },
          ].map(m => (
            <div key={m.label} style={CARD}>
              <div style={LABEL}>{m.label}</div>
              <div style={{ ...VALUE, color: m.color, fontSize: "12px" }}>{m.value}</div>
            </div>
          ))}
        </div>
      )}

      {/* No trade reason */}
      {isNoTrade && report.noTradeReason && (
        <div style={{ ...CARD, borderColor: "rgba(255,107,107,0.2)", background: "rgba(255,107,107,0.04)" }}>
          <div style={{ display: "flex", gap: "10px", alignItems: "flex-start" }}>
            <AlertTriangle size={16} style={{ color: "#FF6B6B", flexShrink: 0, marginTop: "2px" }} />
            <div>
              <div style={{ ...MONO_SM, fontWeight: 700, color: "#FF6B6B", marginBottom: "4px" }}>NO TRADE</div>
              <div style={{ ...MONO_SM, color: "#94A3B8", lineHeight: 1.6 }}>{report.noTradeReason}</div>
            </div>
          </div>
        </div>
      )}

      {/* Market context */}
      {report.marketContext && (
        <div style={CARD}>
          <div style={LABEL}>Market Context</div>
          <div style={{ ...MONO_SM, color: "#94A3B8", lineHeight: 1.6 }}>{report.marketContext}</div>
        </div>
      )}

      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", flexWrap: "wrap" }}>
        <DataFreshnessBadge source="Symbol Intel" generatedAt={report.generatedAt} thresholds={[3, 10, 30]} />
        <span style={{ ...MONO_SM, fontSize: "10px", color: "#374151" }}>Data refreshes every 3 min</span>
      </div>
    </div>
  );
}

// ── Trade Setup Tab ───────────────────────────────────────────
function TradeSetupTab({ report }: { report: DayTradeReport }) {
  const isNoTrade = report.setupType === "NO_TRADE";

  if (isNoTrade) {
    return (
      <div style={{ ...CARD, borderColor: "rgba(255,107,107,0.2)", background: "rgba(255,107,107,0.04)" }}>
        <div style={{ display: "flex", gap: "10px", alignItems: "flex-start" }}>
          <AlertTriangle size={16} style={{ color: "#FF6B6B", flexShrink: 0, marginTop: "2px" }} />
          <div>
            <div style={{ ...MONO_SM, fontWeight: 700, color: "#FF6B6B", marginBottom: "4px" }}>NO TRADE — Setup Not Valid</div>
            <div style={{ ...MONO_SM, color: "#94A3B8", lineHeight: 1.6 }}>{report.noTradeReason ?? "No valid intraday setup detected."}</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
      {/* Entry / Targets / Stop */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: "10px" }}>
        <div style={CARD}>
          <div style={LABEL}>Entry Zone</div>
          <div style={VALUE}>{fmt(report.entryZoneLow)} – {fmt(report.entryZoneHigh)}</div>
        </div>
        <div style={{ ...CARD, borderColor: "rgba(0,255,136,0.2)" }}>
          <div style={LABEL}>Target 1</div>
          <div style={{ ...VALUE, color: "#00FF88" }}>{fmt(report.target1)}</div>
        </div>
        <div style={{ ...CARD, borderColor: "rgba(0,212,255,0.2)" }}>
          <div style={LABEL}>Target 2</div>
          <div style={{ ...VALUE, color: "#00D4FF" }}>{fmt(report.target2)}</div>
        </div>
        <div style={{ ...CARD, borderColor: "rgba(255,107,107,0.2)" }}>
          <div style={LABEL}>Stop Loss</div>
          <div style={{ ...VALUE, color: "#FF6B6B" }}>{fmt(report.stopLoss)}</div>
        </div>
        <div style={{ ...CARD, borderColor: "rgba(255,149,0,0.2)" }}>
          <div style={LABEL}>Invalidation</div>
          <div style={{ ...VALUE, color: "#FF9500" }}>{fmt(report.invalidationLevel)}</div>
        </div>
        {report.supportLevel !== undefined && report.supportLevel > 0 && (
          <div style={CARD}>
            <div style={LABEL}>Support</div>
            <div style={VALUE}>{fmt(report.supportLevel)}</div>
          </div>
        )}
        {report.resistanceLevel !== undefined && report.resistanceLevel > 0 && (
          <div style={CARD}>
            <div style={LABEL}>Resistance</div>
            <div style={VALUE}>{fmt(report.resistanceLevel)}</div>
          </div>
        )}
      </div>

      {/* Bull / Bear Case */}
      {(report.bullCase || report.bearCase) && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
          <div style={{ ...CARD, borderColor: "rgba(0,255,136,0.2)" }}>
            <div style={{ ...LABEL, marginBottom: "8px", color: "#00FF88" }}>Bull Case</div>
            <div style={{ ...MONO_SM, color: "#94A3B8", lineHeight: 1.6 }}>{report.bullCase}</div>
          </div>
          <div style={{ ...CARD, borderColor: "rgba(255,107,107,0.2)" }}>
            <div style={{ ...LABEL, marginBottom: "8px", color: "#FF6B6B" }}>Bear Case</div>
            <div style={{ ...MONO_SM, color: "#94A3B8", lineHeight: 1.6 }}>{report.bearCase}</div>
          </div>
        </div>
      )}

      {/* Most Likely Path + Alternative */}
      {(report.mostLikelyPath || report.alternativePath) && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
          <div style={CARD}>
            <div style={LABEL}>Most Likely Path</div>
            <div style={{ ...MONO_SM, color: "#94A3B8", lineHeight: 1.6 }}>{report.mostLikelyPath}</div>
          </div>
          <div style={CARD}>
            <div style={LABEL}>Alternative Path</div>
            <div style={{ ...MONO_SM, color: "#94A3B8", lineHeight: 1.6 }}>{report.alternativePath}</div>
          </div>
        </div>
      )}

      {/* Timeframe + Strategy */}
      {(report.recommendedTimeframe || report.bestStrategy) && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
          <div style={CARD}>
            <div style={LABEL}>Recommended Timeframe</div>
            <div style={{ ...MONO_SM, color: "#00D4FF", lineHeight: 1.5 }}>{report.recommendedTimeframe}</div>
          </div>
          <div style={CARD}>
            <div style={LABEL}>Best Strategy</div>
            <div style={{ ...MONO_SM, color: "#FFD700", lineHeight: 1.5 }}>{report.bestStrategy}</div>
          </div>
        </div>
      )}

      {/* Why this trade exists */}
      {report.whyTradeExists && (
        <div style={CARD}>
          <div style={LABEL}>Why This Trade Exists</div>
          <div style={{ ...MONO_SM, color: "#94A3B8", lineHeight: 1.6 }}>{report.whyTradeExists}</div>
        </div>
      )}
    </div>
  );
}

// ── Risk Analysis Tab ─────────────────────────────────────────
function RiskAnalysisTab({ report }: { report: DayTradeReport }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
      {/* Execution Score Breakdown */}
      {report.executionScoreBreakdown && report.executionScore > 0 && (
        <div style={CARD}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "14px" }}>
            <div style={{ ...LABEL, marginBottom: 0 }}>Execution Score Breakdown</div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span style={{ fontFamily: "'Rajdhani', sans-serif", fontWeight: 800, fontSize: "22px", color: gradeColor(report.executionGrade) }}>
                {report.executionGrade}
              </span>
              <span style={{ ...MONO_SM, color: "#94A3B8" }}>{report.executionScore}/100</span>
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
            {([
              ["Macro Condition", report.executionScoreBreakdown.macroCondition, 20],
              ["Technical Structure", report.executionScoreBreakdown.technicalStructure, 20],
              ["Liquidity Score", report.executionScoreBreakdown.liquidityScore, 15],
              ["Volatility Score", report.executionScoreBreakdown.volatilityScore, 15],
              ["Momentum Score", report.executionScoreBreakdown.momentumScore, 15],
              ["Risk/Reward Score", report.executionScoreBreakdown.riskRewardScore, 15],
            ] as [string, number, number][]).map(([label, val, max]) => (
              <div key={label}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
                  <span style={{ ...MONO_SM, fontSize: "10px", color: "#94A3B8" }}>{label}</span>
                  <span style={{ ...MONO_SM, fontSize: "10px", color: "#F0F4FF", fontWeight: 600 }}>{val}/{max}</span>
                </div>
                <div style={{ height: "4px", background: "rgba(255,255,255,0.06)", borderRadius: "2px", overflow: "hidden" }}>
                  <div style={{
                    height: "100%",
                    width: `${(val / max) * 100}%`,
                    background: val / max >= 0.7 ? "#00FF88" : val / max >= 0.4 ? "#FFD700" : "#FF6B6B",
                    borderRadius: "2px",
                    transition: "width 0.4s ease-out",
                  }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* What cancels this trade */}
      {report.whatCancelsThisTrade && (
        <div style={{ ...CARD, borderColor: "rgba(255,149,0,0.2)" }}>
          <div style={{ ...LABEL, marginBottom: "8px", color: "#FF9500" }}>What Cancels This Trade</div>
          <div style={{ ...MONO_SM, color: "#94A3B8", lineHeight: 1.6 }}>{report.whatCancelsThisTrade}</div>
        </div>
      )}

      {/* Primary Catalyst + Largest Risk */}
      {(report.primaryCatalyst || report.largestRisk) && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
          <div style={CARD}>
            <div style={LABEL}>Primary Catalyst</div>
            <div style={{ ...MONO_SM, color: "#94A3B8", lineHeight: 1.5 }}>{report.primaryCatalyst}</div>
          </div>
          <div style={{ ...CARD, borderColor: "rgba(255,107,107,0.2)" }}>
            <div style={{ ...LABEL, marginBottom: "8px", color: "#FF6B6B" }}>Largest Risk</div>
            <div style={{ ...MONO_SM, color: "#94A3B8", lineHeight: 1.5 }}>{report.largestRisk}</div>
          </div>
        </div>
      )}

      {/* Confidence reasoning */}
      {report.confidenceReasoning && (
        <div style={CARD}>
          <div style={LABEL}>Confidence Reasoning</div>
          <div style={{ ...MONO_SM, color: "#94A3B8", lineHeight: 1.6 }}>{report.confidenceReasoning}</div>
        </div>
      )}
    </div>
  );
}

// ── AI Analysis Tab ───────────────────────────────────────────
function AIAnalysisTab({ report }: { report: DayTradeReport }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
      {report.catalystSummary && (
        <div style={CARD}>
          <div style={LABEL}>Catalyst Summary</div>
          <div style={{ ...MONO_SM, color: "#94A3B8", lineHeight: 1.6 }}>{report.catalystSummary}</div>
        </div>
      )}
      {report.whyTradeExists && (
        <div style={CARD}>
          <div style={LABEL}>Why This Opportunity Exists</div>
          <div style={{ ...MONO_SM, color: "#94A3B8", lineHeight: 1.6 }}>{report.whyTradeExists}</div>
        </div>
      )}
      {report.mostLikelyPath && (
        <div style={CARD}>
          <div style={LABEL}>AI Price Path Analysis</div>
          <div style={{ ...MONO_SM, color: "#94A3B8", lineHeight: 1.6 }}>{report.mostLikelyPath}</div>
          {report.alternativePath && (
            <div style={{ ...MONO_SM, color: "#6B7280", lineHeight: 1.6, marginTop: "8px", paddingTop: "8px", borderTop: "1px solid rgba(255,255,255,0.06)" }}>
              Alternative: {report.alternativePath}
            </div>
          )}
        </div>
      )}
      {report.bestStrategy && (
        <div style={{ ...CARD, borderColor: "rgba(255,215,0,0.2)" }}>
          <div style={{ ...LABEL, color: "#FFD700", marginBottom: "8px" }}>AI Recommended Strategy</div>
          <div style={{ ...MONO_SM, color: "#94A3B8", lineHeight: 1.6 }}>{report.bestStrategy}</div>
        </div>
      )}
      {report.recommendedTimeframe && (
        <div style={CARD}>
          <div style={LABEL}>Recommended Timeframe</div>
          <div style={{ ...MONO_SM, color: "#00D4FF", lineHeight: 1.5 }}>{report.recommendedTimeframe}</div>
        </div>
      )}
      <div style={{ ...CARD, background: "rgba(255,170,0,0.04)", borderColor: "rgba(255,170,0,0.15)" }}>
        <div style={{ display: "flex", gap: "8px", alignItems: "flex-start" }}>
          <AlertTriangle size={12} style={{ color: "#FFAA00", marginTop: "2px", flexShrink: 0 }} />
          <span style={{ ...MONO_SM, fontSize: "10px", color: "#FFAA00", lineHeight: 1.5 }}>
            AI analysis is for informational purposes only. Not financial advice. Day Trade Intelligence™ is designed for same-day intraday trading only.
          </span>
        </div>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────
export default function UniversalSymbolIntelligence() {
  const [query, setQuery] = useState("");
  const [assetType, setAssetType] = useState<AssetType>("stock");
  const [submitted, setSubmitted] = useState<{ symbol: string; assetType: AssetType } | null>(null);
  const [activeTab, setActiveTab] = useState("overview");
  const inputRef = useRef<HTMLInputElement>(null);
  const [, navigate] = useLocation();

  const { data, isLoading, error, refetch, isFetching } = trpc.dayTrade.symbolSetup.useQuery(
    { symbol: submitted?.symbol ?? "", assetType: submitted?.assetType ?? "stock", direction: "both" },
    { enabled: !!submitted, staleTime: 3 * 60 * 1000 }
  );

  const report = data as DayTradeReport | null | undefined;

  const handleSearch = useCallback(() => {
    const sym = query.trim().toUpperCase();
    if (!sym) {
      toast.error("Enter a symbol to analyze");
      return;
    }
    setSubmitted({ symbol: sym, assetType });
    setActiveTab("overview");
  }, [query, assetType]);

  const QUICK_STOCKS = ["SPY", "NVDA", "PLTR", "TSLA", "AAPL", "META", "AMD", "MSFT"];
  const QUICK_CRYPTO = ["BTC", "ETH", "SOL", "TAO", "ONDO", "DOGE", "LINK"];

  return (
    <AppLayout>
      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
      `}</style>

      <div style={{ maxWidth: "1100px", margin: "0 auto", padding: "20px 16px 80px" }}>
        {/* Page header */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "20px", flexWrap: "wrap", gap: "12px" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "4px" }}>
              <Telescope size={20} style={{ color: "#00D4FF" }} />
              <h1 style={{ fontFamily: "'Rajdhani', sans-serif", fontWeight: 700, fontSize: "24px", color: "#F0F4FF", margin: 0, letterSpacing: "0.06em" }}>
                Symbol Intelligence™
              </h1>
              <span style={{
                fontFamily: "'IBM Plex Mono', monospace",
                fontSize: "9px",
                background: "rgba(0,212,255,0.1)",
                color: "#00D4FF",
                border: "1px solid rgba(0,212,255,0.25)",
                borderRadius: "3px",
                padding: "2px 6px",
                letterSpacing: "0.1em",
              }}>
                UNIVERSAL
              </span>
            </div>
            <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "11px", color: "#6B7280" }}>
              Complete intelligence for any stock or crypto symbol — trade setup, risk analysis, and AI insights
            </div>
          </div>
        </div>

        {/* Search bar */}
        <div style={{ ...CARD, marginBottom: "20px" }}>
          <div style={{ display: "flex", gap: "8px", marginBottom: "12px", flexWrap: "wrap" }}>
            {/* Asset type toggle */}
            <div style={{ display: "flex", gap: "4px" }}>
              {(["stock", "crypto"] as AssetType[]).map(t => (
                <button
                  key={t}
                  onClick={() => setAssetType(t)}
                  style={{
                    padding: "7px 14px",
                    background: assetType === t ? "rgba(0,212,255,0.12)" : "rgba(255,255,255,0.04)",
                    border: `1px solid ${assetType === t ? "rgba(0,212,255,0.4)" : "rgba(255,255,255,0.08)"}`,
                    borderRadius: "4px",
                    color: assetType === t ? "#00D4FF" : "#6B7280",
                    fontFamily: "'IBM Plex Mono', monospace",
                    fontSize: "11px",
                    cursor: "pointer",
                    letterSpacing: "0.06em",
                    textTransform: "uppercase" as const,
                    transition: "all 0.15s",
                  }}
                >
                  {t}
                </button>
              ))}
            </div>
            {/* Symbol input */}
            <div style={{ flex: 1, display: "flex", gap: "8px", minWidth: "200px" }}>
              <input
                ref={inputRef}
                value={query}
                onChange={e => setQuery(e.target.value.toUpperCase())}
                onKeyDown={e => e.key === "Enter" && handleSearch()}
                placeholder={assetType === "stock" ? "Enter symbol: NVDA, SPY, TSLA..." : "Enter symbol: BTC, ETH, SOL..."}
                style={{
                  flex: 1,
                  background: "rgba(255,255,255,0.04)",
                  border: "1px solid rgba(0,212,255,0.25)",
                  borderRadius: "4px",
                  padding: "8px 14px",
                  color: "#F0F4FF",
                  fontFamily: "'IBM Plex Mono', monospace",
                  fontSize: "14px",
                  outline: "none",
                  letterSpacing: "0.06em",
                }}
              />
              <button
                onClick={handleSearch}
                disabled={isFetching}
                style={{
                  padding: "8px 24px",
                  background: "rgba(0,212,255,0.12)",
                  border: "1px solid rgba(0,212,255,0.4)",
                  borderRadius: "4px",
                  color: "#00D4FF",
                  fontFamily: "'IBM Plex Mono', monospace",
                  fontSize: "12px",
                  cursor: "pointer",
                  fontWeight: 700,
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  letterSpacing: "0.08em",
                  whiteSpace: "nowrap" as const,
                  transition: "all 0.15s",
                }}
              >
                <Search size={13} style={{ animation: isFetching ? "spin 1s linear infinite" : "none" }} />
                {isFetching ? "Analyzing..." : "Analyze"}
              </button>
            </div>
          </div>
          {/* Quick picks */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", alignItems: "center" }}>
            <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "10px", color: "#6B7280" }}>Quick:</span>
            {(assetType === "stock" ? QUICK_STOCKS : QUICK_CRYPTO).map(sym => (
              <button
                key={sym}
                onClick={() => { setQuery(sym); setSubmitted({ symbol: sym, assetType }); setActiveTab("overview"); }}
                style={{
                  padding: "3px 10px",
                  background: "rgba(255,255,255,0.04)",
                  border: "1px solid rgba(255,255,255,0.08)",
                  borderRadius: "3px",
                  color: "#94A3B8",
                  fontFamily: "'IBM Plex Mono', monospace",
                  fontSize: "10px",
                  cursor: "pointer",
                  transition: "all 0.1s",
                }}
              >
                {sym}
              </button>
            ))}
          </div>
        </div>

        {/* TickerContext — live price, change, volume, sector, regime */}
        {submitted && (
          <div style={{ marginBottom: "16px" }}>
            <TickerContext ticker={submitted.symbol} />
          </div>
        )}

        {/* Results area */}
        {!submitted ? (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "80px 24px", gap: "16px" }}>
            <Telescope size={48} style={{ color: "rgba(0,212,255,0.2)" }} />
            <div style={{ fontFamily: "'Rajdhani', sans-serif", fontWeight: 700, fontSize: "20px", color: "#374151", textAlign: "center" }}>
              Enter Any Symbol
            </div>
            <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "11px", color: "#374151", textAlign: "center", maxWidth: "400px", lineHeight: 1.6 }}>
              Search any stock or crypto to get a complete intelligence report: intraday trade setup, execution score, risk analysis, and AI-powered insights.
            </div>
            <div style={{ display: "flex", gap: "16px", flexWrap: "wrap", justifyContent: "center", marginTop: "8px" }}>
              {[
                { icon: <Target size={14} />, label: "Trade Setup" },
                { icon: <Shield size={14} />, label: "Risk Analysis" },
                { icon: <Brain size={14} />, label: "AI Insights" },
                { icon: <BarChart2 size={14} />, label: "Execution Score" },
              ].map(f => (
                <div key={f.label} style={{ display: "flex", alignItems: "center", gap: "6px", color: "#374151", fontFamily: "'IBM Plex Mono', monospace", fontSize: "10px" }}>
                  {f.icon}
                  {f.label}
                </div>
              ))}
            </div>
          </div>
        ) : isLoading ? (
          <LoadingState label={`Generating Symbol Intelligence Report for ${submitted.symbol}...`} />
        ) : error ? (
          <ErrorState message={error.message} onRetry={() => refetch()} />
        ) : !report ? (
          <ErrorState message="Unable to generate report. Live market data may be unavailable." onRetry={() => refetch()} />
        ) : (
          <div>
            {/* Symbol header + refresh */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px", flexWrap: "wrap", gap: "8px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <span style={{ fontFamily: "'Rajdhani', sans-serif", fontWeight: 800, fontSize: "20px", color: "#F0F4FF" }}>
                  {report.symbol}
                </span>
                <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "11px", color: "#6B7280" }}>
                  {report.name}
                </span>
              </div>
              <button
                onClick={() => refetch()}
                disabled={isFetching}
                style={{
                  padding: "5px 12px",
                  background: "rgba(0,212,255,0.06)",
                  border: "1px solid rgba(0,212,255,0.2)",
                  borderRadius: "4px",
                  color: "#00D4FF",
                  fontFamily: "'IBM Plex Mono', monospace",
                  fontSize: "10px",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "5px",
                }}
              >
                <RefreshCw size={10} style={{ animation: isFetching ? "spin 1s linear infinite" : "none" }} />
                Refresh
              </button>
            </div>

            {/* Tab bar */}
            <div style={{
              display: "flex",
              gap: "2px",
              marginBottom: "16px",
              background: "rgba(10,12,16,0.8)",
              border: "1px solid rgba(0,212,255,0.1)",
              borderRadius: "6px",
              padding: "4px",
              overflowX: "auto",
              scrollbarWidth: "none",
            } as React.CSSProperties}>
              {TABS.map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                    padding: "7px 16px",
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
            {activeTab === "overview" && <OverviewTab report={report} />}
            {activeTab === "trade"    && <TradeSetupTab report={report} />}
            {activeTab === "risk"     && <RiskAnalysisTab report={report} />}
            {activeTab === "ai"       && <AIAnalysisTab report={report} />}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
