import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import React, { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CanonicalIntelligenceState } from "../shared/canonicalIntelligenceState";

// QA r13 (gate r12 on 35d5047):
// B12 — Signal Outlook confidence (|composite − 50| × 2), AI confidence
//       (?? 60 / 55) and parameter confidence are withheld by the outlook
//       router and shown as "Not established" / "—".
// B13 — the static "LIVE SIGNAL PREVIEW" demo rows are not mounted in the app.
// B14 — signal confidence min(95, 55 + |score| × 5): CryptoSignals, SignalDetail,
//       MobileCrypto and OwnerSimulation show "Not established"; no snapshot key;
//       the visual-detail payload withholds it. (Signals.tsx is fixed on #59.)
// B15 — the verdict heuristic is "N/100 · heuristic", never "N%".
// Gaps — ledger alias keys, computed share keys, case-insensitive frequency.
(globalThis as any).React = React;

/**
 * MOCK FIXTURE ONLY — fixed, timestamped data for this unit boundary. It never
 * represents a live provider response or an operational financial observation.
 */
const FIXTURES = vi.hoisted(() => {
  const observation = Object.freeze({
    fixtureSource: "MOCK" as const,
    provider: "fixture-yahoo-proxy",
    symbol: "NVDA",
    observedAt: "2026-10-16T20:00:00.000Z",
    fetchedAt: "2026-10-16T20:00:01.000Z",
    price: 100,
    previousClose: 99,
    volume: 1_000_000,
  });
  const vectorIds = ["liquidity-stress", "credit-contagion", "volatility-regime", "macro-sensitivity", "market-breadth", "ai-bubble"];
  const canonical = {
    schemaVersion: "phase2-canonical-state-v1",
    stateId: "state:mock-fail-closed-qa-r13",
    generatedAt: observation.observedAt,
    effectiveAt: observation.observedAt,
    calculationStartedAt: observation.observedAt,
    calculationCompletedAt: observation.fetchedAt,
    championVersion: "champion-v1-frozen",
    modelVersion: "mock-outlook-adapter-r13",
    scoringVersion: "faultline-pressure-v1-frozen",
    configurationVersion: "mock-fail-closed-qa-r13",
    inputSnapshotId: "input:mock-fail-closed-qa-r13",
    stateHash: "hash:mock-fail-closed-qa-r13",
    regime: "MODERATE RISK",
    pressureIndex: 45,
    pressureLevel: "Moderate",
    pressureDirection: "Stable",
    pressureAcceleration: null,
    pressurePersistence: null,
    engines: vectorIds.map((engineId, index) => ({
      engineId,
      engineName: engineId,
      value: 35 + index * 3,
      unit: "score_0_to_100",
      classification: null,
      direction: "Stable",
      acceleration: null,
      persistence: null,
      observedAt: observation.observedAt,
      calculatedAt: observation.fetchedAt,
      sourceInputIds: [`mock:${engineId}`],
      qualityStatus: "HEALTHY",
      freshnessStatus: "CURRENT",
      fallbackStatus: "NONE",
      modelVersion: "champion-v1-frozen",
      calculationVersion: "faultline-pressure-v1-frozen",
      contributionToComposite: true,
    })),
    domains: { fixtureProvenance: observation },
    scenarioOutputs: {},
    probabilityClaimIds: [],
    analogClaimIds: [],
    historicalContext: {
      canonicalLiveHistory: "MOCK fixture only; no live history asserted.",
      reconstructedResearch: "Not supplied in this unit fixture.",
      historicalAnalogOutput: "Not supplied in this unit fixture.",
      patternResolution: "Not supplied in this unit fixture.",
    },
    dataQualitySummary: { fixtureProvenance: observation, staleInputs: [], unavailableInputs: [], fallbackInputs: [] },
    confidenceOrEvidenceQuality: "HEALTHY",
    staleInputs: [], delayedInputs: [], unavailableInputs: [], fallbackInputs: [], warnings: [], conflicts: [],
    historicalDatasetVersion: "mock-historical-dataset-v1",
    researchDatasetVersion: "mock-research-dataset-v1",
    provenance: { manifestSource: "intelligenceStateManifests", governanceVersion: "mock-fail-closed-qa-r13", coherenceStatus: "COHERENT" },
  };
  const outlook = {
    symbol: "NVDA", name: "NVIDIA", assetType: "stock", timeframe: "swing", generatedAt: Date.parse(observation.fetchedAt), dataStatus: "Cached",
    canonicalStateId: canonical.stateId, asOf: canonical.effectiveAt, quality: canonical.confidenceOrEvidenceQuality,
    outlookScore: 55, direction: "Neutral", confidence: 10, riskLevel: "Moderate", timeHorizon: "2-8 weeks", regimeAlignment: "Mixed",
    diagnosticIntegration: { primaryDriver: "MOCK fixture", bullCase: "MOCK fixture", bearCase: "MOCK fixture", portfolioImplication: "MOCK fixture", sensitiveTrigger: "MOCK fixture", macroPath: "MOCK fixture", historicalAnalog: "MOCK fixture", confidence: 55 },
    tradeFramework: { parameterConfidence: 55, riskRating: "Moderate", maxHoldTime: "4 weeks" },
    history: {
      current: { snapshotAt: Date.parse(observation.fetchedAt), outlookScore: 55, direction: "Neutral", confidence: 10, riskLevel: "Moderate" },
      h24: { snapshotAt: Date.parse(observation.observedAt) - 86_400_000, outlookScore: 60, direction: "Bullish", confidence: 20, riskLevel: "Moderate" },
      d7: null, d30: null, trend: "Stable",
    },
  };
  return { observation, canonical, outlook };
});

