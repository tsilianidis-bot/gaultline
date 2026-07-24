import { describe, expect, it } from "vitest";
import { DEFAULT_INDICATORS } from "../client/src/lib/engine";
import { selectBrowserMarketOutput } from "../client/src/lib/marketStateProjection";
import type { CanonicalMarketState } from "../shared/marketState";

function marketState(): CanonicalMarketState {
  return {
    version: "1.0",
    generatedAt: "2026-07-23T12:00:00.000Z",
    sourceUpdatedAt: "2026-07-23T11:55:00.000Z",
    freshness: { status: "fresh", ageMs: 300_000, asOf: "2026-07-23T11:55:00.000Z" },
    cache: { status: "fresh-cache", ageMs: 300_000, staleReason: null },
    sourceHealth: [],
    warnings: [],
    now: { pressureScore: 82, regime: "Late-Cycle Fragility", stressLevel: "High", direction: "Deteriorating", historicalPercentile: 91, headline: "Pressure is elevated.", topDrivers: ["Credit", "Rates"] },
    why: {
      story: "Credit and rates are tightening together.",
      whyThisScore: "Multiple evidence families agree.",
      whyThisRegime: "The system is fragile but not in crisis.",
      keyDevelopments: [],
      narrative: { whatIsHappening: "Pressure is rising.", whyIsItHappening: "Liquidity is tightening.", whatHasChanged: "Credit weakened.", whatIsBuildingBeneathSurface: "Refinancing risk." },
      evidenceFamilies: [{ name: "Credit", signal: "stressed", strength: 76, trend: "deteriorating", currentValue: "Spreads widening", historicalContext: "Above median", whyItMatters: "Credit transmits stress." }],
      evidenceConsensus: "strong",
    },
    outlook: {
      probabilities: { bull: 20, neutral: 30, bear: 50, confidence: 72, primaryDriver: "Credit", evidenceBasis: "Spreads", historicalBasis: "Analogs" },
      regimeProbabilities: { bull: 20, softLanding: 25, stagflation: 15, recession: 30, crash: 10 },
      transitionProbabilities: { remainInRegime: 55, transitionToElevated: 20, transitionToLow: 15, transitionToCrisis: 10, confidence: 70, historicalBasis: "Analogs", currentEvidence: [] },
      highestProbabilityPath: "Remain fragile",
      invalidationConditions: [],
      topAnalog: null,
    },
    watch: { developingConditions: [], activePatterns: [], whatChanged: [], whatToWatch: ["Credit spreads"], accelerating: false, buildingPressure: true },
    act: { marketPosture: "defensive", decisionSummary: "Reduce fragility.", whatWouldInvalidate: "Credit improvement.", riskControls: [] },
    history: { observationCount: 100, datasetSpan: "2018-present", currentStreakDescription: "Three weeks", lastMajorShift: null, analogSummary: "Late-cycle periods" },
  };
}

describe("browser MarketState projection", () => {
  it("uses canonical MarketState for live browser output", () => {
    const result = selectBrowserMarketOutput({ marketState: marketState(), baselineIndicators: DEFAULT_INDICATORS, simulationOverrides: {} });
    expect(result.mode).toBe("canonical");
    expect(result.output.overall.score).toBe(8.2);
    expect(result.output.probability.recessionProbability).toBe(30);
    expect(result.output.overall.source).toBe("canonical-market-state");
  });

  it("keeps simulation deterministic and isolated from canonical live state", () => {
    const result = selectBrowserMarketOutput({ marketState: marketState(), baselineIndicators: DEFAULT_INDICATORS, simulationOverrides: { vix: 55 } });
    const repeated = selectBrowserMarketOutput({ marketState: marketState(), baselineIndicators: DEFAULT_INDICATORS, simulationOverrides: { vix: 55 } });
    expect(result.mode).toBe("simulation");
    expect(result.output).toEqual(repeated.output);
    expect(result.output.overall.source).not.toBe("canonical-market-state");
  });

  it("uses the explicit deterministic fallback when canonical state is unavailable", () => {
    const result = selectBrowserMarketOutput({ marketState: null, baselineIndicators: DEFAULT_INDICATORS, simulationOverrides: {} });
    expect(result.mode).toBe("deterministic-fallback");
    expect(result.output.overall.score).toBeGreaterThanOrEqual(0);
    expect(result.output.overall.score).toBeLessThanOrEqual(10);
  });
});
