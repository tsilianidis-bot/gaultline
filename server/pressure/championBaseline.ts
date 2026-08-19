/**
 * FAULTLINE Champion Baseline — audit-only reproducibility utilities.
 *
 * This module intentionally does NOT power production scoring. It records the
 * observed V1 composite contract and assesses whether persisted historical
 * records contain enough fields to reproduce that contract honestly.
 */

export const CHAMPION_BASELINE_VERSION = "v1-observed-2026-08-18";

export const CHAMPION_VECTOR_WEIGHTS = {
  liquidityStress: 0.20,
  creditContagion: 0.20,
  volatilityRegime: 0.15,
  macroSensitivity: 0.20,
  marketBreadth: 0.10,
  aiBubble: 0.15,
} as const;

export const CHAMPION_REGIME_THRESHOLDS = [
  { minimum: 80, regime: "SYSTEMIC CRISIS", level: "Critical" },
  { minimum: 65, regime: "HIGH STRESS", level: "High" },
  { minimum: 45, regime: "ELEVATED RISK", level: "Elevated" },
  { minimum: 25, regime: "MODERATE RISK", level: "Moderate" },
  { minimum: 0, regime: "LOW RISK", level: "Low" },
] as const;

export type ChampionStoredVectorSnapshot = {
  month: string;
  overallPressure: number;
  regime: string;
  liquidityStress: number | null;
  creditContagion: number | null;
  volatilityRegime: number | null;
  macroSensitivity: number | null;
  marketBreadth: number | null;
  aiBubble: number | null;
  /** Stored raw values available in the legacy monthly record. */
  baaSpread?: number | null;
  hySpreadProxy?: number | null;
  tsy10y?: number | null;
  tsy2y?: number | null;
  fedfunds?: number | null;
  cpiYoy?: number | null;
  unemployment?: number | null;
};

export type ChampionRecreationResult = {
  baselineVersion: typeof CHAMPION_BASELINE_VERSION;
  month: string;
  storedScore: number;
  recreatedScore: number | null;
  scoreDifference: number | null;
  vectorComplete: boolean;
  rawInputRecreationEligible: boolean;
  missingVectorFields: string[];
  missingRawInputs: string[];
  verdict: "RECONCILED" | "VECTOR_GAP" | "RAW_RECREATION_NOT_DEFENSIBLE";
};

const REQUIRED_VECTOR_FIELDS = Object.keys(CHAMPION_VECTOR_WEIGHTS) as Array<keyof typeof CHAMPION_VECTOR_WEIGHTS>;

/**
 * Recreate only the documented weighted composite from stored vector scores.
 * This is not a point-in-time raw-data backtest: it deliberately refuses to
 * claim raw-input reproducibility when required source fields or vintages are
 * absent from the monthly record.
 */
export function recreateChampionFromStoredVectors(
  record: ChampionStoredVectorSnapshot,
): ChampionRecreationResult {
  const missingVectorFields = REQUIRED_VECTOR_FIELDS.filter((field) => record[field] === null || record[field] === undefined);
  const missingRawInputs = [
    record.hySpreadProxy === null || record.hySpreadProxy === undefined ? "hySpreadProxy" : null,
    record.tsy10y === null || record.tsy10y === undefined ? "tsy10y" : null,
    record.tsy2y === null || record.tsy2y === undefined ? "tsy2y" : null,
    record.fedfunds === null || record.fedfunds === undefined ? "fedfunds" : null,
    record.cpiYoy === null || record.cpiYoy === undefined ? "cpiYoy" : null,
    record.unemployment === null || record.unemployment === undefined ? "unemployment" : null,
    // V1 production vector functions also require SOFR and PPI inputs; legacy
    // monthly history does not persist them or source vintage/release dates.
    "sofr",
    "ppiYoy",
    "sourceVintages",
  ].filter((value): value is string => Boolean(value));

  if (missingVectorFields.length > 0) {
    return {
      baselineVersion: CHAMPION_BASELINE_VERSION,
      month: record.month,
      storedScore: record.overallPressure,
      recreatedScore: null,
      scoreDifference: null,
      vectorComplete: false,
      rawInputRecreationEligible: false,
      missingVectorFields,
      missingRawInputs,
      verdict: "VECTOR_GAP",
    };
  }

  const recreatedScore = Math.round(
    REQUIRED_VECTOR_FIELDS.reduce(
      (total, field) => total + (record[field] as number) * CHAMPION_VECTOR_WEIGHTS[field],
      0,
    ),
  );

  return {
    baselineVersion: CHAMPION_BASELINE_VERSION,
    month: record.month,
    storedScore: record.overallPressure,
    recreatedScore,
    scoreDifference: recreatedScore - record.overallPressure,
    vectorComplete: true,
    rawInputRecreationEligible: false,
    missingVectorFields: [],
    missingRawInputs,
    verdict: missingRawInputs.length === 0 ? "RECONCILED" : "RAW_RECREATION_NOT_DEFENSIBLE",
  };
}

export function classifyChampionScore(score: number) {
  return CHAMPION_REGIME_THRESHOLDS.find((threshold) => score >= threshold.minimum)!;
}

export function summarizeChampionRecreation(records: ChampionStoredVectorSnapshot[]) {
  const results = records.map(recreateChampionFromStoredVectors);
  const reconciled = results.filter((result) => result.recreatedScore !== null && result.scoreDifference === 0);
  const vectorGaps = results.filter((result) => result.verdict === "VECTOR_GAP");
  const rawNotDefensible = results.filter((result) => result.verdict === "RAW_RECREATION_NOT_DEFENSIBLE");

  return {
    baselineVersion: CHAMPION_BASELINE_VERSION,
    recordCount: results.length,
    exactCompositeReconciliations: reconciled.length,
    vectorGapCount: vectorGaps.length,
    rawRecreationNotDefensibleCount: rawNotDefensible.length,
    maxAbsoluteDifference: Math.max(0, ...results.map((result) => Math.abs(result.scoreDifference ?? 0))),
    results,
  };
}
