// ============================================================
// FMOS Engine 5 — Transition Engine
// (server/fmos/engines/transition.ts)
//
// Detects early signs of regime change.
// Displays transition probabilities instead of definitive
// predictions. Monitors breadth deterioration, credit spreads,
// liquidity, volatility, sector leadership, and economic data.
//
// This engine wraps and extends the existing aftershockEngine.ts
// and recoveryEngine.ts logic.
//
// Inputs:
//   - FaultlinePressureOutput (from pressure/engine.ts)
//
// Output: FMOSTransitionOutput
// ============================================================

import { clamp } from "../utils";
import type { FaultlinePressureOutput } from "../../pressure/engine";
import type { FMOSTransitionOutput, FMOSTransitionSignal } from "../types";

// ── Helper ────────────────────────────────────────────────────

function getVec(pressure: FaultlinePressureOutput, id: string, fallback = 30): number {
  return pressure.vectors.find(v => v.id === id)?.score ?? fallback;
}

function getVecTrend(
  pressure: FaultlinePressureOutput,
  id: string
): "rising" | "falling" | "stable" {
  return pressure.vectors.find(v => v.id === id)?.trend ?? "stable";
}

// ── Transition Signal Detectors ───────────────────────────────

function detectBreadthDeterioration(pressure: FaultlinePressureOutput): FMOSTransitionSignal {
  const liquidityScore = getVec(pressure, "liquidity-stress");
  const liquidityTrend = getVecTrend(pressure, "liquidity-stress");
  const p = pressure.overallPressure;

  const strength = clamp(Math.round(
    (liquidityScore > 50 ? (liquidityScore - 50) * 2 : 0) +
    (liquidityTrend === "rising" ? 20 : 0) +
    (p > 45 ? (p - 45) * 0.5 : 0)
  ));

  return {
    name: "Breadth Deterioration",
    active: strength > 30,
    strength,
    description: strength > 50
      ? "Market breadth is narrowing — fewer stocks participating in the advance. Leadership concentration is increasing."
      : strength > 30
        ? "Early signs of breadth deterioration. Monitor for narrowing leadership."
        : "Market breadth is healthy — broad participation across sectors.",
  };
}

function detectCreditSpreadWidening(pressure: FaultlinePressureOutput): FMOSTransitionSignal {
  const creditScore = getVec(pressure, "credit-contagion");
  const creditTrend = getVecTrend(pressure, "credit-contagion");

  const strength = clamp(Math.round(
    (creditScore > 40 ? (creditScore - 40) * 1.5 : 0) +
    (creditTrend === "rising" ? 25 : 0)
  ));

  return {
    name: "Credit Spread Widening",
    active: strength > 25,
    strength,
    description: strength > 50
      ? "High-yield credit spreads are widening significantly — credit markets pricing in elevated default risk."
      : strength > 25
        ? "Credit spreads beginning to widen. Early warning of potential credit stress."
        : "Credit spreads contained — no systemic credit stress detected.",
  };
}

function detectLiquidityDeterioration(pressure: FaultlinePressureOutput): FMOSTransitionSignal {
  const liquidityScore = getVec(pressure, "liquidity-stress");
  const creditScore = getVec(pressure, "credit-contagion");
  const liquidityTrend = getVecTrend(pressure, "liquidity-stress");

  const strength = clamp(Math.round(
    liquidityScore * 0.5 +
    creditScore * 0.3 +
    (liquidityTrend === "rising" ? 20 : 0)
  ));

  return {
    name: "Liquidity Deterioration",
    active: strength > 35,
    strength,
    description: strength > 60
      ? "Liquidity conditions are deteriorating — funding markets showing stress. Risk of cascade increasing."
      : strength > 35
        ? "Liquidity conditions tightening. Monitor for further deterioration."
        : "Liquidity conditions adequate — no funding stress detected.",
  };
}

function detectVolatilityRegime(pressure: FaultlinePressureOutput): FMOSTransitionSignal {
  const volatilityScore = getVec(pressure, "volatility-regime");
  const volatilityTrend = getVecTrend(pressure, "volatility-regime");

  const strength = clamp(Math.round(
    volatilityScore * 0.7 +
    (volatilityTrend === "rising" ? 30 : 0)
  ));

  return {
    name: "Volatility Regime Shift",
    active: strength > 40,
    strength,
    description: strength > 65
      ? "Volatility regime has shifted to high — VIX-equivalent elevated, options pricing in tail risk."
      : strength > 40
        ? "Volatility rising — potential regime shift from low to high volatility environment."
        : "Low volatility regime intact — favorable for systematic strategies.",
  };
}

