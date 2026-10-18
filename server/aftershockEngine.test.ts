import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CanonicalIntelligenceState } from "../shared/canonicalIntelligenceState";
import {
  clearAftershockCache,
  getAssetContagionChain,
  getAllContagionAssets,
  normalizeAftershockTicker,
  runAftershockEngine,
  toObservedAftershockQuote,
  type AftershockMarketSnapshot,
  type ObservedAftershockQuote,
} from "./aftershockEngine";
import { resolveRunContext } from "./forwardRunProvenance";
import type { YahooDailyBar } from "./yahooProxy";

const OBSERVED_AT = Date.parse("2026-09-18T21:00:00.000Z");
const RECEIVED_AT = Date.parse("2026-09-18T21:05:00.000Z");
const CANONICAL_AT = "2026-10-16T20:30:00.000Z";
const FIXTURE_NOW = Date.parse("2026-10-16T21:00:00.000Z");
const CANONICAL_STATE_ID = "state:2026-10-16T20:30:00.000Z:aftershock-fixture";
const CANONICAL_INPUT_SNAPSHOT_ID = "input:aftershock-fixture:9c20e3038cb343ef";
const SCHEDULED_RUN = resolveRunContext("cron-endpoint", new Date(CANONICAL_AT));

/** Exact completed Yahoo daily-bar fixture: 20-bar mean volume = 109.5, latest volume = 219. */
function bars(count = 21): YahooDailyBar[] {
  return Array.from({ length: count }, (_, index) => ({
    timestamp: Date.parse(`2026-08-${String(index + 1).padStart(2, "0")}T21:00:00.000Z`),
    open: 100 + index,
    high: 102 + index,
    low: 99 + index,
    close: index === 20 ? 125 : 100 + index,
    volume: index === 20 ? 219 : 100 + index,
  }));
}

function canonical(overrides: Partial<CanonicalIntelligenceState> = {}): CanonicalIntelligenceState {
  return {
    schemaVersion: "phase2-canonical-state-v1",
    stateId: CANONICAL_STATE_ID,
    generatedAt: CANONICAL_AT,
    effectiveAt: CANONICAL_AT,
    calculationStartedAt: "2026-10-16T20:15:00.000Z",
    calculationCompletedAt: CANONICAL_AT,
    championVersion: "champion-v1-frozen",
    modelVersion: "seismograph-core-v1",
    scoringVersion: "faultline-pressure-v1-frozen",
    configurationVersion: "phase1b-governance-v1",
    inputSnapshotId: CANONICAL_INPUT_SNAPSHOT_ID,
    stateHash: "c2f8138ab8e1844293a925b257940f38003361d3cb2dd61ae42f5f6cb51aa32b",
    pressureIndex: 64,
    pressureLevel: "Elevated",
    regime: "ELEVATED STRESS",
    pressureDirection: "Stable",
    pressureAcceleration: null,
    pressurePersistence: null,
    confidenceOrEvidenceQuality: "HEALTHY",
    unavailableInputs: [],
    staleInputs: [],
    delayedInputs: [],
    fallbackInputs: [],
    engines: [
      ["liquidity-stress", 64, ["hy_credit_spread", "secured_overnight_financing_rate"]],
      ["credit-contagion", 61, ["hy_credit_spread", "ten_year_treasury_yield", "unemployment_rate"]],
      ["volatility-regime", 66, ["ten_year_treasury_yield", "two_year_treasury_yield"]],
      ["macro-sensitivity", 62, ["consumer_price_index_yoy", "producer_price_index_yoy", "federal_funds_rate"]],
      ["market-breadth", 63, ["unemployment_rate", "ten_year_treasury_yield"]],
      ["ai-bubble", 68, ["ai_concentration_static_baseline"]],
    ].map(([engineId, value, sourceInputIds]) => ({
      engineId,
      engineName: engineId,
      value,
      unit: "score_0_to_100",
      classification: null,
      direction: engineId === "ai-bubble" ? "Unknown" : "Stable",
      acceleration: null,
      persistence: null,
      observedAt: CANONICAL_AT,
      calculatedAt: CANONICAL_AT,
      sourceInputIds,
      qualityStatus: engineId === "ai-bubble" ? "DEGRADED" : "HEALTHY",
      freshnessStatus: "CURRENT",
      fallbackStatus: "NONE",
      modelVersion: "seismograph-core-v1",
      calculationVersion: "faultline-pressure-v1-frozen",
      contributionToComposite: true,
    })),
    domains: {},
    scenarioOutputs: {},
    probabilityClaimIds: [],
    analogClaimIds: [],
    historicalContext: {
      canonicalLiveHistory: "intelligenceStateManifests append-only operational snapshots only",
      reconstructedResearch: "reconstructed-champion-v1-2000-2026-research-only",
      historicalAnalogOutput: "governed analog claim references only",
      patternResolution: "governedResearchResolutions append-only later outcomes",
    },
    dataQualitySummary: { totalInputs: 8, liveInputs: 8, delayedInputs: 0, staleInputs: [], unavailableInputs: [], fallbackInputs: [] },
    warnings: [],
    conflicts: [],
    historicalDatasetVersion: "legacy-317-unreconciled",
    researchDatasetVersion: "reconstructed-champion-v1-2000-2026-research-only",
    provenance: {
      manifestSource: "intelligenceStateManifests",
      governanceVersion: "phase1b-governance-v1",
      coherenceStatus: "COHERENT",
      runTrigger: SCHEDULED_RUN.trigger,
      scheduledPublication: SCHEDULED_RUN.trigger === "SCHEDULED_CRON" && SCHEDULED_RUN.scheduledWindow,
    },
    ...overrides,
  } satisfies CanonicalIntelligenceState;
}

