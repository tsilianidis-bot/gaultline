import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { computeCryptoSignal } from "./cryptoSignals";

const root = path.resolve(import.meta.dirname, "..");
const market = {
  id: "bitcoin", symbol: "BTC", name: "Bitcoin", image: "", currentPrice: 70000,
  marketCap: 1, marketCapRank: 1, fullyDilutedValuation: null, totalVolume: 1,
  high24h: 71000, low24h: 69000, priceChange24h: 1, priceChangePercent24h: 8,
  priceChangePercent7d: 10, priceChangePercent30d: 15, marketCapChange24h: 0,
  marketCapChangePercent24h: 0, circulatingSupply: 1, totalSupply: 1, maxSupply: 1,
  ath: 75000, athChangePercent: -6, atl: 1, atlChangePercent: 1, sparkline7d: Array.from({ length: 48 }, (_, i) => 60000 + i * 500),
  lastUpdated: new Date().toISOString(), volatility24h: 1, distanceFromAth: 6,
};

describe("crypto technical-indicator integrity", () => {
  it("withholds RSI wording and RSI-derived conviction when completed daily bars are unavailable", () => {
    const result = computeCryptoSignal({ market, btcDominance: 55, regime: { label: "MODERATE RISK", score: 5 } });
    expect(result.technicals.rsiIsTrue).toBe(false);
    expect(result.rationale).not.toMatch(/RSI(?:~|\(14\)| at)/i);
    expect(result.rationale).toContain("Insufficient completed historical bars");
  });

  it("rejects a direct caller’s current candle before it can establish a true RSI", () => {
    const now = Date.now();
    const ohlcBars = Array.from({ length: 15 }, (_, i) => ({
      timestamp: i === 14 ? now : now - (15 - i) * 86_400_000,
      open: 60000 + i, high: 60100 + i, low: 59900 + i, close: 60050 + i,
    }));
    const result = computeCryptoSignal({ market, ohlcBars, btcDominance: 55, regime: { label: "MODERATE RISK", score: 5 } });
    expect(result.technicals.rsiIsTrue).toBe(false);
  });

  it("does not render the approximate RSI indicator anywhere in the Crypto Signals surface", () => {
    const source = readFileSync(path.join(root, "client/src/pages/CryptoSignals.tsx"), "utf8");
    expect(source).not.toContain("RSI~");
    expect(source).toContain("CryptoRsiReadout");
    expect(source).not.toContain("sig.technicals.rsiIsTrue ? (");
  });
});
