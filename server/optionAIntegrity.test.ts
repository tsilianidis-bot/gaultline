/**
 * Option A regressions. Each case is red on 2d0746d and green after the fix.
 * Missing, stale, future, and empty evidence must not become a signal, a LIVE
 * label, or a numeric confidence.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { evidenceFreshnessLabel } from "./evidenceFreshness";
import { computeTradingSignal, computeWildersRSI } from "./tradingSignals";
import { computeCryptoSignal } from "./cryptoSignals";
import { dayTradeIndicatorGate } from "./dayTradeEngine";
import { runScheduledSeismographForTests } from "./scheduledSeismograph";
import {
  admitScheduledSessionOutcome,
  claimScheduledSeismographSession,
  scheduledSeismographOutcomeKey,
  type SessionClaimStore,
} from "./scheduledSessionClaim";
import { evidenceStatusFromFailureStats, evidenceStatusFromIntegrity } from "../shared/evidenceStatus";

const root = resolve(import.meta.dirname, "..");
const source = (path: string) => readFileSync(resolve(root, path), "utf8");

function memoryStore(): SessionClaimStore & { rows: Map<string, string> } {
  const rows = new Map<string, string>();
  return {
    rows,
    async read(key) { return rows.get(key) ?? null; },
    async insert(key, value) {
      if (rows.has(key)) throw Object.assign(new Error(`Duplicate entry '${key}'`), { code: "ER_DUP_ENTRY", errno: 1062 });
      rows.set(key, value);
    },
    async cas(key, previous, next) {
      if (rows.get(key) !== previous) return false;
      rows.set(key, next);
      return true;
    },
    async listByPrefix(prefix) {
      return [...rows.entries()]
        .filter(([key]) => key.startsWith(prefix))
        .map(([key, value]) => ({ key, value }));
    },
  };
}

const fresh = Date.parse("2026-10-05T20:20:00.000Z");
const liveMacro = {
  scope: "macro" as const,
  canonicalQuality: "HEALTHY",
  fredStatus: "live",
  observedAtMs: fresh,
  nowMs: fresh,
};

function bars(count: number, closeAt: (index: number) => number) {
  return Array.from({ length: count }, (_, index) => ({
    timestamp: fresh - (count - index) * 86_400_000,
    open: closeAt(index),
    high: closeAt(index) + 1,
    low: closeAt(index) - 1,
    close: closeAt(index),
    volume: 1_000_000,
  }));
}

describe("blocker 1 — a named ticker cannot be verified without its own quote", () => {
  it("rejects a missing scope and a ticker scope with no quote observation", () => {
    expect(evidenceFreshnessLabel({ ...liveMacro, scope: undefined })).toBe("Unavailable");
    expect(evidenceFreshnessLabel({
      canonicalQuality: "HEALTHY",
      fredStatus: "live",
      observedAtMs: fresh,
      nowMs: fresh,
    })).toBe("Unavailable");
    expect(evidenceFreshnessLabel({ ...liveMacro, scope: "ticker" })).toBe("Unavailable");
    expect(evidenceFreshnessLabel({ ...liveMacro, scope: "ticker", quotes: [] })).toBe("Unavailable");
    expect(evidenceFreshnessLabel(liveMacro)).toBe("Verified source");
  });

  it("requires the ticker's own fresh, non-future, source-timestamped quote", () => {
    const cases = [
      { name: "missing", quote: { observedAtMs: null, sourceStatus: "live" }, expected: "Unavailable" },
      { name: "empty source", quote: { observedAtMs: fresh, sourceStatus: "" }, expected: "Unavailable" },
      { name: "future", quote: { observedAtMs: fresh + 120_000, sourceStatus: "live" }, expected: "Unavailable" },
      { name: "stale", quote: { observedAtMs: fresh - 20 * 60 * 60 * 1000, sourceStatus: "live" }, expected: "Unavailable" },
      { name: "delayed yahoo", quote: { observedAtMs: fresh, sourceStatus: "delayed" }, expected: "Delayed" },
      { name: "fresh coingecko", quote: { observedAtMs: fresh, sourceStatus: "live" }, expected: "Verified source" },
    ] as const;
    for (const row of cases) {
      expect(evidenceFreshnessLabel({ ...liveMacro, scope: "ticker", quotes: [row.quote] }), row.name).toBe(row.expected);
    }
  });

  it("Ask declares ticker scope whenever the response names a ticker", () => {
    const ask = source("server/routers/smartDiscovery.ts");
    const observed = ask.indexOf("const observedAt = fredObservationMs");
    const askReturn = ask.slice(observed, ask.indexOf("}) as FaultlineAnswer", observed));
    expect(askReturn).toContain('scope: ticker ? "ticker" : "macro"');
    expect(askReturn).toContain("quotes:");
  });
});

describe("blocker 2 — the real out-of-window cron finalizes stale pending rows", () => {
  afterEach(() => vi.useRealTimers());

  async function pending(store: ReturnType<typeof memoryStore>, etDate: string, nowMs: number) {
    await claimScheduledSeismographSession(etDate, async () => store, { nowMs, trigger: "SCHEDULED_CRON" });
    await admitScheduledSessionOutcome(etDate, { pressureScore: 41, regime: "MODERATE RISK" }, async () => store, nowMs);
  }

  it.each([
    ["EDT out of window", "2026-10-05T21:15:00.000Z", "2026-10-05", Date.parse("2026-10-05T20:20:00.000Z")],
    ["EST out of window", "2026-01-05T20:15:00.000Z", "2026-01-05", Date.parse("2026-01-05T21:20:00.000Z")],
  ])("%s marks pending_score skipped: unrecoverable and does not run the pipeline", async (_name, fireIso, etDate, admittedAt) => {
    const store = memoryStore();
    await pending(store, etDate, admittedAt);
    vi.useFakeTimers();
    vi.setSystemTime(new Date(fireIso));
    const pipeline = vi.fn(async () => {
      throw new Error("pipeline must not run");
    });
    const recordScore = vi.fn();
    const json = vi.fn();
    const status = vi.fn(() => ({ json }));
    await runScheduledSeismographForTests({ json, status } as never, {
      sessionStore: async () => store,
      runPipeline: pipeline,
    });
    expect(pipeline).not.toHaveBeenCalled();
    expect(recordScore).not.toHaveBeenCalled();
    expect(status).toHaveBeenCalledWith(200);
    expect(json).toHaveBeenCalledWith(expect.objectContaining({
      ok: true,
      alert: false,
      skipped: "dst_companion_outside_window",
    }));
    expect(store.rows.get(scheduledSeismographOutcomeKey(etDate))).toContain("skipped: unrecoverable");
  });

  it("finalizes a prior session on the next in-window fire and leaves today's pending for reconcile", async () => {
    const store = memoryStore();
    await pending(store, "2026-10-05", Date.parse("2026-10-05T20:20:00.000Z"));
    await pending(store, "2026-10-06", Date.parse("2026-10-06T20:20:00.000Z"));
    const mod = await import("./scheduledSessionClaim");
    expect(mod.finalizeStaleScheduledSessionOutcomes).toEqual(expect.any(Function));
    const marked = await mod.finalizeStaleScheduledSessionOutcomes!(async () => store, {
      nowMs: Date.parse("2026-10-06T20:20:00.000Z"),
      trigger: "SCHEDULED_CRON",
    });
    expect(marked.status).toBe("finalized");
    expect(marked.marked).toBe(1);
    expect(store.rows.get(scheduledSeismographOutcomeKey("2026-10-05"))).toContain("skipped: unrecoverable");
    expect(store.rows.get(scheduledSeismographOutcomeKey("2026-10-06"))).toContain("pending_score");
  });

  it("is idempotent and fail-closed for a non-cron trigger", async () => {
    const store = memoryStore();
    await pending(store, "2026-10-05", Date.parse("2026-10-05T20:20:00.000Z"));
    const nowMs = Date.parse("2026-10-05T21:15:00.000Z");
    const mod = await import("./scheduledSessionClaim");
    expect(mod.finalizeStaleScheduledSessionOutcomes).toEqual(expect.any(Function));
    const finalize = mod.finalizeStaleScheduledSessionOutcomes!;
    const refused = await finalize(async () => store, { nowMs, trigger: "MANUAL" });
    expect(refused).toEqual({ status: "unavailable", marked: 0 });
    expect(store.rows.get(scheduledSeismographOutcomeKey("2026-10-05"))).toContain("pending_score");
    const wave = await Promise.all([
      finalize(async () => store, { nowMs, trigger: "SCHEDULED_CRON" }),
      finalize(async () => store, { nowMs, trigger: "SCHEDULED_CRON" }),
    ]);
    expect(wave.reduce((sum, row) => sum + row.marked, 0)).toBe(1);
    const again = await finalize(async () => store, { nowMs, trigger: "SCHEDULED_CRON" });
    expect(again.marked).toBe(0);
    expect(store.rows.get(scheduledSeismographOutcomeKey("2026-10-05"))).toContain("skipped: unrecoverable");
  });
});

describe("items 3 and 4 — crypto screener and Pulse use the five evidence states", () => {
  it("does not hardcode COINGECKO LIVE, LIVE DATA, or LIVE FEED", () => {
    const crypto = source("client/src/pages/CryptoSignals.tsx");
    const pulse = source("client/src/components/dashboard/PulseMode.tsx");
    expect(crypto).not.toContain("COINGECKO LIVE");
    expect(crypto).not.toContain(">LIVE DATA<");
    expect(pulse).not.toContain("LIVE FEED");
    expect(pulse).not.toContain("CACHED DATA");
  });

  it("renders LIVE, RECENT, DELAYED, STALE, and UNAVAILABLE for Pulse and the screener", async () => {
    const pulse = await import("../client/src/components/dashboard/PulseMode.tsx");
    const crypto = await import("../client/src/pages/CryptoSignals.tsx");
    const now = fresh;
    const pulseLabels = ["LIVE", "CACHED", "DELAYED", "STALE", "UNAVAILABLE"].map(integrityLabel =>
      renderToStaticMarkup(createElement(pulse.PulseFeedStatus, { integrityLabel })).replace(/<[^>]+>/g, "").trim(),
    );
    expect(pulseLabels).toEqual(["LIVE", "RECENT", "DELAYED", "STALE", "UNAVAILABLE"]);
    const screener = [
      { observedAtMs: now, expected: "LIVE" },
      { observedAtMs: now - 60 * 60 * 1000, expected: "RECENT" },
      { observedAtMs: now, sourceStatus: "delayed", expected: "DELAYED" },
      { observedAtMs: now - 20 * 60 * 60 * 1000, expected: "STALE" },
      { observedAtMs: null, expected: "UNAVAILABLE" },
      { observedAtMs: now + 120_000, expected: "UNAVAILABLE" },
    ];
    for (const row of screener) {
      const html = renderToStaticMarkup(createElement(crypto.CryptoScreenerFreshnessBadge, {
        observedAtMs: row.observedAtMs,
        nowMs: now,
        sourceStatus: row.sourceStatus,
      }));
      expect(html).toContain(row.expected);
    }
  });
});

describe("items 5–8 — withheld indicators are not numeric and the bar rules match", () => {
  it("returns null below 15 closes and for a flat 15-close series, and keeps a genuine all-gain series", () => {
    const rising = Array.from({ length: 14 }, (_, index) => 100 + index);
    expect(computeWildersRSI(rising)).toBeNull();
    expect(computeWildersRSI(Array.from({ length: 15 }, () => 100))).toBeNull();
    expect(computeWildersRSI(Array.from({ length: 15 }, (_, index) => 100 + index))).toBe(100);
  });

  it("does not score equities, crypto, or day trade from a flat series or missing bars", () => {
    const flat = bars(15, () => 100);
    const equityMissing = computeTradingSignal({
      ticker: "RED", price: 100, open: 100, high: 101, low: 99, changePercent: 0,
      volumeMillions: 1, avgVolume: 1, sparkline: [], relativeStrength: 50,
    }, { label: "MODERATE RISK", score: 5 });
    const equityFlat = computeTradingSignal({
      ticker: "FLAT", price: 100, open: 100, high: 101, low: 99, changePercent: 0,
      volumeMillions: 1, avgVolume: 1, sparkline: [], relativeStrength: 50, dailyBars: flat,
    }, { label: "MODERATE RISK", score: 5 });
    for (const signal of [equityMissing, equityFlat]) {
      expect(signal.technicals.rsiEstimate).toBeNull();
      expect(signal.technicals.momentumScore).toBeNull();
      expect(signal.confidence).toBeNull();
      expect(signal.indicatorsAvailable).toBe(false);
    }
    const cryptoFlat = computeCryptoSignal({
      market: {
        symbol: "FLAT", name: "Flat", id: "flat-coin", image: "", currentPrice: 100,
        marketCap: 1, marketCapRank: 1, fullyDilutedValuation: null, totalVolume: 1,
        high24h: 101, low24h: 99, priceChange24h: 0, priceChangePercent24h: 0,
        priceChangePercent7d: 0, priceChangePercent30d: 0, marketCapChange24h: 0,
        marketCapChangePercent24h: 0, circulatingSupply: 1, totalSupply: 1, maxSupply: 1,
        ath: 100, athChangePercent: 0, atl: 100, atlChangePercent: 0, sparkline7d: [],
        lastUpdated: "", volatility24h: 1, distanceFromAth: -1,
      },
      ohlcBars: flat.map(bar => ({ timestamp: bar.timestamp, open: bar.open, high: bar.high, low: bar.low, close: bar.close })),
      btcDominance: 55,
      regime: { label: "MODERATE RISK", score: 5 },
    });
    expect(cryptoFlat.technicals.rsiEstimate).toBeNull();
    expect(cryptoFlat.technicals.momentumScore).toBeNull();
    expect(cryptoFlat.confidence).toBeNull();
    expect(dayTradeIndicatorGate(Array.from({ length: 15 }, () => 100))).toEqual({ available: false, rsi: null });
  });

  it("documents that day trade does not compute MACD and that CoinGecko requests daily bars", () => {
    const day = source("server/dayTradeEngine.ts");
    expect(day).not.toContain("DAY_TRADE_MACD_MIN_COMPLETED_BARS");
    expect(day).toContain("does not compute MACD");
    const proxy = source("server/coingeckoProxy.ts");
    expect(proxy).not.toContain("~30 daily bars");
    expect(proxy).toContain("interval=daily");
    expect(proxy).toMatch(/30-day request[\s\S]{0,80}4-hour|4-hour bars for a 30-day/);
  });
});

describe("item 9 — claim, reconcile, and finalize reject a non-cron trigger", () => {
  it("does not insert a claim unless the trigger is SCHEDULED_CRON", async () => {
    const store = memoryStore();
    const refused = await claimScheduledSeismographSession("2026-10-05", async () => store, {
      nowMs: fresh,
      trigger: "AD_HOC",
    });
    expect(refused).toEqual({ status: "unavailable" });
    expect(store.rows.size).toBe(0);
    const missing = await claimScheduledSeismographSession("2026-10-05", async () => store, { nowMs: fresh });
    expect(missing).toEqual({ status: "unavailable" });
    expect(store.rows.size).toBe(0);
  });
});

describe("missing, stale, future, and empty evidence cannot fabricate a customer signal", () => {
  const pages = [
    { surface: "Today's Story", missing: evidenceStatusFromIntegrity(null), stale: evidenceStatusFromIntegrity("STALE") },
    { surface: "Pulse", missing: evidenceStatusFromIntegrity(undefined), stale: evidenceStatusFromIntegrity("STALE") },
    { surface: "Alerts", missing: evidenceStatusFromIntegrity(""), stale: evidenceStatusFromIntegrity("STALE") },
    { surface: "Day Trade provider", missing: evidenceStatusFromFailureStats(null), stale: evidenceStatusFromFailureStats({ total: 5, failures: 2 }) },
  ];

  it.each(pages)("$surface withholds missing evidence", (row) => {
    expect(row.missing).not.toBe("LIVE");
    expect(row.stale === "STALE" || row.stale === "UNAVAILABLE").toBe(true);
  });

  it("watchlist, alt rotation, and the seismograph title do not default a missing reading to LIVE", () => {
    expect(source("client/src/pages/Watchlist.tsx")).not.toContain("stateLabel ?? 'LIVE'");
    expect(source("client/src/pages/Watchlist.tsx")).not.toContain('stateLabel ?? "LIVE"');
    expect(source("client/src/pages/AltRotation.tsx")).not.toMatch(/>\s*LIVE\s*</);
    expect(source("client/src/pages/SeismographicDash.tsx")).not.toContain("LIVE SEISMOGRAPH");
    expect(source("client/src/pages/Alerts.tsx")).not.toContain("LIVE VERIFIED");
    expect(source("client/src/pages/DayTradeIntelligence.tsx")).not.toContain("flowing normally");
  });
});
