/**
 * QA final pass (e9d45f9) item: Opportunity Engine showed "PRESSURE: 33"
 * (its cached scoring pressure) beside the canonical 34. Display only: the
 * label shows the canonical Pressure Index or UNAVAILABLE; the scoring input
 * (payload pressureIndex) is unchanged.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { canonicalPressureLabel, canonicalPressureValue } from "../client/src/lib/canonicalPressureDisplay";
import {
  OUTLOOK_CANONICAL_VECTOR_IDS,
  OutlookStateUnavailableError,
  projectCanonicalOutlookState,
  resolveOutlookState,
  type OutlookPressureVectorId,
} from "./signalOutlook";
import type { CanonicalEngineState, CanonicalIntelligenceState } from "../shared/canonicalIntelligenceState";

const read = (p: string) => readFileSync(resolve(process.cwd(), p), "utf8");

/** Explicit fixture-only observations; these are never offered as live provider data. */
type MockProviderObservation = {
  inputId: string;
  provider: "FRED" | "Yahoo Finance";
  sourceKind: "MOCK";
  seriesOrSymbol: string;
  observedAt: string;
  receivedAt: string;
};

const MOCK_OBSERVED_AT = "2026-10-16T20:00:00.000Z";
const MOCK_RECEIVED_AT = "2026-10-16T20:01:00.000Z";
const MOCK_PROVIDER_OBSERVATIONS = {
  "liquidity-stress": { inputId: "mock:fred:WALCL:2026-10-16", provider: "FRED", sourceKind: "MOCK", seriesOrSymbol: "WALCL", observedAt: MOCK_OBSERVED_AT, receivedAt: MOCK_RECEIVED_AT },
  "credit-contagion": { inputId: "mock:fred:BAMLH0A0HYM2:2026-10-16", provider: "FRED", sourceKind: "MOCK", seriesOrSymbol: "BAMLH0A0HYM2", observedAt: MOCK_OBSERVED_AT, receivedAt: MOCK_RECEIVED_AT },
  "volatility-regime": { inputId: "mock:yahoo:^VIX:2026-10-16", provider: "Yahoo Finance", sourceKind: "MOCK", seriesOrSymbol: "^VIX", observedAt: MOCK_OBSERVED_AT, receivedAt: MOCK_RECEIVED_AT },
  "macro-sensitivity": { inputId: "mock:fred:T10Y2Y:2026-10-16", provider: "FRED", sourceKind: "MOCK", seriesOrSymbol: "T10Y2Y", observedAt: MOCK_OBSERVED_AT, receivedAt: MOCK_RECEIVED_AT },
  "market-breadth": { inputId: "mock:yahoo:SPY:2026-10-16", provider: "Yahoo Finance", sourceKind: "MOCK", seriesOrSymbol: "SPY", observedAt: MOCK_OBSERVED_AT, receivedAt: MOCK_RECEIVED_AT },
  "ai-bubble": { inputId: "mock:fred:NASDAQCOM:2026-10-16", provider: "FRED", sourceKind: "MOCK", seriesOrSymbol: "NASDAQCOM", observedAt: MOCK_OBSERVED_AT, receivedAt: MOCK_RECEIVED_AT },
} as const satisfies Record<OutlookPressureVectorId, MockProviderObservation>;

const MOCK_VECTOR_VALUES = {
  "liquidity-stress": 31,
  "credit-contagion": 27,
  "volatility-regime": 42,
  "macro-sensitivity": 38,
  "market-breadth": 46,
  "ai-bubble": 49,
} as const satisfies Record<OutlookPressureVectorId, number>;

const COMPLETE_MOCK_ENGINES: CanonicalEngineState[] = OUTLOOK_CANONICAL_VECTOR_IDS.map(engineId => ({
  engineId,
  engineName: `Mock ${engineId}`,
  value: MOCK_VECTOR_VALUES[engineId],
  unit: "score_0_to_100",
  classification: "fixture-only",
  direction: "Stable",
  acceleration: null,
  persistence: null,
  observedAt: MOCK_PROVIDER_OBSERVATIONS[engineId].observedAt,
  calculatedAt: MOCK_RECEIVED_AT,
  sourceInputIds: [MOCK_PROVIDER_OBSERVATIONS[engineId].inputId],
  qualityStatus: "HEALTHY",
  freshnessStatus: "CURRENT",
  fallbackStatus: "NONE",
  modelVersion: "mock-canonical-model-v1",
  calculationVersion: "faultline-pressure-v1-frozen",
  contributionToComposite: true,
}));

