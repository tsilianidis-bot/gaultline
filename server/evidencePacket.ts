import type { PublicCanonicalIntelligenceState } from "../shared/canonicalIntelligenceState";
import { createEvidencePacket, type CanonicalClaimBinding, type EvidenceClaim, type EvidencePacket, type EvidenceStrength } from "../shared/evidenceContract";

function strengthFor(state: PublicCanonicalIntelligenceState): EvidenceStrength {
  return state.confidenceOrEvidenceQuality === "HEALTHY" ? "MODERATE" : "PRELIMINARY";
}

function bindingFor(state: PublicCanonicalIntelligenceState): CanonicalClaimBinding {
  return {
    stateId: state.stateId, effectiveAt: state.effectiveAt,
    inputSnapshotId: state.inputSnapshotId, modelVersion: state.modelVersion,
    configurationVersion: state.configurationVersion,
  };
}

/** Canonical model outputs are DERIVED, never raw provider observations. */
export function buildCanonicalEvidencePacket(state: PublicCanonicalIntelligenceState): EvidencePacket {
  const canonical = bindingFor(state);
  const common = {
    canonical, qualityStatus: state.confidenceOrEvidenceQuality,
    evidenceStrength: strengthFor(state), limitations: state.warnings,
    createdAt: state.generatedAt, effectiveAt: state.effectiveAt,
    forecastAuthorized: false,
  } as const;
  const claims: EvidenceClaim[] = [];
  if (state.confidenceOrEvidenceQuality === "UNAVAILABLE") return createEvidencePacket(canonical, claims, state.generatedAt);
  for (const engine of state.engines) {
    if (engine.value === null || !Number.isFinite(engine.value) || engine.qualityStatus === "UNAVAILABLE") continue;
    // References name the immutable manifest's source-input snapshot, not invented
    // raw measurements. An engine without provider inputs is a versioned model baseline.
    const inputIds = engine.sourceInputIds.length ? engine.sourceInputIds : ["model-baseline"];
    claims.push({ ...common,
      claimId: `${state.stateId}:derived:engine:${engine.engineId}`, evidenceClass: "DERIVED",
      statement: `${engine.engineName} model score is ${engine.value}.`, value: engine.value,
      unit: engine.unit, sourceIds: engine.sourceInputIds, sourceType: "ENGINE",
      sourceTimestamp: engine.calculatedAt ?? state.effectiveAt,
      derivedFromClaimIds: inputIds.map(id => `${state.inputSnapshotId}:input:${id}`),
      methodologyId: `canonical-engine:${engine.engineId}`,
      methodologyVersion: engine.calculationVersion ?? state.scoringVersion,
      modelId: "canonical-engine", modelVersion: engine.modelVersion,
      qualityStatus: engine.qualityStatus,
      limitations: engine.sourceInputIds.length ? state.warnings : [...state.warnings, "Versioned model baseline; not a provider observation."],
    });
  }
  const engineDependencies = claims.map(claim => claim.claimId);
  const dependencies = engineDependencies.length ? engineDependencies : [`${state.inputSnapshotId}:manifest-inputs`];
  if (state.pressureIndex !== null && Number.isFinite(state.pressureIndex)) {
    claims.push({ ...common, claimId: `${state.stateId}:derived:pressure-index`, evidenceClass: "DERIVED",
      statement: `Canonical Pressure Index is ${state.pressureIndex}.`, value: state.pressureIndex,
      unit: "score_0_to_100", sourceIds: [state.stateId], sourceType: "MANIFEST",
      derivedFromClaimIds: dependencies, methodologyId: "canonical-pressure-index",
      methodologyVersion: state.scoringVersion, modelId: "canonical-state", modelVersion: state.modelVersion });
  }
  if (state.regime) {
    claims.push({ ...common, claimId: `${state.stateId}:derived:regime`, evidenceClass: "DERIVED",
      statement: `Canonical regime classification is ${state.regime}.`, value: state.regime,
      unit: "regime", sourceIds: [state.stateId], sourceType: "MANIFEST",
      derivedFromClaimIds: [claims.find(claim => claim.claimId.endsWith(":derived:pressure-index"))?.claimId ?? dependencies[0]],
      methodologyId: "canonical-regime-classification", methodologyVersion: state.scoringVersion,
      modelId: "canonical-state", modelVersion: state.modelVersion });
  }
  for (const [label, value] of Object.entries(state.scenarioOutputs)) {
    if (typeof value !== "number" || !Number.isFinite(value)) continue;
    claims.push({ ...common, claimId: `${state.stateId}:derived:scenario:${label}`, evidenceClass: "DERIVED",
      statement: `Scenario component ${label} is ${value}.`, value, unit: "scenario_score",
      derivedFromClaimIds: dependencies, methodologyId: "canonical-scenario-output", methodologyVersion: state.scoringVersion,
      modelId: "canonical-state", modelVersion: state.modelVersion,
      limitations: [...state.warnings, "Scenario arithmetic is not a calibrated forecast probability."], probabilityType: "SCENARIO_SCORE" });
  }
  return createEvidencePacket(canonical, claims, state.generatedAt);
}
