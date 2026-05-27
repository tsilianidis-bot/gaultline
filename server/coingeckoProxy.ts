// ============================================================
// FAULTLINE — CoinGecko Proxy Server Route
//
// Fetches live crypto market data from CoinGecko server-side.
// No API key required for public endpoints (rate limit: 30 req/min).
// All data is cached server-side to stay within rate limits.
//
// Endpoints:
//   GET  /api/crypto/search?q=BTC          — search by symbol/name
//   GET  /api/crypto/asset/:id             — full market data for one asset
//   GET  /api/crypto/markets               — top 50 by market cap
//   GET  /api/crypto/global                — global market stats
//   POST /api/crypto/clear-cache           — clear all caches
// ============================================================
import type { Express, Request, Response } from "express";
import { LRUCache } from "./lruCache";
import { log } from "./logger";

const COINGECKO_BASE = "https://api.coingecko.com/api/v3";

// Cache TTLs (ms) — generous to stay within CoinGecko free-tier 30 req/min
const SEARCH_TTL    = 10 * 60 * 1000;  // 10 min — search results stable
const MARKET_TTL    =  5 * 60 * 1000;  //  5 min — top markets
const GLOBAL_TTL    =  5 * 60 * 1000;  //  5 min — global stats
const ASSET_TTL     = 90 * 1000;        // 90 sec — individual asset; short enough to catch intraday moves

const searchCache = new LRUCache<string, CoinSearchResult[]>(100, SEARCH_TTL);
const marketCache = new LRUCache<string, CoinMarketData[]>(10,  MARKET_TTL);
const globalCache = new LRUCache<string, GlobalStats>(5,    GLOBAL_TTL);
const assetCache  = new LRUCache<string, CoinMarketData>(200, ASSET_TTL);

// In-flight deduplication — prevents duplicate concurrent fetches for the same key
const inFlight = new Map<string, Promise<unknown>>();

function dedupe<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const existing = inFlight.get(key);
  if (existing) return existing as Promise<T>;
  const p = fn().finally(() => inFlight.delete(key));
  inFlight.set(key, p);
  return p;
}

// ── Types ─────────────────────────────────────────────────────
export interface CoinSearchResult {
  id: string;
  symbol: string;
  name: string;
  thumb: string;
  marketCapRank: number | null;
}

export interface CoinMarketData {
  id: string;
  symbol: string;
  name: string;
  image: string;
  currentPrice: number;
  marketCap: number;
  marketCapRank: number;
  fullyDilutedValuation: number | null;
  totalVolume: number;
  high24h: number;
  low24h: number;
  priceChange24h: number;
  priceChangePercent24h: number;
  priceChangePercent7d: number | null;
  priceChangePercent30d: number | null;
  marketCapChange24h: number;
  marketCapChangePercent24h: number;
  circulatingSupply: number;
  totalSupply: number | null;
  maxSupply: number | null;
  ath: number;
  athChangePercent: number;
  atl: number;
  atlChangePercent: number;
  sparkline7d: number[];
  lastUpdated: string;
  // Computed volatility metrics
  volatility24h: number;   // (high-low)/low * 100
  distanceFromAth: number; // % below ATH
}

export interface GlobalStats {
  totalMarketCap: number;
  totalVolume24h: number;
  btcDominance: number;
  ethDominance: number;
  marketCapChangePercent24h: number;
  activeCryptocurrencies: number;
  markets: number;
  fetchedAt: number;
}

// ── Helpers ───────────────────────────────────────────────────
// Retry once on 429 with exponential backoff; throws on all other errors.
async function cgFetch<T>(path: string, attempt = 0): Promise<T> {
  const url = `${COINGECKO_BASE}${path}`;
  const headers: Record<string, string> = {
    "Accept": "application/json",
    "User-Agent": "FAULTLINE/1.0",
  };
  // CoinGecko Demo API key — raises rate limit from 30 to 500 req/min
  const cgApiKey = process.env.COINGECKO_API_KEY;
  if (cgApiKey) headers["x-cg-demo-api-key"] = cgApiKey;
  const res = await fetch(url, {
    headers,
    signal: AbortSignal.timeout(12_000),
  });
  if (res.status === 429 && attempt === 0) {
    // CoinGecko free tier: back off 3 seconds then retry once
    const retryAfter = Number(res.headers.get("Retry-After") ?? 3);
    const delay = Math.min(retryAfter * 1000, 5_000);
    log.warn("[CoinGecko] Rate limited (429), retrying after " + delay + "ms", { path });
    await new Promise(r => setTimeout(r, delay));
    return cgFetch<T>(path, 1);
  }
  if (!res.ok) {
    throw new Error(`CoinGecko ${res.status}: ${path}`);
  }
  return res.json() as Promise<T>;
}

