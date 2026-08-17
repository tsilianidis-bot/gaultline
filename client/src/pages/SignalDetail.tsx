import { useMemo } from "react";
import { useLocation, useRoute } from "wouter";
import { AlertTriangle, ArrowLeft, BrainCircuit, RefreshCw } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { UnifiedIntelligenceChart, type IntelligenceLevel } from "@/components/UnifiedIntelligenceChart";

const CYAN = "#00D4FF";
const GREEN = "#00FF88";
const RED = "#FF4D6A";
const AMBER = "#FFAA00";
const MUTED = "#9DAFC1";

function money(value: number | null | undefined): string {
  return typeof value === "number" && Number.isFinite(value)
    ? `$${value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    : "—";
}

function number(value: number | null | undefined, suffix = ""): string {
  return typeof value === "number" && Number.isFinite(value) ? `${value.toFixed(2)}${suffix}` : "—";
}

function stamp(value: number | null | undefined): string {
  return value ? new Date(value).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : "Unavailable";
}

function actionColor(action: string | undefined): string {
  if (action === "BUY") return GREEN;
  if (action === "SELL") return RED;
  if (action === "HOLD") return AMBER;
  return MUTED;
}

function Metric({ label, value, color = "#EAF5FF", detail }: { label: string; value: string; color?: string; detail?: string }) {
  return <div style={metric}><div style={metricLabel}>{label}</div><div style={{ ...metricValue, color }}>{value}</div>{detail && <div style={metricDetail}>{detail}</div>}</div>;
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return <section style={panel}><h2 style={panelTitle}>{title}</h2>{children}</section>;
}

export default function SignalDetail() {
  const [, params] = useRoute<{ symbol: string }>("/app/signals/:symbol");
  const [, navigate] = useLocation();
  const symbol = (params?.symbol ?? "").toUpperCase();
  const query = trpc.signals.getSignalVisualDetail.useQuery({ symbol }, { enabled: Boolean(symbol), retry: 2, staleTime: 60_000 });
  const detail = query.data;
  const signal = detail?.signal;
  const quote = detail?.quote;
  const levelLines = useMemo<IntelligenceLevel[]>(() => {
    if (!signal) return [];
    const levels = signal.priceLevels;
    return [
      { label: "SUPPORT", value: levels.support, color: GREEN },
      { label: "RESISTANCE", value: levels.resistance, color: AMBER },
      { label: "ENTRY", value: levels.entryZone, color: CYAN, dashed: false },
      { label: "STOP", value: levels.stopLoss, color: RED },
      { label: "TARGET", value: levels.targetPrice, color: GREEN },
      { label: "THESIS FAIL", value: levels.riskLevels.thesisFailure.price, color: RED },
    ];
  }, [signal]);

  const askAsha = () => {
    const current = signal
      ? `${symbol} is currently ${signal.action} at ${signal.confidence}% confidence. Its calculated entry is ${money(signal.priceLevels.entryZone)}, stop is ${money(signal.priceLevels.stopLoss)}, and target is ${money(signal.priceLevels.targetPrice)}.`
      : `${symbol} has incomplete source inputs, so FAULTLINE is withholding a current trading signal.`;
    navigate(`/app/asha?prompt=${encodeURIComponent(`Explain the current ${symbol} Signals visual analysis using only the displayed observed daily bars, current technicals, calculated levels, regime context, and explicit source availability. ${current} Do not imply historical FAULTLINE signals or outcomes.`)}`);
  };

  if (query.isLoading) return <main style={page}><div style={empty}>ASSEMBLING SOURCE-BACKED SIGNAL VISUAL ANALYSIS…</div></main>;

  if (query.isError || !detail) {
    const accessError = query.error?.data?.code === "UNAUTHORIZED" || query.error?.data?.code === "FORBIDDEN";
    return <main style={page}><div style={content}><button style={back} onClick={() => navigate("/app/signals")}><ArrowLeft size={14} /> BACK TO SIGNALS</button><section style={empty}><AlertTriangle size={16} color={AMBER} /><div><b>{accessError ? "SIGNAL VISUAL ANALYSIS REQUIRES CORE ACCESS." : "VISUAL ANALYSIS IS TEMPORARILY UNAVAILABLE."}</b><p style={copy}>{accessError ? "Sign in with an eligible Core, Premium, or Founding membership to calculate a source-backed signal. The scanner remains available without substituting an unavailable calculation." : "The requested source-backed detail could not be assembled. This does not substitute unavailable information with a generic signal. Return to the scanner or retry the observed-data request."}</p>{accessError ? <button style={secondaryButton} onClick={() => navigate("/app/account")}>VIEW MEMBERSHIP</button> : <button style={secondaryButton} onClick={() => query.refetch()}><RefreshCw size={13} /> RETRY SOURCE CHECK</button>}</div></section></div></main>;
  }

  const technicals = signal?.technicals;
  const priceChange = quote?.changePercent;
  const positive = typeof priceChange === "number" && priceChange >= 0;
  const currentPrice = quote?.price ?? null;

  return <main style={page}><div style={content}>
    <button style={back} onClick={() => navigate("/app/signals")}><ArrowLeft size={14} /> BACK TO SIGNALS</button>
    <header style={header}>
      <div><div style={eyebrow}>SIGNALS / VISUAL ANALYSIS</div><h1 style={title}>{symbol}</h1><div style={subtle}>CURRENT OBSERVATION {stamp(detail.observedAt)} · DAILY BARS ONLY · NO INTRADAY INTERVALS</div></div>
      <div style={quoteBlock}><div style={{ ...quotePrice, color: currentPrice == null ? MUTED : "#EAF5FF" }}>{money(currentPrice)}</div><div style={{ color: positive ? GREEN : RED, fontSize: 11 }}>{typeof priceChange === "number" ? `${positive ? "+" : ""}${priceChange.toFixed(2)}%` : "QUOTE CHANGE UNAVAILABLE"}</div><div style={subtle}>{quote?.isDelayed ? "DELAYED QUOTE" : "QUOTE STATUS UNAVAILABLE"}</div></div>
    </header>

    <section style={statusStrip}>
      <Metric label="CURRENT SIGNAL" value={signal ? `${signal.action} · ${signal.actionLabel}` : "WITHHELD"} color={actionColor(signal?.action)} detail={signal ? `${signal.confidence}% confidence · ${signal.strength.toUpperCase()}` : "Required inputs are incomplete"} />
      <Metric label="REGIME" value={detail.regime?.label ?? "UNAVAILABLE"} color={detail.regime ? CYAN : AMBER} detail={detail.regime ? `${detail.regime.pressureIndex}/100 · ${detail.regime.direction}` : "Signal calculation withheld"} />
      <Metric label="DAILY HISTORY" value={`${detail.bars.length} COMPLETED BARS`} detail={detail.providerHealth.dailyBars.status.toUpperCase()} />
      <Metric label="OBSERVED QUOTE" value={detail.providerHealth.quote.status.toUpperCase()} color={detail.providerHealth.quote.status === "available" ? GREEN : AMBER} detail={detail.providerHealth.quote.source.toUpperCase()} />
    </section>

    <section style={heroPanel}>
      <div style={sectionHeader}><div><b style={{ color: "#EAF5FF" }}>PRICE ACTION & CURRENT SIGNAL LEVELS</b><div style={subtle}>Horizontal lines are current deterministic calculations from the displayed completed daily bars and observed quote. They are not historical FAULTLINE calls.</div></div><button style={secondaryButton} onClick={() => query.refetch()} disabled={query.isFetching}><RefreshCw size={13} /> {query.isFetching ? "REFRESHING" : "REFRESH"}</button></div>
      <div style={{ overflowX: "auto", marginTop: 12 }}><UnifiedIntelligenceChart bars={detail.bars} levels={levelLines} ariaLabel={`${symbol} completed daily price, volume, and current signal levels`} volumeLabel="VOLUME · COMPLETED DAILY SOURCE BARS" /></div>
      <div style={historyBoundary}><AlertTriangle size={14} color={AMBER} /><span><b>NO HISTORICAL SIGNAL MARKERS.</b> FAULTLINE does not yet have immutable stored signal observations for this symbol. The chart displays source price history and current calculated levels only.</span></div>
    </section>

    {signal ? <>
      <section style={grid}>
        <Panel title="WHY FAULTLINE IS SHOWING THIS"><div style={{ ...actionBadge, color: actionColor(signal.action), borderColor: `${actionColor(signal.action)}66` }}>{signal.action} · {signal.actionLabel}</div><p style={copy}>{signal.rationale}</p><div style={metricGrid}><Metric label="CONFIDENCE" value={`${signal.confidence}%`} color={actionColor(signal.action)} /><Metric label="TIMEFRAME" value={signal.timeframe.toUpperCase()} /><Metric label="REGIME ALIGNMENT" value={signal.regimeAlignment.toUpperCase()} color={signal.regimeAlignment === "Counter-Trend" ? RED : signal.regimeAlignment === "Aligned" ? GREEN : AMBER} detail={`${signal.regimeAlignmentScore}/10`} /></div></Panel>
        <Panel title="CALCULATED PRICE LEVELS"><div style={metricGrid}><Metric label="SUPPORT" value={money(signal.priceLevels.support)} color={GREEN} /><Metric label="RESISTANCE" value={money(signal.priceLevels.resistance)} color={AMBER} /><Metric label="ENTRY" value={money(signal.priceLevels.entryZone)} color={CYAN} /><Metric label="STOP" value={money(signal.priceLevels.stopLoss)} color={RED} /><Metric label="TARGET" value={money(signal.priceLevels.targetPrice)} color={GREEN} /><Metric label="RISK / REWARD" value={`${signal.priceLevels.riskReward}:1`} /></div></Panel>
      </section>
      <section style={grid}>
        <Panel title="TECHNICAL EVIDENCE"><div style={metricGrid}><Metric label={technicals?.rsiIsTrue ? "RSI (14)" : "RSI APPROX."} value={`${number(technicals?.rsiEstimate, "") } · ${technicals?.rsiLabel.toUpperCase() ?? "—"}`} color={technicals?.rsiLabel === "Overbought" ? RED : technicals?.rsiLabel === "Oversold" ? GREEN : "#EAF5FF"} detail={technicals?.rsiIsTrue ? "Wilder’s completed-bar calculation" : "Fallback calculation"} /><Metric label={technicals?.smaIsTrue ? "SMA 50 / 200" : "SMA STRUCTURE"} value={technicals?.smaSignal.toUpperCase() ?? "—"} color={technicals?.smaSignal === "Golden Cross" ? GREEN : technicals?.smaSignal === "Death Cross" ? RED : "#EAF5FF"} /><Metric label="MACD 12 / 26 / 9" value={technicals?.macd ? technicals.macd.signal.toUpperCase() : "UNAVAILABLE"} color={technicals?.macd?.signal === "Bullish" ? GREEN : technicals?.macd?.signal === "Bearish" ? RED : MUTED} detail={technicals?.macd ? `Histogram ${number(technicals.macd.histogram)}` : "Requires sufficient completed bars"} /><Metric label="VOLUME" value={technicals?.volumeSignal.toUpperCase() ?? "—"} color={technicals?.volumeSignal === "Surge" ? AMBER : technicals?.volumeSignal === "Low" ? RED : "#EAF5FF"} detail={detail.avgVolume ? `20-bar avg ${Math.round(detail.avgVolume).toLocaleString()} shares` : "20-bar average unavailable"} /><Metric label="TREND" value={technicals?.trend.toUpperCase() ?? "—"} /><Metric label="MOMENTUM" value={`${technicals?.momentumScore ?? "—"}/100`} /></div></Panel>
        <Panel title="RISK FRAMEWORK"><div style={metricGrid}><Metric label="TRADE STOP" value={money(signal.priceLevels.riskLevels.tradeStop.price)} color={RED} detail={signal.priceLevels.riskLevels.tradeStopExplanation} /><Metric label="SWING STOP" value={money(signal.priceLevels.riskLevels.swingStop.price)} color={AMBER} detail={signal.priceLevels.riskLevels.swingStopExplanation} /><Metric label="THESIS FAILURE" value={money(signal.priceLevels.riskLevels.thesisFailure.price)} color={RED} detail={signal.priceLevels.riskLevels.thesisFailureExplanation} /></div></Panel>
      </section>
      <Panel title="WHAT CHANGED"><div style={metricGrid}><Metric label="OBSERVED DAILY MOVE" value={typeof priceChange === "number" ? `${positive ? "+" : ""}${priceChange.toFixed(2)}%` : "UNAVAILABLE"} color={positive ? GREEN : RED} detail="Current quote versus its reported prior close" /><Metric label="RELATIVE TO 20-BAR AVERAGE" value={detail.relativeStrength == null ? "UNAVAILABLE" : `${detail.relativeStrength}/100`} color={detail.relativeStrength != null && detail.relativeStrength >= 50 ? GREEN : AMBER} detail="Normalized completed-bar price relationship" /><Metric label="LATEST COMPLETED BAR" value={stamp(detail.providerHealth.dailyBars.latestCompletedAt)} detail="Source daily OHLCV observation" /></div><p style={copy}>No earlier immutable FAULTLINE signal observation exists for this symbol yet, so this page does not claim a comparison with a prior FAULTLINE call. The first stored verified signal observation will establish that boundary.</p></Panel>
    </> : <Panel title="CURRENT SIGNAL WITHHELD"><p style={copy}>FAULTLINE will not produce a partial or substituted signal. Review source status below; the chart still shows any completed source bars that were available.</p></Panel>}

    <section style={grid}>
      <Panel title="SOURCE STATUS"><div style={sourceList}>{Object.entries(detail.providerHealth).map(([name, source]) => <div key={name} style={sourceRow}><span style={{ color: source.status === "available" ? GREEN : AMBER }}>{source.status === "available" ? "●" : "▲"}</span><div><b>{name.replace(/([A-Z])/g, " $1").toUpperCase()}</b><p style={sourceCopy}>{source.detail}</p></div></div>)}</div></Panel>
      <Panel title="ASK ASHA"><p style={copy}>ASHA receives only this current observed signal context, source availability, and the explicit no-history boundary.</p><button style={primaryButton} onClick={askAsha}><BrainCircuit size={15} /> EXPLAIN THIS CHART</button></Panel>
    </section>
  </div></main>;
}

const page: React.CSSProperties = { minHeight: "100vh", background: "#050608", color: "#EAF5FF", padding: "22px 16px 100px", fontFamily: "IBM Plex Mono, monospace" };
const content: React.CSSProperties = { maxWidth: 1380, margin: "0 auto" };
const header: React.CSSProperties = { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 18, flexWrap: "wrap", margin: "16px 0" };
const eyebrow: React.CSSProperties = { color: CYAN, fontSize: 10, letterSpacing: ".16em" };
const title: React.CSSProperties = { margin: "5px 0", fontSize: 44, fontFamily: "Rajdhani, sans-serif", letterSpacing: ".04em" };
const subtle: React.CSSProperties = { color: "#8EA2B8", fontSize: 10, lineHeight: 1.5 };
const quoteBlock: React.CSSProperties = { textAlign: "right", minWidth: 180 };
const quotePrice: React.CSSProperties = { fontSize: 34, fontFamily: "Rajdhani, sans-serif", fontWeight: 700 };
const statusStrip: React.CSSProperties = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(165px, 1fr))", gap: 10, padding: "13px 15px", border: "1px solid rgba(0,212,255,.18)", borderRadius: 7, marginBottom: 14, background: "rgba(0,212,255,.04)" };
const heroPanel: React.CSSProperties = { border: "1px solid rgba(0,212,255,.24)", background: "rgba(7,10,15,.95)", borderRadius: 9, padding: 14 };
const sectionHeader: React.CSSProperties = { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" };
const grid: React.CSSProperties = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 340px), 1fr))", gap: 13, marginTop: 13 };
const panel: React.CSSProperties = { border: "1px solid rgba(255,255,255,.09)", background: "rgba(9,13,19,.88)", borderRadius: 7, padding: 14 };
const panelTitle: React.CSSProperties = { fontSize: 11, color: CYAN, letterSpacing: ".1em", margin: "0 0 10px" };
const metricGrid: React.CSSProperties = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(135px, 1fr))", gap: 8 };
const metric: React.CSSProperties = { padding: 10, border: "1px solid rgba(255,255,255,.08)", borderRadius: 5, minWidth: 0 };
const metricLabel: React.CSSProperties = { fontSize: 8, color: "#8092A8", letterSpacing: ".08em" };
const metricValue: React.CSSProperties = { fontSize: 13, marginTop: 5, fontWeight: 700, overflowWrap: "anywhere" };
const metricDetail: React.CSSProperties = { fontSize: 9, color: "#8193A8", lineHeight: 1.45, marginTop: 4 };
const copy: React.CSSProperties = { fontSize: 11, color: "#C3D0DE", lineHeight: 1.6, margin: "6px 0" };
const back: React.CSSProperties = { display: "inline-flex", alignItems: "center", gap: 5, border: 0, background: "none", color: "#A6B6C7", padding: 0, cursor: "pointer", fontSize: 10 };
const primaryButton: React.CSSProperties = { display: "inline-flex", alignItems: "center", gap: 6, border: "1px solid rgba(0,212,255,.45)", background: "rgba(0,212,255,.14)", color: CYAN, borderRadius: 4, padding: "10px 12px", cursor: "pointer", fontSize: 10, letterSpacing: ".07em" };
const secondaryButton: React.CSSProperties = { display: "inline-flex", alignItems: "center", gap: 6, border: "1px solid rgba(255,255,255,.15)", background: "rgba(255,255,255,.03)", color: "#C3D0DE", borderRadius: 4, padding: "8px 10px", cursor: "pointer", fontSize: 9, letterSpacing: ".06em" };
const empty: React.CSSProperties = { display: "flex", gap: 10, alignItems: "flex-start", padding: 20, border: "1px solid rgba(0,212,255,.2)", borderRadius: 8, color: "#A6B6C7", fontSize: 11 };
const historyBoundary: React.CSSProperties = { display: "flex", gap: 7, alignItems: "flex-start", marginTop: 12, padding: 10, border: "1px solid rgba(255,170,0,.22)", background: "rgba(255,170,0,.05)", borderRadius: 5, color: "#E0C58D", fontSize: 10, lineHeight: 1.5 };
const actionBadge: React.CSSProperties = { display: "inline-flex", border: "1px solid", borderRadius: 4, padding: "7px 9px", fontSize: 12, fontWeight: 700, letterSpacing: ".06em" };
const sourceList: React.CSSProperties = { display: "grid", gap: 8 };
const sourceRow: React.CSSProperties = { display: "grid", gridTemplateColumns: "14px 1fr", gap: 7, fontSize: 10, color: "#D8E4EF" };
const sourceCopy: React.CSSProperties = { color: "#8EA2B8", fontSize: 10, lineHeight: 1.45, margin: "3px 0 0" };
