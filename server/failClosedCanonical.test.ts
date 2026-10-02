/**
 * Fail-closed + canonical-consistency regression tests
 * (prod QA report 2026-10-01, snapshot state:2026-10-01T18:00:34.034Z:2ec8d9c1d8f6e278).
 *
 * Fixtures in server/__fixtures__/prod-2026-10-01 are the production API payloads
 * captured during that QA pass (deployment da863238 / d3cce2a).
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

import { computeSOB, SOB_INSUFFICIENT_LABEL, SOB_UNAVAILABLE_VALUE } from "./sobEngine";
import { collectAllEvidence, isSOBEvidenceEligible } from "./seismographAdapters";
import {
  buildEvidenceFamilies,
  LABOR_RATES_FAMILY_NAME,
  normalizeLaborRatesScore,
  type HistoricalMonth,
} from "./seismographUnified";
import { PRESSURE_VECTOR_DISPLAY, pressureVectorLabel } from "@shared/pressureVectorLabels";
import { buildSOBSourceInputs } from "@/lib/appHeaderStrip";
import {
  signalQuoteBadge,
  signalQuoteView,
  signalsFeedLabel,
  signalsPriceBadge,
  catalogQuotes,
} from "@/lib/signalQuoteView";
import { SIGNAL_STOCKS } from "@/lib/signalsData";
import { mergeCanonicalMarketState } from "@/lib/canonicalNowProjection";
import {
  canonicalDirectionTrend,
  canonicalHistoricalPercentile,
  canonicalScenarioLeader,
  canonicalScenarioSet,
  classifyEvidenceFamilies,
  formatScenarioPercent,
} from "@shared/canonicalReadout";
import { directionDisplay } from "@shared/snapshotEvidence";

const ROOT = path.resolve(import.meta.dirname, "..");
const FIX = path.join(import.meta.dirname, "__fixtures__", "prod-2026-10-01");
const fixture = <T = any>(name: string): T => JSON.parse(readFileSync(path.join(FIX, name), "utf8"));
const src = (rel: string) => readFileSync(path.join(ROOT, rel), "utf8");

const canonical = fixture("canonical-current.json");
const legacy = fixture("market-state-current.json");
const globalSnapshot = fixture("global-snapshot.json");
const signalsQuotes = fixture("signals-quotes.json");

// ─────────────────────────────────────────────────────────────────────────────
// 1. S.O.B. fail-closed
// ─────────────────────────────────────────────────────────────────────────────
describe("S.O.B. fail-closed", () => {
  it("all inputs missing → every pillar UNAVAILABLE, never Clear, never active", () => {
    const sob = computeSOB({ pressureIndex: 33, regime: "MODERATE RISK" });
    expect(sob.label).not.toBe("Clear");
    expect(sob.label).toBe(SOB_INSUFFICIENT_LABEL);
    expect(sob.coverage).toBe("UNAVAILABLE");
    expect(sob.availablePillarCount).toBe(0);
    expect(sob.pillars).toHaveLength(6);
    for (const p of sob.pillars) {
      expect(p.available).toBe(false);
      expect(p.active).toBe(false);
      expect(p.value).toBe(SOB_UNAVAILABLE_VALUE);
      expect(p.description).not.toMatch(/normal|healthy|not inverted|flowing/i);
    }
    expect(sob.unavailablePillars).toHaveLength(6);
  });

  it("a stressed pressure index / regime never activates a pillar by proxy", () => {
    const sob = computeSOB({ pressureIndex: 95, regime: "CRISIS" });
    expect(sob.pillars.every(p => !p.active && !p.available)).toBe(true);
    expect(sob.level).toBe(0);
    expect(sob.label).toBe(SOB_INSUFFICIENT_LABEL);
  });

  it("breadth (and momentum) have no input → always UNAVAILABLE, so Clear is impossible", () => {
    const sob = computeSOB({ pressureIndex: 33, creditSpread: 280, yieldSpread: 0.41, fedFundsRate: 4.33, vix: 16.39 });
    const breadth = sob.pillars.find(p => /breadth/i.test(p.name))!;
    expect(breadth.available).toBe(false);
    expect(breadth.value).toBe(SOB_UNAVAILABLE_VALUE);
    expect(sob.coverage).toBe("PARTIAL");
    expect(sob.availablePillarCount).toBe(4);
    expect(sob.label).not.toBe("Clear");
    expect(sob.label).toBe(SOB_INSUFFICIENT_LABEL);
    // grid: no combination of available inputs can produce Clear while breadth is missing
    for (const vix of [null, 12, 30]) for (const cs of [null, 250, 600]) for (const ys of [null, -0.5, 0.4]) for (const ff of [null, 1, 5.5]) {
      const r = computeSOB({ vix, creditSpread: cs, yieldSpread: ys, fedFundsRate: ff });
      expect(r.label).not.toBe("Clear");
      expect(r.coverage).not.toBe("COMPLETE");
    }
  });

  it("real stressed inputs still raise the level, with the coverage gap stated", () => {
    const sob = computeSOB({ vix: 32, creditSpread: 620, yieldSpread: -0.4, fedFundsRate: 5.4 });
    expect(sob.level).toBeGreaterThan(0);
    expect(sob.label).not.toBe(SOB_INSUFFICIENT_LABEL);
    expect(sob.explanation).toMatch(/unavailable/i);
  });

  it("an incomplete S.O.B. is never fed to the seismograph as (bullish) evidence", async () => {
    const sob = computeSOB({ pressureIndex: 33, creditSpread: 280, yieldSpread: 0.41, fedFundsRate: 4.33, vix: 16.39 });
    expect(isSOBEvidenceEligible(sob)).toBe(false);
    const packets = await collectAllEvidence({ sobOutput: sob });
    expect(packets.some(p => p.engineId === "breakdown_signals")).toBe(false);
    const none = await collectAllEvidence({ sobOutput: computeSOB({}) });
    expect(none.some(p => p.engineId === "breakdown_signals")).toBe(false);
  });

  it("Pressure passes the real inputs: HY bps, 10Y-2Y, Fed funds, VIX from the prod snapshot", () => {
    const now = Number(globalSnapshot.fetchedAt); // epoch ms
    expect(Number.isFinite(now)).toBe(true);
    const inputs = buildSOBSourceInputs({
      quotes: globalSnapshot.items,
      fred: {
        // FRED observations served by prod /api/fred during the same QA capture
        BAMLH0A0HYM2: [{ date: "2026-09-30", value: "3.12" }, { date: "2026-09-29", value: "3.08" }],
        FEDFUNDS: [{ date: "2026-09-01", value: "3.75" }, { date: "2026-08-01", value: "3.63" }],
      },
      now,
    });
    expect(inputs).toEqual({ creditSpread: 312, yieldSpread: 0.41, fedFundsRate: 3.75, vix: 16.39 });
    const sob = computeSOB({ pressureIndex: 33, ...inputs });
    expect(sob.availablePillarCount).toBe(4);
    expect(sob.label).toBe(SOB_INSUFFICIENT_LABEL); // breadth + momentum still UNAVAILABLE

    // stale / missing → null (→ UNAVAILABLE pillar), never a substituted value
    const stale = buildSOBSourceInputs({
      quotes: [],
      fred: { BAMLH0A0HYM2: [{ date: "2026-06-01", value: "2.81" }], FEDFUNDS: null },
      now,
    });
    expect(stale).toEqual({ creditSpread: null, yieldSpread: null, fedFundsRate: null, vix: null });
    // an invalid clock never makes an observation "fresh"
    expect(buildSOBSourceInputs({ quotes: [], fred: { FEDFUNDS: [{ date: "2026-09-01", value: "4.33" }] }, now: Number.NaN }).fedFundsRate).toBeNull();

    const pressure = src("client/src/pages/Pressure.tsx");
    expect(pressure).toMatch(/creditSpread=\{sobInputs\.creditSpread\}|creditSpread=\{[^}]*creditSpread/);
    expect(pressure).toMatch(/vix=\{[^}]*vix/);
    expect(pressure).toMatch(/fedFundsRate=\{[^}]*fedFundsRate/);
    expect(pressure).toMatch(/yieldSpread=\{[^}]*yieldSpread/);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. "Market Breadth" mislabel → Labor & Rates; missing never becomes 50
// ─────────────────────────────────────────────────────────────────────────────
function month(overrides: Partial<HistoricalMonth> = {}): HistoricalMonth {
  return {
    month: "2026-09", score: 33, regime: "MODERATE RISK", liquidity: 17, credit: 30, volatility: 40, macro: 35,
    breadth: 45, aiBubble: 30, baaSpread: null, hySpread: null, tsy10y: 4.1, tsy2y: 3.7, fedfunds: 4.33,
    cpiYoy: 2.9, unemployment: 4.3, sp500: null, ...overrides,
  };
}

describe("Labor & Rates (engine id market-breadth)", () => {
  it("uses the canonical label from shared/pressureVectorLabels.ts", () => {
    expect(LABOR_RATES_FAMILY_NAME).toBe(PRESSURE_VECTOR_DISPLAY["market-breadth"].label);
    expect(LABOR_RATES_FAMILY_NAME).toBe(pressureVectorLabel("market-breadth"));
    expect(LABOR_RATES_FAMILY_NAME).toMatch(/^Labor & Rates/);
    expect(LABOR_RATES_FAMILY_NAME).not.toMatch(/breadth/i);
  });

  it("missing / 0-sentinel scores stay null — never a neutral 50", () => {
    expect(normalizeLaborRatesScore(null)).toBeNull();
    expect(normalizeLaborRatesScore(undefined)).toBeNull();
    expect(normalizeLaborRatesScore(0)).toBeNull();
    expect(normalizeLaborRatesScore(Number.NaN)).toBeNull();
    expect(normalizeLaborRatesScore(45)).toBe(45);
  });

  it("no score → family omitted (not a 50/100 neutral reading)", () => {
    const history = Array.from({ length: 6 }, () => month({ breadth: null }));
    const families = buildEvidenceFamilies(month({ breadth: null }), history);
    expect(families.find(f => f.name === LABOR_RATES_FAMILY_NAME)).toBeUndefined();
    expect(families.some(f => /breadth/i.test(f.name))).toBe(false);
  });

  it("with a score → accurately named family, no breadth conclusions", () => {
    const history = Array.from({ length: 6 }, () => month());
    const families = buildEvidenceFamilies(month(), history);
    const fam = families.find(f => f.name === LABOR_RATES_FAMILY_NAME)!;
    expect(fam).toBeDefined();
    expect(fam.currentValue).toBe("45/100");
    expect(fam.historicalContext).not.toMatch(/market breadth/i);
    expect(families.some(f => f.name === "Market Breadth")).toBe(false);
    const all = JSON.stringify(families);
    expect(all).not.toMatch(/Market breadth is moderate|neither confirming nor contradicting/i);
  });

  it("source: the `marketBreadth || 50` fallback and the old label are gone", () => {
    const s = src("server/seismographUnified.ts");
    expect(s).not.toMatch(/marketBreadth\s*\|\|\s*50/);
    expect(s).not.toMatch(/name:\s*"Market Breadth"/);
    expect(s).not.toMatch(/Market breadth is moderate/);
    expect(s).not.toMatch(/primary pressure driver is \$\{topFamily\.name\.toLowerCase\(\)\}/);
  });

  it("NOW top-threat/chips no longer hard-code Market Breadth / BREADTH", () => {
    const now = src("client/src/pages/Now.tsx");
    expect(now).not.toMatch(/BREADTH:|Market Breadth/);
    expect(now).toMatch(/threats\[0\]/);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. Signals: no server quote → "—" UNAVAILABLE; never fake "LIVE"
// ─────────────────────────────────────────────────────────────────────────────
describe("Signals quotes fail closed", () => {
  const quotes = signalsQuotes.quotes as Array<{ ticker: string; price: number; changePercent: number; isLive: boolean; marketStatus: string; sparkline: number[] }>;
  const quoteMap = new Map(quotes.map(q => [q.ticker, q]));

  it("no quote / invalid quote → '—' + UNAVAILABLE, no sparkline", () => {
    for (const q of [undefined, null, { price: 0, changePercent: 1, isLive: true, marketStatus: "open" }, { price: Number.NaN, changePercent: 0, isLive: false, marketStatus: "closed" }]) {
      const v = signalQuoteView(q as never);
      expect(v.priceText).toBe("—");
      expect(v.changeText).toBe("—");
      expect(v.badge).toBe("UNAVAILABLE");
      expect(v.available).toBe(false);
      expect(v.sparkline).toEqual([]);
    }
  });

  it("tickers the server did not quote (MRNA, AMC, …) render as UNAVAILABLE", () => {
    for (const ticker of ["MRNA", "AMC"]) {
      expect(quoteMap.has(ticker)).toBe(false);
      expect(signalQuoteView(quoteMap.get(ticker)).badge).toBe("UNAVAILABLE");
      expect(signalQuoteView(quoteMap.get(ticker)).priceText).toBe("—");
    }
  });

  it("captured prod quotes are closed / isLive:false → LAST CLOSE, never LIVE", () => {
    expect(signalsQuotes.source).toBe("live");
    expect(signalsQuotes.marketStatus).toBe("closed");
    for (const q of quotes) expect(signalQuoteBadge(q)).not.toBe("LIVE");
    const nvda = signalQuoteView(quoteMap.get("NVDA"));
    expect(nvda.badge).toBe("LAST CLOSE");
    expect(nvda.priceText).toContain("230.86");
    const feed = signalsFeedLabel({ source: "live", quotes, tickerCount: quotes.length + 5 });
    expect(feed.label).not.toBe("YAHOO FINANCE LIVE");
    expect(feed.label).toMatch(/LAST CLOSE/);
    expect(feed.coverage).toMatch(/UNAVAILABLE/);
    expect(signalsPriceBadge(quotes).label).toBe("LAST CLOSE");
    expect(signalsPriceBadge([]).label).toBe("UNAVAILABLE");
  });

  it("coverage counts only catalog tickers the server actually quoted (never > catalog size)", () => {
    const catalog = SIGNAL_STOCKS.map(s => s.ticker);
    const scoped = catalogQuotes(quotes, catalog);
    expect(scoped.length).toBeLessThanOrEqual(catalog.length);
    const feed = signalsFeedLabel({ source: "live", quotes: scoped, tickerCount: catalog.length });
    const [quoted, total] = feed.coverage.split(" ")[0].split("/").map(Number);
    expect(quoted).toBeLessThanOrEqual(total);
    expect(total).toBe(catalog.length);
    const unquoted = catalog.filter(t => !quoteMap.has(t));
    expect(quoted + unquoted.length).toBe(catalog.length);
    expect(src("client/src/pages/Signals.tsx")).toMatch(/quotes=\{catalogQuotes\(quotesData\?\.quotes, SIGNAL_STOCKS\.map/);
  });

  it("LIVE only for a live quote in an open session", () => {
    const live = { price: 100, changePercent: 1, isLive: true, marketStatus: "open" };
    expect(signalQuoteBadge(live)).toBe("LIVE");
    expect(signalsFeedLabel({ source: "live", quotes: [live], tickerCount: 1 }).label).toBe("YAHOO FINANCE LIVE");
    expect(signalsPriceBadge([live]).label).toBe("LIVE PRICES");
  });

  it("source: cards never render static signalsData prices", () => {
    const s = src("client/src/pages/Signals.tsx");
    expect(s).not.toMatch(/\$\{?stock\.price|\{stock\.price|stock\.changePercent\s*>=|stock\.sparkline/);
    expect(s).not.toMatch(/integrityLabel === 'LIVE' \? 'LIVE PRICES'/);
    expect(s).toMatch(/signalQuoteView\(/);
    // trading-signal inputs: quoted tickers only, never catalog prices
    expect(s).toMatch(/if \(!lq \|\| !hasUsableSignalQuote\(lq\)\) return \[\];/);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. Canonical consistency across NOW / Brief / Pressure / Watch / ACT / strip
// ─────────────────────────────────────────────────────────────────────────────
describe("canonical consistency (one source)", () => {
  const merged = mergeCanonicalMarketState(canonical, legacy)!;

  it("fixture is the preserved snapshot (33/100 MODERATE RISK)", () => {
    expect(canonical.stateId).toBe("state:2026-10-01T18:00:34.034Z:2ec8d9c1d8f6e278");
    expect(canonical.pressureIndex).toBe(33);
    expect(canonical.regime).toBe("MODERATE RISK");
    expect(merged.now.pressureScore).toBe(33);
    expect(merged.now.regime).toBe("MODERATE RISK");
  });

  it("(a) direction + percentile: Pressure shows exactly what NOW shows", () => {
    const nowDirection = merged.now.direction;
    expect(nowDirection).toBe(directionDisplay(canonical.pressureDirection));
    expect(nowDirection).toBe("Stable");
    // Pressure.tsx ScoreExplainer inputs
    expect(canonicalDirectionTrend(directionDisplay(canonical.pressureDirection))).toBe("stable");
    expect(canonicalHistoricalPercentile(merged.now.historicalPercentile)).toBe(83);
    expect(canonicalHistoricalPercentile(merged.now.historicalPercentile)).not.toBe(canonical.pressureIndex);
    const p = src("client/src/pages/Pressure.tsx");
    expect(p).not.toMatch(/historicalPercentile=\{data\.overallPressure\}/);
    expect(p).toMatch(/trend=\{canonicalDirectionTrend\(directionDisplay\(canonicalState\?\.pressureDirection\)\)\}/);
    expect(p).toMatch(/historicalPercentile=\{canonicalHistoricalPercentile\(marketState\?\.now\.historicalPercentile\)\}/);
    expect(canonicalDirectionTrend("Unknown")).toBeUndefined();
  });

  it("(b) one scenario set = governed snapshot scenarioOutputs (43/43/14) everywhere", () => {
    expect(canonicalScenarioSet(canonical.scenarioOutputs)).toEqual({ bull: 43, neutral: 43, bear: 14 });
    const { bull, neutral, bear } = merged.outlook.probabilities;
    expect({ bull, neutral, bear }).toEqual({ bull: 43, neutral: 43, bear: 14 });
    // not the seismograph 3-way (64/21/15) or the 5-way regime split (53/33/8/4/2)
    expect(legacy.outlook.probabilities.bull).toBe(64);
    expect(bull).not.toBe(64);
    expect(canonicalScenarioLeader(merged.outlook.probabilities)).toEqual({ keys: ["bull", "neutral"], value: 43 });
    expect(formatScenarioPercent(merged.outlook.probabilities.bear)).toBe("14%");

    // missing canonical set → withheld ("—"), never back-filled from another distribution
    const withheld = mergeCanonicalMarketState({ ...canonical, scenarioOutputs: null }, legacy)!;
    expect(Number.isNaN(withheld.outlook.probabilities.bull)).toBe(true);
    expect(formatScenarioPercent(withheld.outlook.probabilities.bull)).toBe("—");
    expect(canonicalScenarioLeader(withheld.outlook.probabilities)).toBeNull();

    // every surface reads marketState.outlook.probabilities (the merged canonical set)
    const now = src("client/src/pages/Now.tsx");
    expect(now).not.toMatch(/regimeProbabilities/);
    expect(now).toMatch(/marketState\?\.outlook\.probabilities\.bull/);
    expect(src("client/src/pages/Act.tsx")).toMatch(/marketState\.outlook\.probabilities\.bull/);
    expect(src("client/src/pages/Watch.tsx")).toMatch(/marketState\?\.outlook\.probabilities/);
    const strip = src("client/src/components/MarketContextStrip.tsx");
    expect(strip).toMatch(/canonicalScenarioLeader\(marketState\?\.outlook\.probabilities\)/);
    expect(strip).not.toMatch(/regimeProbabilities|seismographOutput\??\.scenarioProbabilities/);
    expect(src("client/src/contexts/EngineContext.tsx")).toMatch(/mergeCanonicalMarketState\(/);
  });

  it("(c) analog only when verified (canonical topAnalog) — none in this snapshot", () => {
    expect(merged.outlook.topAnalog).toBeNull();
    const strip = src("client/src/components/MarketContextStrip.tsx");
    expect(strip).toMatch(/const verifiedAnalog = marketState\?\.outlook\.topAnalog \?\? null/);
    expect(strip).not.toMatch(/analogMatches\??\[0\]/);
  });

  it("(d) threats/supports come from one classifier; neutral families are neither", () => {
    const direct = classifyEvidenceFamilies(legacy.why.evidenceFamilies);
    expect(merged.now.threats).toEqual(direct.threats);
    expect(merged.now.supports).toEqual(direct.supports);
    expect(merged.now.threats).toEqual([]);
    expect(merged.now.supports).toEqual(["Macro Sensitivity: 35/100", "Credit Markets: 30/100", "Liquidity Conditions: 17/100"]);
    // the QA failure: neutral Breadth/Volatility called "supporting" on ACT
    for (const line of merged.now.supports) expect(line).not.toMatch(/Breadth|Volatility/);
    expect(direct.neutral.map(l => l.split(":")[0])).toEqual(["Market Breadth", "Volatility Regime"]);

    const act = src("client/src/pages/Act.tsx");
    expect(act).toMatch(/const greenFlags = marketState\?\.now\.supports \?\? \[\]/);
    expect(act).not.toMatch(/greenFlags = evidence/);
    const now = src("client/src/pages/Now.tsx");
    expect(now).toMatch(/marketState\?\.now\.threats/);
    expect(src("server/marketStateService.ts")).toMatch(/classifyEvidenceFamilies\(/);
  });
});
