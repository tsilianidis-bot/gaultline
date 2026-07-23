import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const projectRoot = resolve(import.meta.dirname, "..");

function source(relativePath: string): string {
  return readFileSync(resolve(projectRoot, relativePath), "utf8");
}

describe("ACT destination composition", () => {
  const actSource = source("client/src/pages/Act.tsx");
  const appSource = source("client/src/App.tsx");

  it("presents the required bounded decision sequence", () => {
    const orderedSections = [
      ["posture", 'data-act-section="posture"'],
      ["evidence-boundary", 'id="evidence-boundary"'],
      ["scenario-responses", 'id="scenario-responses"'],
      ["risk-controls", 'id="risk-controls"'],
      ["invalidation", 'id="invalidation"'],
      ["monitored-triggers", 'id="monitored-triggers"'],
      ["confidence", 'id="confidence"'],
      ["asha", 'id="asha"'],
      ["expert-handoffs", 'id="expert-handoffs"'],
    ];

    let previousIndex = -1;
    for (const [section, token] of orderedSections) {
      const currentIndex = actSource.indexOf(token);
      expect(currentIndex, `${section} section must exist`).toBeGreaterThan(-1);
      expect(currentIndex, `${section} must follow the prior section`).toBeGreaterThan(previousIndex);
      previousIndex = currentIndex;
    }
  });

  it("binds ACT to the canonical destination and preserves Smart Discovery as its deep view", () => {
    expect(appSource).toContain('import Act from "./pages/Act"');
    expect(appSource).toContain('const ACT_DEEP_PATH = "/app/act/deep"');
    expect(appSource).toContain("act: Act");
    expect(appSource).toContain('<Route path={ACT_DEEP_PATH} component={SmartDiscovery} />');
    expect(appSource.indexOf("<Route path={ACT_DEEP_PATH}")).toBeLessThan(appSource.indexOf("<CanonicalDestinationRoutes"));
  });

  it("projects decision posture from shared canonical MarketState with explicit deterministic fallback", () => {
    expect(actSource).toContain("useEngine()");
    expect(actSource).toContain("marketState?.act.marketPosture");
    expect(actSource).toContain("marketState?.act.decisionSummary");
    expect(actSource).toContain("marketState?.act.riskControls ?? []");
    expect(actSource).toContain("marketState?.act.whatWouldInvalidate");
    expect(actSource).toContain('marketMode === "canonical" && Boolean(marketState)');
    expect(actSource).toContain("Canonical refresh is degraded");
    expect(actSource).not.toContain("trpc.");
  });

  it("keeps evidence, advice, scenario, and fallback boundaries explicit", () => {
    expect(actSource).toContain("does not create individualized investment advice");
    expect(actSource).toContain("It does not know a user&apos;s objectives");
    expect(actSource).toContain("A probability is context for a decision process, not a direct instruction");
    expect(actSource).toContain("Canonical risk controls are unavailable");
    expect(actSource).toContain("ACT will not manufacture a threshold");
    expect(actSource).toContain("not a directive to buy, sell, or hedge");
  });

  it("keeps monitored triggers, confidence, source health, freshness, warnings, and history attached", () => {
    expect(actSource).toContain("marketState?.watch.whatToWatch");
    expect(actSource).toContain("marketState?.watch.developingConditions ?? []");
    expect(actSource).toContain("marketState?.outlook.probabilities.confidence");
    expect(actSource).toContain("sourceHealth.map");
    expect(actSource).toContain("marketState?.warnings.length");
    expect(actSource).toContain('marketState?.freshness ?? "Fallback"');
    expect(actSource).toContain("marketState?.history.observationCount");
    expect(actSource).toContain("lastUpdated?.toLocaleString()");
  });

  it("uses registry-owned ASHA, expert-workspace, and WATCH handoffs", () => {
    expect(actSource).toContain("PERSISTENT_UTILITY_BY_ID.asha.path");
    expect(actSource).toContain('EXPERT_WORKSPACE_BY_ID["decision-engine"].path');
    expect(actSource).toContain('EXPERT_WORKSPACE_BY_ID["symbol-intelligence"].path');
    expect(actSource).toContain('EXPERT_WORKSPACE_BY_ID["day-trade-intelligence"].path');
    expect(actSource).toContain("CANONICAL_DESTINATION_BY_ID.watch.path");
    expect(actSource).toContain('const ACT_DEEP_PATH = "/app/act/deep"');
  });

  it("formats pressure, confidence, and scenario probabilities on the shared canonical 0–100 scale", () => {
    expect(actSource).toContain("formatCanonicalScore(pressure)");
    expect(actSource).toContain("formatCanonicalPercent(confidence)");
    expect(actSource).toContain("formatCanonicalPercent(scenario.probability)");
    expect(actSource).not.toMatch(/\}\s*\/10\b/);
    expect(actSource).not.toContain("/10</");
  });
});
