import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import type { CanonicalIntelligenceState } from "../shared/canonicalIntelligenceState";
import type { YahooDailyBar, YahooQuote } from "./yahooProxy";
import { buildCanonicalIntelligenceState } from "./canonicalIntelligenceState";
import { toOperationalPressure, toSignalRegime } from "./operationalSignalInputs";
import { buildObservedTradingSignalInput } from "./signalVisualDetail";
import { computeTradingSignal, computeTradingSignals, type TradingSignalsInput } from "./tradingSignals";
import {
  withholdScreenerConfidence,
  withholdSignalConfidence,
  withholdSignalsConfidence,
} from "./signalConfidenceBoundary";

// Test-only static data. These fixtures are explicitly MOCK observations, never
// live evidence or an operational financial assertion.
const MOCK_SOURCE_METADATA = Object.freeze({
  kind: "MOCK",
  provider: "Yahoo Finance fixture",
  verification: "NOT_LIVE_OR_OPERATIONAL",
  observedAt: "2026-10-16T20:30:00.000Z",
});
const AS_OF = "2026-10-16T20:30:00.000Z";
const FIXTURE_NOW = Date.parse("2026-10-16T20:40:00.000Z");
const VECTOR_IDS = ["liquidity-stress", "credit-contagion", "volatility-regime", "macro-sensitivity", "market-breadth", "ai-bubble"] as const;

const completedBars: YahooDailyBar[] = Array.from({ length: 30 }, (_, index) => {
  const close = 100 + index;
  return { open: close - 0.5, high: close + 1, low: close - 1, close,
    volume: 1_000_000 + index * 10_000, timestamp: Date.UTC(2026, 8, 1 + index, 20, 0, 0) };
});

const quoteFixture: YahooQuote = {
  ticker: "AAPL", price: 130, prevClose: 129, open: 128.5, high: 131, low: 127.5,
  volume: 2_100_000, change: 1, changePercent: 0.78, marketState: "REGULAR", isDelayed: true,
  source: "yahoo", observedAt: Date.parse(AS_OF), fetchedAt: Date.parse("2026-10-16T20:31:00.000Z"),
};

function canonicalFixture(): CanonicalIntelligenceState {
  return buildCanonicalIntelligenceState({
    stateId: "state:mock-signal-confidence-2026-10-16", generatedAt: AS_OF,
    championVersion: "champion-v1-frozen", modelVersion: "signal-confidence-test-v1",
    scoringVersion: "faultline-pressure-v1-frozen", configurationVersion: "phase2-canonical-state-v1",
    inputSnapshotId: "input:mock-signal-confidence-2026-10-16", stateHash: "hash:mock-signal-confidence-2026-10-16",
    pressureIndex: 50, regime: "MODERATE RISK",
    engineValues: Object.fromEntries(VECTOR_IDS.map((id, index) => [id, 40 + index * 2])),
    engineDirections: Object.fromEntries(VECTOR_IDS.map(id => [id, "stable"])),
    domainValues: {}, scenarioOutputs: {}, probabilityClaimIds: [], analogClaimIds: [],
    historicalDatasetVersion: "mock-historical-dataset-v1", researchDatasetVersion: "mock-research-dataset-v1",
    coherenceStatus: "COHERENT", coherenceNotes: [],
    dataQualitySummary: { staleInputs: [], unavailableInputs: [], fallbackInputs: [], staticInputs: [] },
    staleInputs: [], unavailableInputs: [], fallbackInputs: [],
    inputQuality: VECTOR_IDS.map(id => ({ inputId: `mock:${id}`, source: "MOCK:signal-confidence-fixture",
      observedAt: AS_OF, receivedAt: AS_OF, freshnessStatus: "CURRENT", required: true, contributesTo: [id] })),
  });
}

const CANONICAL = canonicalFixture();
const REGIME = toSignalRegime(toOperationalPressure(CANONICAL, true));

function observedTicker(symbol = quoteFixture.ticker, quote = quoteFixture): TradingSignalsInput {
  const input = buildObservedTradingSignalInput(symbol, quote, completedBars, FIXTURE_NOW);
  if (!input) throw new Error("The explicit MOCK provider fixture must satisfy the observed-input adapter.");
  return input;
}

