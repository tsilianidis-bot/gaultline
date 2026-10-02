/* ============================================================
   MarketContextStrip — Unified Market Intelligence System
   A slim persistent banner that injects today's market context
   into every page. Answers: "What is the market doing right now?"
   Pulls exclusively from EngineContext — zero additional API calls.
   ============================================================ */
import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { ChevronDown, ChevronUp, Activity, TrendingUp, TrendingDown, Minus, ArrowRight } from "lucide-react";
import { useEngine } from "@/contexts/EngineContext";
import { canonicalScenarioLeader, formatScenarioPercent } from "@shared/canonicalReadout";
import { getRiskColor } from "@/components/RiskBadge";
import { trpc } from "@/lib/trpc";
import { formatCanonicalScore } from "@shared/marketMetrics";
import { PROBABILITY_DISPLAY_TEXT, probabilityText } from "@shared/probabilityContract";
import { humanizeQualityStatus } from "@shared/customerIntegrityLabels";
import { ForecastHorizonDisclosure } from "./ForecastHorizonDisclosure";
import { insufficientHorizonMetadata } from "@shared/forecastMetadata";

// Pages that should NOT show the strip (landing, auth, public pages)
const EXCLUDED_PATHS = [
  "/app/dashboard", // Dashboard already has its own full context
  "/app/command-center", // Command center already has regime pills
];

function getVerdictLabel(riskLevel: string): string {
  const map: Record<string, string> = {
    low: "BULLISH",
    moderate: "SELECTIVE",
    elevated: "CAUTIOUS",
    high: "DEFENSIVE",
    critical: "CRISIS MODE",
  };
  return map[riskLevel] ?? "NEUTRAL";
}

function ProbBar({ value, color, label }: { value: number; color: string; label: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "2px", minWidth: "52px" }}>
      <div style={{ fontSize: "7px", fontFamily: "'IBM Plex Mono', monospace", letterSpacing: "0.12em", color: "rgba(148,163,184,0.5)", textTransform: "uppercase" }}>{label}</div>
      <div style={{ width: "100%", height: "3px", background: "rgba(255,255,255,0.11)", borderRadius: "2px", overflow: "hidden" }}>
        <div style={{ width: `${value}%`, height: "100%", background: color, borderRadius: "2px", transition: "width 0.6s ease" }} />
      </div>
      <div style={{ fontSize: "9px", fontFamily: "'IBM Plex Mono', monospace", color, fontWeight: 600 }}>{value}%</div>
    </div>
  );
}

