import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";

function json(data: unknown) {
  return { ok: true, json: async () => data };
}

function prices() {
  return {
    bitcoin: { usd: 65000, btc: 1, usd_24h_change: 1.2, usd_market_cap: 1_280_000_000_000 },
    ethereum: { usd: 3200, btc: 0.049, usd_24h_change: 2.4, usd_market_cap: 380_000_000_000 },
    tether: { usd: 1, usd_24h_change: 0.01, usd_market_cap: 110_000_000_000 },
    "usd-coin": { usd: 1, usd_24h_change: 0.01, usd_market_cap: 32_000_000_000 },
  };
}

function globalBody(dominance: { btc?: number; eth?: number }) {
  return {
    data: {
      market_cap_percentage: dominance,
      total_market_cap: { usd: 2_500_000_000_000 },
      total_volume: { usd: 120_000_000_000 },
      active_cryptocurrencies: 13000,
      updated_at: 1_704_067_200,
    },
  };
}

async function rotationFor(dominance: { btc?: number; eth?: number }) {
  vi.resetModules();
  vi.stubGlobal("fetch", vi.fn(async (url: string) => {
    const target = String(url);
    if (target.includes("/global")) return json(globalBody(dominance));
    if (target.includes("ids=bitcoin")) return json(prices());
    if (target.includes("/coins/markets")) return json([]);
    return json({});
  }));
  const { clearAltRotationCache, computeAltRotation } = await import("./altRotationEngine");
  clearAltRotationCache();
  return computeAltRotation();
}

describe("alt rotation missing dominance", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it("does not fabricate 58 or 9, and does not score the missing reading", async () => {
    const missing = await rotationFor({});
    const fabricated = await rotationFor({ btc: 58, eth: 9 });

    expect(missing.btcDominance.current).toBeNull();
    expect(missing.ethDominance).toBeNull();
    expect(missing.marketBreadth.altcoinDominance).toBeNull();
    expect(missing.btcDominance.score).toBeNull();
    expect(missing.marketBreadth.score).toBeNull();
    expect(missing.score).not.toBe(fabricated.score);
    const btcRow = missing.scoreBreakdown.find(row => row.label === "BTC Dominance Engine");
    const breadthRow = missing.scoreBreakdown.find(row => row.label === "Market Breadth");
    expect(btcRow?.rawScore).toBeNull();
    expect(btcRow?.contribution).toBeNull();
    expect(breadthRow?.rawScore).toBeNull();
    expect(breadthRow?.contribution).toBeNull();
    const text = JSON.stringify(missing);
    expect(text).not.toContain("58.0");
    expect(text).not.toContain("58.00");
    expect(text).not.toMatch(/"current":58/);
    expect(missing.aiCommentary.toLowerCase()).toContain("unavailable");
    expect(missing.aiCommentary).not.toContain("58");
  });

  it("keeps an observed dominance in the score", async () => {
    const observed = await rotationFor({ btc: 54.2, eth: 17.1 });
    expect(observed.btcDominance.current).toBeCloseTo(54.2, 1);
    expect(observed.ethDominance).toBeCloseTo(17.1, 1);
    expect(observed.btcDominance.score).toBe(50);
    expect(observed.marketBreadth.altcoinDominance).toBeCloseTo(28.7, 1);
  });

  it("renders unavailable on the Alt Rotation and mobile rotation surfaces", () => {
    for (const file of [
      "client/src/pages/AltRotation.tsx",
      "client/src/pages/mobile/MobileRotation.tsx",
      "client/src/pages/mobile/MobileBrief.tsx",
    ]) {
      const source = readFileSync(file, "utf8");
      expect(source, file).not.toMatch(/btcDominance\.current\.toFixed/);
      expect(source, file).toContain("formatObservedFixed");
    }
    expect(readFileSync("client/src/pages/AltRotation.tsx", "utf8")).not.toMatch(/altcoinDominance\.toFixed/);
  });
});
