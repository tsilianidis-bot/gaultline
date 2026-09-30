/**
 * Post-release consistency (Sep 30): one definition of fallback / stale / delayed,
 * direction derived from the composite index, band from engine thresholds, and an
 * /app header strip with no hard-coded placeholder values.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import type { PublicCanonicalIntelligenceState } from "../shared/canonicalIntelligenceState";
import {
  canonicalEngineEvidence,
  compositePressureDirection,
  directionDisplay,
  engineEvidenceStatus,
  snapshotEvidenceCounts,
  stressTrendDirection,
} from "../shared/snapshotEvidence";
import { customerIntegrityFromCanonical, customerIntegrityLabel, CUSTOMER_INTEGRITY_LABELS } from "../shared/customerIntegrityLabels";
import { buildCanonicalIntelligenceState, selectPriorPressureIndex, toPublicCanonicalIntelligenceState } from "./canonicalIntelligenceState";
import { selectPressureSnapshot } from "../client/src/lib/pressureSnapshot";
import { INTEGRITY_COPY, landingFromSnapshot } from "../client/src/components/landing/landingPressure";
import { buildWorkedExample } from "../client/src/components/landing/thesis/workedExample";
import { canonicalStoryLead, projectCanonicalNow } from "../client/src/lib/canonicalNowProjection";
import { buildAppHeaderStrip, cpiYoY, fredObservationState } from "../client/src/lib/appHeaderStrip";

const source = (path: string) => readFileSync(resolve(import.meta.dirname, "..", path), "utf8");

const DELAYED_INPUTS = ["ten_year_treasury_yield", "consumer_price_index_yoy", "producer_price_index_yoy", "federal_funds_rate", "unemployment_rate"];

/** Shape of the live canonical state on Sep 30 (d9f57b7): 0 stale, 5 delayed, 0 fallback, quality PARTIAL. */
function liveShapedState(overrides: Partial<PublicCanonicalIntelligenceState> = {}): PublicCanonicalIntelligenceState {
  const engine = (engineId: string, value: number, sourceInputIds: string[], freshnessStatus: string) => ({
    engineId, engineName: engineId, value, unit: "score_0_to_100", classification: null, direction: "Stable" as const, acceleration: null, persistence: null,
    observedAt: null, calculatedAt: "2026-09-30T18:01:14.845Z", sourceInputIds, qualityStatus: "PARTIAL" as const, freshnessStatus,
    fallbackStatus: "NONE", modelVersion: "champion-v1-frozen", calculationVersion: "faultline-pressure-v1-frozen", contributionToComposite: true,
  });
  return {
    schemaVersion: "phase2-canonical-state-v1", stateId: "state:qa-fixture", generatedAt: "2026-09-30T18:01:14.845Z", effectiveAt: "2026-09-30T18:01:14.845Z",
    calculationStartedAt: null, calculationCompletedAt: "2026-09-30T18:01:14.845Z", championVersion: "champion-v1-frozen", modelVersion: "2.0",
    scoringVersion: "faultline-pressure-v1-frozen", configurationVersion: "phase1b-governance-v1", inputSnapshotId: "input:qa", stateHash: "qa",
    regime: "MODERATE RISK", pressureIndex: 33, pressureLevel: "MODERATE RISK", pressureDirection: "Stable", pressureAcceleration: null, pressurePersistence: null,
    engines: [
      engine("liquidity-stress", 16, ["hy_credit_spread", "secured_overnight_financing_rate"], "PARTIAL"),
      engine("credit-contagion", 30, ["hy_credit_spread", "ten_year_treasury_yield", "unemployment_rate"], "STALE"),
      engine("volatility-regime", 35, ["ten_year_treasury_yield", "two_year_treasury_yield"], "STALE"),
      engine("macro-sensitivity", 40, ["consumer_price_index_yoy", "producer_price_index_yoy", "federal_funds_rate"], "STALE"),
      engine("market-breadth", 28, ["ten_year_treasury_yield", "unemployment_rate"], "STALE"),
      engine("ai-bubble", 60, ["ai_concentration_static_baseline"], "PARTIAL"),
    ],
    scenarioOutputs: {}, probabilityClaimIds: [], analogClaimIds: [],
    historicalContext: { canonicalLiveHistory: "", reconstructedResearch: "", historicalAnalogOutput: "", patternResolution: "" },
    dataQualitySummary: { status: "PARTIAL", staleInputCount: 0, delayedInputCount: 5, unavailableInputCount: 0, fallbackInputCount: 0 },
    confidenceOrEvidenceQuality: "PARTIAL", staleInputs: [], delayedInputs: DELAYED_INPUTS, unavailableInputs: [], fallbackInputs: [],
    warnings: [], conflicts: [], historicalDatasetVersion: "h", researchDatasetVersion: "r",
    provenance: { manifestSource: "intelligenceStateManifests", governanceVersion: "g", coherenceStatus: "COHERENT" },
    ...overrides,
  };
}

