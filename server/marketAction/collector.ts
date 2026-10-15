import { MARKET_ACTION_METHOD_VERSION, type MarketActionReading, type MarketActionServed, type MarketActionSnapshot, type MarketActionSourceCoverage } from "../../shared/marketAction";
import { fetchFredBulk, type FredSeriesResult } from "../fredClient";
import { getGlobalStats } from "../coingeckoProxy";
import { recordVerifiedInstitutionalEvent } from "../institutionalMemory";
import { log } from "../logger";
import { getQuotes, type YahooQuote } from "../yahooProxy";
import { detectMarketAction, highestPriorityEvent } from "./analysis";
import { MarketActionStore } from "./store";

const MINUTE = 60_000;
const TICK_INTERVAL_MS = 5 * MINUTE;
const SNAPSHOT_FRESH_MS = 35 * MINUTE;
const QUOTE_SPECS = [
  ["SPY", "SPY", "S&P 500 ETF proxy"],
  ["QQQ", "QQQ", "Nasdaq-100 ETF proxy"],
  ["IWM", "IWM", "Russell 2000 ETF proxy"],
  ["XLK", "XLK", "Technology Select Sector SPDR"],
  ["XLF", "XLF", "Financial Select Sector SPDR"],
  ["XLE", "XLE", "Energy Select Sector SPDR"],
  ["XLY", "XLY", "Consumer Discretionary Select Sector SPDR"],
  ["XLP", "XLP", "Consumer Staples Select Sector SPDR"],
  ["XLV", "XLV", "Health Care Select Sector SPDR"],
  ["XLI", "XLI", "Industrial Select Sector SPDR"],
  ["XLU", "XLU", "Utilities Select Sector SPDR"],
  ["XLB", "XLB", "Materials Select Sector SPDR"],
  ["XLRE", "XLRE", "Real Estate Select Sector SPDR"],
  ["XLC", "XLC", "Communication Services Select Sector SPDR"],
  ["VIX", "^VIX", "CBOE Volatility Index"],
  ["BTC", "BTC-USD", "Bitcoin (BTC-USD)"],
] as const;

type QuoteId = typeof QUOTE_SPECS[number][0];

function asIso(value: number | null | undefined): string | null {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? new Date(value).toISOString() : null;
}

function quoteReading(id: QuoteId, ticker: string, label: string, quote: YahooQuote | undefined): MarketActionReading {
  const observedAt = asIso(quote?.observedAt) ?? asIso(quote?.fetchedAt);
  const available = quote?.price != null && Number.isFinite(quote.price);
  return {
    id,
    label,
    value: available ? quote!.price : null,
    changePercent: typeof quote?.changePercent === "number" && Number.isFinite(quote.changePercent) ? quote.changePercent : null,
    observedAt,
    provider: quote?.source === "polygon-prev" ? "Polygon previous-close fallback" : "Yahoo Finance",
    freshness: available ? "delayed" : "unavailable",
    unavailableReason: available ? null : "No verified quote was returned by the configured market-data adapter.",
  };
}

function latestFred(result: FredSeriesResult | undefined): { value: number; observedAt: string } | null {
  const observation = result?.observations.find(item => Number.isFinite(Number(item.value)));
  if (!observation) return null;
  return { value: Number(observation.value), observedAt: new Date(`${observation.date}T12:00:00.000Z`).toISOString() };
}

function coverage(id: MarketActionSourceCoverage["id"], label: string, provider: MarketActionSourceCoverage["provider"], count: number, total: number, observedAt: string | null, freshness: MarketActionSourceCoverage["freshness"]): MarketActionSourceCoverage {
  const available = count > 0;
  return {
    id,
    label,
    provider,
    status: available ? "available" : "unavailable",
    freshness: available ? freshness : "unavailable",
    observedAt,
    detail: available ? `${count}/${total} configured observations returned.` : "No verified observation is available from the configured source.",
  };
}

function latestObservation(readings: MarketActionReading[]) {
  const values = readings.map(reading => reading.observedAt).filter((value): value is string => !!value).map(value => Date.parse(value)).filter(Number.isFinite);
  return values.length ? new Date(Math.max(...values)).toISOString() : null;
}

