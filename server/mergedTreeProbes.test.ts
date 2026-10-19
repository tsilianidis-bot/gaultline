import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { evidenceFreshnessLabel } from "./evidenceFreshness";
import { evidenceStatusLabel } from "../shared/evidenceStatus";
import { computeWildersRSI } from "./tradingSignals";
import { computeCryptoSignal } from "./cryptoSignals";
import { completedYahooDailyBars, type YahooDailyBar } from "./yahooProxy";
import { captureTrackRecordFromScheduledRun } from "./trackRecordCapture";
import {
  admitScheduledSessionOutcome,
  claimScheduledSeismographSession,
  failScheduledSession,
  finalizeStaleScheduledSessionOutcomes,
  reconcileScheduledSessionScore,
  type SessionClaimStore,
} from "./scheduledSessionClaim";
import { TodaysStoryStatusBadge } from "../client/src/pages/TodaysStory.tsx";

function store(): SessionClaimStore & { rows: Map<string, string> } {
  const rows = new Map<string, string>();
  return {
    rows,
    async read(key) { return rows.get(key) ?? null; },
    async insert(key, value) {
      if (rows.has(key)) throw Object.assign(new Error("dup"), { code: "ER_DUP_ENTRY" });
      rows.set(key, value);
    },
    async cas(key, previous, next) {
      if (rows.get(key) !== previous) return false;
      rows.set(key, next);
      return true;
    },
    async listByPrefix(prefix) {
      return [...rows.entries()].filter(([key]) => key.startsWith(prefix)).map(([key, value]) => ({ key, value }));
    },
  };
}

const fresh = Date.parse("2026-10-05T20:20:00.000Z");
const bar = (timestamp: number): YahooDailyBar => ({ timestamp, open: 10, high: 11, low: 9, close: 10.5, volume: 1 });

