import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CanonicalIntelligenceState } from "../shared/canonicalIntelligenceState";
import type { YahooDailyBar, YahooQuote } from "./yahooProxy";

const mocks = vi.hoisted(() => ({
  getQuote: vi.fn(),
  getDailyBars: vi.fn(),
  getAuthoritativeCanonicalIntelligenceState: vi.fn(),
}));

vi.mock("./yahooProxy", async importOriginal => ({
  ...await importOriginal<typeof import("./yahooProxy")>(),
  getQuote: mocks.getQuote,
  getDailyBars: mocks.getDailyBars,
}));

vi.mock("./canonicalIntelligenceState", async importOriginal => ({
  ...await importOriginal<typeof import("./canonicalIntelligenceState")>(),
  getAuthoritativeCanonicalIntelligenceState: mocks.getAuthoritativeCanonicalIntelligenceState,
}));

import { buildCanonicalIntelligenceState } from "./canonicalIntelligenceState";
import { getSignalVisualDetailPayload } from "./signalVisualDetail";

const AS_OF = "2026-10-16T20:30:00.000Z";
const FIXTURE_NOW = new Date("2026-10-16T20:40:00.000Z");
const VECTOR_IDS = ["liquidity-stress", "credit-contagion", "volatility-regime", "macro-sensitivity", "market-breadth", "ai-bubble"] as const;

/** MOCK SOURCE FIXTURE ONLY: fixed Yahoo observations; no network, credentials, or database. */
const completedBars: YahooDailyBar[] = Array.from({ length: 30 }, (_, index) => {
  const close = 100 + index;
  return {
    open: close - 0.5,
    high: close + 1,
    low: close - 1,
    close,
    volume: 1_000_000 + index * 10_000,
    timestamp: Date.UTC(2026, 8, 1 + index, 20, 0, 0),
  };
});

const quoteFixture: YahooQuote = {
  ticker: "AAPL",
  price: 130,
  prevClose: 129,
  open: 128.5,
  high: 131,
  low: 127.5,
  volume: 2_100_000,
  change: 1,
  changePercent: 0.78,
  marketState: "REGULAR",
  isDelayed: true,
  source: "yahoo",
  observedAt: Date.parse("2026-10-16T20:30:00.000Z"),
  fetchedAt: Date.parse("2026-10-16T20:31:00.000Z"),
};

function canonicalFixture(): CanonicalIntelligenceState {
  return buildCanonicalIntelligenceState({
    stateId: "state:mock-signal-detail-2026-10-16",
    generatedAt: AS_OF,
    championVersion: "champion-v1-frozen",
    modelVersion: "signal-visual-detail-test-v1",
    scoringVersion: "faultline-pressure-v1-frozen",
    configurationVersion: "phase2-canonical-state-v1",
    inputSnapshotId: "input:mock-signal-detail-2026-10-16",
    stateHash: "hash:mock-signal-detail-2026-10-16",
    pressureIndex: 28,
    regime: "MODERATE RISK",
    engineValues: Object.fromEntries(VECTOR_IDS.map((id, index) => [id, 23 + index * 2])),
    engineDirections: Object.fromEntries(VECTOR_IDS.map(id => [id, "stable"])),
    domainValues: {},
    scenarioOutputs: {},
    probabilityClaimIds: [],
    analogClaimIds: [],
    historicalDatasetVersion: "mock-historical-dataset-v1",
    researchDatasetVersion: "mock-research-dataset-v1",
    coherenceStatus: "COHERENT",
    coherenceNotes: [],
    dataQualitySummary: { staleInputs: [], unavailableInputs: [], fallbackInputs: [], staticInputs: [] },
    staleInputs: [],
    unavailableInputs: [],
    fallbackInputs: [],
    inputQuality: VECTOR_IDS.map(id => ({
      inputId: `mock:${id}`,
      source: "MOCK:canonical-signal-detail-fixture",
      observedAt: AS_OF,
      receivedAt: AS_OF,
      freshnessStatus: "CURRENT",
      required: true,
      contributesTo: [id],
    })),
  });
}

describe("Signal Visual Analysis adapter", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(FIXTURE_NOW);
    vi.clearAllMocks();
    mocks.getQuote.mockResolvedValue(quoteFixture);
    mocks.getDailyBars.mockResolvedValue(completedBars);
    mocks.getAuthoritativeCanonicalIntelligenceState.mockResolvedValue(canonicalFixture());
  });

  afterEach(() => vi.useRealTimers());

  it("uses only observed quote, completed daily bars, one canonical state, and the existing signal engine", async () => {
    const detail = await getSignalVisualDetailPayload("AAPL");

    expect(mocks.getQuote).toHaveBeenCalledWith("AAPL");
    expect(mocks.getDailyBars).toHaveBeenCalledWith("AAPL", "3mo");
    expect(mocks.getAuthoritativeCanonicalIntelligenceState).toHaveBeenCalledTimes(1);
    expect(detail.bars).toEqual(completedBars);
    expect(detail.signal).not.toBeNull();
    expect(detail.signal?.ticker).toBe("AAPL");
    expect(detail.signal).toMatchObject({
      canonicalStateId: "state:mock-signal-detail-2026-10-16",
      observedAt: quoteFixture.observedAt,
      source: "yahoo",
      evidenceQuality: "HEALTHY",
      confidence: null,
    });
    expect(detail.signal?.priceLevels).toMatchObject({
      support: expect.any(Number),
      resistance: expect.any(Number),
      entryZone: expect.any(Number),
      stopLoss: expect.any(Number),
      targetPrice: expect.any(Number),
    });
    expect(detail.regime).toMatchObject({
      label: "MODERATE RISK",
      score: 2.8,
      pressureIndex: 28,
      stateId: "state:mock-signal-detail-2026-10-16",
    });
    expect(detail.providerHealth).toMatchObject({
      quote: { status: "available", source: "yahoo" },
      dailyBars: { status: "available", completedBars: 30 },
      regime: { status: "available", source: "canonical-intelligence-state", computedAt: AS_OF },
      signal: { status: "available" },
    });
    expect(detail).not.toHaveProperty("historicalSignalMarkers");
  });

  it("withholds the signal and reports source status when required canonical regime context is unavailable", async () => {
    mocks.getAuthoritativeCanonicalIntelligenceState.mockResolvedValue(null);

    const detail = await getSignalVisualDetailPayload("AAPL");

    expect(detail.bars).toEqual(completedBars);
    expect(detail.signal).toBeNull();
    expect(detail.regime).toBeNull();
    expect(detail.providerHealth.regime).toMatchObject({ status: "unavailable", source: "canonical-intelligence-state" });
    expect(detail.providerHealth.signal).toMatchObject({
      status: "unavailable",
      detail: expect.stringContaining("canonical context"),
    });
  });
});
