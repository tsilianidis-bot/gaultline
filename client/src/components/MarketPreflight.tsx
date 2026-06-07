/**
 * FAULTLINE Complete Market Awareness™
 * MarketPreflight — the modal, score ring, checklist, and interpretation panel.
 */

import { useState, useEffect, useCallback, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { useLocation } from "wouter";
import { useEngine } from "@/contexts/EngineContext";
import type { EngineOutput } from "@/lib/engine";

// ── Types ────────────────────────────────────────────────────
interface ScoreData {
  score: number;
  completedKeys: string[];
  missingKeys: string[];
  rating: {
    label: string;
    statusLabel: string;
    color: string;
  };
  categoryBreakdown: Record<string, { earned: number; max: number }>;
}

// ── Checklist items ──────────────────────────────────────────
const CHECKLIST_ITEMS = [
  {
    key: "viewed_dashboard",
    label: "Open the Dashboard",
    description: "Review the FAULTLINE Pressure Index and current regime.",
    page: "/",
    category: "A",
    points: 10,
  },
  {
    key: "reviewed_faultline_score",
    label: "Review the Pressure Score",
    description: "Check the composite risk score and understand the current risk level.",
    page: "/pressure",
    category: "A",
    points: 10,
  },
  {
    key: "opened_score_explanation",
    label: "Read the Score Explanation",
    description: "Understand what the 6 risk vectors mean for the current environment.",
    page: "/scores",
    category: "B",
    points: 10,
  },
  {
    key: "viewed_market_regime",
    label: "Check the Market Regime",
    description: "Identify whether we are in a bull, bear, or transition regime.",
    page: "/pressure",
    category: "B",
    points: 10,
  },
  {
    key: "viewed_alerts",
    label: "Review Active Alerts",
    description: "Check for any active risk alerts or threshold breaches.",
    page: "/alerts",
    category: "C",
    points: 10,
  },
  {
    key: "viewed_signal_explanation",
    label: "Review Signal Context",
    description: "Check the signal labels on key tickers and understand what they mean.",
    page: "/signals",
    category: "C",
    points: 10,
  },
  {
    key: "opened_scenario_tool",
    label: "Run a Pressure Scenario",
    description: "Simulate a market stress scenario to understand downside risk.",
    page: "/simulate",
    category: "D",
    points: 15,
  },
  {
    key: "checked_data_status",
    label: "Verify Data Status",
    description: "Confirm prices are live and data sources are active.",
    page: "/signals",
    category: "E",
    points: 10,
  },
  {
    key: "added_watchlist_item",
    label: "Update Your Watchlist",
    description: "Add or review tickers relevant to your current positions.",
    page: "/watchlist",
    category: "F",
    points: 10,
  },
  {
    key: "opened_daily_briefing",
    label: "Read the Daily Market Briefing",
    description: "Review the AI-generated daily macro intelligence summary.",
    page: "/daily-report",
    category: "C",
    points: 0,
  },
  {
    key: "opened_ai_market_explanation",
    label: "Read the AI Market Explanation",
    description: "Review the AI Diagnostic explanation of current conditions.",
    page: "/diagnostic",
    category: "B",
    points: 0,
  },
  {
    key: "opened_historical_comparison",
    label: "Review Historical Comparisons",
    description: "Check which historical periods match the current market structure.",
    page: "/historical-analogs",
    category: "D",
    points: 0,
  },
  {
    key: "completed_daily_market_preflight",
    label: "Complete the Daily Preflight",
    description: "Confirm you have reviewed all critical market context for today.",
    page: null,
    category: "G",
    points: 5,
  },
] as const;

const CATEGORY_LABELS: Record<string, { label: string; color: string }> = {
  A: { label: "Dashboard & Score Review",      color: "#00D4FF" },
  B: { label: "Market Context",                color: "#C084FC" },
  C: { label: "Signal & Alert Review",         color: "#00FF88" },
  D: { label: "Risk Scenario Review",          color: "#FF9500" },
  E: { label: "Data Trust Awareness",          color: "#FFD700" },
  F: { label: "Portfolio & Watchlist Context", color: "#FF2D55" },
  G: { label: "Daily Preflight Completion",    color: "#00D4FF" },
};

// ── Possible Future Outcomes (4 market scenarios using live engine data) ─────
interface MarketScenario {
  id: string;
  label: string;
  confidence: string;
  color: string;
  description: string;
  supporting: string[];
  confirmation: string[];
  invalidating: string[];
  watchNext: string[];
}

function buildMarketScenarios(output: EngineOutput): MarketScenario[] {
  const { probability, overall, domains } = output;
  const score = overall.score;

  const bullConf = probability.bullProbability > 50 ? "Elevated" : probability.bullProbability > 30 ? "Moderate" : "Low";
  const bearConf = probability.crashProbability > 40 ? "Elevated" : probability.crashProbability > 20 ? "Moderate" : "Low";
  const systemicConf = score >= 7.0 ? "Elevated" : "Low";

  const confColor = (c: string) => {
    if (c === "Elevated") return "#FF9500";
    if (c === "Moderate") return "#FFD700";
    if (c === "High") return "#FF2D55";
    return "#00FF88";
  };

  const topDomains = [...domains].sort((a, b) => b.score - a.score).slice(0, 2).map(d => d.label);

  return [
    {
      id: "bullish",
      label: "Bullish Continuation",
      confidence: bullConf,
      color: confColor(bullConf),
      description: "Risk conditions stabilize or improve. Pressure readings decline. Market breadth expands.",
      supporting: [
        "FAULTLINE Pressure Index declining from current levels",
        "Credit spreads compressing and liquidity conditions easing",
        "Fed policy signaling accommodation or pause",
      ],
      confirmation: [
        "Sustained decline in overall Pressure score over 2–4 weeks",
        "Breadth and momentum signals broadening across sectors",
        "Treasury yield curve steepening from current levels",
      ],
      invalidating: [
        "Credit spread widening or VIX spike above 30",
        "Deterioration in any critical domain score",
        "Fed policy tightening beyond current expectations",
      ],
      watchNext: [
        "FAULTLINE Pressure trend over the next 2–4 weeks",
        "Credit market conditions and high-yield spreads",
        "Fed communication and inflation data releases",
      ],
    },
    {
      id: "neutral",
      label: "Neutral / Sideways",
      confidence: "Moderate",
      color: "#FFD700",
      description: "Conditions remain range-bound. No clear directional catalyst. Risk stays elevated but contained.",
      supporting: [
        "Current regime remains stable without escalation",
        "No new macro shocks or policy surprises",
        "Mixed signals across domains with no dominant driver",
      ],
      confirmation: [
        "FAULTLINE score oscillating within a narrow band",
        "Volatility remaining elevated but not spiking",
        "Macro data releases in line with consensus expectations",
      ],
      invalidating: [
        "A sharp move in any single domain score above 8.0",
        "Unexpected Fed action or geopolitical escalation",
        "Significant deterioration in credit or liquidity conditions",
      ],
      watchNext: [
        "Macro data releases for any upside or downside surprise",
        "Earnings season results relative to expectations",
        "Geopolitical developments affecting risk appetite",
      ],
    },
    {
      id: "bearish",
      label: "Bearish / Risk-Off",
      confidence: bearConf,
      color: confColor(bearConf),
      description: "Risk conditions deteriorate. Pressure readings rise. Defensive positioning becomes more relevant.",
      supporting: [
        `Current regime with Pressure Index at ${score.toFixed(1)} / 10`,
        topDomains.length > 0 ? `Elevated readings in: ${topDomains.join(", ")}` : "One or more domains at elevated or high risk levels",
        `Recession probability at ${probability.recessionProbability.toFixed(0)}% — above baseline`,
      ],
      confirmation: [
        "FAULTLINE Pressure Index rising above current level",
        "Credit spreads widening and high-yield stress increasing",
        "Breadth deteriorating and defensive sectors outperforming",
      ],
      invalidating: [
        "Sustained decline in the Pressure Index over multiple weeks",
        "Fed pivot or significant liquidity injection",
        "Credit conditions improving and spreads compressing",
      ],
      watchNext: [
        "Credit spread trajectory and high-yield stress indicators",
        "Labor market data for signs of deterioration",
        "FAULTLINE domain scores for further escalation",
      ],
    },
    {
      id: "systemic",
      label: "Systemic Stress",
      confidence: systemicConf,
      color: confColor(systemicConf),
      description: "Multiple fault lines escalate simultaneously. Systemic risk becomes the primary concern.",
      supporting: [
        score >= 7.0 ? "Current score already in late-cycle fragility range" : "Escalation of multiple domain scores simultaneously",
        "Liquidity stress and credit contagion risk both elevated",
        "Historical analog patterns matching prior stress episodes",
      ],
      confirmation: [
        "FAULTLINE score rising above 8.5 (critical systemic threshold)",
        "Multiple domains simultaneously at critical or high levels",
        "Liquidity conditions deteriorating rapidly",
      ],
      invalidating: [
        "Coordinated central bank intervention and liquidity support",
        "Rapid compression of credit spreads and VIX normalization",
        "FAULTLINE score declining below 6.0 on sustained basis",
      ],
      watchNext: [
        "Banking sector stress indicators and interbank rates",
        "Federal Reserve emergency communication or action",
        "FAULTLINE critical threshold (8.5) proximity",
      ],
    },
  ];
}

// ── Score Ring ───────────────────────────────────────────────
function ScoreRing({ score, color, size = 120 }: { score: number; color: string; size?: number }) {
  const [anim, setAnim] = useState(0);
  useEffect(() => {
    const t = setTimeout(() => setAnim(score), 200);
    return () => clearTimeout(t);
  }, [score]);

  const r = (size / 2) - 10;
  const circ = 2 * Math.PI * r;
  const dash = (anim / 100) * circ;

  return (
    <div style={{ position: "relative", width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
        {/* Track */}
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={8} />
        {/* Progress */}
        <circle
          cx={size / 2} cy={size / 2} r={r}
          fill="none"
          stroke={color}
          strokeWidth={8}
          strokeLinecap="round"
          strokeDasharray={`${dash} ${circ}`}
          style={{ transition: "stroke-dasharray 1.4s cubic-bezier(0.23,1,0.32,1)", filter: `drop-shadow(0 0 6px ${color}80)` }}
        />
      </svg>
      <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
        <span style={{ fontFamily: "'Rajdhani', sans-serif", fontWeight: 700, fontSize: size > 100 ? "28px" : "22px", color, lineHeight: 1 }}>{score}</span>
        <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "10px", color: "rgba(100,116,139,0.8)", letterSpacing: "0.1em", marginTop: "2px" }}>/ 100</span>
      </div>
    </div>
  );
}

// ── Mini Score Badge (for page buttons) ──────────────────────
export function AwarenessScoreBadge({ score, color, label }: { score: number; color: string; label: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "8px", padding: "6px 12px", background: `${color}10`, border: `1px solid ${color}30`, borderRadius: "4px" }}>
      <ScoreRing score={score} color={color} size={36} />
      <div>
        <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "11px", color, letterSpacing: "0.12em", textTransform: "uppercase" }}>Market Awareness</div>
        <div style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: "11px", color: "rgba(148,163,184,0.8)" }}>{label}</div>
      </div>
    </div>
  );
}

