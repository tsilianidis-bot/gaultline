import { REDESIGN_EVALUATION_GATES } from "./redesignResearch";

export type ResearchEvidenceState = {
  championReproducible: boolean;
  pointInTimeDataAvailable: boolean;
  independentOutcomesAvailable: boolean;
  lockedWalkForwardAvailable: boolean;
  calibrationSampleAdequate: boolean;
  ablationSampleAdequate: boolean;
  stabilitySampleAdequate: boolean;
  explainabilityContractComplete: boolean;
};

export type PreRegisteredInteraction = {
  id: string;
  hypothesis: string;
  requiredClusters: readonly string[];
  status: "blocked_pending_data" | "eligible_for_offline_test";
};

/**
 * Interactions are hypotheses only. They cannot become model terms until the
 * same locked training/validation/holdout protocol evaluates them against the
 * immutable Champion.
 */
export const PRE_REGISTERED_INTERACTIONS: readonly Omit<PreRegisteredInteraction, "status">[] = [
  { id: "credit_liquidity_confirmation", hypothesis: "Credit deterioration is more informative when independent liquidity stress confirms.", requiredClusters: ["credit", "liquidity"] },
  { id: "treasury_growth_confirmation", hypothesis: "Treasury stress is more informative when growth/labor deterioration confirms.", requiredClusters: ["treasury_sovereign", "growth_labor"] },
  { id: "market_volatility_confirmation", hypothesis: "Market-internal deterioration is more informative when volatility confirms.", requiredClusters: ["market_internals", "volatility"] },
];

export function evaluateRedesignReadiness(evidence: ResearchEvidenceState) {
  const values = {
    champion_reproducibility: evidence.championReproducible,
    point_in_time_data: evidence.pointInTimeDataAvailable,
    outcome_ledger: evidence.independentOutcomesAvailable,
    walk_forward: evidence.lockedWalkForwardAvailable,
    calibration: evidence.calibrationSampleAdequate,
    ablation: evidence.ablationSampleAdequate,
    stability: evidence.stabilitySampleAdequate,
    explainability: evidence.explainabilityContractComplete,
  } as const;
  const missing = REDESIGN_EVALUATION_GATES.filter(gate => values[gate.name] !== true).map(gate => gate.name);
  return {
    status: missing.length === 0 ? "ELIGIBLE_FOR_SHADOW" as const : "BLOCKED" as const,
    missingGates: missing,
    interactionCandidates: PRE_REGISTERED_INTERACTIONS.map(candidate => ({
      ...candidate,
      status: missing.length === 0 ? "eligible_for_offline_test" as const : "blocked_pending_data" as const,
    })),
  };
}

/** Current verified evidence state from the Champion Baseline audit. */
export const CURRENT_REDESIGN_EVIDENCE: ResearchEvidenceState = {
  championReproducible: false,
  pointInTimeDataAvailable: false,
  independentOutcomesAvailable: false,
  lockedWalkForwardAvailable: false,
  calibrationSampleAdequate: false,
  ablationSampleAdequate: false,
  stabilitySampleAdequate: false,
  explainabilityContractComplete: true,
};