export async function collectMarketActionSnapshot(now = Date.now()): Promise<MarketActionSnapshot> {
  const [quotes, cryptoGlobal, fred] = await Promise.all([
    getQuotes(QUOTE_SPECS.map(([, ticker]) => ticker)),
    getGlobalStats().catch(() => null),
    fetchFredBulk([
      { id: "DGS10", limit: 2 },
      { id: "DGS2", limit: 2 },
      { id: "BAMLH0A0HYM2", limit: 2 },
    ]),
  ]);
  const byTicker = new Map(quotes.map(quote => [quote.ticker.toUpperCase(), quote]));
  const readings = QUOTE_SPECS.map(([id, ticker, label]) => quoteReading(id, ticker, label, byTicker.get(ticker.toUpperCase())));
  const globalObservedAt = cryptoGlobal ? new Date(cryptoGlobal.fetchedAt).toISOString() : null;
  readings.push({
    id: "CRYPTO_GLOBAL",
    label: "Total crypto market capitalization",
    value: cryptoGlobal?.totalMarketCap ?? null,
    changePercent: cryptoGlobal?.marketCapChangePercent24h ?? null,
    observedAt: globalObservedAt,
    provider: "CoinGecko",
    freshness: cryptoGlobal ? "continuous" : "unavailable",
    unavailableReason: cryptoGlobal ? null : "CoinGecko global market statistics are unavailable.",
  });
  const fredSeries = [
    ["DGS10", "10-year Treasury yield (DGS10)"],
    ["DGS2", "2-year Treasury yield (DGS2)"],
    ["BAMLH0A0HYM2", "ICE BofA US High Yield OAS"],
  ] as const;
  for (const [seriesId, label] of fredSeries) {
    const observation = latestFred(fred.results[seriesId]);
    readings.push({
      id: seriesId,
      label,
      value: observation?.value ?? null,
      changePercent: null,
      observedAt: observation?.observedAt ?? null,
      provider: "FRED",
      freshness: observation ? "daily" : "unavailable",
      unavailableReason: observation ? null : "No verified daily FRED observation is available.",
    });
  }

  const equities = readings.filter(reading => ["SPY", "QQQ", "IWM"].includes(reading.id));
  const sectors = readings.filter(reading => ["XLK", "XLF", "XLE", "XLY", "XLP", "XLV", "XLI", "XLU", "XLB", "XLRE", "XLC"].includes(reading.id));
  const vix = readings.find(reading => reading.id === "VIX");
  const crypto = readings.filter(reading => ["BTC", "CRYPTO_GLOBAL"].includes(reading.id));
  const treasury = readings.filter(reading => ["DGS10", "DGS2"].includes(reading.id));
  const credit = readings.filter(reading => reading.id === "BAMLH0A0HYM2");
  const capturedAt = new Date(now).toISOString();
  const snapshot: MarketActionSnapshot = {
    kind: "market-action-snapshot",
    methodVersion: MARKET_ACTION_METHOD_VERSION,
    capturedAt,
    calculationAt: capturedAt,
    latestObservedAt: latestObservation(readings),
    coverage: [
      coverage("equities", "Major equity ETF proxies", "Yahoo Finance", equities.filter(reading => reading.value != null).length, equities.length, latestObservation(equities), "delayed"),
      coverage("sectors", "Sector ETF proxies", "Yahoo Finance", sectors.filter(reading => reading.value != null).length, sectors.length, latestObservation(sectors), "delayed"),
      coverage("volatility", "Volatility index", "Yahoo Finance", vix?.value != null ? 1 : 0, 1, vix?.observedAt ?? null, "delayed"),
      coverage("crypto", "Crypto market", "CoinGecko", crypto.filter(reading => reading.value != null).length, crypto.length, latestObservation(crypto), "continuous"),
      coverage("treasury", "Treasury yields", "FRED", treasury.filter(reading => reading.value != null).length, treasury.length, latestObservation(treasury), "daily"),
      coverage("credit", "Credit spread", "FRED", credit.filter(reading => reading.value != null).length, credit.length, latestObservation(credit), "daily"),
    ],
    readings,
    events: [],
    sourceNote: "Yahoo Finance observations are delayed where reported; CoinGecko is continuously traded crypto data; FRED Treasury and credit series are daily observations. Missing observations are disclosed and never treated as calm conditions.",
  };
  return snapshot;
}

