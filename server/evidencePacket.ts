import type { PublicCanonicalIntelligenceState } from "../shared/canonicalIntelligenceState";
import { createEvidencePacket, type CanonicalClaimBinding, type EvidenceClaim, type EvidencePacket, type EvidenceStrength } from "../shared/evidenceContract";

function strengthFor(state: PublicCanonicalIntelligenceState): EvidenceStrength {
  return state.confidenceOrEvidenceQuality === "HEALTHY" ? "MODERATE" : "PRELIMINARY";
}

function bindingFor(state: PublicCanonicalIntelligenceState): CanonicalClaimBinding {
  return {
    stateId: state.stateId,
    effectiveAt: state.effectiveAt,
    inputSnapshotId: state.inputSnapshotId,
    modelVersion: state.modelVersion,
    configurationVersion: state.configurationVersion,
  };
}

/**
 * Creates a compact, deterministic packet of only the current canonical facts
 * available from the authoritative state. Historical and forecast evidence is
 * deliberately omitted until it has class-specific structured provenance.
 */
export function buildCanonicalEvidencePacket(state: PublicCanonicalIntelligenceState): EvidencePacket {
  const canonical = bindingFor(state);
  const common = {
    canonical,
    qualityStatus: state.confidenceOrEvidenceQuality,
    evidenceStrength: strengthFor(state),
    limitations: state.warnings,
    createdAt: state.generatedAt,
    effectiveAt: state.effectiveAt,
    forecastAuthorized: false,
  } as const;
  const claims: EvidenceClaim[] = [];
  if (state.pressureIndex !== null) {
    claims.push({ ...common, claimId: `${state.stateId}:observed:pressure-index`, evidenceClass: "OBSERVED", statement: `Pressure Index is ${state.pressureIndex}.`, value: state.pressureIndex, unit: "score_0_to_100", sourceIds: [state.stateId], sourceType: "MANIFEST", sourceTimestamp: state.effectiveAt });
  }
  if (state.regime) {
    claims.push({ ...common, claimId: `${state.stateId}:observed:regime`, evidenceClass: "OBSERVED", statement: `Current regime is ${state.regime}.`, value: state.regime, unit: "regime", sourceIds: [state.stateId], sourceType: "MANIFEST", sourceTimestamp: state.effectiveAt });
  }
  for (const engine of state.engines) {
    if (engine.value === null) continue;
    claims.push({ ...common, claimId: `${state.stateId}:observed:engine:${engine.engineId}`, evidenceClass: "OBSERVED", statement: `${engine.engineName} is ${engine.value}.`, value: engine.value, unit: engine.unit, sourceIds: engine.sourceInputIds.length ? engine.sourceInputIds : [state.stateId], sourceType: "ENGINE", sourceTimestamp: engine.calculatedAt ?? state.effectiveAt, modelId: "canonical-engine", modelVersion: engine.modelVersion });
  }
  const dependencies = claims.filter(claim => claim.claimId.includes(":observed:")).map(claim => claim.claimId);
  for (const [label, value] of Object.entries(state.scenarioOutputs)) {
    claims.push({ ...common, claimId: `${state.stateId}:derived:scenario:${label}`, evidenceClass: "DERIVED", statement: `Scenario component ${label} is ${value}.`, value, unit: "scenario_score", derivedFromClaimIds: dependencies, methodologyId: "canonical-scenario-output", methodologyVersion: state.scoringVersion, modelId: "canonical-state", modelVersion: state.modelVersion, limitations: [...state.warnings, "Scenario arithmetic is not a calibrated forecast probability."], probabilityType: "SCENARIO_SCORE" });
  }
  return createEvidencePacket(canonical, claims, state.generatedAt);
}
