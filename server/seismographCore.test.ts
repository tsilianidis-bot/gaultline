import { describe, expect, it } from "vitest";
import {
  buildAlertEvaluationContext,
  buildMacroContextBlock,
  computeEvidenceConsensus,
  deriveProviderProvenance,
  groupIntoFamilies,
  synthesizePressureScore,
  type EvidencePacket,
} from "./seismographCore";

function packet(overrides: Partial<EvidencePacket> = {}): EvidencePacket {
  return {
    source: "test-engine",
    timestamp: 1_700_000_000_000,
    evidenceType: "macro_pressure",
    signal: "neutral",
    strength: 50,
    confidence: 80,
    primaryReading: "Test reading",
    humanReadable: "Test evidence.",
    ...overrides,
  };
}

describe("deriveProviderProvenance", () => {
  it("reports live pressure-engine provenance", () => {
    expect(deriveProviderProvenance([
      packet({ source: "pressure-engine", metadata: { dataSource: "live" } }),
    ])).toEqual({
      fred: {
        status: "live",
        detail: "FRED macro and credit observations (latest published releases) contributed through the pressure engine.",
        asOf: 1_700_000_000_000,
      },
    });
  });

  it("preserves an explicit fallback reason", () => {
    expect(deriveProviderProvenance([
      packet({
        source: "pressure-engine",
        metadata: { dataSource: "fallback", fallbackReason: "Provider maintenance" },
      }),
    ])).toMatchObject({ fred: { status: "fallback", detail: "Provider maintenance" } });
  });

  it("reports unavailable provenance when pressure evidence is absent", () => {
    expect(deriveProviderProvenance([], 123)).toMatchObject({
      fred: { status: "unavailable", asOf: 123 },
    });
  });
});

describe("Seismograph synthesis", () => {
  it("returns the neutral baseline without evidence", () => {
    expect(synthesizePressureScore([])).toBe(5);
  });

  it("detects strong directional consensus", () => {
    expect(computeEvidenceConsensus([
      packet({ signal: "bullish" }),
      packet({ signal: "recovering", evidenceType: "recovery_confirmation" }),
      packet({ signal: "bullish", evidenceType: "momentum" }),
    ])).toBe("strong");
  });

  it("groups packets into stable display families", () => {
    expect(groupIntoFamilies([
      packet({ source: "pressure", signal: "stressed", strength: 80 }),
      packet({ source: "credit", evidenceType: "credit_stress", signal: "bearish", strength: 60 }),
    ])).toEqual([
      {
        name: "Macro Pressure",
        signal: "stressed",
        strength: 80,
        contributors: ["pressure"],
        summary: "Test evidence.",
      },
      {
        name: "Credit Stress",
        signal: "bearish",
        strength: 60,
        contributors: ["credit"],
        summary: "Test evidence.",
      },
    ]);
  });

  it("keeps pressure alerts but does not promote uncalibrated transition shares into crisis-risk alerts", () => {
    const context = buildAlertEvaluationContext({
      pressureScore: 75,
      regime: "HIGH STRESS",
      stressLevel: "High",
      direction: "Deteriorating",
      transitionProbabilities: { remainInRegime: 1, transitionToElevated: 1, transitionToLow: 1, transitionToCrisis: 99, primaryDriver: "static default" },
      activePatterns: [],
    } as any);
    expect(context.significantChanges).toContain("High pressure: 75/100");
    expect(context.significantChanges.join(" ")).not.toMatch(/crisis transition risk/i);
  });

  it("does not turn uncalibrated scenario evidence-vote shares into positioning guidance", () => {
    const context = buildMacroContextBlock({
      pressureScore: 60,
      regime: "ELEVATED RISK",
      stressLevel: "Elevated",
      direction: "Deteriorating",
      probabilities: { bull: 0, neutral: 0, bear: 100, primaryDriver: "Macro Pressure", confidence: 99 },
      evidenceFamilies: [],
      topAnalog: null,
      historicalPercentile: null,
      dataFreshness: "live",
    } as any);
    expect(context.regimeImplication).toMatch(/uncalibrated/i);
    expect(context.regimeImplication).not.toMatch(/positioning is favored|tailwinds|selective positioning/i);
  });
});
