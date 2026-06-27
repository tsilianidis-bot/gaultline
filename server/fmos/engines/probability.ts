// ============================================================
// FMOS Engine 7 — Probability Engine
// (server/fmos/engines/probability.ts)
//
// Generates probability distributions (bull/neutral/bear) that
// ALWAYS sum to 100. Replaces the two competing probability
// formulas that existed in preFlight.ts and signalOutlook.ts.
//
// Key design principle: bull + neutral + bear = 100 (always).
// The old formulas could produce inconsistent results where
// bull + bear ≠ 100.
//
// Inputs:
//   - FaultlinePressureOutput (from pressure/engine.ts)
//   - FMOSEvidenceOutput (from Evidence Engine)
//
// Output: FMOSProbabilityDistribution
// ============================================================

import { clamp, computeProbabilityDistribution } from "../utils";
import type { FaultlinePressureOutput } from "../../pressure/engine";
import type { FMOSEvidenceOutput, FMOSProbabilityDistribution } from "../types";

// ── Helper ────────────────────────────────────────────────────

function getVec(pressure: FaultlinePressureOutput, id: string, fallback = 30): number {
  return pressure.vectors.find(v => v.id === id)?.score ?? fallback;
}

// ── Evidence Adjustment ───────────────────────────────────────

/**
 * Adjust base probability distribution using evidence signals.
 * Evidence can shift the distribution by up to ±15 percentage points.
 */
function adjustForEvidence(
  base: { bull: number; neutral: number; bear: number },
  evidence: FMOSEvidenceOutput
): { bull: number; neutral: number; bear: number } {
  const { bullishFamilies, bearishFamilies, diversityScore } = evidence;

  // Net evidence signal: positive = bullish, negative = bearish
  const netEvidence = bullishFamilies - bearishFamilies;
  const evidenceStrength = clamp(Math.round(diversityScore * 0.15));

  let { bull, neutral, bear } = base;

  if (netEvidence > 0) {
    // Bullish evidence: shift toward bull
    const shift = Math.min(evidenceStrength, 15);
    bull = clamp(bull + shift);
    bear = clamp(bear - shift);
  } else if (netEvidence < 0) {
    // Bearish evidence: shift toward bear
    const shift = Math.min(evidenceStrength, 15);
    bear = clamp(bear + shift);
    bull = clamp(bull - shift);
  }

  // Renormalize to sum to 100
  const total = bull + neutral + bear;
  if (total !== 100) {
    const diff = 100 - total;
    neutral = clamp(neutral + diff);
  }

  return { bull, neutral, bear };
}

// ── Primary Driver ────────────────────────────────────────────

function identifyPrimaryDriver(
  pressure: FaultlinePressureOutput,
  evidence: FMOSEvidenceOutput
): string {
  const p = pressure.overallPressure;

  // Find the highest-scoring vector
  const topVector = pressure.vectors.reduce(
    (max, v) => v.score > max.score ? v : max,
    pressure.vectors[0] ?? { id: "unknown", score: 0, label: "Unknown", trend: "stable" as const }
  );

  if (p >= 65) {
    return `Systemic pressure at ${p}/100 — ${topVector.label} is the primary stress driver`;
  }
  if (p >= 45) {
    return `Elevated pressure at ${p}/100 — ${topVector.label} elevated, monitoring for escalation`;
  }

  // Check evidence families for primary driver
  const strongestFamily = evidence.families
    .filter(f => f.available && f.strength > 40)
    .sort((a, b) => b.strength - a.strength)[0];

  if (strongestFamily) {
    return `${strongestFamily.label} is the primary driver — ${strongestFamily.signal} signal at ${strongestFamily.strength}/100 strength`;
  }

  return `Low systemic pressure at ${p}/100 — conditions broadly supportive`;
}

// ── Bull Evidence ─────────────────────────────────────────────

function buildBullEvidence(
  pressure: FaultlinePressureOutput,
  evidence: FMOSEvidenceOutput
): string[] {
  const p = pressure.overallPressure;
  const bullEvidence: string[] = [];

  // Pressure-based bull evidence
  if (p < 40) {
    bullEvidence.push(`Low systemic pressure (${p}/100) — no major stress vectors elevated`);
  }

  // Evidence family-based bull evidence
  for (const family of evidence.families) {
    if (family.signal === "bullish" && family.strength > 35) {
      bullEvidence.push(`${family.label}: ${family.items[0]?.description ?? "bullish signal"}`);
    }
  }

  // Vector-based bull evidence
  for (const vector of pressure.vectors) {
    if (vector.score < 30 && vector.trend === "falling") {
      bullEvidence.push(`${vector.label} declining — stress easing`);
    }
  }

  return bullEvidence.slice(0, 4);
}

