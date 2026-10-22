/* Probability / scenario normalization contract (shared/probabilityContract.ts,
   server/probabilityContract.ts). A probability number renders only when its
   model is CALIBRATED and its data are complete and fresh. */
import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import {
  NOT_OFFERED_EVENTS,
  PROBABILITY_DISPLAY_TEXT,
  RETIRED_PROBABILITY_GENERATORS,
  buildProbabilityClaim,
  mostRestrictiveDisplay,
  notOfferedClaim,
  probabilityPercent,
  probabilityText,
  resolveProbabilityDisplay,
  scenarioModelForSeismographVersion,
  systemicRegimeProbabilityClaims,
  SCENARIO_DEFINITIONS,
  type CalibrationRecord,
} from "../shared/probabilityContract";
import { buildCanonicalProbabilityContract } from "./probabilityContract";
import { assembleCanonicalMarketState } from "./marketStateService";
import { regimeModelScoreDisplay } from "../shared/credibilityLabels";
import { mergeCanonicalMarketState } from "../client/src/lib/canonicalNowProjection";
import { selectBrowserMarketOutput, engineProbabilityText } from "../client/src/lib/marketStateProjection";
import { DEFAULT_INDICATORS } from "../client/src/lib/engine";
import type { SystemicRegimeReading } from "../shared/systemicRegime";

const fixtureDir = join(__dirname, "__fixtures__", "prod-2026-10-01");
const prodCanonical = JSON.parse(readFileSync(join(fixtureDir, "canonical-current.json"), "utf8"));
const prodMarketState = JSON.parse(readFileSync(join(fixtureDir, "market-state-current.json"), "utf8"));


/** A stored-manifest shape built from the 2026-10-01 production canonical state. */
function prodManifest(overrides: Record<string, unknown> = {}) {
  return {
    stateId: prodCanonical.stateId,
    generatedAt: prodCanonical.generatedAt,
    modelVersion: prodCanonical.modelVersion,
    scenarioOutputs: prodCanonical.scenarioOutputs,
    staleInputs: prodCanonical.staleInputs,
    delayedInputs: prodCanonical.delayedInputs,
    unavailableInputs: prodCanonical.unavailableInputs,
    fallbackInputs: prodCanonical.fallbackInputs,
    coherenceStatus: "COHERENT",
    ...overrides,
  };
}

const CALIBRATED: CalibrationRecord = { status: "CALIBRATED", metric: "ECE", value: 0.02, basis: "test" };
const UNCALIBRATED: CalibrationRecord = { status: "UNCALIBRATED", metric: null, value: null, basis: "test" };

describe("display rule", () => {
  const base = { value: 43, offered: true, calibration: "CALIBRATED" as const, missingData: "COMPLETE" as const, freshness: "CURRENT" as const };

  it("renders a number only when calibrated, complete and fresh", () => {
    expect(resolveProbabilityDisplay(base)).toEqual({ state: "AVAILABLE", text: "43%", percent: 43 });
    expect(resolveProbabilityDisplay({ ...base, freshness: "DELAYED" }).state).toBe("AVAILABLE");
  });

  it("orders the withheld states: not offered → unavailable → insufficient → uncalibrated", () => {
    expect(resolveProbabilityDisplay({ ...base, offered: false }).text).toBe("Not offered");
    expect(resolveProbabilityDisplay({ ...base, value: null }).text).toBe("Unavailable");
    expect(resolveProbabilityDisplay({ ...base, value: Number.NaN }).text).toBe("Unavailable");
    expect(resolveProbabilityDisplay({ ...base, missingData: "UNAVAILABLE" }).text).toBe("Unavailable");
    expect(resolveProbabilityDisplay({ ...base, missingData: "PARTIAL" }).text).toBe("Insufficient data");
    expect(resolveProbabilityDisplay({ ...base, freshness: "STALE" }).text).toBe("Insufficient data");
    expect(resolveProbabilityDisplay({ ...base, calibration: "UNCALIBRATED" }).text).toBe("Uncalibrated");
    expect(resolveProbabilityDisplay({ ...base, calibration: "UNCALIBRATED", missingData: "PARTIAL" }).text).toBe("Insufficient data");
    for (const state of ["NOT_OFFERED", "UNAVAILABLE", "INSUFFICIENT_DATA", "UNCALIBRATED"] as const) {
      expect(PROBABILITY_DISPLAY_TEXT[state]).not.toMatch(/\d/);
    }
  });

  it("never returns a percent for a withheld claim and picks the most restrictive set state", () => {
    const claim = buildProbabilityClaim({
      claimId: "x", stateId: "s", scenario: SCENARIO_DEFINITIONS.bull, model: scenarioModelForSeismographVersion("2.1"),
      evidenceBasis: "e", freshness: { status: "CURRENT", asOf: null }, missingData: { status: "COMPLETE", missingInputs: [] },
      calibration: UNCALIBRATED, value: 43,
    });
    expect(claim.value).toBe(43);
    expect(probabilityPercent(claim)).toBeNull();
    expect(probabilityText(claim)).toBe("Uncalibrated");
    expect(probabilityText(null)).toBe("Unavailable");
    expect(claim.claimObservationKey).toBe("s:x");
    const available = { ...claim, display: resolveProbabilityDisplay({ ...base }) };
    expect(probabilityPercent(available)).toBe(43);
    expect(mostRestrictiveDisplay([available.display, claim.display]).text).toBe("Uncalibrated");
    expect(buildProbabilityClaim({ ...claim, scenario: claim.scenario, model: claim.model, calibration: CALIBRATED, value: 43 }).display.text).toBe("43%");
  });
});

