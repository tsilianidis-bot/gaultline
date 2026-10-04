/**
 * Signal Outlook 8-factor breakdown: factor scores are 0–100 heuristic values and can arrive
 * as raw floats (50.940000000000005). Display rounds to one decimal at most; the value itself,
 * the bar width and every calculation are unchanged.
 */
export function formatFactorScore(score: number): string {
  return Number.isFinite(score) ? String(Math.round(score * 10) / 10) : "\u2014";
}
