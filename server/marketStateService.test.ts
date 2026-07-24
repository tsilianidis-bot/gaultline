import { describe, expect, it, vi } from "vitest";
import {
  assembleCanonicalMarketState,
  createCanonicalMarketStateReader,
  type CanonicalMarketStateSource,
} from "./marketStateService";
import { pressureToEvidencePacket } from "./seismographAdapters";
import { deriveProviderProvenance } from "./seismographCore";
import type { FaultlinePressureOutput } from "./pressure/engine";

function source(overrides: Partial<CanonicalMarketStateSource> = {}): CanonicalMarketStateSource {
  return {
    currentScore: 68,
    currentRegime: "Elevated Risk",
    currentStressLevel: "High",
    currentDirection: "Deteriorating",
    currentPercentile: 82,
    dataFreshness: "live",
    lastUpdated: "2026-07-23T12:00:00.000Z",
    providerProvenance: {
      fred: {
        status: "live",
        detail: "Live FRED macro and credit observations contributed through the pressure engine.",
        asOf: Date.parse("2026-07-23T12:00:00.000Z"),
      },
    },
    todayStory: "Credit and liquidity conditions are tightening together.",
    keyDevelopments: ["Credit spreads widened"],
    whyThisScore: "Three high-weight evidence families are stressed.",
    whyThisRegime: "Pressure is above the historical high-risk threshold.",
    probabilities: {
      bull: 18,
      neutral: 29,
      bear: 53,
      confidence: 78,
      primaryDriver: "Credit stress",
      evidenceBasis: "Four normalized evidence families",
      historicalBasis: "317 monthly observations",
    },
    evidenceFamilies: [{
      name: "Credit",
      signal: "stressed",
      strength: 82,
      currentValue: "Widening",
      historicalContext: "Above the 80th percentile",
      trend: "deteriorating",
      whyItMatters: "Credit leads broader risk appetite.",
    }],
    evidenceConsensus: "strong",
    topAnalog: {
      period: "2018-12",
      label: "Q4 2018 selloff",
      similarity: 84,
      score: 67,
      regime: "High Risk",
      description: "Comparable tightening episode",
      outcome3m: "Fed pivot",
      outcome6m: "Recovery",
      outcome12m: "Expansion",
      avgReturn3m: 9,
      avgReturn6m: 14,
      avgReturn12m: 22,
      durationMonths: 3,
      peakPressure: 71,
      resolution: "Policy conditions eased",
    },
    analogSummary: "The closest episodes resolved after financial conditions eased.",
    transitionProbabilities: {
      remainInRegime: 52,
      transitionToElevated: 8,
      transitionToLow: 12,
      transitionToCrisis: 28,
      confidence: 74,
      historicalBasis: "Comparable high-risk regimes",
      currentEvidence: ["Credit deterioration"],
    },
    evolution: {
      sevenDayTrend: "Pressure rising",
      thirtyDayTrend: "Deteriorating",
      ninetyDayTrend: "Building",
      yearTrend: "Above average",
      accelerating: true,
      buildingPressure: true,
      whatChanged: ["Credit weakened"],
      whatToWatch: ["Funding spreads"],
      invalidationConditions: ["Credit spreads normalize"],
      sparkline90d: [],
    },
    memory: {
      observationCount: 317,
      datasetSpan: "2000-present",
      currentStreakDescription: "Three months above elevated threshold",
      longestStreak: 11,
      regimeHistory: [],
      keyThresholdsCrossed: [],
      lastMajorShift: "2026-05",
      historicalStats: {
        avgPressure: 46,
        maxPressure: 92,
        minPressure: 12,
        criticalMonths: 8,
        highRiskMonths: 31,
        elevatedMonths: 78,
        moderateMonths: 124,
        lowMonths: 76,
      },
    },
    regimeProbabilities5way: {
      bull: 10,
      softLanding: 24,
      stagflation: 31,
      recession: 27,
      crash: 8,
    },
    developingConditions: [{
      title: "Credit transmission",
      description: "Funding pressure is spreading.",
      engines: ["Credit"],
      evidence: "Spreads widened for three weeks.",
      severity: "High",
      durationDescription: "Building for 21 days",
      trend: "building",
      expectedImpact: "Lower risk tolerance",
    }],
    marketNarrative: {
      whatIsHappening: "Cross-asset pressure is elevated.",
      whyIsItHappening: "Liquidity and credit are tightening.",
      whatHasChanged: "Credit weakened this month.",
      whatIsBuildingBeneathSurface: "Funding stress is broadening.",
      highestProbabilityPath: "pressure remains elevated until liquidity improves.",
      whatWouldInvalidate: "A sustained normalization in credit and liquidity.",
    },
    activePatterns: [{
      name: "Credit-led tightening",
      description: "Credit is weakening ahead of equities.",
      confidence: 79,
      daysActive: 21,
      historicalFrequency: "14 prior episodes",
      outcomeDistribution: { bullish: 15, sideways: 35, correction: 50 },
      avgReturn1m: -2,
      avgReturn3m: -4,
      avgReturn6m: 2,
      invalidationConditions: "Spreads reverse below the 60th percentile",
      analogs: ["2018-12"],
    }],
    ...overrides,
  };
}

