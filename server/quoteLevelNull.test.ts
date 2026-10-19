import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { formatUsdQuote } from "../client/src/lib/nullableFormat";
import { fixedQuoteLevel } from "./signalsProxy";

describe("a missing quote open, high, or low stays null", () => {
  it("keeps an observed level, including 0, at two decimals", () => {
    expect(fixedQuoteLevel(101.239)).toBe(101.24);
    expect(fixedQuoteLevel(0)).toBe(0);
    expect(formatUsdQuote(101.239)).toBe("$101.24");
    expect(formatUsdQuote(0)).toBe("$0.00");
  });

  it("does not turn a missing level into 0", () => {
    expect(fixedQuoteLevel(null)).toBeNull();
    expect(fixedQuoteLevel(undefined)).toBeNull();
    expect(fixedQuoteLevel(Number.NaN)).toBeNull();
    expect(formatUsdQuote(null)).toBe("Unavailable");
    const signals = readFileSync("server/signalsProxy.ts", "utf8");
    expect(signals).not.toMatch(/open: 0,\s*high: 0,\s*low: 0/);
    expect(signals).not.toContain("?? 0).toFixed(2)");
    const search = readFileSync("client/src/components/TickerSearch.tsx", "utf8");
    expect(search).not.toContain("profile.open.toFixed");
    expect(search).not.toContain("profile.high.toFixed");
    expect(search).not.toContain("profile.low.toFixed");
    expect(search).toContain("formatUsdQuote(profile.open)");
  });
});
