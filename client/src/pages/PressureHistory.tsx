import { useMemo, useState } from "react";
import { Link } from "wouter";
import { UnifiedIntelligenceChart, type IntelligenceBar, type IntelligenceMarker } from "@/components/UnifiedIntelligenceChart";
import { trpc } from "@/lib/trpc";
import { CANONICAL_HOME } from "@shared/routeRegistry";

const ranges = [30, 90] as const;
const pressure = (n: number) => `${Math.round(n)} / 100`;
const colorFor = (severity?: string | null) => severity === "critical" ? "#FF4D6A" : severity === "high" ? "#FFAA00" : "#00D4FF";

export default function PressureHistory() {
  const [days, setDays] = useState<(typeof ranges)[number]>(90);
  const { data: readings = [], isLoading: readingsLoading } = trpc.seismograph.getReadingHistory.useQuery({ days });
  const { data: archive, isLoading: eventsLoading } = trpc.institutionalMemory.listEvents.useQuery({ limit: 100 });
  const [selected, setSelected] = useState<number | null>(null);
  const bars = useMemo<IntelligenceBar[]>(() => [...readings].reverse().map((r: any) => ({
    timestamp: new Date(`${r.readingDate}T16:00:00Z`).getTime(), open: r.pressureScore, high: r.pressureScore, low: r.pressureScore, close: r.pressureScore, volume: 0,
  })), [readings]);
  const events = archive?.events ?? [];
  const markers = useMemo<IntelligenceMarker[]>(() => events.map((e: any) => ({ eventAt: new Date(e.eventAt).getTime(), type: "LIVE VERIFIED", headline: e.headline, detail: e.explanation ?? undefined, color: colorFor(e.severity), score: e.pressureIndex, status: e.marketRegime })), [events]);
  const event = selected == null ? null : events.find((e: any) => e.id === selected);

  return <main style={{ minHeight: "100vh", background: "#050608", color: "#EAF5FF", padding: "28px clamp(16px,4vw,56px)", fontFamily: "IBM Plex Sans, sans-serif" }}>
    <header style={{ maxWidth: 1280, margin: "0 auto 22px" }}>
      <Link href={CANONICAL_HOME} style={{ color: "#00D4FF", fontSize: 11, fontFamily: "IBM Plex Mono,monospace", textDecoration: "none" }}>← HOME / DEEP DASHBOARD</Link>
      <p style={{ margin: "18px 0 4px", color: "#00D4FF", fontSize: 10, fontFamily: "IBM Plex Mono,monospace", letterSpacing: ".18em" }}>CANONICAL HISTORY · LIVE VERIFIED EVIDENCE</p>
      <h1 style={{ margin: 0, fontSize: "clamp(30px,5vw,54px)", fontFamily: "Rajdhani,sans-serif", letterSpacing: ".04em" }}>PRESSURE INDEX HISTORY</h1>
      <p style={{ maxWidth: 760, color: "#A6B6C7", fontSize: 14, lineHeight: 1.6 }}>What FAULTLINE saw, when it saw it, and—only after completed source windows—what was later observed. Original event records are immutable; outcome measurements are appended separately.</p>
    </header>
    <section style={{ maxWidth: 1280, margin: "0 auto", display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(280px,360px)", gap: 18 }}>
      <div style={{ minWidth: 0, border: "1px solid rgba(0,212,255,.2)", borderRadius: 10, background: "rgba(7,12,19,.86)", padding: 14 }}>
        <div style={{ display: "flex", gap: 8, alignItems: "center", justifyContent: "space-between", marginBottom: 10, flexWrap: "wrap" }}><b style={{ fontFamily: "IBM Plex Mono,monospace", fontSize: 11 }}>PRESSURE · COMPLETED DAILY SEISMOGRAPH READINGS</b><div>{ranges.map((r) => <button key={r} type="button" onClick={() => setDays(r)} style={{ marginLeft: 6, border: `1px solid ${days === r ? "#00D4FF" : "#304253"}`, borderRadius: 4, padding: "5px 9px", color: days === r ? "#00D4FF" : "#A6B6C7", background: "transparent", fontSize: 10 }}>{r}D</button>)}</div></div>
        {readingsLoading ? <p style={{ color: "#A6B6C7" }}>Loading completed source readings…</p> : <UnifiedIntelligenceChart bars={bars} markers={markers} mode="line" ariaLabel="Pressure Index history with immutable verified institutional event markers" formatValue={pressure} volumeLabel="DAILY PRESSURE OBSERVATIONS · COMPLETED SOURCE READINGS" />}
        <p style={{ color: "#718296", fontSize: 10, lineHeight: 1.5 }}>Markers are placed at their original immutable source timestamps. Hover or touch the chart for exact completed readings. No historical events are reconstructed, repositioned, or inferred.</p>
      </div>
      <aside style={{ border: "1px solid rgba(255,255,255,.1)", borderRadius: 10, padding: 16, background: "rgba(7,12,19,.86)" }}>
        <p style={{ margin: 0, color: "#FACC15", font: "10px IBM Plex Mono,monospace", letterSpacing: ".12em" }}>LIVE VERIFIED EVENTS</p>
        {eventsLoading ? <p style={{ color: "#A6B6C7" }}>Loading immutable archive…</p> : events.length === 0 ? <p style={{ color: "#A6B6C7", fontSize: 12 }}>No immutable events recorded in this window yet.</p> : events.map((e: any) => <button key={e.id} type="button" onClick={() => setSelected(e.id)} style={{ width: "100%", textAlign: "left", marginTop: 10, padding: 10, borderRadius: 6, border: `1px solid ${selected === e.id ? "#00D4FF" : "rgba(255,255,255,.1)"}`, background: "transparent", color: "#EAF5FF" }}><b style={{ fontSize: 12 }}>{e.headline}</b><br/><span style={{ color: "#A6B6C7", fontSize: 10 }}>{new Date(e.eventAt).toLocaleString()} · {pressure(e.pressureIndex)} · {e.marketRegime}</span></button>)}</aside>
    </section>
    {event && <section style={{ maxWidth: 1280, margin: "18px auto", border: "1px solid rgba(250,204,21,.35)", borderRadius: 10, padding: 18, background: "rgba(28,24,8,.3)" }}><p style={{ margin: 0, color: "#FACC15", font: "10px IBM Plex Mono,monospace" }}>ORIGINAL IMMUTABLE OBSERVATION</p><h2 style={{ margin: "6px 0" }}>{event.headline}</h2><p style={{ color: "#C8D6E5" }}>{event.explanation}</p><p style={{ color: "#A6B6C7", fontSize: 12 }}>Detected: {new Date(event.eventAt).toLocaleString()} · Original Pressure: {pressure(event.pressureIndex)} · Original Regime: {event.marketRegime} · Source: {event.sourceEngine}</p><h3 style={{ fontSize: 13 }}>APPENDED FOLLOW-THROUGH OBSERVATIONS</h3>{[1,5,20,60].map((h) => { const o = event.outcomes?.find((x:any) => x.horizonTradingDays === h); return <div key={h} style={{ display:"grid", gridTemplateColumns:"72px repeat(4,minmax(0,1fr))", gap:8, padding:"8px 0", borderTop:"1px solid rgba(255,255,255,.08)", fontSize:11 }}><b>{h}D</b>{o ? <><span>SPY {o.spyReturnPct == null ? "PENDING" : `${o.spyReturnPct.toFixed(2)}%`}</span><span>10Y {o.tenYearYieldChangeBps == null ? "PENDING" : `${o.tenYearYieldChangeBps.toFixed(1)} bp`}</span><span>PRESSURE {o.pressureIndexChange == null ? "PENDING" : `${o.pressureIndexChange > 0 ? "+" : ""}${o.pressureIndexChange}`}</span><span>REGIME {o.laterRegime ?? "PENDING"}</span></> : <span style={{ gridColumn:"span 4", color:"#A6B6C7" }}>PENDING · completed source window not yet available</span>}</div>; })}</section>}
  </main>;
}
