import { readFileSync } from "node:fs";
import path from "node:path";
import React, { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { Router } from "wouter";
import { describe, expect, it, vi } from "vitest";

// QA r12 follow-ups:
// 1. "The highest-probability outcome (60% historical frequency)" — the
//    narrative is recomputed per request and served from an in-memory cache,
//    but the response boundary (marketState.current via
//    assembleCanonicalMarketState, seismograph.getUnifiedIntelligence via
//    overlayUnifiedSeismographIntelligence) now cleans it anyway, so an older
//    generator's / cached text cannot reach /app/now or /app/act.
// 2. Ticker header "CONFIDENCE N%" was |outlookScore − 50| × 2 — a formula,
//    not a calibrated confidence. Withheld by outlook.getSecurityContext and
//    shown as "Not established" in UniversalTickerHeader.
(globalThis as any).React = React;

vi.mock("./signalOutlook", async importOriginal => ({
  ...(await importOriginal<Record<string, unknown>>()),
  getQuickOutlook: vi.fn(async (symbol: string) => ({ symbol, assetType: "stock", outlookScore: 55, direction: "Neutral", confidence: 10, riskLevel: "Moderate", dataStatus: "Live" })),
}));
vi.mock("./yahooProxy", async importOriginal => ({
  ...(await importOriginal<Record<string, unknown>>()),
  getQuote: vi.fn(async () => ({ price: 100, change: 1, changePercent: 1, volume: 10, marketState: "REGULAR" })),
}));
const fixtures = vi.hoisted(() => ({ data: {} as Record<string, unknown> }));
vi.mock("@/lib/trpc", () => {
  const node = (keys: string[]): any => new Proxy(() => undefined, {
    get: (_t, prop: string) => {
      if (prop === "useQuery") return () => ({ data: fixtures.data[keys.join(".")], isLoading: false, refetch: () => undefined });
      if (prop === "useMutation") return () => ({ mutate: () => undefined, mutateAsync: async () => undefined, isPending: false });
      if (prop === "useUtils" || prop === "useContext") return () => node([]);
      return node([...keys, prop]);
    },
  });
  return { trpc: node([]) };
});

import { assembleCanonicalMarketState } from "./marketStateService";
import { overlayUnifiedSeismographIntelligence, withoutNarrativeText } from "./probabilityContract";
import { outlookRouter } from "./routers/outlook";
import UniversalTickerHeader from "../client/src/components/UniversalTickerHeader";

const root = path.resolve(import.meta.dirname, "..");
const read = (rel: string) => readFileSync(path.join(root, rel), "utf8");
const text = (html: string) => html.replace(/<[^>]+>/g, " ").replace(/&[a-z]+;/g, " ").replace(/\s+/g, " ");
const prodState = JSON.parse(read("server/__fixtures__/prod-2026-10-01/market-state-current.json"));
const STORED = prodState.outlook.highestProbabilityPath as string;
const PERCENT_CLAIM = /\d+(?:\.\d+)?\s*%\s*historical frequency|\(\s*\d+(?:\.\d+)?\s*%/i;

function sourceWith(narrativeText: string) {
  return {
    currentScore: 30, currentRegime: "Moderate Risk", currentStressLevel: "Elevated", currentDirection: "Stable", currentPercentile: 50,
    dataFreshness: "live", lastUpdated: "2026-10-01T18:00:00.000Z", providerProvenance: { fred: { status: "live", detail: "FRED", asOf: Date.parse("2026-10-01T18:00:00.000Z") } }, todayStory: "s", keyDevelopments: [],
    whyThisScore: "w", whyThisRegime: "r",
    probabilities: { bull: 64, neutral: 21, bear: 15, confidence: 50, primaryDriver: "p", evidenceBasis: "e", historicalBasis: "h" },
    evidenceFamilies: [], evidenceConsensus: "weak", topAnalog: null, analogSummary: "a",
    transitionProbabilities: { remainInRegime: 70, transitionToElevated: 15, transitionToLow: 10, transitionToCrisis: 5, confidence: 40, historicalBasis: "h", currentEvidence: [] },
    evolution: { whatChanged: [], whatToWatch: [], accelerating: false, buildingPressure: false, invalidationConditions: [] },
    memory: { observationCount: 1, datasetSpan: "x", currentStreakDescription: "x", lastMajorShift: "x" },
    regimeProbabilities5way: { bull: 53, softLanding: 33, stagflation: 8, recession: 4, crash: 2 },
    developingConditions: [],
    marketNarrative: {
      whatIsHappening: `Pressure is moderate. ${narrativeText}`,
      whyIsItHappening: "There is a 70% probability of a bull continuation. Credit spreads are contained.",
      whatHasChanged: "VIX fell 5% this week.",
      whatIsBuildingBeneathSurface: narrativeText,
      highestProbabilityPath: narrativeText,
      whatWouldInvalidate: `${narrativeText} A drawdown of 10% would invalidate it.`,
    },
    activePatterns: [],
  } as never;
}

describe("QA r12 #1: stored / cached narrative '(60% historical frequency)' comes out clean", () => {
  it("the Oct 1 prod fixture really carries the 60% text (guards the premise)", () => {
    expect(STORED).toContain("(60% historical frequency)");
    expect(prodState.act.decisionSummary).toContain("(60% historical frequency)");
  });

  it("withoutNarrativeText rewrites the frequency % and keeps the rest of the sentence", () => {
    const out = withoutNarrativeText(STORED);
    expect(out).not.toMatch(/%/);
    expect(out).toContain("The highest-probability outcome (frequency withheld: uncalibrated) is continuation of the current MODERATE RISK regime");
    expect(withoutNarrativeText("Regimes held at 60% historical frequency.")).toBe("Regimes held at frequency withheld (uncalibrated).");
    // Head generator text is unchanged; ordinary move sizes are kept.
    const head = "The most frequent historical outcome (frequency withheld: uncalibrated) is continuation.";
    expect(withoutNarrativeText(head)).toBe(head);
    expect(withoutNarrativeText("A drawdown of 10% is typical.")).toBe("A drawdown of 10% is typical.");
    expect(withoutNarrativeText("There is a 70% probability of a rally. Spreads are calm.")).toBe("Spreads are calm.");
  });

  it("marketState.current boundary (assembleCanonicalMarketState): why / outlook / act carry no probability %", () => {
    const state = assembleCanonicalMarketState(sourceWith(STORED), { generatedAt: "2026-10-01T18:05:00.000Z", cacheStatus: "fresh-cache", cacheAgeMs: 0 } as never);
    const fields = [
      state.outlook.highestProbabilityPath, state.act.decisionSummary, state.act.whatWouldInvalidate,
      ...Object.values((state as any).why.narrative as Record<string, string>),
    ];
    for (const f of fields) {
      expect(f, f).not.toMatch(PERCENT_CLAIM);
      expect(f, f).not.toMatch(/\d+\s*%\s*probability/i);
    }
    expect(state.outlook.highestProbabilityPath).toContain("(frequency withheld: uncalibrated)");
    expect(state.act.decisionSummary).toMatch(/^Maintain a \w+ posture while The highest-probability outcome \(frequency withheld: uncalibrated\)/);
    expect(state.act.whatWouldInvalidate).toContain("A drawdown of 10% would invalidate it.");
    expect((state as any).why.narrative.whatHasChanged).toBe("VIX fell 5% this week.");
    expect((state as any).why.narrative.whyIsItHappening).toBe("Credit spreads are contained.");
    expect(JSON.stringify(state)).not.toContain("historical frequency)");
  });

  it("seismograph.getUnifiedIntelligence boundary (overlayUnifiedSeismographIntelligence) cleans marketNarrative", () => {
    const intel = { marketNarrative: { highestProbabilityPath: STORED, whatIsHappening: "There is a 70% chance of a crash.", n: 3 }, other: "kept 60% historical frequency" };
    const out = overlayUnifiedSeismographIntelligence(intel, null) as any;
    expect(out.marketNarrative.highestProbabilityPath).not.toMatch(/%/);
    expect(out.marketNarrative.highestProbabilityPath).toContain("(frequency withheld: uncalibrated)");
    expect(out.marketNarrative.whatIsHappening).toBe("");
    expect(out.marketNarrative.n).toBe(3);
    expect(out.probabilityContract).toBeNull();
  });

  it("both boundaries are wired in source (guard not bypassed)", () => {
    const svc = read("server/marketStateService.ts");
    expect(svc).toMatch(/const narrative = withoutNarrativeProbabilityClaims\(source\.marketNarrative\)/);
    expect(svc).not.toMatch(/source\.marketNarrative\./);
  });
});

describe("QA r12 #2: ticker-header CONFIDENCE is a formula, so it is 'Not established'", () => {
  it("the source value is |composite − 50| × 2 (documents why it is not calibrated)", () => {
    expect(read("server/signalOutlook.ts")).toMatch(/confidence: clamp\(Math\.abs\(scoreBreakdown\.composite - 50\) \* 2\)/);
  });

  it("outlook.getSecurityContext withholds confidence even when the quick outlook has one (10)", async () => {
    const caller = outlookRouter.createCaller({ req: {} as never, res: {} as never, user: null } as never);
    const ctx = await caller.getSecurityContext({ symbol: "nvda", assetType: "crypto" });
    expect(ctx.confidence).toBeNull();
    expect(ctx.opportunityScore).toBe(55);
    expect(ctx.price).toBe(100);
  });

  it("UniversalTickerHeader shows 'Not established' and no % even if a stale server sends 10", () => {
    fixtures.data["outlook.getSecurityContext"] = {
      symbol: "NVDA", assetType: "stock", price: 100, change: 1, changePercent: 1, volume: 10, marketState: "REGULAR",
      sector: null, industry: null, marketCap: null, opportunityScore: 55, direction: "Neutral", riskLevel: "Moderate", confidence: 10,
    };
    const html = renderToStaticMarkup(createElement(Router, null, createElement(UniversalTickerHeader, { symbol: "NVDA", assetType: "stock" })));
    const t = text(html);
    expect(html).toContain('data-confidence-status="not-established"');
    expect(t).toMatch(/CONFIDENCE\s+Not established/);
    expect(t).not.toMatch(/CONFIDENCE\s+\d/);
    expect(t).not.toContain("10%");
  });

  it("the Ask prompt no longer feeds the formula in as 'Confidence: N%'", () => {
    expect(read("server/routers/smartDiscovery.ts")).not.toMatch(/Confidence: \$\{outlookData\.confidence\}%/);
  });
});
