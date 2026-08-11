/**
 * FAULTLINE — Global Markets tRPC Router
 * server/routers/markets.ts
 *
 * Provides a single getGlobalSnapshot procedure that fetches live quotes
 * for all global indices, macro assets, and crypto in one batched call.
 * Uses yahooProxy.getQuotes() with server-side LRU caching (90s TTL).
 *
 * Symbols:
 *   US Equities:    ^GSPC, ^DJI, ^IXIC, ^NYA, ^RUT
 *   Volatility:     ^VIX
 *   Europe:         ^FTSE, ^GDAXI, ^FCHI, ^STOXX50E
 *   Asia:           ^N225, ^HSI, 000001.SS, 399001.SZ
 *   Rates:          ^TNX (10Y), ^IRX (13-week proxy for 2Y), ^TYX (30Y)
 *   Dollar:         DX-Y.NYB (DXY)
 *   Commodities:    GC=F (Gold), CL=F (WTI), BZ=F (Brent)
 *   Crypto:         BTC-USD, ETH-USD
 */
import { publicProcedure, router } from "../_core/trpc";
import { getQuotes, type YahooQuote } from "../yahooProxy";
import { LRUCache } from "../lruCache";
import { log } from "../logger";

// ── Instrument definitions ────────────────────────────────────────────────────
export interface MarketInstrument {
  symbol: string;
  label: string;
  shortLabel: string;
  category: "us_equity" | "volatility" | "europe" | "asia" | "rates" | "dollar" | "commodity" | "crypto";
  region?: string;
  unit?: "price" | "percent" | "bps";
}

export const GLOBAL_INSTRUMENTS: MarketInstrument[] = [
  // US Equities
  { symbol: "^GSPC",    label: "S&P 500",           shortLabel: "SPX",    category: "us_equity" },
  { symbol: "^DJI",     label: "Dow Jones",          shortLabel: "DJIA",   category: "us_equity" },
  { symbol: "^IXIC",    label: "Nasdaq",             shortLabel: "IXIC",   category: "us_equity" },
  { symbol: "^NYA",     label: "NYSE Composite",     shortLabel: "NYA",    category: "us_equity" },
  { symbol: "^RUT",     label: "Russell 2000",       shortLabel: "RUT",    category: "us_equity" },
  // Volatility
  { symbol: "^VIX",     label: "VIX",                shortLabel: "VIX",    category: "volatility" },
  // Europe
  { symbol: "^FTSE",    label: "FTSE 100",           shortLabel: "FTSE",   category: "europe",  region: "UK" },
  { symbol: "^GDAXI",   label: "DAX",                shortLabel: "DAX",    category: "europe",  region: "Germany" },
  { symbol: "^FCHI",    label: "CAC 40",             shortLabel: "CAC",    category: "europe",  region: "France" },
  { symbol: "^STOXX50E",label: "STOXX 50",           shortLabel: "SX5E",   category: "europe",  region: "Europe" },
  // Asia
  { symbol: "^N225",    label: "Nikkei 225",         shortLabel: "N225",   category: "asia",    region: "Japan" },
  { symbol: "^HSI",     label: "Hang Seng",          shortLabel: "HSI",    category: "asia",    region: "HK" },
  { symbol: "000001.SS",label: "Shanghai Comp.",     shortLabel: "SHCOMP", category: "asia",    region: "China" },
  { symbol: "399001.SZ",label: "Shenzhen Comp.",     shortLabel: "SZCOMP", category: "asia",    region: "China" },
  // Rates
  { symbol: "^TNX",     label: "10Y Treasury",       shortLabel: "10Y",    category: "rates",   unit: "percent" },
  { symbol: "^FVX",     label: "5Y Treasury",        shortLabel: "5Y",     category: "rates",   unit: "percent" },
  { symbol: "^IRX",     label: "2Y Treasury (proxy)",shortLabel: "2Y",     category: "rates",   unit: "percent" },
  // Dollar
  { symbol: "DX-Y.NYB", label: "US Dollar Index",    shortLabel: "DXY",    category: "dollar" },
  // Commodities
  { symbol: "GC=F",     label: "Gold",               shortLabel: "GOLD",   category: "commodity" },
  { symbol: "CL=F",     label: "WTI Crude",          shortLabel: "WTI",    category: "commodity" },
  { symbol: "BZ=F",     label: "Brent Crude",        shortLabel: "BRENT",  category: "commodity" },
  // Crypto
  { symbol: "BTC-USD",  label: "Bitcoin",            shortLabel: "BTC",    category: "crypto" },
  { symbol: "ETH-USD",  label: "Ethereum",           shortLabel: "ETH",    category: "crypto" },
];

