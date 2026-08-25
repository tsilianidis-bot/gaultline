import { describe, expect, it } from "vitest";
import { buildAtomicIntelligenceStateManifest, buildGovernedClaims, buildLiveInputQualityManifest } from "./intelligenceGovernance";

const pressure = {
  overallPressure: 27,
  regime: "MODERATE RISK",
  level: "Moderate",
  timestamp: "2026-08-20T16:00:00.000Z",
  lastUpdated: "2026-08-20T16:00:00.000Z",
  dataSource: "live",
  priorPressure: null,
  alerts: [],
  topAnalog: { year: 2018, label: "Reference", similarity: 54, description: "reference" },
  analogs: [],
  vectors: [
    { id: "liquidity-stress", score: 20, trend: "stable", weight: 0.2, rawInputs: { hySpread: 300, sofr: 5 }, dataStatus: "live", source: "FRED", label: "Liquidity", description: "", level: "Low", driver: "" },
    { id: "credit-contagion", score: 20, trend: "stable", weight: 0.2, rawInputs: { hySpread: 300, tsy10y: 4, unemployment: 4 }, dataStatus: "live", source: "FRED", label: "Credit", description: "", level: "Low", driver: "" },
    { id: "volatility-regime", score: 20, trend: "stable", weight: 0.15, rawInputs: { tsy10y: 4, tsy2y: 4 }, dataStatus: "live", source: "FRED", label: "Volatility", description: "", level: "Low", driver: "" },
    { id: "macro-sensitivity", score: 25, trend: "stable", weight: 0.2, rawInputs: { cpi: 2, ppi: null, fedFunds: 5 }, dataStatus: "delayed", source: "FRED", label: "Macro", description: "", level: "Moderate", driver: "" },
    { id: "market-breadth", score: 25, trend: "stable", weight: 0.1, rawInputs: { unemployment: 4, tsy10y: 4 }, dataStatus: "delayed", source: "FRED", label: "Breadth", description: "", level: "Moderate", driver: "" },
    { id: "ai-bubble", score: 30, trend: "stable", weight: 0.15, rawInputs: { tsy10y: 4, hySpread: 300 }, dataStatus: "static", source: "Static", label: "AI", description: "", level: "Moderate", driver: "" },
  ],
} as any;

const seismograph = {
  version: "seismograph-core-v1",
  computedAt: Date.parse("2026-08-20T16:00:00.000Z"),
  dataFreshness: "live",
  pressureScore: 27,
  regime: "MODERATE RISK",
  stressLevel: "Elevated",
  direction: "Stable",
  probabilities: { bull: 45, neutral: 35, bear: 20, primaryDriver: "mixed", confidence: 55 },
  historicalPercentile: 50,
  analogMatches: [{ label: "Reference period", similarity: 71, description: "reference" }],
  topAnalog: { label: "Reference period", similarity: 71, description: "reference" },
  activePatterns: [{ patternId: "pattern-a", name: "Pattern A", description: "", confidence: 60, daysActive: 1, historicalOutcome: "+10%" }],
  patternsSummary: "",
  transitionProbabilities: { remainInRegime: 70, transitionToElevated: 15, transitionToLow: 10, transitionToCrisis: 5, primaryDriver: "mixed" },
  evidenceFamilies: [], activeContributors: ["pressure"], evidenceConsensus: "moderate", marketMemory: { streakDays: 1, streakDirection: "stable", peakPressureThisCycle: 27, troughPressureThisCycle: 27, daysSinceLastTransition: 0, keyMemoryPoints: [] },
} as any;

describe("Phase 1B intelligence governance", () => {
  it("separates delayed, unavailable, and static input-quality states without manufacturing neutral evidence", () => {
    const entries = buildLiveInputQualityManifest(pressure);
    expect(entries.find(entry => entry.inputId === "producer_price_index_yoy")).toMatchObject({ value: null, freshnessStatus: "UNAVAILABLE", availabilityStatus: "UNAVAILABLE", publicClaimEligible: false });
    expect(entries.find(entry => entry.inputId === "consumer_price_index_yoy")).toMatchObject({ freshnessStatus: "DELAYED", availabilityStatus: "AVAILABLE" });
    expect(entries.find(entry => entry.inputId === "ai_concentration_static_baseline")).toMatchObject({ availabilityStatus: "STATIC_MODEL_INPUT", publicClaimEligible: false, value: 65 });
  });

  it("governs scenario scores and analog similarity with different semantics", () => {
    const claims = buildGovernedClaims(seismograph, "2026-08-20T16:00:00.000Z");
    expect(claims.find(claim => claim.claimId === "seismograph.scenario.bull")).toMatchObject({ claimType: "DERIVED_SCENARIO_SCORE", displayStatus: "SUPPRESS_PREDICTIVE_PRESENTATION", timeHorizon: null });
    expect(claims.find(claim => claim.claimType === "ANALOG_SIMILARITY")).toMatchObject({ displayStatus: "DISPLAY_WITH_QUALIFICATION", evidenceStatus: "UNVERIFIED" });
    expect(claims.find(claim => claim.claimType === "UNSUPPORTED")).toMatchObject({ displayStatus: "SUPPRESS_PREDICTIVE_PRESENTATION" });
  });

  it("creates a deterministic coherent manifest for an identical input snapshot", () => {
    const first = buildAtomicIntelligenceStateManifest({ pressure, seismograph, generatedAt: "2026-08-20T16:00:00.000Z" });
    const second = buildAtomicIntelligenceStateManifest({ pressure, seismograph, generatedAt: "2026-08-20T16:00:00.000Z" });
    expect(first.manifest.coherenceStatus).toBe("COHERENT");
    expect(first.manifest.stateHash).toBe(second.manifest.stateHash);
    expect(first.manifest.inputSnapshotId).toBe(second.manifest.inputSnapshotId);
    expect(first.manifest.probabilityClaimIds).toEqual(expect.arrayContaining(["seismograph.scenario.bull"]));
  });

  it("records a score disagreement as an explicit mismatch rather than silently mixing outputs", () => {
    const mismatched = buildAtomicIntelligenceStateManifest({ pressure, seismograph: { ...seismograph, pressureScore: 31 }, generatedAt: "2026-08-20T16:00:00.000Z" });
    expect(mismatched.manifest.coherenceStatus).toBe("EXPLICIT_MISMATCH");
    expect(mismatched.manifest.coherenceNotes.join(" ")).toContain("pressure-score-mismatch");
  });
});
