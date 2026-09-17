import { describe, expect, it } from "vitest";
import {
  MARKETS_UNAVAILABLE_LABEL,
  areComparableObservations,
  crossAssetRelationship,
  isValidNumericObservation,
  rutVersusSpxSpread,
  usEquitiesReadSentence,
  usIndicesAdvancing,
} from "../shared/marketsMissingData";

describe("isValidNumericObservation", () => {
  it("accepts genuine zeros and signed finite values", () => {
    expect(isValidNumericObservation(0)).toBe(true);
    expect(isValidNumericObservation(-0)).toBe(true);
    expect(isValidNumericObservation(1.25)).toBe(true);
    expect(isValidNumericObservation(-0.4)).toBe(true);
  });

  it("rejects null, undefined, and non-finite numbers", () => {
    expect(isValidNumericObservation(null)).toBe(false);
    expect(isValidNumericObservation(undefined)).toBe(false);
    expect(isValidNumericObservation(Number.NaN)).toBe(false);
    expect(isValidNumericObservation(Number.POSITIVE_INFINITY)).toBe(false);
    expect(isValidNumericObservation(Number.NEGATIVE_INFINITY)).toBe(false);
  });
});

describe("usIndicesAdvancing", () => {
  it("shows Unavailable when every U.S. index observation is missing", () => {
    const display = usIndicesAdvancing([
      { changePercent: null, freshnessState: "UNAVAILABLE" },
      { changePercent: undefined, freshnessState: "UNAVAILABLE" },
      { changePercent: Number.NaN, freshnessState: "LIVE" },
    ]);
    expect(display).toEqual({
      kind: "unavailable",
      label: MARKETS_UNAVAILABLE_LABEL,
      value: null,
    });
    expect(display.label).not.toMatch(/0%/);
  });

  it("computes advancing share from partial data and ignores missing inputs", () => {
    const display = usIndicesAdvancing([
      { changePercent: 0.8, freshnessState: "LIVE" },
      { changePercent: null, freshnessState: "UNAVAILABLE" },
      { changePercent: -0.2, freshnessState: "LIVE" },
    ]);
    expect(display.kind).toBe("percent");
    if (display.kind === "percent") {
      expect(display.value).toBe(50);
      expect(display.label).toBe("50.0%");
    }
  });

  it("preserves genuine zeros as 0% advancing, not Unavailable", () => {
    const display = usIndicesAdvancing([
      { changePercent: 0, freshnessState: "LIVE" },
      { changePercent: 0, freshnessState: "LIVE" },
    ]);
    expect(display).toEqual({ kind: "percent", label: "0.0%", value: 0 });
  });

  it("counts only positives as advancing among mixed signed values", () => {
    const display = usIndicesAdvancing([
      { changePercent: 1.1, freshnessState: "LIVE" },
      { changePercent: 0, freshnessState: "LIVE" },
      { changePercent: -0.5, freshnessState: "LIVE" },
      { changePercent: 0.2, freshnessState: "LIVE" },
    ]);
    expect(display.kind).toBe("percent");
    if (display.kind === "percent") {
      expect(display.value).toBe(50);
    }
  });

  it("excludes stale observations so they cannot appear as live advancing", () => {
    const display = usIndicesAdvancing([
      { changePercent: 1.4, freshnessState: "STALE" },
      { changePercent: null, freshnessState: "UNAVAILABLE" },
    ]);
    expect(display.kind).toBe("unavailable");
  });
});

