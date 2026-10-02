/**
 * Data Integrity stream (Oct 2 2026): one canonical market state, no demo
 * values in production surfaces, fail-closed on missing canonical state, and
 * freshness wording that matches the inputs.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { DEFAULT_INDICATORS } from "../client/src/lib/engine";
import { selectBrowserMarketOutput } from "../client/src/lib/marketStateProjection";
import { buildLiveIndicatorReadings, evaluableIndicatorValues } from "../client/src/lib/liveIndicatorReadings";
import { generateSystemicAlerts } from "../client/src/components/SystemicAlerts";
import {
  canonicalFreshnessReadout,
  canonicalRunBasisNote,
  formatRecordMonth,
  monthlyRecordBasisNote,
} from "../shared/dataIntegrityReadout";
import { pressureVectorLabel } from "../shared/pressureVectorLabels";
import { buildEvidenceFamilies, YIELD_CURVE_FAMILY_NAME, type HistoricalMonth } from "./seismographUnified";
import type { CanonicalMarketState } from "../shared/marketState";

const root = resolve(import.meta.dirname, "..");
const src = (p: string) => readFileSync(resolve(root, p), "utf8");

const fixture = JSON.parse(src("server/__fixtures__/prod-2026-10-01/market-state-current.json"));
const NOW = Date.parse("2026-10-02T08:30:00Z");

describe("canonical freshness readout (WATCH / ACT Freshness card)", () => {
  const canonical = {
    generatedAt: "2026-10-01T18:00:34Z",
    delayedInputs: ["a", "b", "c", "d", "e"],
    staleInputs: [],
    fallbackInputs: [],
    unavailableInputs: [],
  };

  it("follows the header integrity label and names the delayed inputs", () => {
    const r = canonicalFreshnessReadout({ integrityLabel: "DELAYED", canonical });
    expect(r.label).toBe("DELAYED");
    expect(r.detail).toMatch(/5 inputs delayed/);
    expect(r.detail).toMatch(/ET/);
    expect(r.detail).not.toMatch(/\blive\b/i);
  });

  it("is UNAVAILABLE without a canonical state", () => {
    expect(canonicalFreshnessReadout({ integrityLabel: "DELAYED", canonical: null }).label).toBe("UNAVAILABLE");
  });

  it("basis notes name the monthly record vs the canonical run", () => {
    expect(formatRecordMonth("2026-09")).toBe("Sep 2026");
    expect(formatRecordMonth("garbage")).toBeNull();
    expect(monthlyRecordBasisNote("2026-09")).toMatch(/monthly pressure-history record \(Sep 2026\)/);
    expect(canonicalRunBasisNote("2026-10-01T18:00:34Z")).toMatch(/current canonical run \(.*ET\)/);
  });
});

describe("real indicator readings (Watchlist / Alerts / deep dashboard)", () => {
  const fred = {
    BAMLH0A0HYM2: [{ date: "2026-09-30", value: "3.12" }],
    FEDFUNDS: [{ date: "2026-08-01", value: "4.08" }],
    CPIAUCSL: [{ date: "2026-08-01", value: "330.0" }, { date: "2025-08-01", value: "321.0" }],
  };
  const quotes = [
    { symbol: "FRED:DGS10", shortLabel: "10Y", price: 4.12, changePercent: 0.1, freshnessState: "DELAYED", sessionStatus: "CLOSED", unit: "%", proxySymbol: null },
    { symbol: "DERIVED:2Y10Y", shortLabel: "2s10s", price: 41, changePercent: null, freshnessState: "DELAYED", sessionStatus: "CLOSED", unit: "bps", proxySymbol: null },
    { symbol: "^VIX", shortLabel: "VIX", price: 15.98, changePercent: -1.2, freshnessState: "DELAYED", sessionStatus: "CLOSED", unit: null, proxySymbol: null },
  ] as never;

  it("uses real sources and never the DEFAULT_INDICATORS demo baseline", () => {
    const r = buildLiveIndicatorReadings({ quotes, fred, now: NOW });
    expect(r.hySpread?.value).toBe(312);
    expect(r.hySpread?.value).not.toBe(DEFAULT_INDICATORS.hySpread);
    expect(r.yieldCurveSpread?.value).toBe(41);
    expect(r.vix?.value).toBe(15.98);
    expect(r.yield10Y?.stateLabel).toBe("LAST CLOSE");
    expect(r.cpi?.value).toBeCloseTo(2.8, 1);
    // no real source → absent (UNAVAILABLE), never a demo number
    expect(r.yield30Y).toBeUndefined();
    expect(r.unemployment).toBeUndefined();
  });

  it("STALE readings are not evaluated for threshold alerts", () => {
    const r = buildLiveIndicatorReadings({ quotes: [], fred: { BAMLH0A0HYM2: [{ date: "2026-06-01", value: "6.00" }] }, now: NOW });
    expect(r.hySpread?.stateLabel).toBe("STALE");
    expect(evaluableIndicatorValues(r).hySpread).toBeUndefined();
  });
});

describe("canonical projection carries no demo gauges", () => {
  const marketState = fixture as unknown as CanonicalMarketState;

  it("canonical mode nulls the 0–100 alertPressure gauges and ticker values", () => {
    const result = selectBrowserMarketOutput({ marketState, baselineIndicators: DEFAULT_INDICATORS, simulationOverrides: {} });
    expect(result.mode).toBe("canonical");
    expect(result.output.alertPressure).toEqual({ treasury: null, credit: null, aiRisk: null, liquidity: null });
    expect(result.output.tickerValues).toEqual([]);
  });

  it("systemic alerts never read alertPressure (no '56.0/10' from a 0–100 demo gauge)", () => {
    const fallback = selectBrowserMarketOutput({ marketState: null, baselineIndicators: DEFAULT_INDICATORS, simulationOverrides: {} });
    const output = { ...fallback.output, domains: [], analogs: [], overall: { ...fallback.output.overall, score: 3.3 } };
    const alerts = generateSystemicAlerts(output);
    expect(alerts.map(a => a.category)).toEqual([]);
    expect(src("client/src/components/SystemicAlerts.tsx")).not.toMatch(/alertPressure\./);
  });
});

describe("evidence family naming matches the Pressure vector label", () => {
  const month = (m: string, v: number): HistoricalMonth => ({
    month: m, score: 33, regime: "MODERATE RISK", liquidity: 17, credit: 30, volatility: v, macro: 35, breadth: 45,
    aiBubble: 44, baaSpread: null, hySpread: null, tsy10y: null, tsy2y: null, fedfunds: null, cpiYoy: null, unemployment: null, sp500: null,
  });

  it("the volatility-regime family is the yield-curve vector, not VIX volatility", () => {
    expect(YIELD_CURVE_FAMILY_NAME).toBe(pressureVectorLabel("volatility-regime"));
    const families = buildEvidenceFamilies(month("2026-09", 40), [month("2026-08", 40), month("2026-09", 40)]);
    const fam = families.find(f => f.name === YIELD_CURVE_FAMILY_NAME);
    expect(fam?.strength).toBe(40);
    expect(families.some(f => f.name === "Volatility Regime")).toBe(false);
    expect(`${fam?.historicalContext} ${fam?.whyItMatters}`).not.toMatch(/hedging demand|forced deleveraging|Volatility is/);
    expect(`${fam?.whyItMatters}`).toMatch(/does not read VIX/);
  });
});

describe("source guards — production surfaces", () => {
  it("no 'live' claims beside delayed inputs", () => {
    expect(src("client/src/pages/Now.tsx")).not.toMatch(/Live pressure across all 10 engines/);
    for (const p of ["client/src/pages/Watch.tsx", "client/src/pages/Act.tsx"]) {
      expect(src(p)).not.toMatch(/Canonical source state is/);
      expect(src(p)).toMatch(/canonicalFreshnessReadout/);
    }
  });

  it("NOW fails closed when the canonical state is unavailable", () => {
    expect(src("client/src/pages/Now.tsx")).toMatch(/if \(!marketState \|\| !canonicalState\) \{?\s*return <PageDegradedBanner/);
  });

  it("Watchlist, Alerts and the deep dashboard never show EngineContext.indicators as readings", () => {
    for (const p of ["client/src/pages/Watchlist.tsx", "client/src/pages/Alerts.tsx", "client/src/pages/Dashboard.tsx"]) {
      const s = src(p);
      expect(s).not.toMatch(/\bindicators\.(hySpread|yield10Y|yield30Y|vix|cpi|unemployment|fedFundsRate|yieldCurveSpread)\b/);
      expect(s).not.toMatch(/rawFred\[/);
      expect(s).not.toMatch(/seededRand|buildSparkline|buildMiniSeries/);
    }
    expect(src("client/src/pages/Alerts.tsx")).not.toMatch(/alertPressure/);
  });

  it("Signals never shows static catalog RSI or a defaulted regime", () => {
    const s = src("client/src/pages/Signals.tsx");
    expect(s).not.toMatch(/stock\.relativeStrength\.toString\(\)/);
    expect(s).not.toMatch(/overall\?\.score \?\? 5/);
    expect(s).not.toMatch(/regime\?\.label \?\? 'MODERATE RISK',\n\s*score:/);
    expect(s).toMatch(/\{quote\.available && <div/);
  });

  it("deep dashboard (/app/now/deep) fails closed and drops the static demo metric set", () => {
    const s = src("client/src/pages/Dashboard.tsx");
    expect(s).not.toMatch(/from "@\/lib\/data"/);
    expect(s).toMatch(/if \(marketMode === 'deterministic-fallback'\)/);
    expect(src("client/src/components/dashboard/FaultlineInterpretation.tsx")).toMatch(/static baseline/);
  });

  it("Pressure does not print a hardcoded 0% weight", () => {
    const s = src("client/src/pages/Pressure.tsx");
    expect(s).not.toMatch(/weight: 0,/);
    expect(s).toMatch(/canonicalRunBasisNote/);
  });
});

describe("Product-QA guest baseline items (Oct 2 2026)", () => {
  it("Signals shows the canonical Pressure Index on the 0–100 scale", () => {
    const s = src("client/src/pages/Signals.tsx");
    expect(s).toMatch(/engine\?\.canonicalState\?\.pressureIndex/);
    expect(s).toMatch(/Math\.round\(canonicalPressureIndex\) : '—'\}<span[^>]*>\/100</);
    expect(s).not.toMatch(/regimeForSignals\.score\.toFixed\(1\)/);
  });

  it("Watchlist breach badge in AppLayout never evaluates demo indicators", () => {
    const s = src("client/src/components/AppLayout.tsx");
    expect(s).not.toMatch(/\(indicators as unknown as Record/);
    expect(s).toMatch(/evaluableIndicatorValues\(liveIndicatorReadings\)/);
  });

  it("PWA manifest declares the served icons and scope", () => {
    const m = JSON.parse(src("client/public/manifest.json"));
    expect(m.scope).toBe("/");
    expect(m.icons.map((i: { src: string; sizes: string }) => `${i.src} ${i.sizes}`)).toEqual([
      "/icon-192x192.png 192x192",
      "/icon-512x512.png 512x512",
    ]);
    for (const icon of m.icons) {
      const png = readFileSync(resolve(root, "client/public", icon.src.slice(1)));
      expect(png.subarray(1, 4).toString()).toBe("PNG");
      const [w, h] = [png.readUInt32BE(16), png.readUInt32BE(20)];
      expect(`${w}x${h}`).toBe(icon.sizes);
    }
  });

  it("guests on /app/asha get an in-page sign-in prompt; ashaMemory queries mount only for a user", () => {
    const s = src("client/src/pages/AshaIntelligenceCenter.tsx");
    const gate = s.slice(s.indexOf("export default function AshaIntelligenceCenter"), s.indexOf("function AshaIntelligenceWorkspace"));
    expect(gate).toMatch(/if \(!user\) return <AshaGuestSignIn \/>;/);
    expect(gate).not.toMatch(/ashaMemory/);
    const workspace = s.slice(s.indexOf("function AshaIntelligenceWorkspace"));
    expect((workspace.match(/trpc\.ashaMemory\.\w+\.useQuery\(/g) ?? []).length).toBe(8);
    expect((s.match(/trpc\.ashaMemory\./g) ?? []).length).toBe((workspace.match(/trpc\.ashaMemory\./g) ?? []).length);
    // main.tsx redirect contract (Auth stream) is untouched by this change
    expect(src("client/src/main.tsx")).toMatch(/navigateToLogin\(\);/);
  });

  it("NOW formats source timestamps in ET; mobile pulse fails closed offline", () => {
    const now = src("client/src/pages/Now.tsx");
    expect(now).toMatch(/As of \{formatEt\(source\.asOf\)/);
    expect(now).not.toMatch(/lastUpdated\.toLocaleString\(\)/);
    const pulse = src("client/src/pages/mobile/MobilePulse.tsx");
    expect(pulse).toMatch(/fetchStatus === "paused"/);
    expect(pulse).toMatch(/canonicalLoading && !offlinePaused/);
  });
});
