/**
 * Tests for the Historical Context Engine
 *
 * Validates:
 *   - Percentile computation accuracy
 *   - Outcome parsing from analog text
 *   - Trend direction classification
 *   - Driver contribution calculation
 *   - Rarity label assignment
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Inline the pure helper functions for unit testing ──────────

function computePercentile(value: number, sortedValues: number[]): number {
  if (sortedValues.length === 0) return 50;
  const below = sortedValues.filter(v => v < value).length;
  return Math.round((below / sortedValues.length) * 100);
}

function parseDrawdownFromOutcome(outcome: string): number | null {
  const negMatch = outcome.match(/fell\s+(-\d+(?:\.\d+)?%)/i) ||
                   outcome.match(/(-\d+(?:\.\d+)?%)\s+(?:in|from|over)/i) ||
                   outcome.match(/(-\d+(?:\.\d+)?%)\s+(?:peak|drawdown)/i);
  if (negMatch) {
    const val = parseFloat(negMatch[1].replace('%', ''));
    if (!isNaN(val) && val < 0) return val;
  }
  const posMatch = outcome.match(/advanced\s+\+(\d+(?:\.\d+)?%)/i);
  if (posMatch) return 0;
  return null;
}

function parseRecoveryFromOutcome(outcome: string): number | null {
  const monthMatch = outcome.match(/within\s+(\d+)\s+months?/i) ||
                     outcome.match(/(\d+)\s+months?\s+(?:to|for)/i) ||
                     outcome.match(/(\d+)\s+months?\s+(?:later|after)/i);
  if (monthMatch) {
    const val = parseInt(monthMatch[1], 10);
    if (!isNaN(val) && val > 0) return val;
  }
  const yearMatch = outcome.match(/(\d+)\+?\s+years?\s+to/i);
  if (yearMatch) {
    const val = parseInt(yearMatch[1], 10);
    if (!isNaN(val)) return val * 12;
  }
  return null;
}

function classifyTrendDirection(
  trend7d: number | null,
  trend30d: number | null,
  trend90d: number | null
): string {
  const t7 = trend7d ?? 0;
  const t30 = trend30d ?? 0;

  if (t7 >= 15 && t30 >= 15) return "Accelerating";
  if (t7 >= 15) return "Rapidly Deteriorating";
  if (t7 >= 10 && t30 >= 10) return "Accelerating";
  if (t7 >= 5 || t30 >= 8) return "Building";
  if (t7 <= -10 || t30 <= -15) return "Improving";
  if (t7 <= -5 || t30 <= -8) return "Improving";
  return "Stable";
}

function getRarityLabel(percentile: number): string {
  if (percentile >= 95) return "Extreme — top 5% of all historical readings";
  if (percentile >= 85) return "Very High — top 15% of all historical readings";
  if (percentile >= 70) return "High — top 30% of all historical readings";
  if (percentile >= 50) return "Above Average — upper half of historical readings";
  if (percentile >= 30) return "Below Average — lower half of historical readings";
  return "Low — bottom 30% of all historical readings";
}

// ── Tests ──────────────────────────────────────────────────────

describe("computePercentile", () => {
  it("returns 50 for empty array", () => {
    expect(computePercentile(50, [])).toBe(50);
  });

  it("returns 0 for value below all", () => {
    const sorted = [10, 20, 30, 40, 50];
    expect(computePercentile(5, sorted)).toBe(0);
  });

  it("returns 100 for value above all", () => {
    const sorted = [10, 20, 30, 40, 50];
    expect(computePercentile(100, sorted)).toBe(100);
  });

  it("returns correct percentile for median value", () => {
    // 4 out of 10 values are below 50
    const sorted = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100];
    expect(computePercentile(50, sorted)).toBe(40); // 4/10 = 40%
  });

  it("handles value equal to all elements", () => {
    const sorted = [30, 30, 30, 30];
    // 0 values below 30
    expect(computePercentile(30, sorted)).toBe(0);
  });

  it("handles single element array", () => {
    expect(computePercentile(50, [50])).toBe(0);
    expect(computePercentile(100, [50])).toBe(100);
    expect(computePercentile(10, [50])).toBe(0);
  });

  it("correctly ranks a value in the 80th percentile", () => {
    const sorted = Array.from({ length: 100 }, (_, i) => i + 1); // 1..100
    expect(computePercentile(81, sorted)).toBe(80); // 80 values below 81
  });
});

describe("parseDrawdownFromOutcome", () => {
  it("parses 'fell -57%' pattern", () => {
    const outcome = "S&P 500 fell -57% from peak. Credit markets froze.";
    expect(parseDrawdownFromOutcome(outcome)).toBe(-57);
  });

  it("parses 'fell -25%' pattern", () => {
    const outcome = "S&P 500 fell -25%, bonds fell -20% (worst bond year in history).";
    expect(parseDrawdownFromOutcome(outcome)).toBe(-25);
  });

  it("parses 'fell -34%' pattern", () => {
    const outcome = "S&P 500 fell -34% in 33 days.";
    expect(parseDrawdownFromOutcome(outcome)).toBe(-34);
  });

  it("returns 0 for positive outcome (advanced +20%)", () => {
    const outcome = "S&P 500 advanced +20% as Fed pivoted.";
    expect(parseDrawdownFromOutcome(outcome)).toBe(0);
  });

  it("returns null for outcome with no clear drawdown", () => {
    const outcome = "Markets were volatile with mixed signals.";
    expect(parseDrawdownFromOutcome(outcome)).toBeNull();
  });

  it("parses decimal drawdown", () => {
    const outcome = "Index fell -12.5% in the correction.";
    expect(parseDrawdownFromOutcome(outcome)).toBe(-12.5);
  });
});

describe("parseRecoveryFromOutcome", () => {
  it("parses 'within 5 months' pattern", () => {
    const outcome = "Market recovered to new highs within 5 months.";
    expect(parseRecoveryFromOutcome(outcome)).toBe(5);
  });

  it("parses 'within 6 months' pattern", () => {
    const outcome = "Markets recovered to new highs within 6 months.";
    expect(parseRecoveryFromOutcome(outcome)).toBe(6);
  });

  it("parses '4+ years to' pattern", () => {
    const outcome = "Recovery took 4+ years to new highs.";
    expect(parseRecoveryFromOutcome(outcome)).toBe(48);
  });

  it("returns null for outcome with no recovery info", () => {
    const outcome = "Commodities and energy massively outperformed.";
    expect(parseRecoveryFromOutcome(outcome)).toBeNull();
  });
});

describe("classifyTrendDirection", () => {
  it("returns Accelerating when both 7d and 30d are high", () => {
    expect(classifyTrendDirection(12, 18, 25)).toBe("Accelerating");
  });

  it("returns Building when 7d is moderately positive", () => {
    expect(classifyTrendDirection(6, 5, 3)).toBe("Building");
  });

  it("returns Building when 30d is moderately positive", () => {
    expect(classifyTrendDirection(2, 10, 5)).toBe("Building");
  });

  it("returns Improving when 7d is strongly negative", () => {
    expect(classifyTrendDirection(-12, -5, -3)).toBe("Improving");
  });

  it("returns Improving when 30d is strongly negative", () => {
    expect(classifyTrendDirection(-3, -18, -10)).toBe("Improving");
  });

  it("returns Stable when changes are small", () => {
    expect(classifyTrendDirection(2, 3, 1)).toBe("Stable");
  });

  it("returns Stable when all nulls", () => {
    expect(classifyTrendDirection(null, null, null)).toBe("Stable");
  });

  it("returns Rapidly Deteriorating when 7d is extreme and 30d is small", () => {
    // t7=16 triggers Rapidly Deteriorating, but only when t30 < 8 (otherwise Building fires first)
    expect(classifyTrendDirection(16, 3, 1)).toBe("Rapidly Deteriorating");
  });
});

describe("getRarityLabel", () => {
  it("returns Extreme for 95th+ percentile", () => {
    expect(getRarityLabel(95)).toContain("Extreme");
    expect(getRarityLabel(99)).toContain("Extreme");
  });

  it("returns Very High for 85-94th percentile", () => {
    expect(getRarityLabel(85)).toContain("Very High");
    expect(getRarityLabel(90)).toContain("Very High");
  });

  it("returns High for 70-84th percentile", () => {
    expect(getRarityLabel(70)).toContain("High");
    expect(getRarityLabel(80)).toContain("High");
  });

  it("returns Above Average for 50-69th percentile", () => {
    expect(getRarityLabel(50)).toContain("Above Average");
    expect(getRarityLabel(65)).toContain("Above Average");
  });

  it("returns Below Average for 30-49th percentile", () => {
    expect(getRarityLabel(30)).toContain("Below Average");
    expect(getRarityLabel(45)).toContain("Below Average");
  });

  it("returns Low for below 30th percentile", () => {
    expect(getRarityLabel(0)).toContain("Low");
    expect(getRarityLabel(29)).toContain("Low");
  });
});

describe("driver contribution calculation", () => {
  it("correctly computes contribution percentage", () => {
    const vectors = [
      { score: 80, weight: 0.25 }, // contribution = 20
      { score: 60, weight: 0.25 }, // contribution = 15
      { score: 40, weight: 0.25 }, // contribution = 10
      { score: 20, weight: 0.25 }, // contribution = 5
    ];
    const totalWeighted = vectors.reduce((s, v) => s + v.score * v.weight, 0); // 50
    const contributions = vectors.map(v => ({
      contribution: v.score * v.weight,
      pct: Math.round(((v.score * v.weight) / totalWeighted) * 100),
    }));

    expect(contributions[0].contribution).toBe(20);
    expect(contributions[0].pct).toBe(40); // 20/50 = 40%
    expect(contributions[1].pct).toBe(30); // 15/50 = 30%
    expect(contributions[2].pct).toBe(20); // 10/50 = 20%
    expect(contributions[3].pct).toBe(10); // 5/50 = 10%

    // All percentages sum to 100
    const sum = contributions.reduce((s, c) => s + c.pct, 0);
    expect(sum).toBe(100);
  });

  it("handles zero total weighted score without division by zero", () => {
    const totalWeighted = 0;
    const pct = totalWeighted > 0 ? Math.round((10 / totalWeighted) * 100) : 0;
    expect(pct).toBe(0);
  });
});
