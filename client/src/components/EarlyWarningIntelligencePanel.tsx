import { useState } from "react";
import { Activity, ChevronDown, ChevronUp, ShieldCheck, TrendingDown } from "lucide-react";
import { trpc } from "@/lib/trpc";

const lifecycleColor: Record<string, string> = {
  EMERGING: "#FACC15",
  DEVELOPING: "#FB923C",
  CONFIRMING: "#F97316",
  ELEVATED: "#EF4444",
  FADING: "#60A5FA",
  INVALIDATED: "#94A3B8",
};

function timeLabel(value: string | Date) {
  return new Date(value).toLocaleString(undefined, { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export default function EarlyWarningIntelligencePanel() {
  const current = trpc.marketState.earlyWarningsCurrent.useQuery(undefined, { staleTime: 30_000 });
  const [selectedWarningId, setSelectedWarningId] = useState<string | null>(null);
  const history = trpc.marketState.earlyWarningHistory.useQuery({ warningId: selectedWarningId ?? "" }, { enabled: !!selectedWarningId });

  if (current.isLoading) return <section aria-label="Early Warning Intelligence" style={{ border: "1px solid rgba(251,146,60,0.18)", borderRadius: 10, padding: "16px 18px", background: "linear-gradient(120deg, rgba(124,45,18,0.13), rgba(2,8,18,0.75))" }}><div style={{ color: "rgba(251,191,36,0.72)", fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, letterSpacing: "0.18em" }}>EARLY WARNING INTELLIGENCE™ · VERIFYING GOVERNED SYNTHESIS</div></section>;
  if (!current.data) return null;

  const warnings = current.data.qualifiedWarnings;
  if (!warnings.length) return (
    <section aria-label="Early Warning Intelligence" style={{ border: "1px solid rgba(34,211,238,0.16)", borderRadius: 10, padding: "16px 18px", background: "linear-gradient(120deg, rgba(8,47,73,0.16), rgba(2,8,18,0.78))" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 9 }}><ShieldCheck size={16} color="#22D3EE" /><span style={{ color: "#C7F9FF", fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, letterSpacing: "0.18em" }}>EARLY WARNING INTELLIGENCE™</span></div>
      <div style={{ marginTop: 10, color: "#E2E8F0", fontFamily: "'Rajdhani', sans-serif", fontSize: 19, fontWeight: 700 }}>NO MATERIAL EARLY WARNING</div>
      <p style={{ margin: "5px 0 0", color: "rgba(203,213,225,0.72)", fontSize: 13, lineHeight: 1.55 }}>No persistent, sufficiently independent governed relationship currently meets the qualification standard. This is an integrity outcome, not missing data.</p>
    </section>
  );

  return (
    <section aria-label="Early Warning Intelligence" style={{ border: "1px solid rgba(249,115,22,0.35)", borderRadius: 10, overflow: "hidden", background: "linear-gradient(125deg, rgba(69,26,3,0.28), rgba(8,12,22,0.9) 52%, rgba(2,8,18,0.9))", boxShadow: "0 0 34px rgba(249,115,22,0.08)" }}>
      <div style={{ padding: "13px 18px", borderBottom: "1px solid rgba(249,115,22,0.18)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 9 }}><Activity size={16} color="#FB923C" /><span style={{ color: "#FED7AA", fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, letterSpacing: "0.18em" }}>EARLY WARNING INTELLIGENCE™</span></div>
        <span style={{ color: "rgba(254,215,170,0.62)", fontFamily: "'IBM Plex Mono', monospace", fontSize: 9, letterSpacing: "0.12em" }}>{warnings.length} MATERIAL {warnings.length === 1 ? "WARNING" : "WARNINGS"}</span>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(270px, 1fr))", gap: 1, background: "rgba(249,115,22,0.14)" }}>
        {warnings.map(warning => {
          const expanded = selectedWarningId === warning.warningId;
          const color = lifecycleColor[warning.lifecycleState ?? "EMERGING"] ?? "#FB923C";
          return <article key={warning.warningId} style={{ background: "rgba(7,13,24,0.96)", padding: "17px 18px" }}>
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10 }}>
              <div><div style={{ color, fontFamily: "'IBM Plex Mono', monospace", fontSize: 9, letterSpacing: "0.15em", fontWeight: 700 }}>{warning.lifecycleState}</div><h3 style={{ margin: "6px 0 0", color: "#F8FAFC", fontFamily: "'Rajdhani', sans-serif", fontSize: 20, lineHeight: 1.02, letterSpacing: "0.03em" }}>{warning.title}</h3></div>
              <div style={{ textAlign: "right", flexShrink: 0 }}><div style={{ color: "#FDBA74", fontFamily: "'IBM Plex Mono', monospace", fontSize: 20, fontWeight: 700 }}>{warning.compositeWarningScore}<span style={{ color: "rgba(253,186,116,0.55)", fontSize: 10 }}>/100</span></div><div style={{ color: "rgba(203,213,225,0.52)", fontFamily: "'IBM Plex Mono', monospace", fontSize: 8, letterSpacing: "0.08em" }}>PRIORITY SCORE</div></div>
            </div>
            <p style={{ margin: "13px 0 0", color: "rgba(226,232,240,0.82)", fontSize: 13, lineHeight: 1.5 }}><strong style={{ color: "#FED7AA" }}>Developing relationship:</strong> {warning.participatingEngines.join(" / ")} remain directionally divergent across the governed synthesis.</p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 12, fontFamily: "'IBM Plex Mono', monospace", fontSize: 9 }}>
              <div style={{ color: "rgba(203,213,225,0.65)" }}>FIRST DETECTED<br /><span style={{ color: "#E2E8F0" }}>{timeLabel(warning.firstObservedAt)}</span></div>
              <div style={{ color: "rgba(203,213,225,0.65)" }}>DATA CONFIDENCE<br /><span style={{ color }}>{warning.dataConfidence}</span></div>
            </div>
            {warning.marketContext && <div style={{ marginTop: 10, color: "rgba(203,213,225,0.6)", fontFamily: "'IBM Plex Mono', monospace", fontSize: 9, letterSpacing: "0.06em" }}>ORIGINAL MARKET CONTEXT · PRESSURE {warning.marketContext.pressureIndex ?? "UNAVAILABLE"} · {warning.marketContext.regime ?? "REGIME UNAVAILABLE"}</div>}
            <button type="button" onClick={() => setSelectedWarningId(expanded ? null : warning.warningId)} style={{ marginTop: 14, color: "#FDBA74", background: "transparent", border: "none", padding: 0, cursor: "pointer", fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, letterSpacing: "0.12em", display: "inline-flex", alignItems: "center", gap: 5 }}>{expanded ? "HIDE WARNING DETAIL" : "VIEW FULL WARNING"}{expanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}</button>
            {expanded && <div style={{ marginTop: 13, borderTop: "1px solid rgba(148,163,184,0.14)", paddingTop: 12 }}>
              <div style={{ color: "rgba(203,213,225,0.62)", fontFamily: "'IBM Plex Mono', monospace", fontSize: 9, letterSpacing: "0.1em" }}>WHAT CONFIRMS IT</div><p style={{ margin: "5px 0 10px", color: "rgba(226,232,240,0.8)", fontSize: 12 }}>{warning.confirmationConditions.join(" ")}</p>
              <div style={{ color: "rgba(203,213,225,0.62)", fontFamily: "'IBM Plex Mono', monospace", fontSize: 9, letterSpacing: "0.1em" }}>WHAT INVALIDATES IT</div><p style={{ margin: "5px 0 10px", color: "rgba(226,232,240,0.8)", fontSize: 12 }}>{warning.invalidationConditions.join(" ")}</p>
              <div style={{ color: "rgba(203,213,225,0.62)", fontFamily: "'IBM Plex Mono', monospace", fontSize: 9, letterSpacing: "0.1em" }}>LIVE VERIFIED EVOLUTION</div>
              {history.data?.observations?.length ? <ol style={{ margin: "8px 0 0", paddingLeft: 18, color: "rgba(226,232,240,0.76)", fontSize: 12, lineHeight: 1.65 }}>{history.data.observations.map(item => <li key={item.observationKey}>{timeLabel(item.observedAt)} · {item.lifecycleState.replaceAll("_", " ")} · {item.warningScore}/100</li>)}</ol> : <div style={{ marginTop: 7, color: "rgba(203,213,225,0.58)", fontSize: 12 }}>The original state-locked warning is preserved; later verified observations will append here as they occur.</div>}
              <div style={{ marginTop: 11, color: "rgba(148,163,184,0.5)", fontFamily: "'IBM Plex Mono', monospace", fontSize: 8, wordBreak: "break-all" }}>SYNTHESIS {warning.originatingSynthesisId} · STATE {warning.originatingStateId}</div>
            </div>}
          </article>;
        })}
      </div>
      <div style={{ padding: "10px 18px", color: "rgba(203,213,225,0.52)", fontFamily: "'IBM Plex Mono', monospace", fontSize: 8, letterSpacing: "0.07em" }}><TrendingDown size={11} style={{ display: "inline", verticalAlign: "-2px", marginRight: 5 }} />EARLY WARNING SCORE IS A GOVERNED PRIORITIZATION SCORE, NOT A PROBABILITY OF ANY MARKET OUTCOME.</div>
    </section>
  );
}
