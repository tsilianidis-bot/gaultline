import { describe, expect, it } from "vitest";
import { evaluateIntelligenceEvidence, type IntelligenceEvidence } from "./intelligenceIntegrity";

const now = Date.parse("2026-10-16T15:00:00.000Z");
const sample: IntelligenceEvidence = {
  id: "fred-10y", source: "FRED", origin: "observed", value: 4.2,
  observedAt: "2026-10-16T14:55:00.000Z", receivedAt: "2026-10-16T14:56:00.000Z",
  maxAgeMs: 10 * 60_000, sourceHealthy: true,
};
describe("intelligence integrity gate", () => {
  it("accepts verified observed inputs", () => {
    expect(evaluateIntelligenceEvidence(sample, now).status).toBe("verified");
  });
  it("rejects missing values instead of manufacturing neutral values", () => {
    expect(evaluateIntelligenceEvidence({ ...sample, value: null }, now)).toMatchObject({
      status: "unavailable", displayValue: null, canSupportCurrentClaim: false,
    });
  });
  it("rejects non-finite numeric values", () => {
    expect(evaluateIntelligenceEvidence({ ...sample, value: NaN }, now).canSupportCurrentClaim).toBe(false);
  });
  it("rejects stale values for current conclusions", () => {
    expect(evaluateIntelligenceEvidence({ ...sample, observedAt: "2026-10-15T14:55:00.000Z" }, now))
      .toMatchObject({ status: "stale", canSupportCurrentClaim: false });
  });
  it("fails closed if provider is unavailable", () => {
    expect(evaluateIntelligenceEvidence({ ...sample, sourceHealthy: false }, now))
      .toMatchObject({ status: "unavailable", canSupportCurrentClaim: false });
  });
  it("does not trust future or reversed timestamps", () => {
    expect(evaluateIntelligenceEvidence({ ...sample, observedAt: "2026-10-16T14:59:00.000Z" }, now).status)
      .toBe("unavailable");
  });
  it("requires model version for modeled outputs", () => {
    expect(evaluateIntelligenceEvidence({ ...sample, origin: "modeled" }, now).canSupportCurrentClaim).toBe(false);
    expect(evaluateIntelligenceEvidence({ ...sample, origin: "modeled", modelVersion: "v1" }, now).status)
      .toBe("delayed");
  });
});
