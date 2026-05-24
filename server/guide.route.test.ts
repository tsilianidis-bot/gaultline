/**
 * Guide route smoke test — verifies the /guide route is registered
 * in App.tsx and the Guide.tsx file exists with expected section IDs.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

describe("Guide page", () => {
  const guideSrc = readFileSync(
    resolve(__dirname, "../client/src/pages/Guide.tsx"),
    "utf-8"
  );
  const appSrc = readFileSync(
    resolve(__dirname, "../client/src/App.tsx"),
    "utf-8"
  );

  it("Guide.tsx exists and exports a default component", () => {
    expect(guideSrc).toContain("export default function Guide");
  });

  it("/guide route is registered in App.tsx", () => {
    expect(appSrc).toContain('path="/app/guide"');
    // Guide uses React.lazy — check for lazy import pattern
    expect(appSrc).toContain('import("./pages/Guide")');
  });

  it("Guide page contains all 14 required sections", () => {
    const requiredSections = [
      "overview", "pressure", "dashboard", "scores",
      "charts", "ai-watch", "signals", "watchlist",
      "alerts", "scenarios", "analogs", "simulate",
      "report", "glossary",
    ];
    for (const section of requiredSections) {
      expect(guideSrc).toContain(`id: "${section}"`);
    }
  });

  it("Guide page includes disclaimer text", () => {
    expect(guideSrc).toContain("DISCLAIMER");
    expect(guideSrc).toContain("financial advice");
  });

  it("Guide page documents all FAULTLINE signal labels", () => {
    expect(guideSrc).toContain("MOMENTUM BREAKOUT");
    expect(guideSrc).toContain("AI BUBBLE EXPOSURE");
    expect(guideSrc).toContain("LIQUIDITY SENSITIVE");
    expect(guideSrc).toContain("DEBT STRESS RISK");
    expect(guideSrc).toContain("RECESSION DEFENSIVE");
    expect(guideSrc).toContain("MACRO BENEFICIARY");
    expect(guideSrc).toContain("MACRO VULNERABLE");
  });
});
