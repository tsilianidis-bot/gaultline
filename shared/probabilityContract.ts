/* ============================================================
   FAULTLINE scenario-probability contract (faultline-probability-contract-v1).

   One versioned record for every user-facing probability, scenario weight
   or model confidence. The server builds it from the stored canonical
   manifest (server/probabilityContract.ts); UIs and PLATO render only
   `claim.display.text` and never compute, re-scale or invent a percentage.

   Display rule (resolveProbabilityDisplay), checked in order:
     not offered                        → "Not offered"
     no value / no data / unavailable   → "Unavailable"
     partial inputs / stale             → "Insufficient data"
     not calibrated                     → "Uncalibrated"
     otherwise                          → "NN%"  (values are 0–100; never ×100)
   ============================================================ */
import type { HorizonBucket } from "./forecastMetadata";
import type { SystemicRegimeReading } from "./systemicRegime";

export const PROBABILITY_CONTRACT_VERSION = "faultline-probability-contract-v1" as const;

export type ProbabilityDisplayState = "AVAILABLE" | "UNCALIBRATED" | "INSUFFICIENT_DATA" | "UNAVAILABLE" | "NOT_OFFERED";
export type CalibrationStatus = "CALIBRATED" | "UNCALIBRATED" | "NOT_ASSESSED";
export type MissingDataStatus = "COMPLETE" | "PARTIAL" | "UNAVAILABLE";
export type ProbabilityFreshnessStatus = "CURRENT" | "DELAYED" | "STALE" | "UNAVAILABLE";
export type ProbabilityKind = "SCENARIO_WEIGHT" | "REGIME_POSTERIOR" | "TRANSITION_FREQUENCY" | "EVENT_PROBABILITY";

export const PROBABILITY_DISPLAY_TEXT: Record<Exclude<ProbabilityDisplayState, "AVAILABLE">, string> = {
  UNCALIBRATED: "Uncalibrated",
  INSUFFICIENT_DATA: "Insufficient data",
  UNAVAILABLE: "Unavailable",
  NOT_OFFERED: "Not offered",
};

export interface ProbabilityModelRef {
  modelId: string;
  modelVersion: string;
  kind: ProbabilityKind;
  methodology: string;
}

export interface HorizonClass {
  bucket: HorizonBucket;
  minDays: number | null;
  maxDays: number | null;
  description: string;
}

export interface ScenarioDefinition {
  scenarioId: string;
  label: string;
  /** What the number measures, stated plainly. */
  definition: string;
  /** Market-resolvable event; null when none has been registered. */
  eventDefinition: string | null;
  resolvable: boolean;
}

export interface CalibrationRecord {
  status: CalibrationStatus;
  metric: "ECE" | null;
  value: number | null;
  basis: string;
}

export interface ProbabilityDisplay {
  state: ProbabilityDisplayState;
  /** The only text a UI or LLM may render for this claim. */
  text: string;
  /** Integer percent, or null whenever a number must not be shown. */
  percent: number | null;
}

export interface ProbabilityClaim {
  contractVersion: typeof PROBABILITY_CONTRACT_VERSION;
  /** Stable across model versions (the version lives in model.modelVersion). */
  claimId: string;
  stateId: string | null;
  /** `${stateId}:${claimId}` — the governedIntelligenceClaims observation key. */
  claimObservationKey: string | null;
  scenario: ScenarioDefinition;
  horizon: HorizonClass;
  model: ProbabilityModelRef;
  evidenceBasis: string;
  freshness: { status: ProbabilityFreshnessStatus; asOf: string | null };
  missingData: { status: MissingDataStatus; missingInputs: string[] };
  calibration: CalibrationRecord;
  /** Raw 0–100 model output, retained for the ledger/validation only. Never render. */
  value: number | null;
  display: ProbabilityDisplay;
}

export interface ScenarioProbabilitySet {
  setId: string;
  model: ProbabilityModelRef;
  horizon: HorizonClass;
  scenarios: ProbabilityClaim[];
  /** Display state of the set as a whole (the most restrictive member state). */
  display: ProbabilityDisplay;
}

export interface CanonicalProbabilityContract {
  contractVersion: typeof PROBABILITY_CONTRACT_VERSION;
  stateId: string | null;
  generatedAt: string | null;
  scenarioSet: ScenarioProbabilitySet;
  systemicRegime: {
    crisis: ProbabilityClaim;
    stressBuilding: ProbabilityClaim;
    transition: ProbabilityClaim;
    regimeConfidence: ProbabilityClaim;
    stressScore: ProbabilityClaim;
  } | null;
  transitions: ProbabilityClaim[];
  notOffered: ProbabilityClaim[];
}

