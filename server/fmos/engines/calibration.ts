// ============================================================
// FMOS Engine 12 — Calibration Engine
// (server/fmos/engines/calibration.ts)
//
// Tracks prediction accuracy over time using Brier scores
// and calibration metrics. Provides the data foundation
// for the Validation Lab page.
//
// The Calibration Engine reads from the existing database
// tables (pressureRuns, outlookHistory) to compute accuracy
// metrics without requiring new data structures.
//
// Key Metrics:
//   - Brier Score: measures probability calibration (0=perfect, 1=worst)
//   - Calibration Error: mean absolute difference between predicted/actual
//   - Transition Accuracy: how often regime transitions were predicted
//   - Direction Accuracy: how often bull/bear direction was correct
//
// Inputs:
//   - Database query results from pressureRuns and outlookHistory
//
// Output: FMOSCalibrationMetrics + per-run accuracy data
// ============================================================

import type { FMOSCalibrationMetrics } from "../types";

// ── Brier Score Calculation ───────────────────────────────────

/**
 * Compute Brier score for a set of probability forecasts.
 * Brier score = (1/N) * Σ(forecast_probability - actual_outcome)²
 *
 * @param forecasts - Array of { probability: 0-1, outcome: 0 or 1 }
 * @returns Brier score (0 = perfect, 1 = worst)
 */
export function computeBrierScore(
  forecasts: Array<{ probability: number; outcome: 0 | 1 }>
): number {
  if (forecasts.length === 0) return 0;
  const sum = forecasts.reduce(
    (s, f) => s + Math.pow(f.probability - f.outcome, 2),
    0
  );
  return Math.round((sum / forecasts.length) * 1000) / 1000;
}

/**
 * Compute calibration error (mean absolute difference between
 * predicted probability and actual frequency).
 *
 * @param forecasts - Array of { probability: 0-1, outcome: 0 or 1 }
 * @param bins      - Number of calibration bins (default: 10)
 */
export function computeCalibrationError(
  forecasts: Array<{ probability: number; outcome: 0 | 1 }>,
  bins = 10
): number {
  if (forecasts.length === 0) return 0;

  const binSize = 1 / bins;
  let totalError = 0;
  let totalBins = 0;

  for (let i = 0; i < bins; i++) {
    const lo = i * binSize;
    const hi = (i + 1) * binSize;
    const inBin = forecasts.filter(f => f.probability >= lo && f.probability < hi);

    if (inBin.length === 0) continue;

    const avgPredicted = inBin.reduce((s, f) => s + f.probability, 0) / inBin.length;
    const actualFreq = inBin.filter(f => f.outcome === 1).length / inBin.length;

    totalError += Math.abs(avgPredicted - actualFreq);
    totalBins++;
  }

  return totalBins > 0 ? Math.round((totalError / totalBins) * 1000) / 1000 : 0;
}

// ── Direction Accuracy ────────────────────────────────────────

/**
 * Compute directional accuracy: how often the predicted direction
 * (bull/bear) matched the actual market direction.
 *
 * @param predictions - Array of { predictedBull: 0-100, actualPositive: boolean }
 */
export function computeDirectionAccuracy(
  predictions: Array<{ predictedBull: number; actualPositive: boolean }>
): number {
  if (predictions.length === 0) return 0;
  const correct = predictions.filter(p =>
    (p.predictedBull > 50 && p.actualPositive) ||
    (p.predictedBull <= 50 && !p.actualPositive)
  ).length;
  return Math.round((correct / predictions.length) * 100);
}

// ── Regime Transition Accuracy ────────────────────────────────

/**
 * Compute how accurately regime transitions were predicted.
 *
 * @param transitions - Array of { predictedProbability: 0-100, actualTransition: boolean }
 */
export function computeTransitionAccuracy(
  transitions: Array<{ predictedProbability: number; actualTransition: boolean }>
): number {
  if (transitions.length === 0) return 0;

  // A transition prediction is "correct" if:
  // - Predicted > 50% AND transition occurred
  // - Predicted <= 50% AND no transition occurred
  const correct = transitions.filter(t =>
    (t.predictedProbability > 50 && t.actualTransition) ||
    (t.predictedProbability <= 50 && !t.actualTransition)
  ).length;

  return Math.round((correct / transitions.length) * 100);
}

// ── Calibration Metrics from Database ────────────────────────

export interface PressureRunRecord {
  id: number;
  overallPressure: number;
  bullProbability?: number;
  bearProbability?: number;
  regime?: string;
  snapshotAt: Date;
  engineVersion?: string;
}

export interface OutlookHistoryRecord {
  id: number;
  symbol: string;
  direction: string;
  confidence: number;
  outlookScore: number;
  pressureIndex: number;
  snapshotAt: Date;
}

/**
 * Compute calibration metrics from historical database records.
 * This is used by the Validation Lab page.
 *
 * Note: "actual outcomes" are approximated by comparing predictions
 * to subsequent pressure readings (forward-looking comparison).
 *
 * @param pressureRuns - Historical pressure run records
 * @param outlookHistory - Historical outlook records
 */
