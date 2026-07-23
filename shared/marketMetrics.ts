const MIN_CANONICAL_METRIC = 0;
const MAX_CANONICAL_METRIC = 100;

export function normalizeCanonicalMetric(value: number, fallback = 0): number {
  const safeFallback = Number.isFinite(fallback) ? fallback : 0;
  const numeric = Number.isFinite(value) ? value : safeFallback;
  const clamped = Math.min(MAX_CANONICAL_METRIC, Math.max(MIN_CANONICAL_METRIC, numeric));
  return Math.round(clamped * 10) / 10;
}

function displayMetric(value: number): string {
  const normalized = normalizeCanonicalMetric(value);
  return Number.isInteger(normalized) ? normalized.toFixed(0) : normalized.toFixed(1);
}

export function formatCanonicalPercent(value: number): string {
  return `${displayMetric(value)}%`;
}

export function formatCanonicalScore(value: number): string {
  return `${displayMetric(value)}/100`;
}