const mocks = vi.hoisted(() => ({
  getFullOutlook: vi.fn(),
  getQuickOutlook: vi.fn(),
  getTopOpportunities: vi.fn(),
  getAuthoritativeCanonicalIntelligenceState: vi.fn(),
  recordForecastObservation: vi.fn(),
}));

// Keep every current, unmocked adapter export available to the router.
vi.mock("./signalOutlook", async () => ({
  ...(await vi.importActual<typeof import("./signalOutlook")>("./signalOutlook")),
  getFullOutlook: mocks.getFullOutlook,
  getQuickOutlook: mocks.getQuickOutlook,
  getTopOpportunities: mocks.getTopOpportunities,
}));
vi.mock("./canonicalIntelligenceState", async () => ({
  ...(await vi.importActual<typeof import("./canonicalIntelligenceState")>("./canonicalIntelligenceState")),
  getAuthoritativeCanonicalIntelligenceState: mocks.getAuthoritativeCanonicalIntelligenceState,
}));
vi.mock("./forecastHorizon", async () => ({
  ...(await vi.importActual<typeof import("./forecastHorizon")>("./forecastHorizon")),
  recordForecastObservation: mocks.recordForecastObservation,
}));

import { outlookRouter } from "./routers/outlook";
import { withoutLedgerFabricatedScores } from "./routers/smartDiscovery";
import { withoutNarrativeText } from "./probabilityContract";
import DecisionConfidencePanel, { type ConfidenceData } from "../client/src/components/DecisionConfidencePanel";