const manifest = {
  stateId: "state:m", generatedAt: "2026-09-30T18:01:14.845Z", championVersion: "champion-v1-frozen", modelVersion: "2.0", scoringVersion: "faultline-pressure-v1-frozen",
  configurationVersion: "c", inputSnapshotId: "i", stateHash: "h", pressureIndex: 33, regime: "MODERATE RISK",
  engineValues: { "liquidity-stress": 16, "macro-sensitivity": 40, "ai-bubble": 60 },
  engineDirections: { "liquidity-stress": "rising", "macro-sensitivity": "falling", "ai-bubble": "rising" },
  domainValues: {}, scenarioOutputs: {}, probabilityClaimIds: [], analogClaimIds: [], historicalDatasetVersion: "h", researchDatasetVersion: "r",
  coherenceStatus: "COHERENT", coherenceNotes: [],
  dataQualitySummary: { totalInputs: 3, delayedInputs: 1, staleInputs: [], unavailableInputs: [], fallbackInputs: [], staticInputs: [] },
  staleInputs: [], unavailableInputs: [], fallbackInputs: [],
  inputQuality: [
    { inputId: "hy_credit_spread", freshnessStatus: "LIVE", contributesTo: ["liquidity-stress"] },
    { inputId: "consumer_price_index_yoy", freshnessStatus: "DELAYED", contributesTo: ["macro-sensitivity"] },
    { inputId: "ai_concentration_static_baseline", freshnessStatus: "LIVE", contributesTo: ["ai-bubble"] },
  ],
};

describe("one definition of fallback / stale / delayed (shared/snapshotEvidence.ts)", () => {
  it("counts from the snapshot lists, falling back to summary counts", () => {
    expect(snapshotEvidenceCounts(liveShapedState())).toEqual({ stale: 0, delayed: 5, fallback: 0, unavailable: 0 });
    expect(snapshotEvidenceCounts({ dataQualitySummary: { staleInputCount: 2, delayedInputCount: 1, fallbackInputCount: 3, unavailableInputCount: 0 } }))
      .toEqual({ stale: 2, delayed: 1, fallback: 3, unavailable: 0 });
  });

  it("engine status priority is unavailable > stale > fallback > delayed > current", () => {
    const lists = { unavailable: ["u"], stale: ["s"], fallback: ["f"], delayed: ["d"] };
    expect(engineEvidenceStatus(["d", "f", "s", "u"], lists)).toBe("UNAVAILABLE");
    expect(engineEvidenceStatus(["d", "f", "s"], lists)).toBe("STALE");
    expect(engineEvidenceStatus(["d", "f"], lists)).toBe("FALLBACK");
    expect(engineEvidenceStatus(["d"], lists)).toBe("DELAYED");
    expect(engineEvidenceStatus(["x"], lists)).toBe("CURRENT");
  });

  it("re-derives old payloads that reported delayed inputs as STALE: 4 vectors DELAYED, none STALE", () => {
    const state = liveShapedState();
    const statuses = state.engines.map(engine => [engine.engineId, canonicalEngineEvidence(engine, state)]);
    expect(Object.fromEntries(statuses)).toEqual({
      "liquidity-stress": "CURRENT", "credit-contagion": "DELAYED", "volatility-regime": "DELAYED",
      "macro-sensitivity": "DELAYED", "market-breadth": "DELAYED", "ai-bubble": "CURRENT",
    });
  });

  it("landing badge, worked example and /app integrity agree: DELAYED, not FALLBACK, with 0 on fallback", () => {
    const state = liveShapedState();
    const view = selectPressureSnapshot({ data: state, isLoading: false });
    const landing = landingFromSnapshot(view);
    const example = buildWorkedExample(view, { status: "unavailable" }, { status: "unavailable" });
    expect(landing.status === "available" && landing.integrity).toBe("DELAYED");
    expect(example.source?.integrity).toBe("DELAYED");
    expect(example.why).toMatchObject({ staleInputs: 0, delayedInputs: 5, fallbackInputs: 0 });
    expect(customerIntegrityFromCanonical(state)).toBe("DELAYED");
    expect(INTEGRITY_COPY.DELAYED).toMatch(/publication lag/);
    expect(INTEGRITY_COPY.DELAYED).not.toMatch(/on a governed fallback/i);
    expect(CUSTOMER_INTEGRITY_LABELS).toContain("DELAYED");
  });

  it("FALLBACK and STALE only when an input actually is on fallback / stale", () => {
    expect(customerIntegrityFromCanonical(liveShapedState({ fallbackInputs: ["hy_credit_spread"], confidenceOrEvidenceQuality: "DEGRADED" }))).toBe("FALLBACK");
    expect(customerIntegrityFromCanonical(liveShapedState({ staleInputs: ["hy_credit_spread"] }))).toBe("STALE");
    expect(customerIntegrityLabel({ hasState: true, freshness: "live", quality: "HEALTHY", fredStatus: "healthy" })).toBe("LIVE");
  });
});

