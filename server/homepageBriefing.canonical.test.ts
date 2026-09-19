import { beforeEach, describe, expect, it, vi } from "vitest";
import { buildCanonicalIntelligenceState } from "./canonicalIntelligenceState";
import { getAuthoritativeCanonicalIntelligenceState } from "./canonicalIntelligenceState";
import { computeHomepageBriefing } from "./homepageBriefing";

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

function manifest(overrides: Record<string, unknown> = {}) {
  return {
    stateId: "state:briefing-test",
    generatedAt: "2026-09-12T00:00:00.000Z",
    championVersion: "champion-v1-frozen",
    modelVersion: "2.0",
    scoringVersion: "faultline-pressure-v1-frozen",
    configurationVersion: "phase1b-governance-v1",
    inputSnapshotId: "input:briefing-test",
    stateHash: "hash:briefing-test",
    pressureIndex: 41,
    regime: "MODERATE RISK",
    engineValues: {
      "liquidity-stress": 30,
      "credit-contagion": 28,
      "volatility-regime": 33,
      "macro-sensitivity": 36,
      "market-breadth": 29,
      "ai-bubble": 31,
    },
    engineDirections: {},
    domainValues: {},
    scenarioOutputs: { bull: 52, neutral: 31, bear: 17 },
    probabilityClaimIds: [],
    analogClaimIds: [],
    historicalDatasetVersion: "historical",
    researchDatasetVersion: "research",
    coherenceStatus: "COHERENT",
    coherenceNotes: [],
    dataQualitySummary: { staleInputs: [], unavailableInputs: [], fallbackInputs: [], staticInputs: [] },
    staleInputs: [],
    unavailableInputs: [],
    fallbackInputs: [],
    inputQuality: [],
    ...overrides,
  };
}

describe("homepage briefing canonical bind", () => {
  beforeEach(() => {
    vi.mocked(getAuthoritativeCanonicalIntelligenceState).mockReset();
  });

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

  it("uses canonical pressure and separate scenario probabilities", async () => {
    vi.mocked(getAuthoritativeCanonicalIntelligenceState).mockResolvedValue(
      buildCanonicalIntelligenceState(manifest()),
    );
    const briefing = await computeHomepageBriefing();
    expect(briefing.availability).toBe("AVAILABLE");
    expect(briefing.dataSource).toBe("canonical");
    expect(briefing.canonicalStateId).toBe("state:briefing-test");
    expect(briefing.metrics.pressureIndex.current).toBe(41);
    expect(briefing.metrics.regime).toBe("MODERATE RISK");
    expect(briefing.metrics.bullProbability).toBe(52);
    expect(briefing.metrics.crashProbability).toBe(17);
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
    expect(briefing.whyTodayIsDifferent.bullProbDelta.current).toBe("UNAVAILABLE");
    expect(briefing.whyTodayIsDifferent.crashProbDelta.current).toBe("UNAVAILABLE");
  });
});
