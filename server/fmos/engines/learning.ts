// ============================================================
// FMOS Engine 13 — Learning Engine
// (server/fmos/engines/learning.ts)
//
// Tracks what worked and what didn't. Identifies systematic
// biases in the probability engine and suggests adjustments.
//
// The Learning Engine uses the Calibration Engine's metrics
// to detect patterns in prediction errors and recommend
// adjustments to the probability calculation.
//
// Key Functions:
//   - detectSystematicBias(): finds consistent over/under-estimation
//   - computeRegimeBias(): measures accuracy per regime
//   - suggestAdjustments(): recommends probability recalibration
//
// Inputs:
//   - FMOSCalibrationMetrics (from Calibration Engine)
//   - Historical pressure run records
//
// Output: FMOSLearningInsights
// ============================================================

import type { FMOSCalibrationMetrics } from "../types";
import type { PressureRunRecord } from "./calibration";

// ── Learning Insights Types ───────────────────────────────────

export interface FMOSBiasDetection {
  /** Type of bias detected */
  biasType: "overconfident" | "underconfident" | "bullish_bias" | "bearish_bias" | "none";
  /** Severity of the bias (0–100) */
  severity: number;
  /** Human-readable description */
  description: string;
  /** Suggested adjustment to probability formula */
  suggestedAdjustment: string;
}

export interface FMOSRegimeAccuracy {
  /** Regime name */
  regime: string;
  /** Number of predictions in this regime */
  count: number;
  /** Direction accuracy in this regime (0–100%) */
  directionAccuracy: number;
  /** Whether this regime has a systematic bias */
  hasBias: boolean;
  /** Bias description */
  biasDescription: string;
}

export interface FMOSLearningInsights {
  /** Overall bias detection */
  bias: FMOSBiasDetection;
  /** Per-regime accuracy breakdown */
  regimeAccuracy: FMOSRegimeAccuracy[];
  /** Whether the model is well-calibrated */
  isWellCalibrated: boolean;
  /** Calibration grade (A, B, C, D, F) */
  calibrationGrade: "A" | "B" | "C" | "D" | "F";
  /** Key insights from the learning engine */
  insights: string[];
  /** Recommended improvements */
  recommendations: string[];
  /** Sample size (number of predictions evaluated) */
  sampleSize: number;
}

// ── Bias Detection ────────────────────────────────────────────

function detectSystematicBias(
  metrics: FMOSCalibrationMetrics
): FMOSBiasDetection {
  const { falsePositiveRate, falseNegativeRate, brierScore, calibrationError } = metrics;

  // Overconfident: Brier score high, calibration error high
  if (brierScore > 0.35 && calibrationError > 0.15) {
    return {
      biasType: "overconfident",
      severity: Math.round(Math.min(brierScore * 100, 100)),
      description: "The model is overconfident — probability estimates are too extreme (too close to 0 or 100).",
      suggestedAdjustment: "Apply probability shrinkage: move all probabilities 10% toward 50% to reduce overconfidence.",
    };
  }

  // Bullish bias: high false positive rate
  if (falsePositiveRate > 40 && falsePositiveRate > falseNegativeRate + 15) {
    return {
      biasType: "bullish_bias",
      severity: Math.round(falsePositiveRate * 0.8),
      description: `The model has a bullish bias — predicts bull ${falsePositiveRate}% of the time when conditions are actually bearish.`,
      suggestedAdjustment: "Reduce bull probability by 5–10 percentage points when pressure is above 45.",
    };
  }

  // Bearish bias: high false negative rate
  if (falseNegativeRate > 40 && falseNegativeRate > falsePositiveRate + 15) {
    return {
      biasType: "bearish_bias",
      severity: Math.round(falseNegativeRate * 0.8),
      description: `The model has a bearish bias — predicts bear ${falseNegativeRate}% of the time when conditions are actually bullish.`,
      suggestedAdjustment: "Increase bull probability by 5–10 percentage points when pressure is below 40.",
    };
  }

  // Underconfident: Brier score low but calibration error moderate
  if (brierScore < 0.15 && calibrationError > 0.10) {
    return {
      biasType: "underconfident",
      severity: Math.round(calibrationError * 100),
      description: "The model is underconfident — probability estimates cluster too close to 50%, missing strong signals.",
      suggestedAdjustment: "Amplify probability signals: stretch probabilities away from 50% by 10–15%.",
    };
  }

  return {
    biasType: "none",
    severity: 0,
    description: "No systematic bias detected. The model appears well-calibrated.",
    suggestedAdjustment: "No adjustment needed.",
  };
}

// ── Regime Accuracy ───────────────────────────────────────────

