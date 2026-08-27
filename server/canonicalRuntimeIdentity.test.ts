import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { buildCanonicalIntelligenceState, toPublicCanonicalIntelligenceState } from "./canonicalIntelligenceState";
import { buildCanonicalEvidencePacket } from "./evidencePacket";
import { buildCrossEngineSynthesis } from "./crossEngineSynthesis";
import { buildNoMaterialEarlyWarningPresentation } from "./earlyWarningPresentation";

const validManifest = {
  stateId: "state:identity-contract", generatedAt: "2026-08-27T02:00:00.000Z", championVersion: "champion-v1-frozen", modelVersion: "2.0", scoringVersion: "faultline-pressure-v1-frozen", configurationVersion: "phase1b-governance-v1", inputSnapshotId: "input:identity-contract", stateHash: "identity-contract-hash", pressureIndex: 28, regime: "MODERATE RISK", engineValues: { "liquidity-stress": 16, "credit-contagion": 16 }, engineDirections: { "liquidity-stress": "Stable", "credit-contagion": "Stable" }, domainValues: { evidenceConsensus: "weak" }, scenarioOutputs: { bull: 43, neutral: 43, bear: 14 }, probabilityClaimIds: ["seismograph.scenario.bull"], analogClaimIds: ["seismograph.analog.0"], historicalDatasetVersion: "legacy-317-unreconciled", researchDatasetVersion: "reconstructed-champion-v1-2000-2026-research-only", coherenceStatus: "COHERENT", coherenceNotes: [], dataQualitySummary: { totalInputs: 2, liveInputs: 1, delayedInputs: 1, staleInputs: [], unavailableInputs: [], fallbackInputs: [], staticInputs: [] }, staleInputs: [], unavailableInputs: [], fallbackInputs: [], inputQuality: [{ inputId: "hy_credit_spread", freshnessStatus: "LIVE", contributesTo: ["liquidity-stress"] }, { inputId: "consumer_price_index_yoy", freshnessStatus: "DELAYED", contributesTo: ["credit-contagion"] }],
};

describe("Canonical runtime identity contract", () => {
  it("TEST A–E: preserves one authoritative state identity from canonical state through evidence, synthesis, and no-material Early Warning output", () => {
    const canonical = toPublicCanonicalIntelligenceState(buildCanonicalIntelligenceState(validManifest));
    const evidence = buildCanonicalEvidencePacket(canonical);
    const synthesis = buildCrossEngineSynthesis(canonical, evidence);
    const earlyWarning = buildNoMaterialEarlyWarningPresentation(canonical.stateId, synthesis.synthesisId, "CURRENT", canonical.generatedAt);

    expect(canonical).toMatchObject({ stateId: validManifest.stateId, pressureIndex: 28, regime: "MODERATE RISK", inputSnapshotId: validManifest.inputSnapshotId });
    expect(evidence.canonicalState?.stateId).toBe(canonical.stateId);
    expect(evidence.claims.every(claim => claim.canonical.stateId === canonical.stateId)).toBe(true);
    expect(synthesis.originatingStateId).toBe(canonical.stateId);
    expect(earlyWarning).toMatchObject({ kind: "NO_MATERIAL_EARLY_WARNING", stateId: canonical.stateId, synthesisId: synthesis.synthesisId });
  });

  it("TEST D and F: keeps canonical consumers and all five Pentagonal destinations attached to the canonical authority boundary", () => {
    const engineContext = readFileSync(new URL("../client/src/contexts/EngineContext.tsx", import.meta.url), "utf8");
    const appRoutes = readFileSync(new URL("../client/src/App.tsx", import.meta.url), "utf8");
    expect(engineContext).toMatch(/marketState\.canonicalCurrent/);
    expect(engineContext).toMatch(/canonicalEnvelope/);
    for (const route of ["/app/now", "/app/why", "/app/outlook", "/app/watch", "/app/act"]) {
      expect(appRoutes).toContain(route);
    }
  });

  it("fails closed when canonical identity is unavailable rather than recasting it as no material warning", async () => {
    const unavailable = (await import("./earlyWarningPresentation")).buildGovernedEvaluationUnavailablePresentation(null, null, "CANONICAL_STATE_UNAVAILABLE", "2026-08-27T02:00:00.000Z");
    expect(unavailable).toMatchObject({ kind: "GOVERNED_EVALUATION_UNAVAILABLE", stateId: null, synthesisId: null, freshness: "UNAVAILABLE" });
  });
});
