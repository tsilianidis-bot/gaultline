import { describe, expect, it } from "vitest";
import { buildCanonicalEvidencePacket } from "./evidencePacket";
import type { PublicCanonicalIntelligenceState } from "../shared/canonicalIntelligenceState";

const state: PublicCanonicalIntelligenceState = {
  schemaVersion: "phase2-canonical-state-v1", stateId: "state:evidence-test", generatedAt: "2026-08-22T15:00:00.000Z", effectiveAt: "2026-08-22T15:00:00.000Z", calculationStartedAt: null, calculationCompletedAt: null,
  championVersion: "champion-v1-frozen", modelVersion: "model-v1", scoringVersion: "score-v1", configurationVersion: "config-v1", inputSnapshotId: "input:evidence", stateHash: "hash:evidence",
  pressureIndex: 18, regime: "MODERATE RISK", pressureLevel: "Moderate", pressureDirection: "Stable", pressureAcceleration: null, pressurePersistence: null,
  engines: [{ engineId: "macro", engineName: "Macro", value: 44, unit: "score_0_to_100", classification: null, direction: "Deteriorating", acceleration: null, persistence: null, observedAt: null, calculatedAt: "2026-08-22T15:00:00.000Z", sourceInputIds: ["FRED:macro"], qualityStatus: "HEALTHY", freshnessStatus: "CURRENT", fallbackStatus: "NONE", modelVersion: "model-v1", calculationVersion: "score-v1", contributionToComposite: true }],
  scenarioOutputs: { bull: 42 }, probabilityClaimIds: [], analogClaimIds: [], historicalContext: { canonicalLiveHistory: "operational-only", reconstructedResearch: "research-only", historicalAnalogOutput: "governed-only", patternResolution: "append-only" },
  dataQualitySummary: { status: "HEALTHY", staleInputCount: 0, delayedInputCount: 0, unavailableInputCount: 0, fallbackInputCount: 0 }, confidenceOrEvidenceQuality: "HEALTHY", staleInputs: [], delayedInputs: [], unavailableInputs: [], fallbackInputs: [], warnings: [], conflicts: [], historicalDatasetVersion: "history-v1", researchDatasetVersion: "research-v1", provenance: { manifestSource: "intelligenceStateManifests", governanceVersion: "config-v1", coherenceStatus: "COHERENT" },
};

describe("Phase 3 canonical evidence packet", () => {
  it("binds every current claim to the canonical state and retains deterministic provenance", () => {
    const packet = buildCanonicalEvidencePacket(state);
    expect(packet).toMatchObject({ contractVersion: "phase3-evidence-contract-v1", canonicalState: { stateId: state.stateId, inputSnapshotId: state.inputSnapshotId } });
    expect(packet.claims).toHaveLength(4);
    expect(packet.claims.every(claim => claim.canonical?.stateId === state.stateId)).toBe(true);
  });

  it("represents scenario arithmetic as DERIVED rather than model probability or forecast", () => {
    const packet = buildCanonicalEvidencePacket(state);
    const scenario = packet.claims.find(claim => claim.claimId.endsWith(":derived:scenario:bull"));
    expect(scenario).toMatchObject({ evidenceClass: "DERIVED", probabilityType: "SCENARIO_SCORE", forecastAuthorized: false });
    expect(scenario?.statement).not.toMatch(/likely|will|within/i);
  });

  it("does not fabricate historical or forecast claims from only canonical claim references", () => {
    const packet = buildCanonicalEvidencePacket({ ...state, analogClaimIds: ["analog:reference"], probabilityClaimIds: ["probability:reference"] });
    expect(packet.claims.some(claim => claim.evidenceClass === "HISTORICAL" || claim.evidenceClass === "FORECAST")).toBe(false);
  });
});
