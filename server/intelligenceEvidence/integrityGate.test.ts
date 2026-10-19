import { describe, expect, it } from "vitest";
import { evaluateIntelligenceEvidence } from "../../shared/intelligenceIntegrity";

const now = Date.parse("2026-10-16T15:00:00.000Z");
const verified = {
  id: "fred:DGS10",
  source: "Federal Reserve Economic Data (FRED)",
  origin: "observed" as const,
  value: 4.12,
  observedAt: "2026-10-16T14:55:00.000Z",
  receivedAt: "2026-10-16T14:56:00.000Z",
  maxAgeMs: 10 * 60_000,
  sourceHealthy: true,
};

describe("Phase 0 Integrity Gate — executable Phase 1 boundary", () => {
  it("admits only a valid, current, source-identified observation", () => {
    expect(evaluateIntelligenceEvidence(verified, now)).toMatchObject({ status: "verified", canSupportCurrentClaim: true, displayValue: 4.12 });
  });

  it.each([
    ["invalid number", { value: Number.NaN }],
    ["missing timestamp", { observedAt: null }],
    ["unknown source", { source: "" }],
    ["provider failure", { sourceHealthy: false }],
    ["stale source", { observedAt: "2026-10-15T14:55:00.000Z" }],
  ])("rejects %s without a replacement market claim", (_label, patch) => {
    const outcome = evaluateIntelligenceEvidence({ ...verified, ...patch }, now);
    expect(outcome.canSupportCurrentClaim).toBe(false);
  });

  it("requires a model version for canonical or other modeled output", () => {
    expect(evaluateIntelligenceEvidence({ ...verified, origin: "modeled" }, now)).toMatchObject({ status: "unavailable", canSupportCurrentClaim: false });
    expect(evaluateIntelligenceEvidence({ ...verified, origin: "modeled", modelVersion: "champion-v1" }, now)).toMatchObject({ status: "delayed", canSupportCurrentClaim: true });
  });
});
