// ============================================================
// FAULTLINE Crypto Intelligence™ — server/cryptoIntelligence.test.ts
//
// Tests for the crypto signal scoring engine.
// CURRENT macro context binds to the canonical intelligence state.
// ============================================================
import { beforeEach, describe, expect, it, vi } from "vitest";
import { buildCanonicalIntelligenceState } from "./canonicalIntelligenceState";
import { getAuthoritativeCanonicalIntelligenceState } from "./canonicalIntelligenceState";
import { getCryptoIntelligence, clearCryptoCache } from "./cryptoIntelligence";

vi.mock("./canonicalIntelligenceState", async () => {
  const actual = await vi.importActual<typeof import("./canonicalIntelligenceState")>("./canonicalIntelligenceState");
  return {
    ...actual,
    getAuthoritativeCanonicalIntelligenceState: vi.fn(),
  };
});

vi.mock("./_core/llm", () => ({
  invokeLLM: vi.fn().mockResolvedValue({
    choices: [{ message: { content: "Test AI narrative for crypto markets." } }],
  }),
}));

function manifest(overrides: Record<string, unknown> = {}) {
  return {
    stateId: "state:crypto-test",
    generatedAt: "2026-09-12T00:00:00.000Z",
    championVersion: "champion-v1-frozen",
    modelVersion: "2.0",
    scoringVersion: "faultline-pressure-v1-frozen",
    configurationVersion: "phase1b-governance-v1",
    inputSnapshotId: "input:crypto-test",
    stateHash: "hash:crypto-test",
    pressureIndex: 45,
    regime: "MODERATE STRESS",
    engineValues: {
      "liquidity-stress": 40,
      "credit-contagion": 35,
      "volatility-regime": 50,
      "macro-sensitivity": 38,
      "market-breadth": 42,
      "ai-bubble": 40,
    },
    engineDirections: { "liquidity-stress": "stable" },
    domainValues: {},
    scenarioOutputs: { bull: 43, neutral: 43, bear: 14 },
    probabilityClaimIds: [],
    analogClaimIds: [],
    historicalDatasetVersion: "historical",
    researchDatasetVersion: "research",
    coherenceStatus: "COHERENT",
    coherenceNotes: [],
    dataQualitySummary: { staleInputs: [], unavailableInputs: [], fallbackInputs: [], staticInputs: [] },
    staleInputs: [],
    unavailableInputs: [],
    fallbackInputs: [],
    inputQuality: [],
    ...overrides,
  };
}

function bindCanonical(overrides: Record<string, unknown> = {}) {
  vi.mocked(getAuthoritativeCanonicalIntelligenceState).mockResolvedValue(
    buildCanonicalIntelligenceState(manifest(overrides)),
  );
}

describe("getCryptoIntelligence", () => {
  beforeEach(() => {
    clearCryptoCache();
    bindCanonical();
  });

  it("returns a valid CryptoIntelligenceReport shape bound to canonical state", async () => {
    const report = await getCryptoIntelligence();

    expect(report).toBeDefined();
    expect(report.availability).toBe("AVAILABLE");
    expect(report.canonicalStateId).toBe("state:crypto-test");
    expect(typeof report.generatedAt).toBe("number");
    expect(report.pressureIndex).toBe(45);
    expect(report.regime).toBe("MODERATE STRESS");
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

  it("second call returns cached result for the same stateId", async () => {
    const first  = await getCryptoIntelligence();
    const second = await getCryptoIntelligence();
    expect(second.cached).toBe(true);
    expect(second.generatedAt).toBe(first.generatedAt);
  });

  it("clearCryptoCache forces fresh fetch on next call", async () => {
    await getCryptoIntelligence();
    clearCryptoCache();
    const second = await getCryptoIntelligence();
    expect(second.cached).toBe(false);
    expect(getAuthoritativeCanonicalIntelligenceState).toHaveBeenCalled();
  });

  it("pressureIndex matches the canonical pressureIndex", async () => {
    const report = await getCryptoIntelligence();
    expect(report.pressureIndex).toBe(45);
  });

  it("withholds CURRENT crypto truth when canonical state is missing", async () => {
    vi.mocked(getAuthoritativeCanonicalIntelligenceState).mockResolvedValue(null);
    const report = await getCryptoIntelligence();
    expect(report.availability).toBe("UNAVAILABLE");
    expect(report.pressureIndex).toBeNull();
    expect(report.signals).toEqual([]);
    expect(report.btcDashboard.overallBtcBias).toBe("UNAVAILABLE");
    expect(report.btcDashboard.marketCyclePhase.phase).toBe("UNAVAILABLE");
  });
});

describe("Bear Market → Accumulation Phase classification", () => {
  beforeEach(() => {
    clearCryptoCache();
    bindCanonical({
      pressureIndex: 55,
      regime: "ELEVATED STRESS",
      engineValues: {
        "liquidity-stress": 50,
        "credit-contagion": 40,
        "volatility-regime": 45,
        "macro-sensitivity": 42,
        "market-breadth": 45,
        "ai-bubble": 40,
      },
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
    bindCanonical({
      pressureIndex: 20,
      regime: "RISK ON",
      engineValues: {
        "liquidity-stress": 20,
        "credit-contagion": 20,
        "volatility-regime": 25,
        "macro-sensitivity": 22,
        "market-breadth": 15,
        "ai-bubble": 20,
      },
    });
    const report = await getCryptoIntelligence();
    expect(report.btcDashboard.marketCyclePhase.phase).not.toBe("Bear Market → Accumulation Phase");
    expect(report.btcDashboard.accumulationAnalysis).toBeUndefined();
  });

  it("does NOT include accumulationAnalysis under crisis/bear conditions", async () => {
    clearCryptoCache();
    bindCanonical({
      pressureIndex: 88,
      regime: "CRISIS",
      engineValues: {
        "liquidity-stress": 80,
        "credit-contagion": 80,
        "volatility-regime": 75,
        "macro-sensitivity": 78,
        "market-breadth": 82,
        "ai-bubble": 80,
      },
    });
    const report = await getCryptoIntelligence();
    expect(report.btcDashboard.marketCyclePhase.phase).not.toBe("Bear Market → Accumulation Phase");
    expect(report.btcDashboard.accumulationAnalysis).toBeUndefined();
  });
});