const root = path.resolve(import.meta.dirname, "..");
const read = (rel: string) => readFileSync(path.join(root, rel), "utf8");
const text = (html: string) => html.replace(/<[^>]+>/g, " ").replace(/&[a-z]+;/g, " ").replace(/\s+/g, " ");
const caller = () => outlookRouter.createCaller({ req: {} as never, res: {} as never, user: null } as never);
/** Every key named "confidence" / "parameterConfidence" anywhere in a payload. */
function confidenceValues(v: unknown, out: unknown[] = []): unknown[] {
  if (Array.isArray(v)) v.forEach(x => confidenceValues(x, out));
  else if (v && typeof v === "object") for (const [k, x] of Object.entries(v)) { if (k === "confidence" || k === "parameterConfidence") out.push(x); confidenceValues(x, out); }
  return out;
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getAuthoritativeCanonicalIntelligenceState.mockResolvedValue(structuredClone(FIXTURES.canonical));
  mocks.getFullOutlook.mockImplementation(async (
    _symbol: string, _assetType: "stock" | "crypto", _timeframe: string, canonical: CanonicalIntelligenceState | null | undefined
  ) => {
    if (canonical && canonical.stateId !== FIXTURES.canonical.stateId) throw new Error("Fixture received a mismatched canonical state.");
    return structuredClone(FIXTURES.outlook);
  });
  mocks.getQuickOutlook.mockImplementation(async (
    symbol: string, assetType: "stock" | "crypto", canonical: CanonicalIntelligenceState | null | undefined
  ) => {
    if (canonical && canonical.stateId !== FIXTURES.canonical.stateId) throw new Error("Fixture received a mismatched canonical state.");
    return {
      symbol: symbol.toUpperCase(), assetType, canonicalStateId: FIXTURES.canonical.stateId, asOf: FIXTURES.canonical.effectiveAt,
      quality: FIXTURES.canonical.confidenceOrEvidenceQuality, outlookScore: 55, direction: "Neutral", confidence: 10, riskLevel: "Moderate", dataStatus: "Cached",
    };
  });
  mocks.getTopOpportunities.mockImplementation(async (canonical: CanonicalIntelligenceState | null | undefined) => {
    if (!canonical || canonical.stateId !== FIXTURES.canonical.stateId) throw new Error("Top opportunities require the fixture's canonical state.");
    const common = { canonicalStateId: FIXTURES.canonical.stateId, asOf: FIXTURES.canonical.effectiveAt, quality: FIXTURES.canonical.confidenceOrEvidenceQuality };
    return {
      stocks: [{ ...common, symbol: "NVDA", name: "NVIDIA", assetType: "stock", outlookScore: 72, direction: "Bullish", confidence: 44, riskLevel: "Moderate", regimeAlignment: "Mixed", topReason: "MOCK fixture" }],
      crypto: [{ ...common, symbol: "BTC", name: "Bitcoin", assetType: "crypto", outlookScore: 30, direction: "Bearish", confidence: 40, riskLevel: "High", regimeAlignment: "Neutral", topReason: "MOCK fixture" }],
    };
  });
  mocks.recordForecastObservation.mockResolvedValue(undefined);
});

