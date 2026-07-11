/* ============================================================
   SeismographNarrativeBanner — The cohesion thread
   Answers the 7 understanding questions on every major page:
   1. What is happening?
   2. Why is it happening?
   3. What is driving it?
   4. How long has it been developing?
   5. What changed today?
   6. How does today compare to history?
   7. What should I monitor next?

   Reads exclusively from trpc.seismograph.getAssembledOutput.
   Falls back gracefully when no Seismograph data exists yet.
   ============================================================ */
import { useState, useCallback } from "react";
import { ChevronDown, ChevronUp, Activity, Clock, BarChart2, AlertTriangle, TrendingUp, TrendingDown, Minus, ArrowRight, RefreshCw } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { Link } from "wouter";

// ── Types (mirrors SeismographOutput from server) ─────────────
interface SeismographAnalog {
  label: string;
  similarity: number;
  description: string;
  period?: string;
  outcome?: string;
  durationMonths?: number;
}
interface SeismographPattern {
  patternId: string;
  name: string;
  description: string;
  confidence: number;
  daysActive: number;
  historicalOutcome?: string;
}
interface SeismographMarketMemory {
  streakDays: number;
  streakDirection: "rising" | "falling" | "stable";
  peakPressureThisCycle: number;
  troughPressureThisCycle: number;
  daysSinceLastTransition: number;
  lastRegimeTransition?: string;
  keyMemoryPoints: string[];
}
interface SeismographTransitionProbabilities {
  remainInRegime: number;
  transitionToElevated: number;
  transitionToLow: number;
  transitionToCrisis: number;
  primaryDriver: string;
}
interface SeismographOutput {
  pressureScore: number;
  regime: string;
  stressLevel: string;
  direction: "Improving" | "Stable" | "Deteriorating" | "Accelerating";
  probabilities: { bull: number; neutral: number; bear: number; primaryDriver: string; confidence: number };
  historicalPercentile: number;
  topAnalog: SeismographAnalog | null;
  activePatterns: SeismographPattern[];
  patternsSummary: string;
  transitionProbabilities: SeismographTransitionProbabilities;
  marketMemory: SeismographMarketMemory;
  evidenceConsensus: "strong" | "moderate" | "weak" | "divergent";
  dataFreshness: "live" | "recent" | "stale";
  computedAt: number;
  forDashboard: {
    pressureScore: number;
    regime: string;
    stressLevel: string;
    direction: string;
    probabilities: { bull: number; neutral: number; bear: number };
    topAnalog: SeismographAnalog | null;
    activePatterns: SeismographPattern[];
    transitionProbabilities: SeismographTransitionProbabilities;
    marketMemory: SeismographMarketMemory;
    lastUpdated: number;
    dataFreshness: "live" | "recent" | "stale";
  };
}

// ── Helpers ───────────────────────────────────────────────────
function getStressColor(level: string): string {
  if (level === "Crisis") return "#FF2D55";
  if (level === "High") return "#FF6B35";
  if (level === "Elevated") return "#FF9500";
  return "#22C55E";
}
function getDirectionIcon(direction: string) {
  if (direction === "Improving") return <TrendingDown size={11} style={{ color: "#22C55E" }} />;
  if (direction === "Deteriorating" || direction === "Accelerating") return <TrendingUp size={11} style={{ color: "#FF2D55" }} />;
  return <Minus size={11} style={{ color: "#94A3B8" }} />;
}
function getDirectionColor(direction: string): string {
  if (direction === "Improving") return "#22C55E";
  if (direction === "Deteriorating" || direction === "Accelerating") return "#FF2D55";
  return "#94A3B8";
}
function formatTimeAgo(ts: number): string {
  const diff = Date.now() - ts;
  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  if (h >= 24) return `${Math.floor(h / 24)}d ago`;
  if (h > 0) return `${h}h ${m}m ago`;
  return `${m}m ago`;
}
function getStreakLabel(memory: SeismographMarketMemory): string {
  const dir = memory.streakDirection === "rising" ? "rising" : memory.streakDirection === "falling" ? "falling" : "stable";
  return `${memory.streakDays}d ${dir} streak`;
}
function getHistoricalPercentileLabel(pct: number): string {
  if (pct >= 90) return `top ${100 - pct}% most stressed in history`;
  if (pct >= 75) return `more stressed than ${pct}% of historical days`;
  if (pct >= 50) return `above median historical stress`;
  if (pct >= 25) return `below median — calmer than ${100 - pct}% of historical days`;
  return `among the calmest ${pct}% of historical days`;
}

