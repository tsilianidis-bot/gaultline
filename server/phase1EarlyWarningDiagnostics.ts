import { asc, eq } from "drizzle-orm";
import { reconstructedHistoricalScores } from "../drizzle/schema";
import { getDb } from "./db";
import { detectEquityDrawdownEvents } from "./reconstructedChampionMetrics";
import { getDailyBarsForPeriod, type YahooDailyBar } from "./yahooProxy";

const VECTOR_KEYS = [
  "liquidityStress",
  "creditContagion",
  "volatilityRegime",
  "macroSensitivity",
  "marketBreadth",
  "aiBubble",
] as const;

type VectorKey = (typeof VECTOR_KEYS)[number];

export interface Phase1MonthlyScore {
  scoreMonth: string;
  scoreTimestamp: Date;
  overallPressure: number;
  vectors: Record<VectorKey, number>;
}

export interface Phase1DiagnosticEvent {
  startDate: string;
  troughDate: string;
  drawdownPct: number;
  warningStartDate: string;
  compositeQualifiedMonths: Array<{ month: string; score: number }>;
  compositeWarned: boolean;
  peakVectorScores: Record<VectorKey, number | null>;
  elevatedVectors: VectorKey[];
}

function isoDate(value: Date) {
  return value.toISOString().slice(0, 10);
}

export function twoMonthsBefore(date: string) {
  const value = new Date(`${date}T00:00:00.000Z`);
  value.setUTCMonth(value.getUTCMonth() - 2);
  return value.toISOString().slice(0, 10);
}

export function scoreDate(score: Phase1MonthlyScore) {
  return isoDate(score.scoreTimestamp);
}

export function analyzePreEventWindow(
  event: { startDate: string; troughDate: string; drawdownPct: number },
  scores: Phase1MonthlyScore[],
  compositeWarningThreshold = 45,
  vectorElevationThreshold = 45,
): Phase1DiagnosticEvent {
  const warningStartDate = twoMonthsBefore(event.startDate);
  const window = scores.filter(score => {
    const date = scoreDate(score);
    return date >= warningStartDate && date <= event.startDate;
  });
  const compositeQualifiedMonths = window
    .filter(score => score.overallPressure >= compositeWarningThreshold)
    .map(score => ({ month: score.scoreMonth, score: score.overallPressure }));
  const peakVectorScores = Object.fromEntries(
    VECTOR_KEYS.map(key => [key, window.length ? Math.max(...window.map(score => score.vectors[key])) : null]),
  ) as Record<VectorKey, number | null>;
  const elevatedVectors = VECTOR_KEYS.filter(key => (peakVectorScores[key] ?? -Infinity) >= vectorElevationThreshold);

  return {
    ...event,
    warningStartDate,
    compositeQualifiedMonths,
    compositeWarned: compositeQualifiedMonths.length > 0,
    peakVectorScores,
    elevatedVectors,
  };
}

export function summarizeDiagnosticEvents(events: Phase1DiagnosticEvent[]) {
  const misses = events.filter(event => !event.compositeWarned);
  const vectorElevationsInMisses = Object.fromEntries(
    VECTOR_KEYS.map(key => [key, misses.filter(event => (event.peakVectorScores[key] ?? -Infinity) >= 45).length]),
  ) as Record<VectorKey, number>;
  return {
    eventCount: events.length,
    compositeWarnedCount: events.filter(event => event.compositeWarned).length,
    compositeMissedCount: misses.length,
    compositeWarningRatePct: events.length ? (events.filter(event => event.compositeWarned).length / events.length) * 100 : null,
    vectorElevationsInMisses,
  };
}

/**
 * Read-only Phase 1 diagnostic. This has no production route, does not persist
 * data, and may not be used to tune weights or promote V3-H.
 */
export async function runPhase1EarlyWarningDiagnostics() {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const scoreRows = await db
    .select()
    .from(reconstructedHistoricalScores)
    .where(eq(reconstructedHistoricalScores.scoreStatus, "COMPLETE"))
    .orderBy(asc(reconstructedHistoricalScores.scoreTimestamp));
  const scores: Phase1MonthlyScore[] = scoreRows.map(row => ({
    scoreMonth: row.scoreMonth,
    scoreTimestamp: row.scoreTimestamp,
    overallPressure: row.overallPressure!,
    vectors: JSON.parse(row.vectorScoresJson) as Record<VectorKey, number>,
  }));
  if (!scores.length) throw new Error("No complete reconstructed scores available");

  const dailyBars = await getDailyBarsForPeriod("^GSPC", "1999-12-01", "2026-12-31");
  if (dailyBars.length < 1_000) {
    throw new Error(`Daily S&P 500 source insufficient for diagnostics: ${dailyBars.length} bars`);
  }
  const events = detectEquityDrawdownEvents(dailyBars as YahooDailyBar[])
    .filter(event => event.startDate >= isoDate(scores[0]!.scoreTimestamp) && event.startDate <= isoDate(scores.at(-1)!.scoreTimestamp))
    .map(event => analyzePreEventWindow(event, scores));

  return {
    diagnosticVersion: "PHASE_1_EARLY_WARNING_DIAGNOSTIC_V1",
    datasetTier: "RECONSTRUCTED_HISTORICAL_RESEARCH_HISTORY",
    observedAt: new Date().toISOString(),
    policy: {
      compositeWarningThreshold: 45,
      preEventWindow: "two calendar months before registered event start through event start",
      vectorElevationThreshold: 45,
      eventDefinition: "local 20-trading-day high followed by >=10% close drawdown within 60 trading days",
      classification: "descriptive diagnostic only; not a candidate-warning or confirmation engine",
    },
    events,
    summary: summarizeDiagnosticEvents(events),
    leadIndicatorAssessment: {
      conclusion: "INCONCLUSIVE",
      reason: "Vector elevation before composite misses can identify descriptive divergence but does not establish independent predictive usefulness, lead time, calibration, or a deployable early-warning rule.",
      macroSensitivityFourToEightWeeks: {
        status: "NOT_SUBSTANTIATED",
        reason: "The reconstructed monthly score cadence and revised/proxy inputs cannot test an exact 4–8-week real-time lead claim. No registered macro event/horizon calibration is available.",
      },
    },
    constraints: [
      "No outcomes, legacy values, or event results enter reconstructed score calculation.",
      "The score tier is reconstructed revised/proxy research, not point-in-time evidence.",
      "This diagnostic cannot upgrade the protected INCONCLUSIVE validation verdict.",
      "V3-H is excluded and remains shadow-only.",
    ],
  };
}
