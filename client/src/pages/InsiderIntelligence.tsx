import { useState } from "react";
import { trpc } from "@/lib/trpc";
import PageHeader from "@/components/PageHeader";
import { useSEO, PAGE_SEO } from "@/hooks/useSEO";
import { trackInsiderSearch } from "@/hooks/useAnalytics";
import {
  AlertTriangle, ChevronDown, ChevronUp, Eye, RefreshCw, Search, Shield, Users, X,
} from "lucide-react";
import { PremiumGateFull } from "@/components/PremiumGate";

type ConvictionBand =
  | "Exceptional Conviction" | "Strong Conviction" | "Moderate Conviction"
  | "Neutral" | "Weak Conviction" | "Negative Insider Signal";
type SellingClassification = "Normal" | "Elevated" | "Aggressive" | "Unusual";

type RadarOutput = {
  radar: Array<{
    rank: number; ticker: string; company: string; convictionScore: number; convictionBand: ConvictionBand;
    activity: string; dollarAmount: number | null; signalColor: "green" | "yellow" | "red";
    trend: "unavailable";
  }>;
  clusterAlerts: Array<{
    ticker: string; company: string; insiderCount: number; totalCapital: number | null;
    strength: "MODERATE" | "HIGH" | "EXCEPTIONAL"; daysWindow: number; convictionScore: number;
    insiders: Array<{ name: string; role: string; amount: number | null }>;
  }>;
  topSellingAlerts: Array<{
    ticker: string; insiderName: string; role: string; saleAmount: number | null;
    percentOfHoldings: number | null; classification: SellingClassification; reason: string;
    isScheduledPlan: "disclosed" | "unknown"; isTaxRelated: true | "unknown"; isAbnormal: boolean | null;
    transactionCode: string; sourceUrl: string; accessionNumber: string;
  }>;
  weeklyStats: {
    totalBuyValue: number | null; totalSellValue: number | null; netSentiment: number | null;
    activeTickers: number; clusterCount: number; unclassifiedSellingCount: number;
  };
  observedAt: string | null;
};

type CompanyOutput = {
  profile: {
    company: string; dataStatus: "AVAILABLE" | "NO_ACTIVITY"; observedAt: string | null;
    convictionScore: number | null; convictionBand: ConvictionBand | null; impactPoints: number | null;
    buyVsSell: { buyCount: number; sellCount: number; buyValue: number | null; sellValue: number | null };
    mostRecentFiling: string | null;
    sellingAnalysis: Array<{
      insiderName: string; role: string; saleAmount: number | null; percentOfHoldings: number | null;
      classification: SellingClassification | null; reason: string; transactionCode: string;
      isScheduledPlan: "disclosed" | "unknown"; isTaxRelated: true | "unknown";
      sourceUrl: string; accessionNumber: string;
    }>;
  };
  timeline: Array<{
    date: string; type: "buy" | "sell" | "other"; role: string; amount: number | null; label: string;
    transactionCode: string; shares: number; pricePerShare: number | null; accessionNumber: string;
    sourceUrl: string; filingDate: string;
  }>;
};

type SourceStatus = { status: "UNAVAILABLE"; reason: string } | null;

/** Maps a tRPC source failure to an explicit display state; it never infers empty activity. */
function sourceStatusAdapter(error: unknown): SourceStatus {
  if (!error || typeof error !== "object") return null;
  const candidate = error as { message?: unknown; data?: { code?: unknown } };
  const code = candidate.data?.code;
  const message = typeof candidate.message === "string" ? candidate.message : "Insider Intelligence source is unavailable.";
  if (code === "SERVICE_UNAVAILABLE" || /unavailable|source verification|required|sec form 4/i.test(message)) {
    return { status: "UNAVAILABLE", reason: message };
  }
  return { status: "UNAVAILABLE", reason: "Insider Intelligence could not verify SEC Form 4 source data. Please retry later." };
}

