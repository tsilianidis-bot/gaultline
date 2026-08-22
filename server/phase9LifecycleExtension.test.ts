import { describe, expect, it } from "vitest";
import { decidePhase9LifecycleAuthorityTransition } from "../shared/earlyWarningLifecycle";

describe("Phase 9 authority extension of the Phase 8 lifecycle", () => {
  it("permits only a typed confirmation event from DEVELOPING to enter CONFIRMING", () => {
    const decision = decidePhase9LifecycleAuthorityTransition({ lifecycleId: "lc:1", currentLifecycleState: "DEVELOPING", authorityEventId: "ev:1", authorityEventType: "CONFIRMATION_AUTHORIZED" });
    expect(decision.newLifecycleState).toBe("CONFIRMING");
    expect(decision.transitionReasonCode).toBe("PHASE9_CONFIRMATION_AUTHORIZED");
  });
  it("does not let EMERGING enter CONFIRMING even when a confirmation condition is met", () => {
    const decision = decidePhase9LifecycleAuthorityTransition({ lifecycleId: "lc:1", currentLifecycleState: "EMERGING", authorityEventId: "ev:1", authorityEventType: "CONFIRMATION_AUTHORIZED" });
    expect(decision.appendObservation).toBe(false);
    expect(decision.newLifecycleState).toBe("EMERGING");
  });
  it("permits typed invalidation from developing, fading, or confirming only", () => {
    for (const state of ["DEVELOPING", "FADING", "CONFIRMING"] as const) {
      const decision = decidePhase9LifecycleAuthorityTransition({ lifecycleId: "lc:1", currentLifecycleState: state, authorityEventId: `ev:${state}`, authorityEventType: "INVALIDATION_AUTHORIZED" });
      expect(decision.newLifecycleState).toBe("INVALIDATED");
      expect(decision.appendObservation).toBe(true);
    }
  });
  it("keeps INVALIDATED terminal and does not permit ordinary or duplicate event reactivation", () => {
    const decision = decidePhase9LifecycleAuthorityTransition({ lifecycleId: "lc:1", currentLifecycleState: "INVALIDATED", authorityEventId: "ev:2", authorityEventType: "CONFIRMATION_AUTHORIZED" });
    expect(decision.appendObservation).toBe(false);
    expect(decision.newLifecycleState).toBe("INVALIDATED");
  });
  it("keeps ELEVATED and RESOLVED dormant", () => {
    for (const state of ["ELEVATED", "RESOLVED"] as const) {
      const decision = decidePhase9LifecycleAuthorityTransition({ lifecycleId: "lc:1", currentLifecycleState: state, authorityEventId: `ev:${state}`, authorityEventType: "CONFIRMATION_AUTHORIZED" });
      expect(decision.appendObservation).toBe(false);
      expect(decision.newLifecycleState).toBe(state);
    }
  });
});
