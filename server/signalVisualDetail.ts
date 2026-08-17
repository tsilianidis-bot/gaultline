import { computeTradingSignal } from "./tradingSignals";
import { getDailyBars, getQuote } from "./yahooProxy";
import { getLatestSeismographOutput } from "./scheduledSeismograph";

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function isObservedNumber(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function buildRelativeStrength(price: number, closes: number[]): number | null {
  if (closes.length < 20) return null;
  const sma20 = closes.slice(-20).reduce((sum, close) => sum + close, 0) / 20;
  if (!Number.isFinite(sma20) || sma20 <= 0) return null;

  return Math.round(clamp(50 + ((price / sma20) - 1) * 500, 0, 100));
}

/**
 * Creates the source-backed payload used by Signal Visual Analysis.
 * It never manufactures history: the chart receives completed daily bars only,
 * and a signal is withheld unless quote, bars, and canonical regime inputs exist.
 */
export async function getSignalVisualDetailPayload(symbol: string) {
  const [quoteResult, barsResult, seismographResult] = await Promise.allSettled([
    getQuote(symbol),
    getDailyBars(symbol, "3mo"),
    getLatestSeismographOutput(),
  ]);

  const quote = quoteResult.status === "fulfilled" ? quoteResult.value : null;
  const bars = barsResult.status === "fulfilled" ? barsResult.value : [];
  const seismograph = seismographResult.status === "fulfilled" ? seismographResult.value : null;
  const closes = bars.map(bar => bar.close);
  const latestBar = bars.at(-1) ?? null;
  const avgVolume = bars.length >= 20
    ? bars.slice(-20).reduce((sum, bar) => sum + bar.volume, 0) / 20
    : null;

  const quoteFieldsAvailable = Boolean(
    quote &&
    quote.source !== "error" &&
    isObservedNumber(quote.price) &&
    isObservedNumber(quote.open) &&
    isObservedNumber(quote.high) &&
    isObservedNumber(quote.low) &&
    isObservedNumber(quote.changePercent) &&
    isObservedNumber(quote.volume)
  );
  const regimeAvailable = Boolean(
    seismograph &&
    typeof seismograph.regime === "string" &&
    isObservedNumber(seismograph.pressureScore)
  );
  const regime = regimeAvailable && seismograph
    ? {
        label: seismograph.regime,
        score: clamp(seismograph.pressureScore / 10, 0, 10),
        pressureIndex: seismograph.pressureScore,
        direction: seismograph.direction,
        freshness: seismograph.dataFreshness,
        computedAt: seismograph.computedAt,
      }
    : null;
  const relativeStrength = quoteFieldsAvailable && quote
    ? buildRelativeStrength(quote.price, closes)
    : null;
  const sparklineBars = bars.slice(-5);
  const sparklineBase = sparklineBars[0]?.close;
  const sparkline = sparklineBase && sparklineBase > 0
    ? sparklineBars.map(bar => Number((((bar.close - sparklineBase) / sparklineBase) * 100).toFixed(4)))
    : [];

  const signal = quoteFieldsAvailable && quote && bars.length >= 15 && regime && relativeStrength !== null && avgVolume !== null
    ? computeTradingSignal({
        ticker: symbol,
        price: quote.price,
        open: quote.open,
        high: quote.high,
        low: quote.low,
        changePercent: quote.changePercent,
        volumeMillions: quote.volume / 1_000_000,
        avgVolume: avgVolume / 1_000_000,
        sparkline,
        relativeStrength,
        dailyBars: bars,
      }, regime)
    : null;

  return {
    symbol,
    quote,
    bars,
    signal,
    regime,
    relativeStrength,
    avgVolume,
    observedAt: quote?.observedAt ?? latestBar?.timestamp ?? seismograph?.computedAt ?? null,
    providerHealth: {
      quote: {
        status: quoteFieldsAvailable ? "available" : "unavailable",
        source: quote?.source ?? "unavailable",
        observedAt: quote?.observedAt ?? null,
        fetchedAt: quote?.fetchedAt ?? null,
        detail: quoteFieldsAvailable
          ? `${quote?.isDelayed ? "Delayed" : "Observed"} market quote available.`
          : quote?.error ?? "The market quote is not available with the fields required for a signal calculation.",
      },
      dailyBars: {
        status: bars.length >= 15 ? "available" : bars.length > 0 ? "limited" : "unavailable",
        source: "yahoo",
        completedBars: bars.length,
        latestCompletedAt: latestBar?.timestamp ?? null,
        detail: bars.length >= 15
          ? "Completed daily OHLCV bars available for charting and technical calculations."
          : "Fewer than 15 completed daily bars are available; technical signal calculation is withheld.",
      },
      regime: {
        status: regime ? "available" : "unavailable",
        source: "seismograph",
        computedAt: seismograph?.computedAt ?? null,
        freshness: seismograph?.dataFreshness ?? null,
        detail: regime
          ? "Latest canonical Seismograph regime context available."
          : "Current Seismograph regime context is unavailable; signal calculation is withheld.",
      },
      signal: {
        status: signal ? "available" : "unavailable",
        detail: signal
          ? "Calculated from the existing deterministic trading-signal engine."
          : "Signal calculation is unavailable until quote, completed daily-bar, and current regime inputs are all present.",
      },
    },
  };
}
