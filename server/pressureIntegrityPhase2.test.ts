// Phase 2 (2026-10-13) integrity regression tests: recovery direction, public
// probability redaction, Today label, read-only public pressure query, claim copy.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { classifyCondition, isBroadRecoveryVerified } from "../shared/conditionDirection";
import { buildEvidenceFamilies, type HistoricalMonth } from "./seismographUnified";
import { toPublicMarketStateWire, fromPublicMarketStateWire } from "../shared/publicProbabilityWire";
import { redactSystemicRegimeReading, redactSystemicRegimeHistoryPoint } from "../shared/systemicRegimePublic";
import { EMPTY_SYSTEMIC_REGIME_READING } from "../shared/systemicRegime";
import superjson from "superjson";

const src = (p: string) => readFileSync(p, "utf8");

describe("directional condition states (#6)", () => {
  it("uses actual changes: Sep 9 → Oct 9 2026 recomputed engines", () => {
    expect(classifyCondition(22, 16).state).toBe("Deteriorating"); // liquidity
    expect(classifyCondition(22, 18).state).toBe("Deteriorating"); // credit
    expect(classifyCondition(44, 42).state).toBe("Insufficient evidence"); // macro: +2, moderate, no verified direction
  });
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
  it("buildEvidenceFamilies: low but rising engines are Deteriorating, not recovering", () => {
    const row = (month: string, liq: number, cr: number, mac: number): HistoricalMonth => ({
      month, score: 30, regime: "MODERATE RISK", liquidity: liq, credit: cr, volatility: 40, macro: mac, breadth: 29, aiBubble: 44,
      baaSpread: null, hySpread: null, tsy10y: null, tsy2y: null, cpiYoy: null, fedfunds: null,
    } as unknown as HistoricalMonth);
    const hist = [row("2026-08", 16, 18, 42), row("2026-09", 22, 22, 44)];
    const fams = buildEvidenceFamilies(hist[1], hist);
    const by = Object.fromEntries(fams.map(f => [f.name, f]));
    expect(by["Liquidity Conditions"].conditionState).toBe("Deteriorating");
    expect(by["Credit Markets"].conditionState).toBe("Deteriorating");
    expect(by["Liquidity Conditions"].trend).toBe("deteriorating");
    expect(isBroadRecoveryVerified(fams, 33)).toBe(false);
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
  ]) it(`seismographUnified no longer says "${phrase}"`, () => expect(unified).not.toContain(phrase));
  it("client copy no longer asserts crisis detection under the current framework", () => {
    expect(src("client/src/components/ProductExperience.tsx")).not.toMatch(/under the current framework/);
    expect(src("client/src/components/SystemicAlerts.tsx")).not.toContain("crossed 65/100 before Lehman");
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
    expect([r.crisisProbability, r.transitionProbability, r.regimeConfidence, r.stressBuildingProbability]).toEqual([null, null, null, null]);
    expect(r.probabilitiesWithheld).toBe(true);
    const h = redactSystemicRegimeHistoryPoint({ date: "2026-10-09", currentRegime: "NORMAL", crisisProbability: 0.2, stressBuildingProbability: 0.3, transitionProbability: 0.1, regimeConfidence: 0.9, systemicRiskScore: 10, pc1: 0, spx: 1 });
    expect([h.crisisProbability, h.stressBuildingProbability, h.transitionProbability, h.regimeConfidence]).toEqual([null, null, null, null]);
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
