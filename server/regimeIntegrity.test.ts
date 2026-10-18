import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { buildCanonicalIntelligenceState, getAuthoritativeCanonicalIntelligenceState } from "./canonicalIntelligenceState";
import { calculateFaultlinePressure } from "./pressure/engine";
import { getCryptoIntelligence } from "./cryptoIntelligence";
import { clearStockRegimeCache, computeStockMarketRegime } from "./stockRegimeEngine";
import { clearCryptoRegimeCache, computeCryptoMarketRegime } from "./cryptoRegimeEngine";

// Fixture-only tests: every fixture carries explicit synthetic provider metadata.
// These tests make no provider, database, LLM, or credentialed network calls.
vi.mock("./canonicalIntelligenceState", async () => {
  const actual = await vi.importActual<typeof import("./canonicalIntelligenceState")>("./canonicalIntelligenceState");
  return { ...actual, getAuthoritativeCanonicalIntelligenceState: vi.fn() };
});

vi.mock("./pressure/engine", () => ({
  calculateFaultlinePressure: vi.fn(),
}));

vi.mock("./signalsProxy", () => ({
  fetchDailyBars: vi.fn(),
}));

vi.mock("./cryptoIntelligence", () => ({
  getCryptoIntelligence: vi.fn(),
}));

const providerMetadata = {
  provider: "fixture-canonical-manifest",
  sourceId: "fixture:canonical:2026-10-17",
  observedAt: "2026-10-17T12:00:00.000Z",
};

function canonicalFixture(overrides: Record<string, unknown> = {}) {
  return buildCanonicalIntelligenceState({
    stateId: "state:regime-integrity",
    generatedAt: "2026-10-17T12:00:00.000Z",
    championVersion: "fixture-champion-v1",
    modelVersion: "fixture-model-v1",
    scoringVersion: "fixture-pressure-v1",
    configurationVersion: "fixture-governance-v1",
    inputSnapshotId: "input:regime-integrity",
    stateHash: "fixture-hash",
    pressureIndex: 73,
    regime: "HIGH STRESS",
    engineValues: {
      "liquidity-stress": 67,
      "credit-contagion": 81,
      "volatility-regime": 62,
      "macro-sensitivity": 58,
      "market-breadth": 71,
      "ai-bubble": 40,
    },
    engineDirections: {},
    domainValues: {},
    scenarioOutputs: {},
    probabilityClaimIds: [],
    analogClaimIds: [],
    historicalDatasetVersion: "fixture-historical-v1",
    researchDatasetVersion: "fixture-research-v1",
    coherenceStatus: "COHERENT",
    coherenceNotes: [],
    dataQualitySummary: { staleInputs: [], unavailableInputs: [], fallbackInputs: [], staticInputs: [] },
    staleInputs: [],
    unavailableInputs: [],
    fallbackInputs: [],
    inputQuality: [
      "liquidity-stress", "credit-contagion", "volatility-regime", "macro-sensitivity", "market-breadth", "ai-bubble",
    ].map(engineId => ({
      ...providerMetadata,
      inputId: `fixture:${engineId}`,
      contributesTo: [engineId],
      freshnessStatus: "CURRENT",
      required: true,
    })),
    ...overrides,
  });
}

function cryptoReportFixture(phase: string) {
  return {
    availability: "AVAILABLE",
    canonicalStateId: "state:crypto-fixture",
    qualityStatus: "HEALTHY",
    generatedAt: Date.parse(providerMetadata.observedAt),
    pressureIndex: 55,
    regime: "ELEVATED STRESS",
    signals: [],
    btcDashboard: {
      trendStrength: { score: 48, label: "Moderate", direction: "sideways", note: "Fixture macro-derived trend; no BTC-price provider." },
      liquidityConditions: { score: 50, label: "Neutral", direction: "neutral", note: "Fixture canonical-macro liquidity projection." },
      dollarPressure: { score: 55, label: "Neutral", direction: "neutral", note: "Fixture macro dollar/rate projection." },
      yieldPressure: { score: 45, label: "Moderate", direction: "neutral", note: "Fixture yield projection." },
      etfInstitutionalFlow: {
        score: 49,
        label: "Mixed",
        direction: "neutral",
        note: "DERIVED_MODEL — fixture canonical-macro projection; not an ETF or institutional-flow observation.",
      },
      marketCyclePhase: { phase, confidence: 63, note: "Fixture canonical macro cycle classification." },
      overallBtcBias: "Neutral",
      aiNarrative: "Fixture only; no external provider call.",
    },
    altcoinRisk: {
      overallRisk: "Elevated",
      riskScore: 55,
      btcDominanceSignal: "Fixture macro risk proxy — no BTC-dominance provider.",
      liquiditySignal: "Fixture macro liquidity projection.",
      stablecoinSignal: "Fixture macro liquidity proxy — no stablecoin-supply provider.",
      riskOnOffSignal: "Fixture macro risk appetite.",
      macroPressureSignal: "Fixture macro pressure.",
      volatilitySignal: "Fixture credit projection.",
      altcoinSeasonProbability: 45,
      recommendation: "Fixture macro-derived output.",
    },
    macroCorrelation: {
      overallMacroSignal: "Neutral",
      correlationSummary: "Fixture canonical-macro correlation summary.",
    },
    portfolioGuidance: {},
  };
}

