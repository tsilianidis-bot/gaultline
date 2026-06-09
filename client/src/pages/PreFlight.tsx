/* ============================================================
   FAULTLINE — PRE-FLIGHT Market Awareness Command Center
   ============================================================
   Purpose: Answer "Do I fully understand current market
   conditions before risking capital?"

   This is NOT a trade simulator. It is a market awareness
   command center. The Situation Room handles trade decisions.

   Panels:
   A. Awareness Score (gauge + level)
   B. Pressure Index + Regime
   C. Bull vs Bear Probability
   D. Market Status
   E. Daily Intelligence Brief
   F. Threat Board
   G. Key Risk Alerts
   H. Macro Drivers
   I. Credit Conditions
   J. Liquidity Conditions
   K. AI Bubble Risk
   L. Recession Risk
   M. Volatility Regime
   N. Awareness Checks (Missing Checks)
   ============================================================ */

import { useState, useEffect, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { useSEO, PAGE_SEO } from "@/hooks/useSEO";
import { Link } from "wouter";
import {
  AlertTriangle, CheckCircle, XCircle, ChevronRight,
  Activity, Shield, TrendingDown, TrendingUp, Zap,
  Eye, Brain, Target, BarChart3, Clock, RefreshCw,
  ArrowRight, Info, Minus
} from "lucide-react";

// ── Types (mirrored from server) ──────────────────────────────

type AwarenessLevel = "FULLY AWARE" | "AWARE" | "PARTIAL AWARENESS" | "LOW AWARENESS" | "BLIND SPOT";
type ConditionLevel = "Clear" | "Stable" | "Caution" | "Stressed" | "Critical";
type MarketStatus = "Cleared" | "Caution" | "Defensive";

// ── Design tokens ─────────────────────────────────────────────

const STATUS_COLORS: Record<MarketStatus, { bg: string; border: string; text: string; glow: string }> = {
  Cleared:   { bg: "rgba(0,212,100,0.08)",  border: "rgba(0,212,100,0.35)",  text: "#00D464", glow: "0 0 20px rgba(0,212,100,0.3)" },
  Caution:   { bg: "rgba(255,170,0,0.08)",  border: "rgba(255,170,0,0.35)",  text: "#FFAA00", glow: "0 0 20px rgba(255,170,0,0.3)" },
  Defensive: { bg: "rgba(255,60,60,0.08)",  border: "rgba(255,60,60,0.35)",  text: "#FF3C3C", glow: "0 0 20px rgba(255,60,60,0.3)" },
};

const AWARENESS_COLORS: Record<AwarenessLevel, { color: string; bg: string; border: string }> = {
  "FULLY AWARE":      { color: "#00D464", bg: "rgba(0,212,100,0.08)",  border: "rgba(0,212,100,0.35)" },
  "AWARE":            { color: "#00D4FF", bg: "rgba(0,212,255,0.08)",  border: "rgba(0,212,255,0.35)" },
  "PARTIAL AWARENESS":{ color: "#FFAA00", bg: "rgba(255,170,0,0.08)",  border: "rgba(255,170,0,0.35)" },
  "LOW AWARENESS":    { color: "#FF6B00", bg: "rgba(255,107,0,0.08)",  border: "rgba(255,107,0,0.35)" },
  "BLIND SPOT":       { color: "#FF3C3C", bg: "rgba(255,60,60,0.08)",  border: "rgba(255,60,60,0.35)" },
};

const CONDITION_COLORS: Record<ConditionLevel, { color: string; bg: string }> = {
  Clear:    { color: "#00D464", bg: "rgba(0,212,100,0.12)" },
  Stable:   { color: "#00D4FF", bg: "rgba(0,212,255,0.12)" },
  Caution:  { color: "#FFAA00", bg: "rgba(255,170,0,0.12)" },
  Stressed: { color: "#FF6B00", bg: "rgba(255,107,0,0.12)" },
  Critical: { color: "#FF3C3C", bg: "rgba(255,60,60,0.12)" },
};

const SEVERITY_COLORS: Record<string, string> = {
  low:      "#00D464",
  moderate: "#FFAA00",
  elevated: "#FF6B00",
  high:     "#FF3C3C",
  critical: "#FF0000",
};

const DIRECTION_ICONS: Record<string, React.ReactNode> = {
  bullish: <TrendingUp size={14} style={{ color: "#00D464" }} />,
  neutral: <Minus size={14} style={{ color: "#888" }} />,
  bearish: <TrendingDown size={14} style={{ color: "#FF3C3C" }} />,
};

// ── Sub-components ────────────────────────────────────────────

function PanelCard({ title, icon, children, accent, className = "" }: {
  title: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
  accent?: string;
  className?: string;
}) {
  return (
    <div className={className} style={{
      background: "rgba(8,10,14,0.95)",
      border: `1px solid ${accent ?? "rgba(0,212,255,0.12)"}`,
      borderRadius: "4px",
      padding: "20px",
      position: "relative",
      overflow: "hidden",
    }}>
      {/* Top accent line */}
      <div style={{
        position: "absolute", top: 0, left: 0, right: 0,
        height: "2px",
        background: accent ?? "rgba(0,212,255,0.3)",
      }} />
      <div style={{
        display: "flex", alignItems: "center", gap: "8px",
        marginBottom: "16px",
      }}>
        {icon}
        <span style={{
          fontFamily: "'IBM Plex Mono', monospace",
          fontSize: "11px",
          letterSpacing: "0.15em",
          color: "#666",
          textTransform: "uppercase",
        }}>{title}</span>
      </div>
      {children}
    </div>
  );
}

function ScoreBar({ value, max = 100, color }: { value: number; max?: number; color: string }) {
  const pct = Math.min(100, Math.round((value / max) * 100));
  return (
    <div style={{ position: "relative", height: "6px", background: "rgba(255,255,255,0.06)", borderRadius: "3px", overflow: "hidden" }}>
      <div style={{
        position: "absolute", left: 0, top: 0, bottom: 0,
        width: `${pct}%`,
        background: color,
        borderRadius: "3px",
        transition: "width 0.8s cubic-bezier(0.23,1,0.32,1)",
        boxShadow: `0 0 8px ${color}66`,
      }} />
    </div>
  );
}

function AwarenessGauge({ score, level }: { score: number; level: AwarenessLevel }) {
  const colors = AWARENESS_COLORS[level];
  const circumference = 2 * Math.PI * 54;
  const offset = circumference - (score / 100) * circumference;

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "12px" }}>
      <div style={{ position: "relative", width: "140px", height: "140px" }}>
        <svg width="140" height="140" viewBox="0 0 140 140" style={{ transform: "rotate(-90deg)" }}>
          <circle cx="70" cy="70" r="54" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="10" />
          <circle
            cx="70" cy="70" r="54" fill="none"
            stroke={colors.color}
            strokeWidth="10"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            style={{ transition: "stroke-dashoffset 1.2s cubic-bezier(0.23,1,0.32,1)", filter: `drop-shadow(0 0 6px ${colors.color})` }}
          />
        </svg>
        <div style={{
          position: "absolute", inset: 0,
          display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
        }}>
          <span style={{
            fontFamily: "'IBM Plex Mono', monospace",
            fontSize: "32px",
            fontWeight: "700",
            color: colors.color,
            lineHeight: 1,
            textShadow: `0 0 20px ${colors.color}66`,
          }}>{score}</span>
          <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "11px", color: "#666", marginTop: "2px" }}>/100</span>
        </div>
      </div>
      <div style={{
        padding: "4px 14px",
        background: colors.bg,
        border: `1px solid ${colors.border}`,
        borderRadius: "2px",
        fontFamily: "'IBM Plex Mono', monospace",
        fontSize: "11px",
        letterSpacing: "0.12em",
        color: colors.color,
        textTransform: "uppercase",
      }}>{level}</div>
    </div>
  );
}

