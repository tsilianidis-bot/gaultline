import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { degradedCryptoMarketFields } from "./dayTradeEngine";

describe("a degraded crypto day-trade report does not zero-fill the market", () => {
  it("keeps an observed change, volume, high, and low, including 0", () => {
    expect(degradedCryptoMarketFields({
      priceChangePercent24h: 0,
      totalVolume: 0,
      low24h: 0,
      high24h: 0,
    })).toEqual({
      changePercent: 0,
      volume: 0,
      supportLevel: 0,
      resistanceLevel: 0,
    });
    expect(degradedCryptoMarketFields({
      priceChangePercent24h: 1.5,
      totalVolume: 5_000_000,
      low24h: 99.5,
      high24h: 101.25,
    })).toEqual({
      changePercent: 1.5,
      volume: 5_000_000,
      supportLevel: 99.5,
      resistanceLevel: 101.25,
    });
  });

  it("leaves a missing change, volume, high, or low null", () => {
    expect(degradedCryptoMarketFields({
      priceChangePercent24h: null,
      totalVolume: null,
      low24h: null,
      high24h: null,
    })).toEqual({
      changePercent: null,
      volume: null,
      supportLevel: null,
      resistanceLevel: null,
    });
    const source = readFileSync("server/dayTradeEngine.ts", "utf8");
    expect(source).not.toContain("priceChangePercent24h ?? 0");
    expect(source).not.toContain("totalVolume ?? 0");
    expect(source).not.toContain("low24h ?? 0");
    expect(source).not.toContain("high24h ?? 0");
    const page = readFileSync("client/src/pages/DayTradeIntelligence.tsx", "utf8");
    expect(page).toContain("Unavailable");
  });
});
