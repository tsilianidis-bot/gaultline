// ============================================================
// FAULTLINE — Signal Outlook Center™ Unit Tests
// server/signalOutlook.test.ts
// ============================================================
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  getFullOutlook,
  getQuickOutlook,
  getTopOpportunities,
  getOpportunityDiscovery,
  clearOutlookCaches,
} from "./signalOutlook";

// ── Mock LLM ─────────────────────────────────────────────────
vi.mock("./_core/llm", () => ({
  invokeLLM: vi.fn().mockResolvedValue({
    choices: [{
      message: {
        content: JSON.stringify({
          whyBullish: "Strong momentum and favorable macro conditions.",
          whyBearish: "Elevated valuation risk and macro headwinds.",
          momentumCondition: "Positive — price above key moving averages.",
          volumeCondition: "Above average — institutional participation visible.",
          liquidityCondition: "Adequate — tight bid/ask spreads.",
          volatilityCondition: "Moderate — within normal range.",
          macroCondition: "Supportive — pressure index below 50.",
          mainDrivers: ["AI demand cycle", "Strong earnings momentum", "Sector rotation into tech"],
          diagnosticBullCase: "Continued AI capex supports revenue growth.",
          diagnosticBearCase: "Multiple compression risk if rates stay elevated.",
          diagnosticPrimaryDriver: "AI infrastructure spending cycle.",
          diagnosticPortfolioImplication: "Maintain exposure with defined risk.",
          diagnosticSensitiveTrigger: "Fed rate decision or earnings miss.",
          diagnosticMacroPath: "Soft landing with gradual rate cuts.",
          diagnosticHistoricalAnalog: "2019 tech recovery.",
          diagnosticConfidence: 72,
          invalidationScenarios: [
            { trigger: "Fed hike surprise", description: "Unexpected rate increase would compress multiples.", severity: "Critical" },
            { trigger: "Earnings miss", description: "Revenue miss would trigger sector rotation out.", severity: "Major" },
            { trigger: "BTC breakdown", description: "Crypto contagion could spill into risk assets.", severity: "Minor" },
          ],
          preflightSupportReasons: ["Trend is intact", "Volume confirms move"],
          preflightOppositionReasons: ["Elevated macro pressure"],
          preflightReviewBeforeEntering: ["Check earnings date"],
        }),
      },
    }],
  }),
}));

// ── Mock the pressure engine ─────────────────────────────────
vi.mock("./pressure/engine", () => ({
  calculateFaultlinePressure: vi.fn().mockResolvedValue({
    overallPressure: 45,
    regime: "MODERATE_RISK",
    level: "moderate",
    dataSource: "live",
    vectors: [],
    alerts: [],
    topAnalog: { period: "2019", similarity: 0.7, outcome: "Mild correction", description: "Test analog" },
    analogs: [],
    timestamp: new Date().toISOString(),
    lastUpdated: new Date().toISOString(),
  }),
}));

// ── Mock Yahoo proxy ─────────────────────────────────────────
vi.mock("./yahooProxy", () => ({
  getQuotes: vi.fn().mockResolvedValue([
    {
      ticker: "NVDA",
      price: 850,
      open: 840,
      high: 860,
      low: 835,
      changePercent: 1.2,
      volumeMillions: 45,
      avgVolume: 40,
      sparkline: [800, 810, 820, 830, 840, 850],
      marketCap: 2100000000000,
      sector: "Technology",
      industry: "Semiconductors",
      description: "NVIDIA Corporation",
    },
  ]),
  getTopStockPerformers: vi.fn().mockResolvedValue([
    { ticker: "NVDA", changePercent: 3.5 },
    { ticker: "TSLA", changePercent: 2.8 },
    { ticker: "META", changePercent: 2.1 },
    { ticker: "AMD",  changePercent: 1.9 },
    { ticker: "PLTR", changePercent: 1.7 },
  ]),
  getQuote: vi.fn().mockResolvedValue({ price: 100, isDelayed: true, observedAt: Date.parse("2026-08-14T20:00:00Z") }),
  getDailyBars: vi.fn().mockResolvedValue(Array.from({ length: 60 }, (_, index) => ({
    close: 75 + index, open: 74 + index, high: 76 + index, low: 73 + index, volume: 1_000_000 + index * 10_000, timestamp: Date.parse("2026-06-01T00:00:00Z") + index * 86_400_000,
  }))),
}));

