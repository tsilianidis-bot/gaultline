/**
 * Labels shown for Smart Discovery. They come from source evidence, never from
 * a fixed "updated just now" string and never from model prose.
 */
export type EvidenceFreshnessLabel = "Verified source" | "Delayed" | "Unavailable";

export interface EvidenceFreshnessInput {
  canonicalQuality?: string | null;
  fredStatus?: string | null;
  observedAtMs?: number | null;
  nowMs?: number;
  /** Quote-source classifications already produced by the scanner (LIVE, DELAYED, STALE, UNAVAILABLE). */
  quoteFreshness?: Array<string | null | undefined>;
}

const LIVE_MAX_AGE_MS = 20 * 60 * 1000;
const RECENT_MAX_AGE_MS = 18 * 60 * 60 * 1000;

export function evidenceFreshnessLabel(input: EvidenceFreshnessInput): EvidenceFreshnessLabel {
  if (input.quoteFreshness) {
    const quotes = input.quoteFreshness.map(value => String(value ?? "UNAVAILABLE").toUpperCase());
    if (quotes.length === 0 || quotes.some(value => value === "STALE" || value === "UNAVAILABLE" || value === "")) return "Unavailable";
    if (quotes.some(value => value === "DELAYED")) return "Delayed";
    if (quotes.every(value => value === "LIVE")) return "Verified source";
    return "Unavailable";
  }

  const fred = String(input.fredStatus ?? "unavailable").toLowerCase();
  const quality = input.canonicalQuality ?? null;
  const observedAt = input.observedAtMs;
  const now = input.nowMs ?? Date.now();
  const ageMs = typeof observedAt === "number" && Number.isFinite(observedAt) ? Math.max(0, now - observedAt) : Number.POSITIVE_INFINITY;

  if (fred === "unavailable" || fred === "stale" || quality === "UNAVAILABLE" || ageMs > RECENT_MAX_AGE_MS) return "Unavailable";
  if (fred === "fallback" || fred === "delayed" || quality !== "HEALTHY" || ageMs > LIVE_MAX_AGE_MS) return "Delayed";
  if (fred === "live" && quality === "HEALTHY") return "Verified source";
  return "Unavailable";
}
