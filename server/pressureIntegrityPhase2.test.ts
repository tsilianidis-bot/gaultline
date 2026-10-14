// Phase 2 (2026-10-13) integrity regression tests: recovery direction, public
// probability redaction, Today label, read-only public pressure query, claim copy.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { classifyCondition, isBroadRecoveryVerified } from "../shared/conditionDirection";
import deepFixture from "./pressure/__fixtures__/fred-2026-10-12-deep.json";
import { computePriorComponents } from "./pressure/priorComponents";
import { buildEvidenceFamilies, currentEnginesFromCanonical, type HistoricalMonth } from "./seismographUnified";
import { toPublicMarketStateWire, fromPublicMarketStateWire } from "../shared/publicProbabilityWire";
import { redactSystemicRegimeReading, redactSystemicRegimeHistoryPoint } from "../shared/systemicRegimePublic";
import { EMPTY_SYSTEMIC_REGIME_READING } from "../shared/systemicRegime";
import superjson from "superjson";

const src = (p: string) => readFileSync(p, "utf8");

describe("directional condition states (#6)", () => {
  it("distinguishes the five states", () => {
    expect(classifyCondition(20, 21).state).toBe("Low current stress");
    expect(classifyCondition(30, 36).state).toBe("Improving");
    expect(classifyCondition(30, 26).state).toBe("Deteriorating");
    expect(classifyCondition(50, 70).state).toBe("Elevated stress");
    expect(classifyCondition(30, null).state).toBe("Insufficient evidence");
    expect(classifyCondition(null, 30).state).toBe("Insufficient evidence");
  });
  it("Broad Recovery never fires on low levels alone", () => {
    const lowButFlat = ["Credit Markets", "Liquidity Conditions", "Macro Sensitivity", "X"].map(name => ({ name, conditionState: "Low current stress" as const }));
    expect(isBroadRecoveryVerified(lowButFlat, 20)).toBe(false);
    const improving = ["Credit Markets", "Liquidity Conditions", "Macro Sensitivity"].map(name => ({ name, conditionState: "Improving" as const }));
    expect(isBroadRecoveryVerified(improving, 30)).toBe(true);
    expect(isBroadRecoveryVerified([...improving.slice(0, 2), { name: "Macro Sensitivity", conditionState: "Deteriorating" as const }, { name: "Y", conditionState: "Improving" as const }], 30)).toBe(false);
  });
  // Stored-shape fixtures: prod pressureHistory rows (QA gate cfdf28e, prod-trackRecord-history.json)
  // and the canonical engine values of state 2026-10-11 (22/22/40/44/29).
  const stored = (r: any): HistoricalMonth => ({
    month: r.month, score: r.overallPressure, regime: "MODERATE RISK",
    liquidity: r.liquidityStress, credit: r.creditContagion, volatility: r.volatilityRegime, macro: r.macroSensitivity,
    breadth: r.marketBreadth, aiBubble: r.aiBubble, baaSpread: null, hySpread: null, tsy10y: null, tsy2y: null, fedfunds: null, cpiYoy: null,
  } as unknown as HistoricalMonth);
  const AUG = stored({ month: "2026-08", overallPressure: 31, liquidityStress: 20, creditContagion: 32, volatilityRegime: 42, macroSensitivity: 36, marketBreadth: 44, aiBubble: 28 });
  const SEP = stored({ month: "2026-09", overallPressure: 28, liquidityStress: 17, creditContagion: 30, volatilityRegime: 40, macroSensitivity: 35, marketBreadth: 45, aiBubble: 25 });
  const CANONICAL = currentEnginesFromCanonical({ "liquidity-stress": 22, "credit-contagion": 22, "volatility-regime": 40, "macro-sensitivity": 44, "market-breadth": 29, "ai-bubble": 44 });

  // Prior = same v1 components recomputed from FRED obs dated one month before each current input
  // (real fixture fred-2026-10-12-deep.json). Stored monthly rows (SEP) are NOT used for direction.
  const PRIOR = computePriorComponents(deepFixture.results as any, new Date("2026-10-12T16:00:00Z"))!;
  it("prior components recomputed from date-matched FRED observations", () => {
    expect(PRIOR.asOf).toBe("2026-09-08");
    expect(PRIOR.inputDates).toMatchObject({ hySpread: "2026-09-08", cpi: "2026-07-01", fedFunds: "2026-08-01", unemployment: "2026-08-01" });
    expect(PRIOR.components).toMatchObject({ "liquidity-stress": 16, "credit-contagion": 17, "macro-sensitivity": 41 });
  });
  it("direction = current canonical value vs recomputed prior of the same component", () => {
    const fams = buildEvidenceFamilies(SEP, [AUG, SEP], CANONICAL, currentEnginesFromCanonical(PRIOR.components));
    const by = Object.fromEntries(fams.map(f => [f.name, f]));
    expect(by["Liquidity Conditions"]).toMatchObject({ conditionState: "Deteriorating", conditionChange: 6 });
    expect(by["Credit Markets"]).toMatchObject({ conditionState: "Deteriorating", conditionChange: 5 });
    expect(by["Macro Sensitivity"]).toMatchObject({ conditionState: "Deteriorating", conditionChange: 3 });
    for (const f of [by["Liquidity Conditions"], by["Credit Markets"]]) expect(["recovering", "bullish"]).not.toContain(f.signal);
    expect(isBroadRecoveryVerified(fams, 33)).toBe(false);
  });
  it("missing prior observations → Insufficient evidence", () => {
    const thin = JSON.parse(JSON.stringify(deepFixture.results));
    thin.BAMLH0A0HYM2.observations = thin.BAMLH0A0HYM2.observations.slice(0, 5);
    expect(computePriorComponents(thin, new Date("2026-10-12T16:00:00Z"))).toBeNull();
    const fams = buildEvidenceFamilies(SEP, [AUG, SEP], CANONICAL, {});
    expect(fams.find(f => f.name === "Credit Markets")!.conditionState).toBe("Insufficient evidence");
  });
  it("no current canonical value → Insufficient evidence and no recovering/bullish wording", () => {
    const fams = buildEvidenceFamilies(SEP, [AUG, SEP]);
    for (const f of fams.filter(f => f.conditionState !== undefined)) expect(f.conditionState).toBe("Insufficient evidence");
    for (const f of fams) expect(["recovering", "bullish"]).not.toContain(f.signal);
  });
  it("recovering/bullish signal appears only for Improving families", () => {
    for (const f of buildEvidenceFamilies(SEP, [AUG, SEP], CANONICAL, currentEnginesFromCanonical(PRIOR.components))) {
      if (f.signal === "recovering" || f.signal === "bullish") expect(f.conditionState).toBe("Improving");
    }
  });
});

