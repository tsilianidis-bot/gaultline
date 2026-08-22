import { describe, expect, it } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const read = (path: string) => readFileSync(resolve(root, path), "utf8");

describe("Phase 8 lifecycle integration boundaries", () => {
  it("runs one global lifecycle evaluation after the global Phase 7 qualification stream", () => {
    const scheduled = read("server/scheduledSeismograph.ts");
    expect(scheduled).toContain('import { evaluateAndPersistLifecycle } from "./earlyWarningLifecycle"');
    expect(scheduled.indexOf("evaluateAndPersistLifecycle(qualification.evaluation)")).toBeGreaterThan(scheduled.indexOf("evaluateAndPersistImportanceQualification(candidates.evaluation.candidates)"));
  });

  it("keeps lifecycle provenance available only through protected owner diagnostics", () => {
    const admin = read("server/routers/admin.ts");
    expect(admin).toContain("getLifecycleDebug: adminProcedure");
    expect(admin).toContain("qualificationEvaluationId");
    expect(admin).toContain("transitionReasonCode");
  });

  it("does not reactivate public lifecycle cards, public lifecycle API, or ASHA/Oracle warning presentation", () => {
    expect(existsSync(resolve(root, "client/src/components/EarlyWarningIntelligencePanel.tsx"))).toBe(false);
    const dashboard = read("client/src/pages/Dashboard.tsx");
    const marketState = read("server/routers/marketState.ts");
    const asha = read("server/ashaEngine.ts");
    const oracle = read("server/routers/smartDiscovery.ts");
    expect(dashboard).not.toContain("EarlyWarningIntelligencePanel");
    expect(marketState).not.toMatch(/earlyWarning|lifecycleHistory/i);
    expect(asha).not.toMatch(/governed early warning|warning evaluation/i);
    expect(oracle).not.toMatch(/governed early warning|warning evaluation/i);
  });
});
