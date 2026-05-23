// ============================================================
// FAULTLINE Crypto Intelligence™ — server/cryptoIntelligence.test.ts
//
// Tests for the crypto signal scoring engine.
// Validates that all scoring functions produce valid output
// shapes and that the tRPC procedure is wired correctly.
// ============================================================
import { describe, it, expect, vi, beforeEach } from "vitest";
import { getCryptoIntelligence, clearCryptoCache } from "./cryptoIntelligence";

// Mock the pressure engine to return deterministic values
vi.mock("./pressure/engine", () => ({
  calculateFaultlinePressure: vi.fn().mockResolvedValue({
    overallPressure: 45,
    regime: "MODERATE STRESS",
    level: "Elevated",
    vectors: [
      { id: "liquidity",     score: 40, driver: "test", trend: "stable" },
      { id: "yield_curve",   score: 50, driver: "test", trend: "stable" },
      { id: "credit_stress", score: 35, driver: "test", trend: "stable" },
      { id: "equity_stress", score: 42, driver: "test", trend: "stable" },
      { id: "sovereign_debt",score: 38, driver: "test", trend: "stable" },
    ],
    alerts: [],
    topAnalog: { year: 2019, label: "2019 Trade War", similarity: 0.7, description: "test" },
    analogs: [],
    timestamp: new Date().toISOString(),
    dataSource: "fallback" as const,
  }),
}));

// Mock LLM to avoid real API calls in tests
vi.mock("./_core/llm", () => ({
  invokeLLM: vi.fn().mockResolvedValue({
    choices: [{ message: { content: "Test AI narrative for crypto markets." } }],
  }),
}));

