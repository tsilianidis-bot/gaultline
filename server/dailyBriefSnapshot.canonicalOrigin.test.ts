import { describe, expect, it } from "vitest";
import {
  buildDailyBriefPromptContext,
  buildDailyBriefSnapshot,
} from "./dailyBriefSnapshot";
import type { PublicCanonicalIntelligenceState } from "../shared/canonicalIntelligenceState";

const canonicalState: PublicCanonicalIntelligenceState = {
  schemaVersion: "phase2-canonical-state-v1",
  stateId: "phase2-state-2026-08-22T12:00:00.000Z",
  generatedAt: "2026-08-22T12:00:00.000Z",
  effectiveAt: "2026-08-22T12:00:00.000Z",
  calculationStartedAt: null,
  calculationCompletedAt: null,
  championVersion: "champion-v1",
  modelVersion: "phase2-model-v1",
  scoringVersion: "score-v1",
  configurationVersion: "config-v1",
  inputSnapshotId: "inputs-2026-08-22",
  stateHash: "hash-1",
  regime: "Minimal Pressure",
  pressureIndex: 20,
  pressureLevel: "Minimal Pressure",
  pressureDirection: "Stable",
  pressureAcceleration: null,
  pressurePersistence: null,
  engines: [],
  scenarioOutputs: {},
  probabilityClaimIds: [],
  analogClaimIds: [],
  historicalContext: {
    canonicalLiveHistory: "operational-only",
    reconstructedResearch: "research-only",
    historicalAnalogOutput: "governed-only",
    patternResolution: "append-only",
  },
  dataQualitySummary: {
    status: "HEALTHY",
    staleInputCount: 0,
    delayedInputCount: 0,
    unavailableInputCount: 0,
    fallbackInputCount: 0,
  },
  confidenceOrEvidenceQuality: "HEALTHY",
  staleInputs: [],
  delayedInputs: [],
  unavailableInputs: [],
  fallbackInputs: [],
  warnings: [],
  conflicts: [],
  historicalDatasetVersion: "history-v1",
  researchDatasetVersion: "research-v1",
  provenance: {
    manifestSource: "intelligenceStateManifests",
    governanceVersion: "config-v1",
    coherenceStatus: "COHERENT",
  },
};

describe("Daily Brief canonical origin", () => {
  it("retains the exact publication-time canonical origin only when immutable snapshot metrics match", () => {
    const snapshot = buildDailyBriefSnapshot({
      pressure: { overallPressure: 20, regime: "Minimal Pressure", level: "Minimal Pressure" } as never,
      seismograph: null,
      canonicalState,
      now: Date.parse("2026-08-22T12:05:00.000Z"),
    });

    expect(snapshot.canonicalOrigin).toMatchObject({
      status: "linked",
      originatingStateId: canonicalState.stateId,
      originatingEffectiveAt: canonicalState.effectiveAt,
      originatingGeneratedAt: canonicalState.generatedAt,
      originatingModelVersion: canonicalState.modelVersion,
      originatingConfigurationVersion: canonicalState.configurationVersion,
      originatingInputSnapshotId: canonicalState.inputSnapshotId,
    });
  });

  it("withholds rather than fabricates a canonical origin when the immutable brief snapshot differs", () => {
    const snapshot = buildDailyBriefSnapshot({
      pressure: { overallPressure: 21, regime: "Minimal Pressure", level: "Minimal Pressure" } as never,
      seismograph: null,
      canonicalState,
      now: Date.parse("2026-08-22T12:05:00.000Z"),
    });

    expect(snapshot.canonicalOrigin).toEqual({
      status: "unavailable",
      reason: "canonical-state-did-not-match-immutable-brief-snapshot",
      originatingStateId: null,
      originatingEffectiveAt: null,
      originatingGeneratedAt: null,
      originatingModelVersion: null,
      originatingConfigurationVersion: null,
      originatingInputSnapshotId: null,
    });
  });

  it("labels an origin-unavailable brief as an archived generated snapshot rather than current state", () => {
    const snapshot = buildDailyBriefSnapshot({
      pressure: { overallPressure: 20, regime: "Minimal Pressure", level: "Minimal Pressure" } as never,
      seismograph: null,
      canonicalState: null,
      now: Date.parse("2026-08-22T12:05:00.000Z"),
    });

    expect(buildDailyBriefPromptContext(snapshot)).toContain("this is an archived generated snapshot, not a current market-state claim");
  });
});
