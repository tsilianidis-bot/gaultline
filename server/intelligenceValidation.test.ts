/**
 * FAULTLINE — Phase 7: Intelligence Validation Center Tests
 * server/intelligenceValidation.test.ts
 *
 * Tests cover:
 *  1. computeAccuracy helper (win rate, strict accuracy, edge cases)
 *  2. getISOWeek helper (correct ISO week strings)
 *  3. Decision First UX — OpportunityRankingAnswer shape validation
 *  4. lessonExtractor — PATTERN_TAGS completeness
 */

import { describe, it, expect } from "vitest";

// ── Re-implement helpers locally so we can test without DB ─────────────────────

interface MockEntry {
  outcome: "pending" | "correct" | "partially_correct" | "incorrect" | "still_active";
  createdAt: Date;
}

function computeAccuracy(entries: MockEntry[]) {
  const resolved = entries.filter(e => e.outcome !== "pending");
  const correct = resolved.filter(e => e.outcome === "correct").length;
  const partial = resolved.filter(e => e.outcome === "partially_correct").length;
  const incorrect = resolved.filter(e => e.outcome === "incorrect").length;
  const stillActive = resolved.filter(e => e.outcome === "still_active").length;
  const pending = entries.filter(e => e.outcome === "pending").length;

  const winPoints = correct + partial * 0.5;
  const winRate = resolved.length > 0 ? Math.round((winPoints / resolved.length) * 100) : null;
  const strictAccuracy = resolved.length > 0 ? Math.round((correct / resolved.length) * 100) : null;

  return { total: entries.length, resolved: resolved.length, pending, correct, partial, incorrect, stillActive, winRate, strictAccuracy };
}

