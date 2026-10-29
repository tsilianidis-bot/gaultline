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
import { coinGeckoOhlcPeriodMs, isCryptoCandleComplete } from "../shared/completedBars";
import { LRUCache } from "./lruCache";
import { log } from "./logger";
import { allowOwnerOrAdmin } from "./security/access";

const COINGECKO_BASE = "https://api.coingecko.com/api/v3";

// Cache TTLs (ms) — generous to stay within CoinGecko free-tier 30 req/min
const SEARCH_TTL    = 10 * 60 * 1000;  // 10 min — search results stable
const MARKET_TTL    =  5 * 60 * 1000;  //  5 min — top markets
const GLOBAL_TTL    =  5 * 60 * 1000;  //  5 min — global stats
const ASSET_TTL     = 60 * 1000;        // 60 sec — individual asset; short enough to catch intraday moves

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
  currentPrice: number | null;
  marketCap: number | null;
  marketCapRank: number | null;
  fullyDilutedValuation: number | null;
  totalVolume: number | null;
  high24h: number | null;
  low24h: number | null;
  priceChange24h: number | null;
  priceChangePercent24h: number | null;
  /** Display only: null when CoinGecko supplied no 24h change. */
  priceChangePercent24hDisplay?: number | null;
  priceChangePercent7d: number | null;
  priceChangePercent30d: number | null;
  marketCapChange24h: number | null;
  marketCapChangePercent24h: number | null;
  circulatingSupply: number | null;
  totalSupply: number | null;
  maxSupply: number | null;
  ath: number | null;
  athChangePercent: number | null;
  atl: number | null;
  atlChangePercent: number | null;
  sparkline7d: number[];
  lastUpdated: string;
  // Computed volatility metrics
  volatility24h: number | null;   // (high-low)/low * 100; null when the 24h range was not supplied
  distanceFromAth: number | null; // % below ATH; null when price was not supplied
}

/**
 * Top-markets response metadata. `fetchedAt` is the adapter receipt/cache-write
 * time, not a provider observation time; individual assets retain CoinGecko's
 * `lastUpdated` provider field. A failed upstream call has no fetch timestamp.
 */
export interface CoinMarketsSnapshot {
  coins: CoinMarketData[];
  fetchedAt: number | null;
  cached: boolean;
  source: "coingecko";
}

export interface GlobalStats {
  totalMarketCap: number | null;
  totalVolume24h: number | null;
  btcDominance: number | null;
  ethDominance: number | null;
  marketCapChangePercent24h: number | null;
  activeCryptocurrencies: number | null;
  markets: number | null;
  /** CoinGecko `data.updated_at`, in Unix milliseconds; null when absent or invalid. */
  observedAt: number | null;
  /** Local receipt time. This is never used as a provider observation time. */
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
  // AI / Compute / DePIN
  TAO:    "bittensor",
  WLD:    "worldcoin-wld",
  FIL:    "filecoin",
  AR:     "arweave",
  IO:     "io-net",
  AIOZ:   "aioz-network",
  KAITO:  "kaito",
  VIRTUAL:"virtual-protocol",
  AI16Z:  "ai16z",
  AIXBT:  "aixbt-by-virtuals",
  GOAT:   "goat",
  GRIFFAIN:"griffain",
  FARTCOIN:"fartcoin",
  ZEREBRO:"zerebro",
  // DeFi
  PENDLE: "pendle",
  DYDX:   "dydx",
  GMX:    "gmx",
  RDNT:   "radiant-capital",
  AERO:   "aerodrome-finance",
  VELO:   "velodrome-finance",
  ENA:    "ethena",
  ONDO:   "ondo-finance",
  ETHFI:  "ether-fi",
  EIGEN:  "eigenlayer",
  RPL:    "rocket-pool",
  SSV:    "ssv-network",
  COMP:   "compound-governance-token",
  YFI:    "yearn-finance",
  CVX:    "convex-finance",
  BAL:    "balancer",
  SUSHI:  "sushi",
  CAKE:   "pancakeswap-token",
  // L2 / ZK
  ZK:     "zksync",
  STRK:   "starknet",
  MANTA:  "manta-network",
  BLAST:  "blast",
  ZRO:    "layerzero",
  W:      "wormhole",
  ALT:    "altlayer",
  DYM:    "dymension",
  OMNI:   "omni-network",
  SAGA:   "saga-2",
  // Meme / Base ecosystem
  FLOKI:  "floki",
  BOME:   "book-of-meme",
  POPCAT: "popcat",
  MEW:    "cat-in-a-dogs-world",
  BRETT:  "brett",
  MOG:    "mog-coin",
  DEGEN:  "degen-base",
  TURBO:  "turbo",
  BLUR:   "blur",
  // BTC ecosystem / Ordinals
  ORDI:   "ordi",
  SATS:   "1000sats-ordinals",
  RATS:   "rats-ordinals",
  // TON ecosystem
  NOT:    "notcoin",
  DOGS:   "dogs-2",
  HMSTR:  "hamster-kombat",
  CATI:   "catizen",
  MAJOR:  "major",
  // Gaming / Metaverse
  IMX:    "immutable-x",
  SAND:   "the-sandbox",
  MANA:   "decentraland",
  AXS:    "axie-infinity",
  MAGIC:  "magic",
  PIXEL:  "pixels",
  PORTAL: "portal-gaming",
  GALA:   "gala",
  // Infrastructure / Other
  ENS:    "ethereum-name-service",
  HBAR:   "hedera-hashgraph",
  ALGO:   "algorand",
  XTZ:    "tezos",
  FLOW:   "flow",
  THETA:  "theta-token",
  VET:    "vechain",
  ZIL:    "zilliqa",
  IOTA:   "iota",
  LUNA:   "terra-luna-2",
  TRX:    "tron",
  BCH:    "bitcoin-cash",
  ETC:    "ethereum-classic",
  XMR:    "monero",
  XLM:    "stellar",
  OSMO:   "osmosis",
  KAVA:   "kava",
  ROSE:   "oasis-network",
  CELO:   "celo",
  JASMY:  "jasmycoin",
  AUDIO:  "audius",
  GRT2:   "the-graph",
  CTSI:   "cartesi",
};

