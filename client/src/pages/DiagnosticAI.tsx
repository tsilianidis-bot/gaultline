// ============================================================
// FAULTLINE Diagnostic AI™ + Position Guidance™
// client/src/pages/DiagnosticAI.tsx
// ============================================================

import { useState, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import PageHeader from "@/components/PageHeader";
import { PreflightTrigger } from "@/components/MarketPreflight";
import { useSEO } from "@/hooks/useSEO";

// ── Types (mirrored from server) ─────────────────────────────

type Timeframe = "today" | "week" | "month" | "year";
type ActionBias = "Bullish" | "Neutral" | "Cautious" | "Defensive" | "Critical";
type PositionAction = "Add" | "Hold" | "Trim" | "Watch / No Add" | "Exit Watch" | "Sell Bias";
type ConvictionLevel = "High" | "Moderate" | "Low";

// ── Color helpers ─────────────────────────────────────────────

function biasColor(bias: ActionBias): string {
  switch (bias) {
    case "Bullish":   return "#00FF88";
    case "Neutral":   return "#64B5F6";
    case "Cautious":  return "#FFD700";
    case "Defensive": return "#FF9800";
    case "Critical":  return "#FF2D55";
    default:          return "#94A3B8";
  }
}

function actionColor(action: PositionAction): string {
  switch (action) {
    case "Add":            return "#00FF88";
    case "Hold":           return "#64B5F6";
    case "Trim":           return "#FFD700";
    case "Watch / No Add": return "#FF9800";
    case "Exit Watch":     return "#FF6B35";
    case "Sell Bias":      return "#FF2D55";
    default:               return "#94A3B8";
  }
}

function convictionColor(c: ConvictionLevel): string {
  switch (c) {
    case "High":     return "#FF2D55";
    case "Moderate": return "#FFD700";
    case "Low":      return "#64B5F6";
    default:         return "#94A3B8";
  }
}

function scoreColor(score: number, invert = false): string {
  const s = invert ? 100 - score : score;
  if (s >= 75) return "#FF2D55";
  if (s >= 55) return "#FF9800";
  if (s >= 35) return "#FFD700";
  return "#00FF88";
}

function trendArrow(trend: string): string {
  if (trend === "rising")  return "↑";
  if (trend === "falling") return "↓";
  return "→";
}

function trendArrowColor(trend: string): string {
  if (trend === "rising")  return "#FF2D55";
  if (trend === "falling") return "#00FF88";
  return "#64B5F6";
}

// ── Sub-components ────────────────────────────────────────────

function ScoreBar({ score, color, height = 6 }: { score: number; color: string; height?: number }) {
  return (
    <div style={{ background: "rgba(255,255,255,0.06)", borderRadius: 4, overflow: "hidden", height }}>
      <div style={{
        width: `${Math.max(2, score)}%`,
        height: "100%",
        background: color,
        borderRadius: 4,
        transition: "width 0.6s ease",
        boxShadow: `0 0 8px ${color}60`,
      }} />
    </div>
  );
}

function MetricRow({ metric }: { metric: { label: string; score: number; level: string; trend: string; note: string } }) {
  const color = scoreColor(metric.score);
  return (
    <div style={{
      padding: "10px 14px",
      borderBottom: "1px solid rgba(255,255,255,0.05)",
      display: "grid",
      gridTemplateColumns: "1fr auto auto",
      gap: "8px",
      alignItems: "center",
    }}>
      <div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
          <span style={{ fontSize: 11, fontFamily: "'Space Grotesk', sans-serif", color: "#CBD5E1", letterSpacing: "0.05em" }}>
            {metric.label}
          </span>
          <span style={{ fontSize: 10, color: trendArrowColor(metric.trend), fontWeight: 700 }}>
            {trendArrow(metric.trend)}
          </span>
        </div>
        <ScoreBar score={metric.score} color={color} />
        <div style={{ fontSize: 9, color: "#64748B", marginTop: 3, fontFamily: "'IBM Plex Mono', monospace" }}>
          {metric.note}
        </div>
      </div>
      <div style={{
        fontSize: 10,
        color: "#64748B",
        fontFamily: "'IBM Plex Mono', monospace",
        textAlign: "right",
        whiteSpace: "nowrap",
      }}>
        {metric.level}
      </div>
      <div style={{
        fontSize: 13,
        fontFamily: "'Orbitron', monospace",
        fontWeight: 700,
        color,
        textAlign: "right",
        minWidth: 36,
      }}>
        {metric.score}
      </div>
    </div>
  );
}

function ActionBiasBadge({ bias }: { bias: ActionBias }) {
  const color = biasColor(bias);
  return (
    <span style={{
      display: "inline-block",
      padding: "4px 12px",
      borderRadius: 4,
      border: `1px solid ${color}`,
      background: `${color}18`,
      color,
      fontSize: 11,
      fontFamily: "'Orbitron', monospace",
      fontWeight: 700,
      letterSpacing: "0.12em",
      textTransform: "uppercase",
    }}>
      {bias}
    </span>
  );
}

function DiagnosticSkeleton() {
  return (
    <div style={{ animation: "ambient-float 3s ease-in-out infinite" }}>
      {[...Array(6)].map((_, i) => (
        <div key={i} style={{
          height: 60,
          background: "rgba(255,255,255,0.04)",
          borderRadius: 8,
          marginBottom: 8,
          animation: `pulse-gold 1.5s ease-in-out ${i * 0.1}s infinite`,
        }} />
      ))}
    </div>
  );
}

// ── Main DiagnosticAI Page ────────────────────────────────────

const TABS: { id: Timeframe; label: string }[] = [
  { id: "today", label: "Today" },
  { id: "week",  label: "This Week" },
  { id: "month", label: "This Month" },
  { id: "year",  label: "This Year" },
];

export default function DiagnosticAI() {
  useSEO({
    title: "Diagnostic AI™ — Macro Timeframe Analysis & Position Guidance",
    description: "FAULTLINE Diagnostic AI™: four-timeframe macro analysis (Today/Week/Month/Year) with pressure scores, regime context, and AI-powered position guidance.",
    canonical: "/diagnostic",
  });
  const [activeTab, setActiveTab] = useState<Timeframe>("today");

  const { data: report, isLoading, error, refetch } = trpc.diagnostic.getReport.useQuery(
    { timeframe: activeTab },
    { staleTime: 5 * 60 * 1000, retry: 1 }
  );

  const { data: guidance, isLoading: guidanceLoading } = trpc.guidance.getGuidance.useQuery(
    undefined,
    { staleTime: 5 * 60 * 1000, retry: 1 }
  );

  const handleTabChange = useCallback((tab: Timeframe) => {
    setActiveTab(tab);
  }, []);

  return (
    <div style={{
      minHeight: "100vh",
      background: "linear-gradient(160deg, #050A14 0%, #080F1E 50%, #050A14 100%)",
      color: "#E2E8F0",
      fontFamily: "'Space Grotesk', sans-serif",
      maxWidth: 1200,
      margin: "0 auto",
    }}>
      <PageHeader
        title="AI Market Explanation"
        subtitle="AI-generated daily, weekly, monthly, and yearly market-risk interpretation — powered by FAULTLINE's live pressure engine."
        badge="AI-GENERATED"
        badgeColor="blue"
        rightSlot={<PreflightTrigger currentPage="diagnostic" actionKey="viewed_diagnostic_ai" />}
      />
      <div style={{ padding: "24px 20px 60px" }}>

      {/* ── Timeframe Tabs ── */}
      <div style={{
        display: "flex",
        gap: 4,
        marginBottom: 24,
        background: "rgba(255,255,255,0.04)",
        borderRadius: 10,
        padding: 4,
        border: "1px solid rgba(255,255,255,0.08)",
      }}>
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => handleTabChange(tab.id)}
            style={{
              flex: 1,
              padding: "10px 8px",
              borderRadius: 7,
              border: "none",
              cursor: "pointer",
              fontFamily: "'Orbitron', monospace",
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              transition: "all 0.2s ease",
              background: activeTab === tab.id
                ? "rgba(0, 255, 136, 0.12)"
                : "transparent",
              color: activeTab === tab.id ? "#00FF88" : "#64748B",
              borderBottom: activeTab === tab.id ? "2px solid #00FF88" : "2px solid transparent",
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── Loading / Error ── */}
      {isLoading && <DiagnosticSkeleton />}
      {error && (
        <div style={{
          padding: 20,
          background: "rgba(255,45,85,0.1)",
          border: "1px solid rgba(255,45,85,0.3)",
          borderRadius: 10,
          marginBottom: 24,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}>
          <span style={{ fontSize: 13, color: "#FF2D55" }}>
            Diagnostic data unavailable — FRED data may be loading
          </span>
          <button
            onClick={() => refetch()}
            style={{
              padding: "6px 14px",
              background: "rgba(255,45,85,0.15)",
              border: "1px solid rgba(255,45,85,0.4)",
              borderRadius: 6,
              color: "#FF2D55",
              fontSize: 11,
              fontFamily: "'IBM Plex Mono', monospace",
              cursor: "pointer",
            }}
          >
            RETRY
          </button>
        </div>
      )}

      {/* ── Diagnostic Report ── */}
      {report && (
        <>
          {/* Top summary strip */}
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
            gap: 12,
            marginBottom: 24,
          }}>
            {/* Pressure Index */}
            <div className="intel-module" style={{ padding: "16px 18px", textAlign: "center" }}>
              <div style={{ fontSize: 9, fontFamily: "'IBM Plex Mono', monospace", color: "#64748B", letterSpacing: "0.15em", marginBottom: 6 }}>
                PRESSURE INDEX
              </div>
              <div style={{
                fontSize: 36,
                fontFamily: "'Orbitron', monospace",
                fontWeight: 900,
                color: scoreColor(report.pressureIndex),
                lineHeight: 1,
                textShadow: `0 0 20px ${scoreColor(report.pressureIndex)}80`,
              }}>
                {report.pressureIndex}
              </div>
              <div style={{ fontSize: 9, color: "#64748B", marginTop: 4, fontFamily: "'IBM Plex Mono', monospace" }}>/ 100</div>
            </div>

            {/* Regime */}
            <div className="intel-module" style={{ padding: "16px 18px", textAlign: "center" }}>
              <div style={{ fontSize: 9, fontFamily: "'IBM Plex Mono', monospace", color: "#64748B", letterSpacing: "0.15em", marginBottom: 6 }}>
                EQUITY REGIME
              </div>
              <div style={{ fontSize: 11, fontFamily: "'Orbitron', monospace", fontWeight: 700, color: "#F1F5F9", lineHeight: 1.3 }}>
                {report.regimeLabel}
              </div>
              <div style={{ fontSize: 9, color: "#64748B", marginTop: 4, fontFamily: "'IBM Plex Mono', monospace" }}>
                {report.regime}
              </div>
            </div>

            {/* Trend */}
            <div className="intel-module" style={{ padding: "16px 18px", textAlign: "center" }}>
              <div style={{ fontSize: 9, fontFamily: "'IBM Plex Mono', monospace", color: "#64748B", letterSpacing: "0.15em", marginBottom: 6 }}>
                TREND DIRECTION
              </div>
              <div style={{
                fontSize: 13,
                fontFamily: "'Orbitron', monospace",
                fontWeight: 700,
                color: report.trendDirection === "Bullish" || report.trendDirection === "Recovering"
                  ? "#00FF88"
                  : report.trendDirection === "Bearish" || report.trendDirection === "Deteriorating"
                  ? "#FF2D55"
                  : "#FFD700",
              }}>
                {report.trendDirection}
              </div>
            </div>

            {/* Action Bias */}
            <div className="intel-module" style={{ padding: "16px 18px", textAlign: "center" }}>
              <div style={{ fontSize: 9, fontFamily: "'IBM Plex Mono', monospace", color: "#64748B", letterSpacing: "0.15em", marginBottom: 8 }}>
                EQUITY ACTION BIAS
              </div>
              <ActionBiasBadge bias={report.actionBias as ActionBias} />
              <div style={{ marginTop: 8 }}>
                <ScoreBar score={report.actionBiasScore} color={biasColor(report.actionBias as ActionBias)} height={4} />
              </div>
            </div>
          </div>

          {/* Main grid: metrics + interpretation */}
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 360px), 1fr))",
            gap: 16,
            marginBottom: 24,
          }}>
            {/* Left: metrics */}
            <div className="intel-module" style={{ padding: 0, overflow: "hidden" }}>
              <div style={{
                padding: "12px 16px",
                borderBottom: "1px solid rgba(255,255,255,0.08)",
                display: "flex",
                alignItems: "center",
                gap: 8,
              }}>
                <span style={{ fontSize: 9, fontFamily: "'IBM Plex Mono', monospace", color: "#64748B", letterSpacing: "0.15em" }}>
                  EQUITY RISK METRICS — {TABS.find(t => t.id === activeTab)?.label.toUpperCase()}
                </span>
              </div>
              <MetricRow metric={report.crashRisk} />
              <MetricRow metric={report.bullContinuation} />
              <MetricRow metric={report.volatility} />
              <MetricRow metric={report.treasuryYield} />
              <MetricRow metric={report.creditRisk} />
              <MetricRow metric={report.liquidity} />
              <MetricRow metric={report.marketBreadth} />
              <MetricRow metric={report.sectorLeadership} />
              <MetricRow metric={report.aiConcentration} />
              <MetricRow metric={report.stockSignal} />
            </div>

            {/* Right: interpretation panels */}
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {/* AI Interpretation */}
              <div className="intel-module" style={{ padding: "18px 20px" }}>
                <div style={{ fontSize: 9, fontFamily: "'IBM Plex Mono', monospace", color: "#00FF88", letterSpacing: "0.15em", marginBottom: 10 }}>
                  MACRO: AI INTERPRETATION
                </div>
                <p style={{ fontSize: 13, lineHeight: 1.7, color: "#CBD5E1", margin: 0 }}>
                  {report.aiInterpretation}
                </p>
              </div>

              {/* Why It Matters */}
              <div className="intel-module" style={{ padding: "18px 20px" }}>
                <div style={{ fontSize: 9, fontFamily: "'IBM Plex Mono', monospace", color: "#64B5F6", letterSpacing: "0.15em", marginBottom: 10 }}>
                  MACRO: WHY IT MATTERS
                </div>
                <p style={{ fontSize: 13, lineHeight: 1.7, color: "#CBD5E1", margin: 0 }}>
                  {report.whyItMatters}
                </p>
              </div>

              {/* Key Risk Drivers */}
              <div className="intel-module" style={{ padding: "18px 20px" }}>
                <div style={{ fontSize: 9, fontFamily: "'IBM Plex Mono', monospace", color: "#FF9800", letterSpacing: "0.15em", marginBottom: 10 }}>
                  KEY RISK DRIVERS
                </div>
                <ul style={{ margin: 0, padding: 0, listStyle: "none" }}>
                  {report.keyRiskDrivers.map((d: string, i: number) => (
                    <li key={i} style={{
                      display: "flex",
                      alignItems: "flex-start",
                      gap: 8,
                      marginBottom: 6,
                      fontSize: 12,
                      color: "#94A3B8",
                      lineHeight: 1.5,
                    }}>
                      <span style={{ color: "#FF9800", marginTop: 2, flexShrink: 0 }}>▸</span>
                      {d}
                    </li>
                  ))}
                </ul>
              </div>

              {/* What Changed */}
              <div className="intel-module" style={{ padding: "18px 20px" }}>
                <div style={{ fontSize: 9, fontFamily: "'IBM Plex Mono', monospace", color: "#FFD700", letterSpacing: "0.15em", marginBottom: 10 }}>
                  WHAT CHANGED
                </div>
                <ul style={{ margin: 0, padding: 0, listStyle: "none" }}>
                  {report.whatChanged.map((c: string, i: number) => (
                    <li key={i} style={{
                      display: "flex",
                      alignItems: "flex-start",
                      gap: 8,
                      marginBottom: 6,
                      fontSize: 12,
                      color: "#94A3B8",
                      lineHeight: 1.5,
                    }}>
                      <span style={{ color: "#FFD700", marginTop: 2, flexShrink: 0 }}>◆</span>
                      {c}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>

          {/* Disclaimer */}
          <div style={{
            padding: "12px 16px",
            background: "rgba(255,255,255,0.03)",
            border: "1px solid rgba(255,255,255,0.06)",
            borderRadius: 8,
            marginBottom: 40,
          }}>
            <p style={{ fontSize: 11, color: "#475569", margin: 0, lineHeight: 1.6 }}>
              <strong style={{ color: "#64748B" }}>FAULTLINE Diagnostic AI™</strong> is for market-risk awareness, research, and educational purposes only. It is not personalized financial advice, investment advice, or a guarantee of future market performance.
            </p>
          </div>
        </>
      )}

            {/* ── Position Guidance Section ── */}
      <PositionGuidanceSection guidance={guidance} isLoading={guidanceLoading} />
      </div>{/* /padding div */}
    </div>
  );
}
// ── Position Guidance Section ─────────────────────────────────