function IndicatorDot({ status }: { status: "green" | "yellow" | "red" }) {
  const c = status === "green" ? "#00D464" : status === "yellow" ? "#FFAA00" : "#FF3C3C";
  return (
    <div style={{
      width: "8px", height: "8px", borderRadius: "50%",
      background: c, flexShrink: 0,
      boxShadow: `0 0 6px ${c}`,
    }} />
  );
}

function CheckItem({ check }: { check: { id: string; question: string; status: "pass" | "warn" | "fail"; explanation: string } }) {
  const [open, setOpen] = useState(false);
  const colors = {
    pass: { icon: <CheckCircle size={16} style={{ color: "#00D464" }} />, border: "rgba(0,212,100,0.2)" },
    warn: { icon: <AlertTriangle size={16} style={{ color: "#FFAA00" }} />, border: "rgba(255,170,0,0.2)" },
    fail: { icon: <XCircle size={16} style={{ color: "#FF3C3C" }} />, border: "rgba(255,60,60,0.2)" },
  }[check.status];

  return (
    <div style={{
      border: `1px solid ${colors.border}`,
      borderRadius: "3px",
      overflow: "hidden",
      marginBottom: "6px",
    }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          width: "100%", display: "flex", alignItems: "center", gap: "10px",
          padding: "10px 12px",
          background: "transparent", border: "none", cursor: "pointer",
          textAlign: "left",
        }}
      >
        {colors.icon}
        <span style={{
          flex: 1,
          fontFamily: "'IBM Plex Mono', monospace",
          fontSize: "12px",
          color: "#ccc",
        }}>{check.question}</span>
        <ChevronRight size={14} style={{
          color: "#555",
          transform: open ? "rotate(90deg)" : "none",
          transition: "transform 0.2s ease",
        }} />
      </button>
      {open && (
        <div style={{
          padding: "0 12px 12px 38px",
          fontFamily: "'IBM Plex Mono', monospace",
          fontSize: "11px",
          color: "#888",
          lineHeight: 1.6,
        }}>
          {check.explanation}
        </div>
      )}
    </div>
  );
}