// ── Dashboard Card ───────────────────────────────────────────
export function AwarenessDashboardCard({ onOpen }: { onOpen: () => void }) {
  const { user } = useAuth();
  const { data: scoreData, isLoading } = trpc.awareness.getScore.useQuery(undefined, {
    enabled: !!user,
    staleTime: 30_000,
  });
  const { data: modeData } = trpc.awareness.getPreflightMode.useQuery(undefined, {
    enabled: !!user,
    staleTime: 60_000,
  });
  const logAction = trpc.awareness.logAction.useMutation();
  const utils = trpc.useUtils();
  // Auto-log viewed_dashboard when the card mounts
  useEffect(() => {
    if (user) {
      logAction.mutate({ actionKey: "viewed_dashboard", sourcePage: "dashboard" }, {
        onSuccess: () => utils.awareness.getScore.invalidate(),
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);
  if (!user) return null;
  const mode = modeData?.mode ?? "full_guidance";
  // Off: hide the card entirely from the dashboard
  if (mode === "off") return null;

    const score = scoreData?.score ?? 0;
  const color = scoreData?.rating.color ?? "#00D4FF";
  const label = scoreData?.rating.label ?? "Loading...";
  const completed = scoreData?.completedKeys.length ?? 0;
  const total = 13; // number of checklist items with points > 0

  // Minimal Reminders: compact score + button only
  if (mode === "minimal_reminders") {
    return (
      <div
        style={{ display: "flex", alignItems: "center", gap: "10px", padding: "10px 14px", marginBottom: "10px", background: "rgba(255,255,255,0.02)", border: `1px solid ${color}25`, borderRadius: "6px", cursor: "pointer" }}
        onClick={onOpen}
        role="button"
        aria-label="Open Market Preflight"
      >
        <ScoreRing score={score} color={color} size={36} />
        <div style={{ flex: 1 }}>
          <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "11px", color, letterSpacing: "0.12em", textTransform: "uppercase" }}>
            Market Awareness: {score}/100
          </span>
        </div>
        <button
          onClick={(e) => { e.stopPropagation(); onOpen(); }}
          style={{ padding: "5px 12px", background: `${color}15`, border: `1px solid ${color}40`, borderRadius: "4px", fontFamily: "'IBM Plex Mono', monospace", fontSize: "10px", color, letterSpacing: "0.1em", textTransform: "uppercase", cursor: "pointer" }}
        >
          Run Preflight
        </button>
      </div>
    );
  }

  return (
    <div
      className="intel-module"
      style={{
        padding: "16px",
        marginBottom: "10px",
        borderLeft: `3px solid ${color}`,
        animation: "cinematic-reveal 0.7s cubic-bezier(0.23,1,0.32,1) 90ms both",
        cursor: "pointer",
      }}
      onClick={onOpen}
      role="button"
      aria-label="Open Market Preflight Checklist"
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <div style={{ width: "6px", height: "6px", borderRadius: "50%", background: color, boxShadow: `0 0 8px ${color}`, animation: score >= 80 ? "blink-alert 2s ease-in-out infinite" : undefined }} />
          <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "12px", color, textTransform: "uppercase", letterSpacing: "0.18em", fontWeight: 600 }}>Complete Market Awareness™</span>
        </div>
        <div style={{ padding: "2px 8px", background: `${color}15`, border: `1px solid ${color}35`, borderRadius: "3px" }}>
          <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "11px", color, letterSpacing: "0.12em" }}>
            {isLoading ? "LOADING" : scoreData?.rating.statusLabel ?? "REVIEW"}
          </span>
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
        {isLoading ? (
          <div style={{ width: 80, height: 80, borderRadius: "50%", background: "rgba(255,255,255,0.04)", animation: "pulse 2s ease-in-out infinite" }} />
        ) : (
          <ScoreRing score={score} color={color} size={80} />
        )}
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: "'Rajdhani', sans-serif", fontWeight: 700, fontSize: "16px", color: "#F0F4FF", marginBottom: "4px" }}>
            {isLoading ? "Calculating..." : label}
          </div>
          <div style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: "12px", color: "#94A3B8", marginBottom: "8px" }}>
            {isLoading ? "Loading your daily context score..." : `${completed} of ${total} context checkpoints completed today`}
          </div>
          {/* Progress bar */}
          <div style={{ height: "4px", background: "rgba(255,255,255,0.06)", borderRadius: "2px", overflow: "hidden" }}>
            <div style={{
              height: "100%",
              width: `${score}%`,
              background: `linear-gradient(90deg, ${color}70, ${color})`,
              boxShadow: `0 0 6px ${color}60`,
              borderRadius: "2px",
              transition: "width 1.4s cubic-bezier(0.23,1,0.32,1)",
            }} />
          </div>
          <div style={{ marginTop: "8px", fontFamily: "'IBM Plex Mono', monospace", fontSize: "11px", color: "rgba(100,116,139,0.7)", letterSpacing: "0.1em" }}>
            TAP TO RUN MARKET PREFLIGHT →
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main Preflight Modal ─────────────────────────────────────
export function MarketPreflightModal({
  open,
  onClose,
  currentPage,
  regimeLabel = "Unknown",
}: {
  open: boolean;
  onClose: () => void;
  currentPage?: string;
  regimeLabel?: string;
}) {
    const { user } = useAuth();
  const [, navigate] = useLocation();
  const [activeTab, setActiveTab] = useState<"checklist" | "interpretation" | "outcomes">("checklist");
  const [completingPreflight, setCompletingPreflight] = useState(false);
  const { output } = useEngine();
  const { data: scoreData, isLoading, refetch } = trpc.awareness.getScore.useQuery(undefined, {
    enabled: !!user && open,
    staleTime: 5_000,
  });

  const logAction = trpc.awareness.logAction.useMutation({
    onSuccess: () => refetch(),
  });

  const handleComplete = useCallback(async () => {
    setCompletingPreflight(true);
    await logAction.mutateAsync({
      actionKey: "completed_daily_market_preflight",
      sourcePage: currentPage ?? "preflight",
    });
    setCompletingPreflight(false);
  }, [logAction, currentPage]);

  const handleNavigate = useCallback((page: string, actionKey: string) => {
    logAction.mutate({ actionKey, sourcePage: currentPage ?? "preflight" });
    onClose();
    navigate(page);
  }, [logAction, currentPage, onClose, navigate]);

  if (!open) return null;

  const score = scoreData?.score ?? 0;
  const color = scoreData?.rating.color ?? "#00D4FF";
  const completedKeys = new Set(scoreData?.completedKeys ?? []);
  const outcomes = useMemo(() => buildMarketScenarios(output), [output]);

  return (
    <div
      style={{ position: "fixed", inset: 0, zIndex: 1000, display: "flex", alignItems: "flex-end", justifyContent: "center", background: "rgba(5,6,8,0.85)", backdropFilter: "blur(8px)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "600px",
          maxHeight: "90vh",
          background: "#0C0F16",
          border: `1px solid ${color}30`,
          borderTop: `2px solid ${color}`,
          borderRadius: "12px 12px 0 0",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          animation: "slide-up 0.3s cubic-bezier(0.23,1,0.32,1)",
        }}
      >
        {/* Header */}
        <div style={{ padding: "16px 20px 12px", borderBottom: "1px solid rgba(255,255,255,0.07)", flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <ScoreRing score={score} color={color} size={56} />
              <div>
                <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "11px", color, letterSpacing: "0.18em", textTransform: "uppercase", marginBottom: "2px" }}>Complete Market Awareness™</div>
                <div style={{ fontFamily: "'Rajdhani', sans-serif", fontWeight: 700, fontSize: "18px", color: "#F0F4FF" }}>
                  {isLoading ? "Calculating..." : scoreData?.rating.label ?? "Market Preflight"}
                </div>
                <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "11px", color: "rgba(100,116,139,0.7)", letterSpacing: "0.1em" }}>
                  {score}/100 · {completedKeys.size} of {CHECKLIST_ITEMS.length} items completed today
                </div>
              </div>
            </div>
            <button
              onClick={onClose}
              style={{ background: "none", border: "none", color: "rgba(100,116,139,0.7)", cursor: "pointer", fontSize: "20px", padding: "4px 8px", borderRadius: "4px" }}
              aria-label="Close"
            >
              ×
            </button>
          </div>

          {/* Tabs */}
          <div style={{ display: "flex", gap: "4px" }}>
            {(["checklist", "interpretation", "outcomes"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                style={{
                  flex: 1,
                  padding: "6px 8px",
                  background: activeTab === tab ? `${color}15` : "transparent",
                  border: `1px solid ${activeTab === tab ? color + "40" : "rgba(255,255,255,0.08)"}`,
                  borderRadius: "4px",
                  fontFamily: "'IBM Plex Mono', monospace",
                  fontSize: "10px",
                  color: activeTab === tab ? color : "rgba(100,116,139,0.7)",
                  letterSpacing: "0.1em",
                  textTransform: "uppercase",
                  cursor: "pointer",
                  transition: "all 0.15s ease-out",
                }}
              >
                {tab === "checklist" ? "Checklist" : tab === "interpretation" ? "Reading" : "Outcomes"}
              </button>
            ))}
          </div>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: "auto", padding: "16px 20px" }}>

          {/* ── CHECKLIST TAB ─────────────────────────────── */}
          {activeTab === "checklist" && (
            <div>
              {Object.entries(CATEGORY_LABELS).map(([cat, catInfo]) => {
                const items = CHECKLIST_ITEMS.filter((i) => i.category === cat);
                if (items.length === 0) return null;
                const catData = scoreData?.categoryBreakdown[cat];
                return (
                  <div key={cat} style={{ marginBottom: "16px" }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "8px" }}>
                      <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "10px", color: catInfo.color, letterSpacing: "0.15em", textTransform: "uppercase" }}>
                        {catInfo.label}
                      </span>
                      {catData && (
                        <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "10px", color: "rgba(100,116,139,0.6)" }}>
                          {catData.earned}/{catData.max} pts
                        </span>
                      )}
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                      {items.map((item) => {
                        const done = completedKeys.has(item.key);
                        return (
                          <div
                            key={item.key}
                            title={item.description}
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: "10px",
                              padding: "10px 12px",
                              background: done ? `${catInfo.color}08` : "rgba(255,255,255,0.02)",
                              border: `1px solid ${done ? catInfo.color + "30" : "rgba(255,255,255,0.06)"}`,
                              borderRadius: "4px",
                              cursor: item.page ? "pointer" : "default",
                              transition: "all 0.15s ease-out",
                            }}
                            onClick={() => {
                              if (item.key === "completed_daily_market_preflight") {
                                handleComplete();
                              } else if (item.page) {
                                handleNavigate(item.page, item.key);
                              }
                            }}
                          >
                            {/* Checkbox */}
                            <div style={{
                              width: "18px", height: "18px", borderRadius: "3px", flexShrink: 0,
                              background: done ? catInfo.color : "transparent",
                              border: `1.5px solid ${done ? catInfo.color : "rgba(100,116,139,0.4)"}`,
                              display: "flex", alignItems: "center", justifyContent: "center",
                              boxShadow: done ? `0 0 6px ${catInfo.color}60` : undefined,
                              transition: "all 0.2s ease-out",
                            }}>
                              {done && <span style={{ color: "#050608", fontSize: "11px", fontWeight: 700 }}>✓</span>}
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: "13px", color: done ? "#F0F4FF" : "#94A3B8", fontWeight: done ? 500 : 400 }}>
                                {item.label}
                              </div>
                              <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "10px", color: "rgba(100,116,139,0.55)", marginTop: "2px" }}>
                                {item.description}
                              </div>
                            </div>
                            {item.points > 0 && (
                              <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "10px", color: done ? catInfo.color : "rgba(100,116,139,0.4)", letterSpacing: "0.08em", flexShrink: 0 }}>
                                +{item.points}
                              </div>
                            )}
                            {item.page && !done && (
                              <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "10px", color: "rgba(100,116,139,0.4)", flexShrink: 0 }}>→</div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* ── CURRENT READING INTERPRETATION TAB ────────── */}
          {activeTab === "interpretation" && (
            <div>
              <div style={{ marginBottom: "16px", padding: "14px", background: `${color}08`, border: `1px solid ${color}25`, borderRadius: "6px" }}>
                <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "11px", color, letterSpacing: "0.15em", textTransform: "uppercase", marginBottom: "6px" }}>
                  Current Reading
                </div>
                <div style={{ fontFamily: "'Rajdhani', sans-serif", fontWeight: 700, fontSize: "20px", color: "#F0F4FF", marginBottom: "4px" }}>
                  {scoreData?.rating.label ?? "Calculating..."}
                </div>
                <div style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: "12px", color: "#94A3B8", lineHeight: 1.65 }}>
                  {score >= 90
                    ? "You have reviewed all critical market context for today. Your decision-making is supported by full awareness of current regime conditions, active risk signals, and scenario context."
                    : score >= 75
                    ? "You have reviewed the most important market context areas. A few remaining checkpoints would complete your situational awareness for today."
                    : score >= 60
                    ? "You have covered the foundational context but several important areas remain unreviewed. Completing the checklist will improve your ability to respond to market changes."
                    : score >= 40
                    ? "You have partial market context. Key areas such as alerts, signal context, or scenario review have not been completed today. This increases the risk of reactive decisions."
                    : "You have limited market context for today. It is recommended to complete the preflight checklist before making any position decisions in the current regime."}
                </div>
              </div>

              {/* Category breakdown */}
              <div style={{ marginBottom: "16px" }}>
                <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "11px", color: "rgba(100,116,139,0.7)", letterSpacing: "0.15em", textTransform: "uppercase", marginBottom: "10px" }}>
                  Awareness Breakdown
                </div>
                {Object.entries(CATEGORY_LABELS).map(([cat, catInfo]) => {
                  const catData = scoreData?.categoryBreakdown[cat];
                  if (!catData) return null;
                  const pct = catData.max > 0 ? (catData.earned / catData.max) * 100 : 0;
                  return (
                    <div key={cat} style={{ marginBottom: "10px" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
                        <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "11px", color: catInfo.color, letterSpacing: "0.08em" }}>{catInfo.label}</span>
                        <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "11px", color: "rgba(100,116,139,0.6)" }}>{catData.earned}/{catData.max}</span>
                      </div>
                      <div style={{ height: "4px", background: "rgba(255,255,255,0.06)", borderRadius: "2px", overflow: "hidden" }}>
                        <div style={{
                          height: "100%",
                          width: `${pct}%`,
                          background: `linear-gradient(90deg, ${catInfo.color}70, ${catInfo.color})`,
                          boxShadow: `0 0 4px ${catInfo.color}60`,
                          borderRadius: "2px",
                          transition: "width 1.2s cubic-bezier(0.23,1,0.32,1)",
                        }} />
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Regime context */}
              <div style={{ padding: "12px", background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: "6px" }}>
                <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "10px", color: "rgba(100,116,139,0.6)", letterSpacing: "0.15em", textTransform: "uppercase", marginBottom: "6px" }}>
                  Current Market Regime
                </div>
                <div style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: "13px", color: "#F0F4FF" }}>{regimeLabel || "Unknown"}</div>
                <div style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: "12px", color: "#64748B", marginTop: "4px" }}>
                  Awareness score is reset daily at midnight UTC. Complete the checklist each trading day for consistent situational awareness.
                </div>
              </div>
            </div>
          )}

          {/* ── POSSIBLE FUTURE OUTCOMES TAB ──────────────── */}
          {activeTab === "outcomes" && (
            <div>
              <div style={{ marginBottom: "14px", fontFamily: "'IBM Plex Sans', sans-serif", fontSize: "12px", color: "#94A3B8", lineHeight: 1.65 }}>
                Based on your current awareness score of <strong style={{ color }}>{score}/100</strong> and the <strong style={{ color: "#F0F4FF" }}>{regimeLabel}</strong> regime, here are the likely decision-making outcomes:
              </div>
              {outcomes.map((outcome: MarketScenario, i: number) => (
                <div
                  key={i}
                  style={{
                    padding: "14px",
                    background: `${outcome.color}08`,
                    border: `1px solid ${outcome.color}25`,
                    borderLeft: `3px solid ${outcome.color}`,
                    borderRadius: "4px",
                    marginBottom: "12px",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "6px" }}>
                    <span style={{ fontFamily: "'Rajdhani', sans-serif", fontWeight: 700, fontSize: "14px", color: "#F0F4FF" }}>{outcome.label}</span>
                    <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "10px", color: outcome.color, padding: "2px 6px", background: `${outcome.color}15`, border: `1px solid ${outcome.color}30`, borderRadius: "3px" }}>
                      {outcome.confidence}
                    </span>
                  </div>
                  <div style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: "12px", color: "#94A3B8", lineHeight: 1.6, marginBottom: "10px" }}>
                    {outcome.description}
                  </div>
                  {/* Supporting evidence */}
                  <div style={{ marginBottom: "8px" }}>
                    <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "10px", color: outcome.color, letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: "4px" }}>Supporting</div>
                    {outcome.supporting.map((s, si) => (
                      <div key={si} style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: "11px", color: "rgba(148,163,184,0.8)", paddingLeft: "8px", borderLeft: `1px solid ${outcome.color}30`, marginBottom: "2px" }}>{s}</div>
                    ))}
                  </div>
                  {/* Confirmation signals */}
                  <div style={{ marginBottom: "8px" }}>
                    <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "10px", color: "rgba(100,116,139,0.7)", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: "4px" }}>Confirmation Signals</div>
                    {outcome.confirmation.map((s, si) => (
                      <div key={si} style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: "11px", color: "rgba(148,163,184,0.7)", paddingLeft: "8px", borderLeft: "1px solid rgba(255,255,255,0.08)", marginBottom: "2px" }}>{s}</div>
                    ))}
                  </div>
                  {/* Invalidating conditions */}
                  <div style={{ marginBottom: "8px" }}>
                    <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "10px", color: "rgba(100,116,139,0.7)", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: "4px" }}>Invalidating Conditions</div>
                    {outcome.invalidating.map((s, si) => (
                      <div key={si} style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: "11px", color: "rgba(148,163,184,0.7)", paddingLeft: "8px", borderLeft: "1px solid rgba(255,255,255,0.08)", marginBottom: "2px" }}>{s}</div>
                    ))}
                  </div>
                  {/* Watch next */}
                  <div>
                    <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "10px", color: "rgba(100,116,139,0.7)", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: "4px" }}>Watch Next</div>
                    {outcome.watchNext.map((s, si) => (
                      <div key={si} style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: "11px", color: "rgba(148,163,184,0.7)", paddingLeft: "8px", borderLeft: "1px solid rgba(255,255,255,0.08)", marginBottom: "2px" }}>{s}</div>
                    ))}
                  </div>
                </div>
              ))}

              {score < 80 && (
                <button
                  onClick={() => setActiveTab("checklist")}
                  style={{
                    width: "100%",
                    padding: "12px",
                    background: `${color}15`,
                    border: `1px solid ${color}40`,
                    borderRadius: "6px",
                    fontFamily: "'IBM Plex Mono', monospace",
                    fontSize: "12px",
                    color,
                    letterSpacing: "0.12em",
                    textTransform: "uppercase",
                    cursor: "pointer",
                    marginTop: "6px",
                    transition: "all 0.15s ease-out",
                  }}
                >
                  Complete Preflight Checklist →
                </button>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: "12px 20px", borderTop: "1px solid rgba(255,255,255,0.07)", flexShrink: 0, display: "flex", gap: "8px" }}>
          {!completedKeys.has("completed_daily_market_preflight") && (
            <button
              onClick={handleComplete}
              disabled={completingPreflight}
              style={{
                flex: 1,
                padding: "10px",
                background: score >= 60 ? `${color}20` : "rgba(255,255,255,0.04)",
                border: `1px solid ${score >= 60 ? color + "50" : "rgba(255,255,255,0.1)"}`,
                borderRadius: "6px",
                fontFamily: "'IBM Plex Mono', monospace",
                fontSize: "12px",
                color: score >= 60 ? color : "rgba(100,116,139,0.6)",
                letterSpacing: "0.12em",
                textTransform: "uppercase",
                cursor: score >= 60 ? "pointer" : "not-allowed",
                transition: "all 0.15s ease-out",
              }}
            >
              {completingPreflight ? "Confirming..." : score >= 60 ? "✓ Confirm Preflight Complete" : "Complete Checklist First"}
            </button>
          )}
          {completedKeys.has("completed_daily_market_preflight") && (
            <div style={{ flex: 1, padding: "10px", background: "rgba(0,255,136,0.08)", border: "1px solid rgba(0,255,136,0.25)", borderRadius: "6px", textAlign: "center" }}>
              <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "12px", color: "#00FF88", letterSpacing: "0.12em" }}>✓ DAILY PREFLIGHT CONFIRMED</span>
            </div>
          )}
          <button
            onClick={onClose}
            style={{
              padding: "10px 16px",
              background: "transparent",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: "6px",
              fontFamily: "'IBM Plex Mono', monospace",
              fontSize: "12px",
              color: "rgba(100,116,139,0.7)",
              letterSpacing: "0.1em",
              cursor: "pointer",
            }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Preflight Trigger Button (for individual pages) ──────────
export function PreflightTrigger({
  currentPage,
  regimeLabel,
  actionKey,
}: {
  currentPage: string;
  regimeLabel?: string;
  actionKey?: string;
}) {
    const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const { data: scoreData } = trpc.awareness.getScore.useQuery(undefined, {
    enabled: !!user,
    staleTime: 30_000,
  });
  const { data: modeData } = trpc.awareness.getPreflightMode.useQuery(undefined, {
    enabled: !!user,
    staleTime: 60_000,
  });
  const logAction = trpc.awareness.logAction.useMutation();
  const utils = trpc.useUtils();
  const handleOpen = useCallback(() => {
    if (actionKey && user) {
      logAction.mutate({ actionKey, sourcePage: currentPage }, {
        onSuccess: () => utils.awareness.getScore.invalidate(),
      });
    }
    setOpen(true);
  }, [actionKey, user, logAction, currentPage, utils]);
  if (!user) return null;
  // Off: hide page-level triggers entirely
  if (modeData?.mode === "off") return null;

  const score = scoreData?.score ?? 0;
  const color = scoreData?.rating.color ?? "#00D4FF";

  return (
    <>
      <button
        onClick={handleOpen}
        title={`Market Awareness: ${score}/100 — ${scoreData?.rating.label ?? "Run preflight"}`}
        style={{
          display: "flex",
          alignItems: "center",
          gap: "6px",
          padding: "5px 10px",
          background: `${color}10`,
          border: `1px solid ${color}30`,
          borderRadius: "4px",
          cursor: "pointer",
          transition: "all 0.15s ease-out",
        }}
      >
        <div style={{ position: "relative", width: "20px", height: "20px" }}>
          <svg width="20" height="20" style={{ transform: "rotate(-90deg)" }}>
            <circle cx="10" cy="10" r="7" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="3" />
            <circle
              cx="10" cy="10" r="7"
              fill="none"
              stroke={color}
              strokeWidth="3"
              strokeLinecap="round"
              strokeDasharray={`${(score / 100) * 44} 44`}
              style={{ transition: "stroke-dasharray 1s ease-out", filter: `drop-shadow(0 0 3px ${color}80)` }}
            />
          </svg>
          <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "7px", color, fontWeight: 700 }}>{score}</span>
          </div>
        </div>
        <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "10px", color, letterSpacing: "0.1em", textTransform: "uppercase" }}>
          Preflight
        </span>
      </button>

      <MarketPreflightModal
        open={open}
        onClose={() => setOpen(false)}
        currentPage={currentPage}
        regimeLabel={regimeLabel}
      />
    </>
  );
}
