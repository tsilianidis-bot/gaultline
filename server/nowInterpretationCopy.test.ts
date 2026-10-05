import { readFileSync } from "node:fs";
import { resolve } from "node:path";
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

  it("empty successful threat analysis does not say unavailable", () => {
    expect(topThreatEvidenceCopy(false)).toBe("No single threat currently dominates");
    expect(topThreatEvidenceCopy(true)).toBe("Strongest evidence family currently signaling stress.");
    expect(topThreatEvidenceCopy(false, true)).toMatch(/unavailable/i);
  });
});

describe("threat / analog empty-success vs unavailable", () => {
  it("uses 'No single threat currently dominates' when analysis succeeds with no dominant threat", async () => {
    const { topThreatHeadline, NO_DOMINANT_THREAT_TEXT } = await import("../shared/nowInterpretationCopy");
    expect(topThreatHeadline(null, false)).toBe(NO_DOMINANT_THREAT_TEXT);
    expect(topThreatHeadline("", false)).toBe(NO_DOMINANT_THREAT_TEXT);
    expect(topThreatHeadline("Credit stress", false)).toBe("Credit stress");
  });
  it("uses 'No high-confidence historical analog identified' when analysis succeeds with no analog", async () => {
    const { topAnalogHeadline, topAnalogDetail, NO_HIGH_CONFIDENCE_ANALOG_TEXT } = await import("../shared/nowInterpretationCopy");
    expect(topAnalogHeadline(null, false)).toBe(NO_HIGH_CONFIDENCE_ANALOG_TEXT);
    expect(topAnalogDetail(null, false, n => `${n}%`)).not.toMatch(/unavailable/i);
    expect(topAnalogHeadline({ label: "GFC", period: "2008" }, false)).toBe("GFC · 2008");
  });
  it("reserves 'unavailable' for actual data/engine failure on both surfaces", async () => {
    const {
      topThreatHeadline, topThreatEvidenceCopy, topAnalogHeadline, topAnalogDetail,
      THREAT_ANALYSIS_UNAVAILABLE_TEXT, ANALOG_ANALYSIS_UNAVAILABLE_TEXT,
    } = await import("../shared/nowInterpretationCopy");
    expect(topThreatHeadline(null, true)).toBe(THREAT_ANALYSIS_UNAVAILABLE_TEXT);
    expect(topThreatEvidenceCopy(false, true)).toMatch(/unavailable/i);
    expect(topAnalogHeadline(null, true)).toBe(ANALOG_ANALYSIS_UNAVAILABLE_TEXT);
    expect(topAnalogDetail(null, true, n => `${n}%`)).toMatch(/unavailable/i);
    expect(topThreatHeadline(null, false)).not.toMatch(/unavailable/i);
    expect(topAnalogHeadline(null, false)).not.toMatch(/unavailable/i);
  });
  it("NOW page wires the three-state helpers into the verdict cards", () => {
    const now = readFileSync(resolve(process.cwd(), "client/src/pages/Now.tsx"), "utf8");
    expect(now).toContain("topThreatHeadline(threats[0], false)");
    expect(now).toContain("topAnalogHeadline(topAnalog, false)");
    expect(now).toContain("topAnalogDetail(topAnalog, false, formatCanonicalPercent)");
    expect(now).not.toContain("No dominant verified threat");
    expect(now).not.toContain("Historical comparison remains unavailable.");
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
