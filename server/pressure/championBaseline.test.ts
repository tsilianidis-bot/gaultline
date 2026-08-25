import { describe, expect, it } from "vitest";
import {
  CHAMPION_BASELINE_VERSION,
  CHAMPION_VECTOR_WEIGHTS,
  classifyChampionScore,
  recreateChampionFromStoredVectors,
  summarizeChampionRecreation,
} from "./championBaseline";

const completeRecord = {
  month: "2020-03",
  overallPressure: 43,
  regime: "MODERATE RISK",
  liquidityStress: 20,
  creditContagion: 30,
  volatilityRegime: 40,
  macroSensitivity: 50,
  marketBreadth: 60,
  aiBubble: 70,
  hySpreadProxy: 300,
  tsy10y: 1.2,
  tsy2y: 0.8,
  fedfunds: 1.0,
  cpiYoy: 2.3,
  unemployment: 4.4,
};

describe("Champion Baseline audit harness", () => {
  it("records the observed production weights without changing production scoring", () => {
    expect(CHAMPION_BASELINE_VERSION).toBe("v1-observed-2026-08-18");
    expect(Object.values(CHAMPION_VECTOR_WEIGHTS).reduce((total, value) => total + value, 0)).toBe(1);
  });

  it("exactly reconciles the stored weighted composite when all six stored vectors exist", () => {
    const result = recreateChampionFromStoredVectors(completeRecord);
    expect(result.recreatedScore).toBe(43);
    expect(result.scoreDifference).toBe(0);
    expect(result.vectorComplete).toBe(true);
    expect(result.verdict).toBe("RAW_RECREATION_NOT_DEFENSIBLE");
  });

  it("refuses a false reconstruction when a stored vector is absent", () => {
    const result = recreateChampionFromStoredVectors({ ...completeRecord, aiBubble: null });
    expect(result.recreatedScore).toBeNull();
    expect(result.verdict).toBe("VECTOR_GAP");
    expect(result.missingVectorFields).toContain("aiBubble");
  });

  it("does not claim raw point-in-time recreation without SOFR, PPI, and source vintages", () => {
    const result = recreateChampionFromStoredVectors(completeRecord);
    expect(result.rawInputRecreationEligible).toBe(false);
    expect(result.missingRawInputs).toEqual(expect.arrayContaining(["sofr", "ppiYoy", "sourceVintages"]));
  });

  it("reports aggregate reconciliation gaps without hiding incomplete records", () => {
    const summary = summarizeChampionRecreation([completeRecord, { ...completeRecord, month: "2020-04", aiBubble: null }]);
    expect(summary.recordCount).toBe(2);
    expect(summary.exactCompositeReconciliations).toBe(1);
    expect(summary.vectorGapCount).toBe(1);
  });

  it("uses the observed Champion regime boundaries", () => {
    expect(classifyChampionScore(80).regime).toBe("SYSTEMIC CRISIS");
    expect(classifyChampionScore(65).regime).toBe("HIGH STRESS");
    expect(classifyChampionScore(45).regime).toBe("ELEVATED RISK");
    expect(classifyChampionScore(24).regime).toBe("LOW RISK");
  });
});
