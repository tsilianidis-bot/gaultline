/**
 * Validates that POLYGON_API_KEY is set and functional.
 * Calls the lightweight /v2/aggs/ticker/AAPL/prev endpoint.
 * This test runs server-side only — the key is never exposed to the browser.
 *
 * Note: HTTP 429 (Too Many Requests) is treated as a valid key — it means
 * the key is recognized but rate-limited. Only 401/403 indicate an invalid key.
 */
import { describe, it, expect } from "vitest";

describe("POLYGON_API_KEY validation", () => {
  it("should have POLYGON_API_KEY set in environment", () => {
    const key = process.env.POLYGON_API_KEY;
    expect(key, "POLYGON_API_KEY must be set").toBeTruthy();
    expect(key!.length, "POLYGON_API_KEY must be non-empty").toBeGreaterThan(0);
  });

  it("should successfully call Polygon.io /v2/aggs/ticker/AAPL/prev with a valid key", async () => {
    const key = process.env.POLYGON_API_KEY;
    expect(key).toBeTruthy();

    const url = `https://api.polygon.io/v2/aggs/ticker/AAPL/prev?adjusted=true&apiKey=${key}`;
    const response = await fetch(url);

    // 200 = success, 429 = rate-limited (key is valid but quota exceeded)
    // 401/403 = invalid key — these are the only failure cases
    const VALID_STATUSES = [200, 429];
    expect(
      VALID_STATUSES,
      `Polygon.io returned unexpected status ${response.status}. Expected 200 (success) or 429 (rate limited). 401/403 would indicate an invalid key.`
    ).toContain(response.status);

    if (response.status === 200) {
      const data = await response.json() as {
        status?: string;
        resultsCount?: number;
        results?: Array<{ c?: number; v?: number }>;
      };
      expect(data.status, "Response status should be OK").toBe("OK");
      expect(data.resultsCount, "Should have at least 1 result").toBeGreaterThan(0);
      expect(Array.isArray(data.results), "Results should be an array").toBe(true);
      expect(data.results![0].c, "Close price should be a positive number").toBeGreaterThan(0);
    }
    // If 429, the key is valid — no further assertions needed
  }, 15_000); // 15s timeout for network call
});
