import { describe, expect, it } from "vitest";
import { buildCanonicalIntelligenceState } from "./canonicalIntelligenceState";
import { buildCanonicalEvidencePacket } from "./evidencePacket";
import { toOperationalPressure, toSignalRegime, requireObservedCryptoGlobals } from "./operationalSignalInputs";
import { evaluateIntelligenceEvidence } from "../shared/intelligenceIntegrity";
import { evidenceReferenceHash, selectVerifiedEvidenceReferences, trackRecordCronWritesEnabled } from "./trackRecordCapture";
import type { GlobalStats } from "./coingeckoProxy";

const NOW = Date.parse("2026-10-17T18:05:00.000Z");
function state(score = 25) {
  return buildCanonicalIntelligenceState({ stateId: "state:truth", generatedAt: new Date(NOW).toISOString(),
    championVersion: "champion-v1-frozen", modelVersion: "model-v1", scoringVersion: "pressure-v1-frozen", configurationVersion: "config-v1",
    inputSnapshotId: "input:truth", stateHash: "hash:truth", pressureIndex: score, regime: "MODERATE RISK", coherenceStatus: "COHERENT",
    engineValues: { "liquidity-stress": 20, "credit-contagion": 30, "volatility-regime": 40, "macro-sensitivity": 50, "market-breadth": 60, "ai-bubble": 40 },
    engineDirections: {}, scenarioOutputs: {}, inputQuality: [], dataQualitySummary: {}, staleInputs: [], unavailableInputs: [], fallbackInputs: [], coherenceNotes: [] });
}
const globals: GlobalStats = { totalMarketCap: 100, totalVolume24h: 20, btcDominance: 62, ethDominance: 12, marketCapChangePercent24h: -1.2,
  activeCryptocurrencies: 10, markets: 5, observedAt: NOW - 60_000, fetchedAt: NOW - 10_000 };

describe("source-of-truth operational boundaries", () => {
  it("normalizes the actual canonical 0-100 pressure exactly once", () => {
    expect(toSignalRegime(toOperationalPressure(state(25), true)).score).toBe(2.5);
    expect(toSignalRegime(toOperationalPressure(state(55), true)).score).toBe(5.5);
  });
  it("withholds instead of inventing missing canonical pressure or vectors", () => {
    expect(() => toOperationalPressure(null)).toThrow(/unavailable/i);
    const missing = state(); missing.engines = missing.engines.filter(engine => engine.engineId !== "credit-contagion");
    expect(() => toOperationalPressure(missing, true)).toThrow(/unavailable/i);
    expect(() => toSignalRegime({ overallPressure: Infinity, regime: "fake" })).toThrow();
  });
  it("never labels a canonical composite or engine model score OBSERVED", () => {
    const packet = buildCanonicalEvidencePacket(state());
    expect(packet.claims.length).toBeGreaterThan(0);
    expect(packet.claims.every(claim => claim.evidenceClass === "DERIVED")).toBe(true);
    expect(packet.claims.every(claim => claim.methodologyVersion && claim.derivedFromClaimIds?.length)).toBe(true);
    expect(packet.claims.every(claim => claim.canonical?.stateId === "state:truth")).toBe(true);
  });
  it("requires actual crypto values and provider timestamp, not local retrieval time", () => {
    expect(requireObservedCryptoGlobals(globals, NOW)).toBe(globals);
    expect(() => requireObservedCryptoGlobals(null, NOW)).toThrow(/unavailable/i);
    expect(() => requireObservedCryptoGlobals({ ...globals, observedAt: NOW - 20 * 60_000, fetchedAt: NOW }, NOW)).toThrow(/stale/i);
    expect(() => requireObservedCryptoGlobals({ ...globals, btcDominance: Number.NaN }, NOW)).toThrow();
  });
  it("rejects explicit simulations and historical reconstructions as current evidence", () => {
    for (const origin of ["simulated", "historical_reconstruction", "unavailable"] as const) {
      expect(evaluateIntelligenceEvidence({ id: "fixture", source: "test", origin, value: 10, observedAt: new Date(NOW - 1000).toISOString(), receivedAt: new Date(NOW).toISOString(), maxAgeMs: 5000, sourceHealthy: true }, NOW).canSupportCurrentClaim).toBe(false);
    }
  });
  it("same source identity/time with different measurements cannot share a content hash", () => {
    const input = { id: "quote:SPY", observedAt: new Date(NOW).toISOString(), receivedAt: new Date(NOW).toISOString(), validationStatus: "verified", methodVersion: "v1", provider: "Yahoo", origin: "observed", sourceIdentifier: "SPY", unit: "USD" };
    expect(evidenceReferenceHash({ ...input, value: 100 })).not.toBe(evidenceReferenceHash({ ...input, value: 101 }));
    expect(evidenceReferenceHash({ ...input, value: 100 })).toBe(evidenceReferenceHash({ ...input, value: 100 }));
  });
  it("recording requires exactly the approved flag value", () => {
    expect(trackRecordCronWritesEnabled({ TRACK_RECORD_CRON_WRITES: "true" })).toBe(true);
    for (const value of ["TRUE", " true ", "1", "false"]) expect(trackRecordCronWritesEnabled({ TRACK_RECORD_CRON_WRITES: value })).toBe(false);
    expect(selectVerifiedEvidenceReferences(null, NOW)).toEqual({ ok: false, reason: "evidence_missing" });
  });
});