// ── Snapshot cache (90s TTL) ──────────────────────────────────────────────────
interface SnapshotEntry {
  data: GlobalMarketSnapshot;
  fetchedAt: number;
}
const SNAPSHOT_TTL_MS = 90_000; // 90 seconds
const snapshotCache = new LRUCache<string, SnapshotEntry>(1, SNAPSHOT_TTL_MS);

// ── Types ─────────────────────────────────────────────────────────────────────
export interface MarketQuoteItem {
  symbol: string;
  label: string;
  shortLabel: string;
  category: MarketInstrument["category"];
  region?: string;
  unit?: string;
  price: number | null;
  prevClose: number | null;
  open: number | null;
  high: number | null;
  low: number | null;
  change: number | null;
  changePercent: number | null;
  marketState: YahooQuote["marketState"];
  isDelayed: boolean;
  source: string;
  error?: string;
}

export interface GlobalMarketSnapshot {
  items: MarketQuoteItem[];
  fetchedAt: number;
  // Derived summary
  summary: {
    usEquities: "risk-on" | "risk-off" | "mixed" | "unavailable";
    europe: "positive" | "negative" | "mixed" | "closed" | "unavailable";
    asia: "positive" | "negative" | "mixed" | "closed" | "unavailable";
    volatility: "elevated" | "normal" | "low" | "unavailable";
    dollar: "strengthening" | "weakening" | "stable" | "unavailable";
    rates: "rising" | "falling" | "stable" | "unavailable";
    commodities: "positive" | "negative" | "mixed" | "unavailable";
    crypto: "positive" | "negative" | "mixed" | "unavailable";
  };
  // Ranked by % change
  strongest: MarketQuoteItem[];
  weakest: MarketQuoteItem[];
}

// ── Summary derivation ────────────────────────────────────────────────────────
function deriveStatus<T extends string>(
  items: MarketQuoteItem[],
  positiveLabel: T,
  negativeLabel: T,
  mixedLabel: T,
  unavailableLabel: T,
  closedLabel?: T
): T {
  const live = items.filter(i => i.changePercent !== null);
  if (live.length === 0) return unavailableLabel;
  // Check if all are closed
  if (closedLabel && live.every(i => i.marketState === "CLOSED")) return closedLabel;
  const avg = live.reduce((s, i) => s + (i.changePercent ?? 0), 0) / live.length;
  const positive = live.filter(i => (i.changePercent ?? 0) > 0.1).length;
  const negative = live.filter(i => (i.changePercent ?? 0) < -0.1).length;
  if (positive >= live.length * 0.7) return positiveLabel;
  if (negative >= live.length * 0.7) return negativeLabel;
  if (Math.abs(avg) < 0.15) return mixedLabel;
  return avg > 0 ? positiveLabel : negativeLabel;
}

function buildSummary(items: MarketQuoteItem[]): GlobalMarketSnapshot["summary"] {
  const byCategory = (cat: MarketInstrument["category"]) =>
    items.filter(i => i.category === cat);

  const usItems = byCategory("us_equity");
  const euItems = byCategory("europe");
  const asiaItems = byCategory("asia");
  const vixItems = byCategory("volatility");
  const dollarItems = byCategory("dollar");
  const ratesItems = byCategory("rates");
  const commItems = byCategory("commodity");
  const cryptoItems = byCategory("crypto");

  // US equities
  const usAvg = usItems.filter(i => i.changePercent !== null)
    .reduce((s, i) => s + (i.changePercent ?? 0), 0) / (usItems.filter(i => i.changePercent !== null).length || 1);
  const usEquities: GlobalMarketSnapshot["summary"]["usEquities"] =
    usItems.filter(i => i.changePercent !== null).length === 0 ? "unavailable" :
    usAvg > 0.3 ? "risk-on" : usAvg < -0.3 ? "risk-off" : "mixed";

  // Volatility
  const vix = vixItems.find(i => i.symbol === "^VIX");
  const volatility: GlobalMarketSnapshot["summary"]["volatility"] =
    vix?.price == null ? "unavailable" :
    vix.price > 25 ? "elevated" : vix.price < 15 ? "low" : "normal";

  // Dollar
  const dxy = dollarItems.find(i => i.symbol === "DX-Y.NYB");
  const dollar: GlobalMarketSnapshot["summary"]["dollar"] =
    dxy?.changePercent == null ? "unavailable" :
    dxy.changePercent > 0.15 ? "strengthening" : dxy.changePercent < -0.15 ? "weakening" : "stable";

  // Rates (10Y)
  const t10 = ratesItems.find(i => i.symbol === "^TNX");
  const rates: GlobalMarketSnapshot["summary"]["rates"] =
    t10?.changePercent == null ? "unavailable" :
    t10.changePercent > 0.5 ? "rising" : t10.changePercent < -0.5 ? "falling" : "stable";

  return {
    usEquities,
    europe: deriveStatus(euItems, "positive", "negative", "mixed", "unavailable", "closed"),
    asia: deriveStatus(asiaItems, "positive", "negative", "mixed", "unavailable", "closed"),
    volatility,
    dollar,
    rates,
    commodities: deriveStatus(commItems, "positive", "negative", "mixed", "unavailable"),
    crypto: deriveStatus(cryptoItems, "positive", "negative", "mixed", "unavailable"),
  };
}