describe("unsupported claims removed (#3)", () => {
  const unified = src("server/seismographUnified.ts");
  for (const phrase of [
    "historically been a reliable early indicator",
    "most reliable leading indicator of systemic stress",
    "making this an early-warning signal",
    "historically precede broader market dislocations by 2–4 months",
    "typically produces a 5–15% directional move",
    "most reliable recession predictor",
    "has historically preceded composite score increases by 4–8 weeks",
    "This divergence historically precedes",
  ]) it(`seismographUnified no longer says "${phrase}"`, () => expect(unified).not.toContain(phrase));
  it("client copy no longer asserts crisis detection under the current framework", () => {
    expect(src("client/src/components/ProductExperience.tsx")).not.toMatch(/under the current framework/);
    expect(src("client/src/components/SystemicAlerts.tsx")).not.toContain("crossed 65/100 before Lehman");
    expect(src("client/src/components/SystemicAlerts.tsx")).not.toContain("most dangerous early-warning signal");
    expect(src("server/historicalIntelligenceEngine.ts")).not.toContain("Elevated pressure historically precedes");
    expect(src("server/seismographEngine.ts")).not.toContain("Sustained elevated pressure historically precedes");
    expect(src("server/routers/timeMachine.ts")).not.toContain("What did the pressure engine see in the months before the crash?");
  });
});