describe("assembleCanonicalMarketState", () => {
  it("maps one authoritative source into all five destination contracts", () => {
    const state = assembleCanonicalMarketState(source(), {
      generatedAt: "2026-07-23T12:01:00.000Z",
      cacheStatus: "refreshed",
      cacheAgeMs: 0,
    });

    expect(state.now).toMatchObject({ pressureScore: 68, stressLevel: "High", historicalPercentile: 82 });
    expect(state.why.evidenceFamilies[0].name).toBe("Credit");
    expect(state.outlook.probabilities.primaryDriver).toBe("Credit stress");
    expect(state.watch.developingConditions[0].durationDescription).toBe("Building for 21 days");
    expect(state.act.marketPosture).toBe("balanced");
    expect(state.history.observationCount).toBe(317);
    expect(state.sourceHealth.filter(item => item.required).every(item => item.status === "healthy")).toBe(true);
  });

  it("makes stale-if-error state explicit instead of fabricating live data", () => {
    const state = assembleCanonicalMarketState(source(), {
      generatedAt: "2026-07-23T12:05:00.000Z",
      cacheStatus: "stale-if-error",
      cacheAgeMs: 300_000,
      staleReason: "Refresh failed; serving the last known-good MarketState.",
    });

    expect(state.freshness).toBe("stale");
    expect(state.cache.staleReason).toContain("Refresh failed");
    expect(state.sourceHealth.find(item => item.id === "seismograph")?.status).toBe("degraded");
    expect(state.warnings).toContain("Refresh failed; serving the last known-good MarketState.");
  });

  it("normalizes all canonical pressure and probability values to 0-100", () => {
    const state = assembleCanonicalMarketState(source({
      currentScore: 140,
      currentPercentile: -8,
      probabilities: {
        ...source().probabilities,
        bull: 108,
        bear: -2,
        confidence: 61.26,
      },
    }), {
      generatedAt: "2026-07-23T12:05:00.000Z",
      cacheStatus: "refreshed",
      cacheAgeMs: 0,
    });

    expect(state.now.pressureScore).toBe(100);
    expect(state.now.historicalPercentile).toBe(0);
    expect(state.outlook.probabilities).toMatchObject({ bull: 100, bear: 0, confidence: 61.3 });
  });
});