const COMPLETE_MOCK_CANONICAL_STATE: CanonicalIntelligenceState = {
  schemaVersion: "phase2-canonical-state-v1",
  stateId: "mock:canonical-state:opportunity-pressure-display:2026-10-16T20:01:00.000Z",
  generatedAt: MOCK_RECEIVED_AT,
  effectiveAt: MOCK_OBSERVED_AT,
  calculationStartedAt: "2026-10-16T20:00:30.000Z",
  calculationCompletedAt: MOCK_RECEIVED_AT,
  championVersion: "mock-champion-v1",
  modelVersion: "mock-canonical-model-v1",
  scoringVersion: "faultline-pressure-v1-frozen",
  configurationVersion: "mock-governance-v1",
  inputSnapshotId: "mock:input-snapshot:opportunity-pressure-display:2026-10-16T20:01:00.000Z",
  stateHash: "mock:sha256:opportunity-pressure-display:canonical-state",
  regime: "MODERATE RISK",
  pressureIndex: 34,
  pressureLevel: "Moderate",
  pressureDirection: "Stable",
  pressureAcceleration: null,
  pressurePersistence: null,
  engines: COMPLETE_MOCK_ENGINES,
  domains: { fixtureOnlyProviderObservations: MOCK_PROVIDER_OBSERVATIONS },
  scenarioOutputs: {},
  probabilityClaimIds: [],
  analogClaimIds: [],
  historicalContext: {
    canonicalLiveHistory: "fixture only — no live history claim",
    reconstructedResearch: "fixture only — no research claim",
    historicalAnalogOutput: "fixture only — no analog claim",
    patternResolution: "fixture only — no outcome claim",
  },
  dataQualitySummary: { fixtureOnly: true, observationSourceKind: "MOCK" },
  confidenceOrEvidenceQuality: "HEALTHY",
  staleInputs: [],
  delayedInputs: [],
  unavailableInputs: [],
  fallbackInputs: [],
  warnings: [],
  conflicts: [],
  historicalDatasetVersion: "mock-historical-dataset-v1",
  researchDatasetVersion: "mock-research-dataset-v1",
  provenance: {
    manifestSource: "intelligenceStateManifests",
    governanceVersion: "mock-governance-v1",
    coherenceStatus: "COHERENT",
  },
};

