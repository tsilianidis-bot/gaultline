/**
 * Guard: customer-facing pages must not mount Pre-Flight / Market Awareness CTAs.
 * Keep redirect, Trade Preflight, analytics, entitlements, server/preFlight.ts.
 */
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "fs";
import { join } from "path";

const ROOT = join(import.meta.dirname, "..");

function walk(dir: string, acc: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name.startsWith(".")) continue;
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) walk(p, acc);
    else if (/\.(tsx|ts)$/.test(name) && !/\.test\./.test(name)) acc.push(p);
  }
  return acc;
}

const ALLOWED_FILES = new Set([
  "client/src/components/MarketPreflight.tsx", // unused shell; keep until fully retired
  "client/src/components/PreflightGate.tsx",
  "client/src/pages/PreFlight.tsx", // route redirects to /app/now/deep
  "client/src/pages/DecisionEngine.tsx", // Trade Preflight (different product)
  "shared/routeRegistry.ts", // redirect map + search keyword
  "shared/legacyCapabilityAudit.ts",
  "server/preFlight.ts",
]);

const FORBIDDEN = [
  /PreflightTrigger/,
  /MarketPreflightModal/,
  /from ["']@\/components\/MarketPreflight["']/,
  /Complete Market Awareness/,
  /Market Awareness Check/,
  /Run Market Preflight/,
  /Free Market Awareness/,
  /OPEN PRE-FLIGHT/,
  /label:\s*['"]Pre-Flight['"]/,
];

describe("customer-facing: no Pre-Flight / Market Awareness CTA", () => {
  const pages = walk(join(ROOT, "client/src/pages"));
  const components = walk(join(ROOT, "client/src/components"));
  const shared = walk(join(ROOT, "shared")).filter((p) => p.endsWith("tiers.ts"));

  const targets = [...pages, ...components, ...shared].filter((abs) => {
    const rel = abs.slice(ROOT.length + 1);
    return !ALLOWED_FILES.has(rel);
  });

  it("pages/components do not import or render PreflightTrigger / Market Awareness CTAs", () => {
    const hits: string[] = [];
    for (const abs of targets) {
      const rel = abs.slice(ROOT.length + 1);
      const src = readFileSync(abs, "utf8");
      for (const re of FORBIDDEN) {
        if (re.test(src)) hits.push(`${rel} matches ${re}`);
      }
    }
    expect(hits).toEqual([]);
  });

  it("keeps /app/pre-flight → /app/now/deep redirect", () => {
    const reg = readFileSync(join(ROOT, "shared/routeRegistry.ts"), "utf8");
    expect(reg).toMatch(/["']\/app\/pre-flight["']\s*:\s*["']\/app\/now\/deep["']/);
  });
});