describe("signal confidence response boundary", () => {
  it("engine still computes a number internally; the boundary sends null and keeps every other field", () => {
    const raw = computeTradingSignal(observedTicker(), REGIME);
    expect(typeof raw.confidence).toBe("number");
    // Behavioral score freeze: proven against source-backed inputs rather than a
    // whole-file text diff, so cache/provenance repairs remain allowed.
    expect(raw).toMatchObject({ ticker: "AAPL", action: "HOLD", confidence: 60, strength: "Moderate", timeframe: "Swing" });
    const out = withholdSignalConfidence(raw);
    expect(out.confidence).toBeNull();
    const { confidence: _a, ...restRaw } = raw;
    const { confidence: _b, ...restOut } = out;
    expect(restOut).toEqual(restRaw);
    expect(raw.confidence).not.toBeNull(); // input not mutated
  });

  it("batch: every signal has confidence null", () => {
    const raw = computeTradingSignals([
      observedTicker(),
      observedTicker("MSFT", { ...quoteFixture, ticker: "MSFT", price: 225, prevClose: 222, open: 221, high: 228, low: 220, change: 3, changePercent: 1.35 }),
    ], REGIME);
    const out = withholdSignalsConfidence(raw);
    expect(out).toHaveLength(raw.length);
    expect(out.every(s => s.confidence === null)).toBe(true);
    expect(out.map(s => s.ticker)).toEqual(raw.map(s => s.ticker));
  });

  it("screener: confidence null, server order kept, strengthRank reproduces the old confidence ordering (ties in engine order)", () => {
    const rows = [
      { symbol: "A", confidence: 60, canonicalStateId: CANONICAL.stateId, sourceMetadata: MOCK_SOURCE_METADATA },
      { symbol: "B", confidence: 80, canonicalStateId: CANONICAL.stateId, sourceMetadata: MOCK_SOURCE_METADATA },
      { symbol: "C", confidence: 60, canonicalStateId: CANONICAL.stateId, sourceMetadata: MOCK_SOURCE_METADATA },
      { symbol: "D", confidence: 92, canonicalStateId: CANONICAL.stateId, sourceMetadata: MOCK_SOURCE_METADATA },
    ];
    const out = withholdScreenerConfidence(rows);
    expect(out.map(r => r.symbol)).toEqual(["A", "B", "C", "D"]);
    expect(out.every(r => r.confidence === null)).toBe(true);
    expect(out.every(r => r.canonicalStateId === CANONICAL.stateId && r.sourceMetadata.kind === "MOCK")).toBe(true);
    expect(out.map(r => r.strengthRank)).toEqual([3, 2, 4, 1]);
    const oldOrder = [...rows].sort((a, b) => b.confidence - a.confidence).map(r => r.symbol);
    const newOrder = [...out].sort((a, b) => a.strengthRank - b.strengthRank).map(r => r.symbol);
    expect(newOrder).toEqual(oldOrder);
    expect(Object.values(out[0]).some(v => v === 60)).toBe(false);
  });
});

const root = path.resolve(import.meta.dirname, "..");
const code = (rel: string) => readFileSync(path.join(root, rel), "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
const procedure = (src: string, name: string, nextName: string) => {
  const start = src.indexOf(`${name}:`);
  if (start === -1) return "";
  const end = src.indexOf(`${nextName}:`, start + name.length);
  return src.slice(start, end === -1 ? undefined : end);
};

describe("routers.ts applies the boundary on every mounted signal procedure", () => {
  const src = code("server/routers.ts");
  it("signals.getTradingSignals / getTradingSignal", () => {
    const batch = procedure(src, "getTradingSignals", "getTradingSignal");
    const single = procedure(src, "getTradingSignal", "getSignalVisualDetail");
    expect(batch).toMatch(/getAuthoritativeCanonicalIntelligenceState/);
    expect(batch).toMatch(/toOperationalPressure\(canonical\)/);
    expect(batch).toMatch(/getSignalVisualDetailPayload\(item\.ticker,\s*canonical\)/);
    expect(batch).not.toMatch(/computeTradingSignals\(input\.tickers,\s*input\.regime\)/);
    expect(single).toMatch(/getSignalVisualDetailPayload\(input\.ticker\)/);
    expect(single).not.toMatch(/computeTradingSignal\(tickerInput,\s*regime\)/);
    expect(`${batch}\n${single}`).not.toMatch(/input\.(price|open|high|low|changePercent|volumeMillions|avgVolume|sparkline|relativeStrength|regime)\b/);
  });
  it("crypto.getSignal / crypto.getScreener", () => {
    const crypto = procedure(src, "crypto", "altRotation");
    const single = procedure(crypto, "getSignal", "getScreener");
    const screener = procedure(crypto, "getScreener", "clearCache");
    expect(single).toMatch(/getCoinMarketData\(input\.idOrSymbol\)/);
    expect(single).toMatch(/getGlobalStats\(\)/);
    expect(single).toMatch(/readOperationalPressure\(\)/);
    expect(single).toMatch(/requireObservedCryptoGlobals\(globalStats\)/);
    expect(single).toMatch(/withholdSignalConfidence\(result\)/);
    expect(single).toMatch(/canonicalStateId:\s*pressure\.canonicalStateId/);
    expect(screener).toMatch(/signals:\s*withholdScreenerConfidence\(results\)/);
    expect(screener).toMatch(/globalsObservedAt:\s*observedGlobals\.observedAt/);
    expect(screener).not.toMatch(/signals:\s*results/);
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
