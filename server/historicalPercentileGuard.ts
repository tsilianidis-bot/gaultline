/**
 * Historical-context percentile guard (display layer only).
 *
 * computeHistoricalContext() ranks today's reading against the monthly
 * pressureHistory table. The canonical MarketState (marketStateService
 * `now.historicalPercentile`) is the percentile every other surface shows.
 * When the two disagree the historical-context percentile is withheld — it is
 * shown as "Unavailable", and the rarity label, months-at-level / frequency
 * figures and the market-story clause that cite it are suppressed — so no page
 * shows two different percentiles for the same reading. When they agree the
 * context is returned unchanged. No calculation reads anything set here.
 *
 * Applied at the server response boundary (pressure.getHistoricalContext and
 * the homepage briefing), so every consumer receives the guarded value.
 */
import type { HistoricalContextResult, HistoricalRarityContext } from "./historicalContextEngine";

export type HistoricalPercentileStatus =
  /** The historical-context percentile matches the canonical percentile. */
  | "AVAILABLE"
  /** Fewer than 10 recorded months: the engine itself withholds the percentile. */
  | "INSUFFICIENT_SAMPLE"
  /** It differs from (or cannot be checked against) the canonical percentile. */
  | "UNAVAILABLE";

export const HISTORICAL_PERCENTILE_UNAVAILABLE_LABEL =
  "Unavailable — the monthly-history percentile does not match the canonical reading";

export type GuardedHistoricalRarityContext =
  Omit<HistoricalRarityContext, "monthsAtOrAbove" | "frequencyPct"> & {
    monthsAtOrAbove: number | null;
    frequencyPct: number | null;
    percentileStatus: HistoricalPercentileStatus;
  };

export type GuardedHistoricalContext<T extends HistoricalContextResult = HistoricalContextResult> =
  Omit<T, "rarityContext"> & { rarityContext: GuardedHistoricalRarityContext };

/** Canonical percentile as displayed elsewhere (rounded), or null. */
export function normalizeCanonicalPercentile(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? Math.round(value) : null;
}

// The engine's story opens "Market pressure is currently X/100 (R), placing it
// in the Nth percentile of N recorded monthly observations since YYYY-MM."
const STORY_PERCENTILE_CLAUSE = /,\s*placing it in the \d+(?:st|nd|rd|th) percentile\b[^.]*\./i;
const ANY_ORDINAL_PERCENTILE = /\b\d+(?:st|nd|rd|th)\s+percentile\b/i;

/** Remove the clause (or, failing that, every sentence) citing an ordinal percentile. */
export function stripHistoricalPercentileFromStory(story: string): string {
  let out = story.replace(STORY_PERCENTILE_CLAUSE, ".");
  if (ANY_ORDINAL_PERCENTILE.test(out)) {
    out = (out.match(/[^.!?]+[.!?]*\s*/g) ?? [])
      .filter(sentence => !ANY_ORDINAL_PERCENTILE.test(sentence))
      .join("")
      .trim();
  }
  return out;
}

export function reconcileHistoricalContextPercentile<T extends HistoricalContextResult>(
  context: T,
  canonicalPercentileInput: number | null | undefined,
): GuardedHistoricalContext<T> {
  const canonicalPercentile = normalizeCanonicalPercentile(canonicalPercentileInput);
  const contextPercentile = context.rarityContext.percentile;

  if (contextPercentile === null) {
    return { ...context, rarityContext: { ...context.rarityContext, percentileStatus: "INSUFFICIENT_SAMPLE" } };
  }
  if (canonicalPercentile !== null && contextPercentile === canonicalPercentile) {
    return { ...context, rarityContext: { ...context.rarityContext, percentileStatus: "AVAILABLE" } };
  }
  // Differs from the canonical percentile, or the canonical one is unavailable:
  // fail closed.
  return {
    ...context,
    marketStory: stripHistoricalPercentileFromStory(context.marketStory),
    rarityContext: {
      ...context.rarityContext,
      percentile: null,
      monthsAtOrAbove: null,
      frequencyPct: null,
      rarityLabel: HISTORICAL_PERCENTILE_UNAVAILABLE_LABEL,
      percentileStatus: "UNAVAILABLE",
    },
  };
}
