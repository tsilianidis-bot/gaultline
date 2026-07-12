/**
 * Seismograph Intelligence — FAULTLINE Market Operating System
 *
 * The default post-login command center. Presents the full executive
 * briefing in the correct narrative order:
 *
 *   1. Today's Market Story    — What is happening
 *   2. Pressure Index          — Overall systemic stress
 *   3. Current Regime          — Prevailing market environment
 *   4. Active Patterns         — What is developing beneath the surface
 *   5. Regime Transition Probs — Where the market is most likely heading
 *   6. Evolution Analysis      — How conditions have changed
 *   7. Historical Memory       — Historical context and comparable environments
 *
 * Design: Palantir Noir — void black, neon accents, institutional tone
 */

import { useState as useReactState, useMemo } from "react";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Activity, TrendingUp, TrendingDown, Minus, AlertTriangle, Info,
  Clock, BarChart3, Zap, Brain, History, ChevronRight, RefreshCw,
  BookOpen, Radio, Telescope, Crosshair, Shield, Search, Eye,
  ArrowRight, Gauge, Map,
} from "lucide-react";

// ─── Color helpers ────────────────────────────────────────────────────────────

function pressureColor(score: number): string {
  if (score >= 80) return "#ff4444";
  if (score >= 65) return "#ff8c00";
  if (score >= 50) return "#ffd700";
  if (score >= 35) return "#7ecf7e";
  return "#00ffc8";
}

function pressureBg(score: number): string {
  if (score >= 80) return "rgba(255,68,68,0.08)";
  if (score >= 65) return "rgba(255,140,0,0.08)";
  if (score >= 50) return "rgba(255,215,0,0.08)";
  if (score >= 35) return "rgba(126,207,126,0.08)";
  return "rgba(0,255,200,0.06)";
}

function pressureBorder(score: number): string {
  if (score >= 80) return "rgba(255,68,68,0.25)";
  if (score >= 65) return "rgba(255,140,0,0.25)";
  if (score >= 50) return "rgba(255,215,0,0.2)";
  if (score >= 35) return "rgba(126,207,126,0.2)";
  return "rgba(0,255,200,0.18)";
}

function directionIcon(direction: string) {
  if (direction === "rising" || direction === "Deteriorating" || direction === "Accelerating")
    return <TrendingUp className="w-4 h-4 text-red-400" />;
  if (direction === "falling" || direction === "Improving")
    return <TrendingDown className="w-4 h-4 text-emerald-400" />;
  return <Minus className="w-4 h-4 text-yellow-400" />;
}

function fmtDate(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "short", day: "numeric", year: "numeric",
    });
  } catch { return dateStr; }
}

// ─── Shared primitives ────────────────────────────────────────────────────────

function SectionHeader({
  icon, label, badge, tooltip,
}: {
  icon: React.ReactNode;
  label: string;
  badge?: React.ReactNode;
  tooltip?: string;
}) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: "8px",
      paddingBottom: "12px",
      borderBottom: "1px solid rgba(255,255,255,0.05)",
      marginBottom: "16px",
    }}>
      <span style={{ color: "#00D4FF", display: "flex" }}>{icon}</span>
      <span style={{
        fontFamily: "'IBM Plex Mono', monospace",
        fontSize: "10px", fontWeight: 700, letterSpacing: "0.14em",
        color: "rgba(148,163,184,0.7)", textTransform: "uppercase",
      }}>
        {label}
      </span>
      {badge}
      {tooltip && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Info className="w-3 h-3 text-gray-600 cursor-help ml-auto" />
          </TooltipTrigger>
          <TooltipContent className="max-w-xs text-xs">{tooltip}</TooltipContent>
        </Tooltip>
      )}
    </div>
  );
}

function SectionCard({ children, accent = "#00D4FF" }: { children: React.ReactNode; accent?: string }) {
  return (
    <div style={{
      background: "rgba(6,8,14,0.95)",
      border: `1px solid rgba(255,255,255,0.06)`,
      borderTop: `2px solid ${accent}30`,
      borderRadius: "8px",
      padding: "20px",
    }}>
      {children}
    </div>
  );
}