function observedQuote(symbol: string, overrides: Partial<ObservedAftershockQuote> = {}): ObservedAftershockQuote {
  return {
    symbol,
    providerSymbol: symbol,
    changePercent: 0.25,
    volumeRatio: 1.1,
    observedAt: OBSERVED_AT,
    receivedAt: RECEIVED_AT,
    source: "yahoo-daily",
    freshness: "DELAYED",
    availability: "AVAILABLE",
    ...overrides,
  };
}

function snapshot(quotes: ObservedAftershockQuote[], reason: string | null = null): AftershockMarketSnapshot {
  return { availability: quotes.length ? "AVAILABLE" : "UNAVAILABLE", quotes, reason };
}

beforeEach(() => {
  clearAftershockCache();
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(FIXTURE_NOW);
});

afterEach(() => vi.useRealTimers());

describe("toObservedAftershockQuote", () => {
  it("derives exact close-to-close change and a 20-prior-completed-bar volume ratio with Yahoo provenance", () => {
    const quote = toObservedAftershockQuote("nvda", bars(), RECEIVED_AT, FIXTURE_NOW, "NVDA");

    expect(quote).toEqual({
      symbol: "NVDA",
      providerSymbol: "NVDA",
      changePercent: ((125 - 119) / 119) * 100,
      volumeRatio: 219 / 109.5,
      observedAt: Date.parse("2026-08-21T21:00:00.000Z"),
      receivedAt: RECEIVED_AT,
      source: "yahoo-daily",
      freshness: "DELAYED",
      availability: "AVAILABLE",
    });
  });

  it.each([
    ["has fewer than 21 completed bars", bars(20)],
    ["has a zero-volume baseline bar", bars().map((bar, index) => index === 4 ? { ...bar, volume: 0 } : bar)],
    ["has an invalid price", bars().map((bar, index) => index === 20 ? { ...bar, close: Number.NaN } : bar)],
  ])("returns null when the observation %s", (_label, fixture) => {
    expect(toObservedAftershockQuote("NVDA", fixture, RECEIVED_AT, FIXTURE_NOW, "NVDA")).toBeNull();
  });

  it("uses explicit provider mappings rather than sending internal crypto symbols to Yahoo unchanged", () => {
    expect(normalizeAftershockTicker("BTC")).toBe("BTC-USD");
    expect(normalizeAftershockTicker("eth")).toBe("ETH-USD");
    expect(normalizeAftershockTicker("VIX")).toBe("^VIX");
    expect(normalizeAftershockTicker("unknown")).toBeNull();
  });
});

