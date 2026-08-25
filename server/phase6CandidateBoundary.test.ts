import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");
const candidateContract = source("shared/candidateDetection.ts");
const candidateService = source("server/candidateDetection.ts");
const scheduler = source("server/scheduledSeismograph.ts");
const marketState = source("server/routers/marketState.ts");
const dashboard = source("client/src/pages/Dashboard.tsx");
const asha = source("server/ashaEngine.ts");
const oracle = source("server/routers/smartDiscovery.ts");

describe("Phase 6 candidate-only boundary", () => {
  it("keeps candidate provenance, detector identity, no-candidate behavior, and Phase 5 authority", () => {
    ["originatingStateId", "originatingSynthesisId", "evidenceClaimIds", "detectorId", "detectorVersion", "detectorConfigVersion"].forEach(field => expect(candidateContract).toContain(field));
    expect(candidateService).toContain("evaluateCandidateDetections(synthesis)");
    expect(candidateService).toContain("noCandidates: candidates.length === 0");
    expect(scheduler).toContain("persistCrossEngineSynthesis(synthesis)");
    expect(scheduler).toContain("evaluateAndPersistCandidateDetections(synthesis)");
  });

  it("has no active Phase 7–10 warning leak in Phase 6 contracts, runtime, public API, dashboard, or AI prompts", () => {
    const phase6Active = [candidateContract, candidateService, scheduler, marketState, dashboard].join("\n");
    [
      "compositeWarningScore", "qualifiedWarnings", "qualificationState", "PRIORITY SCORE",
      "EarlyWarningIntelligencePanel", "earlyWarningsCurrent", "earlyWarningHistory",
      "buildEarlyWarningPromptContract", "evaluateEarlyWarnings", "confirmationConditions", "invalidationConditions",
    ].forEach(term => expect(phase6Active).not.toContain(term));
    ["EMERGING", "DEVELOPING", "CONFIRMING", "ELEVATED", "FADING", "INVALIDATED"].forEach(term => expect(candidateContract).not.toContain(term));
    [asha, oracle].forEach(aiSource => {
      expect(aiSource).not.toContain("earlyWarningIntelligence");
      expect(aiSource).not.toContain("buildEarlyWarningPromptContract");
      expect(aiSource).not.toContain("evaluateEarlyWarnings");
    });
  });

  it("retains only protected candidate diagnostics and append-only candidate observation history", () => {
    const admin = source("server/routers/admin.ts");
    expect(admin).toContain("getCandidateDetectionDebug: adminProcedure");
    expect(admin).toContain("getPersistedCandidateDetections");
    expect(admin).toContain("getCandidateObservationTimeline");
    expect(candidateService).toContain('"candidate_detected"');
    expect(candidateService).toContain('"candidate_observed"');
  });
});