// Map symbol → CoinGecko id for common tickers (avoids search round-trip)
const SYMBOL_MAP: Record<string, string> = {
  BTC:   "bitcoin",
  ETH:   "ethereum",
  SOL:   "solana",
  BNB:   "binancecoin",
  XRP:   "ripple",
  ADA:   "cardano",
  AVAX:  "avalanche-2",
  DOT:   "polkadot",
  MATIC: "matic-network",
  POL:   "matic-network",
  LINK:  "chainlink",
  UNI:   "uniswap",
  ATOM:  "cosmos",
  LTC:   "litecoin",
  NEAR:  "near",
  APT:   "aptos",
  SUI:   "sui",
  ARB:   "arbitrum",
  OP:    "optimism",
  DOGE:  "dogecoin",
  SHIB:  "shiba-inu",
  PEPE:  "pepe",
  WIF:   "dogwifcoin",
  BONK:  "bonk",
  RNDR:  "render-token",
  RENDER:"render-token",
  FET:   "fetch-ai",
  OCEAN: "ocean-protocol",
  GRT:   "the-graph",
  INJ:   "injective-protocol",
  SEI:   "sei-network",
  TIA:   "celestia",
  PYTH:  "pyth-network",
  JTO:   "jito-governance-token",
  JUP:   "jupiter-exchange-solana",
  BERA:  "berachain-bera",
  HYPE:  "hyperliquid",
  AAVE:  "aave",
  MKR:   "maker",
  CRV:   "curve-dao-token",
  SNX:   "synthetix-network-token",
  LDO:   "lido-dao",
  RETH:  "rocket-pool-eth",
  STETH: "staked-ether",
  USDT:  "tether",
  USDC:  "usd-coin",
  DAI:   "dai",
  FRAX:  "frax",
};

function mapRawCoin(c: Record<string, unknown>): CoinMarketData {
  const high = (c.high_24h as number) ?? 0;
  const low  = (c.low_24h  as number) ?? 0;
  const ath  = (c.ath      as number) ?? 0;
  const price = (c.current_price as number) ?? 0;
  const sparkRaw = (c.sparkline_in_7d as { price?: number[] })?.price ?? [];
  return {
    id:                       c.id as string,
    symbol:                   ((c.symbol as string) ?? "").toUpperCase(),
    name:                     c.name as string,
    image:                    (c.image as string) ?? "",
    currentPrice:             price,
    marketCap:                (c.market_cap as number) ?? 0,
    marketCapRank:            (c.market_cap_rank as number) ?? 0,
    fullyDilutedValuation:    (c.fully_diluted_valuation as number | null) ?? null,
    totalVolume:              (c.total_volume as number) ?? 0,
    high24h:                  high,
    low24h:                   low,
    priceChange24h:           (c.price_change_24h as number) ?? 0,
    priceChangePercent24h:    (c.price_change_percentage_24h as number) ?? 0,
    priceChangePercent7d:     (c.price_change_percentage_7d_in_currency as number | null) ?? null,
    priceChangePercent30d:    (c.price_change_percentage_30d_in_currency as number | null) ?? null,
    marketCapChange24h:       (c.market_cap_change_24h as number) ?? 0,
    marketCapChangePercent24h:(c.market_cap_change_percentage_24h as number) ?? 0,
    circulatingSupply:        (c.circulating_supply as number) ?? 0,
    totalSupply:              (c.total_supply as number | null) ?? null,
    maxSupply:                (c.max_supply as number | null) ?? null,
    ath:                      ath,
    athChangePercent:         (c.ath_change_percentage as number) ?? 0,
    atl:                      (c.atl as number) ?? 0,
    atlChangePercent:         (c.atl_change_percentage as number) ?? 0,
    sparkline7d:              sparkRaw.slice(-48),  // last 48 data points (~2 days)
    lastUpdated:              (c.last_updated as string) ?? "",
    volatility24h:            low > 0 ? ((high - low) / low) * 100 : 0,
    distanceFromAth:          ath > 0 ? ((price - ath) / ath) * 100 : 0,
  };
}

