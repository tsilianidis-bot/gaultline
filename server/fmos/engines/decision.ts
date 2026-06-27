// ============================================================
// FMOS Engine 10 — Decision Engine
// (server/fmos/engines/decision.ts)
//
// Synthesizes all upstream engine outputs into a clear,
// actionable decision recommendation with full context.
//
// The Decision Engine is the culmination of the analytical
// pipeline. It produces a verdict, conviction level, bull/bear
// cases, catalysts, threats, and key levels.
//
// Inputs:
//   - FaultlinePressureOutput (from pressure/engine.ts)
//   - FMOSRegimeOutput (from Regime Engine)
//   - FMOSProbabilityDistribution (from Probability Engine)
//   - FMOSConfidenceOutput (from Confidence Engine)
//   - FMOSMarketWeather (from Market Weather Engine)
//
// Output: FMOSDecisionOutput
// ============================================================

import { clamp, pressureToActionBias } from "../utils";
import type { FaultlinePressureOutput } from "../../pressure/engine";
import type {
  FMOSRegimeOutput,
  FMOSProbabilityDistribution,
  FMOSConfidenceOutput,
  FMOSMarketWeather,
  FMOSDecisionOutput,
  DecisionVerdict,
  ActionBias,
} from "../types";

// ── Verdict Classification ────────────────────────────────────

function classifyVerdict(
  bull: number,
  bear: number,
  confidence: number,
  actionBias: ActionBias
): DecisionVerdict {
  const edge = bull - bear;

  // Critical/Defensive bias overrides
  if (actionBias === "Critical") return "AVOID";
  if (actionBias === "Defensive") {
    if (edge > 20) return "WATCH";
    return "REDUCE";
  }

  // Normal classification by edge and confidence
  if (edge >= 30 && confidence >= 60) return "STRONG BUY";
  if (edge >= 20 && confidence >= 50) return "BUY";
  if (edge >= 10) return "ACCUMULATE";
  if (edge >= -10) return "HOLD";
  if (edge >= -20) return "WATCH";
  if (edge >= -30) return "TRIM";
  if (edge >= -40) return "REDUCE";
  if (edge >= -50) return "SELL";
  return "AVOID";
}

// ── Position Sizing Guidance ──────────────────────────────────

function buildPositionSizing(
  verdict: DecisionVerdict,
  confidence: number,
  weather: FMOSMarketWeather
): string {
  const weatherPenalty = weather.score > 60 ? "Reduce size by 25–50% due to adverse market conditions." : "";

  const sizeGuide: Record<DecisionVerdict, string> = {
    "STRONG BUY": `Full position (up to 100% of target allocation). ${weatherPenalty}`,
    "BUY": `Standard position (75–100% of target allocation). ${weatherPenalty}`,
    "ACCUMULATE": `Staged entry (50–75% of target allocation). ${weatherPenalty}`,
    "HOLD": `Maintain current position. No new additions until conditions improve.`,
    "WATCH": `No new positions. Monitor for entry opportunity.`,
    "TRIM": `Reduce to 50% of current position. Take partial profits.`,
    "REDUCE": `Reduce to 25% of current position. Significant risk reduction warranted.`,
    "SELL": `Exit position. Capital preservation priority.`,
    "AVOID": `No exposure. Capital preservation is the only objective.`,
  };

  return sizeGuide[verdict];
}

// ── Timeframe Guidance ────────────────────────────────────────

function buildTimeframe(verdict: DecisionVerdict, regime: FMOSRegimeOutput): string {
  if (verdict === "AVOID" || verdict === "SELL") {
    return "No defined entry timeframe — wait for regime improvement";
  }
  if (verdict === "STRONG BUY" || verdict === "BUY") {
    return `${regime.transitionProbability30d < 30 ? "Medium-term (3–6 months)" : "Short-term (4–8 weeks)"} — monitor for regime change`;
  }
  if (verdict === "ACCUMULATE") {
    return "Staged entry over 2–4 weeks — build position as conditions confirm";
  }
  return "Tactical (1–4 weeks) — reassess as conditions evolve";
}

// ── Catalysts ─────────────────────────────────────────────────

function buildCatalysts(
  pressure: FaultlinePressureOutput,
  probability: FMOSProbabilityDistribution
): string[] {
  const catalysts: string[] = [];
  const p = pressure.overallPressure;
  const getVec = (id: string) => pressure.vectors.find(v => v.id === id)?.score ?? 30;

  const creditScore = getVec("credit-contagion");
  const liquidityScore = getVec("liquidity-stress");

  if (p < 45) {
    catalysts.push("Continued low systemic pressure supports risk-on positioning");
  }
  if (creditScore < 35) {
    catalysts.push("Credit conditions benign — no systemic credit stress");
  }
  if (liquidityScore < 35) {
    catalysts.push("Liquidity conditions supportive — funding markets functioning normally");
  }

  // From probability bull evidence
  for (const evidence of probability.bullEvidence.slice(0, 2)) {
    catalysts.push(evidence);
  }

  if (catalysts.length === 0) {
    catalysts.push("Policy intervention could improve conditions");
    catalysts.push("Earnings stabilization would support recovery");
  }

  return catalysts.slice(0, 4);
}

