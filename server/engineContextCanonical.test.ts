import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { createCanonicalConsumerEnvelope } from "../shared/canonicalConsumerEnvelope";
import type { PublicCanonicalIntelligenceState } from "../shared/canonicalIntelligenceState";

const source = fs.readFileSync(
  path.resolve(process.cwd(), "client/src/contexts/EngineContext.tsx"),
  "utf8",
);

const controlledState: PublicCanonicalIntelligenceState = {
  schemaVersion: "phase2-canonical-state-v1", stateId: "state:controlled", generatedAt: "2026-08-22T15:00:00.000Z", effectiveAt: "2026-08-22T15:00:00.000Z",
  calculationStartedAt: null, calculationCompletedAt: null, championVersion: "champion-v1-frozen", modelVersion: "model-controlled", scoringVersion: "score-controlled", configurationVersion: "config-controlled", inputSnapshotId: "inputs-controlled", stateHash: "hash-controlled",
  regime: "MODERATE RISK", pressureIndex: 27, pressureLevel: "Moderate", pressureDirection: "Stable", pressureAcceleration: null, pressurePersistence: null,
  engines: [{ engineId: "liquidity-stress", engineName: "Liquidity", value: 16, unit: "score_0_to_100", classification: null, direction: "Stable", acceleration: null, persistence: null, observedAt: null, calculatedAt: "2026-08-22T15:00:00.000Z", sourceInputIds: ["hy"], qualityStatus: "HEALTHY", freshnessStatus: "CURRENT", fallbackStatus: "NONE", modelVersion: "model-controlled", calculationVersion: "score-controlled", contributionToComposite: true }],
  scenarioOutputs: {}, probabilityClaimIds: ["claim:probability"], analogClaimIds: ["claim:analog"], historicalContext: { canonicalLiveHistory: "operational-only", reconstructedResearch: "research-only", historicalAnalogOutput: "governed-only", patternResolution: "append-only" },
  dataQualitySummary: { status: "HEALTHY", staleInputCount: 0, delayedInputCount: 0, unavailableInputCount: 0, fallbackInputCount: 0 }, confidenceOrEvidenceQuality: "HEALTHY", staleInputs: [], delayedInputs: [], unavailableInputs: [], fallbackInputs: [], warnings: [], conflicts: [], historicalDatasetVersion: "history-v1", researchDatasetVersion: "research-v1", provenance: { manifestSource: "intelligenceStateManifests", governanceVersion: "config-controlled", coherenceStatus: "COHERENT" },
};

describe("EngineContext Phase 2D canonical transport", () => {
  it("uses canonical state as the upstream current-state authority", () => {
    expect(source).toContain("trpc.marketState.canonicalCurrent.useQuery");
    expect(source).toContain("enabled: Boolean(canonicalStateQuery.data)");
    expect(source).toContain("if (!canonicalState) return null;");
    expect(source).toContain("const canonicalState = canonicalStateQuery.data ?? null");
  });

  it("exposes canonical identity and projects core score/regime from that state", () => {
    expect(source).toContain("canonicalState: PublicCanonicalIntelligenceState | null");
    expect(source).toContain("pressureScore = canonicalState.pressureIndex");
    expect(source).toContain("regime = canonicalState.regime");
    expect(source).toContain("canonicalState,");
  });

  it("exposes a reusable canonical consumer envelope around compatibility data", () => {
    expect(source).toContain("createCanonicalConsumerEnvelope");
    expect(source).toContain("canonicalEnvelope: CanonicalConsumerEnvelope<CanonicalMarketState> | null");
    expect(source).toContain("if (!canonicalState || !marketState) return null;");
    expect(source).toContain("canonicalEnvelope,");
    expect(source).toContain("{ ...projected.output, canonicalEnvelope }");
  });

  it("does not silently return a legacy-shaped current state when canonical state is unavailable", () => {
    const canonicalGuard = source.indexOf("if (!canonicalState) return null;");
    const legacyProjectionRead = source.indexOf("const legacy = legacyProjectionQuery.data;");
    expect(canonicalGuard).toBeGreaterThan(-1);
    expect(legacyProjectionRead).toBeGreaterThan(canonicalGuard);
  });

  it("TEST A: retains one controlled canonical identity, pressure, regime, and engine values through the consumer envelope", () => {
    const compatibility = { now: { pressureScore: 27, regime: "MODERATE RISK" }, engineValues: { "liquidity-stress": 16 } };
    const envelope = createCanonicalConsumerEnvelope(controlledState, compatibility);
    expect(envelope.stateId).toBe(controlledState.stateId);
    expect(envelope.compatibilityData.now.pressureScore).toBe(controlledState.pressureIndex);
    expect(envelope.compatibilityData.now.regime).toBe(controlledState.regime);
    expect(envelope.compatibilityData.engineValues["liquidity-stress"]).toBe(controlledState.engines[0]?.value);
    expect(envelope.stateHash).toBe(controlledState.stateHash);
  });

  it("TEST J: canonical failure withholds compatibility state instead of activating legacy projection", () => {
    expect(source).toContain("if (!canonicalState) return null;");
    expect(source).toContain("enabled: Boolean(canonicalStateQuery.data)");
    expect(source).not.toContain("canonicalStateQuery.error ? legacyProjectionQuery.data");
    expect(source).toContain("if (!canonicalState || !marketState) return null;");
  });
});
