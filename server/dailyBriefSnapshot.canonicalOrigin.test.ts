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

/** Explicit MOCK historical fixture, not live provider proof. */
function assembled(overrides: Record<string, unknown> = {}) {
  return { canonicalStateId: canonicalState.stateId, stateHash: canonicalState.stateHash, inputSnapshotId: canonicalState.inputSnapshotId,
    computedAt: Date.parse(canonicalState.generatedAt), pressureScore: 20, regime: canonicalState.regime, stressLevel: "Minimal Pressure", direction: "Stable",
    probabilities: { bull: 30, neutral: 40, bear: 30, confidence: null }, marketMemory: { streakDays: 0, streakDirection: "unknown" },
    transitionProbabilities: { remainInRegime: null, transitionToCrisis: null }, topAnalog: null, ...overrides } as never;
}
describe("Daily Brief canonical origin", () => {
  it("retains the exact publication-time canonical origin only when immutable snapshot metrics match", () => {
    const snapshot = buildDailyBriefSnapshot({ pressure: null, seismograph: assembled(), canonicalState, now: Date.parse("2026-08-22T12:05:00Z") });
    expect(snapshot.canonicalOrigin).toMatchObject({ status: "linked", originatingStateId: canonicalState.stateId,
      originatingStateHash: canonicalState.stateHash, originatingInputSnapshotId: canonicalState.inputSnapshotId });
    expect(snapshot.validation.passed).toBe(true);
  });
  it("withholds rather than fabricates a canonical origin when the immutable brief snapshot differs", () => {
    for (const mismatch of [{ pressureScore: 21 }, { canonicalStateId: "wrong" }, { stateHash: "wrong" }, { inputSnapshotId: "wrong" }]) {
      const snapshot = buildDailyBriefSnapshot({ pressure: null, seismograph: assembled(mismatch), canonicalState, now: Date.parse("2026-08-22T12:05:00Z") });
      expect(snapshot.canonicalOrigin.status).toBe("unavailable");
      expect(snapshot.canonicalOrigin.originatingStateId).toBeNull();
      expect(snapshot.validation.errors).toContain("canonical-origin-unavailable");
    }
  });
  it("labels an origin-unavailable brief as an archived generated snapshot rather than current state", () => {
    const snapshot = buildDailyBriefSnapshot({ pressure: null, seismograph: assembled(), canonicalState: null, now: Date.parse("2026-08-22T12:05:00Z") });
    expect(snapshot.validation.passed).toBe(false);
    expect(buildDailyBriefPromptContext(snapshot)).toContain("this is an archived generated snapshot, not a current market-state claim");
  });
  it("does not equate unrelated equal scores with provenance or manufacture a direct source time", () => {
    const snapshot = buildDailyBriefSnapshot({ pressure: { overallPressure: 20, regime: canonicalState.regime } as never, seismograph: null, canonicalState, now: Date.parse("2026-08-22T12:05:00Z") });
    expect(snapshot.canonicalOrigin.status).toBe("unavailable"); expect(snapshot.validation.passed).toBe(false);
    expect(snapshot.sourceInputs[0].asOf).toBeNull();
  });
});
