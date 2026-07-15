/**
 * HomepageBriefingPanel
 *
 * Renders three intelligence sections on the logged-in dashboard:
 *   1. Today's Market Story — LLM-generated institutional briefing
 *   2. Why Today Is Different — delta cards (pressure change, regime, biggest movers)
 *   3. History Says — percentile, analogs, streak, probabilities, confidence, sample size
 *
 * All data is sourced from the `pressure.getHomepageBriefing` tRPC procedure,
 * which computes everything from the live pressure engine + pressureHistory DB.
 * No hardcoded values.
 */

import { trpc } from "@/lib/trpc";
import { useLocation } from "wouter";

// ── Helpers ──────────────────────────────────────────────────────────────────

function colorForDirection(dir: "up" | "down" | "neutral", isRisk = false): string {
  if (dir === "neutral") return "#64748B";
  if (isRisk) return dir === "up" ? "#FF2D55" : "#00FF88";
  return dir === "up" ? "#00FF88" : "#FF2D55";
}

function DeltaBadge({ value, direction, isRisk = false }: { value: string | null; direction: "up" | "down" | "neutral"; isRisk?: boolean }) {
  if (!value) return null;
  const color = colorForDirection(direction, isRisk);
  const arrow = direction === "up" ? "▲" : direction === "down" ? "▼" : "—";
  return (
    <span style={{
      fontFamily: "'IBM Plex Mono', monospace",
      fontSize: "10px",
      color,
      background: `${color}15`,
      border: `1px solid ${color}30`,
      borderRadius: "3px",
      padding: "1px 5px",
      letterSpacing: "0.05em",
    }}>
      {arrow} {value}
    </span>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      fontFamily: "'IBM Plex Mono', monospace",
      fontSize: "9px",
      color: "#475569",
      letterSpacing: "0.18em",
      textTransform: "uppercase",
      marginBottom: "10px",
    }}>
      {children}
    </div>
  );
}

