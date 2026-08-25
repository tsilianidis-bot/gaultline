import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");
const shared = source("shared/importanceQualification.ts");
const service = source("server/importanceQualification.ts");
const scheduler = source("server/scheduledSeismograph.ts");
const admin = source("server/routers/admin.ts");
const marketState = source("server/routers/marketState.ts");
const dashboard = source("client/src/pages/Dashboard.tsx");
const asha = source("server/ashaEngine.ts");
const oracle = source("server/routers/smartDiscovery.ts");

describe("Phase 7 qualification boundary", () => {
  it("uses only structured Phase 6 candidate objects, a versioned scoring config, and deterministic internal qualification", () => {
    expect(shared).toContain("CandidateDetection");
    expect(shared).toContain("IMPORTANCE_SCORING_MODEL_ID");
    expect(shared).toContain("IMPORTANCE_SCORING_MODEL_VERSION");
    expect(shared).toContain("IMPORTANCE_SCORING_CONFIG_VERSION");
    expect(service).toContain("evaluateImportanceQualification(contexts)");
    expect(scheduler).toContain("evaluateAndPersistImportanceQualification(candidates.evaluation.candidates)");
  });

  it("preserves state/candidate/evidence/score provenance in append-only qualification evaluation rows", () => {
    ["candidateId", "originatingStateId", "originatingSynthesisId", "factorTraceJson", "scoringModelVersion", "scoringConfigVersion"].forEach(field => expect(service).toContain(field));
    expect(service).toContain("importanceQualificationEvaluations");
    expect(service).not.toContain(".update(importanceQualificationEvaluations)");
    expect(admin).toContain("getImportanceQualificationDebug: adminProcedure");
  });

  it("has no active lifecycle, confirmation/invalidation, public warning, or AI warning presentation leak", () => {
    const phase7Active = [shared, service, scheduler].join("\n");
    [
      "EMERGING", "DEVELOPING", "CONFIRMING", "ELEVATED", "FADING", "INVALIDATED", "RESOLVED",
      "lifecycleState", "confirmationConditions", "invalidationConditions",
    ].forEach(term => expect(phase7Active).not.toContain(term));
    [marketState, dashboard].forEach(surface => {
      expect(surface).not.toContain("EarlyWarningIntelligencePanel");
      expect(surface).not.toContain("earlyWarningsCurrent");
      expect(surface).not.toContain("earlyWarningHistory");
    });
    [asha, oracle].forEach(surface => {
      expect(surface).not.toContain("buildEarlyWarningPromptContract");
      expect(surface).not.toContain("evaluateEarlyWarnings");
      expect(surface).not.toContain("importanceQualification");
    });
  });

  it("keeps score semantics non-probabilistic and supports a first-class no-material result", () => {
    expect(shared).toContain("IMPORTANCE_MATERIALITY_NOT_PROBABILITY");
    expect(shared).toContain("noMaterialEarlyWarning");
    expect(shared).toContain("maximumSecondaryQualifiedCandidates: 2");
  });
});
