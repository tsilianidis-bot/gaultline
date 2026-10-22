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

/**
 * Engine domain/composite scores and their deltas are 0–10 internally; the
 * product displays them on the canonical 0–100 scale. Display conversion only
 * (×10); the composite calculation is unchanged.
 */
function toCanonical100(value010: unknown): number | null {
  const v = finiteOrNull(value010);
  return v === null ? null : Math.round(v * 10 * 10) / 10;
}

/** "33" for a 0–10 engine score of 3.3 (render with a "/100" suffix); "—" when missing. */
export function score100Value(score010: unknown): string {
  const v = toCanonical100(score010);
  return v === null ? MISSING_VALUE_TEXT : String(Math.round(v));
}

/**
 * A score's delta when it is known. Canonical projections have no prior
 * comparable reading, so they mark `deltaAvailable: false` (the numeric field
 * stays 0 for legacy consumers); those render "—", never "0 pts" or "Stable".
 */
export function availableDelta(
  item: { delta?: unknown; deltaAvailable?: boolean } | null | undefined,
): number | null {
  if (!item || item.deltaAvailable === false) return null;
  return finiteOrNull(item.delta);
}

/** "+3 pts" for a 0–10 delta of 0.3 (canonical 0–100 points); "—" when missing. */
export function pointsDeltaText(delta010: unknown): string {
  const v = toCanonical100(delta010);
  if (v === null) return MISSING_VALUE_TEXT;
  const shown = Object.is(v, -0) || v === 0 ? 0 : v;
  const sign = shown > 0 ? "+" : shown < 0 ? "-" : "";
  const abs = Math.abs(shown);
  return `${sign}${Number.isInteger(abs) ? abs.toFixed(0) : abs.toFixed(1)} pts`;
}