function PositionGuidanceSection({ guidance, isLoading }: { guidance: any[] | undefined; isLoading: boolean }) {
  return (
    <div>
      {/* Section header */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 6 }}>
          <div style={{
            width: 8, height: 8, borderRadius: "50%",
            background: "#64B5F6",
            boxShadow: "0 0 12px #64B5F6",
          }} />
          <span style={{
            fontSize: 10,
            fontFamily: "'IBM Plex Mono', monospace",
            color: "#64B5F6",
            letterSpacing: "0.2em",
            textTransform: "uppercase",
          }}>
            FAULTLINE POSITION GUIDANCE™
          </span>
        </div>
        <h2 style={{
          fontSize: "clamp(18px, 3vw, 24px)",
          fontFamily: "'Orbitron', monospace",
          fontWeight: 900,
          color: "#F1F5F9",
          margin: "0 0 4px",
          letterSpacing: "0.05em",
        }}>
          POSITION GUIDANCE™
        </h2>
        <p style={{ fontSize: 13, color: "#64748B", margin: 0 }}>
          AI-powered add, hold, trim, and exit-bias signals based on market conditions.
        </p>
        <div style={{
          marginTop: 8,
          padding: "6px 10px",
          background: "rgba(255,215,0,0.06)",
          border: "1px solid rgba(255,215,0,0.15)",
          borderRadius: 6,
          display: "inline-block",
        }}>
          <span style={{ fontSize: 10, color: "#FFD700", fontFamily: "'IBM Plex Mono', monospace" }}>
            DEMO MODE — Placeholder assets for illustration. Connect live data for production use.
          </span>
        </div>
      </div>

      {isLoading && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 16 }}>
          {[...Array(7)].map((_, i) => (
            <div key={i} style={{
              height: 200,
              background: "rgba(255,255,255,0.04)",
              borderRadius: 12,
              animation: `pulse-gold 1.5s ease-in-out ${i * 0.1}s infinite`,
            }} />
          ))}
        </div>
      )}

      {guidance && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))", gap: 16, marginBottom: 32 }}>
          {guidance.map((card: any) => (
            <PositionCard key={card.ticker} card={card} />
          ))}
        </div>
      )}

      {/* Disclaimer */}
      <div style={{
        padding: "12px 16px",
        background: "rgba(255,255,255,0.03)",
        border: "1px solid rgba(255,255,255,0.06)",
        borderRadius: 8,
      }}>
        <p style={{ fontSize: 11, color: "#475569", margin: 0, lineHeight: 1.6 }}>
          <strong style={{ color: "#64748B" }}>FAULTLINE Position Guidance™</strong> is for market-risk awareness, research, and educational purposes only. It is not personalized financial advice, investment advice, or a guarantee of future market performance.
        </p>
      </div>
    </div>
  );
}

