import { useLocation } from "wouter";
import { ArrowLeft, BrainCircuit, ChevronRight, Clock, RefreshCw, Sparkles } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useSEO } from "@/hooks/useSEO";
import RisingStarsPanel, { type RisingStarItem } from "@/components/RisingStarsPanel";

type StandaloneStar = RisingStarItem & {
  latestPrice: number;
  dailyChange: number | null;
  dailyChangePercent: number | null;
  signalDirection: "CONSTRUCTIVE" | "WATCH";
  signalStrength: "LOW" | "MODERATE" | "HIGH" | "VERY HIGH";
  momentumScore: number;
  relativeStrengthScore: number;
  volumeParticipationScore: number;
  riskLevel: "MODERATE" | "ELEVATED";
  macroContext: string;
  marketDataAsOf: number;
};

function price(value: number) {
  return value >= 1000
    ? value.toLocaleString("en-US", { maximumFractionDigits: 2 })
    : value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function scoreColor(value: number) {
  return value >= 70 ? "#00FF88" : value >= 50 ? "#FACC15" : "#94A3B8";
}

function DetailCard({ item, onAnalyze }: { item: StandaloneStar; onAnalyze: () => void }) {
  const changeColor = item.dailyChangePercent == null ? "#64748B" : item.dailyChangePercent >= 0 ? "#00FF88" : "#FF6B6B";
  const formatTime = (value: number) => new Date(value).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
  const metrics = [
    ["MOMENTUM", item.momentumScore],
    ["REL. STRENGTH", item.relativeStrengthScore],
    ["VOLUME / PARTICIPATION", item.volumeParticipationScore],
  ] as const;
  return (
    <article style={{ border: "1px solid rgba(0,212,255,0.16)", borderRadius: 8, background: "rgba(7,10,15,0.94)", overflow: "hidden" }}>
      <div style={{ padding: "15px 16px", display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
        <div>
          <div style={{ display: "flex", gap: 8, alignItems: "baseline", flexWrap: "wrap" }}>
            <strong style={{ color: "#F0F4FF", fontFamily: "'Rajdhani', sans-serif", fontSize: 22, letterSpacing: "0.06em" }}>{item.ticker}</strong>
            <span style={{ color: "rgba(176,196,216,0.55)", fontFamily: "'IBM Plex Mono', monospace", fontSize: 10 }}>{item.name}</span>
          </div>
          <div style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 7, flexWrap: "wrap" }}>
            <span style={{ color: "#E7EEF8", fontFamily: "'IBM Plex Mono', monospace", fontWeight: 700, fontSize: 16 }}>${price(item.latestPrice)}</span>
            <span style={{ color: changeColor, fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, fontWeight: 700 }}>{item.dailyChangePercent == null ? "DAILY CHANGE UNAVAILABLE" : `${item.dailyChange! >= 0 ? "+" : ""}${item.dailyChange!.toFixed(2)} · ${item.dailyChangePercent >= 0 ? "+" : ""}${item.dailyChangePercent.toFixed(2)}%`}</span>
          </div>
        </div>
        <div style={{ textAlign: "right", flexShrink: 0 }}>
          <div style={{ color: scoreColor(item.risingStarScore), fontFamily: "'Rajdhani', sans-serif", fontSize: 28, fontWeight: 800 }}>{item.risingStarScore}</div>
          <div style={{ color: "rgba(148,163,184,0.55)", fontFamily: "'IBM Plex Mono', monospace", fontSize: 8, letterSpacing: "0.1em" }}>RISING STAR SCORE</div>
        </div>
      </div>
      <div style={{ padding: 14 }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 7 }}>
          <div style={{ padding: "8px 9px", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 4 }}><div style={{ color: "rgba(148,163,184,0.52)", fontFamily: "'IBM Plex Mono', monospace", fontSize: 8 }}>SIGNAL</div><div style={{ color: item.signalDirection === "CONSTRUCTIVE" ? "#00FF88" : "#FACC15", fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, fontWeight: 700, marginTop: 4 }}>{item.signalDirection}</div></div>
          <div style={{ padding: "8px 9px", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 4 }}><div style={{ color: "rgba(148,163,184,0.52)", fontFamily: "'IBM Plex Mono', monospace", fontSize: 8 }}>CONFIDENCE</div><div style={{ color: "#00D4FF", fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, fontWeight: 700, marginTop: 4 }}>{item.signalStrength}</div></div>
          <div style={{ padding: "8px 9px", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 4 }}><div style={{ color: "rgba(148,163,184,0.52)", fontFamily: "'IBM Plex Mono', monospace", fontSize: 8 }}>RISK</div><div style={{ color: item.riskLevel === "ELEVATED" ? "#F59E0B" : "#A7F3D0", fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, fontWeight: 700, marginTop: 4 }}>{item.riskLevel}</div></div>
          {metrics.map(([label, value]) => <div key={label} style={{ padding: "8px 9px", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 4 }}><div style={{ color: "rgba(148,163,184,0.52)", fontFamily: "'IBM Plex Mono', monospace", fontSize: 8 }}>{label}</div><div style={{ color: scoreColor(value), fontFamily: "'IBM Plex Mono', monospace", fontSize: 12, fontWeight: 700, marginTop: 4 }}>{Math.round(value)}/100</div></div>)}
        </div>
        <p style={{ margin: "12px 0 0", color: "rgba(176,196,216,0.72)", fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, lineHeight: 1.6 }}>{item.macroContext}</p>
        <div style={{ marginTop: 10, color: "rgba(148,163,184,0.5)", fontFamily: "'IBM Plex Mono', monospace", fontSize: 8, display: "flex", alignItems: "center", gap: 5 }}><Clock size={10} /> Price data from latest completed daily bar · {formatTime(item.marketDataAsOf)}</div>
        <button onClick={onAnalyze} style={{ marginTop: 12, width: "100%", padding: "9px", borderRadius: 4, border: "1px solid rgba(0,212,255,0.3)", background: "rgba(0,212,255,0.06)", color: "#00D4FF", cursor: "pointer", fontFamily: "'IBM Plex Mono', monospace", fontSize: 9, fontWeight: 700, letterSpacing: "0.1em" }}>OPEN SYMBOL INTELLIGENCE <ChevronRight size={12} style={{ display: "inline", verticalAlign: "-2px" }} /></button>
      </div>
    </article>
  );
}

