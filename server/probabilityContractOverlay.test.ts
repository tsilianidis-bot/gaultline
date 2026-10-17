/* Probability contract — response overlays and QA #60 display items.
   The seismograph engines still compute their scenario / 5-way / transition
   numbers unchanged; only what a client can read or render is gated here. */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  buildCanonicalProbabilityContract,
  overlayAssembledSeismographOutput,
  overlayUnifiedSeismographIntelligence,
} from "./probabilityContract";
import { buildProbabilityClaim, SCENARIO_DEFINITIONS, type CanonicalProbabilityContract } from "../shared/probabilityContract";
import { EngineSnapshotSchema, computeOverallConfidence, OVERALL_CONFIDENCE_DISPLAY_TEXT } from "./routers/dailyBrief";
import { computeEngine, DEFAULT_INDICATORS } from "../client/src/lib/engine";

const prodCanonical = JSON.parse(readFileSync(join(__dirname, "__fixtures__", "prod-2026-10-01", "canonical-current.json"), "utf8"));
const contract = buildCanonicalProbabilityContract({
  stateId: prodCanonical.stateId,
  generatedAt: prodCanonical.generatedAt,
  modelVersion: prodCanonical.modelVersion,
  scenarioOutputs: prodCanonical.scenarioOutputs,
  staleInputs: [], unavailableInputs: [], fallbackInputs: [], coherenceStatus: "COHERENT",
});

// Shapes and values of the 2026-10-02 production getUnifiedIntelligence payload (QA gate-pr60).
const unified = {
  currentScore: 33, currentPercentile: 83, currentRegime: "MODERATE RISK", currentDirection: "Stable",
  probabilities: { bull: 64, neutral: 21, bear: 15, confidence: 50, primaryDriver: "Credit Markets", evidenceBasis: "e", historicalBasis: "h" },
  regimeProbabilities5way: { bull: 53, softLanding: 33, stagflation: 8, recession: 4, crash: 2 },
  transitionProbabilities: { remainInRegime: 60, transitionToElevated: 20, transitionToLow: 20, transitionToCrisis: 0, confidence: 41, historicalBasis: "b", currentEvidence: [] as string[] },
  analogs: [{ period: "2019-07", similarity: 91 }],
};

const assembled = {
  version: "2.0", pressureScore: 33, historicalPercentile: 83, regime: "MODERATE RISK",
  probabilities: { bull: 43, neutral: 43, bear: 14, primaryDriver: "Historical Context", confidence: 67 },
  transitionProbabilities: { remainInRegime: 70, transitionToElevated: 15, transitionToLow: 10, transitionToCrisis: 5, primaryDriver: "p" },
  forDashboard: { pressureScore: 33, probabilities: { bull: 43, neutral: 43, bear: 14 }, transitionProbabilities: { remainInRegime: 70, transitionToElevated: 15, transitionToLow: 10, transitionToCrisis: 5, primaryDriver: "p" } },
  forASHA: { pressureScore: 33, probabilities: { bull: 43, neutral: 43, bear: 14 }, systemPromptBlock: "x" },
  forStockPages: { pressureScore: 33, probabilities: { bull: 43, neutral: 43, bear: 14 } },
  forReports: { pressureScore: 33, probabilities: { bull: 43, neutral: 43, bear: 14 } },
  forAlerts: { pressureScore: 33, transitionProbabilities: { remainInRegime: 70, transitionToElevated: 15, transitionToLow: 10, transitionToCrisis: 5, primaryDriver: "p" } },
};

