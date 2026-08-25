import { describe, expect, it } from "vitest";
import { buildForwardChampionProvenance } from "./algorithmProvenance";

describe("forward Champion provenance", () => {
  const pressure = {
    overallPressure: 41,
    regime: "ELEVATED RISK",
    level: "Elevated",
    timestamp: "2026-08-19T18:00:00.000Z",
    lastUpdated: "2026-08-19T17:55:00.000Z",
    dataSource: "live",
    priorPressure: 39,
    alerts: [],
    topAnalog: { year: 2008, label: "Example", similarity: 0, description: "test" },
    analogs: [],
    vectors: [
      { id: "liquidityStress", label: "Liquidity", description: "", score: 42, level: "Elevated", driver: "", trend: "stable", weight: 0.2, rawInputs: { BAMLH0A0HYM2: 350 }, dataStatus: "live", source: "FRED" },
      { id: "creditContagion", label: "Credit", description: "", score: 40, level: "Moderate", driver: "", trend: "stable", weight: 0.2, rawInputs: { DGS10: 4.2 }, dataStatus: "live", source: "FRED" },
    ],
  } as any;

  it("records formula, raw input, and release-metadata absence without claiming point-in-time replay", () => {
    const provenance = buildForwardChampionProvenance(pressure, new Date("2026-08-19T18:00:00.000Z"));
    expect(provenance.observationKey).toContain("2026-08-19");
    expect(provenance.formulaHash).toHaveLength(64);
    expect(provenance.provenanceStatus).toBe("forward_observed_unvintaged");
    expect(provenance.inputManifestJson).toContain("BAMLH0A0HYM2");
    expect(provenance.availabilityJson).toContain("release_metadata_not_captured");
  });
});
