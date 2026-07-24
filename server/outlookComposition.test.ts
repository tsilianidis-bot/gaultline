import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const projectRoot = resolve(import.meta.dirname, "..");

function source(relativePath: string): string {
  return readFileSync(resolve(projectRoot, relativePath), "utf8");
}

describe("OUTLOOK destination composition", () => {
  const outlookSource = source("client/src/pages/Outlook.tsx");
  const appSource = source("client/src/App.tsx");

  it("presents the required probability and transition sequence", () => {
    const orderedSections = [
      ["forecast", 'data-outlook-section="forecast"'],
      ["ranked-scenarios", '<Section id="ranked-scenarios"'],
      ["probability-changes", '<Section id="probability-changes"'],
      ["horizons", '<Section id="horizons"'],
      ["triggers", '<Section id="triggers"'],
      ["invalidations", '<Section id="invalidations"'],
      ["indicators", '<Section id="indicators"'],
      ["analogs", '<Section id="analogs"'],
      ["confidence", '<Section id="confidence"'],
      ["asha", '<Section id="asha"'],
      ["expert-handoffs", '<Section id="expert-handoffs"'],
    ];

    let previousIndex = -1;
    for (const [section, token] of orderedSections) {
      const currentIndex = outlookSource.indexOf(token);
      expect(currentIndex, `${section} section must exist`).toBeGreaterThan(-1);
      expect(currentIndex, `${section} must follow the prior section`).toBeGreaterThan(previousIndex);
      previousIndex = currentIndex;
    }
  });

  it("binds OUTLOOK to the canonical destination and preserves Signal Outlook Center as its deep view", () => {
    expect(appSource).toContain('import Outlook from "./pages/Outlook"');
    expect(appSource).toContain('const OUTLOOK_DEEP_PATH = "/app/outlook/deep"');
    expect(appSource).toContain("outlook: Outlook");
    expect(appSource).toContain('<Route path={OUTLOOK_DEEP_PATH} component={SignalOutlookCenter} />');
    expect(appSource.indexOf("<Route path={OUTLOOK_DEEP_PATH}")).toBeLessThan(appSource.indexOf("<CanonicalDestinationRoutes"));
  });

  it("projects scenario and transition evidence from shared canonical MarketState with explicit deterministic fallback", () => {
    expect(outlookSource).toContain("useEngine()");
    expect(outlookSource).toContain('marketState?.outlook.regimeProbabilities ?? {');
    expect(outlookSource).toContain("marketState?.outlook.probabilities ?? {");
    expect(outlookSource).toContain("marketState?.outlook.transitionProbabilities ?? null");
    expect(outlookSource).toContain("marketState?.outlook.highestProbabilityPath ??");
    expect(outlookSource).toContain('marketMode === "canonical" ? "Canonical state" : "Deterministic fallback"');
    expect(outlookSource).toContain("Canonical refresh is degraded");
    expect(outlookSource).not.toContain("trpc.");
  });

  it("keeps probability-change and forecast-horizon evidence boundaries explicit", () => {
    expect(outlookSource).toContain("does not yet publish a prior probability vector");
    expect(outlookSource).toContain("No point-change labels are manufactured");
    expect(outlookSource).toContain("does not attach arbitrary calendar targets");
    expect(outlookSource).toContain("Canonical transition timing is unavailable in deterministic fallback mode");
  });

  it("keeps invalidation, source health, freshness, confidence, warnings, and historical context attached", () => {
    expect(outlookSource).toContain("marketState?.outlook.invalidationConditions ?? []");
    expect(outlookSource).toContain("sourceHealth.map");
    expect(outlookSource).toContain("marketState?.warnings.length");
    expect(outlookSource).toContain("lastUpdated?.toLocaleString()");
    expect(outlookSource).toContain("marketState?.history.observationCount");
    expect(outlookSource).toContain("marketState?.outlook.topAnalog");
  });

  it("uses registry-owned ASHA, expert, ACT, and WATCH handoffs", () => {
    expect(outlookSource).toContain("PERSISTENT_UTILITY_BY_ID.asha.path");
    expect(outlookSource).toContain('EXPERT_WORKSPACE_BY_ID["signal-outlook"].path');
    expect(outlookSource).toContain('EXPERT_WORKSPACE_BY_ID["decision-engine"].path');
    expect(outlookSource).toContain("CANONICAL_DESTINATION_BY_ID.watch.path");
    expect(outlookSource).toContain('const OUTLOOK_DEEP_PATH = "/app/outlook/deep"');
  });

  it("formats every probability, confidence, similarity, and pressure metric on the shared canonical 0–100 scale", () => {
    expect(outlookSource).toContain("formatCanonicalPercent(scenario.probability)");
    expect(outlookSource).toContain("formatCanonicalPercent(probabilityDistribution.confidence)");
    expect(outlookSource).toContain("formatCanonicalPercent(topAnalog.similarity)");
    expect(outlookSource).toContain("formatCanonicalScore(marketState?.now.pressureScore ?? output.overall.score * 10)");
    expect(outlookSource).not.toMatch(/\}\s*\/10\b/);
    expect(outlookSource).not.toContain("/10</");
  });
});
