/** Format a finite observation. Missing, NaN, and non-numeric values stay Unavailable. */
export function formatObservedFixed(
  value: number | null | undefined,
  digits: number,
  suffix = "",
): string {
  if (typeof value !== "number" || !Number.isFinite(value)) return "Unavailable";
  return `${value.toFixed(digits)}${suffix}`;
}

/**
 * Crypto card price. Observed numbers keep the prior ladder
 * (>= 1000 whole dollars, >= 1 two decimals, otherwise four).
 * A missing price is Unavailable and is never passed to toFixed.
 */
/** Equity quote level. Observed numbers stay two decimals, including 0. */
export function formatUsdQuote(value: number | null | undefined): string {
  if (typeof value !== "number" || !Number.isFinite(value)) return "Unavailable";
  return `$${value.toFixed(2)}`;
}

export function formatCryptoPrice(value: number | null | undefined): string {
  if (typeof value !== "number" || !Number.isFinite(value)) return "Unavailable";
  if (value >= 1000) return `$${value.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
  if (value >= 1) return `$${value.toFixed(2)}`;
  return `$${value.toFixed(4)}`;
}
