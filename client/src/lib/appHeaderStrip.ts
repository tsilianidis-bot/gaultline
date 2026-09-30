/* ============================================================
   /app header strip — pure view model (presentation only).

   Every value comes from a real source, tagged the same way as the landing
   ticker (DELAYED / LAST CLOSE / STALE / UNAVAILABLE):
     - Regime, Pressure Index, Liquidity, Credit Stress → the canonical
       snapshot (marketState.canonicalCurrent) and its evidence lists.
     - VIX, 10Y, 2Y10Y, BTC dominance → markets.getGlobalSnapshot, through
       the landing ticker's toTickerQuote().
     - HY spread, USD Broad index, effective fed funds, CPI YoY → FRED
       observations via /api/fred, tagged DELAYED within the series cadence
       and STALE beyond it.
   Anything without a source renders "—" + UNAVAILABLE. Nothing is invented,
   and nothing here calculates an engine score.
   ============================================================ */
import type { PublicCanonicalIntelligenceState } from "@shared/canonicalIntelligenceState";
import type { CustomerIntegrityLabel } from "@shared/customerIntegrityLabels";
import { canonicalEngineEvidence, directionDisplay } from "@shared/snapshotEvidence";
import { formatCanonicalScore } from "@shared/marketMetrics";
import { toTickerQuote } from "@/components/landing/ticker/tickerModel";
import type { MarketQuoteItem } from "../../../server/routers/markets";

export type HeaderDirection = "up" | "down" | "flat";

export interface HeaderStripItem {
  label: string;
  value: string;
  direction: HeaderDirection | null;
  /** Visible freshness tag; null only for a current reading. */
  stateLabel: string | null;
  /** Source + as-of note for the tooltip. */
  title?: string;
}

export interface FredObservation { date: string; value: string }

export type FredCadence = "daily" | "weekly" | "monthly";

/**
 * Maximum observation age (days) before a FRED reading is STALE. Daily series
 * allow a long weekend plus publication lag; monthly series allow the normal
 * release lag (month M is published during month M+1) plus one missed release.
 */
export const FRED_MAX_OBSERVATION_AGE_DAYS: Record<FredCadence, number> = { daily: 5, weekly: 14, monthly: 75 };

export const APP_HEADER_FRED_SERIES = [
  { id: "BAMLH0A0HYM2", limit: 2, cadence: "daily" },
  // Daily observations, released weekly (Fed H.10), so staleness follows the weekly release cadence.
  { id: "DTWEXBGS", limit: 2, cadence: "weekly" },
  { id: "FEDFUNDS", limit: 2, cadence: "monthly" },
  { id: "CPIAUCSL", limit: 13, cadence: "monthly" },
] as const satisfies ReadonlyArray<{ id: string; limit: number; cadence: FredCadence }>;

export type AppHeaderFredSeriesId = (typeof APP_HEADER_FRED_SERIES)[number]["id"];

type QuoteLike = Pick<MarketQuoteItem, "symbol" | "shortLabel" | "price" | "changePercent" | "freshnessState" | "sessionStatus" | "unit" | "proxySymbol">;

const UNAVAILABLE = "UNAVAILABLE";

function unavailable(label: string, title?: string): HeaderStripItem {
  return { label, value: "—", direction: null, stateLabel: UNAVAILABLE, title };
}

function validObservations(observations: readonly FredObservation[] | null | undefined): Array<{ date: string; value: number }> {
  return (observations ?? [])
    .map(obs => ({ date: obs.date, value: Number.parseFloat(obs.value) }))
    .filter(obs => /^\d{4}-\d{2}-\d{2}$/.test(obs.date) && Number.isFinite(obs.value));
}

export function fredObservationState(date: string, cadence: FredCadence, now: number): "DELAYED" | "STALE" {
  const observed = Date.parse(`${date}T00:00:00Z`);
  if (!Number.isFinite(observed)) return "STALE";
  const ageDays = (now - observed) / 86_400_000;
  return ageDays > FRED_MAX_OBSERVATION_AGE_DAYS[cadence] ? "STALE" : "DELAYED";
}

function trend(current: number, prior: number | undefined, epsilon: number): HeaderDirection | null {
  if (prior == null || !Number.isFinite(prior)) return null;
  if (current > prior + epsilon) return "up";
  if (current < prior - epsilon) return "down";
  return "flat";
}

function fredItem(
  label: string,
  seriesId: AppHeaderFredSeriesId,
  cadence: FredCadence,
  observations: readonly FredObservation[] | null | undefined,
  now: number,
  format: (value: number) => string,
  epsilon: number,
): HeaderStripItem {
  const obs = validObservations(observations);
  if (obs.length === 0) return unavailable(label, `FRED ${seriesId} unavailable`);
  const [latest, prior] = obs;
  return {
    label,
    value: format(latest.value),
    direction: trend(latest.value, prior?.value, epsilon),
    stateLabel: fredObservationState(latest.date, cadence, now),
    title: `FRED ${seriesId} · observation ${latest.date}`,
  };
}

