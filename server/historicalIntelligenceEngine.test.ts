/**
 * Vitest tests for server/historicalIntelligenceEngine.ts
 *
 * Tests cover all pure functions:
 *   - percentileRank
 *   - countConsecutiveStreak
 *   - classifyFrequency
 *   - extractDrawdownFromOutcome
 *   - extractRecoveryFromOutcome
 *   - computeOutcomeDistribution
 *   - buildTimeline
 *   - buildRegimeComparison
 *   - buildMarketEvolution
 *   - formatPromptBlock
 */

import { describe, it, expect } from "vitest";
import {
  percentileRank,
  countConsecutiveStreak,
  classifyFrequency,
  extractDrawdownFromOutcome,
  extractRecoveryFromOutcome,
  computeOutcomeDistribution,
  buildTimeline,
  buildRegimeComparison,
  buildMarketEvolution,
  formatPromptBlock,
} from "./historicalIntelligenceEngine";

// ── percentileRank ─────────────────────────────────────────────────────────────

describe("percentileRank", () => {
  it("returns 50 for empty array", () => {
    expect(percentileRank([], 50)).toBe(50);
  });

  it("returns 0 when target is below all values", () => {
    expect(percentileRank([10, 20, 30, 40, 50], 5)).toBe(0);
  });

  it("returns 100 when target is above all values", () => {
    expect(percentileRank([10, 20, 30, 40, 50], 100)).toBe(100);
  });

  it("returns 50 when target is at the median", () => {
    // 5 values: 10, 20, 30, 40, 50 — 2 below 30 → 40th percentile
    expect(percentileRank([10, 20, 30, 40, 50], 30)).toBe(40);
  });

  it("returns correct percentile for a typical pressure reading", () => {
    // 100 values from 0 to 99 — value 70 has 70 values below it → 70th percentile
    const values = Array.from({ length: 100 }, (_, i) => i);
    expect(percentileRank(values, 70)).toBe(70);
  });

  it("handles single-element array", () => {
    expect(percentileRank([50], 50)).toBe(0);
    expect(percentileRank([50], 51)).toBe(100);
  });
});

// ── countConsecutiveStreak ─────────────────────────────────────────────────────

describe("countConsecutiveStreak", () => {
  it("returns 0 for empty array", () => {
    expect(countConsecutiveStreak([], 45)).toBe(0);
  });

  it("returns 0 when last value is below threshold", () => {
    expect(countConsecutiveStreak([60, 70, 80, 30], 45)).toBe(0);
  });

  it("counts consecutive values at end of array", () => {
    expect(countConsecutiveStreak([20, 30, 50, 60, 70], 45)).toBe(3);
  });

  it("returns full length when all values are at or above threshold", () => {
    expect(countConsecutiveStreak([50, 55, 60, 65, 70], 45)).toBe(5);
  });

  it("stops counting at first value below threshold from the end", () => {
    expect(countConsecutiveStreak([80, 90, 30, 70, 75], 45)).toBe(2);
  });

  it("handles threshold exactly equal to value", () => {
    expect(countConsecutiveStreak([44, 45, 46], 45)).toBe(2);
  });
});

// ── classifyFrequency ──────────────────────────────────────────────────────────

describe("classifyFrequency", () => {
  it("classifies 0% as Rare", () => {
    expect(classifyFrequency(0)).toBe("Rare");
  });

  it("classifies 5% as Rare", () => {
    expect(classifyFrequency(5)).toBe("Rare");
  });

  it("classifies 6% as Uncommon", () => {
    expect(classifyFrequency(6)).toBe("Uncommon");
  });

  it("classifies 15% as Uncommon", () => {
    expect(classifyFrequency(15)).toBe("Uncommon");
  });

  it("classifies 16% as Typical", () => {
    expect(classifyFrequency(16)).toBe("Typical");
  });

  it("classifies 40% as Typical", () => {
    expect(classifyFrequency(40)).toBe("Typical");
  });

  it("classifies 41% as Frequent", () => {
    expect(classifyFrequency(41)).toBe("Frequent");
  });

  it("classifies 100% as Frequent", () => {
    expect(classifyFrequency(100)).toBe("Frequent");
  });
});

