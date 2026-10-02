/* ============================================================
   Real readings for the macro indicators that Watchlist and the Alert
   Monitor threshold cards display (presentation only).

   EngineContext.indicators is the browser engine's fixed DEFAULT_INDICATORS
   baseline (HY 342 bps, 10Y–2Y −42 bps, VIX 22.4, …). It exists for the
   Simulate Pressure sandbox and must never be shown as a market reading.
   These readings come from the same sources as the /app header strip:
     - HY spread, effective fed funds, CPI YoY → FRED via /api/fred
     - 10Y, 30Y, 10Y–2Y, VIX → markets.getGlobalSnapshot
   Every reading carries its own freshness tag (DELAYED / LAST CLOSE / STALE).
   An indicator without a real source is simply absent → "—" UNAVAILABLE.
   Nothing here calculates an engine score.
   ============================================================ */
import type { RawIndicators } from "@/lib/engine";
import { toTickerQuote } from "@/components/landing/ticker/tickerModel";
import {
  cpiYoY,
  fredObservationState,
  validObservations,
  type AppHeaderFredSeriesId,
  type FredCadence,
  type FredObservation,
} from "@/lib/appHeaderStrip";
import type { MarketQuoteItem } from "../../../server/routers/markets";

export interface IndicatorReading {
  value: number;
  /** Visible freshness tag; null only for a genuinely live print. */
  stateLabel: string | null;
  /** Source + as-of note for tooltips. */
  source: string;
}

export type IndicatorKey = keyof RawIndicators;
export type LiveIndicatorReadings = Partial<Record<IndicatorKey, IndicatorReading>>;

type QuoteLike = Pick<MarketQuoteItem, "symbol" | "shortLabel" | "price" | "changePercent" | "freshnessState" | "sessionStatus" | "unit" | "proxySymbol">;

function fredReading(
  seriesId: AppHeaderFredSeriesId,
  cadence: FredCadence,
  observations: readonly FredObservation[] | null | undefined,
  now: number,
  transform: (value: number) => number = value => value,
): IndicatorReading | null {
  const [latest] = validObservations(observations);
  if (!latest) return null;
  return {
    value: transform(latest.value),
    stateLabel: fredObservationState(latest.date, cadence, now),
    source: `FRED ${seriesId} · observation ${latest.date}`,
  };
}

function quoteReading(items: readonly QuoteLike[] | null | undefined, symbol: string, requiredUnit?: string): IndicatorReading | null {
  const item = items?.find(candidate => candidate.symbol === symbol);
  if (!item) return null;
  if (requiredUnit && item.unit !== requiredUnit) return null;
  const quote = toTickerQuote(item, symbol, symbol);
  if (quote.state === "unavailable" || typeof item.price !== "number" || !Number.isFinite(item.price)) return null;
  return { value: item.price, stateLabel: quote.stateLabel, source: `markets.getGlobalSnapshot · ${symbol}` };
}

export function buildLiveIndicatorReadings(input: {
  quotes: readonly QuoteLike[] | null | undefined;
  fred: Partial<Record<AppHeaderFredSeriesId, readonly FredObservation[] | null>>;
  now: number;
}): LiveIndicatorReadings {
  const { quotes, fred, now } = input;
  const readings: LiveIndicatorReadings = {};
  const set = (key: IndicatorKey, reading: IndicatorReading | null) => {
    if (reading) readings[key] = reading;
  };
  // FRED BAMLH0A0HYM2 is in percent; the indicator is in bps.
  set("hySpread", fredReading("BAMLH0A0HYM2", "daily", fred.BAMLH0A0HYM2, now, value => Math.round(value * 100)));
  set("fedFundsRate", fredReading("FEDFUNDS", "monthly", fred.FEDFUNDS, now));
  const cpi = cpiYoY(fred.CPIAUCSL);
  if (cpi) {
    readings.cpi = {
      value: Math.round(cpi.value * 10) / 10,
      stateLabel: fredObservationState(cpi.date, "monthly", now),
      source: `FRED CPIAUCSL YoY · observation ${cpi.date}`,
    };
  }
  set("yield10Y", quoteReading(quotes, "FRED:DGS10"));
  set("yield30Y", quoteReading(quotes, "FRED:DGS30"));
  // DERIVED:2Y10Y is published in bps; accepted only when the unit says so.
  set("yieldCurveSpread", quoteReading(quotes, "DERIVED:2Y10Y", "bps"));
  set("vix", quoteReading(quotes, "^VIX"));
  return readings;
}

/**
 * Plain values for threshold evaluation. STALE readings are excluded so an
 * out-of-date observation never fires (or clears) a threshold alert.
 */
export function evaluableIndicatorValues(readings: LiveIndicatorReadings): Partial<Record<IndicatorKey, number>> {
  const values: Partial<Record<IndicatorKey, number>> = {};
  for (const [key, reading] of Object.entries(readings) as Array<[IndicatorKey, IndicatorReading | undefined]>) {
    if (reading && reading.stateLabel !== "STALE" && reading.stateLabel !== "UNAVAILABLE") values[key] = reading.value;
  }
  return values;
}
