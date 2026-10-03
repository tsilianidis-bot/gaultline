/**
 * Display text for scenario / transition probabilities read from a canonical
 * state's probability contract (shared/probabilityContract). Display only.
 *
 * Crash, drawdown and recession probabilities are never offered: no governed
 * model with a defined event, horizon and calibration record exists. They
 * render CRASH_RISK_DISPLAY_TEXT ("Not offered") and are never derived from the
 * pressure score (e.g. pressure × 0.85) or from the bear scenario weight.
 */
import {
  PROBABILITY_DISPLAY_TEXT,
  probabilityPercent,
  probabilityText,
  type CanonicalProbabilityContract,
  type ProbabilityClaim,
} from "@shared/probabilityContract";

export const CRASH_RISK_DISPLAY_TEXT = PROBABILITY_DISPLAY_TEXT.NOT_OFFERED;

type ContractLike = Pick<CanonicalProbabilityContract, "scenarioSet" | "transitions"> | null | undefined;

export function contractScenarioClaim(contract: ContractLike, scenarioId: "bull" | "neutral" | "bear"): ProbabilityClaim | null {
  return contract?.scenarioSet?.scenarios?.find(c => c.scenario.scenarioId === scenarioId) ?? null;
}

export function contractTransitionClaim(contract: ContractLike, scenarioId: string): ProbabilityClaim | null {
  return contract?.transitions?.find(c => c.scenario.scenarioId === scenarioId) ?? null;
}

/** "Uncalibrated" / "Unavailable" / … or "43%" only when the contract marks the claim AVAILABLE. */
export function contractScenarioText(contract: ContractLike, scenarioId: "bull" | "neutral" | "bear"): string {
  return probabilityText(contractScenarioClaim(contract, scenarioId));
}

export { probabilityPercent, probabilityText };
