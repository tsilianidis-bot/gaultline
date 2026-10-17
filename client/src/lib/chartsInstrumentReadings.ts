/* ============================================================
   Charts tab (/app/pressure → Charts) "Market Intelligence Ribbon":
   presentation-only view model.

   Each instrument is bound to the reading the app already fetches through
   its canonical path (the same sources as the /app header strip and the
   Watchlist / Alert Monitor readings):
     - 10Y yield, 10Y–2Y spread, VIX → markets.getGlobalSnapshot
     - HY OAS → FRED BAMLH0A0HYM2 via /api/fred
   and shows its source, freshness tag and as-of (quote time in ET, or the
   FRED observation date). Without a valid reading it shows Unavailable.
   Instruments the app does not ingest (AI sentiment, M2 / Fed balance
   sheet liquidity) are Not tracked. No fixed values, no modelled lines.
   ============================================================ */
import { formatEt } from "@shared/credibilityLabels";
import { buildLiveIndicatorReadings, type IndicatorKey } from "@/lib/liveIndicatorReadings";
import { validObservations, type AppHeaderFredSeriesId, type FredObservation } from "@/lib/appHeaderStrip";
import type { MarketQuoteItem } from "../../../server/routers/markets";

export type ChartsQuoteItem = Pick<
  MarketQuoteItem,
  "symbol" | "shortLabel" | "price" | "changePercent" | "freshnessState" | "sessionStatus" | "unit" | "proxySymbol" | "observedAt" | "source"
>;

export interface ChartsInstrumentView {
  id: "yield-curve" | "vix" | "treasury" | "ai-sentiment" | "liquidity" | "credit-spread";
  label: string;
  sublabel: string;
  status: "bound" | "unavailable" | "not-tracked";
  /** Formatted value, "Unavailable" or "Not tracked". */
  value: string;
  unit: string;
  /** Freshness tag from the source (DELAYED / LAST CLOSE / STALE …), when bound. */
  stateLabel: string | null;
  /** Source + as-of line, or why there is no value. */
  basis: string;
  color: string;
}

interface BoundSpec {
  id: ChartsInstrumentView["id"];
  label: string;
  sublabel: string;
  key: IndicatorKey;
  unit: string;
  color: string;
  digits: number;
  /** Quote symbol in markets.getGlobalSnapshot, or FRED series id. */
  quoteSymbol?: string;
  fredSeries?: AppHeaderFredSeriesId;
}

const BOUND: BoundSpec[] = [
  { id: "yield-curve", label: "Yield Curve", sublabel: "10Y–2Y Spread", key: "yieldCurveSpread", unit: "bps", color: "#FF2D55", digits: 0, quoteSymbol: "DERIVED:2Y10Y" },
  { id: "vix", label: "VIX", sublabel: "CBOE Volatility Index", key: "vix", unit: "", color: "#FF9500", digits: 1, quoteSymbol: "^VIX" },
  { id: "treasury", label: "Treasury", sublabel: "10Y Yield", key: "yield10Y", unit: "%", color: "#00D4FF", digits: 2, quoteSymbol: "FRED:DGS10" },
  { id: "credit-spread", label: "Credit Spread", sublabel: "HY OAS", key: "hySpread", unit: "bps", color: "#FF9500", digits: 0, fredSeries: "BAMLH0A0HYM2" },
];

const NOT_TRACKED: Array<Pick<ChartsInstrumentView, "id" | "label" | "sublabel">> = [
  { id: "ai-sentiment", label: "AI Sentiment", sublabel: "Speculation Index" },
  { id: "liquidity", label: "Liquidity Flow", sublabel: "M2 / Fed Balance Sheet" },
];

const ORDER: ChartsInstrumentView["id"][] = ["yield-curve", "vix", "treasury", "ai-sentiment", "liquidity", "credit-spread"];

/**
 * As-of for a snapshot quote. FRED-backed items (source "fred" / "derived:FRED")
 * carry the observation DATE as midnight UTC, so they are shown as that date,
 * never converted to a clock time. Other quotes show their observation time in ET.
 */
export function quoteAsOf(item: Pick<ChartsQuoteItem, "observedAt" | "source"> | undefined): string {
  const t = item?.observedAt;
  if (typeof t !== "number" || !Number.isFinite(t)) return "— (no observation time)";
  if (/^(derived:)?fred$/i.test(item?.source ?? "")) return `${new Date(t).toISOString().slice(0, 10)} (FRED observation date)`;
  return formatEt(t) ?? "— (no observation time)";
}

export function buildChartsInstruments(input: {
  quotes: readonly ChartsQuoteItem[] | null | undefined;
  fred: Partial<Record<AppHeaderFredSeriesId, readonly FredObservation[] | null>>;
  now: number;
}): ChartsInstrumentView[] {
  const readings = buildLiveIndicatorReadings({ quotes: input.quotes, fred: input.fred, now: input.now });
  const views = new Map<ChartsInstrumentView["id"], ChartsInstrumentView>();

  for (const spec of BOUND) {
    const reading = readings[spec.key];
    if (!reading || !Number.isFinite(reading.value)) {
      views.set(spec.id, {
        id: spec.id, label: spec.label, sublabel: spec.sublabel, status: "unavailable", value: "Unavailable",
        unit: "", stateLabel: null, color: "#64748B",
        basis: spec.fredSeries ? `FRED ${spec.fredSeries}: no valid observation` : `markets.getGlobalSnapshot ${spec.quoteSymbol}: no valid reading`,
      });
      continue;
    }
    let basis: string;
    if (spec.fredSeries) {
      const [latest] = validObservations(input.fred[spec.fredSeries]);
      basis = `FRED ${spec.fredSeries} · as of ${latest?.date ?? "—"} (observation date)`;
    } else {
      const item = input.quotes?.find(q => q.symbol === spec.quoteSymbol);
      basis = `${item?.source ? `${item.source} via ` : ""}markets.getGlobalSnapshot ${spec.quoteSymbol} · as of ${quoteAsOf(item)}`;
    }
    views.set(spec.id, {
      id: spec.id, label: spec.label, sublabel: spec.sublabel, status: "bound",
      value: reading.value.toFixed(spec.digits), unit: spec.unit, stateLabel: reading.stateLabel,
      basis, color: spec.color,
    });
  }
  for (const nt of NOT_TRACKED) {
    views.set(nt.id, { ...nt, status: "not-tracked", value: "Not tracked", unit: "", stateLabel: null, basis: "FAULTLINE does not ingest this data", color: "#64748B" });
  }
  return ORDER.map(id => views.get(id)!);
}

/**
 * Source line for a Charts macro card: "API: <source>" only when a source is
 * wired; with no feed the note stands alone (never "API: No live data feed…").
 */
export function macroCardSourceText(apiSource: string | null | undefined): string {
  const text = (apiSource ?? "").trim();
  if (!text || /^no live data feed/i.test(text)) return text || "No live data feed is connected to this card.";
  return `API: ${text}`;
}
