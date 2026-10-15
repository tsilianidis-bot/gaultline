/**
 * Macro Answer (/app/act/deep, /app/discover) credibility + hierarchy pass
 * (James, 2026-10-05). Presentation only — no engine, scoring, canonical-state
 * or probability-contract change. Fixtures: today's canonical state, early
 * warning and market-state captures (guest GETs) plus a synthetic served answer
 * that reproduces the values reported on the live page.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { customerIntegrityFromEngine } from "../shared/customerIntegrityLabels";
import { pressureBand } from "../shared/pressureBands";
import {
  engineCoverage, engineCoverageText, canonicalStateText, riskRegimeText, regimeDirectionText,
  materialEarlyWarningText, invalidationLines, biasStanceText, sanitizeMacroAnswerForDisplay,
  historicalPositionCopy, analogSimilarityLabel, hasUngovernedScenarioNumber, evidenceSignalCounts,
  NO_QUALIFYING_THESIS_INVALIDATION_TEXT, NO_GOVERNED_INVALIDATION_PLAN_TEXT, INVALIDATION_EVALUATION_UNAVAILABLE_TEXT,
  ANALOG_SIMILARITY_DESCRIPTOR, NO_HIGH_CONFIDENCE_ANALOG_TEXT, EVIDENCE_ENGINE_DESCRIPTOR,
} from "../client/src/lib/macroAnswerPresentation";

(globalThis as any).React = React;

const root = path.resolve(import.meta.dirname, "..");
const read = (rel: string) => readFileSync(path.join(root, rel), "utf8");
const fx = (name: string) => JSON.parse(read(`server/__fixtures__/macro-answer-2026-10-05/${name}`));
const text = (html: string) => html.replace(/<[^>]+>/g, " ").replace(/&amp;/g, "&").replace(/&#x27;/g, "'").replace(/&quot;/g, '"').replace(/\s+/g, " ");

const CANONICAL = fx("canonical-state.json");
const EARLY_WARNING = fx("early-warning.json");
const MARKET_STATE = fx("market-state.json");
const ANSWER = fx("served-answer.json");

const CONTRACT_OUTPUT = {
  probabilityDisplay: {
    bullProbability: { state: "UNCALIBRATED", text: "Uncalibrated", percent: null },
    crashProbability: { state: "NOT_OFFERED", text: "Not offered", percent: null },
  },
};

const ctx: { engine: any; earlyWarning: any } = { engine: {}, earlyWarning: null };
vi.mock("@/contexts/EngineContext", () => ({ useEngine: () => ctx.engine }));
vi.mock("@/lib/trpc", () => {
  const node = (): any => new Proxy(function () {}, {
    get: (_t, prop) => {
      if (prop === "useQuery") return () => ({ data: ctx.earlyWarning, isLoading: false });
      if (prop === "useMutation") return () => ({ mutate() {}, mutateAsync: async () => null, isPending: false });
      return node();
    },
    apply: () => node(),
  });
  return { trpc: node() };
});

function engineFor(overrides: { canonical?: any; topAnalog?: any } = {}) {
  const canonicalState = overrides.canonical ?? CANONICAL;
  const marketState = { ...MARKET_STATE, outlook: { topAnalog: overrides.topAnalog ?? null }, sourceHealth: [] };
  const integrityLabel = customerIntegrityFromEngine({ canonicalState, marketState, sourceHealth: [], marketMode: "live" });
  return { canonicalState, marketState, integrityLabel, output: CONTRACT_OUTPUT, marketMode: "live", isLoading: false, lastUpdated: null };
}

async function renderAnswer(answer = ANSWER, engineOverrides: { canonical?: any; topAnalog?: any } = {}, earlyWarning: any = EARLY_WARNING) {
  ctx.engine = engineFor(engineOverrides);
  ctx.earlyWarning = earlyWarning;
  const { InstitutionalAnswer } = await import("../client/src/pages/SmartDiscovery");
  return text(renderToStaticMarkup(React.createElement(InstitutionalAnswer, { answer, onDeepDive: () => {}, onAskFollowUp: () => {} })));
}

beforeEach(() => {
  ctx.engine = engineFor();
  ctx.earlyWarning = EARLY_WARNING;
});

const page = read("client/src/pages/SmartDiscovery.tsx");
const institutional = page.slice(page.indexOf("export function InstitutionalAnswer("), page.indexOf("// ── Opportunity Ranking Card"));

describe("fixture = today's canonical state (verified, not hard-coded)", () => {
  it("PI 33, MODERATE RISK band, direction Stable, 2 CURRENT / 4 DELAYED engines, no material warning, no canonical analog", () => {
    expect(CANONICAL.pressureIndex).toBe(33);
    expect(pressureBand(CANONICAL.pressureIndex).regime).toBe("MODERATE RISK");
    expect(CANONICAL.regime).toBe("MODERATE RISK");
    expect(CANONICAL.pressureDirection).toBe("Stable");
    expect(CANONICAL.engines.filter((e: any) => e.freshnessStatus === "CURRENT").map((e: any) => e.engineId)).toEqual(["liquidity-stress", "ai-bubble"]);
    expect(CANONICAL.engines.filter((e: any) => e.freshnessStatus === "DELAYED").map((e: any) => e.engineId)).toEqual(["credit-contagion", "volatility-regime", "macro-sensitivity", "market-breadth"]);
    expect(CANONICAL.staleInputs).toEqual([]);
    expect(EARLY_WARNING.kind).toBe("NO_MATERIAL_EARLY_WARNING");
    expect(MARKET_STATE.outlook.topAnalog).toBeNull();
    expect(MARKET_STATE.history.observationCount).toBe(6);
  });
});

describe("1 — regime: RISK REGIME (canonical band) + REGIME DIRECTION (canonical field); TRANSITIONING gone", () => {
  it("labels come from pressureBand() and pressureDirection", async () => {
    const html = await renderAnswer();
    expect(html).toContain("RISK REGIME MODERATE RISK");
    expect(html).toContain("REGIME DIRECTION STABLE");
    expect(html).not.toMatch(/TRANSITIONING|STRESSED/);
    expect(riskRegimeText(70)).toBe(pressureBand(70).regime);
    expect(riskRegimeText(null)).toBe("UNAVAILABLE");
    expect(regimeDirectionText("Deteriorating")).toBe("DETERIORATING");
    expect(regimeDirectionText("Unknown")).toBe("NOT ESTABLISHED");
  });
  it("source: the regimeColor bucket no longer drives a regime label", () => {
    expect(page).not.toContain('"TRANSITIONING"');
    expect(institutional).not.toContain("answer.regimeColor");
    expect(institutional).toContain("pressureDirection={canonicalState?.pressureDirection ?? null}");
  });
});

describe("2 — DATA LIVE replaced by CANONICAL STATE + ENGINE COVERAGE (derived)", () => {
  it("today: CANONICAL STATE · DELAYED (governed integrity label) and 2 CURRENT · 4 DELAYED", async () => {
    const html = await renderAnswer();
    expect(html).toContain("CANONICAL STATE · DELAYED");
    expect(html).toContain("ENGINE COVERAGE · 2 CURRENT · 4 DELAYED");
    expect(html).not.toMatch(/\bLIVE\b/);
    expect(html).not.toContain("Live — updated just now");
  });
  it("counts follow the engines' freshnessStatus, not constants", () => {
    const all = CANONICAL.engines.map((e: any) => ({ ...e, freshnessStatus: "CURRENT" }));
    expect(engineCoverageText(engineCoverage(all))).toBe("ENGINE COVERAGE · 6 CURRENT");
    const mixed = CANONICAL.engines.map((e: any, i: number) => ({ ...e, freshnessStatus: i === 0 ? "STALE" : i < 3 ? "DELAYED" : "CURRENT" }));
    expect(engineCoverageText(engineCoverage(mixed))).toBe("ENGINE COVERAGE · 3 CURRENT · 2 DELAYED · 1 STALE");
    expect(engineCoverageText(engineCoverage([]))).toBe("ENGINE COVERAGE · UNAVAILABLE");
    expect(canonicalStateText("LIVE")).toBe("CANONICAL STATE · LIVE");
  });
  it("source: no hard-coded LIVE value and no model dataFreshness string", () => {
    expect(institutional).not.toContain('value="LIVE"');
    expect(institutional).not.toContain("answer.dataFreshness");
  });
});

describe("3 — ungoverned scenario numbers suppressed (contract: Bull Uncalibrated / Crash Not offered)", () => {
  it("model prose loses every scenario component / score figure; the contract strip stays", async () => {
    const html = await renderAnswer();
    expect(html).not.toMatch(/scenario component|scenario score/i);
    expect(html).not.toMatch(/Bull scenario component 33|Neutral scenario score is 50/);
    expect(html).toContain("BULL SCENARIO Uncalibrated");
    expect(html).toContain("CRASH RISK Not offered");
    expect(html).toContain("Liquidity Stress at 22/100 and Credit Contagion at 22/100 are contained.");
    const why = sanitizeMacroAnswerForDisplay(ANSWER, { pressureIndex: 33, riskRegime: "MODERATE RISK", analogQualified: false }).whyThisVerdict;
    expect(why).toBe("Liquidity Stress at 22/100 remains contained."); // full-analysis field
  });
  it("detector covers the reported forms and leaves engine values alone", () => {
    for (const s of ["Bull scenario component is 33.", "Neutral scenario score is 50.", "Scenario weights: bull 43, neutral 43, bear 14.", "The bull scenario sits at 33.", "A 50% neutral scenario."]) {
      expect(hasUngovernedScenarioNumber(s), s).toBe(true);
    }
    for (const s of ["Liquidity Stress at 22/100 remains contained.", "Bull case: earnings hold up.", "Macro Sensitivity is 44."]) {
      expect(hasUngovernedScenarioNumber(s), s).toBe(false);
    }
  });
  it("Evidence Engine category scores (model-written 0–100, default 50) are not displayed", async () => {
    const { EvidenceEngineGrid } = await import("../client/src/pages/SmartDiscovery");
    const html = renderToStaticMarkup(React.createElement(EvidenceEngineGrid, { scores: ANSWER.evidenceScores }));
    expect(html).not.toMatch(/\(\d+\/100\)/);
    expect(html).not.toMatch(/>\s*(50|58|62|42|40)\s*</);
    expect(text(html)).toContain(EVIDENCE_ENGINE_DESCRIPTOR);
  });
});

describe("4 — historical position: percentile wording with its real denominator", () => {
  it("collapsed + expanded: HISTORICAL POSITION · 83rd percentile over 6 monthly readings; no severity words", async () => {
    const { HistoricalContextPanel } = await import("../client/src/components/HistoricalContextPanel");
    for (const defaultExpanded of [false, true]) {
      const html = text(renderToStaticMarkup(React.createElement(HistoricalContextPanel, { data: ANSWER.historicalIntelligence, defaultExpanded })));
      expect(html).toContain("HISTORICAL POSITION · 83rd percentile");
      expect(html).not.toMatch(/very elevated|extreme reading|Low Risk|— Critical|2000–present/);
      if (!defaultExpanded) expect(html).toContain("The current reading is higher than 83% of the 6 monthly readings on record (2026-04 to 2026-09).");
      if (defaultExpanded) {
        expect(html).toContain("Historical percentile measures relative rarity, not the 0–100 Pressure Index severity level.");
        expect(html).toContain("Computed from 6 monthly pressureHistory readings (2026-04 to 2026-09)");
      }
    }
  });
  it("no monthly record → not available (the engine's empty-history 50 is never shown)", async () => {
    expect(historicalPositionCopy({ percentile: 50, n: 0, dataRange: "N/A" })).toBeNull();
    const { HistoricalContextPanel } = await import("../client/src/components/HistoricalContextPanel");
    const html = text(renderToStaticMarkup(React.createElement(HistoricalContextPanel, { data: { ...ANSWER.historicalIntelligence, historicalN: 0, historicalPercentile: 50 }, defaultExpanded: true })));
    expect(html).toContain("HISTORICAL POSITION · Not available");
    expect(html).not.toMatch(/50th/);
  });
  it("server rarity copy: same numbers, no severity words; percentileRank unchanged", async () => {
    const engineSrc = read("server/historicalIntelligenceEngine.ts");
    expect(engineSrc).not.toMatch(/very elevated reading|extreme reading/);
    expect(engineSrc).toContain("Historical percentile measures relative rarity, not Pressure Index severity.");
    const { percentileRank } = await import("./historicalIntelligenceEngine");
    expect(percentileRank([20, 25, 28, 30, 31, 35], 33)).toBe(83); // 5 of 6 monthly readings strictly lower
  });
});

describe("5 — analogs: similarity label, gated by the same canonical analog rule as NOW", () => {
  it("no canonical analog (today): no 90/82/78% anywhere, NOW wording shown", async () => {
    const html = await renderAnswer();
    expect(html).not.toMatch(/\b(90|82|78)\s*%/);
    expect(html).toContain(NO_HIGH_CONFIDENCE_ANALOG_TEXT);
    expect(html).not.toContain("Closest analog: Fed Pivot Rally");
    expect(html.match(new RegExp(NO_HIGH_CONFIDENCE_ANALOG_TEXT, "g"))?.length).toBe(1);
    // without the Historical Intelligence panel, the analog block carries the NOW wording itself
    const bare = await renderAnswer({ ...ANSWER, historicalIntelligence: null });
    expect(bare.match(new RegExp(NO_HIGH_CONFIDENCE_ANALOG_TEXT, "g"))?.length).toBe(1);
  });
  it("qualified analog: NN% SIMILARITY + not-a-forecast descriptor", async () => {
    const { HistoricalContextPanel } = await import("../client/src/components/HistoricalContextPanel");
    const html = text(renderToStaticMarkup(React.createElement(HistoricalContextPanel, { data: ANSWER.historicalIntelligence, defaultExpanded: true, analogsQualified: true })));
    expect(html).toContain("90% SIMILARITY");
    expect(html).toContain(ANALOG_SIMILARITY_DESCRIPTOR);
    expect(html).not.toMatch(/Bullish Continuation|61%|24%|15%/); // outcome split stays withheld
    expect(analogSimilarityLabel(82)).toBe("82% SIMILARITY");
    const page = await renderAnswer(ANSWER, { topAnalog: { period: "2019", label: "Fed Pivot Rally", similarity: 90 } });
    expect(page).toContain("Closest analog: Fed Pivot Rally (90% similarity).");
  });
  it("panel fails closed when the gate prop is absent", async () => {
    const { HistoricalContextPanel } = await import("../client/src/components/HistoricalContextPanel");
    const html = text(renderToStaticMarkup(React.createElement(HistoricalContextPanel, { data: ANSWER.historicalIntelligence, defaultExpanded: true })));
    expect(html).not.toMatch(/\b(90|82|78)\s*%/);
  });
});

describe("6 — Opportunity (model-written, not governed) removed", () => {
  it("rendered page and source carry no Opportunity score", async () => {
    const html = await renderAnswer();
    expect(html).not.toMatch(/opportunity/i);
    expect(institutional).not.toContain("answer.opportunityScore");
    expect(read("server/routers/smartDiscovery.ts")).toContain('"opportunityScore": number (0-100)'); // origin: model schema
  });
});

describe("7 — invalidation: governed wording tied to the Early Warning presentation", () => {
  it("no material warning → no qualifying thesis", async () => {
    const html = await renderAnswer();
    expect(html).toContain(`INVALIDATION CONDITIONS ${NO_QUALIFYING_THESIS_INVALIDATION_TEXT}`);
    expect(html).not.toContain("No governed invalidation condition is currently defined.");
  });
  it("active warning → its governed conditions; evaluation unavailable → says so", () => {
    expect(invalidationLines({ kind: "ACTIVE_GOVERNED_WARNING", invalidationConditions: ["Credit Contagion falls below 30 for 3 sessions"] } as any)).toEqual(["Credit Contagion falls below 30 for 3 sessions"]);
    expect(invalidationLines({ kind: "ACTIVE_GOVERNED_WARNING", invalidationConditions: [] } as any)).toEqual([NO_GOVERNED_INVALIDATION_PLAN_TEXT]);
    expect(invalidationLines({ kind: "GOVERNED_EVALUATION_UNAVAILABLE" } as any)).toEqual([INVALIDATION_EVALUATION_UNAVAILABLE_TEXT]);
    expect(invalidationLines(null)).toEqual([INVALIDATION_EVALUATION_UNAVAILABLE_TEXT]);
    expect(materialEarlyWarningText(EARLY_WARNING)).toBe("NONE QUALIFIED");
    expect(materialEarlyWarningText({ kind: "GOVERNED_EVALUATION_UNAVAILABLE" } as any)).toBe("EVALUATION UNAVAILABLE");
  });
});

describe("8 — TOP ANSWER states the conclusion once", () => {
  it("one block: PI / regime / direction / early warning / confidence / bias", async () => {
    const html = await renderAnswer();
    expect(html).toContain("TOP ANSWER");
    expect(html).toContain("PRESSURE INDEX 33 / 100");
    expect(html).toContain("MATERIAL EARLY WARNING NONE QUALIFIED");
    expect(html).toContain("CONFIDENCE NOT ESTABLISHED");
    expect(html).toContain("BIAS NEUTRAL / WATCH");
    expect(biasStanceText("NEUTRAL / WATCH while the Pressure Index stays in band")).toBe("NEUTRAL / WATCH");
    expect(biasStanceText("", "WATCH")).toBe("WATCH");
  });
  it("no repeats of PI 33 / MODERATE RISK / insufficient evidence / no warning / confidence below it", async () => {
    const html = await renderAnswer();
    expect(html.match(/MODERATE RISK/g)?.length).toBe(1);
    expect(html.match(/not established/gi)?.length).toBe(1);
    expect(html).not.toMatch(/Pressure Index (is )?33\b|Pressure Index 33\b/);
    expect(html).not.toMatch(/insufficient cross-engine evidence|no qualified material warning/i);
    expect(html.match(/MACRO ANSWER/g)?.length).toBe(1);
    expect(html.match(/BULL SCENARIO/g)?.length).toBe(1);
    // substantive sentences survive the dedupe
    expect(html).toContain("Macro Sensitivity at 44/100 leads the engines while four engines remain delayed.");
    expect(html).toContain("Hold the current stance until delayed inputs refresh.");
  });
  it("the expanded Historical Intelligence panel does not restate PI / regime", async () => {
    const { HistoricalContextPanel } = await import("../client/src/components/HistoricalContextPanel");
    const html = text(renderToStaticMarkup(React.createElement(HistoricalContextPanel, { data: ANSWER.historicalIntelligence, defaultExpanded: true })));
    expect(html).not.toMatch(/33\/100|MODERATE RISK/);
  });
  it("sanitizer never mutates the served answer and never empties a field", () => {
    const before = JSON.stringify(ANSWER);
    const out = sanitizeMacroAnswerForDisplay({ ...ANSWER, primaryDriver: "Pressure Index 33 is MODERATE RISK." }, { pressureIndex: 33, riskRegime: "MODERATE RISK", analogQualified: false });
    expect(JSON.stringify(ANSWER)).toBe(before);
    expect(out.primaryDriver).toBe("Pressure Index 33 is MODERATE RISK.");
  });
});

describe("9 — preserved sections; counts are mutually consistent", () => {
  it("Evidence Engine 2↑/2↓/10—, 14 categories, Bull/Bear, What Changes Our View, Key Drivers, Risks, Historical Intelligence, Full Analysis", async () => {
    const html = await renderAnswer();
    for (const s of ["EVIDENCE ENGINE", "2↑", "2↓", "10—", "14 categories · 2 not applicable", "BULL CASE", "BEAR CASE", "WHAT CHANGES OUR VIEW", "KEY DRIVERS", "RISKS TO THE THESIS", "Historical Intelligence", "SHOW FULL ANALYSIS", "FINAL VERDICT", "PROBABILITY Not offered"]) {
      expect(html, s).toContain(s);
    }
  });
  it("14 = model-interpreted categories; 6 = canonical engines (different universes, both labelled)", () => {
    const counts = evidenceSignalCounts(ANSWER.evidenceScores);
    expect(counts).toEqual({ bullish: 2, bearish: 2, neutral: 10, notApplicable: 2, total: 14 });
    const coverage = engineCoverage(CANONICAL.engines);
    expect(coverage.total).toBe(6);
    expect(coverage.current + coverage.notCurrent).toBe(CANONICAL.engines.length);
  });
});

describe("10 — self-audit of the rendered page", () => {
  it("no contradictory regime label, no LIVE on delayed data, no unlabelled percentages, no default 50", async () => {
    const html = await renderAnswer();
    expect(html).not.toMatch(/TRANSITIONING|\bLIVE\b|opportunity/i);
    const percents = html.match(/\d+(?:\.\d+)?\s*%/g) ?? [];
    expect(percents).toEqual(["83%"]); // only the historical-position sentence
    expect(html).toContain("higher than 83% of the 6 monthly readings");
    expect(html).not.toMatch(/\b50\b/);
  });
});

describe("NOW residuals from #72 post-deploy QA (presentation only)", () => {
  it("threat card does not repeat 'No single threat currently dominates' in headline and detail", async () => {
    const copy = await import("../shared/nowInterpretationCopy");
    const headline = copy.topThreatHeadline(undefined);
    const detail = copy.topThreatEvidenceCopy(false);
    expect(headline).toBe(copy.NO_DOMINANT_THREAT_TEXT);
    expect(detail).not.toContain(copy.NO_DOMINANT_THREAT_TEXT);
    expect(detail).toBe(copy.NO_THREAT_EVIDENCE_DETAIL_TEXT);
  });
  it("analysisFailed is a real signal for threats (no served evidence), not a dead literal", async () => {
    const copy = await import("../shared/nowInterpretationCopy");
    expect(copy.threatAnalysisUnavailable([])).toBe(true);
    expect(copy.threatAnalysisUnavailable(undefined)).toBe(true);
    expect(copy.threatAnalysisUnavailable([{ name: "Credit" }])).toBe(false);
    const now = readFileSync(path.resolve(process.cwd(), "client/src/pages/Now.tsx"), "utf8");
    expect(now).not.toMatch(/topThreat\w+\([^)]*,\s*false\)/);
    expect(now).not.toMatch(/topAnalog\w+\([^)]*,\s*false[,)]/);
  });
  it("NOW closest-analog tile labels the percentage as similarity", () => {
    const now = readFileSync(path.resolve(process.cwd(), "client/src/pages/Now.tsx"), "utf8");
    expect(now).toContain("${formatCanonicalPercent(topAnalog.similarity)} similarity`");
  });
  it("incomplete Top 5 label has no trailing period", () => {
    const m = readFileSync(path.resolve(process.cwd(), "client/src/components/sectorRotation/SectorRotationModule.tsx"), "utf8");
    expect(m).toContain("not a complete Top 5</p>");
    expect(m).not.toContain("not a complete Top 5.");
  });
});
