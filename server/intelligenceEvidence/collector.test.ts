import { describe, expect, it } from "vitest";
import type { CanonicalIntelligenceState } from "../../shared/canonicalIntelligenceState";
import { canonicalEngineIntegrityEvidence } from "../canonicalIntelligenceState";
import { retainedCanonicalFred, buildEvidenceSnapshot, withinDeadline, isObservedPostCloseQuote, IntelligenceEvidenceCollector } from "./collector";

const NOW = new Date("2026-10-16T15:00:00.000Z");
const NOW_MS = NOW.getTime();

const canonical = (): CanonicalIntelligenceState => ({
  stateId: "state-verified-1",
  domains: { pressureVerification: { status: "verified", receivedAt: new Date(NOW_MS - 60_000).toISOString(), inputs: [
    { seriesId: "DGS10", sourceValue: 4.12, value: 4.12, observationDate: "2026-10-16" },
    { seriesId: "DGS2", sourceValue: 3.77, value: 3.77, observationDate: "2026-10-16" },
    { seriesId: "BAMLH0A0HYM2", sourceValue: 3.18, value: 318, observationDate: "2026-10-16" },
  ] } },
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
    expect(finding(snapshot, "quote:SPY")).toMatchObject({ provider: "Yahoo Finance", validationStatus: "verified", supportsCurrentClaim: true, observedAt: "2026-10-16T14:58:00.000Z" });
    expect(finding(snapshot, "fred:DGS10")).toMatchObject({ provider: "Federal Reserve Economic Data (FRED)", validationStatus: "verified", supportsCurrentClaim: true });
    expect(finding(snapshot, "canonical:credit-stress")).toMatchObject({ origin: "modeled", modelVersion: "champion-v1", validationStatus: "delayed", supportsCurrentClaim: true });
  });

  it("maps a CoinGecko aggregate only when its provider observation timestamp is present", () => {
    const snapshot = buildEvidenceSnapshot(inputs(), NOW);
    expect(finding(snapshot, "coingecko:global-market-cap")).toMatchObject({ value: 2_000_000_000_000, validationStatus: "verified", supportsCurrentClaim: true, observedAt: "2026-10-16T14:58:00.000Z", temporalStatus: "delayed" });
    expect(snapshot.providerHealth.find(provider => provider.id === "coingecko")?.status).toBe("healthy");
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
});

describe("scheduled canonical source reuse — mocked fixtures only", () => {
  it("admits genuine last-session quotes in the unchanged approved regular and early-close windows", () => {
    const regular = { ...inputs().quotes[0], marketState: "CLOSED" as const, observedAt: Date.parse("2026-10-16T20:00:00.000Z") };
    expect(isObservedPostCloseQuote(regular, Date.parse("2026-10-16T20:30:00.000Z"))).toBe(true);
    expect(isObservedPostCloseQuote(regular, Date.parse("2026-10-17T20:30:00.000Z"))).toBe(false);
    expect(isObservedPostCloseQuote({ ...regular, observedAt: Date.parse("2026-10-15T20:00:00.000Z") }, Date.parse("2026-10-16T20:30:00.000Z"))).toBe(false);
    const early = { ...regular, observedAt: Date.parse("2026-11-27T18:00:00.000Z") };
    expect(isObservedPostCloseQuote(early, Date.parse("2026-11-27T21:30:00.000Z"))).toBe(true);
    const nowMs = Date.parse("2026-10-16T20:30:00.000Z");
    const snapshot = buildEvidenceSnapshot(inputs({ quotes: [{ ...regular, fetchedAt: nowMs }], crypto: null }), new Date(nowMs));
    expect(finding(snapshot, "quote:SPY")).toMatchObject({ observedAt: "2026-10-16T20:00:00.000Z", validationStatus: "verified", temporalStatus: "delayed", supportsCurrentClaim: true });
  });
  it("one-shot refresh claims/persists only the supplied exact canonical state; rollover is withheld", async () => {
    const inserted: Array<{ canonicalStateId: string | null }> = [];
    const claimed: Array<string | null> = [];
    const store = {
      tryClaim: async (_now: number, stateId: string | null) => { claimed.push(stateId); return "CLAIMED"; },
      insert: async (snapshot: { canonicalStateId: string | null }) => { inserted.push(snapshot); return "INSERTED"; },
      loadLatest: async () => null,
    };
    const collector = new IntelligenceEvidenceCollector(store as never, async () => inputs());
    expect(await collector.refreshForCanonicalRun("different-state")).toBeNull();
    expect(inserted).toHaveLength(0);
    expect((await collector.refreshForCanonicalRun("state-verified-1"))?.canonicalStateId).toBe("state-verified-1");
    expect(claimed).toEqual(["state-verified-1"]);
    expect(inserted).toHaveLength(1);
  });
});

describe("retained macro source identity — MOCK only", () => {
  it("retains original receipt/value rather than later FRED release or computation time", () => {
    const original = retainedCanonicalFred(canonical());
    expect(original?.timestamp).toBe(new Date(NOW_MS - 60_000).toISOString());
    expect(original?.results.DGS10.observations[0]).toMatchObject({ date: "2026-10-16", value: "4.12" });
    const unknown = canonical(); delete (unknown.domains.pressureVerification as {receivedAt?:string}).receivedAt;
    expect(retainedCanonicalFred(unknown)).toBeNull();
  });
});