function ProbBar({ label, value, color, tooltip }: { label: string; value: number; color: string; tooltip?: string }) {
  const inner = (
    <div style={{ marginBottom: "8px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
        <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "10px", color: "rgba(148,163,184,0.6)", textTransform: "uppercase", letterSpacing: "0.1em" }}>
          {label}
        </span>
        <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "11px", fontWeight: 700, color }}>
          {value}%
        </span>
      </div>
      <div style={{ height: "4px", background: "rgba(255,255,255,0.05)", borderRadius: "2px", overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${value}%`, backgroundColor: color, borderRadius: "2px", transition: "width 0.8s ease" }} />
      </div>
    </div>
  );
  if (!tooltip) return inner;
  return (
    <Tooltip>
      <TooltipTrigger asChild><div>{inner}</div></TooltipTrigger>
      <TooltipContent className="max-w-xs text-xs">{tooltip}</TooltipContent>
    </Tooltip>
  );
}

function MiniSparkline({ readings }: { readings: Array<{ pressureScore: number }> }) {
  const scores = readings.slice(0, 30).reverse().map(r => r.pressureScore);
  if (scores.length < 2) return null;
  const min = Math.min(...scores);
  const max = Math.max(...scores);
  const range = max - min || 1;
  const w = 300; const h = 52;
  const pts = scores.map((s, i) => {
    const x = (i / (scores.length - 1)) * w;
    const y = h - ((s - min) / range) * (h - 6) - 3;
    return `${x},${y}`;
  }).join(" ");
  return (
    <svg width="100%" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none">
      <defs>
        <linearGradient id="sparkGrad" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#00ffc8" stopOpacity="0.4" />
          <stop offset="100%" stopColor="#00D4FF" stopOpacity="0.9" />
        </linearGradient>
      </defs>
      {[35, 50, 65, 80].map(t => {
        const y = h - ((t - min) / range) * (h - 6) - 3;
        if (y < 0 || y > h) return null;
        return <line key={t} x1={0} y1={y} x2={w} y2={y} stroke="rgba(255,255,255,0.05)" strokeWidth="0.5" strokeDasharray="3,3" />;
      })}
      <polyline points={pts} fill="none" stroke="url(#sparkGrad)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

// ─── Section 1: Today's Market Story ─────────────────────────────────────────

function StorySection({ assembled }: { assembled: ReturnType<typeof useAssembled>["data"] }) {
  const brief = assembled?.forDailyBrief;
  const narrative = brief?.narrativeContext ?? "";
  const keyDev = brief?.keyDevelopments ?? [];

  return (
    <SectionCard accent="#00D4FF">
      <SectionHeader
        icon={<BookOpen className="w-3.5 h-3.5" />}
        label="Today's Market Story"
        tooltip="The Seismograph synthesizes evidence from all contributing engines into a single market narrative. This is what is happening, why it is happening, and what matters most right now."
      />
      {narrative ? (
        <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "12px", color: "rgba(226,232,240,0.85)", lineHeight: 1.75 }}>
          {narrative}
        </div>
      ) : (
        <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "11px", color: "rgba(100,116,139,0.6)" }}>
          No narrative available. Run the Seismograph pipeline to generate today's market story.
        </div>
      )}
      {keyDev.length > 0 && (
        <div style={{ marginTop: "14px", paddingTop: "14px", borderTop: "1px solid rgba(255,255,255,0.05)" }}>
          <p style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "9px", color: "rgba(100,116,139,0.5)", letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: "8px" }}>
            Key Developments
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
            {keyDev.map((d, i) => (
              <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: "8px" }}>
                <ChevronRight className="w-3 h-3 text-cyan-400 shrink-0 mt-0.5" />
                <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "11px", color: "rgba(148,163,184,0.8)" }}>{d}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </SectionCard>
  );
}

// ─── Section 2: Pressure Index ────────────────────────────────────────────────

function PressureSection({ state }: { state: NonNullable<ReturnType<typeof useSeismoState>["data"]> }) {
  const { today } = state;
  const col = pressureColor(today.pressureScore);
  const bg = pressureBg(today.pressureScore);
  const border = pressureBorder(today.pressureScore);

  return (
    <SectionCard accent={col}>
      <SectionHeader
        icon={<Gauge className="w-3.5 h-3.5" />}
        label="Pressure Index"
        tooltip="The Pressure Index aggregates dozens of macroeconomic signals — credit stress, liquidity risk, Fed pressure, volatility, and momentum — into a single 0–100 score. Higher scores indicate greater systemic stress."
      />
      <div style={{ display: "flex", gap: "16px", alignItems: "flex-start", flexWrap: "wrap" }}>
        {/* Score block */}
        <div style={{
          background: bg, border: `1px solid ${border}`,
          borderRadius: "10px", padding: "16px 24px",
          display: "flex", flexDirection: "column", alignItems: "center",
          minWidth: "120px", flexShrink: 0,
        }}>
          <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "52px", fontWeight: 900, color: col, lineHeight: 1 }}>
            {today.pressureScore}
          </span>
          <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "9px", color: "rgba(148,163,184,0.5)", letterSpacing: "0.14em", textTransform: "uppercase", marginTop: "4px" }}>
            Pressure Index
          </span>
          <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "11px", color: col, fontWeight: 700, marginTop: "4px" }}>
            {today.stressLevel}
          </span>
        </div>

        {/* Metadata */}
        <div style={{ flex: 1, minWidth: "200px", display: "flex", flexDirection: "column", gap: "8px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            {directionIcon(today.direction)}
            <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "11px", color: "rgba(226,232,240,0.8)" }}>
              {today.direction === "rising" ? "Rising" : today.direction === "falling" ? "Declining" : "Stable"}
              {" "}<span style={{ color: "rgba(100,116,139,0.6)" }}>for</span>{" "}
              <strong style={{ color: "#fff" }}>{today.streakDays}</strong>
              {" "}<span style={{ color: "rgba(100,116,139,0.6)" }}>consecutive days</span>
            </span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <BarChart3 className="w-3.5 h-3.5 text-gray-500" />
            <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "11px", color: "rgba(226,232,240,0.8)" }}>
              <strong style={{ color: "#fff" }}>{today.historicalPercentile}th</strong>
              {" "}<span style={{ color: "rgba(100,116,139,0.6)" }}>historical percentile</span>
            </span>
          </div>
          {today.deltaFromPrior !== 0 && (
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <Activity className="w-3.5 h-3.5 text-gray-500" />
              <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "11px", color: "rgba(226,232,240,0.8)" }}>
                Change from prior:{" "}
                <strong style={{ color: today.deltaFromPrior > 0 ? "#ff8c00" : "#7ecf7e" }}>
                  {today.deltaFromPrior > 0 ? "+" : ""}{today.deltaFromPrior} pts
                </strong>
              </span>
            </div>
          )}
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <Clock className="w-3.5 h-3.5 text-gray-500" />
            <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "10px", color: "rgba(100,116,139,0.5)" }}>
              {fmtDate(today.date)}
            </span>
          </div>
        </div>
      </div>

      {/* Pressure drivers */}
      {today.pressureDrivers.length > 0 && (
        <div style={{ marginTop: "14px", paddingTop: "14px", borderTop: "1px solid rgba(255,255,255,0.05)" }}>
          <p style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "9px", color: "rgba(100,116,139,0.5)", letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: "8px" }}>
            Active Pressure Drivers
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
            {today.pressureDrivers.map((d, i) => (
              <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: "8px" }}>
                <AlertTriangle className="w-3 h-3 text-orange-400 shrink-0 mt-0.5" />
                <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "11px", color: "rgba(148,163,184,0.8)" }}>{d}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </SectionCard>
  );
}

// ─── Section 3: Current Regime ────────────────────────────────────────────────

function RegimeSection({ state, assembled }: {
  state: NonNullable<ReturnType<typeof useSeismoState>["data"]>;
  assembled: ReturnType<typeof useAssembled>["data"];
}) {
  const regime = state.today.regime;
  const probs = assembled?.probabilities;
  const consensus = assembled?.evidenceConsensus ?? "—";
  const evidenceFamilies = assembled?.evidenceFamilies ?? [];

  const consensusColor = consensus === "strong" ? "#7ecf7e" : consensus === "moderate" ? "#ffd700" : consensus === "divergent" ? "#ff8c00" : "#94a3b8";

  return (
    <SectionCard accent="#7C3AED">
      <SectionHeader
        icon={<Map className="w-3.5 h-3.5" />}
        label="Current Regime"
        tooltip="The Regime Engine classifies the prevailing market environment based on pressure, momentum, credit, and volatility signals. It is not a prediction — it is the current state of the market as understood by all contributing engines."
      />
      <div style={{ display: "flex", gap: "16px", alignItems: "flex-start", flexWrap: "wrap" }}>
        {/* Regime name */}
        <div style={{
          background: "rgba(124,58,237,0.08)", border: "1px solid rgba(124,58,237,0.2)",
          borderRadius: "10px", padding: "14px 20px",
          display: "flex", flexDirection: "column", alignItems: "center",
          minWidth: "140px", flexShrink: 0,
        }}>
          <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "13px", fontWeight: 700, color: "#C4B5FD", textAlign: "center", lineHeight: 1.3 }}>
            {regime}
          </span>
          <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "9px", color: "rgba(148,163,184,0.4)", letterSpacing: "0.14em", textTransform: "uppercase", marginTop: "6px" }}>
            Current Regime
          </span>
        </div>

        {/* Probabilities */}
        {probs && (
          <div style={{ flex: 1, minWidth: "200px" }}>
            <p style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "9px", color: "rgba(100,116,139,0.5)", letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: "10px" }}>
              Market State Probabilities
            </p>
            <ProbBar label="Bull / Recovery" value={probs.bull} color="#7ecf7e"
              tooltip="Probability of bullish continuation or recovery based on current evidence." />
            <ProbBar label="Neutral / Sideways" value={probs.neutral} color="#ffd700"
              tooltip="Probability of sideways or range-bound conditions." />
            <ProbBar label="Bear / Stress" value={probs.bear} color="#ff4444"
              tooltip="Probability of bearish or stressed conditions." />
            <div style={{ marginTop: "8px", display: "flex", alignItems: "center", gap: "6px" }}>
              <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "9px", color: "rgba(100,116,139,0.5)", textTransform: "uppercase", letterSpacing: "0.1em" }}>
                Evidence Consensus:
              </span>
              <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "10px", fontWeight: 700, color: consensusColor, textTransform: "uppercase" }}>
                {consensus}
              </span>
            </div>
            {probs.primaryDriver && (
              <p style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "10px", color: "rgba(148,163,184,0.6)", marginTop: "6px", lineHeight: 1.5 }}>
                Primary driver: {probs.primaryDriver}
              </p>
            )}
          </div>
        )}
      </div>

      {/* Evidence families */}
      {evidenceFamilies.length > 0 && (
        <div style={{ marginTop: "14px", paddingTop: "14px", borderTop: "1px solid rgba(255,255,255,0.05)" }}>
          <p style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "9px", color: "rgba(100,116,139,0.5)", letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: "10px" }}>
            Evidence Families
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: "8px" }}>
            {evidenceFamilies.slice(0, 6).map((fam, i) => {
              const sigColor = fam.signal === "bullish" || fam.signal === "recovering" ? "#7ecf7e"
                : fam.signal === "bearish" || fam.signal === "stressed" ? "#ff4444"
                : fam.signal === "transitioning" ? "#ff8c00" : "#ffd700";
              return (
                <Tooltip key={i}>
                  <TooltipTrigger asChild>
                    <div style={{
                      background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)",
                      borderRadius: "6px", padding: "8px 10px", cursor: "default",
                    }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "3px" }}>
                        <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "9px", color: "rgba(148,163,184,0.6)", textTransform: "uppercase", letterSpacing: "0.1em" }}>
                          {fam.name}
                        </span>
                        <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "9px", fontWeight: 700, color: sigColor, textTransform: "uppercase" }}>
                          {fam.signal}
                        </span>
                      </div>
                      <div style={{ height: "2px", background: "rgba(255,255,255,0.04)", borderRadius: "1px", overflow: "hidden" }}>
                        <div style={{ height: "100%", width: `${fam.strength}%`, backgroundColor: sigColor, opacity: 0.6 }} />
                      </div>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs text-xs">{fam.summary}</TooltipContent>
                </Tooltip>
              );
            })}
          </div>
        </div>
      )}
    </SectionCard>
  );
}

// ─── Section 4: Active Patterns ───────────────────────────────────────────────

function PatternsSection({ state }: { state: NonNullable<ReturnType<typeof useSeismoState>["data"]> }) {
  const { activePatterns } = state;
  const [expanded, setExpanded] = useReactState<number | null>(null);

  return (
    <SectionCard accent="#F59E0B">
      <SectionHeader
        icon={<Brain className="w-3.5 h-3.5" />}
        label="Active Patterns"
        badge={
          activePatterns.length > 0 ? (
            <span style={{
              fontFamily: "'IBM Plex Mono', monospace", fontSize: "9px", fontWeight: 700,
              color: "#F59E0B", background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.25)",
              padding: "2px 7px", borderRadius: "3px",
            }}>
              {activePatterns.length} detected
            </span>
          ) : undefined
        }
        tooltip="Patterns are recurring market configurations detected by comparing current conditions against the full historical dataset. Each pattern has a historical outcome distribution and analog matches."
      />
      {activePatterns.length === 0 ? (
        <p style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "11px", color: "rgba(100,116,139,0.6)" }}>
          No significant patterns currently active. The Seismograph will detect patterns as more observations accumulate.
        </p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          {activePatterns.map((p, i) => (
            <div key={i} style={{ border: "1px solid rgba(255,255,255,0.06)", borderRadius: "6px", overflow: "hidden" }}>
              <button
                onClick={() => setExpanded(expanded === i ? null : i)}
                style={{
                  width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
                  padding: "10px 12px", background: "transparent", border: "none", cursor: "pointer",
                  textAlign: "left",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <div style={{ width: "3px", height: "32px", borderRadius: "2px", backgroundColor: pressureColor(p.confidence), flexShrink: 0 }} />
                  <div>
                    <p style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "12px", fontWeight: 700, color: "#E2E8F0", margin: 0 }}>
                      {p.patternName}
                    </p>
                    <div style={{ display: "flex", gap: "8px", marginTop: "2px" }}>
                      <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "9px", color: "rgba(100,116,139,0.5)", background: "rgba(255,255,255,0.04)", padding: "1px 5px", borderRadius: "2px" }}>
                        {p.frequency}
                      </span>
                      <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "9px", color: pressureColor(p.confidence) }}>
                        {p.confidence}% confidence
                      </span>
                    </div>
                  </div>
                </div>
                <ChevronRight
                  className="w-4 h-4 text-gray-500 shrink-0"
                  style={{ transform: expanded === i ? "rotate(90deg)" : "none", transition: "transform 0.2s" }}
                />
              </button>

              {expanded === i && (
                <div style={{ padding: "0 12px 12px", borderTop: "1px solid rgba(255,255,255,0.05)" }}>
                  <p style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "11px", color: "rgba(148,163,184,0.8)", lineHeight: 1.7, paddingTop: "10px" }}>
                    {p.description}
                  </p>
                  {p.outcomeDistribution && p.outcomeDistribution.sampleSize > 0 && (
                    <div style={{ marginTop: "10px" }}>
                      <p style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "9px", color: "rgba(100,116,139,0.5)", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: "8px" }}>
                        Historical Outcome Distribution (n={p.outcomeDistribution.sampleSize})
                      </p>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "8px", marginBottom: "8px" }}>
                        {[
                          { label: "Bullish", value: p.outcomeDistribution.bullishContinuation, color: "#7ecf7e" },
                          { label: "Sideways", value: p.outcomeDistribution.sideways, color: "#ffd700" },
                          { label: "Correction", value: p.outcomeDistribution.correction, color: "#ff4444" },
                        ].map(({ label, value, color }) => (
                          <div key={label} style={{ textAlign: "center", background: "rgba(255,255,255,0.02)", borderRadius: "4px", padding: "6px" }}>
                            <p style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "16px", fontWeight: 900, color, margin: 0 }}>{value}%</p>
                            <p style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "9px", color: "rgba(100,116,139,0.5)", margin: 0 }}>{label}</p>
                          </div>
                        ))}
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: "4px" }}>
                        {[
                          { label: "1W Avg", value: p.outcomeDistribution.avgReturn1w },
                          { label: "1M Avg", value: p.outcomeDistribution.avgReturn1m },
                          { label: "3M Avg", value: p.outcomeDistribution.avgReturn3m },
                          { label: "6M Avg", value: p.outcomeDistribution.avgReturn6m },
                        ].map(({ label, value }) => (
                          <div key={label} style={{ textAlign: "center", background: "rgba(255,255,255,0.02)", borderRadius: "4px", padding: "5px" }}>
                            <p style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "11px", fontWeight: 700, color: value >= 0 ? "#7ecf7e" : "#ff4444", margin: 0 }}>
                              {value >= 0 ? "+" : ""}{value.toFixed(1)}%
                            </p>
                            <p style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "9px", color: "rgba(100,116,139,0.5)", margin: 0 }}>{label}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {p.invalidationConditions && (
                    <div style={{ marginTop: "8px", background: "rgba(255,68,68,0.04)", border: "1px solid rgba(255,68,68,0.1)", borderRadius: "4px", padding: "8px 10px" }}>
                      <p style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "9px", color: "rgba(100,116,139,0.5)", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: "4px" }}>
                        Invalidation
                      </p>
                      <p style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "10px", color: "rgba(148,163,184,0.7)", margin: 0 }}>
                        {p.invalidationConditions}
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </SectionCard>
  );
}

// ─── Section 5: Regime Transition Probabilities ───────────────────────────────

function TransitionSection({ state }: { state: NonNullable<ReturnType<typeof useSeismoState>["data"]> }) {
  const { transitionProbabilities: tp } = state;

  return (
    <SectionCard accent="#00ffc8">
      <SectionHeader
        icon={<Zap className="w-3.5 h-3.5" />}
        label="Regime Transition Probabilities"
        tooltip="These are historical base rates derived from similar past conditions — not predictions. They describe where the market has historically gone from environments like this one. Confidence reflects dataset size."
      />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px", alignItems: "start" }}>
        <div>
          <ProbBar label="Remain in current regime" value={tp.remainInRegime} color="#00ffc8"
            tooltip="Probability that the market stays in its current regime over the next 30 days, based on historical base rates from similar conditions." />
          <ProbBar label="Transition → elevated stress" value={tp.transitionToElevated} color="#ffd700"
            tooltip="Probability of moving into an elevated stress environment." />
          <ProbBar label="Transition → low stress" value={tp.transitionToLow} color="#7ecf7e"
            tooltip="Probability of conditions improving toward a low-stress environment." />
          <ProbBar label="Transition → crisis" value={tp.transitionToCrisis} color="#ff4444"
            tooltip="Probability of deterioration into a crisis-level environment. This is a historical base rate, not a prediction." />
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          <div style={{ background: "rgba(255,255,255,0.02)", borderRadius: "6px", padding: "10px 12px" }}>
            <p style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "9px", color: "rgba(100,116,139,0.5)", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: "4px" }}>
              Confidence
            </p>
            <p style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "14px", fontWeight: 700, color: "#00ffc8", margin: 0 }}>
              {tp.confidence}%
            </p>
          </div>
          <div style={{ background: "rgba(255,255,255,0.02)", borderRadius: "6px", padding: "10px 12px" }}>
            <p style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "9px", color: "rgba(100,116,139,0.5)", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: "4px" }}>
              Historical Basis
            </p>
            <p style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "10px", color: "rgba(148,163,184,0.7)", lineHeight: 1.5, margin: 0 }}>
              {tp.historicalBasis}
            </p>
          </div>
        </div>
      </div>
      {tp.currentEvidence.length > 0 && (
        <div style={{ marginTop: "14px", paddingTop: "14px", borderTop: "1px solid rgba(255,255,255,0.05)" }}>
          <p style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "9px", color: "rgba(100,116,139,0.5)", letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: "8px" }}>
            Current Evidence Supporting This Assessment
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
            {tp.currentEvidence.map((e, i) => (
              <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: "8px" }}>
                <ChevronRight className="w-3 h-3 text-cyan-400 shrink-0 mt-0.5" />
                <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "11px", color: "rgba(148,163,184,0.8)" }}>{e}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </SectionCard>
  );
}

// ─── Section 6: Evolution Analysis ───────────────────────────────────────────

function EvolutionSection({ state, readings }: {
  state: NonNullable<ReturnType<typeof useSeismoState>["data"]>;
  readings: Array<{ pressureScore: number; readingDate: string; regime: string; direction: string }>;
}) {
  const { evolution } = state;

  return (
    <SectionCard accent="#60A5FA">
      <SectionHeader
        icon={<TrendingUp className="w-3.5 h-3.5" />}
        label="Evolution Analysis"
        tooltip="Evolution Analysis shows how conditions have changed over the past 7 and 30 days. It identifies acceleration, building pressure, what has changed, and what to watch next."
      />

      {/* Sparkline */}
      {readings.length >= 2 && (
        <div style={{ background: "rgba(0,0,0,0.3)", borderRadius: "6px", padding: "10px 12px", marginBottom: "14px" }}>
          <MiniSparkline readings={readings} />
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: "4px" }}>
            <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "9px", color: "rgba(100,116,139,0.4)" }}>
              {fmtDate(readings[readings.length - 1]?.readingDate ?? "")}
            </span>
            <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "9px", color: "rgba(100,116,139,0.4)" }}>Today</span>
          </div>
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", marginBottom: "14px" }}>
        <div style={{ background: "rgba(255,255,255,0.02)", borderRadius: "6px", padding: "10px 12px" }}>
          <p style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "9px", color: "rgba(100,116,139,0.5)", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: "4px" }}>
            7-Day Trend
          </p>
          <p style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "11px", color: "#E2E8F0", margin: 0 }}>{evolution.sevenDayTrend}</p>
        </div>
        <div style={{ background: "rgba(255,255,255,0.02)", borderRadius: "6px", padding: "10px 12px" }}>
          <p style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "9px", color: "rgba(100,116,139,0.5)", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: "4px" }}>
            30-Day Trend
          </p>
          <p style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "11px", color: "#E2E8F0", margin: 0 }}>{evolution.thirtyDayTrend}</p>
        </div>
      </div>

      {evolution.accelerating && (
        <div style={{ display: "flex", alignItems: "center", gap: "8px", background: "rgba(255,140,0,0.06)", border: "1px solid rgba(255,140,0,0.15)", borderRadius: "6px", padding: "8px 12px", marginBottom: "10px" }}>
          <AlertTriangle className="w-3.5 h-3.5 text-orange-400 shrink-0" />
          <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "11px", color: "#FBB040" }}>Pressure is accelerating</span>
        </div>
      )}
      {evolution.buildingPressure && evolution.buildingDuration > 3 && (
        <div style={{ display: "flex", alignItems: "center", gap: "8px", background: "rgba(255,215,0,0.06)", border: "1px solid rgba(255,215,0,0.15)", borderRadius: "6px", padding: "8px 12px", marginBottom: "10px" }}>
          <Activity className="w-3.5 h-3.5 text-yellow-400 shrink-0" />
          <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "11px", color: "#FFD700" }}>
            Building pressure for {evolution.buildingDuration} consecutive days
          </span>
        </div>
      )}

      {evolution.whatChanged.length > 0 && (
        <div style={{ marginBottom: "12px" }}>
          <p style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "9px", color: "rgba(100,116,139,0.5)", letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: "7px" }}>
            What Changed
          </p>
          {evolution.whatChanged.map((c, i) => (
            <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: "8px", marginBottom: "4px" }}>
              <ChevronRight className="w-3 h-3 text-cyan-400 shrink-0 mt-0.5" />
              <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "11px", color: "rgba(148,163,184,0.8)" }}>{c}</span>
            </div>
          ))}
        </div>
      )}

      {evolution.whatToWatch.length > 0 && (
        <div style={{ marginBottom: "12px" }}>
          <p style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "9px", color: "rgba(100,116,139,0.5)", letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: "7px" }}>
            What to Watch Next
          </p>
          {evolution.whatToWatch.map((w, i) => (
            <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: "8px", marginBottom: "4px" }}>
              <div style={{ width: "5px", height: "5px", borderRadius: "50%", background: "rgba(0,212,255,0.5)", flexShrink: 0, marginTop: "5px" }} />
              <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "11px", color: "rgba(148,163,184,0.8)" }}>{w}</span>
            </div>
          ))}
        </div>
      )}

      {evolution.invalidationConditions.length > 0 && (
        <div>
          <p style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "9px", color: "rgba(100,116,139,0.5)", letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: "7px" }}>
            Invalidation Conditions
          </p>
          {evolution.invalidationConditions.map((c, i) => (
            <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: "8px", marginBottom: "4px" }}>
              <div style={{ width: "5px", height: "5px", borderRadius: "50%", background: "rgba(255,68,68,0.5)", flexShrink: 0, marginTop: "5px" }} />
              <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "11px", color: "rgba(148,163,184,0.6)" }}>{c}</span>
            </div>
          ))}
        </div>
      )}
    </SectionCard>
  );
}

// ─── Section 7: Historical Memory ────────────────────────────────────────────

function MemorySection({ state, assembled }: {
  state: NonNullable<ReturnType<typeof useSeismoState>["data"]>;
  assembled: ReturnType<typeof useAssembled>["data"];
}) {
  const { marketMemorySummary: mem } = state;
  const analogs = assembled?.analogMatches ?? [];
  const topAnalog = assembled?.topAnalog;

  return (
    <SectionCard accent="#F472B6">
      <SectionHeader
        icon={<History className="w-3.5 h-3.5" />}
        label="Historical Memory"
        tooltip="Market Memory is a persistent record of every observation, streak, threshold crossing, and regime shift. Historical analogs are past periods that most closely resemble current conditions."
      />

      {/* Stats row */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "8px", marginBottom: "14px" }}>
        <div style={{ background: "rgba(255,255,255,0.02)", borderRadius: "6px", padding: "10px", textAlign: "center" }}>
          <p style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "22px", fontWeight: 900, color: "#00D4FF", margin: 0 }}>{mem.observationCount}</p>
          <p style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "9px", color: "rgba(100,116,139,0.5)", margin: "2px 0 0" }}>Days Recorded</p>
        </div>
        <div style={{ background: "rgba(255,255,255,0.02)", borderRadius: "6px", padding: "10px", textAlign: "center" }}>
          <p style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "22px", fontWeight: 900, color: "#FFD700", margin: 0 }}>{mem.longestStreakInDataset}</p>
          <p style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "9px", color: "rgba(100,116,139,0.5)", margin: "2px 0 0" }}>Longest Streak</p>
        </div>
        <div style={{ background: "rgba(255,255,255,0.02)", borderRadius: "6px", padding: "10px", textAlign: "center" }}>
          <p style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "22px", fontWeight: 900, color: "#F472B6", margin: 0 }}>
            {mem.regimeHistory.length}
          </p>
          <p style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "9px", color: "rgba(100,116,139,0.5)", margin: "2px 0 0" }}>Regimes Seen</p>
        </div>
      </div>

      {/* Current streak */}
      <div style={{ marginBottom: "12px" }}>
        <p style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "9px", color: "rgba(100,116,139,0.5)", letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: "5px" }}>
          Current Streak
        </p>
        <p style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "11px", color: "rgba(148,163,184,0.8)", lineHeight: 1.6 }}>
          {mem.currentStreakDescription}
        </p>
      </div>

      {/* Top analog */}
      {topAnalog && (
        <div style={{ background: "rgba(244,114,182,0.05)", border: "1px solid rgba(244,114,182,0.15)", borderRadius: "6px", padding: "10px 12px", marginBottom: "12px" }}>
          <p style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "9px", color: "rgba(244,114,182,0.6)", letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: "5px" }}>
            Closest Historical Analog
          </p>
          <p style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "12px", fontWeight: 700, color: "#F9A8D4", marginBottom: "3px" }}>
            {topAnalog.label}
          </p>
          <p style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "10px", color: "rgba(148,163,184,0.7)", lineHeight: 1.5, marginBottom: "5px" }}>
            {topAnalog.description}
          </p>
          {topAnalog.outcome && (
            <p style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "10px", color: "rgba(100,116,139,0.6)", fontStyle: "italic" }}>
              Historical outcome: {topAnalog.outcome}
            </p>
          )}
          <div style={{ display: "flex", alignItems: "center", gap: "6px", marginTop: "5px" }}>
            <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "9px", color: "rgba(100,116,139,0.5)" }}>Similarity:</span>
            <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "10px", fontWeight: 700, color: "#F472B6" }}>{topAnalog.similarity}%</span>
          </div>
        </div>
      )}

      {/* Additional analogs */}
      {analogs.length > 1 && (
        <div style={{ marginBottom: "12px" }}>
          <p style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "9px", color: "rgba(100,116,139,0.5)", letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: "7px" }}>
            Additional Analog Matches
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
            {analogs.slice(1, 4).map((a, i) => (
              <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "rgba(255,255,255,0.02)", borderRadius: "4px", padding: "6px 10px" }}>
                <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "10px", color: "rgba(148,163,184,0.7)" }}>{a.label}</span>
                <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "10px", fontWeight: 700, color: "#F472B6" }}>{a.similarity}%</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Last major shift */}
      {mem.lastMajorShift && (
        <div style={{ marginBottom: "12px" }}>
          <p style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "9px", color: "rgba(100,116,139,0.5)", letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: "5px" }}>
            Last Major Shift
          </p>
          <p style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "11px", color: "rgba(148,163,184,0.8)" }}>{mem.lastMajorShift}</p>
        </div>
      )}

      {/* Key thresholds */}
      {mem.keyThresholdsCrossed.length > 0 && (
        <div>
          <p style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "9px", color: "rgba(100,116,139,0.5)", letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: "7px" }}>
            Key Thresholds Crossed
          </p>
          {mem.keyThresholdsCrossed.map((t, i) => (
            <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: "8px", marginBottom: "4px" }}>
              <div style={{ width: "5px", height: "5px", borderRadius: "50%", background: "rgba(255,140,0,0.6)", flexShrink: 0, marginTop: "5px" }} />
              <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "11px", color: "rgba(148,163,184,0.8)" }}>{t}</span>
            </div>
          ))}
        </div>
      )}

      {mem.observationCount < 14 && (
        <div style={{ marginTop: "12px", background: "rgba(0,212,255,0.04)", border: "1px solid rgba(0,212,255,0.12)", borderRadius: "6px", padding: "10px 12px" }}>
          <p style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "10px", color: "rgba(0,212,255,0.6)", lineHeight: 1.6, margin: 0 }}>
            The Seismograph is in its early accumulation phase. Pattern detection accuracy improves significantly after 30 observations and continues improving as the dataset grows.
          </p>
        </div>
      )}
    </SectionCard>
  );
}

// ─── Next Steps Navigation Strip ─────────────────────────────────────────────

function NextStepsStrip() {
  const links = [
    { icon: <Radio className="w-3.5 h-3.5" />, label: "Signal Outlook", sub: "What signals are active", path: "/app/signal-outlook", color: "#00D4FF" },
    { icon: <Telescope className="w-3.5 h-3.5" />, label: "Symbol Intelligence", sub: "Analyze individual stocks", path: "/app/symbol-intelligence", color: "#7C3AED" },
    { icon: <BookOpen className="w-3.5 h-3.5" />, label: "Daily Briefing", sub: "Full AI-generated report", path: "/app/report", color: "#F59E0B" },
    { icon: <Gauge className="w-3.5 h-3.5" />, label: "Pressure Index", sub: "Deep pressure analysis", path: "/app/pressure", color: "#ff4444" },
    { icon: <Shield className="w-3.5 h-3.5" />, label: "Pre-Flight Check", sub: "Trade readiness check", path: "/app/pre-flight", color: "#7ecf7e" },
    { icon: <Search className="w-3.5 h-3.5" />, label: "Ask FAULTLINE", sub: "AI-powered market Q&A", path: "/app/discover", color: "#F472B6" },
  ];

  return (
    <div style={{ marginTop: "32px", paddingTop: "24px", borderTop: "1px solid rgba(255,255,255,0.05)" }}>
      <p style={{
        fontFamily: "'IBM Plex Mono', monospace", fontSize: "9px", fontWeight: 700,
        color: "rgba(100,116,139,0.4)", letterSpacing: "0.2em", textTransform: "uppercase",
        marginBottom: "14px",
      }}>
        Now that you understand the market environment, explore:
      </p>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: "8px" }}>
        {links.map((l) => (
          <Link key={l.path} href={l.path}>
            <div style={{
              display: "flex", alignItems: "center", gap: "10px",
              background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)",
              borderRadius: "6px", padding: "10px 12px", cursor: "pointer",
              transition: "border-color 0.15s, background 0.15s",
            }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLElement).style.borderColor = `${l.color}30`;
                (e.currentTarget as HTMLElement).style.background = `${l.color}06`;
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.05)";
                (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.02)";
              }}
            >
              <span style={{ color: l.color, flexShrink: 0 }}>{l.icon}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "11px", fontWeight: 700, color: "#E2E8F0", margin: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {l.label}
                </p>
                <p style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "9px", color: "rgba(100,116,139,0.5)", margin: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {l.sub}
                </p>
              </div>
              <ArrowRight className="w-3 h-3 shrink-0" style={{ color: l.color, opacity: 0.5 }} />
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

// ─── Custom hooks ─────────────────────────────────────────────────────────────

function useSeismoState() {
  return trpc.seismograph.getState.useQuery(undefined, {
    refetchInterval: 5 * 60 * 1000,
    staleTime: 3 * 60 * 1000,
  });
}

function useAssembled() {
  return trpc.seismograph.getAssembledOutput.useQuery(undefined, {
    refetchInterval: 5 * 60 * 1000,
    staleTime: 3 * 60 * 1000,
  });
}

// ─── Loading skeleton ─────────────────────────────────────────────────────────

function LoadingSkeleton() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
      {[1, 2, 3].map(i => (
        <div key={i} style={{ background: "rgba(6,8,14,0.95)", border: "1px solid rgba(255,255,255,0.05)", borderRadius: "8px", padding: "20px" }}>
          <div style={{ height: "10px", width: "140px", background: "rgba(255,255,255,0.05)", borderRadius: "3px", marginBottom: "14px" }} />
          <div style={{ height: "10px", width: "100%", background: "rgba(255,255,255,0.03)", borderRadius: "3px", marginBottom: "6px" }} />
          <div style={{ height: "10px", width: "80%", background: "rgba(255,255,255,0.03)", borderRadius: "3px", marginBottom: "6px" }} />
          <div style={{ height: "10px", width: "60%", background: "rgba(255,255,255,0.03)", borderRadius: "3px" }} />
        </div>
      ))}
    </div>
  );
}

// ─── Empty state ──────────────────────────────────────────────────────────────

function EmptyState({ seedNow, refetch }: {
  seedNow: ReturnType<typeof trpc.seismograph.seedNow.useMutation>;
  refetch: () => void;
}) {
  return (
    <div style={{ minHeight: "60vh", display: "flex", alignItems: "center", justifyContent: "center", padding: "24px" }}>
      <div style={{
        background: "rgba(6,8,14,0.95)", border: "1px solid rgba(255,255,255,0.06)",
        borderRadius: "12px", padding: "40px 32px", maxWidth: "440px", width: "100%", textAlign: "center",
      }}>
        <Activity className="w-10 h-10 mx-auto mb-4" style={{ color: "rgba(0,212,255,0.3)" }} />
        <p style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "14px", fontWeight: 700, color: "#E2E8F0", marginBottom: "8px" }}>
          No Seismograph Data Yet
        </p>
        <p style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "11px", color: "rgba(100,116,139,0.6)", lineHeight: 1.6, marginBottom: "24px" }}>
          The Seismograph runs automatically after market close each day. Generate today's first reading now to activate the command center.
        </p>
        {seedNow.isError && (
          <p style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "10px", color: "#ff4444", marginBottom: "12px" }}>
            {seedNow.error?.message ?? "Pipeline failed. Check server logs."}
          </p>
        )}
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          <button
            onClick={() => seedNow.mutate()}
            disabled={seedNow.isPending}
            style={{
              display: "flex", alignItems: "center", justifyContent: "center", gap: "8px",
              width: "100%", padding: "12px 16px", borderRadius: "7px",
              background: "rgba(0,212,255,0.08)", border: "1px solid rgba(0,212,255,0.25)",
              color: "#00D4FF", fontFamily: "'IBM Plex Mono', monospace", fontSize: "12px", fontWeight: 700,
              cursor: seedNow.isPending ? "not-allowed" : "pointer", opacity: seedNow.isPending ? 0.6 : 1,
              transition: "all 0.15s",
            }}
          >
            {seedNow.isPending ? (
              <><RefreshCw className="w-3.5 h-3.5 animate-spin" />Running pipeline… (30–60s)</>
            ) : (
              <><Activity className="w-3.5 h-3.5" />Generate Today's Reading Now</>
            )}
          </button>
          <button
            onClick={refetch}
            style={{
              display: "flex", alignItems: "center", justifyContent: "center", gap: "6px",
              background: "none", border: "none", cursor: "pointer",
              fontFamily: "'IBM Plex Mono', monospace", fontSize: "10px", color: "rgba(100,116,139,0.5)",
              transition: "color 0.15s",
            }}
          >
            <RefreshCw className="w-3 h-3" />Refresh
          </button>
        </div>
        <p style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "9px", color: "rgba(100,116,139,0.35)", lineHeight: 1.5, marginTop: "16px" }}>
          Runs: Pressure Engine → FMOS → Cross-Market → SOB → Evidence Assembly → Pattern Analysis
        </p>
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function SeismographIntelligence() {
  const { data: state, isLoading: stateLoading, error: stateError, refetch } = useSeismoState();
  const { data: assembled, isLoading: assembledLoading } = useAssembled();
  const { data: readings = [] } = trpc.seismograph.getReadingHistory.useQuery(
    { days: 30 },
    { staleTime: 3 * 60 * 1000 }
  );
  const utils = trpc.useUtils();
  const seedNow = trpc.seismograph.seedNow.useMutation({
    onSuccess: () => {
      void utils.seismograph.getState.invalidate();
      void utils.seismograph.getReadingHistory.invalidate();
      void utils.seismograph.getActivePatterns.invalidate();
      void utils.seismograph.getAssembledOutput.invalidate();
    },
  });

  const isLoading = stateLoading || assembledLoading;

  if (isLoading) {
    return (
      <div style={{ minHeight: "100vh", background: "#050508" }}>
        {/* Header */}
        <div style={{ borderBottom: "1px solid rgba(255,255,255,0.05)", background: "rgba(0,0,0,0.6)", backdropFilter: "blur(8px)", position: "sticky", top: 0, zIndex: 10 }}>
          <div style={{ maxWidth: "900px", margin: "0 auto", padding: "14px 16px", display: "flex", alignItems: "center", gap: "10px" }}>
            <Activity className="w-4 h-4 text-cyan-400 animate-pulse" />
            <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "11px", fontWeight: 700, color: "rgba(148,163,184,0.5)", letterSpacing: "0.14em", textTransform: "uppercase" }}>
              Loading Seismograph…
            </span>
          </div>
        </div>
        <div style={{ maxWidth: "900px", margin: "0 auto", padding: "24px 16px" }}>
          <LoadingSkeleton />
        </div>
      </div>
    );
  }

  if (stateError || !state) {
    return (
      <div style={{ minHeight: "100vh", background: "#050508" }}>
        <EmptyState seedNow={seedNow} refetch={refetch} />
      </div>
    );
  }

  const typedReadings = readings as Array<{ pressureScore: number; readingDate: string; regime: string; direction: string }>;

  return (
    <div style={{ minHeight: "100vh", background: "#050508", color: "#fff" }}>
      {/* ── Sticky header ─────────────────────────────────────── */}
      <div style={{
        borderBottom: "1px solid rgba(255,255,255,0.05)",
        background: "rgba(5,5,8,0.92)", backdropFilter: "blur(8px)",
        position: "sticky", top: 0, zIndex: 10,
      }}>
        <div style={{ maxWidth: "900px", margin: "0 auto", padding: "12px 16px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#00D4FF", boxShadow: "0 0 8px #00D4FF" }} />
            <div>
              <h1 style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "12px", fontWeight: 700, color: "#E2E8F0", letterSpacing: "0.12em", textTransform: "uppercase", margin: 0 }}>
                Seismograph Intelligence
              </h1>
              <p style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "9px", color: "rgba(100,116,139,0.5)", margin: 0, marginTop: "1px" }}>
                FAULTLINE Market Operating System · {state.marketMemorySummary.observationCount} observations · {state.today.regime}
              </p>
            </div>
          </div>
          <button
            onClick={() => refetch()}
            style={{
              display: "flex", alignItems: "center", gap: "5px",
              background: "none", border: "none", cursor: "pointer",
              fontFamily: "'IBM Plex Mono', monospace", fontSize: "9px",
              color: "rgba(100,116,139,0.5)", transition: "color 0.15s",
            }}
            onMouseEnter={e => (e.currentTarget.style.color = "rgba(148,163,184,0.9)")}
            onMouseLeave={e => (e.currentTarget.style.color = "rgba(100,116,139,0.5)")}
          >
            <RefreshCw className="w-3 h-3" />Refresh
          </button>
        </div>
      </div>

      {/* ── Page intro ────────────────────────────────────────── */}
      <div style={{ maxWidth: "900px", margin: "0 auto", padding: "24px 16px 0" }}>
        <div style={{ marginBottom: "24px" }}>
          <p style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "9px", color: "rgba(0,212,255,0.5)", letterSpacing: "0.2em", textTransform: "uppercase", marginBottom: "6px" }}>
            Executive Briefing
          </p>
          <h2 style={{ fontFamily: "'Rajdhani', sans-serif", fontWeight: 900, fontSize: "clamp(20px, 4vw, 28px)", color: "#E2E8F0", letterSpacing: "0.04em", margin: "0 0 6px" }}>
            Today's Market Intelligence
          </h2>
          <p style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "11px", color: "rgba(100,116,139,0.6)", lineHeight: 1.6, margin: 0, maxWidth: "600px" }}>
            Understand the market before you act. The Seismograph synthesizes all available evidence into a single, coherent market narrative — from overall stress to historical context.
          </p>
        </div>

        {/* ── 7 Sections in narrative order ─────────────────── */}
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>

          {/* 1. Today's Market Story */}
          <StorySection assembled={assembled} />

          {/* 2. Pressure Index */}
          <PressureSection state={state} />

          {/* 3. Current Regime */}
          <RegimeSection state={state} assembled={assembled} />

          {/* 4. Active Patterns */}
          <PatternsSection state={state} />

          {/* 5. Regime Transition Probabilities */}
          <TransitionSection state={state} />

          {/* 6. Evolution Analysis */}
          <EvolutionSection state={state} readings={typedReadings} />

          {/* 7. Historical Memory */}
          <MemorySection state={state} assembled={assembled} />

        </div>

        {/* ── Next Steps ────────────────────────────────────── */}
        <NextStepsStrip />

        {/* ── Disclaimer ────────────────────────────────────── */}
        <div style={{ marginTop: "32px", paddingTop: "16px", paddingBottom: "32px", borderTop: "1px solid rgba(255,255,255,0.04)" }}>
          <p style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "9px", color: "rgba(100,116,139,0.35)", lineHeight: 1.6, maxWidth: "700px" }}>
            <strong style={{ color: "rgba(100,116,139,0.5)" }}>Important:</strong> Seismograph probabilities are historical base rates derived from similar past conditions — not predictions or guarantees. The system distinguishes between historical frequency, current evidence, and confidence level. Past patterns do not guarantee future outcomes. This is an analytical tool, not investment advice.
          </p>
        </div>
      </div>
    </div>
  );
}
