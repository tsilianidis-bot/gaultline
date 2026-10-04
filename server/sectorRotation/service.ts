/**
 * FAULTLINE Sector Rotation — data acquisition (read-only) + cached reading.
 *
 * Sources (no new vendors, secrets or env vars):
 *  - Yahoo Finance v8 chart (existing adapter, server/yahooProxy.ts getDailyChart):
 *    SPY, XLK XLF XLE XLV XLI XLY XLP XLU XLB XLRE XLC, SOXX, SMH, IWM, CL=F, DX-Y.NYB, ^VIX (range 6mo)
 *    and every S&P 500 constituent (range 3mo).
 *  - FRED (existing client, server/fredClient.ts, existing FRED_API_KEY): DGS10, DGS2, BAMLH0A0HYM2, T10YIE, WALCL.
 *  - S&P 500 constituents + GICS sector: the 11 Select Sector SPDR daily holdings files published by
 *    State Street (public, no key): https://www.ssga.com/us/en/intermediary/library-content/products/fund-data/etfs/us/holdings-daily-us-en-<etf>.xlsx
 *  - Company news: Polygon /v2/reference/news (existing provider, existing POLYGON_API_KEY), one bulk request per window.
 *  - Canonical regime / Pressure Index / stateId: getAuthoritativeCanonicalIntelligenceState() (read-only select).
 *
 * Reads perform no DB writes, no shadow writes and send no email. Nothing here
 * feeds the Pressure Index, engines or the probability contract.
 */
import XLSX from "xlsx";
import { LRUCache } from "../lruCache";
import { log } from "../logger";
import { getDailyChart, type YahooDailyChart } from "../yahooProxy";
import { fetchFredSeries } from "../fredClient";
import { BENCHMARK_TICKER, SECTOR_ETFS, type CanonicalLink, type SectorRotationReading } from "../../shared/sectorRotation";
import { parseSsgaHoldings } from "./universe";
import {
  buildSectorRotationReading, dailyChange, newsWindow, splitBars,
  type ChartInput, type FredInput, type NewsInput, type SectorRotationInputs, type UniverseInput,
} from "./calc";

export const ROTATION_CHART_SYMBOLS = [BENCHMARK_TICKER, ...SECTOR_ETFS.map(s => s.ticker), "SOXX", "SMH", "IWM", "CL=F", "DX-Y.NYB", "^VIX"] as const;
export const ROTATION_FRED_SERIES = [
  { id: "DGS10", limit: 60 }, { id: "DGS2", limit: 60 }, { id: "BAMLH0A0HYM2", limit: 60 }, { id: "T10YIE", limit: 60 }, { id: "WALCL", limit: 12 },
] as const;
export const SSGA_HOLDINGS_URL = (etf: string) => `https://www.ssga.com/us/en/intermediary/library-content/products/fund-data/etfs/us/holdings-daily-us-en-${etf.toLowerCase()}.xlsx`;
const POLYGON_NEWS_URL = "https://api.polygon.io/v2/reference/news";
const STOCK_CONCURRENCY = 8;

function toChartInput(chart: YahooDailyChart): ChartInput {
  return { ticker: chart.ticker, bars: chart.bars, regularMarketTime: chart.regularMarketTime, companyName: chart.longName, error: chart.error };
}

async function mapLimit<T, R>(items: readonly T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out = new Array<R>(items.length);
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) { const i = next++; out[i] = await fn(items[i]); }
  }));
  return out;
}

// ── Universe (SSGA Select Sector SPDR holdings) ──────────────────────────────

const universeCache = new LRUCache<string, UniverseInput>(2, 12 * 60 * 60_000);
const universeFailureCache = new LRUCache<string, UniverseInput>(2, 5 * 60_000);
async function fetchUniverse(): Promise<UniverseInput> {
  const cached = universeCache.get("sp500") ?? universeFailureCache.get("sp500");
  if (cached) return cached;
  const base = { name: "S&P 500 (union of the 11 Select Sector SPDR holdings)", source: "State Street SPDR daily holdings files (ssga.com)" };
  try {
    const parts = await Promise.all(SECTOR_ETFS.map(async ({ ticker }) => {
      const res = await fetch(SSGA_HOLDINGS_URL(ticker), { headers: { "User-Agent": "Mozilla/5.0" }, redirect: "follow", signal: AbortSignal.timeout(15_000) });
      if (!res.ok) throw new Error(`${ticker} holdings HTTP ${res.status}`);
      const wb = XLSX.read(new Uint8Array(await res.arrayBuffer()), { type: "array" });
      const rows = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[wb.SheetNames[0]], { header: 1, raw: true, defval: null });
      const parsed = parseSsgaHoldings(rows, ticker);
      if (parsed.members.length === 0) throw new Error(`${ticker} holdings file had no equity rows`);
      return parsed;
    }));
    const seen = new Set<string>();
    const members = parts.flatMap(p => p.members).filter(m => (seen.has(m.ticker) ? false : (seen.add(m.ticker), true)));
    const asOfs = parts.map(p => p.asOf).filter((d): d is string => !!d).sort();
    const universe: UniverseInput = { ...base, status: "OK", asOf: asOfs[0] ?? null, members, reason: null };
    universeCache.set("sp500", universe);
    return universe;
  } catch (error) {
    const reason = `Constituent list unavailable: ${error instanceof Error ? error.message : String(error)}`;
    log.warn(`[SectorRotation] ${reason}`);
    const failed: UniverseInput = { ...base, status: "UNAVAILABLE", asOf: null, members: [], reason };
    universeFailureCache.set("sp500", failed);
    return failed;
  }
}

// ── News (Polygon, one bulk request per window) ──────────────────────────────