describe("canonical contract on the 2026-10-01 production state", () => {
  const contract = buildCanonicalProbabilityContract(prodManifest());

  it("withholds the 43/43/14 scenario set as Uncalibrated, bound to the stateId", () => {
    expect(contract.stateId).toBe(prodCanonical.stateId);
    expect(contract.scenarioSet.scenarios.map(c => c.value)).toEqual([43, 43, 14]);
    expect(contract.scenarioSet.scenarios.map(c => c.display.text)).toEqual(["Uncalibrated", "Uncalibrated", "Uncalibrated"]);
    expect(contract.scenarioSet.display.text).toBe("Uncalibrated");
    expect(contract.scenarioSet.scenarios.every(c => c.horizon.bucket === "NOT_ESTABLISHED")).toBe(true);
    expect(contract.scenarioSet.scenarios[0].claimObservationKey).toBe(`${prodCanonical.stateId}:seismograph.scenario.bull`);
  });

  it("shows Insufficient data when inputs are stale or fall back", () => {
    expect(buildCanonicalProbabilityContract(prodManifest({ staleInputs: ["fred:DGS10"] })).scenarioSet.display.text).toBe("Insufficient data");
    expect(buildCanonicalProbabilityContract(prodManifest({ fallbackInputs: ["x"] })).scenarioSet.display.text).toBe("Insufficient data");
    expect(buildCanonicalProbabilityContract(prodManifest({ scenarioOutputs: null })).scenarioSet.display.text).toBe("Unavailable");
    expect(buildCanonicalProbabilityContract(null).scenarioSet.display.text).toBe("Unavailable");
  });

  it("marks transitions Unavailable and the five event probabilities Not offered", () => {
    expect(contract.transitions.map(c => c.display.text)).toEqual(["Unavailable", "Unavailable", "Unavailable", "Unavailable"]);
    expect(contract.notOffered.map(c => c.scenario.scenarioId).sort()).toEqual(Object.keys(NOT_OFFERED_EVENTS).sort());
    expect(contract.notOffered.every(c => c.display.text === "Not offered")).toBe(true);
    expect(notOfferedClaim("crash").display.percent).toBeNull();
  });

  it("labels the current evidence vote as model v1 for every seismograph version (methodology unchanged)", () => {
    expect(scenarioModelForSeismographVersion("2.0").modelVersion).toBe("seismograph-evidence-vote-v1");
    expect(scenarioModelForSeismographVersion("2.1").modelVersion).toBe("seismograph-evidence-vote-v1");
    expect(contract.scenarioSet.model.modelVersion).toBe("seismograph-evidence-vote-v1");
    expect(RETIRED_PROBABILITY_GENERATORS.length).toBeGreaterThan(0);
  });
});

