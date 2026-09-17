import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  advancingShare,
  appearsLive,
  overlayLabel,
  relationshipRead,
  rutSpxCommentary,
  rutVersusSpxSpread,
  usEquityRead,
  validChangePercent,
} from "../shared/marketsDisplay";

describe("Markets missing-data display", () => {
  it("treats null, undefined, and non-finite change percents as missing, not zero", () => {
    expect(validChangePercent(null)).toBeNull();
    expect(validChangePercent(undefined)).toBeNull();
    expect(validChangePercent(Number.NaN)).toBeNull();
    expect(validChangePercent(Number.POSITIVE_INFINITY)).toBeNull();
    expect(validChangePercent(Number.NEGATIVE_INFINITY)).toBeNull();
    expect(validChangePercent(0)).toBe(0);
    expect(validChangePercent(-0.4)).toBe(-0.4);
  });

  it("shows Unavailable advancing share when U.S. index observations are missing", () => {
    expect(advancingShare([])).toBeNull();
    expect(advancingShare([null, undefined, Number.NaN])).toBeNull();
    expect(advancingShare([
      { changePercent: null, freshnessState: "UNAVAILABLE" },
      { changePercent: Number.NaN, freshnessState: "LIVE" },
    ])).toBeNull();
    expect(overlayLabel("unavailable")).toBe("Unavailable");
  });

  it("preserves a genuine zero advancing share when every valid observation is unchanged", () => {
    expect(advancingShare([0, 0, 0])).toBe(0);
    expect(advancingShare([0, -0.1])).toBe(0);
    expect(advancingShare([
      { changePercent: 0, freshnessState: "LIVE" },
      { changePercent: 0, freshnessState: "LIVE" },
    ])).toBe(0);
  });

  it("computes advancing share from partial valid data without filling missing names", () => {
    expect(advancingShare([1.2, null, -0.4, undefined])).toBe(50);
    expect(advancingShare([0.1, 0.2, 0.3])).toBe(100);
    expect(advancingShare([-0.1, -0.2])).toBe(0);
    expect(advancingShare([
      { changePercent: 0.8, freshnessState: "LIVE" },
      { changePercent: null, freshnessState: "UNAVAILABLE" },
      { changePercent: -0.2, freshnessState: "LIVE" },
    ])).toBe(50);
  });

  it("excludes stale observations from advancing share", () => {
    expect(advancingShare([
      { changePercent: 1.4, freshnessState: "STALE" },
      { changePercent: null, freshnessState: "UNAVAILABLE" },
    ])).toBeNull();
    expect(advancingShare([
      { changePercent: 1.4, freshnessState: "STALE" },
      { changePercent: -0.2, freshnessState: "LIVE" },
    ])).toBe(0);
  });

  it("calculates RUT versus SPX only with two valid comparable observations", () => {
    expect(rutVersusSpxSpread(1.2, 0.4).value).toBeCloseTo(0.8);
    expect(rutVersusSpxSpread(0, 0).value).toBe(0);
    expect(rutVersusSpxSpread(-0.5, 0.1).value).toBeCloseTo(-0.6);
    expect(rutVersusSpxSpread(null, 0.4).value).toBeNull();
    expect(rutVersusSpxSpread(1.2, undefined).value).toBeNull();
    expect(rutVersusSpxSpread(Number.NaN, 0.4).value).toBeNull();
    expect(rutSpxCommentary(null)).toBeNull();
    expect(rutSpxCommentary(0.8)).toContain("Small caps outperforming");
    expect(rutSpxCommentary(-0.8)).toContain("Large caps leading");
    expect(rutSpxCommentary(0)).toContain("roughly in line");
    expect(rutVersusSpxSpread(
      { changePercent: 1.2, freshnessState: "LIVE" },
      { changePercent: 0.4, freshnessState: "DELAYED" },
    ).value).toBeNull();
    expect(rutVersusSpxSpread(
      { changePercent: 1.2, freshnessState: "UNAVAILABLE" },
      { changePercent: 0.4, freshnessState: "LIVE" },
    ).value).toBeNull();
  });

  it("shows delayed RUT/SPX spread without live outperformance commentary", () => {
    const delayed = rutVersusSpxSpread(
      { changePercent: 1.2, freshnessState: "DELAYED" },
      { changePercent: 0.1, freshnessState: "DELAYED" },
    );
    expect(delayed.value).toBeCloseTo(1.1);
    expect(delayed.live).toBe(false);
    expect(rutSpxCommentary(delayed.value, delayed.live)).toBeNull();
  });

  it("does not invent Mixed, Neutral, or directional reads from missing inputs", () => {
    expect(usEquityRead("unavailable")).toBeNull();
    expect(usEquityRead(undefined)).toBeNull();
    expect(usEquityRead("mixed")).toContain("mixed");
    expect(usEquityRead("risk-on")).toContain("advancing");
    expect(usEquityRead("risk-off")).toContain("under pressure");
    expect(relationshipRead("unavailable", "risk-on", "aligned", "divergent", "Neutral")).toBe("Unavailable");
    expect(relationshipRead("strengthening", "unavailable", "aligned", "divergent", "Neutral")).toBe("Unavailable");
    expect(relationshipRead("strengthening", "risk-on", "aligned", "divergent", "Neutral")).toBe("divergent");
    expect(relationshipRead("weakening", "risk-on", "aligned", "divergent", "Neutral")).toBe("aligned");
    expect(relationshipRead("stable", "mixed", "aligned", "divergent", "Neutral")).toBe("Neutral");
  });

  it("never treats delayed or stale freshness as live", () => {
    expect(appearsLive("LIVE")).toBe(true);
    expect(appearsLive("DELAYED")).toBe(false);
    expect(appearsLive("STALE")).toBe(false);
    expect(appearsLive("UNAVAILABLE")).toBe(false);
    expect(appearsLive("LATEST_VERIFIED")).toBe(false);
  });

  it("keeps Markets.tsx from coercing missing observations to 0%", () => {
    const source = readFileSync(resolve(import.meta.dirname, "../client/src/pages/Markets.tsx"), "utf8");
    expect(source).not.toContain("changePercent ?? 0");
    expect(source).not.toContain("U.S. equity markets are mixed, with no clear directional conviction across major indices.");
    expect(source).toContain("advancingShare");
    expect(source).toContain("rutVersusSpxSpread");
    expect(source).toContain("Unavailable");
  });
});