describe("direction: rising stress = Deteriorating; overall from the composite index", () => {
  it("maps engine stress trends the right way round", () => {
    expect(stressTrendDirection("rising")).toBe("Deteriorating");
    expect(stressTrendDirection("falling")).toBe("Improving");
    expect(stressTrendDirection("stable")).toBe("Stable");
    expect(stressTrendDirection(undefined)).toBe("Unknown");
    const state = buildCanonicalIntelligenceState(manifest);
    const byId = Object.fromEntries(state.engines.map(engine => [engine.engineId, engine.direction]));
    expect(byId["liquidity-stress"]).toBe("Deteriorating");
    expect(byId["macro-sensitivity"]).toBe("Improving");
    // ai-bubble's engine trend is a hard-coded constant, so no truthful direction exists.
    expect(byId["ai-bubble"]).toBe("Unknown");
  });

  it("derives overall direction from the composite index vs the prior reading, not the liquidity vector", () => {
    expect(buildCanonicalIntelligenceState(manifest).pressureDirection).toBe("Unknown");
    expect(buildCanonicalIntelligenceState(manifest, { priorPressureIndex: 33 }).pressureDirection).toBe("Stable");
    expect(buildCanonicalIntelligenceState(manifest, { priorPressureIndex: 31 }).pressureDirection).toBe("Stable");
    expect(buildCanonicalIntelligenceState(manifest, { priorPressureIndex: 30 }).pressureDirection).toBe("Deteriorating");
    expect(buildCanonicalIntelligenceState(manifest, { priorPressureIndex: 36 }).pressureDirection).toBe("Improving");
    expect(compositePressureDirection(33, null)).toBe("Unknown");
    expect(compositePressureDirection(Number.NaN, 30)).toBe("Unknown");
    expect(directionDisplay("Unknown")).toBe("Unavailable");
  });

  it("only compares against a prior manifest on the same scoring version", () => {
    expect(selectPriorPressureIndex(manifest, { ...manifest, pressureIndex: 29 })).toBe(29);
    expect(selectPriorPressureIndex(manifest, { ...manifest, scoringVersion: "other", pressureIndex: 29 })).toBeNull();
    expect(selectPriorPressureIndex(manifest, null)).toBeNull();
    const repo = source("server/canonicalIntelligenceState.ts");
    expect(repo).not.toContain('direction(manifest.engineDirections?.["liquidity-stress"])');
  });

  it("emits DELAYED engine freshness for publication-lag inputs (not STALE) and keeps scores untouched", () => {
    const state = buildCanonicalIntelligenceState(manifest, { priorPressureIndex: 33 });
    const macro = state.engines.find(engine => engine.engineId === "macro-sensitivity")!;
    const liquidity = state.engines.find(engine => engine.engineId === "liquidity-stress")!;
    expect(macro.freshnessStatus).toBe("DELAYED");
    expect(liquidity.freshnessStatus).toBe("CURRENT");
    expect(state.pressureIndex).toBe(33);
    expect(state.engines.map(engine => engine.value)).toEqual([16, 40, 60]);
    expect(toPublicCanonicalIntelligenceState(state).dataQualitySummary).toMatchObject({ delayedInputCount: 1, staleInputCount: 0, fallbackInputCount: 0 });
  });
});

