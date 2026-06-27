// ============================================================
// FMOS Engine 4 — Regime Engine
// (server/fmos/engines/regime.ts)
//
// Creates a probabilistic regime classification model.
// Does NOT force binary labels — displays confidence,
// stability, transition risk, and alternative scenarios.
//
// This engine REPLACES the two competing regime classification
// systems that existed in pressure/engine.ts and diagnosticAI.ts.
// Both systems are now unified here.
//
// Inputs:
//   - FaultlinePressureOutput (from pressure/engine.ts)
//   - FMOSMarketDNA (from Market DNA Engine)
//
// Output: FMOSRegimeOutput
// ============================================================

import { clamp, classifyPressureLevel, classifyRegimeLabel } from "../utils";
import type { FaultlinePressureOutput } from "../../pressure/engine";
import type { FMOSMarketDNA, FMOSRegimeOutput } from "../types";

// ── Helper ────────────────────────────────────────────────────

function getVec(pressure: FaultlinePressureOutput, id: string, fallback = 30): number {
  return pressure.vectors.find(v => v.id === id)?.score ?? fallback;
}

// ── Regime Stability ──────────────────────────────────────────

/**
 * Compute regime stability (0–100, higher = more stable).
 * A regime is stable when pressure is consistent across vectors
 * and not showing rapid change.
 */
function computeRegimeStability(pressure: FaultlinePressureOutput): number {
  const vectors = pressure.vectors;
  if (vectors.length === 0) return 50;

  // Stability = inverse of variance across vector scores
  const scores = vectors.map(v => v.score);
  const mean = scores.reduce((s, x) => s + x, 0) / scores.length;
  const variance = scores.reduce((s, x) => s + Math.pow(x - mean, 2), 0) / scores.length;
  const stdDev = Math.sqrt(variance);

  // High std dev = unstable (vectors diverging)
  // Low std dev = stable (vectors aligned)
  const stabilityFromVariance = clamp(Math.round(100 - stdDev * 1.5));

  // Also check how many vectors are "rising" (trend = deteriorating)
  const risingCount = vectors.filter(v => v.trend === "rising").length;
  const risingPenalty = Math.round((risingCount / vectors.length) * 30);

  return clamp(stabilityFromVariance - risingPenalty);
}

// ── Transition Risk ───────────────────────────────────────────

/**
 * Compute transition risk (0–100, higher = more likely to transition).
 * High transition risk when multiple vectors are at inflection points.
 */
function computeTransitionRisk(
  pressure: FaultlinePressureOutput,
  stability: number
): number {
  const p = pressure.overallPressure;

  // Transition risk is highest at regime boundaries
  // (pressure near 25, 45, 65, 80 — the regime thresholds)
  const thresholds = [25, 45, 65, 80];
  const minDistToThreshold = Math.min(...thresholds.map(t => Math.abs(p - t)));
  const boundaryRisk = clamp(Math.round((15 - minDistToThreshold) * 5));

  // Rising vectors increase transition risk
  const risingVectors = pressure.vectors.filter(v => v.trend === "rising").length;
  const trendRisk = Math.round((risingVectors / Math.max(pressure.vectors.length, 1)) * 40);

  // Inverse of stability
  const instabilityRisk = clamp(100 - stability);

  return clamp(Math.round(
    boundaryRisk * 0.3 +
    trendRisk * 0.4 +
    instabilityRisk * 0.3
  ));
}

// ── Alternative Scenarios ─────────────────────────────────────

