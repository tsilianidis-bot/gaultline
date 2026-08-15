import { describe, expect, it } from "vitest";
import { buildDailyBriefSnapshot, validateDailyBriefNarrative } from "./dailyBriefSnapshot";

const pressure = { overallPressure: 29, regime: "MODERATE RISK", level: "Elevated" } as any;
const seismograph = {
  computedAt: Date.UTC(2026, 7, 13, 18, 0, 0), pressureScore: 19.8, regime: "LOW PRESSURE", stressLevel: "Low", direction: "Improving",
  probabilities: { bull: 45, neutral: 35, bear: 20, confidence: 80 }, marketMemory: { streakDays: 3, streakDirection: "improving" }, evidenceConsensus: "moderate",
  transitionProbabilities: { remainInRegime: 70, transitionToCrisis: 5 }, topAnalog: { label: "Fed Pivot Rally", similarity: 91 }, providerProvenance: {},
} as any;

describe("Daily Brief snapshot contract", () => {
  it("uses one canonical source rather than mixing a later pressure-engine value into the brief", () => {
    const snapshot = buildDailyBriefSnapshot({ pressure, seismograph, now: Date.UTC(2026, 7, 13, 19, 0, 0) });
    expect(snapshot.canonicalSource).toBe("seismograph");
    expect(snapshot.pressureIndex).toBe(19.8);
    expect(snapshot.proprietaryOutputs.join(" ")).not.toContain("29/100");
  });

  it("blocks a publication when mutually exclusive regime probabilities do not total 100", () => {
    const broken = { ...seismograph, probabilities: { bull: 70, neutral: 0, bear: 5, confidence: 80 } };
    const snapshot = buildDailyBriefSnapshot({ pressure, seismograph: broken, now: Date.UTC(2026, 7, 13, 19, 0, 0) });
    expect(snapshot.validation.passed).toBe(false);
    expect(snapshot.validation.errors).toContain("probability-distribution-does-not-total-100");
  });

  it("does not manufacture unavailable historical or transition inputs when only the pressure engine responds", () => {
    const snapshot = buildDailyBriefSnapshot({ pressure, seismograph: null, now: Date.UTC(2026, 7, 13, 19, 0, 0) });
    expect(snapshot.historicalAnalog).toBeNull();
    expect(snapshot.probabilities).toBeNull();
    expect(snapshot.unavailableData.join(" ")).toContain("Historical analog");
  });

  it("rejects unsupported statistical and promotional language", () => {
    const result = validateDailyBriefNarrative("This is a statistically significant, near certainty ground-floor entry point.");
    expect(result.passed).toBe(false);
    expect(result.issues.length).toBeGreaterThan(2);
  });
});

