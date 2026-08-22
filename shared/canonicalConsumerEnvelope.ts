import type { PublicCanonicalIntelligenceState } from './canonicalIntelligenceState';

/**
 * The required provenance boundary for any payload representing current market
 * intelligence. Compatibility data may retain existing UI field names, but all
 * current-state truth is anchored to the supplied canonical state.
 */
export interface CanonicalConsumerEnvelope<TCompatibility> {
  contractVersion: 'phase2-canonical-consumer-envelope-v1';
  stateId: string;
  effectiveAt: string | null;
  generatedAt: string | null;
  qualityStatus: string | null;
  coherenceStatus: string | null;
  conflicts: unknown[];
  probabilityClaimIds: string[];
  analogClaimIds: string[];
  championVersion: string | null;
  modelVersion: string | null;
  scoringVersion: string | null;
  configurationVersion: string | null;
  inputSnapshotId: string | null;
  stateHash: string | null;
  compatibilityData: TCompatibility;
}

export function createCanonicalConsumerEnvelope<TCompatibility>(
  state: PublicCanonicalIntelligenceState,
  compatibilityData: TCompatibility,
): CanonicalConsumerEnvelope<TCompatibility> {
  return {
    contractVersion: 'phase2-canonical-consumer-envelope-v1',
    stateId: state.stateId,
    effectiveAt: state.effectiveAt ?? null,
    generatedAt: state.generatedAt ?? null,
    qualityStatus: state.qualityStatus ?? null,
    coherenceStatus: state.coherenceStatus ?? null,
    conflicts: state.conflicts ?? [],
    probabilityClaimIds: state.probabilityClaimIds ?? [],
    analogClaimIds: state.analogClaimIds ?? [],
    championVersion: state.championVersion ?? null,
    modelVersion: state.modelVersion ?? null,
    scoringVersion: state.scoringVersion ?? null,
    configurationVersion: state.configurationVersion ?? null,
    inputSnapshotId: state.inputSnapshotId ?? null,
    stateHash: state.stateHash ?? null,
    compatibilityData,
  };
}
