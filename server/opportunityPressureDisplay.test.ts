/**
 * QA final pass (e9d45f9) item: Opportunity Engine showed "PRESSURE: 33"
 * (its cached scoring pressure) beside the canonical 34. Display only: the
 * label shows the canonical Pressure Index or UNAVAILABLE; the scoring input
 * (payload pressureIndex) is unchanged.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { canonicalPressureLabel, canonicalPressureValue } from "../client/src/lib/canonicalPressureDisplay";

const read = (p: string) => readFileSync(resolve(process.cwd(), p), "utf8");

describe("Opportunity Engine pressure label", () => {
  it("shows the canonical Pressure Index, or UNAVAILABLE", () => {
    expect(canonicalPressureLabel({ pressureIndex: 34 })).toBe("34");
    expect(canonicalPressureValue({ pressureIndex: 34 })).toBe(34);
    expect(canonicalPressureLabel({ pressureIndex: 34.04 })).toBe("34");
    expect(canonicalPressureLabel({ pressureIndex: 33.75 })).toBe("33.8");
    expect(canonicalPressureLabel({ pressureIndex: null })).toBe("UNAVAILABLE");
    expect(canonicalPressureLabel({ pressureIndex: Number.NaN })).toBe("UNAVAILABLE");
    expect(canonicalPressureLabel(null)).toBe("UNAVAILABLE");
    expect(canonicalPressureValue(undefined)).toBeNull();
  });

  it("the panel and the Opportunities page render the canonical value, not the scoring pressure", () => {
    const panel = read("client/src/components/OpportunityDiscoveryPanel.tsx");
    const page = read("client/src/pages/Opportunities.tsx");
    for (const src of [panel, page]) {
      expect(src).toContain("const { canonicalState } = useEngine();");
      expect(src).toContain("canonicalPressureLabel(canonicalState)");
      expect(src).not.toMatch(/data\.pressureIndex/);
    }
    expect(panel).toContain("PRESSURE: <span");
    expect(panel).toContain("{displayPressureLabel}</span>");
    expect(page).toContain("PRESSURE {displayPressureLabel} ·");
  });

  it("does not touch the opportunity scoring inputs", () => {
    const outlook = read("server/signalOutlook.ts");
    expect(outlook).toContain("const pressure = await calculateFaultlinePressure();");
    expect(outlook).toContain("pressureIndex: p,");
  });
});
