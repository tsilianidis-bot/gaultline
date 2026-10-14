// FL-PI-v2-research-0 — locked pre-specification constants (SHADOW ONLY, non-public).
// Source of truth: docs/pressure/v2/PRESPEC_V2.md (sha256 below). Nothing here may be
// changed without a NEW spec id + new pre-registration (see docs/pressure/v2/ARCHITECTURE.md).
export const V2_SPEC_ID = "FL-PI-v2-research-0" as const;
export const V2_SPEC_SHA256 = "3ce5661ed0929fb391aca67329a8d339ecea54ee2edbb225f2e99c8569910b82" as const;
/** Implementation version of the shadow code (not the methodology). */
export const V2_IMPLEMENTATION_VERSION = "v2-shadow-impl-1.0.0" as const;
export const V2_REFERENCE_FILE = "v2-reference-2026-09-11.json" as const;

export const V2_PILLARS = ["credit", "funding", "vol", "mkt", "macro"] as const;
export type V2Pillar = (typeof V2_PILLARS)[number];

/** Minimum history before a pillar is usable (spec: ≥5 years). Implemented as in the research build: 5×365 days. */
export const V2_MIN_HISTORY_DAYS = 5 * 365;
/** Daily-series staleness: value older than 10 calendar days → pillar unavailable (research build rule). */
export const V2_MAX_STALENESS_DAYS = 10;
/** Weekly Sahm-gap pool must hold ≥260 point-in-time values (research build rule). */
export const V2_MIN_MACRO_POOL = 260;
/** Composite requires ≥3 available pillars, else UNAVAILABLE (fail closed). */
export const V2_MIN_PILLARS = 3;
/** Bands: existing labels and cut-points kept unchanged for comparability. */
export const V2_BAND_CUTS = { moderate: 25, elevated: 45, high: 65, crisis: 80 } as const;

/** Benchmarks and their locked thresholds (spec §Event definitions). */
export const V2_BENCHMARK_THRESHOLDS = {
  v2: 45,
  vix: 25,
  baa10y: 3.0,
  trendBelow200dSma: true,
  ewz: 1.0,
} as const;
