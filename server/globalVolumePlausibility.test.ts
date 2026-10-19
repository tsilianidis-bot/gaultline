import { describe, expect, it } from "vitest";
import { observedGlobalUsdVolume } from "./coingeckoProxy";

describe("CoinGecko global volume stays a USD print", () => {
  it("keeps a normal volume, including an observed zero", () => {
    expect(observedGlobalUsdVolume(0, 2e12)).toBe(0);
    expect(observedGlobalUsdVolume(4e11, 2e12)).toBe(4e11);
    expect(observedGlobalUsdVolume({ usd: 7.7e10, vef: 6.77e18 }, 2.758e12)).toBe(7.7e10);
    expect(observedGlobalUsdVolume(7.7e10, null)).toBe(7.7e10);
  });

  it("withholds an implausible USD volume instead of summing other currencies", () => {
    expect(observedGlobalUsdVolume(3.98e17, 2.758e12)).toBeNull();
    expect(observedGlobalUsdVolume({ usd: 3.98e17, vef: 1 }, null)).toBeNull();
    expect(observedGlobalUsdVolume({ vef: 6.77e18 }, 2.758e12)).toBeNull();
    expect(observedGlobalUsdVolume({ usd: 4e11 }, 2e12)).toBe(4e11);
  });
});
