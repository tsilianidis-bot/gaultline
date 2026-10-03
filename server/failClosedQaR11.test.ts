import { readFileSync } from "node:fs";
import path from "node:path";
import React, { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi, beforeEach } from "vitest";

// QA r11 (gate r10 on 144b5da, blockers B7 + B9):
// B7 — Situation Room / trade.simulate never ships or renders a scenario
//      probability, a probability-weighted outcome, a bull/crash probability,
//      a probability range, a hard-coded freshness, a fabricated historical
//      similarity, or an "institutional agreement" figure. Case returns stay
//      (formulas unchanged) and are labelled uncalibrated.
// B9 — SmartDiscovery shows "Not established" for a withheld (null)
//      confidence, never "0%" or "null%".
(globalThis as any).React = React;

const llm = vi.hoisted(() => ({ calls: [] as any[] }));
vi.mock("./_core/llm", () => ({
  invokeLLM: vi.fn(async (req: any) => {
    llm.calls.push(req);
    return { choices: [{ message: { content: "Deterministic explanation." } }] };
  }),
}));
vi.mock("./ownerSimulation", () => ({ scanOpportunities: vi.fn().mockResolvedValue([]) }));

import { runTradePreflightSimulation } from "./tradePreflight";
import { createInterpretationTransaction, validateInterpretationOutput } from "../shared/interpretationIntegrity";
import DecisionConfidencePanel, { type ConfidenceData } from "../client/src/components/DecisionConfidencePanel";
import { CONFIDENCE_NOT_ESTABLISHED, confidenceDisplayText } from "../client/src/lib/confidenceDisplay";

const root = path.resolve(import.meta.dirname, "..");
const read = (rel: string) => readFileSync(path.join(root, rel), "utf8");
const text = (html: string) => html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");

const vectors = (score: number) => ["liquidity-stress", "credit-contagion", "volatility-regime", "macro-sensitivity", "market-breadth", "ai-bubble"]
  .map(id => ({ id, score, label: id, riskLevel: score >= 60 ? "critical" : "low" }));
const PRESSURES = {
  low: { overallPressure: 22, dataSource: "live" as const, vectors: vectors(20), regime: "Expansion", level: "Low" },
  high: { overallPressure: 75, dataSource: "live" as const, vectors: vectors(70), regime: "Late-Cycle Stress", level: "High" },
  fallback: { overallPressure: 50, dataSource: "fallback" as const, vectors: vectors(45), regime: "Transition", level: "Elevated" },
};
const MOVES = ["add_risk", "reduce_risk", "hedge", "rotate", "raise_cash", "deploy_cash", "buy_specific_asset", "sell_specific_asset", "hold"] as const;
const TIMEFRAMES = ["today", "this_week", "one_three_months", "six_twelve_months"] as const;
// favorableSetupProbability / adversePressureProbability are heuristic 0–100
// scores (rendered as "score", QA r10); every other *probability key must be null.
const PROB_KEY_WITH_NUMBER = /"(?!favorableSetupProbability"|adversePressureProbability")[A-Za-z]*[Pp]robability(?:Range)?"\s*:\s*-?\d/;