// ── Horizons ────────────────────────────────────────────────────────────────
export const HORIZON_NOT_ESTABLISHED: HorizonClass = {
  bucket: "NOT_ESTABLISHED",
  minDays: null,
  maxDays: null,
  description: "No forecast horizon has been registered or validated for this output.",
};

// ── Model registry ──────────────────────────────────────────────────────────
export const SCENARIO_MODEL_ID = "seismograph-evidence-vote";
const SCENARIO_METHODOLOGY_V1 =
  "Share of the state's Seismograph evidence packets whose signal is bullish/recovering, neutral, or bearish/stressed. A vote count, not a probability. Known defect: historical-analog similarity above 70 was voted as stress.";
/**
 * Scenario model reference for display metadata. Every current seismograph
 * version uses the v1 evidence vote (the analog-vote change is held for owner
 * approval; see HELD_CHANGES.md), so this always returns v1.
 */
export function scenarioModelForSeismographVersion(_seismographVersion: string | null | undefined): ProbabilityModelRef {
  return {
    modelId: SCENARIO_MODEL_ID,
    modelVersion: "seismograph-evidence-vote-v1",
    kind: "SCENARIO_WEIGHT",
    methodology: SCENARIO_METHODOLOGY_V1,
  };
}

export const TRANSITION_MODEL: ProbabilityModelRef = {
  modelId: "seismograph-transition-frequency",
  modelVersion: "seismograph-transition-v1",
  kind: "TRANSITION_FREQUENCY",
  methodology: "Historical frequency of regime change over 3-month forward windows among months within ±10 points of the current score; static 70/15/10/5 defaults when no sample exists.",
};

export const SYSTEMIC_REGIME_MODEL_ID = "systemic-regime-hmm";

/**
 * Out-of-sample crisis calibration of the live 2-state HMM.
 * Source: quant/systemic-regime/artifacts/fred_validation_report.json → byNStates.2.calibration.ece
 * (expanding-window OOS; train years never include the test year).
 */
export const SYSTEMIC_REGIME_CALIBRATION: CalibrationRecord = {
  status: "UNCALIBRATED",
  metric: "ECE",
  value: 0.5152,
  basis: "2-state HMM crisis-probability ECE 0.515 (expanding-window OOS, quant/systemic-regime/artifacts/fred_validation_report.json). Not calibrated.",
};

const NOT_CALIBRATED: CalibrationRecord = {
  status: "UNCALIBRATED",
  metric: null,
  value: null,
  basis: "No outcome-resolved forward record; governed claims are UNVERIFIED.",
};

const NOT_ASSESSED: CalibrationRecord = {
  status: "NOT_ASSESSED",
  metric: null,
  value: null,
  basis: "No governed model produces this probability.",
};

export const SCENARIO_DEFINITIONS: Record<"bull" | "neutral" | "bear", ScenarioDefinition> = {
  bull: {
    scenarioId: "bull",
    label: "Bull",
    definition: "Share of the state's evidence packets signalling bullish or recovering conditions.",
    eventDefinition: null,
    resolvable: false,
  },
  neutral: {
    scenarioId: "neutral",
    label: "Neutral",
    definition: "Share of the state's evidence packets signalling neutral conditions.",
    eventDefinition: null,
    resolvable: false,
  },
  bear: {
    scenarioId: "bear",
    label: "Bear",
    definition: "Share of the state's evidence packets signalling bearish or stressed conditions.",
    eventDefinition: null,
    resolvable: false,
  },
};

export const TRANSITION_DEFINITIONS: Record<"remainInRegime" | "transitionToElevated" | "transitionToLow" | "transitionToCrisis", ScenarioDefinition> = {
  remainInRegime: { scenarioId: "remainInRegime", label: "Remain in regime", definition: "Historical frequency of no regime change within 3 months among similar-pressure months.", eventDefinition: null, resolvable: false },
  transitionToElevated: { scenarioId: "transitionToElevated", label: "Transition to elevated", definition: "Historical frequency of a change to an elevated/high regime within 3 months among similar-pressure months.", eventDefinition: null, resolvable: false },
  transitionToLow: { scenarioId: "transitionToLow", label: "Transition to low", definition: "Historical frequency of a change to a lower regime within 3 months among similar-pressure months.", eventDefinition: null, resolvable: false },
  transitionToCrisis: { scenarioId: "transitionToCrisis", label: "Transition to crisis", definition: "Historical frequency of a change to a critical regime within 3 months among similar-pressure months.", eventDefinition: null, resolvable: false },
};