// ── Position Card ─────────────────────────────────────────────

function PositionCard({ card }: { card: any }) {
  const [expanded, setExpanded] = useState(false);
  const [whyOpen, setWhyOpen] = useState(false);

  const actionCol = actionColor(card.action as PositionAction);
  const convCol   = convictionColor(card.conviction as ConvictionLevel);

  return (
    <div className="intel-module" style={{ padding: 0, overflow: "hidden" }}>
      {/* Card header */}
      <div style={{
        padding: "14px 16px",
        borderBottom: "1px solid rgba(255,255,255,0.06)",
        background: `linear-gradient(135deg, ${actionCol}08 0%, transparent 60%)`,
      }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2 }}>
              <span style={{
                fontSize: 18,
                fontFamily: "'Orbitron', monospace",
                fontWeight: 900,
                color: "#F1F5F9",
              }}>
                {card.ticker}
              </span>
              <span style={{
                fontSize: 9,
                fontFamily: "'IBM Plex Mono', monospace",
                color: "#64748B",
                background: "rgba(255,255,255,0.06)",
                padding: "2px 6px",
                borderRadius: 3,
              }}>
                {card.assetType}
              </span>
            </div>
            <div style={{ fontSize: 11, color: "#64748B", fontFamily: "'Space Grotesk', sans-serif" }}>
              {card.name}
            </div>
            <div style={{ fontSize: 9, fontFamily: "'IBM Plex Mono', monospace", color: "#475569", marginTop: 3 }}>
              {card.timeframe} · {card.regime}
            </div>
          </div>
          {/* Action badge */}
          <div style={{ textAlign: "right", flexShrink: 0 }}>
            <div style={{
              padding: "5px 10px",
              borderRadius: 5,
              border: `1px solid ${actionCol}`,
              background: `${actionCol}15`,
              color: actionCol,
              fontSize: 10,
              fontFamily: "'Orbitron', monospace",
              fontWeight: 700,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              marginBottom: 4,
            }}>
              {card.action}
            </div>
            <div style={{
              fontSize: 9,
              fontFamily: "'IBM Plex Mono', monospace",
              color: convCol,
              textAlign: "right",
            }}>
              {card.conviction} conviction
            </div>
          </div>
        </div>
      </div>

      {/* Scores grid */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "1fr 1fr 1fr",
        gap: 0,
        borderBottom: "1px solid rgba(255,255,255,0.06)",
      }}>
        {[
          { label: "PRESSURE", value: card.pressureIndex, invert: true },
          { label: "ASSET SCORE", value: card.scores.assetSignalScore, invert: false },
          { label: "MOMENTUM", value: card.scores.momentumScore, invert: false },
          { label: "SECTOR STR", value: card.scores.sectorStrengthScore, invert: false },
          { label: "VOLATILITY", value: card.scores.volatilityScore, invert: true },
          { label: "MACRO RISK", value: card.scores.macroRiskScore, invert: false },
        ].map((s, i) => (
          <div key={i} style={{
            padding: "10px 12px",
            borderRight: i % 3 !== 2 ? "1px solid rgba(255,255,255,0.05)" : "none",
            borderBottom: i < 3 ? "1px solid rgba(255,255,255,0.05)" : "none",
          }}>
            <div style={{ fontSize: 8, fontFamily: "'IBM Plex Mono', monospace", color: "#475569", letterSpacing: "0.1em", marginBottom: 4 }}>
              {s.label}
            </div>
            <div style={{
              fontSize: 16,
              fontFamily: "'Orbitron', monospace",
              fontWeight: 700,
              color: scoreColor(s.value, s.invert),
              lineHeight: 1,
            }}>
              {s.value}
            </div>
            <ScoreBar score={s.value} color={scoreColor(s.value, s.invert)} height={3} />
          </div>
        ))}
      </div>

      {/* Trend + support */}
      <div style={{ padding: "10px 16px", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
        <div style={{ fontSize: 10, color: "#94A3B8", marginBottom: 3 }}>
          <span style={{ color: "#64748B", fontFamily: "'IBM Plex Mono', monospace", fontSize: 9 }}>TREND  </span>
          {card.trendCondition}
        </div>
        <div style={{ fontSize: 10, color: "#94A3B8" }}>
          <span style={{ color: "#64748B", fontFamily: "'IBM Plex Mono', monospace", fontSize: 9 }}>SUPPORT  </span>
          {card.supportLevel}
        </div>
        <div style={{ fontSize: 10, color: "#94A3B8", marginTop: 3 }}>
          <span style={{ color: "#64748B", fontFamily: "'IBM Plex Mono', monospace", fontSize: 9 }}>PRICE  </span>
          <span style={{ color: "#64B5F6" }}>{card.currentPrice}</span>
        </div>
      </div>

      {/* AI Interpretation (collapsed by default) */}
      <button
        onClick={() => setExpanded(!expanded)}
        style={{
          width: "100%",
          padding: "10px 16px",
          background: "transparent",
          border: "none",
          borderBottom: "1px solid rgba(255,255,255,0.06)",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          color: "#64748B",
          fontSize: 10,
          fontFamily: "'IBM Plex Mono', monospace",
          letterSpacing: "0.1em",
        }}
      >
        <span>AI INTERPRETATION</span>
        <span style={{ color: "#00FF88", fontSize: 12 }}>{expanded ? "▲" : "▼"}</span>
      </button>

      {expanded && (
        <div style={{ padding: "12px 16px", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
          <p style={{ fontSize: 12, color: "#CBD5E1", lineHeight: 1.7, margin: "0 0 10px" }}>
            {card.aiInterpretation}
          </p>
          <div style={{
            padding: "8px 12px",
            background: `${actionCol}0A`,
            border: `1px solid ${actionCol}25`,
            borderRadius: 6,
            marginBottom: 8,
          }}>
            <div style={{ fontSize: 9, fontFamily: "'IBM Plex Mono', monospace", color: actionCol, marginBottom: 4 }}>
              SUGGESTED POSITION BEHAVIOR
            </div>
            <p style={{ fontSize: 12, color: "#CBD5E1", margin: 0, lineHeight: 1.6 }}>
              {card.suggestedBehavior}
            </p>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <div style={{ padding: "8px 10px", background: "rgba(255,45,85,0.06)", border: "1px solid rgba(255,45,85,0.15)", borderRadius: 6 }}>
              <div style={{ fontSize: 8, fontFamily: "'IBM Plex Mono', monospace", color: "#FF2D55", marginBottom: 3 }}>INVALIDATION</div>
              <p style={{ fontSize: 11, color: "#94A3B8", margin: 0, lineHeight: 1.5 }}>{card.invalidationCondition}</p>
            </div>
            <div style={{ padding: "8px 10px", background: "rgba(100,181,246,0.06)", border: "1px solid rgba(100,181,246,0.15)", borderRadius: 6 }}>
              <div style={{ fontSize: 8, fontFamily: "'IBM Plex Mono', monospace", color: "#64B5F6", marginBottom: 3 }}>WATCH FOR</div>
              <p style={{ fontSize: 11, color: "#94A3B8", margin: 0, lineHeight: 1.5 }}>{card.nextConditionToWatch}</p>
            </div>
          </div>
        </div>
      )}

      {/* Key Drivers */}
      {expanded && (
        <div style={{ padding: "10px 16px", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
          <div style={{ fontSize: 9, fontFamily: "'IBM Plex Mono', monospace", color: "#FF9800", marginBottom: 6 }}>KEY DRIVERS</div>
          {card.keyDrivers.map((d: string, i: number) => (
            <div key={i} style={{ display: "flex", gap: 6, marginBottom: 4, fontSize: 11, color: "#94A3B8", lineHeight: 1.5 }}>
              <span style={{ color: "#FF9800", flexShrink: 0 }}>▸</span>
              {d}
            </div>
          ))}
        </div>
      )}

      {/* Why This Signal? */}
      <button
        onClick={() => setWhyOpen(!whyOpen)}
        style={{
          width: "100%",
          padding: "10px 16px",
          background: "transparent",
          border: "none",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          color: "#64748B",
          fontSize: 10,
          fontFamily: "'IBM Plex Mono', monospace",
          letterSpacing: "0.1em",
        }}
      >
        <span>WHY THIS SIGNAL?</span>
        <span style={{ color: "#64B5F6", fontSize: 12 }}>{whyOpen ? "▲" : "▼"}</span>
      </button>

      {whyOpen && card.whyThisSignal && (
        <div style={{ padding: "12px 16px", background: "rgba(100,181,246,0.04)", borderTop: "1px solid rgba(100,181,246,0.1)" }}>
          {[
            { label: "CAUSE", value: card.whyThisSignal.cause, color: "#CBD5E1" },
            { label: "DRIVER", value: card.whyThisSignal.driver, color: "#CBD5E1" },
            { label: "ISSUE TYPE", value: card.whyThisSignal.issueType, color: "#FFD700" },
            { label: "WHAT IMPROVES SIGNAL", value: card.whyThisSignal.whatImproves, color: "#00FF88" },
            { label: "WHAT WORSENS SIGNAL", value: card.whyThisSignal.whatWorsens, color: "#FF2D55" },
          ].map((row, i) => (
            <div key={i} style={{ marginBottom: 8 }}>
              <div style={{ fontSize: 8, fontFamily: "'IBM Plex Mono', monospace", color: "#475569", letterSpacing: "0.1em", marginBottom: 2 }}>
                {row.label}
              </div>
              <div style={{ fontSize: 12, color: row.color, lineHeight: 1.5 }}>{row.value}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