describe("B7 trade.simulate response: no scenario / bull / crash probability leaves the server", () => {
  beforeEach(() => { llm.calls.length = 0; });
  for (const [name, pressure] of Object.entries(PRESSURES)) {
    for (const moveType of MOVES) {
      it(`${name} · ${moveType}: probabilities are null, returns remain`, async () => {
        for (const timeframe of TIMEFRAMES) {
          const r: any = await runTradePreflightSimulation({ moveType, timeframe, ticker: "SPY" } as any, pressure as any, null);
          expect(r.outcomeSimulator.scenarios.map((s: any) => s.label)).toEqual(["Bull Case", "Base Case", "Bear Case"]);
          for (const s of r.outcomeSimulator.scenarios) {
            expect(s.probability, `${timeframe} ${s.label}`).toBeNull();
            expect(Number.isFinite(s.expectedReturn)).toBe(true);
          }
          expect(r.outcomeSimulator.weightedOutcome).toBeNull();
          expect(r.marketCondition.bullProbability).toBeNull();
          expect(r.marketCondition.crashProbability).toBeNull();
          expect(r.decisionLight.bullContinuationProbability).toBeNull();
          expect(r.decisionLight.crashDrawdownProbability).toBeNull();
          const evidence = [...(r.decisionLight.supportingEvidence ?? []), ...(r.decisionLight.conflictingEvidence ?? [])].join(" | ");
          expect(evidence).not.toMatch(/Bull-continuation probability|Crash\/drawdown probability/);
          expect(JSON.stringify(r)).not.toMatch(PROB_KEY_WITH_NUMBER);
        }
      });
    }
  }

  it("scenario return formulas and the decision light are unchanged (all 108 cases pinned to 144b5da)", async () => {
    for (const [name, pressure] of Object.entries(PRESSURES)) for (const moveType of MOVES) for (const timeframe of TIMEFRAMES) {
      const key = `${name}|${moveType}|${timeframe}`;
      const r: any = await runTradePreflightSimulation({ moveType, timeframe, ticker: "SPY" } as any, pressure as any, null);
      expect([r.outcomeSimulator.scenarios.map((s: any) => s.expectedReturn), r.decisionLight.decisionLight, r.verdict.confidence], key).toEqual(PINNED_144B5DA[key]);
    }
  });

  it("the explanation prompt has no Expected Weighted Outcome and no probability %", async () => {
    await runTradePreflightSimulation({ moveType: "add_risk", timeframe: "this_week", ticker: "NVDA" } as any, PRESSURES.low as any, null);
    const prompt = JSON.stringify(llm.calls.map(c => c.messages));
    expect(prompt.length).toBeGreaterThan(200);
    expect(prompt).not.toMatch(/Weighted Outcome/i);
    expect(prompt).not.toMatch(/probabilit[a-z]*[^.\\]{0,24}\d+(?:\.\d+)?%/i);
  });
});

const SITUATION_ROOM_CONF: ConfidenceData = {
  confidenceScore: 62,
  supportingSignals: [],
  conflictingSignals: [],
  dataFreshnessMinutes: null,
  historicalWinRate: undefined,
  expectedVolatility: "MODERATE",
  rewardRisk: 2.1,
  verdict: "HOLD",
};
const renderPanel = (data: ConfidenceData, defaultExpanded: boolean) =>
  text(renderToStaticMarkup(createElement(DecisionConfidencePanel, { data, defaultExpanded })));

describe("B7 DecisionConfidencePanel: no probability range, no fabricated freshness / similarity / agreement", () => {
  for (const expanded of [false, true]) {
    it(`Situation Room data (${expanded ? "expanded" : "collapsed"}) renders none of them`, () => {
      const html = renderPanel(SITUATION_ROOM_CONF, expanded);
      expect(html).toContain("DECISION CONFIDENCE");
      expect(html).not.toMatch(/PROB RANGE|\d+–\d+%/);
      expect(html).not.toMatch(/\d+m ago|\d+h ago|\bLIVE\b|DATA FRESHNESS/);
      expect(html).not.toMatch(/HISTORICAL SIMILARITY\s+\d|INSTITUTIONAL AGREE|AGREEMENT/);
      expect(html).not.toMatch(/\b72\b/);
    });
  }
  it("a real freshness / heuristic score is shown only when supplied, labelled as a heuristic", () => {
    const html = renderPanel({ ...SITUATION_ROOM_CONF, dataFreshnessMinutes: 12, institutionalAgreement: 55 }, true);
    expect(html).toContain("DATA FRESHNESS: 12m ago");
    expect(html).toContain("AGREEMENT (HEURISTIC /100)");
    expect(html).not.toContain("INSTITUTIONAL AGREE");
  });
  it("the panel source has no probabilityRange and no default freshness / similarity", () => {
    const src = read("client/src/components/DecisionConfidencePanel.tsx");
    expect(src).not.toMatch(/probabilityRange|PROB RANGE/);
    expect(src).not.toContain('label="INSTITUTIONAL AGREE"');
    expect(src).toContain("{hasFreshness && (");
    expect(src).toContain("{hasSimilarity && (");
    expect(src).toContain("{hasAgreement && (");
  });
});

describe("B7 SituationRoom source: case returns only, labelled uncalibrated", () => {
  const src = read("client/src/pages/SituationRoom.tsx");
  it("no scenario probability text or bars", () => {
    expect(src).not.toMatch(/\{(bull|base|bear)\.probability\}/);
    expect(src).not.toMatch(/Probability:\s*\{/);
    // no read of a scenario probability at all (text, bar width, or cast)
    expect(src).not.toMatch(/\b(bull|base|bear)(?:\s+as\s+any\))?\??\.probability\b/);
    expect(src.match(/Scenario return · uncalibrated · no probability assigned/g)?.length).toBe(2);
    expect(src).toContain("{returnSign(base.expectedReturn)}</span>");
    expect(src).toContain("· uncalibrated</span>");
  });
  it("no probabilityRange, hard-coded freshness, similarity 72 or institutional-agree figure", () => {
    expect(src).not.toMatch(/probabilityRange/);
    expect(src).not.toMatch(/dataFreshnessMinutes:\s*\d/);
    expect(src).toContain("dataFreshnessMinutes: null,");
    expect(src).not.toMatch(/historicalSimilarity\s*:/);
    expect(src).not.toMatch(/institutionalAgreement\s*:/);
  });
  it("footer no longer calls readings probability-weighted estimates", () => {
    expect(src).not.toContain("probability-weighted estimates");
    expect(src).toContain("Scenario returns are uncalibrated illustrations");
  });
});

