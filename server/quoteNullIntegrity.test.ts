import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { deriveMomentum } from "./cryptoEngine";
import {
  polygonSnapshotQuoteFields,
  screenerQuoteFields,
} from "./yahooProxy";
import {
  assemblePolygonBarQuote,
  resolveSignalChangePercent,
  resolveSignalVolume,
} from "./signalsProxy";

const read = (rel: string) => readFileSync(resolve(import.meta.dirname, "..", rel), "utf8");

describe("missing 7-day momentum is withheld", () => {
  it("keeps the prior label when the 7-day change is a number, including 0", () => {
    expect(deriveMomentum(4, 6)).toBe("Accelerating");
    expect(deriveMomentum(-4, -6)).toBe("Reversing");
    expect(deriveMomentum(1, 0)).toBe("Stable");
    expect(deriveMomentum(4, 0)).toBe("Decelerating");
  });

  it("does not count a missing 7-day change as 0", () => {
    expect(deriveMomentum(4, null)).toBe("Unavailable");
    expect(deriveMomentum(4, Number.NaN)).toBe("Unavailable");
    expect(deriveMomentum(1, null)).not.toBe("Stable");
    const source = read("server/cryptoEngine.ts");
    expect(source).not.toContain("priceChangePercent7d ?? 0");
    expect(source).not.toContain("change7d ?? 0");
    expect(source).toContain("momScore7d      * 0.20");
  });
});

describe("missing quote price, change, and volume stay null", () => {
  it("keeps an observed screener quote byte-identical, including zeros", () => {
    expect(screenerQuoteFields({
      regularMarketPrice: 12.5,
      regularMarketChange: 0,
      regularMarketChangePercent: -1.25,
      regularMarketVolume: 0,
    })).toEqual({ price: 12.5, change: 0, changePercent: -1.25, volume: 0 });
  });

  it("does not turn a missing screener field into 0", () => {
    expect(screenerQuoteFields({})).toEqual({
      price: null, change: null, changePercent: null, volume: null,
    });
    const source = read("server/yahooProxy.ts");
    expect(source).not.toContain("regularMarketPrice ?? 0");
    expect(source).not.toContain("regularMarketChange ?? 0");
    expect(source).not.toContain("regularMarketChangePercent ?? 0");
    expect(source).not.toContain("regularMarketVolume ?? 0");
    expect(source).not.toContain("todaysChangePerc ?? 0");
  });

  it("keeps a complete Polygon snapshot change identical and withholds a missing close", () => {
    expect(polygonSnapshotQuoteFields({
      day: { c: 110, v: 2_000_000 },
      prevDay: { c: 100 },
      todaysChangePerc: 10,
    })).toEqual({ price: 110, change: 10, changePercent: 10, volume: 2_000_000 });
    expect(polygonSnapshotQuoteFields({
      day: { c: 110, v: 0 },
      prevDay: { c: 100 },
      todaysChangePerc: 0,
    }).changePercent).toBe(0);
    expect(polygonSnapshotQuoteFields({ day: { v: 5 }, prevDay: { c: 100 } })).toMatchObject({
      price: 100, change: null, changePercent: null, volume: 5,
    });
    expect(polygonSnapshotQuoteFields({ day: { c: 110 } }, "day")).toMatchObject({
      price: 110, change: null, volume: null,
    });
  });

  it("resolves a present signal change exactly as before and leaves a missing one null", () => {
    expect(resolveSignalChangePercent(1.23456, 110, 100)).toBe(1.235);
    expect(resolveSignalChangePercent(0, 110, 100)).toBe(0);
    expect(resolveSignalChangePercent(null, 110, 100)).toBe(10);
    expect(resolveSignalChangePercent(undefined, 110, 0)).toBe(0);
    expect(resolveSignalChangePercent(null, 110, null)).toBeNull();
    expect(resolveSignalChangePercent(null, null, 100)).toBeNull();
    expect(resolveSignalVolume(1_500_000)).toEqual({ volume: 1_500_000, volumeMillions: 1.5 });
    expect(resolveSignalVolume(0)).toEqual({ volume: 0, volumeMillions: 0 });
    expect(resolveSignalVolume(null, 2_500_000)).toEqual({ volume: 2_500_000, volumeMillions: 2.5 });
    expect(resolveSignalVolume(null, null)).toEqual({ volume: null, volumeMillions: null });
    expect(assemblePolygonBarQuote({ c: 100.126, o: 99, v: 1_000_000 }, 90)).toMatchObject({
      price: 100.13,
      changePercent: parseFloat((((100.126 - 90) / 90) * 100).toFixed(3)),
      volume: 1_000_000,
      volumeMillions: 1,
    });
    expect(assemblePolygonBarQuote({ o: 99 }, null)).toMatchObject({
      price: null, changePercent: null, volume: null, volumeMillions: null,
    });
    const source = read("server/signalsProxy.ts");
    expect(source).not.toContain("price: 0, open: 0, high: 0, low: 0");
    expect(source).not.toContain("changePercent: 0");
    expect(source).not.toContain("volume: 0, volumeMillions: 0");
  });

  it("renders a missing quote as unavailable instead of 0 or +0.00%", () => {
    const signals = read("client/src/pages/Signals.tsx");
    const mobile = read("client/src/pages/mobile/MobileSignals.tsx");
    const hero = read("client/src/components/AshaHeroSection.tsx");
    const heatmap = read("client/src/pages/StockHeatmap.tsx");
    expect(signals).not.toContain("changePercent ?? 0");
    expect(mobile).not.toContain("changePercent ?? 0");
    expect(hero).not.toContain("changePercent ?? 0");
    expect(hero).not.toContain("price: q.price ?? 0");
    expect(heatmap).toContain("Unavailable");
    expect(read("client/src/pages/CryptoSearch.tsx")).toContain('"Unavailable"');
  });
});
