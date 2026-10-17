import { computeTradingSignal, type TradingSignalsInput, type RegimeInput } from "./tradingSignals";
import { getDailyBars, getQuote, classifyYahooObservation, type YahooQuote, type YahooDailyBar } from "./yahooProxy";
import { getAuthoritativeCanonicalIntelligenceState } from "./canonicalIntelligenceState";
import { toOperationalPressure, toSignalRegime } from "./operationalSignalInputs";
import { etDate, isSessionComplete } from "./sectorRotation/calc";
import type { CanonicalIntelligenceState } from "../shared/canonicalIntelligenceState";

function finite(value: unknown): value is number { return typeof value === "number" && Number.isFinite(value); }

export function completedSignalBars(bars: YahooDailyBar[], now = Date.now()): YahooDailyBar[] {
  return bars.filter(bar => [bar.open, bar.high, bar.low, bar.close, bar.volume, bar.timestamp].every(finite) &&
    bar.close > 0 && bar.open > 0 && bar.volume >= 0 && bar.high >= bar.low && isSessionComplete(etDate(bar.timestamp), now));
}

/** Shared observed-data builder for desktop, mobile and strict ticker detail. */
export function buildObservedTradingSignalInput(symbol: string, quote: YahooQuote | null, rawBars: YahooDailyBar[], now = Date.now()): TradingSignalsInput | null {
  const bars = completedSignalBars(rawBars, now);
  const timing = classifyYahooObservation(quote, now);
  if (!quote || quote.source === "error" || ![quote.price, quote.open, quote.high, quote.low, quote.changePercent, quote.volume].every(finite) ||
    !finite(quote.observedAt) || !finite(quote.fetchedAt) || quote.observedAt > quote.fetchedAt + 60_000 ||
    quote.fetchedAt > now + 60_000 || !["live", "delayed", "completed_session"].includes(timing.timing) || bars.length < 20 || (quote.price as number) <= 0) return null;
  const closes = bars.map(bar => bar.close);
  const sma20 = closes.slice(-20).reduce((sum, close) => sum + close, 0) / 20;
  const avgVolume = bars.slice(-20).reduce((sum, bar) => sum + bar.volume, 0) / 20;
  if (!Number.isFinite(sma20) || sma20 <= 0 || !Number.isFinite(avgVolume) || avgVolume <= 0) return null;
  const relativeStrength = Math.round(Math.max(0, Math.min(100, 50 + (((quote.price as number) / sma20) - 1) * 500)));
  const recent = bars.slice(-5);
  const base = recent[0].close;
  return { ticker: symbol.toUpperCase(), price: quote.price as number, open: quote.open as number,
    high: quote.high as number, low: quote.low as number, changePercent: quote.changePercent as number,
    volumeMillions: (quote.volume as number) / 1_000_000, avgVolume: avgVolume / 1_000_000,
    sparkline: recent.map(bar => Number((((bar.close - base) / base) * 100).toFixed(4))), relativeStrength, dailyBars: bars };
}

export async function getSignalVisualDetailPayload(symbol: string, suppliedCanonical?: CanonicalIntelligenceState | null) {
  const [quoteResult, barsResult, canonicalResult] = await Promise.allSettled([
    getQuote(symbol), getDailyBars(symbol, "3mo"), suppliedCanonical !== undefined ? Promise.resolve(suppliedCanonical) : getAuthoritativeCanonicalIntelligenceState(),
  ]);
  const quote = quoteResult.status === "fulfilled" ? quoteResult.value : null;
  const rawBars = barsResult.status === "fulfilled" ? barsResult.value : [];
  const canonical = canonicalResult.status === "fulfilled" ? canonicalResult.value : null;
  const bars = completedSignalBars(rawBars);
  const input = buildObservedTradingSignalInput(symbol, quote, bars);
  let regime: (RegimeInput & { pressureIndex: number; direction: string; freshness: string; computedAt: string; stateId: string }) | null = null;
  try {
    const pressure = toOperationalPressure(canonical);
    regime = { ...toSignalRegime(pressure), pressureIndex: pressure.overallPressure, direction: canonical!.pressureDirection,
      freshness: canonical!.confidenceOrEvidenceQuality, computedAt: canonical!.effectiveAt, stateId: canonical!.stateId };
  } catch { /* No usable canonical reading: do not independently recalculate. */ }
  const signal = input && regime ? computeTradingSignal(input, regime) : null;
  const latestBar = bars.at(-1) ?? null;
  const quoteTiming = classifyYahooObservation(quote);
  return {
    symbol, quote, bars, signal: signal ? { ...signal, confidence: null, canonicalStateId: canonical!.stateId,
      observedAt: quote!.observedAt, source: quote!.source, evidenceQuality: canonical!.confidenceOrEvidenceQuality } : null,
    regime, relativeStrength: input?.relativeStrength ?? null,
    avgVolume: input ? input.avgVolume * 1_000_000 : null,
    observedAt: quote?.observedAt ?? latestBar?.timestamp ?? null,
    providerHealth: {
      quote: { status: input ? "available" : "unavailable", source: quote?.source ?? "unavailable", observedAt: quote?.observedAt ?? null,
        fetchedAt: quote?.fetchedAt ?? null, detail: input ? quoteTiming.detail : quote?.error ?? "Required timestamped market quote fields are unavailable." },
      dailyBars: { status: bars.length >= 20 ? "available" : bars.length > 0 ? "limited" : "unavailable", source: "yahoo", completedBars: bars.length,
        latestCompletedAt: latestBar?.timestamp ?? null, detail: bars.length >= 20 ? "Completed daily OHLCV observations supplied for deterministic technical calculations." : "Fewer than 20 completed daily bars: volume baseline and relative strength withheld." },
      regime: { status: regime ? "available" : "unavailable", source: "canonical-intelligence-state", computedAt: canonical?.effectiveAt ?? null,
        freshness: canonical?.confidenceOrEvidenceQuality ?? null, detail: regime ? `Bound to canonical state ${regime.stateId}.` : "Verified canonical market context unavailable." },
      signal: { status: signal ? "available" : "unavailable", detail: signal ? "Deterministic model output from observed quote, completed bars and canonical market context; not a calibrated forecast." : "Signal withheld until required source observations and canonical context are available." },
    },
  };
}
