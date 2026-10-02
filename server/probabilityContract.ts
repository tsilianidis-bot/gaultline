/* ============================================================
   The ONE server source of the scenario-probability contract.

   buildCanonicalProbabilityContract is a pure function of a stored
   intelligenceStateManifests.manifestJson. It is called only from
   buildCanonicalIntelligenceState, so every reader (canonicalCurrent,
   evidenceCurrent, the legacy marketState overlay PLATO reads) gets the
   same stateId-bound record. Old manifests resolve to their own model
   version; nothing stored is rewritten.
   ============================================================ */
import {
  PROBABILITY_CONTRACT_VERSION,
  SCENARIO_DEFINITIONS,
  TRANSITION_DEFINITIONS,
  TRANSITION_MODEL,
  buildProbabilityClaim,
  mostRestrictiveDisplay,
  notOfferedClaim,
  probabilityPercent,
  scenarioModelForSeismographVersion,
  systemicRegimeProbabilityClaims,
  type CanonicalProbabilityContract,
  type CalibrationRecord,
  type MissingDataStatus,
  type NotOfferedEventId,
  type ProbabilityClaim,
  type ProbabilityFreshnessStatus,
} from "../shared/probabilityContract";
import type { SystemicRegimeReading } from "../shared/systemicRegime";

type StoredManifest = Record<string, any>;

const SCENARIO_CALIBRATION: CalibrationRecord = {
  status: "UNCALIBRATED",
  metric: null,
  value: null,
  basis: "Derived scenario score. No registered event, horizon or outcome-resolved forward record; governed scenario claims are UNVERIFIED.",
};

const NOT_OFFERED_IDS: NotOfferedEventId[] = ["recession", "crash", "softLanding", "stagflation", "altSeason"];

