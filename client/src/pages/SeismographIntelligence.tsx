/**
 * FAULTLINE Seismograph Intelligence
 *
 * Faithful reproduction of the approved v1 promotional video:
 * - Exactly 3 panels: MARKET STATE (left-top), ACTIVE PATTERNS (left-bottom),
 *   TRANSITION PROBABILITIES (right, full height)
 * - 60/40 left/right column split
 * - Large negative space, cinematic, calm, institutional
 * - AI briefing first, diagnostics progressively disclosed
 * - Color hierarchy: cyan=interface, white=info, green=improving,
 *   amber=caution, orange=elevated, red=critical only
 */
import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { Link } from "wouter";

// ─── Color helpers ────────────────────────────────────────────────────────────
function pressureColor(score: number): string {
  if (score >= 80) return "#ef4444";
  if (score >= 65) return "#f97316";
  if (score >= 45) return "#eab308";
  if (score >= 30) return "#84cc16";
  return "#22c55e";
}

function stressColor(level: string): string {
  if (level === "Crisis") return "#ef4444";
  if (level === "High") return "#f97316";
  if (level === "Elevated") return "#eab308";
  return "#22c55e";
}

function regimeLabel(r: string): string {
  const map: Record<string, string> = {
    bull: "Bull Market", bear: "Bear Market", neutral: "Neutral",
    low: "Low Stress", elevated: "Elevated Stress", high: "High Stress",
    crisis: "Crisis", late_cycle: "Late Cycle Stress", expansion: "Expansion",
    contraction: "Contraction", stagflation: "Stagflation", recovery: "Recovery",
  };
  return map[r?.toLowerCase()] ?? r?.replace(/_/g, " ").toUpperCase() ?? "UNKNOWN";
}

function stateLabel(level: string): string {
  if (level === "Crisis") return "CRITICAL";
  if (level === "High") return "ELEVATED";
  if (level === "Elevated") return "CAUTIOUS";
  return "STABLE";
}

// ─── Blinking dot ─────────────────────────────────────────────────────────────
function BlinkDot({ color }: { color: string }) {
  return (
    <span
      style={{
        display: "inline-block", width: 6, height: 6, borderRadius: "50%",
        background: color, boxShadow: `0 0 6px ${color}`,
        animation: "blink 2s ease-in-out infinite",
      }}
    />
  );
}

// ─── Seismograph waveform ─────────────────────────────────────────────────────
function Waveform({ confidence, daysActive, color }: { confidence: number; daysActive: number; color: string }) {
  const bars = 32;
  const heights = Array.from({ length: bars }, (_, i) => {
    const progress = i / bars;
    const base = 8 + progress * confidence * 0.55;
    const noise = Math.sin(i * 2.3 + daysActive * 0.1) * 12 + Math.cos(i * 1.7 + 0.5) * 8;
    return Math.max(4, Math.min(90, base + noise));
  });
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 1.5, height: 40 }}>
      {heights.map((h, i) => (
        <div
          key={i}
          style={{
            flex: 1, height: `${h}%`, background: color,
            opacity: 0.5 + (i / bars) * 0.5,
            boxShadow: i > bars * 0.7 ? `0 0 3px ${color}` : "none",
            borderRadius: 1,
          }}
        />
      ))}
    </div>
  );
}