function servedFreshness(snapshot: MarketActionSnapshot | null, now: number): Pick<MarketActionServed, "freshness" | "freshnessReason"> {
  if (!snapshot) return { freshness: "UNAVAILABLE", freshnessReason: "No verified Market Action snapshot has been saved yet." };
  const capturedAt = Date.parse(snapshot.capturedAt);
  if (!Number.isFinite(capturedAt)) return { freshness: "UNAVAILABLE", freshnessReason: "The saved Market Action snapshot has no valid collection timestamp." };
  const age = now - capturedAt;
  if (age <= SNAPSHOT_FRESH_MS) return { freshness: "CURRENT", freshnessReason: "Verified source observations are being collected on the active cadence; individual provider delays remain labeled." };
  if (age <= 6 * 60 * MINUTE) return { freshness: "DELAYED", freshnessReason: "The latest verified Market Action snapshot is older than the active collection window." };
  return { freshness: "STALE", freshnessReason: "The latest verified Market Action snapshot is stale; no current market-action inference is made from it." };
}

export class MarketActionCollector {
  private latest: MarketActionSnapshot | null = null;
  private running: Promise<void> | null = null;
  private timers: Array<ReturnType<typeof setTimeout>> = [];
  private lastSuccessfulCollectionAt: string | null = null;

  constructor(private readonly store = new MarketActionStore(), private readonly clock: () => number = Date.now) {}

  async served(): Promise<MarketActionServed> {
    if (!this.latest) this.latest = await this.store.loadLatest().catch(() => null);
    const freshness = servedFreshness(this.latest, this.clock());
    return {
      snapshot: this.latest,
      latestEvent: this.latest ? highestPriorityEvent(this.latest.events) : null,
      ...freshness,
      lastSuccessfulCollectionAt: this.lastSuccessfulCollectionAt ?? this.latest?.capturedAt ?? null,
    };
  }

  tick(): Promise<void> {
    if (this.running) return this.running;
    this.running = this.run().catch(error => {
      log.warn(`[MarketAction] Collection failed: ${error instanceof Error ? error.message : String(error)}`);
    }).finally(() => { this.running = null; });
    return this.running;
  }

  private async run(): Promise<void> {
    const now = this.clock();
    const claim = await this.store.tryClaim(now);
    if (claim === "HELD") return;
    const previous = this.latest ?? await this.store.loadLatest();
    const snapshot = await collectMarketActionSnapshot(now);
    snapshot.events = detectMarketAction(snapshot, previous);
    const inserted = await this.store.insert(snapshot);
    if (inserted === "DUPLICATE") return;
    this.latest = snapshot;
    this.lastSuccessfulCollectionAt = snapshot.capturedAt;
    await Promise.all(snapshot.events.map(event => recordVerifiedInstitutionalEvent({
      eventKey: event.key,
      eventType: `market_action_${event.kind}`,
      sourceEngine: "market_action_monitor",
      entityType: "market",
      severity: event.severity,
      direction: event.direction,
      eventAt: new Date(event.detectedAt),
      sourceObservedAt: snapshot.latestObservedAt ? new Date(snapshot.latestObservedAt) : null,
      dataFreshness: snapshot.coverage.map(item => `${item.id}:${item.freshness}`).join(",").slice(0, 64),
      headline: event.headline,
      explanation: event.inference,
      previousState: previous ? { capturedAt: previous.capturedAt, latestObservedAt: previous.latestObservedAt } : null,
      newState: { capturedAt: snapshot.capturedAt, latestObservedAt: snapshot.latestObservedAt, event },
      supportingState: { evidence: event.evidence, coverage: snapshot.coverage, sourceNote: snapshot.sourceNote },
    }).catch(error => log.warn(`[MarketAction] Event persistence failed: ${error instanceof Error ? error.message : String(error)}`))));
    log.info(`[MarketAction] Saved verified snapshot (${snapshot.readings.filter(item => item.value != null).length}/${snapshot.readings.length} readings; ${snapshot.events.length} material events).`);
  }

  start() {
    if (this.timers.length) return;
    const boot = setTimeout(() => { void this.tick(); }, 7_500);
    const interval = setInterval(() => { void this.tick(); }, TICK_INTERVAL_MS);
    (boot as { unref?: () => void }).unref?.();
    (interval as { unref?: () => void }).unref?.();
    this.timers.push(boot, interval);
  }

  stop() {
    for (const timer of this.timers) { clearTimeout(timer); clearInterval(timer); }
    this.timers = [];
  }
}

let singleton: MarketActionCollector | null = null;
export function getMarketActionCollector() {
  singleton ??= new MarketActionCollector();
  return singleton;
}
export function startMarketActionCollector() {
  getMarketActionCollector().start();
}
