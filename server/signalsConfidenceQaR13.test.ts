import { afterEach, describe, expect, it, vi } from "vitest";

// QA r13 B14: signals.getSignalVisualDetail withholds the signal confidence
// (min(95, 55 + |score| × 5)); action, strength and levels are the engine's.
// These are fixture-only adapters, not live-provider verification.
const mocks = vi.hoisted(() => ({
  getQuote: vi.fn(),
  getDailyBars: vi.fn(),
  getAuthoritativeCanonicalIntelligenceState: vi.fn(),
}));

// Preserve timing classification and every unrelated adapter export. A narrow
// mock is required because the payload now calls classifyYahooObservation.
vi.mock("./yahooProxy", async importOriginal => {
  const actual = await importOriginal<typeof import("./yahooProxy")>();
  return { ...actual, getQuote: mocks.getQuote, getDailyBars: mocks.getDailyBars };
});
vi.mock("./canonicalIntelligenceState", async importOriginal => {
  const actual = await importOriginal<typeof import("./canonicalIntelligenceState")>();
  return { ...actual, getAuthoritativeCanonicalIntelligenceState: mocks.getAuthoritativeCanonicalIntelligenceState };
});

import { buildCanonicalIntelligenceState } from "./canonicalIntelligenceState";
import { getSignalVisualDetailPayload } from "./signalVisualDetail";

const NOW = Date.parse("2026-10-16T19:55:00.000Z");
const OBSERVED_AT = Date.parse("2026-10-16T19:50:00.000Z");
const FETCHED_AT = Date.parse("2026-10-16T19:51:00.000Z");

/** Explicitly marked mock records with complete Yahoo-shaped observations. */
const yahooFixture = {
  fixtureSource: "MOCK" as const,
  provider: "Yahoo Finance",
  observedAt: OBSERVED_AT,
  fetchedAt: FETCHED_AT,
  quote: {
    ticker: "AAPL",
    price: 130,
    prevClose: 129,
    open: 128.5,
    high: 131,
    low: 127.5,
    volume: 2_100_000,
    change: 1,
    changePercent: 0.78,
    marketState: "REGULAR" as const,
    isDelayed: true,
    source: "yahoo" as const,
    observedAt: OBSERVED_AT,
    fetchedAt: FETCHED_AT,
  },
  dailyBars: Array.from({ length: 30 }, (_, index) => {
    const close = 100 + index;
    return {
      open: close - 0.5,
      high: close + 1,
      low: close - 1,
      close,
      volume: 1_000_000 + index * 10_000,
      // All observations predate the frozen Friday session; no incomplete bar
      // is presented as a completed provider observation.
      timestamp: Date.parse("2026-09-16T20:00:00.000Z") + index * 86_400_000,
    };
  }),
};

const canonicalFixture = Object.freeze(buildCanonicalIntelligenceState({
  stateId: "state:signals-confidence-qa-r13",
  generatedAt: new Date(NOW).toISOString(),
  championVersion: "champion-v1-frozen",
  modelVersion: "signals-qa-r13-model",
  scoringVersion: "faultline-pressure-v1-frozen",
  configurationVersion: "signals-qa-r13-fixture",
  inputSnapshotId: "input:signals-confidence-qa-r13",
  stateHash: "hash:signals-confidence-qa-r13",
  pressureIndex: 28,
  regime: "MODERATE RISK",
  engineValues: {
    "liquidity-stress": 20,
    "credit-contagion": 30,
    "volatility-regime": 25,
    "macro-sensitivity": 35,
    "market-breadth": 30,
    "ai-bubble": 28,
  },
  engineDirections: {},
  domainValues: {},
  scenarioOutputs: {},
  probabilityClaimIds: [],
  analogClaimIds: [],
  historicalDatasetVersion: "mock-historical-v1",
  researchDatasetVersion: "mock-research-v1",
  coherenceStatus: "COHERENT",
  coherenceNotes: [],
  dataQualitySummary: { fixtureSource: "MOCK", staleInputs: [], unavailableInputs: [], fallbackInputs: [] },
  staleInputs: [],
  unavailableInputs: [],
  fallbackInputs: [],
  inputQuality: [],
}));

describe("B14 visual-detail payload", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it("withholds confidence while preserving a canonical identity and timestamped provider provenance", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    mocks.getQuote.mockResolvedValue(yahooFixture.quote);
    mocks.getDailyBars.mockResolvedValue(yahooFixture.dailyBars);
    mocks.getAuthoritativeCanonicalIntelligenceState.mockResolvedValue(canonicalFixture);

    const detail = await getSignalVisualDetailPayload("AAPL");

    expect(mocks.getQuote).toHaveBeenCalledWith("AAPL");
    expect(mocks.getDailyBars).toHaveBeenCalledWith("AAPL", "3mo");
    expect(mocks.getAuthoritativeCanonicalIntelligenceState).toHaveBeenCalledOnce();
    expect(detail.signal).not.toBeNull();
    expect(detail.signal!.confidence).toBeNull();
    expect(detail.signal!.action).toMatch(/^(BUY|SELL|HOLD|WATCH)$/);
    expect(detail.signal!.strength).toMatch(/^(Strong|Moderate|Weak)$/);
    expect(typeof detail.signal!.technicals.momentumScore).toBe("number");
    expect(detail.signal).toMatchObject({
      canonicalStateId: canonicalFixture.stateId,
      source: "yahoo",
      observedAt: yahooFixture.observedAt,
      evidenceQuality: "HEALTHY",
    });
    expect(detail.providerHealth).toMatchObject({
      quote: { status: "available", source: "yahoo", observedAt: OBSERVED_AT, fetchedAt: FETCHED_AT },
      dailyBars: { status: "available", completedBars: 30 },
      regime: { status: "available", source: "canonical-intelligence-state", computedAt: canonicalFixture.effectiveAt },
    });
    expect(detail.regime).toMatchObject({ stateId: canonicalFixture.stateId, pressureIndex: 28, label: "MODERATE RISK" });
    expect(JSON.stringify(detail)).not.toMatch(/"confidence":\d/);
  });
});
