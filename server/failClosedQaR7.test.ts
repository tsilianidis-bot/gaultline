import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { computeEvolution } from "./seismographUnified";
import { EngineSnapshotSchema, computeOverallConfidence } from "./routers/dailyBrief";
import { DEFAULT_INDICATORS } from "../client/src/lib/engine";
import { projectCanonicalMarketState, selectBrowserMarketOutput } from "../client/src/lib/marketStateProjection";
import { availableDelta, pointsDeltaText } from "../client/src/lib/displayFallbacks";
import { buildEngineSnapshot, canonicalPressure100 } from "../client/src/lib/engineSnapshot";
import type { CanonicalMarketState } from "../shared/marketState";

// QA r7 (#60 at c9c1e5c): display-only, fail-closed fixes. No engine change.
const root = path.resolve(import.meta.dirname, "..");
const read = (rel: string) => readFileSync(path.join(root, rel), "utf8");

/**
 * MOCK FIXTURE ONLY — no provider, credential, database, or network call.
 * Every observed value carries fixture provenance so it cannot be presented as
 * a production market observation. Identity fields bind this browser projection
 * to one immutable canonical-state fixture rather than page-authored facts.
 */
const MOCK_OBSERVED_AT = "2026-10-17T12:00:00.000Z";
const MOCK_PROVIDER_METADATA = {
  classification: "MOCK",
  mode: "credential-free-fixture",
  observedAt: MOCK_OBSERVED_AT,
  receivedAt: "2026-10-17T12:00:01.000Z",
} as const;
const MOCK_PROVIDER_OBSERVATIONS = [
  { ...MOCK_PROVIDER_METADATA, provider: "MOCK:FRED", sourceIdentifier: "mock:fred:liquidity", vector: "liquidity-stress", value: 17 },
  { ...MOCK_PROVIDER_METADATA, provider: "MOCK:FRED", sourceIdentifier: "mock:fred:credit", vector: "credit-contagion", value: 30 },
  { ...MOCK_PROVIDER_METADATA, provider: "MOCK:MARKET", sourceIdentifier: "mock:market:volatility", vector: "volatility-regime", value: 40 },
  { ...MOCK_PROVIDER_METADATA, provider: "MOCK:FRED", sourceIdentifier: "mock:fred:macro", vector: "macro-sensitivity", value: 35 },
  { ...MOCK_PROVIDER_METADATA, provider: "MOCK:MARKET", sourceIdentifier: "mock:market:breadth", vector: "market-breadth", value: 45 },
] as const;

