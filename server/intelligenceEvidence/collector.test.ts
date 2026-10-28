import { describe, expect, it } from "vitest";
import type { CanonicalIntelligenceState } from "../../shared/canonicalIntelligenceState";
import { pressureVectorLabel } from "../../shared/pressureVectorLabels";
import { canonicalEngineIntegrityEvidence } from "../canonicalIntelligenceState";
import { captureTrackRecordFromScheduledRun } from "../trackRecordCapture";
import { buildEvidenceSnapshot, withinDeadline } from "./collector";

const NOW = new Date("2026-10-16T15:00:00.000Z");
const NOW_MS = NOW.getTime();

const canonical = (): CanonicalIntelligenceState => ({
  stateId: "state-verified-1",
  generatedAt: new Date(NOW_MS - 60_000).toISOString(),
  modelVersion: "champion-v1",
  confidenceOrEvidenceQuality: "HEALTHY",
  engines: [{
    engineId: "credit-stress", engineName: "Credit stress", value: 31, unit: "score_0_to_100",
    classification: null, direction: "Stable", acceleration: null, persistence: null,
    observedAt: null, calculatedAt: new Date(NOW_MS - 60_000).toISOString(), sourceInputIds: ["BAMLH0A0HYM2"],
    qualityStatus: "HEALTHY", freshnessStatus: "CURRENT", fallbackStatus: "NONE",
    modelVersion: "champion-v1", calculationVersion: "score-v1", contributionToComposite: true,
  }],
} as unknown as CanonicalIntelligenceState);

function inputs(overrides: Record<string, unknown> = {}) {
  return {
    canonical: canonical(),
    quotes: ["SPY", "QQQ", "IWM", "^VIX"].map((ticker, index) => ({
      ticker, price: 100 + index, prevClose: 99, open: 99, high: 101, low: 98, volume: 1000, change: 1, changePercent: 1,
      marketState: "REGULAR" as const, isDelayed: true, source: "yahoo" as const, observedAt: NOW_MS - 120_000, fetchedAt: NOW_MS - 60_000,
    })),
    crypto: { totalMarketCap: 2_000_000_000_000, totalVolume24h: 100, btcDominance: 50, ethDominance: 15, marketCapChangePercent24h: 1, activeCryptocurrencies: 1, markets: 1, observedAt: NOW_MS - 120_000, fetchedAt: NOW_MS - 60_000 },
    fred: {
      timestamp: new Date(NOW_MS - 60_000).toISOString(),
      results: {
        DGS10: { observations: [{ date: "2026-10-16", value: "4.12" }], cached: false },
        DGS2: { observations: [{ date: "2026-10-16", value: "3.77" }], cached: false },
        BAMLH0A0HYM2: { observations: [{ date: "2026-10-16", value: "3.18" }], cached: false },
      },
    },
    ...overrides,
  };
}

const finding = (snapshot: ReturnType<typeof buildEvidenceSnapshot>, id: string) => {
  const item = snapshot.observations.find(observation => observation.id === id);
  if (!item) throw new Error(`Missing evidence ${id}`);
  return item;
};

