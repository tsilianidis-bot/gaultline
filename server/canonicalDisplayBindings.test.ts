/**
 * QA prod consistency check (2026-10-02 2 PM snapshot,
 * state:2026-10-02T18:01:25.427Z:57a5d9b62897f5e6): display/context bindings.
 * Display only — none of these change a calculated value.
 */
import { describe, expect, it } from "vitest";
import { bindEvidenceFamiliesToCanonical } from "./marketStateService";
import { LABOR_RATES_FAMILY_NAME, YIELD_CURVE_FAMILY_NAME } from "./seismographUnified";
import { assembleSeismographOutput } from "./seismographCore";
import {
  applySeismographDisplayContext,
  dataFreshnessFromDataQuality,
  fredProvenanceFromDataQuality,
  type CanonicalDataQualityInput,
} from "./seismographDisplayContext";

// September monthly-row families as served at 2 PM (45/40/35/30/17).
const monthlyFamilies = [
  { name: LABOR_RATES_FAMILY_NAME, signal: "neutral", strength: 45, currentValue: "45/100", historicalContext: "6-month average: 41/100. Labor-and-rates pressure is moderate.", trend: "stable", whyItMatters: "x" },
  { name: YIELD_CURVE_FAMILY_NAME, signal: "neutral", strength: 40, currentValue: "40/100", historicalContext: "6-month average: 40/100.", trend: "stable", whyItMatters: "x" },
  { name: "Macro Sensitivity", signal: "bullish", strength: 35, currentValue: "35/100", historicalContext: "6-month average: 37/100.", trend: "stable", whyItMatters: "x" },
  { name: "Credit Markets", signal: "bullish", strength: 30, currentValue: "30/100", historicalContext: "6-month average: 29/100.", trend: "stable", whyItMatters: "x" },
  { name: "Liquidity Conditions", signal: "recovering", strength: 17, currentValue: "17/100", historicalContext: "6-month average: 20/100.", trend: "stable", whyItMatters: "x" },
  { name: "Treasury Yield Curve", signal: "bullish", strength: 30, currentValue: "10Y: 4.1% | 2Y: 3.6% | Spread: 0.50%", historicalContext: "6-month average spread: 0.45%.", trend: "stable", whyItMatters: "x" },
] as any[];

// Canonical engines at 2 PM.
const canonicalEngines = [
  { engineId: "liquidity-stress", value: 23, direction: "Stable" as const },
  { engineId: "credit-contagion", value: 23, direction: "Stable" as const },
  { engineId: "volatility-regime", value: 40, direction: "Stable" as const },
  { engineId: "macro-sensitivity", value: 44, direction: "Stable" as const },
  { engineId: "market-breadth", value: 29, direction: "Stable" as const },
  { engineId: "ai-bubble", value: 44, direction: "Unknown" as const },
];

describe("A. evidence-family cards bind to canonical engines", () => {
  it("shows 29/40/44/23/23 (canonical), keeping the monthly value and 6-month average as labelled context", () => {
    const bound = bindEvidenceFamiliesToCanonical(monthlyFamilies, canonicalEngines, "2026-10-02T18:01:25.427Z", "2026-09");
    const byName = Object.fromEntries(bound.map(f => [f.name, f]));
    expect(byName[LABOR_RATES_FAMILY_NAME].currentValue).toBe("29/100");
    expect(byName[LABOR_RATES_FAMILY_NAME].strength).toBe(29);
    expect(byName[LABOR_RATES_FAMILY_NAME].signal).toBe("bullish");
    expect(byName[YIELD_CURVE_FAMILY_NAME].currentValue).toBe("40/100");
    expect(byName["Macro Sensitivity"].currentValue).toBe("44/100");
    expect(byName["Macro Sensitivity"].signal).toBe("neutral");
    expect(byName["Credit Markets"].currentValue).toBe("23/100");
    expect(byName["Liquidity Conditions"].currentValue).toBe("23/100");
    expect(byName[LABOR_RATES_FAMILY_NAME].historicalContext).toContain("Current canonical value as of Oct 2, 2:01 PM ET");
    expect(byName[LABOR_RATES_FAMILY_NAME].historicalContext).toContain("monthly record (2026-09): 45/100");
    expect(byName[LABOR_RATES_FAMILY_NAME].historicalContext).toContain("6-month average: 41/100");
    // No canonical engine for the treasury-curve family: monthly value, labelled as such.
    expect(byName["Treasury Yield Curve"].historicalContext).toMatch(/^Monthly record \(2026-09\): 10Y/);
  });

  it("without a canonical state, labels every value as the monthly record (no silent current claim)", () => {
    const bound = bindEvidenceFamiliesToCanonical(monthlyFamilies, null, null, "2026-09");
    expect(bound[0].currentValue).toBe("45/100");
    expect(bound.every(f => f.historicalContext.startsWith("Monthly record (2026-09): "))).toBe(true);
  });
});

