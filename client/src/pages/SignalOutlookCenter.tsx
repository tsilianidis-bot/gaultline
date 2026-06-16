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
            <span style={{ fontFamily: "'Rajdhani', sans-serif", fontWeight: 700, fontSize: "16px", color: "#F1F5F9" }}>
              {opp.symbol}
            </span>
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
            <span style={{ fontFamily: "'Rajdhani', sans-serif", fontWeight: 700, fontSize: "22px", color: "#F1F5F9" }}>
              {d.symbol}
            </span>
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
        {d.tradeFramework.dataInsufficient ? (
          <div style={{
            background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)",
            borderRadius: "6px", padding: "12px",
            fontFamily: "'IBM Plex Mono', monospace", fontSize: "11px", color: "#6B7280", lineHeight: 1.6,
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "6px" }}>
              <Info size={12} color="#4B5563" />
              <span style={{ color: "#94A3B8" }}>Price Levels Not Available</span>
            </div>
            {d.tradeFramework.explanation}
            <div style={{ marginTop: "8px" }}>
              <a href="/app/signals" style={{ color: "#64B5F6", textDecoration: "none", fontSize: "10px" }}>
                → View calculated price levels in Stock & Market Signals
              </a>
            </div>
          </div>
        ) : (
          <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "11px", color: "#94A3B8" }}>
            {d.tradeFramework.explanation}
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

  // If a symbol is selected, show full outlook
  if (selectedSymbol) {
    return (
      <div style={{ padding: "0 0 40px" }}>
        <PageHeader
          title="Signal Outlook Center™"
          subtitle={`Full outlook for ${selectedSymbol}`}
          badge="INTELLIGENCE"
          badgeColor="blue"
        />
        <div style={{ maxWidth: "900px", margin: "0 auto", padding: "0 16px" }}>
          {/* Timeframe selector */}
          <div style={{ display: "flex", gap: "6px", marginBottom: "16px", flexWrap: "wrap" }}>
            <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "10px", color: "#4B5563", alignSelf: "center" }}>TIMEFRAME:</span>
            {(["day", "short", "swing", "long"] as OutlookTimeframe[]).map(tf => (
              <button
                key={tf}
                onClick={() => setTimeframe(tf)}
                style={{
                  fontFamily: "'IBM Plex Mono', monospace", fontSize: "10px",
                  color: timeframe === tf ? "#00D4FF" : "#4B5563",
                  background: timeframe === tf ? "rgba(0,212,255,0.08)" : "transparent",
                  border: `1px solid ${timeframe === tf ? "rgba(0,212,255,0.3)" : "rgba(255,255,255,0.08)"}`,
                  borderRadius: "4px", padding: "4px 10px", cursor: "pointer",
                  transition: "all 0.15s ease",
                }}
              >
                {tf === "day" ? "Day Trade" : tf === "short" ? "Short (1-5d)" : tf === "swing" ? "Swing (1-4w)" : "Long (1-3m)"}
              </button>
            ))}
          </div>
          <FullOutlookView
            symbol={selectedSymbol}
            assetType={selectedAssetType}
            timeframe={timeframe}
            onBack={handleBack}
          />
        </div>
      </div>
    );
  }

  // Landing screen
  return (
    <div style={{ padding: "0 0 40px" }}>
      <PageHeader
        title="Signal Outlook Center™"
        subtitle="Transform raw signals into actionable market intelligence"
        badge="INTELLIGENCE"
        badgeColor="blue"
      />

      <div style={{ maxWidth: "900px", margin: "0 auto", padding: "0 16px" }}>

        {/* ── Search ── */}
        <div style={{
          background: "rgba(255,255,255,0.03)",
          border: "1px solid rgba(255,255,255,0.08)",
          borderRadius: "10px",
          padding: "16px",
          marginBottom: "20px",
        }}>
          <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "10px", color: "#4B5563", marginBottom: "10px", letterSpacing: "0.08em" }}>
            LOOK UP ANY SYMBOL
          </div>
          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
            <div style={{ position: "relative", flex: 1, minWidth: "160px" }}>
              <Search size={14} color="#4B5563" style={{ position: "absolute", left: "10px", top: "50%", transform: "translateY(-50%)" }} />
              <input
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handleSearch()}
                placeholder="NVDA, BTC, ETH, TSLA..."
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
        </div>

        {/* ── Top Opportunities ── */}
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

        {/* ── Quick access grid ── */}
        <div style={{
          background: "rgba(255,255,255,0.02)",
          border: "1px solid rgba(255,255,255,0.06)",
          borderRadius: "10px",
          padding: "14px 16px",
        }}>
          <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "10px", color: "#4B5563", marginBottom: "10px", letterSpacing: "0.08em" }}>
            QUICK ACCESS
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
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
              { symbol: "AVAX", type: "crypto" as const },
              { symbol: "LINK", type: "crypto" as const },
            ].map(item => (
              <button
                key={`${item.symbol}_${item.type}`}
                onClick={() => handleSelect(item.symbol, item.type)}
                style={{
                  fontFamily: "'IBM Plex Mono', monospace", fontSize: "10px",
                  color: item.type === "crypto" ? "#F7931A" : "#94A3B8",
                  background: "rgba(255,255,255,0.03)",
                  border: `1px solid ${item.type === "crypto" ? "rgba(247,147,26,0.15)" : "rgba(255,255,255,0.08)"}`,
                  borderRadius: "4px", padding: "5px 10px", cursor: "pointer",
                  transition: "all 0.15s ease",
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = item.type === "crypto" ? "rgba(247,147,26,0.4)" : "rgba(255,255,255,0.2)"; }}
                onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = item.type === "crypto" ? "rgba(247,147,26,0.15)" : "rgba(255,255,255,0.08)"; }}
              >
                {item.symbol}
              </button>
            ))}
          </div>
        </div>

        {/* ── How it works ── */}
        <div style={{
          marginTop: "16px",
          background: "rgba(0,212,255,0.03)",
          border: "1px solid rgba(0,212,255,0.08)",
          borderRadius: "10px",
          padding: "14px 16px",
        }}>
          <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "10px", color: "#00D4FF", marginBottom: "10px", letterSpacing: "0.08em" }}>
            HOW SIGNAL OUTLOOK CENTER™ WORKS
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: "8px" }}>
            {[
              { label: "8-Factor Scoring", desc: "Each asset scored across 8 deterministic factors: trend, relative strength, volume, volatility, sector, breadth, regime, structure." },
              { label: "AI Interpretation", desc: "FAULTLINE AI explains what the scores mean in plain English — no jargon, no fabricated data." },
              { label: "Separate Paths", desc: "Stock and crypto outlooks use different factor sets. No cross-contamination of signals." },
              { label: "Environment Context", desc: "Every outlook is grounded in the current FAULTLINE Pressure Index and macro regime." },
              { label: "Invalidation Scenarios", desc: "5 specific scenarios that would change the outlook — so you know what to watch." },
              { label: "No Invented Data", desc: "Price levels require live data. If unavailable, the framework says so — never fabricates numbers." },
            ].map(item => (
              <div key={item.label} style={{ display: "flex", gap: "8px", alignItems: "flex-start" }}>
                <div style={{ width: "4px", height: "4px", borderRadius: "50%", background: "#00D4FF", marginTop: "5px", flexShrink: 0 }} />
                <div>
                  <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "9px", fontWeight: 600, color: "#94A3B8", marginBottom: "2px" }}>{item.label}</div>
                  <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "9px", color: "#4B5563", lineHeight: 1.5 }}>{item.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}