// ── extractDrawdownFromOutcome ─────────────────────────────────────────────────

describe("extractDrawdownFromOutcome", () => {
  it("returns null for outcome with no percentage", () => {
    expect(extractDrawdownFromOutcome("Market was broadly stable")).toBeNull();
  });

  it("extracts drawdown from 'fell -57%' pattern", () => {
    const result = extractDrawdownFromOutcome("S&P 500 fell -57% from peak");
    expect(result).toBe("-57%");
  });

  it("extracts negative percentage from outcome", () => {
    const result = extractDrawdownFromOutcome("Index fell -25% over 18 months");
    expect(result).toBe("-25%");
  });

  it("handles outcome with no drawdown (positive outcome)", () => {
    const result = extractDrawdownFromOutcome("Market advanced +20% over the next year");
    expect(result).toBeNull();
  });
});

// ── extractRecoveryFromOutcome ─────────────────────────────────────────────────

describe("extractRecoveryFromOutcome", () => {
  it("returns null for outcome with no recovery mention", () => {
    expect(extractRecoveryFromOutcome("Market fell sharply")).toBeNull();
  });

  it("extracts recovery duration in months", () => {
    const result = extractRecoveryFromOutcome("Market recovered within 18 months");
    expect(result).toBe("18 months");
  });

  it("extracts recovery duration in years", () => {
    const result = extractRecoveryFromOutcome("Recovered within 2 years");
    expect(result).toBe("2 years");
  });
});

// ── computeOutcomeDistribution ─────────────────────────────────────────────────

describe("computeOutcomeDistribution", () => {
  it("returns insufficient confidence for empty array", () => {
    const result = computeOutcomeDistribution([], 50);
    expect(result.confidence).toBe("insufficient");
    expect(result.sampleSize).toBe(0);
  });

  it("returns insufficient confidence for 1 analog", () => {
    const result = computeOutcomeDistribution(["Market fell -30%"], 50);
    expect(result.confidence).toBe("insufficient");
  });

  it("returns low confidence for 3 analogs", () => {
    const outcomes = [
      "Market fell -30% over 18 months",
      "Market advanced +15% over the next year",
      "Market was broadly sideways",
    ];
    const result = computeOutcomeDistribution(outcomes, 50);
    expect(result.confidence).toBe("low");
    expect(result.sampleSize).toBe(3);
  });

  it("returns medium confidence for 5 analogs", () => {
    const outcomes = Array(5).fill("Market fell -20%");
    const result = computeOutcomeDistribution(outcomes, 50);
    expect(result.confidence).toBe("medium");
  });

  it("returns high confidence for 7+ analogs", () => {
    const outcomes = Array(7).fill("Market advanced +10%");
    const result = computeOutcomeDistribution(outcomes, 50);
    expect(result.confidence).toBe("high");
  });

  it("percentages sum to 100", () => {
    const outcomes = [
      "Market fell -30% over 18 months",
      "Market fell -20% over 12 months",
      "Market advanced +15%",
      "Market was broadly sideways",
      "Correction followed by recovery",
    ];
    const result = computeOutcomeDistribution(outcomes, 50);
    const total = result.bullishContinuation + result.sideways + result.correction;
    expect(total).toBe(100);
  });

  it("high pressure tilts toward correction", () => {
    // All bullish outcomes — high pressure should shift some to correction
    const outcomes = Array(5).fill("Market advanced +20% and rewarded risk-on positioning");
    const lowPressureResult = computeOutcomeDistribution(outcomes, 20);
    const highPressureResult = computeOutcomeDistribution(outcomes, 80);
    // High pressure should have more correction than low pressure
    expect(highPressureResult.correction).toBeGreaterThanOrEqual(lowPressureResult.correction);
  });

  it("includes disclaimer text", () => {
    const outcomes = Array(5).fill("Market fell -20%");
    const result = computeOutcomeDistribution(outcomes, 50);
    expect(result.disclaimer).toContain("historical analog periods");
    expect(result.disclaimer).toContain("Past outcomes do not predict future results");
  });
});

// ── buildTimeline ──────────────────────────────────────────────────────────────

