/** Data Integrity follow-ups after PR #55 (Oct 2 2026). */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  INDICATOR_MAP, migrateOverallScale, evaluateBreach, loadWatchlist, saveWatchlist,
  getDefaultWatchlist, WATCHLIST_STORAGE_KEY, OVERALL_DEFAULT_THRESHOLD, OVERALL_DEFAULT_BELOW_THRESHOLD,
  LEGACY_OVERALL_SCALE_KEY, overallFallbackThreshold, type WatchlistItem,
} from "../client/src/lib/watchlist";
import {
  aiWatchTiles, selectAiBubbleRisk, AI_CONCENTRATION_STATIC_BASELINE_PCT,
} from "../client/src/lib/aiWatchMetrics";
import { PRESSURE_VECTOR_DISPLAY } from "../shared/pressureVectorLabels";

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
    for (const v of overall(stored())) { expect(typeof v).toBe("number"); expect(Number.isFinite(v)).toBe(true); expect(v).toBeGreaterThanOrEqual(0); }
    expect(mem.getItem(LEGACY_OVERALL_SCALE_KEY)).toBeNull();
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

  it("0 is a legitimate threshold (edit-dialog minimum) and is kept; negative and missing fall back", () => {
    mem.setItem(WATCHLIST_STORAGE_KEY, JSON.stringify([legacy(0), legacy(-3), legacy(undefined), legacy(0, { overallScale: 100 })]));
    expectStable([0, 70, 70, 0]);
  });

  it("saving 0 from the edit dialog stays 0 (not silently 70)", () => {
    loadWatchlist();
    const zero: WatchlistItem = { id: "z", indicatorKey: "score_overall", thresholdValue: 0, condition: "below", severity: "moderate", createdAt: 3, breachCount: 0 };
    saveWatchlist([...loadWatchlist(), zero]);
    expectStable([70, 0]);
  });

  it("fallback respects direction: invalid 'below' items become below 20, never below 70", () => {
    expect(overallFallbackThreshold("above")).toBe(OVERALL_DEFAULT_THRESHOLD);
    expect(overallFallbackThreshold("below")).toBe(OVERALL_DEFAULT_BELOW_THRESHOLD);
    mem.setItem(WATCHLIST_STORAGE_KEY, JSON.stringify([
      legacy(null, { condition: "below" }), legacy(-1, { condition: "below" }), legacy("x", { condition: "below", overallScale: 100 }),
      legacy(null, { condition: "above" }),
    ]));
    expectStable([20, 20, 20, 70]);
    // A normal 33/100 reading does not breach any of the fallbacks.
    for (const item of loadWatchlist()) expect(evaluateBreach(item, 33)).toBe(false);
    // saveWatchlist applies the same direction-aware fallback.
    saveWatchlist([{ id: "b", indicatorKey: "score_overall", thresholdValue: Number.NaN, condition: "below", severity: "high", createdAt: 4, breachCount: 0 }]);
    expect(overall(stored())).toEqual([20]);
  });

  it("legacy 0.5 / 1.0 (old 0–10 scale) convert once to 5 / 10 across six loads", () => {
    mem.setItem(WATCHLIST_STORAGE_KEY, JSON.stringify([legacy(0.5), legacy(1), legacy(0.5, { condition: "below" })]));
    expectStable([5, 10, 5]);
  });

  it("leftover 96c3256 flag: unmarked values were already /100, so they are not scaled again; the flag is removed", () => {
    mem.setItem(LEGACY_OVERALL_SCALE_KEY, "100");
    mem.setItem(WATCHLIST_STORAGE_KEY, JSON.stringify([legacy(5), legacy(70), legacy(0.5)]));
    expectStable([5, 70, 0.5]);
  });

  it("leftover 96c3256 flag is kept if the marked list could not be persisted (no double ×10 later)", () => {
    mem.setItem(LEGACY_OVERALL_SCALE_KEY, "100");
    mem.setItem(WATCHLIST_STORAGE_KEY, JSON.stringify([legacy(5)]));
    const realSet = mem.setItem.bind(mem);
    mem.setItem = () => { throw new Error("QuotaExceededError"); };
    expect(overall(loadWatchlist())).toEqual([5]);
    expect(mem.getItem(LEGACY_OVERALL_SCALE_KEY)).toBe("100");
    mem.setItem = realSet;
    expectStable([5]);
  });

  it("leftover flag with no list: defaults stored, flag removed", () => {
    mem.setItem(LEGACY_OVERALL_SCALE_KEY, "100");
    expectStable([70]);
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

// ── Launch blocker: no hard-coded prices / levels (James, Oct 2 11:42 AM ET) ──
describe("no hard-coded current-looking prices or price levels", () => {
  // Numeric literal on a price/level key, or a $-figure on any target key.
  const PRICE_LEVEL_KEYS = /\b(price|currentPrice|lastPrice|support|resistance|targetPrice|priceTarget|stopLoss|entryZone|invalidationLevel|profitTargets|riskReward)\s*:\s*(\[\s*)?['"`]?\$?[0-9]|\b(target|stop|entry|invalidation)\w*\s*:\s*(\[\s*)?['"`]\$[0-9]/;
  const DOLLAR_LEVEL = /(support|resistance|target|stop|entry|invalidat|close (above|below))[^'"`\n]{0,40}\$[0-9]/i;

  it("signalsData.ts catalog has no price, level, target, stop or invalidation literals", async () => {
    const s = src("client/src/lib/signalsData.ts");
    expect(s).not.toMatch(PRICE_LEVEL_KEYS);
    expect(s).not.toMatch(DOLLAR_LEVEL);
    // Only market-cap bucket labels may contain a $ figure.
    const dollarLines = s.split("\n").filter(l => /\$[0-9]/.test(l));
    expect(dollarLines.every(l => /marketCapRange:/.test(l))).toBe(true);
    const { SIGNAL_STOCKS } = await import("../client/src/lib/signalsData");
    for (const st of SIGNAL_STOCKS as unknown as Record<string, unknown>[]) {
      for (const k of ["price", "support", "resistance", "entryZone", "stopLoss", "profitTargets", "riskReward", "invalidationLevel"]) {
        expect(st[k], `${st.ticker}.${k}`).toBeUndefined();
      }
    }
  });

  it("client/shared app code (outside public SEO pages owned by Claims) has no hard-coded price levels", () => {
    const { readdirSync, statSync } = require("node:fs") as typeof import("node:fs");
    const files: string[] = [];
    const walk = (d: string) => {
      for (const n of readdirSync(d)) {
        const p = resolve(d, n);
        if (statSync(p).isDirectory()) { if (n !== "seo" && n !== "node_modules") walk(p); }
        else if (/\.(ts|tsx)$/.test(n) && !/\.test\./.test(n)) files.push(p);
      }
    };
    walk(resolve(root, "client/src")); walk(resolve(root, "shared"));
    const offenders = files.flatMap(f => readFileSync(f, "utf8").split("\n").map((l, i) => ({ f, i: i + 1, l })))
      .filter(({ l }) => PRICE_LEVEL_KEYS.test(l) || DOLLAR_LEVEL.test(l))
      // Subscription plan prices ('$0' FREE tier) are not market prices.
      .filter(({ f, l }) => !(/ProductExperience\.tsx$/.test(f) && /price: '\$0'/.test(l)))
      .map(({ f, i, l }) => `${f.replace(root + "/", "")}:${i}: ${l.trim().slice(0, 100)}`);
    expect(offenders).toEqual([]);
  });

  it("Signals card: static catalog block shows no levels; levels carry source + ET as-of or are UNAVAILABLE", () => {
    const s = src("client/src/pages/Signals.tsx");
    expect(s).not.toMatch(/stock\.(entryZone|support|resistance|stopLoss|profitTargets|riskReward|invalidationLevel|price)\b/);
    expect(s).toMatch(/CATALOG NOTES · STATIC REFERENCE, NOT MARKET DATA/);
    expect(s).toMatch(/KEY PRICE LEVELS · UNAVAILABLE/);
    expect((s.match(/priceLevelsBasis\(liveQuote, quote\.badge\)/g) ?? []).length).toBe(2);
    expect(s).toMatch(/const asOf = quote \? formatEt\(quote\.timestamp\) : null;/);
  });

  it("NOW deep-view illustrative example binds no real quote (QA gate r3 D4)", () => {
    const s = src("client/src/components/HomeStockIntelSection.tsx");
    expect(s).not.toMatch(/price: [0-9]/);
    expect(s).not.toMatch(/change: [+-]?[0-9]/);
    expect(s).not.toMatch(/Live Signal Preview/);
    // A real live quote beside a static BUY / 84% reads as a current call: no quote feed in the example.
    expect(s).not.toMatch(/\/api\/signals\/quotes/);
    expect(s).not.toMatch(/signalQuoteView|liveQuote/);
    expect(s).toMatch(/EXAMPLE · NO QUOTE/);
    expect(s).toMatch(/data-example-label/);
    expect(s).toMatch(/Illustrative Example, Not Current Signals/);
  });

  it("dashboard search panels label quote/screener times in ET with their source", () => {
    const s = src("client/src/components/DashboardSearchPanels.tsx");
    expect(s).not.toMatch(/toLocaleTimeString\(/);
    expect(s).toMatch(/Signals quote · as of \{formatEt\(liveQ\.timestamp \?\? null\)/);
    expect(s).toMatch(/Crypto screener · as of \{lastUpdated\}/);
  });

  it("AIWatch: no unsourced $214B capex figure", () => {
    const s = src("client/src/pages/AIWatch.tsx");
    expect(s).not.toMatch(/\$214B/);
    expect(aiWatchTiles().find(t => t.id === "ai-capex")?.value).toBe("Not tracked");
  });
});

describe("PR #59 r2 nits", () => {
  it("Watchlist card falls back on an unknown severity instead of crashing", () => {
    expect(src("client/src/pages/Watchlist.tsx")).toMatch(/SEVERITY_CONFIG\[item\.severity\] \?\? SEVERITY_CONFIG\.moderate/);
  });
  it("ScoreExplainer 55+ band no longer says a high 10Y alone ('and/or') adds meaningful pressure", () => {
    const s = src("client/src/components/ScoreExplainer.tsx");
    expect(s).not.toMatch(/and\/or a high 10Y/);
    expect(s).toMatch(/A high 10Y alone keeps this vector low/);
  });
});

// ── AI Sector Watch (/app/watch/deep): no unsourced tiles ─────────────────────
describe("AIWatch tiles: canonical, static baseline, or Not tracked", () => {
  const page = src("client/src/pages/AIWatch.tsx");
  const lib = src("client/src/lib/aiWatchMetrics.ts");
  const engine = (over: Record<string, unknown> = {}) => ({
    engineId: "ai-bubble", engineName: "ai-bubble", value: 44, unit: "score_0_to_100", classification: null,
    direction: "Unknown", acceleration: null, persistence: null, observedAt: null,
    calculatedAt: "2026-10-01T18:00:34.034Z", sourceInputIds: ["ai_concentration_static_baseline"],
    qualityStatus: "PARTIAL", freshnessStatus: "CURRENT", fallbackStatus: "NONE",
    modelVersion: "m", calculationVersion: "c", contributionToComposite: true, ...over,
  });
  const state = (engines: unknown[]) => ({ engines, effectiveAt: "2026-10-01T18:00:34.034Z" }) as never;

  it("no hard-coded AI figures, deltas or bubble grade come back", () => {
    for (const s of [page, lib]) {
      expect(s).not.toMatch(/2\.4M|\$890B|\$214B|8\.6\/10|\+42%|\+180%|\+65%|\+1\.8%|YoY/);
      expect(s).not.toMatch(/Bubble Risk: CRITICAL/);
    }
    expect(page).not.toMatch(/32\.4/); // baseline only via the labelled constant
    expect(page).not.toMatch(/\bdelta:/);
  });

  it("capex, GPU orders and startup valuations are Not tracked; concentration is a labelled static baseline", () => {
    const tiles = Object.fromEntries(aiWatchTiles().map(t => [t.id, t]));
    for (const id of ["ai-capex", "gpu-orders", "ai-startup-valuations"]) expect(tiles[id].value).toBe("Not tracked");
    expect(tiles["ai-concentration"].label).toMatch(/Static Baseline/);
    expect(tiles["ai-concentration"].value).toBe("~32.4%");
    expect(tiles["ai-concentration"].note).toMatch(/not live, no change tracked/);
    expect(tiles["ai-concentration"].note).not.toMatch(/[+-]\d/);
    // same reference value the engine and vector label describe
    expect(PRESSURE_VECTOR_DISPLAY["ai-bubble"].description).toContain(`${AI_CONCENTRATION_STATIC_BASELINE_PCT}%`);
    expect(src("server/pressure/engine.ts")).toContain(`Static ${AI_CONCENTRATION_STATIC_BASELINE_PCT}% AI-concentration baseline`);
  });

  it("AI / Speculation score binds to the canonical ai-bubble engine on /100 with source and ET as-of", () => {
    const v = selectAiBubbleRisk(state([engine()]));
    expect(v.available).toBe(true);
    expect(v.value).toBe("44/100");
    expect(v.label).toBe("AI / Speculation (Static Baseline)");
    expect(v.basis).toMatch(/^Canonical Pressure Index · AI \/ Speculation vector/);
    expect(v.basis).toMatch(/as of .* ET/);
    expect(v.basis).toMatch(/quality PARTIAL/);
    expect(page).toMatch(/trpc\.marketState\.canonicalCurrent\.useQuery/);
    expect(page).toMatch(/selectAiBubbleRisk\(canonicalQuery\.data \?\? null/);
  });

  it("prod fixture ai-bubble value renders as its /100 score", () => {
    const fx = JSON.parse(src("server/__fixtures__/prod-2026-10-01/canonical-current.json"));
    const st = fx.state ?? fx;
    const e = st.engines.find((x: { engineId: string }) => x.engineId === "ai-bubble");
    expect(selectAiBubbleRisk(st).value).toBe(`${Math.round(e.value)}/100`);
  });

  it("no state, no engine, null / non-finite / out-of-range value or wrong unit → Unavailable", () => {
    expect(selectAiBubbleRisk(null).value).toBe("Unavailable");
    expect(selectAiBubbleRisk(undefined, { isLoading: true }).basis).toMatch(/Loading/);
    expect(selectAiBubbleRisk(state([])).value).toBe("Unavailable");
    for (const bad of [null, Number.NaN, Infinity, -1, 101]) {
      expect(selectAiBubbleRisk(state([engine({ value: bad })])).value).toBe("Unavailable");
    }
    expect(selectAiBubbleRisk(state([engine({ unit: "score_0_to_10", value: 8.6 })])).value).toBe("Unavailable");
  });

  it("non-current freshness is shown, not hidden", () => {
    expect(selectAiBubbleRisk(state([engine({ freshnessStatus: "STALE" })])).basis).toMatch(/STALE/);
  });
});

describe("ScoreExplainer yield-curve bands match the engine maximum (74)", () => {
  const s = src("client/src/components/ScoreExplainer.tsx");
  const block = s.slice(s.indexOf("volatilityRegime: {"), s.indexOf("watchNext", s.indexOf("volatilityRegime: {")));
  it("no unreachable 75–100 'Extreme Curve Pressure' band; 55–74 is the top band", () => {
    expect(block).not.toMatch(/Extreme Curve Pressure/);
    expect(block).not.toMatch(/75–100/);
    expect(block).not.toMatch(/v >= 75/);
    expect(block).toMatch(/\{ label: "High Curve Pressure", range: "55–74"/);
  });
  it("engine formula still caps at 74 (0.6 × 90 + 0.4 × 50), so no scoring change is implied", () => {
    const e = src("server/pressure/engine.ts");
    expect(e).toMatch(/if \(spread < -1\.0\) spreadScore = 90;/);
    expect(e).toMatch(/linearMap\(tsy10y, 2\.5, 6, 0, 50\)/);
    expect(e).toMatch(/Math\.round\(spreadScore \* 0\.6 \+ rateScore \* 0\.4\)/);
  });
});

describe("AIWatch feed + data.ts: no undated / unsourced items, no $214B", () => {
  const data = src("client/src/lib/data.ts");
  it("feed holds no relative-time stamps and every item type requires publishedAt + source", async () => {
    const mod = await import("../client/src/lib/data");
    for (const item of mod.aiWatchItems) {
      expect(Number.isNaN(Date.parse(item.publishedAt))).toBe(false);
      expect(item.source.name.length).toBeGreaterThan(0);
      expect(item.source.url).toMatch(/^https:\/\//);
    }
    const feed = data.slice(data.indexOf("// ---- AI Watch Feed ----"), data.indexOf("// ---- Alerts ----"));
    expect(feed).not.toMatch(/timestamp:\s*'\d+[hd] ago'/);
    expect(feed).not.toMatch(/\$6\.6B|\$157B|Claude 4|Gemini Ultra/);
    expect(data).toMatch(/publishedAt: string;/);
    expect(data).toMatch(/source: \{ name: string; url: string \};/);
  });
  it("data.ts no longer carries the $214B AI capex metric", () => {
    expect(data).not.toMatch(/\$214B/);
    expect(data).not.toMatch(/id: 'ai-capex'/);
  });
  it("AIWatch shows the feed as Unavailable when empty and dates items in ET with source", () => {
    const page = src("client/src/pages/AIWatch.tsx");
    expect(page).toMatch(/AI Headline Feed · Unavailable/);
    expect(page).toMatch(/\{formatEt\(item\.publishedAt\) \?\? '—'\} · \{item\.source\.name\}/);
    expect(page).not.toMatch(/item\.timestamp/);
    expect(page).not.toMatch(/has reached 32\.4%/);
  });
});

// ── Charts tab ribbon: canonical readings or Unavailable / Not tracked ───────
describe("Charts Market Intelligence Ribbon (no fixed values, no MODEL lines)", async () => {
  const { buildChartsInstruments, quoteAsOf } = await import("../client/src/lib/chartsInstrumentReadings");
  const charts = src("client/src/pages/Charts.tsx");
  const ribbon = charts.slice(charts.indexOf("function InstitutionalWidgets()"), charts.indexOf("// ── Main Charts Page"));
  const NOW = Date.parse("2026-10-02T18:00:00Z");
  const q = (symbol: string, price: number | null, extra: Record<string, unknown> = {}) => ({
    symbol, shortLabel: symbol, price, changePercent: 0, freshnessState: "delayed", sessionStatus: "OPEN",
    unit: undefined, proxySymbol: undefined, observedAt: NOW - 15 * 60_000, source: "yahoo", ...extra,
  }) as never;

  it("source: no hard-coded VIX 22.8 / 10Y 4.42 / HY 380 / curve -0.42, no seeded sparklines, no MODEL badge", () => {
    expect(ribbon).not.toMatch(/'22\.8'|'4\.42'|'380'|'-0\.42'|'72'|'5\.8'/);
    expect(ribbon).not.toMatch(/buildW\(|seededRandW|LineChart/);
    expect(ribbon).not.toMatch(/MODEL/);
    expect(ribbon).not.toMatch(/Alpha Vantage|FINRA|TradingView|API integration ready/);
    expect(ribbon).toMatch(/trpc\.markets\.getGlobalSnapshot\.useQuery/);
    expect(ribbon).toMatch(/useAppHeaderFred\(\)/);
  });

  it("binds VIX / 10Y / curve / HY with source + as-of; ET time for quotes, observation date for FRED", () => {
    const views = buildChartsInstruments({
      quotes: [
        q("^VIX", 17.3),
        q("FRED:DGS10", 4.11, { source: "fred", freshnessState: "delayed", sessionStatus: "CLOSED", unit: "percent", observedAt: Date.parse("2026-10-01T00:00:00Z") }),
        q("DERIVED:2Y10Y", 52, { source: "derived:FRED", unit: "bps", sessionStatus: "CLOSED", observedAt: Date.parse("2026-10-01T00:00:00Z") }),
      ],
      fred: { BAMLH0A0HYM2: [{ date: "2026-10-01", value: "2.95" }] },
      now: NOW,
    });
    const by = Object.fromEntries(views.map(v => [v.id, v]));
    expect(by.vix).toMatchObject({ status: "bound", value: "17.3" });
    expect(by.vix.basis).toMatch(/markets\.getGlobalSnapshot \^VIX · as of .* ET$/);
    expect(by.treasury).toMatchObject({ status: "bound", value: "4.11", unit: "%" });
    expect(by.treasury.basis).toMatch(/as of 2026-10-01 \(FRED observation date\)/);
    expect(by["yield-curve"]).toMatchObject({ status: "bound", value: "52", unit: "bps" });
    expect(by["credit-spread"]).toMatchObject({ status: "bound", value: "295", unit: "bps" });
    expect(by["credit-spread"].basis).toBe("FRED BAMLH0A0HYM2 · as of 2026-10-01 (observation date)");
    expect(by["ai-sentiment"].value).toBe("Not tracked");
    expect(by.liquidity.value).toBe("Not tracked");
  });

  it("no snapshot / no FRED → every bound instrument is Unavailable (never a default number)", () => {
    const views = buildChartsInstruments({ quotes: null, fred: {}, now: NOW });
    for (const v of views) expect(["Unavailable", "Not tracked"]).toContain(v.value);
    expect(views.filter(v => v.status === "unavailable").map(v => v.id).sort()).toEqual(["credit-spread", "treasury", "vix", "yield-curve"]);
  });

  it("quoteAsOf never turns a FRED date into a clock time", () => {
    expect(quoteAsOf({ observedAt: Date.parse("2026-10-01T00:00:00Z"), source: "fred" })).toBe("2026-10-01 (FRED observation date)");
    expect(quoteAsOf({ observedAt: null, source: "yahoo" })).toMatch(/no observation time/);
  });
});

// ── PR #59 r5: QA prod consistency (snapshot-1401) + gate r3/r4 D1–D5 ─────────
import { signalQuoteBadge, signalQuoteView, signalsFeedLabel, signalsPriceBadge, signalsFooter } from "../client/src/lib/signalQuoteView";
import { pressureVectorWeight, pressureVectorLevel, canonicalVectorScore, vectorScoreText, contagionSummary, topScoredVectors } from "../client/src/lib/pressureVectorWeights";
import { macroCardSourceText } from "../client/src/lib/chartsInstrumentReadings";
import { canonicalSummary, sandboxScoreOn100, SANDBOX_BASIS } from "../client/src/lib/simulatePressureView";
import { canonicalFreshnessReadout } from "../shared/dataIntegrityReadout";

describe("composite is the canonical /100 Pressure Index, never a 0–10 score", () => {
  it("Charts: canonical displayScore / 100 with the header integrity label, no '/ 10.0', no 'Composite Score · Live'", () => {
    const s = src("client/src/pages/Charts.tsx");
    expect(s).not.toMatch(/\/ 10\.0/);
    expect(s).not.toMatch(/Composite Score · Live/);
    expect(s).not.toMatch(/getSystemicPressureData|getSystemicPressureSnapshot|output\.overall\.score/);
    expect(s).toMatch(/const view = usePressureSnapshot\(\);/);
    expect(s).toMatch(/\{ready \? '\/ 100' :/);
    expect(s).toMatch(/`\$\{integrityLabel\} · Canonical Pressure Index · as of \$\{asOf \?\? '—'\} · evidence/);
  });

  it("SimulatePressure: canonical score when not simulating, sandbox ×10 labelled SANDBOX when simulating", () => {
    const s = src("client/src/pages/SimulatePressure.tsx");
    // Slider inputs show their 0–10 input scale in the sublabel, not as "x/10".
    expect(s).not.toMatch(/\/ 10\.0|\/ ?10\b/);
    expect(s).not.toMatch(/Live market conditions/);
    expect(s).toMatch(/label: 'Example Defaults'/);
    expect(s).toMatch(/EXAMPLE DEFAULTS · NOT LIVE/);
    expect(s).toMatch(/SIMULATED REGIME \(SANDBOX\)/);
    expect(s).not.toMatch(/buildScoreHistory|Math\.random/);
    expect(sandboxScoreOn100(3.4)).toBe(34);
    expect(sandboxScoreOn100(4.5)).toBe(45);
    expect(sandboxScoreOn100(NaN)).toBeNull();
    expect(SANDBOX_BASIS).toMatch(/not live/);
    const engines = [
      { engineId: "liquidity-stress", engineName: "liquidity-stress", value: 23, unit: "score_0_to_100" },
      { engineId: "labor-rates", engineName: "labor-rates", value: 29, unit: "score_0_to_100" },
      { engineId: "x", engineName: "x", value: null, unit: "score_0_to_100" },
    ];
    const sum = canonicalSummary({ pressureIndex: 34, regime: "MODERATE RISK", effectiveAt: "2026-10-02T18:01:25.427Z", engines, confidenceOrEvidenceQuality: "PARTIAL" } as never);
    expect(sum).toMatchObject({ available: true, score: 34, regime: "MODERATE RISK" });
    if (sum.available) {
      // A missing engine value stays null (rendered "—"), never dropped into a 0.
      expect(sum.vectors.map(v => v.value)).toEqual([23, 29, null]);
      expect(sum.basis).toMatch(/ET · evidence PARTIAL$/);
    }
    expect(canonicalSummary(null).available).toBe(false);
    expect(canonicalSummary({ pressureIndex: 34, confidenceOrEvidenceQuality: "UNAVAILABLE", engines: [] } as never).available).toBe(false);
  });

  it("Signals regime-score is already the canonical /100 (QA ref 1804 is prod ce491b3)", () => {
    const s = src("client/src/pages/Signals.tsx");
    expect(s).not.toMatch(/regime-score[\s\S]{0,200}\/10\b/);
  });
});

describe("Pressure vectors: the engine's real weights and each vector's own level", () => {
  it("weights by engine id match the engine (20/20/15/20/10/15) and sum to 1", () => {
    const ids = ["liquidity-stress", "credit-contagion", "volatility-regime", "macro-sensitivity", "market-breadth", "ai-bubble"];
    expect(ids.map(id => pressureVectorWeight(id))).toEqual([0.2, 0.2, 0.15, 0.2, 0.1, 0.15]);
    expect(ids.reduce((a, id) => a + (pressureVectorWeight(id) ?? 0), 0)).toBeCloseTo(1, 10);
    expect(pressureVectorWeight("unknown-engine")).toBeNull();
    expect(pressureVectorWeight("liquidity-stress", false)).toBeNull();
    // Same id → weight pairs as the engine's own vector table.
    const engine = src("server/pressure/engine.ts");
    const pairs = [...engine.matchAll(/id: "([a-z-]+)",[\s\S]{0,600}?weight: ([0-9.]+),/g)].map(m => [m[1], Number(m[2])]);
    expect(pairs).toEqual(ids.map(id => [id, pressureVectorWeight(id)]));
  });

  it("each vector's level is its own score on the engine thresholds (80/65/45/25), not the composite's", () => {
    expect([23, 29, 40, 44, 45, 65, 80].map(pressureVectorLevel)).toEqual(["Low", "Moderate", "Moderate", "Moderate", "Elevated", "High", "Critical"]);
    expect(pressureVectorLevel(null)).toBeNull();
    expect(pressureVectorLevel(Number.NaN)).toBeNull();
    const engine = src("server/pressure/engine.ts");
    expect(engine).toMatch(/score >= 80[\s\S]{0,80}score >= 65[\s\S]{0,80}score >= 45[\s\S]{0,80}score >= 25/);
    const p = src("client/src/pages/Pressure.tsx");
    expect(p).toMatch(/weight: pressureVectorWeight\(engine\.engineId, engine\.contributionToComposite\)/);
    expect(p).toMatch(/level: pressureVectorLevel\(engine\.value\),/);
    expect(p).not.toMatch(/levelKnown/);
    expect(p).not.toMatch(/weight: null,/);
  });
});

describe("Signals quote freshness follows the feed (QA D1, strip says DELAYED)", () => {
  const open = { price: 100, changePercent: 1, isLive: true, marketStatus: "open" };
  it("a delayed (Yahoo) open-session quote is DELAYED, never LIVE; the footer is not 'LIVE DATA'", () => {
    const yahoo = { ...open, isDelayed: true };
    expect(signalQuoteBadge(yahoo)).toBe("DELAYED");
    const feed = signalsFeedLabel({ source: "live", quotes: [yahoo], tickerCount: 1 });
    expect(feed.label).toBe("YAHOO FINANCE · DELAYED");
    expect(signalsFooter(feed).title).toBe("DELAYED");
    expect(signalsPriceBadge([yahoo]).label).toBe("DELAYED");
  });

  it("a stale-cache response is STALE per quote and in the header, even if the cached quote says isLive", () => {
    expect(signalQuoteBadge(open, "stale")).toBe("STALE");
    expect(signalQuoteBadge({ ...open, feedSource: "stale" })).toBe("STALE");
    expect(signalQuoteView({ ...open, feedSource: "stale" }).badge).toBe("STALE");
    expect(signalQuoteBadge(open, "fallback")).toBe("UNAVAILABLE");
    expect(signalsPriceBadge([open], "stale").label).toBe("STALE");
    expect(signalsFeedLabel({ source: "stale", quotes: [open], tickerCount: 1 }).label).toBe("STALE CACHE");
  });

  it("Signals page stamps the response source on every quote and passes it to the header badge", () => {
    const s = src("client/src/pages/Signals.tsx");
    expect(s).toMatch(/map\.set\(q\.ticker, \{ \.\.\.q, feedSource: quotesData\?\.source \?\? null \}\);/);
    expect(s).toMatch(/signalsPriceBadge\(quotesData\?\.quotes, quotesData\?\.source \?\? null\)/);
    expect(s).toMatch(/function fmtTimestamp\(ts: string \| null\): string \{\s*return formatEt\(ts\) \?\? '—';/);
    expect(s).not.toMatch(/toLocaleTimeString\(/);
  });

  it("server: Yahoo quotes carry isDelayed, the stale cache is served not-live, quote time is market time", () => {
    const s = src("server/signalsProxy.ts");
    expect(s).toMatch(/isLive: true,\s*isDelayed: yahooQ\.isDelayed \?\? true,/);
    expect(s).toMatch(/quotes: quotesCache\.quotes\.map\(q => \(\{ \.\.\.q, isLive: false \}\)\),\s*timestamp: new Date\(quotesCache\.fetchedAt\)\.toISOString\(\),\s*marketStatus: quotesCache\.marketStatus,\s*tradeDate: quotesCache\.tradeDate,\s*source: "stale"/);
    // QA D2: no quote is stamped with the fetch time.
    expect(s).not.toMatch(/^\s+timestamp: Date\.now\(\),$/m);
    expect(s).not.toMatch(/bar\.t \?\? Date\.now\(\)/);
    expect((s.match(/timestamp: yahooQ\.observedAt \?\? null,/g) ?? []).length).toBe(3);
    const signals = src("client/src/pages/Signals.tsx");
    expect(signals).toMatch(/Signals quote\$\{asOf \? ` · as of \$\{asOf\}` : ''\}/);
  });

  it("ticker search shows the real freshness badge, not a bare LIVE", () => {
    const s = src("client/src/components/TickerSearch.tsx");
    // One badge from the quote and its response source (stale → STALE), no separate STALE chip.
    expect(s).toMatch(/const badge = signalQuoteBadge\(profile, profile\.source\);/);
    expect(s).toMatch(/data-ticker-freshness=\{badge\}/);
    expect(s).not.toMatch(/\}\}>LIVE<\/span>|\}\}>STALE<\/span>/);
    expect(signalQuoteBadge({ price: 10, changePercent: 1, isLive: true, isDelayed: true, marketStatus: "open" }, "stale")).toBe("STALE");
  });
});

describe("Signals card: details reachable, catalog tags labelled static (QA D3, D5)", () => {
  const s = src("client/src/pages/Signals.tsx");
  it("a details toggle sets expanded without navigating", () => {
    expect(s).toMatch(/data-card-details-toggle[\s\S]{0,80}aria-expanded=\{expanded\}[\s\S]{0,40}onClick=\{e => \{ e\.stopPropagation\(\); setExpanded\(x => !x\); \}\}/);
  });
  it("every catalog tag list carries the 'Catalog tag · static' label", () => {
    expect((s.match(/<CatalogTagsLabel \/>/g) ?? []).length).toBe(2);
    expect(s).toMatch(/>Catalog tag · static</);
    const tagSites = s.match(/<SignalTag key=\{sig\} signal=\{sig\} \/>/g) ?? [];
    expect(tagSites.length).toBe(2);
  });
});

describe("WATCH / ACT freshness states the evidence grade", () => {
  it("DELAYED label, delayed-input count and PARTIAL grade; never 'source state is live'", () => {
    const r = canonicalFreshnessReadout({
      integrityLabel: "DELAYED",
      canonical: { generatedAt: "2026-10-02T18:01:25.427Z", delayedInputs: ["a", "b", "c", "d", "e"], staleInputs: [], fallbackInputs: [], unavailableInputs: [], confidenceOrEvidenceQuality: "PARTIAL" },
    });
    expect(r.label).toBe("DELAYED");
    expect(r.detail).toMatch(/Evidence quality: PARTIAL\./);
    expect(r.detail).toMatch(/5 inputs delayed/);
    for (const f of ["client/src/pages/Watch.tsx", "client/src/pages/Act.tsx"]) {
      expect(src(f)).not.toMatch(/source state is/);
    }
  });
});

// ── Extended price-level guard + in-suite mutation test (QA gate r3: 3/11 bypassed) ──
describe("price-level guard covers bare numeric levels and level tiles", () => {
  const PRICE_LEVEL_KEYS = /\b(price|currentPrice|lastPrice|support|resistance|targetPrice|priceTarget|stopLoss|entryZone|invalidationLevel|profitTargets|riskReward)\s*:\s*(\[\s*)?['"`]?\$?[0-9]|\b(target|stop|entry|invalidation)\w*\s*:\s*(\[\s*)?['"`]\$[0-9]/;
  const DOLLAR_LEVEL = /(support|resistance|target|stop|entry|invalidat|close (above|below))[^'"`\n]{0,40}\$[0-9]/i;
  // New: numeric literal on any level-ish key (pivot: 820, keyLevels: '820 / 950').
  const NUM_LEVEL_KEY = /\b(pivot\w*|keyLevels?|levels?|support\w*|resistance\w*|breakout(Level|Price)|breakdown(Level|Price)|trigger(Level|Price)|floor|ceiling)\s*:\s*(\[\s*)?['"`]?\$?[0-9]/i;
  // New: a level word next to a bare 2+ digit number in prose ("Holding 820 support"); percentages excluded.
  const LEVEL_WORD_NUMBER = /\b(support|resistance|pivot|breakout|breakdown|floor|ceiling|stop|target|entry|invalidat\w*)\b[^\n'"`]{0,24}?\b[0-9]{2,}(\.[0-9]+)?\b(?!\s*%)|\b[0-9]{2,}(\.[0-9]+)?\s*(support|resistance|pivot|floor|ceiling)\b/i;
  // New: a level-label tile with a literal value ({ label: 'SUPPORT', value: '$820' }).
  const LEVEL_TILE = /label:\s*['"`](SUPPORT|RESISTANCE|ENTRY|STOP(\s|_)?LOSS|STOP|TARGET|PIVOT|INVALIDATION)['"`]\s*,\s*value:\s*['"`]?\$?[0-9]/i;

  const catalogOffenders = (text: string) => text.split("\n").filter(l =>
    PRICE_LEVEL_KEYS.test(l) || DOLLAR_LEVEL.test(l) || NUM_LEVEL_KEY.test(l) || LEVEL_WORD_NUMBER.test(l) || LEVEL_TILE.test(l));
  const appOffenders = (text: string) => text.split("\n").filter(l =>
    PRICE_LEVEL_KEYS.test(l) || DOLLAR_LEVEL.test(l) || LEVEL_TILE.test(l) || /\bpivot\w*\s*:\s*['"`]?\$?[0-9]/i.test(l));

  const catalog = src("client/src/lib/signalsData.ts");

  it("signalsData.ts passes the extended guard", () => {
    expect(catalogOffenders(catalog)).toEqual([]);
  });

  it("client/shared app code has no level tiles or pivot literals", () => {
    const { readdirSync, statSync } = require("node:fs") as typeof import("node:fs");
    const files: string[] = [];
    const walk = (d: string) => {
      for (const n of readdirSync(d)) {
        const p = resolve(d, n);
        if (statSync(p).isDirectory()) { if (n !== "seo" && n !== "node_modules") walk(p); }
        else if (/\.(ts|tsx)$/.test(n) && !/\.test\./.test(n)) files.push(p);
      }
    };
    walk(resolve(root, "client/src")); walk(resolve(root, "shared"));
    const offenders = files.flatMap(f => readFileSync(f, "utf8").split("\n")
      .filter(l => LEVEL_TILE.test(l) || /\bpivot\w*\s*:\s*['"`]?\$?[0-9]/i.test(l))
      .map(l => `${f.replace(root + "/", "")}: ${l.trim().slice(0, 100)}`));
    expect(offenders).toEqual([]);
  });

  // Each of QA's 11 re-injections must be caught.
  const anchor = "ticker: 'NVDA',";
  const catalogInjections: Array<[string, string]> = [
    ["M1 support $820", "support: '$820',"],
    ["M2 price 875.40", "price: 875.40,"],
    ["M3 invalidationLevel", "invalidationLevel: 'Close below $780',"],
    ["M4 profitTargets", "profitTargets: ['$920'],"],
    ["M5 riskReward", "riskReward: '3.4:1',"],
    ["M6 keyLevels", "keyLevels: '$820 / $950',"],
    ["M7 whyAppearing bare levels", "whyAppearing: 'Holding 820 support, 950 resistance',"],
    ["M8 pivot", "pivot: 820,"],
    ["M8b pivotPoint string", "pivotPoint: '820',"],
    ["M8c bare resistance number", "notes: 'resistance near 950 then 1020',"],
  ];
  it.each(catalogInjections)("mutation %s in signalsData.ts is caught", (_name, line) => {
    expect(catalog).toContain(anchor);
    const mutated = catalog.replace(anchor, `${anchor}\n    ${line}`);
    expect(catalogOffenders(mutated).length).toBeGreaterThan(catalogOffenders(catalog).length);
  });

  const appInjections: Array<[string, string, string]> = [
    ["M9 preview price", "client/src/components/HomeStockIntelSection.tsx", "  price: 924.58,"],
    ["M11 static SUPPORT tile", "client/src/pages/Signals.tsx", "  { label: 'SUPPORT', value: '$820', color: '#22C55E' },"],
    ["M11b bare RESISTANCE tile", "client/src/pages/Signals.tsx", "  { label: \"RESISTANCE\", value: 950 },"],
    ["M11c pivot literal", "client/src/pages/Signals.tsx", "  pivot: 820,"],
  ];
  it.each(appInjections)("mutation %s in app code is caught", (_name, file, line) => {
    const text = src(file);
    expect(appOffenders(`${text}\n${line}`).length).toBeGreaterThan(appOffenders(text).length);
  });

  it("M10: Signals levels basis never hard-codes LIVE", () => {
    const s = src("client/src/pages/Signals.tsx");
    expect(s).not.toMatch(/Computed from LIVE/);
    expect((s.match(/priceLevelsBasis\(liveQuote, quote\.badge\)/g) ?? []).length).toBe(2);
  });
});

// ── PR #59 r6: missing vectors stay null to render; Charts seeded/illustrative content ──
describe("a missing vector value is null all the way to render (never 0)", () => {
  // Same mapping Pressure.tsx uses for canonicalState.engines → vector rows.
  const engines = [
    { engineId: "liquidity-stress", value: 23 },
    { engineId: "credit-contagion", value: null },
    { engineId: "volatility-regime", value: Number.NaN },
    { engineId: "macro-sensitivity", value: 0 },
  ];
  const rows = engines.map(e => ({ id: e.engineId, score: canonicalVectorScore(e.value as number | null), level: pressureVectorLevel(e.value as number | null) }));

  it("maps missing / invalid values to null score and null level; a genuine 0 stays 0", () => {
    expect(rows.map(r => r.score)).toEqual([23, null, null, 0]);
    expect(rows.map(r => r.level)).toEqual(["Low", null, null, "Low"]);
    expect(canonicalVectorScore(undefined)).toBeNull();
    expect(canonicalVectorScore(140)).toBeNull();
  });

  it("renders '—' for a missing vector — no '0' text, no level", () => {
    const missing = rows.filter(r => r.score == null);
    expect(missing.map(r => vectorScoreText(r.score))).toEqual(["—", "—"]);
    for (const r of missing) expect(vectorScoreText(r.score)).not.toMatch(/\d/);
    expect(vectorScoreText(0)).toBe("0");
    expect(vectorScoreText(23)).toBe("23");
  });

  it("contagion and top-vector read-outs skip missing vectors instead of treating them as 0", () => {
    const c = contagionSummary(rows, 35);
    expect(c).toMatchObject({ scored: 2, total: 4, pct: 0 });
    expect(contagionSummary([{ score: null }, { score: null }], 35).pct).toBeNull();
    expect(contagionSummary([{ score: 50 }, { score: null }], 35)).toMatchObject({ scored: 1, pct: 100 });
    expect(topScoredVectors(rows, 3).map(r => r.id)).toEqual(["liquidity-stress", "macro-sensitivity"]);
  });

  it("Pressure / Scenarios source: no '?? 0' or '|| 0' fallback on a score, vector or level", () => {
    for (const f of ["client/src/pages/Pressure.tsx", "client/src/pages/SimulatePressure.tsx", "client/src/lib/simulatePressureView.ts", "client/src/lib/pressureVectorWeights.ts", "client/src/pages/Charts.tsx"]) {
      const s = src(f);
      expect(s, f).not.toMatch(/(score|value|vector|level|\bv)\)?\s*(\?\?|\|\|)\s*0\b/i);
      expect(s, f).not.toMatch(/\?\? \("Low" as PressureLevel\)|\?\? "Moderate"\)|\?\? "MODERATE"/);
    }
    const p = src("client/src/pages/Pressure.tsx");
    expect(p).toMatch(/score: canonicalVectorScore\(engine\.value\),/);
    expect(p).toMatch(/level: pressureVectorLevel\(engine\.value\),/);
    expect(p).toMatch(/score: v\?\.score \?\? null, level: v\?\.level \?\? null/);
    expect(p).toMatch(/\{vectorScoreText\(vector\.score\)\}/);
    expect(p).toMatch(/data-vector-level="unavailable"[^>]*>Unavailable</);
    expect(p).toMatch(/\{\(liq\?\.level \?\? "Unavailable"\)\.toUpperCase\(\)\}/);
    expect(p).toMatch(/if \(score == null\) return <div data-score-bar="unavailable"/);
    const sim = src("client/src/pages/SimulatePressure.tsx");
    expect(sim).toMatch(/\{vec\.value \?\? '—'\}/);
  });
});

describe("Charts: no seeded paths, no false source claims (QA #60 follow-up)", () => {
  const s = src("client/src/pages/Charts.tsx");
  it("macro card source: no 'API:' prefix before the no-feed note", () => {
    expect(macroCardSourceText("No live data feed is connected to this card.")).toBe("No live data feed is connected to this card.");
    expect(macroCardSourceText("")).toBe("No live data feed is connected to this card.");
    expect(macroCardSourceText("FRED: T10Y2Y")).toBe("API: FRED: T10Y2Y");
    expect(s).not.toMatch(/API: \{card\.apiSource\}/);
    expect(s).toMatch(/\{macroCardSourceText\(card\.apiSource\)\}/);
  });
  it("no MODEL DATA footer claiming FRED / Polygon / Alpha Vantage integration", () => {
    expect(s).not.toMatch(/MODEL DATA|Alpha Vantage|Polygon\.io|Full live integration/);
  });
  it("no 0–10 engine score and no seeded crisis paths / current trajectory plotted", () => {
    expect(s).not.toMatch(/output\.overall|currentTrajectoryData|s\.data\[i\]/);
    expect(s).toMatch(/Historical Reference · Not a data overlay/);
  });
  it("correlation map is labelled illustrative and shows no static stress/correlation figures", () => {
    expect(s).not.toMatch(/Stress contagion detected/);
    expect(s).not.toMatch(/\{node\.value\}|edge\.correlation\.toFixed/);
    expect(s).toMatch(/Cross-Asset Relationships · Illustrative/);
  });
});

describe("lib/data.ts: no relative 'h ago' / 'd ago' stamps", () => {
  it("the unimported static alert list with relative stamps is gone", async () => {
    const s = src("client/src/lib/data.ts");
    expect(s).not.toMatch(/timestamp: '\d+[hd] ago'/);
    const mod = await import("../client/src/lib/data") as Record<string, unknown>;
    expect(mod.alerts).toBeUndefined();
  });
});

describe("Signals card: static fundamentals are Unavailable, never current-looking", () => {
  const s = src("client/src/pages/Signals.tsx");
  it("market cap / short interest / debt-equity / avg volume show Unavailable; descriptors labelled static", () => {
    for (const label of ["Market Cap", "Short Interest", "Debt/Equity", "Avg Volume"]) {
      expect(s).toContain(`{ label: '${label}', value: 'Unavailable' }`);
    }
    expect(s).not.toMatch(/fmtCap\(|stock\.shortInterest|stock\.debtToEquity|stock\.avgVolume\.toFixed/);
    expect(s).toMatch(/FUNDAMENTALS · NO CURRENT SOURCE CONNECTED/);
    expect(s).toMatch(/label: 'AI Exposure · static'/);
    expect(s).toMatch(/label: `Day Open · \$\{quote\.badge\}`/);
  });
  it("no static 'EARN nd' badge and no volume ratio against the static average", () => {
    expect(s).not.toMatch(/EARN \{stock\.earningsDaysAway\}d/);
    expect(s).not.toMatch(/volumeSurge\(/);
  });
});

// ── PR #59 r7: QA gate r6 F1 / F2 ─────────────────────────────────────────────
describe("Signals ASSET INFO: catalog momentum / bias chips are labelled static (F1)", () => {
  const s = src("client/src/pages/Signals.tsx");
  it("both chips carry 'Catalog · static'; no bare 'MOM:' or bare bias chip", () => {
    expect(s).toMatch(/data-catalog-static-chip="momentum"[\s\S]{0,400}?\}\}>Catalog · static · MOM \{stock\.momentum\}<\/span>/);
    expect(s).toMatch(/data-catalog-static-chip="bias"[\s\S]{0,1200}?\}\}>Catalog · static · \{stock\.bias\.toUpperCase\(\)\}<\/span>/);
    expect(s).not.toMatch(/>MOM: \{stock\.momentum\}</);
    expect(s).not.toMatch(/\}\}>\{stock\.bias\.toUpperCase\(\)\}<\/span>/);
  });
});

describe("no hard-coded $ figures in quote surfaces; NOW example price/change are '—' (F2)", () => {
  const QUOTE_SURFACES = [
    "client/src/pages/Signals.tsx",
    "client/src/components/HomeStockIntelSection.tsx",
    "client/src/components/DashboardSearchPanels.tsx",
    "client/src/components/TickerSearch.tsx",
  ];
  // A literal dollar figure ("$924.58", "$64,250.12"). Template interpolation ("$${x}") is not a literal.
  const DOLLAR_LITERAL = /\$[0-9]/;
  const offenders = (text: string) => text.split("\n").filter(l => DOLLAR_LITERAL.test(l));

  it.each(QUOTE_SURFACES)("%s has no $-number literal", f => {
    expect(offenders(src(f))).toEqual([]);
  });

  const PRICE_CELL = /<div data-preview-price style=\{\{[^}]*\}\}>—<\/div>/;
  const CHANGE_CELL = /<div data-preview-change style=\{\{[^}]*\}\}>—<\/div>/;
  const previewCellsAreDashes = (text: string) =>
    PRICE_CELL.test(text) && CHANGE_CELL.test(text) &&
    (text.match(/data-preview-price/g) ?? []).length === 1 && (text.match(/data-preview-change/g) ?? []).length === 1;

  it("HomeStockIntelSection preview price and change cells always render '—'", () => {
    expect(previewCellsAreDashes(src("client/src/components/HomeStockIntelSection.tsx"))).toBe(true);
  });

  // QA's 4 bypass injections, applied in-suite: each must be caught.
  const home = src("client/src/components/HomeStockIntelSection.tsx");
  const dash = src("client/src/components/DashboardSearchPanels.tsx");
  const signals = src("client/src/pages/Signals.tsx");
  it("mutation: '$924.58' in the preview price cell is caught", () => {
    const m = home.replace(/(<div data-preview-price style=\{\{[^}]*\}\}>)—(<\/div>)/, "$1$$924.58$2");
    expect(m).not.toBe(home);
    expect(previewCellsAreDashes(m)).toBe(false);
    expect(offenders(m).length).toBeGreaterThan(0);
  });
  it("mutation: '+3.42%' in the preview change cell is caught", () => {
    const m = home.replace(/(<div data-preview-change style=\{\{[^}]*\}\}>)—(<\/div>)/, "$1+3.42%$2");
    expect(m).not.toBe(home);
    expect(previewCellsAreDashes(m)).toBe(false);
  });
  it("mutation: const BTC_PRICE='$64,250.12' in DashboardSearchPanels is caught", () => {
    expect(offenders(`${dash}\nconst BTC_PRICE='$64,250.12';`).length).toBeGreaterThan(0);
  });
  it("mutation: {label:'Last', value:'$924.58'} in Signals is caught", () => {
    expect(offenders(`${signals}\n  {label:'Last', value:'$924.58'},`).length).toBeGreaterThan(0);
  });
});

describe("no X/10 score text on routed #59 pages (Signals, Charts, SimulatePressure)", () => {
  const SLASH_TEN = /\/\s?10(?:\.0)?\b|out of 10\b/i;
  const slashTenLines = (text: string) =>
    text.split("\n").map((l, i) => ({ l, n: i + 1 })).filter(({ l }) => SLASH_TEN.test(l));
  const files = ["client/src/pages/Signals.tsx", "client/src/pages/Charts.tsx", "client/src/pages/SimulatePressure.tsx"];

  it.each(files)("%s has no /10 or /10.0 score text", (f) => {
    expect(slashTenLines(src(f)).map(({ n, l }) => `${f}:${n}: ${l.trim()}`)).toEqual([]);
  });

  it("Signals regime alignment badge shows the label only (no tier score)", () => {
    const s = src("client/src/pages/Signals.tsx");
    expect(s).toMatch(/function RegimeAlignmentBadge\(\{ alignment \}: \{/);
    expect(s).toMatch(/<RegimeAlignmentBadge alignment=\{tradingSignal\.regimeAlignment\} \/>/);
    expect(s).not.toMatch(/score\.toFixed\(0\)\}\/10/);
  });

  it("SimulatePressure 0–10 slider inputs carry the scale in the sublabel, unit empty", () => {
    const s = src("client/src/pages/SimulatePressure.tsx");
    expect(s).toMatch(/sublabel: 'NFCI proxy · input scale 0–10', unit: '',/);
    expect(s).toMatch(/sublabel: 'CRE composite · input scale 0–10', unit: '',/);
  });

  it.each([
    ["Signals alignment", "{score.toFixed(0)}/10"],
    ["Charts current", "<div>/ 10.0</div>"],
    ["Charts tooltip", "formatter={(v: number) => [`${v.toFixed(2)} / 10`, 'Systemic Pressure']}"],
    ["Simulate headline", "<div>/ 10.0</div>"],
    ["Simulate vector", "<span>/10</span>"],
    ["slider unit", "unit: '/10',"],
  ])("mutation: %s is caught", (_name, line) => {
    expect(slashTenLines(`x\n${line}\n`).length).toBe(1);
    expect(slashTenLines("<span>/100</span> {v}/100 `/ 100`").length).toBe(0);
  });
});

describe("QA r7 blockers: Simulate probability NaN%, Charts legend/ribbon/footer, slider inputs", async () => {
  const { probabilityPercentText } = await import("../client/src/lib/simulatePressureView");
  const { selectBrowserMarketOutput } = await import("../client/src/lib/marketStateProjection");
  const { DEFAULT_INDICATORS } = await import("../client/src/lib/engine");
  const sim = src("client/src/pages/SimulatePressure.tsx");
  const charts = src("client/src/pages/Charts.tsx");
  const KEYS = ["crashProbability", "recessionProbability", "stagflationProbability"] as const;

  it("probabilityPercentText: finite 0–100 → 'N%', withheld (NaN / null / undefined / ±Infinity / out of range) → '—'", () => {
    expect(probabilityPercentText(34)).toBe("34%");
    expect(probabilityPercentText(0)).toBe("0%");
    for (const v of [Number.NaN, null, undefined, Infinity, -Infinity, -1, 101, "34"]) expect(probabilityPercentText(v)).toBe("—");
  });

  it("SimulatePressure probability row renders through the guard, never a raw {p.value}%", () => {
    expect(sim).not.toMatch(/\{p\.value\}%/);
    expect(sim).toMatch(/data-sim-probability=\{p\.label\}/);
    expect(sim).toMatch(/\{probabilityPercentText\(p\.value\)\}/);
  });

  // Runs against whatever engine/projection is in the tree: at #59's base the
  // values are finite; with #60 merged the withheld ones are NaN. Neither may
  // reach the page as "NaN%".
  it.each([
    ["deterministic fallback", {}],
    ["simulation", { vix: 35 }],
  ])("browser engine output (%s): probability cells never render NaN%%", (_mode, overrides) => {
    const { output } = selectBrowserMarketOutput({ marketState: null, baselineIndicators: DEFAULT_INDICATORS, simulationOverrides: overrides });
    for (const k of KEYS) {
      const raw = (output.probability as unknown as Record<string, number>)[k];
      const text = probabilityPercentText(raw);
      expect(text).not.toMatch(/NaN/);
      if (Number.isFinite(raw)) expect(text).toBe(`${raw}%`);
      else expect(text).toBe("—");
    }
  });

  it("Charts: no 0–10 zone legend (7.5+ Danger Zone / 6.0–7.5 / 4.5–6.0)", () => {
    expect(charts).not.toMatch(/Danger Zone|7\.5\+|6\.0–7\.5|4\.5–6\.0/);
  });

  it("Charts: ribbon has no static Liquidity 5.8/10, AI Sentiment 72/100 EXTREME or VIX 22.8; no MODEL DATA footer", () => {
    expect(charts).not.toMatch(/'5\.8'|'72'|'22\.8'|EXTREME/);
    expect(charts).not.toMatch(/MODEL DATA/);
    expect(charts).toMatch(/buildChartsInstruments\(\{ quotes: quotesQuery\.data\?\.items \?\? null, fred, now: Date\.now\(\) \}\)/);
  });

  it("SimulatePressure 0–10 sliders are labelled as inputs (not a FAULTLINE score) and show no /10", () => {
    const sliders = sim.slice(sim.indexOf("const SLIDERS"), sim.indexOf("const CATEGORIES"));
    expect(sliders).not.toMatch(/FAULTLINE|score/i);
    expect(sliders).not.toMatch(/unit: '\/10'/);
  });
});

describe("claims sweep: no unsourced present-tense valuation / record claims in #59 data and quote surfaces", () => {
  const CLAIM = /record[- ]highs?|all[- ]time[- ]highs?|\b\d+(?:\.\d+)?x (?:earnings|sales|revenue|book)\b|trading at \d/i;
  const files = [
    "client/src/lib/data.ts",
    "client/src/lib/signalsData.ts",
    "client/src/pages/Signals.tsx",
    "client/src/pages/Charts.tsx",
    "client/src/pages/SimulatePressure.tsx",
    "client/src/components/HomeStockIntelSection.tsx",
    "client/src/components/DashboardSearchPanels.tsx",
    "client/src/components/TickerSearch.tsx",
  ];
  const claimLines = (text: string) => text.split("\n").map((l, i) => ({ l, n: i + 1 })).filter(({ l }) => CLAIM.test(l));

  it.each(files)("%s has no 'record highs' / 'all-time high' / 'Nx earnings' / 'Trading at N' claim", (f) => {
    expect(claimLines(src(f)).map(({ n, l }) => `${f}:${n}: ${l.trim()}`)).toEqual([]);
  });

  it("signalsData: the unrendered whyAppearing blurbs (volume multiples, RSI, P/E) are gone", () => {
    expect(src("client/src/lib/signalsData.ts")).not.toMatch(/whyAppearing/);
  });

  it.each([
    "interpretation: 'Office vacancy at record highs.'",
    "description: 'capex boom with negative ROI. Nasdaq at 100x earnings.'",
    "whyAppearing: 'Trading at 8x earnings with China stimulus catalyst'",
    "resistance: '$950 (all-time high zone)'",
    "note: 'Trading at 12.5x sales'",
  ])("mutation: %s is caught", (line) => {
    expect(claimLines(`x\n${line}\n`).length).toBe(1);
  });
});

describe("Watchlist domain scores on the 0–100 display scale (stored 0–10 unchanged)", async () => {
  const { INDICATOR_MAP: MAP, thresholdSlider } = await import("../client/src/lib/watchlist");
  const { buildWatchlistItem } = await import("../client/src/components/watchlist/WatchlistEditModel");
  const DOMAIN = ["score_credit", "score_ai", "score_treasury", "score_recession"] as const;

  it.each(DOMAIN)("%s: shown /100 (×10), stored scale and defaults unchanged", (key) => {
    const def = MAP[key];
    expect(def.unit).toBe("/100");
    expect([def.min, def.max, def.step]).toEqual([0, 10, 0.1]);
    expect(def.defaultThreshold).toBeGreaterThan(0);
    expect(def.defaultThreshold).toBeLessThanOrEqual(10);
    expect(def.format(7)).toBe("70");
    expect(def.format(7.5)).toBe("75");
    expect(def.format(def.stressLevel)).toBe(String(Math.round(def.stressLevel * 10)));
  });

  it.each(DOMAIN)("%s: slider runs 0–100 step 10 and saves the stored 0–10 value", (key) => {
    const sl = thresholdSlider(MAP[key]);
    expect([sl.min, sl.max, sl.step]).toEqual([0, 100, 10]);
    expect(sl.toDisplay(7)).toBe(70);
    expect(sl.toStored(80)).toBe(8);
    expect(sl.toStored(sl.toDisplay(7.5))).toBe(7.5);
    const saved = buildWatchlistItem({ indicatorKey: key, thresholdValue: sl.toStored(80), condition: "above", severity: "high", note: "" }, null, () => 1, () => "id");
    expect(saved.thresholdValue).toBe(8);
  });

  it("score_overall slider stays on its canonical 0–100 scale (step 1); raw indicators keep their own scale", () => {
    expect(thresholdSlider(MAP.score_overall)).toMatchObject({ min: 0, max: 100, step: 1 });
    expect(thresholdSlider(MAP.score_overall).toStored(70)).toBe(70);
    const vix = thresholdSlider(MAP.vix);
    expect([vix.min, vix.max, vix.step]).toEqual([MAP.vix.min, MAP.vix.max, MAP.vix.step]);
  });

  it("no /10 unit left in the watchlist catalog; 0–10 indicator inputs say 'index 0–10'", () => {
    const lib = src("client/src/lib/watchlist.ts");
    expect(lib).not.toMatch(/unit: '\/10'/);
    expect(MAP.bankLiquidityStress.unit).toBe("index 0–10");
    expect(MAP.creStress.unit).toBe("index 0–10");
  });

  it("WatchlistEditModal slider is bound through thresholdSlider (display ↔ stored)", () => {
    const m = src("client/src/components/watchlist/WatchlistEditModal.tsx");
    expect(m).toMatch(/const slider = thresholdSlider\(def\);/);
    expect(m).toMatch(/value=\{slider\.toDisplay\(threshold\)\}/);
    expect(m).toMatch(/setThreshold\(slider\.toStored\(parseFloat\(event\.target\.value\)\)\)/);
    expect(m).not.toMatch(/max=\{def\?\.max \?\? 10\}|value=\{threshold\}/);
    for (const f of ["client/src/components/watchlist/WatchlistEditModal.tsx", "client/src/pages/Watchlist.tsx"]) {
      expect(src(f)).not.toMatch(/\/\s?10(?:\.0)?\b/);
    }
  });
});

describe("missing delta renders '—' / Unavailable, never 'Stable' or '0 vs baseline' (works with and without #60)", async () => {
  const { knownDelta, deltaTrend, deltaDirection, vsBaselineText } = await import("../client/src/lib/deltaAvailability");
  const { projectCanonicalMarketState, selectBrowserMarketOutput } = await import("../client/src/lib/marketStateProjection");
  const { DEFAULT_INDICATORS } = await import("../client/src/lib/engine");
  const marketState = JSON.parse(src("server/__fixtures__/prod-2026-10-01/market-state-current.json"));

  it("helpers: flagged-unavailable or non-finite delta → null / unavailable; a known delta still reads", () => {
    for (const item of [{ delta: 0, deltaAvailable: false }, { delta: 0.4, deltaAvailable: false }, { delta: Number.NaN }, { delta: undefined }, null, undefined]) {
      expect(knownDelta(item)).toBeNull();
      expect(deltaTrend(item)).toBe("unavailable");
      expect(deltaDirection(item)).toBe("Unavailable");
      expect(vsBaselineText(item)).toBe("Δ unavailable");
    }
    expect(deltaTrend({ delta: 0 })).toBe("stable");
    expect(deltaDirection({ delta: 0.35 })).toBe("Deteriorating");
    expect(deltaDirection({ delta: -0.35, deltaAvailable: true })).toBe("Improving");
    expect(vsBaselineText({ delta: 0.35 })).toBe("+3.5 pts vs baseline");
    expect(vsBaselineText({ delta: -0.2 })).toBe("-2.0 pts vs baseline");
  });

  it("canonical projection (prod fixture): any delta flagged unavailable renders Unavailable", () => {
    const fb = selectBrowserMarketOutput({ marketState: null, baselineIndicators: DEFAULT_INDICATORS, simulationOverrides: {} }).output;
    const out = projectCanonicalMarketState(marketState, fb);
    for (const item of [out.overall, ...out.domains] as Array<{ delta: number; deltaAvailable?: boolean }>) {
      if (item.deltaAvailable === false) {
        expect(deltaTrend(item)).toBe("unavailable");
        expect(deltaDirection(item)).toBe("Unavailable");
        expect(vsBaselineText(item)).not.toMatch(/\d|stable/i);
      } else {
        expect(deltaTrend(item)).toBe(item.delta > 0.1 ? "deteriorating" : item.delta < -0.1 ? "improving" : "stable");
      }
    }
  });

  it("Now.tsx: fallback trend / direction / what-changed read the delta through the helpers", () => {
    const s = src("client/src/pages/Now.tsx");
    expect(s).toMatch(/trend: deltaTrend\(domain\),/);
    expect(s).toMatch(/\?\? deltaDirection\(output\.overall\);/);
    expect(s).toMatch(/const d = knownDelta\(domain\);/);
    expect(s).not.toMatch(/domain\.delta > 0\.1|output\.overall\.delta > 0\.1|Math\.abs\(domain\.delta\)/);
    expect(s).toMatch(/trend === "stable" \? "Stable" : "Unavailable"/);
  });

  it("Pressure.tsx: domain delta via vsBaselineText, no raw '0 vs baseline'; unknown direction has no 'stable' icon; domain score /100", () => {
    const s = src("client/src/pages/Pressure.tsx");
    expect(s).toMatch(/const d = knownDelta\(domain\);/);
    expect(s).toMatch(/\{vsBaselineText\(domain\)\}/);
    expect(s).not.toMatch(/domain\.delta\.toFixed|domain\.delta !== 0/);
    expect(s).not.toMatch(/trend \?\? "stable"/);
    expect(s).toMatch(/engine\.direction === "Stable" \? "stable" : "unavailable"/);
    expect(s).not.toMatch(/\{domain\.score\.toFixed\(1\)\}/);
    expect(s).toMatch(/Math\.round\(domain\.score \* 10\)/);
  });
});
