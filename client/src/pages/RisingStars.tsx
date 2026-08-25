import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { ArrowLeft, BrainCircuit, ChevronDown, ChevronRight, Clock, Filter, RefreshCw, Sparkles, X } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useSEO } from "@/hooks/useSEO";

type MarketCapCategory = "small" | "mid" | "large" | "mega";
type ListingAgeCategory = "under_1y" | "one_to_three_y" | "three_plus_y" | "unknown";
type SortKey = "score" | "newest" | "gain" | "loss" | "market_cap" | "momentum" | "low_risk" | "high_risk";
type TopCategory = "all" | "new_listings" | MarketCapCategory | "mag7";

interface DiscoveryStar {
  ticker: string; name: string; risingStarScore: number; latestPrice: number; dailyChange: number | null; dailyChangePercent: number | null;
  signalDirection: "CONSTRUCTIVE" | "WATCH"; signalStrength: "LOW" | "MODERATE" | "HIGH" | "VERY HIGH";
  momentumScore: number; relativeStrengthScore: number; volumeParticipationScore: number; riskLevel: "MODERATE" | "ELEVATED";
  macroContext: string; marketDataAsOf: number; whyFaultlineIsSeeingItEarly: string[];
  exchange: string; marketCap: number | null; marketCapCategory: MarketCapCategory | null; marketCapLabel: string | null;
  listingDate: string | null; listingAgeCategory: ListingAgeCategory; yearsPublic: number | null; monthsPublic: number | null;
  sector: string | null; industry: string | null; themes: string[]; description: string; primaryCatalyst: string; keyRisk: string; isMagnificentSeven: boolean;
  priceStatus: "DELAYED" | "LAST_CLOSE";
}

const TOP_CATEGORIES: Array<{ id: TopCategory; label: string }> = [
  { id: "all", label: "All" }, { id: "new_listings", label: "New Listings" }, { id: "small", label: "Small Cap" },
  { id: "mid", label: "Mid Cap" }, { id: "large", label: "Large Cap" }, { id: "mega", label: "Mega Cap" }, { id: "mag7", label: "Mag 7" },
];

const LISTING_LABELS: Record<ListingAgeCategory, string> = {
  under_1y: "Under 1 Year Public", one_to_three_y: "1–3 Years Public", three_plus_y: "3+ Years Public", unknown: "Listing age unavailable",
};

const SORT_LABELS: Record<SortKey, string> = {
  score: "Highest Rising Star Score", newest: "Newest Listing", gain: "Largest Daily Gain", loss: "Largest Daily Loss",
  market_cap: "Market Cap", momentum: "Strongest Momentum", low_risk: "Lowest Risk", high_risk: "Highest Risk",
};

function parseSavedState() {
  try { return JSON.parse(sessionStorage.getItem("faultline:rising-stars:filters") ?? "{}"); } catch { return {}; }
}

