import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(process.cwd());
const source = (path: string) => readFileSync(resolve(root, path), "utf8");

describe("Phase 5 cross-engine integration boundaries", () => {
  it("exposes one deterministic synthesis through the canonical market-state router", () => {
    const router = source("server/routers/marketState.ts");
    expect(router).toContain('getAuthoritativeCrossEngineSynthesis');
    expect(router).toContain('synthesisCurrent: publicProcedure.query(() => getAuthoritativeCrossEngineSynthesis())');
  });

  it("binds ASHA and Oracle to governed synthesis input and returns its exact identity in integrity metadata", () => {
    const asha = source("server/ashaEngine.ts");
    const oracle = source("server/routers/smartDiscovery.ts");
    for (const module of [asha, oracle]) {
      expect(module).toContain('buildCrossEngineSynthesis(');
      expect(module).toContain('buildCrossEngineSynthesisPromptContract(');
      expect(module).toContain('synthesisId:');
      expect(module).toContain('originatingStateId:');
    }
    expect(asha).toContain('governedCrossEngineSynthesis');
    expect(oracle).toContain('const crossEngineSynthesis = publicCanonicalState && evidencePacket');
  });

  it("persists only material synthesis changes to the existing immutable archive without Early Warning lifecycle logic", () => {
    const service = source("server/crossEngineSynthesis.ts");
    const scheduled = source("server/scheduledSeismograph.ts");
    expect(service).toContain('persistCrossEngineSynthesis');
    expect(service).toContain('recordVerifiedInstitutionalEvent');
    expect(service).toContain('cross_engine_divergence_emerged');
    expect(service).not.toContain('warningScore:');
    expect(service).not.toContain('warningLifecycle');
    expect(service).not.toContain('EARLY_WARNING');
    expect(scheduled).toContain('persistCrossEngineSynthesis(synthesis)');
  });

  it("keeps raw synthesis audit visibility behind an admin procedure", () => {
    const admin = source("server/routers/admin.ts");
    expect(admin).toContain('getCrossEngineSynthesisDebug: adminProcedure');
    expect(admin).toContain('exposesToAdminOnly: true');
  });

  it("retains public synthesis identity through the ASHA client mapping and labels it at the briefing boundary", () => {
    const ashaPanel = source("client/src/components/AshaPanel.tsx");
    const briefing = source("client/src/components/OracleBriefing.tsx");
    expect(ashaPanel).toContain('synthesisProvenance: response.integrity?.synthesis');
    expect(briefing).toContain('synthesisProvenance?:');
    expect(briefing).toContain('GOVERNED SYNTHESIS ${data.synthesisProvenance.synthesisId}');
  });
});
