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

  it("NOW deep-view stock preview: price only from the Signals quote feed, else UNAVAILABLE", () => {
    const s = src("client/src/components/HomeStockIntelSection.tsx");
    expect(s).not.toMatch(/price: [0-9]/);
    expect(s).not.toMatch(/change: [+-]?[0-9]/);
    expect(s).not.toMatch(/Live Signal Preview/);
    expect(s).toMatch(/fetch\('\/api\/signals\/quotes'\)/);
    expect(s).toMatch(/const quote = signalQuoteView\(liveQuote\);/);
    expect(s).toMatch(/: 'UNAVAILABLE'\}/);
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