// ── Bear Evidence ─────────────────────────────────────────────

function buildBearEvidence(
  pressure: FaultlinePressureOutput,
  evidence: FMOSEvidenceOutput
): string[] {
  const p = pressure.overallPressure;
  const bearEvidence: string[] = [];

  // Pressure-based bear evidence
  if (p >= 55) {
    bearEvidence.push(`Elevated systemic pressure (${p}/100) — multiple stress vectors active`);
  }

  // Evidence family-based bear evidence
  for (const family of evidence.families) {
    if (family.signal === "bearish" && family.strength > 35) {
      bearEvidence.push(`${family.label}: ${family.items[0]?.description ?? "bearish signal"}`);
    }
  }

  // Vector-based bear evidence
  for (const vector of pressure.vectors) {
    if (vector.score > 65 && vector.trend === "rising") {
      bearEvidence.push(`${vector.label} rising — stress escalating`);
    }
  }

  return bearEvidence.slice(0, 4);
}

// ── Invalidation Conditions ───────────────────────────────────

function buildInvalidationConditions(
  bull: number,
  bear: number,
  pressure: FaultlinePressureOutput
): string[] {
  const conditions: string[] = [];
  const p = pressure.overallPressure;
  const creditScore = getVec(pressure, "credit-contagion");
  const liquidityScore = getVec(pressure, "liquidity-stress");

  if (bull > bear) {
    // Bull thesis invalidation
    conditions.push(`Pressure index rises above ${Math.min(p + 20, 80)} — stress escalating`);
    if (creditScore < 60) {
      conditions.push(`Credit spreads widen significantly — HY spread above 500bps`);
    }
    conditions.push("Fed signals additional tightening beyond current expectations");
  } else {
    // Bear thesis invalidation
    conditions.push(`Pressure index falls below ${Math.max(p - 20, 20)} — stress easing`);
    if (liquidityScore > 40) {
      conditions.push("Liquidity conditions improve materially — funding stress resolves");
    }
    conditions.push("Fed pivot or emergency policy intervention");
  }

  return conditions.slice(0, 3);
}

// ── Confidence Calculation ────────────────────────────────────

function computeConfidence(
  bull: number,
  bear: number,
  evidence: FMOSEvidenceOutput
): number {
  // Confidence is higher when:
  // 1. The distribution is more decisive (less neutral)
  // 2. Evidence families agree with the distribution
  // 3. There are fewer contradictions

  const decisiveness = clamp(Math.round(Math.abs(bull - bear)));
  const contradictionPenalty = evidence.contradictions.length * 10;
  const evidenceBonus = clamp(Math.round(evidence.diversityScore * 0.3));

  return clamp(Math.round(40 + decisiveness * 0.4 + evidenceBonus - contradictionPenalty));
}

// ── Main Probability Engine Function ─────────────────────────

/**
 * Generate a canonical probability distribution (bull/neutral/bear).
 * bull + neutral + bear = 100 (always).
 *
 * @param pressure - Output from calculateFaultlinePressure()
 * @param evidence - Output from computeEvidence()
 */
export function computeProbability(
  pressure: FaultlinePressureOutput,
  evidence: FMOSEvidenceOutput
): FMOSProbabilityDistribution {
  const creditScore = getVec(pressure, "credit-contagion");

  // Start with canonical base distribution
  const base = computeProbabilityDistribution(pressure.overallPressure, creditScore);

  // Adjust for evidence signals
  const adjusted = adjustForEvidence(base, evidence);

  const primaryDriver = identifyPrimaryDriver(pressure, evidence);
  const bullEvidence = buildBullEvidence(pressure, evidence);
  const bearEvidence = buildBearEvidence(pressure, evidence);
  const invalidationConditions = buildInvalidationConditions(
    adjusted.bull,
    adjusted.bear,
    pressure
  );
  const confidence = computeConfidence(adjusted.bull, adjusted.bear, evidence);

  return {
    bull: adjusted.bull,
    neutral: adjusted.neutral,
    bear: adjusted.bear,
    primaryDriver,
    bullEvidence,
    bearEvidence,
    confidence,
    invalidationConditions,
  };
}
