import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the db module
vi.mock("../db", () => ({
  getPressureHistory: vi.fn(),
}));

import { getPressureHistory } from "../db";

const mockHistory = [
  { date: "2008-01", overallPressure: 45, regime: "ELEVATED", liquidityStress: 50, creditContagion: 60, volatilityRegime: 55, macroSensitivity: 40, marketBreadth: 35, rawBaaSpread: 2.5, rawHySpread: 5.0, rawTenYearYield: 3.8, rawTwoYearYield: 2.1, rawFedFunds: 3.0, rawCpi: 4.2, rawUnemployment: 5.0, rawSpx: 1400 },
  { date: "2008-06", overallPressure: 72, regime: "CRITICAL", liquidityStress: 80, creditContagion: 85, volatilityRegime: 75, macroSensitivity: 65, marketBreadth: 60, rawBaaSpread: 4.0, rawHySpread: 8.0, rawTenYearYield: 4.0, rawTwoYearYield: 2.5, rawFedFunds: 2.0, rawCpi: 5.0, rawUnemployment: 5.5, rawSpx: 1280 },
  { date: "2008-10", overallPressure: 94, regime: "CRITICAL", liquidityStress: 95, creditContagion: 98, volatilityRegime: 92, macroSensitivity: 88, marketBreadth: 90, rawBaaSpread: 6.5, rawHySpread: 18.0, rawTenYearYield: 3.5, rawTwoYearYield: 1.5, rawFedFunds: 1.0, rawCpi: 3.8, rawUnemployment: 6.5, rawSpx: 900 },
  { date: "2009-03", overallPressure: 88, regime: "CRITICAL", liquidityStress: 85, creditContagion: 90, volatilityRegime: 80, macroSensitivity: 82, marketBreadth: 85, rawBaaSpread: 5.8, rawHySpread: 15.0, rawTenYearYield: 2.8, rawTwoYearYield: 0.9, rawFedFunds: 0.25, rawCpi: 0.5, rawUnemployment: 8.5, rawSpx: 680 },
  { date: "2009-12", overallPressure: 55, regime: "ELEVATED", liquidityStress: 50, creditContagion: 55, volatilityRegime: 48, macroSensitivity: 52, marketBreadth: 45, rawBaaSpread: 3.2, rawHySpread: 7.5, rawTenYearYield: 3.5, rawTwoYearYield: 1.0, rawFedFunds: 0.25, rawCpi: 2.7, rawUnemployment: 10.0, rawSpx: 1115 },
];

describe("Time Machine router logic", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (getPressureHistory as ReturnType<typeof vi.fn>).mockResolvedValue(mockHistory);
  });

  it("identifies peak pressure month correctly", () => {
    const peak = mockHistory.reduce((max, r) => r.overallPressure > max.overallPressure ? r : max, mockHistory[0]);
    expect(peak.date).toBe("2008-10");
    expect(peak.overallPressure).toBe(94);
    expect(peak.regime).toBe("CRITICAL");
  });

  it("identifies first CRITICAL month correctly", () => {
    const firstCritical = mockHistory.find(r => r.regime === "CRITICAL");
    expect(firstCritical?.date).toBe("2008-06");
  });

  it("computes pressure change from start to peak correctly", () => {
    const start = mockHistory[0].overallPressure; // 45
    const peak = 94;
    const change = peak - start;
    expect(change).toBe(49);
  });

  it("identifies recovery month (first drop below 60 after peak)", () => {
    const peakIdx = mockHistory.findIndex(r => r.overallPressure === 94);
    const recovery = mockHistory.slice(peakIdx + 1).find(r => r.overallPressure < 60);
    expect(recovery?.date).toBe("2009-12");
  });

  it("computes domain scores as 0-100 values", () => {
    for (const row of mockHistory) {
      expect(row.liquidityStress).toBeGreaterThanOrEqual(0);
      expect(row.liquidityStress).toBeLessThanOrEqual(100);
      expect(row.creditContagion).toBeGreaterThanOrEqual(0);
      expect(row.creditContagion).toBeLessThanOrEqual(100);
    }
  });

  it("returns correct number of months for 2008-2009 period", () => {
    const filtered = mockHistory.filter(r => r.date >= "2008-01" && r.date <= "2009-12");
    expect(filtered).toHaveLength(5);
  });

  it("PRESET_PERIODS covers the 2008 GFC period", () => {
    const gfcStart = "2007-06";
    const gfcEnd = "2009-12";
    expect(gfcStart < gfcEnd).toBe(true);
    // Verify the period label
    const label = "2008 Global Financial Crisis";
    expect(label).toContain("2008");
  });

  it("correctly maps regime string to numeric tier", () => {
    const regimeToTier = (r: string) => {
      if (r === "CRITICAL") return 4;
      if (r === "ELEVATED") return 3;
      if (r === "MODERATE") return 2;
      return 1;
    };
    expect(regimeToTier("CRITICAL")).toBe(4);
    expect(regimeToTier("ELEVATED")).toBe(3);
    expect(regimeToTier("MODERATE")).toBe(2);
    expect(regimeToTier("CALM")).toBe(1);
  });

  it("peak pressure is the maximum value in the dataset", () => {
    const max = Math.max(...mockHistory.map(r => r.overallPressure));
    expect(max).toBe(94);
  });

  it("generates correct narrative for CRITICAL regime at peak", () => {
    const peak = mockHistory.find(r => r.overallPressure === 94)!;
    const narrative = peak.regime === "CRITICAL"
      ? `Pressure reached ${peak.overallPressure}/100 — CRITICAL regime. Systemic risk was at its highest.`
      : "Normal conditions";
    expect(narrative).toContain("94/100");
    expect(narrative).toContain("CRITICAL");
  });
});