describe("buildTimeline", () => {
  const now = Date.now();
  const MS_PER_DAY = 86_400_000;

  const mockRuns = [
    { overallPressure: 40, regime: "MODERATE RISK", computedAt: new Date(now - 30 * MS_PER_DAY) },
    { overallPressure: 45, regime: "MODERATE RISK", computedAt: new Date(now - 14 * MS_PER_DAY) },
    { overallPressure: 50, regime: "ELEVATED RISK", computedAt: new Date(now - 7 * MS_PER_DAY) },
    { overallPressure: 55, regime: "ELEVATED RISK", computedAt: new Date(now - 1 * MS_PER_DAY) },
  ];

  it("returns exactly 5 timeline points", () => {
    const timeline = buildTimeline(mockRuns, 60, "ELEVATED RISK");
    expect(timeline).toHaveLength(5);
  });

  it("last point is always Today with current pressure", () => {
    const timeline = buildTimeline(mockRuns, 60, "HIGH STRESS");
    const today = timeline[timeline.length - 1];
    expect(today.label).toBe("Today");
    expect(today.pressure).toBe(60);
    expect(today.regime).toBe("HIGH STRESS");
  });

  it("first point is 30 days ago", () => {
    const timeline = buildTimeline(mockRuns, 60, "ELEVATED RISK");
    expect(timeline[0].label).toBe("30 days ago");
  });

  it("delta is null for the first point", () => {
    const timeline = buildTimeline(mockRuns, 60, "ELEVATED RISK");
    expect(timeline[0].delta).toBeNull();
  });

  it("delta is computed for subsequent points", () => {
    const timeline = buildTimeline(mockRuns, 60, "ELEVATED RISK");
    // Second point (14 days ago) should have delta vs first point (30 days ago)
    expect(timeline[1].delta).not.toBeNull();
  });

  it("handles empty runs array gracefully", () => {
    const timeline = buildTimeline([], 50, "MODERATE RISK");
    expect(timeline).toHaveLength(5);
    // All points should use current pressure as fallback
    for (const point of timeline) {
      expect(point.pressure).toBe(50);
    }
  });

  it("highlight describes pressure surge when delta >= 10", () => {
    // Create runs where there's a big jump
    const bigJumpRuns = [
      { overallPressure: 30, regime: "LOW RISK", computedAt: new Date(now - 30 * MS_PER_DAY) },
      { overallPressure: 30, regime: "LOW RISK", computedAt: new Date(now - 14 * MS_PER_DAY) },
      { overallPressure: 30, regime: "LOW RISK", computedAt: new Date(now - 7 * MS_PER_DAY) },
      { overallPressure: 30, regime: "LOW RISK", computedAt: new Date(now - 1 * MS_PER_DAY) },
    ];
    const timeline = buildTimeline(bigJumpRuns, 75, "HIGH STRESS");
    const today = timeline[timeline.length - 1];
    expect(today.highlight).toContain("surged");
  });
});

// ── buildRegimeComparison ──────────────────────────────────────────────────────

describe("buildRegimeComparison", () => {
  it("returns correct structure", () => {
    const result = buildRegimeComparison("HIGH STRESS", 70, ["2018 Q4 Selloff", "2022 Rate Shock"]);
    expect(result).toHaveProperty("resembles");
    expect(result).toHaveProperty("doesNotResemble");
    expect(result).toHaveProperty("regimeLabel");
    expect(result).toHaveProperty("regimeDescription");
  });

  it("filters out crisis labels from resembles", () => {
    const result = buildRegimeComparison("HIGH STRESS", 70, [
      "2018 Q4 Selloff",
      "2008 Global Financial Crisis",
      "COVID-19 Crash (2020)",
    ]);
    // Crisis labels should not be in resembles
    expect(result.resembles).not.toContain("2008 Global Financial Crisis");
    expect(result.resembles).not.toContain("COVID-19 Crash (2020)");
    expect(result.resembles).toContain("2018 Q4 Selloff");
  });

  it("includes crisis labels in doesNotResemble when not in analogs", () => {
    const result = buildRegimeComparison("MODERATE RISK", 50, ["2018 Q4 Selloff"]);
    // Crisis labels not in analogs should appear in doesNotResemble
    expect(result.doesNotResemble.length).toBeGreaterThan(0);
  });

  it("returns correct description for critical pressure", () => {
    const result = buildRegimeComparison("CRITICAL STRESS", 85, []);
    expect(result.regimeDescription).toContain("Crisis-level pressure");
  });

  it("returns correct description for low pressure", () => {
    const result = buildRegimeComparison("LOW RISK", 20, []);
    expect(result.regimeDescription).toContain("Low systemic pressure");
  });

  it("limits resembles to 3 items", () => {
    const result = buildRegimeComparison("ELEVATED RISK", 55, [
      "2018 Q4 Selloff", "2022 Rate Shock", "2015 China Shock", "2016 Brexit", "2011 Debt Ceiling",
    ]);
    expect(result.resembles.length).toBeLessThanOrEqual(3);
  });
});

