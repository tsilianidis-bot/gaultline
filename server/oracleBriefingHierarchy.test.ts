import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const projectRoot = process.cwd();
const briefingSource = readFileSync(resolve(projectRoot, "client/src/components/OracleBriefing.tsx"), "utf8");
const rendererSource = briefingSource.slice(briefingSource.indexOf("export default function OracleBriefing"));
const panelSource = readFileSync(resolve(projectRoot, "client/src/components/AshaPanel.tsx"), "utf8");
const engineSource = readFileSync(resolve(projectRoot, "server/ashaEngine.ts"), "utf8");

describe("ORACLE Briefing presentation hierarchy", () => {
  it("renders the required answer-first intelligence sequence", () => {
    const requiredSections = [
      "DIRECT ANSWER",
      "MISSION SNAPSHOT",
      "CORE THESIS",
      "KEY FINDINGS · CURRENT ASSESSMENT",
      "CROSS-ENGINE SYNTHESIS",
      "WHAT COULD CONFIRM THE RISK",
      "RISK DISMISSED OR REDUCED IF",
      "MISSION RECOMMENDATION",
    ];

    const positions = requiredSections.map(section => rendererSource.indexOf(section));
    expect(positions.every(position => position >= 0)).toBe(true);
    expect(positions).toEqual([...positions].sort((a, b) => a - b));
  });

  it("keeps direct answer, thesis, synthesis, confirmation, and invalidation as typed briefing fields", () => {
    [
      "directAnswer?: string;",
      "coreThesis?: string;",
      "crossEngineSynthesis?: Array<",
      "confirmationConditions?: string[];",
      "invalidationConditions: string[];",
    ].forEach(contract => expect(briefingSource).toContain(contract));
  });

  it("keeps unavailable confirmation and invalidation states explicit instead of fabricating conditions", () => {
    expect(briefingSource).toContain("No additional confirmation condition was returned by the currently available engines.");
    expect(briefingSource).toContain("No explicit invalidation condition was returned by the currently available engines.");
  });

  it("maps the extended ORACLE fields from ASHA without replacing established conclusion fields", () => {
    [
      "directAnswer: response.directAnswer",
      "coreThesis: response.coreThesis",
      "crossEngineSynthesis: response.crossEngineSynthesis",
      "confirmationConditions: response.confirmationConditions",
      "missionRecommendation: response.missionRecommendation",
      "finalVerdictAction: response.finalVerdictAction",
    ].forEach(mapping => expect(panelSource).toContain(mapping));
  });

  it("requires hierarchy fields from the ORACLE model while retaining source and limitation safeguards", () => {
    [
      "directAnswer: EXACTLY ONE decisive sentence",
      "coreThesis: ONE strong paragraph",
      "crossEngineSynthesis: EXACTLY 3-6 rows",
      "confirmationConditions: EXACTLY 2-4 DISTINCT measurable conditions",
      "limited historical sample caveat",
      "DO NOT claim these engines contributed to this briefing",
      "missionRecommendation: A concise actionable guidance paragraph",
    ].forEach(rule => expect(engineSource).toContain(rule));
  });
});
