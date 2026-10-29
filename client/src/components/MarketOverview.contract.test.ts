import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const projectRoot = path.resolve(import.meta.dirname, "../../..");
const source = readFileSync(path.join(projectRoot, "client/src/components/MarketOverview.tsx"), "utf8");

describe("Market Overview truthful lookup and mover contracts", () => {
  it("keeps the Polygon suggestion flow stock-and-ETF-only and links the dedicated crypto search", () => {
    expect(source).toContain('placeholder="Search stocks & ETFs…"');
    expect(source).toContain("STOCK & ETF LOOKUP · CRYPTO:");
    expect(source).toContain('href="/app/crypto-search"');
    expect(source).not.toContain('placeholder="Search any ticker, stock, crypto, ETF…"');
  });

  it("does not collapse a stock provider error into an empty no-match result", () => {
    expect(source).toContain("if (!res.ok) throw new Error");
    expect(source).toContain("No match result has been confirmed.");
    expect(source).toContain("No matching stocks or ETFs found.");
  });

  it("uses the existing stock autorun contract for stock search and mover clickthroughs", () => {
    expect(source).toContain("&type=stock&autorun=1");
    expect(source).not.toContain("navigate(`/app/symbol-intelligence?symbol=${ticker}`)");
    expect(source).not.toContain("href={`/app/symbol-intelligence?symbol=${ticker}`}");
  });

  it("shows unavailable and empty mover states rather than post-load loading copy", () => {
    expect(source).toContain("Market movers are temporarily unavailable.");
    expect(source).toContain("No market-mover data is available right now.");
    expect(source).toContain("moverUnavailable");
    expect(source).not.toContain("Loading market data…");
  });
});
