/**
 * FAULTLINE — Portfolio Intelligence™
 * 8-metric macro-risk intelligence layer displayed above holdings.
 * Design: Palantir Noir — void black, neon accents, cockpit HUD language.
 */

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { TrendingUp, TrendingDown, Minus, ChevronDown, ChevronUp, Brain } from "lucide-react";

// ── Types ─────────────────────────────────────────────────────
type IntelMetric = {
  id: string;
  label: string;
  description: string;
  score: number;
  level: string;
  driver: string;
  trend: "rising" | "falling" | "stable";
  color: string;
};

// ── Gauge Bar ─────────────────────────────────────────────────
function GaugeBar({ score, color }: { score: number; color: string }) {
  return (
    <div style={{ height: "4px", background: "rgba(255,255,255,0.06)", borderRadius: "2px", overflow: "hidden" }}>
      <div
        style={{
          height: "100%",
          width: `${score}%`,
          background: `linear-gradient(90deg, ${color}80, ${color})`,
          borderRadius: "2px",
          transition: "width 0.6s cubic-bezier(0.23,1,0.32,1)",
        }}
      />
    </div>
  );
}

// ── Trend Icon ────────────────────────────────────────────────
function TrendIcon({ trend, color }: { trend: "rising" | "falling" | "stable"; color: string }) {
  if (trend === "rising") return <TrendingUp size={11} style={{ color }} />;
  if (trend === "falling") return <TrendingDown size={11} style={{ color: "#00FF88" }} />;
  return <Minus size={11} style={{ color: "#64748B" }} />;
}

// ── Single Metric Card ────────────────────────────────────────
function MetricCard({ metric }: { metric: IntelMetric }) {
  const [expanded, setExpanded] = useState(false);
  const isHigh = metric.score >= 60;

  return (
    <div
      style={{
        background: "rgba(255,255,255,0.02)",
        border: `1px solid ${isHigh ? metric.color + "30" : "rgba(255,255,255,0.06)"}`,
        borderLeft: `3px solid ${metric.color}`,
        borderRadius: "6px",
        padding: "12px 14px",
        cursor: "pointer",
        transition: "border-color 0.2s, background 0.2s",
      }}
      onClick={() => setExpanded(e => !e)}
      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.04)"; }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.02)"; }}
    >
      {/* Row 1: label + score + trend */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "8px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <TrendIcon trend={metric.trend} color={metric.color} />
          <span style={{
            fontFamily: "'IBM Plex Mono', monospace",
            fontSize: "10px",
            color: "#A8B8CC",
            letterSpacing: "0.1em",
            textTransform: "uppercase",
          }}>
            {metric.label}
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <span style={{
            fontFamily: "'Rajdhani', sans-serif",
            fontWeight: 700,
            fontSize: "16px",
            color: metric.color,
          }}>
            {metric.score}
          </span>
          <span style={{
            fontFamily: "'IBM Plex Mono', monospace",
            fontSize: "9px",
            color: metric.color,
            background: `${metric.color}15`,
            border: `1px solid ${metric.color}30`,
            borderRadius: "3px",
            padding: "1px 5px",
            letterSpacing: "0.08em",
            textTransform: "uppercase",
          }}>
            {metric.level}
          </span>
          {expanded ? <ChevronUp size={12} style={{ color: "#4B5563" }} /> : <ChevronDown size={12} style={{ color: "#4B5563" }} />}
        </div>
      </div>

      {/* Gauge bar */}
      <GaugeBar score={metric.score} color={metric.color} />

      {/* Expanded: driver + description */}
      {expanded && (
        <div style={{ marginTop: "10px", paddingTop: "10px", borderTop: "1px solid rgba(255,255,255,0.05)" }}>
          <p style={{
            fontFamily: "'IBM Plex Mono', monospace",
            fontSize: "10px",
            color: "#64748B",
            letterSpacing: "0.06em",
            lineHeight: 1.7,
            margin: "0 0 6px",
          }}>
            {metric.driver}
          </p>
          <p style={{
            fontFamily: "'IBM Plex Sans', sans-serif",
            fontSize: "11px",
            color: "#374151",
            lineHeight: 1.5,
            margin: 0,
          }}>
            {metric.description}
          </p>
        </div>
      )}
    </div>
  );
}

