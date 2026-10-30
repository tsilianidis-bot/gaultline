import {
  classifyYahooObservation,
  type YahooObservationTiming,
  type YahooQuote,
} from "./yahooProxy";

/** Customer-visible quote state. LIVE requires an undelayed, fresh provider observation. */
export type SecurityQuoteFreshness = "LIVE" | "DELAYED" | "STALE" | "FALLBACK" | "UNAVAILABLE";

export interface SecurityQuoteProvenance {
  /** Actual provider adapter; never inferred from the session label. */
  provider: "yahoo" | "polygon-prev" | "unavailable";
  /** Provider observation time in epoch milliseconds. Null when unavailable, invalid, or in the future. */
  observedAt: number | null;
  /** Yahoo/Polygon delay declaration; null when no usable quote exists. */
  isDelayed: boolean | null;
  /** Provider session classification, separate from freshness. */
  marketSession: YahooQuote["marketState"];
  /** Freshness is derived from provider observation metadata, not REGULAR/PRE/POST alone. */
  freshnessState: SecurityQuoteFreshness;
}

function validObservedAt(value: unknown, now: number): number | null {
  return typeof value === "number" && Number.isFinite(value) && value > 0 && value <= now
    ? value
    : null;
}

function freshnessFromTiming(timing: YahooObservationTiming): SecurityQuoteFreshness {
  if (timing === "live") return "LIVE";
  // A completed close is an observed, non-live quote. It remains explicitly delayed
  // rather than being promoted to a current/live price.
  if (timing === "delayed" || timing === "completed_session") return "DELAYED";
  if (timing === "stale") return "STALE";
  return "UNAVAILABLE";
}

/**
 * Carries all quote provenance needed by the customer-visible security context.
 * A provider session such as REGULAR only identifies the session; it can never
 * establish LIVE without a non-delayed, fresh provider observation.
 */
export function securityQuoteProvenance(
  quote: YahooQuote | null | undefined,
  now = Date.now(),
): SecurityQuoteProvenance {
  const marketSession = quote?.marketState ?? "UNKNOWN";
  const observedAt = validObservedAt(quote?.observedAt, now);
  if (!quote || quote.source === "error") {
    return {
      provider: "unavailable",
      observedAt: null,
      isDelayed: null,
      marketSession,
      freshnessState: "UNAVAILABLE",
    };
  }

  const timing = classifyYahooObservation(quote, now).timing;
  const observationFreshness = freshnessFromTiming(timing);
  // Polygon's previous-bar adapter is explicitly a fallback source. Preserve that
  // source fact while it remains a usable, dated observation; an expired/missing
  // observation is stale/unavailable instead of a deceptively usable fallback.
  const freshnessState: SecurityQuoteFreshness = quote.source === "polygon-prev"
    && (observationFreshness === "LIVE" || observationFreshness === "DELAYED")
    ? "FALLBACK"
    : observationFreshness;

  return {
    provider: quote.source,
    observedAt,
    isDelayed: quote.isDelayed,
    marketSession,
    freshnessState,
  };
}
