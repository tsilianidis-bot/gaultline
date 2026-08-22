import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(process.cwd());
const source = (path: string) => readFileSync(resolve(root, path), "utf8");

describe("Phase 6 Early Warning integration boundaries", () => {
  it("evaluates only after the exact authoritative Phase 5 synthesis is persisted in the scheduled canonical pipeline", () => {
    const scheduled = source("server/scheduledSeismograph.ts");
    expect(scheduled).toContain('persistCrossEngineSynthesis(synthesis)');
    expect(scheduled).toContain('evaluateAndPersistEarlyWarnings(synthesis)');
    expect(scheduled.indexOf('persistCrossEngineSynthesis(synthesis)')).toBeLessThan(scheduled.indexOf('evaluateAndPersistEarlyWarnings(synthesis)'));
  });

  it("exposes current warnings only through the canonical market-state router and appends history by persistent warning identity", () => {
    const router = source("server/routers/marketState.ts");
    expect(router).toContain("earlyWarningsCurrent");
    expect(router).toContain("getAuthoritativeCrossEngineSynthesis");
    expect(router).toContain("earlyWarningHistory");
    expect(router).toContain("getEarlyWarningTimeline");
  });

  it("preserves original warning provenance and appends later lifecycle observations instead of rewriting history", () => {
    const service = source("server/earlyWarningIntelligence.ts");
    const schema = source("drizzle/schema.ts");
    expect(service).toContain("originalPayloadJson");
    expect(service).toContain("earlyWarningObservations");
    expect(service).toContain("warning_invalidated");
    expect(schema).toContain('export const earlyWarnings');
    expect(schema).toContain('export const earlyWarningObservations');
  });

  it("keeps the flagship HOME panel state-locked and treats no-warning as a deliberate integrity outcome", () => {
    const dashboard = source("client/src/pages/Dashboard.tsx");
    const panel = source("client/src/components/EarlyWarningIntelligencePanel.tsx");
    expect(dashboard).toContain("EarlyWarningIntelligencePanel");
    expect(panel).toContain("earlyWarningsCurrent");
    expect(panel).toContain("NO MATERIAL EARLY WARNING");
    expect(panel).toContain("VIEW FULL WARNING");
    expect(panel).toContain("LIVE VERIFIED EVOLUTION");
    expect(panel).toContain("NOT A PROBABILITY OF ANY MARKET OUTCOME");
  });

  it("binds ASHA and Oracle to governed warning evaluation rather than raw-metric warning invention", () => {
    const asha = source("server/ashaEngine.ts");
    const oracle = source("server/routers/smartDiscovery.ts");
    expect(asha).toContain("evaluateEarlyWarnings(governedCrossEngineSynthesis)");
    expect(asha).toContain("buildEarlyWarningPromptContract(governedEarlyWarnings)");
    expect(oracle).toContain("buildEarlyWarningPromptContract(crossEngineSynthesis ? evaluateEarlyWarnings(crossEngineSynthesis) : null)");
    expect(oracle).toContain("or Early Warnings");
  });

  it("keeps raw warning provenance and lifecycle inspection behind the existing admin procedure boundary", () => {
    const admin = source("server/routers/admin.ts");
    expect(admin).toContain("getEarlyWarningDebug: adminProcedure");
    expect(admin).toContain("getPersistedEarlyWarnings(false)");
    expect(admin).toContain("getEarlyWarningTimeline");
    expect(admin).toContain("exposesToAdminOnly: true");
  });
});
