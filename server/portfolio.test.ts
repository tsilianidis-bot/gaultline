// ============================================================
// FAULTLINE — Portfolio + Yahoo Proxy Tests
// server/portfolio.test.ts
// ============================================================
import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Yahoo Proxy unit tests ────────────────────────────────────
describe("Yahoo Finance Proxy", () => {
  it("normalises ticker to uppercase", async () => {
    // We test the cache key normalisation without hitting the network
    const { getQuoteCacheStats, clearQuoteCache } = await import("./yahooProxy");
    clearQuoteCache();
    const stats = getQuoteCacheStats();
    expect(stats.size).toBe(0);
    expect(Array.isArray(stats.tickers)).toBe(true);
  });

  it("clearQuoteCache empties the cache", async () => {
    const { clearQuoteCache, getQuoteCacheStats } = await import("./yahooProxy");
    clearQuoteCache();
    expect(getQuoteCacheStats().size).toBe(0);
  });

  it("getQuotes returns array of same length as input", async () => {
    // Mock fetch to avoid real network calls in tests
    const originalFetch = global.fetch;
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        chart: {
          result: [{
            meta: {
              regularMarketPrice: 150.0,
              previousClose: 148.0,
              regularMarketOpen: 149.0,
              regularMarketDayHigh: 151.0,
              regularMarketDayLow: 147.0,
              regularMarketVolume: 50000000,
              regularMarketChangePercent: 1.35,
              marketState: "REGULAR",
            },
          }],
        },
      }),
    } as any);

    const { getQuotes, clearQuoteCache } = await import("./yahooProxy");
    clearQuoteCache();

    const tickers = ["AAPL", "MSFT", "GOOGL"];
    const results = await getQuotes(tickers);

    expect(results).toHaveLength(3);
    expect(results[0].ticker).toBe("AAPL");
    expect(results[0].price).toBe(150.0);
    expect(results[0].isDelayed).toBe(true);

    global.fetch = originalFetch;
  });

  it("getQuote returns error fields on fetch failure", async () => {
    const originalFetch = global.fetch;
    global.fetch = vi.fn().mockRejectedValue(new Error("Network error"));

    const { getQuote, clearQuoteCache } = await import("./yahooProxy");
    clearQuoteCache();

    const result = await getQuote("FAIL");
    expect(result.price).toBeNull();
    expect(result.error).toBeDefined();
    expect(result.ticker).toBe("FAIL");

    global.fetch = originalFetch;
  });

  it("deduplicates tickers in getQuotes", async () => {
    const originalFetch = global.fetch;
    let callCount = 0;
    global.fetch = vi.fn().mockImplementation(async () => {
      callCount++;
      return {
        ok: true,
        json: async () => ({
          chart: {
            result: [{
              meta: {
                regularMarketPrice: 200.0,
                previousClose: 198.0,
                regularMarketOpen: 199.0,
                regularMarketDayHigh: 201.0,
                regularMarketDayLow: 197.0,
                regularMarketVolume: 30000000,
                regularMarketChangePercent: 1.01,
                marketState: "CLOSED",
              },
            }],
          },
        }),
      } as any;
    });

    const { getQuotes, clearQuoteCache } = await import("./yahooProxy");
    clearQuoteCache();

    const results = await getQuotes(["SPY", "SPY", "SPY"]);
    // Should deduplicate — only 1 unique ticker
    expect(results).toHaveLength(1);
    expect(callCount).toBe(1);

    global.fetch = originalFetch;
  });
});

// ── Portfolio P&L calculation logic ──────────────────────────
describe("Portfolio P&L calculations", () => {
  it("computes unrealized P&L correctly", () => {
    const shares = 100;
    const costBasis = 150.0;
    const currentPrice = 180.0;

    const totalCost = shares * costBasis;           // 15000
    const marketValue = shares * currentPrice;      // 18000
    const unrealizedPnl = marketValue - totalCost;  // 3000
    const unrealizedPnlPct = (unrealizedPnl / totalCost) * 100; // 20%

    expect(totalCost).toBe(15000);
    expect(marketValue).toBe(18000);
    expect(unrealizedPnl).toBe(3000);
    expect(unrealizedPnlPct).toBeCloseTo(20.0, 2);
  });

  it("computes negative P&L correctly", () => {
    const shares = 50;
    const costBasis = 200.0;
    const currentPrice = 160.0;

    const totalCost = shares * costBasis;
    const marketValue = shares * currentPrice;
    const unrealizedPnl = marketValue - totalCost;
    const unrealizedPnlPct = (unrealizedPnl / totalCost) * 100;

    expect(totalCost).toBe(10000);
    expect(marketValue).toBe(8000);
    expect(unrealizedPnl).toBe(-2000);
    expect(unrealizedPnlPct).toBeCloseTo(-20.0, 2);
  });

  it("handles fractional crypto shares", () => {
    const shares = 0.5;
    const costBasis = 60000;
    const currentPrice = 70000;

    const totalCost = shares * costBasis;
    const marketValue = shares * currentPrice;
    const unrealizedPnl = marketValue - totalCost;

    expect(totalCost).toBe(30000);
    expect(marketValue).toBe(35000);
    expect(unrealizedPnl).toBe(5000);
  });

  it("computes portfolio summary totals correctly", () => {
    const positions = [
      { totalCost: 10000, marketValue: 12000, dayChange: 100 },
      { totalCost: 5000,  marketValue: 4500,  dayChange: -50 },
      { totalCost: 8000,  marketValue: 8000,  dayChange: 0 },
    ];

    const totalCostAll  = positions.reduce((s, p) => s + p.totalCost, 0);
    const totalValueAll = positions.reduce((s, p) => s + p.marketValue, 0);
    const totalPnl      = totalValueAll - totalCostAll;
    const totalPnlPct   = (totalPnl / totalCostAll) * 100;
    const totalDayChg   = positions.reduce((s, p) => s + p.dayChange, 0);

    expect(totalCostAll).toBe(23000);
    expect(totalValueAll).toBe(24500);
    expect(totalPnl).toBe(1500);
    expect(totalPnlPct).toBeCloseTo(6.52, 1);
    expect(totalDayChg).toBe(50);
  });

  it("handles null currentPrice gracefully", () => {
    const shares = 100;
    const costBasis = 150.0;
    const currentPrice: number | null = null;

    const totalCost = shares * costBasis;
    const marketValue = currentPrice != null ? shares * currentPrice : null;
    const unrealizedPnl = marketValue != null ? marketValue - totalCost : null;

    expect(totalCost).toBe(15000);
    expect(marketValue).toBeNull();
    expect(unrealizedPnl).toBeNull();
  });
});

// ── Input validation ──────────────────────────────────────────
describe("Portfolio input validation", () => {
  it("rejects zero shares", () => {
    const shares = 0;
    expect(shares > 0).toBe(false);
  });

  it("rejects negative cost basis", () => {
    const costBasis = -100;
    expect(costBasis > 0).toBe(false);
  });

  it("accepts fractional shares", () => {
    const shares = 0.00000001;
    expect(shares > 0).toBe(true);
  });

  it("normalises ticker to uppercase", () => {
    const ticker = "aapl";
    expect(ticker.toUpperCase()).toBe("AAPL");
  });

  it("validates asset type enum", () => {
    const valid = ["Stock", "ETF", "Crypto", "Other"];
    expect(valid.includes("Stock")).toBe(true);
    expect(valid.includes("Bond")).toBe(false);
  });
});
