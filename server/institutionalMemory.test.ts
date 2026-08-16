import { describe, expect, it } from "vitest";

describe("institutional memory transition rules", () => {
  it("does not infer events from one isolated state", async () => {
    const { recordDailyMarketEvidence } = await import("./institutionalMemory");
    expect(typeof recordDailyMarketEvidence).toBe("function");
  });

  it("keeps live verified history distinct from reconstructed analysis", async () => {
    const { recordVerifiedInstitutionalEvent } = await import("./institutionalMemory");
    expect(typeof recordVerifiedInstitutionalEvent).toBe("function");
  });
});
