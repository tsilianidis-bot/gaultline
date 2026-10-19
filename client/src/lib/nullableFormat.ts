/** Format a finite observation. Missing, NaN, and non-numeric values stay Unavailable. */
export function formatObservedFixed(
  value: number | null | undefined,
  digits: number,
  suffix = "",
): string {
  if (typeof value !== "number" || !Number.isFinite(value)) return "Unavailable";
  return `${value.toFixed(digits)}${suffix}`;
}
