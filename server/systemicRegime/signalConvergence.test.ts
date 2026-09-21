import { describe, expect, it } from "vitest";
import { computeSignalConvergence, type ConvergenceInputs } from "./signalConvergence";
import { EMPTY_SYSTEMIC_REGIME_READING } from "../../shared/systemicRegime";
import { buildSystemicRegimePromptContract } from "./platoRead";

function inputs(overrides: Partial<ConvergenceInputs> = {}): ConvergenceInputs {
  return {
    canonical: {
      pressureIndex: 28,
      regime: "MODERATE RISK",
      pressureDirection: "Stable",
    } as ConvergenceInputs["canonical"],
    seismograph: {
      evidenceConsensus: "weak",
      direction: "Stable",
      probabilities: { bull: 45, bear: 20, neutral: 35, confidence: 50, primaryDriver: "mixed" },
    } as ConvergenceInputs["seismograph"],
    synthesis: {
      summary: { overallSynthesis: "MIXED" },
      engineObservations: [
        { direction: "STABLE" },
        { direction: "IMPROVING" },
      ],
      divergences: [],
      deterioratingDomains: [],
    } as unknown as ConvergenceInputs["synthesis"],
    earlyWarning: { kind: "NO_MATERIAL_EARLY_WARNING" } as ConvergenceInputs["earlyWarning"],
    systemicRegime: { ...EMPTY_SYSTEMIC_REGIME_READING, currentRegime: "NORMAL", freshnessStatus: "CURRENT", dataAsOf: "2026-09-18" },
    ...overrides,
  };
}

describe("Signal Convergence N of M", () => {
  it("stays LOW when a single independent engine is deteriorating", () => {
    const snapshot = computeSignalConvergence(inputs({
      systemicRegime: { ...EMPTY_SYSTEMIC_REGIME_READING, currentRegime: "CRISIS", freshnessStatus: "CURRENT", dataAsOf: "2026-09-18" },
    }));
    expect(snapshot.level).toBe("LOW");
    expect(snapshot.deterioratingCount).toBe(1);
    expect(snapshot.contributesToPressureIndex).toBe(false);
    expect(snapshot.summary).toContain("1 of");
    expect(snapshot.summary).toContain("Not a score average");
  });

  it("is MEDIUM at two deteriorating votes and HIGH at three", () => {
    const medium = computeSignalConvergence(inputs({
      canonical: { pressureIndex: 70, regime: "HIGH STRESS", pressureDirection: "Deteriorating" } as ConvergenceInputs["canonical"],
      systemicRegime: { ...EMPTY_SYSTEMIC_REGIME_READING, currentRegime: "STRESS BUILDING", freshnessStatus: "CURRENT", dataAsOf: "2026-09-18" },
    }));
    expect(medium.level).toBe("MEDIUM");
    const high = computeSignalConvergence(inputs({
      canonical: { pressureIndex: 80, regime: "SYSTEMIC CRISIS", pressureDirection: "Deteriorating" } as ConvergenceInputs["canonical"],
      seismograph: { evidenceConsensus: "divergent", direction: "Deteriorating", probabilities: { bull: 10, bear: 70, neutral: 20, confidence: 40, primaryDriver: "credit" } } as ConvergenceInputs["seismograph"],
      systemicRegime: { ...EMPTY_SYSTEMIC_REGIME_READING, currentRegime: "CRISIS", freshnessStatus: "CURRENT", dataAsOf: "2026-09-18" },
    }));
    expect(high.level).toBe("HIGH");
    expect(high.deterioratingCount).toBeGreaterThanOrEqual(3);
  });

  it("does not treat missing engines as safe", () => {
    const snapshot = computeSignalConvergence({
      canonical: null,
      seismograph: null,
      synthesis: null,
      earlyWarning: null,
      systemicRegime: null,
    });
    expect(snapshot.level).toBe("UNAVAILABLE");
    expect(snapshot.availableCount).toBe(0);
  });
});

describe("PLATO thin read", () => {
  it("withholds invented regime when inference is missing", () => {
    const contract = buildSystemicRegimePromptContract(null, null);
    expect(contract).toContain("No persisted inference is available");
    expect(contract).toContain("Do not invent a systemic regime");
    expect(contract).toContain("Do not imply that the absence of a reading means markets are safe");
  });
});
