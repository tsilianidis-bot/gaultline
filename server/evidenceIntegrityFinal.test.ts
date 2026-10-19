/**
 * Final evidence-integrity regressions. Each case reproduces a reviewer blocker
 * against the pre-fix behavior. Run red before the fix, then green after it.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import {
  EVIDENCE_LIVE_MAX_AGE_MS,
  evidenceStatusLabel,
} from "../shared/evidenceStatus";
import { evidenceFreshnessLabel, providerRowFreshness } from "./evidenceFreshness";
import { computeMACD, computeWildersRSI } from "./tradingSignals";
import { getDailyBars } from "./yahooProxy";
import { getCoinOHLC } from "./coingeckoProxy";
import {
  admitScheduledSessionOutcome,
  claimScheduledSeismographSession,
  failScheduledSession,
  reconcileScheduledSessionScore,
  type SessionClaimStore,
} from "./scheduledSessionClaim";

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
  };
}

const inWindow = Date.parse("2026-10-05T20:20:00.000Z");
const outsideWindow = Date.parse("2026-10-05T21:00:00.000Z");

describe("blocker 1 — missing FRED status or timestamp is never verified", () => {
  const now = Date.parse("2026-10-05T20:20:00.000Z");

  it.each([null, undefined, ""])("fred status %j with a fresh timestamp is Unavailable", (fredStatus) => {
    expect(evidenceFreshnessLabel({
      scope: "macro",
      canonicalQuality: "HEALTHY",
      fredStatus,
      observedAtMs: now,
      nowMs: now,
    })).toBe("Unavailable");
    expect(evidenceStatusLabel({
      observedAtMs: now,
      nowMs: now,
      quality: "HEALTHY",
      sourceStatus: fredStatus,
    })).toBe("UNAVAILABLE");
  });

  it("does not treat a missing observation time as fresh", () => {
    expect(evidenceFreshnessLabel({
      scope: "macro",
      canonicalQuality: "HEALTHY",
      fredStatus: "live",
      observedAtMs: null,
      nowMs: now,
    })).toBe("Unavailable");
  });

  it("Ask path does not substitute assembly computedAt for a missing FRED asOf", () => {
    const ask = source("server/routers/smartDiscovery.ts");
    const marker = "const observedAt = fredObservationMs";
    const observed = ask.slice(ask.indexOf(marker), ask.indexOf(marker) + 180);
    expect(observed).not.toMatch(/computedAt/);
    expect(observed).toMatch(/fred\?\.asOf/);
  });
});

describe("blocker 2 — empty quotes are Unavailable", () => {
  const now = Date.parse("2026-10-05T20:20:00.000Z");
  const liveMacro = {
    scope: "macro" as const,
    canonicalQuality: "HEALTHY",
    fredStatus: "live",
    observedAtMs: now,
    nowMs: now,
  };

  it("classifies quotes: [] as Unavailable", () => {
    expect(evidenceFreshnessLabel({ ...liveMacro, quotes: [] })).toBe("Unavailable");
  });

  it("verifies canonical and FRED only when the caller declares macro scope", () => {
    expect(evidenceFreshnessLabel(liveMacro)).toBe("Verified source");
    expect(evidenceFreshnessLabel({ ...liveMacro, scope: undefined })).toBe("Unavailable");
    expect(evidenceFreshnessLabel({ ...liveMacro, scope: "ticker" })).toBe("Unavailable");
  });

  it("does not verify an unmatched ticker from macro evidence alone", () => {
    const router = source("server/routers/smartDiscovery.ts");
    expect(router).toContain("quotes: quote ? [quote] : []");
    expect(evidenceFreshnessLabel({
      ...liveMacro,
      quotes: [],
    })).not.toBe("Verified source");
  });
});

describe("blocker 3 — future timestamps and the 20-minute boundary", () => {
  const now = Date.parse("2026-10-05T20:20:00.000Z");
  const live = { nowMs: now, quality: "HEALTHY" as const, sourceStatus: "live" };

  it("rejects an observation more than 60 seconds in the future", () => {
    expect(evidenceStatusLabel({ ...live, observedAtMs: now + 60_001 })).toBe("UNAVAILABLE");
    expect(providerRowFreshness({
      provider: "coingecko",
      observedAtMs: now + 60_001,
      nowMs: now,
    })).toBe("UNAVAILABLE");
  });

  it("allows only the documented 60 second clock skew", () => {
    expect(evidenceStatusLabel({ ...live, observedAtMs: now + 60_000 })).toBe("LIVE");
  });

  it("keeps exact 20:00 LIVE, 20:00.001 RECENT, and 19:59 LIVE", () => {
    expect(evidenceStatusLabel({ ...live, observedAtMs: now - EVIDENCE_LIVE_MAX_AGE_MS })).toBe("LIVE");
    expect(evidenceStatusLabel({ ...live, observedAtMs: now - EVIDENCE_LIVE_MAX_AGE_MS - 1 })).toBe("RECENT");
    expect(evidenceStatusLabel({ ...live, observedAtMs: now - (19 * 60 * 1000 + 59 * 1000) })).toBe("LIVE");
  });
});

describe("blocker 4 — Today's Story badge follows evidence status", () => {
  it("does not hardcode LIVE INTELLIGENCE", () => {
    expect(source("client/src/pages/TodaysStory.tsx")).not.toContain("LIVE INTELLIGENCE");
  });

  it("renders LIVE, RECENT, DELAYED, STALE, and UNAVAILABLE", async () => {
    const page = await import("../client/src/pages/TodaysStory.tsx");
    const Badge = page.TodaysStoryStatusBadge;
    expect(Badge).toEqual(expect.any(Function));
    const rendered = ["LIVE", "CACHED", "DELAYED", "STALE", "UNAVAILABLE"].map(label =>
      renderToStaticMarkup(createElement(Badge, { integrityLabel: label })),
    );
    expect(rendered.map(html => html.replace(/<[^>]+>/g, "").trim())).toEqual([
      "LIVE", "RECENT", "DELAYED", "STALE", "UNAVAILABLE",
    ]);
  });
});

describe("blocker 5 — withheld crypto RSI is not drawn", () => {
  it("server withholds rsi as null and the client does not render RSI~ or the bar", async () => {
    const { computeCryptoSignal } = await import("./cryptoSignals");
    const withheld = computeCryptoSignal({
      market: {
        symbol: "RED",
        name: "Red",
        id: "red-rsi",
        currentPrice: 100,
        high24h: 101,
        low24h: 99,
        priceChangePercent24h: 1,
        totalVolume: 1,
        marketCap: 1,
        volatility24h: 1,
        distanceFromAth: 1,
        priceChangePercent7d: 1,
        priceChangePercent30d: 1,
        sparkline7d: [100],
      } as never,
      ohlcBars: [{ timestamp: 1, open: 1, high: 1, low: 1, close: 100 }],
      regime: { label: "Neutral", score: 5 },
    });
    expect(withheld.technicals.rsiEstimate).toBeNull();
    expect(withheld.actionLabel).toBe("Unavailable");

    const page = await import("../client/src/pages/CryptoSignals.tsx");
    const View = page.CryptoRsiReadout;
    const hidden = renderToStaticMarkup(createElement(View, {
      rsiEstimate: null,
      rsiLabel: "Neutral",
      rsiIsTrue: false,
      actionLabel: "Unavailable",
    }));
    expect(hidden).not.toMatch(/RSI~/);
    expect(hidden).not.toMatch(/rsi-bar|RSIBar/i);
    const shown = renderToStaticMarkup(createElement(View, {
      rsiEstimate: 62.4,
      rsiLabel: "Neutral",
      rsiIsTrue: true,
      actionLabel: "Watch",
    }));
    expect(shown).toContain("RSI(14)");
    expect(shown).toContain("62");
  });
});

describe("blocker 6 — in-progress candles stay out of indicator bars", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  function yahooPayload(timestamps: number[]) {
    return {
      chart: {
        result: [{
          timestamp: timestamps,
          indicators: {
            quote: [{
              close: timestamps.map(() => 100),
              open: timestamps.map(() => 100),
              high: timestamps.map(() => 101),
              low: timestamps.map(() => 99),
              volume: timestamps.map(() => 1_000),
            }],
          },
        }],
      },
    };
  }

  it("keeps an equity bar at the NYSE close and drops it one millisecond before", async () => {
    const friday = Math.floor(Date.parse("2026-10-02T13:30:00.000Z") / 1000);
    const monday = Math.floor(Date.parse("2026-10-05T13:30:00.000Z") / 1000);
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify(yahooPayload([friday, monday])), { status: 200 })));
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-05T19:59:59.999Z"));
    const before = await getDailyBars("RED-EQ-BEFORE", "3mo");
    expect(before.map(bar => new Date(bar.timestamp).toISOString())).toEqual(["2026-10-02T13:30:00.000Z"]);
    vi.setSystemTime(new Date("2026-10-05T20:00:00.000Z"));
    const after = await getDailyBars("RED-EQ-AFTER", "3mo");
    expect(after.map(bar => new Date(bar.timestamp).toISOString())).toEqual([
      "2026-10-02T13:30:00.000Z",
      "2026-10-05T13:30:00.000Z",
    ]);
  });

  it("uses the 13:00 ET early close on Christmas Eve", async () => {
    const eve = Math.floor(Date.parse("2026-12-24T14:30:00.000Z") / 1000);
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify(yahooPayload([eve])), { status: 200 })));
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-12-24T17:59:59.999Z"));
    expect(await getDailyBars("RED-EQ-EVE-OPEN", "3mo")).toHaveLength(0);
    vi.setSystemTime(new Date("2026-12-24T18:00:00.000Z"));
    expect(await getDailyBars("RED-EQ-EVE-CLOSE", "3mo")).toHaveLength(1);
  });

  it("drops the open CoinGecko candle and the current UTC day", async () => {
    const now = Date.parse("2026-10-05T12:00:00.000Z");
    const closed = now - 5 * 60 * 60 * 1000;
    const open = now - 60 * 60 * 1000;
    const yesterday = Date.parse("2026-10-04T00:00:00.000Z");
    const today = Date.parse("2026-10-05T00:00:00.000Z");
    vi.stubGlobal("fetch", vi.fn(async (url: string) => {
      const candles = String(url).includes("days=30")
        ? [[closed, 1, 2, 0.5, 1.5], [open, 1, 2, 0.5, 1.6]]
        : [[yesterday, 1, 2, 0.5, 1.5], [today, 1, 2, 0.5, 1.6]];
      return new Response(JSON.stringify(candles), { status: 200 });
    }));
    vi.useFakeTimers();
    vi.setSystemTime(new Date(now));
    const intraday = await getCoinOHLC("red-candle-intraday", 30);
    expect(intraday.map(bar => bar.timestamp)).toEqual([closed]);
    const daily = await getCoinOHLC("red-candle-daily", 90);
    expect(daily.map(bar => bar.timestamp)).toEqual([yesterday]);
  });

  it("shares the 15-bar RSI and 35-bar MACD minimum across equities, crypto, and day trade", () => {
    const trading = source("server/tradingSignals.ts");
    const crypto = source("server/cryptoSignals.ts");
    const day = source("server/dayTradeEngine.ts");
    expect(trading).toMatch(/export const RSI_MIN_COMPLETED_BARS = 15/);
    expect(trading).toMatch(/export const MACD_MIN_COMPLETED_BARS = 35/);
    expect(crypto).toContain("RSI_MIN_COMPLETED_BARS");
    expect(crypto).toContain("MACD_MIN_COMPLETED_BARS");
    expect(day).toContain("RSI_MIN_COMPLETED_BARS");
    expect(day).toContain("does not compute MACD");
    expect(day).not.toContain("DAY_TRADE_MACD_MIN_COMPLETED_BARS");
    const closes = (n: number) => Array.from({ length: n }, (_, i) => 100 + i);
    expect(computeMACD(closes(34))).toBeNull();
    expect(computeMACD(closes(35))).not.toBeNull();
    expect(computeMACD(closes(39))).not.toBeNull();
  });
});

describe("blocker 9 — one-price RSI is insufficient, not 50", () => {
  it("returns null for a one-price series and for fewer than two changes", () => {
    expect(computeWildersRSI([100])).toBeNull();
    expect(computeWildersRSI([100, 100])).not.toBe(50);
  });
});

describe("findings 7 and 8 — outcome reconcile and generation cap", () => {
  it("reconciles a crash after the outcome insert without a second score write", async () => {
    const store = memoryStore();
    const claimed = await claimScheduledSeismographSession("2026-10-05", async () => store, { nowMs: inWindow, trigger: "SCHEDULED_CRON" });
    await admitScheduledSessionOutcome("2026-10-05", { pressureScore: 42, regime: "MODERATE RISK" }, async () => store, inWindow);
    await failScheduledSession("2026-10-05", claimed.generation!, async () => store, inWindow);
    const next = await claimScheduledSeismographSession("2026-10-05", async () => store, {
      nowMs: inWindow + 1000,
      trigger: "SCHEDULED_CRON",
    });
    expect(next.status).toBe("reconcile");
    let writes = 0;
    const options = {
      nowMs: inWindow + 1000,
      trigger: "SCHEDULED_CRON" as const,
      evidenceVerified: true,
      readingExists: async () => writes > 0,
      recordScore: async () => { writes += 1; },
    };
    const wave = await Promise.all([
      reconcileScheduledSessionScore("2026-10-05", async () => store, options),
      reconcileScheduledSessionScore("2026-10-05", async () => store, options),
    ]);
    expect(writes).toBe(1);
    expect(wave.filter(result => result === "scored")).toHaveLength(1);
    expect(wave.filter(result => result === "already_scored")).toHaveLength(1);
    await expect(reconcileScheduledSessionScore("2026-10-05", async () => store, options)).resolves.toBe("already_scored");
    expect(writes).toBe(1);
  });

  it("stops at one recovery and records exhausted", async () => {
    const store = memoryStore();
    const first = await claimScheduledSeismographSession("2026-10-05", async () => store, { nowMs: inWindow, trigger: "SCHEDULED_CRON" });
    await failScheduledSession("2026-10-05", first.generation!, async () => store, inWindow);
    const recovered = await claimScheduledSeismographSession("2026-10-05", async () => store, {
      nowMs: inWindow + 1000,
      trigger: "SCHEDULED_CRON",
    });
    expect(recovered).toMatchObject({ status: "claimed", generation: 2, mode: "recovered" });
    await failScheduledSession("2026-10-05", 2, async () => store, inWindow + 1000);
    const wave = await Promise.all([
      claimScheduledSeismographSession("2026-10-05", async () => store, { nowMs: inWindow + 2000, trigger: "SCHEDULED_CRON" }),
      claimScheduledSeismographSession("2026-10-05", async () => store, { nowMs: inWindow + 2000, trigger: "SCHEDULED_CRON" }),
    ]);
    expect(wave.every(result => result.status === "exhausted")).toBe(true);
    expect(JSON.stringify([...store.rows.values()])).toContain("exhausted");
  });

  it("does not reconcile a pending outcome after the NYSE window closes", async () => {
    const store = memoryStore();
    const claimed = await claimScheduledSeismographSession("2026-10-05", async () => store, { nowMs: inWindow, trigger: "SCHEDULED_CRON" });
    await admitScheduledSessionOutcome("2026-10-05", { pressureScore: 42, regime: "MODERATE RISK" }, async () => store, inWindow);
    await failScheduledSession("2026-10-05", claimed.generation!, async () => store, inWindow);
    const late = await claimScheduledSeismographSession("2026-10-05", async () => store, {
      nowMs: outsideWindow,
      trigger: "SCHEDULED_CRON",
    });
    expect(late.status).not.toBe("claimed");
    expect(late.status).not.toBe("reconcile");
    const outcome = [...store.rows.entries()].find(([key]) => key.includes("outcome"));
    expect(outcome?.[1]).toMatch(/unrecoverable|skipped: unrecoverable/);
  });
});

describe("finding 10 — hardcoded LIVE claims", () => {
  it("removes the named unconditional live sentences", () => {
    expect(source("client/src/pages/Alerts.tsx")).not.toContain("LIVE VERIFIED EVENT");
    expect(source("client/src/pages/Alerts.tsx")).not.toContain("LIVE VERIFIED");
    expect(source("client/src/pages/DayTradeIntelligence.tsx")).not.toContain("Live data is flowing normally");
    expect(source("client/src/components/dashboard/PulseMode.tsx")).not.toContain("LIVE INTELLIGENCE");
  });
});