describe("seismograph.getUnifiedIntelligence overlay", () => {
  const out = overlayUnifiedSeismographIntelligence(unified, contract);
  it("withholds raw 64/21/15, the 5-way 53/33/8/4/2 and the transitions", () => {
    expect(out.probabilities).toMatchObject({ bull: null, neutral: null, bear: null, confidence: null, primaryDriver: "Credit Markets" });
    expect(out.regimeProbabilities5way).toEqual({ bull: null, softLanding: null, stagflation: null, recession: null, crash: null });
    expect(out.transitionProbabilities).toMatchObject({ remainInRegime: null, transitionToElevated: null, transitionToLow: null, transitionToCrisis: null, confidence: null, historicalBasis: "b" });
    expect(out.probabilityContract?.stateId).toBe(prodCanonical.stateId);
  });
  it("leaves pressure score, percentile, regime and analogs untouched", () => {
    expect(out.currentScore).toBe(33);
    expect(out.currentPercentile).toBe(83);
    expect(out.currentRegime).toBe("MODERATE RISK");
    expect(out.analogs).toEqual(unified.analogs);
    // The engine object itself is not mutated.
    expect(unified.probabilities.bull).toBe(64);
  });
  it("a missing contract fails closed (all null)", () => {
    const closed = overlayUnifiedSeismographIntelligence(unified, null);
    expect(closed.probabilities.bull).toBeNull();
    expect(closed.probabilityContract).toBeNull();
  });
  it("an AVAILABLE claim passes its displayed percent through", () => {
    const calibrated = buildProbabilityClaim({
      claimId: "seismograph.scenario.bull", stateId: "s", scenario: SCENARIO_DEFINITIONS.bull,
      model: contract.scenarioSet.model, evidenceBasis: "t", freshness: { status: "CURRENT", asOf: "t" },
      missingData: { status: "COMPLETE", missingInputs: [] }, calibration: { status: "CALIBRATED", metric: "ECE", value: 0.02, basis: "t" }, value: 61.6,
    });
    const available: CanonicalProbabilityContract = { ...contract, scenarioSet: { ...contract.scenarioSet, scenarios: [calibrated, ...contract.scenarioSet.scenarios.slice(1)] } };
    expect(overlayUnifiedSeismographIntelligence(unified, available).probabilities.bull).toBe(62);
  });
});

describe("seismograph.getAssembledOutput overlay", () => {
  const out = overlayAssembledSeismographOutput(assembled, contract);
  it("withholds 43/43/14 and transitions at the top level and in every distribution payload", () => {
    expect(out.probabilities).toMatchObject({ bull: null, neutral: null, bear: null, confidence: null, primaryDriver: "Historical Context" });
    expect(out.transitionProbabilities.transitionToCrisis).toBeNull();
    for (const payload of [out.forDashboard, out.forASHA, out.forStockPages, out.forReports]) {
      expect(payload.probabilities).toEqual({ bull: null, neutral: null, bear: null });
    }
    expect(out.forDashboard.transitionProbabilities.remainInRegime).toBeNull();
    expect(out.forAlerts.transitionProbabilities.transitionToCrisis).toBeNull();
    expect(JSON.stringify(out)).not.toMatch(/"(bull|neutral|bear|remainInRegime|transitionTo\w+)":\d/);
  });
  it("keeps pressure score, percentile, regime and version", () => {
    expect(out).toMatchObject({ version: "2.0", pressureScore: 33, historicalPercentile: 83, regime: "MODERATE RISK" });
    expect(out.forDashboard.pressureScore).toBe(33);
  });
});