vi.mock("./risingStarsDiscovery", () => ({
  MAGNIFICENT_SEVEN: new Set(["AAPL", "MSFT", "GOOGL", "AMZN", "NVDA", "META", "TSLA"]),
  classifyListingAge: () => ({ category: "three_plus_y", yearsPublic: 4, monthsPublic: 48 }),
  classifyMarketCap: () => "large",
  deriveFaultlineThemes: () => ["AI Infrastructure"],
  deriveSector: () => "Technology",
  getPublicCompanyProfile: vi.fn().mockResolvedValue({
    ticker: "TEST", name: "Verified Test Company", exchange: "Nasdaq", exchangeCode: "XNAS", marketCap: 12_000_000_000,
    listingDate: "2022-01-01", sector: null, industry: "Software", description: "Verified provider description for a public software company.", active: true, profileAsOf: Date.now(),
  }),
  marketCapLabel: () => "Large Cap",
}));

vi.mock("./socialIntelligence", () => ({
  getCachedVerifiedSocialSnapshot: vi.fn().mockReturnValue(null),
}));

// ── Mock CoinGecko proxy ─────────────────────────────────────
vi.mock("./coingeckoProxy", () => ({
  getTopMarkets: vi.fn().mockResolvedValue([
    { id: "bitcoin", symbol: "BTC", name: "Bitcoin", current_price: 65000, price_change_percentage_24h: 2.1, total_volume: 30000000000, market_cap: 1300000000000 },
    { id: "ethereum", symbol: "ETH", name: "Ethereum", current_price: 3200, price_change_percentage_24h: 1.8, total_volume: 15000000000, market_cap: 380000000000 },
    { id: "solana", symbol: "SOL", name: "Solana", current_price: 145, price_change_percentage_24h: 3.2, total_volume: 3000000000, market_cap: 65000000000 },
    { id: "avalanche-2", symbol: "AVAX", name: "Avalanche", current_price: 35, price_change_percentage_24h: 2.5, total_volume: 800000000, market_cap: 14000000000 },
    { id: "chainlink", symbol: "LINK", name: "Chainlink", current_price: 14, price_change_percentage_24h: 1.9, total_volume: 600000000, market_cap: 8000000000 },
  ]),
  getCoinMarketData: vi.fn().mockResolvedValue({
    id: "bitcoin", symbol: "BTC", name: "Bitcoin",
    market_data: {
      current_price: { usd: 65000 },
      price_change_percentage_24h: 2.1,
      price_change_percentage_7d: 5.3,
      price_change_percentage_30d: 12.1,
      total_volume: { usd: 30000000000 },
      market_cap: { usd: 1300000000000 },
      ath: { usd: 73000 },
      ath_change_percentage: { usd: -11 },
    },
  }),
}));

// ── Mock DB ──────────────────────────────────────────────────
vi.mock("./db", () => ({
  getDb: vi.fn().mockResolvedValue(null),
}));

// ── Mock crypto engine ───────────────────────────────────────
vi.mock("./cryptoEngine", () => ({
  getCryptoIntelligenceResult: vi.fn().mockResolvedValue({
    btcDominanceTrend: "Rising",
    altRotationSignal: "Neutral",
    liquidityEnvironment: "Adequate",
    cryptoRegime: "Bull Market",
  }),
}));

// ── Mock alt rotation engine ─────────────────────────────────
vi.mock("./altRotationEngine", () => ({
  computeAltRotation: vi.fn().mockResolvedValue({
    rotationSignal: "Neutral",
    topSectors: [],
  }),
}));