describe("merged-tree reviewer probes", () => {
  it("rejects blank FRED, empty quotes, omitted ticker quotes, and a 61s future timestamp", () => {
    expect(evidenceFreshnessLabel({
      scope: "macro",
      canonicalQuality: "HEALTHY",
      fredStatus: "",
      observedAtMs: fresh,
      nowMs: fresh,
    })).toBe("Unavailable");
    expect(evidenceFreshnessLabel({
      scope: "macro",
      canonicalQuality: "HEALTHY",
      fredStatus: "live",
      observedAtMs: fresh,
      nowMs: fresh,
      quotes: [],
    })).toBe("Unavailable");
    expect(evidenceFreshnessLabel({
      scope: "ticker",
      canonicalQuality: "HEALTHY",
      fredStatus: "live",
      observedAtMs: fresh,
      nowMs: fresh,
    })).toBe("Unavailable");
    expect(evidenceStatusLabel({
      observedAtMs: fresh + 61_000,
      nowMs: fresh,
      sourceStatus: "live",
      quality: "HEALTHY",
      hasObservation: true,
    })).toBe("UNAVAILABLE");
    expect(readFileSync(new URL("./routers/smartDiscovery.ts", import.meta.url), "utf8")).not.toContain("asOf ?? seismographOutput?.computedAt");
  });

  it("withholds RSI below 15 closes and does not invent crypto RSI from a 24h change", () => {
    expect(computeWildersRSI([100])).toBeNull();
    expect(computeWildersRSI(Array.from({ length: 14 }, (_, index) => 100 + index))).toBeNull();
    const fromChange = computeCryptoSignal({
      market: {
        symbol: "MOON", name: "Moon", id: "moon", image: "", currentPrice: 100,
        marketCap: 1, marketCapRank: 1, fullyDilutedValuation: null, totalVolume: 1,
        high24h: 120, low24h: 80, priceChange24h: 12, priceChangePercent24h: 12,
        priceChangePercent7d: 20, priceChangePercent30d: 30, marketCapChange24h: 0,
        marketCapChangePercent24h: 0, circulatingSupply: 1, totalSupply: 1, maxSupply: 1,
        ath: 200, athChangePercent: -50, atl: 1, atlChangePercent: 100, sparkline7d: [80, 90, 100],
        lastUpdated: "", volatility24h: 4, distanceFromAth: -50,
      },
      btcDominance: null,
      regime: { label: "MODERATE RISK", score: 5 },
    });
    expect(fromChange.technicals.rsiEstimate).toBeNull();
    expect(fromChange.technicals.momentumScore).toBeNull();
    expect(fromChange.confidence).toBeNull();
    expect(readFileSync(new URL("./cryptoSignals.ts", import.meta.url), "utf8")).not.toContain(": 50");
  });

  it("renders Today's Story from evidence status and keeps a closed Yahoo session bar", () => {
    const story = renderToStaticMarkup(createElement(TodaysStoryStatusBadge, { integrityLabel: null }));
    expect(story).toContain("UNAVAILABLE");
    expect(story).not.toContain("LIVE");
    const friday = Date.parse("2026-10-16T13:30:00.000Z");
    expect(completedYahooDailyBars([bar(friday)], Date.parse("2026-10-16T19:30:00.000Z"))).toEqual([]);
    expect(completedYahooDailyBars([bar(friday)], Date.parse("2026-10-16T20:20:00.000Z")).map(item => item.timestamp)).toEqual([friday]);
  });

  it("caps recovery at one generation and finalizes an out-of-window pending row without a score", async () => {
    const memory = store();
    const provider = async () => memory;
    const first = await claimScheduledSeismographSession("2026-10-05", provider, { nowMs: fresh, trigger: "SCHEDULED_CRON" });
    expect(first.status).toBe("claimed");
    await failScheduledSession("2026-10-05", first.generation!, provider, fresh);
    const recovered = await claimScheduledSeismographSession("2026-10-05", provider, { nowMs: fresh + 1000, trigger: "SCHEDULED_CRON" });
    expect(recovered).toMatchObject({ status: "claimed", generation: 2 });
    await failScheduledSession("2026-10-05", 2, provider, fresh + 1000);
    await expect(claimScheduledSeismographSession("2026-10-05", provider, { nowMs: fresh + 2000, trigger: "SCHEDULED_CRON" }))
      .resolves.toMatchObject({ status: "exhausted" });

    const pending = store();
    await claimScheduledSeismographSession("2026-10-05", async () => pending, { nowMs: fresh, trigger: "SCHEDULED_CRON" });
    await admitScheduledSessionOutcome("2026-10-05", { pressureScore: 40, regime: "MODERATE RISK" }, async () => pending, fresh);
    let writes = 0;
    const outside = Date.parse("2026-10-05T21:15:00.000Z");
    const finalized = await finalizeStaleScheduledSessionOutcomes(async () => pending, { nowMs: outside, trigger: "SCHEDULED_CRON" });
    expect(finalized.marked).toBe(1);
    expect(writes).toBe(0);
    expect([...pending.rows.values()].join("\n")).toContain("skipped: unrecoverable");
  });

  it("writes a reconciled score once and leaves Track Record capture off", async () => {
    const memory = store();
    const provider = async () => memory;
    await claimScheduledSeismographSession("2026-10-05", provider, { nowMs: fresh, trigger: "SCHEDULED_CRON" });
    await admitScheduledSessionOutcome("2026-10-05", { pressureScore: 41, regime: "MODERATE RISK" }, provider, fresh);
    let writes = 0;
    const options = {
      nowMs: fresh + 1000,
      trigger: "SCHEDULED_CRON" as const,
      evidenceVerified: true,
      readingExists: async () => writes > 0,
      recordScore: async () => { writes += 1; },
    };
    expect(await reconcileScheduledSessionScore("2026-10-05", provider, options)).toBe("scored");
    expect(await reconcileScheduledSessionScore("2026-10-05", provider, options)).not.toBe("scored");
    expect(writes).toBe(1);
    const capture = await captureTrackRecordFromScheduledRun({
      run: { trigger: "SCHEDULED_CRON" },
      pressureIndex: 41,
      regime: "MODERATE RISK",
      generatedAt: new Date(fresh).toISOString(),
      env: {},
    });
    expect(capture).toEqual({ recorded: false, reason: "cron_writes_disabled" });
  });
});