function list(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function scenarioMissingData(manifest: StoredManifest): { status: MissingDataStatus; missingInputs: string[] } {
  const outputs = manifest.scenarioOutputs;
  const hasAll = outputs && ["bull", "neutral", "bear"].every(key => typeof outputs[key] === "number" && Number.isFinite(outputs[key]));
  if (!hasAll) return { status: "UNAVAILABLE", missingInputs: ["scenarioOutputs"] };
  const unavailable = list(manifest.unavailableInputs);
  const fallback = list(manifest.fallbackInputs);
  const incoherent = manifest.coherenceStatus && manifest.coherenceStatus !== "COHERENT";
  const missingInputs = [...unavailable, ...fallback, ...(incoherent ? [`coherence:${manifest.coherenceStatus}`] : [])];
  return { status: missingInputs.length ? "PARTIAL" : "COMPLETE", missingInputs };
}

function scenarioFreshness(manifest: StoredManifest): { status: ProbabilityFreshnessStatus; asOf: string | null } {
  const asOf = typeof manifest.generatedAt === "string" ? manifest.generatedAt : null;
  if (!asOf) return { status: "UNAVAILABLE", asOf };
  if (list(manifest.staleInputs).length) return { status: "STALE", asOf };
  const inputQuality = Array.isArray(manifest.inputQuality) ? manifest.inputQuality : [];
  const delayed = inputQuality.some((input: any) => input?.freshnessStatus === "DELAYED");
  return { status: delayed ? "DELAYED" : "CURRENT", asOf };
}

export function buildCanonicalProbabilityContract(manifest: StoredManifest | null | undefined): CanonicalProbabilityContract {
  const stateId = typeof manifest?.stateId === "string" ? manifest.stateId : null;
  const generatedAt = typeof manifest?.generatedAt === "string" ? manifest.generatedAt : null;
  const m = manifest ?? {};
  const model = scenarioModelForSeismographVersion(m.modelVersion);
  const freshness = scenarioFreshness(m);
  const missingData = scenarioMissingData(m);
  const evidenceBasis = Array.isArray(m.domainValues?.activeContributors) && m.domainValues.activeContributors.length
    ? `Evidence packets from: ${m.domainValues.activeContributors.join(", ")}.`
    : "Seismograph evidence packets recorded with the state.";
  const scenarios = (["bull", "neutral", "bear"] as const).map(key => buildProbabilityClaim({
    claimId: `seismograph.scenario.${key}`,
    stateId,
    scenario: SCENARIO_DEFINITIONS[key],
    model,
    evidenceBasis,
    freshness,
    missingData,
    calibration: SCENARIO_CALIBRATION,
    value: m.scenarioOutputs?.[key],
  }));
  const transitions = (Object.keys(TRANSITION_DEFINITIONS) as Array<keyof typeof TRANSITION_DEFINITIONS>).map(key => buildProbabilityClaim({
    claimId: `seismograph.transition.${key}`,
    stateId,
    scenario: TRANSITION_DEFINITIONS[key],
    model: TRANSITION_MODEL,
    evidenceBasis: "Transition components are not part of the state manifest; the assembled values fall back to static 70/15/10/5 defaults when no state history exists.",
    freshness,
    missingData: { status: "UNAVAILABLE", missingInputs: ["transitionProbabilities"] },
    calibration: SCENARIO_CALIBRATION,
    value: null,
  }));
  const reading = (m.domainValues?.systemicRegime ?? null) as SystemicRegimeReading | null;
  return {
    contractVersion: PROBABILITY_CONTRACT_VERSION,
    stateId,
    generatedAt,
    scenarioSet: {
      setId: `seismograph.scenario-set:${model.modelVersion}`,
      model,
      horizon: scenarios[0].horizon,
      scenarios,
      display: mostRestrictiveDisplay(scenarios.map(s => s.display)),
    },
    systemicRegime: systemicRegimeProbabilityClaims(reading, stateId),
    transitions,
    notOffered: NOT_OFFERED_IDS.map(id => notOfferedClaim(id, stateId)),
  };
}

// ── Response overlay for legacy seismograph payloads ────────────────────────
// seismograph.getAssembledOutput and seismograph.getUnifiedIntelligence return
// engine objects whose scenario, 5-way and transition fields were rendered as
// raw percentages. The engines still compute (and internally consume) those
// numbers unchanged; only the public tRPC response is overlaid here, so every
// number a client can read is the contract's displayed percent or null.

function contractPercentOrNull(claim: ProbabilityClaim | null | undefined): number | null {
  return probabilityPercent(claim);
}

function scenarioPercent(contract: CanonicalProbabilityContract | null | undefined, id: "bull" | "neutral" | "bear"): number | null {
  return contractPercentOrNull(contract?.scenarioSet.scenarios.find(claim => claim.scenario.scenarioId === id));
}

function transitionPercent(contract: CanonicalProbabilityContract | null | undefined, id: keyof typeof TRANSITION_DEFINITIONS): number | null {
  return contractPercentOrNull(contract?.transitions.find(claim => claim.scenario.scenarioId === id));
}

type ScenarioKey = "bull" | "neutral" | "bear" | "confidence";
type TransitionKey = "remainInRegime" | "transitionToElevated" | "transitionToLow" | "transitionToCrisis" | "confidence";

/** P with every scenario / transition number widened to `number | null` (withheld unless AVAILABLE). */
export type ContractWithheld<P> = {
  [K in keyof P]: K extends "probabilities"
    ? { [Q in keyof P[K]]: Q extends ScenarioKey ? number | null : P[K][Q] }
    : K extends "transitionProbabilities"
    ? { [Q in keyof P[K]]: Q extends TransitionKey ? number | null : P[K][Q] }
    : K extends "regimeProbabilities5way"
    ? { [Q in keyof P[K]]: null }
    : P[K];
};

function overlayPayload<P extends object>(payload: P, contract: CanonicalProbabilityContract | null | undefined): ContractWithheld<P> {
  const out: Record<string, any> = { ...payload };
  if (out.probabilities && typeof out.probabilities === "object") {
    out.probabilities = {
      ...out.probabilities,
      bull: scenarioPercent(contract, "bull"),
      neutral: scenarioPercent(contract, "neutral"),
      bear: scenarioPercent(contract, "bear"),
      // Forecast confidence is not calibrated; never offered.
      ...("confidence" in out.probabilities ? { confidence: null } : {}),
    };
  }
  if (out.transitionProbabilities && typeof out.transitionProbabilities === "object") {
    out.transitionProbabilities = {
      ...out.transitionProbabilities,
      remainInRegime: transitionPercent(contract, "remainInRegime"),
      transitionToElevated: transitionPercent(contract, "transitionToElevated"),
      transitionToLow: transitionPercent(contract, "transitionToLow"),
      transitionToCrisis: transitionPercent(contract, "transitionToCrisis"),
      ...("confidence" in out.transitionProbabilities ? { confidence: null } : {}),
    };
  }
  if (out.regimeProbabilities5way && typeof out.regimeProbabilities5way === "object") {
    // The retired 5-way split (bull / soft landing / stagflation / recession / crash) is NOT_OFFERED.
    out.regimeProbabilities5way = Object.fromEntries(Object.keys(out.regimeProbabilities5way).map(key => [key, null]));
  }
  return out as ContractWithheld<P>;
}

const ASSEMBLED_PAYLOAD_KEYS = ["forDashboard", "forASHA", "forDailyBrief", "forAlerts", "forStockPages", "forReports"] as const;

/** seismograph.getAssembledOutput response: top level and every distribution payload overlaid. */
export function overlayAssembledSeismographOutput<O extends object>(output: O, contract: CanonicalProbabilityContract | null | undefined) {
  const out: Record<string, any> = overlayPayload(output, contract);
  for (const key of ASSEMBLED_PAYLOAD_KEYS) {
    if (out[key] && typeof out[key] === "object") out[key] = overlayPayload(out[key], contract);
  }
  return { ...(out as { [K in keyof O]: K extends (typeof ASSEMBLED_PAYLOAD_KEYS)[number] ? ContractWithheld<O[K]> : ContractWithheld<O>[K] }), probabilityContract: contract ?? null };
}

/** seismograph.getUnifiedIntelligence response overlay. */
export function overlayUnifiedSeismographIntelligence<U extends object>(intel: U, contract: CanonicalProbabilityContract | null | undefined) {
  return { ...overlayPayload(intel, contract), probabilityContract: contract ?? null };
}
