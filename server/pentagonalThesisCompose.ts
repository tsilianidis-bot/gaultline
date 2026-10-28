/**
 * Assembles a stock Pentagonal Thesis from existing observations.
 * Missing providers become gaps. This module does not calculate Pressure Index v1,
 * does not read crisis fields, and does not ask PLATO for a cause.
 */
import { isCanonicalCurrentUsable } from "./canonicalPressureProjection";
import { getAuthoritativeCanonicalIntelligenceState } from "./canonicalIntelligenceState";
import { LRUCache } from "./lruCache";
import { getDailyBars, getQuote, type YahooDailyBar, type YahooQuote } from "./yahooProxy";
import {
  buildPentagonalThesis,
  type CompletedBar,
  type MarketContextObservation,
  type PentagonalThesis,
  type ProfileObservation,
  type QuoteObservation,
} from "../shared/pentagonalThesis";

const cache = new LRUCache<string, PentagonalThesis>(100, 60_000);

export interface ThesisSourceDeps {
  getQuote: (symbol: string) => Promise<YahooQuote | null>;
  getDailyBars: (symbol: string) => Promise<YahooDailyBar[]>;
  getMarket: () => Promise<MarketContextObservation | null>;
  getProfile: (symbol: string) => Promise<ProfileObservation | null>;
}

function quoteObservation(quote: YahooQuote | null): QuoteObservation | null {
  if (!quote || quote.source === "error") return null;
  return {
    price: quote.price,
    previousClose: quote.prevClose,
    volume: quote.volume,
    changePercent: quote.changePercent,
    source: quote.source,
    observedAt: quote.observedAt ? new Date(quote.observedAt).toISOString() : null,
    fetchedAt: Number.isFinite(quote.fetchedAt) ? new Date(quote.fetchedAt).toISOString() : null,
    delayed: quote.isDelayed,
  };
}

function barObservations(bars: YahooDailyBar[]): CompletedBar[] {
  return bars.map(bar => ({
    high: bar.high,
    low: bar.low,
    close: bar.close,
    volume: bar.volume,
    timestamp: new Date(bar.timestamp).toISOString(),
  }));
}

export async function readCanonicalMarketContext(): Promise<MarketContextObservation | null> {
  try {
    const state = await getAuthoritativeCanonicalIntelligenceState();
    if (!state || !isCanonicalCurrentUsable(state)) return null;
    return {
      pressureIndex: state.pressureIndex,
      regime: state.regime,
      source: "canonical-intelligence-state",
      observedAt: state.effectiveAt,
      usable: true,
    };
  } catch {
    return null;
  }
}

export async function fetchYahooProfile(symbol: string): Promise<ProfileObservation | null> {
  try {
    const response = await fetch(`https://query1.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(symbol)}?modules=assetProfile,summaryDetail,calendarEvents`, {
      headers: { "User-Agent": "Mozilla/5.0", Accept: "application/json", Referer: "https://finance.yahoo.com/" },
      signal: AbortSignal.timeout(8_000),
    });
    if (!response.ok) return null;
    const payload = await response.json() as {
      quoteSummary?: { result?: Array<{
        assetProfile?: { sector?: unknown; industry?: unknown };
        summaryDetail?: { marketCap?: { raw?: unknown } | number; trailingPE?: { raw?: unknown } | number };
        calendarEvents?: { earnings?: { earningsDate?: Array<{ raw?: unknown } | number> } };
      }> };
    };
    const result = payload.quoteSummary?.result?.[0];
    if (!result) return null;
    const rawNumber = (value: unknown): number | null => {
      if (typeof value === "number" && Number.isFinite(value)) return value;
      if (value && typeof value === "object" && "raw" in value && typeof value.raw === "number" && Number.isFinite(value.raw)) return value.raw;
      return null;
    };
    const text = (value: unknown): string | null => typeof value === "string" && value.trim() ? value.trim() : null;
    const earningsRaw = result.calendarEvents?.earnings?.earningsDate?.[0];
    const earningsUnix = rawNumber(earningsRaw);
    const profile: ProfileObservation = {
      name: null,
      sector: text(result.assetProfile?.sector),
      industry: text(result.assetProfile?.industry),
      marketCap: rawNumber(result.summaryDetail?.marketCap),
      trailingPe: rawNumber(result.summaryDetail?.trailingPE),
      earningsDate: earningsUnix != null ? new Date(earningsUnix * 1000).toISOString() : null,
      source: "yahoo-quote-summary",
      observedAt: null,
    };
    if (!profile.sector && !profile.industry && profile.marketCap == null && profile.trailingPe == null && !profile.earningsDate) return null;
    return profile;
  } catch {
    return null;
  }
}

export function liveThesisSources(): ThesisSourceDeps {
  return {
    getQuote: async symbol => {
      try {
        return await getQuote(symbol);
      } catch {
        return null;
      }
    },
    getDailyBars: async symbol => {
      try {
        return await getDailyBars(symbol, "3mo");
      } catch {
        return [];
      }
    },
    getMarket: readCanonicalMarketContext,
    getProfile: fetchYahooProfile,
  };
}

export async function composeStockPentagonalThesis(
  symbol: string,
  options?: { now?: Date; deps?: ThesisSourceDeps; useCache?: boolean },
): Promise<PentagonalThesis> {
  const deps = options?.deps;
  const useCache = options?.useCache ?? !deps;
  const cacheKey = symbol.trim().toUpperCase();
  if (useCache) {
    const cached = cache.get(cacheKey);
    if (cached) return cached;
  }
  const sources = deps ?? liveThesisSources();
  const [quote, bars, market, profile] = await Promise.all([
    sources.getQuote(cacheKey).catch(() => null),
    sources.getDailyBars(cacheKey).catch(() => []),
    sources.getMarket().catch(() => null),
    sources.getProfile(cacheKey).catch(() => null),
  ]);
  const now = (options?.now ?? new Date()).toISOString();
  const thesis = buildPentagonalThesis({
    symbol: cacheKey,
    scope: "stock",
    generatedAt: now,
    quote: quoteObservation(quote),
    bars: barObservations(bars),
    market,
    profile,
    sessionRank: null,
  });
  if (!thesis.integrity.ok) {
    thesis.headline = "This read failed an integrity check and is not offered as analysis.";
    thesis.gaps.push({ field: "integrity", reason: thesis.integrity.violations.join("; ") || "Integrity check failed.", citedAsDriver: false });
  }
  thesis.persistence = { written: false, reason: "A public read does not record a thesis." };
  if (useCache && thesis.integrity.ok) cache.set(cacheKey, thesis);
  return thesis;
}

export function clearPentagonalThesisCache(): void {
  cache.clear();
}
