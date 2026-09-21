/**
 * FAULTLINE Decision-Light contract (action-specific).
 *
 * Lights are never collapsed to a single bullish/bearish label.
 * Bull-continuation probability, crash/drawdown probability, Pressure Index,
 * regime, confirmation, invalidation, evidence quality, and source health
 * remain separate fields on every decision output.
 *
 * GREEN/PROCEED: supported by canonical regime, evidence, and confirmation
 * YELLOW/CAUTION: opportunity with pressure/fragility/conflict → tighter controls
 * RED/AVOID: material conflict with canonical state/risk/invalidation
 * GRAY/UNAVAILABLE: missing/stale/unhealthy evidence — withhold; never manufacture a color
 */

export const DECISION_LIGHT_CONTRACT_VERSION = "faultline-decision-light-v1" as const;

export const DECISION_LIGHTS = ["GREEN", "YELLOW", "RED", "GRAY"] as const;
export type DecisionLight = (typeof DECISION_LIGHTS)[number];

export const DECISION_LIGHT_LABELS = ["PROCEED", "CAUTION", "AVOID", "UNAVAILABLE"] as const;
export type DecisionLightLabel = (typeof DECISION_LIGHT_LABELS)[number];

export const SOURCE_HEALTH_STATUSES = ["healthy", "degraded", "unavailable"] as const;
export type DecisionSourceHealthStatus = (typeof SOURCE_HEALTH_STATUSES)[number];

export const RISK_ON_MOVES = ["add_risk", "buy_specific_asset", "deploy_cash"] as const;
export const RISK_OFF_MOVES = ["reduce_risk", "sell_specific_asset", "raise_cash", "hedge"] as const;
export const NEUTRAL_MOVES = ["hold", "rotate"] as const;

export type DecisionMoveFamily = "risk_on" | "risk_off" | "neutral";

export function decisionLightLabel(light: DecisionLight): DecisionLightLabel {
  switch (light) {
    case "GREEN":
      return "PROCEED";
    case "YELLOW":
      return "CAUTION";
    case "RED":
      return "AVOID";
    case "GRAY":
      return "UNAVAILABLE";
  }
}

export function classifyDecisionMoveFamily(moveType: string): DecisionMoveFamily {
  if ((RISK_ON_MOVES as readonly string[]).includes(moveType)) return "risk_on";
  if ((RISK_OFF_MOVES as readonly string[]).includes(moveType)) return "risk_off";
  return "neutral";
}

export interface DecisionLightOutput {
  contractVersion: typeof DECISION_LIGHT_CONTRACT_VERSION;
  proposedAction: string;
  moveType: string;
  moveFamily: DecisionMoveFamily;
  decisionLight: DecisionLight;
  decisionLabel: DecisionLightLabel;
  explanation: string;
  supportingEvidence: string[];
  confirmationTriggers: string[];
  invalidationTriggers: string[];
  canonicalStateId: string | null;
  timestamp: string;
  sourceHealthStatus: DecisionSourceHealthStatus;
  evidenceQuality: string | null;
  pressureIndex: number | null;
  regime: string | null;
  bullContinuationProbability: number | null;
  crashDrawdownProbability: number | null;
}

export const DECISION_LIGHT_REQUIRED_FIELDS = [
  "proposedAction",
  "decisionLight",
  "explanation",
  "supportingEvidence",
  "confirmationTriggers",
  "invalidationTriggers",
  "canonicalStateId",
  "timestamp",
  "sourceHealthStatus",
] as const satisfies ReadonlyArray<keyof DecisionLightOutput>;