const marketState: CanonicalMarketState = {
  version: "1.0",
  canonicalStateId: "mock:canonical-state:fail-closed-qa-r7:2026-10-17T12:00:00.000Z",
  stateHash: "sha256:5f4a9d86f3db73d14a4db8596066e8121e5de710ab4258e5ed8343bd4e9c6d3a",
  inputSnapshotId: "mock:input-snapshot:fail-closed-qa-r7:2026-10-17T12:00:00.000Z",
  generatedAt: "2026-10-17T12:00:01.000Z",
  sourceUpdatedAt: MOCK_OBSERVED_AT,
  freshness: "live",
  cache: { status: "refreshed", ageMs: 1_000, staleReason: null },
  sourceHealth: [
    { id: "seismograph", label: "Canonical Seismograph", status: "healthy", required: true, asOf: MOCK_OBSERVED_AT, detail: "MOCK fixture canonical synthesis bound to the observations below." },
    { id: "historical-memory", label: "Historical Market Memory", status: "healthy", required: true, asOf: MOCK_OBSERVED_AT, detail: "MOCK fixture append-only history reference." },
    { id: "fred", label: "Macro and Credit Evidence", status: "healthy", required: true, asOf: MOCK_OBSERVED_AT, detail: "MOCK:FRED fixture observations; not live provider data." },
    { id: "coingecko", label: "Crypto Market Overlay", status: "unavailable", required: false, asOf: MOCK_OBSERVED_AT, detail: "MOCK fixture has no optional crypto observation." },
  ],
  warnings: ["MOCK FIXTURE ONLY — observations are non-operational."],
  now: {
    pressureScore: 33, regime: "MODERATE RISK", stressLevel: "Elevated", direction: "Stable", historicalPercentile: 83,
    headline: "Mock canonical pressure fixture: 33/100.", topDrivers: ["Market Breadth: 45/100", "Volatility Regime: 40/100", "Macro Sensitivity: 35/100"],
    threats: [], supports: [],
  },
  why: {
    story: "Mock canonical synthesis only.", whyThisScore: "Mock evidence-family vector values only.", whyThisRegime: "Mock canonical regime only.", keyDevelopments: [],
    narrative: { whatIsHappening: "Mock fixture.", whyIsItHappening: "Mock fixture.", whatHasChanged: "Mock fixture.", whatIsBuildingBeneathSurface: "Mock fixture." },
    evidenceFamilies: [
      { name: "Market Breadth", signal: "neutral", strength: 45, trend: "stable", currentValue: "45/100", historicalContext: "MOCK observed vector", whyItMatters: "Mock breadth vector." },
      { name: "Volatility Regime", signal: "neutral", strength: 40, trend: "stable", currentValue: "40/100", historicalContext: "MOCK observed vector", whyItMatters: "Mock volatility vector." },
      { name: "Macro Sensitivity", signal: "bullish", strength: 35, trend: "stable", currentValue: "35/100", historicalContext: "MOCK observed vector", whyItMatters: "Mock macro vector." },
      { name: "Credit Markets", signal: "bullish", strength: 30, trend: "stable", currentValue: "30/100", historicalContext: "MOCK observed vector", whyItMatters: "Mock credit vector." },
      { name: "Liquidity Conditions", signal: "recovering", strength: 17, trend: "stable", currentValue: "17/100", historicalContext: "MOCK observed vector", whyItMatters: "Mock liquidity vector." },
    ],
    evidenceConsensus: "moderate", evidenceAsOfMonth: "2026-10",
  },
  outlook: {
    probabilities: { bull: 64, neutral: 21, bear: 15, confidence: 50, primaryDriver: "Mock Market Breadth", evidenceBasis: "MOCK fixture only", historicalBasis: "MOCK fixture only" },
    regimeProbabilities: { bull: 53, softLanding: 33, stagflation: 8, recession: 4, crash: 2 },
    transitionProbabilities: { remainInRegime: 60, transitionToElevated: 20, transitionToLow: 20, transitionToCrisis: 0, confidence: 41, historicalBasis: "MOCK fixture only", currentEvidence: [] },
    highestProbabilityPath: "MOCK fixture only — no operational forecast.", invalidationConditions: [], topAnalog: null,
  },
  watch: { developingConditions: [], activePatterns: [], whatChanged: [], whatToWatch: [], accelerating: false, buildingPressure: false },
  act: { marketPosture: "balanced", decisionSummary: "MOCK fixture only.", whatWouldInvalidate: "MOCK fixture only.", riskControls: [] },
  history: { observationCount: 6, datasetSpan: "MOCK fixture", currentStreakDescription: "MOCK fixture", lastMajorShift: null, analogSummary: "MOCK fixture only." },
};
const fallback503 = () => selectBrowserMarketOutput({ marketState: null, baselineIndicators: DEFAULT_INDICATORS, simulationOverrides: {} });
const canonical = () => selectBrowserMarketOutput({ marketState, baselineIndicators: DEFAULT_INDICATORS, simulationOverrides: {} });

