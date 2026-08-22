import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const projectRoot = process.cwd();
const briefingSource = readFileSync(resolve(projectRoot, "client/src/components/OracleBriefing.tsx"), "utf8");
const rendererSource = briefingSource.slice(briefingSource.indexOf("export default function OracleBriefing"));
const panelSource = readFileSync(resolve(projectRoot, "client/src/components/AshaPanel.tsx"), "utf8");
const engineSource = readFileSync(resolve(projectRoot, "server/ashaEngine.ts"), "utf8");

describe("ORACLE Briefing Phase 4 presentation hierarchy", () => {
  it("renders the required answer-first evidence-bound sequence", () => {
    const requiredSections = ["DIRECT ANSWER", "MISSION SNAPSHOT", "CORE THESIS", "KEY FINDINGS · CURRENT ASSESSMENT", "EVIDENCE RELATIONSHIPS", "MISSION RECOMMENDATION"];
    const positions = requiredSections.map(section => rendererSource.indexOf(section));
    expect(positions.every(position => position >= 0)).toBe(true);
    expect(positions).toEqual([...positions].sort((a, b) => a - b));
  });

  it("keeps direct answer, thesis, evidence relationships, and governed conditions as typed fields", () => {
    ["directAnswer?: string;", "coreThesis?: string;", "crossEngineSynthesis?: Array<", "confirmationConditions?: string[];", "invalidationConditions?: string[];"].forEach(contract => expect(briefingSource).toContain(contract));
  });

  it("renders missing confirmation and invalidation as explicit no-governed-rule states without pseudo-engine language", () => {
    expect(briefingSource).toContain("No governed confirmation condition is currently defined.");
    expect(briefingSource).toContain("No governed invalidation condition is currently defined.");
    expect(briefingSource).not.toContain("No additional confirmation condition was returned by the currently available engines.");
    expect(briefingSource).not.toContain("Structured synthesis unavailable");
  });

  it("retains established ASHA panel field mapping without making guidance into evidence", () => {
    ["directAnswer: response.directAnswer", "coreThesis: response.coreThesis", "crossEngineSynthesis: response.crossEngineSynthesis", "confirmationConditions: response.confirmationConditions", "missionRecommendation: response.missionRecommendation", "finalVerdictAction: response.finalVerdictAction"].forEach(mapping => expect(panelSource).toContain(mapping));
  });

  it("requires Phase 4 evidence limits rather than forced probability, threshold, and all-engine claims", () => {
    ["buildInterpretationPromptContract(transaction, evidencePacket)", "Historical analog similarity is not forecast probability"].forEach(rule => expect(engineSource).toContain(rule));
  });
});
