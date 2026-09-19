import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  ANALYTICAL_LEGACY_ALIASES,
  CANONICAL_DESTINATION_BY_ID,
  getLegacyAliasTarget,
} from "../shared/routeRegistry";
import {
  customerChromeModeLabel,
  customerIntegrityChipLevel,
  customerIntegrityLabel,
} from "../shared/customerIntegrityLabels";

const root = resolve(import.meta.dirname, "..");
const read = (relativePath: string) => readFileSync(resolve(root, relativePath), "utf8");

describe("P1 launch QA — public pricing and mobile routes", () => {
  const app = read("client/src/App.tsx");

  it("registers /pricing on the marketing site before the AppLayout 404 catch-all", () => {
    expect(app).toContain('path="/pricing"');
    expect(app).toContain('initialSection="pricing"');
    const pricingRoute = app.indexOf('path="/pricing"');
    const catchAll404 = app.indexOf('<Route><Redirect to="/404" /></Route>');
    expect(pricingRoute).toBeGreaterThanOrEqual(0);
    expect(catchAll404).toBeGreaterThan(pricingRoute);
    expect(ANALYTICAL_LEGACY_ALIASES["/pricing"]).toBe("/#access");
    expect(getLegacyAliasTarget("/pricing")).toBe("/#access");
  });

  it("redirects bare /mobile and /mobile/ to NOW so Pulse nav is not a 404", () => {
    expect(app).toContain('path="/mobile"');
    expect(app).toContain('path="/mobile/"');
    expect(app).toContain("CANONICAL_DESTINATION_BY_ID.now.path");
    const mobileBare = app.indexOf('<Route path="/mobile">');
    const mobileWildcard = app.indexOf('path="/mobile/:tab*"');
    const catchAll404 = app.indexOf('<Route><Redirect to="/404" /></Route>');
    expect(mobileBare).toBeGreaterThanOrEqual(0);
    expect(mobileWildcard).toBeGreaterThan(mobileBare);
    expect(catchAll404).toBeGreaterThan(mobileBare);
    expect(getLegacyAliasTarget("/mobile")).toBe(CANONICAL_DESTINATION_BY_ID.now.path);
    expect(getLegacyAliasTarget("/mobile/")).toBe(CANONICAL_DESTINATION_BY_ID.now.path);
  });
});

describe("P1 launch QA — signals and crypto never infinite-load", () => {
  const signals = read("client/src/pages/Signals.tsx");
  const crypto = read("client/src/pages/CryptoSearch.tsx");
  const gate = read("client/src/components/PremiumGate.tsx");
  const routers = read("server/routers.ts");

  it("bounds guest Signals fetches and does not wait forever on auth or quotes", () => {
    expect(signals).toContain("AbortSignal.timeout(8000)");
    expect(signals).not.toContain("AbortSignal.timeout(30000)");
    expect(signals).not.toContain("AbortSignal.timeout(45000)");
    expect(signals).toContain("10_000");
    expect(signals).toContain("QUOTES UNAVAILABLE");
    expect(signals).toContain("isQaSession || !isAuthenticated");
    expect(gate).toContain("AUTH_LOAD_BUDGET_MS");
    expect(gate).toContain("authLoadTimedOut");
    expect(gate).toContain("4_000");
  });

  it("does not keep the crypto heatmap on Market data loading after a settled empty or error", () => {
    expect(crypto).toContain("marketsUnavailable");
    expect(crypto).toContain("Market data unavailable.");
    expect(crypto).toContain("/api/crypto/markets");
    expect(crypto).toContain("/api/crypto/global");
    expect(crypto).not.toMatch(/isLoadingMarkets \? \([\s\S]*Market data loading/);
    expect(routers).toMatch(/getTopMarkets:\s*publicProcedure/);
    expect(routers).toMatch(/getGlobalStats:\s*publicProcedure/);
  });
});

describe("P1 launch QA — no LIVE chrome when integrity is FALLBACK", () => {
  it("maps PARTIAL + live freshness to FALLBACK chrome, never Canonical/LIVE", () => {
    const label = customerIntegrityLabel({
      hasState: true,
      freshness: "live",
      cacheStatus: "refreshed",
      quality: "PARTIAL",
      fallbackInputCount: 0,
      fredStatus: "healthy",
    });
    expect(label).toBe("FALLBACK");
    expect(customerChromeModeLabel(label)).toBe("FALLBACK");
    expect(customerIntegrityChipLevel(label)).toBe("fallback");
    expect(customerChromeModeLabel(label)).not.toMatch(/LIVE|Canonical/i);
  });
});