describe("systemic regime HMM (ECE 0.5152)", () => {
  const reading = {
    currentRegime: "CALM", nStates: 2, modelType: "pca-hmm", modelVersion: "systemic-regime-v1",
    crisisProbability: 0.0021, stressBuildingProbability: 0.01, transitionProbability: 0.03, regimeConfidence: 0.996,
    systemicRiskScore: 1, freshnessStatus: "CURRENT", dataAsOf: "2026-09-30", computedAt: "2026-10-01T19:00:00.000Z",
  } as unknown as SystemicRegimeReading;

  it("is Uncalibrated, never 0% from a 0–1 fraction", () => {
    const claims = systemicRegimeProbabilityClaims(reading)!;
    expect(claims.crisis.value).toBeCloseTo(0.21, 5);
    expect(claims.regimeConfidence.value).toBeCloseTo(99.6, 5);
    for (const claim of Object.values(claims)) {
      expect(claim.display.text).toBe("Uncalibrated");
      expect(claim.calibration.value).toBe(0.5152);
    }
    expect(regimeModelScoreDisplay(reading, false).value).toBe("Uncalibrated");
    expect(systemicRegimeProbabilityClaims({ ...reading, freshnessStatus: "UNAVAILABLE", currentRegime: null } as never)!.crisis.display.text).toBe("Unavailable");
  });
});

describe("MarketState overlay and client projections", () => {
  const contract = buildCanonicalProbabilityContract(prodManifest());
  const options = { generatedAt: "2026-10-01T18:05:00.000Z", cacheStatus: "fresh-cache" as const, cacheAgeMs: 0 };

  it("assembleCanonicalMarketState sets NaN for withheld numbers and carries the contract", () => {
    const src = {
      currentScore: 30, currentRegime: "Moderate Risk", currentStressLevel: "Elevated", currentDirection: "Stable", currentPercentile: 50,
      dataFreshness: "live", lastUpdated: "2026-10-01T18:00:00.000Z", providerProvenance: { fred: { status: "live", detail: "FRED", asOf: Date.parse("2026-10-01T18:00:00.000Z") } }, todayStory: "s", keyDevelopments: [],
      whyThisScore: "w", whyThisRegime: "r",
      probabilities: { bull: 64, neutral: 21, bear: 15, confidence: 50, primaryDriver: "p", evidenceBasis: "e", historicalBasis: "h" },
      evidenceFamilies: [], evidenceConsensus: "weak", topAnalog: null, analogSummary: "a",
      transitionProbabilities: { remainInRegime: 70, transitionToElevated: 15, transitionToLow: 10, transitionToCrisis: 5, confidence: 40, historicalBasis: "h", currentEvidence: [] },
      evolution: { whatChanged: [], whatToWatch: [], accelerating: false, buildingPressure: false, invalidationConditions: [] },
      memory: { observationCount: 1, datasetSpan: "x", currentStreakDescription: "x", lastMajorShift: "x" },
      regimeProbabilities5way: { bull: 53, softLanding: 33, stagflation: 8, recession: 4, crash: 2 },
      developingConditions: [], marketNarrative: { whatIsHappening: "", whyIsItHappening: "", whatHasChanged: "", whatIsBuildingBeneathSurface: "", highestProbabilityPath: "The most frequent historical outcome (frequency withheld: uncalibrated) is continuation.", whatWouldInvalidate: "" },
      activePatterns: [],
    } as never;
    const state = assembleCanonicalMarketState(src, { ...options, probabilityContract: contract });
    expect(state.outlook.probabilities.bull).toBeNaN();
    expect(state.outlook.probabilities.bear).toBeNaN();
    expect(state.outlook.probabilities.confidence).toBeNaN();
    expect(Object.values(state.outlook.regimeProbabilities).every(Number.isNaN)).toBe(true);
    expect(state.outlook.transitionProbabilities.transitionToCrisis).toBeNaN();
    expect(state.outlook.probabilityContract?.stateId).toBe(prodCanonical.stateId);
    expect(state.outlook.highestProbabilityPath).not.toMatch(/\d+%/);
    expect(state.act.marketPosture).toBe("balanced");
    // No contract (canonical state unavailable) withholds every number too.
    const none = assembleCanonicalMarketState(src, options);
    expect(none.outlook.probabilities.bull).toBeNaN();
    expect(none.outlook.probabilityContract).toBeNull();
    // Posture is a calculated output and still reads the source weights (unchanged
    // calculation): Low stress + source bull 64 stays "opportunistic" even though
    // the displayed bull is withheld.
    const low = assembleCanonicalMarketState({ ...(src as object), currentStressLevel: "Low" } as never, { ...options, probabilityContract: contract });
    expect(low.outlook.probabilities.bull).toBeNaN();
    expect(low.act.marketPosture).toBe("opportunistic");
  });

  it("merge + browser projection carry contract text, never numbers or the 5300% defect", () => {
    const legacy = { ...prodMarketState, outlook: { ...prodMarketState.outlook, probabilityContract: null } };
    const canonical = { ...prodCanonical, probabilityContract: contract };
    const merged = mergeCanonicalMarketState(canonical, legacy)!;
    expect(merged.outlook.probabilities.bull).toBeNaN();
    expect(Object.values(merged.outlook.regimeProbabilities).every(Number.isNaN)).toBe(true);
    expect(merged.outlook.transitionProbabilities.transitionToCrisis).toBeNaN();
    expect(merged.outlook.probabilityContract?.scenarioSet.display.text).toBe("Uncalibrated");

    const canonicalOut = selectBrowserMarketOutput({ marketState: merged, baselineIndicators: DEFAULT_INDICATORS, simulationOverrides: {} });
    expect(canonicalOut.mode).toBe("canonical");
    expect(Object.values(canonicalOut.output.probability).every(Number.isNaN)).toBe(true);
    expect(engineProbabilityText(canonicalOut.output, "bullProbability")).toBe("Uncalibrated");
    expect(engineProbabilityText(canonicalOut.output, "crashProbability")).toBe("Not offered");
    expect(engineProbabilityText(canonicalOut.output, "recessionProbability")).toBe("Not offered");

    const fallback = selectBrowserMarketOutput({ marketState: null, baselineIndicators: DEFAULT_INDICATORS, simulationOverrides: {} });
    expect(engineProbabilityText(fallback.output, "bullProbability")).toBe("Unavailable");
    expect(Object.values(fallback.output.probability).every(Number.isNaN)).toBe(true);
    const sim = selectBrowserMarketOutput({ marketState: merged, baselineIndicators: DEFAULT_INDICATORS, simulationOverrides: { vix: 40 } as never });
    expect(engineProbabilityText(sim.output, "bullProbability")).toBe("Uncalibrated");
    expect(engineProbabilityText(sim.output, "crashProbability")).toBe("Not offered");
  });
});

