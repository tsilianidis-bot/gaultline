/**
 * FAULTLINE Historical Context Engine
 *
 * Transforms every Pressure Index reading into a complete market story.
 * All metrics are computed dynamically from the pressureHistory DB and pressureRuns audit table.
 *
 * Sections:
 *   1. Market Story — LLM-generated institutional narrative
 *   2. Why Is The Pressure Index Here? — ranked driver contributions with percentiles
 *   3. Pressure Timeline — regime duration, streaks, trend direction
 *   4. Historical Context — analog matches with similarity scores and narratives
 *   5. Historical Outcomes — outcome statistics with sample sizes
 *   6. Trend Assessment — 7/30/90-day trend analysis
 *   7. Institutional Interpretation — macro strategist perspective
 *   8. Data Transparency — N, date range, last refresh
 */

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import {
  RefreshCw, BookOpen, TrendingUp, TrendingDown, Minus,
  Clock, AlertTriangle, BarChart2, Activity, ChevronDown, ChevronUp,
  Copy, Download, Info, Calendar, Database
} from "lucide-react";

// ── Design tokens (Palantir Noir) ─────────────────────────────
const C = {
  bg: "#0A0A0F",
  surface: "#0D1117",
  border: "#1A2030",
  borderHover: "#00D4FF33",
  cyan: "#00D4FF",
  cyanDim: "#00D4FF66",
  green: "#00FF88",
  greenDim: "#00FF8866",
  orange: "#FF6B00",
  orangeDim: "#FF6B0066",
  red: "#FF2D55",
  redDim: "#FF2D5566",
  yellow: "#FFD700",
  yellowDim: "#FFD70066",
  text: "#E2E8F0",
  textMid: "#9CA3AF",
  textDim: "#4B5563",
  mono: "'IBM Plex Mono', monospace",
  sans: "'IBM Plex Sans', sans-serif",
  raj: "'Rajdhani', sans-serif",
};

function levelColor(level: string): string {
  switch (level?.toLowerCase()) {
    case "critical": return C.red;
    case "high": return C.orange;
    case "elevated": return C.yellow;
    case "moderate": return C.cyan;
    default: return C.green;
  }
}

function trendIcon(direction: string) {
  if (direction === "Worsening" || direction === "rising") return <TrendingUp size={11} style={{ color: C.red }} />;
  if (direction === "Improving" || direction === "falling") return <TrendingDown size={11} style={{ color: C.green }} />;
  return <Minus size={11} style={{ color: C.textDim }} />;
}

function trendColor(direction: string): string {
  if (direction === "Worsening" || direction === "Building" || direction === "Accelerating" || direction === "Rapidly Deteriorating") return C.orange;
  if (direction === "Improving") return C.green;
  return C.textMid;
}

// ── Section wrapper ───────────────────────────────────────────
function Section({
  title, icon, children, badge
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  badge?: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      style={{
        background: C.surface,
        border: `1px solid ${C.border}`,
        borderRadius: "6px",
        marginBottom: "16px",
        overflow: "hidden",
      }}
    >
      <div style={{
        display: "flex", alignItems: "center", gap: "8px",
        padding: "12px 16px", borderBottom: `1px solid ${C.border}`,
        background: "#0A0E1A",
      }}>
        <span style={{ color: C.cyan }}>{icon}</span>
        <span style={{ fontFamily: C.mono, fontSize: "10px", letterSpacing: "0.12em", color: C.cyan, textTransform: "uppercase" }}>{title}</span>
        {badge && (
          <span style={{ marginLeft: "auto", fontFamily: C.mono, fontSize: "9px", color: C.textDim, background: "#1A2030", padding: "2px 6px", borderRadius: "3px" }}>{badge}</span>
        )}
      </div>
      <div style={{ padding: "16px" }}>{children}</div>
    </motion.div>
  );
}

// ── Stat pill ─────────────────────────────────────────────────
function StatPill({ label, value, color }: { label: string; value: string | number; color?: string }) {
  return (
    <div style={{
      background: "#0A0E1A", border: `1px solid ${C.border}`,
      borderRadius: "4px", padding: "8px 12px", minWidth: "80px",
    }}>
      <div style={{ fontFamily: C.mono, fontSize: "8px", color: C.textDim, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: "4px" }}>{label}</div>
      <div style={{ fontFamily: C.raj, fontWeight: 700, fontSize: "18px", color: color ?? C.text }}>{value}</div>
    </div>
  );
}

