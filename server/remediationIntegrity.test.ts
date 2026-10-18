import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { evidenceFreshnessLabel } from "./evidenceFreshness";
import { assembleCanonicalMarketState, deriveMarketStateFreshness } from "./marketStateService";
import { freshnessFromAssembledSnapshot } from "./seismographUnified";
import { computeTradingSignal, clearSignalCache } from "./tradingSignals";

const now = Date.parse("2026-10-16T20:20:00.000Z");
const fresh = now - 5 * 60 * 1000;

function source(overrides: Record<string, unknown> = {}) {
  return {
    currentScore: 42,
    currentRegime: "MODERATE RISK",
    currentStressLevel: "Moderate",
    currentDirection: "Stable",
    currentPercentile: 50,
    dataFreshness: "live",
    lastUpdated: new Date(fresh).toISOString(),
    providerProvenance: { fred: { status: "live", detail: "FRED", asOf: fresh } },
    todayStory: "s",
    keyDevelopments: [],
    whyThisScore: "w",
    whyThisRegime: "w",
    probabilities: { bull: 10, neutral: 20, bear: 30, primaryDriver: "Macro", confidence: 40 },
    evidenceFamilies: [],
    evidenceConsensus: "weak",
    topAnalog: null,
    analogSummary: "",
    transitionProbabilities: {
      remainInRegime: 1, transitionToElevated: 1, transitionToLow: 1, transitionToCrisis: 1,
      confidence: 1, historicalBasis: "", currentEvidence: [],
    },
    evolution: {
      sevenDayTrend: "", thirtyDayTrend: "", ninetyDayTrend: "", yearTrend: "",
      accelerating: false, buildingPressure: false, whatChanged: [], whatToWatch: [],
      invalidationConditions: [], sparkline90d: [],
    },
    memory: {
      observationCount: 1, datasetSpan: "span", currentStreakDescription: "", longestStreak: 1,
      regimeHistory: [], keyThresholdsCrossed: [], lastMajorShift: null,
      historicalStats: { avgPressure: 1, maxPressure: 1, minPressure: 1, criticalMonths: 0, highRiskMonths: 0, elevatedMonths: 0, moderateMonths: 0, lowMonths: 0 },
    },
    regimeProbabilities5way: null,
    developingConditions: [],
    marketNarrative: {
      whatIsHappening: "", whyIsItHappening: "", whatHasChanged: "", whatIsBuildingBeneathSurface: "",
      highestProbabilityPath: "", whatWouldInvalidate: "",
    },
    activePatterns: [],
    ...overrides,
  } as never;
}

describe("false LIVE remediation", () => {
  it("does not call a fresh snapshot live when FRED provenance is fallback", () => {
    expect(freshnessFromAssembledSnapshot({
      computedAt: fresh,
      dataFreshness: "live",
      providerProvenance: { fred: { status: "fallback", asOf: fresh } },
    }, { recentRunCount: 0, now })).not.toBe("live");

    const state = assembleCanonicalMarketState(source({
      providerProvenance: { fred: { status: "fallback", detail: "FRED unavailable; fallback observations.", asOf: Date.parse("2026-10-01T00:00:00.000Z") } },
    }), {
      generatedAt: new Date(now).toISOString(),
      cacheStatus: "refreshed",
      cacheAgeMs: 0,
      canonicalQuality: "HEALTHY",
    });
    expect(state.freshness).not.toBe("live");
    expect(state.sourceHealth.find((item: { id: string }) => item.id === "fred")?.status).not.toBe("healthy");
  });

  it("does not call missing canonical quality live", () => {
    expect(deriveMarketStateFreshness(source(), {
      generatedAt: new Date(now).toISOString(),
      cacheStatus: "refreshed",
      canonicalQuality: null,
    })).not.toBe("live");
    expect(deriveMarketStateFreshness(source(), {
      generatedAt: new Date(now).toISOString(),
      cacheStatus: "refreshed",
    })).not.toBe("live");
  });

  it("stays live only for a healthy canonical quality and a current live FRED observation", () => {
    expect(deriveMarketStateFreshness(source(), {
      generatedAt: new Date(now).toISOString(),
      cacheStatus: "refreshed",
      canonicalQuality: "HEALTHY",
    })).toBe("live");
  });
});

describe("Smart Discovery freshness label", () => {
  it("uses verified, delayed, or unavailable evidence and never a fixed live sentence", () => {
    expect(evidenceFreshnessLabel({ quoteFreshness: ["LIVE", "LIVE"] })).toBe("Verified source");
    expect(evidenceFreshnessLabel({ quoteFreshness: ["LIVE", "DELAYED"] })).toBe("Delayed");
    expect(evidenceFreshnessLabel({ quoteFreshness: [] })).toBe("Unavailable");
    expect(evidenceFreshnessLabel({
      canonicalQuality: "DEGRADED",
      fredStatus: "fallback",
      observedAtMs: fresh,
      nowMs: now,
    })).toBe("Delayed");
    expect(evidenceFreshnessLabel({
      canonicalQuality: null,
      fredStatus: "live",
      observedAtMs: fresh,
      nowMs: now,
    })).toBe("Delayed");
    const server = readFileSync(path.resolve("server/routers/smartDiscovery.ts"), "utf8");
    const client = readFileSync(path.resolve("client/src/pages/SmartDiscovery.tsx"), "utf8");
    expect(server).not.toContain("Live — updated just now");
    expect(client).not.toContain('value="LIVE"');
  });
});

describe("trading signals without completed bars", () => {
  it("does not emit BUY, SELL, crossover, or RSI wording", () => {
    clearSignalCache();
    const result = computeTradingSignal({
      ticker: "SPY",
      price: 500,
      open: 490,
      high: 505,
      low: 488,
      changePercent: 4.2,
      volumeMillions: 80,
      avgVolume: 20,
      sparkline: [1, 2, 3, 4, 8],
      relativeStrength: 90,
    }, { label: "MOMENTUM", score: 2 });
    expect(result.indicatorsAvailable).toBe(false);
    expect(result.action).not.toBe("BUY");
    expect(result.action).not.toBe("SELL");
    expect(result.technicals.smaSignal).toBe("Neutral");
    expect(result.technicals.rsiIsTrue).toBe(false);
    const rendered = `${result.actionLabel} ${result.rationale} ${result.technicals.smaSignal}`;
    expect(rendered).not.toMatch(/BUY|SELL|RSI|golden cross|death cross/i);
  });
});