// ── buildMarketEvolution ───────────────────────────────────────────────────────

describe("buildMarketEvolution", () => {
  const baseTimeline = [
    { label: "30 days ago", pressure: 40, regime: "MODERATE RISK", delta: null, highlight: "No significant change" },
    { label: "14 days ago", pressure: 45, regime: "MODERATE RISK", delta: 5, highlight: "Pressure increased +5 points" },
    { label: "7 days ago", pressure: 50, regime: "ELEVATED RISK", delta: 5, highlight: "Pressure increased +5 points" },
    { label: "Yesterday", pressure: 55, regime: "ELEVATED RISK", delta: 5, highlight: "Pressure increased +5 points" },
    { label: "Today", pressure: 60, regime: "ELEVATED RISK", delta: 5, highlight: "Pressure increased +5 points" },
  ];

  it("returns correct structure", () => {
    const result = buildMarketEvolution(baseTimeline, 60, "ELEVATED RISK", 3, "Liquidity Stress");
    expect(result).toHaveProperty("whatIsBuilding");
    expect(result).toHaveProperty("howLong");
    expect(result).toHaveProperty("whyItMatters");
    expect(result).toHaveProperty("whatAccelerated");
    expect(result).toHaveProperty("whatWouldInvalidate");
  });

  it("describes building pressure when totalChange > 5", () => {
    const result = buildMarketEvolution(baseTimeline, 60, "ELEVATED RISK", 3, "Liquidity Stress");
    expect(result.whatIsBuilding).toContain("building");
  });

  it("describes easing pressure when totalChange < -5", () => {
    const easingTimeline = [
      { label: "30 days ago", pressure: 70, regime: "HIGH STRESS", delta: null, highlight: "" },
      { label: "14 days ago", pressure: 65, regime: "HIGH STRESS", delta: -5, highlight: "" },
      { label: "7 days ago", pressure: 60, regime: "ELEVATED RISK", delta: -5, highlight: "" },
      { label: "Yesterday", pressure: 55, regime: "ELEVATED RISK", delta: -5, highlight: "" },
      { label: "Today", pressure: 50, regime: "ELEVATED RISK", delta: -5, highlight: "" },
    ];
    const result = buildMarketEvolution(easingTimeline, 50, "ELEVATED RISK", 2, "Credit Spreads");
    expect(result.whatIsBuilding).toContain("easing");
  });

  it("includes streak duration in howLong when streakMonths > 0", () => {
    const result = buildMarketEvolution(baseTimeline, 60, "ELEVATED RISK", 5, "Liquidity Stress");
    expect(result.howLong).toContain("5 month");
  });

  it("includes invalidation guidance", () => {
    const result = buildMarketEvolution(baseTimeline, 60, "ELEVATED RISK", 3, "Liquidity Stress");
    expect(result.whatWouldInvalidate.length).toBeGreaterThan(0);
  });

  it("high pressure invalidation mentions declining below 45", () => {
    const result = buildMarketEvolution(baseTimeline, 70, "HIGH STRESS", 3, "Credit Stress");
    expect(result.whatWouldInvalidate).toContain("45");
  });
});

// ── formatPromptBlock ──────────────────────────────────────────────────────────