describe("/app now: band from engine thresholds, one direction", () => {
  it("pairs the canonical regime with the engine band level, never 'Elevated' at 33", () => {
    const now = projectCanonicalNow({ pressureIndex: 33, regime: "MODERATE RISK", pressureDirection: "Stable" }, { stressLevel: "Elevated", headline: "Elevated stress in a MODERATE RISK regime; pressure is deteriorating.", regime: "MODERATE RISK" });
    expect(now.stressLevel).toBe("Moderate");
    expect(now.direction).toBe("Stable");
    expect(now.headline).toBe("Moderate pressure in a MODERATE RISK regime; composite pressure is stable versus the prior reading.");
    expect(now.headline).not.toMatch(/deteriorat|Elevated/);
  });

  it("shows direction as unavailable when it cannot be derived", () => {
    const now = projectCanonicalNow({ pressureIndex: 33, regime: "MODERATE RISK", pressureDirection: "Unknown" }, { stressLevel: "Elevated", headline: "x", regime: "MODERATE RISK" });
    expect(now.direction).toBe("Unavailable");
    expect(now.headline).toContain("direction is unavailable");
  });

  it("replaces the seismograph story lead so it cannot contradict the canonical direction", () => {
    const story = "FAULTLINE's Seismograph is reading 33/100 — moderate conditions — and conditions are deteriorating. The market is in a Moderate Risk regime.";
    const lead = canonicalStoryLead(story, { pressureIndex: 33, pressureDirection: "Stable" });
    expect(lead).toBe("FAULTLINE's Pressure Index is reading 33/100 — moderate band (25–44) — composite pressure is stable versus the prior reading. The market is in a Moderate Risk regime.");
    expect(lead).not.toContain("deteriorating");
  });

  it("EngineContext projects stress level, direction, headline and story from the canonical snapshot", () => {
    const ctx = source("client/src/contexts/EngineContext.tsx");
    expect(ctx).toContain("projectCanonicalNow(canonicalState, legacy.now)");
    expect(ctx).toContain("stressLevel: now.stressLevel");
    expect(ctx).toContain("direction: now.direction");
    expect(ctx).toContain("canonicalStoryLead(legacy.why.story, canonicalState)");
    expect(ctx).not.toContain("canonicalState.pressureDirection === 'Unknown' ? legacy.now.direction");
  });
});

