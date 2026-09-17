/**
 * Authoritative FAULTLINE Decision-Light engine.
 *
 * One deterministic function. Duplicate switch/case paths are forbidden here:
 * each move family has exactly one scoring posture, then one light assignment.
 * Colored lights are never manufactured when evidence is unavailable.
 */

import {
  DECISION_LIGHT_CONTRACT_VERSION,
  classifyDecisionMoveFamily,
  decisionLightLabel,
  type DecisionLight,
  type DecisionLightOutput,
  type DecisionSourceHealthStatus,
} from "../shared/decisionLight";

export interface DecisionLightEvidence {
  moveType: string;
  proposedAction: string;
  favorability: number;
  pressureIndex: number | null;
  regime: string | null;
  dataSource?: "live" | "fallback" | string | null;
  creditScore?: number | null;
  liquidityScore?: number | null;
  greenLights?: string[];
  redFlags?: string[];
  confirmationTriggers?: string[];
  invalidationTriggers?: string[];
  bullContinuationProbability?: number | null;
  crashDrawdownProbability?: number | null;
  timestamp?: string;
  canonicalStateId?: string | null;
  evidenceQuality?: string | null;
  coherenceStatus?: string | null;
  requiredSourcesUnavailable?: boolean;
  freshnessStale?: boolean;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function isUnavailableQuality(quality: string | null | undefined): boolean {
  if (!quality) return false;
  return /UNAVAILABLE|WITHHELD|INVALID/i.test(quality);
}

function isDegradedQuality(quality: string | null | undefined): boolean {
  if (!quality) return false;
  return /DEGRADED|PARTIAL|STALE|FALLBACK|MIXED/i.test(quality);
}

export function resolveDecisionEvidenceHealth(input: DecisionLightEvidence): DecisionSourceHealthStatus {
  if (input.requiredSourcesUnavailable) return "unavailable";
  if (input.freshnessStale) return "unavailable";
  if (isUnavailableQuality(input.evidenceQuality)) return "unavailable";
  if (input.coherenceStatus === "UNAVAILABLE" || input.coherenceStatus === "INVALID") return "unavailable";
  if (input.dataSource === "fallback" && !input.canonicalStateId) return "unavailable";
  if (input.pressureIndex == null || Number.isNaN(input.pressureIndex)) return "unavailable";
  if (input.dataSource === "fallback" || isDegradedQuality(input.evidenceQuality) || input.coherenceStatus === "DEGRADED") {
    return "degraded";
  }
  return "healthy";
}

function assignLight(params: {
  family: ReturnType<typeof classifyDecisionMoveFamily>;
  favorability: number;
  pressure: number;
  credit: number;
  liquidity: number;
  sourceHealth: DecisionSourceHealthStatus;
  evidenceQuality?: string | null;
}): DecisionLight {
  if (params.sourceHealth === "unavailable") return "GRAY";

  const conflict = params.credit >= 60 || params.liquidity >= 60 || params.pressure >= 65;
  const fragile = params.credit >= 45 || params.liquidity >= 45 || params.pressure >= 40;
  const degradedCeiling = params.sourceHealth === "degraded" || isDegradedQuality(params.evidenceQuality);

  let light: DecisionLight;
  if (params.family === "risk_on") {
    if (conflict || params.favorability < 40) light = "RED";
    else if (fragile || params.favorability < 62) light = "YELLOW";
    else light = "GREEN";
  } else if (params.family === "risk_off") {
    if (params.pressure < 35 && params.credit < 35 && params.favorability < 40) light = "RED";
    else if (params.pressure >= 60 || params.favorability >= 62) light = "GREEN";
    else light = "YELLOW";
  } else {
    if (conflict && params.favorability < 45) light = "RED";
    else if (fragile || params.favorability < 62) light = "YELLOW";
    else light = "GREEN";
  }

  if (degradedCeiling && light === "GREEN") return "YELLOW";
  return light;
}

function defaultExplanation(light: DecisionLight, family: ReturnType<typeof classifyDecisionMoveFamily>, action: string): string {
  if (light === "GRAY") {
    return `Decision withheld for ${action}. Canonical evidence is missing, stale, or unhealthy — no colored light is manufactured.`;
  }
  if (light === "GREEN") {
    return family === "risk_off"
      ? `Canonical regime, evidence, and confirmation support ${action}. Proceed with the stated controls.`
      : `Canonical regime, evidence, and confirmation support ${action}.`;
  }
  if (light === "YELLOW") {
    return `Opportunity in ${action} exists alongside pressure, fragility, or conflict. Reduce exposure and tighten controls.`;
  }
  return `Material conflict between ${action} and the canonical state, risk, or invalidation set. Avoid the move.`;
}

export function evaluateDecisionLight(input: DecisionLightEvidence): DecisionLightOutput {
  const family = classifyDecisionMoveFamily(input.moveType);
  const sourceHealthStatus = resolveDecisionEvidenceHealth(input);
  const pressure = input.pressureIndex;
  const favorability = clamp(input.favorability, 0, 100);
  const credit = input.creditScore ?? 40;
  const liquidity = input.liquidityScore ?? 40;
  const timestamp = input.timestamp ?? new Date().toISOString();

  const light = assignLight({
    family,
    favorability,
    pressure: pressure ?? Number.NaN,
    credit,
    liquidity,
    sourceHealth: sourceHealthStatus,
    evidenceQuality: input.evidenceQuality,
  });

  const structuralEvidence = [
    pressure != null ? `Pressure Index ${pressure}/100` : null,
    input.regime ? `Regime: ${input.regime}` : null,
    input.bullContinuationProbability != null ? `Bull-continuation probability ${input.bullContinuationProbability}` : null,
    input.crashDrawdownProbability != null ? `Crash/drawdown probability ${input.crashDrawdownProbability}` : null,
  ].filter((item): item is string => Boolean(item));

  const supportingEvidence = light === "GRAY"
    ? []
    : Array.from(new Set([...(input.greenLights ?? []).filter(Boolean), ...structuralEvidence])).slice(0, 6);

  const confirmationTriggers = light === "GRAY"
    ? []
    : (input.confirmationTriggers ?? []).filter(Boolean).slice(0, 6);

  const invalidationTriggers = light === "GRAY"
    ? []
    : (input.invalidationTriggers ?? []).filter(Boolean).slice(0, 6);

  return {
    contractVersion: DECISION_LIGHT_CONTRACT_VERSION,
    proposedAction: input.proposedAction,
    moveType: input.moveType,
    moveFamily: family,
    decisionLight: light,
    decisionLabel: decisionLightLabel(light),
    explanation: defaultExplanation(light, family, input.proposedAction),
    supportingEvidence,
    confirmationTriggers,
    invalidationTriggers,
    canonicalStateId: input.canonicalStateId ?? null,
    timestamp,
    sourceHealthStatus,
    evidenceQuality: input.evidenceQuality ?? null,
    pressureIndex: pressure,
    regime: input.regime,
    bullContinuationProbability: input.bullContinuationProbability ?? null,
    crashDrawdownProbability: input.crashDrawdownProbability ?? null,
  };
}

export function assertDecisionLightContract(output: DecisionLightOutput): void {
  if (!output.proposedAction.trim()) throw new Error("Decision-Light requires a proposed action.");
  if (!output.explanation.trim()) throw new Error("Decision-Light requires an explanation.");
  if (!output.timestamp.trim()) throw new Error("Decision-Light requires a timestamp.");
  if (output.decisionLight === "GRAY") {
    if (output.decisionLabel !== "UNAVAILABLE") throw new Error("GRAY must map to UNAVAILABLE.");
    return;
  }
  if (output.sourceHealthStatus === "unavailable") {
    throw new Error("Colored Decision-Light cannot be issued when source health is unavailable.");
  }
  if (output.supportingEvidence.length === 0) {
    throw new Error("Colored Decision-Light requires supporting evidence.");
  }
}