describe("canonical MarketState provider boundary", () => {
  it("uses one authoritative provider and retries it once before succeeding", async () => {
    const authoritative = source({ currentScore: 61, lastUpdated: "2026-07-23T13:00:00.000Z" });
    const load = vi.fn()
      .mockRejectedValueOnce(new Error("temporary upstream failure"))
      .mockResolvedValueOnce(authoritative);
    const cache = {
      getOrLoad: vi.fn(async (loader: () => Promise<CanonicalMarketStateSource>) => ({
        value: await loader(),
        status: "refreshed" as const,
        ageMs: 0,
      })),
    };
    const read = createCanonicalMarketStateReader({
      provider: { id: "unified-seismograph", load },
      cache,
      now: () => new Date("2026-07-23T13:01:00.000Z"),
    });

    const state = await read();

    expect(load).toHaveBeenCalledTimes(2);
    expect(cache.getOrLoad).toHaveBeenCalledTimes(1);
    expect(state.now.pressureScore).toBe(61);
    expect(state.sourceUpdatedAt).toBe(authoritative.lastUpdated);
    expect(state.freshness).toBe("live");
    expect(state.sourceHealth.find(item => item.id === "fred")).toMatchObject({
      status: "healthy",
      required: true,
      asOf: new Date(authoritative.providerProvenance.fred.asOf).toISOString(),
    });
  });

  it("labels stale-if-error data and provenance truthfully after both provider attempts fail", async () => {
    const lastKnownGood = source({
      currentScore: 57,
      dataFreshness: "stale",
      lastUpdated: "2026-07-23T12:30:00.000Z",
    });
    const load = vi.fn().mockRejectedValue(new Error("provider unavailable"));
    const cache = {
      getOrLoad: vi.fn(async (loader: () => Promise<CanonicalMarketStateSource>) => {
        try {
          await loader();
        } catch (error) {
          return { value: lastKnownGood, status: "stale-if-error" as const, ageMs: 1_800_000, error };
        }
        throw new Error("Expected provider failure");
      }),
    };
    const read = createCanonicalMarketStateReader({
      provider: { id: "unified-seismograph", load },
      cache,
      now: () => new Date("2026-07-23T13:00:00.000Z"),
    });

    const state = await read({ forceRefresh: true });

    expect(load).toHaveBeenCalledTimes(2);
    expect(cache.getOrLoad).toHaveBeenCalledWith(expect.any(Function), { forceRefresh: true });
    expect(state.cache).toMatchObject({ status: "stale-if-error", ageMs: 1_800_000 });
    expect(state.freshness).toBe("stale");
    expect(state.sourceUpdatedAt).toBe(lastKnownGood.lastUpdated);
    expect(state.sourceHealth.find(item => item.id === "seismograph")?.status).toBe("degraded");
    expect(state.warnings.join(" ")).toContain("provider unavailable");
  });

  it("marks missing source evidence unavailable instead of fabricating live values", () => {
    const withoutEvidence = source({
      evidenceFamilies: [],
      providerProvenance: {
        fred: {
          status: "unavailable",
          detail: "No pressure-engine FRED provenance was present in this Seismograph output.",
          asOf: Date.parse("2026-07-23T12:00:00.000Z"),
        },
      },
      memory: { ...source().memory, observationCount: 0, datasetSpan: "unavailable" },
    });
    const state = assembleCanonicalMarketState(withoutEvidence, {
      generatedAt: "2026-07-23T13:00:00.000Z",
      cacheStatus: "refreshed",
      cacheAgeMs: 0,
    });

    expect(state.now.topDrivers).toEqual([]);
    expect(state.why.evidenceFamilies).toEqual([]);
    expect(state.sourceHealth.find(item => item.id === "fred")?.status).toBe("unavailable");
    expect(state.sourceHealth.find(item => item.id === "historical-memory")?.status).toBe("unavailable");
    expect(state.warnings).toEqual(expect.arrayContaining([
      expect.stringContaining("Macro and Credit Evidence"),
      expect.stringContaining("Historical Market Memory"),
    ]));
  });

  it("propagates the real pressure adapter's FRED fallback provenance into canonical source health", () => {
    const pressure: FaultlinePressureOutput = {
      overallPressure: 58,
      regime: "Elevated Risk",
      level: "High",
      vectors: [{
        id: "credit-liquidity",
        name: "Credit and Liquidity",
        score: 58,
        level: "High",
        trend: "stable",
        weight: 1,
        rawInputs: { hySpread: null },
        dataStatus: "fallback",
        source: "FRED: BAMLH0A0HYM2",
        fallbackReason: "FRED data unavailable; using last known values",
      }],
      alerts: [],
      topAnalog: { year: 2018, label: "Q4 2018", similarity: 82, description: "Tightening episode" },
      analogs: [],
      timestamp: "2026-07-23T12:00:00.000Z",
      dataSource: "fallback",
      lastUpdated: "2026-07-23T12:00:00.000Z",
    };
    const providerProvenance = deriveProviderProvenance([
      pressureToEvidencePacket(pressure),
    ]);
    const state = assembleCanonicalMarketState(source({ providerProvenance }), {
      generatedAt: "2026-07-23T13:00:00.000Z",
      cacheStatus: "refreshed",
      cacheAgeMs: 0,
    });

    expect(providerProvenance.fred).toMatchObject({
      status: "fallback",
      detail: "FRED data unavailable; using last known values",
      asOf: Date.parse(pressure.timestamp),
    });
    expect(state.sourceHealth.find(item => item.id === "fred")).toMatchObject({
      status: "degraded",
      detail: "FRED data unavailable; using last known values",
    });
    expect(state.warnings.join(" ")).toContain("FRED data unavailable; using last known values");
  });
});
