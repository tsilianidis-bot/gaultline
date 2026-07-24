import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const projectRoot = resolve(import.meta.dirname, "..");

function source(relativePath: string): string {
  return readFileSync(resolve(projectRoot, relativePath), "utf8");
}

describe("WATCH destination composition", () => {
  const watchSource = source("client/src/pages/Watch.tsx");
  const appSource = source("client/src/App.tsx");

  it("presents the required monitoring information sequence", () => {
    const orderedSections = [
      ["what-changed", 'data-watch-section="what-changed"'],
      ["developing-conditions", 'id="developing-conditions"'],
      ["active-patterns", 'id="active-patterns"'],
      ["leading-indicators", 'id="leading-indicators"'],
      ["duration-trend", 'id="duration-trend"'],
      ["expected-impact", 'id="expected-impact"'],
      ["invalidations", 'id="invalidations"'],
      ["confidence", 'id="confidence"'],
      ["asha", 'id="asha"'],
      ["expert-handoffs", 'id="expert-handoffs"'],
    ];

    let previousIndex = -1;
    for (const [section, token] of orderedSections) {
      const currentIndex = watchSource.indexOf(token);
      expect(currentIndex, `${section} section must exist`).toBeGreaterThan(-1);
      expect(currentIndex, `${section} must follow the prior section`).toBeGreaterThan(previousIndex);
      previousIndex = currentIndex;
    }
  });

  it("binds WATCH to the canonical destination and preserves AI Watch as its deep view", () => {
    expect(appSource).toContain('import Watch from "./pages/Watch"');
    expect(appSource).toContain('const WATCH_DEEP_PATH = "/app/watch/deep"');
    expect(appSource).toContain("watch: Watch");
    expect(appSource).toContain('<Route path={WATCH_DEEP_PATH} component={AIWatch} />');
    expect(appSource.indexOf("<Route path={WATCH_DEEP_PATH}")).toBeLessThan(appSource.indexOf("<CanonicalDestinationRoutes"));
  });

  it("projects monitoring evidence from shared canonical MarketState with explicit deterministic fallback", () => {
    expect(watchSource).toContain("useEngine()");
    expect(watchSource).toContain("marketState?.watch.whatChanged");
    expect(watchSource).toContain("marketState?.watch.developingConditions");
    expect(watchSource).toContain("marketState?.watch.activePatterns ?? []");
    expect(watchSource).toContain("marketState?.watch.whatToWatch");
    expect(watchSource).toContain("marketState?.why.evidenceFamilies");
    expect(watchSource).toContain('marketMode === "canonical" && Boolean(marketState)');
    expect(watchSource).toContain("Canonical refresh is degraded");
    expect(watchSource).not.toContain("trpc.");
    expect(watchSource).not.toContain("aiWatchItems");
  });

  it("keeps duration, expected impact, trend, and pattern boundaries explicit", () => {
    expect(watchSource).toContain("condition.durationDescription");
    expect(watchSource).toContain("condition.expectedImpact");
    expect(watchSource).toContain("pattern.daysActive");
    expect(watchSource).toContain("pattern.invalidationConditions");
    expect(watchSource).toContain("Canonical duration records are unavailable in deterministic fallback mode");
    expect(watchSource).toContain("Expected-impact language is withheld until canonical monitoring state is restored");
    expect(watchSource).toContain("does not promote deterministic domain scores into named historical patterns");
  });

  it("keeps confidence, source health, freshness, warnings, history, and invalidation attached", () => {
    expect(watchSource).toContain("marketState?.outlook.probabilities.confidence");
    expect(watchSource).toContain("marketState?.outlook.invalidationConditions ?? []");
    expect(watchSource).toContain("sourceHealth.map");
    expect(watchSource).toContain("marketState?.warnings.length");
    expect(watchSource).toContain("marketState?.freshness ?? \"Fallback\"");
    expect(watchSource).toContain("marketState?.history.observationCount");
    expect(watchSource).toContain("lastUpdated?.toLocaleString()");
  });

  it("uses registry-owned ASHA, alerts, expert, and ACT handoffs", () => {
    expect(watchSource).toContain("PERSISTENT_UTILITY_BY_ID.asha.path");
    expect(watchSource).toContain("PERSISTENT_UTILITY_BY_ID.alerts.path");
    expect(watchSource).toContain("EXPERT_WORKSPACE_BY_ID.pressure.path");
    expect(watchSource).toContain('EXPERT_WORKSPACE_BY_ID["smart-discovery"].path');
    expect(watchSource).toContain("CANONICAL_DESTINATION_BY_ID.act.path");
    expect(watchSource).toContain('const WATCH_DEEP_PATH = "/app/watch/deep"');
  });

  it("formats every confidence, pressure, and evidence-strength metric on the shared canonical 0–100 scale", () => {
    expect(watchSource).toContain("formatCanonicalScore(pressure)");
    expect(watchSource).toContain("formatCanonicalPercent(confidence)");
    expect(watchSource).toContain("formatCanonicalPercent(pattern.confidence)");
    expect(watchSource).toContain("formatCanonicalScore(indicator.strength)");
    expect(watchSource).toContain("normalizeCanonicalMetric(domain.score * 10)");
    expect(watchSource).not.toMatch(/\}\s*\/10\b/);
    expect(watchSource).not.toContain("/10</");
  });
});
