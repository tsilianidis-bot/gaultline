// ============================================================
// FAULTLINE Crypto Intelligence™ — server/cryptoIntelligence.test.ts
//
// Tests for the crypto signal scoring engine.
// Validates that all scoring functions produce valid output
// shapes and that the tRPC procedure is wired correctly.
// ============================================================
import { describe, it, expect, vi, beforeEach } from "vitest";
import { getCryptoIntelligence, clearCryptoCache } from "./cryptoIntelligence";
import { calculateFaultlinePressure } from "./pressure/engine";

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
    vi.mocked(calculateFaultlinePressure).mockClear();
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
    expect(calculateFaultlinePressure).toHaveBeenCalledTimes(2);
  });

  it("pressureIndex matches the mocked overallPressure", async () => {
    const report = await getCryptoIntelligence();
    expect(report.pressureIndex).toBe(45);
  });
});

// ── Bear Market → Accumulation Phase tests ───────────────────────────────────
// These tests use a second mock that produces conditions matching the
// isAccumulationPhase criteria:
//   trendScore 25–55 (pressure 40–70 + equity 40–65 → trend = 100 - (p*0.6 + eq*0.4))
//   pressure 40–70
//   liquidity 35–60 (liquidity = 100 - liquidityVectorScore, so vector 40–65)
//   credit < 60
//   equity < 65