describe("public probabilities withheld (#4)", () => {
  it("marketState.current wire: non-finite probabilities become null, never the string 'NaN'", () => {
    const state: any = { outlook: {
      probabilities: { bull: NaN, neutral: NaN, bear: NaN, confidence: NaN, primaryDriver: "x", evidenceBasis: "", historicalBasis: "" },
      regimeProbabilities: { bull: NaN, softLanding: NaN, stagflation: NaN, recession: NaN, crash: NaN },
      transitionProbabilities: { remainInRegime: NaN, transitionToElevated: NaN, transitionToLow: NaN, transitionToCrisis: NaN, confidence: NaN, historicalBasis: "", currentEvidence: [] },
    } };
    const pub = toPublicMarketStateWire(state);
    const wire = JSON.stringify(superjson.serialize(pub).json);
    expect(wire).not.toContain("NaN");
    expect(pub!.outlook.transitionProbabilities.transitionToCrisis).toBeNull();
    const back = fromPublicMarketStateWire(pub);
    expect(Number.isNaN(back!.outlook.probabilities.bull)).toBe(true);
    expect(back!.outlook.probabilities.primaryDriver).toBe("x");
  });
  it("systemicRegime public reading carries no model probabilities", () => {
    const r = redactSystemicRegimeReading({ ...EMPTY_SYSTEMIC_REGIME_READING, crisisProbability: 0.00348, transitionProbability: 0.03, regimeConfidence: 0.99652, stressBuildingProbability: 0.1 });
    for (const k of ["crisisProbability", "transitionProbability", "regimeConfidence", "stressBuildingProbability", "systemicRiskScore"]) expect(k in r).toBe(false);
    expect(r.probabilitiesWithheld).toBe(true);
    const h = redactSystemicRegimeHistoryPoint({ date: "2026-10-09", currentRegime: "NORMAL", crisisProbability: 0.2, stressBuildingProbability: 0.3, transitionProbability: 0.1, regimeConfidence: 0.9, systemicRiskScore: 10, pc1: 0, spx: 1 });
    expect([h.crisisProbability, h.stressBuildingProbability, h.transitionProbability, h.regimeConfidence, h.systemicRiskScore]).toEqual([null, null, null, null, null]);
  });
  it("public router uses the redaction; unredacted access is admin-only", () => {
    const r = src("server/routers/systemicRegime.ts");
    expect(r).toMatch(/current: publicProcedure[\s\S]*redactSystemicRegimeReading/);
    expect(r).toMatch(/currentInternal: adminProcedure/);
    expect(src("server/routers/marketState.ts")).toMatch(/current: publicProcedure\.query\(async \(\) => toPublicMarketStateWire/);
  });
});

describe("Today label (#5) and read-only public pressure (#7)", () => {
  it("homepage timeline labels actual observation dates and never 'Today'", () => {
    const hb = src("server/homepageBriefing.ts");
    const section = hb.slice(hb.lastIndexOf("Section 4: Market Evolution Timeline"), hb.indexOf("// Timeline caption"));
    expect(section).not.toMatch(/label: [^\n]*"Today"/);
    expect(section).not.toContain('isToday ? "Today"');
    expect(section).toContain("toLocaleDateString");
    expect(section).toContain("canonical.generatedAt");
    expect(section).toContain("pressureRegimeLabel(run.overallPressure)");
  });
  it("pressure.getCurrentPressure performs no writes", () => {
    const r = src("server/routers.ts");
    const proc = r.slice(r.indexOf("getCurrentPressure: publicProcedure"), r.indexOf("getCurrentPressure: publicProcedure") + 2500);
    expect(proc).not.toMatch(/insertPressureRun\(|runV3HShadow\(|db\.insert/);
    expect(src("server/pressure/engine.ts")).not.toMatch(/runV3HShadow\(/);
    expect(src("server/scheduledSeismograph.ts")).toContain("persistPressureRunAndShadows(pressureOutput");
  });
});

describe("prior-component recompute is read-only", () => {
  it("priorComponents.ts has no DB access", () => {
    expect(src("server/pressure/priorComponents.ts")).not.toMatch(/getDb|drizzle|insert|\.\.\/db"/);
  });
});