function ConfidencePill({ level }: { level: "high" | "medium" | "low" }) {
  const colors: Record<string, string> = { high: "#00FF88", medium: "#FFD700", low: "#FF9500" };
  const c = colors[level] ?? "#64748B";
  return (
    <span style={{
      fontFamily: "'IBM Plex Mono', monospace",
      fontSize: "8px",
      color: c,
      background: `${c}15`,
      border: `1px solid ${c}30`,
      borderRadius: "3px",
      padding: "1px 5px",
      letterSpacing: "0.1em",
      textTransform: "uppercase",
    }}>
      {level} confidence
    </span>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function HomepageBriefingPanel() {
  const { data, isLoading, error } = trpc.pressure.getHomepageBriefing.useQuery(undefined, {
    staleTime: 5 * 60 * 1000, // 5 min
    retry: 1,
  });
  const [, navigate] = useLocation();

  if (isLoading) {
    return (
      <div style={{
        background: "rgba(12,15,22,0.95)",
        border: "1px solid rgba(255,255,255,0.11)",
        borderRadius: "6px",
        padding: "20px",
        marginBottom: "10px",
        animation: "cinematic-reveal 0.5s cubic-bezier(0.23,1,0.32,1) both",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "12px" }}>
          <div style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#FFD700", animation: "blink-alert 1.5s ease-in-out infinite" }} />
          <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "9px", color: "#FFD700", letterSpacing: "0.18em", textTransform: "uppercase" }}>
            Generating Market Briefing…
          </span>
        </div>
        <div style={{ height: "60px", background: "rgba(255,255,255,0.03)", borderRadius: "4px", animation: "pulse 2s ease-in-out infinite" }} />
      </div>
    );
  }

  if (error || !data) {
    return null; // Fail silently — existing MarketSynthesisPanel still renders below
  }

  const { marketStory, whyTodayIsDifferent, historySays, metrics, timeline } = data;

  return (
    <div style={{ marginBottom: "10px", animation: "cinematic-reveal 0.5s cubic-bezier(0.23,1,0.32,1) both" }}>

      {/* ── Section 1: Today's Market Story ──────────────────────────────── */}
      <div style={{
        background: "linear-gradient(135deg, rgba(255,215,0,0.04) 0%, rgba(12,15,22,0.98) 60%)",
        border: "1px solid rgba(255,215,0,0.15)",
        borderLeft: "3px solid #FFD700",
        borderRadius: "6px",
        padding: "16px",
        marginBottom: "8px",
      }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "10px", flexWrap: "wrap", gap: "6px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <div style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#FFD700", boxShadow: "0 0 8px #FFD700", animation: "blink-alert 2s ease-in-out infinite" }} />
            <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "11px", color: "#FFD700", letterSpacing: "0.18em", textTransform: "uppercase", fontWeight: 600 }}>
              Today's Market Story
            </span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "9px", color: "#475569", letterSpacing: "0.08em" }}>
              {new Date(data.computedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} · {data.dataSource === "live" ? "LIVE DATA" : "CACHED"}
            </span>
            <button
              onClick={() => navigate("/app/pressure?tab=context")}
              style={{
                fontFamily: "'IBM Plex Mono', monospace",
                fontSize: "8px",
                color: "#FFD700",
                background: "rgba(255,215,0,0.08)",
                border: "1px solid rgba(255,215,0,0.25)",
                borderRadius: "3px",
                padding: "2px 7px",
                cursor: "pointer",
                letterSpacing: "0.1em",
                textTransform: "uppercase",
              }}
            >
              Full Analysis →
            </button>
          </div>
        </div>

        <p style={{
          fontFamily: "'IBM Plex Sans', sans-serif",
          fontSize: "13px",
          color: "#CBD5E1",
          lineHeight: 1.65,
          margin: 0,
          marginBottom: "12px",
        }}>
          {marketStory}
        </p>

        {/* Metric strip */}
        <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
          {[
            { label: "PRESSURE", value: `${metrics.pressureIndex.current}/100`, color: metrics.pressureIndex.current >= 65 ? "#FF2D55" : metrics.pressureIndex.current >= 45 ? "#FF9500" : "#00FF88" },
            { label: "REGIME", value: metrics.regime, color: "#00E5FF" },
            { label: "BULL PROB", value: `${metrics.bullProbability}%`, color: "#00FF88" },
            { label: "BEAR PROB", value: `${metrics.bearProbability}%`, color: "#FF2D55" },
          ].map(m => (
            <div key={m.label} style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
              <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "8px", color: "#475569", letterSpacing: "0.12em" }}>{m.label}</span>
              <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "12px", color: m.color, fontWeight: 600 }}>{m.value}</span>
            </div>
          ))}
          {metrics.pressureIndex.todayChange !== null && (
            <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
              <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "8px", color: "#475569", letterSpacing: "0.12em" }}>1D CHANGE</span>
              <DeltaBadge
                value={`${metrics.pressureIndex.todayChange > 0 ? "+" : ""}${metrics.pressureIndex.todayChange.toFixed(1)}`}
                direction={metrics.pressureIndex.todayChange > 0.5 ? "up" : metrics.pressureIndex.todayChange < -0.5 ? "down" : "neutral"}
                isRisk
              />
            </div>
          )}
          {metrics.pressureIndex.historicalPercentile !== null && (
            <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
              <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "8px", color: "#475569", letterSpacing: "0.12em" }}>PERCENTILE</span>
              <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "12px", color: "#C084FC", fontWeight: 600 }}>{metrics.pressureIndex.historicalPercentile}th</span>
            </div>
          )}
        </div>
      </div>

      {/* ── Section 2: Why Today Is Different ────────────────────────────── */}
      {whyTodayIsDifferent && (
        <div style={{
          background: "rgba(12,15,22,0.95)",
          border: "1px solid rgba(255,255,255,0.11)",
          borderRadius: "6px",
          padding: "14px 16px",
          marginBottom: "8px",
        }}>
          <SectionLabel>Why Today Is Different</SectionLabel>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: "8px" }}>
            {[
              whyTodayIsDifferent.pressureDelta,
              whyTodayIsDifferent.regimeDelta,
              whyTodayIsDifferent.bullProbDelta,
              whyTodayIsDifferent.bearProbDelta,
              whyTodayIsDifferent.biggestImproving,
              whyTodayIsDifferent.biggestDeteriorating,
            ].filter(Boolean).map((card, i) => {
              if (!card) return null;
              const c = card as typeof whyTodayIsDifferent.pressureDelta;
              const color = colorForDirection(c.direction, true);
              return (
                <div key={i} style={{
                  background: `${color}08`,
                  border: `1px solid ${color}20`,
                  borderRadius: "4px",
                  padding: "10px 12px",
                }}>
                  <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "8px", color: "#475569", letterSpacing: "0.12em", marginBottom: "4px", textTransform: "uppercase" }}>
                    {c.label}
                  </div>
                  <div style={{ display: "flex", alignItems: "baseline", gap: "6px", flexWrap: "wrap" }}>
                    <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "14px", color: "#E2E8F0", fontWeight: 600 }}>
                      {c.current}
                    </span>
                    {c.change && (
                      <DeltaBadge value={c.change} direction={c.direction} isRisk />
                    )}
                  </div>
                  {c.significance === "high" && (
                    <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "8px", color: color, marginTop: "3px", letterSpacing: "0.08em" }}>
                      NOTABLE SHIFT
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Institutional interpretation */}
          {metrics.pressureIndex.institutionalInterpretation && (
            <div style={{
              marginTop: "10px",
              padding: "10px 12px",
              background: "rgba(0,212,255,0.04)",
              border: "1px solid rgba(0,229,255,0.20)",
              borderRadius: "4px",
            }}>
              <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "8px", color: "#00E5FF", letterSpacing: "0.12em", marginBottom: "5px", textTransform: "uppercase" }}>
                Institutional Interpretation
              </div>
              <p style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: "12px", color: "#94A3B8", lineHeight: 1.6, margin: 0 }}>
                {metrics.pressureIndex.institutionalInterpretation}
              </p>
            </div>
          )}
        </div>
      )}

      {/* ── Section 3: History Says ───────────────────────────────────────── */}
      {historySays && (
        <div style={{
          background: "rgba(12,15,22,0.95)",
          border: "1px solid rgba(255,255,255,0.11)",
          borderRadius: "6px",
          padding: "14px 16px",
          marginBottom: "8px",
        }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "10px", flexWrap: "wrap", gap: "6px" }}>
            <SectionLabel>History Says</SectionLabel>
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <ConfidencePill level={historySays.confidenceLevel === "insufficient" ? "low" : historySays.confidenceLevel} />
              <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "8px", color: "#475569", letterSpacing: "0.08em" }}>
                N={historySays.historicalSampleSize} · {historySays.historicalDateRange}
              </span>
            </div>
          </div>

          {/* Percentile + streak row */}
          <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", marginBottom: "12px" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
              <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "8px", color: "#475569", letterSpacing: "0.12em" }}>HISTORICAL PERCENTILE</span>
              <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "16px", color: "#C084FC", fontWeight: 700 }}>
                {historySays.historicalPercentile}th
              </span>
              <span style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: "10px", color: "#64748B" }}>
                {historySays.percentileLabel}
              </span>
            </div>
            <div style={{ width: "1px", background: "rgba(255,255,255,0.11)", alignSelf: "stretch" }} />
            <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
              <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "8px", color: "#475569", letterSpacing: "0.12em" }}>REGIME DURATION</span>
              <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "16px", color: "#00E5FF", fontWeight: 700 }}>
                {historySays.currentRegimeDuration}mo
              </span>
              <span style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: "10px", color: "#64748B" }}>in current regime</span>
            </div>
            {historySays.consecutiveElevatedStreak > 0 && (
              <>
                <div style={{ width: "1px", background: "rgba(255,255,255,0.11)", alignSelf: "stretch" }} />
                <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                  <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "8px", color: "#475569", letterSpacing: "0.12em" }}>ELEVATED STREAK</span>
                  <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "16px", color: "#FF9500", fontWeight: 700 }}>
                    {historySays.consecutiveElevatedStreak}mo
                  </span>
                  <span style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: "10px", color: "#64748B" }}>above 45/100</span>
                </div>
              </>
            )}
          </div>

          {/* Plain English summary */}
          {historySays.plainEnglishSummary && (
            <p style={{
              fontFamily: "'IBM Plex Sans', sans-serif",
              fontSize: "12px",
              color: "#94A3B8",
              lineHeight: 1.6,
              margin: "0 0 12px 0",
              padding: "8px 10px",
              background: "rgba(255,255,255,0.03)",
              borderRadius: "4px",
              borderLeft: "2px solid rgba(192,132,252,0.4)",
            }}>
              {historySays.plainEnglishSummary}
            </p>
          )}

          {/* Closest analogs */}
          {historySays.closestAnalogs.length > 0 && (
            <div style={{ marginBottom: "12px" }}>
              <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "8px", color: "#475569", letterSpacing: "0.12em", marginBottom: "6px", textTransform: "uppercase" }}>
                Closest Historical Analogs
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                {historySays.closestAnalogs.map((analog, i) => (
                  <div key={i} style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: "10px",
                    padding: "8px 10px",
                    background: "rgba(255,255,255,0.02)",
                    border: "1px solid rgba(255,255,255,0.09)",
                    borderRadius: "4px",
                  }}>
                    <div style={{ minWidth: "36px", textAlign: "center" }}>
                      <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "10px", color: "#00E5FF", fontWeight: 600 }}>
                        {analog.similarity}%
                      </div>
                      <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "7px", color: "#475569", letterSpacing: "0.08em" }}>SIM</div>
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "10px", color: "#E2E8F0", fontWeight: 600, marginBottom: "2px" }}>
                        {analog.label} ({analog.year})
                      </div>
                      <div style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: "11px", color: "#64748B", lineHeight: 1.5 }}>
                        {analog.outcome}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Probability grid */}
          {(historySays.historicalBullContinuationRate !== null || historySays.historicalCorrectionProbability !== null) && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))", gap: "6px", marginBottom: "10px" }}>
              {[
                { label: "Bull Continuation", value: historySays.historicalBullContinuationRate, color: "#00FF88" },
                { label: "Correction Risk", value: historySays.historicalCorrectionProbability, color: "#FF2D55" },
                { label: "Elevated Volatility", value: historySays.historicalElevatedVolatilityRate, color: "#FF9500" },
                { label: "Recovery Probability", value: historySays.historicalRecoveryProbability, color: "#00E5FF" },
              ].filter(p => p.value !== null).map(p => (
                <div key={p.label} style={{
                  background: `${p.color}08`,
                  border: `1px solid ${p.color}20`,
                  borderRadius: "4px",
                  padding: "8px 10px",
                }}>
                  <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "7px", color: "#475569", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: "3px" }}>
                    {p.label}
                  </div>
                  <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "14px", color: p.color, fontWeight: 700 }}>
                    {p.value}%
                  </div>
                  {/* Mini bar */}
                  <div style={{ height: "2px", background: "rgba(255,255,255,0.11)", borderRadius: "1px", marginTop: "5px" }}>
                    <div style={{ height: "100%", width: `${p.value}%`, background: p.color, borderRadius: "1px", transition: "width 1s cubic-bezier(0.23,1,0.32,1)" }} />
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Disclaimer */}
          <div style={{
            fontFamily: "'IBM Plex Sans', sans-serif",
            fontSize: "10px",
            color: "#334155",
            lineHeight: 1.5,
            padding: "6px 8px",
            background: "rgba(255,255,255,0.02)",
            borderRadius: "3px",
          }}>
            Historical analysis is for informational purposes only. Past market conditions do not guarantee future outcomes. Sample size: N={historySays.historicalSampleSize} months ({historySays.historicalDateRange}).
          </div>
        </div>
      )}

      {/* ── Section 4: Market Evolution Timeline ─────────────────────────── */}
      {timeline && timeline.length >= 3 && (
        <div style={{
          background: "rgba(12,15,22,0.95)",
          border: "1px solid rgba(255,255,255,0.11)",
          borderRadius: "6px",
          padding: "14px 16px",
          marginBottom: "8px",
        }}>
          <SectionLabel>Market Evolution Timeline</SectionLabel>
          <div style={{ display: "flex", alignItems: "flex-end", gap: "3px", height: "40px" }}>
            {timeline.map((point, i) => {
              const isLatest = i === timeline.length - 1;
              const pct = Math.max(4, Math.min(100, point.pressure));
              const color = point.pressure >= 65 ? "#FF2D55" : point.pressure >= 45 ? "#FF9500" : "#00FF88";
              return (
                <div
                  key={i}
                  title={`${point.label}: ${point.pressure}/100`}
                  style={{
                    flex: 1,
                    height: `${pct}%`,
                    background: isLatest ? color : `${color}55`,
                    borderRadius: "2px 2px 0 0",
                    transition: "height 0.8s cubic-bezier(0.23,1,0.32,1)",
                    boxShadow: isLatest ? `0 0 6px ${color}66` : "none",
                    cursor: "default",
                  }}
                />
              );
            })}
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: "4px" }}>
            <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "8px", color: "#334155" }}>
              {timeline[0]?.label}
            </span>
            <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "8px", color: "#64748B" }}>
              {metrics.pressureIndex.streak > 1 ? `${metrics.pressureIndex.streak}-run ${metrics.pressureIndex.streakDirection} streak` : ""}
            </span>
            <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "8px", color: "#334155" }}>
              Now
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
