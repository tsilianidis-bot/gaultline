import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { securityQuoteProvenance } from "./securityQuoteContext";

const NOW = Date.parse("2026-10-16T15:00:00.000Z");
const quote = (overrides: Record<string, unknown> = {}) => ({
  price: 100,
  observedAt: NOW - 60_000,
  isDelayed: false,
  marketState: "REGULAR",
  source: "yahoo",
  ...overrides,
}) as any;

describe("security quote provenance", () => {
  it("does not infer LIVE from a REGULAR session when the provider marks the quote delayed", () => {
    expect(securityQuoteProvenance(quote({ isDelayed: true }), NOW)).toEqual({
      provider: "yahoo",
      observedAt: NOW - 60_000,
      isDelayed: true,
      marketSession: "REGULAR",
      freshnessState: "DELAYED",
    });
  });

  it("labels LIVE only for a fresh, undelayed provider observation", () => {
    expect(securityQuoteProvenance(quote(), NOW).freshnessState).toBe("LIVE");
  });

  it("keeps stale, fallback, and unavailable states explicit", () => {
    expect(securityQuoteProvenance(quote({ observedAt: NOW - 25 * 60_000 }), NOW).freshnessState).toBe("STALE");
    expect(securityQuoteProvenance(quote({ source: "polygon-prev" }), NOW).freshnessState).toBe("FALLBACK");
    expect(securityQuoteProvenance(quote({ observedAt: null }), NOW).freshnessState).toBe("UNAVAILABLE");
    expect(securityQuoteProvenance(quote({ observedAt: NOW + 1 }), NOW)).toMatchObject({
      observedAt: null,
      freshnessState: "UNAVAILABLE",
    });
  });

  it("renders the header freshness from quote provenance rather than REGULAR session state", () => {
    const header = readFileSync(resolve(process.cwd(), "client/src/components/UniversalTickerHeader.tsx"), "utf8");
    expect(header).toContain("quoteProvenance?.freshnessState");
    expect(header).not.toMatch(/REGULAR:\s*\{\s*label:\s*["']LIVE["']/);
    expect(header).toContain("fmtQuoteAsOf(quoteProvenance?.observedAt)");
  });
});
