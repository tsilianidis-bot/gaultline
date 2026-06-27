// ============================================================
// FMOS Engine 3 — Market Weather Engine
// (server/fmos/engines/marketWeather.ts)
//
// Measures daily tactical market conditions.
// Unlike Market DNA (structural/long-term), Market Weather
// captures the immediate trading environment.
//
// Inputs:
//   - FaultlinePressureOutput (from pressure/engine.ts)
//
// Output: FMOSMarketWeather
//
// Note: This engine wraps and extends the existing preFlight.ts
// logic, which already computes breadth, momentum, and
// volatility from pressure vectors.
// ============================================================

import { clamp } from "../utils";
import type { FaultlinePressureOutput } from "../../pressure/engine";
import type { FMOSMarketWeather, MarketWeatherCondition } from "../types";

// ── Helper ────────────────────────────────────────────────────

function getVec(pressure: FaultlinePressureOutput, id: string, fallback = 30): number {
  return pressure.vectors.find(v => v.id === id)?.score ?? fallback;
}

// ── Weather Classification ────────────────────────────────────

function classifyWeather(score: number): MarketWeatherCondition {
  if (score >= 75) return "Severe";
  if (score >= 60) return "Stormy";
  if (score >= 45) return "Overcast";
  if (score >= 25) return "Partly Cloudy";
  return "Clear";
}

// ── Tactical Bias ─────────────────────────────────────────────

function computeTacticalBias(
  condition: MarketWeatherCondition,
  breadth: number,
  momentum: number
): string {
  if (condition === "Severe") {
    return "Extreme caution — capital preservation is the priority. Avoid new risk positions.";
  }
  if (condition === "Stormy") {
    return "Defensive posture warranted. Reduce exposure on rallies. Tight stops on existing positions.";
  }
  if (condition === "Overcast") {
    return "Selective positioning only. Favor quality names with strong fundamentals. Avoid speculative positions.";
  }
  if (condition === "Partly Cloudy") {
    if (breadth < 40 && momentum < 40) {
      return "Cautiously constructive. Broad participation improving. Staged entries in high-conviction names.";
    }
    return "Moderately constructive. Risk-on positioning appropriate with defined risk management.";
  }
  // Clear
  if (breadth < 30 && momentum < 30) {
    return "Favorable conditions. Broad market participation supports risk-on positioning.";
  }
  return "Optimal conditions for risk deployment. Momentum and breadth both supportive.";
}

// ── Main Weather Engine Function ──────────────────────────────

/**
 * Compute daily tactical market weather from pressure vectors.
 *
 * @param pressure - Output from calculateFaultlinePressure()
 */
export function computeMarketWeather(
  pressure: FaultlinePressureOutput
): FMOSMarketWeather {
  const p = pressure.overallPressure;

  // Extract relevant vector scores
  const liquidityScore = getVec(pressure, "liquidity-stress");
  const creditScore = getVec(pressure, "credit-contagion");
  const volatilityScore = getVec(pressure, "volatility-regime");
  const macroScore = getVec(pressure, "macro-sensitivity");
  const aiScore = getVec(pressure, "ai-bubble");

  // ── Breadth ────────────────────────────────────────────────
  // Measures how broadly the market is participating
  // High breadth score = narrow leadership = bad
  const breadth = clamp(Math.round(
    p * 0.4 +
    liquidityScore * 0.3 +
    creditScore * 0.3
  ));

  // ── Momentum ──────────────────────────────────────────────
  // Measures directional momentum quality
  // High momentum score = negative momentum = bad
  const momentum = clamp(Math.round(
    p * 0.5 +
    macroScore * 0.3 +
    volatilityScore * 0.2
  ));

  // ── Volatility ────────────────────────────────────────────
  // Direct from volatility vector
  const volatility = volatilityScore;

  // ── Leadership ────────────────────────────────────────────
  // Quality of market leadership
  // High leadership score = poor leadership = bad
  const leadership = clamp(Math.round(
    aiScore * 0.5 +        // AI concentration = poor leadership quality
    creditScore * 0.3 +    // Credit stress = leadership deteriorating
    volatilityScore * 0.2
  ));

  // ── Sector Rotation ───────────────────────────────────────
  // Amount of sector rotation occurring
  // High rotation score = defensive rotation = bad
  const sectorRotation = clamp(Math.round(
    macroScore * 0.5 +
    p * 0.3 +
    creditScore * 0.2
  ));

  // ── Risk Appetite ─────────────────────────────────────────
  // Overall risk appetite (high = risk-off = bad)
  const riskAppetite = clamp(Math.round(
    p * 0.5 +
    liquidityScore * 0.3 +
    volatilityScore * 0.2
  ));

  // ── Overall Weather Score ─────────────────────────────────
  const score = clamp(Math.round(
    breadth * 0.20 +
    momentum * 0.20 +
    volatility * 0.20 +
    leadership * 0.15 +
    sectorRotation * 0.10 +
    riskAppetite * 0.15
  ));

  const condition = classifyWeather(score);

  // ── Observations ─────────────────────────────────────────
  const observations: string[] = [];

  if (breadth > 65) {
    observations.push("Market breadth narrow — leadership concentrated in few names");
  } else if (breadth < 35) {
    observations.push("Market breadth broad — healthy participation across sectors");
  }

  if (momentum > 65) {
    observations.push("Negative momentum dominant — trend is deteriorating");
  } else if (momentum < 35) {
    observations.push("Positive momentum intact — trend is constructive");
  }

  if (volatility > 65) {
    observations.push("Volatility elevated — entry risk is high, use smaller position sizes");
  } else if (volatility < 30) {
    observations.push("Low volatility environment — favorable for systematic strategies");
  }

  if (leadership > 65) {
    observations.push("Leadership quality poor — AI/tech concentration at risk");
  }

  if (sectorRotation > 60) {
    observations.push("Defensive rotation underway — institutions moving to safety");
  }

  if (riskAppetite > 65) {
    observations.push("Risk appetite deteriorating — institutional risk-off positioning");
  } else if (riskAppetite < 35) {
    observations.push("Risk appetite healthy — institutions positioned for growth");
  }

  if (observations.length === 0) {
    observations.push("Market conditions within normal parameters");
  }

  const tacticalBias = computeTacticalBias(condition, breadth, momentum);

  return {
    condition,
    score,
    breadth,
    momentum,
    volatility,
    leadership,
    sectorRotation,
    riskAppetite,
    observations,
    tacticalBias,
  };
}