describe("getCryptoIntelligence", () => {
  beforeEach(() => {
    clearCryptoCache();
  });

  it("returns a valid CryptoIntelligenceReport shape", async () => {
    const report = await getCryptoIntelligence();

    expect(report).toBeDefined();
    expect(typeof report.generatedAt).toBe("number");
    expect(typeof report.pressureIndex).toBe("number");
    expect(typeof report.regime).toBe("string");
    expect(Array.isArray(report.signals)).toBe(true);
    expect(report.btcDashboard).toBeDefined();
    expect(report.altcoinRisk).toBeDefined();
    expect(report.macroCorrelation).toBeDefined();
    expect(report.portfolioGuidance).toBeDefined();
  });

  it("returns exactly 6 crypto asset signals", async () => {
    const report = await getCryptoIntelligence();
    expect(report.signals).toHaveLength(6);
  });

  it("each signal has required fields with valid values", async () => {
    const report = await getCryptoIntelligence();
    const validSignals = ["Bullish", "Neutral", "Bearish"];
    const validRisks   = ["Low", "Moderate", "Elevated", "High", "Critical"];
    const validMomentum = ["Accelerating", "Stable", "Decelerating", "Reversing"];

    report.signals.forEach(asset => {
      expect(asset.id).toBeTruthy();
      expect(asset.name).toBeTruthy();
      expect(asset.ticker).toBeTruthy();
      expect(validSignals).toContain(asset.signal);
      expect(validRisks).toContain(asset.risk);
      expect(validMomentum).toContain(asset.momentum);
      expect(asset.signalScore).toBeGreaterThanOrEqual(0);
      expect(asset.signalScore).toBeLessThanOrEqual(100);
      expect(asset.riskScore).toBeGreaterThanOrEqual(0);
      expect(asset.riskScore).toBeLessThanOrEqual(100);
      expect(asset.explanation).toBeTruthy();
      expect(Array.isArray(asset.keyDrivers)).toBe(true);
      expect(asset.keyDrivers.length).toBeGreaterThan(0);
      expect(["Aligned", "Diverging", "Neutral"]).toContain(asset.macroAlignment);
    });
  });

  it("signals include all expected tickers", async () => {
    const report = await getCryptoIntelligence();
    const tickers = report.signals.map(s => s.ticker);
    expect(tickers).toContain("BTC");
    expect(tickers).toContain("ETH");
    expect(tickers).toContain("SOL");
    expect(tickers).toContain("TOTAL");
    expect(tickers).toContain("ALT");
    expect(tickers).toContain("STABLE");
  });

  it("BTC dashboard has all 6 required metrics", async () => {
    const report = await getCryptoIntelligence();
    const d = report.btcDashboard;
    expect(d.trendStrength).toBeDefined();
    expect(d.liquidityConditions).toBeDefined();
    expect(d.dollarPressure).toBeDefined();
    expect(d.yieldPressure).toBeDefined();
    expect(d.etfInstitutionalFlow).toBeDefined();
    expect(d.marketCyclePhase).toBeDefined();
    expect(["Bullish", "Neutral", "Bearish"]).toContain(d.overallBtcBias);
    expect(d.aiNarrative).toBeTruthy();
  });

  it("BTC dashboard scores are in valid range", async () => {
    const report = await getCryptoIntelligence();
    const d = report.btcDashboard;
    [d.trendStrength.score, d.liquidityConditions.score, d.dollarPressure.score,
     d.yieldPressure.score, d.etfInstitutionalFlow.score].forEach(score => {
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(100);
    });
    expect(d.marketCyclePhase.confidence).toBeGreaterThanOrEqual(0);
    expect(d.marketCyclePhase.confidence).toBeLessThanOrEqual(100);
  });

  it("altcoin risk has valid structure", async () => {
    const report = await getCryptoIntelligence();
    const a = report.altcoinRisk;
    expect(["Low", "Moderate", "Elevated", "High", "Critical"]).toContain(a.overallRisk);
    expect(a.riskScore).toBeGreaterThanOrEqual(0);
    expect(a.riskScore).toBeLessThanOrEqual(100);
    expect(a.altcoinSeasonProbability).toBeGreaterThanOrEqual(0);
    expect(a.altcoinSeasonProbability).toBeLessThanOrEqual(100);
    expect(a.recommendation).toBeTruthy();
  });

  it("macro correlation has all 6 factors", async () => {
    const report = await getCryptoIntelligence();
    const c = report.macroCorrelation;
    expect(c.fedPolicyImpact).toBeDefined();
    expect(c.interestRateImpact).toBeDefined();
    expect(c.dollarStrength).toBeDefined();
    expect(c.liquidityCycle).toBeDefined();
    expect(c.equityRiskAppetite).toBeDefined();
    expect(c.bondMarketStress).toBeDefined();
    expect(["Bullish", "Neutral", "Bearish"]).toContain(c.overallMacroSignal);
    expect(c.correlationSummary).toBeTruthy();
  });

  it("portfolio guidance has all 4 asset classes", async () => {
    const report = await getCryptoIntelligence();
    const g = report.portfolioGuidance;
    expect(g.btcGuidance.action).toBeTruthy();
    expect(g.ethGuidance.action).toBeTruthy();
    expect(g.altGuidance.action).toBeTruthy();
    expect(g.stableGuidance.action).toBeTruthy();
    expect(g.overallBias).toBeTruthy();
    expect(g.disclaimer).toBeTruthy();
  });

  it("second call returns cached result", async () => {
    const first  = await getCryptoIntelligence();
    const second = await getCryptoIntelligence();
    expect(second.cached).toBe(true);
    expect(second.generatedAt).toBe(first.generatedAt);
  });

  it("clearCryptoCache forces fresh fetch on next call", async () => {
    const first = await getCryptoIntelligence();
    clearCryptoCache();
    const second = await getCryptoIntelligence();
    // After clearing cache, second call should NOT be cached
    expect(second.cached).toBe(false);
  });

  it("pressureIndex matches the mocked overallPressure", async () => {
    const report = await getCryptoIntelligence();
    expect(report.pressureIndex).toBe(45);
  });
});
