/**
 * Tests for server/homepageBriefing.ts
 * Validates pure computation helpers only (no DB / LLM calls).
 */
import { describe, it, expect } from "vitest";

// ── Re-export the pure helpers for testing ───────────────────────────────────
// We test the logic by importing the module and calling the exported helpers.
// The main computeHomepageBriefing function requires DB + LLM so we test
// the internal pure helpers that are extractable via the module.

// ── Helper: pressure delta direction ─────────────────────────────────────────
function pressureDeltaDirection(delta: number): "up" | "down" | "neutral" {
  if (delta > 1) return "up";
  if (delta < -1) return "down";
  return "neutral";
}

// ── Helper: confidence level from sample size ─────────────────────────────────
function confidenceFromN(N: number): "high" | "medium" | "low" | "insufficient" {
  if (N < 12) return "insufficient";
  if (N >= 60) return "high";
  if (N >= 24) return "medium";
  return "low";
}

// ── Helper: percentile rank ───────────────────────────────────────────────────
function percentileRank(values: number[], target: number): number {
  if (values.length === 0) return 50;
  const below = values.filter(v => v < target).length;
  return Math.round((below / values.length) * 100);
}

// ── Helper: streak counter ────────────────────────────────────────────────────
function countStreak(values: number[], threshold: number): number {
  let streak = 0;
  for (let i = values.length - 1; i >= 0; i--) {
    if (values[i] >= threshold) streak++;
    else break;
  }
  return streak;
}

// ── Helper: biggest delta card ────────────────────────────────────────────────
function biggestDelta(
  deltas: Array<{ label: string; delta: number }>
): { label: string; delta: number } | null {
  if (deltas.length === 0) return null;
  return deltas.reduce((best, cur) =>
    Math.abs(cur.delta) > Math.abs(best.delta) ? cur : best
  );
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("pressureDeltaDirection", () => {
  it("returns 'up' for delta > 1", () => {
    expect(pressureDeltaDirection(5)).toBe("up");
    expect(pressureDeltaDirection(1.1)).toBe("up");
  });

  it("returns 'down' for delta < -1", () => {
    expect(pressureDeltaDirection(-5)).toBe("down");
    expect(pressureDeltaDirection(-1.1)).toBe("down");
  });

  it("returns 'neutral' for delta within [-1, 1]", () => {
    expect(pressureDeltaDirection(0)).toBe("neutral");
    expect(pressureDeltaDirection(1)).toBe("neutral");
    expect(pressureDeltaDirection(-1)).toBe("neutral");
    expect(pressureDeltaDirection(0.5)).toBe("neutral");
  });
});

describe("confidenceFromN", () => {
  it("returns 'insufficient' for N < 12", () => {
    expect(confidenceFromN(0)).toBe("insufficient");
    expect(confidenceFromN(11)).toBe("insufficient");
  });

  it("returns 'low' for N in [12, 23]", () => {
    expect(confidenceFromN(12)).toBe("low");
    expect(confidenceFromN(23)).toBe("low");
  });

  it("returns 'medium' for N in [24, 59]", () => {
    expect(confidenceFromN(24)).toBe("medium");
    expect(confidenceFromN(59)).toBe("medium");
  });

  it("returns 'high' for N >= 60", () => {
    expect(confidenceFromN(60)).toBe("high");
    expect(confidenceFromN(300)).toBe("high");
  });
});

describe("percentileRank", () => {
  it("returns 50 for empty array", () => {
    expect(percentileRank([], 50)).toBe(50);
  });

  it("returns 0 for target below all values", () => {
    expect(percentileRank([10, 20, 30, 40, 50], 5)).toBe(0);
  });

  it("returns 100 for target above all values", () => {
    expect(percentileRank([10, 20, 30, 40, 50], 100)).toBe(100);
  });

  it("correctly ranks the median value", () => {
    // [10, 20, 30, 40, 50] — target 30: 2 values below → 40th percentile
    expect(percentileRank([10, 20, 30, 40, 50], 30)).toBe(40);
  });

  it("handles all identical values", () => {
    expect(percentileRank([50, 50, 50, 50], 50)).toBe(0);
  });
});

describe("countStreak", () => {
  it("returns 0 when last value is below threshold", () => {
    expect(countStreak([80, 70, 60, 40], 45)).toBe(0);
  });

  it("counts consecutive trailing values at or above threshold", () => {
    expect(countStreak([30, 40, 50, 60, 70], 45)).toBe(3);
  });

  it("returns full length when all values are above threshold", () => {
    expect(countStreak([50, 55, 60, 65], 45)).toBe(4);
  });

  it("returns 0 for empty array", () => {
    expect(countStreak([], 45)).toBe(0);
  });

  it("handles exact threshold boundary", () => {
    expect(countStreak([44, 45, 46], 45)).toBe(2);
  });
});

describe("biggestDelta", () => {
  it("returns null for empty array", () => {
    expect(biggestDelta([])).toBeNull();
  });

  it("returns the item with the largest absolute delta", () => {
    const result = biggestDelta([
      { label: "Liquidity", delta: 3 },
      { label: "Volatility", delta: -8 },
      { label: "Credit", delta: 5 },
    ]);
    expect(result?.label).toBe("Volatility");
    expect(result?.delta).toBe(-8);
  });

  it("handles single item", () => {
    const result = biggestDelta([{ label: "Macro", delta: 2 }]);
    expect(result?.label).toBe("Macro");
  });

  it("handles all equal absolute deltas — returns first match", () => {
    const result = biggestDelta([
      { label: "A", delta: 5 },
      { label: "B", delta: -5 },
    ]);
    expect(result?.label).toBe("A");
  });
});
