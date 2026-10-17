import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildCanonicalIntelligenceState } from "./canonicalIntelligenceState";
import { getAuthoritativeCanonicalIntelligenceState } from "./canonicalIntelligenceState";
import { buildAtomicIntelligenceStateManifest } from "./intelligenceGovernance";
import { computeHomepageBriefing } from "./homepageBriefing";
import { resolveRunContext } from "./forwardRunProvenance";
import type { FaultlinePressureOutput, RiskVector } from "./pressure/engine";
import type { SeismographOutput } from "./seismographCore";

vi.mock("./canonicalIntelligenceState", async () => {
  const actual = await vi.importActual<typeof import("./canonicalIntelligenceState")>("./canonicalIntelligenceState");
  return {
    ...actual,
    getAuthoritativeCanonicalIntelligenceState: vi.fn(),
  };
});

vi.mock("./db", () => ({
  getRecentPressureRuns: vi.fn().mockResolvedValue([]),
  getPressureHistory: vi.fn().mockResolvedValue([]),
}));

vi.mock("./historicalContextEngine", () => ({
  computeHistoricalContext: vi.fn().mockResolvedValue(null),
}));

vi.mock("./_core/llm", () => ({
  invokeLLM: vi.fn().mockRejectedValue(new Error("llm withheld in test")),
}));

const SOURCE_AT = "2026-10-16T20:30:00.000Z"; // 16:30 ET, inside the Friday NYSE publication window.
const INPUT_OBSERVED_AT = "2026-10-16";

const vectors: RiskVector[] = [
  { id: "liquidity-stress", label: "Liquidity Stress", description: "MOCK fixture", score: 30, level: "Moderate", driver: "MOCK fixture", trend: "stable", weight: 0.20, rawInputs: { hySpread: 3.2, sofr: 4.1 }, observationDates: { hySpread: INPUT_OBSERVED_AT, sofr: INPUT_OBSERVED_AT }, dataStatus: "live", source: "MOCK fixture" },
  { id: "credit-contagion", label: "Credit Contagion Risk", description: "MOCK fixture", score: 28, level: "Moderate", driver: "MOCK fixture", trend: "stable", weight: 0.20, rawInputs: { tsy10y: 4.1 }, observationDates: { tsy10y: INPUT_OBSERVED_AT }, dataStatus: "live", source: "MOCK fixture" },
  { id: "volatility-regime", label: "Yield Curve", description: "MOCK fixture", score: 33, level: "Moderate", driver: "MOCK fixture", trend: "stable", weight: 0.15, rawInputs: { tsy2y: 3.8 }, observationDates: { tsy2y: INPUT_OBSERVED_AT }, dataStatus: "live", source: "MOCK fixture" },
  { id: "macro-sensitivity", label: "Macro Sensitivity", description: "MOCK fixture", score: 36, level: "Moderate", driver: "MOCK fixture", trend: "stable", weight: 0.20, rawInputs: { cpi: 2.7, ppi: 3.1 }, observationDates: { cpi: INPUT_OBSERVED_AT, ppi: INPUT_OBSERVED_AT }, dataStatus: "live", source: "MOCK fixture" },
  { id: "market-breadth", label: "Labor & Rates", description: "MOCK fixture", score: 29, level: "Moderate", driver: "MOCK fixture", trend: "stable", weight: 0.10, rawInputs: { fedFunds: 3.5, unemployment: 4.2 }, observationDates: { fedFunds: INPUT_OBSERVED_AT, unemployment: INPUT_OBSERVED_AT }, dataStatus: "live", source: "MOCK fixture" },
  { id: "ai-bubble", label: "AI / Speculation", description: "MOCK fixture", score: 31, level: "Moderate", driver: "MOCK fixture", trend: "stable", weight: 0.15, rawInputs: {}, observationDates: {}, dataStatus: "static", source: "MOCK fixture" },
];

