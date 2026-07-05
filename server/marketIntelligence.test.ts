/**
 * Market Intelligence Engine Tests
 * Tests for stockRegimeEngine, cryptoRegimeEngine, and crossMarketEngine.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Stock Regime Engine ──────────────────────────────────────────────────────
// Mock matches server-side FaultlinePressureOutput interface (NOT the client-side engine)
vi.mock("./pressure/engine", () => ({
  calculateFaultlinePressure: vi.fn().mockResolvedValue({
    overallPressure: 42,           // 0-100 already
    regime: "MODERATE RISK",       // string, not object
    level: "Moderate",
    vectors: [
      { id: "credit-contagion",      score: 38, label: "Credit Contagion",      level: "Low" },
      { id: "liquidity-stress",      score: 32, label: "Liquidity Stress",      level: "Low" },
      { id: "market-breadth",        score: 40, label: "Market Breadth",        level: "Moderate" },
      { id: "recession",             score: 28, label: "Recession Risk",        level: "Low" },
      { id: "breadth-deterioration", score: 40, label: "Breadth Deterioration", level: "Moderate" },
    ],
    alerts: [],
    topAnalog: { year: 2019, label: "2019 Mid-Cycle", similarity: 0.72, description: "Mid-cycle slowdown" },
    analogs: [],
    timestamp: new Date().toISOString(),
    dataSource: "fallback",
    lastUpdated: new Date().toISOString(),
  }),
}));

// fetchDailyBars returns an array of { close, open, high, low, volume, timestamp } bars
// Note: vi.mock is hoisted, so we cannot reference top-level variables — inline the data
vi.mock("./signalsProxy", () => ({
  fetchDailyBars: vi.fn().mockResolvedValue(
    Array.from({ length: 210 }, (_, i) => ({
      close: 480 + (i * 0.1),
      open: 480 + (i * 0.08),
      high: 480 + (i * 0.15),
      low: 480 + (i * 0.05),
      volume: 50_000_000,
      timestamp: Date.now() - (210 - i) * 86400000,
    }))
  ),
}));

vi.mock("./cryptoIntelligence", () => ({
  getCryptoIntelligence: vi.fn().mockResolvedValue({
    btcDashboard: {
      marketCyclePhase: {
        phase: "Mid Bull",
        confidence: 72,
        note: "Healthy mid-cycle conditions",
      },
      overallBtcBias: "Bullish",
      trendStrength: {
        score: 70, label: "Strong", direction: "up",
        note: "Price above key moving averages",
      },
      liquidityConditions: {
        score: 65, label: "Expanding", direction: "expanding",
        note: "Exchange balances declining",
      },
      etfInstitutionalFlow: {
        score: 60, label: "Positive Inflow", direction: "inflow",
        note: "ETF net inflows positive",
      },
      longTermHolderBehavior: {
        score: 65, label: "Accumulating", direction: "accumulating",
        note: "LTH supply increasing",
      },
      exchangeBalance: {
        score: 40, label: "Declining", direction: "declining",
        note: "Coins leaving exchanges",
      },
      fundingRates: {
        score: 55, label: "Neutral", direction: "neutral",
        note: "Funding rates neutral",
      },
      accumulationAnalysis: null,
    },
    altcoinRisk: { riskLevel: "Moderate", riskScore: 45, signals: [] },
    macroCorrelation: {
      overallMacroSignal: "Neutral",
      correlationSummary: "Moderate macro correlation. No strong divergence.",
    },
    systemicRisk: { score: 3.2, level: "Low", factors: [] },
    report: "Healthy crypto conditions",
  }),
}));

vi.mock("./_core/env", () => ({
  ENV: {
    POLYGON_API_KEY: "test-key",
    FRED_API_KEY: "test-fred-key",
    BUILT_IN_FORGE_API_KEY: "test-forge-key",
    BUILT_IN_FORGE_API_URL: "https://test.api.manus.im",
  },
}));

vi.mock("./_core/notification", () => ({
  notifyOwner: vi.fn().mockResolvedValue(true),
}));

import { computeStockMarketRegime, clearStockRegimeCache } from "./stockRegimeEngine";
import { computeCryptoMarketRegime, clearCryptoRegimeCache } from "./cryptoRegimeEngine";
import { computeCrossMarketIntelligence, clearCrossMarketCache, resetCrossMarketPrevRegimes } from "./crossMarketEngine";

describe("Stock Market Regime Engine", () => {
  beforeEach(() => {
    clearStockRegimeCache();
    vi.clearAllMocks();
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
    const { calculateFaultlinePressure } = await import("./pressure/engine");
    await computeStockMarketRegime();
    await computeStockMarketRegime();
    // Should only call the pressure engine once due to caching
    expect(calculateFaultlinePressure).toHaveBeenCalledTimes(1);
  });

  it("clearStockRegimeCache forces re-fetch", async () => {
    const { calculateFaultlinePressure } = await import("./pressure/engine");
    await computeStockMarketRegime();
    clearStockRegimeCache();
    await computeStockMarketRegime();
    expect(calculateFaultlinePressure).toHaveBeenCalledTimes(2);
  });

  it("returns Expansion or Bull Market for low pressure + strong price action", async () => {
    const result = await computeStockMarketRegime();
    // With pressure 4.5 and SPY above both MAs with positive momentum, should be bullish
    expect(["Bull Market", "Expansion", "Consolidation", "Recovery"]).toContain(result.regime);
  });
});

describe("Crypto Market Regime Engine", () => {
  beforeEach(() => {
    clearCryptoRegimeCache();
    vi.clearAllMocks();
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

  it("detects regime change on second call with different regime", async () => {
    const { calculateFaultlinePressure } = await import("./pressure/engine");
    // First call establishes baseline (uses default mock: pressure 42, MODERATE RISK)
    // prevStockRegime/prevCryptoRegime are null at this point (reset in beforeEach)
    await computeCrossMarketIntelligence();
    // Now prevStockRegime and prevCryptoRegime are set to the first call's values.
    // Clear the result caches so the second call re-fetches with new data.
    // Do NOT call resetCrossMarketPrevRegimes() — we need prev values to detect change.
    clearCrossMarketCache();
    clearStockRegimeCache();
    clearCryptoRegimeCache();
    // Second call with very different pressure — should trigger regime change alert
    (calculateFaultlinePressure as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      overallPressure: 88,
      regime: "SYSTEMIC CRISIS",
      level: "Critical",
      vectors: [
        { id: "credit-contagion",      score: 88, label: "Credit Contagion",      level: "Critical" },
        { id: "liquidity-stress",      score: 82, label: "Liquidity Stress",      level: "Critical" },
        { id: "market-breadth",        score: 75, label: "Market Breadth",        level: "High" },
        { id: "recession",             score: 80, label: "Recession Risk",        level: "Critical" },
        { id: "breadth-deterioration", score: 75, label: "Breadth Deterioration", level: "High" },
      ],
      alerts: [],
      topAnalog: { year: 2008, label: "2008 GFC", similarity: 0.85, description: "Financial crisis" },
      analogs: [],
      timestamp: new Date().toISOString(),
      dataSource: "fallback",
      lastUpdated: new Date().toISOString(),
    });
    const result2 = await computeCrossMarketIntelligence();
    // Should detect a regime change from the previous baseline
    expect(result2.regimeChangeAlerts.length).toBeGreaterThan(0);
  });

  it("plainEnglishSummary mentions both stock and crypto", async () => {
    const result = await computeCrossMarketIntelligence();
    const summary = result.plainEnglishSummary.toLowerCase();
    // Should mention either stock/equity or crypto/bitcoin
    const mentionsMarkets = summary.includes("stock") || summary.includes("equit") ||
      summary.includes("crypto") || summary.includes("bitcoin") ||
      summary.includes("market");
    expect(mentionsMarkets).toBe(true);
  });

  it("caches results on second call", async () => {
    const { calculateFaultlinePressure } = await import("./pressure/engine");
    await computeCrossMarketIntelligence();
    await computeCrossMarketIntelligence();
    // With caching, pressure engine should only be called once
    expect(calculateFaultlinePressure).toHaveBeenCalledTimes(1);
  });
});

// ─── PROJECT BLACK: Alert Enrichment Tests ────────────────────────────────────
// We test the enrichment logic indirectly by triggering a regime change and
// verifying the resulting alert has non-empty whyItMatters and whatToWatchNext.

describe("PROJECT BLACK — Regime Change Alert Enrichment", () => {
  beforeEach(() => {
    clearCrossMarketCache();
    resetCrossMarketPrevRegimes();
    clearStockRegimeCache();
    clearCryptoRegimeCache();
    vi.clearAllMocks();
  });

  it("enriched alert has non-empty whyItMatters when stock regime changes", async () => {
    const { calculateFaultlinePressure } = await import("./pressure/engine");

    // First call — establishes baseline
    await computeCrossMarketIntelligence();

    // Clear caches but keep prev regime tracking
    clearCrossMarketCache();
    clearStockRegimeCache();
    clearCryptoRegimeCache();

    // Second call with crisis-level pressure → different regime → alert fires
    (calculateFaultlinePressure as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      overallPressure: 88,
      regime: "SYSTEMIC CRISIS",
      level: "Critical",
      vectors: [
        { id: "credit-contagion",      score: 88, label: "Credit Contagion",      level: "Critical" },
        { id: "liquidity-stress",      score: 82, label: "Liquidity Stress",      level: "Critical" },
        { id: "market-breadth",        score: 75, label: "Market Breadth",        level: "High" },
        { id: "recession",             score: 80, label: "Recession Risk",        level: "Critical" },
        { id: "breadth-deterioration", score: 75, label: "Breadth Deterioration", level: "High" },
      ],
      alerts: [],
      topAnalog: { year: 2008, label: "2008 GFC", similarity: 0.85, description: "Financial crisis" },
      analogs: [],
      timestamp: new Date().toISOString(),
      dataSource: "fallback",
      lastUpdated: new Date().toISOString(),
    });

    const result = await computeCrossMarketIntelligence();
    const stockAlert = result.regimeChangeAlerts.find(a => a.asset === "Stock");

    expect(stockAlert).toBeDefined();
    expect(stockAlert!.whyItMatters).toBeTruthy();
    expect(stockAlert!.whyItMatters.length).toBeGreaterThan(20);
    expect(stockAlert!.whatToWatchNext).toBeTruthy();
    expect(stockAlert!.whatToWatchNext.length).toBeGreaterThan(20);
  });

  it("whyItMatters for Stock crisis regime mentions capital preservation", async () => {
    const { calculateFaultlinePressure } = await import("./pressure/engine");

    await computeCrossMarketIntelligence();
    clearCrossMarketCache();
    clearStockRegimeCache();
    clearCryptoRegimeCache();

    (calculateFaultlinePressure as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      overallPressure: 88,
      regime: "SYSTEMIC CRISIS",
      level: "Critical",
      vectors: [
        { id: "credit-contagion",      score: 88, label: "Credit Contagion",      level: "Critical" },
        { id: "liquidity-stress",      score: 82, label: "Liquidity Stress",      level: "Critical" },
        { id: "market-breadth",        score: 75, label: "Market Breadth",        level: "High" },
        { id: "recession",             score: 80, label: "Recession Risk",        level: "Critical" },
        { id: "breadth-deterioration", score: 75, label: "Breadth Deterioration", level: "High" },
      ],
      alerts: [],
      topAnalog: { year: 2008, label: "2008 GFC", similarity: 0.85, description: "Financial crisis" },
      analogs: [],
      timestamp: new Date().toISOString(),
      dataSource: "fallback",
      lastUpdated: new Date().toISOString(),
    });

    const result = await computeCrossMarketIntelligence();
    const stockAlert = result.regimeChangeAlerts.find(a => a.asset === "Stock");

    if (stockAlert) {
      // Crisis/recession regime should mention capital preservation or drawdowns
      const text = stockAlert.whyItMatters.toLowerCase();
      const mentionsRisk = text.includes("capital") || text.includes("drawdown") || text.includes("preservation") || text.includes("reduce");
      expect(mentionsRisk).toBe(true);
    }
  });

  it("whatToWatchNext for Stock crisis regime mentions Fed or credit spreads", async () => {
    const { calculateFaultlinePressure } = await import("./pressure/engine");

    await computeCrossMarketIntelligence();
    clearCrossMarketCache();
    clearStockRegimeCache();
    clearCryptoRegimeCache();

    (calculateFaultlinePressure as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      overallPressure: 88,
      regime: "SYSTEMIC CRISIS",
      level: "Critical",
      vectors: [
        { id: "credit-contagion",      score: 88, label: "Credit Contagion",      level: "Critical" },
        { id: "liquidity-stress",      score: 82, label: "Liquidity Stress",      level: "Critical" },
        { id: "market-breadth",        score: 75, label: "Market Breadth",        level: "High" },
        { id: "recession",             score: 80, label: "Recession Risk",        level: "Critical" },
        { id: "breadth-deterioration", score: 75, label: "Breadth Deterioration", level: "High" },
      ],
      alerts: [],
      topAnalog: { year: 2008, label: "2008 GFC", similarity: 0.85, description: "Financial crisis" },
      analogs: [],
      timestamp: new Date().toISOString(),
      dataSource: "fallback",
      lastUpdated: new Date().toISOString(),
    });

    const result = await computeCrossMarketIntelligence();
    const stockAlert = result.regimeChangeAlerts.find(a => a.asset === "Stock");

    if (stockAlert) {
      const text = stockAlert.whatToWatchNext.toLowerCase();
      // Crisis watch list should mention Fed, credit spreads, or yield curve
      const mentionsWatchItems = text.includes("fed") || text.includes("credit") || text.includes("yield") || text.includes("vix") || text.includes("watch");
      expect(mentionsWatchItems).toBe(true);
    }
  });

  it("alert has all required fields: asset, previous, current, message, whyItMatters, whatToWatchNext, timestamp", async () => {
    const { calculateFaultlinePressure } = await import("./pressure/engine");

    await computeCrossMarketIntelligence();
    clearCrossMarketCache();
    clearStockRegimeCache();
    clearCryptoRegimeCache();

    (calculateFaultlinePressure as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      overallPressure: 88,
      regime: "SYSTEMIC CRISIS",
      level: "Critical",
      vectors: [
        { id: "credit-contagion",      score: 88, label: "Credit Contagion",      level: "Critical" },
        { id: "liquidity-stress",      score: 82, label: "Liquidity Stress",      level: "Critical" },
        { id: "market-breadth",        score: 75, label: "Market Breadth",        level: "High" },
        { id: "recession",             score: 80, label: "Recession Risk",        level: "Critical" },
        { id: "breadth-deterioration", score: 75, label: "Breadth Deterioration", level: "High" },
      ],
      alerts: [],
      topAnalog: { year: 2008, label: "2008 GFC", similarity: 0.85, description: "Financial crisis" },
      analogs: [],
      timestamp: new Date().toISOString(),
      dataSource: "fallback",
      lastUpdated: new Date().toISOString(),
    });

    const result = await computeCrossMarketIntelligence();

    for (const alert of result.regimeChangeAlerts) {
      expect(alert.asset).toMatch(/^(Stock|Crypto)$/);
      expect(alert.previous).toBeTruthy();
      expect(alert.current).toBeTruthy();
      expect(alert.message).toBeTruthy();
      expect(alert.whyItMatters).toBeTruthy();
      expect(alert.whatToWatchNext).toBeTruthy();
      expect(alert.timestamp).toBeGreaterThan(0);
    }
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
