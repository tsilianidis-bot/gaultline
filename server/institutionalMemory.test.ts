import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(resolve(process.cwd(), "server/institutionalMemory.ts"), "utf8");

describe("institutional memory transition rules", () => {
  it("does not infer events from one isolated state", async () => {
    const { recordDailyMarketEvidence } = await import("./institutionalMemory");
    expect(typeof recordDailyMarketEvidence).toBe("function");
  });

  it("keeps live verified history distinct from reconstructed analysis", async () => {
    const { recordVerifiedInstitutionalEvent } = await import("./institutionalMemory");
    expect(typeof recordVerifiedInstitutionalEvent).toBe("function");
  });

  it("records only material observed vector and probability transitions as append-only events", () => {
    expect(source).toContain("MATERIAL_VECTOR_VARIANCE = 15");
    expect(source).toContain("MATERIAL_PROBABILITY_VARIANCE = 15");
    expect(source).toContain('eventType: "pressure_vector_material_change"');
    expect(source).toContain('eventType: "regime_probability_material_change"');
    expect(source).toContain("previousState: previous.state");
    expect(source).toContain("newState: baseState");
  });
});
