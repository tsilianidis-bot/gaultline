/**
 * QA delta gate (d4ecd85), display only:
 * (b) HISTORY SAYS / metrics PERCENTILE use the canonical percentile only — no
 *     rank over the loaded history rows ("36th · Low — below 75%…"); null
 *     renders "Unavailable" and the rarity sentence is dropped.
 * CORRECTION RISK: the average analog drawdown magnitude is not a probability;
 *     the probability grid carries no non-contract value.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ canonicalPercentile: null as number | null }));

// 36 rows, all below today's 34 except a few: a history-row rank would give a number.
const history = Array.from({ length: 36 }, (_, i) => ({
  month: `${2016 + Math.floor((i + 9) / 12)}-${String(((i + 9) % 12) + 1).padStart(2, "0")}`,
  overallPressure: i < 13 ? 30 : 40,
  regime: "MODERATE RISK",
  liquidityStress: 20, creditContagion: 25, volatilityRegime: 40, macroSensitivity: 35, marketBreadth: 45, aiBubble: 44,
}));
const now = Date.now();

vi.mock("./db", () => ({
  getPressureHistory: vi.fn(async () => history),
  getPressureHistoryStats: vi.fn(async () => null),
  getRecentPressureRuns: vi.fn(async () => [{ computedAt: new Date(now - 3600000).toISOString(), overallPressure: 34, vectorsJson: null }]),
}));
vi.mock("./_core/llm", () => ({ invokeLLM: vi.fn().mockRejectedValue(new Error("llm withheld in test")) }));
vi.mock("./marketStateService", () => ({
  getCanonicalMarketState: vi.fn(async () => ({ now: { historicalPercentile: state.canonicalPercentile }, outlook: { topAnalog: { period: "2019" } } })),
}));
// Historical context with outcome stats (avg analog drawdown −23%) and a governed analog.
vi.mock("./historicalContextEngine", () => ({
  computeHistoricalContext: vi.fn(async () => ({
    marketStory: "Market pressure is currently 34/100 (MODERATE RISK). The largest measured contributor is Macro.",
    institutionalInterpretation: "Retrospective description.",
    rarityContext: { percentile: null, sampleSize: 36, dataStartMonth: "2016-10", dataEndMonth: "2019-09", monthsAtOrAbove: 23, frequencyPct: 64, rarityLabel: "x", regimeDistribution: [] },
    analogMatches: [{ year: 2019, label: "2019 Repo", period: "2019", similarity: 71, outcome: "Recovered within months" }],
    outcomeStats: { sampleSize: 3, avgDrawdownPct: -23, avgRecoveryMonths: 6, drawdownRange: null, recoveryRange: null, disclaimer: "" },
  })),
}));
vi.mock("./canonicalIntelligenceState", async () => {
  const actual = await vi.importActual<typeof import("./canonicalIntelligenceState")>("./canonicalIntelligenceState");
  return { ...actual, getAuthoritativeCanonicalIntelligenceState: vi.fn() };
});

import { computeHomepageBriefing } from "./homepageBriefing";
import { buildCanonicalIntelligenceState, getAuthoritativeCanonicalIntelligenceState } from "./canonicalIntelligenceState";

function canonical() {
  return buildCanonicalIntelligenceState({
    stateId: "state:fail-closed", generatedAt: new Date(now).toISOString(),
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

const ORDINAL_PERCENTILE = /\b\d+(?:st|nd|rd|th)\s+percentile\b/i;

describe("homepage briefing percentile: canonical only", () => {
  beforeEach(() => {
    vi.mocked(getAuthoritativeCanonicalIntelligenceState).mockResolvedValue(canonical());
  });

  it("canonical percentile null → Unavailable everywhere, no history-row rank, no rarity sentence", async () => {
    state.canonicalPercentile = null;
    const b = await computeHomepageBriefing();
    expect(b.availability).toBe("AVAILABLE");
    expect(b.historySays.insufficientData).toBe(false);
    expect(b.historySays.historicalSampleSize).toBe(36);
    expect(b.historySays.historicalPercentile).toBeNull();
    expect(b.historySays.percentileLabel).toBe("Unavailable");
    expect(b.historySays.plainEnglishSummary).not.toMatch(ORDINAL_PERCENTILE);
    expect(b.historySays.plainEnglishSummary).not.toContain("historical months analyzed");
    expect(b.historySays.plainEnglishSummary).not.toMatch(/ranks at the/);
    expect(b.historySays.plainEnglishSummary).toContain("The closest historical analog is 2019 Repo");
    expect(b.metrics.pressureIndex.historicalPercentile).toBeNull();
    expect(JSON.stringify(b.historySays)).not.toMatch(/below 75%|bottom 25%|near historical median|36th/);
  });

  it("canonical percentile present → unchanged canonical rendering", async () => {
    state.canonicalPercentile = 83;
    const b = await computeHomepageBriefing();
    expect(b.historySays.historicalPercentile).toBe(83);
    expect(b.metrics.pressureIndex.historicalPercentile).toBe(83);
    expect(b.historySays.percentileLabel).toBe("Very High — top 25% of all historical readings");
    expect(b.historySays.plainEnglishSummary).toMatch(/^Today's pressure reading of 34\/100 ranks at the 83rd percentile \(.+\) on the canonical reading\. The closest historical analog is 2019 Repo/);
  });

  it("canonical 83.4 is rounded like every other surface", async () => {
    state.canonicalPercentile = 83.4;
    const b = await computeHomepageBriefing();
    expect(b.historySays.historicalPercentile).toBe(83);
  });

  it("the probability grid carries no non-contract value (no CORRECTION RISK from the average analog drawdown)", async () => {
    for (const p of [null, 83]) {
      state.canonicalPercentile = p;
      const b = await computeHomepageBriefing();
      expect(b.historySays.historicalCorrectionProbability).toBeNull();
      expect(b.historySays.historicalBullContinuationRate).toBeNull();
      expect(b.historySays.historicalElevatedVolatilityRate).toBeNull();
      expect(b.historySays.historicalRecoveryProbability).toBeNull();
      expect(JSON.stringify(b.historySays)).not.toMatch(/\b23\b/);
      // The crash / drawdown metric stays contract text.
      expect(b.metrics.crashProbability).toBeNull();
      expect(b.metrics.crashProbabilityText).toBe("Not offered");
    }
  });
});

describe("HomepageBriefingPanel renders the null percentile as Unavailable", () => {
  const panel = readFileSync(resolve(process.cwd(), "client/src/components/HomepageBriefingPanel.tsx"), "utf8");
  it("metrics PERCENTILE cell is always rendered; null → Unavailable", () => {
    expect(panel).not.toContain("{metrics.pressureIndex.historicalPercentile !== null && (");
    expect(panel).toContain('{metrics.pressureIndex.historicalPercentile !== null ? formatOrdinal(metrics.pressureIndex.historicalPercentile) : "Unavailable"}');
    expect(panel).toContain('{historySays.historicalPercentile !== null ? formatOrdinal(historySays.historicalPercentile) : "Unavailable"}');
  });
  it("source: no history-row percentile fallback and no drawdown-as-probability", () => {
    const src = readFileSync(resolve(process.cwd(), "server/homepageBriefing.ts"), "utf8");
    expect(src).toContain("const percentile = canonicalPercentile;");
    expect(src).toContain("const percentileForMetric = canonicalPercentile;");
    expect(src).toContain("const correctionProb = null;");
    expect(src).not.toMatch(/canonicalPercentile \?\?/);
    expect(src).not.toMatch(/avgDrawdownPct\)\)\)/);
  });
});
