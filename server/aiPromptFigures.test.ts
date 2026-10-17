/**
 * Launch fix-up 5: no fabricated confidence / probability figure in text sent to a model whose
 * output a customer sees (PLATO answer and greeting, published pages, chat, trade rationale).
 * The engines keep their internal values; only the model-bound text changes.
 *
 * Why input-side: #58's output strip (stripProbabilityClaims.isProbabilityPercentClaim) removes a
 * sentence only when it has a % plus a probability word (probability/odds/chance/likelihood/likely)
 * or a bull/bear/crash/recession/scenario word. "78% confidence" and "N/100 confidence" are not
 * matched, so a confidence figure handed to a model is not reliably removed from its answer.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const llm = vi.hoisted(() => ({ calls: [] as any[], reply: "" }));
vi.mock("./_core/llm", async importOriginal => ({
  ...(await importOriginal<typeof import("./_core/llm")>()),
  invokeLLM: vi.fn(async (req: any) => {
    llm.calls.push(req);
    return { id: "r", created: 1, model: "m", choices: [{ index: 0, message: { role: "assistant", content: llm.reply || "Answer." }, finish_reason: "stop" }] };
  }),
}));
const gateway = vi.hoisted(() => ({ createContext: vi.fn() }));
vi.mock("./ashaGateway", async importOriginal => ({
  ...(await importOriginal<typeof import("./ashaGateway")>()),
  createAshaGatewayContext: gateway.createContext,
}));

import { buildDailyBriefContext, buildReportContext } from "./seismographCore";
import { buildAshaCanonicalContextBlock } from "./ashaGateway";
import { askAsha } from "./ashaEngine";
import { generateBotResponse } from "./chatbotEngine";
import { isProbabilityPercentClaim } from "./stripProbabilityClaims";

const root = path.resolve(__dirname, "..");
const src = (file: string) => readFileSync(path.join(root, file), "utf8");
const marketState = JSON.parse(src("server/__fixtures__/prod-2026-10-01/market-state-current.json"));

/** A confidence or probability figure: "78% confidence", "(78%)", "72/100 confidence", "41% probability". */
const FIGURE = /\d+(?:\.\d+)?\s*%\s*(?:confidence|probability)|confidence[^.\n]{0,12}\d+(?:\.\d+)?\s*(?:%|\/100)|\d+\s*\/100\s*confidence|probability[^.\n]{0,12}\d+(?:\.\d+)?\s*%/i;

const seismographOutput = (overrides: Record<string, unknown> = {}) => ({
  pressureScore: 64, regime: "Elevated Risk", stressLevel: "Elevated", direction: "Deteriorating",
  evidenceConsensus: "strong", activeContributors: ["a", "b"], topAnalog: null, historicalPercentile: 80,
  probabilities: { bull: 20, neutral: 30, bear: 50, confidence: 50, primaryDriver: "Credit" },
  evidenceFamilies: [{ name: "Credit", signal: "stressed", strength: 70, summary: "Credit stressed" }],
  activePatterns: [
    { name: "Sustained Elevated Pressure", confidence: 78 },
    { name: "Credit-Liquidity Divergence", confidence: 72 },
    { name: "Regime Persistence", confidence: 65 },
  ],
  transitionProbabilities: { remainInRegime: 40, transitionToElevated: 20, transitionToLow: 5, transitionToCrisis: 35, confidence: 50 },
  marketMemory: { streakDays: 4, streakDirection: "deteriorating", keyMemoryPoints: [] },
  dataFreshness: "live",
  ...overrides,
}) as any;

