import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const projectRoot = resolve(import.meta.dirname, "..");

function source(relativePath: string): string {
  return readFileSync(resolve(projectRoot, relativePath), "utf8");
}

describe("WHY destination composition", () => {
  const whySource = source("client/src/pages/Why.tsx");
  const appSource = source("client/src/App.tsx");

  it("presents the required causal information sequence", () => {
    const orderedSections = [
      ["explanation", 'data-why-section="explanation"'],
      ["drivers", '<Section id="drivers"'],
      ["transmission", '<Section id="transmission"'],
      ["positioning", '<Section id="positioning"'],
      ["duration-change", '<Section id="duration-change"'],
      ["history", '<Section id="history"'],
      ["invalidation", '<Section id="invalidation"'],
      ["confidence", '<Section id="confidence"'],
      ["asha", '<Section id="asha"'],
      ["expert-handoffs", '<Section id="expert-handoffs"'],
    ];

    let previousIndex = -1;
    for (const [section, token] of orderedSections) {
      const currentIndex = whySource.indexOf(token);
      expect(currentIndex, `${section} section must exist`).toBeGreaterThan(-1);
      expect(currentIndex, `${section} must follow the prior section`).toBeGreaterThan(previousIndex);
      previousIndex = currentIndex;
    }
  });

  it("binds WHY to the canonical destination and preserves Today's Story as its deep view", () => {
    expect(appSource).toContain('import Why from "./pages/Why"');
    expect(appSource).toContain('const WHY_DEEP_PATH = "/app/why/deep"');
    expect(appSource).toContain("why: Why");
    expect(appSource).toContain('<Route path={WHY_DEEP_PATH} component={TodaysStory} />');
    expect(appSource.indexOf("<Route path={WHY_DEEP_PATH}")).toBeLessThan(appSource.indexOf("<CanonicalDestinationRoutes"));
  });

  it("projects causal explanation from the shared canonical MarketState with explicit deterministic fallback", () => {
    expect(whySource).toContain("useEngine()");
    expect(whySource).toContain("marketState?.why.evidenceFamilies ?? output.domains.map");
    expect(whySource).toContain("marketState?.why.story ?? output.narrative.summary");
    expect(whySource).toContain("marketState?.why.whyThisRegime ?? output.narrative.regimeAssessment");
    expect(whySource).toContain('marketMode === "canonical" ? "Canonical state" : "Deterministic fallback"');
    expect(whySource).toContain("Canonical refresh is degraded");
    expect(whySource).not.toContain("trpc.");
  });

  it("keeps confidence, source health, freshness, warnings, history, and invalidation attached", () => {
    expect(whySource).toContain("marketState?.why.evidenceConsensus");
    expect(whySource).toContain("sourceHealth.map");
    expect(whySource).toContain("marketState?.warnings.length");
    expect(whySource).toContain("lastUpdated?.toLocaleString()");
    expect(whySource).toContain("marketState?.history.observationCount");
    expect(whySource).toContain("marketState?.outlook.invalidationConditions");
    expect(whySource).toContain("No canonical duration records are available");
  });

  it("uses registry-owned ASHA, expert, and OUTLOOK handoffs", () => {
    expect(whySource).toContain("PERSISTENT_UTILITY_BY_ID.asha.path");
    expect(whySource).toContain("EXPERT_WORKSPACE_BY_ID.pressure.path");
    expect(whySource).toContain("CANONICAL_DESTINATION_BY_ID.outlook.path");
    expect(whySource).toContain('const WHY_DEEP_PATH = "/app/why/deep"');
  });

  it("uses the shared canonical 0–100 pressure formatter and states the positioning evidence boundary", () => {
    expect(whySource).toContain("formatCanonicalScore(pressure)");
    expect(whySource).toContain("normalizeCanonicalMetric(domain.score * 10)");
    expect(whySource).toContain("not publish a standalone institutional-positioning feed");
    expect(whySource).not.toMatch(/\}\s*\/10\b/);
    expect(whySource).not.toContain("/10</");
  });
});
