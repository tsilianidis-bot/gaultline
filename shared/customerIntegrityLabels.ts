/**
 * Customer-facing data-integrity labels.
 * LIVE is reserved for truly live evidence. Fallback, cache, stale, and
 * unavailable states must never be presented as LIVE / MODE LIVE.
 */

export const CUSTOMER_INTEGRITY_LABELS = [
  "LIVE",
  "CACHED",
  "STALE",
  "FALLBACK",
  "UNAVAILABLE",
] as const;

export type CustomerIntegrityLabel = (typeof CUSTOMER_INTEGRITY_LABELS)[number];

export type CustomerIntegrityInput = {
  hasState?: boolean;
  freshness?: string | null;
  cacheStatus?: string | null;
  quality?: string | null;
  coherence?: string | null;
  fredStatus?: string | null;
  requiredUnavailable?: boolean;
  fallbackActive?: boolean;
  fallbackInputCount?: number;
  staleInputCount?: number;
  marketMode?: string | null;
  pressureDataSource?: string | null;
};

export type CustomerIntegrityEngineSnapshot = {
  canonicalState?: {
    confidenceOrEvidenceQuality?: string | null;
    provenance?: { coherenceStatus?: string | null };
    dataQualitySummary?: { fallbackInputCount?: number; staleInputCount?: number };
    fallbackInputs?: unknown[];
    staleInputs?: unknown[];
  } | null;
  marketState?: {
    freshness?: string | null;
    cache?: { status?: string | null };
  } | null;
  sourceHealth?: Array<{ id?: string; status?: string; required?: boolean }>;
  marketMode?: string | null;
};

const CONFLICT_TITLES: Record<string, string> = {
  STALE_INPUT: "Stale source data",
  FALLBACK_INPUT: "Fallback source data",
  UNAVAILABLE_INPUT: "Unavailable source",
  PRESSURE_MISMATCH: "Pressure mismatch",
  REGIME_MISMATCH: "Regime mismatch",
  TEMPORAL_MISMATCH: "Timing mismatch",
  STATE_UNAVAILABLE: "State unavailable",
};

const QUALITY_TITLES: Record<string, string> = {
  HEALTHY: "Healthy evidence",
  DEGRADED: "Limited evidence",
  PARTIAL: "Partial evidence",
  UNAVAILABLE: "Unavailable",
};

const BLANK_VALUES = new Set(["", "—", "–", "-", "N/A", "NA", "NULL", "UNAVAILABLE", "UNKNOWN"]);

export function customerIntegrityLabel(input: CustomerIntegrityInput): CustomerIntegrityLabel {
  const quality = String(input.quality ?? "").toUpperCase();
  const freshness = String(input.freshness ?? "").toLowerCase();
  const cache = String(input.cacheStatus ?? "").toLowerCase();
  const fred = String(input.fredStatus ?? "").toLowerCase();
  const coherence = String(input.coherence ?? "").toUpperCase();
  const mode = String(input.marketMode ?? "").toLowerCase();
  const pressureSource = String(input.pressureDataSource ?? "").toLowerCase();

  if (input.hasState === false) return "UNAVAILABLE";
  if (quality === "UNAVAILABLE") return "UNAVAILABLE";
  if (coherence === "UNAVAILABLE" || coherence === "INVALID") return "UNAVAILABLE";
  if (fred === "unavailable") return "UNAVAILABLE";
  if (input.requiredUnavailable) return "UNAVAILABLE";

  const fallback =
    quality === "DEGRADED" ||
    quality === "PARTIAL" ||
    coherence === "DEGRADED" ||
    fred === "degraded" ||
    input.fallbackActive === true ||
    (input.fallbackInputCount ?? 0) > 0 ||
    pressureSource === "fallback" ||
    mode === "deterministic-fallback";

  if (fallback) return "FALLBACK";

  const stale =
    freshness === "stale" ||
    cache === "stale-if-error" ||
    coherence === "STALE" ||
    (input.staleInputCount ?? 0) > 0;

  if (stale) return "STALE";

  const trulyLive =
    freshness === "live" &&
    (quality === "HEALTHY" || quality === "") &&
    (fred === "healthy" || fred === "") &&
    cache !== "fresh-cache" &&
    cache !== "stale-if-error";

  if (trulyLive) return "LIVE";
  return "CACHED";
}