// ── Core fetch ────────────────────────────────────────────────────────────────
async function fetchGlobalSnapshot(): Promise<GlobalMarketSnapshot> {
  const cached = snapshotCache.get("global");
  if (cached) return cached.data;

  const symbols = GLOBAL_INSTRUMENTS.map(i => i.symbol);
  let quotes: YahooQuote[] = [];
  try {
    quotes = await getQuotes(symbols);
  } catch (err) {
    log.warn("[Markets] getQuotes failed", { err });
  }

  const quoteMap = new Map<string, YahooQuote>(quotes.map(q => [q.ticker, q]));

  const items: MarketQuoteItem[] = GLOBAL_INSTRUMENTS.map(inst => {
    const q = quoteMap.get(inst.symbol);
    return {
      symbol: inst.symbol,
      label: inst.label,
      shortLabel: inst.shortLabel,
      category: inst.category,
      region: inst.region,
      unit: inst.unit,
      price: q?.price ?? null,
      prevClose: q?.prevClose ?? null,
      open: q?.open ?? null,
      high: q?.high ?? null,
      low: q?.low ?? null,
      change: q?.change ?? null,
      changePercent: q?.changePercent ?? null,
      marketState: q?.marketState ?? "UNKNOWN",
      isDelayed: q?.isDelayed ?? true,
      source: q?.source ?? "error",
      error: q?.error,
    };
  });

  // Ranked lists (exclude rates/volatility from rank — they move differently)
  const rankable = items.filter(i =>
    i.changePercent !== null &&
    !["rates", "volatility"].includes(i.category)
  );
  const sorted = [...rankable].sort((a, b) => (b.changePercent ?? 0) - (a.changePercent ?? 0));
  const strongest = sorted.slice(0, 5);
  const weakest = sorted.slice(-5).reverse();

  const snapshot: GlobalMarketSnapshot = {
    items,
    fetchedAt: Date.now(),
    summary: buildSummary(items),
    strongest,
    weakest,
  };

  snapshotCache.set("global", { data: snapshot, fetchedAt: Date.now() });
  return snapshot;
}

// ── Router ────────────────────────────────────────────────────────────────────
export const marketsRouter = router({
  getGlobalSnapshot: publicProcedure.query(async () => {
    try {
      return await fetchGlobalSnapshot();
    } catch (err) {
      log.error("[Markets] getGlobalSnapshot failed", { err });
      // Return empty snapshot rather than throwing
      const empty: GlobalMarketSnapshot = {
        items: GLOBAL_INSTRUMENTS.map(inst => ({
          symbol: inst.symbol,
          label: inst.label,
          shortLabel: inst.shortLabel,
          category: inst.category,
          region: inst.region,
          unit: inst.unit,
          price: null, prevClose: null, open: null, high: null, low: null,
          change: null, changePercent: null,
          marketState: "UNKNOWN" as const,
          isDelayed: true,
          source: "error",
          error: "Data temporarily unavailable",
        })),
        fetchedAt: Date.now(),
        summary: {
          usEquities: "unavailable", europe: "unavailable", asia: "unavailable",
          volatility: "unavailable", dollar: "unavailable", rates: "unavailable",
          commodities: "unavailable", crypto: "unavailable",
        },
        strongest: [],
        weakest: [],
      };
      return empty;
    }
  }),
});