describe("B7 tradePreflight source: no probability formulas feed the response or prompt", () => {
  const src = read("server/tradePreflight.ts");
  it("scenario, weighted-outcome and market-condition probabilities are null; prompt line dropped", () => {
    expect(src).not.toMatch(/const (bullProb|bearProb|baseProb) = clamp\(Math\.round\(favorability/);
    expect(src).not.toMatch(/const weightedOutcome = /);
    expect(src).not.toMatch(/const (bullProbability|crashProbability)\s*=/);
    expect(src).not.toContain("Expected Weighted Outcome");
    expect(src).toContain("bullContinuationProbability: null,");
    expect(src).toContain("crashDrawdownProbability: null,");
    for (const label of ["Bull Case", "Base Case", "Bear Case"]) expect(src).toContain(`{ label: "${label}", probability: null, expectedReturn:`);
  });
});

describe("B9 SmartDiscovery: a withheld confidence is 'Not established', never 0% / null%", () => {
  it("confidenceDisplayText", () => {
    expect(CONFIDENCE_NOT_ESTABLISHED).toBe("Not established");
    expect(confidenceDisplayText(null)).toBe("Not established");
    expect(confidenceDisplayText(undefined)).toBe("Not established");
    expect(confidenceDisplayText(Number.NaN)).toBe("Not established");
    expect(confidenceDisplayText(62)).toBe("62%");
    expect(confidenceDisplayText(0)).toBe("0%");
  });
  it("the integrity validator nulls confidence, which then reads 'Not established'", () => {
    const tx = createInterpretationTransaction("ORACLE", null, null);
    const out = validateInterpretationOutput({ confidence: 62, finalVerdictConfidence: 71, verdict: "HOLD" }, tx).normalizedOutput as any;
    expect(out.confidence).toBeNull();
    expect(out.finalVerdictConfidence).toBeNull();
    expect(confidenceDisplayText(out.confidence)).toBe("Not established");
    expect(confidenceDisplayText(out.finalVerdictConfidence)).toBe("Not established");
  });
  it("every SmartDiscovery confidence display goes through the null-safe path", () => {
    const src = read("client/src/pages/SmartDiscovery.tsx");
    expect(src).not.toMatch(/finalVerdictConfidence \?\? 0/);
    expect(src).not.toMatch(/\$\{answer\.(confidence|finalVerdictConfidence)\}%/);
    expect(src).toContain("value={confidenceDisplayText(answer.confidence)}");
    expect(src).toContain('{ label: "CONFIDENCE", value: confidenceDisplayText(answer.finalVerdictConfidence),');
    expect(src).toContain("{value == null ? CONFIDENCE_NOT_ESTABLISHED : value}");
    expect(src).toContain("{value != null && <div style={scoreBar(value, color)} />}");
  });
});

describe("post-launch nit (in #60's files): MobilePulse", () => {
  it("labels the bull cell a scenario, not a probability", () => {
    const src = read("client/src/pages/mobile/MobilePulse.tsx");
    expect(src).not.toContain("BULL PROB");
    expect(src).toContain(">BULL SCENARIO</span>");
  });
});

// [bull, base, bear] expectedReturn, decision light, verdict confidence — measured at 144b5da.
const PINNED_144B5DA: Record<string, [number[], string, number]> = {
  "low|add_risk|today": [[20, 6, -5], "GREEN", 79],
  "low|add_risk|this_week": [[34, 11, -10], "GREEN", 77],
  "low|add_risk|one_three_months": [[46, 15, -15], "GREEN", 75],
  "low|add_risk|six_twelve_months": [[70, 22, -26], "GREEN", 72],
  "low|reduce_risk|today": [[8, 2, -12], "RED", 62],
  "low|reduce_risk|this_week": [[16, 4, -21], "RED", 60],
  "low|reduce_risk|one_three_months": [[24, 7, -29], "RED", 59],
  "low|reduce_risk|six_twelve_months": [[42, 13, -45], "RED", 57],
  "low|hedge|today": [[5, 2, -4], "RED", 62],
  "low|hedge|this_week": [[7, 4, -6], "RED", 60],
  "low|hedge|one_three_months": [[8, 5, -9], "RED", 59],
  "low|hedge|six_twelve_months": [[11, 8, -14], "RED", 57],
  "low|rotate|today": [[7, 2, -4], "YELLOW", 67],
  "low|rotate|this_week": [[13, 4, -6], "YELLOW", 66],
  "low|rotate|one_three_months": [[18, 6, -9], "YELLOW", 65],
  "low|rotate|six_twelve_months": [[27, 8, -14], "YELLOW", 65],
  "low|raise_cash|today": [[5, 2, -4], "YELLOW", 63],
  "low|raise_cash|this_week": [[7, 4, -6], "YELLOW", 63],
  "low|raise_cash|one_three_months": [[8, 5, -9], "YELLOW", 62],
  "low|raise_cash|six_twelve_months": [[11, 8, -14], "YELLOW", 62],
  "low|deploy_cash|today": [[9, 3, -2], "GREEN", 79],
  "low|deploy_cash|this_week": [[15, 5, -4], "GREEN", 77],
  "low|deploy_cash|one_three_months": [[21, 7, -7], "GREEN", 75],
  "low|deploy_cash|six_twelve_months": [[32, 10, -11], "GREEN", 72],
  "low|buy_specific_asset|today": [[9, 3, -2], "GREEN", 79],
  "low|buy_specific_asset|this_week": [[15, 5, -4], "GREEN", 77],
  "low|buy_specific_asset|one_three_months": [[21, 7, -7], "GREEN", 75],
  "low|buy_specific_asset|six_twelve_months": [[32, 10, -11], "GREEN", 72],
  "low|sell_specific_asset|today": [[5, 2, -4], "RED", 62],
  "low|sell_specific_asset|this_week": [[7, 4, -6], "RED", 60],
  "low|sell_specific_asset|one_three_months": [[8, 5, -9], "RED", 59],
  "low|sell_specific_asset|six_twelve_months": [[11, 8, -14], "RED", 57],
  "low|hold|today": [[7, 2, -4], "YELLOW", 63],
  "low|hold|this_week": [[12, 4, -7], "YELLOW", 63],
  "low|hold|one_three_months": [[16, 5, -10], "YELLOW", 62],
  "low|hold|six_twelve_months": [[26, 8, -16], "YELLOW", 62],
  "high|add_risk|today": [[10, 3, -12], "RED", 73],
  "high|add_risk|this_week": [[18, 5, -20], "RED", 72],
  "high|add_risk|one_three_months": [[27, 8, -27], "RED", 71],
  "high|add_risk|six_twelve_months": [[45, 14, -42], "RED", 69],
  "high|reduce_risk|today": [[18, 6, -6], "GREEN", 55],
  "high|reduce_risk|this_week": [[31, 11, -11], "GREEN", 55],
  "high|reduce_risk|one_three_months": [[43, 14, -17], "GREEN", 55],
  "high|reduce_risk|six_twelve_months": [[67, 21, -29], "GREEN", 55],
  "high|hedge|today": [[12, 6, -2], "GREEN", 55],
  "high|hedge|this_week": [[21, 11, -3], "GREEN", 55],
  "high|hedge|one_three_months": [[30, 15, -5], "GREEN", 55],
  "high|hedge|six_twelve_months": [[48, 24, -8], "GREEN", 55],
  "high|rotate|today": [[9, 3, -6], "YELLOW", 64],
  "high|rotate|this_week": [[16, 5, -11], "YELLOW", 63],
  "high|rotate|one_three_months": [[23, 7, -16], "YELLOW", 63],
  "high|rotate|six_twelve_months": [[37, 11, -26], "YELLOW", 63],
  "high|raise_cash|today": [[12, 6, -2], "GREEN", 59],
  "high|raise_cash|this_week": [[21, 11, -3], "GREEN", 59],
  "high|raise_cash|one_three_months": [[30, 15, -5], "GREEN", 59],
  "high|raise_cash|six_twelve_months": [[48, 24, -8], "GREEN", 60],
  "high|deploy_cash|today": [[7, 2, -8], "RED", 73],
  "high|deploy_cash|this_week": [[12, 4, -13], "RED", 72],
  "high|deploy_cash|one_three_months": [[18, 5, -19], "RED", 71],
  "high|deploy_cash|six_twelve_months": [[30, 10, -29], "RED", 69],
  "high|buy_specific_asset|today": [[7, 2, -8], "RED", 73],
  "high|buy_specific_asset|this_week": [[12, 4, -13], "RED", 72],
  "high|buy_specific_asset|one_three_months": [[18, 5, -19], "RED", 71],
  "high|buy_specific_asset|six_twelve_months": [[30, 10, -29], "RED", 69],
  "high|sell_specific_asset|today": [[12, 6, -2], "GREEN", 55],
  "high|sell_specific_asset|this_week": [[21, 11, -3], "GREEN", 55],
  "high|sell_specific_asset|one_three_months": [[30, 15, -5], "GREEN", 55],
  "high|sell_specific_asset|six_twelve_months": [[48, 24, -8], "GREEN", 55],
  "high|hold|today": [[10, 3, -6], "YELLOW", 59],
  "high|hold|this_week": [[18, 6, -10], "YELLOW", 59],
  "high|hold|one_three_months": [[25, 8, -14], "YELLOW", 59],
  "high|hold|six_twelve_months": [[40, 13, -22], "YELLOW", 60],
  "fallback|add_risk|today": [[15, 5, -8], "GRAY", 55],
  "fallback|add_risk|this_week": [[26, 8, -15], "GRAY", 55],
  "fallback|add_risk|one_three_months": [[36, 11, -21], "GRAY", 55],
  "fallback|add_risk|six_twelve_months": [[58, 18, -34], "GRAY", 55],
  "fallback|reduce_risk|today": [[14, 4, -9], "GRAY", 55],
  "fallback|reduce_risk|this_week": [[24, 7, -16], "GRAY", 55],
  "fallback|reduce_risk|one_three_months": [[34, 11, -23], "GRAY", 55],
  "fallback|reduce_risk|six_twelve_months": [[54, 18, -37], "GRAY", 55],
  "fallback|hedge|today": [[6, 3, -2], "GRAY", 55],
  "fallback|hedge|this_week": [[11, 6, -4], "GRAY", 55],
  "fallback|hedge|one_three_months": [[15, 8, -6], "GRAY", 55],
  "fallback|hedge|six_twelve_months": [[24, 13, -10], "GRAY", 55],
  "fallback|rotate|today": [[8, 2, -3], "GRAY", 55],
  "fallback|rotate|this_week": [[13, 4, -6], "GRAY", 55],
  "fallback|rotate|one_three_months": [[18, 6, -8], "GRAY", 55],
  "fallback|rotate|six_twelve_months": [[29, 10, -14], "GRAY", 55],
  "fallback|raise_cash|today": [[6, 3, -2], "GRAY", 55],
  "fallback|raise_cash|this_week": [[11, 6, -4], "GRAY", 55],
  "fallback|raise_cash|one_three_months": [[15, 8, -6], "GRAY", 55],
  "fallback|raise_cash|six_twelve_months": [[24, 13, -10], "GRAY", 55],
  "fallback|deploy_cash|today": [[7, 2, -4], "GRAY", 55],
  "fallback|deploy_cash|this_week": [[12, 4, -7], "GRAY", 55],
  "fallback|deploy_cash|one_three_months": [[16, 5, -10], "GRAY", 55],
  "fallback|deploy_cash|six_twelve_months": [[26, 8, -16], "GRAY", 55],
  "fallback|buy_specific_asset|today": [[7, 2, -4], "GRAY", 55],
  "fallback|buy_specific_asset|this_week": [[12, 4, -7], "GRAY", 55],
  "fallback|buy_specific_asset|one_three_months": [[16, 5, -10], "GRAY", 55],
  "fallback|buy_specific_asset|six_twelve_months": [[26, 8, -16], "GRAY", 55],
  "fallback|sell_specific_asset|today": [[6, 3, -2], "GRAY", 55],
  "fallback|sell_specific_asset|this_week": [[11, 6, -4], "GRAY", 55],
  "fallback|sell_specific_asset|one_three_months": [[15, 8, -6], "GRAY", 55],
  "fallback|sell_specific_asset|six_twelve_months": [[24, 13, -10], "GRAY", 55],
  "fallback|hold|today": [[8, 3, -3], "GRAY", 55],
  "fallback|hold|this_week": [[14, 4, -5], "GRAY", 55],
  "fallback|hold|one_three_months": [[20, 6, -8], "GRAY", 55],
  "fallback|hold|six_twelve_months": [[30, 10, -13], "GRAY", 55],
};