/** Event probabilities FAULTLINE does not offer: no governed model exists. */
export const NOT_OFFERED_EVENTS = {
  recession: "Recession probability",
  crash: "Crash probability",
  softLanding: "Soft-landing probability",
  stagflation: "Stagflation probability",
  altSeason: "Alt-season probability",
} as const;
export type NotOfferedEventId = keyof typeof NOT_OFFERED_EVENTS;

/** Generators that must never reach a user (kept for audit / tests). */
export const RETIRED_PROBABILITY_GENERATORS = [
  "unified-seismograph-3way (server/seismographUnified.ts computeProbabilities)",
  "unified-seismograph-5way (server/seismographUnified.ts compute5WayRegimeProbabilities)",
  "preflight-heuristic (server/preFlight.ts bull/bear/recession/crash)",
  "browser-engine (client/src/lib/engine.ts computeEngine probability)",
] as const;

// ── Display ─────────────────────────────────────────────────────────────────
function withheld(state: Exclude<ProbabilityDisplayState, "AVAILABLE">): ProbabilityDisplay {
  return { state, text: PROBABILITY_DISPLAY_TEXT[state], percent: null };
}

export function isProbabilityValue(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 100;
}

export function resolveProbabilityDisplay(input: {
  value: number | null | undefined;
  offered: boolean;
  calibration: CalibrationStatus;
  missingData: MissingDataStatus;
  freshness: ProbabilityFreshnessStatus;
}): ProbabilityDisplay {
  if (!input.offered) return withheld("NOT_OFFERED");
  if (!isProbabilityValue(input.value) || input.freshness === "UNAVAILABLE" || input.missingData === "UNAVAILABLE") return withheld("UNAVAILABLE");
  if (input.missingData === "PARTIAL" || input.freshness === "STALE") return withheld("INSUFFICIENT_DATA");
  if (input.calibration !== "CALIBRATED") return withheld("UNCALIBRATED");
  const percent = Math.round(input.value);
  return { state: "AVAILABLE", text: `${percent}%`, percent };
}

const DISPLAY_RANK: Record<ProbabilityDisplayState, number> = { NOT_OFFERED: 4, UNAVAILABLE: 3, INSUFFICIENT_DATA: 2, UNCALIBRATED: 1, AVAILABLE: 0 };

export function mostRestrictiveDisplay(displays: ProbabilityDisplay[]): ProbabilityDisplay {
  if (!displays.length) return withheld("UNAVAILABLE");
  const worst = displays.slice().sort((a, b) => DISPLAY_RANK[b.state] - DISPLAY_RANK[a.state])[0];
  return worst.state === "AVAILABLE" ? { state: "AVAILABLE", text: "Available", percent: null } : withheld(worst.state);
}

/** Render text for a claim (or a missing claim). The only sanctioned formatter. */
export function probabilityText(claim: Pick<ProbabilityClaim, "display"> | null | undefined): string {
  return claim?.display.text ?? PROBABILITY_DISPLAY_TEXT.UNAVAILABLE;
}

/** Percent for bars/widths: the displayed integer, or null when withheld. */
export function probabilityPercent(claim: Pick<ProbabilityClaim, "display"> | null | undefined): number | null {
  return claim?.display.state === "AVAILABLE" ? claim.display.percent : null;
}

// ── Claim builders (pure; shared by the server builder and display surfaces) ─
export function buildProbabilityClaim(input: {
  claimId: string;
  stateId: string | null;
  scenario: ScenarioDefinition;
  model: ProbabilityModelRef;
  horizon?: HorizonClass;
  evidenceBasis: string;
  freshness: { status: ProbabilityFreshnessStatus; asOf: string | null };
  missingData: { status: MissingDataStatus; missingInputs: string[] };
  calibration: CalibrationRecord;
  value: number | null | undefined;
  offered?: boolean;
}): ProbabilityClaim {
  const value = isProbabilityValue(input.value) ? input.value : null;
  const offered = input.offered ?? true;
  return {
    contractVersion: PROBABILITY_CONTRACT_VERSION,
    claimId: input.claimId,
    stateId: input.stateId,
    claimObservationKey: input.stateId ? `${input.stateId}:${input.claimId}` : null,
    scenario: input.scenario,
    horizon: input.horizon ?? HORIZON_NOT_ESTABLISHED,
    model: input.model,
    evidenceBasis: input.evidenceBasis,
    freshness: input.freshness,
    missingData: input.missingData,
    calibration: input.calibration,
    value,
    display: resolveProbabilityDisplay({ value, offered, calibration: input.calibration.status, missingData: input.missingData.status, freshness: input.freshness.status }),
  };
}

