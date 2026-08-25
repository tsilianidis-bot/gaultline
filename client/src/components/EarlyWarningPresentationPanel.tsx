import { Link } from "wouter";
import { Activity, AlertTriangle, CheckCircle2, Clock3, ShieldCheck } from "lucide-react";
import { trpc } from "@/lib/trpc";

type PanelMode = "home" | "watch" | "detail" | "compact";

const lifecycleColor: Record<string, string> = {
  EMERGING: "#FBBF24", DEVELOPING: "#FB923C", CONFIRMING: "#F97316", FADING: "#A78BFA", INVALIDATED: "#94A3B8",
};

function StatusLine({ label, status, detail }: { label: string; status: string; detail?: string }) {
  const color = status === "AUTHORIZED" ? "#F97316" : status === "CONFLICTED_CONDITIONS" ? "#FBBF24" : "#94A3B8";
  return <div style={{ padding: "10px 0", borderTop: "1px solid rgba(255,255,255,.08)" }}>
    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, letterSpacing: ".12em" }}><span style={{ color: "#64748B" }}>{label}</span><span style={{ color }}>{status.replaceAll("_", " ")}</span></div>
    {detail && <div style={{ color: "#9FB0C4", fontSize: 12, lineHeight: 1.5, marginTop: 6 }}>{detail}</div>}
  </div>;
}