const delayedQuality: CanonicalDataQualityInput = {
  generatedAt: "2026-10-02T18:01:25.427Z",
  confidenceOrEvidenceQuality: "PARTIAL",
  delayedInputs: ["ten_year_treasury_yield", "consumer_price_index_yoy", "producer_price_index_yoy", "federal_funds_rate", "unemployment_rate"],
  staleInputs: [],
  unavailableInputs: [],
  fallbackInputs: [],
  engineInputIds: ["hy_credit_spread", "secured_overnight_financing_rate", "ten_year_treasury_yield", "unemployment_rate", "two_year_treasury_yield", "consumer_price_index_yoy", "producer_price_index_yoy", "federal_funds_rate", "ai_concentration_static_baseline"],
};

function assembled() {
  return assembleSeismographOutput({
    pressureScore: 34,
    regime: "MODERATE RISK",
    stressLevel: "Moderate",
    direction: "Stable",
    historicalPercentile: 83,
    analogMatches: [{ label: "Fed Pivot Rally", period: "2019", similarity: 91, description: "d", outcome: "o" } as any],
    activePatterns: [],
    transitionProbabilities: { remainInRegime: 70, transitionToElevated: 15, transitionToLow: 10, transitionToCrisis: 5, primaryDriver: "test" },
    marketMemory: { streakDays: 0, streakDirection: "stable", peakPressureThisCycle: 34, troughPressureThisCycle: 34, daysSinceLastTransition: 0, keyMemoryPoints: [] },
  }, [
    { source: "pressure-engine", evidenceType: "macro_pressure", signal: "neutral", strength: 34, confidence: 80, humanReadable: "p", primaryReading: "p", timestamp: 1, metadata: { dataSource: "live" } } as any,
    { source: "a", evidenceType: "credit", signal: "neutral", strength: 30, confidence: 80, humanReadable: "a", primaryReading: "a" } as any,
    { source: "b", evidenceType: "liquidity", signal: "neutral", strength: 30, confidence: 80, humanReadable: "b", primaryReading: "b" } as any,
    { source: "c", evidenceType: "volatility", signal: "neutral", strength: 30, confidence: 80, humanReadable: "c", primaryReading: "c" } as any,
    { source: "d", evidenceType: "breadth", signal: "neutral", strength: 30, confidence: 80, humanReadable: "d", primaryReading: "d" } as any,
  ]);
}

describe("getAssembledOutput display context (seismographCore context blocks)", () => {
  it("context blocks use /100 and the report context states no probability", () => {
    const out = assembled();
    expect(out.forDailyBrief.narrativeContext).toContain("Pressure Score of 34/100");
    expect(out.forReports.narrativeContext).toContain("Pressure 34/100");
    expect(out.forReports.narrativeContext).not.toMatch(/% probability|\/10\b/);
    // 34/100 is not a high-pressure reading (High band starts at 70).
    expect(out.forAlerts.significantChanges.join(" ")).not.toContain("High pressure");
  });

  it("FRED is DELAYED from canonical data quality; freshness is the real data-quality state", () => {
    expect(fredProvenanceFromDataQuality(delayedQuality, 0).status).toBe("delayed");
    expect(fredProvenanceFromDataQuality(null, 0).status).toBe("unavailable");
    const fresh = dataFreshnessFromDataQuality(delayedQuality);
    expect(fresh.freshness).toBe("recent");
    expect(fresh.text).toBe("PARTIAL (5 delayed inputs) · canonical state Oct 2, 2:01 PM ET");
  });

  it("drops the closest analog when the canonical outlook has none, and rebuilds the ASHA block", () => {
    const raw = assembled();
    expect(raw.providerProvenance?.fred.status).toBe("live");
    expect(raw.forASHA.systemPromptBlock).toContain("Fed Pivot Rally");
    const shown = applySeismographDisplayContext(raw, { dataQuality: delayedQuality, canonicalTopAnalogAvailable: false });
    expect(shown.providerProvenance?.fred.status).toBe("delayed");
    expect(shown.topAnalog).toBeNull();
    expect(shown.analogMatches).toEqual([]);
    expect(shown.forDashboard.topAnalog).toBeNull();
    expect(shown.forASHA.systemPromptBlock).toContain("Closest Analog: No close analog");
    expect(shown.forASHA.systemPromptBlock).toContain("Data freshness: PARTIAL (5 delayed inputs)");
    expect(JSON.stringify(shown.forASHA)).not.toContain("Fed Pivot");
    expect(JSON.stringify(shown.forDailyBrief)).not.toContain("Fed Pivot");
    expect(JSON.stringify(shown.forStockPages)).not.toContain("Fed Pivot");
    expect(JSON.stringify(shown.forReports)).not.toContain("Fed Pivot");
    // Calculated values are untouched.
    expect(shown.pressureScore).toBe(raw.pressureScore);
    expect(shown.probabilities).toEqual(raw.probabilities);
    expect(shown.historicalPercentile).toBe(raw.historicalPercentile);
    // The stored output (and MarketState source health that reads it) is not mutated.
    expect(raw.providerProvenance?.fred.status).toBe("live");
    expect(raw.topAnalog?.label).toBe("Fed Pivot Rally");
  });

  it("keeps the analog when the canonical outlook has one", () => {
    const shown = applySeismographDisplayContext(assembled(), { dataQuality: delayedQuality, canonicalTopAnalogAvailable: true });
    expect(shown.topAnalog?.label).toBe("Fed Pivot Rally");
  });
});
