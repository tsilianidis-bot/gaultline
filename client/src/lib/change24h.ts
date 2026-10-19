/**
 * 24h price change for display. A missing CoinGecko change is null on both
 * the scored field and `priceChangePercent24hDisplay`. Displays show "—" with
 * a neutral color and no arrow instead of "+0.00%".
 */
export type Change24hSource = {
  priceChangePercent24h?: number | null;
  priceChangePercent24hDisplay?: number | null;
};

export const CHANGE_24H_UNAVAILABLE_TEXT = "—";
export const CHANGE_24H_UNAVAILABLE_COLOR = "#64748B";

/** Displayable 24h change, or null when the provider did not supply one. */
export function displayChange24h(source: Change24hSource | null | undefined): number | null {
  if (!source) return null;
  const value = source.priceChangePercent24hDisplay !== undefined ? source.priceChangePercent24hDisplay : source.priceChangePercent24h;
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export function change24hText(value: number | null, digits = 2): string {
  return value === null ? CHANGE_24H_UNAVAILABLE_TEXT : `${value >= 0 ? "+" : ""}${value.toFixed(digits)}%`;
}

export function change24hColor(value: number | null, up = "#00FF88", down = "#FF2D55"): string {
  return value === null ? CHANGE_24H_UNAVAILABLE_COLOR : value >= 0 ? up : down;
}
