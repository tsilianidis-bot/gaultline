import { beforeEach, describe, expect, it, vi } from "vitest";
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
import type { YahooDailyBar } from "./yahooProxy";

const OBSERVED_AT = Date.parse("2026-09-18T21:00:00.000Z");
const RECEIVED_AT = Date.parse("2026-09-18T21:05:00.000Z");
const FIXTURE_NOW = Date.parse("2026-10-17T17:00:00.000Z");

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
    stateId: "state:aftershock-fixture",
    generatedAt: "2026-09-19T00:00:00.000Z",
    effectiveAt: "2026-09-18T21:00:00.000Z",
    inputSnapshotId: "input:aftershock-fixture",
    stateHash: "hash:aftershock-fixture",
    pressureIndex: 64,
    pressureLevel: "Elevated",
    regime: "ELEVATED STRESS",
    confidenceOrEvidenceQuality: "HEALTHY",
    unavailableInputs: [],
    staleInputs: [],
    delayedInputs: [],
    fallbackInputs: [],
    engines: [],
    provenance: { coherenceStatus: "COHERENT" },
    ...overrides,
  } as CanonicalIntelligenceState;
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

beforeEach(() => clearAftershockCache());

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
      canonicalStateId: "state:aftershock-fixture",
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
      canonicalStateId: "state:aftershock-fixture",
      canonicalInputSnapshotId: "input:aftershock-fixture",
      model: { modelDerived: true, calibrationStatus: "NOT_CALIBRATED", probabilityStatus: "NOT_ESTABLISHED" },
    });
    expect(rupture).toMatchObject({
      id: `rupture_NVDA_${OBSERVED_AT}`,
      source: "yahoo-daily",
      observedAt: OBSERVED_AT,
      receivedAt: RECEIVED_AT,
      availability: "AVAILABLE",
      evidenceStatus: "DELAYED",
      canonicalStateId: "state:aftershock-fixture",
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
      canonicalStateId: "state:aftershock-fixture",
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

    expect(result).toMatchObject({ availability: "AVAILABLE", evidenceStatus: "STALE", canonicalStateId: "state:aftershock-fixture" });
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
