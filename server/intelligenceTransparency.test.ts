/**
 * Intelligence transparency — contribution math, evidence contract, demotion.
 * Read-only versus Champion weights / engine; no methodology changes.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { CHAMPION_VECTOR_WEIGHTS } from "./pressure/championBaseline";
import type { CanonicalIntelligenceState } from "../shared/canonicalIntelligenceState";
import {
  buildIntelligenceTransparency,
  championWeightsFromBaseline,
  contributionMathMatchesWeights,
  demoteProbabilityPair,
  demotionIssues,
  directionPosture,
  mapFreshnessBadge,
  unavailableCitedAsDriver,
  unavailableNamedAsContributor,
  INTELLIGENCE_VECTOR_IDS,
} from "../shared/intelligenceTransparency";
import { PROBABILITY_DISPLAY_TEXT } from "../shared/probabilityContract";

const WEIGHTS = championWeightsFromBaseline(CHAMPION_VECTOR_WEIGHTS);
const here = dirname(fileURLToPath(import.meta.url));

function engine(
  engineId: string,
  value: number | null,
  extras: Partial<CanonicalIntelligenceState["engines"][number]> = {},
): CanonicalIntelligenceState["engines"][number] {
  return {
    engineId,
    engineName: engineId,
    value,
    unit: "score_0_to_100",
    classification: null,
    direction: "Stable",
    acceleration: null,
    persistence: null,
    observedAt: null,
    calculatedAt: "2026-10-04T18:03:10.085Z",
    sourceInputIds: extras.sourceInputIds ?? [],
    qualityStatus: value == null ? "UNAVAILABLE" : "PARTIAL",
    freshnessStatus: "CURRENT",
    fallbackStatus: "NONE",
    modelVersion: "champion-v1-frozen",
    calculationVersion: "faultline-pressure-v1-frozen",
    contributionToComposite: true,
    ...extras,
  };
}

function liveLikeState(over: Partial<CanonicalIntelligenceState> = {}): CanonicalIntelligenceState {
  return {
    schemaVersion: "phase2-canonical-state-v1",
    stateId: "state:test-intel-transparency",
    generatedAt: "2026-10-04T18:03:10.085Z",
    effectiveAt: "2026-10-04T18:03:10.085Z",
    calculationStartedAt: null,
    calculationCompletedAt: "2026-10-04T18:03:10.085Z",
    championVersion: "champion-v1-frozen",
    modelVersion: "2.0",
    scoringVersion: "faultline-pressure-v1-frozen",
    configurationVersion: "phase1b-governance-v1",
    inputSnapshotId: "input:test",
    stateHash: "hash:test",
    regime: "MODERATE RISK",
    pressureIndex: 34,
    pressureLevel: "MODERATE RISK",
    pressureDirection: "Stable",
    pressureAcceleration: null,
    pressurePersistence: null,
    engines: [
      engine("liquidity-stress", 23, {
        freshnessStatus: "CURRENT",
        sourceInputIds: ["hy_credit_spread", "secured_overnight_financing_rate"],
      }),
      engine("credit-contagion", 23, {
        freshnessStatus: "DELAYED",
        sourceInputIds: ["hy_credit_spread", "ten_year_treasury_yield", "unemployment_rate"],
      }),
      engine("volatility-regime", 40, {
        freshnessStatus: "DELAYED",
        sourceInputIds: ["ten_year_treasury_yield", "two_year_treasury_yield"],
      }),
      engine("macro-sensitivity", 44, {
        freshnessStatus: "DELAYED",
        sourceInputIds: ["consumer_price_index_yoy", "producer_price_index_yoy", "federal_funds_rate"],
      }),
      engine("market-breadth", 29, {
        freshnessStatus: "DELAYED",
        sourceInputIds: ["ten_year_treasury_yield", "unemployment_rate"],
      }),
      engine("ai-bubble", 44, {
        freshnessStatus: "CURRENT",
        direction: "Unknown",
        sourceInputIds: ["ai_concentration_static_baseline"],
      }),
    ],
    domains: {},
    scenarioOutputs: {},
    probabilityClaimIds: [],
    analogClaimIds: [],
    historicalContext: {
      canonicalLiveHistory: "test",
      reconstructedResearch: "test",
      historicalAnalogOutput: "test",
      patternResolution: "test",
    },
    dataQualitySummary: {},
    confidenceOrEvidenceQuality: "PARTIAL",
    staleInputs: [],
    delayedInputs: [
      "ten_year_treasury_yield",
      "consumer_price_index_yoy",
      "producer_price_index_yoy",
      "federal_funds_rate",
      "unemployment_rate",
    ],
    unavailableInputs: [],
    fallbackInputs: [],
    warnings: [],
    conflicts: [],
    historicalDatasetVersion: "legacy-317-unreconciled",
    researchDatasetVersion: "reconstructed-research",
    provenance: {
      manifestSource: "intelligenceStateManifests",
      governanceVersion: "phase1b-governance-v1",
      coherenceStatus: "MIXED_FRESHNESS",
    },
    ...over,
  };
}

describe("intelligence transparency contribution math", () => {
  it("matches Champion V1 engine weights exactly (read-only)", () => {
    expect(WEIGHTS["liquidity-stress"]).toBe(CHAMPION_VECTOR_WEIGHTS.liquidityStress);
    expect(WEIGHTS["credit-contagion"]).toBe(CHAMPION_VECTOR_WEIGHTS.creditContagion);
    expect(WEIGHTS["volatility-regime"]).toBe(CHAMPION_VECTOR_WEIGHTS.volatilityRegime);
    expect(WEIGHTS["macro-sensitivity"]).toBe(CHAMPION_VECTOR_WEIGHTS.macroSensitivity);
    expect(WEIGHTS["market-breadth"]).toBe(CHAMPION_VECTOR_WEIGHTS.marketBreadth);
    expect(WEIGHTS["ai-bubble"]).toBe(CHAMPION_VECTOR_WEIGHTS.aiBubble);
    expect(Object.values(WEIGHTS).reduce((a, b) => a + b, 0)).toBeCloseTo(1, 10);
  });

  it("reconciles live-shaped 34 from weighted components (not a simple average)", () => {
    const model = buildIntelligenceTransparency(liveLikeState(), WEIGHTS);
    expect(model.status).toBe("ready");
    expect(model.pressureIndex).toBe(34);
    expect(model.howBuilt?.weightedSum).toBe(33.5);
    expect(model.howBuilt?.roundedScore).toBe(34);
    expect(model.howBuilt?.reconciles).toBe(true);
    expect(model.howBuilt?.methodNote).toMatch(/not a simple average/i);
    expect(contributionMathMatchesWeights(model.components, WEIGHTS)).toBe(true);

    const avg5 =
      (44 + 40 + 29 + 23 + 23) / 5;
    expect(avg5).not.toBe(34);
    expect(model.howBuilt?.explanation).toMatch(/HOW 34 IS BUILT/);
    expect(model.howBuilt?.explanation).toMatch(/AI \/ Speculation/);
  });

  it("ranks Macro Sensitivity first at 8.8 points for the live-shaped state", () => {
    const model = buildIntelligenceTransparency(liveLikeState(), WEIGHTS);
    const macro = model.components.find((c) => c.engineId === "macro-sensitivity");
    expect(macro?.score).toBe(44);
    expect(macro?.contributionPoints).toBe(8.8);
    expect(macro?.rank).toBe(1);
    expect(macro?.freshness).toBe("DELAYED");
    expect(macro?.posture).toBe("low-and-stable");
  });
});

describe("unavailable is not cited as a driver", () => {
  it("marks unavailable engines as not cited and keeps them out of HOW-built contributors", () => {
    const state = liveLikeState({
      engines: liveLikeState().engines.map((e) =>
        e.engineId === "market-breadth"
          ? engine("market-breadth", null, {
              qualityStatus: "UNAVAILABLE",
              freshnessStatus: "UNAVAILABLE",
              sourceInputIds: ["ten_year_treasury_yield", "unemployment_rate"],
            })
          : e,
      ),
      // Recompute published PI without labor: 33.5 - 2.9 = 30.6 → 31
      pressureIndex: 31,
    });
    const model = buildIntelligenceTransparency(state, WEIGHTS);
    const labor = model.components.find((c) => c.engineId === "market-breadth");
    expect(labor?.availability).toBe("unavailable");
    expect(labor?.citedAsDriver).toBe(false);
    expect(labor?.plainEnglishReason).toMatch(/not cited as a driver/i);
    expect(unavailableCitedAsDriver(model)).toEqual([]);
    expect(unavailableNamedAsContributor(model)).toEqual([]);
    expect(model.howBuilt?.explanation).toMatch(/Not cited as drivers/);
    expect(model.howBuilt?.explanation).toMatch(/Labor & Rates/);
  });
});

describe("uncalibrated / not-offered demotion", () => {
  it("never converts Uncalibrated / Not offered into implied probabilities", () => {
    const pair = demoteProbabilityPair(
      { state: "UNCALIBRATED", text: PROBABILITY_DISPLAY_TEXT.UNCALIBRATED, percent: null },
      { state: "NOT_OFFERED", text: PROBABILITY_DISPLAY_TEXT.NOT_OFFERED, percent: null },
    );
    expect(pair.every((p) => p.demoted && p.impliedProbability === null)).toBe(true);
    const model = buildIntelligenceTransparency(liveLikeState(), WEIGHTS, {
      bullDisplay: { state: "UNCALIBRATED", text: PROBABILITY_DISPLAY_TEXT.UNCALIBRATED, percent: null },
      crashDisplay: { state: "NOT_OFFERED", text: PROBABILITY_DISPLAY_TEXT.NOT_OFFERED, percent: null },
    });
    expect(demotionIssues(model)).toEqual([]);
    expect(model.demotedProbabilities[0].text).toBe(PROBABILITY_DISPLAY_TEXT.UNCALIBRATED);
    expect(model.demotedProbabilities[1].text).toBe(PROBABILITY_DISPLAY_TEXT.NOT_OFFERED);
  });

  it("flags demotion regressions that embed percents into uncalibrated text", () => {
    const model = buildIntelligenceTransparency(liveLikeState(), WEIGHTS, {
      bullDisplay: { state: "UNCALIBRATED", text: "Uncalibrated 43%", percent: null },
      crashDisplay: { state: "NOT_OFFERED", text: "Not offered", percent: null },
    });
    expect(demotionIssues(model).some((i) => i.includes("bullProbability"))).toBe(true);
  });
});

describe("direction posture + freshness mapping", () => {
  it("maps the four named postures plus stable/improving variants", () => {
    expect(directionPosture(50, "Improving")).toBe("high-but-improving");
    expect(directionPosture(50, "Deteriorating")).toBe("high-and-worsening");
    expect(directionPosture(20, "Deteriorating")).toBe("low-but-worsening");
    expect(directionPosture(20, "Stable")).toBe("low-and-stable");
    expect(directionPosture(null, "Stable")).toBe("unavailable");
  });

  it("maps freshness badges LIVE/DELAYED/STALE/UNAVAILABLE", () => {
    expect(mapFreshnessBadge("CURRENT")).toBe("LIVE");
    expect(mapFreshnessBadge("DELAYED")).toBe("DELAYED");
    expect(mapFreshnessBadge("STALE")).toBe("STALE");
    expect(mapFreshnessBadge("UNAVAILABLE")).toBe("UNAVAILABLE");
  });
});

describe("presentation wiring (source contract)", () => {
  it("IntelligenceMode mounts transparency and demoted scenario chips", () => {
    const mode = readFileSync(join(here, "../client/src/components/dashboard/IntelligenceMode.tsx"), "utf8");
    expect(mode).toMatch(/IntelligenceTransparency/);
    expect(mode).toMatch(/DemotedScenarioChips/);
    expect(mode).not.toMatch(/engineProbabilityText\(output,\s*"bullProbability"\)/);
    expect(mode).not.toMatch(/CRASH PROBABILITY/);
  });

  it("covers all six Champion vectors", () => {
    expect([...INTELLIGENCE_VECTOR_IDS]).toEqual([
      "liquidity-stress",
      "credit-contagion",
      "volatility-regime",
      "macro-sensitivity",
      "market-breadth",
      "ai-bubble",
    ]);
  });
});
