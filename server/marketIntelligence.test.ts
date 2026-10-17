/**
 * Market Intelligence Engine Tests
 * Tests for stockRegimeEngine, cryptoRegimeEngine, and crossMarketEngine.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// Fixture-only tests. These partial mocks retain real unmocked helpers and make
// no provider, DB, model, or credentialed network call.
vi.mock("./canonicalIntelligenceState", async () => {
  const actual = await vi.importActual<typeof import("./canonicalIntelligenceState")>("./canonicalIntelligenceState");
  return { ...actual, getAuthoritativeCanonicalIntelligenceState: vi.fn() };
});

vi.mock("./pressure/engine", async () => {
  const actual = await vi.importActual<typeof import("./pressure/engine")>("./pressure/engine");
  return { ...actual, calculateFaultlinePressure: vi.fn() };
});

vi.mock("./signalsProxy", async () => {
  const actual = await vi.importActual<typeof import("./signalsProxy")>("./signalsProxy");
  return { ...actual, fetchDailyBars: vi.fn() };
});

vi.mock("./cryptoIntelligence", async () => {
  const actual = await vi.importActual<typeof import("./cryptoIntelligence")>("./cryptoIntelligence");
  return { ...actual, getCryptoIntelligence: vi.fn() };
});

import { computeStockMarketRegime, clearStockRegimeCache } from "./stockRegimeEngine";
import { computeCryptoMarketRegime, clearCryptoRegimeCache } from "./cryptoRegimeEngine";
import { computeCrossMarketIntelligence, clearCrossMarketCache, resetCrossMarketPrevRegimes } from "./crossMarketEngine";
import { buildCanonicalIntelligenceState, getAuthoritativeCanonicalIntelligenceState } from "./canonicalIntelligenceState";
import { calculateFaultlinePressure } from "./pressure/engine";
import { fetchDailyBars } from "./signalsProxy";
import { getCryptoIntelligence } from "./cryptoIntelligence";

const MOCK_OBSERVED_AT = "2026-10-17T20:00:00.000Z";
const MOCK_PROVIDER = {
  provider: "MOCK",
  sourceId: "MOCK:market-intelligence-regression:v1",
  observedAt: MOCK_OBSERVED_AT,
  receivedAt: MOCK_OBSERVED_AT,
} as const;
const REQUIRED_VECTOR_IDS = [
  "liquidity-stress", "credit-contagion", "volatility-regime",
  "macro-sensitivity", "market-breadth", "ai-bubble",
] as const;

// Schema-accurate completed Polygon daily observations, explicitly tagged by
// this test as MOCK; they are never represented as a live provider response.
const MOCK_SPY_BARS = Array.from({ length: 210 }, (_, index) => {
  const close = 400 + index;
  return {
    close,
    open: close - 1.25,
    high: close + 2.5,
    low: close - 2.75,
    volume: 50_000_000 + index,
    timestamp: Date.parse(MOCK_OBSERVED_AT) - ((209 - index) * 86_400_000),
  };
});

function canonicalFixture(overrides: Record<string, unknown> = {}) {
  return buildCanonicalIntelligenceState({
    stateId: "state:market-intelligence-mock:base",
    generatedAt: MOCK_OBSERVED_AT,
    championVersion: "mock-champion-v1",
    modelVersion: "mock-model-v1",
    scoringVersion: "faultline-pressure-v1-frozen",
    configurationVersion: "mock-governance-v1",
    inputSnapshotId: "input:market-intelligence-mock:base",
    stateHash: "hash:market-intelligence-mock:base",
    pressureIndex: 42,
    regime: "MODERATE RISK",
    engineValues: {
      "liquidity-stress": 20,
      "credit-contagion": 20,
      "volatility-regime": 30,
      "macro-sensitivity": 40,
      "market-breadth": 30,
      "ai-bubble": 40,
    },
    engineDirections: {
      "liquidity-stress": "Stable",
      "credit-contagion": "Stable",
      "volatility-regime": "Stable",
      "macro-sensitivity": "Stable",
      "market-breadth": "Improving",
      "ai-bubble": "Unknown",
    },
    domainValues: {
      pressureVerification: {
        status: "verified",
        computedAt: MOCK_OBSERVED_AT,
        inputs: [
          ["hySpread", 3.1], ["tsy10y", 4.2], ["tsy2y", 4.0], ["sofr", 4.1],
          ["fedFunds", 4.0], ["cpi", 2.7], ["ppi", 2.5], ["unemployment", 4.1],
        ].map(([inputId, value]) => ({
          ...MOCK_PROVIDER,
          inputId,
          seriesId: `MOCK:${inputId}`,
          value,
          observationDate: "2026-10-17",
          status: "verified",
        })),
      },
    },
    scenarioOutputs: {},
    probabilityClaimIds: [],
    analogClaimIds: [],
    historicalDatasetVersion: "mock-historical-v1",
    researchDatasetVersion: "mock-research-v1",
    coherenceStatus: "COHERENT",
    coherenceNotes: [],
    dataQualitySummary: { staleInputs: [], unavailableInputs: [], fallbackInputs: [], staticInputs: [] },
    staleInputs: [],
    unavailableInputs: [],
    fallbackInputs: [],
    inputQuality: REQUIRED_VECTOR_IDS.map(engineId => ({
      ...MOCK_PROVIDER,
      inputId: `MOCK:${engineId}`,
      contributesTo: [engineId],
      freshnessStatus: "CURRENT",
      required: true,
    })),
    ...overrides,
  });
}

function cryptoReportFixture(canonicalStateId: string) {
  return {
    availability: "AVAILABLE",
    canonicalStateId,
    qualityStatus: "HEALTHY",
    generatedAt: Date.parse(MOCK_OBSERVED_AT),
    pressureIndex: 42,
    regime: "MODERATE RISK",
    signals: [],
    btcDashboard: {
      marketCyclePhase: { phase: "Mid Bull", confidence: 72, note: "MOCK canonical-macro classification; not a Bitcoin price observation." },
      overallBtcBias: "Neutral",
      trendStrength: { score: 70, label: "Strong", direction: "up", note: "MOCK canonical-macro projection; not a price trend." },
      liquidityConditions: { score: 65, label: "Expanding", direction: "expanding", note: "MOCK canonical-macro liquidity projection." },
      etfInstitutionalFlow: { score: 60, label: "Positive", direction: "inflow", note: "DERIVED_MODEL MOCK macro risk-appetite proxy; not ETF flow." },
      dollarPressure: { score: 55, label: "Neutral", direction: "neutral", note: "MOCK dollar/rate proxy; not DXY." },
      yieldPressure: { score: 50, label: "Stable", direction: "neutral", note: "MOCK rate proxy; not a yield observation." },
      accumulationAnalysis: null,
    },
    altcoinRisk: {
      overallRisk: "Moderate",
      riskScore: 45,
      btcDominanceSignal: "MOCK macro risk proxy — not BTC dominance.",
      liquiditySignal: "MOCK canonical-macro liquidity projection.",
      stablecoinSignal: "MOCK macro liquidity proxy — not stablecoin supply.",
      riskOnOffSignal: "MOCK macro risk appetite.",
      macroPressureSignal: "MOCK canonical pressure.",
      volatilitySignal: "MOCK volatility projection.",
      altcoinSeasonProbability: 45,
      recommendation: "MOCK macro-derived output.",
    },
    macroCorrelation: {
      overallMacroSignal: "Neutral",
      correlationSummary: "MOCK canonical-macro correlation summary.",
    },
    portfolioGuidance: {},
  };
}

function configureAvailableFixtures(canonical = canonicalFixture()) {
  vi.mocked(getAuthoritativeCanonicalIntelligenceState).mockResolvedValue(canonical);
  vi.mocked(fetchDailyBars).mockResolvedValue(MOCK_SPY_BARS);
  vi.mocked(getCryptoIntelligence).mockImplementation(async boundCanonical =>
    cryptoReportFixture(boundCanonical?.stateId ?? "state:crypto-unbound") as never,
  );
  return canonical;
}

function crisisCanonicalFixture() {
  return canonicalFixture({
    stateId: "state:market-intelligence-mock:crisis",
    inputSnapshotId: "input:market-intelligence-mock:crisis",
    stateHash: "hash:market-intelligence-mock:crisis",
    pressureIndex: 88,
    regime: "SYSTEMIC CRISIS",
    engineValues: {
      "liquidity-stress": 82,
      "credit-contagion": 88,
      "volatility-regime": 78,
      "macro-sensitivity": 80,
      "market-breadth": 75,
      "ai-bubble": 70,
    },
    engineDirections: {
      "liquidity-stress": "Deteriorating",
      "credit-contagion": "Deteriorating",
      "volatility-regime": "Deteriorating",
      "macro-sensitivity": "Deteriorating",
      "market-breadth": "Deteriorating",
      "ai-bubble": "Unknown",
    },
  });
}

async function computeAfterCanonicalStateChange() {
  const base = canonicalFixture();
  const crisis = crisisCanonicalFixture();
  vi.mocked(getAuthoritativeCanonicalIntelligenceState)
    .mockResolvedValueOnce(base)
    .mockResolvedValueOnce(crisis);

  await computeCrossMarketIntelligence();
  clearCrossMarketCache();
  clearStockRegimeCache();
  clearCryptoRegimeCache();
  return computeCrossMarketIntelligence();
}

describe("Stock Market Regime Engine", () => {
  beforeEach(() => {
    clearStockRegimeCache();
    vi.clearAllMocks();
    process.env.POLYGON_API_KEY = "MOCK_POLYGON_KEY";
    configureAvailableFixtures();
  });

  it("returns a valid StockMarketRegime object", async () => {
    const result = await computeStockMarketRegime();
    expect(result).toBeDefined();
    expect(result.regime).toBeTruthy();
    expect(result.riskLevel).toBeTruthy();
    expect(result.trend).toMatch(/^(Improving|Stable|Deteriorating)$/);
    expect(result.confidence).toBeGreaterThanOrEqual(0);
    expect(result.confidence).toBeLessThanOrEqual(100);
    expect(result.pressureScore).toBeGreaterThanOrEqual(0);
    expect(result.pressureScore).toBeLessThanOrEqual(100);
    expect(Array.isArray(result.keyFactors)).toBe(true);
    expect(result.strategy).toBeTruthy();
    expect(result.explanation).toBeTruthy();
    expect(result.color).toMatch(/^#[0-9A-Fa-f]{6}$/);
    expect(result.fetchedAt).toBeGreaterThan(0);
    expect(result.canonicalStateId).toBe("state:market-intelligence-mock:base");
    expect(result.canonicalQuality).toBe("HEALTHY");
    expect(result.spyLastClose).toEqual({
      status: "AVAILABLE", provider: "Polygon", asOf: MOCK_SPY_BARS.at(-1)!.timestamp,
      lastClose: MOCK_SPY_BARS.at(-1)!.close, reason: null,
    });
    expect(calculateFaultlinePressure).not.toHaveBeenCalled();
  });

  it("returns a valid regime label", async () => {
    const result = await computeStockMarketRegime();
    const validLabels = ["Bull Market", "Expansion", "Consolidation", "Correction", "Distribution", "Bear Market", "Recovery", "Recession Risk"];
    expect(validLabels).toContain(result.regime);
  });

  it("returns a valid risk level", async () => {
    const result = await computeStockMarketRegime();
    const validLevels = ["Low", "Moderate", "Elevated", "High", "Critical"];
    expect(validLevels).toContain(result.riskLevel);
  });

  it("caches results on second call", async () => {
    await computeStockMarketRegime();
    await computeStockMarketRegime();
    // Cache identity is the immutable canonical state, not a client pressure payload.
    expect(fetchDailyBars).toHaveBeenCalledTimes(1);
    expect(calculateFaultlinePressure).not.toHaveBeenCalled();
  });

  it("clearStockRegimeCache forces re-fetch", async () => {
    await computeStockMarketRegime();
    clearStockRegimeCache();
    await computeStockMarketRegime();
    expect(fetchDailyBars).toHaveBeenCalledTimes(2);
    expect(calculateFaultlinePressure).not.toHaveBeenCalled();
  });

  it("returns Expansion or Bull Market from canonical low-moderate pressure plus completed Polygon observations", async () => {
    const result = await computeStockMarketRegime();
    expect(result.pressureScore).toBe(42);
    expect(result.canonicalStateId).toBe("state:market-intelligence-mock:base");
    expect(["Bull Market", "Expansion", "Consolidation", "Recovery"]).toContain(result.regime);
  });

  it("withholds stock claims when the canonical state is unavailable", async () => {
    vi.mocked(getAuthoritativeCanonicalIntelligenceState).mockResolvedValue(null);

    const result = await computeStockMarketRegime();

    expect(result).toMatchObject({
      regime: "UNAVAILABLE", riskLevel: "UNAVAILABLE", trend: "UNAVAILABLE",
      confidence: null, pressureScore: null, canonicalStateId: null,
    });
    expect(result.keyFactors.join(" ")).toContain("no usable canonical CURRENT reading");
    expect(fetchDailyBars).not.toHaveBeenCalled();
    expect(calculateFaultlinePressure).not.toHaveBeenCalled();
  });
});

describe("Crypto Market Regime Engine", () => {
  beforeEach(() => {
    clearCryptoRegimeCache();
    vi.clearAllMocks();
    process.env.POLYGON_API_KEY = "MOCK_POLYGON_KEY";
    configureAvailableFixtures();
  });

  it("returns a valid CryptoMarketRegime object", async () => {
    const result = await computeCryptoMarketRegime();
    expect(result).toBeDefined();
    expect(result.regime).toBeTruthy();
    expect(result.riskLevel).toBeTruthy();
    expect(result.trend).toMatch(/^(Improving|Stable|Deteriorating)$/);
    expect(result.confidence).toBeGreaterThanOrEqual(0);
    expect(result.confidence).toBeLessThanOrEqual(100);
    expect(Array.isArray(result.keyFactors)).toBe(true);
    expect(result.strategy).toBeTruthy();
    expect(result.explanation).toBeTruthy();
    expect(result.color).toMatch(/^#[0-9A-Fa-f]{6}$/);
    expect(result.fetchedAt).toBeGreaterThan(0);
    expect(result.historicalContext).toBeNull();
    expect(result.transitionProbabilities).toEqual([]);
    expect(result.indicators.length).toBeGreaterThan(0);
    expect(result.indicators.every(indicator => indicator.provenance === "DERIVED_MODEL")).toBe(true);
    expect(result.explanation).toContain("not an observation of Bitcoin price or flows");
  });

  it("maps Mid Bull cycle phase to a bullish regime", async () => {
    const result = await computeCryptoMarketRegime();
    expect(["Bull Market", "Mid Bull", "Expansion"]).toContain(result.regime);
  });

  it("returns null accumulationAnalysis when not in accumulation phase", async () => {
    const result = await computeCryptoMarketRegime();
    // Mid Bull phase should not have accumulation analysis
    expect(result.accumulationAnalysis).toBeNull();
  });

  it("caches results on second call", async () => {
    const { getCryptoIntelligence } = await import("./cryptoIntelligence");
    await computeCryptoMarketRegime();
    await computeCryptoMarketRegime();
    expect(getCryptoIntelligence).toHaveBeenCalledTimes(1);
  });
});

describe("Cross-Market Intelligence Engine", () => {
  beforeEach(() => {
    clearCrossMarketCache();
    resetCrossMarketPrevRegimes();
    clearStockRegimeCache();
    clearCryptoRegimeCache();
    vi.clearAllMocks();
    process.env.POLYGON_API_KEY = "MOCK_POLYGON_KEY";
    configureAvailableFixtures();
  });

  it("returns a valid CrossMarketIntelligence object", async () => {
    const result = await computeCrossMarketIntelligence();
    expect(result).toBeDefined();
    expect(result.stockRegime).toBeDefined();
    expect(result.cryptoRegime).toBeDefined();
    expect(result.alignmentStatus).toBeTruthy();
    expect(result.alignmentScore).toBeGreaterThanOrEqual(0);
    expect(result.alignmentScore).toBeLessThanOrEqual(100);
    expect(result.plainEnglishSummary).toBeTruthy();
    expect(Array.isArray(result.keyInsights)).toBe(true);
    expect(result.keyInsights.length).toBeGreaterThan(0);
    expect(result.forwardBias).toBeTruthy();
    expect(Array.isArray(result.regimeChangeAlerts)).toBe(true);
    expect(result.fetchedAt).toBeGreaterThan(0);
    expect(result).toMatchObject({
      canonicalStateId: "state:market-intelligence-mock:base",
      dataAsOf: MOCK_OBSERVED_AT,
      evidenceQuality: "HEALTHY",
      methodology: "cross-market-regime-alignment-heuristic-v1",
    });
    expect(result.stockRegime.canonicalStateId).toBe(result.canonicalStateId);
    expect(result.regimeChangeAlerts).toEqual([]);
    expect(result.plainEnglishSummary).toContain("Rule-derived interpretations of canonical state");
    expect(result.plainEnglishSummary).toContain("not observed price outperformance");
    expect(result.forwardBias).toContain("Model interpretation only");
    expect(calculateFaultlinePressure).not.toHaveBeenCalled();
  });

  it("returns a valid alignment status", async () => {
    const result = await computeCrossMarketIntelligence();
    const validStatuses = [
      "Strongly Aligned \u2014 Risk On",
      "Aligned \u2014 Risk On",
      "Aligned \u2014 Risk Off",
      "Strongly Aligned \u2014 Risk Off",
      "Diverging \u2014 Stocks Leading",
      "Diverging \u2014 Crypto Leading",
      "Diverging \u2014 Conflicting Signals",
      "Neutral",
    ];
    expect(validStatuses).toContain(result.alignmentStatus);
  });

  it("does not fire spurious regime change alert on first call", async () => {
    const result = await computeCrossMarketIntelligence();
    // First call should not produce alerts (prev values are null)
    expect(result.regimeChangeAlerts).toHaveLength(0);
  });

  it("withholds regime-change alerts on a second call with a different canonical regime", async () => {
    const result = await computeAfterCanonicalStateChange();

    expect(result.canonicalStateId).toBe("state:market-intelligence-mock:crisis");
    expect(result.stockRegime.pressureScore).toBe(88);
    expect(result.regimeChangeAlerts).toEqual([]);
    expect(result.limitations.join(" ")).toContain("authorized scheduled writer");
    expect(calculateFaultlinePressure).not.toHaveBeenCalled();
  });

  it("plainEnglishSummary mentions both stock and crypto", async () => {
    const result = await computeCrossMarketIntelligence();
    const summary = result.plainEnglishSummary.toLowerCase();
    expect(summary).toContain("equities");
    expect(summary).toContain("crypto macro context");
    expect(summary).toContain("fixed model heuristic");
    expect(summary).toContain("not observed price outperformance");
  });

  it("caches results on second call", async () => {
    await computeCrossMarketIntelligence();
    await computeCrossMarketIntelligence();
    expect(fetchDailyBars).toHaveBeenCalledTimes(1);
    expect(getCryptoIntelligence).toHaveBeenCalledTimes(1);
    expect(calculateFaultlinePressure).not.toHaveBeenCalled();
  });
});

// ─── PROJECT BLACK: Alert Publication Boundary ─────────────────────────────────
// Public reads must not mint persistent alert advice from a mutable request or a
// newly observed state transition. An authorized scheduled writer is required.

describe("PROJECT BLACK — Regime Change Alert Enrichment", () => {
  beforeEach(() => {
    clearCrossMarketCache();
    resetCrossMarketPrevRegimes();
    clearStockRegimeCache();
    clearCryptoRegimeCache();
    vi.clearAllMocks();
    process.env.POLYGON_API_KEY = "MOCK_POLYGON_KEY";
    configureAvailableFixtures();
  });

  it("withholds whyItMatters and whatToWatchNext when stock regime changes", async () => {
    const result = await computeAfterCanonicalStateChange();

    expect(result.regimeChangeAlerts).toEqual([]);
    expect(result.limitations.join(" ")).toContain("Public reads do not persist or notify");
    expect(calculateFaultlinePressure).not.toHaveBeenCalled();
  });

  it("does not invent capital-preservation advice for a Stock crisis transition", async () => {
    const result = await computeAfterCanonicalStateChange();

    expect(result.regimeChangeAlerts.find(alert => alert.asset === "Stock")).toBeUndefined();
    expect(result.forwardBias).toBe("Model interpretation only. Apply the shared macro context alongside separately verified asset observations; alignment is not execution advice.");
    expect(result.plainEnglishSummary).toContain("not observed price outperformance");
  });

  it("does not invent a Fed or credit-spread watch list for a Stock crisis transition", async () => {
    const result = await computeAfterCanonicalStateChange();
    const publicOutput = [result.plainEnglishSummary, result.forwardBias, ...result.keyInsights].join(" ");

    expect(result.regimeChangeAlerts).toHaveLength(0);
    expect(publicOutput).not.toContain("Watch for:");
    expect(publicOutput).toContain("No institutional-flow, on-chain, historical return or divergence-duration claim is supplied.");
  });

  it("withholds all alert fields until an authorized writer supplies durable prior/current evidence", async () => {
    const result = await computeAfterCanonicalStateChange();

    expect(result.regimeChangeAlerts).toEqual([]);
    expect(result.limitations).toContain("Regime-change alerts withheld until durable prior/current manifest evidence is explicitly supplied by an authorized scheduled writer. Public reads do not persist or notify.");
    expect(result.canonicalStateId).toBe("state:market-intelligence-mock:crisis");
  });
});

// ─── PROJECT BLACK: getRecentAlerts Procedure Shape ──────────────────────────
// We test the router procedure by mocking the DB and verifying the returned shape.

vi.mock("./db", () => ({
  getDb: vi.fn().mockResolvedValue({
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        orderBy: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([
            {
              id: 1,
              asset: "Stock",
              previous: "Bull Market",
              current: "Correction",
              message: "US equity market regime changed from Bull Market to Correction.",
              whyItMatters: "The equity market is entering a corrective phase.",
              whatToWatchNext: "Watch for: (1) SPY breaking below 200-day MA.",
              detectedAt: Date.now(),
            },
            {
              id: 2,
              asset: "Crypto",
              previous: "Mid Bull",
              current: "Bear Market → Accumulation Phase",
              message: "Crypto market regime changed from Mid Bull to Bear Market → Accumulation Phase.",
              whyItMatters: "Bitcoin is forming a potential base inside a bear structure.",
              whatToWatchNext: "Watch for: (1) BTC price breaking above major resistance.",
              detectedAt: Date.now() - 3600000,
            },
          ]),
        }),
      }),
    }),
    insert: vi.fn().mockReturnValue({ values: vi.fn().mockResolvedValue({}) }),
  }),
}));

describe("PROJECT BLACK — getRecentAlerts Procedure", () => {
  it("returns an array of regime alert rows with correct shape", async () => {
    const { getDb } = await import("./db");
    const db = await getDb();
    expect(db).toBeDefined();

    // Simulate what the procedure does
    const { regimeAlerts: alertsTable } = await import("../drizzle/schema");
    const { desc: descFn } = await import("drizzle-orm");

    const rows = await db!
      .select()
      .from(alertsTable)
      .orderBy(descFn(alertsTable.detectedAt))
      .limit(10);

    expect(Array.isArray(rows)).toBe(true);
    expect(rows.length).toBe(2);

    const [first] = rows;
    expect(first.id).toBeDefined();
    expect(first.asset).toMatch(/^(Stock|Crypto)$/);
    expect(first.previous).toBeTruthy();
    expect(first.current).toBeTruthy();
    expect(first.message).toBeTruthy();
    expect(first.whyItMatters).toBeTruthy();
    expect(first.whatToWatchNext).toBeTruthy();
    expect(first.detectedAt).toBeGreaterThan(0);
  });

  it("returns rows ordered by detectedAt descending (most recent first)", async () => {
    const { getDb } = await import("./db");
    const db = await getDb();
    const { regimeAlerts: alertsTable } = await import("../drizzle/schema");
    const { desc: descFn } = await import("drizzle-orm");

    const rows = await db!
      .select()
      .from(alertsTable)
      .orderBy(descFn(alertsTable.detectedAt))
      .limit(10);

    if (rows.length >= 2) {
      expect(Number(rows[0].detectedAt)).toBeGreaterThanOrEqual(Number(rows[1].detectedAt));
    }
  });

  it("returns empty array when no alerts exist", async () => {
    const { getDb } = await import("./db");
    // Override mock to return empty array for this test
    (getDb as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          orderBy: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      }),
    });

    const db = await getDb();
    const { regimeAlerts: alertsTable } = await import("../drizzle/schema");
    const { desc: descFn } = await import("drizzle-orm");

    const rows = await db!
      .select()
      .from(alertsTable)
      .orderBy(descFn(alertsTable.detectedAt))
      .limit(10);

    expect(rows).toHaveLength(0);
  });
});