describe("regime source-truth integrity — fixture-only", () => {
  beforeEach(() => {
    clearStockRegimeCache();
    clearCryptoRegimeCache();
    vi.clearAllMocks();
    delete process.env.POLYGON_API_KEY;
  });

  it("projects stock pressure and factors from canonical state, never the independent calculator", async () => {
    vi.mocked(getAuthoritativeCanonicalIntelligenceState).mockResolvedValue(canonicalFixture());
    vi.mocked(calculateFaultlinePressure).mockResolvedValue({ overallPressure: 4 } as never);

    const result = await computeStockMarketRegime();

    expect(result.pressureScore).toBe(73);
    expect(result.canonicalStateId).toBe("state:regime-integrity");
    expect(result.keyFactors.join(" ")).toContain("Credit stress elevated (score: 81)");
    expect(calculateFaultlinePressure).not.toHaveBeenCalled();
    expect(result.spyLastClose).toEqual({
      status: "UNAVAILABLE",
      provider: "Polygon",
      asOf: null,
      lastClose: null,
      reason: "SPY last-close unavailable: Polygon API key is not configured.",
    });
  });

  it("withholds stock regime and all numeric pressure when canonical CURRENT is absent", async () => {
    vi.mocked(getAuthoritativeCanonicalIntelligenceState).mockResolvedValue(null);

    const result = await computeStockMarketRegime();

    expect(result.regime).toBe("UNAVAILABLE");
    expect(result.pressureScore).toBeNull();
    expect(result.confidence).toBeNull();
    expect(result.spyLastClose.status).toBe("UNAVAILABLE");
    expect(calculateFaultlinePressure).not.toHaveBeenCalled();
  });

  it("does not manufacture a neutral factor when a canonical vector is unavailable", async () => {
    vi.mocked(getAuthoritativeCanonicalIntelligenceState).mockResolvedValue(canonicalFixture({
      engineValues: {
        "liquidity-stress": 20,
        "credit-contagion": 20,
        "volatility-regime": 20,
        "macro-sensitivity": 20,
        "ai-bubble": 20,
      },
    }));

    const result = await computeStockMarketRegime();

    expect(result.pressureScore).toBe(73);
    expect(result.keyFactors.join(" ")).not.toContain("score: 50");
    expect(calculateFaultlinePressure).not.toHaveBeenCalled();
  });

  it.each([
    "Early Bull", "Mid Bull", "Late Bull / Euphoria", "Distribution", "Early Bear",
    "Mid Bear", "Capitulation", "Bear Market → Accumulation Phase", "Accumulation",
  ])("withholds fabricated history and transition percentages for %s", async (phase) => {
    vi.mocked(getCryptoIntelligence).mockResolvedValue(cryptoReportFixture(phase) as never);

    const result = await computeCryptoMarketRegime();

    expect(result.historicalContext).toBeNull();
    expect(result.transitionProbabilities).toEqual([]);
  });

  it("labels the retained flow-shaped score as a derived macro risk-appetite proxy", async () => {
    vi.mocked(getCryptoIntelligence).mockResolvedValue(cryptoReportFixture("Mid Bull") as never);

    const result = await computeCryptoMarketRegime();
    const proxy = result.indicators.find(indicator => indicator.name.includes("Macro risk-appetite proxy"));

    expect(proxy).toMatchObject({
      name: "Macro risk-appetite proxy (not ETF flow)",
      provenance: "DERIVED_MODEL",
      reading: "Mixed",
    });
    expect(proxy?.name).not.toContain("Institutional Flow");
    expect(proxy?.name).not.toContain("Exchange");
  });

  it("source-level dashboard guard omits withheld history and transition cards rather than rendering placeholders", () => {
    const dashboard = readFileSync(resolve(process.cwd(), "client/src/pages/CryptoRegimeDashboard.tsx"), "utf8");

    expect(dashboard).toContain("const showHistoricalContext = !isLoading && historicalContext != null;");
    expect(dashboard).toContain("const showTransitionProbabilities = !isLoading && transitionProbabilities.length > 0;");
    expect(dashboard).toContain("{showHistoricalContext && historicalContext && (");
    expect(dashboard).toContain("{showTransitionProbabilities && (");
    expect(dashboard).toContain("DERIVED MODEL");
  });

  it("does not claim CoinGecko input for this macro-only regime call path", () => {
    const implementation = readFileSync(resolve(process.cwd(), "server/cryptoIntelligence.ts"), "utf8");
    const methodology = readFileSync(resolve(process.cwd(), "client/src/pages/Methodology.tsx"), "utf8");

    expect(implementation).not.toMatch(/from ["']\.\/coingeckoProxy["']/);
    expect(methodology).toContain("does not use BTC price, CoinGecko, on-chain, ETF-flow");
    expect(methodology).not.toContain("Crypto regimes and the crypto stress score use CoinGecko plus the pressure reading.");
  });
});