export function computeCalibrationMetrics(
  pressureRuns: PressureRunRecord[],
  outlookHistory: OutlookHistoryRecord[]
): FMOSCalibrationMetrics {
  if (pressureRuns.length < 2) {
    return {
      brierScore: 0,
      calibrationError: 0,
      falsePositiveRate: 0,
      falseNegativeRate: 0,
      transitionAccuracy: 0,
      probabilityReliability: 0,
      sampleSize: 0,
      evaluationPeriod: {
        from: new Date().toISOString(),
        to: new Date().toISOString(),
      },
    };
  }

  // Sort by date
  const sorted = [...pressureRuns].sort(
    (a, b) => new Date(a.snapshotAt).getTime() - new Date(b.snapshotAt).getTime()
  );

  // Build forecasts: use each run's bull probability as the forecast,
  // and compare to whether the NEXT run's pressure was lower (bull outcome)
  const forecasts: Array<{ probability: number; outcome: 0 | 1 }> = [];
  const directionPredictions: Array<{ predictedBull: number; actualPositive: boolean }> = [];
  const transitionPredictions: Array<{ predictedProbability: number; actualTransition: boolean }> = [];

  for (let i = 0; i < sorted.length - 1; i++) {
    const current = sorted[i]!;
    const next = sorted[i + 1]!;

    const bullProb = current.bullProbability ?? (100 - current.overallPressure);
    const bullProbNormalized = bullProb / 100;

    // Outcome: did pressure decrease (bullish) or increase (bearish)?
    const pressureDecreased = next.overallPressure < current.overallPressure;
    const outcome: 0 | 1 = pressureDecreased ? 1 : 0;

    forecasts.push({ probability: bullProbNormalized, outcome });
    directionPredictions.push({ predictedBull: bullProb, actualPositive: pressureDecreased });

    // Transition: did regime change?
    const regimeChanged = current.regime !== next.regime;
    // Approximate transition probability from pressure proximity to thresholds
    const thresholds = [25, 45, 65, 80];
    const minDist = Math.min(...thresholds.map(t => Math.abs(current.overallPressure - t)));
    const transitionProb = Math.max(0, 30 - minDist * 2);
    transitionPredictions.push({ predictedProbability: transitionProb, actualTransition: regimeChanged });
  }

  const brierScore = computeBrierScore(forecasts);
  const calibrationError = computeCalibrationError(forecasts);
  const directionAccuracy = computeDirectionAccuracy(directionPredictions);
  const transitionAccuracy = computeTransitionAccuracy(transitionPredictions);

  // False positive rate: predicted bull but was bear
  const bullPredictions = directionPredictions.filter(p => p.predictedBull > 50);
  const falsePositiveRate = bullPredictions.length > 0
    ? Math.round(bullPredictions.filter(p => !p.actualPositive).length / bullPredictions.length * 100)
    : 0;

  // False negative rate: predicted bear but was bull
  const bearPredictions = directionPredictions.filter(p => p.predictedBull <= 50);
  const falseNegativeRate = bearPredictions.length > 0
    ? Math.round(bearPredictions.filter(p => p.actualPositive).length / bearPredictions.length * 100)
    : 0;

  // Probability reliability (inverse of calibration error, scaled to 0-100)
  const probabilityReliability = Math.round(Math.max(0, 100 - calibrationError * 100));

  const dates = sorted.map(r => new Date(r.snapshotAt).getTime());
  const minDate = new Date(Math.min(...dates)).toISOString();
  const maxDate = new Date(Math.max(...dates)).toISOString();

  return {
    brierScore,
    calibrationError,
    falsePositiveRate,
    falseNegativeRate,
    transitionAccuracy,
    probabilityReliability,
    sampleSize: forecasts.length,
    evaluationPeriod: { from: minDate, to: maxDate },
  };
}

// ── Calibration Chart Data ────────────────────────────────────

export interface CalibrationChartPoint {
  /** Predicted probability bucket (0–100) */
  predictedBucket: number;
  /** Actual frequency in this bucket (0–100) */
  actualFrequency: number;
  /** Number of predictions in this bucket */
  count: number;
}

/**
 * Generate calibration chart data for the Validation Lab.
 * Returns points for a reliability diagram (predicted vs actual).
 */
export function generateCalibrationChartData(
  pressureRuns: PressureRunRecord[]
): CalibrationChartPoint[] {
  const sorted = [...pressureRuns].sort(
    (a, b) => new Date(a.snapshotAt).getTime() - new Date(b.snapshotAt).getTime()
  );

  const forecasts: Array<{ probability: number; outcome: 0 | 1 }> = [];
  for (let i = 0; i < sorted.length - 1; i++) {
    const current = sorted[i]!;
    const next = sorted[i + 1]!;
    const bullProb = current.bullProbability ?? (100 - current.overallPressure);
    const outcome: 0 | 1 = next.overallPressure < current.overallPressure ? 1 : 0;
    forecasts.push({ probability: bullProb / 100, outcome });
  }

  const buckets = 10;
  const bucketSize = 1 / buckets;
  const points: CalibrationChartPoint[] = [];

  for (let i = 0; i < buckets; i++) {
    const lo = i * bucketSize;
    const hi = (i + 1) * bucketSize;
    const inBucket = forecasts.filter(f => f.probability >= lo && f.probability < hi);

    if (inBucket.length === 0) continue;

    const actualFreq = inBucket.filter(f => f.outcome === 1).length / inBucket.length;
    points.push({
      predictedBucket: Math.round((lo + hi) / 2 * 100),
      actualFrequency: Math.round(actualFreq * 100),
      count: inBucket.length,
    });
  }

  return points;
}
