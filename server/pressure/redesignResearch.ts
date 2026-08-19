/**
 * FAULTLINE Champion Redesign Research Contract
 *
 * This module is intentionally offline-only. It defines hypotheses and gates
 * for a future research dataset; it does not calculate, blend, or alter the
 * live Pressure Index. No cluster weights are pre-assigned because weights,
 * interactions, and probability models must earn inclusion through pre-
 * registered out-of-sample tests.
 */

export type RiskClusterId =
  | "credit"
  | "liquidity"
  | "treasury_sovereign"
  | "growth_labor"
  | "inflation_policy"
  | "market_internals"
  | "volatility"
  | "valuation_speculation"
  | "banking"
  | "real_estate_cre"
  | "global_macro";

export type IndicatorResearchSpec = {
  id: string;
  cluster: RiskClusterId;
  source: string;
  frequency: "daily" | "weekly" | "monthly" | "quarterly";
  economicRationale: string;
  direction: "higher_is_stress" | "lower_is_stress" | "two_sided";
  requiresPointInTimeVintage: boolean;
  currentAvailability: "available_live" | "requires_new_source" | "requires_vintage_history";
};

export type IndicatorFeatureState = {
  level: number | null;
  direction: number | null;
  velocity: number | null;
  acceleration: number | null;
  persistence: number | null;
  historicalPercentile: number | null;
  sourceComplete: boolean;
};

export type ResearchEvaluationGate = {
  name: string;
  requirement: string;
  required: boolean;
};

/**
 * Candidate clusters deliberately separate economic mechanisms. A feature may
 * not appear in more than one selected production cluster unless a documented
 * orthogonalization or residualization test passes.
 */
export const RESEARCH_INDICATOR_SPECS: readonly IndicatorResearchSpec[] = [
  { id: "hy_spread", cluster: "credit", source: "FRED:BAMLH0A0HYM2", frequency: "daily", economicRationale: "Credit risk premium and financing stress", direction: "higher_is_stress", requiresPointInTimeVintage: true, currentAvailability: "requires_vintage_history" },
  { id: "sofr", cluster: "liquidity", source: "FRED:SOFR", frequency: "daily", economicRationale: "Secured overnight funding conditions", direction: "higher_is_stress", requiresPointInTimeVintage: true, currentAvailability: "requires_vintage_history" },
  { id: "yield_curve", cluster: "treasury_sovereign", source: "FRED:DGS10,DGS2", frequency: "daily", economicRationale: "Term structure and monetary-restriction state", direction: "two_sided", requiresPointInTimeVintage: true, currentAvailability: "requires_vintage_history" },
  { id: "unemployment", cluster: "growth_labor", source: "FRED:UNRATE", frequency: "monthly", economicRationale: "Labor-cycle deterioration", direction: "higher_is_stress", requiresPointInTimeVintage: true, currentAvailability: "requires_vintage_history" },
  { id: "cpi_yoy", cluster: "inflation_policy", source: "FRED:CPIAUCSL", frequency: "monthly", economicRationale: "Inflation persistence and policy constraint", direction: "two_sided", requiresPointInTimeVintage: true, currentAvailability: "requires_vintage_history" },
  { id: "ppi_yoy", cluster: "inflation_policy", source: "FRED:PPIACO", frequency: "monthly", economicRationale: "Pipeline inflation and margin pressure", direction: "two_sided", requiresPointInTimeVintage: true, currentAvailability: "requires_vintage_history" },
  { id: "equity_breadth", cluster: "market_internals", source: "research_required:direct_breadth", frequency: "daily", economicRationale: "Internal market participation", direction: "lower_is_stress", requiresPointInTimeVintage: false, currentAvailability: "requires_new_source" },
  { id: "implied_volatility", cluster: "volatility", source: "research_required:completed_volatility_series", frequency: "daily", economicRationale: "Options-implied stress", direction: "higher_is_stress", requiresPointInTimeVintage: false, currentAvailability: "requires_new_source" },
  { id: "speculation_concentration", cluster: "valuation_speculation", source: "research_required:time_series_concentration", frequency: "monthly", economicRationale: "Concentration and speculative excess", direction: "higher_is_stress", requiresPointInTimeVintage: true, currentAvailability: "requires_new_source" },
  { id: "banking_stress", cluster: "banking", source: "research_required:banking_series", frequency: "weekly", economicRationale: "Bank funding and balance-sheet stress", direction: "higher_is_stress", requiresPointInTimeVintage: true, currentAvailability: "requires_new_source" },
  { id: "cre_stress", cluster: "real_estate_cre", source: "research_required:cre_series", frequency: "quarterly", economicRationale: "Commercial-real-estate refinancing and collateral stress", direction: "higher_is_stress", requiresPointInTimeVintage: true, currentAvailability: "requires_new_source" },
  { id: "global_financial_conditions", cluster: "global_macro", source: "research_required:global_conditions", frequency: "weekly", economicRationale: "External macro and dollar-liquidity stress", direction: "higher_is_stress", requiresPointInTimeVintage: true, currentAvailability: "requires_new_source" },
] as const;

export const REDESIGN_EVALUATION_GATES: readonly ResearchEvaluationGate[] = [
  { name: "champion_reproducibility", requirement: "Versioned Champion formula reproduces historical records within a documented tolerance.", required: true },
  { name: "point_in_time_data", requirement: "All historical indicator observations use release-available vintage data or carry an explicit limitation.", required: true },
  { name: "outcome_ledger", requirement: "Pre-registered independent market and macro outcomes exist at each evaluation horizon.", required: true },
  { name: "walk_forward", requirement: "Candidate is evaluated on locked walk-forward and holdout periods without retuning.", required: true },
  { name: "calibration", requirement: "Any event probability meets pre-registered calibration and discrimination thresholds on holdout data.", required: true },
  { name: "ablation", requirement: "Each included cluster or interaction adds independent out-of-sample value or is removed.", required: true },
  { name: "stability", requirement: "Transition churn, score volatility, and noise are no worse than Champion outside genuine stress changes.", required: true },
  { name: "explainability", requirement: "Every live reading can provide source-backed signed contributor explanations and confidence limitations.", required: true },
] as const;

/**
 * Returns a bounded 0–100 research feature score only when all required
 * observed dimensions are present. It is intentionally a neutral averaging
 * primitive, not a production formula or a pre-chosen indicator weighting.
 */
export function scoreCompleteResearchFeature(state: IndicatorFeatureState): number | null {
  const values = [state.level, state.direction, state.velocity, state.acceleration, state.persistence, state.historicalPercentile];
  if (!state.sourceComplete || values.some(value => value == null || !Number.isFinite(value))) return null;
  return Math.round(values.reduce((total, value) => total + (value as number), 0) / values.length);
}

/** An independent-confirmation count, not an uncontrolled amplification factor. */
export function countConfirmedClusters(clusterScores: Partial<Record<RiskClusterId, number | null>>, threshold: number) {
  return Object.values(clusterScores).filter(score => score != null && score >= threshold).length;
}

export function canPromoteResearchCandidate(gates: Partial<Record<(typeof REDESIGN_EVALUATION_GATES)[number]["name"], boolean>>) {
  return REDESIGN_EVALUATION_GATES.every(gate => !gate.required || gates[gate.name] === true);
}
