// ============================================================
// FAULTLINE — Signal Outlook Center™
// client/src/pages/SignalOutlookCenter.tsx
//
// Flagship intelligence feature: transforms raw signals into
// actionable market intelligence. Separate stock/crypto paths.
// Five core questions answered for every asset.
// ============================================================
import { useState, useCallback, useMemo, useEffect } from "react";
import { useSearch } from "wouter";
import { trpc } from "@/lib/trpc";
import PageHeader from "@/components/PageHeader";
import { TickerChip } from "@/components/TickerActionMenu";
import { useSEO } from "@/hooks/useSEO";
import {
  Search, TrendingUp, TrendingDown, Minus, AlertTriangle,
  ChevronDown, ChevronUp, Info, RefreshCw, Target, Shield,
  Activity, Zap, BarChart2, Brain, CheckCircle, XCircle,
  ArrowRight, Bitcoin, DollarSign, Eye, Layers, Clock,
} from "lucide-react";

// ── Types (mirrored from server) ─────────────────────────────
type OutlookDirection = "Bullish" | "Bearish" | "Neutral" | "Avoid";
type OutlookTimeframe = "day" | "short" | "swing" | "long";
type OutlookRiskLevel = "Low" | "Moderate" | "High" | "Extreme";
type TradeReadiness = "Cleared" | "Caution" | "Defensive";

// ── Color helpers ─────────────────────────────────────────────
function directionColor(d: OutlookDirection): string {
  switch (d) {
    case "Bullish": return "#00FF88";
    case "Bearish": return "#FF2D55";
    case "Neutral": return "#64B5F6";
    case "Avoid":   return "#FF9500";
    default:        return "#94A3B8";
  }
}

function riskColor(r: OutlookRiskLevel): string {
  switch (r) {
    case "Low":      return "#00FF88";
    case "Moderate": return "#FFD700";
    case "High":     return "#FF9500";
    case "Extreme":  return "#FF2D55";
    default:         return "#94A3B8";
  }
}

function readinessColor(r: TradeReadiness): string {
  switch (r) {
    case "Cleared":   return "#00FF88";
    case "Caution":   return "#FFD700";
    case "Defensive": return "#FF2D55";
    default:          return "#94A3B8";
  }
}

function scoreColor(score: number): string {
  if (score >= 65) return "#00FF88";
  if (score >= 50) return "#64B5F6";
  if (score >= 35) return "#FFD700";
  return "#FF2D55";
}

function directionIcon(d: OutlookDirection) {
  switch (d) {
    case "Bullish": return <TrendingUp size={14} color="#00FF88" />;
    case "Bearish": return <TrendingDown size={14} color="#FF2D55" />;
    case "Neutral": return <Minus size={14} color="#64B5F6" />;
    case "Avoid":   return <AlertTriangle size={14} color="#FF9500" />;
    default:        return <Minus size={14} color="#94A3B8" />;
  }
}

// ── Tooltip component ─────────────────────────────────────────
function Tooltip({ text, children }: { text: string; children: React.ReactNode }) {
  const [show, setShow] = useState(false);
  return (
    <span
      style={{ position: "relative", display: "inline-flex", alignItems: "center" }}
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
    >
      {children}
      {show && (
        <span style={{
          position: "absolute",
          bottom: "calc(100% + 6px)",
          left: "50%",
          transform: "translateX(-50%)",
          background: "#1A1A2E",
          border: "1px solid rgba(255,255,255,0.12)",
          borderRadius: "6px",
          padding: "6px 10px",
          fontSize: "11px",
          color: "#CBD5E1",
          maxWidth: "260px",
          whiteSpace: "pre-wrap" as any,
          zIndex: 100,
          pointerEvents: "none",
          lineHeight: 1.5,
          boxShadow: "0 4px 20px rgba(0,0,0,0.5)",
        }}>
          {text}
        </span>
      )}
    </span>
  );
}

// ── InfoIcon with tooltip ─────────────────────────────────────
function InfoTip({ text }: { text: string }) {
  return (
    <Tooltip text={text}>
      <Info size={12} color="#4B5563" style={{ cursor: "help", marginLeft: 4, flexShrink: 0 }} />
    </Tooltip>
  );
}

// ── Section wrapper ───────────────────────────────────────────
function Section({
  title,
  icon,
  children,
  collapsible = false,
  defaultOpen = true,
  badge,
  badgeColor,
}: {
  title: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
  collapsible?: boolean;
  defaultOpen?: boolean;
  badge?: string;
  badgeColor?: string;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div style={{
      background: "rgba(255,255,255,0.03)",
      border: "1px solid rgba(255,255,255,0.07)",
      borderRadius: "10px",
      overflow: "hidden",
      marginBottom: "12px",
    }}>
      <div
        onClick={collapsible ? () => setOpen(o => !o) : undefined}
        style={{
          display: "flex",
          alignItems: "center",
          gap: "8px",
          padding: "12px 16px",
          borderBottom: open ? "1px solid rgba(255,255,255,0.06)" : "none",
          cursor: collapsible ? "pointer" : "default",
          userSelect: "none",
        }}
      >
        {icon && <span style={{ opacity: 0.7 }}>{icon}</span>}
        <span style={{
          fontFamily: "'IBM Plex Mono', monospace",
          fontSize: "11px",
          fontWeight: 600,
          letterSpacing: "0.1em",
          textTransform: "uppercase",
          color: "#94A3B8",
          flex: 1,
        }}>{title}</span>
        {badge && (
          <span style={{
            fontFamily: "'IBM Plex Mono', monospace",
            fontSize: "9px",
            fontWeight: 600,
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            color: badgeColor ?? "#00FF88",
            background: `${badgeColor ?? "#00FF88"}15`,
            border: `1px solid ${badgeColor ?? "#00FF88"}30`,
            borderRadius: "3px",
            padding: "2px 6px",
          }}>{badge}</span>
        )}
        {collapsible && (
          open ? <ChevronUp size={14} color="#4B5563" /> : <ChevronDown size={14} color="#4B5563" />
        )}
      </div>
      {open && <div style={{ padding: "14px 16px" }}>{children}</div>}
    </div>
  );
}

// ── Score bar ─────────────────────────────────────────────────
function ScoreBar({ score, label, weight, note }: { score: number; label: string; weight: number; note: string }) {
  const color = scoreColor(score);
  return (
    <Tooltip text={note}>
      <div style={{ marginBottom: "8px", cursor: "help" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
          <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "10px", color: "#94A3B8" }}>{label}</span>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "9px", color: "#4B5563" }}>
              ×{(weight * 100).toFixed(0)}%
            </span>
            <span style={{ fontFamily: "'Rajdhani', sans-serif", fontSize: "13px", fontWeight: 700, color }}>{score}</span>
          </div>
        </div>
        <div style={{ height: "3px", background: "rgba(255,255,255,0.06)", borderRadius: "2px", overflow: "hidden" }}>
          <div style={{
            height: "100%",
            width: `${score}%`,
            background: color,
            borderRadius: "2px",
            boxShadow: `0 0 6px ${color}60`,
            transition: "width 0.8s cubic-bezier(0.23, 1, 0.32, 1)",
          }} />
        </div>
      </div>
    </Tooltip>
  );
}

// ── Outlook Score Ring ────────────────────────────────────────
function OutlookScoreRing({ score, direction }: { score: number; direction: OutlookDirection }) {
  const color = directionColor(direction);
  const size = 100;
  const radius = 40;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference * (1 - score / 100);
  return (
    <div style={{ position: "relative", width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
        <circle cx={size/2} cy={size/2} r={radius} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="6" />
        <circle
          cx={size/2} cy={size/2} r={radius} fill="none"
          stroke={color} strokeWidth="6" strokeLinecap="round"
          strokeDasharray={circumference} strokeDashoffset={dashOffset}
          style={{ transition: "stroke-dashoffset 1.2s cubic-bezier(0.23,1,0.32,1)", filter: `drop-shadow(0 0 8px ${color}80)` }}
        />
      </svg>
      <div style={{
        position: "absolute", inset: 0,
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
      }}>
        <span style={{
          fontFamily: "'Rajdhani', sans-serif", fontWeight: 700, fontSize: "22px",
          color, textShadow: `0 0 14px ${color}80`, lineHeight: 1,
        }}>{score}</span>
        <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "8px", color: "#4B5563", lineHeight: 1, marginTop: "2px" }}>/ 100</span>
      </div>
    </div>
  );
}