describe("/app header strip has no hard-coded placeholder values", () => {
  const NOW = Date.parse("2026-09-30T22:50:00Z");
  const quote = (symbol: string, shortLabel: string, price: number | null, extra: Record<string, unknown> = {}) => ({
    symbol, shortLabel, price, changePercent: null, freshnessState: "DELAYED", sessionStatus: "CLOSED", unit: undefined, proxySymbol: null, ...extra,
  }) as never;
  const quotes = [
    quote("^VIX", "VIX", 16.34),
    quote("FRED:DGS10", "10Y", 5.26, { unit: "percent", freshnessState: "LATEST_VERIFIED" }),
    quote("DERIVED:2Y10Y", "2Y10Y", 37, { unit: "bps", freshnessState: "LATEST_VERIFIED" }),
    quote("CG:BTC_DOM", "BTC DOM", 58.3011, { unit: "percent_of_market", freshnessState: "LATEST_VERIFIED", sessionStatus: "OPEN" }),
  ];
  const cpi = Array.from({ length: 13 }, (_, i) => {
    const month = new Date(Date.UTC(2026, 7 - i, 1)).toISOString().slice(0, 10);
    return { date: month, value: i === 0 ? "334.131" : i === 12 ? "324.000" : "330.000" };
  });
  const fred = {
    BAMLH0A0HYM2: [{ date: "2026-09-29", value: "3.08" }, { date: "2026-09-28", value: "3.02" }],
    DTWEXBGS: [{ date: "2026-09-25", value: "120.33" }, { date: "2026-09-24", value: "120.5521" }],
    FEDFUNDS: [{ date: "2026-08-01", value: "3.63" }, { date: "2026-07-01", value: "3.63" }],
    CPIAUCSL: cpi,
  };

  it("shows real values with the landing ticker's tags and a truthful dollar-index label", () => {
    const items = buildAppHeaderStrip({ canonical: liveShapedState(), integrity: "DELAYED", quotes, fred, now: NOW });
    const byLabel = Object.fromEntries(items.map(item => [item.label, item]));
    expect(byLabel["VIX"]).toMatchObject({ value: "16.34", stateLabel: "LAST CLOSE" });
    expect(byLabel["10Y Treasury"]).toMatchObject({ value: "5.26%", stateLabel: "LAST CLOSE" });
    expect(byLabel["2Y10Y"]).toMatchObject({ value: "+37bp", stateLabel: "LAST CLOSE" });
    expect(byLabel["HY Spread"]).toMatchObject({ value: "308bps", stateLabel: "DELAYED", direction: "up" });
    expect(byLabel["USD Broad (FRED)"]).toMatchObject({ value: "120.33", stateLabel: "DELAYED" });
    expect(byLabel["Fed Funds (EFFR, mo. avg)"]).toMatchObject({ value: "3.63%", stateLabel: "DELAYED" });
    expect(byLabel["CPI YoY"]).toMatchObject({ value: "3.1%", stateLabel: "DELAYED" });
    expect(byLabel["BTC Dominance"]).toMatchObject({ value: "58.30%" });
    expect(byLabel["Pressure Index"]).toMatchObject({ value: "33/100", stateLabel: "DELAYED", direction: "flat" });
    expect(byLabel["Regime"]).toMatchObject({ value: "MODERATE RISK" });
    expect(byLabel["Credit Stress"]).toMatchObject({ value: "30/100", stateLabel: "DELAYED" });
    expect(byLabel["Liquidity"]).toMatchObject({ value: "16/100", stateLabel: null });
    expect(items.map(item => item.label)).not.toContain("DXY");
    for (const removed of ["Fed Cut Prob", "Market Breadth", "Fear & Greed", "CRE STRESS", "RECESSION RISK", "YIELD CURVE", "CPI", "FED FUNDS", "AI Concentration"]) {
      expect(items.map(item => item.label), removed).not.toContain(removed);
    }
    const values = items.map(item => item.value).join(" ");
    for (const placeholder of ["22.4", "4.68%", "342bps", "3.4%", "5.25%", "7.2/10", "72%", "-42bps"]) {
      expect(values, placeholder).not.toContain(placeholder);
    }
  });

  it("anything without a source is '—' UNAVAILABLE; old FRED observations are STALE", () => {
    const items = buildAppHeaderStrip({ canonical: null, integrity: "UNAVAILABLE", quotes: null, fred: {}, now: NOW });
    expect(items.every(item => item.value === "—" && item.stateLabel === "UNAVAILABLE")).toBe(true);
    expect(fredObservationState("2026-09-10", "daily", NOW)).toBe("STALE");
    expect(fredObservationState("2026-09-29", "daily", NOW)).toBe("DELAYED");
    expect(fredObservationState("2026-06-01", "monthly", NOW)).toBe("STALE");
    expect(cpiYoY(cpi.slice(0, 12))).toBeNull();
    // A missing month (".") elsewhere in the window does not block YoY; a missing base month does.
    const withGap = cpi.map((obs, i) => (i === 5 ? { ...obs, value: "." } : obs));
    expect(cpiYoY(withGap)?.value).toBeCloseTo(3.127, 2);
    expect(cpiYoY(cpi.map((obs, i) => (i === 12 ? { ...obs, value: "." } : obs)))).toBeNull();
  });

  it("AppLayout no longer reads DEFAULT_INDICATORS or labels the FRED index as DXY", () => {
    const layout = source("client/src/components/AppLayout.tsx");
    for (const needle of ["indicators.vix", "indicators.yield10Y", "indicators.hySpread", "fedCutProb", "fearGreed", "breadthScore", "label: 'DXY'", "tickerValues", "useState<number>(54.2)"]) {
      expect(layout, needle).not.toContain(needle);
    }
    expect(layout).toContain("buildAppHeaderStrip(");
    expect(layout).toContain("trpc.markets.getGlobalSnapshot.useQuery");
  });
});