describe("#2 canonical projection: missing delta renders —, direction from state.now.direction", () => {
  it("overall and domain deltas are marked unavailable (not a real 0)", () => {
    const out = projectCanonicalMarketState(marketState, fallback503().output);
    expect(marketState).toMatchObject({
      canonicalStateId: "mock:canonical-state:fail-closed-qa-r7:2026-10-17T12:00:00.000Z",
      stateHash: "sha256:5f4a9d86f3db73d14a4db8596066e8121e5de710ab4258e5ed8343bd4e9c6d3a",
      inputSnapshotId: "mock:input-snapshot:fail-closed-qa-r7:2026-10-17T12:00:00.000Z",
      sourceUpdatedAt: MOCK_PROVIDER_METADATA.observedAt,
    });
    expect(MOCK_PROVIDER_OBSERVATIONS).toHaveLength(5);
    expect(MOCK_PROVIDER_OBSERVATIONS.every(observation => observation.classification === "MOCK" && observation.observedAt === marketState.sourceUpdatedAt)).toBe(true);
    expect(out.domains.map(domain => domain.source)).toEqual(Array(5).fill("canonical-market-state"));
    expect(out.overall.deltaAvailable).toBe(false);
    expect(availableDelta(out.overall)).toBeNull();
    expect(pointsDeltaText(availableDelta(out.overall))).toBe("—");
    expect(pointsDeltaText(availableDelta(out.overall))).not.toMatch(/\d|NaN/);
    expect(out.overall.direction).toBe(marketState.now.direction);
    for (const d of out.domains) {
      expect(availableDelta(d)).toBeNull();
      expect(pointsDeltaText(availableDelta(d))).toBe("—");
    }
  });
  it("an engine delta that is known still renders pts", () => {
    expect(pointsDeltaText(availableDelta({ delta: 0.3 }))).toBe("+3 pts");
    expect(pointsDeltaText(availableDelta({ delta: Number.NaN }))).toBe("—");
  });
  it("Dashboard reads the delta and direction through the fail-closed path", () => {
    const d = read("client/src/pages/Dashboard.tsx");
    expect(d).toContain("{ label: 'DELTA', value: pointsDeltaText(availableDelta(overall)), color }");
    expect(d).toContain("sub: `Δ ${pointsDeltaText(overallDelta)} vs baseline`");
    expect(d).toContain(": canonicalDirectionView(overall.direction);");
    expect(d).not.toMatch(/overall\.delta > 0\.2/);
    expect(d).not.toMatch(/pointsDeltaText\(overall\.delta\)/);
    expect(read("client/src/components/dashboard/PulseMode.tsx")).toContain('direction === "unavailable" ? "— Unavailable"');
  });
});

describe("#8 seismograph evolution: no NaN and no 'Stable' without a prior reading", () => {
  const months = (n: number) => Array.from({ length: n }, (_, i) => ({
    month: `20${String(10 + Math.floor(i / 12)).padStart(2, "0")}-${String((i % 12) + 1).padStart(2, "0")}`,
    score: 30 + (i % 7), regime: i % 2 ? "Moderate" : "Low",
    liquidity: 40, credit: 40, volatility: 40, macro: 40, breadth: 40,
  })) as any;
  for (const n of [1, 7, 24, 120]) {
    it(`history of ${n} months`, () => {
      const evo = computeEvolution(months(n));
      const text = JSON.stringify(evo);
      expect(text).not.toMatch(/NaN/);
      expect(evo.sevenDayTrend).toBe("Unavailable (insufficient history)");
      expect(evo.sevenDayTrend).not.toMatch(/Stable/);
    });
  }
  it("the legacy seismograph engine does not claim Stable without a prior week either", () => {
    expect(read("server/seismographEngine.ts")).toContain('prior7.length === 0\n    ? "Unavailable (no prior-week reading)"');
  });
});

