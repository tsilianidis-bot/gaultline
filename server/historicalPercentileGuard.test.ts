/**
 * QA final pass (e9d45f9) Gate C, display only: the historical-context /
 * rarity percentile (monthly pressureHistory) must never be shown next to a
 * different canonical percentile. When they differ it is "Unavailable" and the
 * story clause / "bottom|top N%" text citing it is suppressed; when they agree
 * nothing changes.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ canonicalPercentile: 83 as number | null }));

// 121 recorded months: 27 below today's 34 → historical-context percentile 22.
const history = Array.from({ length: 121 }, (_, i) => {
  const year = 2016 + Math.floor((i + 9) / 12);
  const month = ((i + 9) % 12) + 1;
  return {
    month: `${year}-${String(month).padStart(2, "0")}`,
    overallPressure: i < 27 ? 30 : 36 + (i % 5),
    regime: "MODERATE RISK",
    liquidityStress: 20, creditContagion: 25, volatilityRegime: 40, macroSensitivity: 35, marketBreadth: 45, aiBubble: 44,
  };
});
const now = Date.now();
const runs = [0, 18, 19].map((days, i) => ({
  computedAt: new Date(now - days * 86400000 - 3600000).toISOString(),
  overallPressure: [34, 30, 29][i],
  vectorsJson: null,
}));

vi.mock("./db", () => ({
  getPressureHistory: vi.fn(async () => history),
  getPressureHistoryStats: vi.fn(async () => null),
  getRecentPressureRuns: vi.fn(async () => runs),
}));
vi.mock("./_core/llm", () => ({ invokeLLM: vi.fn().mockRejectedValue(new Error("llm withheld in test")) }));
vi.mock("./marketStateService", () => ({
  getCanonicalMarketState: vi.fn(async () => ({ now: { historicalPercentile: state.canonicalPercentile }, outlook: { topAnalog: null } })),
}));
vi.mock("./canonicalIntelligenceState", async () => {
  const actual = await vi.importActual<typeof import("./canonicalIntelligenceState")>("./canonicalIntelligenceState");
  return { ...actual, getAuthoritativeCanonicalIntelligenceState: vi.fn() };
});

import { computeHistoricalContext } from "./historicalContextEngine";
import { computeHomepageBriefing } from "./homepageBriefing";
import { buildCanonicalIntelligenceState, getAuthoritativeCanonicalIntelligenceState } from "./canonicalIntelligenceState";
import { projectPressureFromCanonical } from "./canonicalPressureProjection";
import {
  HISTORICAL_PERCENTILE_UNAVAILABLE_LABEL,
  reconcileHistoricalContextPercentile,
  stripHistoricalPercentileFromStory,
} from "./historicalPercentileGuard";

function canonical() {
  return buildCanonicalIntelligenceState({
    stateId: "state:percentile-guard", generatedAt: new Date(now).toISOString(),
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

const PERCENTILE_TEXT = /\b\d+(?:st|nd|rd|th)\s+percentile\b/i;
const BOTTOM_TOP = /\b(?:bottom|top)\s+\d+%/i;

async function rawContext() {
  return computeHistoricalContext(projectPressureFromCanonical(canonical())!);
}

describe("historical-context percentile guard", () => {
  beforeEach(() => {
    state.canonicalPercentile = 83;
    vi.mocked(getAuthoritativeCanonicalIntelligenceState).mockResolvedValue(canonical());
  });

  it("the fixture reproduces QA's conflict: context 22nd, 'bottom 30%', story cites the 22ND percentile", async () => {
    const ctx = await rawContext();
    expect(ctx.rarityContext.percentile).toBe(22);
    expect(ctx.rarityContext.rarityLabel).toMatch(BOTTOM_TOP);
    expect(ctx.marketStory).toContain("22ND percentile of 121 recorded monthly observations");
  });

  it("fails closed when the context percentile differs from the canonical one", async () => {
    const raw = await rawContext();
    const ctx = reconcileHistoricalContextPercentile(raw, 83);
    expect(ctx.rarityContext.percentile).toBeNull();
    expect(ctx.rarityContext.percentileStatus).toBe("UNAVAILABLE");
    expect(ctx.rarityContext.rarityLabel).toBe(HISTORICAL_PERCENTILE_UNAVAILABLE_LABEL);
    expect(ctx.rarityContext.rarityLabel).not.toMatch(BOTTOM_TOP);
    expect(ctx.rarityContext.monthsAtOrAbove).toBeNull();
    expect(ctx.rarityContext.frequencyPct).toBeNull();
    expect(ctx.marketStory).not.toMatch(PERCENTILE_TEXT);
    expect(ctx.marketStory).not.toContain("22");
    expect(ctx.marketStory.startsWith("Market pressure is currently 34/100 (MODERATE RISK).")).toBe(true);
    // The rest of the story is kept.
    expect(ctx.marketStory).toContain("The largest measured contributor is");
    // Nothing else changes.
    expect(ctx.rarityContext.sampleSize).toBe(121);
    expect(ctx.rarityContext.regimeDistribution).toEqual(raw.rarityContext.regimeDistribution);
    expect(ctx.analogMatches).toEqual(raw.analogMatches);
    expect(ctx.drivers).toEqual(raw.drivers);
    // No residual 22nd anywhere in the payload.
    expect(JSON.stringify(ctx)).not.toMatch(/22(?:nd|ND)/);
  });

  it("fails closed when the canonical percentile is unavailable", async () => {
    const ctx = reconcileHistoricalContextPercentile(await rawContext(), null);
    expect(ctx.rarityContext.percentile).toBeNull();
    expect(ctx.rarityContext.percentileStatus).toBe("UNAVAILABLE");
    expect(ctx.marketStory).not.toMatch(PERCENTILE_TEXT);
  });

  it("changes nothing when the two agree (rounded like every other surface)", async () => {
    const raw = await rawContext();
    for (const canonicalPercentile of [22, 22.4, 21.6]) {
      const ctx = reconcileHistoricalContextPercentile(raw, canonicalPercentile);
      const { percentileStatus, ...rest } = ctx.rarityContext;
      expect(percentileStatus).toBe("AVAILABLE");
      expect(rest).toEqual(raw.rarityContext);
      expect(ctx.marketStory).toBe(raw.marketStory);
    }
    expect(reconcileHistoricalContextPercentile(raw, 23).rarityContext.percentileStatus).toBe("UNAVAILABLE");
    expect(reconcileHistoricalContextPercentile(raw, 21).rarityContext.percentileStatus).toBe("UNAVAILABLE");
  });

  it("leaves an insufficient-sample context (null percentile) as the engine produced it", async () => {
    const raw = await rawContext();
    const insufficient = { ...raw, rarityContext: { ...raw.rarityContext, percentile: null, rarityLabel: "Insufficient data — 6 recorded monthly observations (10 required)" } };
    const ctx = reconcileHistoricalContextPercentile(insufficient, 83);
    expect(ctx.rarityContext.percentileStatus).toBe("INSUFFICIENT_SAMPLE");
    expect(ctx.rarityContext.rarityLabel).toBe(insufficient.rarityContext.rarityLabel);
    expect(ctx.rarityContext.monthsAtOrAbove).toBe(raw.rarityContext.monthsAtOrAbove);
    expect(ctx.marketStory).toBe(raw.marketStory);
  });

  it("strips any other sentence citing an ordinal percentile", () => {
    expect(stripHistoricalPercentileFromStory("A is 34/100. It sits at the 22nd percentile overall. The rest stays."))
      .toBe("A is 34/100. The rest stays.");
    expect(stripHistoricalPercentileFromStory("No percentile here.")).toBe("No percentile here.");
  });
});

describe("served surfaces get the guarded value", () => {
  beforeEach(() => {
    vi.mocked(getAuthoritativeCanonicalIntelligenceState).mockResolvedValue(canonical());
  });

  it("homepage briefing (/app/now/deep, /app/charts, ?tab=analogs) story does not cite the conflicting 22nd", async () => {
    state.canonicalPercentile = 83;
    const b = await computeHomepageBriefing();
    expect(b.historySays.historicalPercentile).toBe(83);
    expect(b.marketStory).not.toMatch(/22(?:nd|ND) percentile/);
    expect(b.marketStory).toContain("Market pressure is currently 34/100");
  });

  it("homepage briefing story is unchanged when the canonical percentile agrees", async () => {
    state.canonicalPercentile = 22;
    const b = await computeHomepageBriefing();
    expect(b.marketStory).toContain("22ND percentile of 121 recorded monthly observations");
  });

  it("pressure.getHistoricalContext applies the guard with the canonical MarketState percentile", () => {
    const routers = readFileSync(resolve(process.cwd(), "server/routers.ts"), "utf8");
    const start = routers.indexOf("getHistoricalContext: publicProcedure");
    const block = routers.slice(start, routers.indexOf("diagnostic: router", start));
    expect(block).toMatch(/const context = reconcileHistoricalContextPercentile\(rawContext, marketState\?\.now\.historicalPercentile \?\? null\);/);
    expect(block).toContain("return { ...context, canonicalStateId");
    expect(block).not.toMatch(/return \{ \.\.\.rawContext/);
  });

  it("the context and analogs pages render the withheld percentile as Unavailable", () => {
    const contextPage = readFileSync(resolve(process.cwd(), "client/src/pages/HistoricalContextEngine.tsx"), "utf8");
    const analogsPage = readFileSync(resolve(process.cwd(), "client/src/pages/HistoricalAnalogs.tsx"), "utf8");
    expect(contextPage.match(/percentileStatus === "UNAVAILABLE" \? "Unavailable"/g)?.length).toBe(2);
    expect(contextPage).toContain('value={d.rarityContext.monthsAtOrAbove ?? "Unavailable"}');
    expect(contextPage).toContain('d.rarityContext.frequencyPct !== null ? `${d.rarityContext.frequencyPct}%` : "Unavailable"');
    expect(contextPage).toContain("differs from the canonical reading, so it is withheld");
    expect(analogsPage).toContain('hasSample && data.rarityContext.percentile !== null');
    expect(analogsPage).toContain("differs from the canonical reading");
  });
});
