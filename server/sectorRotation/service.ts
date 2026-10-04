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
 * Only the post-close collector (./collector.ts) calls collectSectorRotationInputs; the
 * public query serves the saved snapshot (./snapshotStore.ts, append-only rows in the
 * existing marketMemory table) and never triggers a fan-out. No shadow writes, no email.
 * Nothing here feeds the Pressure Index, engines or the probability contract.
 */
import XLSX from "xlsx";
import { LRUCache } from "../lruCache";
import { log } from "../logger";
import { getDailyChart, type YahooDailyChart } from "../yahooProxy";
import { fetchFredSeries } from "../fredClient";
import { BENCHMARK_TICKER, SECTOR_ETFS, type CanonicalLink } from "../../shared/sectorRotation";
import { parseSsgaHoldings } from "./universe";
import { SECTOR_ROTATION_COLLECTOR_POLICY as POLICY, type SectorRotationServed } from "../../shared/sectorRotation";
import { SectorRotationCollector, abortBudget, newBudget, type FanoutBudget } from "./collector";
import { createMarketMemorySnapshotStore } from "./snapshotStore";
import {
  dailyChange, newsWindow, splitBars,
  type ChartInput, type FredInput, type NewsInput, type SectorRotationInputs, type UniverseInput,
} from "./calc";

export const ROTATION_CHART_SYMBOLS = [BENCHMARK_TICKER, ...SECTOR_ETFS.map(s => s.ticker), "SOXX", "SMH", "IWM", "CL=F", "DX-Y.NYB", "^VIX"] as const;
export const ROTATION_FRED_SERIES = [
  { id: "DGS10", limit: 60 }, { id: "DGS2", limit: 60 }, { id: "BAMLH0A0HYM2", limit: 60 }, { id: "T10YIE", limit: 60 }, { id: "WALCL", limit: 12 },
] as const;
export const SSGA_HOLDINGS_URL = (etf: string) => `https://www.ssga.com/us/en/intermediary/library-content/products/fund-data/etfs/us/holdings-daily-us-en-${etf.toLowerCase()}.xlsx`;
const POLYGON_NEWS_URL = "https://api.polygon.io/v2/reference/news";

function toChartInput(chart: YahooDailyChart): ChartInput {
  return { ticker: chart.ticker, bars: chart.bars, regularMarketTime: chart.regularMarketTime, companyName: chart.longName, error: chart.error };
}

const sleep = (ms: number) => new Promise<void>(r => setTimeout(r, ms));
const isRateLimit = (error: string | null | undefined) => !!error && /\b429\b/.test(error);

/**
 * Bounded, paced fan-out: POLICY.fanoutConcurrency workers, POLICY.fanoutDelayMs between a
 * worker's requests. Once the budget is aborted (HTTP 429, timeout) no new request is issued;
 * the remaining items get `skipped(...)` so the build is invalid and is not saved.
 */
async function pacedMap<T, R>(items: readonly T[], budget: FanoutBudget, fn: (item: T) => Promise<R>, skipped: (item: T, reason: string) => R, check: (r: R) => void): Promise<R[]> {
  const out = new Array<R>(items.length);
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(POLICY.fanoutConcurrency, items.length) }, async (_, w) => {
    if (w > 0) await sleep(POLICY.fanoutDelayMs * w / POLICY.fanoutConcurrency);
    while (next < items.length) {
      const i = next++;
      if (!budget.aborted && Date.now() > budget.deadline) abortBudget(budget, `overall build timeout (${POLICY.buildTimeoutMinutes} min)`);
      if (budget.aborted) { out[i] = skipped(items[i], budget.abortReason ?? "build aborted"); continue; }
      budget.requests += 1;
      out[i] = await fn(items[i]);
      check(out[i]);
      if (next < items.length && !budget.aborted) await sleep(POLICY.fanoutDelayMs);
    }
  }));
  return out;
}
const skippedChart = (ticker: string, reason: string): YahooDailyChart => ({ ticker: ticker.toUpperCase(), bars: [], regularMarketTime: null, longName: null, fetchedAt: 0, error: `Skipped: ${reason}` });
const checkChart = (budget: FanoutBudget) => (c: YahooDailyChart) => { if (isRateLimit(c.error)) abortBudget(budget, `Yahoo ${c.ticker}: ${c.error}`, true); };

// ── Universe (SSGA Select Sector SPDR holdings) ──────────────────────────────

const universeCache = new LRUCache<string, UniverseInput>(2, 12 * 60 * 60_000);
async function fetchUniverse(budget: FanoutBudget): Promise<UniverseInput> {
  const cached = universeCache.get("sp500");
  if (cached) return cached;
  const base = { name: "S&P 500 (union of the 11 Select Sector SPDR holdings)", source: "State Street SPDR daily holdings files (ssga.com)" };
  try {
    const parts = await pacedMap(SECTOR_ETFS, budget, async ({ ticker }) => {
      const res = await fetch(SSGA_HOLDINGS_URL(ticker), { headers: { "User-Agent": "Mozilla/5.0" }, redirect: "follow", signal: AbortSignal.timeout(15_000) });
      if (res.status === 429) { abortBudget(budget, `SSGA ${ticker} holdings HTTP 429`, true); throw new Error(`${ticker} holdings HTTP 429`); }
      if (!res.ok) throw new Error(`${ticker} holdings HTTP ${res.status}`);
      const wb = XLSX.read(new Uint8Array(await res.arrayBuffer()), { type: "array" });
      const rows = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[wb.SheetNames[0]], { header: 1, raw: true, defval: null });
      const parsed = parseSsgaHoldings(rows, ticker);
      if (parsed.members.length === 0) throw new Error(`${ticker} holdings file had no equity rows`);
      return parsed;
    }, (_etf, reason) => { throw new Error(`skipped: ${reason}`); }, () => {});
    const seen = new Set<string>();
    const members = parts.flatMap(p => p.members).filter(m => (seen.has(m.ticker) ? false : (seen.add(m.ticker), true)));
    const asOfs = parts.map(p => p.asOf).filter((d): d is string => !!d).sort();
    const universe: UniverseInput = { ...base, status: "OK", asOf: asOfs[0] ?? null, members, reason: null };
    universeCache.set("sp500", universe);
    return universe;
  } catch (error) {
    const reason = `Constituent list unavailable: ${error instanceof Error ? error.message : String(error)}`;
    log.warn(`[SectorRotation] ${reason}`);
    return { ...base, status: "UNAVAILABLE", asOf: null, members: [], reason };
  }
}

