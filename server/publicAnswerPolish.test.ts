import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { redactSystemicRegimeReading, SYSTEMIC_REGIME_PROBABILITY_FIELDS } from "../shared/systemicRegimePublic";
import { EMPTY_SYSTEMIC_REGIME_READING } from "../shared/systemicRegime";
import { actDecisionSummary, splitInvalidationList } from "./marketStateService";
import { alignPrimaryDriver, buildWhyHeadline } from "../shared/whyConsistency";

describe("public answer polish (2026-10-14)", () => {
  it("systemicRegime.current omits every probability field", () => {
    const pub = redactSystemicRegimeReading({ ...EMPTY_SYSTEMIC_REGIME_READING, crisisProbability: 0.4, regimeConfidence: 0.9, transitionProbability: 0.1, stressBuildingProbability: 0.2, systemicRiskScore: 50 });
    for (const key of SYSTEMIC_REGIME_PROBABILITY_FIELDS) expect(Object.prototype.hasOwnProperty.call(pub, key)).toBe(false);
    expect(JSON.stringify(pub)).not.toMatch(/Probability|systemicRiskScore|regimeConfidence/);
    expect(pub.probabilitiesWithheld).toBe(true);
  });

  it("ACT headline is its own short clause and invalidation splits into a list", () => {
    const s = actDecisionSummary("balanced");
    expect(s).toBe("Maintain a balanced posture until the invalidation conditions below are met.");
    expect(s).not.toMatch(/while The|historical outcome/);
    expect(splitInvalidationList("Pressure drops below 20 for 3+ consecutive months. Credit spreads narrow by 50+ basis points. A score move above 49 or below 19 would signal a regime change.")).toHaveLength(3);
  });

  it("WHY headline and primary driver use Top-contributor scores", () => {
    const fam = [
      { name: "Labor & Rates", strength: 29, signal: "neutral" },
      { name: "Macro Sensitivity", strength: 46, signal: "neutral" },
      { name: "Yield Curve", strength: 40 },
    ];
    expect(buildWhyHeadline(fam)).toBe("The largest contributors to current pressure are Macro Sensitivity (46/100), Yield Curve (40/100) and Labor & Rates (29/100).");
    const story = "Reading 34/100. The primary verified pressure driver among available evidence is Labor & Rates (Unemployment, 10Y), which is signaling neutral conditions. More.";
    expect(alignPrimaryDriver(story, fam)).toContain("The primary pressure driver is Macro Sensitivity (46/100)");
    expect(alignPrimaryDriver(story, fam)).not.toContain("Labor & Rates (Unemployment");
  });

  it("OUTLOOK: one ±10 window, no double period, no 'Low pressure environment'", () => {
    const src = readFileSync("server/seismographUnified.ts", "utf8");
    expect(src).not.toContain("Low pressure environment — regime persistence");
    expect(src).not.toMatch(/Math\.abs\(h\.score - currentScore\) <= 15/);
    expect(readFileSync("client/src/pages/Outlook.tsx", "utf8")).toContain('replace(/[.\\s]+$/, "")');
  });
});