function detectSectorLeadershipBreakdown(pressure: FaultlinePressureOutput): FMOSTransitionSignal {
  const aiScore = getVec(pressure, "ai-bubble");
  const macroScore = getVec(pressure, "macro-sensitivity");
  const p = pressure.overallPressure;

  // Leadership breakdown when AI/tech concentration is high AND macro is deteriorating
  const strength = clamp(Math.round(
    (aiScore > 60 ? (aiScore - 60) * 1.5 : 0) +
    (macroScore > 50 ? (macroScore - 50) : 0) +
    (p > 50 ? (p - 50) * 0.5 : 0)
  ));

  return {
    name: "Sector Leadership Breakdown",
    active: strength > 30,
    strength,
    description: strength > 55
      ? "Sector leadership is breaking down — narrow AI/tech concentration is vulnerable to rotation."
      : strength > 30
        ? "Leadership quality deteriorating. Defensive rotation beginning in some sectors."
        : "Sector leadership healthy — broad participation with quality leadership.",
  };
}

function detectEconomicDeterioration(pressure: FaultlinePressureOutput): FMOSTransitionSignal {
  const macroScore = getVec(pressure, "macro-sensitivity");
  const macroTrend = getVecTrend(pressure, "macro-sensitivity");

  const strength = clamp(Math.round(
    macroScore * 0.6 +
    (macroTrend === "rising" ? 30 : 0) +
    (macroTrend === "falling" ? -15 : 0)
  ));

  return {
    name: "Economic Deterioration",
    active: strength > 40,
    strength,
    description: strength > 65
      ? "Economic conditions deteriorating — macro headwinds intensifying. Recession risk elevated."
      : strength > 40
        ? "Economic momentum slowing. Watch for further deterioration in employment and growth data."
        : "Economic conditions stable — macro backdrop supportive.",
  };
}

// ── Transition Direction ──────────────────────────────────────

function computeTransitionDirection(
  pressure: FaultlinePressureOutput,
  signals: FMOSTransitionSignal[]
): "deteriorating" | "improving" | "stable" {
  const risingVectors = pressure.vectors.filter(v => v.trend === "rising").length;
  const fallingVectors = pressure.vectors.filter(v => v.trend === "falling").length;
  const activeSignals = signals.filter(s => s.active).length;

  if (risingVectors > fallingVectors + 1 || activeSignals >= 3) {
    return "deteriorating";
  }
  if (fallingVectors > risingVectors + 1 && activeSignals <= 1) {
    return "improving";
  }
  return "stable";
}

// ── Warning Signals ───────────────────────────────────────────

function extractWarningSignals(
  signals: FMOSTransitionSignal[],
  pressure: FaultlinePressureOutput
): string[] {
  const warnings: string[] = [];

  for (const signal of signals) {
    if (signal.active && signal.strength > 50) {
      warnings.push(signal.description.split(" — ")[0] ?? signal.name);
    }
  }

  // Add overall pressure warning if high
  if (pressure.overallPressure >= 65) {
    warnings.push(`Systemic pressure at ${pressure.overallPressure}/100 — multiple stress vectors converging`);
  }

  return warnings.slice(0, 5);
}

// ── Time to Transition Estimate ───────────────────────────────

function estimateTimeToTransition(
  transitionProbability: number,
  direction: "deteriorating" | "improving" | "stable"
): string {
  if (direction === "stable") return "No transition imminent";
  if (transitionProbability >= 70) return "Transition may be imminent (days to weeks)";
  if (transitionProbability >= 50) return "Transition possible within 2–4 weeks";
  if (transitionProbability >= 30) return "Transition possible within 1–3 months";
  return "No near-term transition expected";
}

// ── Main Transition Engine Function ──────────────────────────

/**
 * Detect early signs of regime transition.
 *
 * @param pressure - Output from calculateFaultlinePressure()
 */
export function computeTransition(
  pressure: FaultlinePressureOutput
): FMOSTransitionOutput {
  // Run all signal detectors
  const breadthSignal = detectBreadthDeterioration(pressure);
  const creditSignal = detectCreditSpreadWidening(pressure);
  const liquiditySignal = detectLiquidityDeterioration(pressure);
  const volatilitySignal = detectVolatilityRegime(pressure);
  const leadershipSignal = detectSectorLeadershipBreakdown(pressure);
  const economicSignal = detectEconomicDeterioration(pressure);

  const allSignals = [
    breadthSignal,
    creditSignal,
    liquiditySignal,
    volatilitySignal,
    leadershipSignal,
    economicSignal,
  ];

  const activeSignals = allSignals.filter(s => s.active);

  // Overall transition probability
  const avgActiveStrength = activeSignals.length > 0
    ? activeSignals.reduce((sum, s) => sum + s.strength, 0) / activeSignals.length
    : 0;

  const transitionProbability = clamp(Math.round(
    (activeSignals.length / allSignals.length) * 50 +
    avgActiveStrength * 0.5
  ));

  const transitionDirection = computeTransitionDirection(pressure, allSignals);
  const warningSignals = extractWarningSignals(allSignals, pressure);
  const estimatedTimeToTransition = estimateTimeToTransition(transitionProbability, transitionDirection);

  return {
    transitionProbability,
    transitionDirection,
    activeSignals,
    breadthDeterioration: breadthSignal.strength,
    creditSpreadWidening: creditSignal.strength,
    liquidityDeterioration: liquiditySignal.strength,
    volatilityRegime: volatilitySignal.strength,
    sectorLeadershipBreakdown: leadershipSignal.strength,
    warningSignals,
    estimatedTimeToTransition,
  };
}