function SourceUnavailable({ status }: { status: SourceStatus }) {
  if (!status) return null;
  return (
    <div role="alert" style={{ display: "flex", gap: "10px", alignItems: "flex-start", padding: "14px 16px", marginBottom: "10px", background: "rgba(255,149,0,0.07)", border: "1px solid rgba(255,149,0,0.35)", borderRadius: "6px" }}>
      <AlertTriangle size={16} color="#FF9500" style={{ marginTop: "1px", flexShrink: 0 }} />
      <div>
        <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "11px", color: "#FF9500", letterSpacing: "0.1em" }}>SEC FORM 4 SOURCE UNAVAILABLE</div>
        <div style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: "13px", color: "#CBD5E1", lineHeight: 1.55, marginTop: "4px" }}>{status.reason}</div>
      </div>
    </div>
  );
}

function convictionColor(score: number): string {
  if (score >= 90) return "#00FF88";
  if (score >= 75) return "#00D4FF";
  if (score >= 60) return "#A78BFA";
  if (score >= 40) return "#FF9500";
  if (score >= 20) return "#FF6B35";
  return "#FF2D55";
}

function sellingColor(cls: SellingClassification | null): string {
  const colors: Record<SellingClassification, string> = {
    Normal: "#00FF88", Elevated: "#FF9500", Aggressive: "#FF2D55", Unusual: "#FF6B35",
  };
  return cls ? colors[cls] : "#94A3B8";
}