describe("B12 outlook router withholds every outlook confidence; scores / directions unchanged", () => {
  it("getOutlook: confidence, AI confidence, parameter confidence and history confidences are null", async () => {
    const r = await caller().getOutlook({ symbol: "nvda", assetType: "stock", timeframe: "swing" });
    expect(r.confidence).toBeNull();
    expect(r.diagnosticIntegration.confidence).toBeNull();
    expect(r.tradeFramework.parameterConfidence).toBeNull();
    expect(r.history?.current.confidence).toBeNull();
    expect(r.history?.h24?.confidence).toBeNull();
    const vals = confidenceValues(r);
    expect(vals.length).toBeGreaterThanOrEqual(5);
    expect(vals.every(v => v === null)).toBe(true);
    expect([r.outlookScore, r.direction, r.riskLevel, r.history?.h24?.outlookScore]).toEqual([55, "Neutral", "Moderate", 60]);
    expect(r.diagnosticIntegration.primaryDriver).toBe("MOCK fixture");
    expect(r.tradeFramework.riskRating).toBe("Moderate");
    expect(r.canonicalState).toMatchObject({
      stateId: FIXTURES.canonical.stateId,
      inputSnapshotId: FIXTURES.canonical.inputSnapshotId,
      stateHash: FIXTURES.canonical.stateHash,
      generatedAt: FIXTURES.observation.observedAt,
    });
    expect(mocks.getFullOutlook).toHaveBeenCalledWith("NVDA", "stock", "swing", expect.objectContaining({
      stateId: FIXTURES.canonical.stateId,
      inputSnapshotId: FIXTURES.canonical.inputSnapshotId,
      stateHash: FIXTURES.canonical.stateHash,
    }));
  });
  it("getQuickOutlook / getWatchlistOutlooks / getTopOpportunities withhold confidence", async () => {
    const q = await caller().getQuickOutlook({ symbol: "nvda", assetType: "stock" });
    expect(q.confidence).toBeNull();
    expect(q.outlookScore).toBe(55);
    expect(q.canonicalStateId).toBe(FIXTURES.canonical.stateId);
    const w = await caller().getWatchlistOutlooks({ items: [{ symbol: "nvda", assetType: "stock" }, { symbol: "aapl", assetType: "stock" }] });
    expect(w.map(x => x.outlook?.confidence)).toEqual([null, null]);
    expect(w.map(x => x.outlook?.direction)).toEqual(["Neutral", "Neutral"]);
    expect(w.map(x => x.outlook?.canonicalStateId)).toEqual([FIXTURES.canonical.stateId, FIXTURES.canonical.stateId]);
    const t = await caller().getTopOpportunities();
    expect(confidenceValues(t)).toEqual([null, null]);
    expect([t.stocks[0].outlookScore, t.stocks[0].direction, t.crypto[0].outlookScore, t.crypto[0].direction]).toEqual([72, "Bullish", 30, "Bearish"]);
    expect([...t.stocks, ...t.crypto].map(opportunity => opportunity.canonicalStateId)).toEqual([FIXTURES.canonical.stateId, FIXTURES.canonical.stateId]);
    expect(mocks.getQuickOutlook).toHaveBeenCalledWith("NVDA", "stock", expect.objectContaining({ stateId: FIXTURES.canonical.stateId }));
    expect(mocks.getTopOpportunities).toHaveBeenCalledWith(expect.objectContaining({ stateId: FIXTURES.canonical.stateId }));
  });
  it("withholds every Outlook endpoint when the authoritative canonical state is absent", async () => {
    mocks.getAuthoritativeCanonicalIntelligenceState.mockResolvedValue(null);
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    try {
      await expect(caller().getOutlook({ symbol: "NVDA", assetType: "stock", timeframe: "swing" })).rejects.toMatchObject({ code: "SERVICE_UNAVAILABLE" });
      await expect(caller().getQuickOutlook({ symbol: "NVDA", assetType: "stock" })).rejects.toMatchObject({ code: "SERVICE_UNAVAILABLE" });
      await expect(caller().getTopOpportunities()).rejects.toMatchObject({ code: "INTERNAL_SERVER_ERROR", message: "Top opportunities unavailable." });
    } finally {
      error.mockRestore();
    }
  });
  it("signalOutlook has no AI-confidence default (?? 60) and no hard-coded 55", () => {
    const src = read("server/signalOutlook.ts");
    expect(src).not.toMatch(/diagnosticConfidence\s*\?\?/);
    expect(src).not.toMatch(/confidence:\s*55\b/);
    expect(src).toContain('confidence: typeof parsed.diagnosticConfidence === "number" ? clamp(parsed.diagnosticConfidence) : null,');
    expect(src).toContain("confidence: null, // QA r13 B12: no hard-coded 55");
  });
  it("SignalOutlookCenter renders no outlook / AI / parameter confidence figure or bar", () => {
    const src = read("client/src/pages/SignalOutlookCenter.tsx");
    expect(src).not.toMatch(/\bopp\b\??\.confidence|\bopp\s*\[/);
    expect(src).not.toMatch(/\bd\??\.confidence\b|\bd\s*\[\s*["'`]confidence/);
    expect(src).not.toMatch(/diagnosticIntegration\??\.confidence|diagnosticIntegration\s*\[\s*["'`]conf/);
    expect(src).not.toMatch(/parameterConfidence\s*\}|parameterConfidence\s*>=|tradeFramework\??\.parameterConfidence/);
    expect(src).toContain("conf: {CONFIDENCE_NOT_ESTABLISHED}");
    expect(src).toContain('{ label: "Confidence", value: CONFIDENCE_NOT_ESTABLISHED,');
    expect(src).toContain('{ label: "PARAMETER CONFIDENCE", value: CONFIDENCE_NOT_ESTABLISHED, color: "#94A3B8" },');
    expect(src).toMatch(/AI CONFIDENCE<\/span>\s*<span data-ai-confidence="withheld"[^>]*>—<\/span>/);
    expect(src).toMatch(/data-confidence-status="not-established"[^>]*>\{CONFIDENCE_NOT_ESTABLISHED\}/);
  });
});

describe("B13 static demo signal rows are not mounted in the app", () => {
  it("no page imports HomeStockIntelSection", () => {
    const dirs = ["client/src/pages", "client/src/pages/mobile", "client/src/components"];
    for (const d of dirs) for (const f of readdirSync(path.join(root, d))) {
      if (!/\.tsx$/.test(f) || f === "HomeStockIntelSection.tsx") continue;
      expect(read(`${d}/${f}`), `${d}/${f}`).not.toMatch(/HomeStockIntelSection/);
    }
  });
});

describe("B14 signal confidence (min(95, 55 + |score| × 5)) is never displayed or shared", () => {
  const FILES = ["client/src/pages/CryptoSignals.tsx", "client/src/pages/SignalDetail.tsx", "client/src/pages/mobile/MobileCrypto.tsx", "client/src/pages/OwnerSimulation.tsx"];
  it("no `{…confidence}%`, no confidence-driven width / colour band", () => {
    for (const f of FILES) {
      const src = read(f);
      expect(src, f).not.toMatch(/(?:sig|signal|s|v|result|opp)\??\.(?:faultline)?[cC]onfidence\s*\}\s*%|\$\{(?:sig|signal|s|v|result|opp)\??\.(?:faultline)?[cC]onfidence\}%/);
      expect(src, f).not.toMatch(/width:\s*`\$\{(?:sig|signal)\??\.confidence\}%`|confidenceBar\(|scoreBar\(opp\.faultlineConfidence\)/);
      expect(src, f).not.toMatch(/(?:sig|signal|result)\??\.(?:faultline)?[cC]onfidence\s*>=/);
      expect(src, f).toContain("CONFIDENCE_NOT_ESTABLISHED");
    }
  });
  it("CryptoSignals: no average confidence and no confidence key in the share snapshot", () => {
    const src = read("client/src/pages/CryptoSignals.tsx");
    expect(src).not.toMatch(/avgConf|AVG CONFIDENCE/);
    const at = src.indexOf('reportType="crypto_intelligence"');
    const snap = src.slice(src.indexOf("snapshotData={{", at), src.indexOf("}}", src.indexOf("snapshotData={{", at)));
    expect(snap).toContain("symbol: s.symbol,");
    const code = snap.replace(/\/\/.*$/gm, "");
    expect(code).not.toMatch(/confidence|\[[^\]]*\]\s*:|\.\.\./i);
  });
  it("SignalDetail: no confidence in the Ask ASHA prompt either", () => {
    const src = read("client/src/pages/SignalDetail.tsx");
    expect(src).not.toMatch(/signal\??\.confidence/);
    expect(src).toContain('<Metric label="CONFIDENCE" value={CONFIDENCE_NOT_ESTABLISHED} />');
  });
  it("the visual-detail payload withholds signal confidence (source boundary)", () => {
    const src = read("server/signalVisualDetail.ts");
    // This boundary preserves provider observation time and canonical identity;
    // neither a client payload nor Date.now() can substitute for either fact.
    expect(src).toMatch(/signal:\s*signal\s*\?\s*\{\s*\.\.\.signal,\s*confidence:\s*null,\s*canonicalStateId:\s*canonical!\.stateId,/s);
    expect(src).toMatch(/observedAt:\s*quote!\.observedAt,\s*source:\s*quote!\.source,\s*evidenceQuality:\s*canonical!\.confidenceOrEvidenceQuality/s);
    expect(src).toContain("getAuthoritativeCanonicalIntelligenceState()");
    expect(src).toContain("toOperationalPressure(canonical)");
    expect(src).toMatch(/!finite\(quote\.observedAt\).*?!finite\(quote\.fetchedAt\)/s);
    expect(src).toContain("quote.observedAt > quote.fetchedAt + 60_000");
    expect(src).toContain("Signal withheld until required source observations and canonical context are available.");
    expect(src).not.toMatch(/calculateFaultlinePressure|calculateFaultline.*Pressure/);
  });
});

describe("B15 verdict heuristic is a /100 score, never a %", () => {
  const base: ConfidenceData = { confidenceScore: 86, supportingSignals: [], conflictingSignals: [], dataFreshnessMinutes: null, expectedVolatility: "MODERATE", rewardRisk: 2.1, verdict: "PROCEED" } as ConfidenceData;
  it("DecisionConfidencePanel collapsed and expanded", () => {
    for (const defaultExpanded of [false, true]) {
      const t = text(renderToStaticMarkup(createElement(DecisionConfidencePanel, { data: base, defaultExpanded })));
      expect(t).toContain("DECISION SCORE · HEURISTIC");
      expect(t).toContain("86/100");
      expect(t).not.toMatch(/86\s*%|DECISION CONFIDENCE/);
      if (defaultExpanded) expect(t).toMatch(/HEURISTIC SCORE\s+86\/100/);
    }
  });
  it("SituationRoom verdict cluster shows N/100 · heuristic", () => {
    const src = read("client/src/pages/SituationRoom.tsx");
    // A "{…verdict.confidence}%" text node (the bar width `${…}%` is a /100 scale, kept).
    expect(src).not.toMatch(/(?<!\$)\{(?:Math\.round\()?result\.verdict\??\.confidence\)?\s*\}\s*%/);
    expect(src).not.toMatch(/>\s*Confidence\s*<\/span>/);
    expect(src).toContain("{Math.round(result.verdict.confidence)}/100</span>");
    expect(src).toContain(">Decision score · heuristic</span>");
  });
});

describe("QA r12 mutation gaps", () => {
  it("ledger guard output has exactly the input keys (no alias such as `conf`)", () => {
    const row = { id: 1, ticker: "NVDA", confidence: 50, opportunityScore: 5, verdict: "HOLD" };
    const [out] = withoutLedgerFabricatedScores([row]);
    expect(Object.keys(out).sort()).toEqual(Object.keys(row).sort());
    expect(Object.values(out).filter(v => v === 50 || v === 5)).toEqual([]);
    const ui = read("client/src/pages/DecisionLedger.tsx");
    expect(ui).not.toMatch(/entry\)?\??\.(?:conf|opp)\w*|entry\)?\s*\[\s*["'`](?:conf|opp)/i);
  });
  it("TradePreflight share snapshot: plain literal keys only, exact set", () => {
    const src = read("client/src/pages/TradePreflight.tsx");
    const start = src.indexOf("snapshotData={{");
    const snap = src.slice(start + "snapshotData={{".length, src.indexOf("}}", start));
    const lines = snap.split("\n").map(l => l.trim()).filter(l => l && !l.startsWith("//") && !l.startsWith("("));
    for (const l of lines) expect(l, l).toMatch(/^[a-zA-Z]+: result\.[a-zA-Z]+,$/);
    expect(lines.map(l => l.split(":")[0])).toEqual(["ticker", "moveLabel", "timeframeLabel", "moveFavorabilityScore", "riskLevel", "confidenceLevel", "favorableSetupScore", "adversePressureScore"]);
  });
  it("frequency rewrite is case-insensitive", () => {
    for (const s of ["The path (60% Historical Frequency) holds.", "The path (60% HISTORICAL FREQUENCY) holds."]) {
      expect(withoutNarrativeText(s)).toBe("The path (frequency withheld: uncalibrated) holds.");
    }
    expect(withoutNarrativeText("Held at 60% Historical Frequency.")).toBe("Held at frequency withheld (uncalibrated).");
  });
});