// ── Threats ───────────────────────────────────────────────────

function buildThreats(
  pressure: FaultlinePressureOutput,
  probability: FMOSProbabilityDistribution
): string[] {
  const threats: string[] = [];
  const p = pressure.overallPressure;
  const getVec = (id: string) => pressure.vectors.find(v => v.id === id)?.score ?? 30;

  const creditScore = getVec("credit-contagion");
  const liquidityScore = getVec("liquidity-stress");
  const volatilityScore = getVec("volatility-regime");

  if (p >= 55) {
    threats.push(`Elevated systemic pressure (${p}/100) — risk of further deterioration`);
  }
  if (creditScore >= 55) {
    threats.push("Credit spread widening — potential credit contagion");
  }
  if (liquidityScore >= 55) {
    threats.push("Liquidity stress elevated — funding market pressure");
  }
  if (volatilityScore >= 55) {
    threats.push("Volatility elevated — increased drawdown risk");
  }

  // From probability bear evidence
  for (const evidence of probability.bearEvidence.slice(0, 2)) {
    threats.push(evidence);
  }

  if (threats.length === 0) {
    threats.push("Unexpected macro deterioration");
    threats.push("Geopolitical shock");
  }

  return threats.slice(0, 4);
}

// ── Primary Reason ────────────────────────────────────────────

function buildPrimaryReason(
  verdict: DecisionVerdict,
  actionBias: ActionBias,
  pressure: FaultlinePressureOutput,
  probability: FMOSProbabilityDistribution
): string {
  const p = pressure.overallPressure;

  if (verdict === "AVOID" || verdict === "SELL") {
    return `Systemic pressure at ${p}/100 with ${actionBias} bias — capital preservation is the priority. ${probability.primaryDriver}`;
  }
  if (verdict === "STRONG BUY" || verdict === "BUY") {
    return `Low systemic pressure (${p}/100) with ${probability.bull}% bull probability — conditions favor risk-on positioning. ${probability.primaryDriver}`;
  }
  if (verdict === "HOLD" || verdict === "WATCH") {
    return `Mixed signals with ${probability.bull}% bull / ${probability.bear}% bear probability — wait for clearer direction. ${probability.primaryDriver}`;
  }
  return `Pressure at ${p}/100 — ${probability.primaryDriver}`;
}

// ── Main Decision Engine Function ─────────────────────────────

/**
 * Synthesize all engine outputs into an actionable decision.
 *
 * @param pressure    - Output from calculateFaultlinePressure()
 * @param regime      - Output from computeRegime()
 * @param probability - Output from computeProbability()
 * @param confidence  - Output from computeConfidence()
 * @param weather     - Output from computeMarketWeather()
 */
export function computeDecision(
  pressure: FaultlinePressureOutput,
  regime: FMOSRegimeOutput,
  probability: FMOSProbabilityDistribution,
  confidence: FMOSConfidenceOutput,
  weather: FMOSMarketWeather
): FMOSDecisionOutput {
  const actionBias = pressureToActionBias(pressure.overallPressure);
  const verdict = classifyVerdict(probability.bull, probability.bear, confidence.score, actionBias);
  const conviction = clamp(Math.round(
    (Math.abs(probability.bull - probability.bear) * 0.5) +
    (confidence.score * 0.3) +
    (regime.confidence * 0.2)
  ));

  const primaryReason = buildPrimaryReason(verdict, actionBias, pressure, probability);
  const bullCase = probability.bullEvidence[0] ?? "Low systemic pressure supports risk-on positioning";
  const bearCase = probability.bearEvidence[0] ?? "Elevated pressure warrants caution";
  const catalysts = buildCatalysts(pressure, probability);
  const threats = buildThreats(pressure, probability);
  const positionSizing = buildPositionSizing(verdict, confidence.score, weather);
  const timeframe = buildTimeframe(verdict, regime);

  return {
    verdict,
    actionBias,
    conviction,
    primaryReason,
    bullCase,
    bearCase,
    catalysts,
    threats,
    keyLevels: {}, // populated by symbol-specific analysis
    invalidationConditions: probability.invalidationConditions,
    positionSizing,
    timeframe,
    probability,
  };
}