// ─── Probability bar ──────────────────────────────────────────────────────────
function ProbBar({ label, pct, color }: { label: string; pct: number; color: string }) {
  const [animated, setAnimated] = useState(0);
  useEffect(() => {
    const t = setTimeout(() => setAnimated(pct), 300);
    return () => clearTimeout(t);
  }, [pct]);
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 5 }}>
        <span style={{ color: "#C8D8E8", fontFamily: "monospace", fontSize: 11, letterSpacing: "0.05em" }}>{label}</span>
        <span style={{ color, fontFamily: "monospace", fontSize: 14, fontWeight: "bold", textShadow: `0 0 8px ${color}60` }}>{pct}%</span>
      </div>
      <div style={{ height: 3, background: "rgba(0,212,255,0.08)", borderRadius: 2 }}>
        <div
          style={{
            height: "100%", borderRadius: 2,
            width: `${animated}%`,
            background: color,
            boxShadow: `0 0 6px ${color}60`,
            transition: "width 1s cubic-bezier(0.23,1,0.32,1)",
          }}
        />
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function SeismographIntelligence() {
  const { data: intel, isLoading, error, refetch } = trpc.seismograph.getUnifiedIntelligence.useQuery(
    undefined,
    { staleTime: 5 * 60 * 1000, refetchOnWindowFocus: false }
  );
  const seedMutation = trpc.seismograph.seedNow.useMutation({ onSuccess: () => refetch() });
  const [horizonTab, setHorizonTab] = useState<"1M" | "3M" | "6M" | "12M">("1M");
  const [expandedPattern, setExpandedPattern] = useState<number | null>(null);
  const [showDiagnostics, setShowDiagnostics] = useState(false);
  const [now, setNow] = useState(new Date());
  useEffect(() => { const t = setInterval(() => setNow(new Date()), 1000); return () => clearInterval(t); }, []);

  // ── Loading ──────────────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#050608", fontFamily: "monospace" }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ color: "#00D4FF", fontSize: 11, letterSpacing: "0.4em", marginBottom: 24 }}>FAULTLINE SEISMOGRAPH™</div>
          <div style={{ color: "rgba(0,212,255,0.4)", fontSize: 10, letterSpacing: "0.3em", marginBottom: 20 }}>INITIALIZING INTELLIGENCE ENGINES</div>
          <div style={{ display: "flex", justifyContent: "center", gap: 4 }}>
            {[0,1,2,3,4].map(i => (
              <div key={i} style={{ width: 3, borderRadius: 2, background: "#00D4FF", animation: `pulse 1.2s ease-in-out ${i * 0.15}s infinite alternate`, height: 8 + i * 5 }} />
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ── Error ────────────────────────────────────────────────────────────────────
  if (error || !intel) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#050608", fontFamily: "monospace" }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ color: "rgba(0,212,255,0.5)", fontSize: 10, letterSpacing: "0.3em", marginBottom: 16 }}>INTELLIGENCE ENGINE OFFLINE</div>
          <button
            onClick={() => seedMutation.mutate()}
            disabled={seedMutation.isPending}
            style={{ border: "1px solid rgba(0,212,255,0.4)", color: "#00D4FF", background: "transparent", padding: "8px 20px", fontFamily: "monospace", fontSize: 10, letterSpacing: "0.2em", cursor: "pointer" }}
          >
            {seedMutation.isPending ? "INITIALIZING..." : "INITIALIZE ENGINE"}
          </button>
        </div>
      </div>
    );
  }

  // ── Derived data ─────────────────────────────────────────────────────────────
  const score = intel.currentScore;
  const scoreColor = pressureColor(score);
  const stressLvl = intel.currentStressLevel;
  const stressC = stressColor(stressLvl);
  const state = stateLabel(stressLvl);
  const patterns = intel.activePatterns ?? [];
  const patternColors = ["#f97316", "#eab308", "#00D4FF"];
  const patternRiskLabels = ["HIGH", "MODERATE", "WATCH"];
  const topAnalog = intel.topAnalog;
  const tp = intel.transitionProbabilities;

  // Evidence consensus score (0–10 scale)
  const evidenceScore = ((score / 100) * 10).toFixed(1);

  // Transition probabilities normalized to 100 for selected horizon
  const horizonMultipliers: Record<string, number> = { "1M": 0.6, "3M": 1.0, "6M": 1.3, "12M": 1.6 };
  const hm = horizonMultipliers[horizonTab] ?? 1;
  const rawProbs = [
    { label: "Deterioration (Elevated Stress)", pct: Math.round(tp.transitionToElevated * hm), color: "#eab308" },
    { label: "Sideways / Choppy (Range-Bound)", pct: Math.round(tp.remainInRegime * hm * 0.8), color: "#94a3b8" },
    { label: "Stabilization (Base-Building)", pct: Math.round(tp.transitionToLow * hm), color: "#00D4FF" },
    { label: "Improvement (Early Expansion)", pct: Math.round(tp.transitionToLow * hm * 0.5), color: "#22c55e" },
    { label: "Systemic Event (Tail Risk)", pct: Math.round(tp.transitionToCrisis * hm), color: "#ef4444" },
  ];
  const total = rawProbs.reduce((s, p) => s + p.pct, 0);
  const transProbs = rawProbs.map(p => ({ ...p, pct: Math.round((p.pct / (total || 1)) * 100) }));

  const utcTime = now.toISOString().replace("T", " ").slice(0, 19) + " UTC";

  return (
    <div style={{ minHeight: "100vh", background: "#050608", fontFamily: "monospace", color: "#F4F8FF", display: "flex", flexDirection: "column" }}>

      {/* ── Keyframes ── */}
      <style>{`
        @keyframes blink { 0%,100%{opacity:1} 50%{opacity:0.3} }
        @keyframes pulse { from{opacity:0.4} to{opacity:1} }
        @keyframes fadeIn { from{opacity:0;transform:translateY(4px)} to{opacity:1;transform:translateY(0)} }
      `}</style>

      {/* ── Header bar ── */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "10px 24px",
        borderBottom: "1px solid rgba(0,212,255,0.12)",
        background: "rgba(5,6,8,0.95)",
        flexShrink: 0,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <span style={{ color: "#00D4FF", fontSize: 11, letterSpacing: "0.35em", fontWeight: "bold" }}>FAULTLINE SEISMOGRAPH™</span>
          <span style={{ color: "rgba(0,212,255,0.35)", fontSize: 9, letterSpacing: "0.2em" }}>SEISMOGRAPH INTELLIGENCE DASHBOARD</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <BlinkDot color="#22c55e" />
            <span style={{ color: "#22c55e", fontSize: 9, letterSpacing: "0.2em" }}>SYSTEM STATUS ONLINE</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <BlinkDot color="#22c55e" />
            <span style={{ color: "#22c55e", fontSize: 9, letterSpacing: "0.2em" }}>DATA FEED LIVE</span>
          </div>
          <span style={{ color: "rgba(0,212,255,0.35)", fontSize: 9 }}>LAST UPDATE: {utcTime}</span>
          <button
            onClick={() => refetch()}
            style={{ border: "1px solid rgba(0,212,255,0.25)", color: "rgba(0,212,255,0.6)", background: "transparent", padding: "3px 10px", fontFamily: "monospace", fontSize: 9, letterSpacing: "0.15em", cursor: "pointer" }}
          >
            ↺ REFRESH
          </button>
        </div>
      </div>

      {/* ── Main content ── */}
      <div style={{ flex: 1, padding: "20px 24px", display: "grid", gridTemplateColumns: "3fr 2fr", gap: 16, minHeight: 0 }}>

        {/* ── LEFT COLUMN (60%) ── */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

          {/* ── MARKET STATE panel ── */}
          <div style={{
            border: "1px solid rgba(0,212,255,0.18)",
            background: "rgba(0,212,255,0.02)",
            padding: "20px 24px",
            animation: "fadeIn 0.4s ease-out",
          }}>
            {/* Panel header */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ color: "rgba(0,212,255,0.5)", fontSize: 9 }}>◈</span>
                <span style={{ color: "rgba(0,212,255,0.7)", fontSize: 9, letterSpacing: "0.25em" }}>MARKET STATE</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <BlinkDot color={stressC} />
                <span style={{ color: stressC, fontSize: 9, letterSpacing: "0.15em" }}>{stressLvl.toUpperCase()}</span>
              </div>
            </div>

            {/* Primary state + score */}
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 20 }}>
              <div>
                <div style={{ color: "rgba(0,212,255,0.4)", fontSize: 9, letterSpacing: "0.2em", marginBottom: 6 }}>CURRENT STATE:</div>
                <div style={{
                  color: stressC, fontSize: 32, fontWeight: "bold", letterSpacing: "0.15em",
                  textShadow: `0 0 30px ${stressC}50`,
                  lineHeight: 1,
                }}>
                  {state}
                </div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ color: "rgba(0,212,255,0.4)", fontSize: 9, letterSpacing: "0.2em", marginBottom: 4 }}>PRESSURE SCORE</div>
                <div style={{
                  color: scoreColor, fontSize: 44, fontWeight: "bold",
                  textShadow: `0 0 40px ${scoreColor}60`,
                  lineHeight: 1,
                }}>
                  {score}
                </div>
                <div style={{ color: "rgba(0,212,255,0.3)", fontSize: 9 }}>/ 100</div>
              </div>
            </div>

            {/* Evidence consensus bar */}
            <div style={{ marginBottom: 20 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
                <span style={{ color: "rgba(0,212,255,0.5)", fontSize: 9, letterSpacing: "0.2em" }}>EVIDENCE CONSENSUS:</span>
                <span style={{ color: stressC, fontSize: 16, fontWeight: "bold" }}>{evidenceScore}<span style={{ fontSize: 10, color: "rgba(0,212,255,0.4)" }}>/10</span></span>
              </div>
              <div style={{ height: 3, background: "rgba(0,212,255,0.08)", borderRadius: 2, position: "relative" }}>
                <div style={{
                  height: "100%", borderRadius: 2,
                  width: `${(parseFloat(evidenceScore) / 10) * 100}%`,
                  background: `linear-gradient(90deg, #22c55e 0%, #eab308 50%, ${stressC} 100%)`,
                  boxShadow: `0 0 8px ${stressC}50`,
                  transition: "width 1.2s cubic-bezier(0.23,1,0.32,1)",
                }} />
                {/* Marker */}
                <div style={{
                  position: "absolute", top: -3, bottom: -3,
                  left: `${(parseFloat(evidenceScore) / 10) * 100}%`,
                  width: 2, background: "#fff", transform: "translateX(-50%)",
                  boxShadow: "0 0 4px rgba(255,255,255,0.8)",
                }} />
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
                {[0, 2.5, 5, 7.5, 10].map(v => (
                  <span key={v} style={{ color: "rgba(0,212,255,0.25)", fontSize: 8 }}>{v}</span>
                ))}
              </div>
            </div>

            {/* Regime + Analog row */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 20 }}>
              <div>
                <div style={{ color: "rgba(0,212,255,0.4)", fontSize: 9, letterSpacing: "0.15em", marginBottom: 4 }}>ACTIVE REGIME:</div>
                <div style={{ color: "#00D4FF", fontSize: 11, fontWeight: "bold", letterSpacing: "0.05em" }}>
                  {regimeLabel(intel.currentRegime)}
                </div>
              </div>
              {topAnalog && (
                <div>
                  <div style={{ color: "rgba(0,212,255,0.4)", fontSize: 9, letterSpacing: "0.15em", marginBottom: 4 }}>HISTORICAL ANALOG:</div>
                  <div style={{ color: "#00D4FF", fontSize: 11, fontWeight: "bold" }}>
                    {topAnalog.period}
                    <span style={{ color: "rgba(0,212,255,0.5)", fontSize: 9, marginLeft: 6 }}>— {topAnalog.similarity}% similarity</span>
                  </div>
                </div>
              )}
            </div>

            {/* AI Briefing — the intelligence layer */}
            {intel.todayStory && (
              <div style={{
                borderTop: "1px solid rgba(0,212,255,0.1)",
                paddingTop: 16,
                marginBottom: 16,
              }}>
                <div style={{ color: "rgba(0,212,255,0.4)", fontSize: 9, letterSpacing: "0.2em", marginBottom: 8 }}>INTELLIGENCE BRIEFING:</div>
                <p style={{ color: "#C8D8E8", fontSize: 11, lineHeight: 1.7, margin: 0 }}>{intel.todayStory}</p>
              </div>
            )}

            {/* Why this score */}
            {intel.whyThisScore && (
              <div style={{ marginBottom: 16 }}>
                <div style={{ color: "rgba(0,212,255,0.4)", fontSize: 9, letterSpacing: "0.2em", marginBottom: 6 }}>WHY THIS SCORE:</div>
                <p style={{ color: "rgba(200,216,232,0.7)", fontSize: 10, lineHeight: 1.6, margin: 0 }}>{intel.whyThisScore}</p>
              </div>
            )}

            {/* Key developments */}
            {intel.keyDevelopments?.length > 0 && (
              <div style={{ borderTop: "1px solid rgba(0,212,255,0.08)", paddingTop: 12 }}>
                {intel.keyDevelopments.slice(0, 3).map((d, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 8, marginBottom: 6 }}>
                    <span style={{ color: "#00D4FF", fontSize: 9, marginTop: 1, flexShrink: 0 }}>▸</span>
                    <span style={{ color: "rgba(200,216,232,0.65)", fontSize: 10, lineHeight: 1.5 }}>{d}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Progressive disclosure toggle */}
            <div style={{ borderTop: "1px solid rgba(0,212,255,0.08)", paddingTop: 12, marginTop: 4 }}>
              <button
                onClick={() => setShowDiagnostics(!showDiagnostics)}
                style={{
                  background: "transparent", border: "none", color: "rgba(0,212,255,0.45)",
                  fontSize: 9, letterSpacing: "0.2em", cursor: "pointer", padding: 0,
                  display: "flex", alignItems: "center", gap: 6,
                }}
              >
                <span>{showDiagnostics ? "▾" : "▸"}</span>
                <span>{showDiagnostics ? "HIDE DIAGNOSTICS" : "VIEW SUPPORTING DIAGNOSTICS"}</span>
              </button>

              {showDiagnostics && (
                <div style={{ marginTop: 16, animation: "fadeIn 0.3s ease-out" }}>
                  {/* Evidence families */}
                  <div style={{ marginBottom: 16 }}>
                    <div style={{ color: "rgba(0,212,255,0.4)", fontSize: 9, letterSpacing: "0.2em", marginBottom: 10 }}>INTELLIGENCE ENGINE BREAKDOWN:</div>
                    {intel.evidenceFamilies?.slice(0, 6).map((ef, i) => {
                      const efColor = ef.signal === "bullish" || ef.signal === "recovering" ? "#22c55e"
                        : ef.signal === "bearish" || ef.signal === "stressed" ? "#f97316" : "#eab308";
                      return (
                        <div key={i} style={{ marginBottom: 10 }}>
                          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                            <span style={{ color: "#94a3b8", fontSize: 9 }}>{ef.name}</span>
                            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                              <span style={{ color: efColor, fontSize: 9, fontWeight: "bold" }}>{ef.strength}/100</span>
                              <span style={{
                                padding: "1px 5px", fontSize: 8,
                                background: `${efColor}15`, color: efColor,
                                border: `1px solid ${efColor}30`,
                              }}>{ef.signal.toUpperCase()}</span>
                            </div>
                          </div>
                          <div style={{ height: 2, background: "rgba(0,212,255,0.06)", borderRadius: 1 }}>
                            <div style={{ height: "100%", borderRadius: 1, width: `${ef.strength}%`, background: efColor }} />
                          </div>
                        </div>
                      );
                    })}
                    <div style={{ color: "rgba(0,212,255,0.35)", fontSize: 9, marginTop: 6 }}>
                      CONSENSUS: <span style={{ color: "#C084FC", fontWeight: "bold" }}>{intel.evidenceConsensus?.toUpperCase()}</span>
                      {intel.enginesAgreeing?.length > 0 && <span style={{ color: "rgba(0,212,255,0.3)" }}> · {intel.enginesAgreeing.length} ENGINES AGREEING</span>}
                    </div>
                  </div>

                  {/* Historical analogs */}
                  {intel.analogs?.length > 0 && (
                    <div>
                      <div style={{ color: "rgba(0,212,255,0.4)", fontSize: 9, letterSpacing: "0.2em", marginBottom: 10 }}>HISTORICAL ANALOGS:</div>
                      {intel.analogs.slice(0, 3).map((a, i) => (
                        <div key={i} style={{
                          padding: "10px 12px", marginBottom: 8,
                          border: `1px solid ${i === 0 ? "rgba(245,158,11,0.3)" : "rgba(0,212,255,0.1)"}`,
                          background: i === 0 ? "rgba(245,158,11,0.04)" : "transparent",
                        }}>
                          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                            <span style={{ color: i === 0 ? "#f59e0b" : "#00D4FF", fontSize: 10, fontWeight: "bold" }}>{a.period}</span>
                            <span style={{ color: "#f59e0b", fontSize: 9 }}>{a.similarity}% MATCH</span>
                          </div>
                          <div style={{ color: "#94a3b8", fontSize: 9, lineHeight: 1.5, marginBottom: 4 }}>{a.description}</div>
                          {a.resolution && (
                            <div style={{ color: "rgba(0,212,255,0.4)", fontSize: 9 }}>OUTCOME: {a.resolution}</div>
                          )}
                          {a.avgReturn3m !== null && a.avgReturn3m !== undefined && (
                            <div style={{ display: "flex", gap: 12, marginTop: 6 }}>
                              {[{ l: "3M", v: a.avgReturn3m }, { l: "6M", v: a.avgReturn6m }, { l: "12M", v: a.avgReturn12m }]
                                .filter(x => x.v !== undefined)
                                .map(m => (
                                  <div key={m.l}>
                                    <div style={{ color: "rgba(0,212,255,0.3)", fontSize: 8 }}>{m.l}</div>
                                    <div style={{ color: (m.v ?? 0) >= 0 ? "#22c55e" : "#f97316", fontSize: 10, fontWeight: "bold" }}>
                                      {(m.v ?? 0) >= 0 ? "+" : ""}{(m.v ?? 0).toFixed(1)}%
                                    </div>
                                  </div>
                                ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* ── ACTIVE PATTERNS panel ── */}
          <div style={{
            border: "1px solid rgba(0,212,255,0.18)",
            background: "rgba(0,212,255,0.02)",
            padding: "20px 24px",
            animation: "fadeIn 0.5s ease-out",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 20 }}>
              <span style={{ color: "rgba(0,212,255,0.5)", fontSize: 9 }}>◎</span>
              <span style={{ color: "rgba(0,212,255,0.7)", fontSize: 9, letterSpacing: "0.25em" }}>ACTIVE PATTERNS</span>
            </div>

            {patterns.length === 0 ? (
              <div style={{ color: "rgba(0,212,255,0.25)", fontSize: 10, textAlign: "center", padding: "20px 0" }}>
                NO ACTIVE PATTERNS DETECTED
              </div>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: `repeat(${Math.min(patterns.length, 3)}, 1fr)`, gap: 20 }}>
                {patterns.slice(0, 3).map((p, i) => {
                  const pColor = patternColors[i] ?? "#00D4FF";
                  const riskLabel = patternRiskLabels[i] ?? "WATCH";
                  const riskColor = riskLabel === "HIGH" ? "#f97316" : riskLabel === "MODERATE" ? "#eab308" : "#00D4FF";
                  return (
                    <div
                      key={i}
                      onClick={() => setExpandedPattern(expandedPattern === i ? null : i)}
                      style={{ cursor: "pointer" }}
                    >
                      {/* Pattern name + days */}
                      <div style={{ marginBottom: 8 }}>
                        <div style={{ color: pColor, fontSize: 10, fontWeight: "bold", marginBottom: 2 }}>{p.name}</div>
                        <div style={{ color: "rgba(0,212,255,0.4)", fontSize: 9 }}>Day {p.daysActive}</div>
                      </div>

                      {/* Waveform */}
                      <Waveform confidence={p.confidence} daysActive={p.daysActive} color={pColor} />

                      {/* Signal quality + risk level */}
                      <div style={{ marginTop: 8 }}>
                        <div style={{ color: "rgba(0,212,255,0.4)", fontSize: 8, letterSpacing: "0.15em", marginBottom: 4 }}>PATTERN STRENGTH</div>
                        <div style={{ height: 2, background: "rgba(0,212,255,0.08)", borderRadius: 1, marginBottom: 6 }}>
                          <div style={{ height: "100%", borderRadius: 1, width: `${p.confidence}%`, background: pColor, boxShadow: `0 0 4px ${pColor}60` }} />
                        </div>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <span style={{ color: "rgba(0,212,255,0.4)", fontSize: 8, letterSpacing: "0.1em" }}>SIGNAL QUALITY</span>
                          <span style={{
                            padding: "1px 6px", fontSize: 8, fontWeight: "bold", letterSpacing: "0.1em",
                            border: `1px solid ${riskColor}50`, color: riskColor, background: `${riskColor}10`,
                          }}>RISK LEVEL {riskLabel}</span>
                        </div>
                      </div>

                      {/* Expanded detail */}
                      {expandedPattern === i && (
                        <div style={{
                          marginTop: 10, padding: "10px 12px",
                          border: `1px solid ${pColor}20`,
                          background: "rgba(0,0,0,0.3)",
                          animation: "fadeIn 0.2s ease-out",
                        }}>
                          <div style={{ color: "rgba(0,212,255,0.5)", fontSize: 9, lineHeight: 1.5, marginBottom: 8 }}>{p.description}</div>
                          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 8 }}>
                            {[
                              { l: "1M AVG", v: p.avgReturn1m },
                              { l: "3M AVG", v: p.avgReturn3m },
                              { l: "6M AVG", v: p.avgReturn6m },
                            ].map(m => (
                              <div key={m.l} style={{ textAlign: "center" }}>
                                <div style={{ color: "rgba(0,212,255,0.3)", fontSize: 8 }}>{m.l}</div>
                                <div style={{ color: m.v >= 0 ? "#22c55e" : "#f97316", fontSize: 10, fontWeight: "bold" }}>
                                  {m.v >= 0 ? "+" : ""}{m.v.toFixed(1)}%
                                </div>
                              </div>
                            ))}
                          </div>
                          <div style={{ color: "rgba(0,212,255,0.3)", fontSize: 8 }}>
                            INVALIDATION: {p.invalidationConditions}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* ── RIGHT COLUMN (40%) ── */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

          {/* ── TRANSITION PROBABILITIES panel ── */}
          <div style={{
            border: "1px solid rgba(0,212,255,0.18)",
            background: "rgba(0,212,255,0.02)",
            padding: "20px 24px",
            flex: 1,
            animation: "fadeIn 0.6s ease-out",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 20 }}>
              <span style={{ color: "rgba(0,212,255,0.5)", fontSize: 9 }}>▦</span>
              <span style={{ color: "rgba(0,212,255,0.7)", fontSize: 9, letterSpacing: "0.25em" }}>TRANSITION PROBABILITIES</span>
            </div>

            {/* Horizon selector */}
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 24 }}>
              <span style={{ color: "rgba(0,212,255,0.35)", fontSize: 9, letterSpacing: "0.15em" }}>HORIZON:</span>
              <div style={{ display: "flex", gap: 4 }}>
                {(["1M", "3M", "6M", "12M"] as const).map(h => (
                  <button
                    key={h}
                    onClick={() => setHorizonTab(h)}
                    style={{
                      padding: "3px 10px",
                      border: `1px solid ${horizonTab === h ? "#22c55e" : "rgba(0,212,255,0.2)"}`,
                      color: horizonTab === h ? "#22c55e" : "rgba(0,212,255,0.4)",
                      background: horizonTab === h ? "rgba(34,197,94,0.08)" : "transparent",
                      fontFamily: "monospace", fontSize: 9, letterSpacing: "0.1em",
                      cursor: "pointer",
                      transition: "all 0.2s",
                    }}
                  >
                    {h}
                  </button>
                ))}
              </div>
            </div>

            {/* Probability bars */}
            <div style={{ marginBottom: 24 }}>
              {transProbs.map((p, i) => (
                <ProbBar key={i} label={p.label} pct={p.pct} color={p.color} />
              ))}
            </div>

            {/* Historical basis */}
            {tp.historicalBasis && (
              <div style={{
                padding: "10px 12px", marginBottom: 20,
                border: "1px solid rgba(0,212,255,0.1)",
                background: "rgba(0,0,0,0.2)",
              }}>
                <div style={{ color: "rgba(0,212,255,0.35)", fontSize: 9, lineHeight: 1.6 }}>{tp.historicalBasis}</div>
              </div>
            )}

            {/* Divider */}
            <div style={{ borderTop: "1px solid rgba(0,212,255,0.08)", paddingTop: 16, marginBottom: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "rgba(0,212,255,0.25)", fontSize: 8 }}>PROBABILITIES SUM TO 100%</span>
                <span style={{ color: "rgba(0,212,255,0.25)", fontSize: 8 }}>DATA-DRIVEN ESTIMATES</span>
              </div>
            </div>

            {/* Evolution summary */}
            <div style={{ marginBottom: 20 }}>
              <div style={{ color: "rgba(0,212,255,0.4)", fontSize: 9, letterSpacing: "0.2em", marginBottom: 12 }}>PRESSURE EVOLUTION:</div>
              {[
                { label: "7-DAY", value: intel.evolution.sevenDayTrend, color: "#00D4FF" },
                { label: "30-DAY", value: intel.evolution.thirtyDayTrend, color: "#00D4FF" },
                { label: "90-DAY", value: intel.evolution.ninetyDayTrend, color: "#eab308" },
                { label: "12-MONTH", value: intel.evolution.yearTrend, color: "#22c55e" },
              ].map(t => (
                <div key={t.label} style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 8 }}>
                  <span style={{ color: t.color, fontSize: 9, letterSpacing: "0.1em" }}>{t.label}</span>
                  <span style={{ color: "#94a3b8", fontSize: 9, maxWidth: "70%", textAlign: "right" }}>{t.value}</span>
                </div>
              ))}
            </div>

            {/* Historical memory stats */}
            <div style={{ borderTop: "1px solid rgba(0,212,255,0.08)", paddingTop: 16 }}>
              <div style={{ color: "rgba(0,212,255,0.4)", fontSize: 9, letterSpacing: "0.2em", marginBottom: 12 }}>HISTORICAL MEMORY:</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                {[
                  { label: "OBSERVATIONS", value: intel.memory.observationCount.toString() },
                  { label: "DATASET SPAN", value: intel.memory.datasetSpan },
                  { label: "PERCENTILE", value: `${intel.currentPercentile}th` },
                  { label: "AVG PRESSURE", value: `${intel.memory.historicalStats.avgPressure}/100` },
                ].map(m => (
                  <div key={m.label} style={{ padding: "8px 10px", border: "1px solid rgba(0,212,255,0.1)", background: "rgba(0,0,0,0.2)" }}>
                    <div style={{ color: "rgba(0,212,255,0.3)", fontSize: 8, letterSpacing: "0.1em", marginBottom: 3 }}>{m.label}</div>
                    <div style={{ color: "#00D4FF", fontSize: 11, fontWeight: "bold" }}>{m.value}</div>
                  </div>
                ))}
              </div>
              {intel.memory.currentStreakDescription && (
                <div style={{ marginTop: 10, color: "rgba(0,212,255,0.4)", fontSize: 9, lineHeight: 1.5 }}>
                  {intel.memory.currentStreakDescription}
                </div>
              )}
            </div>

            {/* Navigate deeper */}
            <div style={{ borderTop: "1px solid rgba(0,212,255,0.08)", paddingTop: 16, marginTop: 16 }}>
              <div style={{ color: "rgba(0,212,255,0.3)", fontSize: 8, letterSpacing: "0.15em", marginBottom: 10 }}>EXPLORE FURTHER:</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {[
                  { label: "Signal Outlook →", href: "/app/signals" },
                  { label: "Pressure Index →", href: "/app/pressure" },
                  { label: "Ask FAULTLINE →", href: "/app/ask" },
                  { label: "Daily Briefing →", href: "/app/daily-report" },
                ].map(link => (
                  <Link key={link.href} href={link.href}>
                    <span style={{
                      color: "rgba(0,212,255,0.45)", fontSize: 9, letterSpacing: "0.1em",
                      cursor: "pointer", display: "block",
                      transition: "color 0.2s",
                    }}
                    onMouseEnter={e => (e.currentTarget.style.color = "#00D4FF")}
                    onMouseLeave={e => (e.currentTarget.style.color = "rgba(0,212,255,0.45)")}
                    >
                      {link.label}
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Footer bar ── */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "8px 24px",
        borderTop: "1px solid rgba(0,212,255,0.1)",
        background: "rgba(5,6,8,0.95)",
        flexShrink: 0,
      }}>
        <span style={{ color: "rgba(0,212,255,0.3)", fontSize: 8, letterSpacing: "0.15em" }}>DATA COVERAGE: GLOBAL MARKETS</span>
        <span style={{ color: "rgba(0,212,255,0.3)", fontSize: 8, letterSpacing: "0.15em" }}>HISTORY: 25 YRS</span>
        <span style={{ color: "rgba(0,212,255,0.3)", fontSize: 8, letterSpacing: "0.15em" }}>MODEL VERSION: 3.7.4</span>
        <span style={{ color: "rgba(0,212,255,0.3)", fontSize: 8, letterSpacing: "0.15em" }}>CONFIDENCE FRAMEWORK: INSTITUTIONAL GRADE</span>
      </div>
    </div>
  );
}