// ── Tests ─────────────────────────────────────────────────────
describe("Signal Outlook Center — scoring engine", () => {
  vi.setConfig({ testTimeout: 15000 });
  beforeEach(() => {
    clearOutlookCaches();
  });

  it("getFullOutlook returns a valid FullOutlookResult for a stock", async () => {
    const result = await getFullOutlook("NVDA", "stock", "swing");

    expect(result).toBeDefined();
    expect(result.symbol).toBe("NVDA");
    expect(result.assetType).toBe("stock");
    expect(result.timeframe).toBe("swing");

    // Score must be 0–100
    expect(result.outlookScore).toBeGreaterThanOrEqual(0);
    expect(result.outlookScore).toBeLessThanOrEqual(100);

    // Direction must be one of the valid values
    expect(["Bullish", "Bearish", "Neutral", "Avoid"]).toContain(result.direction);

    // Confidence must be 0–100
    expect(result.confidence).toBeGreaterThanOrEqual(0);
    expect(result.confidence).toBeLessThanOrEqual(100);

    // Risk level must be valid
    expect(["Low", "Moderate", "High", "Extreme"]).toContain(result.riskLevel);

    // Trade readiness must be valid
    expect(["Cleared", "Caution", "Defensive"]).toContain(result.tradeReadiness);

    // Must have at least 8 scoring factors (expanded to 14 in Phase 4)
    expect(result.scoreBreakdown.factors.length).toBeGreaterThanOrEqual(8);

    // All factor weights must sum to ~1.0
    const totalWeight = result.scoreBreakdown.factors.reduce((sum, f) => sum + f.weight, 0);
    expect(totalWeight).toBeCloseTo(1.0, 1);

    // Must have invalidation scenarios
    expect(result.invalidationScenarios.length).toBeGreaterThan(0);

    // Must have scenarios
    expect(result.scenarios.length).toBeGreaterThan(0);

    // Must have environment context
    expect(result.environment.pressureIndex).toBeGreaterThanOrEqual(0);
    expect(result.environment.pressureIndex).toBeLessThanOrEqual(100);

    // Must have diagnostic integration
    expect(result.diagnosticIntegration).toBeDefined();
    expect(result.diagnosticIntegration.confidence).toBeGreaterThanOrEqual(0);

    // Must have preflight impact
    expect(result.preflightImpact).toBeDefined();

    // Stock analysis must be present for stocks
    expect(result.stockAnalysis).toBeDefined();
    expect(result.cryptoAnalysis).toBeNull();
  });

  it("getFullOutlook returns a valid FullOutlookResult for crypto", async () => {
    const result = await getFullOutlook("BTC", "crypto", "swing");

    expect(result.symbol).toBe("BTC");
    expect(result.assetType).toBe("crypto");
    expect(result.outlookScore).toBeGreaterThanOrEqual(0);
    expect(result.outlookScore).toBeLessThanOrEqual(100);

    // Crypto analysis must be present for crypto
    expect(result.cryptoAnalysis).toBeDefined();
    expect(result.stockAnalysis).toBeNull();
  });

  it("getQuickOutlook returns a QuickOutlookResult", async () => {
    const result = await getQuickOutlook("NVDA", "stock");

    expect(result).toBeDefined();
    expect(result.symbol).toBe("NVDA");
    expect(result.assetType).toBe("stock");
    expect(result.outlookScore).toBeGreaterThanOrEqual(0);
    expect(result.outlookScore).toBeLessThanOrEqual(100);
    expect(["Bullish", "Bearish", "Neutral", "Avoid"]).toContain(result.direction);
    expect(["Low", "Moderate", "High", "Extreme"]).toContain(result.riskLevel);
  });

  it("getTopOpportunities returns stocks and crypto", async () => {
    const result = await getTopOpportunities();

    expect(result).toBeDefined();
    expect(result.stocks).toBeDefined();
    expect(result.crypto).toBeDefined();
    expect(Array.isArray(result.stocks)).toBe(true);
    expect(Array.isArray(result.crypto)).toBe(true);

    // Should have at most 5 of each
    expect(result.stocks.length).toBeLessThanOrEqual(5);
    expect(result.crypto.length).toBeLessThanOrEqual(5);

    // Each stock opportunity must have required fields
    if (result.stocks.length > 0) {
      const opp = result.stocks[0];
      expect(opp.symbol).toBeDefined();
      expect(opp.assetType).toBe("stock");
      expect(opp.outlookScore).toBeGreaterThanOrEqual(0);
      expect(opp.outlookScore).toBeLessThanOrEqual(100);
      expect(["Bullish", "Bearish", "Neutral", "Avoid"]).toContain(opp.direction);
    }
  });

  it("score breakdown factors have valid scores (0–100)", async () => {
    const result = await getFullOutlook("TSLA", "stock", "short");
    for (const factor of result.scoreBreakdown.factors) {
      expect(factor.score).toBeGreaterThanOrEqual(0);
      expect(factor.score).toBeLessThanOrEqual(100);
      expect(factor.name).toBeTruthy();
      expect(factor.note).toBeTruthy();
      expect(factor.weight).toBeGreaterThan(0);
    }
  });

  it("invalidation scenarios have valid severity levels", async () => {
    const result = await getFullOutlook("NVDA", "stock", "long");
    for (const scenario of result.invalidationScenarios) {
      expect(["Critical", "Major", "Minor"]).toContain(scenario.severity);
      expect(scenario.trigger).toBeTruthy();
      expect(scenario.description).toBeTruthy();
    }
  });

  it("caches results and returns consistent data on second call", async () => {
    const first = await getFullOutlook("NVDA", "stock", "swing");
    const second = await getFullOutlook("NVDA", "stock", "swing");

    // Scores should be identical (deterministic + cached)
    expect(first.outlookScore).toBe(second.outlookScore);
    expect(first.direction).toBe(second.direction);
    expect(first.cached).toBe(false); // First call is not cached
    expect(second.cached).toBe(true); // Second call should be cached
  });

  it("clearOutlookCaches resets cache state", async () => {
    await getFullOutlook("NVDA", "stock", "swing");
    clearOutlookCaches();
    const result = await getFullOutlook("NVDA", "stock", "swing");
    expect(result.cached).toBe(false); // After clear, should be fresh
  });

  it("different timeframes produce different time horizons", async () => {
    const short = await getFullOutlook("NVDA", "stock", "short");
    const swing = await getFullOutlook("NVDA", "stock", "swing");
    const long  = await getFullOutlook("NVDA", "stock", "long");

    expect(short.timeHorizon).toBe("1–5 Days");
    expect(swing.timeHorizon).toBe("1–4 Weeks");
    expect(long.timeHorizon).toBe("1–3 Months");
  });

  it("environment pressureIndex matches mocked pressure engine output", async () => {
    const result = await getFullOutlook("NVDA", "stock", "swing");
    // Mocked pressure is 45
    expect(result.environment.pressureIndex).toBe(45);
  });

  it("getOpportunityDiscovery returns 8 buckets with valid structure", async () => {
    const result = await getOpportunityDiscovery();

    expect(result).toBeDefined();
    expect(result.buckets).toHaveLength(26);
    expect(result.pressureIndex).toBeGreaterThanOrEqual(0);
    expect(result.pressureIndex).toBeLessThanOrEqual(100);
    expect(result.regime).toBeTruthy();
    expect(result.generatedAt).toBeGreaterThan(0);
  });

  it("QA confidence sweep: discovery items carry no confidenceLevel (was score × 0.85 + band); scores unchanged", async () => {
    const result = await getOpportunityDiscovery();
    const items = result.buckets.flatMap(b => b.items);
    expect(items.length).toBeGreaterThan(0);
    for (const item of items) {
      expect(item.confidenceLevel).toBeNull();
      expect(typeof item.opportunityScore).toBe("number");
    }
    expect(JSON.stringify(result)).not.toMatch(/"confidenceLevel":\d/);
  });

  it("getOpportunityDiscovery buckets have valid items", async () => {
    const result = await getOpportunityDiscovery();
    const VALID_CATEGORIES = [
      "top_opportunity_today",
      "emerging_breakouts",
      "high_conviction_setups",
      "ai_leaders",
      "crypto_leaders",
      "macro_beneficiaries",
      "undervalued_opportunities",
      "high_risk_high_reward",
      "defense_geopolitical",
      "energy_transition",
      "biotech_healthcare",
      "fintech_payments",
      "infrastructure_industrials",
      "consumer_discretionary",
      "dividend_income",
      "small_cap_growth",
      "defi_web3",
      "commodities_real_assets",
      "volatility_plays",
      "short_squeeze_candidates",
      "earnings_momentum",
      "technical_reversals",
      "institutional_accumulation",
      "etf_flows",
      "global_macro",
      "space_deep_tech",
    ];
    for (const bucket of result.buckets) {
      expect(VALID_CATEGORIES).toContain(bucket.category);
      expect(bucket.label).toBeTruthy();
      expect(bucket.description).toBeTruthy();
      expect(Array.isArray(bucket.items)).toBe(true);
      expect(bucket.items.length).toBeGreaterThan(0);
      expect(bucket.items.length).toBeLessThanOrEqual(4);
    }
  });

  it("getOpportunityDiscovery items have required fields", async () => {
    const result = await getOpportunityDiscovery();
    for (const bucket of result.buckets) {
      for (const item of bucket.items) {
        expect(item.ticker).toBeTruthy();
        expect(item.name).toBeTruthy();
        expect(["stock", "crypto"]).toContain(item.assetType);
        expect(item.opportunityScore).toBeGreaterThanOrEqual(0);
        expect(item.opportunityScore).toBeLessThanOrEqual(100);
        expect(item.expectedTimeHorizon).toBeTruthy();
        expect(item.catalyst).toBeTruthy();
        expect(["Low", "Medium", "High", "Extreme"]).toContain(item.riskLevel);
        expect(["Bullish", "Bearish", "Neutral", "Avoid"]).toContain(item.direction);
        expect(item.rationale).toBeTruthy();
      }
    }
  });

  it("getOpportunityDiscovery caches result on second call", async () => {
    clearOutlookCaches();
    const first = await getOpportunityDiscovery();
    const second = await getOpportunityDiscovery();
    // Same generatedAt timestamp means it came from cache
    expect(first.generatedAt).toBe(second.generatedAt);
  });

  it("getOpportunityDiscovery top_opportunity_today bucket is first", async () => {
    const result = await getOpportunityDiscovery();
    expect(result.buckets[0].category).toBe("top_opportunity_today");
  });
});

