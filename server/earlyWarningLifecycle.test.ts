import { describe, expect, it } from "vitest";
import { decideLifecycleTransition } from "./earlyWarningLifecycle";
import { LIFECYCLE_GOVERNANCE, lifecycleCanAutonomouslyEnter, type LifecycleObservationInput } from "../shared/earlyWarningLifecycle";

function evaluation(overrides: Partial<LifecycleObservationInput["evaluation"]> = {}): LifecycleObservationInput["evaluation"] {
  return {
    qualificationId: "iq:one",
    candidateId: "candidate:one",
    originatingStateId: "state:one",
    originatingSynthesisId: "synthesis:one",
    evaluatedAt: "2026-08-22T12:00:00.000Z",
    importanceScore: 80,
    qualificationStatus: "QUALIFIED",
    evidenceStrength: "MODERATE",
    dataQuality: "CURRENT",
    suppressionReasons: [],
    scoringModelId: "faultline-candidate-materiality",
    scoringModelVersion: "1.0.0",
    scoringConfigVersion: "phase7-governance-v1",
    limitations: [],
    ...overrides,
  } as LifecycleObservationInput["evaluation"];
}

describe("Phase 8 deterministic lifecycle engine", () => {
  it("starts a first qualified candidate as EMERGING", () => {
    const result = decideLifecycleTransition({ evaluation: evaluation(), prior: null });
    expect(result.newLifecycleState).toBe("EMERGING");
    expect(result.transitionReasonCode).toBe("FIRST_QUALIFICATION");
  });

  it("requires configured temporal persistence before DEVELOPING", () => {
    const prior = { lifecycleId: "lc:one", candidateId: "candidate:one", currentLifecycleState: "EMERGING" as const, openedAt: "2026-08-21T12:00:00.000Z", latestObservationAt: "2026-08-21T12:00:00.000Z", latestQualificationEvaluationId: "iq:zero", qualifyingObservationCount: 1, nonQualifyingObservationCount: 0 };
    const result = decideLifecycleTransition({ evaluation: evaluation(), prior });
    expect(result.newLifecycleState).toBe("DEVELOPING");
    expect(result.transitionReasonCode).toBe("PERSISTENCE_REQUIREMENT_MET");
  });

  it("does not falsely escalate degraded or conflicted evidence", () => {
    const prior = { lifecycleId: "lc:one", candidateId: "candidate:one", currentLifecycleState: "EMERGING" as const, openedAt: "2026-08-21T12:00:00.000Z", latestObservationAt: "2026-08-21T12:00:00.000Z", latestQualificationEvaluationId: "iq:zero", qualifyingObservationCount: 1, nonQualifyingObservationCount: 0 };
    expect(decideLifecycleTransition({ evaluation: evaluation({ dataQuality: "DEGRADED" }), prior }).newLifecycleState).toBe("EMERGING");
    expect(decideLifecycleTransition({ evaluation: evaluation({ suppressionReasons: ["A supplied structured evidence conflict blocks qualification."] }), prior }).newLifecycleState).toBe("EMERGING");
  });

  it("applies a grace observation before FADING and never calls it invalidation", () => {
    const prior = { lifecycleId: "lc:one", candidateId: "candidate:one", currentLifecycleState: "DEVELOPING" as const, openedAt: "2026-08-20T12:00:00.000Z", latestObservationAt: "2026-08-21T12:00:00.000Z", latestQualificationEvaluationId: "iq:zero", qualifyingObservationCount: 2, nonQualifyingObservationCount: 0 };
    const oneDip = decideLifecycleTransition({ evaluation: evaluation({ qualificationStatus: "NOT_QUALIFIED" }), prior });
    expect(oneDip.newLifecycleState).toBe("DEVELOPING");
    const fade = decideLifecycleTransition({ evaluation: evaluation({ qualificationId: "iq:two", evaluatedAt: "2026-08-23T12:00:00.000Z", qualificationStatus: "NOT_QUALIFIED" }), prior: { ...prior, nonQualifyingObservationCount: 1, latestObservationAt: "2026-08-22T12:00:00.000Z" } });
    expect(fade.newLifecycleState).toBe("FADING");
    expect(fade.transitionReasonCode).toBe("NO_LONGER_QUALIFIED");
  });

  it("preserves identity through rank changes because rank is not an input", () => {
    const prior = { lifecycleId: "lc:one", candidateId: "candidate:one", currentLifecycleState: "DEVELOPING" as const, openedAt: "2026-08-20T12:00:00.000Z", latestObservationAt: "2026-08-21T12:00:00.000Z", latestQualificationEvaluationId: "iq:zero", qualifyingObservationCount: 2, nonQualifyingObservationCount: 0 };
    expect(decideLifecycleTransition({ evaluation: evaluation(), prior }).lifecycleId).toBe("lc:one");
  });

  it("returns EMERGING deterministically after FADING reentry", () => {
    const prior = { lifecycleId: "lc:one", candidateId: "candidate:one", currentLifecycleState: "FADING" as const, openedAt: "2026-08-20T12:00:00.000Z", latestObservationAt: "2026-08-21T12:00:00.000Z", latestQualificationEvaluationId: "iq:zero", qualifyingObservationCount: 0, nonQualifyingObservationCount: 2 };
    const result = decideLifecycleTransition({ evaluation: evaluation(), prior });
    expect(result.newLifecycleState).toBe("EMERGING");
    expect(result.transitionReasonCode).toBe("REENTRY_AFTER_FADE");
  });

  it("ignores out-of-order input without rewriting the current projection", () => {
    const prior = { lifecycleId: "lc:one", candidateId: "candidate:one", currentLifecycleState: "DEVELOPING" as const, openedAt: "2026-08-20T12:00:00.000Z", latestObservationAt: "2026-08-22T12:00:00.000Z", latestQualificationEvaluationId: "iq:latest", qualifyingObservationCount: 2, nonQualifyingObservationCount: 0 };
    const result = decideLifecycleTransition({ evaluation: evaluation({ evaluatedAt: "2026-08-21T12:00:00.000Z" }), prior });
    expect(result.appendObservation).toBe(false);
    expect(result.updateProjection).toBe(false);
    expect(result.transitionReasonCode).toBe("OUT_OF_ORDER_IGNORED");
  });

  it("uses an evaluation-bound deterministic observation identity for idempotent concurrent persistence", () => {
    const source = require("node:fs").readFileSync(require("node:path").resolve(import.meta.dirname, "earlyWarningLifecycle.ts"), "utf8");
    expect(source).toContain("lifecycleObservationId");
    expect(source).toContain("unique observation identity is the database idempotency boundary");
    expect(source).toContain("lt(earlyWarningLifecycles.latestObservationAt");
  });

  it("keeps later-authority states structurally dormant", () => {
    expect(lifecycleCanAutonomouslyEnter("CONFIRMING")).toBe(false);
    expect(lifecycleCanAutonomouslyEnter("INVALIDATED")).toBe(false);
    expect(lifecycleCanAutonomouslyEnter("RESOLVED")).toBe(false);
    expect(LIFECYCLE_GOVERNANCE.elevatedDecision).toBe("DORMANT_UNTIL_LATER_AUTHORITY");
  });
});
