import { describe, expect, it } from "vitest";
import {
  buildWhatIsHappeningCopy,
  buildWhyThisRegimeCopy,
  laborRatesUnavailableMessage,
  nowInterpretationIssues,
  topThreatEvidenceCopy,
  LABOR_RATES_DISPLAY_NAME,
  type NowInterpretationInput,
} from "../shared/nowInterpretationCopy";

const moderateElevatedImproving: NowInterpretationInput = {
  pressureScore: 34,
  regimeLabel: "MODERATE RISK",
  historicalPercentile: 83,
  evidenceFamilies: [
    { name: LABOR_RATES_DISPLAY_NAME, signal: "bullish", strength: 28, currentValue: "28/100", trend: "improving" },
    { name: "Yield Curve (10Y–2Y) & 10Y Level", signal: "recovering", strength: 30, currentValue: "30/100", trend: "improving" },
    { name: "Macro Sensitivity", signal: "bullish", strength: 32, currentValue: "32/100", trend: "stable" },
    { name: "Credit Markets", signal: "neutral", strength: 40, currentValue: "40/100", trend: "stable" },
    { name: "Liquidity Conditions", signal: "recovering", strength: 22, currentValue: "22/100", trend: "improving" },
  ],
};

describe("NOW interpretation hierarchy copy", () => {
  it("uses live score/percentile and never claims constructive / low-risk as safe when elevated", () => {
    const text = buildWhatIsHappeningCopy(moderateElevatedImproving);
    expect(text).toContain("Systemic pressure is moderate at 34/100");
    expect(text).toContain("historically elevated");
    expect(text).toContain("83rd percentile");
    expect(text).toMatch(/showing improvement or recovery/i);
    expect(text).toMatch(/not yet confirming a low-risk environment/i);
    expect(text).not.toMatch(/constructive risk environment/i);
    expect(text).not.toMatch(/signaling strength or recovery,\s*consistent with/i);
    expect(nowInterpretationIssues(text, moderateElevatedImproving)).toEqual([]);
  });

  it("does not hard-code demo 34/83 when live values differ", () => {
    const text = buildWhatIsHappeningCopy({
      ...moderateElevatedImproving,
      pressureScore: 41,
      historicalPercentile: 77,
    });
    expect(text).toContain("41/100");
    expect(text).toContain("77th percentile");
    expect(text).not.toMatch(/\b34\/100\b/);
    expect(text).not.toMatch(/\b83rd\b/);
    expect(nowInterpretationIssues(text, {
      ...moderateElevatedImproving,
      pressureScore: 41,
      historicalPercentile: 77,
    })).toEqual([]);
  });

  it("replaces the empty-threat copy with verified-family language", () => {
    expect(topThreatEvidenceCopy(false)).toBe(
      "No single verified evidence family is currently dominating the risk signal.",
    );
    expect(topThreatEvidenceCopy(true)).toBe(
      "Strongest evidence family currently signaling stress.",
    );
  });
});

describe("Pulse / whyThisRegime unavailable-as-driver contract", () => {
  it("does not cite Labor & Rates as a current driver when unavailable, and avoids measured risk-taking language", () => {
    const input: NowInterpretationInput = {
      pressureScore: 34,
      regimeLabel: "MODERATE RISK",
      historicalPercentile: 83,
      evidenceFamilies: [
        // Labor omitted → unavailable
        { name: "Macro Sensitivity", signal: "bullish", strength: 35, currentValue: "35/100", trend: "stable" },
      ],
      missingFamilyNames: [LABOR_RATES_DISPLAY_NAME],
      volatilityAvailable: false,
      liquidityAvailable: false,
      scenarioConfidenceAvailable: false,
    };
    const text = buildWhyThisRegimeCopy(input);
    expect(text).toContain("The current Pressure Index is 34/100");
    expect(text).toContain("classified as Moderate Risk");
    expect(text).toMatch(/incomplete confirmation/i);
    expect(text).toContain(laborRatesUnavailableMessage());
    expect(text).not.toMatch(/driven primarily by/i);
    expect(text).not.toMatch(/Labor & Rates[^.]*driven/i);
    expect(text).not.toMatch(/broadly supportive of measured risk-taking/i);
    expect(nowInterpretationIssues(text, input)).toEqual([]);
  });

  it("flags integrity issues when copy cites unavailable Labor as a driver without a prior snapshot timestamp", () => {
    const input: NowInterpretationInput = {
      pressureScore: 34,
      regimeLabel: "MODERATE RISK",
      historicalPercentile: 83,
      evidenceFamilies: [],
      missingFamilyNames: [LABOR_RATES_DISPLAY_NAME],
      volatilityAvailable: false,
      liquidityAvailable: false,
      scenarioConfidenceAvailable: false,
    };
    const bad =
      "The Moderate Risk regime classification is driven primarily by Labor & Rates (Unemployment, 10Y), Yield Curve (10Y-2Y) & 10Y Level, Macro Sensitivity. These factors collectively indicate that the market environment is broadly supportive of measured risk-taking with standard risk management.";
    const issues = nowInterpretationIssues(bad, input);
    expect(issues.some(i => /Labor & Rates/i.test(i))).toBe(true);
    expect(issues.some(i => /measured risk-taking|Forbidden/i.test(i))).toBe(true);
  });

  it("allows prior-snapshot citation only when a timestamp is provided", () => {
    const input: NowInterpretationInput = {
      pressureScore: 34,
      regimeLabel: "MODERATE RISK",
      historicalPercentile: 83,
      evidenceFamilies: [],
      missingFamilyNames: [LABOR_RATES_DISPLAY_NAME],
      priorSnapshotAt: "2026-10-01 14:00 ET",
    };
    const text = buildWhyThisRegimeCopy(input);
    expect(text).toContain("2026-10-01 14:00 ET");
    expect(text).toMatch(/not treated as current drivers/i);
  });
});