// ── Skeleton ──────────────────────────────────────────────────
function IntelligenceSkeleton() {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "10px" }}>
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} style={{
          height: "72px",
          borderRadius: "6px",
          background: "rgba(255,255,255,0.02)",
          border: "1px solid rgba(255,255,255,0.04)",
          animation: "pulse 1.5s ease-in-out infinite",
          animationDelay: `${i * 0.08}s`,
        }} />
      ))}
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────
export default function PortfolioIntelligence() {
  const { user } = useAuth();
  const [collapsed, setCollapsed] = useState(false);

  const { data, isLoading, isError, error } = trpc.portfolio.getIntelligence.useQuery(
    undefined,
    { enabled: !!user, staleTime: 120_000 }
  );

  if (!user) return null;

  const metrics = (data?.metrics ?? []) as IntelMetric[];
  const highRiskCount = metrics.filter(m => m.score >= 60).length;
  const overallColor = highRiskCount >= 5 ? "#FF2D55" : highRiskCount >= 3 ? "#FF6B35" : highRiskCount >= 1 ? "#FFD60A" : "#00FF88";

  return (
    <div style={{ marginBottom: "24px" }}>
      {/* Section header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: collapsed ? "0" : "14px",
          cursor: "pointer",
          padding: "12px 16px",
          background: "rgba(255,255,255,0.02)",
          border: "1px solid rgba(255,255,255,0.06)",
          borderLeft: `3px solid ${overallColor}`,
          borderRadius: collapsed ? "6px" : "6px 6px 0 0",
          transition: "border-radius 0.2s",
        }}
        onClick={() => setCollapsed(c => !c)}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <Brain size={14} style={{ color: overallColor }} />
          <div>
            <span style={{
              fontFamily: "'IBM Plex Mono', monospace",
              fontSize: "11px",
              color: overallColor,
              letterSpacing: "0.18em",
              textTransform: "uppercase",
              fontWeight: 600,
            }}>
              Portfolio Intelligence™
            </span>
            {data && (
              <span style={{
                marginLeft: "10px",
                fontFamily: "'IBM Plex Mono', monospace",
                fontSize: "9px",
                color: "#374151",
                letterSpacing: "0.08em",
              }}>
                {data.regime} · {data.dataSource === "live" ? "LIVE DATA" : "FALLBACK DATA"}
              </span>
            )}
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          {!isLoading && !isError && (
            <span style={{
              fontFamily: "'IBM Plex Mono', monospace",
              fontSize: "9px",
              color: overallColor,
              background: `${overallColor}15`,
              border: `1px solid ${overallColor}30`,
              borderRadius: "3px",
              padding: "2px 7px",
              letterSpacing: "0.08em",
            }}>
              {highRiskCount} HIGH RISK
            </span>
          )}
          {collapsed
            ? <ChevronDown size={14} style={{ color: "#4B5563" }} />
            : <ChevronUp size={14} style={{ color: "#4B5563" }} />
          }
        </div>
      </div>

      {/* Content */}
      {!collapsed && (
        <div style={{
          padding: "14px 16px",
          background: "rgba(255,255,255,0.01)",
          border: "1px solid rgba(255,255,255,0.06)",
          borderTop: "none",
          borderRadius: "0 0 6px 6px",
        }}>
          {isLoading && <IntelligenceSkeleton />}

          {isError && (
            <div style={{
              padding: "16px",
              background: "rgba(255,45,85,0.06)",
              border: "1px solid rgba(255,45,85,0.15)",
              borderRadius: "6px",
              fontFamily: "'IBM Plex Mono', monospace",
              fontSize: "10px",
              color: "#FF2D55",
              letterSpacing: "0.08em",
            }}>
              INTELLIGENCE UNAVAILABLE — {(error as { message?: string })?.message ?? "Engine error"}
            </div>
          )}

          {!isLoading && !isError && metrics.length > 0 && (
            <>
              <div style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
                gap: "10px",
                marginBottom: "12px",
              }}>
                {metrics.map(m => <MetricCard key={m.id} metric={m} />)}
              </div>
              <p style={{
                fontFamily: "'IBM Plex Mono', monospace",
                fontSize: "9px",
                color: "#1F2937",
                letterSpacing: "0.06em",
                lineHeight: 1.6,
                margin: 0,
                paddingTop: "10px",
                borderTop: "1px solid rgba(255,255,255,0.04)",
              }}>
                PORTFOLIO INTELLIGENCE™ IS DERIVED FROM FAULTLINE MACRO-RISK VECTORS AND IS NOT PERSONALIZED FINANCIAL ADVICE.
                SCORES REFLECT SYSTEMIC MARKET CONDITIONS, NOT INDIVIDUAL POSITION PERFORMANCE. NOT A RECOMMENDATION TO BUY, SELL, OR HOLD.
              </p>
            </>
          )}
        </div>
      )}

      <style>{`
        @keyframes pulse { 0%, 100% { opacity: 0.4; } 50% { opacity: 0.8; } }
      `}</style>
    </div>
  );
}
