import { readFileSync } from "node:fs";
import path from "node:path";
import React, { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { Router } from "wouter";
import { computeSOB } from "./sobEngine";

// Routed /10 score text → canonical /100 (display only), missing → "—".
vi.mock("@/lib/trpc", () => ({
  trpc: {
    sob: {
      getSOB: {
        useQuery: (input: Parameters<typeof computeSOB>[0]) => ({ data: computeSOB(input), isLoading: false }),
      },
    },
  },
}));

// The vitest transform uses the classic JSX runtime for client components.
(globalThis as any).React = React;

const root = path.resolve(import.meta.dirname, "..");
const read = (rel: string) => readFileSync(path.join(root, rel), "utf8");
// Source without line comments (a comment may quote the old "56.0/10" bug).
const code = (rel: string) => read(rel).split("\n").filter(l => !/^\s*(\/\/|\*|\/\*)/.test(l)).join("\n");
// A "/10" or "/ 10.0" score suffix after an interpolation, a tag or a digit.
const slashTen = /(\}|>|\d)\s?\/\s?10(\.0)?(?![\d%])/g;

describe("routed X/10 score text is converted to /100 (class a)", () => {
  const converted = [
    "client/src/components/SystemicAlerts.tsx",
    "client/src/lib/regimeAlerts.ts",
    "client/src/pages/CryptoSearch.tsx",
    "client/src/pages/CryptoWatchlist.tsx",
    "client/src/components/RisingStarsPanel.tsx",
    "client/src/pages/DayTradeIntelligence.tsx",
    "client/src/components/SOBPanel.tsx",
  ];
  for (const file of converted) {
    it(`${file} renders no X/10 score text`, () => {
      const src = code(file);
      expect(src.match(slashTen) ?? []).toEqual([]);
      expect(src).not.toMatch(/\.toFixed\(1\)\}\s?\/\s?10\b/);
    });
  }

  it("CryptoSignals REGIME SCORE is the engine composite on /100; only the two native 0–10 per-asset ratings keep /10 (class b)", () => {
    const src = code("client/src/pages/CryptoSignals.tsx");
    expect(src).toContain("{regimeScoreText}<span");
    expect(src).toContain(": score100Value(engine?.output?.overall?.score);");
    // Fix-up 4: degraded mode uses the canonical pressure, never the demo engine composite.
    expect(src).toContain("? (canonicalPressure100 === null ? score100Value(null) : String(Math.round(canonicalPressure100)))");
    expect(src).not.toContain("overall?.score?.toFixed(1)");
    const remaining = src.split("\n").filter(line => slashTen.test(line) && (slashTen.lastIndex = 0, true));
    expect(remaining).toHaveLength(2);
    expect(remaining[0]).toContain("sig.regimeAlignmentScore}/10");
    expect(remaining[1]).toContain("sig.cryptoFactors.liquidityScore.toFixed(1)}/10");
  });

  it("DayTrade pressure has no 0 fallback and renders — when missing", () => {
    const src = read("client/src/pages/DayTradeIntelligence.tsx");
    expect(src).not.toMatch(/overall\?\.score \?\? 0/);
    expect(src).toContain('value: pressure === null ? "—" : `${score100Value(pressure)}/100`');
  });

  it("RisingStars component scores stay on their native /100", () => {
    const src = read("client/src/components/RisingStarsPanel.tsx");
    expect(src).not.toContain("component.score / 10");
    expect(src).toContain("`${Math.round(component.score as number)}/100`");
  });
});

describe("alert generators produce /100 scores and pts deltas", () => {
  it("regimeAlerts: domain threshold + directional-change alerts", async () => {
    const { generateAlerts } = await import("../client/src/lib/regimeAlerts");
    const output = {
      regime: { code: "R", label: "Regime" },
      domains: [{ id: "credit-stress", label: "Credit Stress", score: 7.8, drivers: ["d1"], description: "" }],
    } as any;
    const alerts = generateAlerts(output, {}, "R", { "credit-stress": 6.5 });
    const text = JSON.stringify(alerts);
    expect(text).toContain("Credit Stress at 78/100");
    expect(text).toContain('"value":"78"');
    expect(text).toContain('"threshold":"75"');
    expect(text).toContain("(+13 pts)");
    expect(text).toContain("by 13 pts.");
    expect(text).not.toMatch(/\d\/10(?!\d)/);
  });

  it("SystemicAlerts: composite and vector scores on /100", async () => {
    const { generateSystemicAlerts } = await import("../client/src/components/SystemicAlerts");
    const output = {
      overall: { score: 7.2 },
      regime: { label: "Elevated", sublabel: "s", color: "#fff" },
      analogs: [],
      domains: [
        { id: "liquidity", label: "Liquidity", score: 6.1 },
        { id: "credit-stress", label: "Credit", score: 6.4 },
        { id: "ai-bubble", label: "AI", score: 6.7 },
      ],
    } as any;
    const text = JSON.stringify(generateSystemicAlerts(output));
    expect(text).toContain("Pressure Score has reached 72/100");
    expect(text).toContain("Score 61/100");
    expect(text).toContain("Score 64/100");
    expect(text).toContain("Score 67/100");
    expect(text).toContain("elevated above 60/100");
    expect(text).not.toMatch(/\d\/10(?!\d)/);
  });
});

const renderSob = (SOBPanel: any, props: Record<string, unknown>) =>
  renderToStaticMarkup(createElement(Router, { ssrPath: "/app/now/deep" }, createElement(SOBPanel, props)));

describe("SOBPanel: missing pressure is null and renders —", () => {
  it("shows — (no invented 30, no pressure-derived trend) when pressure is null", async () => {
    const { default: SOBPanel } = await import("../client/src/components/SOBPanel");
    for (const pressureIndex of [null, undefined, Number.NaN]) {
      const html = renderSob(SOBPanel, { pressureIndex, regime: "Elevated" });
      expect(html).toContain('data-sob-trend="unavailable"');
      expect(html).toContain("—");
    }
    const compact = renderSob(SOBPanel, { pressureIndex: null, compact: true });
    expect(compact).toContain('data-sob-trend="unavailable"');
  });
  it("shows the trend when pressure is present", async () => {
    const { default: SOBPanel } = await import("../client/src/components/SOBPanel");
    const html = renderSob(SOBPanel, { pressureIndex: 70, regime: "Elevated" });
    expect(html).not.toContain('data-sob-trend="unavailable"');
  });
  it("has no pressureIndex default of 30, and Dashboard passes null when the score is missing", () => {
    expect(read("client/src/components/SOBPanel.tsx")).not.toMatch(/pressureIndex\s*=\s*30/);
    const dashboard = read("client/src/pages/Dashboard.tsx");
    expect(dashboard).not.toMatch(/Math\.round\(overall\.score \* 10\) : 30/);
    expect(dashboard).toContain("pressureIndex={finiteOrNull(overall?.score) === null ? null : Math.round(overall.score * 10)}");
  });
});
