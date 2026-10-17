import { describe, expect, it } from "vitest";
import { PRESSURE_SCALE } from "../shared/pressureScale";
import { CHAMPION_REGIME_THRESHOLDS } from "./pressure/championBaseline";

describe("shared pressure scale display labels", () => {
  it("uses the engine's regime names and thresholds for every band", () => {
    const engine = [...CHAMPION_REGIME_THRESHOLDS].sort((a, b) => a.minimum - b.minimum);
    expect(PRESSURE_SCALE.map(b => b.min)).toEqual(engine.map(t => t.minimum));
    expect(PRESSURE_SCALE.map(b => b.label)).toEqual(engine.map(t => t.regime));
  });
});