describe("static scan: owned live surfaces render no raw probability number", () => {
  const root = join(__dirname, "..", "client", "src");
  const owned = [
    "pages/Dashboard.tsx", "pages/Outlook.tsx", "pages/Act.tsx",
    "components/AshaHeroSection.tsx", "components/ShareCard.tsx", "components/MarketSynthesisPanel.tsx",
    "components/MarketPreflight.tsx", "components/MarketContextStrip.tsx", "components/SystemicRegimeModule.tsx",
    "components/dashboard/PulseMode.tsx", "components/dashboard/IntelligenceMode.tsx", "components/dashboard/FaultlineInterpretation.tsx",
  ];
  it.each(owned)("%s", file => {
    const src = readFileSync(join(root, file), "utf8");
    expect(src).not.toMatch(/\$\{[^}]*Probabilit(y|ies)[^}]*\}%/);
    expect(src).not.toMatch(/\{[^}]*\.(bull|crash|recession|stagflation|softLanding)Probability\}%/);
    expect(src).not.toMatch(/(Probability|probability|crisisProbability)\s*\*\s*100/);
    expect(src).not.toMatch(/Math\.round\(value \* 100\)/);
  });

  it("the scan list exists", () => {
    for (const file of owned) expect(statSync(join(root, file)).isFile()).toBe(true);
    expect(readdirSync(root).length).toBeGreaterThan(0);
  });
});