// ── Props ─────────────────────────────────────────────────────
export interface SeismographNarrativeBannerProps {
  /** Which page is showing this banner — used to customize "what to watch next" */
  context?: "dashboard" | "pressure" | "signals" | "regime" | "situation" | "daily-brief" | "seismograph" | "default";
  /** Whether to show the full expanded view by default */
  defaultExpanded?: boolean;
  /** Whether to show the "View Full Seismograph" link */
  showSeismographLink?: boolean;
}

// ── Next step map ─────────────────────────────────────────────
const NEXT_STEPS: Record<string, { label: string; path: string }> = {
  dashboard:    { label: "Explore the Pressure Index →", path: "/app/pressure" },
  pressure:     { label: "See the Regime Analysis →", path: "/app/market-intelligence" },
  regime:       { label: "Check the Situation Room →", path: "/app/situation-room" },
  signals:      { label: "Run a Pre-Flight Check →", path: "/app/pre-flight" },
  situation:    { label: "Ask FAULTLINE about this environment →", path: "/app/discover" },
  "daily-brief":{ label: "See what signals are active →", path: "/app/signals" },
  seismograph:  { label: "Ask FAULTLINE about this reading →", path: "/app/discover" },
  default:      { label: "View the full Seismograph →", path: "/app/seismograph" },
};

