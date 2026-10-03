import { readFileSync } from "node:fs";
import path from "node:path";
import React, { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { Router } from "wouter";
import { describe, expect, it, vi } from "vitest";
import { DEFAULT_INDICATORS } from "../client/src/lib/engine";
import { engineProbabilityText, selectBrowserMarketOutput } from "../client/src/lib/marketStateProjection";
import { CRASH_RISK_DISPLAY_TEXT, contractScenarioText } from "../client/src/lib/contractProbabilityText";
import { isProbabilityPercentClaim, stripProbabilityPercentClaims } from "./stripProbabilityClaims";
import { buildCanonicalIntelligenceState, toClientCanonicalIntelligenceState, toPublicCanonicalIntelligenceState, withholdUndisplayedClaimValues } from "./canonicalIntelligenceState";
import { mapRawCoin } from "./coingeckoProxy";
import { change24hColor, change24hText, displayChange24h, CHANGE_24H_UNAVAILABLE_COLOR } from "../client/src/lib/change24h";

// QA r9 (#60 at a266283): no routed screen shows a crash / recession % or a
// probability % that is not the canonical contract's display text. Display only.
(globalThis as any).React = React;

const root = path.resolve(import.meta.dirname, "..");
const read = (rel: string) => readFileSync(path.join(root, rel), "utf8");
const canonicalOct1 = JSON.parse(read("server/__fixtures__/prod-2026-10-01/canonical-current.json"));
const marketState = JSON.parse(read("server/__fixtures__/prod-2026-10-01/market-state-current.json"));
const uncalibrated = { state: "UNCALIBRATED", text: "Uncalibrated", percent: null };
const withContract = {
  ...canonicalOct1,
  probabilityContract: {
    scenarioSet: { display: uncalibrated, scenarios: ["bull", "neutral", "bear"].map(id => ({ scenario: { scenarioId: id }, display: uncalibrated })) },
    transitions: [{ scenario: { scenarioId: "remainInRegime" }, display: uncalibrated }],
  },
};

const q: { data: unknown } = { data: null };
vi.mock("@/lib/trpc", () => {
  const query = () => ({ data: q.data, isLoading: false, isFetching: false, fetchStatus: "idle", refetch: () => undefined });
  return { trpc: { marketState: { canonicalCurrent: { useQuery: query } }, altRotation: { getData: { useQuery: () => ({ data: undefined }) } } } };
});
const MobilePulse = (await import("../client/src/pages/mobile/MobilePulse")).default;
const MobileBrief = (await import("../client/src/pages/mobile/MobileBrief")).default;

const text = (html: string) => html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
function render(Comp: React.ComponentType, data: unknown): string {
  q.data = data;
  return text(renderToStaticMarkup(createElement(Router, { ssrPath: "/mobile/pulse" }, createElement(Comp))));
}
const crashCell = (html: string) => /CRASH RISK\s+(\S+(?: \S+)?)/.exec(html)?.[1];

describe("Mobile Pulse / Brief: CRASH RISK is Not offered, never the bear weight (Oct 1 prod: bear 14)", () => {
  expect(canonicalOct1.scenarioOutputs.bear).toBe(14);
  for (const [name, Comp] of [["MobilePulse", MobilePulse], ["MobileBrief", MobileBrief]] as const) {
    it(`${name}: Oct 1 fixture (no contract) → Not offered, no 14% / 43%`, () => {
      const html = render(Comp, canonicalOct1);
      expect(crashCell(html)).toBe("Not offered");
      expect(html).not.toMatch(/\b14%|\b43%|NaN/);
    });
    it(`${name}: with the contract → bull is the contract text (Uncalibrated)`, () => {
      const html = render(Comp, withContract);
      expect(crashCell(html)).toBe("Not offered");
      expect(html).toContain("Uncalibrated");
      expect(html).not.toMatch(/\d+%|NaN/);
    });
  }
  it("source: no scenarioOutputs / bear fallback left", () => {
    for (const f of ["client/src/pages/mobile/MobilePulse.tsx", "client/src/pages/mobile/MobileBrief.tsx"]) {
      const s = read(f);
      expect(s).not.toContain("scenarioOutputs");
      expect(s).not.toMatch(/\.bear\b/);
      expect(s).toContain("const crashText = CRASH_RISK_DISPLAY_TEXT;");
    }
  });
});

describe("OnboardingFlow (/app/discover): no pressure × 0.85 crash derivation", () => {
  const s = read("client/src/components/OnboardingFlow.tsx");
  it("derivations deleted; contract text / Not offered rendered", () => {
    expect(s).not.toMatch(/\* ?0\.85|\* ?1\.1\b/);
    expect(s).not.toMatch(/crashProb|bullProb/);
    expect(s).toContain("const crashText = CRASH_RISK_DISPLAY_TEXT;");
    expect(s).toContain('const bullText = contractScenarioText(pd?.probabilityContract, "bull");');
    expect(s).toContain("{crashText}");
    expect(s).toContain("{bullText}");
  });
  it("explainer and example show no crash / bull percentage", () => {
    expect(s).not.toMatch(/value: "\d+%"/);
    expect(s).not.toContain('range: "0 – 100%"');
    expect(s).toContain('range: "Not offered"');
  });
  it("helper: Not offered for crash; contract text (or Unavailable) for bull", () => {
    expect(CRASH_RISK_DISPLAY_TEXT).toBe("Not offered");
    expect(contractScenarioText(withContract.probabilityContract as any, "bull")).toBe("Uncalibrated");
    expect(contractScenarioText(undefined, "bull")).toBe("Unavailable");
    const available = { scenarioSet: { scenarios: [{ scenario: { scenarioId: "bull" }, display: { state: "AVAILABLE", text: "61%", percent: 61 } }] }, transitions: [] };
    expect(contractScenarioText(available as any, "bull")).toBe("61%");
  });
});

describe("/app/decision-engine (TradePreflight + SituationRoom): withheld text, never NaN%", () => {
  it("engineProbabilityText gives the contract text for the withheld fields", () => {
    const canonical = selectBrowserMarketOutput({ marketState, baselineIndicators: DEFAULT_INDICATORS, simulationOverrides: {} }).output;
    expect(Number.isNaN(canonical.probability.crashProbability)).toBe(true);
    expect(engineProbabilityText(canonical, "crashProbability")).toBe("Not offered");
    expect(engineProbabilityText(canonical, "bullProbability")).not.toMatch(/NaN/);
  });
  it("source: both tabs render engineProbabilityText", () => {
    const t = read("client/src/pages/TradePreflight.tsx");
    expect(t).not.toMatch(/\{output\.probability\.(bull|crash)Probability\}%/);
    expect(t).toContain('{engineProbabilityText(output, "crashProbability")}');
    expect(t).toContain('{engineProbabilityText(output, "bullProbability")}');
    const r = read("client/src/pages/SituationRoom.tsx");
    expect(r).not.toMatch(/regimeProbabilities\.(bull|crash)/);
    expect(r).not.toMatch(/`\$\{(bull|crash)Probability\}%`/);
    expect(r).toContain('engineProbabilityText(output, "crashProbability")');
    expect(r).not.toContain('scoreKey="crashRisk"');
  });
});

describe("Sweep: other routed screens", () => {
  it("SeismographIntelligence: no crash / recession % in cautions or trade-type evidence", () => {
    const s = read("client/src/pages/SeismographIntelligence.tsx");
    expect(s).not.toContain("crash probability at ${crash}%");
    expect(s).toContain("deriveTradeTypes(currentScore, currentDirection, currentRegime, regimeProbs.bull, null, null)");
    expect(s).toContain('return value == null || !Number.isFinite(value) ? "not offered" : `${value}%`;');
  });
  it("SeismographNarrativeBanner: crisis transition only from an AVAILABLE contract claim", () => {
    const s = read("client/src/components/SeismographNarrativeBanner.tsx");
    expect(s).not.toContain("{output.transitionProbabilities.transitionToCrisis}%");
    expect(s).toContain("probabilityPercent(crisisClaim)");
  });
  it("DayTradeIntelligence: no `?? 50` bull default / `${bullProb}%`", () => {
    const s = read("client/src/pages/DayTradeIntelligence.tsx");
    expect(s).not.toMatch(/bullProbability \?\? 50|\$\{bullProb\}%/);
    expect(s).toContain('engineProbabilityText(output, "bullProbability")');
  });
  it("internal canonical state unchanged: scenarioOutputs still built from the manifest", () => {
    expect(read("server/canonicalIntelligenceState.ts")).toContain("scenarioOutputs: manifest.scenarioOutputs ?? {}");
  });
});

// #56 r16 (72e7a55) detector, verbatim: the only allowed "<event> probability"
// forms are "does not offer/publish a … probability" and "not a … probability".
const EVENT = String.raw`(?:market[- ])?(?:crash|recession|default|bear[- ]market|bull[- ]market|bull\/bear|correction|crisis|alt[- ]season)`;
const OFFER = new RegExp(String.raw`\b${EVENT}[- ]probabilit|\bprobabilit(?:y|ies) of (?:an? )?(?:market )?(?:recession|crash|default|bear market|correction|crisis|alt season|significant market)`, "i");
const ADJ = String.raw`(?:(?:calibrated|validated|published|fitted)\s+)*`;
const DISCLAIMER = new RegExp(String.raw`\b(?:does not (?:offer|publish)|not) an? ${ADJ}(?:${EVENT}[- ])?probabilit(?:y|ies)\b`, "gi");
const offersProbability = (line: string) =>
  line.replace(/\/[a-z0-9/-]*probability[a-z0-9-]*/gi, "").split(/(?<=[.!?:;])\s+/).some(sentence => OFFER.test(sentence.replace(DISCLAIMER, " ")));

describe("QA r9 — #56 r16 disclaimer rule, auto-published link text, LLM prompts", () => {
  const r16Files = [
    "client/src/pages/PublicSituationRoom.tsx",
    "client/src/pages/seo/MarketCrashProbability2026.tsx",
    "server/autonomousPublishing.ts",
    "server/organicContentEngine.ts",
  ];
  it.each(r16Files)("%s passes the r16 detector on every line", rel => {
    const hits = read(rel).split("\n").map((l, i) => [i + 1, l] as const).filter(([, l]) => offersProbability(l));
    expect(hits).toEqual([]);
  });
  it("detector self-check: flags an offer, allows the two disclaimer forms", () => {
    expect(offersProbability("Recession Probability Tracker")).toBe(true);
    expect(offersProbability("not an analyst forecast or a crash-probability model")).toBe(true);
    expect(offersProbability("It is not a crash probability.")).toBe(false);
    expect(offersProbability("FAULTLINE does not offer a recession probability.")).toBe(false);
  });
  it.each(["server/autonomousPublishing.ts", "server/organicContentEngine.ts"])("%s: auto-published link text renamed, URLs unchanged", rel => {
    const s = read(rel);
    expect(s).toContain('{ text: "Market Crash Risk 2026", href: "/market-crash-probability-2026" },');
    expect(s).toContain('{ text: "Recession Risk Context", href: "/recession-probability" },');
    expect(s).not.toMatch(/Market Crash Probability|Recession Probability Tracker/);
  });
  it("organicContentEngine prompt no longer injects a crash / bull percentage", () => {
    const s = read("server/organicContentEngine.ts");
    expect(s).not.toMatch(/Crash Probability: \$\{|Bull Probability: \$\{/);
    expect(s).toContain("FAULTLINE does not offer a crash probability, does not offer a recession probability, and its scenario weights are uncalibrated, so state no probability percentage");
  });
  it("autonomousPublishing prompt uses allowed disclaimer forms", () => {
    const s = read("server/autonomousPublishing.ts");
    expect(s).not.toContain("Scenario, crash, and recession probabilities: not offered");
    expect(s).toContain("FAULTLINE does not offer a crash probability, does not offer a recession probability, and its scenario weights are uncalibrated (probability contract); do not state any probability percentage");
  });
  it("tradePreflight / chatbot LLM prompts no longer hand the model crash / bull percentages", () => {
    expect(read("server/tradePreflight.ts")).not.toMatch(/Crash Probability: \$\{output|Bull Probability: \$\{output/);
    const chat = read("server/chatbotEngine.ts");
    expect(chat).not.toMatch(/Crash Probability: \$\{|Bull Continuation Probability: \$\{/);
    expect(chat).toContain("Probabilities: FAULTLINE does not offer a crash probability, and its scenario weights are uncalibrated; state no probability percentage");
  });
  it("smartDiscovery opportunity prompt: qualitative bull/bear balance, no FMOS percentages", () => {
    const full = read("server/routers/smartDiscovery.ts");
    const start = full.indexOf("async function orchestrateOpportunityRanking(");
    const end = full.indexOf("// ── Route opportunity queries");
    expect(start).toBeGreaterThan(0);
    expect(end).toBeGreaterThan(start);
    const s = full.slice(start, end); // opportunity-ranking pipeline only
    expect(full).toContain('import { stripProbabilityPercentClaims } from "../stripProbabilityClaims";');
    expect(s).not.toContain("Bull/Bear Probability");
    expect(s).not.toMatch(/fmos\.probability\.bull\}%|fmos\.probability\.bear\}%/);
    expect(s).toContain("a qualitative bull/bear balance (words only, no percentages or probabilities)");
    expect(s).toContain("macroContext: stripProbabilityPercentClaims(raw.macroContext)");
    expect(s).toContain("whyTheseRankHighest: stripProbabilityPercentClaims(raw.whyTheseRankHighest)");
    expect(s).toContain("thesisSummary: stripProbabilityPercentClaims(o.thesisSummary)");
  });
  it("stripProbabilityPercentClaims drops probability-% sentences and keeps the rest", () => {
    const text = "Risk-on regime with broad participation. Bull probability sits at 62% versus 38% bear. Credit spreads remain tight! There is a 15% chance of a crash. Breadth improved 12% week over week.";
    expect(stripProbabilityPercentClaims(text)).toBe("Risk-on regime with broad participation. Credit spreads remain tight! Breadth improved 12% week over week.");
    expect(stripProbabilityPercentClaims("Bullish odds 70 percent.")).toBe("");
    expect(stripProbabilityPercentClaims("Recession risk near 30%.")).toBe("");
    expect(stripProbabilityPercentClaims(undefined)).toBeUndefined();
    expect(isProbabilityPercentClaim("Breadth improved 12% week over week.")).toBe(false);
    expect(isProbabilityPercentClaim("The bull case is likely, about 55%.")).toBe(true);
  });
});

describe("QA r9 stack gate — public API payload carries no withheld scenario numbers", () => {
  const state = buildCanonicalIntelligenceState(canonicalOct1);
  const client = toClientCanonicalIntelligenceState(state);
  const claimValues = (node: unknown): unknown[] => JSON.stringify(node).match(/"value":[^,}\]]+/g) ?? [];
  it("client projection: scenarioOutputs {} and every non-AVAILABLE claim value null (Oct 1: 43/43/14 withheld)", () => {
    expect(state.scenarioOutputs).toEqual({ bull: 43, neutral: 43, bear: 14 });
    expect(client.scenarioOutputs).toEqual({});
    expect(claimValues(client.probabilityContract).filter(v => v !== '"value":null')).toEqual([]);
    expect(JSON.stringify(client)).not.toMatch(/"value":(43|14)\b/);
  });
  it("internal consumers unchanged: server-side public state still carries scenarioOutputs and claim values", () => {
    const pub = toPublicCanonicalIntelligenceState(state);
    expect(pub.scenarioOutputs).toEqual({ bull: 43, neutral: 43, bear: 14 });
    expect(claimValues(pub.probabilityContract)).toContain('"value":43');
    const strip = ({ scenarioOutputs: _s, probabilityContract: _p, ...rest }: Record<string, unknown>) => rest;
    expect(strip(client as never)).toEqual(strip(pub as never));
  });
  it("AVAILABLE claims keep their value", () => {
    const tree = { a: { claimId: "x", value: 61, display: { state: "AVAILABLE", text: "61%", percent: 61 } }, b: { claimId: "y", value: 14, display: { state: "UNCALIBRATED" } } };
    expect(withholdUndisplayedClaimValues(tree)).toEqual({ a: tree.a, b: { ...tree.b, value: null } });
  });
  it("browser-facing routes use the client projection", () => {
    expect(read("server/routers/marketState.ts")).toContain("return state ? toClientCanonicalIntelligenceState(state) : null;");
    const outlook = read("server/routers/outlook.ts");
    expect(outlook.match(/canonicalState: canonicalState \? toClientCanonicalIntelligenceState\(canonicalState\) : null,/g)).toHaveLength(2);
    expect(outlook).not.toContain("toPublicCanonicalIntelligenceState(");
  });
  for (const [name, Comp] of [["MobilePulse", MobilePulse], ["MobileBrief", MobileBrief]] as const) {
    it(`${name} on the real client payload: no %, no NaN, crash Not offered`, () => {
      const html = render(Comp, client);
      expect(crashCell(html)).toBe("Not offered");
      expect(html).not.toMatch(/\d+(?:\.\d+)?%|NaN/);
    });
  }
  it("SituationRoom: bull explainer only for a finite percent", () => {
    expect(read("client/src/pages/SituationRoom.tsx")).toContain('{bullProbability != null && Number.isFinite(bullProbability) ? <ScoreExplainer scoreKey="bullProbability"');
    expect(read("client/src/pages/SituationRoom.tsx")).not.toContain('scoreKey="crashRisk"');
  });
});

describe("QA r9 — crypto 24h change: missing shows '—', engine input unchanged", () => {
  const raw = { id: "x", symbol: "x", name: "X", current_price: 1, high_24h: 1, low_24h: 1 };
  it("mapRawCoin: engine value stays 0 (as before); display value is null", () => {
    const missing = mapRawCoin(raw);
    expect(missing.priceChangePercent24h).toBe(0);
    expect(missing.priceChangePercent24hDisplay).toBeNull();
    const present = mapRawCoin({ ...raw, price_change_percentage_24h: -2.5 });
    expect(present.priceChangePercent24h).toBe(-2.5);
    expect(present.priceChangePercent24hDisplay).toBe(-2.5);
  });
  it("helpers: '—' with neutral color for missing; signed % otherwise; legacy objects fall back", () => {
    expect(change24hText(displayChange24h({ priceChangePercent24h: 0, priceChangePercent24hDisplay: null }))).toBe("—");
    expect(change24hColor(null)).toBe(CHANGE_24H_UNAVAILABLE_COLOR);
    expect(change24hText(displayChange24h({ priceChangePercent24h: 1.234 }))).toBe("+1.23%");
    expect(change24hText(-0.5, 1)).toBe("-0.5%");
    expect(change24hText(displayChange24h({ priceChangePercent24h: Number.NaN }))).toBe("—");
  });
  it("cryptoEngine scoring lines unchanged; only the display field and vector text added", () => {
    const e = read("server/cryptoEngine.ts");
    expect(e).toContain("const momScore24h = clamp(50 + c.priceChangePercent24h * 5, 0, 100);");
    expect(e).toContain('direction: c.priceChangePercent24h > 1 ? "positive" : c.priceChangePercent24h < -1 ? "negative" : "neutral",');
    expect(e).toContain("    priceChangePercent24h: c.priceChangePercent24h,\n");
    expect(read("server/coingeckoProxy.ts")).toContain("priceChangePercent24h:    (c.price_change_percentage_24h as number) ?? 0,");
    expect(e).toContain("priceChangePercent24hDisplay: c.priceChangePercent24hDisplay === undefined ? c.priceChangePercent24h : c.priceChangePercent24hDisplay,");
    expect(e).toContain('description: c.priceChangePercent24hDisplay === null ? "24h change unavailable"');
  });
  it.each([
    "client/src/pages/CryptoWatchlist.tsx", "client/src/components/dashboard/PulseMode.tsx", "client/src/components/dashboard/SignalsMode.tsx",
    "client/src/components/HomeCryptoSection.tsx", "client/src/components/MarketOverview.tsx", "client/src/pages/CryptoSearch.tsx",
  ])("%s renders the 24h change through displayChange24h", rel => {
    const s = read(rel);
    expect(s).toContain("displayChange24h(");
    expect(s).not.toMatch(/priceChangePercent24h \?\? 0|priceChangePercent24h\.toFixed|changePct24h=\{c\.priceChangePercent24h\}|change=\{coin\.priceChangePercent24h\}/);
  });
});

describe("QA r9 — public copy nits", () => {
  it("PublicSituationRoom: no probability-weighted / Know the odds", () => {
    const s = read("client/src/pages/PublicSituationRoom.tsx");
    expect(s).not.toMatch(/probability-weighted|Know the odds/i);
  });
  it("TradePreflight footer and LLM prompt: no probability-weighted framing", () => {
    expect(read("client/src/pages/TradePreflight.tsx")).not.toContain("probability-weighted estimates");
    expect(read("server/tradePreflight.ts")).not.toMatch(/probability-weighted (recommendation|setup reading)/);
  });
  it("failClosedQaR8 no longer forbids #59's deltaAvailability.ts", () => {
    expect(read("server/failClosedQaR8.test.ts")).not.toContain('read("client/src/lib/deltaAvailability.ts")');
  });
});
