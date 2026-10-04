/**
 * Fix-up 6 (labels and prompt text only; no calculation changes):
 *  - Signal Outlook 8-factor breakdown: raw factor floats rounded for display (formatFactorScore)
 *  - Discover Ask (legacy orchestrateAnswer block): regime confidence %, FMOS conviction % and
 *    confidence N/100 and the historical outcome split % no longer reach the model as figures
 *  - FMOS LLM-failure fallback headline: no "N% conviction"
 * The factor-name test lives in signalOutlook.test.ts (it reuses that file's engine mocks).
 */
import fs from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { formatFactorScore } from "../client/src/lib/factorScoreDisplay";
import { formatPromptBlock } from "./historicalIntelligenceEngine";

vi.mock("./_core/llm", () => ({ invokeLLM: vi.fn().mockRejectedValue(new Error("llm down")) }));

const read = (p: string) => fs.readFileSync(new URL(p, import.meta.url), "utf8");

describe("formatFactorScore — display rounding only", () => {
  it("rounds raw floats to at most one decimal", () => {
    expect(formatFactorScore(50.940000000000005)).toBe("50.9");
    expect(formatFactorScore(71.10000000000001)).toBe("71.1");
    expect(formatFactorScore(54.936)).toBe("54.9");
    expect(formatFactorScore(72)).toBe("72");
    expect(formatFactorScore(0)).toBe("0");
    expect(formatFactorScore(100)).toBe("100");
    expect(formatFactorScore(Number.NaN)).toBe("—");
  });
  it("ScoreBar renders the formatted value; the bar width still uses the raw score", () => {
    const src = read("../client/src/pages/SignalOutlookCenter.tsx");
    const bar = src.slice(src.indexOf("function ScoreBar("), src.indexOf("function ScoreBar(") + 2000);
    expect(bar).toContain("{formatFactorScore(score)}</span>");
    expect(bar).not.toMatch(/color \}\}>\{score\}<\/span>/);
    expect(bar).toMatch(/width: `\$\{score\}%`/);
  });
});

function sampleHistorical(confidence: "high" | "moderate" | "low" | "insufficient") {
  return {
    analogs: [], timeline: [],
    frequency: { label: "Typical", historicalPct: 22, description: "d", monthsInRegime: 10, totalMonths: 45 },
    outcomeDistribution: { bullishContinuation: 61, sideways: 24, correction: 15, sampleSize: 33, confidence },
    regimeComparison: { resembles: [], doesNotResemble: [], regimeDescription: "r" },
    marketEvolution: { sevenDayChange: 1, thirtyDayChange: 2, trajectory: "stable", description: "e" },
    historicalPercentile: 83, historicalN: 45, dataRange: "2022–2026", rarityStatement: "rs",
    currentPressure: 34, currentRegime: "MODERATE",
  } as any;
}

describe("Discover Ask prompt — historical outcome split withheld (engine unchanged)", () => {
  it("replaces Bullish continuation / Sideways / Correction % with a withheld line and keeps N", async () => {
    const { historicalPromptBlockForModel } = await import("./routers/smartDiscovery");
    for (const c of ["high", "moderate", "low"] as const) {
      const raw = formatPromptBlock(sampleHistorical(c));
      expect(raw).toContain("Bullish continuation: 61%"); // the engine itself is untouched
      const out = historicalPromptBlockForModel(raw);
      expect(out).toContain("  Outcome distribution: frequency withheld (uncalibrated)\n  Sample size: N=33 similar setups");
      expect(out).not.toMatch(/Bullish continuation|Sideways:|Correction:|61%|24%|15%/);
      expect(out).not.toMatch(/Sample size:[^\n]*Confidence/);
      // everything outside the outcome block is byte-identical
      const [pre, post] = raw.split(/  Bullish continuation:[\s\S]*?Sample size: N=33[^\n]*/);
      expect(out.startsWith(pre)).toBe(true);
      expect(out.endsWith(post)).toBe(true);
    }
  });
  it("leaves the insufficient-sample block (no figures) unchanged", async () => {
    const { historicalPromptBlockForModel } = await import("./routers/smartDiscovery");
    const raw = formatPromptBlock(sampleHistorical("insufficient"));
    expect(historicalPromptBlockForModel(raw)).toBe(raw);
  });
});

describe("Discover Ask prompt — regime confidence and FMOS conviction carry no figures", () => {
  const src = read("./routers/smartDiscovery.ts");
  const legacy = src.slice(src.indexOf("── MARKET REGIME INTELLIGENCE ──"), src.indexOf("// ← Historical Intelligence injected here"));
  it("regime lines say 'confidence not established'", () => {
    expect(legacy).toContain("| Risk: ${crossMarket.stockRegime.riskLevel} | confidence not established | Trend:");
    expect(legacy).toContain("| Risk: ${crossMarket.cryptoRegime.riskLevel} | confidence not established | Trend:");
    expect(legacy).not.toMatch(/Regime\.confidence\}%/);
  });
  it("FMOS decision and confidence keep labels, drop numbers", () => {
    expect(legacy).toContain("FMOS Decision: ${fmos.decision.verdict} (conviction not established)");
    expect(legacy).toContain("Confidence: ${fmos.confidence.label}\\nTransition Risk");
    expect(legacy).not.toMatch(/decision\.conviction\}|confidence\.score\}/);
    expect(legacy).toContain("historicalPromptBlockForModel(historicalIntelligence.promptBlock)");
    expect(legacy).not.toMatch(/\? historicalIntelligence\.promptBlock :/);
  });
});

describe("FMOS AI interpretation — LLM-failure fallback headline has no conviction figure", () => {
  it("headline is '<regime> — <Bullish|Bearish> bias' (LLM mocked to fail)", async () => {
    const { computeAIInterpretation } = await import("./fmos/engines/aiInterpretation");
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    const pressure = { overallPressure: 34, vectors: [{ id: "credit", score: 41, label: "Credit", trend: "stable" }] } as any;
    const regime = { currentRegime: "MODERATE", description: "Moderate stress." } as any;
    const decision = { conviction: 71, verdict: "HOLD", positionSizing: "Standard", invalidationConditions: ["x"] } as any;
    for (const [bull, bear, bias] of [[0.6, 0.4, "Bullish"], [0.3, 0.7, "Bearish"]] as const) {
      const probability = { bull, bear, bullEvidence: ["a"], bearEvidence: ["b"] } as any;
      const out = await computeAIInterpretation(pressure, regime, probability, {} as any, decision, {} as any, {} as any, "SPY");
      expect(out.headline).toBe(`MODERATE — ${bias} bias`);
      expect(JSON.stringify(out)).not.toMatch(/71|conviction/i);
    }
    err.mockRestore();
  });
  it("source pin", () => {
    const src = read("./fmos/engines/aiInterpretation.ts");
    expect(src).toContain('"Bullish" : "Bearish"} bias`,');
    expect(src).not.toMatch(/% conviction/);
  });
});
