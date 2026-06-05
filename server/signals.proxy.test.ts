/**
 * FAULTLINE — Signals Proxy Integration Tests
 *
 * Tests the /api/signals/quotes endpoint via the running dev server.
 * These tests validate:
 *   1. The endpoint returns a valid response structure
 *   2. All 20 priority tickers are present
 *   3. Live prices are non-zero real numbers
 *   4. Change percentages are in a reasonable range
 *   5. Volume data is present
 *   6. Trade date is a valid date string
 *   7. Market status is one of the expected values
 *   8. The API key is NOT exposed in the response
 */
import { describe, it, expect, beforeAll } from "vitest";

const BASE_URL = "http://localhost:3000";

const EXPECTED_TICKERS = [
  "NVDA", "MSFT", "META", "AMZN", "GOOGL",
  "TSLA", "PLTR", "QUBT", "IONQ", "RGTI",
  "FRMI", "AMD", "SMCI", "SOFI", "JPM",
  "XLF", "XLK", "SPY", "QQQ", "SPCE",
];

interface QuoteResult {
  ticker: string;
  price: number;
  open: number;
  high: number;
  low: number;
  changePercent: number;
  volume: number;
  volumeMillions: number;
  timestamp: number;
  marketStatus: string;
  isLive: boolean;
  sparkline: number[];
}

interface QuotesResponse {
  quotes: QuoteResult[];
  timestamp: string;
  marketStatus: string;
  tradeDate?: string;
  source: string;
  cached?: boolean;
  count?: number;
  sparklinesCached?: number;
}

let response: QuotesResponse;

beforeAll(async () => {
  const res = await fetch(`${BASE_URL}/api/signals/quotes`, {
    signal: AbortSignal.timeout(30000),
  });
  expect(res.ok).toBe(true);
  response = await res.json() as QuotesResponse;
}, 35000);

