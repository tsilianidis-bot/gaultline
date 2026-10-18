import { describe, expect, it } from "vitest";
import {
  buildEvidenceFamilies,
  comparableHistoricalTerms,
  computeSimilarity,
  currentComparableProfile,
  detectActivePatterns,
  findHistoricalAnalogs,
  seismographFreshnessFromObservedAt,
  type HistoricalMonth,
} from "./seismographUnified";

/**
 * MOCK FIXTURE ONLY — no network, credentials, database, or production call.
 * Provider metadata is part of each fixture so test observations cannot be
 * mistaken for live provider data.
 */
const fixtureProvider = {
  provider: "canonical-intelligence-state/mock",
  observedAt: "2026-10-17T12:00:00.000Z",
  mode: "credential-free-fixture",
};

function month(overrides: Partial<HistoricalMonth> = {}): HistoricalMonth {
  return {
    month: "2024-01",
    score: 70,
    regime: "HIGH RISK",
    liquidity: 70,
    credit: 70,
    volatility: 70,
    macro: 70,
    breadth: 70,
    aiBubble: null,
    baaSpread: null,
    hySpread: null,
    tsy10y: 4,
    tsy2y: 3.5,
    fedfunds: null,
    cpiYoy: null,
    unemployment: null,
    sp500: 100,
    ...overrides,
  };
}

function canonicalFixture(overrides: Record<string, unknown> = {}) {
  return {
    ...fixtureProvider,
    schemaVersion: "phase2-canonical-state-v1",
    stateId: "state-fixture-1",
    stateHash: "hash-fixture-1",
    inputSnapshotId: "input-fixture-1",
    generatedAt: fixtureProvider.observedAt,
    effectiveAt: fixtureProvider.observedAt,
    calculationStartedAt: null,
    calculationCompletedAt: null,
    championVersion: "fixture",
    modelVersion: "fixture",
    scoringVersion: "fixture",
    configurationVersion: "fixture",
    regime: "HIGH RISK",
    pressureIndex: 72,
    pressureLevel: "HIGH RISK",
    pressureDirection: "Deteriorating",
    pressureAcceleration: null,
    pressurePersistence: null,
    engines: [
      ["liquidity-stress", 72],
      ["credit-contagion", 71],
      ["volatility-regime", 70],
      ["macro-sensitivity", 69],
      ["market-breadth", 68],
    ].map(([engineId, value]) => ({
      engineId,
      engineName: engineId,
      value,
      unit: "score_0_to_100",
      classification: null,
      direction: "Stable",
      acceleration: null,
      persistence: null,
      observedAt: null,
      calculatedAt: fixtureProvider.observedAt,
      sourceInputIds: ["fixture-input"],
      qualityStatus: "HEALTHY",
      freshnessStatus: "CURRENT",
      fallbackStatus: "NONE",
      modelVersion: "fixture",
      calculationVersion: "fixture",
      contributionToComposite: true,
    })),
    domains: {},
    scenarioOutputs: {},
    probabilityClaimIds: [],
    analogClaimIds: [],
    historicalContext: {},
    dataQualitySummary: {},
    confidenceOrEvidenceQuality: "HEALTHY",
    staleInputs: [],
    delayedInputs: [],
    unavailableInputs: [],
    fallbackInputs: [],
    warnings: [],
    conflicts: [],
    historicalDatasetVersion: "fixture",
    researchDatasetVersion: "fixture",
    provenance: { manifestSource: "intelligenceStateManifests", governanceVersion: "fixture", coherenceStatus: "COHERENT" },
    ...overrides,
  } as any;
}

function assembledFixture(overrides: Record<string, unknown> = {}) {
  return {
    ...fixtureProvider,
    canonicalStateId: "state-fixture-1",
    stateHash: "hash-fixture-1",
    inputSnapshotId: "input-fixture-1",
    computedAt: Date.parse(fixtureProvider.observedAt),
    pressureScore: 72,
    regime: "HIGH RISK",
    stressLevel: "High",
    direction: "Deteriorating",
    dataFreshness: "live",
    ...overrides,
  } as any;
}

describe("Unified Seismograph integrity — mock fixtures only", () => {
  it("uses same-state canonical vector values, never the distinct final legacy row", () => {
    const profile = currentComparableProfile(canonicalFixture(), assembledFixture());
    expect(profile).toMatchObject({
      score: 72,
      liquidity: 72,
      credit: 71,
      volatility: 70,
      macro: 69,
      breadth: 68,
      tsy10y: null,
    });

    const legacyHistory = Array.from({ length: 14 }, (_, index) => month({
      month: `2024-${String(index + 1).padStart(2, "0")}`,
      score: 12,
      liquidity: 12,
      credit: 13,
      volatility: 14,
      macro: 15,
      breadth: 16,
    }));
    const families = buildEvidenceFamilies(profile!, legacyHistory);
    expect(families.find(family => family.name === "Liquidity Conditions")?.strength).toBe(72);
    expect(families.find(family => family.name === "Credit Markets")?.strength).toBe(71);
    expect(JSON.stringify(families)).not.toContain('"strength":12');
  });

  it("withholds profile-dependent analogs when the canonical and assembled state cannot bind", () => {
    const mismatched = currentComparableProfile(canonicalFixture(), assembledFixture({ pressureScore: 61 }));
    const legacyHistory = Array.from({ length: 14 }, (_, index) => month({ month: `2023-${String(index + 1).padStart(2, "0")}` }));
    expect(mismatched).toBeNull();
    expect(findHistoricalAnalogs(mismatched, legacyHistory)).toEqual([]);
  });

  it("does not substitute 50 for a zero sentinel or 70 for a missing 10Y observation", () => {
    const complete = month();
    expect(computeSimilarity(complete, { ...complete, credit: 0 })).toBeNull();

    const without10Y = { ...complete, tsy10y: null };
    const terms = comparableHistoricalTerms(complete, without10Y);
    expect(terms).toMatchObject({ macroSimilarity: null, comparedTerms: 6, requiredTerms: 5, availableTerms: 7 });
    // Score + observed vector terms are re-normalized; no invented 70 macro term.
    expect(computeSimilarity(complete, without10Y)).toBe(100);
  });

  it("classifies freshness from source timestamp and canonical quality, retaining no cache-derived live status", () => {
    const now = Date.parse("2026-10-17T12:20:00.000Z");
    expect(seismographFreshnessFromObservedAt(fixtureProvider.observedAt, "HEALTHY", now)).toBe("live");
    expect(seismographFreshnessFromObservedAt(fixtureProvider.observedAt, "DEGRADED", now)).toBe("recent");
    expect(seismographFreshnessFromObservedAt("2026-10-16T12:00:00.000Z", "HEALTHY", now)).toBe("stale");
    expect(seismographFreshnessFromObservedAt(fixtureProvider.observedAt, null, now)).toBe("stale");
  });

  it("withholds static pattern confidence, frequency, and outcome claims without governed history", () => {
    const reconstructedHistory = Array.from({ length: 12 }, (_, index) => month({ month: `2025-${String(index + 1).padStart(2, "0")}` }));
    expect(detectActivePatterns(reconstructedHistory, 72, "HIGH RISK")).toEqual([]);
  });
});
