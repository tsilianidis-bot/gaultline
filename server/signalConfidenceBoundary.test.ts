import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { computeTradingSignal, computeTradingSignals, type TradingSignalsInput } from "./tradingSignals";
import {
  withholdScreenerConfidence,
  withholdSignalConfidence,
  withholdSignalsConfidence,
} from "./signalConfidenceBoundary";

// Launch fix-up: the trading-signal "confidence" (min(95, 55 + |score| × 5) and
// the crypto equivalent) is a formula, so the tRPC responses carry null. The
// engines are unchanged and still compute it internally.
const REGIME = { label: "MODERATE RISK", score: 5 };
const ticker = (o: Partial<TradingSignalsInput> = {}): TradingSignalsInput => ({
  ticker: "NVDA", price: 120, open: 118, high: 124, low: 116, changePercent: 1.8,
  volumeMillions: 45, avgVolume: 30, sparkline: [-0.5, 0.2, 0.8, 1.4, 2.1], relativeStrength: 72, ...o,
});

describe("signal confidence response boundary", () => {
  it("engine still computes a number internally; the boundary sends null and keeps every other field", () => {
    const raw = computeTradingSignal(ticker(), REGIME);
    expect(typeof raw.confidence).toBe("number");
    const out = withholdSignalConfidence(raw);
    expect(out.confidence).toBeNull();
    const { confidence: _a, ...restRaw } = raw;
    const { confidence: _b, ...restOut } = out;
    expect(restOut).toEqual(restRaw);
    expect(raw.confidence).not.toBeNull(); // input not mutated
  });

  it("batch: every signal has confidence null", () => {
    const raw = computeTradingSignals([ticker(), ticker({ ticker: "AAPL", changePercent: -2.4, sparkline: [0, -1.5, -3, -4.5, -6] })], REGIME);
    const out = withholdSignalsConfidence(raw);
    expect(out).toHaveLength(raw.length);
    expect(out.every(s => s.confidence === null)).toBe(true);
    expect(out.map(s => s.ticker)).toEqual(raw.map(s => s.ticker));
  });

  it("screener: confidence null, server order kept, strengthRank reproduces the old confidence ordering (ties in engine order)", () => {
    const rows = [
      { symbol: "A", confidence: 60 },
      { symbol: "B", confidence: 80 },
      { symbol: "C", confidence: 60 },
      { symbol: "D", confidence: 92 },
    ];
    const out = withholdScreenerConfidence(rows);
    expect(out.map(r => r.symbol)).toEqual(["A", "B", "C", "D"]);
    expect(out.every(r => r.confidence === null)).toBe(true);
    expect(out.map(r => r.strengthRank)).toEqual([3, 2, 4, 1]);
    const oldOrder = [...rows].sort((a, b) => b.confidence - a.confidence).map(r => r.symbol);
    const newOrder = [...out].sort((a, b) => a.strengthRank - b.strengthRank).map(r => r.symbol);
    expect(newOrder).toEqual(oldOrder);
    expect(Object.values(out[0]).some(v => v === 60)).toBe(false);
  });
});

const root = path.resolve(import.meta.dirname, "..");
const code = (rel: string) => readFileSync(path.join(root, rel), "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");

describe("routers.ts applies the boundary on every mounted signal procedure", () => {
  const src = code("server/routers.ts");
  it("signals.getTradingSignals / getTradingSignal", () => {
    expect(src).toContain("return withholdSignalsConfidence(computeTradingSignals(input.tickers, input.regime));");
    expect(src).toContain("return withholdSignalConfidence(computeTradingSignal(tickerInput, regime));");
    expect(src).not.toMatch(/return computeTradingSignals?\(/);
  });
  it("crypto.getSignal / crypto.getScreener", () => {
    expect(src).toMatch(/const withheld = withholdSignalConfidence\(result\);\s*return sanitizeNumbers\(withheld\) as typeof withheld;/);
    expect(src).toContain("signals: withholdScreenerConfidence(results),");
    expect(src).not.toMatch(/signals: results,/);
  });
});

describe("crypto signals page orders by strengthRank, not confidence", () => {
  it("no confidence arithmetic", () => {
    const src = code("client/src/pages/CryptoSignals.tsx");
    expect(src).not.toMatch(/\.confidence\s*-\s*\w+\.confidence/);
    expect((src.match(/\.sort\(byStrengthRank\)/g) ?? []).length).toBe(3);
    expect(src).toMatch(/a\.strengthRank \?\? Number\.MAX_SAFE_INTEGER\) - \(b\.strengthRank \?\? Number\.MAX_SAFE_INTEGER/);
    expect(src).not.toMatch(/\{[^}]*strengthRank[^}]*\}\s*</);
  });
});