// ── Top Opportunity Card ──────────────────────────────────────
function TopOpportunityCard({
  opp,
  onSelect,
}: {
  opp: {
    symbol: string;
    name: string;
    assetType: "stock" | "crypto";
    outlookScore: number;
    direction: OutlookDirection;
    confidence: number;
    riskLevel: OutlookRiskLevel;
    regimeAlignment: string;
    topReason: string;
  };
  onSelect: (symbol: string, assetType: "stock" | "crypto") => void;
}) {
  const color = directionColor(opp.direction);
  return (
    <div
      onClick={() => onSelect(opp.symbol, opp.assetType)}
      style={{
        background: "rgba(255,255,255,0.03)",
        border: `1px solid ${color}20`,
        borderRadius: "8px",
        padding: "12px",
        cursor: "pointer",
        transition: "all 0.18s cubic-bezier(0.23,1,0.32,1)",
        display: "flex",
        flexDirection: "column",
        gap: "8px",
      }}
      onMouseEnter={e => {
        (e.currentTarget as HTMLDivElement).style.background = `${color}08`;
        (e.currentTarget as HTMLDivElement).style.borderColor = `${color}40`;
      }}
      onMouseLeave={e => {
        (e.currentTarget as HTMLDivElement).style.background = "rgba(255,255,255,0.03)";
        (e.currentTarget as HTMLDivElement).style.borderColor = `${color}20`;
      }}
    >
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <TickerChip ticker={opp.symbol} name={opp.name} assetType={opp.assetType} />
            <span style={{
              fontFamily: "'IBM Plex Mono', monospace", fontSize: "8px",
              color: opp.assetType === "crypto" ? "#F7931A" : "#64B5F6",
              background: opp.assetType === "crypto" ? "rgba(247,147,26,0.1)" : "rgba(100,181,246,0.1)",
              border: `1px solid ${opp.assetType === "crypto" ? "rgba(247,147,26,0.2)" : "rgba(100,181,246,0.2)"}`,
              borderRadius: "2px", padding: "1px 4px", letterSpacing: "0.08em",
            }}>
              {opp.assetType === "crypto" ? "CRYPTO" : "STOCK"}
            </span>
          </div>
          <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "9px", color: "#4B5563", marginTop: "2px" }}>
            {opp.name}
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontFamily: "'Rajdhani', sans-serif", fontWeight: 700, fontSize: "18px", color }}>
            {opp.outlookScore}
          </div>
          <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "8px", color: "#4B5563" }}>score</div>
        </div>
      </div>

      {/* Direction + Risk */}
      <div style={{ display: "flex", gap: "6px", alignItems: "center", flexWrap: "wrap" }}>
        <span style={{
          display: "flex", alignItems: "center", gap: "4px",
          fontFamily: "'IBM Plex Mono', monospace", fontSize: "9px", fontWeight: 600,
          color, background: `${color}12`, border: `1px solid ${color}25`,
          borderRadius: "3px", padding: "2px 6px", letterSpacing: "0.08em",
        }}>
          {directionIcon(opp.direction)} {opp.direction.toUpperCase()}
        </span>
        <span style={{
          fontFamily: "'IBM Plex Mono', monospace", fontSize: "9px",
          color: riskColor(opp.riskLevel),
          background: `${riskColor(opp.riskLevel)}10`,
          border: `1px solid ${riskColor(opp.riskLevel)}20`,
          borderRadius: "3px", padding: "2px 6px",
        }}>
          {opp.riskLevel.toUpperCase()} RISK
        </span>
        <span style={{
          fontFamily: "'IBM Plex Mono', monospace", fontSize: "9px",
          color: "#4B5563",
        }}>
          {opp.confidence}% conf
        </span>
      </div>

      {/* Top reason */}
      <div style={{
        fontFamily: "'IBM Plex Mono', monospace", fontSize: "9px",
        color: "#6B7280", lineHeight: 1.5,
        borderTop: "1px solid rgba(255,255,255,0.05)",
        paddingTop: "6px",
      }}>
        {opp.topReason}
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: "4px", justifyContent: "flex-end" }}>
        <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "9px", color: "#4B5563" }}>View Outlook</span>
        <ArrowRight size={10} color="#4B5563" />
      </div>
    </div>
  );
}

