import { readFileSync } from "node:fs";
import path from "node:path";
import React, { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { Router } from "wouter";
import { describe, expect, it, vi, beforeEach } from "vitest";

// QA r12 (gate r11 on 5ecbfde):
// B9b — the Decision Ledger / Validation pages never show the ledger
//       confidence (client default ?? 50) or opportunity score (?? 5); the
//       server withholds them; no evaluator / lesson prompt uses them;
//       confidence calibration is "Not established". Writes unchanged (NOT NULL).
// B10 — trade.simulate ships no fabricated historical analogs ([]).
// B11 — share snapshots use favorableSetupScore / adversePressureScore.
// Fold-ins — no hard-coded 2.0 reward:risk, no "bull probability" reason,
//       and QA's four r11 mutation gaps.
(globalThis as any).React = React;

const llm = vi.hoisted(() => ({ calls: [] as any[], reply: "" }));
vi.mock("./_core/llm", () => ({
  invokeLLM: vi.fn(async (req: any) => {
    llm.calls.push(req);
    return { choices: [{ message: { content: llm.reply || "Deterministic explanation." } }] };
  }),
}));
vi.mock("./ownerSimulation", () => ({ scanOpportunities: vi.fn().mockResolvedValue([]) }));
const dbState = vi.hoisted(() => ({ inserted: [] as any[] }));
vi.mock("./db", () => {
  // select().from().where().limit() resolves to [] ; insert().values(v) records v
  const chain: any = new Proxy(() => chain, {
    get: (_t, prop) => (prop === "then" ? (resolve: (v: unknown) => void) => resolve([]) : chain),
    apply: () => chain,
  });
  const db = {
    select: () => chain,
    update: () => chain,
    insert: () => ({ values: (v: any) => { dbState.inserted.push(v); return Promise.resolve(); } }),
  };
  return { getDb: vi.fn(async () => db) };
});
const fixtures = vi.hoisted(() => ({ data: {} as Record<string, unknown>, user: { id: 7, name: "QA" } as any }));
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
vi.mock("@/_core/hooks/useAuth", () => ({ useAuth: () => ({ user: fixtures.user, loading: false, isAuthenticated: true }) }));
vi.mock("@/hooks/useSEO", () => ({ useSEO: () => undefined }));

import { runTradePreflightSimulation } from "./tradePreflight";
import { withoutLedgerFabricatedScores } from "./routers/smartDiscovery";
import { evaluateLedgerEntry } from "./decisionLedgerEvaluator";
import { extractLessonForEntry } from "./lessonExtractor";
import DecisionConfidencePanel, { type ConfidenceData } from "../client/src/components/DecisionConfidencePanel";

const root = path.resolve(import.meta.dirname, "..");
const read = (rel: string) => readFileSync(path.join(root, rel), "utf8");
const text = (html: string) => html.replace(/<[^>]+>/g, " ").replace(/&[a-z]+;/g, " ").replace(/\s+/g, " ");

const LEDGER_ROW = {
  id: 11, userId: 7, ticker: "NVDA", assetType: "stock", verdict: "HOLD", opportunityScore: 5, confidence: 50,
  primaryDriver: "Credit spreads contained", expectedTimeframe: "1-3 months", queryType: "security", outcome: "pending",
  notes: null, evaluationNotes: null, priceAtEntry: 100, priceAtResolution: null, elapsedMs: null, autoEvaluated: false,
  evaluatedAt: null, resolvedAt: null, createdAt: new Date("2026-10-01T12:00:00Z"), engineSource: "Ask Intelligence", regimeAtTime: "Transition",
};

describe("B9b Decision Ledger: the defaulted confidence / opportunity score never leave the server", () => {
  it("withoutLedgerFabricatedScores nulls confidence and opportunityScore and keeps every other column", () => {
    const [out] = withoutLedgerFabricatedScores([LEDGER_ROW]);
    expect(out.confidence).toBeNull();
    expect(out.opportunityScore).toBeNull();
    const { confidence: _c, opportunityScore: _o, ...rest } = LEDGER_ROW;
    for (const [k, v] of Object.entries(rest)) expect((out as any)[k], k).toEqual(v);
  });
  it("getLedger returns through the guard; the write path is unchanged (NOT NULL columns, no migration)", () => {
    const router = read("server/routers/smartDiscovery.ts");
    expect(router).toContain("return withoutLedgerFabricatedScores(entries);");
    const schema = read("drizzle/schema.ts");
    expect(schema).toContain('confidence:       int("confidence").notNull(),');
    const client = read("client/src/pages/SmartDiscovery.tsx");
    expect(client).toContain("confidence: fa.confidence ?? 50,");
  });
});

describe("B9b Decision Ledger / Validation pages render no confidence or opportunity figure", () => {
  beforeEach(() => { fixtures.data = {}; });
  it("/app/decision-ledger: no CONF / OPP cell even if a stale server sent 50 / 5", async () => {
    fixtures.data["smartDiscovery.getLedger"] = [LEDGER_ROW];
    fixtures.data["smartDiscovery.getLedgerStats"] = { total: 1, resolved: 0, pending: 1, correct: 0, incorrect: 0, winRate: null, byAsset: [], byVerdict: [] };
    const Page = (await import("../client/src/pages/DecisionLedger")).default;
    const html = text(renderToStaticMarkup(createElement(Router, { ssrPath: "/app/decision-ledger" }, createElement(Page))));
    expect(html).toContain("NVDA");
    expect(html).not.toMatch(/\bCONF\b|\bOPP\b|50%|Confidence/);
    const src = read("client/src/pages/DecisionLedger.tsx");
    expect(src).not.toMatch(/entry\.(confidence|opportunityScore)|entry\[\s*["'`](confidence|opportunityScore)/);
  });
  it("/app/validation: no Avg Conf, no calibration bands; calibration reads Not established", async () => {
    fixtures.data["intelligenceValidation.validationStats"] = { total: 3, resolved: 2, pending: 1, correct: 1, partial: 0, incorrect: 1, stillActive: 0, winRate: 50, strictAccuracy: 50 };
    fixtures.data["intelligenceValidation.engineScorecards"] = [{ engine: "Ask Intelligence", total: 3, resolved: 2, pending: 1, correct: 1, partial: 0, incorrect: 1, stillActive: 0, winRate: 50, strictAccuracy: 50, avgConfidence: 50, avgOpportunityScore: 5, grade: "N/A" }];
    fixtures.data["intelligenceValidation.confidenceCalibration"] = [{ band: "50–59", midpoint: 54.5, total: 3, resolved: 2, winRate: 50, calibrationDelta: -4.5, isCalibrated: true }];
    fixtures.data["intelligenceValidation.getImprovementLessons"] = [{ id: 1, lessonText: "Credit spreads led the move.", patternTag: "Correct Thesis", confidence: 70, engineSource: "Ask Intelligence", regimeAtTime: "Transition", createdAt: new Date() }];
    const Page = (await import("../client/src/pages/IntelligenceValidation")).default;
    const html = text(renderToStaticMarkup(createElement(Router, { ssrPath: "/app/validation" }, createElement(Page))));
    expect(html).toContain("Confidence Calibration");
    expect(html).toContain("Not established — recommendations are logged without a stated model confidence");
    expect(html).not.toMatch(/Avg Conf|50–59|pp vs stated midpoint|\d+% actual/);
    const src = read("client/src/pages/IntelligenceValidation.tsx");
    expect(src).not.toMatch(/avgConfidence|avgOpportunityScore|confidenceCalibration\.useQuery/);
    expect(src).not.toMatch(/\blesson\b(?:\s+as\s+any\))?\??\.confidence|\blesson\b(?:\s+as\s+any\))?\s*\[/);
    expect(src).not.toMatch(/Confidence:\s*\{/);
  });
  it("the validation router computes no confidence average and no confidence bands", () => {
    const src = read("server/routers/intelligenceValidation.ts");
    expect(src).toContain("const avgConfidence = null;");
    expect(src).toContain("const avgOpportunityScore = null;");
    expect(src).not.toMatch(/\b[re]\.(confidence|opportunityScore)\b/);
    const cal = src.slice(src.indexOf("confidenceCalibration:"), src.indexOf("performanceOverTime:"));
    expect(cal).toContain("return [];");
    expect(cal).not.toMatch(/getDb|decisionLedger/);
  });
});

describe("B9b prompts never carry the ledger confidence / opportunity score", () => {
  beforeEach(() => { llm.calls.length = 0; llm.reply = ""; dbState.inserted.length = 0; });
  it("macro evaluator prompt", async () => {
    llm.reply = JSON.stringify({ outcome: "still_active", evaluationNotes: "Ambiguous. This evaluation is automated and for informational purposes only." });
    await evaluateLedgerEntry({ id: 1, ticker: null, assetType: null, verdict: "HOLD", opportunityScore: 5, confidence: 50, primaryDriver: "Credit", expectedTimeframe: "1-3 months", priceAtEntry: null, createdAt: new Date(Date.now() - 86400000) });
    const prompt = JSON.stringify(llm.calls.map(c => c.messages));
    expect(prompt).toContain("RECOMMENDATION TO EVALUATE");
    expect(prompt).not.toMatch(/Confidence at time|Opportunity|\b50%|\b5\/100/);
  });
  it("lesson extractor prompt", async () => {
    llm.reply = JSON.stringify({ lessonText: "Credit spreads led the move by two weeks.", patternTag: "Correct Thesis", confidence: 70 });
    await extractLessonForEntry({ id: 2, userId: 7, ticker: "NVDA", assetType: "stock", verdict: "HOLD", opportunityScore: 5, confidence: 50, primaryDriver: "Credit", expectedTimeframe: "1-3 months", outcome: "correct", evaluationNotes: null, notes: null, priceAtEntry: 100, priceAtResolution: 110, elapsedMs: 3600000, engineSource: null, regimeAtTime: null, sector: null, returnPct: 10 } as any);
    const prompt = JSON.stringify(llm.calls.map(c => c.messages));
    expect(prompt).toContain("RECOMMENDATION:");
    expect(prompt).not.toMatch(/Opportunity Score|- Confidence: |\b50%|\b5\/100/);
  });
});

const vectors = (score: number) => ["liquidity-stress", "credit-contagion", "volatility-regime", "macro-sensitivity", "market-breadth", "ai-bubble"]
  .map(id => ({ id, score, label: id, riskLevel: score >= 60 ? "critical" : "low" }));
const PRESSURES = [
  { overallPressure: 12, dataSource: "live", vectors: vectors(10), regime: "Expansion", level: "Low" },
  { overallPressure: 34, dataSource: "live", vectors: vectors(40), regime: "Transition", level: "Moderate" },
  { overallPressure: 75, dataSource: "live", vectors: vectors(70), regime: "Late-Cycle Stress", level: "High" },
  { overallPressure: 50, dataSource: "fallback", vectors: vectors(45), regime: "Transition", level: "Elevated" },
];
const MOVES = ["add_risk", "reduce_risk", "hedge", "rotate", "raise_cash", "deploy_cash", "buy_specific_asset", "sell_specific_asset", "hold"];
const TIMEFRAMES = ["today", "this_week", "one_three_months", "six_twelve_months"];

describe("B10 / fold-ins on trade.simulate (144 cases)", () => {
  beforeEach(() => { llm.calls.length = 0; llm.reply = ""; });
  it("no historical analogs, no 'probability' reason, scenarios carry only label / probability(null) / expectedReturn, prompt % only on the verdict line", async () => {
    let n = 0;
    for (const p of PRESSURES) for (const moveType of MOVES) for (const timeframe of TIMEFRAMES) {
      llm.calls.length = 0;
      const r: any = await runTradePreflightSimulation({ moveType, timeframe, ticker: "NVDA" } as any, p as any, null);
      const key = `${p.overallPressure}|${moveType}|${timeframe}`;
      expect(r.historicalAnalogs, key).toEqual([]);
      expect(r.verdict.reason, key).not.toMatch(/probabilit|odds|likelihood/i);
      for (const s of r.outcomeSimulator.scenarios) {
        expect(Object.keys(s).sort(), key).toEqual(["expectedReturn", "label", "probability"]);
        expect(s.probability).toBeNull();
      }
      expect(Object.keys(r.outcomeSimulator).sort(), key).toEqual(["scenarios", "weightedOutcome"]);
      const user = llm.calls.flatMap(c => c.messages).filter((m: any) => m.role === "user").map((m: any) => String(m.content)).join("\n");
      const pctLines = user.split("\n").filter(l => /\d(?:\.\d+)?\s*%/.test(l));
      for (const l of pctLines) expect(l, key).toMatch(/^- VERDICT: .+ \(Confidence: \d+%\)$/);
      const ALLOWED_ODDS_LINES = [
        /^- Favorable Setup score: \d+\/100 \(heuristic score, not a likelihood\)$/,
        /^- Adverse Pressure score: \d+\/100 \(heuristic score, not a likelihood\)$/,
        /^- Conclude with a regime-conditioned reading referencing the verdict \(no probability or percentage chance\)$/,
      ];
      for (const l of user.split("\n").filter(l => /\b(odds|chance|likelihood)\b/i.test(l))) {
        expect(ALLOWED_ODDS_LINES.some(re => re.test(l)), `${key}: ${l}`).toBe(true);
      }
      n++;
    }
    expect(n).toBe(144);
  });
  it("the HIGH_CONVICTION reason says 'bull scenario weight is elevated'", async () => {
    const r: any = await runTradePreflightSimulation({ moveType: "add_risk", timeframe: "today", ticker: "NVDA" } as any, PRESSURES[0] as any, null);
    expect(r.verdict.verdict).toBe("HIGH_CONVICTION");
    expect(r.verdict.reason).toContain("bull scenario weight is elevated");
  });
  it("Situation Room hides HISTORICAL ANALOGS on the empty list", () => {
    const src = read("client/src/pages/SituationRoom.tsx");
    expect(src).toContain("{result.historicalAnalogs && result.historicalAnalogs.length > 0 && (");
    expect(read("server/tradePreflight.ts")).toContain("const historicalAnalogs: HistoricalAnalog[] = [];");
  });
});

describe("r11 mutation gaps (QA): scenario cards and confidence data read no probability / agreement", () => {
  const src = read("client/src/pages/SituationRoom.tsx");
  it("the BULL / BEAR card block reads no probability, by dot, bracket or cast", () => {
    const start = src.indexOf("SECTION 3+4 — BULL CASE / BEAR CASE");
    const end = src.indexOf("SECTION", start + 40);
    expect(start).toBeGreaterThan(0);
    const block = src.slice(start, end).replace(/Scenario return · uncalibrated · no probability assigned/g, "");
    expect(block).not.toMatch(/probabilit/i);
    expect(block).not.toMatch(/\[\s*["'`][^"'`]*["'`]\s*\]/);
    // no index access on a scenario at all (literal, concatenated or computed key)
    expect(block).not.toMatch(/\b(bull|base|bear)\b(?:\s+as\s+any\))?\??\.?\s*\[/);
  });
  it("the Situation Room confData has only allowed literal keys (no computed key, no agreement / similarity / range)", () => {
    const start = src.indexOf("const confData: ConfidenceData = {");
    const end = src.indexOf("\n              };", start);
    const block = src.slice(start, end).split("\n").filter(l => !/^\s*\/\//.test(l)).join("\n");
    expect(block).not.toMatch(/^\s*\[[^\]]*\]\s*:/m);
    expect(block).not.toMatch(/\.\.\./);
    expect(block).not.toMatch(/agree|similar|probabilityRange|winRate:\s*\d/i);
    const keys = Array.from(block.matchAll(/^ {16}(\w+):/gm)).map(m => m[1]);
    expect(keys).toEqual(["confidenceScore", "supportingSignals", "conflictingSignals", "dataFreshnessMinutes", "historicalWinRate", "expectedVolatility", "rewardRisk", "verdict"]);
  });
});

const renderPanel = (data: ConfidenceData, expanded: boolean) => text(renderToStaticMarkup(createElement(DecisionConfidencePanel, { data, defaultExpanded: expanded })));
describe("fold-in: reward:risk has no hard-coded 2.0 fallback", () => {
  it("SituationRoom returns null when a return is missing; the panel shows —", () => {
    const src = read("client/src/pages/SituationRoom.tsx");
    expect(src).not.toMatch(/return 2\.0;|: 2\.0,/);
    expect(src).toContain('return null; // QA r12: no hard-coded 2.0 fallback — shown as "—"');
    const base: ConfidenceData = { confidenceScore: 62, supportingSignals: [], conflictingSignals: [], dataFreshnessMinutes: null, expectedVolatility: "MODERATE", rewardRisk: null, verdict: "HOLD" };
    expect(renderPanel(base, false)).toContain("— R:R");
    expect(renderPanel(base, true)).toMatch(/REWARD:RISK —/);
    expect(renderPanel({ ...base, rewardRisk: 2.1 }, false)).toContain("2.1:1 R:R");
    expect(renderPanel(base, true)).not.toMatch(/2\.0:1/);
  });
});

describe("B11 share snapshot keys are scores", () => {
  it("TradePreflight shares favorableSetupScore / adversePressureScore, never *Probability keys", () => {
    const src = read("client/src/pages/TradePreflight.tsx");
    const snap = src.slice(src.indexOf("snapshotData={{"), src.indexOf("}}", src.indexOf("snapshotData={{")));
    expect(snap).toContain("favorableSetupScore: result.favorableSetupProbability,");
    expect(snap).toContain("adversePressureScore: result.adversePressureProbability,");
    expect(snap).not.toMatch(/^\s*\w*Probability\s*:/m);
    expect(src).not.toContain("probability-weighted");
  });
});
