/**
 * Daily Brief must land on the canonical NOW brief (canonical state / homepage
 * briefing), not the legacy /app/now/deep Dashboard that still presents the
 * simulated 0–10 onboarding score.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  CANONICAL_DESTINATION_BY_ID,
  getLegacyAliasTarget,
  resolveCanonicalDestination,
  stripRouteContext,
} from "../shared/routeRegistry";
import { classifyAppRoute } from "../shared/routeConsolidation";

const projectRoot = resolve(import.meta.dirname, "..");

function source(relativePath: string): string {
  return readFileSync(resolve(projectRoot, relativePath), "utf8");
}

describe("Daily Brief route", () => {
  it("aliases /app/daily-briefing to canonical NOW, not /app/now/deep", () => {
    const target = getLegacyAliasTarget("/app/daily-briefing");
    expect(target).toBe(CANONICAL_DESTINATION_BY_ID.now.path);
    expect(target).toBe("/app/now");
    expect(stripRouteContext(target ?? "")).not.toBe("/app/now/deep");
    expect(resolveCanonicalDestination("/app/daily-briefing")?.id).toBe("now");
    expect(resolveCanonicalDestination("/app/daily-briefing")?.defaultView).toBe("brief");
    expect(classifyAppRoute("/app/daily-briefing")).toBe("legacy-alias");
    expect(classifyAppRoute("/app/now")).toBe("canonical");
    expect(classifyAppRoute("/app/now/deep")).toBe("deep-view");
  });

  it("keeps mobile Brief on the same canonical NOW path", () => {
    expect(getLegacyAliasTarget("/mobile/brief")).toBe("/app/now");
    expect(getLegacyAliasTarget("/mobile/brief")).not.toBe("/app/now/deep");
    expect(resolveCanonicalDestination("/mobile/brief")?.id).toBe("now");
  });

  it("does not retarget unrelated deep-dashboard aliases", () => {
    expect(getLegacyAliasTarget("/app/report")).toBe("/app/now/deep");
    expect(getLegacyAliasTarget("/app/command-center")).toBe("/app/now/deep");
    expect(getLegacyAliasTarget("/app/dashboard")).toBe("/app/now");
  });

  it("wires the alias through App.tsx so the SPA redirect uses the registry", () => {
    const appSource = source("client/src/App.tsx");
    const registrySource = source("shared/routeRegistry.ts");
    expect(appSource).toContain("ANALYTICAL_LEGACY_ALIASES");
    expect(appSource).toContain("Object.entries(ANALYTICAL_LEGACY_ALIASES)");
    expect(appSource).toContain("<Redirect");
    expect(appSource).toContain("now: Now");
    expect(appSource).toContain('<Route path={NOW_DEEP_PATH} component={Dashboard} />');
    expect(registrySource).toMatch(/["']\/app\/daily-briefing["']\s*:\s*["']\/app\/now["']/);
    expect(registrySource).not.toMatch(/["']\/app\/daily-briefing["']\s*:\s*["']\/app\/now\/deep["']/);
  });
});
