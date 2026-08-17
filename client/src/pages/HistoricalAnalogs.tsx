import { useMemo, useState } from "react";
import { Link } from "wouter";
import { ChevronDown, ChevronUp, Database, RefreshCw, ShieldAlert } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { CANONICAL_HOME } from "@shared/routeRegistry";

const C = { bg: "#050608", card: "rgba(10,14,20,.95)", border: "rgba(130,151,174,.18)", cyan: "#00D4FF", green: "#00FF88", amber: "#FFAA00", red: "#FF4D6A", text: "#EAF5FF", muted: "#8FA2B8", dim: "#6B7A8D", mono: "IBM Plex Mono,monospace", sans: "IBM Plex Sans,sans-serif", raj: "Rajdhani,sans-serif" };

function color(value: number) {
  if (value >= 70) return C.red;
  if (value >= 50) return C.amber;
  if (value >= 30) return C.cyan;
  return C.green;
}

function ordinal(value: number) {
  const mod100 = value % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${value}TH`;
  switch (value % 10) {
    case 1: return `${value}ST`;
    case 2: return `${value}ND`;
    case 3: return `${value}RD`;
    default: return `${value}TH`;
  }
}

function Label({ children, color: tone = C.cyan }: { children: React.ReactNode; color?: string }) {
  return <p style={{ margin: 0, color: tone, font: `10px ${C.mono}`, letterSpacing: ".14em" }}>{children}</p>;
}

function Metric({ label, value, note, tone = C.text }: { label: string; value: string; note: string; tone?: string }) {
  return <div style={{ minWidth: 0, border: `1px solid ${C.border}`, borderRadius: 8, padding: 12, background: "rgba(5,8,12,.46)" }}>
    <Label color={C.dim}>{label}</Label><strong style={{ display: "block", marginTop: 5, color: tone, font: `700 clamp(21px,4vw,32px) ${C.raj}` }}>{value}</strong><span style={{ display: "block", marginTop: 4, color: C.muted, fontSize: 11, lineHeight: 1.45 }}>{note}</span>
  </div>;
}

export default function HistoricalAnalogs() {
  const [expandedYear, setExpandedYear] = useState<number | null>(null);
  const { data, isLoading, isFetching, error, refetch } = trpc.pressure.getHistoricalContext.useQuery(undefined, { staleTime: 5 * 60 * 1000, refetchOnWindowFocus: false });
  const top = data?.analogMatches[0] ?? null;
  const hasSample = (data?.rarityContext.sampleSize ?? 0) >= 10;
  const copyText = useMemo(() => data ? [
    "FAULTLINE HISTORICAL ANALOGS",
    `Current Pressure: ${data.currentPressure}/100 (${data.currentRegime})`,
    `Recorded history: ${data.meta.pressureHistoryN} monthly observations (${data.meta.pressureHistoryRange})`,
    `Top reference: ${top ? `${top.label} (${top.similarity}% similarity)` : "No close reference period"}`,
    "Boundary: retrospective reference comparison only; not a historical FAULTLINE signal or forecast.",
  ].join("\n") : "", [data, top]);

  if (error) return <main style={{ minHeight: "100vh", background: C.bg, padding: "28px", color: C.text, fontFamily: C.sans }}><div style={{ maxWidth: 920, margin: "0 auto", border: `1px solid ${C.red}66`, background: "rgba(255,77,106,.08)", borderRadius: 10, padding: 18 }}><Label color={C.red}>HISTORICAL CONTEXT UNAVAILABLE</Label><p style={{ color: C.muted, fontSize: 13 }}>{error.message}. No comparison is shown while canonical context is unavailable.</p></div></main>;

  return <main style={{ minHeight: "100vh", background: C.bg, color: C.text, padding: "28px clamp(16px,4vw,56px)", fontFamily: C.sans }}>
    <header style={{ maxWidth: 1240, margin: "0 auto 22px" }}>
      <Link href={CANONICAL_HOME} style={{ color: C.cyan, font: `11px ${C.mono}`, textDecoration: "none" }}>← HOME / DEEP DASHBOARD</Link>
      <div style={{ display: "flex", gap: 18, marginTop: 18, alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap" }}>
        <div style={{ maxWidth: 850 }}><Label>CANONICAL HISTORY · RETROSPECTIVE REFERENCE ANALYSIS</Label><h1 style={{ margin: "5px 0 8px", font: `700 clamp(34px,6vw,58px) ${C.raj}`, letterSpacing: ".04em" }}>HISTORICAL ANALOGS</h1><p style={{ margin: 0, color: C.muted, fontSize: 14, lineHeight: 1.65 }}>Compare the present reading with historical reference periods using current Pressure vectors and recorded Pressure history. This does not imply that FAULTLINE existed or warned anyone during the reference periods.</p></div>
        <div style={{ display: "flex", gap: 8 }}><button type="button" onClick={() => refetch()} disabled={isFetching} style={{ border: `1px solid ${C.border}`, color: C.cyan, background: "transparent", borderRadius: 6, padding: "8px 10px", font: `10px ${C.mono}`, cursor: "pointer" }}><RefreshCw size={12} style={{ verticalAlign: "-2px", marginRight: 5 }} />{isFetching ? "REFRESHING" : "REFRESH"}</button><button type="button" onClick={() => navigator.clipboard.writeText(copyText)} disabled={!data} style={{ border: `1px solid ${C.border}`, color: C.muted, background: "transparent", borderRadius: 6, padding: "8px 10px", font: `10px ${C.mono}`, cursor: data ? "pointer" : "not-allowed" }}>COPY SUMMARY</button></div>
      </div>
    </header>
    {isLoading || !data ? <section style={{ maxWidth: 1240, margin: "0 auto", display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 12 }}>{[1,2,3,4].map(i => <div key={i} style={{ height: 118, borderRadius: 10, border: `1px solid ${C.border}`, background: C.card }} />)}</section> : <>
      <section style={{ maxWidth: 1240, margin: "0 auto", display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(190px,1fr))", gap: 12 }}>
        <Metric label="CURRENT PRESSURE" value={`${data.currentPressure} / 100`} note={`${data.currentRegime} · current source reading`} tone={color(data.currentPressure)} />
        <Metric label="HISTORICAL RARITY" value={hasSample ? `${ordinal(data.rarityContext.percentile)} PCTL` : "UNAVAILABLE"} note={hasSample ? `${data.rarityContext.rarityLabel} · n=${data.rarityContext.sampleSize}` : "Fewer than 10 recorded monthly observations"} tone={hasSample ? C.cyan : C.dim} />
        <Metric label="CURRENT DIRECTION" value={data.trendAssessment.label.toUpperCase()} note={`${data.trendAssessment.explanation}${data.timeline.monthsInCurrentRegime > 0 ? ` · ${data.timeline.monthsInCurrentRegime} completed monthly observation${data.timeline.monthsInCurrentRegime === 1 ? "" : "s"} in current regime` : " · current regime has no completed monthly history observation yet"}`} tone={data.trendAssessment.label === "Improving" ? C.green : data.trendAssessment.label === "Stable" ? C.cyan : C.amber} />
        <Metric label="RECORDED RANGE" value={`${data.meta.pressureHistoryN} MONTHS`} note={data.meta.pressureHistoryRange} tone={C.green} />
      </section>
      <section style={{ maxWidth: 1240, margin: "18px auto", border: `1px solid ${C.cyan}44`, borderRadius: 10, padding: "clamp(16px,3vw,24px)", background: "linear-gradient(120deg,rgba(0,212,255,.09),rgba(10,14,20,.96) 45%)" }}>
        <Label>WHAT THE CURRENT COMPARISON SHOWS</Label><div style={{ display: "grid", gridTemplateColumns: "minmax(0,1.2fr) minmax(240px,.8fr)", gap: 18, alignItems: "start", marginTop: 10 }}><div><h2 style={{ margin: 0, font: `700 clamp(24px,4vw,38px) ${C.raj}` }}>{top ? `${top.label} · ${top.similarity}% VECTOR SIMILARITY` : "NO CLOSE REFERENCE PERIOD"}</h2><p style={{ margin: "8px 0 0", color: C.muted, fontSize: 14, lineHeight: 1.65 }}>{top?.narrativeExplanation ?? "The canonical engine did not return a comparable reference period."}</p></div><div style={{ borderLeft: `2px solid ${C.amber}`, paddingLeft: 12 }}><Label color={C.amber}>INTERPRETATION BOUNDARY</Label><p style={{ margin: "6px 0 0", color: C.muted, fontSize: 12, lineHeight: 1.55 }}>Similarity reflects input-vector overlap with a reference library. It does not estimate a future path, create historical FAULTLINE markers, or imply that the same outcome will recur.</p></div></div>
      </section>
      <section style={{ maxWidth: 1240, margin: "0 auto", display: "grid", gridTemplateColumns: "minmax(0,1.2fr) minmax(280px,.8fr)", gap: 18 }}>
        <div style={{ minWidth: 0, border: `1px solid ${C.border}`, borderRadius: 10, background: C.card, overflow: "hidden" }}><div style={{ padding: "14px 16px", borderBottom: `1px solid ${C.border}` }}><Label>RANKED REFERENCE PERIODS</Label><p style={{ margin: "5px 0 0", color: C.muted, fontSize: 12 }}>Observed similarities and structural differences are shown separately.</p></div>{data.analogMatches.map((analog, index) => { const open = expandedYear === analog.year; return <article key={`${analog.year}-${analog.label}`} style={{ borderTop: index ? `1px solid ${C.border}` : "none" }}><button type="button" onClick={() => setExpandedYear(open ? null : analog.year)} style={{ display: "flex", gap: 12, width: "100%", textAlign: "left", alignItems: "center", padding: 14, background: "transparent", border: "none", color: C.text, cursor: "pointer" }}><span style={{ color: C.dim, font: `10px ${C.mono}`, minWidth: 22 }}>#{index+1}</span><span style={{ flex: 1, minWidth: 0 }}><strong style={{ display: "block", fontSize: 15 }}>{analog.label}</strong><span style={{ display: "block", color: C.muted, fontSize: 11, marginTop: 3 }}>{analog.period} · {analog.typicalDuration}</span></span><span style={{ color: color(analog.similarity), font: `700 24px ${C.raj}`, whiteSpace: "nowrap" }}>{analog.similarity}%</span>{open ? <ChevronUp size={16} color={C.muted} /> : <ChevronDown size={16} color={C.muted} />}</button>{open && <div style={{ padding: "0 16px 16px 48px", display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(210px,1fr))", gap: 12 }}><div><Label color={C.amber}>CURRENT OVERLAP</Label><ul style={{ margin: "7px 0 0", paddingLeft: 16, color: C.muted, fontSize: 12, lineHeight: 1.65 }}>{analog.similarities.map(item => <li key={item}>{item}</li>)}</ul></div><div><Label>STRUCTURAL DIFFERENCES</Label><ul style={{ margin: "7px 0 0", paddingLeft: 16, color: C.muted, fontSize: 12, lineHeight: 1.65 }}>{analog.differences.map(item => <li key={item}>{item}</li>)}</ul></div><div style={{ gridColumn: "1 / -1", borderTop: `1px solid ${C.border}`, paddingTop: 10 }}><Label color={C.dim}>HISTORICAL REFERENCE OUTCOME · NOT A FORECAST</Label><p style={{ margin: "6px 0 0", color: C.muted, fontSize: 12, lineHeight: 1.6 }}>{analog.outcome || "No outcome narrative is available for this reference period."}</p></div></div>}</article>; })}</div>
        <aside style={{ minWidth: 0, display: "flex", flexDirection: "column", gap: 14 }}><section style={{ border: `1px solid ${C.border}`, borderRadius: 10, padding: 16, background: C.card }}><Label>TOP CURRENT DRIVERS</Label><div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 10 }}>{data.drivers.slice(0,4).map(driver => <div key={driver.id} style={{ borderBottom: `1px solid ${C.border}`, paddingBottom: 9 }}><div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}><b style={{ fontSize: 12 }}>{driver.label}</b><span style={{ color: color(driver.score), font: `11px ${C.mono}` }}>{driver.score}/100</span></div><p style={{ margin: "4px 0 0", color: C.muted, fontSize: 11, lineHeight: 1.45 }}>{driver.contributionPct}% contribution · {driver.direction}{driver.percentile !== null ? ` · ${driver.percentile}th percentile (n=${driver.percentileN})` : " · percentile unavailable"}</p></div>)}</div></section><section style={{ border: `1px solid ${C.border}`, borderRadius: 10, padding: 16, background: C.card }}><Label color={C.green}>DATA TRANSPARENCY</Label><p style={{ margin: "8px 0 0", color: C.muted, fontSize: 12, lineHeight: 1.6 }}><Database size={13} style={{ verticalAlign: "-2px", marginRight: 5 }} />Pressure history: {data.meta.pressureHistoryN} monthly observations. Audit runs: {data.meta.pressureRunsN}. Computed: {new Date(data.meta.computedAt).toLocaleString()}.</p></section></aside>
      </section>
      <section style={{ maxWidth: 1240, margin: "18px auto", display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))", gap: 14 }}><div style={{ border: `1px solid ${C.border}`, borderRadius: 10, padding: 16, background: C.card }}><Label>RECORDED HISTORICAL CONTEXT</Label><p style={{ margin: "8px 0 0", color: C.muted, fontSize: 12, lineHeight: 1.6 }}>{data.marketStory}</p></div><div style={{ border: `1px solid ${C.border}`, borderRadius: 10, padding: 16, background: C.card }}><Label color={C.amber}>REFERENCE-SET OUTCOMES</Label><p style={{ margin: "8px 0 0", color: C.muted, fontSize: 12, lineHeight: 1.6 }}>{data.outcomeStats.disclaimer}</p><p style={{ margin: "8px 0 0", color: C.text, fontSize: 12 }}>Reference periods: {data.outcomeStats.sampleSize} · Average drawdown: {data.outcomeStats.avgDrawdownPct == null ? "UNAVAILABLE" : `${data.outcomeStats.avgDrawdownPct}%`} · Average recovery: {data.outcomeStats.avgRecoveryMonths == null ? "UNAVAILABLE" : `${data.outcomeStats.avgRecoveryMonths} months`}</p></div></section>
      <footer style={{ maxWidth: 1240, margin: "0 auto", borderTop: `1px solid ${C.border}`, padding: "14px 0 30px", display: "flex", gap: 8, alignItems: "flex-start" }}><ShieldAlert size={15} color={C.amber} /><p style={{ margin: 0, color: C.dim, font: `10px ${C.mono}`, lineHeight: 1.6 }}>DATA BOUNDARY · Current values are current observations. Reference-period descriptions are retrospective context. No current path is projected; no FAULTLINE events are backfilled, manufactured, or repositioned; no reference outcome is a recommendation or forecast.</p></footer>
    </>}
  </main>;
}