beforeEach(() => {
  llm.calls.length = 0;
  llm.reply = "";
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "log").mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

describe("#58 strip coverage (why the figures are removed before the model)", () => {
  it("the strip does not match a confidence % or a /100 confidence", () => {
    expect(isProbabilityPercentClaim("Pattern detected: Regime Persistence (65% confidence)")).toBe(false);
    expect(isProbabilityPercentClaim("NVDA shows BUY signal with 72/100 confidence.")).toBe(false);
    expect(isProbabilityPercentClaim("Elevated transition risk: 35% probability of crisis regime")).toBe(true);
  });
});

describe("seismographCore brief/report text (autonomous publishing Key Developments)", () => {
  it("daily-brief keyDevelopments carry no pattern confidence and no crisis-transition %", () => {
    const ctx = buildDailyBriefContext(seismographOutput());
    expect(ctx.keyDevelopments).toEqual([
      "Pressure deteriorating — Elevated Risk",
      "Pattern detected: Sustained Elevated Pressure (confidence not established)",
      "Pattern detected: Credit-Liquidity Divergence (confidence not established)",
      "Pattern detected: Regime Persistence (confidence not established)",
    ]);
    for (const line of ctx.keyDevelopments) {
      expect(line).not.toMatch(FIGURE);
      expect(line).not.toMatch(/%/);
    }
    // Internal values unchanged.
    expect(ctx.activePatterns.map((p: any) => p.confidence)).toEqual([78, 72, 65]);
    expect(ctx.transitionProbabilities.transitionToCrisis).toBe(35);
  });

  it("the autonomous-publishing Key Developments line built from them has no figure", () => {
    const ctx = buildDailyBriefContext(seismographOutput());
    const line = `Key Developments: ${ctx.keyDevelopments.join(" | ")}`;
    expect(line).not.toMatch(FIGURE);
    expect(line).not.toMatch(/probability of crisis/i);
  });

  it("report keyDevelopments carry no pattern confidence", () => {
    const ctx = buildReportContext(seismographOutput());
    expect(ctx.keyDevelopments).toContain("Sustained Elevated Pressure pattern active (confidence not established)");
    expect(ctx.keyDevelopments).toContain("Credit-Liquidity Divergence pattern active (confidence not established)");
    for (const line of ctx.keyDevelopments) expect(line).not.toMatch(/%/);
  });
});

describe("PLATO greeting context block (seismographUnified pattern confidence 78/72/65)", () => {
  it("activePatterns confidence and a confidence % in keyDevelopments reach the model as Uncalibrated", () => {
    const state = structuredClone(marketState);
    state.watch.activePatterns = [
      { name: "Sustained Elevated Pressure", description: "d", confidence: 78, daysActive: 180, invalidationConditions: "x" },
      { name: "Credit-Liquidity Divergence", description: "d", confidence: 72, daysActive: 120, invalidationConditions: "x" },
      { name: "Regime Persistence", description: "d", confidence: 65, daysActive: 270, invalidationConditions: "x" },
    ];
    state.why.keyDevelopments = ["Pattern detected: Regime Persistence (65% confidence)"];
    const block = buildAshaCanonicalContextBlock({ version: "1.0", page: { page: "daily-greeting" }, marketState: state } as any);
    const json = JSON.parse(block.split("\n")[3]);
    expect(json.watch.activePatterns.map((p: any) => p.confidence)).toEqual(["Uncalibrated", "Uncalibrated", "Uncalibrated"]);
    expect(json.why.keyDevelopments).toEqual(["Pattern detected: Regime Persistence (Uncalibrated)"]);
    expect(block).not.toMatch(/"confidence":\s*\d/);
    expect(block).not.toMatch(FIGURE);
  });
});

describe("PLATO answer prompt (UniversalSymbolIntelligence day-trade confidence in page context)", () => {
  it("additionalContext.confidence, regimeConfidence and transitionProbability never enter the asha.ask prompt", async () => {
    gateway.createContext.mockImplementation(async (page: any) => ({
      version: "1.0", destination: null, page,
      marketState: { ...structuredClone(marketState), history: { ...marketState.history, observationCount: 0 } },
    }));
    llm.reply = JSON.stringify({
      reply: "Pressure is moderate.", directAnswer: "Pressure is moderate.", executiveSummary: "Pressure is moderate. Credit is calm.", coreThesis: "Credit is calm.",
      keyFindings: ["a", "b", "c"], riskFactors: ["x", "y", "z"], invalidationConditions: ["i1", "i2"],
    });
    await askAsha({
      userMessage: "What is NVDA doing today?",
      history: [],
      pageContext: {
        page: "symbol-intelligence",
        regimeConfidence: 91.375,
        transitionProbability: 44.625,
        additionalContext: { activeSymbol: "NVDA", assetType: "stock", direction: "bullish", setupType: "BREAKOUT", confidence: 87.125 },
      },
    }).catch(() => undefined);
    expect(llm.calls.length).toBeGreaterThan(0);
    const prompt = JSON.stringify(llm.calls.map(c => c.messages));
    expect(prompt).toContain("Page: symbol-intelligence");
    expect(prompt).not.toMatch(/87\.125|91\.375|44\.625/);
    expect(prompt).not.toContain("additionalContext");
  });
});

describe("chatbot live context (btcCycleConfidence)", () => {
  it("no cycle-confidence figure reaches the chat model", async () => {
    await generateBotResponse([], "Is BTC in accumulation?", {
      btcCyclePhase: "Bear Market → Accumulation Phase",
      btcCycleConfidence: 83.375,
      btcAccumulationAnalysis: {
        directAnswer: "BTC may be basing.", confidenceLabel: "MODERATE", keyEvidence: ["e1"],
        bullCycleConfirmation: ["c1"], invalidationSignals: ["s1"], tradingBias: "Patient.",
      },
    });
    const prompt = JSON.stringify(llm.calls.map(c => c.messages));
    expect(prompt).toContain("Bitcoin Market Cycle Phase: Bear Market → Accumulation Phase (confidence not established)");
    expect(prompt).toContain("STEP 2 — Confidence:** confidence not established");
    expect(prompt).not.toMatch(/83\.375/);
    expect(prompt).not.toContain("MODERATE (");
  });
});

describe("prompt templates with a formula confidence (customer-visible model output)", () => {
  const CASES: Array<[string, string[], RegExp[]]> = [
    ["server/ownerSimulation.ts",
      ["- Signal: ${signal.action} (confidence not established)", "signal under ${pressure.regime} regime (confidence not established)."],
      [/\$\{signal\.confidence\}\/100 confidence/]],
    ["server/routers/smartDiscovery.ts",
      ["Confidence: confidence not established — Why: ${o.whyNow}"],
      [/Confidence: \$\{o\.faultlineConfidence\}%/]],
    ["server/tradePreflight.ts",
      ["- VERDICT: ${verdictLabel} (confidence not established)"],
      [/\(Confidence: \$\{output\.verdict\.confidence\}%\)/]],
    ["server/dayTradeEngine.ts",
      ["Confidence: confidence not established (the setup score is a rule-based heuristic, not a calibrated confidence)"],
      [/^Confidence: \$\{confidence\}\/100$/m]],
    ["server/simPortfolioEngine.ts",
      ["- Signal Confidence: confidence not established"],
      [/Signal Confidence: \$\{signal\.confidence\}\/100/]],
    ["server/fmos/engines/aiInterpretation.ts",
      ["(confidence not established, stability: ${regime.stability}%)", "**Market DNA:** ${dna.currentDNA} (confidence not established)", "(conviction not established)", "**Confidence:** confidence not established"],
      [/confidence: \$\{regime\.confidence\}%/, /\$\{dna\.confidence\}% confidence/, /conviction: \$\{decision\.conviction\}%\)\n/, /\(\$\{confidence\.score\}\/100\)/]],
    ["server/seismographCore.ts",
      ["Pattern detected: ${pattern.name} (confidence not established)", "${pattern.name} pattern active (confidence not established)"],
      [/\$\{pattern\.confidence\}% confidence/, /% probability of crisis regime/]],
  ];
  for (const [file, present, absent] of CASES) {
    it(file, () => {
      const text = src(file);
      for (const s of present) expect(text, s).toContain(s);
      for (const re of absent) expect(text, String(re)).not.toMatch(re);
    });
  }
});
