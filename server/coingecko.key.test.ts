/**
 * CoinGecko API Key Validation Test
 * Verifies that COINGECKO_API_KEY is set and accepted by the CoinGecko Demo API.
 *
 * INTEGRATION TEST — the /ping test makes a real HTTP call to api.coingecko.com.
 * It is automatically skipped in CI/sandbox environments where outbound network
 * access is restricted or the API key is not injected.
 *
 * To run the live network test manually:
 *   RUN_INTEGRATION_TESTS=1 pnpm test server/coingecko.key.test.ts
 */
import { describe, it, expect } from "vitest";

const COINGECKO_BASE = "https://api.coingecko.com/api/v3";
const isIntegrationEnv = !!process.env.RUN_INTEGRATION_TESTS;

describe("COINGECKO_API_KEY validation", () => {
  it("COINGECKO_API_KEY env var should be set", () => {
    const key = process.env.COINGECKO_API_KEY;
    expect(key, "COINGECKO_API_KEY is not set").toBeTruthy();
    expect(key!.startsWith("CG-"), "Key should start with CG-").toBe(true);
  });

  it.skipIf(!isIntegrationEnv)(
    "should successfully call CoinGecko /ping with the Demo API key [INTEGRATION — requires RUN_INTEGRATION_TESTS=1]",
    async () => {
      const key = process.env.COINGECKO_API_KEY;
      const res = await fetch(`${COINGECKO_BASE}/ping`, {
        headers: {
          "Accept": "application/json",
          "User-Agent": "FAULTLINE/1.0",
          "x-cg-demo-api-key": key ?? "",
        },
        signal: AbortSignal.timeout(10_000),
      });
      expect(res.status, `Expected 200 but got ${res.status} — key may be invalid`).toBe(200);
      const body = await res.json() as Record<string, unknown>;
      expect(body).toHaveProperty("gecko_says");
    }
  );
});
