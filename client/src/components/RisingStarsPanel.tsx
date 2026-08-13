import { Activity, AlertTriangle, ChevronRight, Eye, Sparkles, TrendingUp } from "lucide-react";

export interface RisingStarItem {
  ticker: string;
  name: string;
  risingStarScore: number;
  socialDiscovery: { status: "live" | "unavailable"; score: number | null; stage: string; note: string };
  insiderConviction: { status: "live" | "unavailable"; score: number | null; note: string };
  optionsConviction: { status: "live" | "unavailable"; score: number | null; note: string };
  crossSignalConfidence: "LOW" | "MODERATE" | "HIGH" | "VERY HIGH";
  informationLead: "LOW" | "MODERATE" | "HIGH" | "UNAVAILABLE";
  crowdingRisk: "LOW" | "ELEVATED" | "HIGH" | "UNAVAILABLE";
  whySeeingItEarly: string[];
  dataNotes: string[];
}

const confidenceColor: Record<RisingStarItem["crossSignalConfidence"], string> = {
  LOW: "#94A3B8",
  MODERATE: "#FACC15",
  HIGH: "#22C55E",
  "VERY HIGH": "#00D4FF",
};

const leadColor: Record<RisingStarItem["informationLead"], string> = {
  LOW: "#94A3B8",
  MODERATE: "#FACC15",
  HIGH: "#22C55E",
  UNAVAILABLE: "#64748B",
};

const crowdingColor: Record<RisingStarItem["crowdingRisk"], string> = {
  LOW: "#22C55E",
  ELEVATED: "#F59E0B",
  HIGH: "#F87171",
  UNAVAILABLE: "#64748B",
};

function Score({ value }: { value: number }) {
  const color = value >= 70 ? "#22C55E" : value >= 55 ? "#FACC15" : "#94A3B8";
  return (
    <div style={{ width: 46, height: 46, borderRadius: "50%", display: "grid", placeItems: "center", flexShrink: 0, border: `1px solid ${color}55`, background: `${color}12`, color, fontFamily: "'Rajdhani', sans-serif", fontWeight: 800, fontSize: 18, boxShadow: `0 0 18px ${color}16` }}>
      {value}
    </div>
  );
}