describe("Phase 1 Intelligence Evidence collector", () => {
  it("maps actual source identity, provider timestamps, and modeled canonical outputs through the gate", () => {
    const snapshot = buildEvidenceSnapshot(inputs(), NOW);
    expect(finding(snapshot, "quote:SPY")).toMatchObject({ provider: "Yahoo Finance", validationStatus: "verified", supportsCurrentClaim: true, observedAt: "2026-10-16T14:58:00.000Z", validUntil: "2026-10-16T15:18:00.000Z" });
    expect(finding(snapshot, "fred:DGS10")).toMatchObject({ provider: "Federal Reserve Economic Data (FRED)", validationStatus: "unavailable", supportsCurrentClaim: false, observedAt: null, validUntil: null, sourceObservationDate: "2026-10-16", historicalValue: { value: 4.12, observedAt: "2026-10-16" } });
    expect(finding(snapshot, "canonical:credit-stress")).toMatchObject({ origin: "modeled", modelVersion: "champion-v1", validationStatus: "delayed", supportsCurrentClaim: true });
  });

  it("does not fabricate midnight or use retrieval time for date-only FRED observations", () => {
    const snapshot = buildEvidenceSnapshot(inputs(), NOW);
    for (const id of ["fred:DGS10", "fred:DGS2", "fred:BAMLH0A0HYM2"]) {
      const item = finding(snapshot, id);
      expect(item.observedAt).toBeNull();
      expect(item.receivedAt).toBe("2026-10-16T14:59:00.000Z");
      expect(item.sourceObservationDate).toBe("2026-10-16");
      expect(item.supportsCurrentClaim).toBe(false);
      expect(item.temporalDetail).toContain("date precision only");
      expect(item.historicalValue?.reason).toContain("not eligible for current claims");
    }
    expect(snapshot.domains.find(domain => domain.id === "bonds_rates")?.currentObservationIds).toEqual([]);
    expect(snapshot.domains.find(domain => domain.id === "bonds_rates")?.historicalObservationIds).toEqual(["fred:DGS10", "fred:DGS2"]);
  });

  it("maps a CoinGecko aggregate only when its provider observation timestamp is present", () => {
    const snapshot = buildEvidenceSnapshot(inputs(), NOW);
    expect(finding(snapshot, "coingecko:global-market-cap")).toMatchObject({ value: 2_000_000_000_000, validationStatus: "verified", supportsCurrentClaim: true, observedAt: "2026-10-16T14:58:00.000Z", temporalStatus: "delayed" });
    expect(snapshot.providerHealth.find(provider => provider.id === "coingecko")?.status).toBe("healthy");
  });

  it("does not label a future CoinGecko timestamp as delayed", () => {
    const crypto = { ...(inputs().crypto as Record<string, unknown>), observedAt: NOW_MS + 120_000 };
    const snapshot = buildEvidenceSnapshot(inputs({ crypto }), NOW);
    expect(finding(snapshot, "coingecko:global-market-cap").temporalStatus).not.toBe("delayed");
    expect(finding(snapshot, "coingecko:global-market-cap")).toMatchObject({ temporalStatus: "unavailable", supportsCurrentClaim: false });
  });

  it("withholds a CoinGecko aggregate when the adapter has only ingestion time", () => {
    const crypto = { ...(inputs().crypto as Record<string, unknown>), observedAt: null };
    const snapshot = buildEvidenceSnapshot(inputs({ crypto }), NOW);
    expect(finding(snapshot, "coingecko:global-market-cap")).toMatchObject({ value: null, validationStatus: "unavailable", supportsCurrentClaim: false, observedAt: null, temporalStatus: "unavailable" });
    expect(snapshot.providerHealth.find(provider => provider.id === "coingecko")?.status).toBe("unavailable");
  });

  it("labels stale readings as historical instead of treating them as a current market claim", () => {
    const staleQuotes = (inputs().quotes as Array<Record<string, unknown>>).map(quote => ({ ...quote, observedAt: NOW_MS - 30 * 60_000 }));
    const snapshot = buildEvidenceSnapshot(inputs({ quotes: staleQuotes }), NOW);
    expect(finding(snapshot, "quote:SPY")).toMatchObject({ validationStatus: "stale", supportsCurrentClaim: false, historicalValue: { value: 100, observedAt: "2026-10-16T14:30:00.000Z" } });
  });

  it("retains a prior verified reading only as explicitly labelled history when a provider fails", () => {
    const verified = buildEvidenceSnapshot(inputs(), NOW);
    const failedQuotes = (inputs().quotes as Array<Record<string, unknown>>).map(quote => ({ ...quote, price: null, source: "error" as const, observedAt: null, error: "HTTP 429" }));
    const degraded = buildEvidenceSnapshot(inputs({ quotes: failedQuotes }), new Date(NOW_MS + 60_000), verified);
    expect(finding(degraded, "quote:SPY")).toMatchObject({ value: null, validationStatus: "unavailable", supportsCurrentClaim: false, lastVerified: { value: 100, provider: "Yahoo Finance" } });
    expect(degraded.limitations).toContain("Market quote provider SPY: HTTP 429");
  });

  it("marks credential and rate-limit provider failures unavailable without substituting a neutral reading", () => {
    const failedFred = {
      timestamp: NOW.toISOString(),
      results: {
        DGS10: { observations: [], cached: false, error: "HTTP 429" },
        DGS2: { observations: [], cached: false, error: "FRED_API_KEY not configured" },
        BAMLH0A0HYM2: { observations: [], cached: false, error: "HTTP 429" },
      },
    };
    const snapshot = buildEvidenceSnapshot(inputs({ fred: failedFred }), NOW);
    expect(finding(snapshot, "fred:DGS10")).toMatchObject({ value: null, validationStatus: "unavailable", supportsCurrentClaim: false });
    expect(snapshot.providerHealth.find(provider => provider.id === "fred")?.status).toBe("unavailable");
    expect(snapshot.limitations).toContain("FRED DGS10: HTTP 429");
  });

  it("preserves canonical state bytes while creating an integrity input at the boundary", () => {
    const state = canonical();
    const before = JSON.stringify(state);
    const boundary = canonicalEngineIntegrityEvidence(state, state.engines[0]);
    expect(boundary).toMatchObject({ source: "FAULTLINE canonical MarketState", origin: "modeled", modelVersion: "champion-v1" });
    expect(JSON.stringify(state)).toBe(before);
  });

  it("returns a bounded fallback instead of hanging when an upstream provider misses its deadline", async () => {
    const warnings: string[] = [];
    const result = await withinDeadline(new Promise<string>(() => {}), "unavailable", 5, "provider deadline reached", warnings);
    expect(result).toBe("unavailable");
    expect(warnings).toEqual(["provider deadline reached"]);
  });

  it("projects the fixed six evidence domains without calculating a new market score", () => {
    const snapshot = buildEvidenceSnapshot(inputs(), NOW);
    expect(snapshot.domains.map(domain => domain.id)).toEqual(["equities", "bonds_rates", "credit", "liquidity", "volatility", "crypto"]);
    expect(snapshot.domains.find(domain => domain.id === "equities")).toMatchObject({ status: "healthy", currentObservationIds: ["quote:SPY", "quote:QQQ", "quote:IWM"] });
    expect(snapshot.domains.find(domain => domain.id === "crypto")).toMatchObject({ status: "healthy", currentObservationIds: ["coingecko:global-market-cap"] });
    expect(snapshot.domains.find(domain => domain.id === "liquidity")).toMatchObject({ status: "unavailable", observationIds: [] });
  });

  it("keeps the Cboe VIX quote out of the yield-curve vector family", () => {
    const state = canonical();
    const engine = state.engines[0]!;
    state.engines = [
      engine,
      {
        ...engine,
        engineId: "volatility-regime",
        engineName: pressureVectorLabel("volatility-regime"),
      },
    ];
    const snapshot = buildEvidenceSnapshot(inputs({ canonical: state }), NOW);
    const volatility = snapshot.domains.find(domain => domain.id === "volatility");
    expect(volatility?.observationIds).toEqual(["quote:VIX"]);
    expect(volatility?.observationIds).not.toContain("canonical:volatility-regime");
    expect(volatility?.label).not.toBe(pressureVectorLabel("volatility-regime"));
    expect(snapshot.observations.some(item => item.id === "canonical:volatility-regime")).toBe(true);
    expect(snapshot.observations.find(item => item.id === "quote:VIX")?.label).toMatch(/Cboe Volatility Index/);
    expect(snapshot.domains.find(domain => domain.id === "bonds_rates")?.observationIds).toEqual(["fred:DGS10", "fred:DGS2"]);
    for (const id of ["fred:SOFR", "fred:UNRATE", "fred:CPIAUCSL", "fred:PPIACO", "fred:FEDFUNDS"]) {
      expect(snapshot.observations.some(item => item.id === id)).toBe(false);
    }
  });

  it("keeps a five-minute-old closed-session SPY quote historical and out of track-record evidence", async () => {
    const closedAt = new Date("2026-10-16T20:05:00.000Z");
    const closedMs = closedAt.getTime();
    const quotes = (inputs().quotes as Array<Record<string, unknown>>).map(quote => quote.ticker === "SPY"
      ? { ...quote, marketState: "CLOSED", observedAt: closedMs - 5 * 60_000, fetchedAt: closedMs }
      : { ...quote, marketState: "REGULAR", observedAt: closedMs - 60_000, fetchedAt: closedMs });
    const snapshot = buildEvidenceSnapshot(inputs({ quotes }), closedAt);
    expect(finding(snapshot, "quote:SPY")).toMatchObject({
      value: 100,
      validationStatus: "historical",
      supportsCurrentClaim: false,
      temporalStatus: "completed_session",
    });
    expect(finding(snapshot, "quote:SPY").validationStatus).not.toBe("verified");
    const capture = await captureTrackRecordFromScheduledRun({
      run: { trigger: "SCHEDULED_CRON" },
      pressureIndex: 40,
      regime: "ELEVATED",
      generatedAt: closedAt.toISOString(),
      env: { TRACK_RECORD_CRON_WRITES: "true" },
      flagEnabled: true,
      nowMs: closedMs,
      loadSnapshot: async () => ({
        ...snapshot,
        persistence: "recorded" as const,
        providerHealth: snapshot.providerHealth.map(item => ({ ...item, status: "healthy" as const })),
      }),
    });
    expect(capture).toEqual({ recorded: false, reason: "integrity_gate_failed" });
  });

  it("keeps an age-stale in-session quote stale rather than historical", () => {
    const staleQuotes = (inputs().quotes as Array<Record<string, unknown>>).map(quote => ({ ...quote, observedAt: NOW_MS - 25 * 60_000 }));
    const snapshot = buildEvidenceSnapshot(inputs({ quotes: staleQuotes }), NOW);
    expect(finding(snapshot, "quote:SPY")).toMatchObject({ validationStatus: "stale", supportsCurrentClaim: false, temporalStatus: "stale" });
  });

  it("retains a completed session as historical context distinct from a fresh in-session quote", () => {
    const sessionQuotes = (inputs().quotes as Array<Record<string, unknown>>).map(quote => ({
      ...quote,
      marketState: quote.ticker === "QQQ" ? "CLOSED" : "REGULAR",
      observedAt: quote.ticker === "QQQ" ? NOW_MS - 12 * 60 * 60_000 : NOW_MS - 60_000,
    }));
    const snapshot = buildEvidenceSnapshot(inputs({ quotes: sessionQuotes }), NOW);
    expect(finding(snapshot, "quote:SPY")).toMatchObject({ validationStatus: "verified", supportsCurrentClaim: true, temporalStatus: "delayed" });
    expect(finding(snapshot, "quote:QQQ")).toMatchObject({
      validationStatus: "historical",
      supportsCurrentClaim: false,
      temporalStatus: "completed_session",
      value: 101,
    });
  });
});