export default function RisingStars() {
  useSEO({ title: "Rising Stars | FAULTLINE", description: "Source-backed market candidates showing constructive technical structure and current FAULTLINE context.", canonical: "/app/rising-stars" });
  const [, navigate] = useLocation();
  const query = trpc.outlook.getOpportunityDiscovery.useQuery(undefined, { staleTime: 2 * 60 * 1000, refetchInterval: 5 * 60 * 1000, retry: 2, retryDelay: attempt => Math.min(1_000 * (attempt + 1), 3_000) });
  const items = (query.data?.risingStars ?? []) as StandaloneStar[];
  const analyze = (ticker: string) => navigate(`/app/stock/${ticker}`);

  return <main style={{ minHeight: "100vh", background: "#050608", color: "#F0F4FF", padding: "24px 16px 90px" }}>
    <div style={{ maxWidth: 1320, margin: "0 auto" }}>
      <button onClick={() => navigate("/app/signals?view=rising-stars")} style={{ background: "transparent", border: "none", padding: 0, color: "rgba(176,196,216,0.62)", cursor: "pointer", fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, display: "inline-flex", alignItems: "center", gap: 6 }}><ArrowLeft size={13} /> BACK TO SIGNALS</button>
      <header style={{ display: "flex", justifyContent: "space-between", gap: 18, alignItems: "flex-end", flexWrap: "wrap", margin: "18px 0" }}>
        <div><div style={{ color: "#00D4FF", fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, letterSpacing: "0.15em" }}><Sparkles size={13} style={{ display: "inline", verticalAlign: "-2px", marginRight: 5 }} />INTELLIGENCE LAB</div><h1 style={{ margin: "7px 0 5px", fontFamily: "'Rajdhani', sans-serif", fontSize: 36, letterSpacing: "0.04em" }}>RISING STARS</h1><p style={{ maxWidth: 760, margin: 0, color: "rgba(176,196,216,0.67)", fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, lineHeight: 1.6 }}>Source-backed candidates inside the current tracked coverage set. Scores do not forecast returns; unavailable insider and options inputs remain excluded.</p></div>
        <div style={{ display: "flex", gap: 8 }}><button onClick={() => query.refetch()} style={{ padding: "8px 10px", borderRadius: 4, border: "1px solid rgba(0,212,255,0.24)", color: "#00D4FF", background: "rgba(0,212,255,0.05)", cursor: "pointer", fontFamily: "'IBM Plex Mono', monospace", fontSize: 9 }}><RefreshCw size={11} style={{ display: "inline", verticalAlign: "-2px", marginRight: 5 }} />REFRESH</button><button onClick={() => navigate("/app/asha")} style={{ padding: "8px 10px", borderRadius: 4, border: "1px solid rgba(167,139,250,0.3)", color: "#C4B5FD", background: "rgba(167,139,250,0.06)", cursor: "pointer", fontFamily: "'IBM Plex Mono', monospace", fontSize: 9 }}><BrainCircuit size={11} style={{ display: "inline", verticalAlign: "-2px", marginRight: 5 }} />ASK ASHA</button></div>
      </header>
      {query.isLoading ? <div style={{ padding: 18, color: "rgba(176,196,216,0.62)", fontFamily: "'IBM Plex Mono', monospace", fontSize: 10 }}>LOADING VERIFIED RISING STARS…</div> : query.isError ? <div style={{ padding: 18, border: "1px solid rgba(255,77,106,0.3)", color: "#FDA4AF", fontFamily: "'IBM Plex Mono', monospace", fontSize: 10 }}>RISING STARS DATA TEMPORARILY UNAVAILABLE. <button onClick={() => query.refetch()} style={{ color: "#00D4FF", background: "none", border: "none", cursor: "pointer", textDecoration: "underline" }}>RETRY</button></div> : <><RisingStarsPanel items={items} onAnalyze={analyze} /><section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(310px, 1fr))", gap: 12 }}>{items.map(item => <DetailCard key={item.ticker} item={item} onAnalyze={() => analyze(item.ticker)} />)}</section></>}
    </div>
  </main>;
}