function Metric({ label, value, tone = "#B0C4D8", title }: { label: string; value: string; tone?: string; title?: string }) {
  return (
    <div title={title} style={{ minWidth: 0, padding: "7px 8px", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 4, background: "rgba(255,255,255,0.018)" }}>
      <div style={{ color: "rgba(148,163,184,0.48)", fontFamily: "'IBM Plex Mono', monospace", fontSize: 8, letterSpacing: "0.09em", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{label}</div>
      <div style={{ color: tone, fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, fontWeight: 700, letterSpacing: "0.035em", marginTop: 3, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{value}</div>
    </div>
  );
}

function ComponentScore({ label, component }: { label: string; component: { status: "live" | "unavailable"; score: number | null; note: string } }) {
  const value = component.status === "live" && component.score != null ? `${(component.score / 10).toFixed(1)}/10` : "NOT CONNECTED";
  return <Metric label={label} value={value} tone={component.status === "live" ? "#00D4FF" : "#64748B"} title={component.note} />;
}

export default function RisingStarsPanel({ items, onAnalyze }: { items: RisingStarItem[]; onAnalyze: (ticker: string) => void }) {
  return (
    <section style={{ marginBottom: 22, border: "1px solid rgba(0,212,255,0.18)", borderRadius: 8, overflow: "hidden", background: "linear-gradient(135deg, rgba(0,212,255,0.06), rgba(8,10,14,0.96) 42%)" }}>
      <div style={{ padding: "14px 16px", borderBottom: "1px solid rgba(0,212,255,0.12)", display: "flex", justifyContent: "space-between", gap: 14, alignItems: "flex-start", flexWrap: "wrap" }}>
        <div>
          <div style={{ display: "flex", gap: 8, alignItems: "center", color: "#00D4FF", fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, fontWeight: 700, letterSpacing: "0.13em" }}>
            <Sparkles size={14} /> RISING STARS
          </div>
          <p style={{ margin: "5px 0 0", maxWidth: 760, color: "rgba(176,196,216,0.64)", fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, lineHeight: 1.55 }}>
            Information-lead candidates within the current tracked coverage set. Scores combine verified price/volume structure, current macro alignment, and multi-source social evidence when available. Unconnected insider and options feeds are excluded—not estimated.
          </p>
        </div>
        <div style={{ color: "rgba(148,163,184,0.48)", fontFamily: "'IBM Plex Mono', monospace", fontSize: 8, letterSpacing: "0.09em", paddingTop: 3 }}>NOT A WHOLE-MARKET SCAN</div>
      </div>

      {items.length === 0 ? (
        <div style={{ padding: 16, display: "flex", alignItems: "flex-start", gap: 9, color: "rgba(148,163,184,0.65)", fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, lineHeight: 1.5 }}>
          <AlertTriangle size={14} color="#F59E0B" style={{ flexShrink: 0, marginTop: 1 }} />
          Rising Stars requires completed daily price/volume bars from the configured market-data provider. No candidate is ranked until that source is available.
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 1, background: "rgba(0,212,255,0.09)" }}>
          {items.map(item => (
            <article key={item.ticker} style={{ padding: 14, background: "rgba(7,10,15,0.98)", minWidth: 0 }}>
              <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                <Score value={item.risingStarScore} />
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 7, flexWrap: "wrap" }}>
                    <span style={{ color: "#F0F4FF", fontFamily: "'Rajdhani', sans-serif", fontSize: 19, fontWeight: 800, letterSpacing: "0.05em" }}>{item.ticker}</span>
                    <span style={{ color: leadColor[item.informationLead], background: `${leadColor[item.informationLead]}16`, border: `1px solid ${leadColor[item.informationLead]}30`, borderRadius: 3, padding: "2px 5px", fontFamily: "'IBM Plex Mono', monospace", fontSize: 8, fontWeight: 700, letterSpacing: "0.08em" }}>INFO LEAD {item.informationLead}</span>
                  </div>
                  <div style={{ marginTop: 2, color: "rgba(148,163,184,0.52)", fontFamily: "'IBM Plex Mono', monospace", fontSize: 9, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{item.name}</div>
                </div>
                <button onClick={() => onAnalyze(item.ticker)} style={{ background: "rgba(0,212,255,0.08)", border: "1px solid rgba(0,212,255,0.28)", color: "#00D4FF", cursor: "pointer", borderRadius: 3, padding: "5px 7px", display: "grid", placeItems: "center" }} aria-label={`Analyze ${item.ticker}`}><ChevronRight size={14} /></button>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 5, marginTop: 12 }}>
                <ComponentScore label="SOCIAL DISCOVERY" component={item.socialDiscovery} />
                <ComponentScore label="INSIDER CONVICTION" component={item.insiderConviction} />
                <ComponentScore label="OPTIONS CONVICTION" component={item.optionsConviction} />
                <Metric label="CROSS-SIGNAL" value={item.crossSignalConfidence} tone={confidenceColor[item.crossSignalConfidence]} />
                <Metric label="CROWDING RISK" value={item.crowdingRisk} tone={crowdingColor[item.crowdingRisk]} />
                <Metric label="SCORE BASIS" value="VERIFIED INPUTS" tone="#B0C4D8" />
              </div>

              <div style={{ marginTop: 12, borderLeft: "2px solid rgba(0,212,255,0.55)", paddingLeft: 8 }}>
                <div style={{ color: "rgba(0,212,255,0.74)", fontFamily: "'IBM Plex Mono', monospace", fontSize: 8, fontWeight: 700, letterSpacing: "0.1em", marginBottom: 5 }}>WHY FAULTLINE IS SEEING IT EARLY</div>
                {item.whySeeingItEarly.length > 0 ? item.whySeeingItEarly.slice(0, 4).map(reason => (
                  <div key={reason} style={{ color: "rgba(176,196,216,0.7)", fontFamily: "'IBM Plex Mono', monospace", fontSize: 9, lineHeight: 1.5, marginTop: 2, display: "flex", gap: 5 }}><TrendingUp size={10} color="#00D4FF" style={{ flexShrink: 0, marginTop: 2 }} />{reason}</div>
                )) : <div style={{ color: "rgba(148,163,184,0.55)", fontFamily: "'IBM Plex Mono', monospace", fontSize: 9 }}>The available signals do not yet show a high-conviction early-lead pattern.</div>}
              </div>

              {item.dataNotes.length > 0 && (
                <div style={{ marginTop: 10, padding: "7px 8px", border: "1px solid rgba(148,163,184,0.12)", borderRadius: 3, background: "rgba(148,163,184,0.035)", color: "rgba(148,163,184,0.55)", fontFamily: "'IBM Plex Mono', monospace", fontSize: 8, lineHeight: 1.45 }}>
                  <span style={{ color: "rgba(148,163,184,0.8)", letterSpacing: "0.08em" }}><Activity size={9} style={{ display: "inline", verticalAlign: "-1px", marginRight: 4 }} />DATA COVERAGE: </span>{item.dataNotes.join(" ")}
                </div>
              )}
              <button onClick={() => onAnalyze(item.ticker)} style={{ marginTop: 10, width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "7px 9px", borderRadius: 3, border: "1px solid rgba(0,212,255,0.22)", background: "rgba(0,212,255,0.05)", color: "#00D4FF", cursor: "pointer", fontFamily: "'IBM Plex Mono', monospace", fontSize: 9, fontWeight: 700, letterSpacing: "0.1em" }}><Eye size={11} /> ANALYZE SETUP</button>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
