import { createHash } from "node:crypto";
import { eq } from "drizzle-orm";
import { verifiedHistoricalFormulaVersions, verifiedHistoricalValidationRuns } from "../drizzle/schema";
import { getDb } from "./db";
import { VERIFIED_CHAMPION_MODEL_VERSION } from "./verifiedHistoricalValidation";

export const VERIFIED_CHAMPION_EVALUATION_PROTOCOL_VERSION = "VERIFIED_CHAMPION_V1_PROTOCOL_20260819_R2";

export const VERIFIED_CHAMPION_LOCKED_PARTITIONS = {
  development: { startMonth: "2023-08", endMonth: "2024-07" },
  validation: { startMonth: "2024-08", endMonth: "2025-07" },
  holdout: { startMonth: "2025-08", endMonth: "2026-07" },
} as const;

export const VERIFIED_CHAMPION_EVENT_DEFINITIONS = {
  equityDrawdown10Within60TradingDays: {
    id: "EQUITY_DRAWDOWN_10_WITHIN_60_TRADING_DAYS",
    instrument: "S&P 500 Price Index (^GSPC)",
    priceField: "daily close",
    lookbackTradingDays: 60,
    thresholdPct: -10,
    onset: "first close in a continuous peak-to-trough episode at or below -10% from the preceding running peak within 60 trading days",
    eventDate: "onset date",
    peakDate: "date of the preceding running peak",
    troughDate: "lowest close before recovery or the data cutoff",
    eventConsolidation: "consecutive qualifying closes belonging to the same unrecovered peak-to-trough episode count as one event",
  },
  volatilityEvent: {
    id: "VIX_SPIKE_PENDING_INDEPENDENT_SOURCE",
    status: "NOT_EVALUATED",
    rationale: "No independent VIX source has been collected in this protocol. It is pre-registered but is not eligible for measurement or inference until an independently sourced VIX daily series is persisted.",
  },
  calmPeriods: {
    id: "CALM_PERIODS",
    definition: "Verified score dates not in a pre-event window, active drawdown event, or post-event recovery window for the registered equity-drawdown definition.",
    preEventWindowTradingDays: 60,
    postEventWindowTradingDays: 20,
  },
  outcomeWindows: {
    horizonsTradingDays: [1, 5, 20, 60],
    censoringRule: "Outcomes begin after the verified month-end score timestamp. Pending horizons remain pending and are excluded from the corresponding metric denominator.",
  },
  pressureBuckets: [
    { label: "LOW_RISK", min: 0, max: 24 },
    { label: "MODERATE_RISK", min: 25, max: 44 },
    { label: "ELEVATED_RISK", min: 45, max: 64 },
    { label: "HIGH_STRESS", min: 65, max: 79 },
    { label: "SYSTEMIC_CRISIS", min: 80, max: 100 },
  ],
  warningRule: {
    pressureThreshold: 45,
    qualifyingRegimes: ["ELEVATED RISK", "HIGH STRESS", "SYSTEMIC CRISIS"],
    leadWindowTradingDays: 60,
    falseAlarm: "a qualifying score with no registered equity-drawdown event onset in the following 60 trading days",
    missedEvent: "a registered equity-drawdown event with no qualifying score in the preceding 60 trading days",
  },
  temporalStability: {
    metric: "lag-1 Pearson autocorrelation of complete monthly scores",
    minimumObservations: 12,
  },
  ablation: {
    status: "SENSITIVITY_ONLY_AFTER_BASELINE_LOCK",
    method: "remove one frozen vector at a time, renormalize the remaining original frozen weights to sum to 1.0, then report correlation and mean absolute difference versus the frozen baseline; no weights, thresholds, or live model behavior are changed",
  },
  lockedMetrics: [
    "score_distribution",
    "regime_distribution",
    "stress_vs_calm_separation",
    "forward_drawdown_by_pressure_bucket",
    "warning_lead_time",
    "false_alarm_count",
    "missed_event_count",
    "temporal_stability",
    "vector_correlation",
    "ablation_after_baseline_lock",
    "walk_forward_by_locked_partition",
  ],
} as const;

function sha256(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

export function validateLockedPartitions() {
  const partitions = Object.values(VERIFIED_CHAMPION_LOCKED_PARTITIONS);
  const ordered = [...partitions].sort((left, right) => left.startMonth.localeCompare(right.startMonth));
  const nonOverlapping = ordered.every((partition, index) => index === 0 || ordered[index - 1]!.endMonth < partition.startMonth);
  const allValid = ordered.every(partition => partition.startMonth <= partition.endMonth);
  return { allValid, nonOverlapping, partitions: ordered };
}

export async function persistPreRegisteredChampionEvaluationProtocol() {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const formula = await db.select().from(verifiedHistoricalFormulaVersions)
    .where(eq(verifiedHistoricalFormulaVersions.modelVersion, VERIFIED_CHAMPION_MODEL_VERSION)).limit(1);
  if (!formula[0]) throw new Error("Frozen Champion formula version is required before protocol registration");
  const validation = validateLockedPartitions();
  if (!validation.allValid || !validation.nonOverlapping) throw new Error("Locked evaluation partitions are invalid");
  const runKey = sha256({ protocol: VERIFIED_CHAMPION_EVALUATION_PROTOCOL_VERSION, formulaVersionId: formula[0].id, definitions: VERIFIED_CHAMPION_EVENT_DEFINITIONS, partitions: VERIFIED_CHAMPION_LOCKED_PARTITIONS });
  await db.insert(verifiedHistoricalValidationRuns).values({
    runKey,
    formulaVersionId: formula[0].id,
    scoringTimestampPolicy: "Frozen monthly score timestamp policy; outcome measurement begins after the score timestamp and uses only completed trading-day horizons.",
    missingDataPolicy: "No fallback score, imputation, interpolation, or score reweighting is permitted. Pending outcomes remain pending and unavailable outcomes remain unavailable.",
    datasetChecksum: sha256({ protocol: VERIFIED_CHAMPION_EVALUATION_PROTOCOL_VERSION, definitions: VERIFIED_CHAMPION_EVENT_DEFINITIONS, partitions: VERIFIED_CHAMPION_LOCKED_PARTITIONS }),
    coverageJson: JSON.stringify({ scoreCoverage: "2023-08 through 2026-07", qualityGate: "REVISED_HISTORICAL due to BAMLH0A0HYM2 source limitation" }),
    partitionJson: JSON.stringify(VERIFIED_CHAMPION_LOCKED_PARTITIONS),
    status: "COMPLETE",
    limitationJson: JSON.stringify({ protocolVersion: VERIFIED_CHAMPION_EVALUATION_PROTOCOL_VERSION, eventDefinitions: VERIFIED_CHAMPION_EVENT_DEFINITIONS, vixStatus: "NOT_EVALUATED_PENDING_INDEPENDENT_SOURCE" }),
  }).onDuplicateKeyUpdate({ set: { runKey } });
  return { runKey, validation };
}
