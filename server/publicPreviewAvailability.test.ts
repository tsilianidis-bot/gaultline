import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync("client/src/pages/PressureIndex.tsx", "utf8");
describe("public preview capability boundaries", () => {
  it("does not advertise calibrated probabilities or an unsupported forecast horizon", () => {
    expect(source).not.toContain("regime probability, and actionable intelligence for the next 30 days");
    expect(source).toContain("Unavailable confidence levels, scenario probabilities, and forecast horizons are withheld.");
    expect(source).not.toContain("ratings across 50+ tickers");
  });
  it("does not market inactive paid plans as purchasable offers", () => {
    expect(source).toContain("Paid plans are not on sale; registration and checkout settings remain unchanged.");
    expect(source).not.toContain("FAULTLINE Lifetime is $1,500 one-time");
  });
});