// ── Main Component ────────────────────────────────────────────
export default function SeismographNarrativeBanner({
  context = "default",
  defaultExpanded = false,
  showSeismographLink = true,
}: SeismographNarrativeBannerProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const toggle = useCallback(() => setExpanded(v => !v), []);

  const { data: output, isLoading, refetch, isRefetching } = trpc.seismograph.getAssembledOutput.useQuery(undefined, {
    refetchOnWindowFocus: false,
    staleTime: 5 * 60 * 1000,
  });

  const nextStep = NEXT_STEPS[context] ?? NEXT_STEPS.default;

  // ── Loading skeleton ──────────────────────────────────────
  if (isLoading) {
    return (
      <div style={{
        background: "rgba(0,212,255,0.03)",
        border: "1px solid rgba(0,212,255,0.08)",
        borderRadius: "6px",
        padding: "10px 14px",
        marginBottom: "16px",
        display: "flex",
        alignItems: "center",
        gap: "10px",
      }}>
        <Activity size={13} style={{ color: "rgba(0,212,255,0.4)", flexShrink: 0 }} />
        <div style={{ flex: 1 }}>
          <div style={{ height: "8px", width: "60%", background: "rgba(255,255,255,0.05)", borderRadius: "2px", marginBottom: "6px" }} />
          <div style={{ height: "7px", width: "40%", background: "rgba(255,255,255,0.04)", borderRadius: "2px" }} />
        </div>
      </div>
    );
  }

  // ── No data yet ───────────────────────────────────────────
  if (!output) {
    return (
      <div style={{
        background: "rgba(0,212,255,0.02)",
        border: "1px solid rgba(0,212,255,0.06)",
        borderRadius: "6px",
        padding: "10px 14px",
        marginBottom: "16px",
        display: "flex",
        alignItems: "center",
        gap: "10px",
      }}>
        <Activity size={13} style={{ color: "rgba(0,212,255,0.3)", flexShrink: 0 }} />
        <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "10px", color: "rgba(148,163,184,0.5)" }}>
          Seismograph reading not yet available — runs automatically after market close.
        </span>
        {context === "seismograph" && (
          <Link href="/app/seismograph" style={{ marginLeft: "auto", fontFamily: "'IBM Plex Mono', monospace", fontSize: "9px", color: "#00D4FF", textDecoration: "none", flexShrink: 0 }}>
            Generate now →
          </Link>
        )}
      </div>
    );
  }

  const stressColor = getStressColor(output.stressLevel);
  const dirColor = getDirectionColor(output.direction);

  // ── Collapsed summary bar ─────────────────────────────────
  const collapsedBar = (
    <button
      onClick={toggle}
      style={{
        width: "100%",
        background: "rgba(0,0,0,0)",
        border: "none",
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        gap: "10px",
        padding: "10px 14px",
        textAlign: "left",
      }}
    >
      {/* Stress indicator dot */}
      <span style={{
        width: "7px", height: "7px", borderRadius: "50%",
        background: stressColor,
        boxShadow: `0 0 6px ${stressColor}60`,
        flexShrink: 0,
      }} />

      {/* Regime + direction */}
      <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "10px", color: "#E2E8F0", fontWeight: 600, flexShrink: 0 }}>
        {output.regime}
      </span>

      {/* Direction arrow */}
      <span style={{ display: "flex", alignItems: "center", gap: "3px", flexShrink: 0 }}>
        {getDirectionIcon(output.direction)}
        <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "9px", color: dirColor, letterSpacing: "0.06em" }}>
          {output.direction}
        </span>
      </span>

      {/* Pressure score */}
      <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "9px", color: "rgba(148,163,184,0.7)", flexShrink: 0 }}>
        Pressure {output.pressureScore.toFixed(1)}/10
      </span>

      {/* Historical percentile */}
      <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "9px", color: "rgba(148,163,184,0.5)", flexShrink: 0 }}>
        · {getHistoricalPercentileLabel(output.historicalPercentile)}
      </span>

      {/* Spacer */}
      <span style={{ flex: 1 }} />

      {/* Freshness */}
      <span style={{
        fontFamily: "'IBM Plex Mono', monospace", fontSize: "8px",
        color: output.dataFreshness === "live" ? "#22C55E" : output.dataFreshness === "recent" ? "#FF9500" : "#FF2D55",
        letterSpacing: "0.1em", flexShrink: 0,
      }}>
        {output.dataFreshness.toUpperCase()}
      </span>

      {/* Expand toggle */}
      <span style={{ color: "rgba(0,212,255,0.5)", flexShrink: 0 }}>
        {expanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
      </span>
    </button>
  );

  // ── Expanded detail ───────────────────────────────────────
  const expandedDetail = expanded && (
    <div style={{ padding: "0 14px 14px 14px" }}>
      {/* Divider */}
      <div style={{ height: "1px", background: "rgba(0,212,255,0.06)", marginBottom: "14px" }} />

      {/* 7-question grid */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>

        {/* Q1: What is happening? */}
        <div style={{ gridColumn: "1 / -1", padding: "10px 12px", background: "rgba(0,0,0,0.3)", borderRadius: "4px", borderLeft: `2px solid ${stressColor}` }}>
          <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "8px", color: stressColor, letterSpacing: "0.15em", marginBottom: "5px" }}>WHAT IS HAPPENING</div>
          <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "11px", color: "#E2E8F0", lineHeight: 1.6 }}>
            The market is in a <strong style={{ color: stressColor }}>{output.stressLevel}</strong> stress regime — <strong style={{ color: "#E2E8F0" }}>{output.regime}</strong>.
            {" "}Conditions are <strong style={{ color: dirColor }}>{output.direction.toLowerCase()}</strong> with a {output.probabilities.bull}% probability of a bullish outcome
            and {output.probabilities.bear}% probability of a bearish outcome.
            {output.evidenceConsensus === "strong" && " Evidence across all measurement systems is in strong agreement."}
            {output.evidenceConsensus === "divergent" && " Evidence is divergent — different measurement systems are sending conflicting signals."}
          </div>
        </div>

        {/* Q2: Why is it happening? */}
        <div style={{ padding: "10px 12px", background: "rgba(0,0,0,0.3)", borderRadius: "4px", borderLeft: "2px solid rgba(0,212,255,0.3)" }}>
          <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "8px", color: "rgba(0,212,255,0.7)", letterSpacing: "0.15em", marginBottom: "5px" }}>WHY IT IS HAPPENING</div>
          <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "10px", color: "#94A3B8", lineHeight: 1.6 }}>
            Primary driver: <strong style={{ color: "#E2E8F0" }}>{output.probabilities.primaryDriver}</strong>.
            {output.transitionProbabilities.primaryDriver && (
              <> Transition risk driven by: <strong style={{ color: "#E2E8F0" }}>{output.transitionProbabilities.primaryDriver}</strong>.</>
            )}
          </div>
        </div>

        {/* Q3: How long has it been developing? */}
        <div style={{ padding: "10px 12px", background: "rgba(0,0,0,0.3)", borderRadius: "4px", borderLeft: "2px solid rgba(0,212,255,0.3)" }}>
          <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "8px", color: "rgba(0,212,255,0.7)", letterSpacing: "0.15em", marginBottom: "5px" }}>HOW LONG DEVELOPING</div>
          <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "10px", color: "#94A3B8", lineHeight: 1.6 }}>
            {getStreakLabel(output.marketMemory)} · {output.marketMemory.daysSinceLastTransition} days since last regime transition.
            {output.marketMemory.lastRegimeTransition && (
              <> Previous: <strong style={{ color: "#E2E8F0" }}>{output.marketMemory.lastRegimeTransition}</strong>.</>
            )}
          </div>
        </div>

        {/* Q4: Active patterns */}
        {output.activePatterns.length > 0 && (
          <div style={{ gridColumn: "1 / -1", padding: "10px 12px", background: "rgba(0,0,0,0.3)", borderRadius: "4px", borderLeft: "2px solid rgba(255,149,0,0.4)" }}>
            <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "8px", color: "rgba(255,149,0,0.8)", letterSpacing: "0.15em", marginBottom: "5px" }}>ACTIVE PATTERNS</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
              {output.activePatterns.slice(0, 3).map((p) => (
                <div key={p.patternId} style={{ padding: "4px 8px", background: "rgba(255,149,0,0.06)", border: "1px solid rgba(255,149,0,0.15)", borderRadius: "3px" }}>
                  <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "9px", color: "#FF9500", marginBottom: "2px" }}>{p.name}</div>
                  <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "8px", color: "rgba(148,163,184,0.7)" }}>
                    {p.daysActive}d active · {Math.round(p.confidence * 100)}% confidence
                    {p.historicalOutcome && <> · Hist: {p.historicalOutcome}</>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Q5: Historical comparison */}
        {output.topAnalog && (
          <div style={{ gridColumn: "1 / -1", padding: "10px 12px", background: "rgba(0,0,0,0.3)", borderRadius: "4px", borderLeft: "2px solid rgba(139,92,246,0.4)" }}>
            <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "8px", color: "rgba(139,92,246,0.8)", letterSpacing: "0.15em", marginBottom: "5px" }}>CLOSEST HISTORICAL ANALOG</div>
            <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "10px", color: "#94A3B8", lineHeight: 1.6 }}>
              <strong style={{ color: "#E2E8F0" }}>{output.topAnalog.label}</strong>
              {output.topAnalog.period && <> ({output.topAnalog.period})</>}
              {" "}— {Math.round(output.topAnalog.similarity * 100)}% similarity.
              {" "}{output.topAnalog.description}
              {output.topAnalog.outcome && (
                <> Historical outcome: <strong style={{ color: "#E2E8F0" }}>{output.topAnalog.outcome}</strong>.</>
              )}
            </div>
          </div>
        )}

        {/* Q6: Historical percentile */}
        <div style={{ padding: "10px 12px", background: "rgba(0,0,0,0.3)", borderRadius: "4px", borderLeft: "2px solid rgba(0,212,255,0.3)" }}>
          <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "8px", color: "rgba(0,212,255,0.7)", letterSpacing: "0.15em", marginBottom: "5px" }}>HOW THIS COMPARES TO HISTORY</div>
          <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "10px", color: "#94A3B8", lineHeight: 1.6 }}>
            This reading is at the <strong style={{ color: "#E2E8F0" }}>{output.historicalPercentile}th percentile</strong> — {getHistoricalPercentileLabel(output.historicalPercentile)}.
          </div>
        </div>

        {/* Q7: What to watch next */}
        <div style={{ padding: "10px 12px", background: "rgba(0,0,0,0.3)", borderRadius: "4px", borderLeft: "2px solid rgba(0,212,255,0.3)" }}>
          <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "8px", color: "rgba(0,212,255,0.7)", letterSpacing: "0.15em", marginBottom: "5px" }}>WHAT TO MONITOR NEXT</div>
          <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "10px", color: "#94A3B8", lineHeight: 1.6 }}>
            {output.transitionProbabilities.transitionToCrisis > 20 && (
              <><strong style={{ color: "#FF2D55" }}>Crisis transition risk: {output.transitionProbabilities.transitionToCrisis}%.</strong>{" "}</>
            )}
            {output.marketMemory.keyMemoryPoints.slice(0, 2).map((pt, i) => (
              <span key={i}>{pt}{i < 1 ? " · " : ""}</span>
            ))}
          </div>
        </div>

      </div>

      {/* Footer: last updated + next step CTA */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: "12px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "8px", color: "rgba(148,163,184,0.4)" }}>
            Updated {formatTimeAgo(output.computedAt)}
          </span>
          <button
            onClick={() => refetch()}
            disabled={isRefetching}
            style={{ background: "none", border: "none", cursor: "pointer", padding: "2px", color: "rgba(0,212,255,0.3)", display: "flex", alignItems: "center" }}
          >
            <RefreshCw size={10} style={{ animation: isRefetching ? "spin 1s linear infinite" : "none" }} />
          </button>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          {showSeismographLink && context !== "seismograph" && (
            <Link href="/app/seismograph" style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "9px", color: "rgba(0,212,255,0.5)", textDecoration: "none" }}>
              Full Seismograph
            </Link>
          )}
          <Link href={nextStep.path} style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "9px", color: "#00D4FF", textDecoration: "none", display: "flex", alignItems: "center", gap: "4px" }}>
            {nextStep.label} <ArrowRight size={10} />
          </Link>
        </div>
      </div>
    </div>
  );

  return (
    <div style={{
      background: "rgba(0,212,255,0.02)",
      border: `1px solid rgba(0,212,255,0.08)`,
      borderTop: `2px solid ${stressColor}40`,
      borderRadius: "6px",
      marginBottom: "16px",
      overflow: "hidden",
    }}>
      {collapsedBar}
      {expandedDetail}
    </div>
  );
}
