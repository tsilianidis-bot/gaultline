/** Data Integrity follow-ups after PR #55 (Oct 2 2026). */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  INDICATOR_MAP, migrateOverallScale, evaluateBreach, loadWatchlist, saveWatchlist,
  getDefaultWatchlist, WATCHLIST_STORAGE_KEY, OVERALL_DEFAULT_THRESHOLD, type WatchlistItem,
} from "../client/src/lib/watchlist";

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

describe("GlobalMarketTicker observed time in ET", () => {
  it("uses formatEt with an ET label, not browser-local time", () => {
    const s = src("client/src/components/GlobalMarketTicker.tsx");
    expect(s).not.toMatch(/toLocaleTimeString\(/);
    expect(s).toMatch(/AS OF \$\{formatEt\(item\.observedAt\) \?\? "—"\}/);
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

  it("migrates unmarked 0–10 thresholds once; other indicators untouched", () => {
    const migrated = migrateOverallScale([item(7), item(500, "hySpread")]);
    expect(migrated.map(i => i.thresholdValue)).toEqual([70, 500]);
    expect(migrated[0].overallScale).toBe(100);
    expect(migrated[1].overallScale).toBeUndefined();
    expect(migrateOverallScale(migrated)).toEqual(migrated);
    // 33/100 does not breach the migrated "above 70" (and would have breached a raw 7)
    expect(evaluateBreach(migrated[0], 33)).toBe(false);
  });

  it("Watchlist live score carries a /100 suffix", () => {
    expect(src("client/src/pages/Watchlist.tsx")).toMatch(/def\.unit === '\/100' && <span data-watchlist-score-suffix[^>]*>\/100<\/span>/);
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
  it("does not claim steepening means high pressure (engine scores a steep curve low)", () => {
    const s = src("client/src/components/ScoreExplainer.tsx");
    const entry = s.slice(s.indexOf("  volatilityRegime: {"), s.indexOf("  }", s.indexOf("whyItMatters", s.indexOf("  volatilityRegime: {"))));
    expect(entry).not.toMatch(/re-steepening/i);
    expect(entry).toMatch(/A normal or steep curve scores low/);
  });
});

// ── loadWatchlist: every path, idempotent across loads and consumers ──────────
class MemoryStorage {
  store = new Map<string, string>();
  writes = 0;
  getItem(k: string) { return this.store.has(k) ? this.store.get(k)! : null; }
  setItem(k: string, v: string) { this.writes++; this.store.set(k, String(v)); }
  removeItem(k: string) { this.store.delete(k); }
  clear() { this.store.clear(); }
}

describe("loadWatchlist schema marker (inside faultline_watchlist_v1)", () => {
  let mem: MemoryStorage;
  const g = globalThis as unknown as { localStorage?: unknown };
  const prev = g.localStorage;
  beforeEach(() => { mem = new MemoryStorage(); g.localStorage = mem; });
  afterEach(() => { g.localStorage = prev; });

  const stored = (): WatchlistItem[] => JSON.parse(mem.getItem(WATCHLIST_STORAGE_KEY)!);
  const overall = (items: WatchlistItem[]) => items.filter(i => i.indicatorKey === "score_overall").map(i => i.thresholdValue);
  const legacy = (thresholdValue: unknown, extra: Partial<WatchlistItem> = {}) => ({
    id: `l-${String(thresholdValue)}`, indicatorKey: "score_overall", thresholdValue, condition: "above",
    severity: "high", createdAt: 1, breachCount: 0, ...extra,
  });
  /** Watchlist page, AppLayout badge, page again, a save round-trip, then two more loads. */
  const consumers = () => {
    const page = loadWatchlist();
    const badge = loadWatchlist();
    const again = loadWatchlist();
    saveWatchlist(page);
    const afterSave = loadWatchlist();
    const last = loadWatchlist();
    return { page, badge, again, afterSave, last };
  };
  const expectStable = (expected: number[]) => {
    const r = consumers();
    for (const items of Object.values(r)) expect(overall(items)).toEqual(expected);
    expect(overall(stored())).toEqual(expected);
    expect(stored().filter(i => i.indicatorKey === "score_overall").every(i => i.overallScale === 100)).toBe(true);
    for (const v of overall(stored())) { expect(v).not.toBeNull(); expect(v).toBeGreaterThan(0); }
  };

  it("no key: stores fresh defaults already marked /100 (70 never becomes 700)", () => {
    const first = loadWatchlist();
    expect(overall(first)).toEqual([OVERALL_DEFAULT_THRESHOLD]);
    expect(overall(stored())).toEqual([70]);
    expect(stored()[0].overallScale).toBe(100);
    expectStable([70]);
  });

  it("empty-string key behaves like no key", () => {
    mem.setItem(WATCHLIST_STORAGE_KEY, "");
    expectStable([70]);
  });

  it("corrupt JSON: replaced by marked /100 defaults", () => {
    mem.setItem(WATCHLIST_STORAGE_KEY, "{not json");
    expect(overall(loadWatchlist())).toEqual([70]);
    expectStable([70]);
  });

  it("non-array JSON: replaced by marked /100 defaults", () => {
    mem.setItem(WATCHLIST_STORAGE_KEY, JSON.stringify({ items: [legacy(7)] }));
    expectStable([70]);
  });

  it("catch path (storage throws): returns marked /100 defaults without writing", () => {
    g.localStorage = {
      getItem() { throw new Error("SecurityError"); },
      setItem() { throw new Error("SecurityError"); },
    };
    for (let i = 0; i < 3; i++) {
      const items = loadWatchlist();
      expect(overall(items)).toEqual([70]);
      expect(items[0].overallScale).toBe(100);
    }
    expect(() => saveWatchlist(getDefaultWatchlist())).not.toThrow();
  });

  it("setItem throws (quota) on a legacy list: still returns migrated values", () => {
    mem.setItem(WATCHLIST_STORAGE_KEY, JSON.stringify([legacy(7.5)]));
    mem.setItem = () => { throw new Error("QuotaExceededError"); };
    expect(overall(loadWatchlist())).toEqual([75]);
    expect(overall(loadWatchlist())).toEqual([75]);
  });

  it("already migrated (marked) values are never scaled again, even ≤ 10", () => {
    mem.setItem(WATCHLIST_STORAGE_KEY, JSON.stringify([legacy(70, { overallScale: 100 }), legacy(5, { overallScale: 100 })]));
    const writesBefore = mem.writes;
    expect(overall(loadWatchlist())).toEqual([70, 5]);
    expect(mem.writes).toBe(writesBefore); // nothing to rewrite
    expectStable([70, 5]);
  });

  it("mixed legacy values and other indicators: only unmarked score_overall ≤ 10 scale ×10", () => {
    mem.setItem(WATCHLIST_STORAGE_KEY, JSON.stringify([
      legacy(7), legacy(3.3), legacy(65), legacy(80, { overallScale: 100 }),
      { ...legacy(450), indicatorKey: "hySpread" }, { ...legacy(4.68), indicatorKey: "yield10Y" },
    ]));
    expectStable([70, 33, 65, 80]);
    const others = stored().filter(i => i.indicatorKey !== "score_overall");
    expect(others.map(i => i.thresholdValue)).toEqual([450, 4.68]);
    expect(others.every(i => i.overallScale === undefined)).toBe(true);
  });

  it("null threshold falls back to 70", () => {
    mem.setItem(WATCHLIST_STORAGE_KEY, JSON.stringify([legacy(null)]));
    expectStable([70]);
  });

  it("NaN threshold (serialised as null) and non-numeric strings fall back to 70", () => {
    mem.setItem(WATCHLIST_STORAGE_KEY, JSON.stringify([legacy(Number.NaN), legacy("abc"), legacy("7")]));
    expectStable([70, 70, 70]);
  });

  it("0, negative and missing thresholds fall back to 70 (never store 0)", () => {
    mem.setItem(WATCHLIST_STORAGE_KEY, JSON.stringify([legacy(0), legacy(-3), legacy(undefined), legacy(0, { overallScale: 100 })]));
    expectStable([70, 70, 70, 70]);
  });

  it("> 10 values are left as they are", () => {
    mem.setItem(WATCHLIST_STORAGE_KEY, JSON.stringify([legacy(10.5), legacy(55), legacy(100)]));
    expectStable([10.5, 55, 100]);
  });

  it("boundary: exactly 10 is a legacy 0–10 value → 100", () => {
    mem.setItem(WATCHLIST_STORAGE_KEY, JSON.stringify([legacy(10)]));
    expectStable([100]);
  });

  it("junk entries are dropped, valid ones kept", () => {
    mem.setItem(WATCHLIST_STORAGE_KEY, JSON.stringify([null, 5, "x", legacy(6)]));
    expectStable([60]);
  });

  it("saving a new /100 item from the modal marks it, so later loads don't scale it", () => {
    loadWatchlist();
    const created: WatchlistItem = { id: "new", indicatorKey: "score_overall", thresholdValue: 8, condition: "above", severity: "high", createdAt: 2, breachCount: 0 };
    saveWatchlist([...loadWatchlist(), created]);
    expectStable([70, 8]);
  });

  it("an unmarked list written later by an old (0–10) bundle is migrated on the next load", () => {
    loadWatchlist();
    mem.setItem(WATCHLIST_STORAGE_KEY, JSON.stringify([legacy(7)])); // old bundle rewrites without marker
    expectStable([70]);
  });
});