describe("daily brief engine snapshot (QA item 4)", () => {
  const base = { overallPressure: 33, regime: "Moderate Risk", liquidity: 50, credit: 30, breadth: 67, aiConcentration: 32, volatility: 40, timestamp: 1 };
  it("accepts a withheld (null or absent) bull field and still accepts older numeric snapshots", () => {
    expect(EngineSnapshotSchema.safeParse({ ...base, bullProbability: null }).success).toBe(true);
    expect(EngineSnapshotSchema.safeParse(base).success).toBe(true);
    expect(EngineSnapshotSchema.safeParse({ ...base, bullProbability: 53 }).success).toBe(true);
  });
  it("overallConfidence keeps the pre-contract formula (methodology-neutral) and is displayed as Uncalibrated", () => {
    // Base formula: round((100-p)*0.35 + breadth*0.25 + liquidity*0.25 + bull*0.15) = round(60.65) = 61.
    expect(computeOverallConfidence({ ...base, bullProbability: 53 })).toBe(61);
    expect(computeOverallConfidence({ ...base, bullProbability: 0 })).toBe(53);
    // Withheld bull: no value is substituted.
    expect(computeOverallConfidence({ ...base, bullProbability: null })).toBeNull();
    expect(computeOverallConfidence({ ...base, bullProbability: Number.NaN })).toBeNull();
    expect(OVERALL_CONFIDENCE_DISPLAY_TEXT).toBe("Uncalibrated");
    const page = readFileSync(join(__dirname, "..", "client", "src", "pages", "SmartDiscovery.tsx"), "utf8");
    expect(page).not.toMatch(/\{brief\.todaysMarket\.confidence\}%/);
    expect(page).toContain("brief.todaysMarket.confidenceText ?? 'Uncalibrated'");
  });
});

describe("browser engine narrative (QA item 7)", () => {
  it("states no crash/recession probability and uses the /100 scale", () => {
    const summary = computeEngine(DEFAULT_INDICATORS).narrative.summary;
    expect(summary).not.toMatch(/probability at \d/i);
    expect(summary).not.toMatch(/recession risk at \d/i);
    expect(summary).toMatch(/\/100/);
    expect(summary).not.toMatch(/\/10 /);
  });
});

describe("static scan: QA #60 bypass surfaces render no raw probability or ×100 similarity", () => {
  const root = join(__dirname, "..", "client", "src");
  const read = (file: string) => readFileSync(join(root, file), "utf8");
  it.each([
    "pages/SeismographIntelligence.tsx", "components/SeismographNarrativeBanner.tsx",
    "components/HomepageBriefingPanel.tsx", "pages/SignalOutlookCenter.tsx", "pages/SmartDiscovery.tsx",
  ])("%s", file => {
    const src = read(file);
    expect(src).not.toMatch(/similarity \* 100/);
    expect(src).not.toMatch(/\.confidence \* 100\)/);
    expect(src).not.toMatch(/probabilities\.(bull|bear)\}%/);
    expect(src).not.toMatch(/\{probability\.bullProbability\}%/);
    expect(src).not.toMatch(/environment\.(bull|bear)Probability\}%/);
    expect(src).not.toMatch(/regimeProbabilities5way\?\.(bull|crash|recession) \?\? 0/);
  });
  it("SeismographicDash (unrouted) reads the overlaid transitions without ×100 similarity", () => {
    const src = read("pages/SeismographicDash.tsx");
    expect(src).not.toMatch(/similarity \* 100/);
    expect(src).not.toMatch(/transitionToCrisis: 0,/);
  });
  it("the macro-regime cells use /100, not / 10.0", () => {
    for (const file of ["components/dashboard/IntelligenceMode.tsx", "components/dashboard/PulseMode.tsx"]) {
      expect(read(file)).not.toMatch(/\/ 10\.0/);
    }
  });
  it("Dashboard never renders a 0% analog match", () => {
    expect(read("pages/Dashboard.tsx")).not.toMatch(/similarity \?\? 0/);
  });
  it("Guide makes no AI-capex tracking claim", () => {
    expect(read("pages/Guide.tsx")).not.toMatch(/\$214B|capex tracker/i);
  });
});

describe("prompts withhold scenario / transition percentages (QA item 8)", () => {
  it("outlook story prompt and daily-brief prompt carry no scenario %", () => {
    const outlook = readFileSync(join(__dirname, "routers", "outlook.ts"), "utf8");
    expect(outlook).not.toMatch(/probability\?\.(bull|bear) \?\? \d+\}%/);
    expect(outlook).not.toMatch(/transitionProbability \?\? 0\}%/);
    const brief = readFileSync(join(__dirname, "routers", "dailyBrief.ts"), "utf8");
    expect(brief).not.toMatch(/Bull Probability: \$\{engineSnapshot\.bullProbability\}%/);
  });
});