// ── Public helpers (used by crypto engine) ────────────────────
export async function searchCoins(query: string): Promise<CoinSearchResult[]> {
  const key = query.toLowerCase().trim();
  const cached = searchCache.peek(key);
  if (cached) return cached.value;

  // First check symbol map
  const upperQuery = query.toUpperCase().trim();
  const cgId = SYMBOL_MAP[upperQuery];

  interface CoinSearchItem {
    id: string;
    symbol: string;
    name: string;
    thumb: string;
    market_cap_rank?: number | null;
  }

  interface CoinSearchResponse {
    coins: CoinSearchItem[];
  }

  let results: CoinSearchResult[] = [];
  try {
    const data = await cgFetch<CoinSearchResponse>(`/search?query=${encodeURIComponent(query)}`);
    results = (data.coins ?? []).slice(0, 10).map((c) => ({
      id:            c.id,
      symbol:        c.symbol.toUpperCase(),
      name:          c.name,
      thumb:         c.thumb,
      marketCapRank: c.market_cap_rank ?? null,
    }));
    // Boost exact symbol match to top
    if (cgId) {
      results.sort((a, b) => (a.id === cgId ? -1 : b.id === cgId ? 1 : 0));
    }
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    log.warn("[CoinGecko] Search failed", { query, errMsg });
  }
  searchCache.set(key, results);
  return results;
}

export async function getCoinMarketData(idOrSymbol: string): Promise<CoinMarketData | null> {
  const upper = idOrSymbol.toUpperCase();
  const cgId = SYMBOL_MAP[upper] ?? idOrSymbol.toLowerCase();
  const cached = assetCache.peek(cgId);
  if (cached) return cached.value;

  return dedupe<CoinMarketData | null>(`asset:${cgId}`, async () => {
    try {
      interface RawMarketItem {
        [key: string]: unknown;
      }
      const data = await cgFetch<RawMarketItem[]>(
        `/coins/markets?vs_currency=usd&ids=${cgId}&order=market_cap_desc&per_page=1&page=1&sparkline=true&price_change_percentage=24h,7d,30d`
      );
      if (!data || data.length === 0) return null;
      const coin = mapRawCoin(data[0]);
      assetCache.set(cgId, coin);
      return coin;
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      log.warn("[CoinGecko] Asset fetch failed", { id: cgId, errMsg });
      return null;
    }
  });
}

export async function getTopMarkets(limit = 50): Promise<CoinMarketData[]> {
  const key = `top_${limit}`;
  const cached = marketCache.peek(key);
  if (cached) return cached.value;

  return dedupe<CoinMarketData[]>(`markets:${limit}`, async () => {
    try {
      interface RawMarketItem {
        [key: string]: unknown;
      }
      const data = await cgFetch<RawMarketItem[]>(
        `/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=${limit}&page=1&sparkline=true&price_change_percentage=24h,7d,30d`
      );
      const coins = (data ?? []).map(mapRawCoin);
      marketCache.set(key, coins);
      // Also populate individual asset cache from the bulk fetch — saves future single-asset calls
      for (const coin of coins) {
        assetCache.set(coin.id, coin);
      }
      return coins;
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      log.warn("[CoinGecko] Top markets fetch failed", { errMsg });
      return [];
    }
  });
}

