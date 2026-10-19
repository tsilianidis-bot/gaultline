/**
 * Labels shown for Smart Discovery. They come from source evidence, never from
 * a fixed "updated just now" string, never from model prose, and never from a
 * bare LIVE token. "Verified source" requires every supplied condition —
 * canonical quality, FRED status, FRED age, and each quote observation — to be
 * independently live.
 */
import {
  evidenceStatusLabel,
  worstEvidenceStatus,
  type EvidenceStatusLabel,
} from "../shared/evidenceStatus";

export type EvidenceFreshnessLabel = "Verified source" | "Delayed" | "Unavailable";

export interface EvidenceQuoteObservation {
  observedAtMs?: number | null;
  sourceStatus?: string | null;
}

export interface EvidenceFreshnessInput {
  /**
   * Required. `macro` may verify from canonical quality and FRED alone.
   * `ticker` verifies only when that response's own quote observations are
   * present. Omitting the scope is Unavailable, so a ticker cannot be
   * verified by forgetting to pass quotes.
   */
  scope?: "macro" | "ticker" | null;
  canonicalQuality?: string | null;
  fredStatus?: string | null;
  observedAtMs?: number | null;
  nowMs?: number;
  /** Provider observations. A string of "LIVE" is not an observation. */
  quotes?: EvidenceQuoteObservation[];
  /**
   * Retained so older callers cannot silently verify themselves. Strings are
   * ignored. Pass `quotes` with timestamps instead.
   */
  quoteFreshness?: Array<string | null | undefined>;
}

/**
 * Quote-row status for Smart Discovery scanners. Yahoo and Polygon previous-close
 * are delayed feeds. CoinGecko is live only when its own last-updated time parses.
 * A missing timestamp is UNAVAILABLE. Fetch time is never substituted.
 */
export function providerRowFreshness(input: {
  observedAtMs?: number | null;
  provider: string;
  nowMs?: number;
}): EvidenceStatusLabel {
  const observedAtMs = typeof input.observedAtMs === "number" && Number.isFinite(input.observedAtMs)
    ? input.observedAtMs
    : null;
  const provider = input.provider;
  const sourceStatus = provider === "polygon-prev"
    ? "polygon-prev"
    : provider === "yahoo"
      ? "delayed"
      : provider === "coingecko"
        ? (observedAtMs != null ? "live" : "unavailable")
        : "unavailable";
  return evidenceStatusLabel({
    observedAtMs,
    nowMs: input.nowMs,
    sourceStatus,
    hasObservation: observedAtMs != null,
  });
}

function discoveryLabel(status: EvidenceStatusLabel): EvidenceFreshnessLabel {
  if (status === "LIVE") return "Verified source";
  if (status === "STALE" || status === "UNAVAILABLE") return "Unavailable";
  return "Delayed";
}

/** FRED observation time. A missing asOf stays missing. Assembly time is never a substitute. */
export function fredObservationMs(asOf: unknown): number | null {
  return typeof asOf === "number" && Number.isFinite(asOf) ? asOf : null;
}

function quoteObservationLabel(quote: EvidenceQuoteObservation, nowMs: number): EvidenceStatusLabel {
  const source = typeof quote.sourceStatus === "string" ? quote.sourceStatus.trim() : "";
  if (!source || quote.observedAtMs == null) return "UNAVAILABLE";
  return evidenceStatusLabel({
    observedAtMs: quote.observedAtMs,
    nowMs,
    sourceStatus: source,
    hasObservation: true,
  });
}

export function evidenceFreshnessLabel(input: EvidenceFreshnessInput): EvidenceFreshnessLabel {
  if (input.scope !== "macro" && input.scope !== "ticker") return "Unavailable";
  if (input.scope === "ticker" && (!input.quotes || input.quotes.length === 0)) return "Unavailable";
  if (input.quotes && input.quotes.length === 0) return "Unavailable";
  const nowMs = input.nowMs ?? Date.now();
  const fredStatus = typeof input.fredStatus === "string" ? input.fredStatus.trim() : "";
  const observedAtMs = fredObservationMs(input.observedAtMs);
  const canonical = evidenceStatusLabel({
    observedAtMs,
    nowMs,
    // Missing canonical quality is not healthy evidence. PARTIAL keeps it
    // out of LIVE without treating an omitted field as a dead source.
    quality: input.canonicalQuality == null ? "PARTIAL" : input.canonicalQuality,
    sourceStatus: fredStatus === "" ? null : fredStatus,
    hasObservation: observedAtMs != null && fredStatus !== "",
  });
  const quoteLabels = (input.quotes ?? []).map(quote => quoteObservationLabel(quote, nowMs));
  // A caller that only has the old LIVE/DELAYED strings has no observation time.
  if (input.quoteFreshness && input.quotes == null) {
    quoteLabels.push("UNAVAILABLE");
  }
  return discoveryLabel(worstEvidenceStatus([canonical, ...quoteLabels]));
}