/** CPI YoY from 13 monthly CPIAUCSL levels; unavailable unless the base month is exactly 12 months earlier. */
export function cpiYoY(observations: readonly FredObservation[] | null | undefined): { date: string; value: number } | null {
  const obs = validObservations(observations);
  if (obs.length < 13) return null;
  const latest = obs[0];
  const base = obs.find(item => {
    const [y, m] = latest.date.split("-").map(Number);
    const [by, bm] = item.date.split("-").map(Number);
    return (y - by) * 12 + (m - bm) === 12;
  });
  if (!base || base.value <= 0) return null;
  return { date: latest.date, value: (latest.value / base.value - 1) * 100 };
}

function quoteItem(label: string, symbol: string, items: readonly QuoteLike[] | null | undefined): HeaderStripItem {
  if (!items) return unavailable(label, `${symbol} unavailable`);
  const item = items.find(candidate => candidate.symbol === symbol);
  const quote = toTickerQuote(item, label, symbol);
  if (quote.state === "unavailable" || quote.price == null) return unavailable(label, `${symbol} unavailable`);
  const value = item?.unit === "percent_of_market" ? `${quote.price}%` : quote.price;
  return { label, value, direction: quote.direction, stateLabel: quote.stateLabel, title: `markets.getGlobalSnapshot · ${symbol}` };
}

type CanonicalLike = Pick<PublicCanonicalIntelligenceState,
  "pressureIndex" | "regime" | "pressureDirection" | "engines" | "staleInputs" | "delayedInputs" | "fallbackInputs" | "unavailableInputs">;

function engineItem(label: string, engineId: string, state: CanonicalLike | null): HeaderStripItem {
  const engine = state?.engines.find(item => item.engineId === engineId);
  if (!state || !engine || typeof engine.value !== "number" || !Number.isFinite(engine.value) || engine.qualityStatus === "UNAVAILABLE") {
    return unavailable(label, `Canonical ${engineId} vector unavailable`);
  }
  const evidence = canonicalEngineEvidence(engine, state);
  return {
    label,
    value: formatCanonicalScore(engine.value),
    direction: null,
    stateLabel: evidence === "CURRENT" ? null : evidence,
    title: `Canonical ${engineId} vector`,
  };
}

const DIRECTION_GLYPH: Record<string, HeaderDirection | null> = { Deteriorating: "up", Improving: "down", Stable: "flat", Unavailable: null };

export function buildAppHeaderStrip(input: {
  canonical: CanonicalLike | null;
  integrity: CustomerIntegrityLabel;
  quotes: readonly QuoteLike[] | null | undefined;
  fred: Partial<Record<AppHeaderFredSeriesId, readonly FredObservation[] | null>>;
  now: number;
}): HeaderStripItem[] {
  const { canonical, fred, now } = input;
  const score = canonical?.pressureIndex;
  const hasScore = typeof score === "number" && Number.isFinite(score);
  const integrityTag = input.integrity === "LIVE" ? null : input.integrity;
  const direction = directionDisplay(canonical?.pressureDirection);
  const cpi = cpiYoY(fred.CPIAUCSL);

  return [
    canonical?.regime ? { label: "Regime", value: canonical.regime, direction: null, stateLabel: integrityTag, title: "Canonical snapshot regime" } : unavailable("Regime"),
    hasScore
      ? { label: "Pressure Index", value: formatCanonicalScore(score as number), direction: DIRECTION_GLYPH[direction], stateLabel: integrityTag, title: `Canonical snapshot · direction ${direction.toLowerCase()}` }
      : unavailable("Pressure Index"),
    engineItem("Liquidity", "liquidity-stress", canonical),
    engineItem("Credit Stress", "credit-contagion", canonical),
    quoteItem("VIX", "^VIX", input.quotes),
    quoteItem("10Y Treasury", "FRED:DGS10", input.quotes),
    quoteItem("2Y10Y", "DERIVED:2Y10Y", input.quotes),
    fredItem("HY Spread", "BAMLH0A0HYM2", "daily", fred.BAMLH0A0HYM2, now, value => `${Math.round(value * 100)}bps`, 0.005),
    fredItem("USD Broad (FRED)", "DTWEXBGS", "weekly", fred.DTWEXBGS, now, value => value.toFixed(2), 0.1),
    fredItem("Fed Funds (EFFR, mo. avg)", "FEDFUNDS", "monthly", fred.FEDFUNDS, now, value => `${value.toFixed(2)}%`, 0.005),
    cpi
      ? { label: "CPI YoY", value: `${cpi.value.toFixed(1)}%`, direction: null, stateLabel: fredObservationState(cpi.date, "monthly", now), title: `FRED CPIAUCSL · observation ${cpi.date}` }
      : unavailable("CPI YoY", "FRED CPIAUCSL unavailable"),
    quoteItem("BTC Dominance", "CG:BTC_DOM", input.quotes),
  ];
}
