import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { equitySessionLevels } from "./signalsProxy";

describe("quote open is not copied from the current price", () => {
  it("keeps a supplied open, high, and low at two decimals", () => {
    expect(equitySessionLevels({ price: 451.02, open: 450.126, high: 452.2, low: 449.004 })).toEqual({
      open: 450.13,
      high: 452.2,
      low: 449,
    });
    expect(equitySessionLevels({ price: 100, open: 0, high: 0, low: 0 })).toEqual({
      open: 0,
      high: 0,
      low: 0,
    });
  });

  it("withholds open, high, and low when the source omits them", () => {
    expect(equitySessionLevels({ price: 451.02, open: null, high: null, low: null })).toEqual({
      open: null,
      high: null,
      low: null,
    });
    const proxy = readFileSync("server/signalsProxy.ts", "utf8");
    expect(proxy).not.toContain("yahooQuote.open ?? yahooQuote.price");
    expect(proxy).not.toContain("yahooQuote.high ?? yahooQuote.price");
    expect(proxy).not.toContain("yahooQuote.low ?? yahooQuote.price");
    const signals = readFileSync("client/src/pages/Signals.tsx", "utf8");
    expect(signals).not.toContain("lq.open > 0 ? lq.open : lq.price");
    expect(signals).not.toContain("lq.high > 0 ? lq.high : lq.price");
    expect(signals).not.toContain("lq.low > 0 ? lq.low : lq.price");
  });
});
