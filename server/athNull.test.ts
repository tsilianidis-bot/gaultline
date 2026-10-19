import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { mapRawCoin } from "./coingeckoProxy";

function coin(overrides: Record<string, unknown> = {}) {
  return mapRawCoin({
    id: "bitcoin",
    symbol: "btc",
    name: "Bitcoin",
    current_price: 70_000,
    high_24h: 72_000,
    low_24h: 68_000,
    market_cap: 1_000_000_000_000,
    total_volume: 30_000_000_000,
    ...overrides,
  });
}

describe("a missing all-time high is not a distance of 0", () => {
  it("keeps an observed ATH and its distance", () => {
    const observed = coin({ ath: 73_750 });
    expect(observed.ath).toBe(73_750);
    expect(observed.distanceFromAth).toBeCloseTo(((70_000 - 73_750) / 73_750) * 100, 10);
  });

  it("does not treat a missing or non-positive ATH as near the high", () => {
    const missing = coin({});
    const zero = coin({ ath: 0 });
    expect(missing.ath).toBeNull();
    expect(missing.distanceFromAth).toBeNull();
    expect(zero.ath).toBeNull();
    expect(zero.distanceFromAth).toBeNull();
    expect(missing.distanceFromAth != null && missing.distanceFromAth > -15).toBe(false);
    expect(missing.distanceFromAth != null && missing.distanceFromAth >= -15).toBe(false);
    const proxy = readFileSync("server/coingeckoProxy.ts", "utf8");
    expect(proxy).not.toContain("(c.ath as number) ?? 0");
    const engine = readFileSync("server/cryptoEngine.ts", "utf8");
    expect(engine).toContain("c.distanceFromAth != null && c.distanceFromAth > -15");
    const signals = readFileSync("server/cryptoSignals.ts", "utf8");
    expect(signals).toContain("distanceFromAth == null || !Number.isFinite(distanceFromAth)");
    const search = readFileSync("client/src/pages/CryptoSearch.tsx", "utf8");
    expect(search).not.toContain("fmt(asset.ath, asset.ath < 1 ? 4 : 2)");
  });
});
