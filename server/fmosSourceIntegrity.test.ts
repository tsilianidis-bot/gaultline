import { describe, it, expect, vi, beforeEach } from "vitest";
import type { FaultlinePressureOutput, PressureInputProvenance } from "./pressure/engine";
import { adaptVerifiedPressureToFmosMacro, hasVerifiedFmosMacroInputs } from "./fmos/engines/dataAcquisition";
import { computeMarketDNA } from "./fmos/engines/marketDNA";
import { computeEvidence } from "./fmos/engines/evidence";
import { runFMOSPipelineFast } from "./fmos/pipeline";
import { projectPressureFromCanonical } from "./canonicalPressureProjection";

const fixtures = vi.hoisted(() => ({ canonical: null as any, read: vi.fn() }));
vi.mock("./canonicalIntelligenceState", async importOriginal => ({
  ...await importOriginal<typeof import("./canonicalIntelligenceState")>(),
  getAuthoritativeCanonicalIntelligenceState: fixtures.read,
}));
vi.mock("./fredClient", () => ({ fetchFredBulk: vi.fn(() => { throw new Error("No provider calls permitted in fixture tests"); }) }));
const AS_OF = "2026-10-16T20:30:00.000Z";
const VECTOR_IDS = ["liquidity-stress", "credit-contagion", "volatility-regime", "macro-sensitivity", "market-breadth", "ai-bubble"];
/** MOCK SOURCE FIXTURE ONLY: no live values, network, credentials, or database. */
function pressureFixture(): FaultlinePressureOutput {
  const values: Array<[PressureInputProvenance["inputId"], number]> = [["hySpread", 320], ["tsy10y", 4], ["tsy2y", 3.5], ["sofr", 4.2], ["fedFunds", 4.25], ["cpi", 2.8], ["ppi", 2.1], ["unemployment", 4.1]];
  return {
    overallPressure: 35, regime: "MODERATE RISK", level: "Moderate", dataSource: "live", timestamp: AS_OF, lastUpdated: AS_OF, priorPressure: null,
    vectors: VECTOR_IDS.map((id, index) => ({ id, label: id, description: "mock input fixture", score: 25 + index * 5,
      level: "Moderate", driver: "fixture", trend: "stable", weight: 0, rawInputs: {}, dataStatus: "live", source: "FRED/mock-fixture" })),
    alerts: [], analogs: [], topAnalog: { year: 0, label: "Unavailable", similarity: 0, description: "No historical fixture source" },
    verification: { status: "verified", methodologyVersion: "mock-source-fixture-v1", computedAt: AS_OF, problems: [],
      inputs: values.map(([inputId, value]) => ({ inputId, seriesId: `MOCK:${inputId}`, value, observationDate: "2026-10-15", status: "verified" })) },
  };
}
function canonicalFixture(pressure: FaultlinePressureOutput) {
  return { stateId: "state:mock-fmos-1", inputSnapshotId: "input:mock-fmos-1", stateHash: "hash:mock-fmos-1",
    pressureIndex: pressure.overallPressure, regime: pressure.regime, generatedAt: AS_OF, effectiveAt: AS_OF,
    confidenceOrEvidenceQuality: "HEALTHY", provenance: { coherenceStatus: "COHERENT" },
    domains: { pressureVerification: pressure.verification },
    engines: pressure.vectors.map(vector => ({ engineId: vector.id, engineName: vector.label, value: vector.score,
      direction: "Stable", qualityStatus: "HEALTHY", freshnessStatus: "CURRENT", fallbackStatus: "NONE" })),
  } as any;
}
beforeEach(() => { fixtures.read.mockReset(); fixtures.read.mockImplementation(async () => fixtures.canonical); fixtures.canonical = null; });

describe("FMOS canonical source integrity — mocked fixtures only", () => {
  it("withholds missing, malformed, stale and nonfinite macro inputs rather than defaults", () => {
    const pressure = pressureFixture();
    for (const verification of [undefined, { ...pressure.verification!, status: "stale" as const },
      { ...pressure.verification!, inputs: pressure.verification!.inputs.filter(item => item.inputId !== "cpi") },
      { ...pressure.verification!, inputs: pressure.verification!.inputs.map(item => item.inputId === "cpi" ? { ...item, value: Number.NaN } : item) }]) {
      const input = { ...pressure, verification };
      const macro = adaptVerifiedPressureToFmosMacro(input);
      expect(hasVerifiedFmosMacroInputs(macro)).toBe(false);
      expect(macro.cpiYoY).toBeNull();
      expect(computeMarketDNA(input, macro)).toMatchObject({ available: false, currentDNA: null, confidence: null });
      expect(computeEvidence(input, macro)).toMatchObject({ available: false });
    }
  });
  it("uses original source dates and values from the canonical projection without a second provider read", () => {
    const original = pressureFixture();
    const projected = projectPressureFromCanonical(canonicalFixture(original));
    expect(projected?.verification).toEqual(original.verification);
    expect(adaptVerifiedPressureToFmosMacro(projected!)).toMatchObject({ hySpreadBps: 320, cpiYoY: 2.8, macroAsOf: AS_OF,
      observationDates: { hySpread: "2026-10-15" } });
  });
  it("produces identical derived evidence/DNA for identical source inputs and no invented history or duration", () => {
    const pressure = pressureFixture(), macro = adaptVerifiedPressureToFmosMacro(pressure);
    const first = computeMarketDNA(pressure, macro);
    expect(first).toEqual(computeMarketDNA(pressure, macro));
    expect(computeEvidence(pressure, macro)).toEqual(computeEvidence(pressure, macro));
    expect(first).toMatchObject({ available: true, confidence: null, historicalFrequency: null, estimatedDuration: null });
    expect(first.portfolioImplications.every(text => text.startsWith("MODEL_ASSUMPTION"))).toBe(true);
  });
  it("scheduled override reuses the verified run input, while public calls resolve one canonical state", async () => {
    const pressure = pressureFixture();
    const result = await runFMOSPipelineFast({ pressureOverride: pressure });
    expect(fixtures.read).not.toHaveBeenCalled();
    expect(result.pressure).toBe(pressure);
    fixtures.canonical = canonicalFixture(pressure);
    const canonicalResult = await runFMOSPipelineFast();
    expect(fixtures.read).toHaveBeenCalledTimes(1);
    expect(canonicalResult.canonicalStateId).toBe("state:mock-fmos-1");
    expect(canonicalResult.pressure.overallPressure).toBe(pressure.overallPressure);
  });
  it("fails closed on absent canonical state or raw canonical macro provenance", async () => {
    await expect(runFMOSPipelineFast()).rejects.toThrow(/unavailable/i);
    fixtures.canonical = { ...canonicalFixture(pressureFixture()), domains: {} };
    await expect(runFMOSPipelineFast()).rejects.toThrow(/exact verified macro/i);
  });
});
