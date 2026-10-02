/**
 * Missing-value display (James's rule): a missing value renders "—" /
 * Unavailable, never 0. formatCanonicalScore / formatCanonicalPercent clamp a
 * missing value to 0, so callers with a possibly-missing value use these.
 */
import { formatCanonicalScore } from "@shared/marketMetrics";

export const MISSING_VALUE_TEXT = "—";

/** The value when it is a finite number, otherwise null (never 0). */
export function finiteOrNull(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

/** "34/100" for a finite 0–100 score; "—" when missing. */
export function canonicalScoreText(value: unknown): string {
  const score = finiteOrNull(value);
  return score === null ? MISSING_VALUE_TEXT : formatCanonicalScore(score);
}

/** "91%" for a finite 0–100 similarity; "—" when missing. */
export function similarityText(value: unknown): string {
  const similarity = finiteOrNull(value);
  return similarity === null ? MISSING_VALUE_TEXT : `${Math.round(similarity)}%`;
}