describe("runAftershockEngine source-truth boundary", () => {
  it("returns UNAVAILABLE and no calm-market or rupture output when the observed snapshot is absent", async () => {
    const marketSnapshotProvider = vi.fn().mockResolvedValue(snapshot([], "Observed market bars unavailable in fixture."));
    const canonicalStateProvider = vi.fn().mockResolvedValue(canonical());

    const result = await runAftershockEngine({ marketSnapshotProvider, canonicalStateProvider, now: () => FIXTURE_NOW });

    expect(canonicalStateProvider).toHaveBeenCalledTimes(1);
    expect(marketSnapshotProvider).toHaveBeenCalledTimes(1);
    expect(result).toMatchObject({
      availability: "UNAVAILABLE",
      evidenceStatus: "UNAVAILABLE",
      canonicalStateId: CANONICAL_STATE_ID,
      pressureIndex: null,
      regime: null,
      activeRuptures: [],
      aftershocks: [],
      chains: [],
    });
    expect(result.summary).toContain("Observations unavailable");
    expect(result.summary).not.toMatch(/normal|no active ruptures/i);
  });

  it("withholds all claims when canonical macro projection is absent instead of manufacturing 50 or a regime", async () => {
    const marketSnapshotProvider = vi.fn().mockResolvedValue(snapshot([observedQuote("NVDA")]));
    const canonicalStateProvider = vi.fn().mockResolvedValue(null);

    const result = await runAftershockEngine({ marketSnapshotProvider, canonicalStateProvider, now: () => FIXTURE_NOW });

    expect(result).toMatchObject({
      availability: "UNAVAILABLE",
      evidenceStatus: "UNAVAILABLE",
      canonicalStateId: null,
      pressureIndex: null,
      regime: null,
      systemicRiskLevel: null,
    });
    expect(marketSnapshotProvider).not.toHaveBeenCalled();
    expect(JSON.stringify(result)).not.toContain("Rate Shock");
    expect(JSON.stringify(result)).not.toContain('"pressureIndex":50');
  });

  it("derives a rupture only from fixed observed quotes and preserves source, time, receipt, canonical, and model metadata", async () => {
    const marketSnapshotProvider = vi.fn().mockResolvedValue(snapshot([
      observedQuote("NVDA", { changePercent: 6, volumeRatio: 2.2 }),
      observedQuote("AMD", { changePercent: 3.1, volumeRatio: 1.1, observedAt: OBSERVED_AT + 1_000, receivedAt: RECEIVED_AT + 1_000 }),
    ]));
    const canonicalStateProvider = vi.fn().mockResolvedValue(canonical());

    const result = await runAftershockEngine({ marketSnapshotProvider, canonicalStateProvider, now: () => FIXTURE_NOW });
    const rupture = result.activeRuptures.find(item => item.triggerAsset === "NVDA");
    const signal = result.aftershocks.find(item => item.triggerAsset === "NVDA" && item.relatedAsset === "AMD");

    expect(marketSnapshotProvider).toHaveBeenCalledTimes(1);
    expect(canonicalStateProvider).toHaveBeenCalledTimes(1);
    expect(result).toMatchObject({
      availability: "AVAILABLE",
      evidenceStatus: "DELAYED",
      source: "yahoo-daily",
      canonicalStateId: CANONICAL_STATE_ID,
      canonicalInputSnapshotId: CANONICAL_INPUT_SNAPSHOT_ID,
      model: { modelDerived: true, calibrationStatus: "NOT_CALIBRATED", probabilityStatus: "NOT_ESTABLISHED" },
    });
    expect(rupture).toMatchObject({
      id: `rupture_NVDA_${OBSERVED_AT}`,
      source: "yahoo-daily",
      observedAt: OBSERVED_AT,
      receivedAt: RECEIVED_AT,
      availability: "AVAILABLE",
      evidenceStatus: "DELAYED",
      canonicalStateId: CANONICAL_STATE_ID,
      modelDerived: true,
    });
    expect(signal).toMatchObject({
      source: "aftershock-static-contagion-graph",
      probability: null,
      confidence: null,
      confirmationStatus: "Confirmed",
      reactionSource: "yahoo-daily",
      reactionObservedAt: OBSERVED_AT + 1_000,
      reactionReceivedAt: RECEIVED_AT + 1_000,
      reactionAvailability: "AVAILABLE",
      canonicalStateId: CANONICAL_STATE_ID,
      modelDerived: true,
      model: { methodologyVersion: "aftershock-methodology-v1", calibrationStatus: "NOT_CALIBRATED" },
    });
    expect(signal?.sourceInputIds).toContain(`market:yahoo-daily:AMD:${OBSERVED_AT + 1_000}`);
  });

  it("cannot confirm a graph edge without an independently observed related reaction", async () => {
    const result = await runAftershockEngine({
      canonicalStateProvider: async () => canonical(),
      marketSnapshotProvider: async () => snapshot([observedQuote("NVDA", { changePercent: -6, volumeRatio: 2.2 })]),
      now: () => FIXTURE_NOW,
    });
    const signal = result.aftershocks.find(item => item.triggerAsset === "NVDA" && item.relatedAsset === "AMD");

    expect(signal).toMatchObject({
      confirmationStatus: "Unconfirmed",
      reactionStarted: false,
      currentReactionPercent: null,
      reactionAvailability: "UNAVAILABLE",
      reactionSource: null,
    });
  });

  it("is reproducible from a fixed source fixture; advancing response time does not create a rupture", async () => {
    const fixedSnapshot = snapshot([observedQuote("NVDA", { changePercent: 6, volumeRatio: 2.2 })]);
    const dependencies = {
      canonicalStateProvider: async () => canonical(),
      marketSnapshotProvider: async () => fixedSnapshot,
    };
    const first = await runAftershockEngine({ ...dependencies, now: () => FIXTURE_NOW });
    const second = await runAftershockEngine({ ...dependencies, now: () => FIXTURE_NOW + 86_400_000 });

    expect(second.activeRuptures).toEqual(first.activeRuptures);
    expect(second.aftershocks.map(signal => signal.id)).toEqual(first.aftershocks.map(signal => signal.id));
    expect(second.generatedAt).toBeGreaterThan(first.generatedAt);
  });

  it("propagates stale canonical evidence rather than relabelling it CURRENT", async () => {
    const result = await runAftershockEngine({
      canonicalStateProvider: async () => canonical({ confidenceOrEvidenceQuality: "PARTIAL", staleInputs: ["fred:DGS10"] }),
      marketSnapshotProvider: async () => snapshot([observedQuote("NVDA", { changePercent: 6, volumeRatio: 2.2 })]),
      now: () => FIXTURE_NOW,
    });

    expect(result).toMatchObject({ availability: "AVAILABLE", evidenceStatus: "STALE", canonicalStateId: CANONICAL_STATE_ID });
  });
});

describe("contagion graph provenance", () => {
  it("keeps the useful graph but exposes it as versioned, uncalibrated methodology", () => {
    const edges = getAssetContagionChain("NVDA");
    expect(edges.length).toBeGreaterThan(0);
    expect(edges[0]?.model).toEqual(expect.objectContaining({
      modelDerived: true,
      modelVersion: "static-graph-v1",
      calibrationStatus: "NOT_CALIBRATED",
      probabilityStatus: "NOT_ESTABLISHED",
    }));
    expect(getAllContagionAssets()).toContain("NVDA");
  });
});