describe("Bear Market → Accumulation Phase classification", () => {
  beforeEach(() => {
    clearCryptoCache();
    // Override mock with accumulation-phase conditions:
    //   pressure = 55 (in 40–70 range)
    //   liquidity vector score = 50 → liquidity = 50 (in 35–60 range)
    //   credit_stress = 40 (< 60)
    //   equity_stress = 45 (< 65)
    //   trendScore = 100 - (55*0.6 + 45*0.4) = 100 - (33 + 18) = 49 (in 25–55 range)
    (calculateFaultlinePressure as ReturnType<typeof vi.fn>).mockResolvedValue({
      overallPressure: 55,
      regime: "ELEVATED STRESS",
      level: "Elevated",
      vectors: [
        { id: "liquidity",     score: 50, driver: "test", trend: "stable" },
        { id: "yield_curve",   score: 45, driver: "test", trend: "stable" },
        { id: "credit_stress", score: 40, driver: "test", trend: "stable" },
        { id: "equity_stress", score: 45, driver: "test", trend: "stable" },
        { id: "sovereign_debt",score: 42, driver: "test", trend: "stable" },
      ],
      alerts: [],
      topAnalog: { year: 2019, label: "2019 Trade War", similarity: 0.7, description: "test" },
      analogs: [],
      timestamp: new Date().toISOString(),
      dataSource: "fallback" as const,
    });
  });

  it("classifies as 'Bear Market → Accumulation Phase' under accumulation conditions", async () => {
    const report = await getCryptoIntelligence();
    expect(report.btcDashboard.marketCyclePhase.phase).toBe("Bear Market → Accumulation Phase");
  });

  it("sets cycle confidence to 63 for accumulation phase", async () => {
    const report = await getCryptoIntelligence();
    expect(report.btcDashboard.marketCyclePhase.confidence).toBe(63);
  });

  it("includes accumulationAnalysis when in accumulation phase", async () => {
    const report = await getCryptoIntelligence();
    expect(report.btcDashboard.accumulationAnalysis).toBeDefined();
  });

  it("accumulationAnalysis has correct direct answer", async () => {
    const report = await getCryptoIntelligence();
    const a = report.btcDashboard.accumulationAnalysis!;
    expect(a.directAnswer).toBe(
      "Bitcoin appears to be in an accumulation phase inside a broader bear-market structure."
    );
  });

  it("accumulationAnalysis has all required fields", async () => {
    const report = await getCryptoIntelligence();
    const a = report.btcDashboard.accumulationAnalysis!;
    expect(typeof a.confidenceLevel).toBe("number");
    expect(a.confidenceLevel).toBeGreaterThanOrEqual(0);
    expect(a.confidenceLevel).toBeLessThanOrEqual(100);
    expect(["High", "Moderate", "Low"]).toContain(a.confidenceLabel);
    expect(Array.isArray(a.keyEvidence)).toBe(true);
    expect(a.keyEvidence.length).toBeGreaterThanOrEqual(3);
    expect(a.keyEvidence.length).toBeLessThanOrEqual(5);
    expect(Array.isArray(a.bullCycleConfirmation)).toBe(true);
    expect(a.bullCycleConfirmation.length).toBe(5);
    expect(Array.isArray(a.invalidationSignals)).toBe(true);
    expect(a.invalidationSignals.length).toBe(5);
    expect(typeof a.tradingBias).toBe("string");
    expect(a.tradingBias.length).toBeGreaterThan(50);
    expect(typeof a.disclaimer).toBe("string");
  });

  it("marketCyclePhase note describes base-forming and unconfirmed bull cycle", async () => {
    const report = await getCryptoIntelligence();
    const note = report.btcDashboard.marketCyclePhase.note;
    expect(note).toContain("base");
    expect(note).toContain("not confirmed");
  });

  it("tradingBias emphasizes capital preservation", async () => {
    const report = await getCryptoIntelligence();
    const bias = report.btcDashboard.accumulationAnalysis!.tradingBias;
    expect(bias.toLowerCase()).toContain("capital preservation");
  });

  it("does NOT include accumulationAnalysis under bull conditions", async () => {
    clearCryptoCache();
    // Override with bull conditions: high trend, high liquidity, low pressure
    (calculateFaultlinePressure as ReturnType<typeof vi.fn>).mockResolvedValue({
      overallPressure: 20,
      regime: "RISK ON",
      level: "Low",
      vectors: [
        { id: "liquidity",     score: 20, driver: "test", trend: "stable" }, // liquidity = 80
        { id: "yield_curve",   score: 25, driver: "test", trend: "stable" },
        { id: "credit_stress", score: 20, driver: "test", trend: "stable" },
        { id: "equity_stress", score: 15, driver: "test", trend: "stable" }, // trendScore = 100-(20*0.6+15*0.4) = 88
        { id: "sovereign_debt",score: 22, driver: "test", trend: "stable" },
      ],
      alerts: [],
      topAnalog: { year: 2019, label: "2019 Trade War", similarity: 0.7, description: "test" },
      analogs: [],
      timestamp: new Date().toISOString(),
      dataSource: "fallback" as const,
    });
    const report = await getCryptoIntelligence();
    // Should be Mid Bull or Early Bull, not accumulation
    expect(report.btcDashboard.marketCyclePhase.phase).not.toBe("Bear Market → Accumulation Phase");
    expect(report.btcDashboard.accumulationAnalysis).toBeUndefined();
  });

  it("does NOT include accumulationAnalysis under crisis/bear conditions", async () => {
    clearCryptoCache();
    // Override with crisis conditions: very high pressure, very low liquidity
    (calculateFaultlinePressure as ReturnType<typeof vi.fn>).mockResolvedValue({
      overallPressure: 88,
      regime: "CRISIS",
      level: "Critical",
      vectors: [
        { id: "liquidity",     score: 80, driver: "test", trend: "stable" }, // liquidity = 20
        { id: "yield_curve",   score: 75, driver: "test", trend: "stable" },
        { id: "credit_stress", score: 80, driver: "test", trend: "stable" },
        { id: "equity_stress", score: 82, driver: "test", trend: "stable" },
        { id: "sovereign_debt",score: 78, driver: "test", trend: "stable" },
      ],
      alerts: [],
      topAnalog: { year: 2019, label: "2019 Trade War", similarity: 0.7, description: "test" },
      analogs: [],
      timestamp: new Date().toISOString(),
      dataSource: "fallback" as const,
    });
    const report = await getCryptoIntelligence();
    expect(report.btcDashboard.marketCyclePhase.phase).not.toBe("Bear Market → Accumulation Phase");
    expect(report.btcDashboard.accumulationAnalysis).toBeUndefined();
  });
});