export function EarlyWarningPresentationPanel({ mode = "home" }: { mode?: PanelMode }) {
  const warning = trpc.marketState.earlyWarningPresentationCurrent.useQuery(undefined, { staleTime: 30_000, refetchOnWindowFocus: false });
  const timeline = trpc.marketState.earlyWarningPresentationTimeline.useQuery(undefined, { staleTime: 30_000, refetchOnWindowFocus: false, enabled: mode === "detail" });
  if (warning.isLoading) return <div style={{ height: 120, border: "1px solid rgba(0,229,255,.16)", background: "rgba(0,229,255,.025)", borderRadius: 8, marginBottom: 16 }} />;
  if (warning.isError || !warning.data) return <div style={{ padding: 14, border: "1px solid rgba(148,163,184,.25)", borderRadius: 8, color: "#94A3B8", fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, letterSpacing: ".1em" }}>WARNING DATA TEMPORARILY UNAVAILABLE</div>;
  const presentation = warning.data;
  if (presentation.kind === "NO_MATERIAL_EARLY_WARNING") return <section data-phase10-presentation-id={presentation.presentationId} style={{ border: "1px solid rgba(0,229,255,.22)", background: "linear-gradient(130deg, rgba(0,229,255,.06), rgba(8,10,15,.96))", borderRadius: 8, padding: "18px", marginBottom: 16 }}>
    <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#00E5FF", fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, letterSpacing: ".16em" }}><ShieldCheck size={14} /> EARLY WARNING INTELLIGENCE™</div>
    <div style={{ color: "#E5F4FF", fontSize: 20, marginTop: 12, fontFamily: "'Rajdhani', sans-serif", fontWeight: 700, letterSpacing: ".04em" }}>NO MATERIAL EARLY WARNING</div>
    <p style={{ color: "#AAB9CA", lineHeight: 1.6, fontSize: 13, margin: "8px 0 0" }}>{presentation.message}</p>
    <p style={{ color: "#64748B", lineHeight: 1.5, fontSize: 11, margin: "8px 0 0" }}>{presentation.limitations[0]}</p>
  </section>;
  const color = lifecycleColor[presentation.lifecycleState] ?? "#00E5FF";
  const isDetail = mode === "detail";
  return <section data-phase10-presentation-id={presentation.presentationId} data-warning-id={presentation.warningId} style={{ border: `1px solid ${color}55`, background: "linear-gradient(145deg, rgba(12,15,22,.98), rgba(5,7,12,.98))", borderRadius: 8, overflow: "hidden", marginBottom: 16, boxShadow: `0 0 28px ${color}12` }}>
    <div style={{ height: 2, background: `linear-gradient(90deg, ${color}, transparent)` }} />
    <div style={{ padding: isDetail ? "22px" : "16px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start", flexWrap: "wrap" }}>
        <div><div style={{ display: "flex", alignItems: "center", gap: 7, color, fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, letterSpacing: ".15em" }}><AlertTriangle size={13} /> EARLY WARNING INTELLIGENCE™</div><h2 style={{ margin: "9px 0 3px", color: "#F1F7FF", fontFamily: "'Rajdhani', sans-serif", fontSize: isDetail ? 28 : 22, letterSpacing: ".03em" }}>{presentation.conciseTitle}</h2><p style={{ margin: 0, color: "#9FB0C4", fontSize: 12, lineHeight: 1.55 }}>{presentation.conciseSummary}</p></div>
        <div style={{ border: `1px solid ${color}45`, background: `${color}10`, padding: "7px 10px", borderRadius: 4, color, fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, letterSpacing: ".12em" }}>{presentation.lifecycleState}</div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(105px,1fr))", gap: 8, margin: "16px 0" }}>
        {[ ["EARLY WARNING SCORE", `${presentation.warningScore} / 100`], ["FIRST DETECTED", new Date(presentation.firstObservedAt).toLocaleDateString()], ["DURATION", `${presentation.durationDays} days`], ["TREND", presentation.trend], ["DATA CONFIDENCE", presentation.dataConfidence] ].map(([label, value]) => <div key={label} style={{ padding: 10, background: "rgba(255,255,255,.025)", border: "1px solid rgba(255,255,255,.07)", borderRadius: 4 }}><div style={{ color: "#64748B", fontFamily: "'IBM Plex Mono', monospace", fontSize: 9, letterSpacing: ".1em" }}>{label}</div><div style={{ color: label === "EARLY WARNING SCORE" ? color : "#DCE8F5", fontFamily: "'Rajdhani', sans-serif", fontWeight: 700, fontSize: 16, marginTop: 4 }}>{value}</div></div>) }
      </div>
      <div style={{ color: "#64748B", fontSize: 11, marginBottom: 12 }}>Early Warning Score is a prioritization score, not probability.</div>
      <StatusLine label="CONFIRMATION STATUS" status={presentation.confirmationStatus} detail={presentation.confirmationStatus === "AUTHORIZED" ? "Additional governed structural evidence supports the warning thesis. This is not a forecast." : undefined} />
      <StatusLine label="INVALIDATION STATUS" status={presentation.invalidationStatus} detail={presentation.invalidationStatus === "AUTHORIZED" ? "Governed contradictory evidence terminated the lifecycle episode. This is not an opposite forecast." : undefined} />
      {isDetail && <>
        <div style={{ borderTop: "1px solid rgba(255,255,255,.08)", paddingTop: 12, marginTop: 2 }}><div style={{ color: "#64748B", fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, letterSpacing: ".12em" }}>WHAT FAULTLINE DETECTED</div><p style={{ color: "#B7C6D7", fontSize: 13, lineHeight: 1.65 }}>{presentation.thesis.statement}</p></div>
        <div style={{ borderTop: "1px solid rgba(255,255,255,.08)", paddingTop: 12 }}><div style={{ color: "#64748B", fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, letterSpacing: ".12em" }}>SOURCE FRESHNESS & PROVENANCE</div><p style={{ color: "#B7C6D7", fontSize: 12, lineHeight: 1.65 }}>Freshness: {presentation.freshness}. Canonical state: {presentation.stateId}. Synthesis: {presentation.synthesisId}. Presentation: {presentation.presentationId}.</p></div>
        <div style={{ borderTop: "1px solid rgba(255,255,255,.08)", paddingTop: 12 }}><div style={{ color: "#64748B", fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, letterSpacing: ".12em" }}>IMMUTABLE LIFECYCLE TIMELINE</div>{timeline.data && timeline.data.length > 0 ? <div style={{ marginTop: 8, display: "grid", gap: 6 }}>{timeline.data.map(entry => <div key={entry.timelineEntryId} style={{ display: "grid", gridTemplateColumns: "120px 1fr", gap: 10, padding: "7px 0", borderTop: "1px solid rgba(255,255,255,.05)", color: "#AAB9CA", fontSize: 11 }}><span style={{ color: "#64748B", fontFamily: "'IBM Plex Mono', monospace" }}>{new Date(entry.effectiveAt).toLocaleString()}</span><span><strong style={{ color }}>{entry.lifecycleState}</strong> · {entry.reasonCode.replaceAll("_", " ")} · {entry.dataQuality}</span></div>)}</div> : <p style={{ color: "#94A3B8", fontSize: 12, lineHeight: 1.5, margin: "7px 0 0" }}>No additional immutable lifecycle observations are available.</p>}</div>
        <div style={{ borderTop: "1px solid rgba(255,255,255,.08)", paddingTop: 12 }}><div style={{ color: "#64748B", fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, letterSpacing: ".12em" }}>LIMITATIONS</div>{presentation.limitations.map(item => <p key={item} style={{ color: "#94A3B8", fontSize: 12, lineHeight: 1.5, margin: "6px 0" }}>{item}</p>)}</div>
      </>}
      {!isDetail && <Link href="/app/early-warning" style={{ display: "inline-flex", alignItems: "center", gap: 6, color, textDecoration: "none", fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, letterSpacing: ".13em", marginTop: 6 }}><Activity size={13} /> VIEW FULL WARNING</Link>}
      <div style={{ marginTop: 12, color: "#536475", fontFamily: "'IBM Plex Mono', monospace", fontSize: 9, letterSpacing: ".08em" }}>OBSERVED {new Date(presentation.observedAt).toLocaleString()} · FRESHNESS {presentation.freshness}</div>
    </div>
  </section>;
}