describe("rutVersusSpxSpread", () => {
  it("requires two valid comparable observations", () => {
    expect(areComparableObservations(
      { changePercent: 0.4, freshnessState: "LIVE" },
      { changePercent: 0.1, freshnessState: "LIVE" },
    )).toBe(true);
    expect(areComparableObservations(
      { changePercent: 0.4, freshnessState: "LIVE" },
      { changePercent: null, freshnessState: "UNAVAILABLE" },
    )).toBe(false);
    expect(areComparableObservations(
      { changePercent: 0.4, freshnessState: "LIVE" },
      { changePercent: 0.1, freshnessState: "DELAYED" },
    )).toBe(false);
  });

  it("shows Unavailable and omits commentary when either leg is missing", () => {
    const missingRut = rutVersusSpxSpread(
      { changePercent: null, freshnessState: "UNAVAILABLE" },
      { changePercent: 0.2, freshnessState: "LIVE" },
    );
    const missingSpx = rutVersusSpxSpread(
      { changePercent: 0.2, freshnessState: "LIVE" },
      undefined,
    );
    for (const display of [missingRut, missingSpx]) {
      expect(display.kind).toBe("unavailable");
      expect(display.label).toBe(MARKETS_UNAVAILABLE_LABEL);
      expect(display.commentary).toBeNull();
      expect(display.live).toBe(false);
    }
  });

  it("preserves a genuine-zero spread and in-line commentary when both are live zeros", () => {
    const display = rutVersusSpxSpread(
      { changePercent: 0, freshnessState: "LIVE" },
      { changePercent: 0, freshnessState: "LIVE" },
    );
    expect(display.kind).toBe("spread");
    if (display.kind === "spread") {
      expect(display.value).toBe(0);
      expect(display.label).toBe("+0.00%");
      expect(display.live).toBe(true);
      expect(display.commentary).toBe("Small and large caps roughly in line");
    }
  });

  it("reports positive and negative live spreads with matching commentary", () => {
    const outperforming = rutVersusSpxSpread(
      { changePercent: 1.0, freshnessState: "LIVE" },
      { changePercent: 0.2, freshnessState: "LIVE" },
    );
    const lagging = rutVersusSpxSpread(
      { changePercent: -0.5, freshnessState: "LIVE" },
      { changePercent: 0.2, freshnessState: "LIVE" },
    );
    expect(outperforming.kind).toBe("spread");
    if (outperforming.kind === "spread") {
      expect(outperforming.value).toBeCloseTo(0.8);
      expect(outperforming.commentary).toBe("Small caps outperforming — broad participation");
    }
    expect(lagging.kind).toBe("spread");
    if (lagging.kind === "spread") {
      expect(lagging.value).toBeCloseTo(-0.7);
      expect(lagging.label).toBe("-0.70%");
      expect(lagging.commentary).toBe("Large caps leading — narrow rally");
    }
  });

  it("does not treat delayed quotes as live outperformance commentary", () => {
    const display = rutVersusSpxSpread(
      { changePercent: 1.2, freshnessState: "DELAYED" },
      { changePercent: 0.1, freshnessState: "DELAYED" },
    );
    expect(display.kind).toBe("spread");
    if (display.kind === "spread") {
      expect(display.value).toBeCloseTo(1.1);
      expect(display.live).toBe(false);
      expect(display.commentary).toBeNull();
    }
  });
});

describe("missing inputs must not invent Mixed/Neutral/directional reads", () => {
  it("returns Unavailable for cross-asset rows when either side is missing", () => {
    expect(
      crossAssetRelationship({
        left: "unavailable",
        right: "risk-on",
        fallback: "Neutral",
        isAligned: false,
        isDivergence: true,
        divergence: "Divergence — watch for reversal",
      }),
    ).toBe(MARKETS_UNAVAILABLE_LABEL);
    expect(
      crossAssetRelationship({
        left: undefined,
        right: undefined,
        fallback: "Mixed",
        isAligned: false,
        isDivergence: false,
      }),
    ).toBe(MARKETS_UNAVAILABLE_LABEL);
  });

  it("allows Neutral/Mixed only when both tones are present", () => {
    expect(
      crossAssetRelationship({
        left: "stable",
        right: "mixed",
        fallback: "Neutral",
        isAligned: false,
        isDivergence: false,
      }),
    ).toBe("Neutral");
    expect(
      crossAssetRelationship({
        left: "strengthening",
        right: "risk-on",
        fallback: "Neutral",
        isAligned: false,
        isDivergence: true,
        divergence: "Divergence — watch for reversal",
      }),
    ).toBe("Divergence — watch for reversal");
  });

  it("does not write a Mixed U.S. read from unavailable equities", () => {
    expect(usEquitiesReadSentence("unavailable")).toBeNull();
    expect(usEquitiesReadSentence(undefined)).toBeNull();
    expect(usEquitiesReadSentence("mixed")).toContain("mixed");
    expect(usEquitiesReadSentence("risk-on")).toContain("advancing");
  });
});