function computeRegimeAccuracy(
  pressureRuns: PressureRunRecord[]
): FMOSRegimeAccuracy[] {
  if (pressureRuns.length < 2) return [];

  const sorted = [...pressureRuns].sort(
    (a, b) => new Date(a.snapshotAt).getTime() - new Date(b.snapshotAt).getTime()
  );

  // Group by regime
  const regimeGroups: Record<string, Array<{ predictedBull: number; actualPositive: boolean }>> = {};

  for (let i = 0; i < sorted.length - 1; i++) {
    const current = sorted[i]!;
    const next = sorted[i + 1]!;
    const regime = current.regime ?? "UNKNOWN";
    const bullProb = current.bullProbability ?? (100 - current.overallPressure);
    const actualPositive = next.overallPressure < current.overallPressure;

    if (!regimeGroups[regime]) regimeGroups[regime] = [];
    regimeGroups[regime]!.push({ predictedBull: bullProb, actualPositive });
  }

  return Object.entries(regimeGroups).map(([regime, predictions]) => {
    const correct = predictions.filter(p =>
      (p.predictedBull > 50 && p.actualPositive) ||
      (p.predictedBull <= 50 && !p.actualPositive)
    ).length;
    const directionAccuracy = Math.round((correct / predictions.length) * 100);

    const bullishPredictions = predictions.filter(p => p.predictedBull > 50);
    const bullishFalsePositiveRate = bullishPredictions.length > 0
      ? bullishPredictions.filter(p => !p.actualPositive).length / bullishPredictions.length
      : 0;

    const hasBias = bullishFalsePositiveRate > 0.4 || directionAccuracy < 50;
    const biasDescription = hasBias
      ? `${directionAccuracy < 50 ? "Below-chance accuracy" : "High false positive rate"} in ${regime} regime`
      : "No significant bias";

    return {
      regime,
      count: predictions.length,
      directionAccuracy,
      hasBias,
      biasDescription,
    };
  }).sort((a, b) => b.count - a.count);
}

// ── Calibration Grade ─────────────────────────────────────────

function computeCalibrationGrade(
  metrics: FMOSCalibrationMetrics
): "A" | "B" | "C" | "D" | "F" {
  const { brierScore, calibrationError, transitionAccuracy } = metrics;

  // Weighted score: lower Brier + lower calibration error + higher transition accuracy
  const brierGrade = brierScore < 0.10 ? 100 : brierScore < 0.15 ? 85 : brierScore < 0.20 ? 70 : brierScore < 0.25 ? 55 : 30;
  const calibGrade = calibrationError < 0.05 ? 100 : calibrationError < 0.10 ? 85 : calibrationError < 0.15 ? 70 : calibrationError < 0.20 ? 55 : 30;
  const transGrade = transitionAccuracy > 70 ? 100 : transitionAccuracy > 60 ? 85 : transitionAccuracy > 50 ? 70 : transitionAccuracy > 40 ? 55 : 30;

  const compositeScore = brierGrade * 0.4 + calibGrade * 0.4 + transGrade * 0.2;

  if (compositeScore >= 90) return "A";
  if (compositeScore >= 75) return "B";
  if (compositeScore >= 60) return "C";
  if (compositeScore >= 45) return "D";
  return "F";
}

// ── Main Learning Engine Function ─────────────────────────────

/**
 * Analyze prediction history and generate learning insights.
 *
 * @param metrics      - Output from computeCalibrationMetrics()
 * @param pressureRuns - Historical pressure run records
 */
export function computeLearningInsights(
  metrics: FMOSCalibrationMetrics,
  pressureRuns: PressureRunRecord[]
): FMOSLearningInsights {
  const bias = detectSystematicBias(metrics);
  const regimeAccuracy = computeRegimeAccuracy(pressureRuns);
  const calibrationGrade = computeCalibrationGrade(metrics);
  const isWellCalibrated = calibrationGrade === "A" || calibrationGrade === "B";

  // Generate insights
  const insights: string[] = [];

  if (metrics.sampleSize < 10) {
    insights.push("Insufficient data for reliable calibration assessment — need at least 10 predictions");
  } else {
    insights.push(`Evaluated ${metrics.sampleSize} predictions over ${metrics.evaluationPeriod.from.split("T")[0]} to ${metrics.evaluationPeriod.to.split("T")[0]}`);
  }

  if (metrics.brierScore > 0) {
    insights.push(`Brier score: ${metrics.brierScore} (${metrics.brierScore < 0.20 ? "good" : metrics.brierScore < 0.30 ? "fair" : "needs improvement"})`);
  }

  if (metrics.transitionAccuracy > 0) {
    insights.push(`Regime transition accuracy: ${metrics.transitionAccuracy}% (${metrics.transitionAccuracy > 60 ? "above chance" : "near chance"})`);
  }

  if (bias.biasType !== "none") {
    insights.push(`Systematic bias detected: ${bias.description}`);
  }

  // Find worst-performing regime
  const worstRegime = regimeAccuracy.find(r => r.hasBias && r.count >= 3);
  if (worstRegime) {
    insights.push(`${worstRegime.regime} regime shows ${worstRegime.directionAccuracy}% accuracy — ${worstRegime.biasDescription}`);
  }

  // Recommendations
  const recommendations: string[] = [];

  if (bias.biasType !== "none") {
    recommendations.push(bias.suggestedAdjustment);
  }

  if (metrics.sampleSize < 30) {
    recommendations.push("Accumulate more prediction history for reliable calibration assessment");
  }

  if (metrics.calibrationError > 0.15) {
    recommendations.push("Consider smoothing probability estimates to reduce calibration error");
  }

  if (recommendations.length === 0) {
    recommendations.push("Continue monitoring — model appears well-calibrated");
  }

  return {
    bias,
    regimeAccuracy,
    isWellCalibrated,
    calibrationGrade,
    insights,
    recommendations,
    sampleSize: metrics.sampleSize,
  };
}