export function customerIntegrityFromEngine(snapshot: CustomerIntegrityEngineSnapshot): CustomerIntegrityLabel {
  const sourceHealth = snapshot.sourceHealth ?? [];
  const fred = sourceHealth.find(source => source.id === "fred");
  return customerIntegrityLabel({
    hasState: Boolean(snapshot.canonicalState || snapshot.marketState),
    freshness: snapshot.marketState?.freshness,
    cacheStatus: snapshot.marketState?.cache?.status,
    quality: snapshot.canonicalState?.confidenceOrEvidenceQuality,
    coherence: snapshot.canonicalState?.provenance?.coherenceStatus,
    fredStatus: fred?.status,
    requiredUnavailable: sourceHealth.some(source => source.required && source.status === "unavailable"),
    fallbackActive: (snapshot.canonicalState?.fallbackInputs?.length ?? 0) > 0,
    fallbackInputCount: snapshot.canonicalState?.dataQualitySummary?.fallbackInputCount
      ?? snapshot.canonicalState?.fallbackInputs?.length
      ?? 0,
    staleInputCount: snapshot.canonicalState?.dataQualitySummary?.staleInputCount
      ?? snapshot.canonicalState?.staleInputs?.length
      ?? 0,
    marketMode: snapshot.marketMode,
  });
}

export function customerIntegrityColor(label: CustomerIntegrityLabel): string {
  if (label === "LIVE") return "#00FF88";
  if (label === "CACHED") return "#A78BFA";
  if (label === "STALE") return "#FBBF24";
  if (label === "FALLBACK") return "#FF9500";
  return "#94A3B8";
}

export function customerIntegrityBadgeColor(label: CustomerIntegrityLabel): "green" | "amber" | "blue" | "gray" {
  if (label === "LIVE") return "green";
  if (label === "CACHED") return "blue";
  if (label === "STALE" || label === "FALLBACK") return "amber";
  return "gray";
}

/** Map integrity onto DataFreshnessChip levels. LIVE only when truly live. */
export function customerIntegrityChipLevel(
  label: CustomerIntegrityLabel,
): "live" | "cached" | "stale" | "fallback" | "unavailable" {
  if (label === "LIVE") return "live";
  if (label === "CACHED") return "cached";
  if (label === "STALE") return "stale";
  if (label === "FALLBACK") return "fallback";
  return "unavailable";
}

export function humanizeConflictType(conflictType: string | null | undefined): string {
  if (!conflictType) return "Data notice";
  const known = CONFLICT_TITLES[conflictType];
  if (known) return known;
  return conflictType
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, char => char.toUpperCase())
    .trim() || "Data notice";
}

export function humanizeQualityStatus(quality: string | null | undefined): string {
  if (!quality) return "Evidence status unavailable";
  return QUALITY_TITLES[quality] ?? quality.replace(/[_-]+/g, " ").toLowerCase().replace(/^\w/, char => char.toUpperCase());
}

const DEBUG_CODE = /STALE_INPUT|FALLBACK_INPUT|UNAVAILABLE_INPUT|CANONICAL[^\n]{0,40}DEGRADED|PHASE2-CANONICAL|state:[0-9T.:-]+[:/][a-f0-9]{8,}|stateHash|[a-f0-9]{24,}/i;

export function isCustomerDebugWatermark(value: string | null | undefined): boolean {
  if (!value) return false;
  return DEBUG_CODE.test(value);
}

export function isBlankTickerValue(value: string | number | null | undefined): boolean {
  if (value == null) return true;
  if (typeof value === "number") return !Number.isFinite(value);
  const trimmed = value.trim();
  if (!trimmed) return true;
  return BLANK_VALUES.has(trimmed.toUpperCase());
}

function normalizeTickerKey(label: string): string {
  return label.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
}

/** Drop blank/unavailable copies when the same strip already has a usable ticker. */
export function hideBlankTickerDuplicates<T extends { label: string; value?: string | number | null }>(
  items: readonly T[],
): T[] {
  const usableKeys = new Set(
    items
      .filter(item => !isBlankTickerValue(item.value))
      .map(item => normalizeTickerKey(item.label)),
  );
  const seen = new Set<string>();
  const result: T[] = [];
  for (const item of items) {
    const key = normalizeTickerKey(item.label);
    const blank = isBlankTickerValue(item.value);
    if (blank && usableKeys.has(key)) continue;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(item);
  }
  return result;
}

export function hideBlankMarketQuoteDuplicates<T extends {
  shortLabel: string;
  label?: string;
  price?: number | null;
  freshnessState?: string | null;
}>(items: readonly T[]): T[] {
  const usableKeys = new Set(
    items
      .filter(item => !isBlankTickerValue(item.price) && item.freshnessState !== "UNAVAILABLE" && item.freshnessState !== "STALE")
      .flatMap(item => [normalizeTickerKey(item.shortLabel), normalizeTickerKey(item.label ?? "")].filter(Boolean)),
  );
  const seen = new Set<string>();
  const result: T[] = [];
  for (const item of items) {
    const keys = [normalizeTickerKey(item.shortLabel), normalizeTickerKey(item.label ?? "")].filter(Boolean);
    const blank = isBlankTickerValue(item.price) || item.freshnessState === "UNAVAILABLE";
    if (blank && keys.some(key => usableKeys.has(key))) continue;
    const primary = keys[0] ?? item.shortLabel;
    if (seen.has(primary)) continue;
    seen.add(primary);
    result.push(item);
  }
  return result;
}
