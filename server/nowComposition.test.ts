import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const projectRoot = resolve(import.meta.dirname, "..");

function source(relativePath: string): string {
  return readFileSync(resolve(projectRoot, relativePath), "utf8");
}

describe("NOW destination composition", () => {
  const nowSource = source("client/src/pages/Now.tsx");
  const appSource = source("client/src/App.tsx");

  it("presents the required conclusion-first information sequence", () => {
    const orderedSections = [
      ["verdict", 'data-now-section="verdict"'],
      ["summary", '<Section id="summary"'],
      ["changed", '<Section id="changed"'],
      ["breadth", '<Section id="breadth"'],
      ["probabilities", '<Section id="probabilities"'],
      ["why", '<Section id="why"'],
      ["history", '<Section id="history"'],
      ["watch-next", '<Section id="watch-next"'],
      ["asha", '<Section id="asha"'],
      ["expert-tools", '<Section id="expert-tools"'],
      ["confidence", '<Section id="confidence"'],
    ];

    let previousIndex = -1;
    for (const [section, token] of orderedSections) {
      const currentIndex = nowSource.indexOf(token);
      expect(currentIndex, `${section} section must exist`).toBeGreaterThan(-1);
      expect(currentIndex, `${section} must follow the prior section`).toBeGreaterThan(previousIndex);
      previousIndex = currentIndex;
    }
  });

  it("binds NOW to the canonical destination and preserves the legacy dashboard as a deep view", () => {
    expect(appSource).toContain('import Now from "./pages/Now"');
    expect(appSource).toContain('const NOW_DEEP_PATH = "/app/now/deep"');
    expect(appSource).toContain("now: Now");
    expect(appSource).toContain('<Route path={NOW_DEEP_PATH} component={Dashboard} />');
    expect(appSource).not.toContain('<Route path="/app/dashboard" component={Dashboard} />');
  });

  it("mounts exactly one cinematic authentication gate", () => {
    expect(appSource.match(/<CinematicAuthGate/g) ?? []).toHaveLength(1);
  });

  it("uses registry-owned handoffs for WHY, WATCH, ASHA, and expert workspaces", () => {
    expect(nowSource).toContain("CANONICAL_DESTINATION_BY_ID.why.path");
    expect(nowSource).toContain("CANONICAL_DESTINATION_BY_ID.watch.path");
    expect(nowSource).toContain("PERSISTENT_UTILITY_BY_ID.asha.path");
    expect(nowSource).toContain("EXPERT_WORKSPACE_BY_ID.pressure.path");
    expect(nowSource).toContain('EXPERT_WORKSPACE_BY_ID["signal-outlook"].path');
    expect(nowSource).toContain('EXPERT_WORKSPACE_BY_ID["decision-engine"].path');
    expect(nowSource).toContain('EXPERT_WORKSPACE_BY_ID["symbol-intelligence"].path');
  });

  it("renders every identified NOW pressure surface on the canonical 0–100 scale", () => {
    const hero = source("client/src/components/AshaHeroSection.tsx");
    // The briefing tiles are built by the canonical-gated helper (PR #58 r3).
    const briefing = source("client/src/components/AshaLiveBriefing.tsx") + source("client/src/lib/ashaBriefingContext.ts");
    const contextStrip = source("client/src/components/MarketContextStrip.tsx");
    const synthesis = source("client/src/components/MarketSynthesisPanel.tsx");
    const narrativeBanner = source("client/src/components/SeismographNarrativeBanner.tsx");
    const appHeaderStrip = source("client/src/lib/appHeaderStrip.ts");

    expect(nowSource).toContain("formatCanonicalScore(pressure)");
    expect(hero).toContain("formatCanonicalScore(score * 10)");
    expect(briefing).toContain("formatCanonicalScore(score10 * 10)");
    expect(contextStrip).toContain("? formatCanonicalScore(canonicalPressure)");
    expect(contextStrip).not.toContain("overall.score * 10"); // no demo-input fallback number
    expect(synthesis).toContain("? formatCanonicalScore(canonicalState.pressureIndex) : \"UNAVAILABLE\"");
    expect(synthesis).not.toContain("pressureIndex ?? 0"); // no 0/100 fallback
    expect(narrativeBanner).toContain("formatCanonicalScore(output.pressureScore)");
    // Header strip Pressure Index reads the canonical snapshot score (0–100), not the legacy 0–10 engine.
    expect(appHeaderStrip).toContain("value: formatCanonicalScore(score as number)");

    expect(hero).not.toContain("/10</span>");
    expect(briefing).not.toContain("`${overall.score.toFixed(1)}/10`");
    expect(contextStrip).not.toContain(">/10</span>");
    expect(synthesis).not.toContain("{overall.score.toFixed(1)}/10");
    expect(narrativeBanner).not.toContain("{output.pressureScore.toFixed(1)}/10");
  });
  it("renders the Case File as a five-question synthesis without changing the canonical framework", () => {
    expect(nowSource).toContain('data-now-section="case-file"');
    expect(nowSource).toContain("FAULTLINE Case File");
    expect(nowSource).toContain("One market state. Five questions.");

    for (const id of ["now", "why", "outlook", "watch", "act"]) {
      expect(nowSource).toContain(`data-case-file-question={item.id}`);
      expect(nowSource).toContain(`id: "${id}"`);
    }

    expect(nowSource).toContain("CANONICAL_DESTINATION_BY_ID.now");
    expect(nowSource).toContain("CANONICAL_DESTINATION_BY_ID.why");
    expect(nowSource).toContain("CANONICAL_DESTINATION_BY_ID.outlook");
    expect(nowSource).toContain("CANONICAL_DESTINATION_BY_ID.watch");
    expect(nowSource).toContain("CANONICAL_DESTINATION_BY_ID.act");
  });

  it("builds Case File answers from the existing governed MarketState instead of a new scoring path", () => {
    expect(nowSource).toContain("marketState.why.narrative.whyIsItHappening");
    expect(nowSource).toContain("marketState.outlook.highestProbabilityPath");
    expect(nowSource).toContain("watchItems[0]");
    expect(nowSource).toContain("marketState.act.decisionSummary");
    expect(nowSource).toContain("marketState.act.whatWouldInvalidate");
    expect(nowSource).not.toContain("caseFileScore");
    expect(nowSource).not.toContain("caseFileProbability");
  });

});
