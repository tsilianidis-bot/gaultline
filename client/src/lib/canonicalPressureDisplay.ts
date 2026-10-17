/**
 * Pressure Index for display beside Opportunity Engine output (display only).
 *
 * The opportunity scorer runs on its own cached pressure calculation; that
 * value stays a scoring input. The number shown to the user is the canonical
 * snapshot Pressure Index — the same source as the header strip, NOW and
 * Signals — or UNAVAILABLE when no canonical snapshot is bound.
 */
import { normalizeCanonicalMetric } from "@shared/marketMetrics";

export function canonicalPressureValue(
  canonical: { pressureIndex: number | null } | null | undefined,
): number | null {
  const value = canonical?.pressureIndex;
  return typeof value === "number" && Number.isFinite(value) ? normalizeCanonicalMetric(value) : null;
}

export function canonicalPressureLabel(
  canonical: { pressureIndex: number | null } | null | undefined,
): string {
  const value = canonicalPressureValue(canonical);
  if (value === null) return "UNAVAILABLE";
  return Number.isInteger(value) ? value.toFixed(0) : value.toFixed(1);
}