// ── Name → CoinGecko ID map (full-name search: "Bittensor", "Ethereum", etc.) ──
const NAME_MAP: Record<string, string> = {
  BITCOIN:          "bitcoin",
  ETHEREUM:         "ethereum",
  SOLANA:           "solana",
  BITTENSOR:        "bittensor",
  CHAINLINK:        "chainlink",
  AVALANCHE:        "avalanche-2",
  POLKADOT:         "polkadot",
  CARDANO:          "cardano",
  DOGECOIN:         "dogecoin",
  LITECOIN:         "litecoin",
  RIPPLE:           "ripple",
  COSMOS:           "cosmos",
  UNISWAP:          "uniswap",
  AAVE:             "aave",
  MAKER:            "maker",
  NEAR:             "near",
  APTOS:            "aptos",
  ARBITRUM:         "arbitrum",
  OPTIMISM:         "optimism",
  INJECTIVE:        "injective-protocol",
  CELESTIA:         "celestia",
  RENDER:           "render-token",
  WORLDCOIN:        "worldcoin-wld",
  FILECOIN:         "filecoin",
  ARWEAVE:          "arweave",
  PENDLE:           "pendle",
  ONDO:             "ondo-finance",
  EIGENLAYER:       "eigenlayer",
  ETHENA:           "ethena",
  STARKNET:         "starknet",
  HYPERLIQUID:      "hyperliquid",
  PEPE:             "pepe",
  SHIBA:            "shiba-inu",
  "SHIBA INU":      "shiba-inu",
  BONK:             "bonk",
  FLOKI:            "floki",
  NOTCOIN:          "notcoin",
  HAMSTER:          "hamster-kombat",
  "HAMSTER KOMBAT": "hamster-kombat",
  DOGWIFHAT:        "dogwifcoin",
  "DOG WIF HAT":    "dogwifcoin",
  POPCAT:           "popcat",
  FETCH:            "fetch-ai",
  "FETCH AI":       "fetch-ai",
  OCEAN:            "ocean-protocol",
  "OCEAN PROTOCOL": "ocean-protocol",
  "THE GRAPH":      "the-graph",
  PYTH:             "pyth-network",
  "PYTH NETWORK":   "pyth-network",
  SEI:              "sei-network",
  "SEI NETWORK":    "sei-network",
  JUPITER:          "jupiter-exchange-solana",
  BERACHAIN:        "berachain-bera",
  LIDO:             "lido-dao",
  "LIDO DAO":       "lido-dao",
};

/** Resolve a user query (symbol, full name, or CoinGecko ID) to a CoinGecko ID */
function resolveCgId(query: string): string {
  const upper = query.toUpperCase().trim();
  return SYMBOL_MAP[upper] ?? NAME_MAP[upper] ?? query.toLowerCase().trim();
}

/**
 * CoinGecko global volume in USD only. Other currency keys are not summed.
 * A print above $10T, or above 10× a known USD market cap, is withheld.
 * An observed zero stays zero.
 */
