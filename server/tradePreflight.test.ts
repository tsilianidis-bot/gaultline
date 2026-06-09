/**
 * FAULTLINE Situation Room — Trade Preflight Simulator
 * Vitest test suite for server/tradePreflight.ts
 *
 * Tests:
 *  - computeMarketStatus (Cleared / Caution / Defensive)
 *  - buildThreatBoard (severity ordering, required categories)
 *  - buildMarketCondition (snapshot fields)
 *  - simulateTrade (full output shape, score bounds, move types)
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mock LLM so tests run offline ────────────────────────────
vi.mock("./_core/llm", () => ({
  invokeLLM: vi.fn().mockResolvedValue({
    choices: [
      {
        message: {
          content:
            "Current regime pressure is moderate. The selected move carries manageable risk given stable credit conditions.",
        },
      },
    ],
  }),
}));

// ── Mock pressure engine ──────────────────────────────────────
const LOW_PRESSURE_OUTPUT = {
  overallPressure: 22,
  vectors: [
    { id: "liquidity-stress",   score: 18, label: "Liquidity Stress",   riskLevel: "low" },
    { id: "credit-contagion",   score: 20, label: "Credit Contagion",   riskLevel: "low" },
    { id: "volatility-regime",  score: 15, label: "Volatility Regime",  riskLevel: "low" },
    { id: "macro-sensitivity",  score: 22, label: "Macro Sensitivity",  riskLevel: "low" },
    { id: "market-breadth",     score: 19, label: "Market Breadth",     riskLevel: "low" },
    { id: "ai-bubble",          score: 25, label: "AI Bubble",          riskLevel: "low" },
    { id: "fed-policy",         score: 20, label: "Fed Policy",         riskLevel: "low" },
    { id: "recession-risk",     score: 18, label: "Recession Risk",     riskLevel: "low" },
  ],
  domains: [],
  regime: { label: "Expansion", description: "Stable macro conditions." },
  probability: { bullProbability: 72, crashProbability: 8 },
  narrative: { headline: "Stable conditions", summary: "Low systemic pressure." },
};

const HIGH_PRESSURE_OUTPUT = {
  overallPressure: 75,
  vectors: [
    { id: "liquidity-stress",   score: 72, label: "Liquidity Stress",   riskLevel: "critical" },
    { id: "credit-contagion",   score: 68, label: "Credit Contagion",   riskLevel: "critical" },
    { id: "volatility-regime",  score: 70, label: "Volatility Regime",  riskLevel: "critical" },
    { id: "macro-sensitivity",  score: 65, label: "Macro Sensitivity",  riskLevel: "elevated" },
    { id: "market-breadth",     score: 66, label: "Market Breadth",     riskLevel: "elevated" },
    { id: "ai-bubble",          score: 60, label: "AI Bubble",          riskLevel: "elevated" },
    { id: "fed-policy",         score: 58, label: "Fed Policy",         riskLevel: "elevated" },
    { id: "recession-risk",     score: 62, label: "Recession Risk",     riskLevel: "elevated" },
  ],
  domains: [],
  regime: { label: "Late-Cycle Stress", description: "Elevated systemic pressure." },
  probability: { bullProbability: 28, crashProbability: 55 },
  narrative: { headline: "Elevated risk", summary: "High systemic pressure." },
};

const MEDIUM_PRESSURE_OUTPUT = {
  overallPressure: 45,
  vectors: [
    { id: "liquidity-stress",   score: 42, label: "Liquidity Stress",   riskLevel: "moderate" },
    { id: "credit-contagion",   score: 38, label: "Credit Contagion",   riskLevel: "moderate" },
    { id: "volatility-regime",  score: 44, label: "Volatility Regime",  riskLevel: "moderate" },
    { id: "macro-sensitivity",  score: 40, label: "Macro Sensitivity",  riskLevel: "moderate" },
    { id: "market-breadth",     score: 45, label: "Market Breadth",     riskLevel: "moderate" },
    { id: "ai-bubble",          score: 35, label: "AI Bubble",          riskLevel: "low" },
    { id: "fed-policy",         score: 40, label: "Fed Policy",         riskLevel: "moderate" },
    { id: "recession-risk",     score: 38, label: "Recession Risk",     riskLevel: "moderate" },
  ],
  domains: [],
  regime: { label: "Transition", description: "Mixed macro signals." },
  probability: { bullProbability: 50, crashProbability: 28 },
  narrative: { headline: "Mixed signals", summary: "Moderate systemic pressure." },
};

// ── Import module under test ──────────────────────────────────
import {
  runTradePreflightSimulation as simulateTrade,
  type MoveType,
  type SimulatorTimeframe,
  type MarketStatus,
} from "./tradePreflight";

// ── Helper: build a minimal FaultlinePressureOutput ───────────
function makePressure(overallPressure: number, liquidityScore: number, creditScore: number) {
  return {
    overallPressure,
    vectors: [
      { id: "liquidity-stress",  score: liquidityScore, label: "Liquidity", riskLevel: "low" },
      { id: "credit-contagion",  score: creditScore,    label: "Credit",    riskLevel: "low" },
      { id: "volatility-regime", score: 20,             label: "Volatility",riskLevel: "low" },
      { id: "macro-sensitivity", score: 20,             label: "Macro",     riskLevel: "low" },
      { id: "market-breadth",    score: 20,             label: "Breadth",   riskLevel: "low" },
      { id: "ai-bubble",         score: 20,             label: "AI",        riskLevel: "low" },
      { id: "fed-policy",        score: 20,             label: "Fed",       riskLevel: "low" },
      { id: "recession-risk",    score: 20,             label: "Recession", riskLevel: "low" },
    ],
    domains: [],
    regime: { label: "Test Regime", description: "Test." },
    probability: { bullProbability: 60, crashProbability: 15 },
    narrative: { headline: "Test", summary: "Test." },
  };
}

// ── Test suites ───────────────────────────────────────────────

describe("simulateTrade — output shape", () => {
  it("returns all required fields for a buy_add_risk move", async () => {
    const result = await simulateTrade(
      { moveType: "buy_add_risk", timeframe: "today" },
      LOW_PRESSURE_OUTPUT as any
    );
    // Required fields
    expect(result).toHaveProperty("marketStatus");
    expect(result).toHaveProperty("moveType", "buy_add_risk");
    expect(result).toHaveProperty("moveLabel");
    expect(result).toHaveProperty("timeframe", "today");
    expect(result).toHaveProperty("timeframeLabel");
    expect(result).toHaveProperty("moveFavorabilityScore");
    expect(result).toHaveProperty("favorableSetupProbability");
    expect(result).toHaveProperty("adversePressureProbability");
    expect(result).toHaveProperty("riskLevel");
    expect(result).toHaveProperty("confidenceLevel");
    expect(result).toHaveProperty("actionBias");
    expect(result).toHaveProperty("bestVersionOfMove");
    expect(result).toHaveProperty("avoidAreas");
    expect(result).toHaveProperty("invalidationTriggers");
    expect(result).toHaveProperty("greenLights");
    expect(result).toHaveProperty("redFlags");
    expect(result).toHaveProperty("watchNext");
    expect(result).toHaveProperty("explanation");
    expect(result).toHaveProperty("marketCondition");
  });

  it("includes ticker in output when provided", async () => {
    const result = await simulateTrade(
      { moveType: "buy_specific_ticker", timeframe: "this_week", ticker: "NVDA" },
      LOW_PRESSURE_OUTPUT as any
    );
    expect(result.ticker).toBe("NVDA");
    expect(result.moveType).toBe("buy_specific_ticker");
  });
});

describe("simulateTrade — score bounds", () => {
  it("moveFavorabilityScore is between 0 and 100", async () => {
    for (const pressure of [LOW_PRESSURE_OUTPUT, MEDIUM_PRESSURE_OUTPUT, HIGH_PRESSURE_OUTPUT]) {
      const result = await simulateTrade(
        { moveType: "hold", timeframe: "one_three_months" },
        pressure as any
      );
      expect(result.moveFavorabilityScore).toBeGreaterThanOrEqual(0);
      expect(result.moveFavorabilityScore).toBeLessThanOrEqual(100);
    }
  });

  it("favorableSetupProbability + adversePressureProbability <= 100", async () => {
    const result = await simulateTrade(
      { moveType: "hedge", timeframe: "six_twelve_months" },
      MEDIUM_PRESSURE_OUTPUT as any
    );
    expect(result.favorableSetupProbability + result.adversePressureProbability).toBeLessThanOrEqual(100);
  });

  it("riskLevel is one of the valid values", async () => {
    const result = await simulateTrade(
      { moveType: "sell", timeframe: "today" },
      HIGH_PRESSURE_OUTPUT as any
    );
    expect(["Low", "Medium", "High", "Extreme"]).toContain(result.riskLevel);
  });

  it("confidenceLevel is one of the valid values", async () => {
    const result = await simulateTrade(
      { moveType: "raise_cash", timeframe: "today" },
      HIGH_PRESSURE_OUTPUT as any
    );
    expect(["Low", "Moderate", "High"]).toContain(result.confidenceLevel);
  });
});

describe("simulateTrade — market status logic", () => {
  it("returns Cleared when pressure is low", async () => {
    const result = await simulateTrade(
      { moveType: "buy_add_risk", timeframe: "today" },
      makePressure(20, 15, 18) as any
    );
    expect(result.marketStatus).toBe("Cleared");
  });

  it("returns Caution when overall pressure is in 40-59 range", async () => {
    const result = await simulateTrade(
      { moveType: "hold", timeframe: "this_week" },
      makePressure(45, 30, 30) as any
    );
    expect(result.marketStatus).toBe("Caution");
  });

  it("returns Defensive when overall pressure >= 60", async () => {
    const result = await simulateTrade(
      { moveType: "hedge", timeframe: "today" },
      makePressure(65, 30, 30) as any
    );
    expect(result.marketStatus).toBe("Defensive");
  });

  it("returns Defensive when credit score >= 60 even if overall is low", async () => {
    const result = await simulateTrade(
      { moveType: "trim", timeframe: "today" },
      makePressure(30, 20, 62) as any
    );
    expect(result.marketStatus).toBe("Defensive");
  });
});

describe("simulateTrade — threat board", () => {
  it("marketCondition.threatBoard is an array with expected categories", async () => {
    const result = await simulateTrade(
      { moveType: "buy_add_risk", timeframe: "today" },
      HIGH_PRESSURE_OUTPUT as any
    );
    const categories = result.marketCondition.threatBoard.map((t: any) => t.category);
    expect(categories).toContain("Volatility");
    expect(categories).toContain("Credit");
    expect(categories).toContain("Liquidity");
    expect(categories).toContain("Breadth");
    expect(categories).toContain("Rates");
    expect(categories).toContain("Speculation");
  });

  it("threat board is sorted with critical threats first", async () => {
    const result = await simulateTrade(
      { moveType: "buy_add_risk", timeframe: "today" },
      HIGH_PRESSURE_OUTPUT as any
    );
    const severities = result.marketCondition.threatBoard.map((t: any) => t.severity);
    const order: Record<string, number> = { critical: 0, elevated: 1, moderate: 2, low: 3 };
    for (let i = 0; i < severities.length - 1; i++) {
      expect(order[severities[i]]).toBeLessThanOrEqual(order[severities[i + 1]]);
    }
  });
});

describe("simulateTrade — all move types", () => {
  const moves: MoveType[] = [
    "buy_add_risk", "hold", "trim", "sell", "hedge",
    "raise_cash", "rotate_sectors", "buy_specific_ticker",
    "increase_crypto", "reduce_crypto",
  ];

  for (const move of moves) {
    it(`handles move type: ${move}`, async () => {
      const result = await simulateTrade(
        { moveType: move, timeframe: "this_week" },
        MEDIUM_PRESSURE_OUTPUT as any
      );
      expect(result.moveType).toBe(move);
      expect(typeof result.moveLabel).toBe("string");
      expect(result.moveLabel.length).toBeGreaterThan(0);
      expect(result.moveFavorabilityScore).toBeGreaterThanOrEqual(0);
      expect(result.moveFavorabilityScore).toBeLessThanOrEqual(100);
    });
  }
});

describe("simulateTrade — all timeframes", () => {
  const timeframes: SimulatorTimeframe[] = [
    "today", "this_week", "one_three_months", "six_twelve_months",
  ];

  for (const tf of timeframes) {
    it(`handles timeframe: ${tf}`, async () => {
      const result = await simulateTrade(
        { moveType: "hold", timeframe: tf },
        LOW_PRESSURE_OUTPUT as any
      );
      expect(result.timeframe).toBe(tf);
      expect(typeof result.timeframeLabel).toBe("string");
    });
  }
});

describe("simulateTrade — array fields are non-empty", () => {
  it("greenLights, redFlags, invalidationTriggers, watchNext are arrays", async () => {
    const result = await simulateTrade(
      { moveType: "buy_add_risk", timeframe: "today" },
      LOW_PRESSURE_OUTPUT as any
    );
    expect(Array.isArray(result.greenLights)).toBe(true);
    expect(Array.isArray(result.redFlags)).toBe(true);
    expect(Array.isArray(result.invalidationTriggers)).toBe(true);
    expect(Array.isArray(result.watchNext)).toBe(true);
  });

  it("avoidAreas is a non-empty array", async () => {
    const result = await simulateTrade(
      { moveType: "sell", timeframe: "this_week" },
      HIGH_PRESSURE_OUTPUT as any
    );
    expect(Array.isArray(result.avoidAreas)).toBe(true);
    expect(result.avoidAreas.length).toBeGreaterThan(0);
  });
});

describe("simulateTrade — defensive regime produces lower favorability for risk-on moves", () => {
  it("buy_add_risk scores lower under high pressure than low pressure", async () => {
    const [lowResult, highResult] = await Promise.all([
      simulateTrade({ moveType: "buy_add_risk", timeframe: "today" }, LOW_PRESSURE_OUTPUT as any),
      simulateTrade({ moveType: "buy_add_risk", timeframe: "today" }, HIGH_PRESSURE_OUTPUT as any),
    ]);
    expect(lowResult.moveFavorabilityScore).toBeGreaterThan(highResult.moveFavorabilityScore);
  });

  it("hedge scores higher under high pressure than low pressure", async () => {
    const [lowResult, highResult] = await Promise.all([
      simulateTrade({ moveType: "hedge", timeframe: "today" }, LOW_PRESSURE_OUTPUT as any),
      simulateTrade({ moveType: "hedge", timeframe: "today" }, HIGH_PRESSURE_OUTPUT as any),
    ]);
    expect(highResult.moveFavorabilityScore).toBeGreaterThan(lowResult.moveFavorabilityScore);
  });
});