describe("#7 SmartDiscovery under a canonical 503 shows no 45 and sends nothing", () => {
  it("deterministic-fallback (503) → no pressure, no snapshot", () => {
    const { output, mode } = fallback503();
    expect(mode).toBe("deterministic-fallback");
    // Preserve the Pressure v1 scoring result for these fixed demo inputs, but
    // prove it cannot become an operational financial claim without canonical state.
    expect(output.overall.score).toBe(4.46);
    expect(output.domains.map(domain => [domain.id, domain.score])).toEqual([
      ["treasury-debt", 3.26], ["inflation-fed", 4.45], ["credit-stress", 4.22], ["ai-bubble", 5.66],
      ["liquidity", 5.6], ["recession", 2.13], ["banking", 5.87],
    ]);
    expect(canonicalPressure100(output, mode)).toBeNull();            // …but is never shown
    expect(buildEngineSnapshot(output, mode)).toBeNull();             // …or sent to recordVisit
    expect(output.narrative.summary).toBe("Synthesis unavailable");
    expect(Number.isNaN(output.probability.bullProbability)).toBe(true);
  });
  it("canonical → snapshot without invented ai/vol defaults; liquidity/credit from the canonical families (QA r8)", () => {
    const { output, mode } = canonical();
    const snap = buildEngineSnapshot(output, mode, 1)!;
    expect(snap.overallPressure).toBe(Math.round(output.overall.score * 10));
    // "Liquidity Conditions" strength 17 → (10 − 1.7) × 10; "Credit Markets" 30 → 3.0 × 10.
    expect(snap.liquidity).toBe(83);
    expect(snap.credit).toBe(30);
    expect(snap.aiConcentration).toBeNull();
    expect(snap.volatility).toBeNull();
    expect(EngineSnapshotSchema.parse(snap)).toBeTruthy();
  });
  it("source: snapshot builders and the market snapshot are fail-closed", () => {
    const s = read("client/src/pages/SmartDiscovery.tsx");
    expect(s).not.toMatch(/overallPressure: pressureScore/);
    expect(s).not.toMatch(/Math\.round\(\(10 - liquidityDomain\.score\) \* 10\) : 50/);
    expect(s).not.toMatch(/Math\.round\(creditDomain\.score \* 10\) : 30/);
    expect(s).not.toMatch(/aiConcentration: 32|volatility: 40/);
    expect(s).toContain("recordVisitMutation.mutate({ snapshot });");
    expect(s).toContain("const pressureScore = canonicalPressure100(output, marketMode);");
    expect(s).toContain("{pressureScore ?? '—'}");
  });
  it("server: missing liquidity → no confidence, no invented risk, prompt says Unavailable", () => {
    expect(computeOverallConfidence({ overallPressure: 33, breadth: 67, liquidity: null, bullProbability: 53 })).toBeNull();
    expect(computeOverallConfidence({ overallPressure: 33, breadth: null, liquidity: 50, bullProbability: 53 })).toBeNull();
    expect(computeOverallConfidence({ overallPressure: 33, breadth: 67, liquidity: 50, bullProbability: null })).toBeNull();
    expect(computeOverallConfidence({ overallPressure: 33, breadth: 67, liquidity: 50, bullProbability: 53 })).toBe(61);
    const r = read("server/routers/dailyBrief.ts");
    expect(r).toContain("- Liquidity: ${readingText(engineSnapshot.liquidity)}");
    expect(r).toMatch(/function deriveMarketHealth[\s\S]*?(breadth === null|!Number\.isFinite\(breadth\))[\s\S]*?(liquidity === null|!Number\.isFinite\(liquidity\))[\s\S]*?return "UNAVAILABLE";/);
    expect(r).toMatch(/const engineSnapshot = canonicalBriefEngineSnapshot\(canonical\);/);
    expect(r).not.toMatch(/const engineSnapshot = input\.engineSnapshot/);
  });
});

describe("#3/#4/#5 copy", () => {
  it("Guide has no 0–10 score copy except the Regime Fit entries, and no scenario probability estimate", () => {
    const lines = read("client/src/pages/Guide.tsx").split("\n").filter(l => /0[–-]10(?!\d)/.test(l));
    expect(lines).toHaveLength(2);
    for (const l of lines) expect(l).toMatch(/Regime Fit/);
    expect(read("client/src/pages/Guide.tsx")).not.toMatch(/probability estimate derived from the current regime score/);
  });
  it("Onboarding has no 0–10 copy or 0–10 band thresholds", () => {
    const o = read("client/src/components/Onboarding.tsx");
    expect(o).not.toMatch(/0[–-]10(?!\d)/);
    expect(o).not.toMatch(/3\.0–5\.0|8\.5\+/);
    expect(o).toContain("0–100 scale");
  });
  it("CryptoSignals labels its native 0–10 ratings explicitly", () => {
    const c = read("client/src/pages/CryptoSignals.tsx");
    expect(c).toContain('label: "ASSET VOLUME LIQUIDITY"');
    expect(c).toContain(">REGIME ALIGNMENT:</span>");
    expect(c).not.toContain('"LIQUIDITY SCORE"');
  });
});

describe("#9 C: MobileRotation has no invented 40 score or regime", () => {
  it("source", () => {
    const m = read("client/src/pages/mobile/MobileRotation.tsx");
    expect(m).not.toMatch(/rotation\?\.score \?\? (40|0)/);
    expect(m).not.toContain('?? "BTC DOMINANCE"');
    expect(m).toContain('label: "UNAVAILABLE"');
  });
});
