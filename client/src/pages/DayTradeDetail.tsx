import { useMemo } from "react";
import { useLocation, useSearch } from "wouter";
import { AlertTriangle, ArrowLeft, BrainCircuit, Clock, ShieldAlert, Target } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { PremiumGateFull } from "@/components/PremiumGate";
import { UnifiedIntelligenceChart, type IntelligenceBar, type IntelligenceLevel } from "@/components/UnifiedIntelligenceChart";

const CARD: React.CSSProperties = { background: "rgba(10,12,16,.95)", border: "1px solid rgba(0,212,255,.14)", borderRadius: 8, padding: 14 };
const MONO: React.CSSProperties = { fontFamily: "'IBM Plex Mono', monospace", fontSize: 10 };

function price(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) && value > 0
    ? `$${value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    : "—";
}

function DayTradeDetailInner() {
  const [location, navigate] = useLocation();
  const query = useSearch();
  const symbol = useMemo(() => location.split("/").filter(Boolean).at(-1)?.toUpperCase() ?? "", [location]);
  const assetType = new URLSearchParams(query).get("asset") === "crypto" ? "crypto" : "stock";
  const detailQuery = trpc.dayTrade.getVisualDetail.useQuery({ symbol, assetType, direction: "both" }, { enabled: Boolean(symbol), staleTime: 3 * 60 * 1000 });
  const detail = detailQuery.data;
  const report = detail?.report as Record<string, any> | null | undefined;
  const bars = (detail?.bars ?? []) as IntelligenceBar[];
  const levels = (detail?.levels ?? []) as IntelligenceLevel[];
  const reportAvailable = detail?.sourceStatus.report === "available" && typeof report?.currentPrice === "number" && report.currentPrice > 0;
  const actionColor = report?.direction === "bearish" ? "#FF4D6A" : report?.setupType === "NO_TRADE" ? "#FFAA00" : "#00FF88";

  return <div style={{ maxWidth: 1220, margin: "0 auto", padding: "20px 16px 88px", color: "#E6EEF8" }}>
    <button type="button" onClick={() => navigate("/app/day-trade-intelligence")} style={{ ...MONO, color: "#00D4FF", background: "transparent", border: "none", cursor: "pointer", display: "inline-flex", gap: 6, alignItems: "center", padding: "2px 0", marginBottom: 14 }}><ArrowLeft size={13} /> DAY TRADE INTELLIGENCE</button>
    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 16 }}>
      <div><div style={{ ...MONO, color: "#00D4FF", letterSpacing: ".14em", marginBottom: 5 }}>DAY TRADE VISUAL ANALYSIS · {assetType.toUpperCase()}</div><h1 style={{ margin: 0, fontFamily: "Rajdhani, sans-serif", fontSize: 30, letterSpacing: ".04em" }}>{symbol || "SYMBOL"} <span style={{ color: actionColor }}>{reportAvailable ? String(report?.setupType ?? "NO TRADE").toUpperCase() : "SOURCE STATUS"}</span></h1></div>
      <div style={{ ...MONO, color: "#6B7A8D", textAlign: "right" }}><Clock size={11} style={{ verticalAlign: "middle", marginRight: 4 }} />OBSERVED {detail?.observedAt ? new Date(detail.observedAt).toLocaleString() : "—"}<br />{detail?.providerHealth?.price?.toUpperCase() ?? "UNAVAILABLE"} PRICE SOURCE</div>
    </div>

    {detailQuery.isLoading && <div style={{ ...CARD, color: "#8DA0B8" }}>LOADING CANONICAL DAY TRADE REPORT AND OBSERVED REFERENCE DATA…</div>}
    {detailQuery.isError && <div style={{ ...CARD, borderColor: "rgba(255,77,106,.4)", color: "#FF8194" }}>DAY TRADE VISUAL ANALYSIS COULD NOT LOAD. {detailQuery.error.message}</div>}
    {detail && <>
      {!reportAvailable && <div style={{ ...CARD, borderColor: "rgba(255,170,0,.38)", background: "rgba(255,170,0,.05)", color: "#FFCC66", display: "flex", gap: 10, lineHeight: 1.55, marginBottom: 14 }}><AlertTriangle size={16} style={{ flexShrink: 0, marginTop: 1 }} /><div><b>LIVE SETUP UNAVAILABLE</b><br />{detail.sourceStatus.detail} No price, level, or setup value is represented as zero when its source is unavailable.</div></div>}
      {reportAvailable && <div style={{ ...CARD, display: "grid", gridTemplateColumns: "minmax(180px,1.3fr) repeat(auto-fit,minmax(108px,1fr))", gap: 12, marginBottom: 14, borderColor: `${actionColor}48` }}>
        <div><div style={{ ...MONO, color: actionColor, letterSpacing: ".12em" }}>CURRENT TACTICAL SETUP</div><div style={{ fontFamily: "Rajdhani, sans-serif", fontSize: 26, fontWeight: 700, color: actionColor, marginTop: 3 }}>{String(report?.setupType ?? "NO TRADE").toUpperCase()}</div><div style={{ ...MONO, color: "#94A3B8", marginTop: 4 }}>{report?.noTradeReason ?? report?.whyTradeExists ?? report?.reasonForRecommendation ?? "No additional setup rationale."}</div></div>
        {[ ["CURRENT", price(report?.currentPrice), "#F0F4FF"], ["CONFIDENCE", typeof report?.confidence === "number" ? `${report.confidence}/100` : "—", actionColor], ["RISK / REWARD", typeof report?.riskRewardRatio === "number" && report.riskRewardRatio > 0 ? `${report.riskRewardRatio.toFixed(1)}:1` : "—", "#00D4FF"], ["HOLD WINDOW", report?.expectedHoldMinutes ? `${report.expectedHoldMinutes} MIN` : "—", "#FACC15"] ].map(([label, value, color]) => <div key={String(label)} style={{ borderLeft: "1px solid rgba(255,255,255,.08)", paddingLeft: 10 }}><div style={{ ...MONO, color: "#6B7A8D" }}>{label}</div><div style={{ fontFamily: "Rajdhani, sans-serif", fontWeight: 700, fontSize: 20, color: String(color), marginTop: 4 }}>{value}</div></div>)}
      </div>}

      <section style={{ ...CARD, marginBottom: 14, overflow: "hidden" }}><div style={{ ...MONO, color: "#00D4FF", letterSpacing: ".12em", marginBottom: 10 }}>PRICE CONTEXT · COMPLETED DAILY REFERENCE BARS</div>{bars.length ? <UnifiedIntelligenceChart bars={bars} levels={levels} ariaLabel={`${symbol} completed daily price reference chart`} volumeLabel="VOLUME · COMPLETED DAILY REFERENCE BARS" /> : <div style={{ color: "#A6B6C7", fontSize: 12, lineHeight: 1.6 }}>{detail.sourceStatus.completedDailyBars === "not_supported" ? "COMPLETED DAILY REFERENCE BARS ARE NOT CURRENTLY SUPPORTED FOR THIS ASSET." : "COMPLETED DAILY REFERENCE BARS ARE TEMPORARILY UNAVAILABLE."}</div>}<div style={{ ...MONO, color: "#6B7A8D", marginTop: 10, lineHeight: 1.55 }}>INTRADAY BAR HISTORY: NOT SUPPORTED · {detail.chartPolicy} Historical setup markers are intentionally absent because no immutable Day Trade event ledger exists yet.</div></section>

      {reportAvailable && <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 12 }}>
        <section style={CARD}><div style={{ ...MONO, color: "#00D4FF", marginBottom: 8 }}>EXECUTION LEVELS</div>{levels.length ? <div style={{ display: "grid", gap: 7 }}>{levels.map(level => <div key={level.label} style={{ display: "flex", justifyContent: "space-between", gap: 8, borderBottom: "1px solid rgba(255,255,255,.06)", paddingBottom: 5 }}><span style={{ ...MONO, color: level.color }}>{level.label}</span><b style={{ ...MONO, color: "#E6EEF8" }}>{price(level.value)}</b></div>)}</div> : <div style={{ ...MONO, color: "#6B7A8D" }}>NO SOURCE-BACKED LEVELS AVAILABLE.</div>}</section>
        <section style={CARD}><div style={{ ...MONO, color: "#00D4FF", marginBottom: 8 }}>TACTICAL CONTEXT</div>{[["REGIME IMPACT", report?.regimeImpact], ["INTRADAY TREND", report?.intradayTrend], ["VWAP STATUS", report?.vwapStatus], ["CATALYST", report?.catalystSummary ?? report?.catalyst]].map(([label, value]) => <div key={String(label)} style={{ marginBottom: 8 }}><div style={{ ...MONO, color: "#6B7A8D", fontSize: 8 }}>{label}</div><div style={{ fontSize: 12, color: "#B7C6D8", lineHeight: 1.45 }}>{value || "—"}</div></div>)}</section>
        <section style={{ ...CARD, borderColor: "rgba(255,170,0,.25)" }}><div style={{ ...MONO, color: "#FFAA00", marginBottom: 8 }}>INVALIDATION / RISK</div><div style={{ fontSize: 12, color: "#D7B27E", lineHeight: 1.6 }}>{report?.whatCancelsThisTrade ?? report?.largestRisk ?? "No source-backed invalidation statement available."}</div><div style={{ ...MONO, color: "#6B7A8D", marginTop: 10 }}>REPORT CONFIDENCE: {detail.providerHealth?.aiEnrichment?.toUpperCase() ?? "UNKNOWN"} AI ENRICHMENT · {detail.providerHealth?.regime?.toUpperCase() ?? "UNKNOWN"} REGIME</div></section>
      </div>}
      <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 14 }}><button type="button" onClick={() => navigate(`/app/asha?context=${encodeURIComponent(`Explain the current Day Trade visual analysis for ${symbol}. Use the displayed source status, observed daily reference bars, current setup, calculated levels, and explicit intraday-history limitation.`)}`)} style={{ ...MONO, color: "#050608", background: "#00D4FF", border: "none", borderRadius: 4, padding: "8px 11px", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6 }}><BrainCircuit size={13} /> ASK ASHA TO EXPLAIN</button></div>
    </>}
  </div>;
}

export default function DayTradeDetail() {
  return <PremiumGateFull variant="dayTrade"><DayTradeDetailInner /></PremiumGateFull>;
}
