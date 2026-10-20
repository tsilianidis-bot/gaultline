/**
 * Day-trade, outlook, and FMOS response boundaries withhold non-finite numbers.
 * Scoring engines are not invoked here. Observed 0 stays 0. Dates stay timestamps.
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { withholdNonFiniteNumbers } from "./displayNumbers";
import { sanitizeNumbers as sanitizeFmos } from "./routers/fmos";
import { sanitizeNumbers as sanitizeOutlook } from "./routers/outlook";

const routers = readFileSync(new URL("./routers.ts", import.meta.url), "utf8");
const outlookPage = readFileSync(new URL("../client/src/pages/SignalOutlookCenter.tsx", import.meta.url), "utf8");
const dayTradePage = readFileSync(new URL("../client/src/pages/DayTradeIntelligence.tsx", import.meta.url), "utf8");
const hubPage = readFileSync(new URL("../client/src/pages/IntelligenceHub.tsx", import.meta.url), "utf8");

function sample() {
  return {
    observedZero: 0,
    missing: Number.NaN,
    unbounded: Number.POSITIVE_INFINITY,
    nested: { score: Number.NEGATIVE_INFINITY, kept: 12.5 },
    rows: [1, Number.NaN],
    when: new Date("2026-10-19T15:04:05.000Z"),
    label: "unchanged",
  };
}

describe("outlook and FMOS response sanitizers", () => {
  it("turns non-finite numbers into null and keeps an observed zero", () => {
    for (const sanitize of [sanitizeOutlook, sanitizeFmos, withholdNonFiniteNumbers]) {
      expect(sanitize(sample())).toEqual({
        observedZero: 0,
        missing: null,
        unbounded: null,
        nested: { score: null, kept: 12.5 },
        rows: [1, null],
        when: "2026-10-19T15:04:05.000Z",
        label: "unchanged",
      });
    }
  });

  it("day-trade responses use the same withhold and no longer substitute 0", () => {
    const dayTrade = routers.slice(routers.indexOf("dayTrade: router({"), routers.indexOf("getVisualDetail:"));
    expect(dayTrade).toContain("return withholdNonFiniteNumbers(result)");
    expect(dayTrade).toContain("const sanitizeNumbers = withholdNonFiniteNumbers;");
    expect(dayTrade).not.toMatch(/isFinite\(v\) && !isNaN\(v\)\) \? v : 0/);
  });
});

describe("unavailable numbers render as Unavailable", () => {
  it("outlook quotes and factor bars do not call toFixed on a missing number", () => {
    expect(outlookPage).toContain('if (typeof value !== "number" || !Number.isFinite(value)) return "Unavailable"');
    expect(outlookPage).toContain('width: finite == null ? "0%" : `${finite}%`');
    expect(outlookPage).toContain("usdQuote(d.calculatedLevels.currentPrice)");
    expect(outlookPage).toContain("usdQuote(item.level.price)");
    expect(outlookPage).toContain('ATR {typeof d.calculatedLevels.atrPct === "number"');
  });

  it("day-trade hold, reward ratio, and relative volume say Unavailable", () => {
    expect(dayTradePage).toContain('if (typeof mins !== "number" || !Number.isFinite(mins)) return "Unavailable"');
    expect(dayTradePage).toContain('typeof n === "number" && Number.isFinite(n) ? `${n.toFixed(1)}:1` : "Unavailable"');
    expect(dayTradePage).toContain('typeof n === "number" && Number.isFinite(n) ? `${n.toFixed(1)}x` : "Unavailable"');
  });

  it("the intelligence hub shows Unavailable for a missing FMOS confidence", () => {
    expect(hubPage).toContain('fmosData?.confidence?.score ?? "Unavailable"');
    expect(hubPage).toContain('fmosData?.evidence?.diversityScore ?? "Unavailable"');
    expect(hubPage).toContain('fmosData.decision.conviction != null ? String(fmosData.decision.conviction) : "Unavailable"');
  });
});