function manifest(overrides: Record<string, unknown> = {}) {
  const pressure: FaultlinePressureOutput = {
    overallPressure: 41,
    regime: "MODERATE RISK",
    level: "Moderate",
    vectors,
    alerts: [],
    topAnalog: { year: 0, label: "UNAVAILABLE", similarity: 0, description: "MOCK fixture" },
    analogs: [],
    timestamp: SOURCE_AT,
    lastUpdated: SOURCE_AT,
    dataSource: "live",
    priorPressure: null,
  };
  const seismograph = {
    version: "2.0",
    pressureScore: 41,
    regime: "MODERATE RISK",
    probabilities: { bull: 52, neutral: 31, bear: 17, primaryDriver: "MOCK fixture", confidence: 0 },
    activeContributors: [],
    evidenceConsensus: "moderate",
    analogMatches: [],
    activePatterns: [],
    transitionProbabilities: {
      remainInRegime: 0,
      transitionToElevated: 0,
      transitionToLow: 0,
      transitionToCrisis: 0,
      primaryDriver: "MOCK fixture",
    },
  } as SeismographOutput;
  const scheduledRun = resolveRunContext("cron-endpoint", new Date(SOURCE_AT));
  const built = buildAtomicIntelligenceStateManifest({
    pressure,
    seismograph,
    originatingRunId: "run:homepage-briefing-mock-2026-10-16",
    generatedAt: SOURCE_AT,
    runContext: scheduledRun,
  });
  return { ...built.manifest, inputQuality: built.inputQuality, runProvenance: built.runProvenance, ...overrides };
}

describe("homepage briefing canonical bind", () => {
  beforeEach(() => {
    // Friday 20:00 ET: the 16:30 ET scheduled source above is the latest eligible publication.
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-17"));
    vi.mocked(getAuthoritativeCanonicalIntelligenceState).mockReset();
  });

  afterEach(() => vi.useRealTimers());

  it("withholds CURRENT briefing when canonical state is missing", async () => {
    vi.mocked(getAuthoritativeCanonicalIntelligenceState).mockResolvedValue(null);
    const briefing = await computeHomepageBriefing();
    expect(briefing.availability).toBe("UNAVAILABLE");
    expect(briefing.dataSource).toBe("unavailable");
    expect(briefing.metrics.pressureIndex.current).toBeNull();
    expect(briefing.metrics.bullProbability).toBeNull();
    expect(briefing.metrics.crashProbability).toBeNull();
    expect(briefing.marketStoryHeadline).toContain("UNAVAILABLE");
  });

  it("uses canonical pressure; scenario numbers render only through the probability contract", async () => {
    vi.mocked(getAuthoritativeCanonicalIntelligenceState).mockResolvedValue(
      buildCanonicalIntelligenceState(manifest()),
    );
    const briefing = await computeHomepageBriefing();
    expect(briefing.availability).toBe("AVAILABLE");
    expect(briefing.dataSource).toBe("canonical");
    expect(briefing.canonicalStateId).toBe(manifest().stateId);
    expect(briefing.metrics.pressureIndex.current).toBe(41);
    expect(briefing.metrics.regime).toBe("MODERATE RISK");
    // The stored 52/31/17 evidence-vote weights are uncalibrated: no number, contract text only.
    expect(briefing.metrics.bullProbability).toBeNull();
    expect(briefing.metrics.crashProbability).toBeNull();
    expect(briefing.metrics.bullProbabilityText).toBe("Uncalibrated");
    expect(briefing.metrics.crashProbabilityText).toBe("Not offered");
    expect(briefing.whyTodayIsDifferent.bullProbDelta.current).toBe("Uncalibrated");
    expect(briefing.whyTodayIsDifferent.crashProbDelta.current).toBe("Not offered");
    expect(JSON.stringify(briefing.metrics)).not.toMatch(/\b(52|17)%/);
    expect(briefing.metrics.opportunityScore).toBeNull();
  });

  it("does not invent bull/crash percentages when scenario outputs are missing", async () => {
    vi.mocked(getAuthoritativeCanonicalIntelligenceState).mockResolvedValue(
      buildCanonicalIntelligenceState(manifest({ scenarioOutputs: {} })),
    );
    const briefing = await computeHomepageBriefing();
    expect(briefing.availability).toBe("AVAILABLE");
    expect(briefing.metrics.bullProbability).toBeNull();
    expect(briefing.metrics.crashProbability).toBeNull();
    expect(briefing.whyTodayIsDifferent.bullProbDelta.current).toBe("Unavailable");
    expect(briefing.whyTodayIsDifferent.crashProbDelta.current).toBe("Not offered");
  });
});