export async function getGlobalStats(): Promise<GlobalStats | null> {
  const cached = globalCache.peek("global");
  if (cached) return cached.value;

  try {
    interface GlobalResponse {
      data: {
        total_market_cap: Record<string, number>;
        total_volume: Record<string, number>;
        market_cap_percentage: Record<string, number>;
        market_cap_change_percentage_24h_usd: number;
        active_cryptocurrencies: number;
        markets: number;
      };
    }
    const data = await cgFetch<GlobalResponse>("/global");
    const d = data.data;
    const stats: GlobalStats = {
      totalMarketCap:            d.total_market_cap?.usd ?? 0,
      totalVolume24h:            d.total_volume?.usd ?? 0,
      btcDominance:              d.market_cap_percentage?.btc ?? 0,
      ethDominance:              d.market_cap_percentage?.eth ?? 0,
      marketCapChangePercent24h: d.market_cap_change_percentage_24h_usd ?? 0,
      activeCryptocurrencies:    d.active_cryptocurrencies ?? 0,
      markets:                   d.markets ?? 0,
      fetchedAt:                 Date.now(),
    };
    globalCache.set("global", stats);
    return stats;
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    log.warn("[CoinGecko] Global stats fetch failed", { errMsg });
    return null;
  }
}

// ── OHLC daily bars (for true RSI/MACD/SMA on crypto) ────────
export interface CoinOHLCBar {
  timestamp: number;  // Unix ms
  open: number;
  high: number;
  low: number;
  close: number;
}

const ohlcCache = new LRUCache<string, CoinOHLCBar[]>(200, 5 * 60 * 1000); // 5 min TTL

/**
 * Fetch daily OHLC bars for a coin from CoinGecko.
 * Uses /coins/{id}/ohlc?vs_currency=usd&days=30 (returns ~30 daily bars).
 */
export async function getCoinOHLC(idOrSymbol: string, days = 30): Promise<CoinOHLCBar[]> {
  const upper = idOrSymbol.toUpperCase();
  const cgId = SYMBOL_MAP[upper] ?? idOrSymbol.toLowerCase();
  const key = `${cgId}:${days}`;
  const cached = ohlcCache.peek(key);
  if (cached) return cached.value;

  return dedupe<CoinOHLCBar[]>(`ohlc:${key}`, async () => {
    try {
      // CoinGecko returns array of [timestamp, open, high, low, close]
      const raw = await cgFetch<number[][]>(`/coins/${cgId}/ohlc?vs_currency=usd&days=${days}`);
      const bars: CoinOHLCBar[] = (raw ?? []).map(([ts, o, h, l, c]) => ({
        timestamp: ts,
        open: o,
        high: h,
        low: l,
        close: c,
      }));
      ohlcCache.set(key, bars);
      return bars;
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      log.warn("[CoinGecko] OHLC fetch failed", { id: cgId, errMsg });
      return [];
    }
  });
}

// ── Coin detail (description + categories) ───────────────
export interface CoinDetail {
  id: string;
  symbol: string;
  name: string;
  description: string | null;   // plain-text, HTML stripped
  categories: string[];          // e.g. ["Layer 1 (L1)", "Smart Contract Platform"]
  sector: string | null;         // derived from first meaningful category
}

const detailCache = new LRUCache<string, CoinDetail>(200, 30 * 60 * 1000); // 30 min TTL

/**
 * Fetch coin description and categories from /coins/{id}.
 * Strips HTML from the description and returns the first 500 chars.
 */