function ConditionPanelCard({ panel }: { panel: {
  label: string;
  level: ConditionLevel;
  score: number;
  summary: string;
  detail: string;
  indicators: { name: string; value: string; status: "green" | "yellow" | "red" }[];
}}) {
  const [expanded, setExpanded] = useState(false);
  const colors = CONDITION_COLORS[panel.level];

  return (
    <div style={{
      background: "rgba(8,10,14,0.95)",
      border: `1px solid rgba(255,255,255,0.07)`,
      borderRadius: "4px",
      overflow: "hidden",
    }}>
      <div style={{
        padding: "14px 16px",
        borderBottom: expanded ? "1px solid rgba(255,255,255,0.05)" : "none",
        cursor: "pointer",
        display: "flex", alignItems: "center", gap: "12px",
      }} onClick={() => setExpanded(e => !e)}>
        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
            <span style={{
              fontFamily: "'IBM Plex Mono', monospace",
              fontSize: "12px",
              color: "#ccc",
              letterSpacing: "0.05em",
            }}>{panel.label}</span>
            <span style={{
              padding: "2px 8px",
              background: colors.bg,
              borderRadius: "2px",
              fontFamily: "'IBM Plex Mono', monospace",
              fontSize: "10px",
              color: colors.color,
              letterSpacing: "0.1em",
            }}>{panel.level.toUpperCase()}</span>
          </div>
          <ScoreBar value={panel.score} color={colors.color} />
          <div style={{
            marginTop: "6px",
            fontFamily: "'IBM Plex Mono', monospace",
            fontSize: "10px",
            color: "#666",
          }}>{panel.summary}</div>
        </div>
        <ChevronRight size={14} style={{
          color: "#555", flexShrink: 0,
          transform: expanded ? "rotate(90deg)" : "none",
          transition: "transform 0.2s ease",
        }} />
      </div>
      {expanded && (
        <div style={{ padding: "14px 16px" }}>
          <p style={{
            fontFamily: "'IBM Plex Mono', monospace",
            fontSize: "11px",
            color: "#888",
            lineHeight: 1.7,
            marginBottom: "14px",
          }}>{panel.detail}</p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
            {panel.indicators.map(ind => (
              <div key={ind.name} style={{
                display: "flex", alignItems: "center", gap: "8px",
                padding: "8px 10px",
                background: "rgba(255,255,255,0.03)",
                borderRadius: "3px",
                border: "1px solid rgba(255,255,255,0.05)",
              }}>
                <IndicatorDot status={ind.status} />
                <div>
                  <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "10px", color: "#666" }}>{ind.name}</div>
                  <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "11px", color: "#ccc" }}>{ind.value}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Loading skeleton ──────────────────────────────────────────

function Skeleton({ h = "20px", w = "100%", mb = "0" }: { h?: string; w?: string; mb?: string }) {
  return (
    <div style={{
      height: h, width: w, marginBottom: mb,
      background: "linear-gradient(90deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.08) 50%, rgba(255,255,255,0.04) 100%)",
      backgroundSize: "200% 100%",
      animation: "shimmer 1.5s infinite",
      borderRadius: "3px",
    }} />
  );
}

// ── Main page ─────────────────────────────────────────────────

export default function PreFlight() {
  useSEO(PAGE_SEO.preFlight);

  const { data, isLoading, error, refetch, isFetching } = trpc.preFlight.getAwarenessData.useQuery(undefined, {
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  const handleRefresh = () => {
    refetch();
    setLastRefresh(new Date());
  };

  // ── Render ──────────────────────────────────────────────────

  const mono = "'IBM Plex Mono', monospace";

  return (
    <div style={{
      minHeight: "100vh",
      background: "#060810",
      color: "#e0e0e0",
      fontFamily: mono,
    }}>
      {/* ── Scanline overlay ── */}
      <div style={{
        position: "fixed", inset: 0, pointerEvents: "none", zIndex: 0,
        backgroundImage: "repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.03) 2px, rgba(0,0,0,0.03) 4px)",
      }} />

      <div style={{ position: "relative", zIndex: 1, maxWidth: "1400px", margin: "0 auto", padding: "24px 20px 60px" }}>

        {/* ── Header ── */}
        <div style={{ marginBottom: "28px" }}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: "12px" }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "6px" }}>
                <div style={{
                  width: "8px", height: "8px", borderRadius: "50%",
                  background: "#00D4FF",
                  boxShadow: "0 0 10px #00D4FF",
                  animation: "pulse 2s infinite",
                }} />
                <span style={{ fontSize: "11px", letterSpacing: "0.2em", color: "#00D4FF", opacity: 0.7 }}>
                  FAULTLINE MARKET INTELLIGENCE
                </span>
              </div>
              <h1 style={{
                fontSize: "clamp(22px, 4vw, 32px)",
                fontWeight: "700",
                letterSpacing: "0.15em",
                color: "#fff",
                margin: 0,
                textTransform: "uppercase",
              }}>
                PRE-FLIGHT
              </h1>
              <p style={{ fontSize: "13px", color: "#666", margin: "6px 0 0", letterSpacing: "0.05em" }}>
                Market Awareness Command Center — Know before you risk.
              </p>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
              {/* Refresh */}
              <button
                onClick={handleRefresh}
                disabled={isFetching}
                style={{
                  display: "flex", alignItems: "center", gap: "6px",
                  padding: "7px 14px",
                  background: "rgba(0,212,255,0.06)",
                  border: "1px solid rgba(0,212,255,0.2)",
                  borderRadius: "3px",
                  color: "#00D4FF",
                  fontSize: "11px",
                  letterSpacing: "0.1em",
                  cursor: isFetching ? "not-allowed" : "pointer",
                  opacity: isFetching ? 0.6 : 1,
                  transition: "all 0.15s ease",
                }}
              >
                <RefreshCw size={12} style={{ animation: isFetching ? "spin 1s linear infinite" : "none" }} />
                REFRESH
              </button>

              {/* Go to Situation Room */}
              <Link href="/app/situation-room">
                <div style={{
                  display: "flex", alignItems: "center", gap: "6px",
                  padding: "7px 14px",
                  background: "rgba(255,170,0,0.08)",
                  border: "1px solid rgba(255,170,0,0.3)",
                  borderRadius: "3px",
                  color: "#FFAA00",
                  fontSize: "11px",
                  letterSpacing: "0.1em",
                  cursor: "pointer",
                  textDecoration: "none",
                  transition: "all 0.15s ease",
                }}>
                  ENTER SITUATION ROOM <ArrowRight size={12} />
                </div>
              </Link>
            </div>
          </div>

          {/* Step indicator */}
          <div style={{
            display: "flex", alignItems: "center", gap: "0",
            marginTop: "16px",
            padding: "10px 16px",
            background: "rgba(255,255,255,0.02)",
            border: "1px solid rgba(255,255,255,0.06)",
            borderRadius: "3px",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <div style={{
                width: "22px", height: "22px", borderRadius: "50%",
                background: "rgba(0,212,255,0.15)",
                border: "1px solid rgba(0,212,255,0.4)",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontFamily: mono, fontSize: "11px", color: "#00D4FF",
              }}>1</div>
              <span style={{ fontSize: "11px", color: "#00D4FF", letterSpacing: "0.08em" }}>PRE-FLIGHT</span>
              <span style={{ fontSize: "10px", color: "#555", marginLeft: "4px" }}>Understand the market</span>
            </div>
            <div style={{ flex: 1, height: "1px", background: "rgba(255,255,255,0.06)", margin: "0 16px" }} />
            <Link href="/app/situation-room">
              <div style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer" }}>
                <div style={{
                  width: "22px", height: "22px", borderRadius: "50%",
                  background: "rgba(255,170,0,0.08)",
                  border: "1px solid rgba(255,170,0,0.25)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontFamily: mono, fontSize: "11px", color: "#FFAA00",
                }}>2</div>
                <span style={{ fontSize: "11px", color: "#FFAA00", letterSpacing: "0.08em" }}>SITUATION ROOM</span>
                <span style={{ fontSize: "10px", color: "#555", marginLeft: "4px" }}>Simulate your move</span>
              </div>
            </Link>
          </div>
        </div>

        {/* ── Error state ── */}
        {error && (
          <div style={{
            padding: "20px", marginBottom: "20px",
            background: "rgba(255,60,60,0.06)",
            border: "1px solid rgba(255,60,60,0.25)",
            borderRadius: "4px",
            fontFamily: mono, fontSize: "12px", color: "#FF3C3C",
          }}>
            <AlertTriangle size={14} style={{ display: "inline", marginRight: "8px" }} />
            Pre-Flight data unavailable. Using fallback mode. {error.message}
          </div>
        )}

        {/* ── Loading state ── */}
        {isLoading && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: "16px" }}>
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} style={{ padding: "20px", background: "rgba(8,10,14,0.95)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: "4px" }}>
                <Skeleton h="12px" w="60%" mb="16px" />
                <Skeleton h="60px" mb="12px" />
                <Skeleton h="10px" w="80%" />
              </div>
            ))}
          </div>
        )}

        {/* ── Main content ── */}
        {data && !isLoading && (
          <>
            {/* ── Row 1: Awareness Score + Market Status + Pressure + Probabilities ── */}
            <div style={{
              display: "grid",
              gridTemplateColumns: "220px 1fr 1fr 1fr",
              gap: "12px",
              marginBottom: "12px",
            }} className="pre-flight-top-row">

              {/* A. Awareness Score */}
              <PanelCard
                title="Awareness Score"
                icon={<Eye size={13} style={{ color: "#00D4FF" }} />}
                accent="rgba(0,212,255,0.3)"
              >
                <AwarenessGauge score={data.awarenessScore} level={data.awarenessLevel as AwarenessLevel} />
              </PanelCard>

              {/* D. Market Status */}
              <PanelCard
                title="Market Status"
                icon={<Shield size={13} style={{ color: STATUS_COLORS[data.marketStatus as MarketStatus].text }} />}
                accent={STATUS_COLORS[data.marketStatus as MarketStatus].border}
              >
                <div style={{ textAlign: "center", padding: "12px 0" }}>
                  <div style={{
                    fontSize: "clamp(22px, 3vw, 30px)",
                    fontWeight: "700",
                    letterSpacing: "0.1em",
                    color: STATUS_COLORS[data.marketStatus as MarketStatus].text,
                    textShadow: STATUS_COLORS[data.marketStatus as MarketStatus].glow,
                    marginBottom: "8px",
                  }}>{data.marketStatus.toUpperCase()}</div>
                  <div style={{ fontSize: "11px", color: "#666", marginBottom: "12px" }}>{data.regime}</div>
                  <div style={{
                    display: "inline-block",
                    padding: "3px 10px",
                    background: "rgba(255,255,255,0.04)",
                    border: "1px solid rgba(255,255,255,0.08)",
                    borderRadius: "2px",
                    fontSize: "10px",
                    color: "#888",
                    letterSpacing: "0.1em",
                  }}>{data.regimeLevel.toUpperCase()} PRESSURE</div>
                </div>
              </PanelCard>

              {/* B. Pressure Index */}
              <PanelCard
                title="Pressure Index"
                icon={<Activity size={13} style={{ color: "#FF6B00" }} />}
                accent="rgba(255,107,0,0.3)"
              >
                <div style={{ textAlign: "center", padding: "8px 0" }}>
                  <div style={{
                    fontSize: "clamp(28px, 4vw, 44px)",
                    fontWeight: "700",
                    color: data.pressureIndex >= 65 ? "#FF3C3C" : data.pressureIndex >= 40 ? "#FF6B00" : "#00D464",
                    textShadow: `0 0 20px ${data.pressureIndex >= 65 ? "#FF3C3C" : data.pressureIndex >= 40 ? "#FF6B00" : "#00D464"}66`,
                    lineHeight: 1,
                    marginBottom: "8px",
                  }}>{data.pressureIndex}</div>
                  <div style={{ fontSize: "11px", color: "#666", marginBottom: "12px" }}>/ 100</div>
                  <ScoreBar
                    value={data.pressureIndex}
                    color={data.pressureIndex >= 65 ? "#FF3C3C" : data.pressureIndex >= 40 ? "#FF6B00" : "#00D464"}
                  />
                  <div style={{ marginTop: "8px", fontSize: "10px", color: "#555" }}>
                    {data.dataSource === "live" ? "● LIVE DATA" : "○ FALLBACK MODE"}
                  </div>
                </div>
              </PanelCard>

              {/* C. Bull vs Bear */}
              <PanelCard
                title="Bull vs Bear Probability"
                icon={<BarChart3 size={13} style={{ color: "#888" }} />}
                accent="rgba(255,255,255,0.1)"
              >
                <div style={{ display: "flex", flexDirection: "column", gap: "12px", paddingTop: "4px" }}>
                  <div>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "5px" }}>
                      <span style={{ fontSize: "11px", color: "#00D464" }}>BULL</span>
                      <span style={{ fontSize: "13px", fontWeight: "700", color: "#00D464" }}>{data.bullProbability}%</span>
                    </div>
                    <ScoreBar value={data.bullProbability} color="#00D464" />
                  </div>
                  <div>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "5px" }}>
                      <span style={{ fontSize: "11px", color: "#FF3C3C" }}>BEAR</span>
                      <span style={{ fontSize: "13px", fontWeight: "700", color: "#FF3C3C" }}>{data.bearProbability}%</span>
                    </div>
                    <ScoreBar value={data.bearProbability} color="#FF3C3C" />
                  </div>
                  <div>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "5px" }}>
                      <span style={{ fontSize: "11px", color: "#FF6B00" }}>RECESSION</span>
                      <span style={{ fontSize: "13px", fontWeight: "700", color: "#FF6B00" }}>{data.recessionProbability}%</span>
                    </div>
                    <ScoreBar value={data.recessionProbability} color="#FF6B00" />
                  </div>
                  <div>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "5px" }}>
                      <span style={{ fontSize: "11px", color: "#FF0000" }}>CRASH</span>
                      <span style={{ fontSize: "13px", fontWeight: "700", color: "#FF0000" }}>{data.crashProbability}%</span>
                    </div>
                    <ScoreBar value={data.crashProbability} color="#FF0000" />
                  </div>
                </div>
              </PanelCard>
            </div>

            {/* ── Row 2: Daily Brief + Threat Board ── */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "12px" }}>

              {/* E. Daily Intelligence Brief */}
              <PanelCard
                title="Daily Intelligence Brief"
                icon={<Brain size={13} style={{ color: "#00D4FF" }} />}
                accent="rgba(0,212,255,0.25)"
              >
                <div style={{
                  fontFamily: mono,
                  fontSize: "13px",
                  color: "#ccc",
                  lineHeight: 1.8,
                  padding: "8px 0",
                  borderLeft: "2px solid rgba(0,212,255,0.3)",
                  paddingLeft: "14px",
                }}>
                  {data.dailyBrief}
                </div>
                <div style={{
                  marginTop: "12px",
                  fontSize: "10px",
                  color: "#444",
                  display: "flex", alignItems: "center", gap: "6px",
                }}>
                  <Clock size={10} />
                  Generated {new Date(data.timestamp).toLocaleTimeString()} · {data.dataSource === "live" ? "Live data" : "Fallback mode"}
                </div>
              </PanelCard>

              {/* F. Threat Board */}
              <PanelCard
                title="Threat Board"
                icon={<AlertTriangle size={13} style={{ color: "#FF6B00" }} />}
                accent="rgba(255,107,0,0.25)"
              >
                <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                  {data.threatBoard.length === 0 ? (
                    <div style={{ fontSize: "12px", color: "#555", textAlign: "center", padding: "20px 0" }}>
                      No active threats detected.
                    </div>
                  ) : data.threatBoard.slice(0, 5).map((threat) => (
                    <div key={threat.rank} style={{
                      display: "flex", alignItems: "flex-start", gap: "10px",
                      padding: "8px 10px",
                      background: "rgba(255,255,255,0.02)",
                      border: `1px solid ${SEVERITY_COLORS[threat.severity]}22`,
                      borderLeft: `3px solid ${SEVERITY_COLORS[threat.severity]}`,
                      borderRadius: "2px",
                    }}>
                      <span style={{
                        fontFamily: mono, fontSize: "10px",
                        color: SEVERITY_COLORS[threat.severity],
                        minWidth: "16px",
                        marginTop: "1px",
                      }}>#{threat.rank}</span>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: "11px", color: "#ccc", marginBottom: "2px" }}>{threat.title}</div>
                        <div style={{ fontSize: "10px", color: "#666" }}>{threat.summary}</div>
                        {threat.hiddenPressure && (
                          <div style={{ fontSize: "10px", color: "#FF6B00", marginTop: "3px" }}>
                            ⚠ {threat.hiddenPressure}
                          </div>
                        )}
                      </div>
                      <span style={{
                        padding: "2px 6px",
                        background: `${SEVERITY_COLORS[threat.severity]}15`,
                        borderRadius: "2px",
                        fontSize: "9px",
                        color: SEVERITY_COLORS[threat.severity],
                        letterSpacing: "0.1em",
                        textTransform: "uppercase",
                        flexShrink: 0,
                      }}>{threat.severity}</span>
                    </div>
                  ))}
                </div>
              </PanelCard>
            </div>

            {/* ── Row 3: Key Risk Alerts ── */}
            <PanelCard
              title="Key Risk Alerts"
              icon={<Zap size={13} style={{ color: "#FFAA00" }} />}
              accent="rgba(255,170,0,0.2)"
              className="pre-flight-risks"
            >
              {data.keyRisks.length === 0 ? (
                <div style={{ fontSize: "12px", color: "#555", textAlign: "center", padding: "20px 0" }}>
                  <CheckCircle size={20} style={{ color: "#00D464", display: "block", margin: "0 auto 8px" }} />
                  No active risk alerts. Market conditions within normal parameters.
                </div>
              ) : (
                <div style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
                  gap: "10px",
                }}>
                  {data.keyRisks.map(risk => (
                    <div key={risk.id} style={{
                      padding: "12px 14px",
                      background: "rgba(255,255,255,0.02)",
                      border: `1px solid ${SEVERITY_COLORS[risk.severity]}22`,
                      borderTop: `2px solid ${SEVERITY_COLORS[risk.severity]}`,
                      borderRadius: "3px",
                    }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px" }}>
                        <span style={{
                          padding: "2px 7px",
                          background: `${SEVERITY_COLORS[risk.severity]}15`,
                          borderRadius: "2px",
                          fontSize: "9px",
                          color: SEVERITY_COLORS[risk.severity],
                          letterSpacing: "0.1em",
                          textTransform: "uppercase",
                        }}>{risk.severity}</span>
                        <span style={{ fontSize: "11px", color: "#ccc", fontWeight: "600" }}>{risk.title}</span>
                      </div>
                      <div style={{ fontSize: "11px", color: "#888", lineHeight: 1.6, marginBottom: "8px" }}>{risk.detail}</div>
                      <div style={{
                        fontSize: "10px",
                        color: "#FFAA00",
                        borderTop: "1px solid rgba(255,255,255,0.05)",
                        paddingTop: "8px",
                      }}>
                        → {risk.actionImplication}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </PanelCard>

            {/* ── Row 4: Macro Drivers ── */}
            <div style={{ marginTop: "12px" }}>
              <PanelCard
                title="Macro Drivers"
                icon={<Target size={13} style={{ color: "#888" }} />}
                accent="rgba(255,255,255,0.1)"
              >
                <div style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
                  gap: "10px",
                }}>
                  {data.macroDrivers.map(driver => (
                    <div key={driver.name} style={{
                      padding: "12px 14px",
                      background: "rgba(255,255,255,0.02)",
                      border: "1px solid rgba(255,255,255,0.06)",
                      borderRadius: "3px",
                    }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px" }}>
                        {DIRECTION_ICONS[driver.direction]}
                        <span style={{ fontSize: "11px", color: "#ccc" }}>{driver.name}</span>
                      </div>
                      <div style={{
                        display: "flex", alignItems: "center", gap: "8px",
                        marginBottom: "6px",
                      }}>
                        <span style={{
                          padding: "2px 8px",
                          background: driver.direction === "bullish" ? "rgba(0,212,100,0.1)" : driver.direction === "bearish" ? "rgba(255,60,60,0.1)" : "rgba(255,255,255,0.05)",
                          borderRadius: "2px",
                          fontSize: "10px",
                          color: driver.direction === "bullish" ? "#00D464" : driver.direction === "bearish" ? "#FF3C3C" : "#888",
                          letterSpacing: "0.08em",
                        }}>{driver.value}</span>
                        <span style={{ fontSize: "10px", color: "#555" }}>{driver.impact}</span>
                      </div>
                      <div style={{ fontSize: "10px", color: "#666", lineHeight: 1.6 }}>{driver.detail}</div>
                    </div>
                  ))}
                </div>
              </PanelCard>
            </div>

            {/* ── Row 5: Condition Panels (6 panels) ── */}
            <div style={{ marginTop: "12px" }}>
              <div style={{
                fontFamily: mono,
                fontSize: "11px",
                letterSpacing: "0.15em",
                color: "#444",
                textTransform: "uppercase",
                marginBottom: "10px",
              }}>CONDITION ANALYSIS</div>
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {[
                  data.creditCondition,
                  data.liquidityCondition,
                  data.aiBubbleRisk,
                  data.recessionRisk,
                  data.volatilityCondition,
                  data.macroCondition,
                ].map(panel => (
                  <ConditionPanelCard key={panel.label} panel={panel as any} />
                ))}
              </div>
            </div>

            {/* ── Row 6: Awareness Checks ── */}
            <div style={{ marginTop: "12px" }}>
              <PanelCard
                title="Awareness Checks"
                icon={<CheckCircle size={13} style={{ color: "#00D464" }} />}
                accent="rgba(0,212,100,0.2)"
              >
                <div style={{ marginBottom: "12px" }}>
                  {/* Summary bar */}
                  <div style={{ display: "flex", gap: "16px", marginBottom: "16px", flexWrap: "wrap" }}>
                    {(["pass", "warn", "fail"] as const).map(status => {
                      const count = data.awarenessChecks.filter(c => c.status === status).length;
                      const label = status === "pass" ? "PASSED" : status === "warn" ? "WARNINGS" : "FAILED";
                      const color = status === "pass" ? "#00D464" : status === "warn" ? "#FFAA00" : "#FF3C3C";
                      return (
                        <div key={status} style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                          <span style={{ fontFamily: mono, fontSize: "18px", fontWeight: "700", color }}>{count}</span>
                          <span style={{ fontFamily: mono, fontSize: "10px", color: "#555", letterSpacing: "0.1em" }}>{label}</span>
                        </div>
                      );
                    })}
                  </div>
                  {data.awarenessChecks.map(check => (
                    <CheckItem key={check.id} check={check} />
                  ))}
                </div>

                {/* CTA to Situation Room */}
                {data.awarenessChecks.filter(c => c.status === "fail").length === 0 && (
                  <div style={{
                    padding: "14px 16px",
                    background: "rgba(255,170,0,0.05)",
                    border: "1px solid rgba(255,170,0,0.2)",
                    borderRadius: "3px",
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                    flexWrap: "wrap", gap: "10px",
                  }}>
                    <div>
                      <div style={{ fontSize: "12px", color: "#FFAA00", marginBottom: "3px" }}>
                        Awareness checks complete. Ready for decision simulation?
                      </div>
                      <div style={{ fontSize: "11px", color: "#666" }}>
                        Proceed to the Situation Room to simulate your specific move.
                      </div>
                    </div>
                    <Link href="/app/situation-room">
                      <div style={{
                        display: "flex", alignItems: "center", gap: "6px",
                        padding: "8px 16px",
                        background: "rgba(255,170,0,0.1)",
                        border: "1px solid rgba(255,170,0,0.35)",
                        borderRadius: "3px",
                        color: "#FFAA00",
                        fontSize: "11px",
                        letterSpacing: "0.1em",
                        cursor: "pointer",
                        textDecoration: "none",
                        transition: "all 0.15s ease",
                        whiteSpace: "nowrap",
                      }}>
                        ENTER SITUATION ROOM <ArrowRight size={12} />
                      </div>
                    </Link>
                  </div>
                )}
              </PanelCard>
            </div>

            {/* ── Compliance disclaimer ── */}
            <div style={{
              marginTop: "24px",
              padding: "14px 16px",
              background: "rgba(255,255,255,0.02)",
              border: "1px solid rgba(255,255,255,0.05)",
              borderRadius: "3px",
              fontFamily: mono,
              fontSize: "10px",
              color: "#444",
              lineHeight: 1.7,
            }}>
              <strong style={{ color: "#555" }}>DISCLAIMER:</strong> FAULTLINE Pre-Flight is a market awareness tool for informational purposes only. It does not constitute investment advice, financial advice, or a recommendation to buy or sell any security. All data is derived from publicly available macroeconomic indicators and algorithmic models. Past market conditions are not predictive of future outcomes. Always consult a qualified financial professional before making investment decisions.
            </div>
          </>
        )}
      </div>

      <style>{`
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes shimmer { 0% { background-position: -200% 0; } 100% { background-position: 200% 0; } }
        @media (max-width: 900px) {
          .pre-flight-top-row {
            grid-template-columns: 1fr 1fr !important;
          }
        }
        @media (max-width: 600px) {
          .pre-flight-top-row {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </div>
  );
}
