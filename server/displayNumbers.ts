/** A non-finite number cannot be shown as zero. Null means unavailable. */
export function withholdNonFiniteNumbers(value: unknown): unknown {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (value === null || value === undefined) return value;
  if (Array.isArray(value)) return value.map(withholdNonFiniteNumbers);
  if (typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, item]) => [key, withholdNonFiniteNumbers(item)]),
    );
  }
  return value;
}