export default function MarketContextStrip() {
  const [location] = useLocation();
  const { output, isLoading, integrityLabel, marketState } = useEngine();
  const { data: canonicalState } = trpc.marketState.canonicalCurrent.useQuery(undefined, {
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });
  const [collapsed, setCollapsed] = useState(() => {
    try { return localStorage.getItem("faultline_ctx_strip_collapsed") === "true"; } catch { return false; }
  });
  const [, navigate] = useLocation();

  // Persist collapse preference
  useEffect(() => {
    try { localStorage.setItem("faultline_ctx_strip_collapsed", String(collapsed)); } catch { /* ignore */ }
  }, [collapsed]);

  // Don't show on excluded pages
  if (EXCLUDED_PATHS.some(p => location === p || location.startsWith(p + "/"))) return null;
  if (isLoading) return null;
  if (!canonicalState) return null;

  const { overall, regime, narrative } = output;
  const canonicalPressure = canonicalState?.pressureIndex;
  const canonicalRegime = canonicalState?.regime;
  const verdictLabel = getVerdictLabel(overall.riskLevel);
  const regimeColor = regime.color;
  const pressureScore = formatCanonicalScore(canonicalPressure ?? overall.score * 10);
  const pressureColor = getRiskColor(overall.riskLevel);

  // Largest scenario from the ONE canonical set (governed snapshot scenarioOutputs,
  // merged by EngineContext) for context only; it is not a probability forecast.
  // Ties name every leader; a withheld set shows "—".
  const SCENARIO_STYLE = {
    bull: { label: "BULL", color: "#10B981" },
    neutral: { label: "NEUTRAL", color: "#00E5FF" },
    bear: { label: "BEAR", color: "#EF4444" },
  } as const;
  const probabilityContract = marketState?.outlook.probabilityContract ?? null;
  const probs = (["bull", "neutral", "bear"] as const)
    .map(key => ({ ...SCENARIO_STYLE[key], value: marketState?.outlook.probabilities[key] ?? Number.NaN }))
    .filter(item => Number.isFinite(item.value));
  const leader = canonicalScenarioLeader(marketState?.outlook.probabilities);
  const dominant = leader
    ? {
        label: leader.keys.map(key => SCENARIO_STYLE[key].label).join(" · "),
        text: formatScenarioPercent(leader.value),
        color: leader.keys.length === 1 ? SCENARIO_STYLE[leader.keys[0]].color : "#94A3B8",
      }
    : {
        // Probability contract: a withheld set shows its state ("Uncalibrated", …), never "—" or a number.
        label: "BULL · NEUTRAL · BEAR",
        text: probabilityContract?.scenarioSet.display.text ?? PROBABILITY_DISPLAY_TEXT.UNAVAILABLE,
        color: "#6B7280",
      };
  const transitionToCrisisText = probabilityText(
    probabilityContract?.transitions.find(claim => claim.scenario.scenarioId === "transitionToCrisis") ?? null,
  );
  // Analog: only the canonical (verified) top analog, the same one NOW/Brief show.
  const verifiedAnalog = marketState?.outlook.topAnalog ?? null;
  const scenarioHorizon = insufficientHorizonMetadata("market-context-derived-scenario", new Date().toISOString(), "Not yet established");

  // One-line synthesis from narrative
  const synthesis = narrative.summary
    ? narrative.summary.split(".")[0].trim() + "."
    : `${regime.label} — ${narrative.regimeAssessment?.split(".")[0] ?? ""}`;

  return (
    <div
      style={{
        background: `linear-gradient(90deg, rgba(10,12,16,0.98) 0%, ${regimeColor}08 50%, rgba(10,12,16,0.98) 100%)`,
        borderBottom: `1px solid ${regimeColor}25`,
        position: "sticky",
        top: 0,
        zIndex: 40,
        transition: "all 0.2s ease",
      }}
    >
      {/* ── Collapsed state: single-line pill bar ── */}
      {collapsed ? (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            padding: "5px 16px",
            cursor: "pointer",
            flexWrap: "wrap",
          }}
          onClick={() => setCollapsed(false)}
        >
          {/* Regime pill */}
          <div style={{
            display: "flex", alignItems: "center", gap: "5px",
            padding: "2px 8px", borderRadius: "3px",
            background: `${regimeColor}15`, border: `1px solid ${regimeColor}30`,
          }}>
            <div style={{ width: "5px", height: "5px", borderRadius: "50%", background: regimeColor, boxShadow: `0 0 6px ${regimeColor}` }} />
            <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "9px", letterSpacing: "0.15em", color: regimeColor, fontWeight: 600 }}>{(canonicalRegime ?? regime.label).toUpperCase()}</span>
          </div>

          {/* Pressure score */}
          <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
            <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "8px", color: "rgba(100,116,139,0.7)", letterSpacing: "0.1em" }}>PRESSURE</span>
            <span style={{ fontFamily: "'Rajdhani', sans-serif", fontWeight: 700, fontSize: "13px", color: pressureColor }}>{pressureScore}</span>
          </div>

          {/* Verdict */}
          <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
            <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "8px", color: "rgba(100,116,139,0.7)", letterSpacing: "0.1em" }}>VERDICT</span>
            <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "9px", color: pressureColor, fontWeight: 600 }}>{verdictLabel}</span>
          </div>

          {/* Dominant derived scenario */}
          <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
            <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "8px", color: "rgba(100,116,139,0.7)", letterSpacing: "0.1em" }}>DERIVED SCENARIO</span>
            <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "9px", color: dominant.color, fontWeight: 600 }}>{dominant.label} {dominant.text}</span>
          </div>
          <ForecastHorizonDisclosure metadata={scenarioHorizon} compact />

          {/* Expand button */}
          <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: "4px", color: "rgba(100,116,139,0.5)" }}>
            <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "7px", letterSpacing: "0.1em" }}>MARKET CONTEXT</span>
            <ChevronDown size={10} />
          </div>
        </div>
      ) : (
        /* ── Expanded state: full context ── */
        <div style={{ padding: "8px 16px 10px" }}>
          {/* Row 1: Regime + Pressure + Verdict + Probabilities + Collapse */}
          <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap", marginBottom: "6px" }}>
            {/* Regime */}
            <button
              onClick={() => navigate("/app/pressure")}
              style={{
                display: "flex", alignItems: "center", gap: "6px",
                padding: "3px 10px", borderRadius: "3px",
                background: `${regimeColor}15`, border: `1px solid ${regimeColor}30`,
                cursor: "pointer", transition: "all 0.15s ease",
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = `${regimeColor}25`; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = `${regimeColor}15`; }}
            >
              <div style={{ width: "6px", height: "6px", borderRadius: "50%", background: regimeColor, boxShadow: `0 0 8px ${regimeColor}` }} />
              <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "9px", letterSpacing: "0.15em", color: regimeColor, fontWeight: 600 }}>{(canonicalRegime ?? regime.label).toUpperCase()}</span>
              <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "7px", color: "rgba(148,163,184,0.4)", letterSpacing: "0.08em" }}>{regime.sublabel}</span>
            </button>

            {/* Pressure Index */}
            <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
              <Activity size={10} color="rgba(100,116,139,0.5)" />
              <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "8px", color: "rgba(100,116,139,0.6)", letterSpacing: "0.1em" }}>PRESSURE INDEX</span>
              <span style={{ fontFamily: "'Rajdhani', sans-serif", fontWeight: 700, fontSize: "15px", color: pressureColor, textShadow: `0 0 10px ${pressureColor}60` }}>{pressureScore}</span>
            </div>

            {/* Verdict */}
            <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
              {overall.riskLevel === "low" ? <TrendingUp size={10} color="#10B981" /> : overall.riskLevel === "critical" || overall.riskLevel === "high" ? <TrendingDown size={10} color="#EF4444" /> : <Minus size={10} color="#F59E0B" />}
              <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "8px", color: "rgba(100,116,139,0.6)", letterSpacing: "0.1em" }}>VERDICT</span>
              <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "10px", color: pressureColor, fontWeight: 600, letterSpacing: "0.1em" }}>{verdictLabel}</span>
            </div>

            {/* Probability bars */}
            <div style={{ display: "flex", gap: "10px", alignItems: "flex-end", marginLeft: "4px" }}>
              {probs.length ? probs.map(p => (
                <ProbBar key={p.label} label={p.label} value={p.value} color={p.color} />
              )) : (
                <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "9px", color: "#6B7280", fontWeight: 600 }}>SCENARIOS {dominant.text}</span>
              )}
            </div>

            {/* Collapse button */}
            <button
              onClick={() => setCollapsed(true)}
              style={{
                marginLeft: "auto", display: "flex", alignItems: "center", gap: "3px",
                padding: "2px 6px", borderRadius: "3px",
                background: "transparent", border: "1px solid rgba(255,255,255,0.11)",
                cursor: "pointer", color: "rgba(100,116,139,0.5)",
                transition: "all 0.15s ease",
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.15)"; (e.currentTarget as HTMLElement).style.color = "rgba(148,163,184,0.8)"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.11)"; (e.currentTarget as HTMLElement).style.color = "rgba(100,116,139,0.5)"; }}
            >
              <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "7px", letterSpacing: "0.1em" }}>COLLAPSE</span>
              <ChevronUp size={9} />
            </button>
          </div>

          {/* Row 2: AI synthesis + key risks + next step */}
          <div style={{ display: "flex", alignItems: "flex-start", gap: "12px", flexWrap: "wrap" }}>
            {canonicalState && (
              <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "7px", color: "rgba(100,116,139,0.55)", letterSpacing: "0.08em" }}>
                {integrityLabel} · {humanizeQualityStatus(canonicalState.confidenceOrEvidenceQuality)}
              </span>
            )}
            {/* Synthesis */}
            <div style={{ flex: "1 1 300px", display: "flex", alignItems: "flex-start", gap: "6px" }}>
              <div style={{ width: "2px", height: "100%", minHeight: "28px", background: `${regimeColor}50`, borderRadius: "1px", flexShrink: 0, marginTop: "2px" }} />
              <div>
                <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "7px", letterSpacing: "0.15em", color: "rgba(100,116,139,0.5)", marginBottom: "2px" }}>MARKET INTELLIGENCE</div>
                <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "10px", color: "rgba(168,184,204,0.85)", lineHeight: 1.5 }}>{synthesis}</div>
              </div>
            </div>

            {/* Key risks */}
            {narrative.keyRisks && narrative.keyRisks.length > 0 && (
              <div style={{ flex: "1 1 200px" }}>
                <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "7px", letterSpacing: "0.15em", color: "rgba(100,116,139,0.5)", marginBottom: "3px" }}>WATCH</div>
                <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                  {narrative.keyRisks.slice(0, 2).map((risk, i) => (
                    <div key={i} style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                      <div style={{ width: "3px", height: "3px", borderRadius: "50%", background: "#F59E0B", flexShrink: 0 }} />
                      <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "9px", color: "rgba(148,163,184,0.6)" }}>{risk}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Seismograph: Active Analog + Transition Probability */}
            {(verifiedAnalog || marketState) && (
              <div style={{ flex: "0 0 auto", display: "flex", flexDirection: "column", gap: "2px" }}>
                <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "7px", letterSpacing: "0.15em", color: "rgba(100,116,139,0.5)", marginBottom: "1px" }}>SEISMOGRAPH</div>
                {verifiedAnalog && (
                  <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                    <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "8px", color: "rgba(100,116,139,0.5)" }}>ANALOG</span>
                    <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "9px", color: "#00E5FF", fontWeight: 600 }}>{verifiedAnalog.period}</span>
                    <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "8px", color: "rgba(100,116,139,0.5)" }}>{formatScenarioPercent(verifiedAnalog.similarity)}</span>
                  </div>
                )}
                {marketState && (
                  <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                    <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "8px", color: "rgba(100,116,139,0.5)" }}>TRANSITION TO CRISIS</span>
                    {/* Contract text only: the assembled seismograph value can be a static 5% default. */}
                    <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "9px", color: "#94A3B8", fontWeight: 600 }}>{transitionToCrisisText}</span>
                  </div>
                )}
              </div>
            )}
            {/* Continue the conversation CTA */}
            <button
              onClick={() => navigate("/app/discover")}
              style={{
                display: "flex", alignItems: "center", gap: "5px",
                padding: "4px 10px", borderRadius: "3px",
                background: `${regimeColor}10`, border: `1px solid ${regimeColor}25`,
                cursor: "pointer", flexShrink: 0,
                transition: "all 0.15s ease",
                fontFamily: "'IBM Plex Mono', monospace",
                fontSize: "8px", letterSpacing: "0.12em",
                color: regimeColor,
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = `${regimeColor}20`; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = `${regimeColor}10`; }}
            >
              ASK PLATO
              <ArrowRight size={9} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