export async function getCoinDetail(idOrSymbol: string): Promise<CoinDetail | null> {
  const upper = idOrSymbol.toUpperCase();
  const cgId = SYMBOL_MAP[upper] ?? idOrSymbol.toLowerCase();
  const cached = detailCache.peek(cgId);
  if (cached) return cached.value;

  return dedupe<CoinDetail | null>(`detail:${cgId}`, async () => {
    try {
      interface RawCoinDetail {
        id: string;
        symbol: string;
        name: string;
        description?: { en?: string };
        categories?: string[];
      }
      const data = await cgFetch<RawCoinDetail>(
        `/coins/${cgId}?localization=false&tickers=false&market_data=false&community_data=false&developer_data=false&sparkline=false`
      );
      // Strip HTML tags and truncate
      const rawDesc = data.description?.en ?? "";
      const plainDesc = rawDesc
        .replace(/<[^>]+>/g, " ")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 600);

      const cats = (data.categories ?? []).filter((c: string) => c && c.trim());
      // Derive a short sector label from the first meaningful category
      const sectorMap: Record<string, string> = {
        "Layer 1": "Layer-1",
        "Layer-1": "Layer-1",
        "Layer 2": "Layer-2",
        "Layer-2": "Layer-2",
        "DeFi": "DeFi",
        "Decentralized Finance": "DeFi",
        "Artificial Intelligence": "AI/Data",
        "AI": "AI/Data",
        "Gaming": "Gaming/NFT",
        "NFT": "Gaming/NFT",
        "Meme": "Meme",
        "Stablecoin": "Stablecoin",
        "Exchange": "Exchange",
        "Infrastructure": "Infrastructure",
        "Oracle": "Oracle",
        "Privacy": "Privacy",
        "Real World Assets": "RWA",
        "Liquid Staking": "Liquid Staking",
      };
      let sector: string | null = null;
      for (const cat of cats) {
        for (const [key, label] of Object.entries(sectorMap)) {
          if (cat.includes(key)) { sector = label; break; }
        }
        if (sector) break;
      }
      if (!sector && cats.length > 0) sector = cats[0];

      const detail: CoinDetail = {
        id: data.id,
        symbol: (data.symbol ?? "").toUpperCase(),
        name: data.name,
        description: plainDesc || null,
        categories: cats.slice(0, 6),
        sector,
      };
      detailCache.set(cgId, detail);
      return detail;
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      log.warn("[CoinGecko] Coin detail fetch failed", { id: cgId, errMsg });
      return null;
    }
  });
}

export function clearCoinGeckoCache() {
  searchCache.clear();
  marketCache.clear();
  globalCache.clear();
  assetCache.clear();
  ohlcCache.clear();
  detailCache.clear();
}

// ── Express route registration ────────────────────────────────
export function registerCoinGeckoProxy(app: Express) {
  // Search
  app.get("/api/crypto/search", async (req: Request, res: Response) => {
    const q = (req.query.q as string ?? "").trim();
    if (!q || q.length < 1) {
      res.status(400).json({ error: "q is required" });
      return;
    }
    try {
      const results = await searchCoins(q);
      res.json({ results, cached: false });
    } catch (err) {
      log.error("[CoinGecko] /search error", { err: err instanceof Error ? err.message : String(err) });
      res.status(500).json({ error: "Search failed" });
    }
  });

  // Single asset
  app.get("/api/crypto/asset/:id", async (req: Request, res: Response) => {
    const id = req.params.id;
    try {
      const coin = await getCoinMarketData(id);
      if (!coin) {
        res.status(404).json({ error: "Asset not found" });
        return;
      }
      res.json(coin);
    } catch (err) {
      log.error("[CoinGecko] /asset error", { id, err: err instanceof Error ? err.message : String(err) });
      res.status(500).json({ error: "Asset fetch failed" });
    }
  });

  // Top markets
  app.get("/api/crypto/markets", async (_req: Request, res: Response) => {
    try {
      const coins = await getTopMarkets(50);
      res.json({ coins, fetchedAt: Date.now() });
    } catch (err) {
      log.error("[CoinGecko] /markets error", { err: err instanceof Error ? err.message : String(err) });
      res.status(500).json({ error: "Markets fetch failed" });
    }
  });

  // Global stats
  app.get("/api/crypto/global", async (_req: Request, res: Response) => {
    try {
      const stats = await getGlobalStats();
      if (!stats) {
        res.status(503).json({ error: "Global stats unavailable" });
        return;
      }
      res.json(stats);
    } catch (err) {
      log.error("[CoinGecko] /global error", { err: err instanceof Error ? err.message : String(err) });
      res.status(500).json({ error: "Global stats failed" });
    }
  });

  // Clear cache
  app.post("/api/crypto/clear-cache", (_req: Request, res: Response) => {
    clearCoinGeckoCache();
    res.json({ success: true });
  });

  log.info("[CoinGecko Proxy] Routes registered: GET /api/crypto/search, GET /api/crypto/asset/:id, GET /api/crypto/markets, GET /api/crypto/global");
}
