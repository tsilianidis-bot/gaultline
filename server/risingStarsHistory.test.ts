import { describe, expect, it } from "vitest";
import { determineRisingStarEvents, isQualifiedRisingStar } from "./risingStarsHistory";

describe("Rising Stars verified-history event rules", () => {
  const base = { ticker: "SOFI", risingStarScore: 64, signalStrength: "MODERATE" as const, riskLevel: "MODERATE" as const };

  it("defines qualification from the canonical score threshold", () => {
    expect(isQualifiedRisingStar({ risingStarScore: 60 })).toBe(true);
    expect(isQualifiedRisingStar({ risingStarScore: 59 })).toBe(false);
  });

  it("creates a first-qualification event only from a genuinely observed live item", () => {
    expect(determineRisingStarEvents(null, base).map(event => event.type)).toEqual(["first_qualification"]);
  });

  it("captures material strengthening, confirmation, and elevated risk transitions", () => {
    const events = determineRisingStarEvents({ id: 1, qualification: "qualified", risingStarScore: 60, signalConfidence: "MODERATE", riskLevel: "MODERATE" }, { ...base, risingStarScore: 70, signalStrength: "HIGH", riskLevel: "ELEVATED" });
    expect(events.map(event => event.type)).toEqual(expect.arrayContaining(["score_strengthened", "confirmation", "risk_threshold"]));
  });

  it("does not manufacture invalidation or removal from unavailable engine output", () => {
    const events = determineRisingStarEvents({ id: 1, qualification: "qualified", risingStarScore: 64, signalConfidence: "MODERATE", riskLevel: "MODERATE" }, { ...base, risingStarScore: 58 });
    expect(events.map(event => event.type)).not.toContain("invalidation");
    expect(events.map(event => event.type)).not.toContain("removed");
  });
});
