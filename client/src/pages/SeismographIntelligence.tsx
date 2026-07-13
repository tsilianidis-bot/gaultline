/**
 * FAULTLINE — Seismograph Intelligence
 * Compact card at top + 9 permanently visible intelligence sections below.
 * No accordions. No hidden panels. Intelligence is the product.
 */

import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { RefreshCw, Info } from "lucide-react";

function pressureColor(score: number): string {
  if (score >= 80) return "#ef4444";
  if (score >= 65) return "#f97316";
  if (score >= 45) return "#f59e0b";
  if (score >= 25) return "#22c55e";
  return "#10b981";
}

function formatTsy(v: number | null): string {
  if (v === null) return "—";
  return v.toFixed(2) + "%";
}
function formatHyBps(bps: number | null): string {
  if (bps === null) return "—";
  return bps + "bps";
}
function formatBtc(v: number | null): string {
  if (v === null) return "—";
  return v.toLocaleString("en-US", { maximumFractionDigits: 0 });
}

function SectionCard({ label, labelColor, children }: { label: string; labelColor?: string; children: React.ReactNode }) {
  return (
    <div style={{ width: "100%", maxWidth: "480px", border: "1px solid rgba(6,182,212,0.25)", borderRadius: "8px", background: "rgba(0,8,20,0.95)", overflow: "hidden", boxShadow: "0 0 30px rgba(6,182,212,0.05)", marginBottom: "12px", fontFamily: "'JetBrains Mono','Courier New',monospace" }}>
      <div style={{ padding: "8px 16px", borderBottom: "1px solid rgba(6,182,212,0.15)", fontSize: "9px", letterSpacing: "0.14em", fontWeight: 700, color: labelColor || "rgba(6,182,212,0.5)" }}>{label}</div>
      <div style={{ padding: "14px 16px" }}>{children}</div>
    </div>
  );
}

function RegimeProbabilityRow({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "7px", fontSize: "11px", letterSpacing: "0.06em", fontWeight: 600 }}>
      <div style={{ width: "88px", color, flexShrink: 0 }}>{label}</div>
      <div style={{ flex: 1, height: "6px", background: "rgba(6,182,212,0.08)", borderRadius: "3px", overflow: "hidden", position: "relative" }}>
        <div style={{ position: "absolute", inset: 0, backgroundImage: "repeating-linear-gradient(90deg,rgba(6,182,212,0.12) 0px,rgba(6,182,212,0.12) 2px,transparent 2px,transparent 6px)" }} />
        <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: `${value}%`, background: color, boxShadow: `0 0 6px ${color}80`, borderRadius: "3px", transition: "width 0.8s cubic-bezier(0.23,1,0.32,1)" }} />
      </div>
      <div style={{ width: "32px", textAlign: "right", color, fontWeight: 700, flexShrink: 0 }}>{value}%</div>
    </div>
  );
}