const newsCache = new LRUCache<string, NewsInput>(8, 10 * 60_000);
async function fetchNews(window: { start: number; end: number } | null): Promise<NewsInput> {
  if (!window) return { status: "UNAVAILABLE", reason: "No session window for news matching.", items: [] };
  const apiKey = process.env.POLYGON_API_KEY;
  if (!apiKey) return { status: "UNAVAILABLE", reason: "News source not configured (POLYGON_API_KEY absent).", items: [] };
  const key = `${window.start}_${window.end}`;
  const cached = newsCache.get(key);
  if (cached) return cached;
  const params = new URLSearchParams({ "published_utc.gt": new Date(window.start).toISOString(), "published_utc.lte": new Date(window.end).toISOString(), order: "desc", sort: "published_utc", limit: "1000" });
  try {
    const res = await fetch(`${POLYGON_NEWS_URL}?${params}&apiKey=${apiKey}`, { signal: AbortSignal.timeout(12_000) });
    if (!res.ok) throw new Error(`Polygon news HTTP ${res.status}`);
    const data = await res.json() as { results?: Array<{ id?: string; title?: string; publisher?: { name?: string }; article_url?: string; published_utc?: string; tickers?: string[] }> };
    const items = (data.results ?? [])
      .filter(r => r.id && r.title && r.article_url && r.published_utc && Array.isArray(r.tickers))
      .map(r => ({ id: r.id!, title: r.title!.trim(), publisher: r.publisher?.name?.trim() || "Unknown publisher", url: r.article_url!, publishedAt: r.published_utc!, tickers: r.tickers!.map(t => t.toUpperCase().replace(".", "-")) }));
    const news: NewsInput = { status: "OK", reason: null, items };
    newsCache.set(key, news);
    return news;
  } catch (error) {
    // Never log the request URL (it carries the key).
    const reason = `News source unavailable: ${error instanceof Error ? error.message : String(error)}`;
    log.warn(`[SectorRotation] ${reason}`);
    return { status: "UNAVAILABLE", reason, items: [] };
  }
}

// ── Canonical link (read-only) ───────────────────────────────────────────────

async function readCanonicalLink(): Promise<CanonicalLink> {
  try {
    const { getAuthoritativeCanonicalIntelligenceState } = await import("../canonicalIntelligenceState");
    const state = await getAuthoritativeCanonicalIntelligenceState();
    if (!state) return { stateId: null, stateHash: null, stateGeneratedAt: null, runId: null, regime: null, pressureIndex: null };
    return { stateId: state.stateId ?? null, stateHash: state.stateHash ?? null, stateGeneratedAt: state.generatedAt ?? null, runId: null, regime: state.regime ?? null, pressureIndex: typeof state.pressureIndex === "number" ? state.pressureIndex : null };
  } catch (error) {
    log.warn(`[SectorRotation] Canonical state unavailable: ${error instanceof Error ? error.message : String(error)}`);
    return { stateId: null, stateHash: null, stateGeneratedAt: null, runId: null, regime: null, pressureIndex: null };
  }
}

// ── Assemble inputs + cached reading ─────────────────────────────────────────

export async function collectSectorRotationInputs(now: () => number = Date.now): Promise<SectorRotationInputs> {
  const [charts, fred, universe, canonical] = await Promise.all([
    mapLimit(ROTATION_CHART_SYMBOLS, STOCK_CONCURRENCY, s => getDailyChart(s, "6mo")),
    Promise.all(ROTATION_FRED_SERIES.map(async s => { const r = await fetchFredSeries(s.id, s.limit, "desc"); return { id: s.id, observations: r.observations, error: r.error ?? null } as FredInput; })),
    fetchUniverse(),
    readCanonicalLink(),
  ]);
  const stockCharts = universe.status === "OK" ? await mapLimit(universe.members, STOCK_CONCURRENCY, m => getDailyChart(m.ticker, "3mo")) : [];
  const at = now();
  const chartMap = Object.fromEntries(charts.map((c, i) => [ROTATION_CHART_SYMBOLS[i], toChartInput(c)]));
  // News window follows SPY's daily-change basis (same basis the movers are ranked on).
  const spy = chartMap[BENCHMARK_TICKER];
  const spySplit = splitBars(spy?.error ? [] : spy?.bars ?? [], at);
  const spyDaily = dailyChange(spySplit, spy?.regularMarketTime ?? null);
  const prior = spyDaily ? (spyDaily.basis.kind === "SESSION_CLOSE" ? spySplit.completed.at(-2)?.session : spySplit.completed.at(-1)?.session) ?? null : null;
  const news = await fetchNews(spyDaily ? newsWindow(spyDaily.basis, prior, at) : null);
  return {
    now: at, canonical, charts: chartMap,
    fred: Object.fromEntries(fred.map(f => [f.id, f])),
    universe,
    stockCharts: Object.fromEntries(stockCharts.map((c, i) => [universe.members[i].ticker, toChartInput(c)])),
    news,
  };
}

const READING_TTL_MS = 5 * 60_000;
const readingCache = new LRUCache<string, SectorRotationReading>(1, READING_TTL_MS);
let inFlight: Promise<SectorRotationReading> | null = null;

/** Cached (5 min), de-duplicated, never throws. */
export async function getSectorRotationReading(): Promise<SectorRotationReading> {
  const cached = readingCache.get("current");
  if (cached) return cached;
  if (inFlight) return inFlight;
  inFlight = (async () => {
    try {
      const reading = buildSectorRotationReading(await collectSectorRotationInputs());
      readingCache.set("current", reading);
      return reading;
    } finally {
      inFlight = null;
    }
  })();
  return inFlight;
}
