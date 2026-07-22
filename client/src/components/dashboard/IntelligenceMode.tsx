/**
 * INTELLIGENCE MODE — "What is the structure of this market?"
 * Deep structural analysis. Institutional-grade macro context.
 * Analytical · Deep · Structural · Institutional
 */
import { useMemo } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { useEngine } from "@/contexts/EngineContext";
import { getRiskColor } from "@/components/RiskBadge";
import { ArrowRight, Shield, Zap, TrendingDown } from "lucide-react";
import { FaultlineInterpretation } from "./FaultlineInterpretation";
import { useAuth } from "@/_core/hooks/useAuth";

// ── Macro Regime Panel ─────────────────────────────────────────────────────────
function MacroRegimePanel() {
  const [, navigate] = useLocation();
  const { output } = useEngine();
  const { regime, overall, domains, probability } = output;
  const color = regime.color;

  const topDomains = useMemo(
    () => [...domains].sort((a, b) => b.score - a.score).slice(0, 6),
    [domains]
  );

  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={{
        background: `linear-gradient(135deg, ${color}06 0%, rgba(7,9,16,0.95) 100%)`,
        border: `1px solid ${color}20`,
      }}
    >
      {/* Header */}
      <div className="px-4 pt-4 pb-3 flex items-center justify-between" style={{ borderBottom: "1px solid rgba(255,255,255,0.09)" }}>
        <div>
          <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 9, letterSpacing: "0.3em", color: "rgba(100,116,139,0.6)", marginBottom: 4 }}>
            MACRO REGIME
          </div>
          <div style={{ fontFamily: "'Rajdhani', sans-serif", fontWeight: 700, fontSize: 18, color }}>
            {regime.label}
          </div>
        </div>
        <div className="text-right">
          <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 28, fontWeight: 700, color, lineHeight: 1 }}>
            {overall.score.toFixed(1)}
          </div>
          <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 9, color: "rgba(100,116,139,0.5)" }}>
            / 10.0
          </div>
        </div>
      </div>

      {/* Domain grid */}
      <div className="p-3 grid grid-cols-2 gap-1.5">
        {topDomains.map((d) => {
          const dc = getRiskColor(d.riskLevel);
          const pct = Math.min(100, d.score * 10);
          return (
            <div
              key={d.id}
              className="rounded-xl p-2.5"
              style={{ background: "rgba(255,255,255,0.025)", border: `1px solid ${dc}15` }}
            >
              <div className="flex items-center justify-between mb-1.5">
                <span style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 10, color: "rgba(148,163,184,0.8)", lineHeight: 1.2 }}>
                  {d.label}
                </span>
                <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, color: dc, fontWeight: 700, flexShrink: 0, marginLeft: 4 }}>
                  {d.score.toFixed(1)}
                </span>
              </div>
              <div className="h-0.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.11)" }}>
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${pct}%`,
                    background: dc,
                    boxShadow: `0 0 4px ${dc}60`,
                    transition: "width 1.2s cubic-bezier(0.23,1,0.32,1)",
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* Probability row */}
      <div className="px-3 pb-3 grid grid-cols-2 gap-2">
        <div
          className="rounded-xl p-2.5 text-center"
          style={{ background: "rgba(0,255,136,0.06)", border: "1px solid rgba(0,255,136,0.15)" }}
        >
          <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 8, letterSpacing: "0.2em", color: "rgba(100,116,139,0.5)", marginBottom: 3 }}>
            BULL PROBABILITY
          </div>
          <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 18, fontWeight: 700, color: "#00FF88" }}>
            {probability.bullProbability}%
          </div>
        </div>
        <div
          className="rounded-xl p-2.5 text-center"
          style={{ background: "rgba(255,45,85,0.06)", border: "1px solid rgba(255,45,85,0.15)" }}
        >
          <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 8, letterSpacing: "0.2em", color: "rgba(100,116,139,0.5)", marginBottom: 3 }}>
            CRASH PROBABILITY
          </div>
          <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 18, fontWeight: 700, color: "#FF2D55" }}>
            {probability.crashProbability}%
          </div>
        </div>
      </div>

      <div className="px-3 pb-3">
        <button
          onClick={() => navigate("/app/pressure")}
          className="w-full rounded-xl py-2.5 flex items-center justify-center gap-2 transition-all duration-200 active:scale-[0.98]"
          style={{ background: `${color}10`, border: `1px solid ${color}25`, color }}
        >
          <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 9, letterSpacing: "0.2em" }}>
            FULL PRESSURE ENGINE
          </span>
          <ArrowRight size={11} />
        </button>
      </div>
    </div>
  );
}

// ── Aftershock Snapshot ────────────────────────────────────────────────────────
function AftershockSnapshot() {
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const { data, isLoading } = trpc.aftershock.getAnalysis.useQuery(undefined, {
    staleTime: 10 * 60 * 1000,
    enabled: !!user,
  });

  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={{ background: "rgba(7,9,16,0.8)", border: "1px solid rgba(255,255,255,0.12)" }}
    >
      <div className="px-4 pt-4 pb-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Zap size={12} style={{ color: "#F59E0B" }} />
          <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 9, letterSpacing: "0.3em", color: "rgba(100,116,139,0.6)" }}>
            AFTERSHOCK ENGINE
          </span>
        </div>
        <button
          onClick={() => navigate("/app/market-intelligence")}
          className="flex items-center gap-1"
          style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 9, color: "#00E5FF", letterSpacing: "0.1em" }}
        >
          MARKET INTEL <ArrowRight size={10} />
        </button>
      </div>

      {isLoading ? (
        <div className="px-4 pb-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-12 rounded-xl animate-pulse mb-2" style={{ background: "rgba(255,255,255,0.14)" }} />
          ))}
        </div>
      ) : data ? (
        <div className="px-3 pb-3 flex flex-col gap-1.5">
          {/* Overall risk */}
          <div
            className="flex items-center justify-between rounded-xl px-3 py-2.5"
            style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.11)" }}
          >
            <div>
              <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 8, letterSpacing: "0.2em", color: "rgba(100,116,139,0.5)", marginBottom: 3 }}>
                SYSTEMIC RISK
              </div>
              <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 20, fontWeight: 700, color: "#F59E0B" }}>
                {data.pressureIndex?.toFixed(1) ?? "—"}<span style={{ fontSize: 10, color: "rgba(100,116,139,0.4)" }}>/100</span>
              </div>
            </div>
            <div
              style={{
                fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, letterSpacing: "0.1em",
                color: "#F59E0B", background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.25)",
                borderRadius: 8, padding: "4px 10px",
              }}
            >
              {data.systemicRiskLevel?.toUpperCase() ?? "—"}
            </div>
          </div>

          {/* Top 3 active ruptures */}
          {data.activeRuptures?.slice(0, 3).map((r) => {
            const rColor = r.strength >= 70 ? "#FF2D55" : r.strength >= 40 ? "#F59E0B" : "#00E5FF";
            return (
              <div
                key={r.id}
                className="flex items-center justify-between rounded-xl px-3 py-2"
                style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.14)" }}
              >
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <div style={{ width: 5, height: 5, borderRadius: "50%", background: rColor, flexShrink: 0 }} />
                  <span style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 11, color: "#CBD5E1", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {r.triggerName}
                  </span>
                </div>
                <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, color: rColor, fontWeight: 600, flexShrink: 0, marginLeft: 8 }}>
                  {r.strength}/100
                </span>
              </div>
            );
          })}

          {(!data.activeRuptures || data.activeRuptures.length === 0) && (
            <div className="rounded-xl px-3 py-2 text-center" style={{ background: "rgba(0,255,136,0.04)", border: "1px solid rgba(0,255,136,0.12)" }}>
              <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, color: "rgba(0,255,136,0.7)" }}>NO ACTIVE RUPTURES DETECTED</span>
            </div>
          )}
        </div>
      ) : (
        <div className="px-4 pb-4 text-center">
          <p style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, color: "rgba(100,116,139,0.4)" }}>
            Analysis unavailable
          </p>
        </div>
      )}
    </div>
  );
}

// ── Track Record Snippet ───────────────────────────────────────────────────────
const CRISIS_SNIPPETS = [
  { period: "2008", label: "GFC", score: 82, regime: "CRITICAL", outcome: "S&P −57%", color: "#FF2D55" },
  { period: "2020", label: "COVID", score: 72, regime: "HIGH RISK", outcome: "S&P −34%", color: "#FF6B35" },
  { period: "2001", label: "Dot-com", score: 68, regime: "HIGH RISK", outcome: "S&P −49%", color: "#F59E0B" },
];

function TrackRecordSnippet() {
  const [, navigate] = useLocation();

  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={{ background: "rgba(7,9,16,0.8)", border: "1px solid rgba(255,255,255,0.12)" }}
    >
      <div className="px-4 pt-4 pb-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Shield size={12} style={{ color: "#00FF88" }} />
          <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 9, letterSpacing: "0.3em", color: "rgba(100,116,139,0.6)" }}>
            METHODOLOGY VALIDATED
          </span>
        </div>
        <button
          onClick={() => navigate("/app/portfolio")}
          className="flex items-center gap-1"
          style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 9, color: "#00FF88", letterSpacing: "0.1em" }}
        >
          MY PORTFOLIO <ArrowRight size={10} />
        </button>
      </div>

      <div className="px-3 pb-3 flex flex-col gap-1.5">
        {CRISIS_SNIPPETS.map((c) => (
          <div
            key={c.period}
            className="flex items-center rounded-xl px-3 py-2.5"
            style={{ background: `${c.color}06`, border: `1px solid ${c.color}20` }}
          >
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, color: c.color, fontWeight: 700 }}>
                  {c.period}
                </span>
                <span style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 11, color: "#CBD5E1" }}>
                  {c.label}
                </span>
              </div>
              <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 9, color: c.color, marginTop: 2 }}>
                {c.regime} — {c.score}/100
              </div>
            </div>
            <div className="flex items-center gap-1 flex-shrink-0">
              <TrendingDown size={10} style={{ color: c.color }} />
              <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, color: c.color, fontWeight: 600 }}>
                {c.outcome}
              </span>
            </div>
          </div>
        ))}

        <div
          className="rounded-xl px-3 py-2 text-center"
          style={{ background: "rgba(0,255,136,0.04)", border: "1px solid rgba(0,255,136,0.12)" }}
        >
          <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 9, color: "rgba(0,255,136,0.6)", letterSpacing: "0.15em" }}>
            25 YEARS · 300+ READINGS · SAME ENGINE
          </span>
        </div>
      </div>
    </div>
  );
}

// ── Structural Risk Summary ────────────────────────────────────────────────────
function StructuralRiskSummary() {
  const { output } = useEngine();
  const { narrative, analogs } = output;

  return (
    <div
      className="rounded-2xl p-4"
      style={{ background: "rgba(7,9,16,0.8)", border: "1px solid rgba(255,255,255,0.12)" }}
    >
      <div className="flex items-center justify-between mb-3">
        <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 9, letterSpacing: "0.3em", color: "rgba(100,116,139,0.6)" }}>
          STRUCTURAL RISK SUMMARY
        </span>
      </div>

      {/* Key risks */}
      <div className="flex flex-col gap-1.5 mb-3">
        {narrative.keyRisks.slice(0, 4).map((risk, i) => (
          <div
            key={i}
            className="flex items-start gap-2.5 rounded-xl px-3 py-2"
            style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.14)" }}
          >
            <div
              style={{
                width: 16, height: 16, borderRadius: "50%", flexShrink: 0, marginTop: 1,
                background: "rgba(255,45,85,0.15)", border: "1px solid rgba(255,45,85,0.3)",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontFamily: "'IBM Plex Mono', monospace", fontSize: 8, color: "#FF2D55", fontWeight: 700,
              }}
            >
              {i + 1}
            </div>
            <span style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 12, color: "rgba(203,213,225,0.85)", lineHeight: 1.5 }}>
              {risk}
            </span>
          </div>
        ))}
      </div>

      {/* Historical analogs */}
      {analogs.length > 0 && (
        <div>
          <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 8, letterSpacing: "0.25em", color: "rgba(100,116,139,0.5)", marginBottom: 8 }}>
            HISTORICAL ANALOGS
          </div>
          <div className="flex flex-col gap-1.5">
            {analogs.slice(0, 2).map((a) => (
              <div
                key={a.id}
                className="flex items-center justify-between rounded-xl px-3 py-2"
                style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.14)" }}
              >
                <div>
                  <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, color: "#00E5FF", fontWeight: 600 }}>
                    {a.era}
                  </span>
                  <span style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 10, color: "rgba(100,116,139,0.6)", marginLeft: 6 }}>
                    {a.year}
                  </span>
                </div>
                <div
                  className="rounded-lg px-2 py-0.5"
                  style={{ background: "rgba(0,229,255,0.14)", border: "1px solid rgba(0,229,255,0.32)" }}
                >
                  <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, color: "#00E5FF" }}>
                    {a.similarity}% match
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── INTELLIGENCE MODE ROOT ─────────────────────────────────────────────────────
export default function IntelligenceMode() {
  return (
    <div className="flex flex-col gap-4 pb-8">
      <MacroRegimePanel />
      <AftershockSnapshot />
      <StructuralRiskSummary />
      <FaultlineInterpretation />
      <TrackRecordSnippet />
    </div>
  );
}
