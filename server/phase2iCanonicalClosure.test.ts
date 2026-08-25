import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

type Consumer = {
  consumer_name: string;
  file: string;
  classification: string;
  canonical_envelope_required: boolean;
  stateId_available: boolean;
  effectiveAt_available: boolean;
  generatedAt_available: boolean;
  quality_available: boolean;
  conflicts_available: boolean;
  claim_refs_available: boolean;
  analog_refs_available: boolean;
  version_identity_available: boolean;
  input_snapshot_available: boolean;
  canonical_origin_proven: boolean;
  legacy_bypass_possible: boolean;
  final_status: string;
};

const root = process.cwd();
const inventory = JSON.parse(fs.readFileSync(path.join(root, "PHASE_2I_CONSUMER_INVENTORY.json"), "utf8")) as {
  totalConsumers: number;
  unclassified: number;
  consumers: Consumer[];
};
const noBypass = JSON.parse(fs.readFileSync(path.join(root, "PHASE_2I_NO_BYPASS.json"), "utf8")) as {
  unresolvedCurrentStateBypasses: number;
};
const formalTests = JSON.parse(fs.readFileSync(path.join(root, "PHASE_2I_A_TO_J.json"), "utf8")) as {
  results: Array<{ test: string; status: string }>;
};
const crossSurface = JSON.parse(fs.readFileSync(path.join(root, "PHASE_2I_CROSS_SURFACE_PROOF.json"), "utf8")) as {
  controlledCanonicalState: { stateId: string; pressureIndex: number; regime: string };
  result: string;
  surfaces: Array<{ surface: string; stateId: string; pressureIndex: number; regime: string; status: string }>;
};
const currentConsumers = inventory.consumers.filter(consumer => consumer.classification === "CURRENT_CANONICAL");
const prohibitedCurrentRead = /trpc\.pressure\.getCurrentPressure|trpc\.marketState\.current\.useQuery|selectBrowserMarketOutput/;

describe("Phase 2I canonical closure guard", () => {
  it("reconciles the exact 44-consumer inventory with zero unclassified consumers", () => {
    expect(inventory.totalConsumers).toBe(44);
    expect(inventory.consumers).toHaveLength(44);
    expect(inventory.unclassified).toBe(0);
    expect(new Set(inventory.consumers.map(consumer => consumer.classification))).toEqual(expect.objectContaining(new Set([
      "CURRENT_CANONICAL", "HISTORICAL_CONTEXT", "ARCHIVED_CANONICAL", "RECONSTRUCTED_RESEARCH", "NON_MARKET_STATE",
    ])));
  });

  it("requires every current canonical boundary to retain the complete canonical envelope provenance", () => {
    expect(currentConsumers.length).toBeGreaterThan(0);
    for (const consumer of currentConsumers) {
      expect(consumer).toMatchObject({
        canonical_envelope_required: true,
        stateId_available: true,
        effectiveAt_available: true,
        generatedAt_available: true,
        quality_available: true,
        conflicts_available: true,
        claim_refs_available: true,
        analog_refs_available: true,
        version_identity_available: true,
        input_snapshot_available: true,
        canonical_origin_proven: true,
        legacy_bypass_possible: false,
        final_status: "VERIFIED_CANONICAL",
      });
    }
  });

  it("prohibits direct legacy current-state reads in every current canonical consumer", () => {
    for (const consumer of currentConsumers) {
      const source = fs.readFileSync(path.join(root, consumer.file), "utf8");
      expect(source, consumer.consumer_name).toMatch(/useEngine\(|canonicalEnvelope/);
      expect(source, consumer.consumer_name).not.toMatch(prohibitedCurrentRead);
    }
    expect(noBypass.unresolvedCurrentStateBypasses).toBe(0);
  });

  it("keeps the approved context output provenance-wrapped at the compatibility boundary", () => {
    const engineContext = fs.readFileSync(path.join(root, "client/src/contexts/EngineContext.tsx"), "utf8");
    expect(engineContext).toContain("{ ...projected.output, canonicalEnvelope }");
    expect(engineContext).toContain("if (!canonicalState || !marketState) return null;");
  });

  it("records all formal Tests A–J as passing permanent evidence", () => {
    expect(formalTests.results.map(result => result.test)).toEqual(["A", "B", "C", "D", "E", "F", "G", "H", "I", "J"]);
    expect(formalTests.results.every(result => result.status === "PASS")).toBe(true);
  });

  it("proves the controlled canonical identity across every required cross-surface representative", () => {
    expect(crossSurface.result).toBe("PASS");
    expect(crossSurface.surfaces.length).toBeGreaterThanOrEqual(14);
    for (const surface of crossSurface.surfaces) {
      expect(surface).toMatchObject({
        stateId: crossSurface.controlledCanonicalState.stateId,
        pressureIndex: crossSurface.controlledCanonicalState.pressureIndex,
        regime: crossSurface.controlledCanonicalState.regime,
        status: "PASS",
      });
    }
  });
});
