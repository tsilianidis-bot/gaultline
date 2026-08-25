import { describe, expect, it } from "vitest";
import { buildStateForAssembly } from "./scheduledSeismograph";
import { assembleSeismographOutput } from "./seismographCore";

describe("scheduled Seismograph canonical Champion alignment", () => {
  it("does not replace the frozen Champion score or regime with a divergent FMOS value", () => {
    const pressure = {
      overallPressure: 29,
      regime: "MODERATE RISK",
      level: "Moderate",
      vectors: [],
    } as any;
    const fmos = {
      pressure: { overallPressure: 19.2 },
      regime: { currentRegime: "LOW RISK", description: "divergent derived regime" },
      analogs: [],
    } as any;

    const state = buildStateForAssembly(pressure, fmos, null);

    expect(state.pressureScore).toBe(29);
    expect(state.regime).toBe("MODERATE RISK");
  });

  it("does not blend evidence-packet pressure into a second canonical Pressure Index", () => {
    const output = assembleSeismographOutput({
      pressureScore: 29,
      regime: "MODERATE RISK",
      stressLevel: "Moderate",
      direction: "Stable",
      historicalPercentile: 50,
      analogMatches: [],
      activePatterns: [],
      transitionProbabilities: { remainInRegime: 70, transitionToElevated: 15, transitionToLow: 10, transitionToCrisis: 5, primaryDriver: "test" },
      marketMemory: { streakDays: 0, streakDirection: "stable", peakPressureThisCycle: 29, troughPressureThisCycle: 29, daysSinceLastTransition: 0, keyMemoryPoints: [] },
    }, [{ source: "derived-engine", evidenceType: "macro_pressure", signal: "bullish", strength: 100, confidence: 100, humanReadable: "derived" } as any]);

    expect(output.pressureScore).toBe(29);
    expect(output.forDashboard.pressureScore).toBe(29);
    expect(output.stressLevel).toBe("Moderate");
  });
});