describe("Opportunity Engine pressure label", () => {
  it("shows the canonical Pressure Index, or UNAVAILABLE", () => {
    expect(canonicalPressureLabel({ pressureIndex: 34 })).toBe("34");
    expect(canonicalPressureValue({ pressureIndex: 34 })).toBe(34);
    expect(canonicalPressureLabel({ pressureIndex: 34.04 })).toBe("34");
    expect(canonicalPressureLabel({ pressureIndex: 33.75 })).toBe("33.8");
    expect(canonicalPressureLabel({ pressureIndex: null })).toBe("UNAVAILABLE");
    expect(canonicalPressureLabel({ pressureIndex: Number.NaN })).toBe("UNAVAILABLE");
    expect(canonicalPressureLabel(null)).toBe("UNAVAILABLE");
    expect(canonicalPressureValue(undefined)).toBeNull();
  });

  it("the panel and the Opportunities page render the canonical value, not the scoring pressure", () => {
    const panel = read("client/src/components/OpportunityDiscoveryPanel.tsx");
    const page = read("client/src/pages/Opportunities.tsx");
    for (const src of [panel, page]) {
      expect(src).toContain("const { canonicalState } = useEngine();");
      expect(src).toContain("canonicalPressureLabel(canonicalState)");
      expect(src).not.toMatch(/data\.pressureIndex/);
      expect(src).toContain("CONFIDENCE_NOT_ESTABLISHED");
      expect(src).toContain('data-confidence-status="not-established"');
      expect(src).not.toMatch(/(?:invokeLLM|citation)/i);
    }
    expect(panel).toContain("PRESSURE: <span");
    expect(panel).toContain("{displayPressureLabel}</span>");
    expect(page).toContain("PRESSURE {displayPressureLabel} ·");
  });

  it("does not touch the opportunity scoring inputs", () => {
    const outlook = read("server/signalOutlook.ts");
    const stockScoring = outlook.slice(
      outlook.indexOf("function scoreStockFactors"),
      outlook.indexOf("// ── Deterministic Crypto Scoring Engine"),
    );
    const cryptoScoring = outlook.slice(
      outlook.indexOf("function scoreCryptoFactors"),
      outlook.indexOf("// ── Stock-specific analysis"),
    );

    // The canonical-state cache identity is an allowed provenance repair. Assert
    // that it is state-bound, then freeze the actual scoring contracts rather
    // than treating any source-file diff as a scoring-method change.
    expect(outlook).toContain("const cacheKey = `discovery_${resolved.canonicalStateId}`;");
    expect(outlook).toContain("const cacheKey = `top_${resolved.canonicalStateId}`;");
    expect(outlook).toContain("pressureIndex: p,");
    expect(outlook).not.toContain("calculateFaultlinePressure");
    expect(outlook).not.toMatch(/Math\.random\s*\(/);

    expect(stockScoring).toContain("const vectorValues = requireOutlookPressureVectors(pressure);");
    expect(stockScoring).toContain("const trendScore = clamp(100 - p * 0.8);");
    expect(stockScoring).toContain("const technicalBreakoutScore = clamp((trendScore * 0.4 + breadthScore * 0.3 + volatilityScore * 0.3) * tfMultiplier);");
    expect([...stockScoring.matchAll(/weight:\s*([\d.]+)/g)].map(match => Number(match[1]))).toEqual([
      0.12, 0.10, 0.08, 0.08, 0.10, 0.08, 0.08, 0.08, 0.06, 0.06, 0.06, 0.04, 0.04, 0.02,
    ]);
    expect(stockScoring).toContain("factors.reduce((sum, f) => sum + f.score * f.weight, 0)");

    expect(cryptoScoring).toContain("const vectorValues = requireOutlookPressureVectors(pressure);");
    expect(cryptoScoring).toContain("const trendScore = clamp(100 - p * 0.85);");
    expect([...cryptoScoring.matchAll(/weight:\s*([\d.]+)/g)].map(match => Number(match[1]))).toEqual([
      0.20, 0.20, 0.10, 0.15, 0.15, 0.05, 0.10, 0.05,
    ]);
    expect(cryptoScoring).toContain("factors.reduce((sum, f) => sum + f.score * f.weight, 0)");
  });

  it("projects a complete explicit MOCK canonical state without substituting raw facts or identity", async () => {
    expect(COMPLETE_MOCK_CANONICAL_STATE.stateId).toMatch(/^mock:canonical-state:/);
    expect(COMPLETE_MOCK_CANONICAL_STATE.inputSnapshotId).toMatch(/^mock:input-snapshot:/);
    expect(COMPLETE_MOCK_CANONICAL_STATE.stateHash).toMatch(/^mock:sha256:/);
    expect(Object.values(MOCK_PROVIDER_OBSERVATIONS).every(observation => observation.sourceKind === "MOCK")).toBe(true);
    expect(COMPLETE_MOCK_CANONICAL_STATE.engines.map(engine => engine.sourceInputIds[0])).toEqual(
      OUTLOOK_CANONICAL_VECTOR_IDS.map(id => MOCK_PROVIDER_OBSERVATIONS[id].inputId),
    );

    const projected = projectCanonicalOutlookState(COMPLETE_MOCK_CANONICAL_STATE);
    expect(projected).toMatchObject({
      canonicalStateId: COMPLETE_MOCK_CANONICAL_STATE.stateId,
      asOf: COMPLETE_MOCK_CANONICAL_STATE.generatedAt,
      quality: "HEALTHY",
      pressure: {
        overallPressure: 34,
        regime: "MODERATE RISK",
        timestamp: COMPLETE_MOCK_CANONICAL_STATE.generatedAt,
        lastUpdated: COMPLETE_MOCK_CANONICAL_STATE.generatedAt,
        dataSource: "live",
        priorPressure: null,
        analogs: [],
      },
    });
    expect(projected?.pressure.vectors.map(vector => ({
      id: vector.id,
      score: vector.score,
      dataStatus: vector.dataStatus,
      rawInputs: vector.rawInputs,
      observationDates: vector.observationDates,
      source: vector.source,
    }))).toEqual(OUTLOOK_CANONICAL_VECTOR_IDS.map(id => ({
      id,
      score: MOCK_VECTOR_VALUES[id],
      dataStatus: "live",
      rawInputs: {},
      observationDates: {},
      source: `FAULTLINE canonical intelligence state ${COMPLETE_MOCK_CANONICAL_STATE.stateId}`,
    })));
    await expect(resolveOutlookState(COMPLETE_MOCK_CANONICAL_STATE)).resolves.toMatchObject({
      canonicalStateId: COMPLETE_MOCK_CANONICAL_STATE.stateId,
      pressure: { overallPressure: 34 },
    });
  });

  it("withholds the Outlook projection when canonical evidence is missing or unavailable", async () => {
    const missingVectorState: CanonicalIntelligenceState = {
      ...COMPLETE_MOCK_CANONICAL_STATE,
      engines: COMPLETE_MOCK_CANONICAL_STATE.engines.filter(engine => engine.engineId !== "ai-bubble"),
    };
    const unavailableState: CanonicalIntelligenceState = {
      ...COMPLETE_MOCK_CANONICAL_STATE,
      confidenceOrEvidenceQuality: "UNAVAILABLE",
    };

    expect(projectCanonicalOutlookState(missingVectorState)).toBeNull();
    expect(projectCanonicalOutlookState(unavailableState)).toBeNull();
    await expect(resolveOutlookState(null)).rejects.toBeInstanceOf(OutlookStateUnavailableError);
  });
});