export default function SeismographIntelligence() {
  const [btcPrice, setBtcPrice] = useState<number | null>(null);
  const [btcChange24h, setBtcChange24h] = useState<number | null>(null);
  const [now, setNow] = useState(() => new Date());

  const { data: intel, isLoading, refetch } = trpc.seismograph.getUnifiedIntelligence.useQuery(undefined, { staleTime: 5 * 60 * 1000 });

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    fetch("/api/signals/ticker/BTC")
      .then((r) => r.json())
      .then((d: { currentPrice?: number; priceChange24hPercent?: number }) => {
        if (d?.currentPrice) setBtcPrice(d.currentPrice);
        if (d?.priceChange24hPercent !== undefined) setBtcChange24h(d.priceChange24hPercent);
      })
      .catch(() => {});
  }, []);

  const formatUtc = (d: Date) => d.toISOString().replace("T", " ").substring(0, 16) + " UTC";

  const dataDate = intel?.macroTicker?.dataMonth
    ? (() => {
        const [y, m] = intel.macroTicker.dataMonth.split("-");
        const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
        return `AS OF ${months[parseInt(m) - 1].toUpperCase()} ${y}`;
      })()
    : `AS OF ${formatUtc(now)}`;

  const scoreColor = intel ? pressureColor(intel.currentScore) : "#06b6d4";
  const regimeProbs = intel?.regimeProbabilities5way;
  const macroTicker = intel?.macroTicker;
  const tsyUp = macroTicker?.tsy10yChange != null ? macroTicker.tsy10yChange > 0 : null;
  const btcUp = btcChange24h != null ? btcChange24h > 0 : null;
  const topEngine = intel?.evidenceFamilies ? [...intel.evidenceFamilies].sort((a, b) => b.strength - a.strength)[0] : null;

  return (
    <div style={{ minHeight: "100vh", background: "#000000", display: "flex", flexDirection: "column", alignItems: "center", padding: "32px 16px 64px", fontFamily: "'JetBrains Mono','Courier New',monospace" }}>

      {/* ── COMPACT CARD ── */}
      <div style={{ width: "100%", maxWidth: "480px", border: "1px solid rgba(6,182,212,0.35)", borderRadius: "8px", background: "rgba(0,8,20,0.95)", overflow: "hidden", boxShadow: "0 0 40px rgba(6,182,212,0.08),0 0 80px rgba(0,0,0,0.8)", marginBottom: "12px" }}>

        {/* Macro Ticker */}
        <div style={{ display: "flex", alignItems: "center", padding: "10px 16px", borderBottom: "1px solid rgba(6,182,212,0.2)", fontSize: "12px", letterSpacing: "0.04em" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "6px", flex: 1 }}>
            <span style={{ color: "rgba(6,182,212,0.6)", fontWeight: 500 }}>10Y Treasury</span>
            <span style={{ color: "#06b6d4", fontWeight: 700, fontSize: "13px" }}>{isLoading ? "—" : formatTsy(macroTicker?.tsy10y ?? null)}</span>
            {tsyUp !== null && <span style={{ color: tsyUp ? "#ef4444" : "#22c55e", fontSize: "10px" }}>{tsyUp ? "▲" : "▼"}</span>}
          </div>
          <div style={{ color: "rgba(6,182,212,0.3)", padding: "0 12px" }}>|</div>
          <div style={{ display: "flex", alignItems: "center", gap: "6px", flex: 1, justifyContent: "center" }}>
            <span style={{ color: "rgba(6,182,212,0.6)", fontWeight: 500 }}>HY Spread</span>
            <span style={{ color: "#06b6d4", fontWeight: 700, fontSize: "13px" }}>{isLoading ? "—" : formatHyBps(macroTicker?.hySpreadBps ?? null)}</span>
          </div>
          <div style={{ color: "rgba(6,182,212,0.3)", padding: "0 12px" }}>|</div>
          <div style={{ display: "flex", alignItems: "center", gap: "6px", flex: 1, justifyContent: "flex-end" }}>
            <span style={{ color: "rgba(6,182,212,0.6)", fontWeight: 500 }}>BTC</span>
            <span style={{ color: "#06b6d4", fontWeight: 700, fontSize: "13px" }}>{btcPrice ? formatBtc(btcPrice) : "—"}</span>
            {btcUp !== null && <span style={{ color: btcUp ? "#22c55e" : "#ef4444", fontSize: "10px" }}>{btcUp ? "▲" : "▼"}</span>}
          </div>
        </div>

        {/* Regime Probabilities */}
        <div style={{ padding: "14px 16px", borderBottom: "1px solid rgba(6,182,212,0.15)" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "10px", letterSpacing: "0.12em", fontWeight: 700, color: "#06b6d4" }}>
              <span>REGIME PROBABILITIES</span>
              <Info size={10} style={{ color: "rgba(6,182,212,0.5)" }} />
            </div>
            <div style={{ fontSize: "9px", letterSpacing: "0.06em", color: "rgba(6,182,212,0.45)" }}>{dataDate}</div>
          </div>
          {isLoading ? (
            <div style={{ color: "rgba(6,182,212,0.3)", fontSize: "11px", padding: "8px 0" }}>Loading intelligence...</div>
          ) : regimeProbs ? (
            <>
              <RegimeProbabilityRow label="BULL" value={regimeProbs.bull} color="#22c55e" />
              <RegimeProbabilityRow label="SOFT LAND" value={regimeProbs.softLanding} color="#06b6d4" />
              <RegimeProbabilityRow label="STAGFLATION" value={regimeProbs.stagflation} color="#f59e0b" />
              <RegimeProbabilityRow label="RECESSION" value={regimeProbs.recession} color="#f97316" />
              <RegimeProbabilityRow label="CRASH" value={regimeProbs.crash} color="#ef4444" />
            </>
          ) : (
            <div style={{ color: "rgba(6,182,212,0.3)", fontSize: "11px", padding: "8px 0" }}>No data available</div>
          )}
        </div>

        {/* Market Intelligence Panel */}
        <div style={{ padding: "14px 16px", borderBottom: "1px solid rgba(6,182,212,0.15)", background: "rgba(6,182,212,0.03)" }}>
          <div style={{ display: "flex", alignItems: "flex-start", gap: "12px", marginBottom: "12px" }}>
            <div style={{ width: "32px", height: "32px", borderRadius: "6px", border: "1px solid rgba(6,182,212,0.3)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, background: "rgba(6,182,212,0.06)" }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#06b6d4" strokeWidth="1.5">
                <path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96-.46 2.5 2.5 0 0 1-1.98-3 2.5 2.5 0 0 1-1.32-4.24 3 3 0 0 1 .34-5.58 2.5 2.5 0 0 1 1.32-4.24A2.5 2.5 0 0 1 9.5 2" />
                <path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96-.46 2.5 2.5 0 0 0 1.98-3 2.5 2.5 0 0 0 1.32-4.24 3 3 0 0 0-.34-5.58 2.5 2.5 0 0 0-1.32-4.24A2.5 2.5 0 0 0 14.5 2" />
              </svg>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "2px" }}>
                <span style={{ fontSize: "11px", letterSpacing: "0.1em", fontWeight: 700, color: "#06b6d4" }}>MARKET INTELLIGENCE</span>
                {intel && <span style={{ fontSize: "20px", fontWeight: 800, color: scoreColor, lineHeight: 1, textShadow: `0 0 12px ${scoreColor}60` }}>{intel.currentScore}</span>}
              </div>
              <div style={{ fontSize: "11px", color: "rgba(6,182,212,0.55)", lineHeight: 1.4 }}>
                {intel ? `Systemic risk composite at ${intel.currentScore} — ${intel.currentStressLevel} stress` : "Loading..."}
              </div>
            </div>
          </div>
          {topEngine && (
            <div style={{ display: "flex", alignItems: "flex-start", gap: "10px", padding: "10px 12px", background: "rgba(6,182,212,0.05)", borderRadius: "6px", border: "1px solid rgba(6,182,212,0.12)" }}>
              <div style={{ width: "24px", height: "24px", borderRadius: "4px", border: "1px solid rgba(6,182,212,0.3)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: "8px", fontWeight: 800, color: "#06b6d4", letterSpacing: "0.05em" }}>AI</div>
              <div>
                <div style={{ fontSize: "11px", fontWeight: 600, color: "#06b6d4", marginBottom: "2px" }}>{topEngine.name} <span style={{ color: "rgba(6,182,212,0.5)", fontWeight: 400 }}>({topEngine.strength.toFixed(1)}/10):</span></div>
                <div style={{ fontSize: "11px", color: "rgba(6,182,212,0.7)", lineHeight: 1.5 }}>{topEngine.currentValue}</div>
              </div>
            </div>
          )}
        </div>

        {/* Footer bar */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 16px", fontSize: "9px", letterSpacing: "0.08em", color: "rgba(6,182,212,0.45)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <div style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#22c55e", boxShadow: "0 0 4px #22c55e", animation: "pulse 2s infinite" }} />
            <span style={{ color: "#22c55e", fontWeight: 700 }}>LIVE</span>
            <span style={{ color: "rgba(6,182,212,0.3)" }}>{intel ? `${intel.memory.observationCount} OBS` : "—"}</span>
          </div>
          <span style={{ fontWeight: 700, color: "rgba(6,182,212,0.5)", fontSize: "9px" }}>FAULTLINE</span>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span>{formatUtc(now)}</span>
            <button onClick={() => refetch()} style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(6,182,212,0.4)", padding: 0 }}><RefreshCw size={10} /></button>
          </div>
        </div>
      </div>

      {/* ── SECTION 2: EXECUTIVE MARKET INTELLIGENCE BRIEFING ── */}
      {intel?.marketNarrative && (
        <SectionCard label="EXECUTIVE MARKET INTELLIGENCE BRIEFING" labelColor="#06b6d4">
          {([
            { q: "WHAT IS HAPPENING", a: intel.marketNarrative.whatIsHappening, accent: "rgba(6,182,212,0.4)", qColor: "rgba(6,182,212,0.5)" },
            { q: "WHY IS IT HAPPENING", a: intel.marketNarrative.whyIsItHappening, accent: "rgba(6,182,212,0.4)", qColor: "rgba(6,182,212,0.5)" },
            { q: "WHAT HAS CHANGED", a: intel.marketNarrative.whatHasChanged, accent: "rgba(6,182,212,0.3)", qColor: "rgba(6,182,212,0.5)" },
            { q: "WHAT IS BUILDING BENEATH THE SURFACE", a: intel.marketNarrative.whatIsBuildingBeneathSurface, accent: "rgba(245,158,11,0.6)", qColor: "rgba(245,158,11,0.7)" },
            { q: "HIGHEST-PROBABILITY PATH FORWARD", a: intel.marketNarrative.highestProbabilityPath, accent: "rgba(6,182,212,0.4)", qColor: "rgba(6,182,212,0.5)" },
            { q: "WHAT WOULD INVALIDATE THIS OUTLOOK", a: intel.marketNarrative.whatWouldInvalidate, accent: "rgba(239,68,68,0.5)", qColor: "rgba(239,68,68,0.65)" },
          ] as { q: string; a: string; accent: string; qColor: string }[]).map(({ q, a, accent, qColor }, i) => (
            <div key={i} style={{ marginBottom: i < 5 ? "8px" : 0, padding: "10px 12px", background: "rgba(6,182,212,0.02)", borderRadius: "5px", borderLeft: `2px solid ${accent}` }}>
              <div style={{ fontSize: "8px", letterSpacing: "0.12em", color: qColor, fontWeight: 700, marginBottom: "4px" }}>{q}</div>
              <div style={{ fontSize: "11px", color: "rgba(6,182,212,0.8)", lineHeight: 1.6 }}>{a}</div>
            </div>
          ))}
        </SectionCard>
      )}

      {/* ── SECTION 3: WHAT IS BUILDING BENEATH THE SURFACE ── */}
      {intel?.developingConditions && intel.developingConditions.length > 0 && (
        <SectionCard label="WHAT IS BUILDING BENEATH THE SURFACE" labelColor="rgba(245,158,11,0.7)">
          {intel.developingConditions.map((c, i) => {
            const sevColor = c.severity === "Critical" ? "#ef4444" : c.severity === "High" ? "#f97316" : c.severity === "Moderate" ? "#f59e0b" : "#22c55e";
            const trendIcon = c.trend === "building" ? "▲ BUILDING" : c.trend === "easing" ? "▼ EASING" : "─ STABLE";
            const trendColor = c.trend === "building" ? "#f97316" : c.trend === "easing" ? "#22c55e" : "rgba(6,182,212,0.5)";
            return (
              <div key={i} style={{ marginBottom: i < intel.developingConditions.length - 1 ? "10px" : 0, padding: "10px 12px", background: "rgba(6,182,212,0.02)", borderRadius: "5px", borderLeft: `2px solid ${sevColor}55` }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "4px" }}>
                  <div style={{ fontSize: "11px", fontWeight: 700, color: sevColor, letterSpacing: "0.04em" }}>{c.title}</div>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <span style={{ fontSize: "9px", color: trendColor, fontWeight: 700, letterSpacing: "0.06em" }}>{trendIcon}</span>
                    <span style={{ fontSize: "9px", color: sevColor, fontWeight: 700, padding: "1px 5px", border: `1px solid ${sevColor}40`, borderRadius: "3px", letterSpacing: "0.06em" }}>{c.severity.toUpperCase()}</span>
                  </div>
                </div>
                <div style={{ fontSize: "11px", color: "rgba(6,182,212,0.72)", lineHeight: 1.55, marginBottom: "6px" }}>{c.description}</div>
                {c.engines.length > 0 && (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "4px", marginBottom: "4px" }}>
                    {c.engines.map((e: string, j: number) => (
                      <span key={j} style={{ fontSize: "8px", color: "rgba(6,182,212,0.5)", padding: "1px 5px", border: "1px solid rgba(6,182,212,0.15)", borderRadius: "3px", letterSpacing: "0.04em" }}>{e}</span>
                    ))}
                  </div>
                )}
                {c.expectedImpact && <div style={{ fontSize: "10px", color: "rgba(6,182,212,0.5)", fontStyle: "italic", lineHeight: 1.4 }}>Expected impact: {c.expectedImpact}</div>}
              </div>
            );
          })}
        </SectionCard>
      )}

      {/* ── SECTION 4: ENGINE CONTRIBUTIONS ── */}
      {intel?.engineContributions && intel.engineContributions.length > 0 && (
        <SectionCard label="ENGINE CONTRIBUTIONS">
          {intel.engineContributions.map((e, i) => {
            const dirColor = e.direction === "bearish" ? "#f97316" : e.direction === "bullish" ? "#22c55e" : "rgba(6,182,212,0.5)";
            return (
              <div key={i} style={{ marginBottom: i < intel.engineContributions.length - 1 ? "8px" : 0, display: "flex", alignItems: "center", gap: "10px" }}>
                <div style={{ width: "140px", fontSize: "10px", color: "rgba(6,182,212,0.7)", flexShrink: 0, letterSpacing: "0.02em" }}>{e.engine}</div>
                <div style={{ flex: 1, height: "5px", background: "rgba(6,182,212,0.08)", borderRadius: "3px", overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${e.contributionWeight}%`, background: dirColor, boxShadow: `0 0 4px ${dirColor}60`, borderRadius: "3px", transition: "width 0.8s cubic-bezier(0.23,1,0.32,1)" }} />
                </div>
                <div style={{ width: "36px", textAlign: "right", fontSize: "10px", color: dirColor, fontWeight: 700, flexShrink: 0 }}>{e.contributionWeight}%</div>
                <div style={{ width: "70px", fontSize: "9px", color: dirColor, textAlign: "right", letterSpacing: "0.04em", flexShrink: 0, textTransform: "uppercase" }}>{e.direction}</div>
              </div>
            );
          })}
        </SectionCard>
      )}

      {/* ── SECTION 5: HISTORICAL PRESSURE TIMELINE ── */}
      {intel?.evolution && (
        <SectionCard label="HISTORICAL PRESSURE TIMELINE">
          {intel.evolution.sparkline90d && intel.evolution.sparkline90d.length > 0 && (
            <div style={{ marginBottom: "12px" }}>
              <svg width="100%" height="48" viewBox={`0 0 ${intel.evolution.sparkline90d.length} 48`} preserveAspectRatio="none" style={{ display: "block" }}>
                {intel.evolution.sparkline90d.map((v: { month: string; score: number; regime: string }, idx: number) => {
                  const h = Math.max(2, (v.score / 100) * 44);
                  const col = pressureColor(v.score);
                  return <rect key={idx} x={idx} y={48 - h} width="0.8" height={h} fill={col} opacity="0.7" />;
                })}
              </svg>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "8px", color: "rgba(6,182,212,0.3)", marginTop: "4px" }}>
                <span>90 DAYS AGO</span><span>TODAY</span>
              </div>
            </div>
          )}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
            {([
              { label: "7-DAY TREND", text: intel.evolution.sevenDayTrend },
              { label: "30-DAY TREND", text: intel.evolution.thirtyDayTrend },
              { label: "90-DAY TREND", text: intel.evolution.ninetyDayTrend },
              { label: "12-MONTH TREND", text: intel.evolution.yearTrend },
            ] as { label: string; text: string }[]).filter((t) => t.text).map(({ label, text }, i) => (
              <div key={i} style={{ padding: "8px 10px", background: "rgba(6,182,212,0.03)", borderRadius: "5px", border: "1px solid rgba(6,182,212,0.1)" }}>
                <div style={{ fontSize: "8px", letterSpacing: "0.1em", color: "rgba(6,182,212,0.4)", fontWeight: 700, marginBottom: "3px" }}>{label}</div>
                <div style={{ fontSize: "10px", color: "rgba(6,182,212,0.72)", lineHeight: 1.5 }}>{text}</div>
              </div>
            ))}
          </div>
          {(intel.evolution.whatChanged.length > 0 || intel.evolution.whatToWatch.length > 0) && (
            <div style={{ marginTop: "10px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
              {intel.evolution.whatChanged.length > 0 && (
                <div style={{ padding: "8px 10px", background: "rgba(6,182,212,0.02)", borderRadius: "5px", borderLeft: "2px solid rgba(6,182,212,0.3)" }}>
                  <div style={{ fontSize: "8px", letterSpacing: "0.1em", color: "rgba(6,182,212,0.45)", fontWeight: 700, marginBottom: "4px" }}>WHAT CHANGED</div>
                  {intel.evolution.whatChanged.slice(0, 3).map((c: string, i: number) => <div key={i} style={{ fontSize: "10px", color: "rgba(6,182,212,0.65)", marginBottom: "2px", lineHeight: 1.4 }}>› {c}</div>)}
                </div>
              )}
              {intel.evolution.whatToWatch.length > 0 && (
                <div style={{ padding: "8px 10px", background: "rgba(6,182,212,0.02)", borderRadius: "5px", borderLeft: "2px solid rgba(245,158,11,0.3)" }}>
                  <div style={{ fontSize: "8px", letterSpacing: "0.1em", color: "rgba(245,158,11,0.5)", fontWeight: 700, marginBottom: "4px" }}>WHAT TO WATCH</div>
                  {intel.evolution.whatToWatch.slice(0, 3).map((c: string, i: number) => <div key={i} style={{ fontSize: "10px", color: "rgba(245,158,11,0.65)", marginBottom: "2px", lineHeight: 1.4 }}>› {c}</div>)}
                </div>
              )}
            </div>
          )}
        </SectionCard>
      )}

      {/* ── SECTION 6: HISTORICAL ANALOGS ── */}
      {intel?.analogs && intel.analogs.length > 0 && (
        <SectionCard label="HISTORICAL ANALOGS — CLOSEST COMPARABLE ENVIRONMENTS">
          {intel.analogs.slice(0, 3).map((a, i) => (
            <div key={i} style={{ marginBottom: i < 2 ? "10px" : 0, padding: "10px 12px", background: "rgba(6,182,212,0.02)", borderRadius: "5px", border: "1px solid rgba(6,182,212,0.1)" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "4px" }}>
                <div style={{ fontSize: "11px", fontWeight: 700, color: "#06b6d4", letterSpacing: "0.04em" }}>{a.period}</div>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <span style={{ fontSize: "9px", color: "rgba(6,182,212,0.45)", letterSpacing: "0.06em" }}>SIMILARITY</span>
                  <span style={{ fontSize: "11px", fontWeight: 700, color: "#06b6d4" }}>{a.similarity}%</span>
                </div>
              </div>
              <div style={{ fontSize: "10px", color: "rgba(6,182,212,0.65)", lineHeight: 1.5, marginBottom: "8px" }}>{a.description}</div>
              <div style={{ display: "flex", gap: "16px" }}>
                {([
                  { label: "3M RETURN", val: a.avgReturn3m },
                  { label: "6M RETURN", val: a.avgReturn6m },
                  { label: "12M RETURN", val: a.avgReturn12m },
                ] as { label: string; val: number | null }[]).map(({ label, val }) => (
                  <div key={label}>
                    <div style={{ fontSize: "8px", color: "rgba(6,182,212,0.35)", letterSpacing: "0.08em", marginBottom: "2px" }}>{label}</div>
                    <div style={{ fontSize: "12px", fontWeight: 700, color: val === null ? "rgba(6,182,212,0.3)" : val >= 0 ? "#22c55e" : "#ef4444" }}>
                      {val !== null ? `${val > 0 ? "+" : ""}${val}%` : "—"}
                    </div>
                  </div>
                ))}
              </div>
              {a.resolution && <div style={{ marginTop: "6px", fontSize: "10px", color: "rgba(6,182,212,0.5)", fontStyle: "italic", lineHeight: 1.4 }}>Resolution: {a.resolution}</div>}
            </div>
          ))}
        </SectionCard>
      )}

      {/* ── SECTION 7: HIGHEST PROBABILITY PATH FORWARD ── */}
      {intel?.transitionProbabilities && (
        <SectionCard label="HIGHEST PROBABILITY PATH FORWARD" labelColor="rgba(6,182,212,0.7)">
          {intel.probabilities.primaryDriver && (
            <div style={{ marginBottom: "12px", padding: "10px 12px", background: "rgba(6,182,212,0.02)", borderRadius: "5px", borderLeft: "2px solid rgba(6,182,212,0.3)" }}>
              <div style={{ fontSize: "8px", letterSpacing: "0.12em", color: "rgba(6,182,212,0.45)", fontWeight: 700, marginBottom: "4px" }}>PRIMARY DRIVER</div>
              <div style={{ fontSize: "11px", color: "rgba(6,182,212,0.8)", lineHeight: 1.6 }}>{intel.probabilities.primaryDriver}</div>
            </div>
          )}
          {([
            { label: "REMAIN IN REGIME", val: intel.transitionProbabilities.remainInRegime, color: "#06b6d4" },
            { label: "TRANSITION ELEVATED", val: intel.transitionProbabilities.transitionToElevated, color: "#f97316" },
            { label: "TRANSITION LOW", val: intel.transitionProbabilities.transitionToLow, color: "#22c55e" },
            { label: "TRANSITION CRISIS", val: intel.transitionProbabilities.transitionToCrisis, color: "#ef4444" },
          ] as { label: string; val: number; color: string }[]).map(({ label, val, color }) => (
            <div key={label} style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "6px" }}>
              <div style={{ width: "150px", fontSize: "9px", color: "rgba(6,182,212,0.5)", letterSpacing: "0.06em", flexShrink: 0 }}>{label}</div>
              <div style={{ flex: 1, height: "5px", background: "rgba(6,182,212,0.08)", borderRadius: "3px", overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${val}%`, background: color, boxShadow: `0 0 4px ${color}60`, borderRadius: "3px", transition: "width 0.8s cubic-bezier(0.23,1,0.32,1)" }} />
              </div>
              <div style={{ width: "32px", textAlign: "right", fontSize: "10px", color, fontWeight: 700, flexShrink: 0 }}>{val}%</div>
            </div>
          ))}
          {intel.transitionProbabilities.historicalBasis && (
            <div style={{ marginTop: "10px", padding: "8px 10px", background: "rgba(6,182,212,0.02)", borderRadius: "5px", borderLeft: "2px solid rgba(6,182,212,0.2)" }}>
              <div style={{ fontSize: "8px", letterSpacing: "0.1em", color: "rgba(6,182,212,0.4)", fontWeight: 700, marginBottom: "3px" }}>HISTORICAL BASIS</div>
              <div style={{ fontSize: "10px", color: "rgba(6,182,212,0.6)", lineHeight: 1.5 }}>{intel.transitionProbabilities.historicalBasis}</div>
            </div>
          )}
          {intel.probabilities.evidenceBasis && (
            <div style={{ marginTop: "8px", padding: "8px 10px", background: "rgba(6,182,212,0.02)", borderRadius: "5px", borderLeft: "2px solid rgba(6,182,212,0.2)" }}>
              <div style={{ fontSize: "8px", letterSpacing: "0.1em", color: "rgba(6,182,212,0.4)", fontWeight: 700, marginBottom: "3px" }}>EVIDENCE BASIS</div>
              <div style={{ fontSize: "10px", color: "rgba(6,182,212,0.6)", lineHeight: 1.5 }}>{intel.probabilities.evidenceBasis}</div>
            </div>
          )}
        </SectionCard>
      )}

      {/* ── SECTION 8: WHAT COULD CHANGE THE OUTLOOK ── */}
      {intel?.evolution?.whatToWatch && intel.evolution.whatToWatch.length > 0 && (
        <SectionCard label="WHAT COULD CHANGE THE OUTLOOK" labelColor="rgba(245,158,11,0.65)">
          <div style={{ marginBottom: "8px", fontSize: "11px", color: "rgba(6,182,212,0.55)", lineHeight: 1.6 }}>
            These are the conditions that would shift the current assessment if they materialize.
          </div>
          {intel.evolution.whatToWatch.map((item: string, i: number) => (
            <div key={i} style={{ marginBottom: i < intel.evolution.whatToWatch.length - 1 ? "6px" : 0, padding: "8px 12px", background: "rgba(245,158,11,0.03)", borderRadius: "5px", borderLeft: "2px solid rgba(245,158,11,0.35)", fontSize: "11px", color: "rgba(245,158,11,0.75)", lineHeight: 1.5 }}>
              › {item}
            </div>
          ))}
        </SectionCard>
      )}

      {/* ── SECTION 9: INVALIDATION CONDITIONS ── */}
      {intel?.evolution?.invalidationConditions && intel.evolution.invalidationConditions.length > 0 && (
        <SectionCard label="INVALIDATION CONDITIONS" labelColor="rgba(239,68,68,0.6)">
          <div style={{ marginBottom: "8px", fontSize: "11px", color: "rgba(6,182,212,0.55)", lineHeight: 1.6 }}>
            If any of the following conditions are met, the current assessment should be re-evaluated.
          </div>
          {intel.evolution.invalidationConditions.map((c: string, i: number) => (
            <div key={i} style={{ marginBottom: i < intel.evolution.invalidationConditions.length - 1 ? "6px" : 0, padding: "8px 12px", background: "rgba(239,68,68,0.03)", borderRadius: "5px", borderLeft: "2px solid rgba(239,68,68,0.35)", fontSize: "11px", color: "rgba(239,68,68,0.7)", lineHeight: 1.5 }}>
              › {c}
            </div>
          ))}
        </SectionCard>
      )}

      {isLoading && (
        <div style={{ width: "100%", maxWidth: "480px", padding: "24px", textAlign: "center", fontSize: "11px", color: "rgba(6,182,212,0.4)", letterSpacing: "0.08em" }}>LOADING INTELLIGENCE...</div>
      )}

      <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }`}</style>
    </div>
  );
}