// ── Percentile bar ────────────────────────────────────────────
function PercentileBar({ pct, color }: { pct: number; color: string }) {
  return (
    <div style={{ height: "3px", background: "#1A2030", borderRadius: "2px", overflow: "hidden", marginTop: "4px" }}>
      <motion.div
        initial={{ width: 0 }}
        animate={{ width: `${pct}%` }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        style={{ height: "100%", background: color, borderRadius: "2px" }}
      />
    </div>
  );
}

// ── Skeleton loader ───────────────────────────────────────────
function Skeleton({ h = 20, w = "100%" }: { h?: number; w?: string }) {
  return (
    <div style={{
      height: h, width: w, background: "#1A2030",
      borderRadius: "3px", animation: "pulse 1.5s ease-in-out infinite",
    }} />
  );
}

// ── Copy button ───────────────────────────────────────────────
function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => {
        navigator.clipboard.writeText(text).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        });
      }}
      style={{
        background: "transparent", border: `1px solid ${C.border}`,
        borderRadius: "3px", padding: "3px 8px", cursor: "pointer",
        display: "flex", alignItems: "center", gap: "4px",
        fontFamily: C.mono, fontSize: "9px", color: copied ? C.green : C.textDim,
        transition: "color 0.2s",
      }}
    >
      <Copy size={10} />
      {copied ? "COPIED" : "COPY"}
    </button>
  );
}