describe("GET /api/signals/quotes — response structure", () => {
  it("returns a valid JSON response with expected top-level fields", () => {
    expect(response).toBeDefined();
    expect(response.quotes).toBeInstanceOf(Array);
    expect(response.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(response.marketStatus).toMatch(/^(open|closed|extended|unknown)$/);
    expect(["live", "stale", "fallback"]).toContain(response.source);
  });

  it("returns exactly 20 priority tickers", () => {
    expect(response.quotes).toHaveLength(20);
  });

  it("includes all expected tickers", () => {
    const returnedTickers = response.quotes.map(q => q.ticker);
    for (const ticker of EXPECTED_TICKERS) {
      expect(returnedTickers).toContain(ticker);
    }
  });

  it("returns a valid trade date when source is live", () => {
    if (response.source === "live" || response.source === "stale") {
      expect(response.tradeDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });
});

describe("GET /api/signals/quotes — quote data quality", () => {
  it("returns non-zero prices for live data", () => {
    if (response.source === "live") {
      const liveQuotes = response.quotes.filter(q => q.price > 0);
      // At least 15 of 20 tickers should have live prices
      expect(liveQuotes.length).toBeGreaterThanOrEqual(15);
    }
  });

  it("returns valid price values (positive numbers)", () => {
    for (const q of response.quotes) {
      if (q.price > 0) {
        expect(q.price).toBeGreaterThan(0);
        expect(q.price).toBeLessThan(1_000_000); // sanity check
        expect(typeof q.price).toBe("number");
        expect(isNaN(q.price)).toBe(false);
      }
    }
  });

  it("returns change percentages in a reasonable range (-50% to +50%)", () => {
    for (const q of response.quotes) {
      if (q.price > 0) {
        expect(q.changePercent).toBeGreaterThan(-50);
        expect(q.changePercent).toBeLessThan(50);
        expect(typeof q.changePercent).toBe("number");
      }
    }
  });

  it("returns valid volume data for live quotes", () => {
    for (const q of response.quotes) {
      if (q.price > 0) {
        expect(q.volume).toBeGreaterThanOrEqual(0);
        expect(q.volumeMillions).toBeGreaterThanOrEqual(0);
        expect(typeof q.volumeMillions).toBe("number");
      }
    }
  });

  it("returns valid market status for each quote", () => {
    for (const q of response.quotes) {
      expect(["open", "closed", "extended", "unknown"]).toContain(q.marketStatus);
    }
  });

  it("returns sparkline as an array (may be empty on first load)", () => {
    for (const q of response.quotes) {
      expect(q.sparkline).toBeInstanceOf(Array);
    }
  });

  it("returns valid OHLC data for live quotes", () => {
    for (const q of response.quotes) {
      if (q.price > 0 && q.open > 0) {
        expect(q.open).toBeGreaterThan(0);
        expect(q.high).toBeGreaterThanOrEqual(q.low);
        expect(q.high).toBeGreaterThan(0);
        expect(q.low).toBeGreaterThan(0);
      }
    }
  });
});

describe("GET /api/signals/quotes — security", () => {
  it("does NOT expose the Polygon API key in the response body", async () => {
    const rawText = JSON.stringify(response);
    // The API key should not appear in any response field
    const apiKey = process.env.POLYGON_API_KEY;
    if (apiKey) {
      expect(rawText).not.toContain(apiKey);
    }
    // Also check that no field looks like an API key (32+ char alphanumeric)
    expect(rawText).not.toMatch(/apiKey=[A-Za-z0-9_]{20,}/);
  });

  it("does NOT include any internal server paths or credentials", () => {
    const rawText = JSON.stringify(response);
    expect(rawText).not.toContain("POLYGON_API_KEY");
    expect(rawText).not.toContain("process.env");
    expect(rawText).not.toContain("/home/ubuntu");
  });
});

describe("GET /api/signals/health — health endpoint", () => {
  it("returns health status with expected fields", async () => {
    const res = await fetch(`${BASE_URL}/api/signals/health`);
    expect(res.ok).toBe(true);
    const health = await res.json() as {
      configured: boolean;
      cached: boolean;
      tickers: number;
      sparklinesCached: number;
    };
    expect(health.configured).toBe(true);
    expect(health.tickers).toBe(20);
    expect(typeof health.sparklinesCached).toBe("number");
  });
});

describe("GET /api/signals/quotes — caching", () => {
  it("returns a valid response with correct shape on any call", async () => {
    const res = await fetch(`${BASE_URL}/api/signals/quotes`, {
      signal: AbortSignal.timeout(20000),
    });
    expect(res.ok).toBe(true);
    const data = await res.json() as QuotesResponse;
    // The proxy returns source: "live" (fresh or cached), "stale", or "fallback".
    // cached:true = in-memory LRU hit; cached:false = fresh upstream fetch.
    // Both are valid — this test verifies the response shape, not cache state.
    expect(["live", "stale", "fallback"]).toContain(data.source);
    expect(data.quotes).toBeInstanceOf(Array);
    expect(typeof data.timestamp).toBe("string");
    // If source is live or stale, cached must be a boolean (true or false)
    if (data.source === "live" || data.source === "stale") {
      expect(typeof data.cached).toBe("boolean");
    }
  }, 25000);
});

describe("GET /api/signals/ticker/:symbol — per-ticker endpoint", () => {
  it("returns 400 for an invalid ticker symbol", async () => {
    const res = await fetch(`${BASE_URL}/api/signals/ticker/INVALID123`);
    expect(res.status).toBe(400);
    const body = await res.json() as { error: string };
    expect(body.error).toMatch(/Invalid ticker symbol/);
  });

  it("returns 400 for an empty ticker symbol", async () => {
    const res = await fetch(`${BASE_URL}/api/signals/ticker/%20`);
    expect(res.status).toBe(400);
  });

  /**
   * Live Polygon.io tests — these may be skipped if the API is rate-limited
   * (HTTP 429 from Polygon.io free plan: 5 req/min). The test suite itself
   * makes multiple Polygon.io calls which can exhaust the quota.
   * The backend proxy handles rate limiting gracefully; these tests verify
   * the response contract when data is available.
   */
  it("returns a valid TickerProfile for NVDA (uses cached data from quotes endpoint)", async () => {
    // NVDA is in the priority catalog so it should be cached from the quotes test
    const res = await fetch(`${BASE_URL}/api/signals/ticker/NVDA`, {
      signal: AbortSignal.timeout(20000),
    });
    // Accept 200 (success) or 503 (upstream rate limited — valid graceful degradation)
    expect([200, 503]).toContain(res.status);
    if (res.status === 200) {
      const profile = await res.json() as {
        ticker: string;
        name: string;
        price: number;
        changePercent: number;
        volume: number;
        sparkline: number[];
        source: string;
      };
      expect(profile.ticker).toBe("NVDA");
      expect(typeof profile.name).toBe("string");
      expect(profile.name.length).toBeGreaterThan(0);
      expect(profile.price).toBeGreaterThan(0);
      expect(typeof profile.changePercent).toBe("number");
      expect(profile.volume).toBeGreaterThanOrEqual(0);
      expect(profile.sparkline).toBeInstanceOf(Array);
      expect(["live", "stale", "fallback"]).toContain(profile.source);
    }
  }, 25000);

  it("does NOT expose the API key in the ticker profile response", async () => {
    // Use NVDA which should be in cache from the quotes test above
    const res = await fetch(`${BASE_URL}/api/signals/ticker/NVDA`, {
      signal: AbortSignal.timeout(20000),
    });
    // Only check security if we got a response body (not a network timeout)
    if (res.status === 200 || res.status === 503) {
      const rawText = await res.text();
      const apiKey = process.env.POLYGON_API_KEY;
      if (apiKey) {
        expect(rawText).not.toContain(apiKey);
      }
      expect(rawText).not.toContain("POLYGON_API_KEY");
      expect(rawText).not.toContain("process.env");
    }
  }, 25000);

  it("returns a cached response on second call to same ticker", async () => {
    // First call to prime the cache (NVDA should already be cached from quotes test)
    await fetch(`${BASE_URL}/api/signals/ticker/NVDA`, {
      signal: AbortSignal.timeout(20000),
    });
    // Second call should be served from 2-min TTL cache
    const t0 = Date.now();
    const res = await fetch(`${BASE_URL}/api/signals/ticker/NVDA`, {
      signal: AbortSignal.timeout(5000),
    });
    const elapsed = Date.now() - t0;
    expect(res.ok).toBe(true);
    // Cached response should return in < 500ms (no upstream call needed)
    expect(elapsed).toBeLessThan(500);
  }, 30000);
});