// ── News (Polygon, one bulk request per window) ──────────────────────────────

const newsCache = new LRUCache<string, NewsInput>(8, 10 * 60_000);
async function fetchNews(window: { start: number; end: number } | null, budget: FanoutBudget): Promise<NewsInput> {
  if (!window) return { status: "UNAVAILABLE", reason: "No session window for news matching.", items: [] };
  const apiKey = process.env.POLYGON_API_KEY;
  if (!apiKey) return { status: "UNAVAILABLE", reason: "News source not configured (POLYGON_API_KEY absent).", items: [] };
  const key = `${window.start}_${window.end}`;
  const cached = newsCache.get(key);
  if (cached) return cached;
  if (budget.aborted) return { status: "UNAVAILABLE", reason: `News not fetched: ${budget.abortReason}`, items: [] };
  const params = new URLSearchParams({ "published_utc.gt": new Date(window.start).toISOString(), "published_utc.lte": new Date(window.end).toISOString(), order: "desc", sort: "published_utc", limit: "1000" });
  try {
    budget.requests += 1;
    const res = await fetch(`${POLYGON_NEWS_URL}?${params}&apiKey=${apiKey}`, { signal: AbortSignal.timeout(12_000) });
    if (res.status === 429) abortBudget(budget, "Polygon news HTTP 429", true);
    if (!res.ok) throw new Error(`Polygon news HTTP ${res.status}`);
    const data = await res.json() as { results?: Array<{ id?: string; title?: string; publisher?: { name?: string }; article_url?: string; published_utc?: string; tickers?: string[] }> };
    const items = (data.results ?? [])
      .filter(r => r.id && r.title && r.article_url && r.published_utc && Array.isArray(r.tickers))
      .map(r => ({ id: r.id!, title: r.title!.trim(), publisher: r.publisher?.name?.trim() ?? "", url: r.article_url!, publishedAt: r.published_utc!, tickers: r.tickers!.map(t => t.toUpperCase().replace(".", "-")) }));
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

export async function collectSectorRotationInputs(budget: FanoutBudget = newBudget(Date.now()), now: () => number = Date.now): Promise<SectorRotationInputs> {
  const charts = await pacedMap(ROTATION_CHART_SYMBOLS, budget, s => getDailyChart(s, "6mo"), skippedChart, checkChart(budget));
  const [fred, universe, canonical] = await Promise.all([
    Promise.all(ROTATION_FRED_SERIES.map(async s => { const r = await fetchFredSeries(s.id, s.limit, "desc"); return { id: s.id, observations: r.observations, error: r.error ?? null } as FredInput; })),
    budget.aborted ? Promise.resolve<UniverseInput>({ name: "S&P 500", source: "ssga.com", status: "UNAVAILABLE", asOf: null, members: [], reason: `Not fetched: ${budget.abortReason}` }) : fetchUniverse(budget),
    readCanonicalLink(),
  ]);
  const stockCharts = universe.status === "OK" && !budget.aborted ? await pacedMap(universe.members.map(m => m.ticker), budget, t => getDailyChart(t, "3mo"), skippedChart, checkChart(budget)) : [];
  const at = now();
  const chartMap = Object.fromEntries(charts.map((c, i) => [ROTATION_CHART_SYMBOLS[i], toChartInput(c)]));
  // News window follows SPY's daily-change basis (same basis the movers are ranked on).
  const spy = chartMap[BENCHMARK_TICKER];
  const spySplit = splitBars(spy?.error ? [] : spy?.bars ?? [], at);
  const spyDaily = dailyChange(spySplit, spy?.regularMarketTime ?? null);
  const prior = spyDaily ? (spyDaily.basis.kind === "SESSION_CLOSE" ? spySplit.completed.at(-2)?.session : spySplit.completed.at(-1)?.session) ?? null : null;
  const news = await fetchNews(spyDaily ? newsWindow(spyDaily.basis, prior, at) : null, budget);
  return {
    now: at, canonical, charts: chartMap,
    fred: Object.fromEntries(fred.map(f => [f.id, f])),
    universe,
    stockCharts: Object.fromEntries(stockCharts.map((c, i) => [universe.members[i].ticker, toChartInput(c)])),
    news,
  };
}

/** The single in-process collector (started from server boot). */
export const sectorRotationCollector = new SectorRotationCollector({
  now: () => Date.now(),
  store: createMarketMemorySnapshotStore(),
  collect: budget => collectSectorRotationInputs(budget),
  log: { info: m => log.info(m), warn: m => log.warn(m) },
});

/** Public read path: the saved snapshot only (memory / store read). Never builds, never fans out. */
export function getServedSectorRotation(): Promise<SectorRotationServed> {
  return sectorRotationCollector.served();
}

/** Called once from server boot (server/_core/index.ts). */
export function startSectorRotationCollector() {
  sectorRotationCollector.start();
}
