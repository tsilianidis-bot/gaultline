import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { formatCryptoPrice } from "../client/src/lib/nullableFormat";

const read = (rel: string) => readFileSync(resolve(import.meta.dirname, "..", rel), "utf8");

describe("nullable coin prices do not crash the home card", () => {
  it("keeps an observed price on the prior format, including 0", () => {
    expect(formatCryptoPrice(1500)).toBe(`$${Number(1500).toLocaleString("en-US", { maximumFractionDigits: 0 })}`);
    expect(formatCryptoPrice(12.5)).toBe("$12.50");
    expect(formatCryptoPrice(0.5)).toBe("$0.5000");
    expect(formatCryptoPrice(0)).toBe("$0.0000");
  });

  it("renders a missing price as Unavailable and does not call toFixed on it", () => {
    expect(formatCryptoPrice(null)).toBe("Unavailable");
    expect(formatCryptoPrice(undefined)).toBe("Unavailable");
    expect(formatCryptoPrice(Number.NaN)).toBe("Unavailable");
    const home = read("client/src/components/HomeCryptoSection.tsx");
    const watch = read("client/src/pages/CryptoWatchlist.tsx");
    expect(home).not.toContain("asset.currentPrice.toFixed");
    expect(home).not.toContain("asset.currentPrice.toLocaleString");
    expect(watch).not.toContain("asset.currentPrice.toFixed");
    expect(watch).not.toContain("asset.currentPrice.toLocaleString");
    expect(home).toContain("formatCryptoPrice(asset.currentPrice)");
    expect(watch).toContain("formatCryptoPrice(asset.currentPrice)");
  });
});