function computeAlternativeScenarios(
  currentRegime: string,
  pressure: FaultlinePressureOutput,
  transitionRisk: number
): Array<{ regime: string; probability: number; trigger: string }> {
  const p = pressure.overallPressure;
  const liquidityScore = getVec(pressure, "liquidity-stress");
  const creditScore = getVec(pressure, "credit-contagion");

  const scenarios: Array<{ regime: string; probability: number; trigger: string }> = [];

  if (p < 45) {
    // Low pressure: main risk is deterioration
    scenarios.push({
      regime: "ELEVATED RISK",
      probability: clamp(Math.round(transitionRisk * 0.6)),
      trigger: "Credit spread widening or liquidity deterioration",
    });
    scenarios.push({
      regime: "MODERATE RISK",
      probability: clamp(Math.round(transitionRisk * 0.3)),
      trigger: "Macro data softening without credit stress",
    });
  } else if (p < 65) {
    // Moderate pressure: could go either way
    scenarios.push({
      regime: "HIGH STRESS",
      probability: clamp(Math.round(transitionRisk * 0.5)),
      trigger: "Credit event or liquidity shock",
    });
    scenarios.push({
      regime: "LOW RISK",
      probability: clamp(Math.round(transitionRisk * 0.3)),
      trigger: "Fed intervention or credit conditions improving",
    });
  } else {
    // High pressure: main hope is improvement
    scenarios.push({
      regime: "ELEVATED RISK",
      probability: clamp(Math.round(transitionRisk * 0.5)),
      trigger: "Policy response reduces credit stress",
    });
    scenarios.push({
      regime: "SYSTEMIC CRISIS",
      probability: clamp(Math.round(
        (creditScore > 70 ? 20 : 10) +
        (liquidityScore > 70 ? 20 : 10)
      )),
      trigger: "Credit contagion accelerates or liquidity freeze",
    });
  }

  // Remove current regime from alternatives
  return scenarios
    .filter(s => s.regime !== currentRegime)
    .sort((a, b) => b.probability - a.probability)
    .slice(0, 3);
}

// ── Regime Description ────────────────────────────────────────

function buildRegimeDescription(
  regime: string,
  pressure: FaultlinePressureOutput,
  stability: number
): string {
  const p = pressure.overallPressure;
  const stabilityLabel = stability >= 70 ? "stable" : stability >= 40 ? "moderately stable" : "unstable";

  const regimeDescriptions: Record<string, string> = {
    "LOW RISK": `Market conditions are favorable. Systemic pressure is low at ${p}/100, with credit and liquidity conditions benign. The regime is ${stabilityLabel}.`,
    "MODERATE RISK": `Market conditions are cautionary. Systemic pressure at ${p}/100 indicates building headwinds. Some vectors are elevated but no systemic stress. The regime is ${stabilityLabel}.`,
    "ELEVATED RISK": `Market conditions are stressed. Systemic pressure at ${p}/100 indicates meaningful risk of further deterioration. Multiple vectors are elevated. The regime is ${stabilityLabel}.`,
    "HIGH STRESS": `Market conditions are significantly stressed. Systemic pressure at ${p}/100 indicates high risk of cascade. Credit and liquidity conditions are deteriorating. The regime is ${stabilityLabel}.`,
    "SYSTEMIC CRISIS": `Market conditions are at crisis level. Systemic pressure at ${p}/100 indicates multiple stress vectors converging. Capital preservation is the priority. The regime is ${stabilityLabel}.`,
  };

  return regimeDescriptions[regime] ?? `Systemic pressure at ${p}/100. The regime is ${stabilityLabel}.`;
}

// ── Main Regime Engine Function ───────────────────────────────

/**
 * Compute the current market regime with full probabilistic context.
 *
 * @param pressure - Output from calculateFaultlinePressure()
 * @param dna      - Output from computeMarketDNA() (optional)
 */
export function computeRegime(
  pressure: FaultlinePressureOutput,
  dna?: FMOSMarketDNA
): FMOSRegimeOutput {
  const p = pressure.overallPressure;
  const currentRegime = classifyRegimeLabel(p);
  const pressureLevel = classifyPressureLevel(p);

  const stability = computeRegimeStability(pressure);
  const transitionRisk = computeTransitionRisk(pressure, stability);

  // Confidence: based on how far pressure is from regime boundaries
  const thresholds = [25, 45, 65, 80];
  const minDistToThreshold = Math.min(...thresholds.map(t => Math.abs(p - t)));
  const confidence = clamp(Math.round(30 + minDistToThreshold * 2.5));

  // Most likely next regime
  const alternatives = computeAlternativeScenarios(currentRegime, pressure, transitionRisk);
  const mostLikelyNextRegime = alternatives[0]?.regime ?? currentRegime;

  // Transition probability in 30 days
  const transitionProbability30d = clamp(Math.round(transitionRisk * 0.7));

  const description = buildRegimeDescription(currentRegime, pressure, stability);

  return {
    currentRegime,
    confidence,
    stability,
    transitionRisk,
    mostLikelyNextRegime,
    transitionProbability30d,
    alternativeScenarios: alternatives,
    pressureLevel,
    description,
  };
}