export function notOfferedClaim(eventId: NotOfferedEventId, stateId: string | null = null): ProbabilityClaim {
  return buildProbabilityClaim({
    claimId: `faultline.event.${eventId}`,
    stateId,
    scenario: { scenarioId: eventId, label: NOT_OFFERED_EVENTS[eventId], definition: `${NOT_OFFERED_EVENTS[eventId]} is not offered: no governed model produces it.`, eventDefinition: null, resolvable: false },
    model: { modelId: "none", modelVersion: "none", kind: "EVENT_PROBABILITY", methodology: "Not offered." },
    evidenceBasis: "None.",
    freshness: { status: "UNAVAILABLE", asOf: null },
    missingData: { status: "UNAVAILABLE", missingInputs: [] },
    calibration: NOT_ASSESSED,
    value: null,
    offered: false,
  });
}

function systemicFreshness(reading: Pick<SystemicRegimeReading, "freshnessStatus">): ProbabilityFreshnessStatus {
  return reading.freshnessStatus === "CURRENT" ? "CURRENT" : reading.freshnessStatus === "DELAYED" ? "DELAYED" : reading.freshnessStatus === "STALE" ? "STALE" : "UNAVAILABLE";
}

/** Systemic-regime HMM outputs as contract claims. Fractions (0–1) are converted to 0–100 here, once. */
export function systemicRegimeProbabilityClaims(
  reading: SystemicRegimeReading | null | undefined,
  stateId: string | null = null,
): NonNullable<CanonicalProbabilityContract["systemicRegime"]> | null {
  if (!reading) return null;
  const model: ProbabilityModelRef = {
    modelId: SYSTEMIC_REGIME_MODEL_ID,
    modelVersion: reading.modelVersion || "unavailable",
    kind: "REGIME_POSTERIOR",
    methodology: `${reading.nStates}-state Gaussian HMM over a PCA of credit, volatility and rates stress (${reading.modelType}).`,
  };
  const freshness = { status: systemicFreshness(reading), asOf: reading.dataAsOf ?? reading.computedAt ?? null };
  const unavailable = !reading.currentRegime || reading.freshnessStatus === "UNAVAILABLE";
  const missingData = { status: (unavailable ? "UNAVAILABLE" : "COMPLETE") as MissingDataStatus, missingInputs: [] as string[] };
  const fraction = (v: number | null | undefined) => (typeof v === "number" && Number.isFinite(v) ? v * 100 : null);
  const claim = (claimId: string, label: string, definition: string, value: number | null) => buildProbabilityClaim({
    claimId: `systemic-regime.${claimId}`,
    stateId,
    scenario: { scenarioId: claimId, label, definition, eventDefinition: null, resolvable: false },
    model,
    evidenceBasis: `Systemic Regime inference, data through ${reading.dataAsOf ?? "unknown"}.`,
    freshness,
    missingData,
    calibration: SYSTEMIC_REGIME_CALIBRATION,
    value,
  });
  return {
    crisis: claim("crisis", "Crisis p", "HMM posterior weight on the crisis state for the latest scored day.", fraction(reading.crisisProbability)),
    stressBuilding: claim("stressBuilding", "Stress building", "HMM posterior weight on the stress-building state for the latest scored day.", fraction(reading.stressBuildingProbability)),
    transition: claim("transition", "Transition", "HMM probability of leaving the current state on the next step.", fraction(reading.transitionProbability)),
    regimeConfidence: claim("regimeConfidence", "Model score", "HMM posterior weight on its current state (model fit, not accuracy).", fraction(reading.regimeConfidence)),
    stressScore: claim("stressScore", "Stress", "100 × (crisis posterior + 0.5 × stress-building posterior).", typeof reading.systemicRiskScore === "number" ? reading.systemicRiskScore : null),
  };
}