function fmtDollar(value: number | null): string {
  if (value === null) return "Unavailable";
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(0)}K`;
  return `$${value.toLocaleString("en-US")}`;
}

function CollapsiblePanel({ open, onToggle, icon, title, color, count, children }: {
  open: boolean; onToggle: () => void; icon: React.ReactNode; title: string; color: string; count?: number; children: React.ReactNode;
}) {
  return (
    <div style={{ background: "rgba(12,15,22,0.98)", border: `1px solid ${color}18`, borderRadius: "6px", overflow: "hidden" }}>
      <button onClick={onToggle} style={{ width: "100%", background: "none", border: "none", cursor: "pointer", padding: "14px 16px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ display: "flex", alignItems: "center", gap: "8px", fontFamily: "'IBM Plex Mono', monospace", fontSize: "12px", color, textTransform: "uppercase", letterSpacing: "0.16em", fontWeight: 600 }}>
          {icon} {title} {count !== undefined ? <small style={{ color: "#64748B" }}>{count}</small> : null}
        </span>
        {open ? <ChevronUp size={13} color="#64748B" /> : <ChevronDown size={13} color="#64748B" />}
      </button>
      {open ? <div style={{ padding: "0 16px 14px" }}>{children}</div> : null}
    </div>
  );
}

function CompanyProfileModal({ ticker, onClose }: { ticker: string; onClose: () => void }) {
  const query = trpc.insider.company.useQuery({ ticker });
  const data = query.data as unknown as CompanyOutput | undefined;
  const status = sourceStatusAdapter(query.error);
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", padding: "16px" }} onClick={event => { if (event.target === event.currentTarget) onClose(); }}>
      <div style={{ background: "#0A0C12", border: "1px solid rgba(0,212,255,0.25)", borderRadius: "8px", width: "100%", maxWidth: "680px", maxHeight: "90vh", overflow: "auto", padding: "24px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "20px" }}>
          <div>
            <div style={{ fontFamily: "'Rajdhani', sans-serif", fontWeight: 700, fontSize: "22px", color: "#E2E8F0" }}>{ticker}</div>
            <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "10px", color: "rgba(100,116,139,0.55)", textTransform: "uppercase", letterSpacing: "0.15em" }}>SEC Form 4 filing profile</div>
          </div>
          <button onClick={onClose} aria-label="Close insider profile" style={{ background: "none", border: "none", cursor: "pointer", color: "#64748B", padding: "4px" }}><X size={18} /></button>
        </div>
        {query.isLoading ? <div style={{ padding: "32px", color: "#64748B", fontFamily: "'IBM Plex Mono', monospace", fontSize: "12px" }}>LOADING SEC FORM 4 OBSERVATIONS…</div> : null}
        <SourceUnavailable status={status} />
        {data ? <>
          {data.profile.dataStatus === "NO_ACTIVITY" ? <div style={{ padding: "14px", color: "#94A3B8", fontFamily: "'IBM Plex Sans', sans-serif" }}>SEC returned no transaction observations for this lookup.</div> : <>
            <div style={{ padding: "14px", marginBottom: "12px", background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: "6px" }}>
              <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "10px", color: "#64748B", textTransform: "uppercase", letterSpacing: "0.1em" }}>Derived Form 4 methodology score</div>
              <div style={{ fontFamily: "'Rajdhani', sans-serif", fontWeight: 700, fontSize: "30px", color: data.profile.convictionScore === null ? "#94A3B8" : convictionColor(data.profile.convictionScore) }}>{data.profile.convictionScore ?? "Unavailable"}</div>
              <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "11px", color: "#94A3B8" }}>{data.profile.convictionBand ?? "No open-market P/S score"}</div>
              <div style={{ marginTop: "7px", fontFamily: "'IBM Plex Mono', monospace", fontSize: "10px", color: "#64748B" }}>Observed at: {data.profile.observedAt ?? "Unavailable"}</div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", marginBottom: "16px" }}>
              <div style={{ padding: "12px", border: "1px solid rgba(0,255,136,0.18)", borderRadius: "5px" }}><div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "10px", color: "#64748B" }}>OPEN-MARKET PURCHASES</div><strong style={{ color: "#00FF88" }}>{fmtDollar(data.profile.buyVsSell.buyValue)}</strong><div style={{ color: "#64748B", fontSize: "11px" }}>{data.profile.buyVsSell.buyCount} P-code transaction(s)</div></div>
              <div style={{ padding: "12px", border: "1px solid rgba(255,45,85,0.18)", borderRadius: "5px" }}><div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "10px", color: "#64748B" }}>OPEN-MARKET SALES</div><strong style={{ color: "#FF2D55" }}>{fmtDollar(data.profile.buyVsSell.sellValue)}</strong><div style={{ color: "#64748B", fontSize: "11px" }}>{data.profile.buyVsSell.sellCount} S-code transaction(s)</div></div>
            </div>
            <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "10px", color: "#64748B", textTransform: "uppercase", marginBottom: "8px" }}>Observed transaction timeline</div>
            {data.timeline.map(event => <div key={event.accessionNumber + event.transactionCode + event.date} style={{ padding: "10px 12px", marginBottom: "6px", borderLeft: `3px solid ${event.type === "buy" ? "#00FF88" : event.type === "sell" ? "#FF2D55" : "#94A3B8"}`, background: "rgba(255,255,255,0.02)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: "10px" }}><span style={{ color: "#CBD5E1", fontSize: "12px" }}>{event.label}</span><span style={{ color: "#94A3B8", fontFamily: "monospace", fontSize: "11px" }}>{fmtDollar(event.amount)}</span></div>
              <div style={{ marginTop: "4px", color: "#64748B", fontFamily: "monospace", fontSize: "10px" }}>Code {event.transactionCode} · {event.shares.toLocaleString("en-US")} shares · {event.pricePerShare === null ? "price unavailable" : `$${event.pricePerShare.toFixed(2)}`} · filed {event.filingDate}</div>
              <a href={event.sourceUrl} target="_blank" rel="noreferrer" style={{ display: "inline-block", marginTop: "5px", color: "#00D4FF", fontFamily: "monospace", fontSize: "10px" }}>SEC filing {event.accessionNumber}</a>
            </div>)}
          </>}
        </> : null}
      </div>
    </div>
  );
}

function InsiderIntelligenceInner() {
  useSEO(PAGE_SEO.insiderIntelligence);
  const query = trpc.insider.radar.useQuery(undefined, { refetchOnWindowFocus: false, staleTime: 5 * 60 * 1000 });
  const radar = query.data as unknown as RadarOutput | undefined;
  const status = sourceStatusAdapter(query.error);
  const [selectedTicker, setSelectedTicker] = useState<string | null>(null);
  const [searchTicker, setSearchTicker] = useState("");
  const [open, setOpen] = useState({ radar: true, clusters: true, selling: true });
  const toggle = (key: keyof typeof open) => setOpen(previous => ({ ...previous, [key]: !previous[key] }));
  const handleSearch = () => {
    const ticker = searchTicker.trim().toUpperCase().replace(/[^A-Z0-9.]/g, "");
    if (ticker) { trackInsiderSearch(ticker); setSelectedTicker(ticker); }
  };

  return <div style={{ background: "#050608", minHeight: "100vh", paddingBottom: "80px" }}>
    <div style={{ maxWidth: "900px", margin: "0 auto", padding: "0 16px" }}>
      <PageHeader title="Insider Intelligence™" subtitle="SEC Form 4 observations with clearly labeled deterministic methodology" badge="INTELLIGENCE" />
      <div style={{ background: "rgba(12,15,22,0.98)", border: "1px solid rgba(0,212,255,0.18)", borderRadius: "6px", padding: "16px", marginBottom: "10px" }}>
        <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "11px", color: "rgba(100,116,139,0.65)", textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: "10px" }}>Company SEC Form 4 lookup</div>
        <div style={{ display: "flex", gap: "8px" }}><input type="text" value={searchTicker} onChange={event => setSearchTicker(event.target.value.toUpperCase().replace(/[^A-Z0-9.]/g, ""))} onKeyDown={event => event.key === "Enter" && handleSearch()} placeholder="e.g. NVDA" maxLength={10} style={{ flex: 1, padding: "10px 14px", background: "rgba(0,212,255,0.04)", border: "1px solid rgba(0,212,255,0.20)", borderRadius: "4px", color: "#E2E8F0", fontFamily: "monospace", fontSize: "14px", outline: "none" }} /><button onClick={handleSearch} style={{ padding: "10px 20px", background: "rgba(0,212,255,0.12)", border: "1px solid rgba(0,212,255,0.40)", borderRadius: "4px", cursor: "pointer", display: "flex", alignItems: "center", gap: "6px", color: "#00D4FF", fontFamily: "monospace", fontSize: "12px" }}><Search size={13} /> ANALYZE</button></div>
      </div>
      <SourceUnavailable status={status} />
      {query.isLoading ? <div style={{ padding: "24px", color: "#64748B", fontFamily: "monospace", fontSize: "12px" }}>SCANNING VERIFIED SEC FORM 4 OBSERVATIONS…</div> : null}
      {radar ? <>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: "6px", marginBottom: "10px" }}>{[
          ["Observed Buy Value", fmtDollar(radar.weeklyStats.totalBuyValue), "#00FF88"], ["Observed Sell Value", fmtDollar(radar.weeklyStats.totalSellValue), "#FF2D55"], ["Derived Sentiment", radar.weeklyStats.netSentiment === null ? "Unavailable" : `${radar.weeklyStats.netSentiment > 0 ? "+" : ""}${radar.weeklyStats.netSentiment}`, "#A78BFA"], ["Active Tickers", String(radar.weeklyStats.activeTickers), "#00D4FF"], ["Cluster Alerts", String(radar.weeklyStats.clusterCount), "#A78BFA"],
        ].map(([label, value, color]) => <div key={label} style={{ padding: "10px 12px", background: "rgba(12,15,22,0.98)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: "5px" }}><div style={{ fontFamily: "monospace", fontSize: "9px", color: "#64748B", textTransform: "uppercase" }}>{label}</div><div style={{ fontWeight: 700, fontSize: "16px", color }}>{value}</div></div>)}</div>
        <CollapsiblePanel open={open.radar} onToggle={() => toggle("radar")} icon={<Eye size={14} />} title="SEC Form 4 Radar" color="#00D4FF" count={radar.radar.length}>
          {radar.radar.map(entry => <div key={entry.ticker} onClick={() => setSelectedTicker(entry.ticker)} style={{ display: "grid", gridTemplateColumns: "35px 65px 1fr 80px 100px", gap: "8px", padding: "10px 8px", borderBottom: "1px solid rgba(255,255,255,0.04)", cursor: "pointer" }}><span style={{ color: "#64748B" }}>{entry.rank}</span><strong style={{ color: "#E2E8F0" }}>{entry.ticker}</strong><span style={{ color: "#94A3B8", fontSize: "12px" }}>{entry.activity}</span><span style={{ color: convictionColor(entry.convictionScore) }}>{entry.convictionScore}</span><span style={{ color: "#00D4FF" }}>{fmtDollar(entry.dollarAmount)}</span></div>)}
          {radar.radar.length === 0 ? <div style={{ color: "#64748B", fontFamily: "monospace", fontSize: "11px", padding: "8px 0" }}>No scoreable open-market P/S transactions are present in the verified radar filings.</div> : null}
          <button onClick={() => query.refetch()} style={{ marginTop: "10px", display: "flex", alignItems: "center", gap: "6px", padding: "6px 12px", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "4px", cursor: "pointer", color: "#94A3B8", fontFamily: "monospace", fontSize: "10px" }}><RefreshCw size={11} /> REFRESH</button>
        </CollapsiblePanel><div style={{ marginBottom: "10px" }} />
        <CollapsiblePanel open={open.clusters} onToggle={() => toggle("clusters")} icon={<Users size={14} />} title="Observed Purchase Clusters" color="#00FF88" count={radar.clusterAlerts.length}>
          {radar.clusterAlerts.map(alert => <div key={alert.ticker} style={{ padding: "12px", marginBottom: "6px", border: "1px solid rgba(0,255,136,0.18)", borderRadius: "5px" }}><strong style={{ color: "#E2E8F0" }}>{alert.ticker}</strong><span style={{ color: "#64748B", marginLeft: "8px", fontSize: "12px" }}>{alert.insiderCount} owners within {alert.daysWindow} days</span><div style={{ color: "#00D4FF", marginTop: "5px" }}>{fmtDollar(alert.totalCapital)} observed transaction value</div></div>)}
          {radar.clusterAlerts.length === 0 ? <div style={{ color: "#64748B", fontFamily: "monospace", fontSize: "11px", padding: "8px 0" }}>No cluster buy alerts detected in the verified radar response.</div> : null}
        </CollapsiblePanel><div style={{ marginBottom: "10px" }} />
        <CollapsiblePanel open={open.selling} onToggle={() => toggle("selling")} icon={<Shield size={14} />} title="Form 4 Selling Analysis" color="#FF9500" count={radar.topSellingAlerts.length}>
          {radar.topSellingAlerts.map(alert => <div key={alert.accessionNumber + alert.insiderName} style={{ padding: "12px", marginBottom: "6px", border: `1px solid ${sellingColor(alert.classification)}30`, borderRadius: "5px" }}><div style={{ display: "flex", justifyContent: "space-between" }}><span style={{ color: "#E2E8F0" }}>{alert.ticker} · {alert.insiderName}</span><strong style={{ color: sellingColor(alert.classification) }}>{alert.classification}</strong></div><div style={{ color: "#94A3B8", marginTop: "5px", fontSize: "12px" }}>SEC code {alert.transactionCode} · {fmtDollar(alert.saleAmount)} · {alert.percentOfHoldings === null ? "holdings percentage unavailable" : `${alert.percentOfHoldings.toFixed(1)}% of prior holdings`}</div><div style={{ color: "#64748B", marginTop: "4px", fontSize: "12px" }}>{alert.reason}</div><a href={alert.sourceUrl} target="_blank" rel="noreferrer" style={{ color: "#00D4FF", fontSize: "10px", fontFamily: "monospace" }}>SEC filing {alert.accessionNumber}</a></div>)}
          {radar.topSellingAlerts.length === 0 ? <div style={{ color: "#64748B", fontFamily: "monospace", fontSize: "11px", padding: "8px 0" }}>No classifiable selling activity in the verified radar response.</div> : null}
          {radar.weeklyStats.unclassifiedSellingCount > 0 ? <div style={{ color: "#FF9500", fontSize: "11px", marginTop: "8px" }}>{radar.weeklyStats.unclassifiedSellingCount} observed disposition(s) withheld from classification because filing data were insufficient.</div> : null}
        </CollapsiblePanel>
      </> : null}
      <div style={{ padding: "12px 14px", marginTop: "10px", background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)", borderRadius: "4px", color: "#64748B", fontFamily: "monospace", fontSize: "10px", lineHeight: 1.6, textAlign: "center" }}>Observed fields are sourced from SEC EDGAR Form 4 filings. Scores and sale labels are deterministic methodology, not investment advice. Historical accuracy and return claims are withheld pending a governed evaluation dataset.</div>
    </div>
    {selectedTicker ? <CompanyProfileModal ticker={selectedTicker} onClose={() => setSelectedTicker(null)} /> : null}
  </div>;
}

export default function InsiderIntelligence() {
  return <PremiumGateFull variant="insiderIntel"><InsiderIntelligenceInner /></PremiumGateFull>;
}