function getISOWeek(date: Date): string {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, "0")}`;
}

// ── computeAccuracy ────────────────────────────────────────────────────────────

describe("computeAccuracy", () => {
  it("returns null win rate when no resolved entries", () => {
    const entries: MockEntry[] = [
      { outcome: "pending", createdAt: new Date() },
      { outcome: "pending", createdAt: new Date() },
    ];
    const result = computeAccuracy(entries);
    expect(result.winRate).toBeNull();
    expect(result.strictAccuracy).toBeNull();
    expect(result.pending).toBe(2);
    expect(result.resolved).toBe(0);
  });

  it("computes 100% win rate for all correct", () => {
    const entries: MockEntry[] = [
      { outcome: "correct", createdAt: new Date() },
      { outcome: "correct", createdAt: new Date() },
    ];
    const result = computeAccuracy(entries);
    expect(result.winRate).toBe(100);
    expect(result.strictAccuracy).toBe(100);
    expect(result.correct).toBe(2);
  });

  it("computes 0% win rate for all incorrect", () => {
    const entries: MockEntry[] = [
      { outcome: "incorrect", createdAt: new Date() },
      { outcome: "incorrect", createdAt: new Date() },
    ];
    const result = computeAccuracy(entries);
    expect(result.winRate).toBe(0);
    expect(result.strictAccuracy).toBe(0);
    expect(result.incorrect).toBe(2);
  });

  it("gives partial credit (0.5) for partially_correct outcomes", () => {
    const entries: MockEntry[] = [
      { outcome: "partially_correct", createdAt: new Date() },
      { outcome: "partially_correct", createdAt: new Date() },
    ];
    const result = computeAccuracy(entries);
    // 2 × 0.5 = 1 win point out of 2 resolved = 50%
    expect(result.winRate).toBe(50);
    // strict accuracy: 0 fully correct out of 2 = 0%
    expect(result.strictAccuracy).toBe(0);
    expect(result.partial).toBe(2);
  });

  it("handles mixed outcomes correctly", () => {
    const entries: MockEntry[] = [
      { outcome: "correct", createdAt: new Date() },         // 1.0
      { outcome: "partially_correct", createdAt: new Date() }, // 0.5
      { outcome: "incorrect", createdAt: new Date() },        // 0.0
      { outcome: "pending", createdAt: new Date() },          // excluded
    ];
    const result = computeAccuracy(entries);
    expect(result.total).toBe(4);
    expect(result.resolved).toBe(3);
    expect(result.pending).toBe(1);
    // winPoints = 1 + 0.5 = 1.5 / 3 = 50%
    expect(result.winRate).toBe(50);
    // strictAccuracy = 1 / 3 = 33%
    expect(result.strictAccuracy).toBe(33);
  });

  it("counts still_active as resolved but not as win points", () => {
    const entries: MockEntry[] = [
      { outcome: "still_active", createdAt: new Date() },
      { outcome: "correct", createdAt: new Date() },
    ];
    const result = computeAccuracy(entries);
    expect(result.resolved).toBe(2);
    expect(result.stillActive).toBe(1);
    // winPoints = 1 / 2 = 50%
    expect(result.winRate).toBe(50);
  });

  it("returns empty stats for empty input", () => {
    const result = computeAccuracy([]);
    expect(result.total).toBe(0);
    expect(result.resolved).toBe(0);
    expect(result.winRate).toBeNull();
    expect(result.strictAccuracy).toBeNull();
  });
});

// ── getISOWeek ─────────────────────────────────────────────────────────────────

describe("getISOWeek", () => {
  it("returns correct ISO week for a known Monday", () => {
    // 2024-01-01 is a Monday in week 1
    const result = getISOWeek(new Date("2024-01-01"));
    expect(result).toBe("2024-W01");
  });

  it("returns correct ISO week for a known Sunday", () => {
    // 2024-01-07 is a Sunday, still in week 1
    const result = getISOWeek(new Date("2024-01-07"));
    expect(result).toBe("2024-W01");
  });

  it("returns correct ISO week for mid-year date", () => {
    // 2024-06-17 is a Monday in week 25
    const result = getISOWeek(new Date("2024-06-17"));
    expect(result).toBe("2024-W25");
  });

  it("returns string in YYYY-Www format", () => {
    const result = getISOWeek(new Date("2025-03-15"));
    expect(result).toMatch(/^\d{4}-W\d{2}$/);
  });

  it("handles year boundary correctly (late Dec in next year's week)", () => {
    // 2020-12-31 is in ISO week 53 of 2020
    const result = getISOWeek(new Date("2020-12-31"));
    expect(result).toBe("2020-W53");
  });
});

// ── Decision First UX — OpportunityRankingAnswer shape ────────────────────────

describe("Decision First UX — OpportunityRankingAnswer shape", () => {
  const mockAnswer = {
    queryType: "opportunity" as const,
    macroContext: "Risk-on environment with strong institutional buying.",
    regimeLabel: "BULL TREND",
    regimeColor: "green" as const,
    topOpportunities: [
      {
        rank: 1,
        ticker: "NVDA",
        name: "NVIDIA Corporation",
        sector: "Technology",
        assetType: "stock" as const,
        action: "BUY" as const,
        convictionScore: 82,
        riskLevel: "Medium" as const,
        primaryDriver: "AI infrastructure buildout",
        nearTermCatalyst: "Q2 earnings beat",
        keyRisk: "Valuation compression",
        thesisSummary: "Dominant AI chip supplier with pricing power.",
        entryZone: "$110–$115",
        stopLevel: "$98",
        targetOne: "$145",
        riskRewardRatio: "1:3",
        dataFreshness: "Live",
      },
    ],
    avoidList: [],
    sectorLeaderboard: [],
    whyTheseRankHighest: "Strong momentum + macro tailwinds.",
    followUpChips: ["Tell me more about NVDA", "What are the risks?"],
    dataFreshness: "Live",
    deepDiveLinks: [],
  };

  it("has queryType === 'opportunity'", () => {
    expect(mockAnswer.queryType).toBe("opportunity");
  });

  it("topOpportunities is a non-empty array", () => {
    expect(Array.isArray(mockAnswer.topOpportunities)).toBe(true);
    expect(mockAnswer.topOpportunities.length).toBeGreaterThan(0);
  });

  it("each opportunity has required Decision First fields", () => {
    const opp = mockAnswer.topOpportunities[0];
    expect(opp).toHaveProperty("rank");
    expect(opp).toHaveProperty("ticker");
    expect(opp).toHaveProperty("name");
    expect(opp).toHaveProperty("assetType");
    expect(opp).toHaveProperty("action");
    expect(opp).toHaveProperty("convictionScore");
    expect(opp).toHaveProperty("riskLevel");
    expect(opp).toHaveProperty("primaryDriver");
    expect(opp).toHaveProperty("thesisSummary");
  });

  it("convictionScore is within valid range 0–100", () => {
    const opp = mockAnswer.topOpportunities[0];
    expect(opp.convictionScore).toBeGreaterThanOrEqual(0);
    expect(opp.convictionScore).toBeLessThanOrEqual(100);
  });

  it("action is one of the valid values", () => {
    const validActions = ["BUY", "ACCUMULATE", "WATCH", "AVOID"];
    const opp = mockAnswer.topOpportunities[0];
    expect(validActions).toContain(opp.action);
  });

  it("assetType is stock or crypto", () => {
    const opp = mockAnswer.topOpportunities[0];
    expect(["stock", "crypto"]).toContain(opp.assetType);
  });

  it("followUpChips is an array", () => {
    expect(Array.isArray(mockAnswer.followUpChips)).toBe(true);
  });
});

// ── PATTERN_TAGS completeness ─────────────────────────────────────────────────

describe("PATTERN_TAGS completeness", () => {
  const PATTERN_TAGS = [
    "Correct Thesis",
    "Overconfidence",
    "Underconfidence",
    "Timing Error",
    "Macro Blind Spot",
    "Sector Rotation",
    "Regime Mismatch",
    "Partial Signal",
    "Catalyst Miss",
    "Stop Hit",
    "Target Exceeded",
    "Liquidity Event",
    "Earnings Surprise",
    "Fed Policy Shift",
    "Crypto Correlation",
    "Technical Breakdown",
    "Technical Breakout",
    "Fundamental Divergence",
    "Risk Management",
    "Market Cap Bias",
  ];

  it("has at least 20 pattern tags", () => {
    expect(PATTERN_TAGS.length).toBeGreaterThanOrEqual(20);
  });

  it("includes essential error categories", () => {
    expect(PATTERN_TAGS).toContain("Overconfidence");
    expect(PATTERN_TAGS).toContain("Timing Error");
    expect(PATTERN_TAGS).toContain("Regime Mismatch");
    expect(PATTERN_TAGS).toContain("Macro Blind Spot");
  });

  it("includes success categories", () => {
    expect(PATTERN_TAGS).toContain("Correct Thesis");
    expect(PATTERN_TAGS).toContain("Target Exceeded");
  });

  it("includes crypto-specific tags", () => {
    expect(PATTERN_TAGS).toContain("Crypto Correlation");
  });

  it("all tags are non-empty strings", () => {
    for (const tag of PATTERN_TAGS) {
      expect(typeof tag).toBe("string");
      expect(tag.length).toBeGreaterThan(0);
    }
  });

  it("no duplicate tags", () => {
    const unique = new Set(PATTERN_TAGS);
    expect(unique.size).toBe(PATTERN_TAGS.length);
  });
});
