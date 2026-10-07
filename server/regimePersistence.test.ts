import { describe, expect, it } from "vitest";
import { computeRegimePersistence } from "./regimePersistence";

const r = (pressureScore: number, regime: string) => ({ pressureScore, regime });

describe("computeRegimePersistence", () => {
  it("treats a single reading as a snapshot only", () => {
    const state = computeRegimePersistence([r(33, "MODERATE RISK")]);
    expect(state.label).toBe("SNAPSHOT");
    expect(state.confirmedRegime).toBeNull();
    expect(state.consecutiveReadings).toBe(1);
  });

  it("promotes 5 consecutive readings to confirmed", () => {
    const state = computeRegimePersistence([
      r(33, "MODERATE RISK"),
      r(32, "MODERATE RISK"),
      r(31, "MODERATE RISK"),
      r(30, "MODERATE RISK"),
      r(29, "MODERATE RISK"),
    ]);
    expect(state.label).toBe("CONFIRMED");
    expect(state.matchingReadingsInLast5).toBe(5);
    expect(state.confirmedRegime).toBe("MODERATE RISK");
  });

  it("labels 10 readings as established and 20 as structural", () => {
    const established = computeRegimePersistence(
      Array.from({ length: 10 }, (_, i) => r(30 + i, "MODERATE RISK"))
    );
    const structural = computeRegimePersistence(
      Array.from({ length: 20 }, (_, i) => r(30 + (i % 3), "MODERATE RISK"))
    );
    expect(established.label).toBe("ESTABLISHED");
    expect(structural.label).toBe("STRUCTURAL");
  });

  it("does not confirm a noisy threshold flip", () => {
    const state = computeRegimePersistence(
      [
        r(46, "ELEVATED RISK"),
        r(44, "MODERATE RISK"),
        r(47, "ELEVATED RISK"),
        r(43, "MODERATE RISK"),
        r(46, "ELEVATED RISK"),
      ],
      "MODERATE RISK"
    );
    expect(state.confirmedRegime).toBe("MODERATE RISK");
    expect(state.hysteresisActive).toBe(true);
  });

  it("requires a lower-risk transition to clear the hysteresis buffer", () => {
    const notCleared = computeRegimePersistence(
      [
        r(43, "MODERATE RISK"),
        r(43, "MODERATE RISK"),
        r(43, "MODERATE RISK"),
        r(43, "MODERATE RISK"),
        r(43, "MODERATE RISK"),
      ],
      "ELEVATED RISK"
    );
    const cleared = computeRegimePersistence(
      [
        r(41, "MODERATE RISK"),
        r(41, "MODERATE RISK"),
        r(40, "MODERATE RISK"),
        r(40, "MODERATE RISK"),
        r(39, "MODERATE RISK"),
      ],
      "ELEVATED RISK"
    );

    expect(notCleared.confirmedRegime).toBe("ELEVATED RISK");
    expect(notCleared.hysteresisActive).toBe(true);
    expect(cleared.confirmedRegime).toBe("MODERATE RISK");
    expect(cleared.hysteresisActive).toBe(false);
  });
});
