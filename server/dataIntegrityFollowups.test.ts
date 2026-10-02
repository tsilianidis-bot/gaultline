/** Data Integrity follow-ups after PR #55 (Oct 2 2026). */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { INDICATOR_MAP, migrateOverallScale, evaluateBreach, type WatchlistItem } from "../client/src/lib/watchlist";

const root = resolve(import.meta.dirname, "..");
const src = (p: string) => readFileSync(resolve(root, p), "utf8");

describe("NOW timestamps (ET, labelled)", () => {
  it("no browser-local toLocaleTimeString in Now.tsx", () => {
    const s = src("client/src/pages/Now.tsx");
    expect(s).not.toMatch(/toLocaleTimeString\(/);
    expect((s.match(/formatEt\(lastUpdated\.getTime\(\)\)/g) ?? []).length).toBe(3);
  });
});

describe("Signals: canonical regime only", () => {
  const s = src("client/src/pages/Signals.tsx");
  it("no 'MODERATE RISK' fallback; priority tabs need a canonical regime code", () => {
    expect(s).not.toMatch(/\?\? 'MODERATE RISK'/);
    expect(s).toMatch(/const regimeCode = useMemo\(\(\) => \(canonicalRegimeLabel \? mapRegimeToCode\(canonicalRegimeLabel\) : null\)/);
    expect(s).toMatch(/const priorityCats: readonly ScreeningCategory\[\] = regimeCode \? REGIME_PRIORITY_CATEGORIES\[regimeCode\] : \[\];/);
  });
  it("narrative banner renders only with a canonical regime", () => {
    expect(s).toMatch(/\{regimeForSignals && \(\s*<div[^>]*>\s*<SeismographNarrativeBanner context="signals"/);
  });
});

describe("PLATO guest sign-in uses navigateToLogin's result", () => {
  it("shows a note when sign-in is unavailable", () => {
    const s = src("client/src/pages/AshaIntelligenceCenter.tsx");
    expect(s).toMatch(/setSignInUnavailable\(!navigateToLogin\(\)\)/);
    expect(s).toMatch(/Sign-in is unavailable right now/);
  });
});

describe("Watchlist overall score on the 0–100 scale", () => {
  const item = (thresholdValue: number, indicatorKey = "score_overall"): WatchlistItem => ({
    id: "x", indicatorKey, thresholdValue, condition: "above", severity: "high", createdAt: 0, breachCount: 0,
  });

  it("catalog uses /100 like NOW / Pressure", () => {
    const def = INDICATOR_MAP.score_overall;
    expect(def.unit).toBe("/100");
    expect([def.min, def.max, def.defaultThreshold]).toEqual([0, 100, 70]);
    expect(def.format(33)).toBe("33");
  });

  it("migrates saved 0–10 thresholds once; other indicators untouched", () => {
    const migrated = migrateOverallScale([item(7), item(500, "hySpread")], false);
    expect(migrated.map(i => i.thresholdValue)).toEqual([70, 500]);
    expect(migrateOverallScale(migrated, true).map(i => i.thresholdValue)).toEqual([70, 500]);
    // 33/100 does not breach the migrated "above 70" (and would have breached a raw 7)
    expect(evaluateBreach(migrated[0], 33)).toBe(false);
  });

  it("Watchlist page and header badge read the canonical Pressure Index directly", () => {
    const page = src("client/src/pages/Watchlist.tsx");
    expect(page).not.toMatch(/pressureIndex \/ 10/);
    expect(page).not.toMatch(/live visual alert|receive live alerts/);
    const layout = src("client/src/components/AppLayout.tsx");
    expect(layout).toMatch(/const overall100 = marketMode === 'canonical' \? canonicalState\?\.pressureIndex : null;/);
  });
});

describe("ScoreExplainer: yield-curve vector, not VIX", () => {
  it("the volatilityRegime entry describes DGS10/DGS2", () => {
    const s = src("client/src/components/ScoreExplainer.tsx");
    const entry = s.slice(s.indexOf("  volatilityRegime: {"), s.indexOf("color: (v) =>", s.indexOf("  volatilityRegime: {")));
    expect(entry).toMatch(/label: "Yield Curve \(10Y–2Y\) & 10Y Level"/);
    expect(entry).not.toMatch(/VIX levels|VIX term structure|implied and realized volatility across/);
    expect(entry).toMatch(/does not read VIX/);
  });
});
