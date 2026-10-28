import { describe, expect, it } from "vitest";
import { getFeatureFlag, resolveFeatureFlag } from "./db";

describe("feature flags", () => {
  it("fails closed for sim_portfolio_visible when the database or the row is missing", () => {
    expect(resolveFeatureFlag("sim_portfolio_visible", null, false)).toBe(false);
    expect(resolveFeatureFlag("sim_portfolio_visible", undefined, true)).toBe(false);
    expect(resolveFeatureFlag("sim_portfolio_visible", { enabled: 0 }, true)).toBe(false);
    expect(resolveFeatureFlag("sim_portfolio_visible", { enabled: 1 }, true)).toBe(true);
  });

  it("does not take the pressure engine offline when its row is absent", () => {
    expect(resolveFeatureFlag("pressure_engine", null, false)).toBe(true);
    expect(resolveFeatureFlag("pressure_engine", undefined, true)).toBe(true);
    expect(resolveFeatureFlag("pressure_engine", { enabled: 0 }, true)).toBe(false);
  });

  it("hides the public simulation portfolio when no database is configured", async () => {
    expect(await getFeatureFlag("sim_portfolio_visible")).toBe(false);
  });
});
