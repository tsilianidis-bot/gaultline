import { describe, expect, it } from "vitest";
import {
  analyzePreEventWindow,
  summarizeDiagnosticEvents,
  twoMonthsBefore,
  type Phase1MonthlyScore,
} from "./phase1EarlyWarningDiagnostics";

const score = (month: string, pressure: number, liquidityStress = 30): Phase1MonthlyScore => ({
  scoreMonth: month.slice(0, 7),
  scoreTimestamp: new Date(`${month}T00:00:00.000Z`),
  overallPressure: pressure,
  vectors: {
    liquidityStress,
    creditContagion: 25,
    volatilityRegime: 20,
    macroSensitivity: 35,
    marketBreadth: 15,
    aiBubble: 40,
  },
});

describe("Phase 1 early-warning diagnostics", () => {
  it("uses the documented two-month pre-event boundary", () => {
    expect(twoMonthsBefore("2020-03-11")).toBe("2020-01-11");
  });

  it("keeps component elevation distinct from composite qualification", () => {
    const event = analyzePreEventWindow(
      { startDate: "2020-03-11", troughDate: "2020-03-23", drawdownPct: -20 },
      [score("2020-01-31", 40, 55), score("2020-02-28", 44, 60)],
    );
    expect(event.compositeWarned).toBe(false);
    expect(event.compositeQualifiedMonths).toEqual([]);
    expect(event.elevatedVectors).toContain("liquidityStress");
  });

  it("reports warning and miss counts without treating elevated vectors as warnings", () => {
    const missed = analyzePreEventWindow(
      { startDate: "2020-03-11", troughDate: "2020-03-23", drawdownPct: -20 },
      [score("2020-02-28", 44, 60)],
    );
    const warned = analyzePreEventWindow(
      { startDate: "2020-06-11", troughDate: "2020-06-23", drawdownPct: -12 },
      [score("2020-05-29", 46, 30)],
    );
    const summary = summarizeDiagnosticEvents([missed, warned]);
    expect(summary.compositeWarnedCount).toBe(1);
    expect(summary.compositeMissedCount).toBe(1);
    expect(summary.vectorElevationsInMisses.liquidityStress).toBe(1);
  });
});
