import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { describe, expect, it } from "vitest";
import {
  SHOWCASE_EVIDENCE,
  hasVerifiedCapture,
} from "../client/src/components/marketing/showcaseEvidence";

const read = (path: string) =>
  readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const before = (path: string) =>
  execFileSync(
    "git",
    ["show", `49d6ab7dbf97dcca272e96339217acf9e8ca022d:${path}`],
    { encoding: "utf8" }
  );
const main = read("client/src/main.tsx");
const originalMain = before("client/src/main.tsx");

describe("public marketing startup isolation", () => {
  it("does not preload marketing styles or modules on direct product arrivals", () => {
    const config = read("vite.config.ts");
    expect(config).toContain('if(window.location.pathname!=="/")return;');
    expect(config).toContain("vitePluginRootMarketingPreload");
    expect(config).toContain('chunk.name === "marketing-entry"');
  });

  it("loads only marketing on root arrival and retains original product providers behind a dynamic boundary", () => {
    expect(main).not.toMatch(/import App from/);
    expect(main).not.toMatch(
      /import \{ (?:TickerStoreProvider|AshaProvider|ExperienceProvider) \} from/
    );
    expect(main).toContain('import("./marketing-entry")');
    expect(main).toContain('import("./App")');
    expect(main).toContain('import("./contexts/TickerStore")');
    expect(main).toContain('import("./contexts/AshaContext")');
    expect(main).toContain('import("./contexts/ExperienceContext")');
    expect(main).toContain("useLocation()");
    expect(main).toMatch(/location\s*===\s*["']\/["']/);
  });

  it("keeps auth-aware tRPC transport, defaults, error subscriptions and client creation byte-equivalent", () => {
    const section = (source: string) =>
      source.slice(
        source.indexOf("async function safeFetch"),
        source.indexOf("\n});", source.indexOf("const trpcClient")) + 5
      );
    // New presentation components are outside this block. No auth or API behavior is rewritten.
    expect(section(main)).toBe(section(originalMain));
  });

  it("keeps the existing root session lookup, canonical redirect and public presentation while loading", () => {
    const entry = read("client/src/marketing-entry.tsx");
    expect(entry).toContain("useAuth()");
    expect(entry).toContain("if (user) return <Redirect to={CANONICAL_HOME}");
    expect(entry).toContain("<MarketingSite");
    expect(entry).toContain("<CookieConsent");
    expect(entry).not.toContain("DEMO_USER");
    expect(entry).not.toContain("isAuthenticated:");
    expect(entry).not.toContain("TickerStoreProvider");
  });

  it("preserves the approved hero and shared intelligence core byte-for-byte", () => {
    for (const path of [
      "client/src/components/marketing/MarketingIntelligenceHero.tsx",
      "client/src/components/marketing/premium-marketing.css",
      "client/src/components/intelligence-core-visual/CoreTopology.tsx",
      "client/src/components/intelligence-core-visual/adapter.ts",
    ])
      expect(read(path)).toBe(before(path));
  });

  it("retains five required categories with distinct public documentation/demo links and explicit blockers", () => {
    expect(SHOWCASE_EVIDENCE.map(item => item.id)).toEqual([
      "pressure-index",
      "six-domain-intelligence",
      "signals-discovery",
      "outlook-scenarios",
      "daily-brief",
    ]);
    for (const item of SHOWCASE_EVIDENCE) {
      expect(item.benefit?.length).toBeGreaterThan(30);
      expect(item.promotionBlockers?.length).toBeGreaterThan(0);
      expect(item.publicDemoHref).toMatch(
        /^\/(?:pressure-index|methodology|daily-brief)(?:#[-a-z]+)?$/
      );
      expect(item.publicDemoHref).not.toMatch(
        /\/app|\/demo|checkout|register|api/
      );
      expect(hasVerifiedCapture(item)).toBe(false);
    }
  });
});
