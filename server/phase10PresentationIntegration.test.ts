import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createSocialReadyWarningPost } from "./earlyWarningPresentation";
import { PHASE10_PRESENTATION_CONTRACT_VERSION, type GovernedEarlyWarningPresentation } from "../shared/earlyWarningPresentation";

const read = (relative: string) => readFileSync(resolve(process.cwd(), relative), "utf8");

const noMaterial: GovernedEarlyWarningPresentation = {
  contractVersion: PHASE10_PRESENTATION_CONTRACT_VERSION,
  presentationContractVersion: PHASE10_PRESENTATION_CONTRACT_VERSION,
  kind: "NO_MATERIAL_EARLY_WARNING",
  presentationId: "p10:none:fixture",
  stateId: "state-fixture",
  synthesisId: "synthesis-fixture",
  message: "Current governed cross-engine evidence does not meet FAULTLINE’s qualification requirements for a material developing warning.",
  limitations: ["This does not mean markets are safe, bullish, or without downside risk."],
  freshness: "CURRENT",
  generatedAt: "2026-08-22T00:00:00.000Z",
};

describe("Phase 10 governed presentation integration", () => {
  it("keeps social-ready output bound to one immutable no-material presentation and never claims safety", () => {
    const social = createSocialReadyWarningPost(noMaterial);
    expect(social.presentationId).toBe(noMaterial.presentationId);
    expect(social.text).toContain("No material early warning");
    expect(social.text).toContain("does not mean markets are safe");
    expect(social.text.toLowerCase()).not.toContain("probability");
  });

  it("exposes current and timeline read-only APIs from the canonical market-state boundary", () => {
    const source = read("server/routers/marketState.ts");
    expect(source).toContain("earlyWarningPresentationCurrent");
    expect(source).toContain("earlyWarningPresentationTimeline");
    expect(source).toContain("getCurrentGovernedEarlyWarningPresentation");
    expect(source).toContain("getCurrentGovernedEarlyWarningTimeline");
  });

  it("binds HOME, actual WATCH, legacy WATCH, detail, and Alerts Archive to the shared component", () => {
    for (const path of [
      "client/src/pages/Dashboard.tsx",
      "client/src/pages/AIWatch.tsx",
      "client/src/pages/Watch.tsx",
      "client/src/pages/Alerts.tsx",
      "client/src/pages/EarlyWarningDetail.tsx",
    ]) {
      expect(read(path)).toContain("EarlyWarningPresentationPanel");
    }
    expect(read("client/src/App.tsx")).toContain('path="/app/early-warning"');
  });

  it("binds ASHA and Oracle to the same read-only presentation contract", () => {
    for (const path of ["server/ashaEngine.ts", "server/routers/smartDiscovery.ts"]) {
      const source = read(path);
      expect(source).toContain("getCurrentGovernedEarlyWarningPresentation");
      expect(source).toContain("buildEarlyWarningPresentationPromptContract");
    }
    expect(read("server/earlyWarningPresentation.ts")).toContain("Do not calculate, score, rank, qualify, transition, confirm, invalidate, forecast");
  });

  it("retains owner-only presentation traceability and no presentation-level scoring functions", () => {
    const admin = read("server/routers/admin.ts");
    const service = read("server/earlyWarningPresentation.ts");
    expect(admin).toContain("getEarlyWarningPresentationDebug");
    expect(admin).toContain("exposesToAdminOnly: true");
    expect(service).toContain("it never calls candidate, scoring, lifecycle, or Phase 9 evaluation code");
    expect(service).not.toContain("evaluateImportanceQualification(");
  });
});
