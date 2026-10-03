/**
 * QA prod consistency check items C and D (display only):
 * - /app/pressure?tab=context percentile is null (Insufficient data) under 10 rows, not a hard-coded 50th.
 * - Homepage briefing: canonical percentile, no ungoverned analog, no 1D change from an 18-day-old run,
 *   no run streak that contradicts the canonical Stable direction.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const sixMonths = ["2026-04", "2026-05", "2026-06", "2026-07", "2026-08", "2026-09"].map((month, i) => ({
  month, overallPressure: [26, 27, 28, 29, 30, 31][i], regime: "MODERATE RISK",
  liquidityStress: 20, creditContagion: 25, volatilityRegime: 40, macroSensitivity: 35, marketBreadth: 45, aiBubble: 44,
}));
const now = Date.now();
const runs = [0, 18, 19, 20, 21, 22].map((days, i) => ({
  computedAt: new Date(now - days * 86400000 - 3600000).toISOString(),
  overallPressure: [34, 30, 29, 28, 27, 26][i],
  vectorsJson: null,
}));

vi.mock("./db", () => ({
  getPressureHistory: vi.fn(async () => sixMonths),
  getPressureHistoryStats: vi.fn(async () => null),
  getRecentPressureRuns: vi.fn(async () => runs),
}));
vi.mock("./_core/llm", () => ({ invokeLLM: vi.fn().mockRejectedValue(new Error("llm withheld in test")) }));
vi.mock("./marketStateService", () => ({
  getCanonicalMarketState: vi.fn(async () => ({ now: { historicalPercentile: 83 }, outlook: { topAnalog: null } })),
}));
vi.mock("./canonicalIntelligenceState", async () => {
  const actual = await vi.importActual<typeof import("./canonicalIntelligenceState")>("./canonicalIntelligenceState");
  return { ...actual, getAuthoritativeCanonicalIntelligenceState: vi.fn() };
});

import { computeHistoricalContext } from "./historicalContextEngine";
import { computeHomepageBriefing } from "./homepageBriefing";
import { buildCanonicalIntelligenceState, getAuthoritativeCanonicalIntelligenceState } from "./canonicalIntelligenceState";
import { projectPressureFromCanonical } from "./canonicalPressureProjection";

function canonical() {
  return buildCanonicalIntelligenceState({
    stateId: "state:2026-10-02T18:01:25.427Z:57a5d9b62897f5e6", generatedAt: new Date(now).toISOString(),
    championVersion: "champion-v1-frozen", modelVersion: "2.0", scoringVersion: "faultline-pressure-v1-frozen",
    configurationVersion: "phase1b-governance-v1", inputSnapshotId: "input:x", stateHash: "hash:x",
    pressureIndex: 34, regime: "MODERATE RISK",
    engineValues: { "liquidity-stress": 23, "credit-contagion": 23, "volatility-regime": 40, "macro-sensitivity": 44, "market-breadth": 29, "ai-bubble": 44 },
    engineDirections: {}, domainValues: {}, scenarioOutputs: { bull: 33, neutral: 50, bear: 17 },
    probabilityClaimIds: [], analogClaimIds: [], historicalDatasetVersion: "h", researchDatasetVersion: "r",
    coherenceStatus: "COHERENT", coherenceNotes: [],
    dataQualitySummary: { staleInputs: [], unavailableInputs: [], fallbackInputs: [], staticInputs: [] },
    staleInputs: [], unavailableInputs: [], fallbackInputs: [], inputQuality: [],
  } as any);
}

describe("historical context display (item D)", () => {
  it("returns a null percentile and an Insufficient-data label with fewer than 10 rows", async () => {
    const pressure = projectPressureFromCanonical(canonical())!;
    const ctx = await computeHistoricalContext(pressure);
    expect(ctx.rarityContext.sampleSize).toBe(6);
    expect(ctx.rarityContext.percentile).toBeNull();
    expect(ctx.rarityContext.rarityLabel).toMatch(/^Insufficient data/);
    expect(ctx.marketStory).toContain("insufficient historical sample (6 recorded monthly observations)");
    // Stored-history high (31) excludes today's 34: labelled as such on the page.
    expect(ctx.timeline.cycleHigh).toBe(31);
  });
});

describe("homepage briefing display (items B and C)", () => {
  beforeEach(() => {
    vi.mocked(getAuthoritativeCanonicalIntelligenceState).mockResolvedValue(canonical());
  });

  it("uses the canonical percentile, shows no ungoverned analog, and no 1D change or streak against Stable", async () => {
    const b = await computeHomepageBriefing();
    expect(b.availability).toBe("AVAILABLE");
    expect(b.historySays.historicalPercentile).toBe(83);
    expect(b.historySays.percentileLabel).toContain("canonical reading");
    expect(b.metrics.pressureIndex.historicalPercentile).toBe(83);
    expect(b.historySays.closestAnalogs).toEqual([]);
    expect(b.metrics.pressureIndex.historicalComparison).toBe("No governed historical analog for the current state");
    expect(JSON.stringify(b)).not.toContain("Fed Pivot");
    // Previous run is 18 days old: not a 1D change.
    expect(b.metrics.pressureIndex.todayChange).toBeNull();
    // Canonical composite direction has no prior reading (Unknown): no rising streak is shown.
    expect(b.metrics.pressureIndex.streak).toBe(0);
    expect(b.metrics.pressureIndex.streakDirection).toBe("stable");
  });
});