// ── Main Component ────────────────────────────────────────────
export default function HistoricalContextEngine() {
  const [expandedAnalog, setExpandedAnalog] = useState<number | null>(null);

  const { data, isLoading, error, refetch, isFetching } = trpc.pressure.getHistoricalContext.useQuery(
    undefined,
    { staleTime: 5 * 60 * 1000, refetchOnWindowFocus: false }
  );

  function handleRefresh() {
    refetch();
    toast.info("Refreshing Historical Context Engine...");
  }

  function handleDownload() {
    if (!data) return;
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `faultline-historical-context-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Historical Context data downloaded.");
  }

  if (error) {
    return (
      <div style={{ padding: "24px", fontFamily: C.mono, color: C.red, fontSize: "11px" }}>
        <AlertTriangle size={14} style={{ display: "inline", marginRight: "8px" }} />
        Historical Context Engine unavailable: {error.message}
      </div>
    );
  }

  const d = data;

  return (
    <div style={{ padding: "24px", maxWidth: "900px", margin: "0 auto" }}>
      {/* ── Header ── */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "24px" }}>
        <div>
          <div style={{ fontFamily: C.mono, fontSize: "9px", color: C.cyan, letterSpacing: "0.15em", textTransform: "uppercase", marginBottom: "4px" }}>
            FAULTLINE HISTORICAL CONTEXT ENGINE
          </div>
          <div style={{ fontFamily: C.raj, fontWeight: 700, fontSize: "22px", color: C.text, letterSpacing: "0.04em" }}>
            Market Story & Historical Context
          </div>
          <div style={{ fontFamily: C.sans, fontSize: "12px", color: C.textMid, marginTop: "4px" }}>
            Every metric computed dynamically from {d?.meta.pressureHistoryN ?? "—"} months of historical data
          </div>
        </div>
        <div style={{ display: "flex", gap: "8px" }}>
          <button
            onClick={handleDownload}
            disabled={!d}
            style={{
              background: "transparent", border: `1px solid ${C.border}`,
              borderRadius: "4px", padding: "6px 12px", cursor: "pointer",
              display: "flex", alignItems: "center", gap: "6px",
              fontFamily: C.mono, fontSize: "9px", color: C.textDim,
            }}
          >
            <Download size={11} /> EXPORT
          </button>
          <button
            onClick={handleRefresh}
            disabled={isFetching}
            style={{
              background: isFetching ? "#0A0E1A" : "transparent",
              border: `1px solid ${isFetching ? C.cyanDim : C.border}`,
              borderRadius: "4px", padding: "6px 12px", cursor: "pointer",
              display: "flex", alignItems: "center", gap: "6px",
              fontFamily: C.mono, fontSize: "9px", color: isFetching ? C.cyan : C.textDim,
            }}
          >
            <RefreshCw size={11} style={{ animation: isFetching ? "spin 1s linear infinite" : "none" }} />
            {isFetching ? "REFRESHING..." : "REFRESH"}
          </button>
        </div>
      </div>

      {/* ── Current Reading Summary ── */}
      {isLoading ? (
        <div style={{ display: "flex", gap: "12px", marginBottom: "16px" }}>
          {[1,2,3,4].map(i => <Skeleton key={i} h={60} w="120px" />)}
        </div>
      ) : d && (
        <div style={{ display: "flex", gap: "12px", marginBottom: "20px", flexWrap: "wrap" }}>
          <StatPill label="Pressure Index" value={d.currentPressure} color={levelColor(d.currentLevel)} />
          <StatPill label="Regime" value={d.currentRegime} color={C.cyan} />
          <StatPill label="Percentile" value={`${d.rarityContext.percentile}th`} color={levelColor(d.currentLevel)} />
          <StatPill label="Months in Regime" value={d.timeline.monthsInCurrentRegime} color={C.textMid} />
          <StatPill label="Trend" value={d.trendAssessment.label} color={trendColor(d.trendAssessment.label)} />
        </div>
      )}

      {/* ── Section 1: Market Story ── */}
      <Section title="Market Story" icon={<BookOpen size={13} />}>
        {isLoading ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            <Skeleton h={16} /><Skeleton h={16} w="90%" /><Skeleton h={16} w="80%" />
          </div>
        ) : d ? (
          <div>
            <p style={{ fontFamily: C.sans, fontSize: "14px", color: C.text, lineHeight: 1.7, margin: 0 }}>
              {d.marketStory}
            </p>
            <div style={{ marginTop: "12px", display: "flex", justifyContent: "flex-end" }}>
              <CopyButton text={d.marketStory} />
            </div>
          </div>
        ) : null}
      </Section>

      {/* ── Section 2: Why Is The Pressure Index Here? ── */}
      <Section
        title="Why Is The Pressure Index Here?"
        icon={<BarChart2 size={13} />}
        badge={d ? `${d.drivers.length} VECTORS` : undefined}
      >
        {isLoading ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {[1,2,3,4,5,6].map(i => <Skeleton key={i} h={52} />)}
          </div>
        ) : d ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {d.drivers.map((driver, i) => {
              const col = levelColor(driver.level);
              return (
                <div key={driver.id} style={{
                  background: "#0A0E1A", border: `1px solid ${C.border}`,
                  borderRadius: "4px", padding: "10px 12px",
                }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "6px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <span style={{ fontFamily: C.mono, fontSize: "9px", color: C.textDim, width: "14px" }}>#{i + 1}</span>
                      <span style={{ fontFamily: C.raj, fontWeight: 700, fontSize: "13px", color: C.text }}>{driver.label}</span>
                      {trendIcon(driver.direction)}
                      <span style={{ fontFamily: C.mono, fontSize: "9px", color: trendColor(driver.direction) }}>{driver.direction}</span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                      {driver.percentile !== null && (
                        <span style={{ fontFamily: C.mono, fontSize: "9px", color: C.textDim }}>
                          {driver.percentile}th pct <span style={{ color: C.textDim }}>({driver.percentileN}mo)</span>
                        </span>
                      )}
                      <span style={{ fontFamily: C.raj, fontWeight: 700, fontSize: "16px", color: col }}>{driver.score}</span>
                      <span style={{ fontFamily: C.mono, fontSize: "9px", color: C.textDim, background: "#1A2030", padding: "2px 6px", borderRadius: "3px" }}>
                        {driver.contributionPct}% of total
                      </span>
                    </div>
                  </div>
                  <PercentileBar pct={driver.score} color={col} />
                  <div style={{ fontFamily: C.sans, fontSize: "11px", color: C.textMid, marginTop: "6px", lineHeight: 1.5 }}>
                    {driver.driver}
                  </div>
                </div>
              );
            })}
            <div style={{ fontFamily: C.mono, fontSize: "9px", color: C.textDim, marginTop: "4px", textAlign: "right" }}>
              Percentiles calculated from {d.meta.pressureHistoryN} months of history ({d.meta.pressureHistoryRange})
            </div>
          </div>
        ) : null}
      </Section>

      {/* ── Section 3: Pressure Timeline ── */}
      <Section title="Pressure Timeline" icon={<Clock size={13} />}>
        {isLoading ? (
          <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
            {[1,2,3,4,5,6].map(i => <Skeleton key={i} h={60} w="120px" />)}
          </div>
        ) : d ? (
          <div>
            <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", marginBottom: "16px" }}>
              <StatPill label="Months in Regime" value={d.timeline.monthsInCurrentRegime} color={C.cyan} />
              <StatPill label="Days in Regime" value={d.timeline.daysInCurrentRegime > 0 ? d.timeline.daysInCurrentRegime : "—"} color={C.textMid} />
              <StatPill label="Elevated Streak" value={`${d.timeline.consecutiveElevatedMonths}mo`} color={d.timeline.consecutiveElevatedMonths >= 6 ? C.orange : C.textMid} />
              <StatPill label="High Streak" value={`${d.timeline.consecutiveHighMonths}mo`} color={d.timeline.consecutiveHighMonths >= 3 ? C.red : C.textMid} />
              <StatPill label="Cycle High" value={d.timeline.cycleHigh} color={C.red} />
              <StatPill label="Cycle Low" value={d.timeline.cycleLow} color={C.green} />
            </div>

            {/* Trend indicators */}
            <div style={{ background: "#0A0E1A", border: `1px solid ${C.border}`, borderRadius: "4px", padding: "12px" }}>
              <div style={{ fontFamily: C.mono, fontSize: "9px", color: C.textDim, letterSpacing: "0.1em", marginBottom: "10px" }}>TREND INDICATORS</div>
              <div style={{ display: "flex", gap: "16px", flexWrap: "wrap", marginBottom: "12px" }}>
                {[
                  { label: "7-Day", value: d.timeline.trend7d },
                  { label: "30-Day", value: d.timeline.trend30d },
                  { label: "90-Day", value: d.timeline.trend90d },
                ].map(t => (
                  <div key={t.label} style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <span style={{ fontFamily: C.mono, fontSize: "9px", color: C.textDim }}>{t.label}:</span>
                    {t.value !== null ? (
                      <span style={{
                        fontFamily: C.raj, fontWeight: 700, fontSize: "14px",
                        color: t.value > 3 ? C.orange : t.value < -3 ? C.green : C.textMid,
                      }}>
                        {t.value > 0 ? "+" : ""}{t.value.toFixed(1)} pts
                      </span>
                    ) : (
                      <span style={{ fontFamily: C.mono, fontSize: "9px", color: C.textDim }}>Insufficient run history</span>
                    )}
                  </div>
                ))}
              </div>
              <div style={{
                fontFamily: C.sans, fontSize: "12px", color: trendColor(d.trendAssessment.label),
                lineHeight: 1.6, borderLeft: `2px solid ${trendColor(d.trendAssessment.label)}`, paddingLeft: "10px",
              }}>
                {d.trendAssessment.explanation}
              </div>
            </div>

            {d.timeline.regimeStartMonth && (
              <div style={{ fontFamily: C.mono, fontSize: "9px", color: C.textDim, marginTop: "8px" }}>
                <Calendar size={10} style={{ display: "inline", marginRight: "4px" }} />
                Current {d.currentRegime} regime started: {d.timeline.regimeStartMonth}
              </div>
            )}
          </div>
        ) : null}
      </Section>

      {/* ── Section 4: Historical Context (Analog Matches) ── */}
      <Section
        title="Historical Context"
        icon={<Activity size={13} />}
        badge={d ? `${d.analogMatches.length} ANALOGS` : undefined}
      >
        {isLoading ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {[1,2,3].map(i => <Skeleton key={i} h={80} />)}
          </div>
        ) : d ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {d.analogMatches.map((analog, i) => {
              const isExpanded = expandedAnalog === i;
              return (
                <div key={i} style={{
                  background: "#0A0E1A", border: `1px solid ${isExpanded ? C.cyanDim : C.border}`,
                  borderRadius: "4px", overflow: "hidden", transition: "border-color 0.2s",
                }}>
                  <button
                    onClick={() => setExpandedAnalog(isExpanded ? null : i)}
                    style={{
                      width: "100%", background: "transparent", border: "none",
                      padding: "12px 14px", cursor: "pointer", textAlign: "left",
                      display: "flex", alignItems: "center", justifyContent: "space-between",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                      <span style={{ fontFamily: C.mono, fontSize: "9px", color: C.textDim, width: "14px" }}>#{i + 1}</span>
                      <div>
                        <div style={{ fontFamily: C.raj, fontWeight: 700, fontSize: "14px", color: C.text }}>{analog.label}</div>
                        <div style={{ fontFamily: C.mono, fontSize: "9px", color: C.textDim, marginTop: "2px" }}>{analog.period}</div>
                      </div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                      <div style={{ textAlign: "right" }}>
                        <div style={{ fontFamily: C.raj, fontWeight: 700, fontSize: "18px", color: analog.similarity >= 70 ? C.orange : analog.similarity >= 50 ? C.yellow : C.textMid }}>
                          {analog.similarity}%
                        </div>
                        <div style={{ fontFamily: C.mono, fontSize: "8px", color: C.textDim }}>SIMILARITY</div>
                      </div>
                      {isExpanded ? <ChevronUp size={13} style={{ color: C.textDim }} /> : <ChevronDown size={13} style={{ color: C.textDim }} />}
                    </div>
                  </button>

                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        style={{ overflow: "hidden" }}
                      >
                        <div style={{ padding: "0 14px 14px", borderTop: `1px solid ${C.border}` }}>
                          <div style={{ paddingTop: "12px" }}>
                            {/* Narrative explanation */}
                            <p style={{ fontFamily: C.sans, fontSize: "12px", color: C.textMid, lineHeight: 1.6, margin: "0 0 12px" }}>
                              {analog.narrativeExplanation}
                            </p>

                            {/* Outcome */}
                            {analog.outcome && (
                              <div style={{ background: "#060A12", border: `1px solid ${C.border}`, borderRadius: "4px", padding: "10px 12px", marginBottom: "10px" }}>
                                <div style={{ fontFamily: C.mono, fontSize: "8px", color: C.textDim, letterSpacing: "0.1em", marginBottom: "6px" }}>HISTORICAL OUTCOME</div>
                                <p style={{ fontFamily: C.sans, fontSize: "12px", color: C.text, lineHeight: 1.6, margin: 0 }}>{analog.outcome}</p>
                              </div>
                            )}

                            {/* Similarities & Differences */}
                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                              {analog.similarities.length > 0 && (
                                <div>
                                  <div style={{ fontFamily: C.mono, fontSize: "8px", color: C.green, letterSpacing: "0.1em", marginBottom: "6px" }}>SIMILARITIES</div>
                                  {analog.similarities.map((s, si) => (
                                    <div key={si} style={{ fontFamily: C.sans, fontSize: "11px", color: C.textMid, lineHeight: 1.5, marginBottom: "3px" }}>
                                      • {s}
                                    </div>
                                  ))}
                                </div>
                              )}
                              {analog.differences.length > 0 && (
                                <div>
                                  <div style={{ fontFamily: C.mono, fontSize: "8px", color: C.orange, letterSpacing: "0.1em", marginBottom: "6px" }}>KEY DIFFERENCES</div>
                                  {analog.differences.map((d, di) => (
                                    <div key={di} style={{ fontFamily: C.sans, fontSize: "11px", color: C.textMid, lineHeight: 1.5, marginBottom: "3px" }}>
                                      • {d}
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>

                            {/* Risks */}
                            {analog.historicalRisks.length > 0 && (
                              <div style={{ marginTop: "10px" }}>
                                <div style={{ fontFamily: C.mono, fontSize: "8px", color: C.red, letterSpacing: "0.1em", marginBottom: "6px" }}>HISTORICAL RISKS</div>
                                <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                                  {analog.historicalRisks.map((r, ri) => (
                                    <span key={ri} style={{
                                      fontFamily: C.mono, fontSize: "9px", color: C.red,
                                      background: "#FF2D5511", border: `1px solid ${C.redDim}`,
                                      borderRadius: "3px", padding: "2px 6px",
                                    }}>{r}</span>
                                  ))}
                                </div>
                              </div>
                            )}

                            {analog.typicalDuration && analog.typicalDuration !== "Unknown" && (
                              <div style={{ fontFamily: C.mono, fontSize: "9px", color: C.textDim, marginTop: "10px" }}>
                                <Clock size={10} style={{ display: "inline", marginRight: "4px" }} />
                                Typical duration: {analog.typicalDuration}
                              </div>
                            )}
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
            <div style={{ fontFamily: C.mono, fontSize: "9px", color: C.textDim, textAlign: "right" }}>
              Similarity scores computed via cosine + Euclidean distance across 6 pressure vectors
            </div>
          </div>
        ) : null}
      </Section>

      {/* ── Section 5: Historical Outcomes ── */}
      <Section
        title="Historical Outcomes"
        icon={<TrendingDown size={13} />}
        badge={d ? `N=${d.outcomeStats.sampleSize}` : undefined}
      >
        {isLoading ? (
          <div style={{ display: "flex", gap: "12px" }}>
            {[1,2,3,4].map(i => <Skeleton key={i} h={60} w="120px" />)}
          </div>
        ) : d ? (
          <div>
            {d.outcomeStats.sampleSize === 0 ? (
              <div style={{ fontFamily: C.mono, fontSize: "10px", color: C.textDim }}>
                Insufficient historical data to produce a statistically reliable result.
              </div>
            ) : (
              <>
                <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", marginBottom: "14px" }}>
                  {d.outcomeStats.avgDrawdownPct !== null && (
                    <StatPill
                      label="Avg Drawdown"
                      value={`${d.outcomeStats.avgDrawdownPct}%`}
                      color={C.red}
                    />
                  )}
                  {d.outcomeStats.avgRecoveryMonths !== null && (
                    <StatPill
                      label="Avg Recovery"
                      value={`${d.outcomeStats.avgRecoveryMonths}mo`}
                      color={C.yellow}
                    />
                  )}
                  {d.outcomeStats.drawdownRange && (
                    <StatPill
                      label="Drawdown Range"
                      value={`${d.outcomeStats.drawdownRange.min}% – ${d.outcomeStats.drawdownRange.max}%`}
                      color={C.orange}
                    />
                  )}
                  {d.outcomeStats.recoveryRange && (
                    <StatPill
                      label="Recovery Range"
                      value={`${d.outcomeStats.recoveryRange.min}–${d.outcomeStats.recoveryRange.max}mo`}
                      color={C.textMid}
                    />
                  )}
                </div>

                <div style={{
                  background: "#060A12", border: `1px solid ${C.border}`,
                  borderRadius: "4px", padding: "10px 12px",
                  fontFamily: C.sans, fontSize: "11px", color: C.textDim, lineHeight: 1.6,
                }}>
                  <Info size={10} style={{ display: "inline", marginRight: "6px", color: C.textDim }} />
                  {d.outcomeStats.disclaimer}
                </div>

                <div style={{ fontFamily: C.mono, fontSize: "9px", color: C.textDim, marginTop: "8px" }}>
                  Sample size: N={d.outcomeStats.sampleSize} analog periods
                </div>
              </>
            )}
          </div>
        ) : null}
      </Section>

      {/* ── Section 6: Historical Rarity Context ── */}
      <Section
        title="Historical Rarity Context"
        icon={<Database size={13} />}
        badge={d ? `N=${d.rarityContext.sampleSize}` : undefined}
      >
        {isLoading ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            <Skeleton h={16} /><Skeleton h={80} />
          </div>
        ) : d ? (
          <div>
            <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", marginBottom: "14px" }}>
              <StatPill label="Percentile" value={`${d.rarityContext.percentile}th`} color={levelColor(d.currentLevel)} />
              <StatPill label="Months at Level" value={d.rarityContext.monthsAtOrAbove} color={C.textMid} />
              <StatPill label="Frequency" value={`${d.rarityContext.frequencyPct}%`} color={C.textMid} />
              <StatPill label="Sample Size" value={`${d.rarityContext.sampleSize}mo`} color={C.textDim} />
            </div>

            <div style={{
              background: "#0A0E1A", border: `1px solid ${C.border}`,
              borderRadius: "4px", padding: "10px 12px", marginBottom: "12px",
            }}>
              <div style={{ fontFamily: C.raj, fontWeight: 700, fontSize: "14px", color: levelColor(d.currentLevel), marginBottom: "4px" }}>
                {d.rarityContext.rarityLabel}
              </div>
              <div style={{ fontFamily: C.sans, fontSize: "12px", color: C.textMid, lineHeight: 1.5 }}>
                The current reading of {d.currentPressure} is at the {d.rarityContext.percentile}th percentile of all {d.rarityContext.sampleSize} monthly readings from {d.rarityContext.dataStartMonth} to {d.rarityContext.dataEndMonth}. Readings at this level or higher have occurred in {d.rarityContext.frequencyPct}% of all historical months ({d.rarityContext.monthsAtOrAbove} of {d.rarityContext.sampleSize} months).
              </div>
            </div>

            {/* Regime distribution */}
            <div>
              <div style={{ fontFamily: C.mono, fontSize: "8px", color: C.textDim, letterSpacing: "0.1em", marginBottom: "8px" }}>HISTORICAL REGIME DISTRIBUTION</div>
              {d.rarityContext.regimeDistribution.map(r => (
                <div key={r.regime} style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "6px" }}>
                  <span style={{ fontFamily: C.mono, fontSize: "9px", color: C.textMid, width: "120px", flexShrink: 0 }}>{r.regime}</span>
                  <div style={{ flex: 1, height: "4px", background: "#1A2030", borderRadius: "2px", overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${r.pct}%`, background: C.cyan, borderRadius: "2px" }} />
                  </div>
                  <span style={{ fontFamily: C.mono, fontSize: "9px", color: C.textDim, width: "60px", textAlign: "right" }}>{r.pct}% ({r.count}mo)</span>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </Section>

      {/* ── Section 7: Institutional Interpretation ── */}
      <Section title="Institutional Interpretation" icon={<Info size={13} />}>
        {isLoading ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            <Skeleton h={16} /><Skeleton h={16} w="90%" /><Skeleton h={16} w="75%" />
          </div>
        ) : d ? (
          <div>
            <p style={{ fontFamily: C.sans, fontSize: "14px", color: C.text, lineHeight: 1.7, margin: "0 0 12px" }}>
              {d.institutionalInterpretation}
            </p>
            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <CopyButton text={d.institutionalInterpretation} />
            </div>
            <div style={{
              marginTop: "12px", background: "#060A12", border: `1px solid ${C.border}`,
              borderRadius: "4px", padding: "8px 12px",
              fontFamily: C.mono, fontSize: "9px", color: C.textDim, lineHeight: 1.6,
            }}>
              This interpretation is generated by an AI model based on historical data patterns. It does not constitute financial advice. Past market behavior does not predict future outcomes.
            </div>
          </div>
        ) : null}
      </Section>

      {/* ── Section 8: Data Transparency ── */}
      <Section title="Data Transparency" icon={<Database size={13} />}>
        {isLoading ? (
          <div style={{ display: "flex", gap: "12px" }}>
            {[1,2,3].map(i => <Skeleton key={i} h={50} w="150px" />)}
          </div>
        ) : d ? (
          <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
            <StatPill label="History Records" value={`${d.meta.pressureHistoryN} months`} color={C.cyan} />
            <StatPill label="Date Range" value={d.meta.pressureHistoryRange} color={C.textMid} />
            <StatPill label="Audit Runs" value={`${d.meta.pressureRunsN} runs`} color={C.textMid} />
            <StatPill label="Data Source" value={d.dataSource.toUpperCase()} color={d.dataSource === "live" ? C.green : C.orange} />
            <div style={{ display: "flex", flexDirection: "column", justifyContent: "center" }}>
              <div style={{ fontFamily: C.mono, fontSize: "9px", color: C.textDim, marginBottom: "4px" }}>COMPUTED AT</div>
              <div style={{ fontFamily: C.mono, fontSize: "10px", color: C.textMid }}>
                {new Date(d.meta.computedAt).toLocaleString()}
              </div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", justifyContent: "center" }}>
              <div style={{ fontFamily: C.mono, fontSize: "9px", color: C.textDim, marginBottom: "4px" }}>LAST DATA REFRESH</div>
              <div style={{ fontFamily: C.mono, fontSize: "10px", color: d.dataSource === "live" ? C.green : C.orange }}>
                {new Date(d.lastUpdated).toLocaleString()}
              </div>
            </div>
          </div>
        ) : null}
      </Section>

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
      `}</style>
    </div>
  );
}