// ── Fix-up 6: News Catalyst is a 0–100 heuristic, never labelled a probability ──
describe("Signal Outlook factor labels — no probability claims (fix-up 6)", () => {
  vi.setConfig({ testTimeout: 15000 });
  beforeEach(() => { clearOutlookCaches(); });
  // The only permitted occurrences are explicit negations ("not a probability", "not offered as a probability").
  const claimsProbability = (s: string) => /probabilit/i.test(s.replace(/not (offered as )?a probability/gi, ""));
  const NEWS = "News Catalyst score (0–100 heuristic, not a probability)";
  const cases: Array<[string, "stock" | "crypto"]> = [["NVDA", "stock"], ["SPY", "stock"], ["BTC", "crypto"], ["SOL", "crypto"]];
  const tfs = ["day", "short", "swing", "long"] as const;

  it("no factor name, label or note (UI breakdown + bull/bear case text) claims a probability", async () => {
    for (const [sym, type] of cases) for (const tf of tfs) {
      clearOutlookCaches();
      const r = await getFullOutlook(sym, type, tf);
      for (const f of r.scoreBreakdown.factors) {
        expect(claimsProbability(f.name), `${sym}/${tf} name ${f.name}`).toBe(false);
        expect(claimsProbability(String(f.label)), `${sym}/${tf} label ${f.label}`).toBe(false);
        expect(claimsProbability(String(f.note)), `${sym}/${tf} note ${f.note}`).toBe(false);
      }
      expect(claimsProbability(r.tradeFramework.bullCaseForTrade)).toBe(false);
      expect(claimsProbability(r.tradeFramework.bearCaseForTrade)).toBe(false);
      if (type === "stock") {
        const news = r.scoreBreakdown.factors.find(f => f.name.startsWith("News Catalyst"));
        expect(news?.name).toBe(NEWS);
        expect(["High catalyst activity — macro + AI events converging", "Moderate catalyst environment", "Low catalyst activity"]).toContain(news?.note);
      }
    }
  });

  it("the Signal Outlook AI prompt's top/bottom factor lines never call a factor a probability", async () => {
    const { invokeLLM } = await import("./_core/llm");
    const mock = vi.mocked(invokeLLM);
    for (const [sym, type] of cases) {
      clearOutlookCaches(); mock.mockClear();
      await getFullOutlook(sym, type, "swing");
      const prompts = mock.mock.calls.map(c => JSON.stringify((c[0] as any).messages));
      expect(prompts.length).toBeGreaterThan(0);
      for (const p of prompts) {
        expect(p).not.toContain("News Catalyst Probability");
        for (const line of p.split("\\n").filter(l => /Top (Bullish|Bearish) Factor:/.test(l))) {
          expect(claimsProbability(line), line).toBe(false);
        }
      }
    }
  });

  it("source pin: the News Catalyst factor carries the heuristic label in the one place the UI and the prompt read it from", async () => {
    const fs = await import("node:fs");
    const src = fs.readFileSync(new URL("./signalOutlook.ts", import.meta.url), "utf8");
    expect(src).toContain(`{ name: "${NEWS}"`);
    expect(src).not.toMatch(/News Catalyst Probability|catalyst probability/i);
    const names = [...src.matchAll(/\{ name: "([^"]+)",\s*score:/g)].map(m => m[1]);
    expect(names.length).toBe(22); // 14 stock + 8 crypto factors
    for (const n of names) expect(claimsProbability(n), n).toBe(false);
  });
});

// ── Fix-up 7: one regime vocabulary (canonical "MODERATE RISK", never the legacy "Normal Risk") ──
describe("Signal Outlook regime label uses the canonical vocabulary (fix-up 7)", () => {
  vi.setConfig({ testTimeout: 15000 });
  it("environment.regimeLabel, the AI prompt and the LLM-failure fallback text all read MODERATE RISK at P=34", async () => {
    const { calculateFaultlinePressure } = await import("./pressure/engine");
    const { invokeLLM } = await import("./_core/llm");
    const pressureMock = vi.mocked(calculateFaultlinePressure);
    const llm = vi.mocked(invokeLLM);
    const basePressure = await pressureMock();
    const llmImpl = llm.getMockImplementation();
    pressureMock.mockResolvedValue({ ...basePressure, overallPressure: 34, regime: "MODERATE RISK" } as any);
    try {
      clearOutlookCaches(); llm.mockClear();
      const r = await getFullOutlook("NVDA", "stock", "swing");
      expect(r.environment.pressureIndex).toBe(34);
      expect(r.environment.regimeLabel).toBe("MODERATE RISK");
      const prompt = llm.mock.calls.map(c => JSON.stringify((c[0] as any).messages)).find(p => p.includes("Signal Outlook AI")) ?? "";
      expect(prompt).toContain("FAULTLINE Pressure Index: 34/100 (MODERATE RISK)");
      expect(prompt).not.toMatch(/Normal Risk|Watch Zone|Calm\b/);

      clearOutlookCaches();
      llm.mockRejectedValue(new Error("llm down"));
      const f = await getFullOutlook("SPY", "stock", "swing");
      expect(f.environment.regimeLabel).toBe("MODERATE RISK");
      expect(f.macroCondition).toBe("FAULTLINE Pressure Index at 34/100 — MODERATE RISK");
      expect(f.environment.environmentImpact).toContain("Current MODERATE RISK environment");
      expect(JSON.stringify(f)).not.toContain("Normal Risk");
    } finally {
      pressureMock.mockResolvedValue(basePressure);
      if (llmImpl) llm.mockImplementation(llmImpl);
      clearOutlookCaches();
    }
  });
});
