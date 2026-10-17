// ============================================================
// FAULTLINE Crypto Intelligence™ — server/cryptoIntelligence.test.ts
//
// Tests for the crypto signal scoring engine.
// CURRENT macro context binds to the canonical intelligence state.
// ============================================================
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildCanonicalIntelligenceState } from "./canonicalIntelligenceState";
import { getAuthoritativeCanonicalIntelligenceState } from "./canonicalIntelligenceState";
import { getCryptoIntelligence, clearCryptoCache } from "./cryptoIntelligence";
import { buildAtomicIntelligenceStateManifest, validateStoredIntelligenceManifest } from "./intelligenceGovernance";
import { resolveRunContext } from "./forwardRunProvenance";

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

const MOCK_GENERATED_AT = "2026-10-16T20:30:00.000Z"; // Friday, 16:30 ET
const MOCK_NOW = new Date("2026-10-16T21:00:00.000Z");
const MOCK_RUN_STARTED_AT = new Date(MOCK_GENERATED_AT);
const MOCK_VECTOR_VALUES = {
  "liquidity-stress": 40,
  "credit-contagion": 35,
  "volatility-regime": 50,
  "macro-sensitivity": 38,
  "market-breadth": 42,
  "ai-bubble": 40,
};
const MOCK_VECTOR_WEIGHTS: Record<string, number> = {
  "liquidity-stress": 0.20,
  "credit-contagion": 0.20,
  "volatility-regime": 0.15,
  "macro-sensitivity": 0.20,
  "market-breadth": 0.10,
  "ai-bubble": 0.15,
};
const MOCK_RAW_INPUTS = {
  hySpread: 350,
  sofr: 4.5,
  tsy10y: 4.2,
  tsy2y: 3.9,
  cpi: 2.7,
  ppi: 2.1,
  fedFunds: 4.25,
  unemployment: 4.1,
};
const MOCK_OBSERVATION_DATES = Object.fromEntries(
  Object.keys(MOCK_RAW_INPUTS).map(inputId => [inputId, "2026-10-16"]),
);

/** A complete, hash-valid scheduled MOCK source; it never represents a live provider result. */
function manifest(overrides: Record<string, unknown> = {}) {
  const pressureIndex = typeof overrides.pressureIndex === "number" ? overrides.pressureIndex : 45;
  const regime = typeof overrides.regime === "string" ? overrides.regime : "MODERATE STRESS";
  const engineValues = {
    ...MOCK_VECTOR_VALUES,
    ...(overrides.engineValues as Record<string, number> | undefined),
  };
  const pressure = {
    overallPressure: pressureIndex,
    regime,
    level: "Moderate",
    timestamp: MOCK_GENERATED_AT,
    lastUpdated: MOCK_GENERATED_AT,
    dataSource: "live",
    priorPressure: null,
    alerts: [],
    topAnalog: { year: 0, label: "UNAVAILABLE", similarity: 0, description: "MOCK canonical source has no analog claim." },
    analogs: [],
    vectors: Object.entries(engineValues).map(([id, score]) => ({
      id,
      label: id,
      description: `MOCK ${id} canonical vector`,
      score,
      level: "Moderate",
      driver: "MOCK canonical fixture",
      trend: "stable",
      weight: MOCK_VECTOR_WEIGHTS[id],
      rawInputs: { ...MOCK_RAW_INPUTS },
      observationDates: { ...MOCK_OBSERVATION_DATES },
      dataStatus: "live",
      source: "MOCK:FRED",
    })),
  } as any;
  const seismograph = {
    version: "seismograph-core-v1",
    computedAt: Date.parse(MOCK_GENERATED_AT),
    dataFreshness: "live",
    pressureScore: pressureIndex,
    regime,
    stressLevel: "Moderate",
    direction: "Stable",
    probabilities: { bull: 43, neutral: 43, bear: 14, primaryDriver: "MOCK canonical fixture", confidence: 55 },
    historicalPercentile: 50,
    analogMatches: [],
    topAnalog: { label: "UNAVAILABLE", similarity: 0, description: "MOCK canonical source has no analog claim." },
    activePatterns: [],
    patternsSummary: "MOCK canonical fixture",
    transitionProbabilities: { remainInRegime: 70, transitionToElevated: 15, transitionToLow: 10, transitionToCrisis: 5, primaryDriver: "MOCK canonical fixture" },
    evidenceFamilies: [],
    activeContributors: ["pressure"],
    evidenceConsensus: "moderate",
    marketMemory: { streakDays: 1, streakDirection: "stable", peakPressureThisCycle: pressureIndex, troughPressureThisCycle: pressureIndex, daysSinceLastTransition: 0, keyMemoryPoints: [] },
  } as any;
  const atomic = buildAtomicIntelligenceStateManifest({
    pressure,
    seismograph,
    originatingRunId: "seismograph:mock-crypto-2026-10-16",
    generatedAt: MOCK_GENERATED_AT,
    runContext: resolveRunContext("cron-endpoint", MOCK_RUN_STARTED_AT),
  });
  const stored = { ...atomic.manifest, inputQuality: atomic.inputQuality, runProvenance: atomic.runProvenance };
  if (!validateStoredIntelligenceManifest(stored)) throw new Error("Invalid canonical MOCK source fixture");
  return stored;
}

let boundCanonical: ReturnType<typeof buildCanonicalIntelligenceState> | null = null;
function bindCanonical(overrides: Record<string, unknown> = {}) {
  boundCanonical = buildCanonicalIntelligenceState(manifest(overrides));
  vi.mocked(getAuthoritativeCanonicalIntelligenceState).mockResolvedValue(boundCanonical);
}

afterEach(() => vi.useRealTimers());

describe("getCryptoIntelligence", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(MOCK_NOW);
    clearCryptoCache();
    bindCanonical();
  });

  it("returns a valid CryptoIntelligenceReport shape bound to canonical state", async () => {
    const report = await getCryptoIntelligence();

    expect(report).toBeDefined();
    expect(report.availability).toBe("AVAILABLE");
    expect(report.canonicalStateId).toBe(boundCanonical!.stateId);
    expect(boundCanonical).toMatchObject({
      generatedAt: MOCK_GENERATED_AT,
      confidenceOrEvidenceQuality: "PARTIAL",
      provenance: { coherenceStatus: "COHERENT", runTrigger: "SCHEDULED_CRON", scheduledPublication: true },
    });
    expect(boundCanonical!.stateHash).toMatch(/^[a-f0-9]{64}$/);
    expect(boundCanonical!.inputSnapshotId).toMatch(/^input:[a-f0-9]{32}$/);
    expect(boundCanonical!.engines).toHaveLength(6);
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
    expect(report.regime).toBeNull();
    expect(report.signals).toEqual([]);
    expect(report.btcDashboard.overallBtcBias).toBe("UNAVAILABLE");
    expect(report.btcDashboard.marketCyclePhase.phase).toBe("UNAVAILABLE");
    expect(report.altcoinRisk.overallRisk).toBe("UNAVAILABLE");
    expect(report.macroCorrelation.overallMacroSignal).toBe("UNAVAILABLE");
    expect(report.portfolioGuidance.overallBias).toBe("UNAVAILABLE");
  });
});

describe("Bear Market → Accumulation Phase classification", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(MOCK_NOW);
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