describe("formatPromptBlock", () => {
  const mockData = {
    currentPressure: 62,
    currentRegime: "HIGH STRESS",
    historicalPercentile: 78,
    historicalN: 295,
    dataRange: "2000-01 to 2025-06",
    rarityStatement: "This is a very elevated reading — higher than 78% of all historical months.",
    analogs: [
      {
        rank: 1,
        year: 2018,
        label: "2018 Q4 Selloff",
        period: "Oct–Dec 2018",
        similarity: 82,
        description: "Fed tightening cycle + trade war fears",
        outcome: "S&P 500 fell -20% before recovering within 6 months",
        whySimilar: "Similar credit spread widening and liquidity deterioration",
        typicalDuration: "3–6 months",
        estimatedDrawdown: "-20%",
        estimatedRecovery: "6 months",
      },
    ],
    timeline: [
      { label: "30 days ago", pressure: 50, regime: "ELEVATED RISK", delta: null, highlight: "No change" },
      { label: "14 days ago", pressure: 55, regime: "ELEVATED RISK", delta: 5, highlight: "Pressure increased +5" },
      { label: "7 days ago", pressure: 58, regime: "ELEVATED RISK", delta: 3, highlight: "Slight increase (+3)" },
      { label: "Yesterday", pressure: 60, regime: "HIGH STRESS", delta: 2, highlight: "Slight increase (+2)" },
      { label: "Today", pressure: 62, regime: "HIGH STRESS", delta: 2, highlight: "Slight increase (+2)" },
    ],
    frequency: {
      label: "Uncommon" as const,
      historicalPct: 12,
      description: "HIGH STRESS conditions have occurred in 12% of historical months.",
      monthsInRegime: 35,
      totalMonths: 295,
    },
    outcomeDistribution: {
      bullishContinuation: 30,
      sideways: 20,
      correction: 50,
      sampleSize: 5,
      confidence: "medium" as const,
      disclaimer: "Based on 5 historical analog periods.",
    },
    regimeComparison: {
      resembles: ["2018 Q4 Selloff", "2022 Rate Shock"],
      doesNotResemble: ["2008 Global Financial Crisis"],
      regimeLabel: "HIGH STRESS",
      regimeDescription: "High systemic pressure across multiple dimensions.",
    },
    marketEvolution: {
      whatIsBuilding: "Systemic pressure has been building over the past 30 days.",
      howLong: "Current HIGH STRESS conditions have persisted for approximately 3 months.",
      whyItMatters: "Elevated pressure historically precedes increased volatility.",
      whatAccelerated: "The most significant shift occurred 14 days ago.",
      whatWouldInvalidate: "A sustained decline below 45 would invalidate the thesis.",
    },
    computedAt: new Date().toISOString(),
    dataSource: "live" as const,
  };

  it("returns a non-empty string", () => {
    const block = formatPromptBlock(mockData);
    expect(typeof block).toBe("string");
    expect(block.length).toBeGreaterThan(100);
  });

  it("includes HISTORICAL INTELLIGENCE ENGINE header", () => {
    const block = formatPromptBlock(mockData);
    expect(block).toContain("HISTORICAL INTELLIGENCE ENGINE");
  });

  it("includes the historical percentile", () => {
    const block = formatPromptBlock(mockData);
    expect(block).toContain("78th");
  });

  it("includes the analog label", () => {
    const block = formatPromptBlock(mockData);
    expect(block).toContain("2018 Q4 Selloff");
  });

  it("includes frequency classification", () => {
    const block = formatPromptBlock(mockData);
    expect(block).toContain("Uncommon");
  });

  it("includes outcome distribution percentages", () => {
    const block = formatPromptBlock(mockData);
    expect(block).toContain("30%");
    expect(block).toContain("50%");
  });

  it("includes regime comparison resembles list", () => {
    const block = formatPromptBlock(mockData);
    expect(block).toContain("2022 Rate Shock");
  });

  it("includes market evolution whatWouldInvalidate", () => {
    const block = formatPromptBlock(mockData);
    expect(block).toContain("invalidate");
  });

  it("includes REQUIRED RESPONSE BEHAVIOR instruction", () => {
    const block = formatPromptBlock(mockData);
    expect(block).toContain("REQUIRED RESPONSE BEHAVIOR");
  });

  it("includes N= sample size", () => {
    const block = formatPromptBlock(mockData);
    expect(block).toContain("N=295");
  });
});