export function observedGlobalUsdVolume(totalVolume: unknown, totalMarketCap: number | null): number | null {
  let usd: number | null = null;
  if (typeof totalVolume === "number" && Number.isFinite(totalVolume)) {
    usd = totalVolume;
  } else if (totalVolume != null && typeof totalVolume === "object" && "usd" in totalVolume) {
    const raw = (totalVolume as { usd?: unknown }).usd;
    usd = typeof raw === "number" && Number.isFinite(raw) ? raw : null;
  }
  if (usd == null) return null;
  if (usd > 1e13) return null;
  if (typeof totalMarketCap === "number" && Number.isFinite(totalMarketCap) && totalMarketCap > 0 && usd > totalMarketCap * 10) {
    return null;
  }
  return usd;
}

function finiteCoinNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export function mapRawCoin(c: Record<string, unknown>): CoinMarketData {
  const high = finiteCoinNumber(c.high_24h);
  const low  = finiteCoinNumber(c.low_24h);
  const athRaw = finiteCoinNumber(c.ath);
  const ath = athRaw != null && athRaw > 0 ? athRaw : null;
  const price = finiteCoinNumber(c.current_price);
  const marketCap = finiteCoinNumber(c.market_cap);
  const totalVolume = finiteCoinNumber(c.total_volume);
  const sparkRaw = (c.sparkline_in_7d as { price?: number[] })?.price ?? [];
  return {
    id:                       c.id as string,
    symbol:                   ((c.symbol as string) ?? "").toUpperCase(),
    name:                     c.name as string,
    image:                    (c.image as string) ?? "",
    currentPrice:             price,
    marketCap,
    marketCapRank:            finiteCoinNumber(c.market_cap_rank),
    fullyDilutedValuation:    finiteCoinNumber(c.fully_diluted_valuation),
    totalVolume,
    high24h:                  high,
    low24h:                   low,
    priceChange24h:           finiteCoinNumber(c.price_change_24h),
    priceChangePercent24h:    finiteCoinNumber(c.price_change_percentage_24h),
    priceChangePercent24hDisplay: typeof c.price_change_percentage_24h === "number" && Number.isFinite(c.price_change_percentage_24h) ? c.price_change_percentage_24h : null,
    priceChangePercent7d:     finiteCoinNumber(c.price_change_percentage_7d_in_currency),
    priceChangePercent30d:    finiteCoinNumber(c.price_change_percentage_30d_in_currency),
    marketCapChange24h:       finiteCoinNumber(c.market_cap_change_24h),
    marketCapChangePercent24h: finiteCoinNumber(c.market_cap_change_percentage_24h),
    circulatingSupply:        finiteCoinNumber(c.circulating_supply),
    totalSupply:              finiteCoinNumber(c.total_supply),
    maxSupply:                finiteCoinNumber(c.max_supply),
    ath:                      ath,
    athChangePercent:         finiteCoinNumber(c.ath_change_percentage),
    atl:                      finiteCoinNumber(c.atl),
    atlChangePercent:         finiteCoinNumber(c.atl_change_percentage),
    sparkline7d:              sparkRaw.slice(-48),  // last 48 data points (~2 days)
    lastUpdated:              (c.last_updated as string) ?? "",
    volatility24h:            high == null || low == null ? null : low > 0 ? ((high - low) / low) * 100 : 0,
    distanceFromAth:          price == null || ath == null ? null : ((price - ath) / ath) * 100,
  };
}

// ── Public helpers (used by crypto engine) ────────────────────
export async function searchCoins(query: string): Promise<CoinSearchResult[]> {
  const key = query.toLowerCase().trim();
  const cached = searchCache.peek(key);
  if (cached) return cached.value;

  // Check symbol map and name map for exact match
  const cgId = SYMBOL_MAP[query.toUpperCase().trim()] ?? NAME_MAP[query.toUpperCase().trim()];

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
    // An upstream failure is not an empty provider result. Callers need a
    // distinct unavailable state rather than a misleading "no matches" UI.
    throw err;
  }
  searchCache.set(key, results);
  return results;
}