function formatPrice(value: number | null) {
  if (value == null || !Number.isFinite(value)) return "Price temporarily unavailable";
  return `$${value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatCap(value: number | null) {
  if (value == null || value <= 0) return "Market cap unavailable";
  if (value >= 1_000_000_000_000) return `$${(value / 1_000_000_000_000).toFixed(2)}T`;
  return `$${(value / 1_000_000_000).toFixed(1)}B`;
}

function scoreColor(value: number) { return value >= 70 ? "#00FF88" : value >= 50 ? "#FACC15" : "#94A3B8"; }

function listingBadge(item: DiscoveryStar) {
  if (item.listingAgeCategory === "under_1y") return item.monthsPublic != null ? `${item.monthsPublic} MONTHS PUBLIC` : "NEWLY PUBLIC";
  if (item.listingAgeCategory === "one_to_three_y") return item.yearsPublic != null ? `${item.yearsPublic.toFixed(1)} YEARS PUBLIC` : "EARLY PUBLIC-MARKET STAGE";
  return null;
}

function StarCard({ item, onAnalyze }: { item: DiscoveryStar; onAnalyze: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const positive = item.dailyChangePercent != null && item.dailyChangePercent >= 0;
  const badge = listingBadge(item);
  const why = item.whyFaultlineIsSeeingItEarly?.slice(0, 3) ?? [];
  return <article style={{ border: "1px solid rgba(0,212,255,0.18)", borderRadius: 9, background: "rgba(7,10,15,0.95)", overflow: "hidden", display: "flex", flexDirection: "column" }}>
    <header style={{ padding: "15px 16px 13px", borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}><strong style={{ color: "#F0F4FF", fontFamily: "'Rajdhani', sans-serif", fontSize: 23, letterSpacing: "0.055em" }}>{item.ticker}</strong><span style={{ color: "rgba(210,224,239,0.68)", fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.name}</span></div>
          <div style={{ marginTop: 5, display: "flex", gap: 6, flexWrap: "wrap" }}><span style={chipStyle}>{item.exchange}</span>{item.marketCapLabel && <span style={chipStyle}>{item.marketCapLabel}</span>}{badge && <span style={{ ...chipStyle, color: "#FACC15", borderColor: "rgba(250,204,21,0.28)" }}>{badge}</span>}{item.isMagnificentSeven && <span style={{ ...chipStyle, color: "#C4B5FD", borderColor: "rgba(196,181,253,0.28)" }}>MAGNIFICENT SEVEN</span>}</div>
        </div>
        <div style={{ textAlign: "right", flexShrink: 0 }}><div style={{ color: scoreColor(item.risingStarScore), fontFamily: "'Rajdhani', sans-serif", fontSize: 30, lineHeight: 0.9, fontWeight: 800 }}>{item.risingStarScore}</div><div style={{ color: "rgba(148,163,184,0.55)", fontFamily: "'IBM Plex Mono', monospace", fontSize: 7, letterSpacing: "0.09em", marginTop: 4 }}>RISING STAR SCORE</div></div>
      </div>
      <div style={{ marginTop: 12, display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}><strong style={{ color: "#F5F9FF", fontFamily: "'IBM Plex Mono', monospace", fontSize: 18 }}>{formatPrice(item.latestPrice)}</strong><span style={{ color: item.dailyChangePercent == null ? "#64748B" : positive ? "#00FF88" : "#FF6B6B", fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, fontWeight: 700 }}>{item.dailyChangePercent == null ? "DAILY MOVE UNAVAILABLE" : `${item.dailyChange! >= 0 ? "+" : ""}${item.dailyChange!.toFixed(2)} · ${positive ? "+" : ""}${item.dailyChangePercent.toFixed(2)}% TODAY`}</span></div>
      <div style={{ marginTop: 5, color: "rgba(148,163,184,0.48)", fontFamily: "'IBM Plex Mono', monospace", fontSize: 8 }}>{item.priceStatus === "DELAYED" ? "DELAYED MARKET DATA" : "LAST COMPLETED CLOSE"} · {new Date(item.marketDataAsOf).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</div>
    </header>
    <div style={{ padding: "14px 16px", display: "grid", gap: 12, flex: 1 }}>
      <InfoBlock label="WHAT IT DOES"><p style={copyStyle}>{item.description}</p></InfoBlock>
      <InfoBlock label="WHY FAULTLINE IS WATCHING">{why.length ? <ul style={{ margin: 0, paddingLeft: 16, color: "rgba(203,219,235,0.78)", fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, lineHeight: 1.55 }}>{why.map(reason => <li key={reason}>{reason}</li>)}</ul> : <p style={copyStyle}>Current technical and macro evidence supports continued monitoring.</p>}</InfoBlock>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 8 }}>
        <Metric label="MARKET CAP" value={formatCap(item.marketCap)} /><Metric label="LISTING" value={item.listingDate ?? "Unavailable"} />
        <Metric label="PUBLIC-MARKET STAGE" value={LISTING_LABELS[item.listingAgeCategory]} /><Metric label="SECTOR" value={item.sector ?? "Sector unavailable"} />
        <Metric label="INDUSTRY" value={item.industry ?? "Industry unavailable"} /><Metric label="SIGNAL" value={`${item.signalDirection} · ${item.signalStrength}`} />
      </div>
      {item.themes.length > 0 && <div><div style={sectionLabelStyle}>FAULTLINE THEMES</div><div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginTop: 5 }}>{item.themes.map(theme => <span key={theme} style={{ ...chipStyle, color: "#8BE9FD" }}>{theme}</span>)}</div></div>}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}><InfoBlock label="PRIMARY CATALYST"><p style={copyStyle}>{item.primaryCatalyst}</p></InfoBlock><InfoBlock label="KEY RISK"><p style={{ ...copyStyle, color: "#FBBF24" }}>{item.keyRisk}</p></InfoBlock></div>
      <button onClick={() => setExpanded(!expanded)} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%", border: "none", background: "rgba(255,255,255,0.025)", padding: "9px 10px", color: "rgba(202,218,235,0.7)", cursor: "pointer", fontFamily: "'IBM Plex Mono', monospace", fontSize: 9, textAlign: "left" }}>HOW THIS SCORE IS CALCULATED <ChevronDown size={13} style={{ transform: expanded ? "rotate(180deg)" : "none", transition: "transform 160ms ease" }} /></button>
      {expanded && <p style={{ ...copyStyle, padding: "0 10px" }}>The canonical Rising Star Score combines completed daily price/volume structure, technical asymmetry, verified public-news catalyst coverage when available, and FAULTLINE macro alignment. It does not forecast returns; missing social, insider, options, sector-flow, or fundamental inputs are excluded rather than estimated.</p>}
      <button onClick={onAnalyze} style={{ marginTop: "auto", padding: "10px", borderRadius: 4, border: "1px solid rgba(0,212,255,0.32)", background: "rgba(0,212,255,0.07)", color: "#00D4FF", cursor: "pointer", fontFamily: "'IBM Plex Mono', monospace", fontSize: 9, fontWeight: 700, letterSpacing: "0.09em" }}>VIEW FULL ANALYSIS <ChevronRight size={13} style={{ display: "inline", verticalAlign: "-2px" }} /></button>
    </div>
  </article>;
}

const chipStyle: React.CSSProperties = { border: "1px solid rgba(148,163,184,0.18)", borderRadius: 99, padding: "3px 6px", color: "rgba(192,211,231,0.68)", fontFamily: "'IBM Plex Mono', monospace", fontSize: 7, letterSpacing: "0.06em" };
const sectionLabelStyle: React.CSSProperties = { color: "#00D4FF", fontFamily: "'IBM Plex Mono', monospace", fontSize: 8, letterSpacing: "0.11em" };
const copyStyle: React.CSSProperties = { margin: "4px 0 0", color: "rgba(203,219,235,0.76)", fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, lineHeight: 1.55 };
function InfoBlock({ label, children }: { label: string; children: React.ReactNode }) { return <div><div style={sectionLabelStyle}>{label}</div>{children}</div>; }
function Metric({ label, value }: { label: string; value: string }) { return <div style={{ border: "1px solid rgba(255,255,255,0.07)", borderRadius: 4, padding: "8px 9px" }}><div style={{ color: "rgba(148,163,184,0.5)", fontFamily: "'IBM Plex Mono', monospace", fontSize: 7 }}>{label}</div><div style={{ color: "rgba(224,237,248,0.84)", fontFamily: "'IBM Plex Mono', monospace", fontSize: 9, marginTop: 4, lineHeight: 1.35 }}>{value}</div></div>; }

export default function RisingStars() {
  useSEO({ title: "Rising Stars | FAULTLINE", description: "Public-market discovery for source-verified companies with current technical structure and FAULTLINE context.", canonical: "/app/rising-stars" });
  const [, navigate] = useLocation();
  const saved = parseSavedState();
  const [topCategory, setTopCategory] = useState<TopCategory>(saved.topCategory ?? "all");
  const [listingAge, setListingAge] = useState<ListingAgeCategory | "">(saved.listingAge ?? "");
  const [sector, setSector] = useState<string>(saved.sector ?? "");
  const [theme, setTheme] = useState<string>(saved.theme ?? "");
  const [characteristic, setCharacteristic] = useState<"" | "momentum" | "high_risk">(saved.characteristic ?? "");
  const [sort, setSort] = useState<SortKey>(saved.sort ?? "score");
  const query = trpc.outlook.getOpportunityDiscovery.useQuery(undefined, { staleTime: 2 * 60 * 1000, refetchInterval: 5 * 60 * 1000, retry: 2, retryDelay: attempt => Math.min(1_000 * (attempt + 1), 3_000) });
  const items = (query.data?.risingStars ?? []) as DiscoveryStar[];
  const sectors = useMemo(() => [...new Set(items.map(item => item.sector).filter((value): value is string => Boolean(value)))].sort(), [items]);
  const themes = useMemo(() => [...new Set(items.flatMap(item => item.themes))].sort(), [items]);
  useEffect(() => { sessionStorage.setItem("faultline:rising-stars:filters", JSON.stringify({ topCategory, listingAge, sector, theme, characteristic, sort })); }, [topCategory, listingAge, sector, theme, characteristic, sort]);
  const visible = useMemo(() => items.filter(item => {
    const topMatch = topCategory === "all" || (topCategory === "new_listings" ? item.listingAgeCategory === "under_1y" : topCategory === "mag7" ? item.isMagnificentSeven : item.marketCapCategory === topCategory);
    return topMatch && (!listingAge || item.listingAgeCategory === listingAge) && (!sector || item.sector === sector) && (!theme || item.themes.includes(theme)) && (!characteristic || (characteristic === "momentum" ? item.momentumScore >= 70 : item.riskLevel === "ELEVATED"));
  }).sort((a, b) => {
    if (sort === "newest") return (b.listingDate ?? "").localeCompare(a.listingDate ?? "");
    if (sort === "gain") return (b.dailyChangePercent ?? -Infinity) - (a.dailyChangePercent ?? -Infinity);
    if (sort === "loss") return (a.dailyChangePercent ?? Infinity) - (b.dailyChangePercent ?? Infinity);
    if (sort === "market_cap") return (b.marketCap ?? -Infinity) - (a.marketCap ?? -Infinity);
    if (sort === "momentum") return b.momentumScore - a.momentumScore;
    if (sort === "low_risk") return (a.riskLevel === "MODERATE" ? 0 : 1) - (b.riskLevel === "MODERATE" ? 0 : 1);
    if (sort === "high_risk") return (a.riskLevel === "ELEVATED" ? 0 : 1) - (b.riskLevel === "ELEVATED" ? 0 : 1);
    return b.risingStarScore - a.risingStarScore;
  }), [items, topCategory, listingAge, sector, theme, characteristic, sort]);
  const filtersActive = topCategory !== "all" || Boolean(listingAge || sector || theme || characteristic || sort !== "score");
  const clearFilters = () => { setTopCategory("all"); setListingAge(""); setSector(""); setTheme(""); setCharacteristic(""); setSort("score"); };
  const analyze = (ticker: string) => navigate(`/app/rising-stars/${ticker}`);

  return <main style={{ minHeight: "100vh", background: "#050608", color: "#F0F4FF", padding: "24px 16px 90px" }}><div style={{ maxWidth: 1380, margin: "0 auto" }}>
    <button onClick={() => navigate("/app/signals?view=rising-stars")} style={{ background: "transparent", border: "none", padding: 0, color: "rgba(176,196,216,0.62)", cursor: "pointer", fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, display: "inline-flex", alignItems: "center", gap: 6 }}><ArrowLeft size={13} /> BACK TO SIGNALS</button>
    <header style={{ display: "flex", justifyContent: "space-between", gap: 18, alignItems: "flex-end", flexWrap: "wrap", margin: "18px 0" }}><div><div style={{ color: "#00D4FF", fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, letterSpacing: "0.15em" }}><Sparkles size={13} style={{ display: "inline", verticalAlign: "-2px", marginRight: 5 }} />INTELLIGENCE LAB</div><h1 style={{ margin: "7px 0 5px", fontFamily: "'Rajdhani', sans-serif", fontSize: 36, letterSpacing: "0.04em" }}>RISING STARS</h1><p style={{ maxWidth: 820, margin: 0, color: "rgba(176,196,216,0.67)", fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, lineHeight: 1.6 }}>Public-market discovery across approved regulated exchanges. Scores rank the current covered universe; they are not return forecasts. Private, pre-IPO, OTC, and pink-sheet securities are excluded.</p></div><div style={{ display: "flex", gap: 8 }}><button onClick={() => query.refetch()} style={actionButton}><RefreshCw size={11} style={{ display: "inline", verticalAlign: "-2px", marginRight: 5 }} />REFRESH</button><button onClick={() => navigate("/app/asha")} style={{ ...actionButton, color: "#C4B5FD", borderColor: "rgba(167,139,250,0.3)", background: "rgba(167,139,250,0.06)" }}><BrainCircuit size={11} style={{ display: "inline", verticalAlign: "-2px", marginRight: 5 }} />ASK ASHA</button></div></header>
    {query.isLoading ? <div style={statusStyle}>LOADING VERIFIED PUBLIC-MARKET DISCOVERY…</div> : query.isError ? <div style={{ ...statusStyle, borderColor: "rgba(255,77,106,0.3)", color: "#FDA4AF" }}>RISING STARS DATA TEMPORARILY UNAVAILABLE. <button onClick={() => query.refetch()} style={linkButton}>RETRY</button></div> : <>
      <section aria-label="Rising Stars filters" style={{ border: "1px solid rgba(0,212,255,0.14)", borderRadius: 8, background: "rgba(7,10,15,0.72)", padding: 12, marginBottom: 16 }}>
        <div style={{ display: "flex", gap: 7, overflowX: "auto", paddingBottom: 2, WebkitOverflowScrolling: "touch" as never }}>{TOP_CATEGORIES.map(category => <button key={category.id} onClick={() => setTopCategory(category.id)} style={{ ...filterChip, color: topCategory === category.id ? "#E7F8FF" : "rgba(176,196,216,0.62)", background: topCategory === category.id ? "rgba(0,212,255,0.12)" : "transparent", borderColor: topCategory === category.id ? "rgba(0,212,255,0.42)" : "rgba(255,255,255,0.09)" }}>{category.label}</button>)}</div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginTop: 11 }}><span style={{ color: "#00D4FF", fontFamily: "'IBM Plex Mono', monospace", fontSize: 9, letterSpacing: "0.08em" }}><Filter size={11} style={{ display: "inline", verticalAlign: "-2px", marginRight: 4 }} />ADVANCED</span><Select label="Listing age" value={listingAge} onChange={value => setListingAge(value as ListingAgeCategory | "")} options={[ ["", "Any listing age"], ["under_1y", "Under 1 Year Public"], ["one_to_three_y", "1–3 Years Public"], ["three_plus_y", "3+ Years Public"] ]} /><Select label="Sector" value={sector} onChange={setSector} options={[["", "Any sector"], ...sectors.map(value => [value, value])]} /><Select label="Theme" value={theme} onChange={setTheme} options={[["", "Any theme"], ...themes.map(value => [value, value])]} /><Select label="Signal" value={characteristic} onChange={value => setCharacteristic(value as "" | "momentum" | "high_risk")} options={[["", "Any characteristic"], ["momentum", "Strong Momentum"], ["high_risk", "High Risk / High Reward"]]} /><Select label="Sort" value={sort} onChange={value => setSort(value as SortKey)} options={Object.entries(SORT_LABELS)} />{filtersActive && <button onClick={clearFilters} style={{ ...linkButton, display: "inline-flex", alignItems: "center", gap: 4 }}><X size={11} />CLEAR FILTERS</button>}</div>
        <div style={{ marginTop: 10, color: "rgba(176,196,216,0.58)", fontFamily: "'IBM Plex Mono', monospace", fontSize: 9 }}>{visible.length} {visible.length === 1 ? "company" : "companies"}{filtersActive ? " · active filters applied" : " · current covered public-market universe"}</div>
      </section>
      {visible.length === 0 ? <div style={statusStyle}>NO RISING STARS CURRENTLY MATCH THESE FILTERS. <button onClick={clearFilters} style={linkButton}>CLEAR FILTERS</button></div> : <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 340px), 1fr))", gap: 13 }}>{visible.map(item => <StarCard key={item.ticker} item={item} onAnalyze={() => analyze(item.ticker)} />)}</section>}
    </>}
  </div></main>;
}

function Select({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: Array<[string, string]> }) { return <label style={{ display: "contents" }}><span className="sr-only">{label}</span><select value={value} onChange={event => onChange(event.target.value)} style={{ border: "1px solid rgba(255,255,255,0.11)", borderRadius: 4, background: "#0A0E14", color: "#C8D8E8", padding: "7px 8px", minHeight: 32, fontFamily: "'IBM Plex Mono', monospace", fontSize: 9, maxWidth: "100%" }}>{options.map(([id, text]) => <option key={id} value={id}>{text}</option>)}</select></label>; }
const actionButton: React.CSSProperties = { padding: "8px 10px", borderRadius: 4, border: "1px solid rgba(0,212,255,0.24)", color: "#00D4FF", background: "rgba(0,212,255,0.05)", cursor: "pointer", fontFamily: "'IBM Plex Mono', monospace", fontSize: 9 };
const filterChip: React.CSSProperties = { flexShrink: 0, border: "1px solid", borderRadius: 99, padding: "7px 10px", cursor: "pointer", fontFamily: "'IBM Plex Mono', monospace", fontSize: 9, minHeight: 32 };
const statusStyle: React.CSSProperties = { padding: 18, border: "1px solid rgba(0,212,255,0.18)", borderRadius: 6, color: "rgba(176,196,216,0.68)", fontFamily: "'IBM Plex Mono', monospace", fontSize: 10 };
const linkButton: React.CSSProperties = { color: "#00D4FF", background: "none", border: "none", cursor: "pointer", fontFamily: "'IBM Plex Mono', monospace", fontSize: 9, textDecoration: "underline" };
