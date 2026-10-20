/**
 * Public-output defects from the live candidate capture
 * (f3906f5, state:2026-10-20T20:20:26.444Z:cb327b864a6fcf4e).
 * Display and claim text only. Weights, thresholds, and score formulas stay.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { buildCanonicalIntelligenceState } from "./canonicalIntelligenceState";
import { projectPressureFromCanonical } from "./canonicalPressureProjection";
import { pressureHistoryStatsFromRow } from "./db";
import { historicalPercentileFromScores } from "./seismographEngine";
import { buildStateForAssembly } from "./scheduledSeismograph";
import { assembleSeismographOutput } from "./seismographCore";
import {
  applySeismographDisplayContext,
  dataFreshnessFromDataQuality,
  sanitizePublicEvidenceSummary,
  type CanonicalDataQualityInput,
} from "./seismographDisplayContext";
import { attentionForTrendingQuote } from "./socialIntelligence";
import { canonicalEngineEvidence } from "../shared/snapshotEvidence";
import { fmosToEvidencePackets } from "./seismographAdapters";
import { buildBullEvidence, identifyPrimaryDriver } from "./fmos/engines/probability";
import {
  detectsPressureAcceleration,
  detectsPressureReliefPattern,
  detectsRegimeTransitionPattern,
  patternDetectionPressureScore,
  patternHistoricalOutcome,
} from "./seismographEngine";
import { detectActivePatterns, highScoreTransitionEvidence, type HistoricalMonth } from "./seismographUnified";

const delayedQuality: CanonicalDataQualityInput = {
  generatedAt: "2026-10-20T20:20:26.444Z",
  confidenceOrEvidenceQuality: "PARTIAL",
  delayedInputs: ["ten_year_treasury_yield", "consumer_price_index_yoy", "producer_price_index_yoy", "federal_funds_rate", "unemployment_rate"],
  staleInputs: [],
  unavailableInputs: [],
  fallbackInputs: [],
  engineInputIds: ["hy_credit_spread", "ten_year_treasury_yield"],
};

function assembled(historicalPercentile: number | null = 50) {
  return assembleSeismographOutput({
    pressureScore: 33,
    regime: "MODERATE RISK",
    stressLevel: "Moderate",
    direction: "Stable",
    historicalPercentile,
    analogMatches: [],
    activePatterns: [],
    transitionProbabilities: { remainInRegime: 70, transitionToElevated: 15, transitionToLow: 10, transitionToCrisis: 5, primaryDriver: "test" },
    marketMemory: { streakDays: 0, streakDirection: "stable", peakPressureThisCycle: 33, troughPressureThisCycle: 33, daysSinceLastTransition: 0, keyMemoryPoints: [] },
  }, [
    { source: "fmos-historical-analogs", evidenceType: "historical_analog", signal: "neutral", strength: 91, confidence: 80, humanReadable: "Closest historical analog: Fed Pivot Rally (91% similarity)", primaryReading: "topAnalog=Fed Pivot Rally similarity=91", timestamp: 1 } as any,
    { source: "fmos-transition", evidenceType: "transition_signal", signal: "neutral", strength: 0, confidence: 75, humanReadable: "0% probability of regime transition (stable)", primaryReading: "transitionProbability=0", timestamp: 1 } as any,
    { source: "fmos-probability", evidenceType: "probability_distribution", signal: "neutral", strength: 40, confidence: 70, humanReadable: "Scenario weights uncalibrated (not offered as probabilities) — Low systemic pressure at 33/100 — conditions broadly supportive", primaryReading: "p", timestamp: 1 } as any,
  ]);
}

describe("live-capture public output", () => {
  it("does not call five delayed inputs recent", () => {
    expect(dataFreshnessFromDataQuality(delayedQuality).freshness).toBe("delayed");
    const shown = applySeismographDisplayContext(assembled(), {
      dataQuality: delayedQuality,
      canonicalTopAnalogAvailable: false,
      canonicalHistoricalPercentile: null,
    });
    expect(shown.dataFreshness).toBe("delayed");
  });

  it("withholds a stored 50th percentile when the canonical percentile is null", () => {
    const shown = applySeismographDisplayContext(assembled(50), {
      dataQuality: delayedQuality,
      canonicalTopAnalogAvailable: false,
      canonicalHistoricalPercentile: null,
    });
    expect(shown.historicalPercentile).toBeNull();
    expect(shown.forASHA.systemPromptBlock).toContain("Percentile: Insufficient data");
    expect(shown.forASHA.systemPromptBlock).not.toMatch(/50th|typical/);
    expect(shown.forStockPages.historicalContext).toContain("insufficient data");
    expect(shown.forStockPages.historicalContext).not.toMatch(/50th/);
  });

  it("keeps a percentile that matches the canonical reading", () => {
    const shown = applySeismographDisplayContext(assembled(83), {
      dataQuality: delayedQuality,
      canonicalTopAnalogAvailable: true,
      canonicalHistoricalPercentile: 83,
    });
    expect(shown.historicalPercentile).toBe(83);
    expect(shown.forASHA.systemPromptBlock).toContain("83rd");
  });

  it("does not claim an analog or a transition probability when analogs are empty and transitions are uncalibrated", () => {
    const shown = applySeismographDisplayContext(assembled(), {
      dataQuality: delayedQuality,
      canonicalTopAnalogAvailable: false,
      canonicalHistoricalPercentile: null,
    });
    const summaries = shown.evidenceFamilies.map(family => family.summary).join(" ");
    expect(shown.analogMatches).toEqual([]);
    expect(summaries).not.toContain("Fed Pivot Rally");
    expect(summaries).toContain("Closest historical analog unavailable.");
    expect(summaries).not.toMatch(/%\s*probability of regime transition/);
    expect(summaries).toContain("Regime-transition probability is uncalibrated and is not stated");
    expect(JSON.stringify(shown.forASHA)).not.toContain("Fed Pivot");
    expect(shown.forDailyBrief.evidenceSummary).toContain("Regime Transition: neutral (probability not stated)");
    expect(shown.forDailyBrief.evidenceSummary).not.toMatch(/probability of regime transition/);
  });

  it("does not call a moderate regime low or broadly supportive", () => {
    const summary = sanitizePublicEvidenceSummary(
      "Scenario weights uncalibrated (not offered as probabilities) — Low systemic pressure at 33/100 — conditions broadly supportive",
      { analogsAvailable: false, regime: "MODERATE RISK" },
    );
    expect(summary).not.toMatch(/low systemic pressure|broadly supportive/i);
    expect(summary).toContain("Moderate systemic pressure at 33/100");
    const driver = identifyPrimaryDriver(
      { overallPressure: 33, vectors: [{ id: "credit-contagion", score: 30, label: "Credit", trend: "stable" }] } as any,
      { families: [], bullishFamilies: 0, bearishFamilies: 0, diversityScore: 0 } as any,
    );
    expect(driver).toBe("Moderate systemic pressure at 33/100 — Credit is the primary contributor");
    const low = identifyPrimaryDriver(
      { overallPressure: 12, vectors: [{ id: "credit-contagion", score: 10, label: "Credit", trend: "stable" }] } as any,
      { families: [], bullishFamilies: 0, bearishFamilies: 0, diversityScore: 0 } as any,
    );
    expect(low).toBe("Low systemic pressure at 12/100 — conditions broadly supportive");
  });

  it("does not emit a transition probability percent from the FMOS adapter", () => {
    const packets = fmosToEvidencePackets({
      regime: { currentRegime: "MODERATE", pressureLevel: "Moderate", confidence: 10, description: "d" },
      probability: { bull: 40, neutral: 40, bear: 20, confidence: 10, primaryDriver: "Credit" },
      analogs: [{ label: "Fed Pivot Rally", similarity: 91, year: 2019, outcome: "o" }],
      transition: { transitionProbability: 82, transitionDirection: "elevated", estimatedTimeToTransition: "unknown" },
      confidence: { score: 10 },
    } as any);
    const transition = packets.find(packet => packet.evidenceType === "transition_signal")!;
    const text = packets.map(packet => packet.humanReadable).join(" ");
    expect(text).not.toMatch(/%\s*probability of regime transition/);
    expect(text).toContain("Closest historical analog: Fed Pivot Rally (91% similarity)");
    expect(transition.humanReadable).toBe("Regime-transition probability is uncalibrated and is not stated.");
    expect(transition.strength).toBe(0);
    expect(transition.metadata?.transitionProbability).toBe("uncalibrated");
    expect(transition.primaryReading).toBe("direction=elevated");
    expect(`${transition.strength} ${transition.primaryReading} ${transition.humanReadable} ${JSON.stringify(transition.metadata)}`).not.toMatch(/82|%/);
    expect(highScoreTransitionEvidence(70)).toBe("Score above 70 — regime-transition probability is uncalibrated and is not stated.");
    expect(highScoreTransitionEvidence(70)).not.toMatch(/\d+%/);
    expect(highScoreTransitionEvidence(69)).toBeNull();
  });

  it("uses the low-risk band for bull evidence and withholds a missing pattern score", () => {
    const emptyEvidence = { families: [], bullishFamilies: 0, bearishFamilies: 0, diversityScore: 0 } as any;
    const atFloor = buildBullEvidence({ overallPressure: 0, vectors: [] } as any, emptyEvidence);
    const low = buildBullEvidence({ overallPressure: 24, vectors: [] } as any, emptyEvidence);
    const moderate = buildBullEvidence({ overallPressure: 33, vectors: [] } as any, emptyEvidence);
    expect(atFloor.join(" ")).toContain("Low systemic pressure (0/100)");
    expect(low.join(" ")).toContain("Low systemic pressure (24/100)");
    expect(moderate.join(" ")).not.toMatch(/low systemic pressure/i);
    expect(patternDetectionPressureScore(0)).toBe(0);
    expect(patternDetectionPressureScore(undefined)).toBeNull();
    expect(patternDetectionPressureScore(null)).toBeNull();
    expect(patternDetectionPressureScore(Number.NaN)).toBeNull();
    const missingScore = [
      { pressureScore: null, regime: "HIGH STRESS" },
      { pressureScore: 80, regime: "MODERATE RISK" },
      { pressureScore: 78, regime: "MODERATE RISK" },
      { pressureScore: 76, regime: "ELEVATED RISK" },
      { pressureScore: 74, regime: "ELEVATED RISK" },
    ];
    expect(detectsPressureReliefPattern(missingScore)).toBe(false);
    expect(detectsRegimeTransitionPattern(missingScore)).toBe(false);
    expect(detectsPressureReliefPattern([
      { pressureScore: 0 },
      { pressureScore: 80 },
      { pressureScore: 80 },
      { pressureScore: 78 },
      { pressureScore: 70 },
    ])).toBe(true);
    expect(detectsRegimeTransitionPattern([
      { pressureScore: 70, regime: "HIGH STRESS" },
      { pressureScore: 40, regime: "MODERATE RISK" },
      { pressureScore: 20, regime: "LOW RISK" },
    ])).toBe(true);
    const emptyDefault = { bullishContinuation: 40, sideways: 35, correction: 25, sampleSize: 0 };
    expect(patternHistoricalOutcome(emptyDefault)).toBeUndefined();
    const uncalibrated = patternHistoricalOutcome({ sampleSize: 4, calibrated: false });
    expect(uncalibrated).toBe("Historical outcome distribution is uncalibrated and is not stated.");
    expect(uncalibrated).not.toMatch(/\d+%/);
    expect(`${emptyDefault.bullishContinuation}% bullish / ${emptyDefault.correction}% correction`).not.toBe(uncalibrated);
    const assembledPatterns = buildStateForAssembly(
      { overallPressure: 33, regime: "MODERATE RISK", level: "Moderate", vectors: [], analogs: [] } as any,
      null,
      { activePatterns: [{ patternType: "pressure_relief", patternName: "Pressure Relief Pattern", description: "d", confidence: 1, frequency: "typical", historicalCount: 0, analogs: [], outcomeDistribution: emptyDefault, invalidationConditions: "" }] } as any,
    );
    expect(assembledPatterns.activePatterns[0]?.historicalOutcome).toBeUndefined();
    expect(JSON.stringify(assembledPatterns.activePatterns)).not.toContain("40% bullish");
  });

  it("does not count a missing score as 0 in the acceleration average", () => {
    const scores = (values: Array<number | null>) => values.map(pressureScore => ({ pressureScore }));
    expect(detectsPressureAcceleration(scores([
      20, 20, 20, 20, 20,
      15, 15, 15, 15, null,
    ]))).toBe(false);
    expect(detectsPressureAcceleration(scores([
      20, 20, 20, 20, 20,
      15, 15, 15, 15, 0,
    ]))).toBe(true);
    expect(detectsPressureAcceleration(scores([
      30, 30, 30, 30, null,
      20, 20, 20, 20, 20,
    ]))).toBe(true);
  });

  it("drops numeric outcome splits from the monthly unified pattern payload", () => {
    const history: HistoricalMonth[] = Array.from({ length: 12 }, (_, index) => ({
      month: `2025-${String(index + 1).padStart(2, "0")}`,
      score: 60,
      regime: "ELEVATED RISK",
      liquidity: 30,
      credit: 60,
      volatility: 40,
      macro: 44,
      breadth: 40,
      aiBubble: 40,
      baaSpread: null,
      hySpread: null,
      tsy10y: null,
      tsy2y: null,
      fedfunds: null,
      cpiYoy: null,
      unemployment: null,
      sp500: null,
    }));
    const patterns = detectActivePatterns(history, 60, "ELEVATED RISK");
    expect(patterns.map(pattern => pattern.name)).toEqual([
      "Sustained Elevated Pressure",
      "Credit-Liquidity Divergence",
      "Regime Persistence",
    ]);
    for (const pattern of patterns) {
      expect(pattern.outcomeDistribution).toEqual({ calibrated: false });
      expect(JSON.stringify(pattern.outcomeDistribution)).not.toMatch(/\d/);
      expect(pattern.outcomeDistribution).not.toHaveProperty("bullish");
      expect(pattern.outcomeDistribution).not.toHaveProperty("sideways");
      expect(pattern.outcomeDistribution).not.toHaveProperty("correction");
    }
  });

  it("does not substitute 50 when history or today's percentile is missing", () => {
    expect(historicalPercentileFromScores(33, [])).toBeNull();
    expect(historicalPercentileFromScores(33, [10, 20, 40])).toBe(Math.round(2 / 3 * 100));
    const state = buildStateForAssembly(
      { overallPressure: 33, regime: "MODERATE RISK", level: "Moderate", vectors: [], analogs: [] } as any,
      null,
      null,
    );
    expect(state.historicalPercentile).toBeNull();
  });

  it("copies an input observation time onto the vector and labels a static-only AI vector static", () => {
    const state = buildCanonicalIntelligenceState({
      stateId: "state:obs",
      generatedAt: "2026-10-20T20:20:26.444Z",
      championVersion: "champion-v1-frozen",
      modelVersion: "2.0",
      scoringVersion: "faultline-pressure-v1-frozen",
      configurationVersion: "c",
      inputSnapshotId: "i",
      stateHash: "h",
      pressureIndex: 33,
      regime: "MODERATE RISK",
      engineValues: { "liquidity-stress": 16, "ai-bubble": 60 },
      engineDirections: { "liquidity-stress": "stable", "ai-bubble": "rising" },
      domainValues: {},
      scenarioOutputs: {},
      probabilityClaimIds: [],
      analogClaimIds: [],
      historicalDatasetVersion: "h",
      researchDatasetVersion: "r",
      coherenceStatus: "COHERENT",
      coherenceNotes: [],
      dataQualitySummary: {},
      staleInputs: [],
      unavailableInputs: [],
      fallbackInputs: [],
      inputQuality: [
        { inputId: "hy_credit_spread", freshnessStatus: "LIVE", contributesTo: ["liquidity-stress"], observedAt: "2026-10-17T00:00:00.000Z" },
        { inputId: "secured_overnight_financing_rate", freshnessStatus: "LIVE", contributesTo: ["liquidity-stress"], observedAt: "2026-10-16T00:00:00.000Z" },
        { inputId: "ten_year_treasury_yield", freshnessStatus: "DELAYED", contributesTo: ["volatility-regime"], observedAt: "2026-10-14T00:00:00.000Z" },
        { inputId: "ai_concentration_static_baseline", freshnessStatus: "LIVE", contributesTo: ["ai-bubble"], observedAt: null, availabilityStatus: "STATIC_MODEL_INPUT" },
      ],
    });
    const liquidity = state.engines.find(engine => engine.engineId === "liquidity-stress");
    const ai = state.engines.find(engine => engine.engineId === "ai-bubble");
    expect(liquidity?.observedAt).toBe("2026-10-16T00:00:00.000Z");
    expect(ai?.observedAt).toBe("2026-10-14T00:00:00.000Z");
    expect(ai?.sourceInputIds).toEqual(["ai_concentration_static_baseline"]);
    expect(ai?.freshnessStatus).toBe("STATIC");
    expect(canonicalEngineEvidence({ sourceInputIds: ["ai_concentration_static_baseline"], freshnessStatus: "CURRENT" }, state)).toBe("STATIC");
    const projected = projectPressureFromCanonical(state);
    expect(projected?.vectors.find(vector => vector.id === "ai-bubble")?.dataStatus).toBe("static");
    expect(projected?.vectors.find(vector => vector.id === "ai-bubble")?.observedAt).toBe("2026-10-14T00:00:00.000Z");
    expect(projected?.vectors.find(vector => vector.id === "liquidity-stress")?.dataStatus).toBe("live");
    expect(projected?.vectors.find(vector => vector.id === "liquidity-stress")?.observedAt).toBe("2026-10-16T00:00:00.000Z");
  });

  it("returns null pressure stats when there are no months, and null buzz when price and news are missing", () => {
    expect(pressureHistoryStatsFromRow({ totalMonths: 0, avgPressure: null, maxPressure: null, minPressure: null })).toMatchObject({
      totalMonths: 0, avgPressure: null, maxPressure: null, minPressure: null,
    });
    expect(pressureHistoryStatsFromRow({ totalMonths: 3, avgPressure: 41.2, maxPressure: 80, minPressure: 12 })).toMatchObject({
      avgPressure: 41, maxPressure: 80, minPressure: 12,
    });
    expect(attentionForTrendingQuote({ price: null, articleCount: 0, bullish: 0, bearish: 0 })).toEqual({
      newsCount: null, buzzScore: null, sentiment: "unknown",
    });
    expect(attentionForTrendingQuote({ price: 10, articleCount: 0, bullish: 0, bearish: 0 })).toMatchObject({
      newsCount: 0, buzzScore: 0,
    });
  });

  it("serves /api/rss as the feed, not the SPA shell", () => {
    const index = readFileSync(resolve(import.meta.dirname, "_core/index.ts"), "utf8");
    expect(index).toContain('app.get("/api/rss", handleRssFeed)');
    expect(index).toContain('app.get("/api/rss.xml", handleRssFeed)');
  });
});