export async function getCoinMarketData(idOrSymbol: string): Promise<CoinMarketData | null> {
  const cgId = resolveCgId(idOrSymbol);
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

export async function getTopMarketsSnapshot(limit = 50): Promise<CoinMarketsSnapshot> {
  const key = `top_${limit}`;
  const cached = marketCache.peek(key);
  if (cached) {
    return { coins: cached.value, fetchedAt: cached.fetchedAt, cached: true, source: "coingecko" };
  }

  const coins = await dedupe<CoinMarketData[]>(`markets:${limit}`, async () => {
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

  // Read cache metadata instead of generating a response-time timestamp. When
  // the provider fetch failed no value was cached, so freshness is unknown.
  const stored = marketCache.peek(key);
  return { coins, fetchedAt: stored?.fetchedAt ?? null, cached: false, source: "coingecko" };
}

/** Existing internal callers consume only the normalized asset array. */
export async function getTopMarkets(limit = 50): Promise<CoinMarketData[]> {
  return (await getTopMarketsSnapshot(limit)).coins;
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
        updated_at?: number | null;
      };
    }
    const data = await cgFetch<GlobalResponse>("/global");
    const d = data.data;
    const updatedAtSeconds = typeof d.updated_at === "number" && Number.isFinite(d.updated_at) && d.updated_at > 0
      ? d.updated_at
      : null;
    const finite = (value: unknown): number | null =>
      typeof value === "number" && Number.isFinite(value) ? value : null;
    const totalMarketCap = finite(d.total_market_cap?.usd);
    const stats: GlobalStats = {
      totalMarketCap,
      totalVolume24h:            observedGlobalUsdVolume(d.total_volume, totalMarketCap),
      btcDominance:              typeof d.market_cap_percentage?.btc === "number" && Number.isFinite(d.market_cap_percentage.btc)
        ? d.market_cap_percentage.btc
        : null,
      ethDominance:              typeof d.market_cap_percentage?.eth === "number" && Number.isFinite(d.market_cap_percentage.eth)
        ? d.market_cap_percentage.eth
        : null,
      marketCapChangePercent24h: finite(d.market_cap_change_percentage_24h_usd),
      activeCryptocurrencies:    finite(d.active_cryptocurrencies),
      markets:                   finite(d.markets),
      observedAt:                updatedAtSeconds === null ? null : updatedAtSeconds * 1000,
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

// ── Completed daily OHLC bars (for true RSI/MACD/SMA on crypto) ────────
export interface CoinOHLCBar {
  /** CoinGecko provider timestamp: the documented close time of this candle, in Unix ms. */
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
}

const ohlcCache = new LRUCache<string, CoinOHLCBar[]>(200, 5 * 60 * 1000); // 5 min TTL

/**
 * CoinGecko documents OHLC timestamps as candle close times and makes a completed
 * UTC daily candle available at approximately 00:35 UTC. Keep a 35-minute buffer:
 * a row at or after this cutoff is not a completed daily observation.
 */
export const COINGECKO_DAILY_CLOSE_BUFFER_MS = 35 * 60 * 1000;

export function completedCoinDailyBars(bars: CoinOHLCBar[], nowMs = Date.now()): CoinOHLCBar[] {
  const cutoff = nowMs - COINGECKO_DAILY_CLOSE_BUFFER_MS;
  return bars.filter(bar =>
    Number.isFinite(bar.timestamp)
    && bar.timestamp <= cutoff
    && [bar.open, bar.high, bar.low, bar.close].every(value => Number.isFinite(value)),
  );
}

/**
 * Fetch completed daily OHLC bars for a coin from CoinGecko.
 * `interval=daily` is deliberate: CoinGecko auto-granularity would otherwise
 * return 4-hour bars for a 30-day request. If the configured provider plan does
 * not support daily candles, this fails closed as an empty series.
 */
export async function getCoinOHLC(idOrSymbol: string, days = 30): Promise<CoinOHLCBar[]> {
  const upper = idOrSymbol.toUpperCase();
  const cgId = SYMBOL_MAP[upper] ?? idOrSymbol.toLowerCase();
  const key = `${cgId}:${days}:daily`;
  const cached = ohlcCache.peek(key);
  if (cached) return cached.value;

  return dedupe<CoinOHLCBar[]>(`ohlc:${key}`, async () => {
    try {
      // CoinGecko returns [timestamp, open, high, low, close]. Its timestamp is
      // the candle close time, not the time this service received the response.
      const raw = await cgFetch<number[][]>(`/coins/${cgId}/ohlc?vs_currency=usd&days=${days}&interval=daily`);
      const bars = completedCoinDailyBars((raw ?? []).map(([ts, o, h, l, c]) => ({
        timestamp: ts,
        open: o,
        high: h,
        low: l,
        close: c,
      })));
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
      res.json(await getTopMarketsSnapshot(50));
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

  // Clear cache — owner/admin only
  app.post("/api/crypto/clear-cache", async (req: Request, res: Response) => {
    if (!(await allowOwnerOrAdmin(req, res))) return;
    clearCoinGeckoCache();
    res.json({ success: true });
  });

  log.info("[CoinGecko Proxy] Routes registered: GET /api/crypto/search, GET /api/crypto/asset/:id, GET /api/crypto/markets, GET /api/crypto/global");
}