// ── Full Outlook View ─────────────────────────────────────────
function FullOutlookView({
  symbol,
  assetType,
  timeframe,
  onBack,
}: {
  symbol: string;
  assetType: "stock" | "crypto";
  timeframe: OutlookTimeframe;
  onBack: () => void;
}) {
  const { data, isLoading, error, refetch } = trpc.outlook.getOutlook.useQuery(
    { symbol, assetType, timeframe },
    { staleTime: 8 * 60 * 1000 }
  );

  if (isLoading) {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "300px", gap: "12px" }}>
        <RefreshCw size={24} color="#00D4FF" style={{ animation: "spin 1s linear infinite" }} />
        <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "11px", color: "#4B5563" }}>
          Computing outlook for {symbol}...
        </span>
        <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div style={{ textAlign: "center", padding: "40px 20px" }}>
        <AlertTriangle size={32} color="#FF9500" style={{ marginBottom: "12px" }} />
        <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "12px", color: "#FF9500" }}>
          Unable to compute outlook for {symbol}
        </div>
        <button onClick={onBack} style={{
          marginTop: "16px",
          fontFamily: "'IBM Plex Mono', monospace", fontSize: "10px",
          color: "#64B5F6", background: "transparent", border: "1px solid rgba(100,181,246,0.3)",
          borderRadius: "4px", padding: "6px 12px", cursor: "pointer",
        }}>← Back</button>
      </div>
    );
  }

  const d = data;
  const dirColor = directionColor(d.direction);
  const rkColor = riskColor(d.riskLevel);
  const rdColor = readinessColor(d.tradeReadiness);

  return (
    <div>
      {/* Back + refresh */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
        <button onClick={onBack} style={{
          fontFamily: "'IBM Plex Mono', monospace", fontSize: "10px",
          color: "#64B5F6", background: "transparent", border: "1px solid rgba(100,181,246,0.2)",
          borderRadius: "4px", padding: "5px 10px", cursor: "pointer",
          display: "flex", alignItems: "center", gap: "4px",
        }}>
          ← Back to Overview
        </button>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          {d.cached && (
            <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "9px", color: "#4B5563" }}>CACHED</span>
          )}
          <span style={{
            fontFamily: "'IBM Plex Mono', monospace", fontSize: "9px",
            color: d.dataStatus === "Live" ? "#00FF88" : "#FFD700",
            background: d.dataStatus === "Live" ? "rgba(0,255,136,0.08)" : "rgba(255,215,0,0.08)",
            border: `1px solid ${d.dataStatus === "Live" ? "rgba(0,255,136,0.2)" : "rgba(255,215,0,0.2)"}`,
            borderRadius: "3px", padding: "2px 6px",
          }}>{d.dataStatus.toUpperCase()}</span>
          <button onClick={() => refetch()} style={{
            background: "transparent", border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: "4px", padding: "4px 6px", cursor: "pointer",
          }}>
            <RefreshCw size={12} color="#4B5563" />
          </button>
        </div>
      </div>

      {/* ── OUTLOOK CARD ── */}
      <div style={{
        background: `linear-gradient(135deg, ${dirColor}08 0%, rgba(0,0,0,0) 60%)`,
        border: `1px solid ${dirColor}25`,
        borderRadius: "12px",
        padding: "20px",
        marginBottom: "12px",
        display: "flex",
        gap: "20px",
        alignItems: "flex-start",
        flexWrap: "wrap",
      }}>
        <OutlookScoreRing score={d.outlookScore} direction={d.direction} />

        <div style={{ flex: 1, minWidth: "200px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px", flexWrap: "wrap" }}>
            <TickerChip ticker={d.symbol} name={d.name} assetType={d.assetType} />
            <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "11px", color: "#94A3B8" }}>
              {d.name}
            </span>
            <span style={{
              fontFamily: "'IBM Plex Mono', monospace", fontSize: "8px",
              color: d.assetType === "crypto" ? "#F7931A" : "#64B5F6",
              background: d.assetType === "crypto" ? "rgba(247,147,26,0.1)" : "rgba(100,181,246,0.1)",
              border: `1px solid ${d.assetType === "crypto" ? "rgba(247,147,26,0.2)" : "rgba(100,181,246,0.2)"}`,
              borderRadius: "2px", padding: "2px 5px",
            }}>
              {d.assetType === "crypto" ? "CRYPTO" : "STOCK"}
            </span>
          </div>

          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginBottom: "10px" }}>
            <span style={{
              display: "flex", alignItems: "center", gap: "4px",
              fontFamily: "'IBM Plex Mono', monospace", fontSize: "10px", fontWeight: 600,
              color: dirColor, background: `${dirColor}12`, border: `1px solid ${dirColor}25`,
              borderRadius: "3px", padding: "3px 8px",
            }}>
              {directionIcon(d.direction)} {d.direction.toUpperCase()}
            </span>
            <span style={{
              fontFamily: "'IBM Plex Mono', monospace", fontSize: "10px",
              color: rkColor, background: `${rkColor}10`, border: `1px solid ${rkColor}20`,
              borderRadius: "3px", padding: "3px 8px",
            }}>
              {d.riskLevel.toUpperCase()} RISK
            </span>
            <span style={{
              fontFamily: "'IBM Plex Mono', monospace", fontSize: "10px",
              color: rdColor, background: `${rdColor}10`, border: `1px solid ${rdColor}20`,
              borderRadius: "3px", padding: "3px 8px",
            }}>
              {d.tradeReadiness.toUpperCase()}
            </span>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))", gap: "8px" }}>
            {[
              { label: "Confidence", value: `${d.confidence}%`, tip: "How strongly the 8-factor model agrees on the direction. Higher = more conviction." },
              { label: "Time Horizon", value: d.timeHorizon, tip: "The timeframe this outlook is calibrated for." },
              { label: "Regime", value: d.regimeAlignment, tip: "Whether the current FAULTLINE regime supports or opposes this outlook." },
              { label: "Generated", value: new Date(d.generatedAt).toLocaleTimeString(), tip: "When this outlook was computed." },
            ].map(item => (
              <div key={item.label} style={{
                background: "rgba(255,255,255,0.03)",
                border: "1px solid rgba(255,255,255,0.06)",
                borderRadius: "6px", padding: "8px 10px",
              }}>
                <div style={{ display: "flex", alignItems: "center" }}>
                  <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "8px", color: "#4B5563", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                    {item.label}
                  </span>
                  <InfoTip text={item.tip} />
                </div>
                <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "11px", color: "#CBD5E1", marginTop: "3px" }}>
                  {item.value}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── CALCULATED PRICE LEVELS ── */}
      <div style={{ marginBottom: "12px" }}>
        {d.calculatedLevels.available ? (
          <div style={{
            background: "rgba(0,0,0,0.4)",
            border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: "12px",
            overflow: "hidden",
          }}>
            {/* Header */}
            <div style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              padding: "12px 16px",
              borderBottom: "1px solid rgba(255,255,255,0.06)",
              background: "rgba(255,255,255,0.02)",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <Target size={14} color="#00D4FF" />
                <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "11px", fontWeight: 700, color: "#E2E8F0", letterSpacing: "0.06em" }}>CALCULATED PRICE LEVELS</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                {d.calculatedLevels.atrPct != null && (
                  <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "9px", color: "#4B5563" }}>ATR {d.calculatedLevels.atrPct}%</span>
                )}
                <span style={{
                  fontFamily: "'IBM Plex Mono', monospace", fontSize: "8px",
                  color: d.calculatedLevels.dataQuality === "full" ? "#00FF88" : d.calculatedLevels.dataQuality === "partial" ? "#FFD700" : "#FF9500",
                  background: d.calculatedLevels.dataQuality === "full" ? "rgba(0,255,136,0.08)" : d.calculatedLevels.dataQuality === "partial" ? "rgba(255,215,0,0.08)" : "rgba(255,149,0,0.08)",
                  border: `1px solid ${d.calculatedLevels.dataQuality === "full" ? "rgba(0,255,136,0.2)" : d.calculatedLevels.dataQuality === "partial" ? "rgba(255,215,0,0.2)" : "rgba(255,149,0,0.2)"}`,
                  borderRadius: "3px", padding: "2px 6px",
                }}>{d.calculatedLevels.barsUsed}D DATA</span>
              </div>
            </div>

            {/* Current Price + Key Indicators */}
            <div style={{ padding: "12px 16px", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(110px, 1fr))", gap: "8px" }}>
                {[
                  { label: "CURRENT PRICE", value: d.calculatedLevels.currentPrice != null ? `$${d.calculatedLevels.currentPrice < 1 ? d.calculatedLevels.currentPrice.toFixed(4) : d.calculatedLevels.currentPrice.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "—", color: "#F1F5F9" },
                  { label: "PIVOT POINT", value: d.calculatedLevels.pivotPoint != null ? `$${d.calculatedLevels.pivotPoint < 1 ? d.calculatedLevels.pivotPoint.toFixed(4) : d.calculatedLevels.pivotPoint.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "—", color: "#94A3B8" },
                  { label: "SMA-20", value: d.calculatedLevels.sma20 != null ? `$${d.calculatedLevels.sma20 < 1 ? d.calculatedLevels.sma20.toFixed(4) : d.calculatedLevels.sma20.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "—", color: d.calculatedLevels.sma20 != null && d.calculatedLevels.currentPrice != null ? (d.calculatedLevels.currentPrice > d.calculatedLevels.sma20 ? "#00FF88" : "#FF2D55") : "#94A3B8" },
                  { label: "SMA-50", value: d.calculatedLevels.sma50 != null ? `$${d.calculatedLevels.sma50 < 1 ? d.calculatedLevels.sma50.toFixed(4) : d.calculatedLevels.sma50.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "—", color: d.calculatedLevels.sma50 != null && d.calculatedLevels.currentPrice != null ? (d.calculatedLevels.currentPrice > d.calculatedLevels.sma50 ? "#00FF88" : "#FF2D55") : "#94A3B8" },
                  { label: "SMA-200", value: d.calculatedLevels.sma200 != null ? `$${d.calculatedLevels.sma200 < 1 ? d.calculatedLevels.sma200.toFixed(4) : d.calculatedLevels.sma200.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "—", color: d.calculatedLevels.sma200 != null && d.calculatedLevels.currentPrice != null ? (d.calculatedLevels.currentPrice > d.calculatedLevels.sma200 ? "#00FF88" : "#FF2D55") : "#94A3B8" },
                  { label: "52W HIGH", value: d.calculatedLevels.weekHigh52 != null ? `$${d.calculatedLevels.weekHigh52 < 1 ? d.calculatedLevels.weekHigh52.toFixed(4) : d.calculatedLevels.weekHigh52.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "—", color: "#FF9500" },
                  { label: "52W LOW", value: d.calculatedLevels.weekLow52 != null ? `$${d.calculatedLevels.weekLow52 < 1 ? d.calculatedLevels.weekLow52.toFixed(4) : d.calculatedLevels.weekLow52.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "—", color: "#64B5F6" },
                  { label: "BOLL UPPER", value: d.calculatedLevels.bollingerUpper != null ? `$${d.calculatedLevels.bollingerUpper < 1 ? d.calculatedLevels.bollingerUpper.toFixed(4) : d.calculatedLevels.bollingerUpper.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "—", color: "#A78BFA" },
                  { label: "BOLL LOWER", value: d.calculatedLevels.bollingerLower != null ? `$${d.calculatedLevels.bollingerLower < 1 ? d.calculatedLevels.bollingerLower.toFixed(4) : d.calculatedLevels.bollingerLower.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "—", color: "#A78BFA" },
                ].map(item => (
                  <div key={item.label} style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)", borderRadius: "6px", padding: "8px 10px" }}>
                    <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "8px", color: "#4B5563", letterSpacing: "0.08em", marginBottom: "3px" }}>{item.label}</div>
                    <div style={{ fontFamily: "'Rajdhani', sans-serif", fontWeight: 700, fontSize: "13px", color: item.color }}>{item.value}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Support + Resistance side by side */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
              {/* Support */}
              <div style={{ padding: "12px 16px", borderRight: "1px solid rgba(255,255,255,0.04)" }}>
                <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "9px", color: "#00FF88", letterSpacing: "0.08em", marginBottom: "8px", display: "flex", alignItems: "center", gap: "6px" }}>
                  <span style={{ display: "inline-block", width: "6px", height: "6px", borderRadius: "50%", background: "#00FF88" }} />
                  SUPPORT LEVELS
                </div>
                {[
                  { key: "S1", level: d.calculatedLevels.supportResistance.support1 },
                  { key: "S2", level: d.calculatedLevels.supportResistance.support2 },
                  { key: "S3", level: d.calculatedLevels.supportResistance.support3 },
                ].map(({ key, level }) => level ? (
                  <div key={key} style={{ marginBottom: "8px" }} title={level.description}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "8px", color: "#00FF8880", letterSpacing: "0.06em" }}>{key} · {level.method}</span>
                      <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "9px", color: "#00FF8899" }}>{level.pctFromCurrent.toFixed(1)}%</span>
                    </div>
                    <div style={{ fontFamily: "'Rajdhani', sans-serif", fontWeight: 700, fontSize: "16px", color: "#00FF88" }}>
                      ${level.price < 1 ? level.price.toFixed(4) : level.price.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </div>
                    <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "8px", color: "#4B5563", marginTop: "1px" }}>{level.description}</div>
                  </div>
                ) : (
                  <div key={key} style={{ marginBottom: "8px" }}>
                    <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "8px", color: "#374151" }}>{key} · —</div>
                  </div>
                ))}
              </div>

              {/* Resistance */}
              <div style={{ padding: "12px 16px" }}>
                <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "9px", color: "#FF2D55", letterSpacing: "0.08em", marginBottom: "8px", display: "flex", alignItems: "center", gap: "6px" }}>
                  <span style={{ display: "inline-block", width: "6px", height: "6px", borderRadius: "50%", background: "#FF2D55" }} />
                  RESISTANCE LEVELS
                </div>
                {[
                  { key: "R1", level: d.calculatedLevels.supportResistance.resistance1 },
                  { key: "R2", level: d.calculatedLevels.supportResistance.resistance2 },
                  { key: "R3", level: d.calculatedLevels.supportResistance.resistance3 },
                ].map(({ key, level }) => level ? (
                  <div key={key} style={{ marginBottom: "8px" }} title={level.description}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "8px", color: "#FF2D5580", letterSpacing: "0.06em" }}>{key} · {level.method}</span>
                      <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "9px", color: "#FF2D5599" }}>+{level.pctFromCurrent.toFixed(1)}%</span>
                    </div>
                    <div style={{ fontFamily: "'Rajdhani', sans-serif", fontWeight: 700, fontSize: "16px", color: "#FF2D55" }}>
                      ${level.price < 1 ? level.price.toFixed(4) : level.price.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </div>
                    <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "8px", color: "#4B5563", marginTop: "1px" }}>{level.description}</div>
                  </div>
                ) : (
                  <div key={key} style={{ marginBottom: "8px" }}>
                    <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "8px", color: "#374151" }}>{key} · —</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Trade Framework: Entry / Risk / Targets / Invalidation */}
            <div style={{ padding: "12px 16px", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
              <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "9px", color: "#64B5F6", letterSpacing: "0.08em", marginBottom: "10px" }}>TRADE FRAMEWORK</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: "8px" }}>
                {[
                  { label: "ENTRY ZONE", level: d.calculatedLevels.tradeFramework.entryZone, color: "#00FF88", border: "rgba(0,255,136,0.2)", bg: "rgba(0,255,136,0.04)" },
                  { label: "RISK ZONE", level: d.calculatedLevels.tradeFramework.riskZone, color: "#FF2D55", border: "rgba(255,45,85,0.2)", bg: "rgba(255,45,85,0.04)" },
                  { label: "PROFIT TARGET 1", level: d.calculatedLevels.tradeFramework.profitTarget1, color: "#00D4FF", border: "rgba(0,212,255,0.2)", bg: "rgba(0,212,255,0.04)" },
                  { label: "PROFIT TARGET 2", level: d.calculatedLevels.tradeFramework.profitTarget2, color: "#00D4FF", border: "rgba(0,212,255,0.2)", bg: "rgba(0,212,255,0.03)" },
                  { label: "STRETCH TARGET", level: d.calculatedLevels.tradeFramework.stretchTarget, color: "#A78BFA", border: "rgba(167,139,250,0.2)", bg: "rgba(167,139,250,0.04)" },
                  { label: "INVALIDATION", level: d.calculatedLevels.tradeFramework.invalidationLevel, color: "#FF9500", border: "rgba(255,149,0,0.2)", bg: "rgba(255,149,0,0.04)" },
                ].map(item => item.level ? (
                  <div key={item.label} style={{ background: item.bg, border: `1px solid ${item.border}`, borderRadius: "8px", padding: "10px 12px" }} title={item.level.description}>
                    <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "8px", color: item.color, letterSpacing: "0.08em", marginBottom: "4px" }}>{item.label}</div>
                    <div style={{ fontFamily: "'Rajdhani', sans-serif", fontWeight: 700, fontSize: "18px", color: item.color }}>
                      ${item.level.price < 1 ? item.level.price.toFixed(4) : item.level.price.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "2px" }}>
                      <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "8px", color: "#4B5563" }}>{item.level.method}</span>
                      <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "9px", color: item.color + "99" }}>
                        {item.level.pctFromCurrent > 0 ? "+" : ""}{item.level.pctFromCurrent.toFixed(1)}%
                      </span>
                    </div>
                    <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "8px", color: "#374151", marginTop: "3px", lineHeight: 1.4 }}>{item.level.description}</div>
                  </div>
                ) : null)}
              </div>
            </div>

            {/* Timeframe-Specific Levels */}
            {(() => {
              const tf = d.timeframe;
              const tfl = d.calculatedLevels.timeframeSpecific;
              const tfData = tf === "day" ? [
                { label: "INTRADAY SUPPORT", level: tfl.day.intradaySupport, color: "#00FF88" },
                { label: "INTRADAY RESISTANCE", level: tfl.day.intradayResistance, color: "#FF2D55" },
                { label: "DAY TARGET 1", level: tfl.day.dayTradeTarget1, color: "#00D4FF" },
                { label: "DAY TARGET 2", level: tfl.day.dayTradeTarget2, color: "#00D4FF" },
                { label: "INTRADAY INVALIDATION", level: tfl.day.intradayInvalidation, color: "#FF9500" },
              ] : tf === "short" ? [
                { label: "NEAR-TERM SUPPORT", level: tfl.short.nearTermSupport, color: "#00FF88" },
                { label: "NEAR-TERM RESISTANCE", level: tfl.short.nearTermResistance, color: "#FF2D55" },
                { label: "TARGET 1", level: tfl.short.target1, color: "#00D4FF" },
                { label: "TARGET 2", level: tfl.short.target2, color: "#00D4FF" },
                { label: "RISK LEVEL", level: tfl.short.riskLevel, color: "#FF9500" },
              ] : tf === "swing" ? [
                { label: "SWING SUPPORT", level: tfl.swing.swingSupport, color: "#00FF88" },
                { label: "SWING RESISTANCE", level: tfl.swing.swingResistance, color: "#FF2D55" },
                { label: "SWING TARGET 1", level: tfl.swing.swingTarget1, color: "#00D4FF" },
                { label: "SWING TARGET 2", level: tfl.swing.swingTarget2, color: "#00D4FF" },
                { label: "SWING INVALIDATION", level: tfl.swing.swingInvalidation, color: "#FF9500" },
              ] : [
                { label: "LT SUPPORT ZONE", level: tfl.long.longTermSupportZone, color: "#00FF88" },
                { label: "LT RESISTANCE ZONE", level: tfl.long.longTermResistanceZone, color: "#FF2D55" },
                { label: "LT TARGET (LOW)", level: tfl.long.longTermTargetLow, color: "#00D4FF" },
                { label: "LT TARGET (HIGH)", level: tfl.long.longTermTargetHigh, color: "#A78BFA" },
                { label: "LT INVALIDATION", level: tfl.long.longTermInvalidation, color: "#FF9500" },
              ];
              return (
                <div style={{ padding: "12px 16px" }}>
                  <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "9px", color: "#94A3B8", letterSpacing: "0.08em", marginBottom: "10px" }}>
                    {tf === "day" ? "INTRADAY LEVELS" : tf === "short" ? "SHORT-TERM LEVELS (1–5 DAYS)" : tf === "swing" ? "SWING LEVELS (1–6 WEEKS)" : "LONG-TERM LEVELS (3–12 MONTHS)"}
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))", gap: "8px" }}>
                    {tfData.map(item => item.level ? (
                      <div key={item.label} style={{ background: "rgba(255,255,255,0.02)", border: `1px solid ${item.color}25`, borderRadius: "6px", padding: "8px 10px" }} title={item.level.description}>
                        <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "8px", color: item.color + "99", letterSpacing: "0.08em", marginBottom: "3px" }}>{item.label}</div>
                        <div style={{ fontFamily: "'Rajdhani', sans-serif", fontWeight: 700, fontSize: "15px", color: item.color }}>
                          ${item.level.price < 1 ? item.level.price.toFixed(4) : item.level.price.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </div>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "2px" }}>
                          <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "8px", color: "#374151" }}>{item.level.method}</span>
                          <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "8px", color: item.color + "88" }}>
                            {item.level.pctFromCurrent > 0 ? "+" : ""}{item.level.pctFromCurrent.toFixed(1)}%
                          </span>
                        </div>
                      </div>
                    ) : null)}
                  </div>
                </div>
              );
            })()}
          </div>
        ) : (
          <div style={{
            background: "rgba(0,0,0,0.3)",
            border: "1px solid rgba(255,255,255,0.06)",
            borderRadius: "8px",
            padding: "16px",
            display: "flex",
            alignItems: "center",
            gap: "10px",
          }}>
            <Target size={16} color="#4B5563" />
            <div>
              <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "10px", color: "#6B7280", fontWeight: 700, marginBottom: "3px" }}>CALCULATED LEVELS UNAVAILABLE</div>
              <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "9px", color: "#4B5563" }}>
                {d.calculatedLevels.insufficientDataReason ?? "Insufficient market data to calculate price levels for this asset."}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── FAULTLINE ENVIRONMENT ── */}
      <Section
        title="FAULTLINE Environment"
        icon={<Activity size={14} color="#00D4FF" />}
        badge={`PRESSURE ${d.environment.pressureIndex}`}
        badgeColor={d.environment.pressureIndex > 65 ? "#FF2D55" : d.environment.pressureIndex > 45 ? "#FFD700" : "#00FF88"}
      >
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))", gap: "8px", marginBottom: "12px" }}>
          {[
            { label: "Pressure Index", value: `${d.environment.pressureIndex}/100`, color: scoreColor(100 - d.environment.pressureIndex), tip: "FAULTLINE composite macro stress score. Higher = more systemic risk." },
            { label: "Trend", value: d.environment.pressureTrend, color: d.environment.pressureTrend === "Rising" ? "#FF2D55" : d.environment.pressureTrend === "Falling" ? "#00FF88" : "#64B5F6", tip: "Direction of recent pressure change." },
            { label: "Regime", value: d.environment.regimeLabel, color: "#94A3B8", tip: "Current FAULTLINE regime classification." },
            { label: "Bull Probability", value: `${d.environment.bullProbability}%`, color: "#00FF88", tip: "Estimated probability of bullish conditions based on current pressure." },
            { label: "Bear Probability", value: `${d.environment.bearProbability}%`, color: "#FF2D55", tip: "Estimated probability of bearish conditions based on current pressure." },
          ].map(item => (
            <div key={item.label} style={{
              background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)",
              borderRadius: "6px", padding: "8px 10px",
            }}>
              <div style={{ display: "flex", alignItems: "center" }}>
                <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "8px", color: "#4B5563", textTransform: "uppercase", letterSpacing: "0.08em" }}>{item.label}</span>
                <InfoTip text={item.tip} />
              </div>
              <div style={{ fontFamily: "'Rajdhani', sans-serif", fontWeight: 700, fontSize: "14px", color: item.color, marginTop: "3px" }}>{item.value}</div>
            </div>
          ))}
        </div>
        <div style={{
          background: "rgba(0,212,255,0.04)", border: "1px solid rgba(0,212,255,0.12)",
          borderRadius: "6px", padding: "10px 12px",
          fontFamily: "'IBM Plex Mono', monospace", fontSize: "11px", color: "#94A3B8", lineHeight: 1.6,
        }}>
          {d.environment.environmentImpact}
        </div>
      </Section>

      {/* ── SCORE BREAKDOWN ── */}
      <Section
        title="8-Factor Score Breakdown"
        icon={<BarChart2 size={14} color="#64B5F6" />}
        collapsible
        defaultOpen
      >
        <div style={{ marginBottom: "10px", display: "flex", alignItems: "center", gap: "8px" }}>
          <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "10px", color: "#4B5563" }}>Composite Score:</span>
          <span style={{ fontFamily: "'Rajdhani', sans-serif", fontWeight: 700, fontSize: "18px", color: scoreColor(d.outlookScore) }}>
            {d.outlookScore}/100
          </span>
          <InfoTip text="Weighted average of all 8 factors. Each factor is scored 0–100 (higher = more bullish). Weights are shown as ×%." />
        </div>
        {d.scoreBreakdown.factors.map(f => (
          <ScoreBar key={f.name} score={f.score} label={f.name} weight={f.weight} note={f.note} />
        ))}
      </Section>

      {/* ── WHY THIS OUTLOOK ── */}
      <Section
        title="Why This Outlook"
        icon={<Brain size={14} color="#A78BFA" />}
        badge="AI INTERPRETATION"
        badgeColor="#A78BFA"
      >
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginBottom: "12px" }}>
          <div style={{
            background: "rgba(0,255,136,0.04)", border: "1px solid rgba(0,255,136,0.12)",
            borderRadius: "6px", padding: "10px 12px",
          }}>
            <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "9px", color: "#00FF88", marginBottom: "6px", letterSpacing: "0.08em" }}>
              BULL CASE
            </div>
            <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "11px", color: "#94A3B8", lineHeight: 1.6 }}>
              {d.whyBullish}
            </div>
          </div>
          <div style={{
            background: "rgba(255,45,85,0.04)", border: "1px solid rgba(255,45,85,0.12)",
            borderRadius: "6px", padding: "10px 12px",
          }}>
            <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "9px", color: "#FF2D55", marginBottom: "6px", letterSpacing: "0.08em" }}>
              BEAR CASE
            </div>
            <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "11px", color: "#94A3B8", lineHeight: 1.6 }}>
              {d.whyBearish}
            </div>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: "8px" }}>
          {[
            { label: "Momentum", value: d.momentumCondition, icon: <TrendingUp size={10} color="#64B5F6" />, tip: "Current momentum conditions for this asset." },
            { label: "Volume", value: d.volumeCondition, icon: <BarChart2 size={10} color="#64B5F6" />, tip: "Volume activity relative to historical norms." },
            { label: "Liquidity", value: d.liquidityCondition, icon: <Layers size={10} color="#64B5F6" />, tip: "Market liquidity conditions affecting this asset." },
            { label: "Volatility", value: d.volatilityCondition, icon: <Activity size={10} color="#64B5F6" />, tip: "Current volatility environment." },
            { label: "Macro", value: d.macroCondition, icon: <Zap size={10} color="#64B5F6" />, tip: "Macro-economic conditions from FAULTLINE pressure engine." },
          ].map(item => (
            <div key={item.label} style={{
              background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)",
              borderRadius: "6px", padding: "8px 10px",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: "4px", marginBottom: "4px" }}>
                {item.icon}
                <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "8px", color: "#4B5563", textTransform: "uppercase", letterSpacing: "0.08em" }}>{item.label}</span>
                <InfoTip text={item.tip} />
              </div>
              <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "10px", color: "#94A3B8", lineHeight: 1.5 }}>{item.value}</div>
            </div>
          ))}
        </div>

        {d.mainDrivers.length > 0 && (
          <div style={{ marginTop: "10px" }}>
            <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "9px", color: "#4B5563", marginBottom: "6px", letterSpacing: "0.08em" }}>
              MAIN DRIVERS
            </div>
            {d.mainDrivers.map((driver, i) => (
              <div key={i} style={{
                display: "flex", alignItems: "flex-start", gap: "6px",
                fontFamily: "'IBM Plex Mono', monospace", fontSize: "10px", color: "#94A3B8",
                lineHeight: 1.5, marginBottom: "4px",
              }}>
                <span style={{ color: "#4B5563", flexShrink: 0 }}>→</span>
                {driver}
              </div>
            ))}
          </div>
        )}
      </Section>

      {/* ── WHAT COULD CHANGE THIS ── */}
      <Section
        title="What Could Change This"
        icon={<AlertTriangle size={14} color="#FF9500" />}
        collapsible
      >
        {d.invalidationScenarios.map((scenario, i) => {
          const sevColor = scenario.severity === "Critical" ? "#FF2D55" : scenario.severity === "Major" ? "#FF9500" : "#FFD700";
          return (
            <div key={i} style={{
              display: "flex", gap: "10px", alignItems: "flex-start",
              padding: "8px 0",
              borderBottom: i < d.invalidationScenarios.length - 1 ? "1px solid rgba(255,255,255,0.04)" : "none",
            }}>
              <span style={{
                fontFamily: "'IBM Plex Mono', monospace", fontSize: "8px",
                color: sevColor, background: `${sevColor}10`, border: `1px solid ${sevColor}20`,
                borderRadius: "2px", padding: "2px 5px", flexShrink: 0, marginTop: "1px",
              }}>{scenario.severity.toUpperCase()}</span>
              <div>
                <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "10px", fontWeight: 600, color: "#CBD5E1", marginBottom: "2px" }}>
                  {scenario.trigger}
                </div>
                <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "10px", color: "#6B7280", lineHeight: 1.5 }}>
                  {scenario.description}
                </div>
              </div>
            </div>
          );
        })}
      </Section>

      {/* ── WHAT WOULD FAULTLINE DO ── */}
      <Section
        title="What Would FAULTLINE Do"
        icon={<Target size={14} color="#00D4FF" />}
        badge="SCENARIO ANALYSIS"
        badgeColor="#00D4FF"
        collapsible
      >
        <div style={{
          fontFamily: "'IBM Plex Mono', monospace", fontSize: "9px", color: "#4B5563",
          marginBottom: "10px", lineHeight: 1.5,
        }}>
          These are scenario frameworks, not investment advice. FAULTLINE does not recommend specific trades.
        </div>
        {d.scenarios.map(scenario => {
          const sColor = scenario.label === "Aggressive" ? "#FF9500" : scenario.label === "Balanced" ? "#64B5F6" : "#00FF88";
          return (
            <div key={scenario.label} style={{
              background: `${sColor}06`, border: `1px solid ${sColor}20`,
              borderRadius: "6px", padding: "10px 12px", marginBottom: "8px",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px" }}>
                <span style={{
                  fontFamily: "'IBM Plex Mono', monospace", fontSize: "9px", fontWeight: 600,
                  color: sColor, letterSpacing: "0.1em",
                }}>{scenario.label.toUpperCase()}</span>
                <div style={{ display: "flex", gap: "4px", flexWrap: "wrap" }}>
                  {scenario.assets.map(a => (
                    <span key={a} style={{
                      fontFamily: "'IBM Plex Mono', monospace", fontSize: "9px",
                      color: "#94A3B8", background: "rgba(255,255,255,0.04)",
                      border: "1px solid rgba(255,255,255,0.08)",
                      borderRadius: "2px", padding: "1px 5px",
                    }}>{a}</span>
                  ))}
                </div>
              </div>
              <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "10px", color: "#6B7280", lineHeight: 1.5 }}>
                {scenario.rationale}
              </div>
            </div>
          );
        })}
      </Section>

      {/* ── STOCK / CRYPTO SPECIFIC ANALYSIS ── */}
      {d.stockAnalysis && (
        <Section
          title="Stock Analysis"
          icon={<DollarSign size={14} color="#64B5F6" />}
          collapsible
        >
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: "8px" }}>
            {[
              { label: "Sector Strength", value: `${d.stockAnalysis.sectorStrength}/100`, tip: "Relative strength of the sector in current conditions." },
              { label: "Sector", value: d.stockAnalysis.sectorLabel, tip: "Sector classification and current risk level." },
              { label: "SPY Alignment", value: d.stockAnalysis.spyAlignment, tip: "Whether this stock's outlook aligns with the S&P 500." },
              { label: "QQQ Alignment", value: d.stockAnalysis.qqqAlignment, tip: "Whether this stock's outlook aligns with the Nasdaq 100." },
              { label: "Relative Strength", value: `${d.stockAnalysis.relativeStrength}/100`, tip: "Relative strength vs. the broader market." },
              { label: "Volume Trend", value: d.stockAnalysis.volumeTrend, tip: "Whether volume is expanding, contracting, or neutral." },
              { label: "Earnings Risk", value: d.stockAnalysis.earningsRisk, tip: "Risk from upcoming earnings events. 'Unknown' = no earnings date data available." },
              { label: "Macro Sensitivity", value: d.stockAnalysis.macroSensitivity, tip: "How sensitive this stock is to macro-economic changes." },
              { label: "Institutional", value: d.stockAnalysis.institutionalParticipation, tip: "Estimated level of institutional participation." },
            ].map(item => (
              <div key={item.label} style={{
                background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)",
                borderRadius: "6px", padding: "8px 10px",
              }}>
                <div style={{ display: "flex", alignItems: "center" }}>
                  <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "8px", color: "#4B5563", textTransform: "uppercase", letterSpacing: "0.08em" }}>{item.label}</span>
                  <InfoTip text={item.tip} />
                </div>
                <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "11px", color: "#CBD5E1", marginTop: "3px" }}>{item.value}</div>
              </div>
            ))}
          </div>
        </Section>
      )}

      {d.cryptoAnalysis && (
        <Section
          title="Crypto Analysis"
          icon={<Bitcoin size={14} color="#F7931A" />}
          collapsible
        >
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: "8px" }}>
            {[
              { label: "BTC Dom Trend", value: d.cryptoAnalysis.btcDominanceTrend, tip: "Direction of Bitcoin dominance — rising favors BTC, falling favors alts." },
              { label: "BTC Signal", value: d.cryptoAnalysis.btcDominanceSignal, tip: "Whether BTC or altcoins are currently favored by dominance dynamics." },
              { label: "ETH Leadership", value: d.cryptoAnalysis.ethLeadership, tip: "Whether ETH is leading or lagging the broader crypto market." },
              { label: "Alt Rotation", value: d.cryptoAnalysis.altRotationSignal, tip: "Whether capital is actively rotating into altcoins." },
              { label: "Liquidity", value: d.cryptoAnalysis.liquidityEnvironment, tip: "Overall crypto liquidity environment." },
              { label: "Crypto Regime", value: d.cryptoAnalysis.cryptoRegime, tip: "Current crypto market regime based on macro pressure." },
            ].map(item => (
              <div key={item.label} style={{
                background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)",
                borderRadius: "6px", padding: "8px 10px",
              }}>
                <div style={{ display: "flex", alignItems: "center" }}>
                  <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "8px", color: "#4B5563", textTransform: "uppercase", letterSpacing: "0.08em" }}>{item.label}</span>
                  <InfoTip text={item.tip} />
                </div>
                <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "11px", color: "#CBD5E1", marginTop: "3px" }}>{item.value}</div>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* ── DIAGNOSTIC AI 2.0 ── */}
      <Section
        title="Diagnostic AI 2.0 Integration"
        icon={<Brain size={14} color="#A78BFA" />}
        badge="AI"
        badgeColor="#A78BFA"
        collapsible
      >
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginBottom: "10px" }}>
          <div style={{ background: "rgba(0,255,136,0.04)", border: "1px solid rgba(0,255,136,0.12)", borderRadius: "6px", padding: "10px 12px" }}>
            <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "9px", color: "#00FF88", marginBottom: "6px" }}>BULL CASE</div>
            <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "10px", color: "#94A3B8", lineHeight: 1.6 }}>{d.diagnosticIntegration.bullCase}</div>
          </div>
          <div style={{ background: "rgba(255,45,85,0.04)", border: "1px solid rgba(255,45,85,0.12)", borderRadius: "6px", padding: "10px 12px" }}>
            <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "9px", color: "#FF2D55", marginBottom: "6px" }}>BEAR CASE</div>
            <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "10px", color: "#94A3B8", lineHeight: 1.6 }}>{d.diagnosticIntegration.bearCase}</div>
          </div>
        </div>
        {[
          { label: "Primary Driver", value: d.diagnosticIntegration.primaryDriver, tip: "The single most important factor driving this outlook." },
          { label: "Portfolio Implication", value: d.diagnosticIntegration.portfolioImplication, tip: "What this outlook means for a diversified portfolio." },
          { label: "Sensitive Trigger", value: d.diagnosticIntegration.sensitiveTrigger, tip: "The event most likely to change this outlook." },
          { label: "Macro Path", value: d.diagnosticIntegration.macroPath, tip: "The expected macro trajectory." },
          { label: "Historical Analog", value: d.diagnosticIntegration.historicalAnalog, tip: "A comparable historical market environment, if available." },
        ].map(item => (
          <div key={item.label} style={{
            display: "flex", gap: "8px", alignItems: "flex-start",
            padding: "6px 0",
            borderBottom: "1px solid rgba(255,255,255,0.04)",
          }}>
            <div style={{ display: "flex", alignItems: "center", minWidth: "140px", flexShrink: 0 }}>
              <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "9px", color: "#4B5563", textTransform: "uppercase", letterSpacing: "0.08em" }}>{item.label}</span>
              <InfoTip text={item.tip} />
            </div>
            <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "10px", color: "#94A3B8", lineHeight: 1.5 }}>{item.value}</span>
          </div>
        ))}
        <div style={{ marginTop: "8px", display: "flex", alignItems: "center", gap: "6px" }}>
          <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "9px", color: "#4B5563" }}>AI CONFIDENCE</span>
          <div style={{ flex: 1, height: "3px", background: "rgba(255,255,255,0.06)", borderRadius: "2px" }}>
            <div style={{ height: "100%", width: `${d.diagnosticIntegration.confidence}%`, background: "#A78BFA", borderRadius: "2px" }} />
          </div>
          <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "10px", color: "#A78BFA" }}>{d.diagnosticIntegration.confidence}%</span>
        </div>
      </Section>

      {/* ── MARKET PREFLIGHT IMPACT ── */}
      <Section
        title="Market Preflight Impact"
        icon={<Shield size={14} color="#00D4FF" />}
        collapsible
      >
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginBottom: "10px" }}>
          {d.preflightImpact.supportReasons.length > 0 && (
            <div style={{ background: "rgba(0,255,136,0.04)", border: "1px solid rgba(0,255,136,0.12)", borderRadius: "6px", padding: "10px 12px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "4px", marginBottom: "6px" }}>
                <CheckCircle size={10} color="#00FF88" />
                <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "9px", color: "#00FF88" }}>SUPPORTS</span>
              </div>
              {d.preflightImpact.supportReasons.map((r, i) => (
                <div key={i} style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "10px", color: "#94A3B8", lineHeight: 1.5, marginBottom: "3px" }}>→ {r}</div>
              ))}
            </div>
          )}
          {d.preflightImpact.oppositionReasons.length > 0 && (
            <div style={{ background: "rgba(255,45,85,0.04)", border: "1px solid rgba(255,45,85,0.12)", borderRadius: "6px", padding: "10px 12px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "4px", marginBottom: "6px" }}>
                <XCircle size={10} color="#FF2D55" />
                <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "9px", color: "#FF2D55" }}>OPPOSES</span>
              </div>
              {d.preflightImpact.oppositionReasons.map((r, i) => (
                <div key={i} style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "10px", color: "#94A3B8", lineHeight: 1.5, marginBottom: "3px" }}>→ {r}</div>
              ))}
            </div>
          )}
        </div>
        {d.preflightImpact.reviewBeforeEntering.length > 0 && (
          <div style={{ background: "rgba(255,149,0,0.04)", border: "1px solid rgba(255,149,0,0.12)", borderRadius: "6px", padding: "10px 12px" }}>
            <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "9px", color: "#FF9500", marginBottom: "6px" }}>REVIEW BEFORE ENTERING</div>
            {d.preflightImpact.reviewBeforeEntering.map((r, i) => (
              <div key={i} style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "10px", color: "#94A3B8", lineHeight: 1.5, marginBottom: "3px" }}>→ {r}</div>
            ))}
          </div>
        )}
      </Section>

      {/* ── TRADE FRAMEWORK ── */}
      <Section
        title="Trade Framework"
        icon={<Target size={14} color="#64B5F6" />}
        collapsible
      >
        {d.tradeFramework.noTradeRecommended ? (
          <div style={{
            background: "rgba(255,45,85,0.06)", border: "1px solid rgba(255,45,85,0.2)",
            borderRadius: "6px", padding: "12px",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "8px" }}>
              <AlertTriangle size={13} color="#FF2D55" />
              <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "11px", color: "#FF2D55", fontWeight: 700 }}>NO TRADE RECOMMENDED</span>
            </div>
            <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "10px", color: "#94A3B8", lineHeight: 1.6 }}>
              {d.tradeFramework.noTradeReason}
            </div>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>

            {/* Confidence + Risk + Max Hold row */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "8px" }}>
              {[
                { label: "PARAMETER CONFIDENCE", value: `${d.tradeFramework.parameterConfidence}/100`, color: d.tradeFramework.parameterConfidence >= 60 ? "#00FF88" : d.tradeFramework.parameterConfidence >= 40 ? "#FF9500" : "#FF2D55" },
                { label: "RISK RATING", value: d.tradeFramework.riskRating, color: d.tradeFramework.riskRating === "Low" ? "#00FF88" : d.tradeFramework.riskRating === "Moderate" ? "#64B5F6" : d.tradeFramework.riskRating === "High" ? "#FF9500" : "#FF2D55" },
                { label: "MAX HOLD TIME", value: d.tradeFramework.maxHoldTime, color: "#94A3B8" },
              ].map(item => (
                <div key={item.label} style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: "6px", padding: "8px 10px" }}>
                  <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "8px", color: "#4B5563", marginBottom: "4px", letterSpacing: "0.08em" }}>{item.label}</div>
                  <div style={{ fontFamily: "'Rajdhani', sans-serif", fontWeight: 700, fontSize: "13px", color: item.color }}>{item.value}</div>
                </div>
              ))}
            </div>

            {/* Entry Zone */}
            {d.tradeFramework.entryZone && (
              <div style={{ background: "rgba(0,255,136,0.04)", border: "1px solid rgba(0,255,136,0.15)", borderRadius: "6px", padding: "10px 12px" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "4px" }}>
                  <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "9px", color: "#00FF88", letterSpacing: "0.08em" }}>ENTRY ZONE</div>
                  {d.tradeFramework.entryZone.price != null && (
                    <div style={{ fontFamily: "'Rajdhani', sans-serif", fontWeight: 700, fontSize: "16px", color: "#00FF88" }}>
                      ${d.tradeFramework.entryZone.price < 1
                        ? d.tradeFramework.entryZone.price.toFixed(4)
                        : d.tradeFramework.entryZone.price.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </div>
                  )}
                </div>
                <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "10px", color: "#E2E8F0", lineHeight: 1.5 }}>{d.tradeFramework.entryZone.description}</div>
                <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "9px", color: "#6B7280", marginTop: "4px" }}>{d.tradeFramework.entryZone.rationale}</div>
              </div>
            )}

            {/* Stop levels */}
            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "9px", color: "#4B5563", letterSpacing: "0.08em" }}>STOP LEVELS (3-TIER)</div>
              {[
                { label: "TRADE STOP", level: d.tradeFramework.tradeStop, color: "#FF9500" },
                { label: "SWING STOP", level: d.tradeFramework.swingStop, color: "#FF6B35" },
                { label: "THESIS FAILURE", level: d.tradeFramework.thesisFailure, color: "#FF2D55" },
              ].map(item => item.level && (
                <div key={item.label} style={{ background: "rgba(255,255,255,0.02)", border: `1px solid rgba(255,255,255,0.06)`, borderLeft: `3px solid ${item.color}40`, borderRadius: "0 6px 6px 0", padding: "8px 10px" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "3px" }}>
                    <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "8px", color: item.color, letterSpacing: "0.08em" }}>{item.label}</div>
                    {item.level.price != null && (
                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        {item.level.pctFromEntry != null && (
                          <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "9px", color: item.color + "CC" }}>
                            {item.level.pctFromEntry > 0 ? "+" : ""}{item.level.pctFromEntry.toFixed(1)}%
                          </span>
                        )}
                        <span style={{ fontFamily: "'Rajdhani', sans-serif", fontWeight: 700, fontSize: "14px", color: item.color }}>
                          ${item.level.price < 1
                            ? item.level.price.toFixed(4)
                            : item.level.price.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      </div>
                    )}
                  </div>
                  <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "10px", color: "#CBD5E1", lineHeight: 1.5 }}>{item.level.description}</div>
                  <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "9px", color: "#6B7280", marginTop: "3px" }}>{item.level.rationale}</div>
                </div>
              ))}
            </div>

            {/* Take-profit ladder */}
            {d.tradeFramework.takeProfitLadder.length > 0 && (
              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "9px", color: "#4B5563", letterSpacing: "0.08em" }}>TAKE-PROFIT LADDER</div>
                {d.tradeFramework.takeProfitLadder.map(tp => (
                  <div key={tp.tier} style={{ background: "rgba(0,212,255,0.03)", border: "1px solid rgba(0,212,255,0.1)", borderRadius: "6px", padding: "8px 10px" }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "3px" }}>
                      <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "8px", color: "#00D4FF", letterSpacing: "0.08em" }}>TP {tp.tier}</div>
                      {tp.price != null && (
                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                          {tp.pctFromEntry != null && (
                            <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "9px", color: "#00D4FFCC" }}>
                              +{tp.pctFromEntry.toFixed(1)}%
                            </span>
                          )}
                          <span style={{ fontFamily: "'Rajdhani', sans-serif", fontWeight: 700, fontSize: "14px", color: "#00D4FF" }}>
                            ${tp.price < 1
                              ? tp.price.toFixed(4)
                              : tp.price.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </span>
                        </div>
                      )}
                    </div>
                    <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "10px", color: "#CBD5E1", lineHeight: 1.5 }}>{tp.description}</div>
                    <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "9px", color: "#6B7280", marginTop: "3px" }}>{tp.rationale}</div>
                  </div>
                ))}
              </div>
            )}

            {/* Hold condition + exit trigger */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
              <div style={{ background: "rgba(0,255,136,0.03)", border: "1px solid rgba(0,255,136,0.1)", borderRadius: "6px", padding: "8px 10px" }}>
                <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "8px", color: "#00FF88", marginBottom: "4px", letterSpacing: "0.08em" }}>IDEAL HOLD CONDITION</div>
                <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "10px", color: "#94A3B8", lineHeight: 1.5 }}>{d.tradeFramework.idealHoldCondition}</div>
              </div>
              <div style={{ background: "rgba(255,45,85,0.03)", border: "1px solid rgba(255,45,85,0.1)", borderRadius: "6px", padding: "8px 10px" }}>
                <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "8px", color: "#FF2D55", marginBottom: "4px", letterSpacing: "0.08em" }}>EXIT TRIGGER</div>
                <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "10px", color: "#94A3B8", lineHeight: 1.5 }}>{d.tradeFramework.exitTrigger}</div>
              </div>
            </div>

            {/* Bull / bear case */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
              <div style={{ background: "rgba(0,255,136,0.03)", border: "1px solid rgba(0,255,136,0.1)", borderRadius: "6px", padding: "8px 10px" }}>
                <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "8px", color: "#00FF88", marginBottom: "4px", letterSpacing: "0.08em" }}>BULL CASE FOR THIS TRADE</div>
                <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "10px", color: "#94A3B8", lineHeight: 1.5 }}>{d.tradeFramework.bullCaseForTrade}</div>
              </div>
              <div style={{ background: "rgba(255,45,85,0.03)", border: "1px solid rgba(255,45,85,0.1)", borderRadius: "6px", padding: "8px 10px" }}>
                <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "8px", color: "#FF2D55", marginBottom: "4px", letterSpacing: "0.08em" }}>BEAR CASE FOR THIS TRADE</div>
                <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "10px", color: "#94A3B8", lineHeight: 1.5 }}>{d.tradeFramework.bearCaseForTrade}</div>
              </div>
            </div>

            {/* Do-not-trade conditions */}
            {d.tradeFramework.doNotTradeIf.length > 0 && (
              <div style={{ background: "rgba(255,149,0,0.04)", border: "1px solid rgba(255,149,0,0.15)", borderRadius: "6px", padding: "10px 12px" }}>
                <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "9px", color: "#FF9500", marginBottom: "6px", letterSpacing: "0.08em" }}>DO NOT TRADE IF</div>
                {d.tradeFramework.doNotTradeIf.map((cond, i) => (
                  <div key={i} style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "10px", color: "#94A3B8", lineHeight: 1.6, marginBottom: "3px" }}>
                    ⚠ {cond}
                  </div>
                ))}
              </div>
            )}

            {/* Data note */}
            {d.tradeFramework.dataInsufficient && (
              <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "9px", color: "#4B5563", textAlign: "center", paddingTop: "4px" }}>
                Live price data unavailable — price levels could not be calculated for this asset.
              </div>
            )}

          </div>
        )}
      </Section>

      {/* ── OUTLOOK HISTORY ── */}
      {d.history && (
        <Section
          title="Outlook History"
          icon={<Clock size={14} color="#64B5F6" />}
          badge={d.history.trend.toUpperCase()}
          badgeColor={d.history.trend === "Improving" ? "#00FF88" : d.history.trend === "Deteriorating" ? "#FF2D55" : "#64B5F6"}
          collapsible
        >
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))", gap: "8px" }}>
            {[
              { label: "Current", point: d.history.current },
              { label: "24h Ago", point: d.history.h24 },
              { label: "7d Ago", point: d.history.d7 },
              { label: "30d Ago", point: d.history.d30 },
            ].map(item => (
              <div key={item.label} style={{
                background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)",
                borderRadius: "6px", padding: "8px 10px",
              }}>
                <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "8px", color: "#4B5563", marginBottom: "4px", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                  {item.label}
                </div>
                {item.point ? (
                  <>
                    <div style={{ fontFamily: "'Rajdhani', sans-serif", fontWeight: 700, fontSize: "16px", color: scoreColor(item.point.outlookScore) }}>
                      {item.point.outlookScore}
                    </div>
                    <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "9px", color: directionColor(item.point.direction) }}>
                      {item.point.direction}
                    </div>
                  </>
                ) : (
                  <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "9px", color: "#4B5563" }}>No data</div>
                )}
              </div>
            ))}
          </div>
        </Section>
      )}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────
export default function SignalOutlookCenter() {
  useSEO({
    title: "Signal Outlook Center™ — FAULTLINE",
    description: "Transform raw signals into actionable market intelligence. Separate stock and crypto outlooks with AI interpretation.",
  });

  const searchStr = useSearch();
  const urlParams = useMemo(() => new URLSearchParams(searchStr), [searchStr]);
  const urlSymbol = urlParams.get("symbol")?.toUpperCase() ?? null;
  const urlType = (urlParams.get("type") === "crypto" ? "crypto" : "stock") as "stock" | "crypto";

  const [selectedSymbol, setSelectedSymbol] = useState<string | null>(urlSymbol);
  const [selectedAssetType, setSelectedAssetType] = useState<"stock" | "crypto">(urlSymbol ? urlType : "stock");
  const [timeframe, setTimeframe] = useState<OutlookTimeframe>("swing");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchAssetType, setSearchAssetType] = useState<"stock" | "crypto">("stock");
  const [activeTab, setActiveTab] = useState<"stocks" | "crypto">("stocks");

  // Sync when URL params change (deep-link from signal cards)
  useEffect(() => {
    if (urlSymbol) {
      setSelectedSymbol(urlSymbol);
      setSelectedAssetType(urlType);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlSymbol, urlType]);

  const { data: topOpps, isLoading: topLoading } = trpc.outlook.getTopOpportunities.useQuery(
    undefined,
    { staleTime: 7 * 60 * 1000 }
  );

  const handleSelect = useCallback((symbol: string, assetType: "stock" | "crypto") => {
    setSelectedSymbol(symbol);
    setSelectedAssetType(assetType);
  }, []);

  const handleBack = useCallback(() => {
    setSelectedSymbol(null);
  }, []);

  const handleSearch = useCallback(() => {
    const q = searchQuery.trim().toUpperCase();
    if (q.length > 0) {
      handleSelect(q, searchAssetType);
    }
  }, [searchQuery, searchAssetType, handleSelect]);

  // ── Single unified page: search + top opps always visible, report renders inline ──
  return (
    <div style={{ padding: "0 0 60px" }}>
      <PageHeader
        title="Signal Outlook Center™"
        subtitle={selectedSymbol ? `Analyst report — ${selectedSymbol}` : "Transform raw signals into actionable market intelligence"}
        badge="INTELLIGENCE"
        badgeColor="blue"
      />

      <div style={{ maxWidth: "900px", margin: "0 auto", padding: "0 16px" }}>

        {/* ── Search bar ── */}
        <div style={{
          background: "rgba(255,255,255,0.03)",
          border: "1px solid rgba(255,255,255,0.08)",
          borderRadius: "10px",
          padding: "14px 16px",
          marginBottom: "16px",
        }}>
          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
            <div style={{ position: "relative", flex: 1, minWidth: "160px" }}>
              <Search size={14} color="#4B5563" style={{ position: "absolute", left: "10px", top: "50%", transform: "translateY(-50%)" }} />
              <input
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handleSearch()}
                placeholder="NVDA, BTC, ETH, TSLA, TAO..."
                style={{
                  width: "100%",
                  background: "rgba(255,255,255,0.04)",
                  border: "1px solid rgba(255,255,255,0.1)",
                  borderRadius: "6px",
                  padding: "8px 10px 8px 32px",
                  fontFamily: "'IBM Plex Mono', monospace",
                  fontSize: "12px",
                  color: "#F1F5F9",
                  outline: "none",
                  boxSizing: "border-box",
                }}
              />
            </div>
            <div style={{ display: "flex", gap: "4px" }}>
              {(["stock", "crypto"] as const).map(at => (
                <button
                  key={at}
                  onClick={() => setSearchAssetType(at)}
                  style={{
                    fontFamily: "'IBM Plex Mono', monospace", fontSize: "10px",
                    color: searchAssetType === at ? (at === "crypto" ? "#F7931A" : "#64B5F6") : "#4B5563",
                    background: searchAssetType === at
                      ? at === "crypto" ? "rgba(247,147,26,0.1)" : "rgba(100,181,246,0.1)"
                      : "transparent",
                    border: `1px solid ${searchAssetType === at ? (at === "crypto" ? "rgba(247,147,26,0.3)" : "rgba(100,181,246,0.3)") : "rgba(255,255,255,0.08)"}`,
                    borderRadius: "4px", padding: "6px 12px", cursor: "pointer",
                    transition: "all 0.15s ease",
                  }}
                >
                  {at === "crypto" ? "CRYPTO" : "STOCK"}
                </button>
              ))}
            </div>
            <button
              onClick={handleSearch}
              disabled={!searchQuery.trim()}
              style={{
                fontFamily: "'IBM Plex Mono', monospace", fontSize: "11px",
                color: searchQuery.trim() ? "#00D4FF" : "#4B5563",
                background: searchQuery.trim() ? "rgba(0,212,255,0.08)" : "rgba(255,255,255,0.02)",
                border: `1px solid ${searchQuery.trim() ? "rgba(0,212,255,0.3)" : "rgba(255,255,255,0.08)"}`,
                borderRadius: "6px", padding: "8px 16px", cursor: searchQuery.trim() ? "pointer" : "not-allowed",
                transition: "all 0.15s ease",
                display: "flex", alignItems: "center", gap: "6px",
              }}
            >
              <Eye size={12} /> Get Outlook
            </button>
          </div>

          {/* Quick access chips — always visible below search */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: "5px", marginTop: "10px" }}>
            {[
              { symbol: "NVDA", type: "stock" as const },
              { symbol: "TSLA", type: "stock" as const },
              { symbol: "META", type: "stock" as const },
              { symbol: "PLTR", type: "stock" as const },
              { symbol: "AMD",  type: "stock" as const },
              { symbol: "AAPL", type: "stock" as const },
              { symbol: "SPY",  type: "stock" as const },
              { symbol: "BTC",  type: "crypto" as const },
              { symbol: "ETH",  type: "crypto" as const },
              { symbol: "SOL",  type: "crypto" as const },
              { symbol: "TAO",  type: "crypto" as const },
              { symbol: "AVAX", type: "crypto" as const },
              { symbol: "LINK", type: "crypto" as const },
            ].map(item => (
              <button
                key={`${item.symbol}_${item.type}`}
                onClick={() => handleSelect(item.symbol, item.type)}
                style={{
                  fontFamily: "'IBM Plex Mono', monospace", fontSize: "9px",
                  color: selectedSymbol === item.symbol && selectedAssetType === item.type
                    ? (item.type === "crypto" ? "#F7931A" : "#00D4FF")
                    : item.type === "crypto" ? "rgba(247,147,26,0.7)" : "#6B7280",
                  background: selectedSymbol === item.symbol && selectedAssetType === item.type
                    ? item.type === "crypto" ? "rgba(247,147,26,0.12)" : "rgba(0,212,255,0.08)"
                    : "rgba(255,255,255,0.02)",
                  border: `1px solid ${selectedSymbol === item.symbol && selectedAssetType === item.type
                    ? item.type === "crypto" ? "rgba(247,147,26,0.35)" : "rgba(0,212,255,0.3)"
                    : item.type === "crypto" ? "rgba(247,147,26,0.12)" : "rgba(255,255,255,0.06)"}`,
                  borderRadius: "3px", padding: "3px 8px", cursor: "pointer",
                  transition: "all 0.12s ease",
                }}
              >
                {item.symbol}
              </button>
            ))}
          </div>
        </div>

        {/* ── Inline analyst report (renders when symbol is selected) ── */}
        {selectedSymbol && (
          <div style={{
            background: "rgba(0,212,255,0.02)",
            border: "1px solid rgba(0,212,255,0.12)",
            borderRadius: "12px",
            padding: "16px",
            marginBottom: "20px",
          }}>
            {/* Report header: symbol + timeframe selector + clear */}
            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "14px", flexWrap: "wrap" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <TickerChip ticker={selectedSymbol} assetType={selectedAssetType} />
                <span style={{
                  fontFamily: "'IBM Plex Mono', monospace", fontSize: "8px",
                  color: selectedAssetType === "crypto" ? "#F7931A" : "#64B5F6",
                  background: selectedAssetType === "crypto" ? "rgba(247,147,26,0.1)" : "rgba(100,181,246,0.1)",
                  border: `1px solid ${selectedAssetType === "crypto" ? "rgba(247,147,26,0.2)" : "rgba(100,181,246,0.2)"}`,
                  borderRadius: "2px", padding: "2px 5px",
                }}>
                  {selectedAssetType === "crypto" ? "CRYPTO" : "STOCK"}
                </span>
                <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "9px", color: "#4B5563" }}>ANALYST REPORT</span>
              </div>
              <div style={{ display: "flex", gap: "4px", flexWrap: "wrap", marginLeft: "auto" }}>
                {(["day", "short", "swing", "long"] as OutlookTimeframe[]).map(tf => (
                  <button
                    key={tf}
                    onClick={() => setTimeframe(tf)}
                    style={{
                      fontFamily: "'IBM Plex Mono', monospace", fontSize: "9px",
                      color: timeframe === tf ? "#00D4FF" : "#4B5563",
                      background: timeframe === tf ? "rgba(0,212,255,0.08)" : "transparent",
                      border: `1px solid ${timeframe === tf ? "rgba(0,212,255,0.3)" : "rgba(255,255,255,0.08)"}`,
                      borderRadius: "3px", padding: "3px 8px", cursor: "pointer",
                      transition: "all 0.15s ease",
                    }}
                  >
                    {tf === "day" ? "DAY" : tf === "short" ? "1-5D" : tf === "swing" ? "1-4W" : "1-3M"}
                  </button>
                ))}
                <button
                  onClick={handleBack}
                  style={{
                    fontFamily: "'IBM Plex Mono', monospace", fontSize: "9px",
                    color: "#4B5563", background: "transparent",
                    border: "1px solid rgba(255,255,255,0.08)",
                    borderRadius: "3px", padding: "3px 8px", cursor: "pointer",
                    marginLeft: "4px",
                  }}
                >
                  ✕ Clear
                </button>
              </div>
            </div>

            <FullOutlookView
              symbol={selectedSymbol}
              assetType={selectedAssetType}
              timeframe={timeframe}
              onBack={handleBack}
            />
          </div>
        )}

        {/* ── Top Opportunities (always visible) ── */}
        <div style={{ marginBottom: "8px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "11px", color: "#94A3B8", letterSpacing: "0.08em" }}>
            TOP OPPORTUNITIES
          </div>
          <div style={{ display: "flex", gap: "4px" }}>
            {(["stocks", "crypto"] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                style={{
                  fontFamily: "'IBM Plex Mono', monospace", fontSize: "10px",
                  color: activeTab === tab ? (tab === "crypto" ? "#F7931A" : "#64B5F6") : "#4B5563",
                  background: activeTab === tab
                    ? tab === "crypto" ? "rgba(247,147,26,0.1)" : "rgba(100,181,246,0.1)"
                    : "transparent",
                  border: `1px solid ${activeTab === tab ? (tab === "crypto" ? "rgba(247,147,26,0.3)" : "rgba(100,181,246,0.3)") : "rgba(255,255,255,0.06)"}`,
                  borderRadius: "4px", padding: "4px 10px", cursor: "pointer",
                  transition: "all 0.15s ease",
                }}
              >
                {tab === "crypto" ? "CRYPTO" : "STOCKS"}
              </button>
            ))}
          </div>
        </div>

        {topLoading ? (
          <div style={{ display: "flex", justifyContent: "center", padding: "40px", gap: "10px", alignItems: "center" }}>
            <RefreshCw size={16} color="#00D4FF" style={{ animation: "spin 1s linear infinite" }} />
            <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "11px", color: "#4B5563" }}>
              Scanning universe...
            </span>
            <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: "10px", marginBottom: "20px" }}>
            {(activeTab === "stocks" ? topOpps?.stocks : topOpps?.crypto)?.map(opp => (
              <TopOpportunityCard key={opp.symbol} opp={opp} onSelect={handleSelect} />
            ))}
          </div>
        )}

      </div>
    </div>
  );
}
