import { describe, expect, it } from "vitest";
import type { IntelligenceEvidenceResponse } from "@shared/intelligenceEvidence";
import { presentVerifiedEvidenceCore } from "../client/src/components/intelligence-core-visual/evidencePresentation";

function response(): IntelligenceEvidenceResponse {
  const now = Date.now();
  const observedAt = new Date(now - 90_000).toISOString();
  const receivedAt = new Date(now - 60_000).toISOString();
  const capturedAt = new Date(now - 30_000).toISOString();
  const validUntil = new Date(now + 10 * 60_000).toISOString();
  return {
    enabled: true,
    status: "CURRENT",
    reason: null,
    nextCollectionAt: new Date(now + 5 * 60_000).toISOString(),
    snapshot: {
      kind: "intelligence-evidence-snapshot",
      methodVersion: "intelligence-evidence-v1-2026-10-16",
      capturedAt,
      canonicalStateId: "canonical-1",
      observations: [{
        id: "quote:VIX",
        label: "Cboe Volatility Index (^VIX)",
        kind: "market_quote",
        provider: "Yahoo Finance",
        origin: "observed",
        value: 18.5,
        unit: "points",
        observedAt,
        receivedAt,
        maxAgeMs: 20 * 60_000,
        validUntil,
        validationStatus: "verified",
        supportsCurrentClaim: true,
        validationReason: "Valid provenance, timestamps and source health.",
        modelVersion: null,
        sourceIdentifier: "yahoo:^VIX",
        temporalStatus: "live",
        temporalDetail: "Provider-reported observation is within the permitted current-use window.",
        historicalValue: null,
        lastVerified: null,
      }],
      providerHealth: [
        { id: "canonical", label: "Canonical MarketState", provider: "FAULTLINE", status: "healthy", observedAt, checkedAt: capturedAt, detail: "Verified canonical state." },
        { id: "yahoo", label: "Market quotes", provider: "Yahoo Finance", status: "healthy", observedAt, checkedAt: capturedAt, detail: "Verified quotes." },
        { id: "fred", label: "Macro and credit releases", provider: "FRED", status: "healthy", observedAt, checkedAt: capturedAt, detail: "Verified macro releases." },
        { id: "coingecko", label: "Crypto aggregate", provider: "CoinGecko", status: "healthy", observedAt, checkedAt: capturedAt, detail: "Verified crypto aggregate." },
      ],
      domains: [
        { id: "equities", label: "Equities", status: "unavailable", observationIds: [], currentObservationIds: [], historicalObservationIds: [], limitation: "No verified equity observations." },
        { id: "bonds_rates", label: "Bonds / Rates", status: "unavailable", observationIds: [], currentObservationIds: [], historicalObservationIds: [], limitation: "No verified rate observations." },
        { id: "credit", label: "Credit", status: "unavailable", observationIds: [], currentObservationIds: [], historicalObservationIds: [], limitation: "No verified credit observations." },
        { id: "liquidity", label: "Liquidity", status: "unavailable", observationIds: [], currentObservationIds: [], historicalObservationIds: [], limitation: "No verified liquidity observations." },
        { id: "volatility", label: "Volatility", status: "healthy", observationIds: ["quote:VIX"], currentObservationIds: ["quote:VIX"], historicalObservationIds: [], limitation: null },
        { id: "crypto", label: "Crypto", status: "unavailable", observationIds: [], currentObservationIds: [], historicalObservationIds: [], limitation: "No verified crypto observations." },
      ],
      limitations: [],
      persistence: "recorded",
    },
  };
}

const canonical = () => ({
  stateId: "canonical-1",
  generatedAt: new Date(Date.now() - 60_000).toISOString(),
  pressureIndex: 42,
  regime: "Caution",
});

describe("verified evidence Core presentation", () => {
  it("withholds the full assessment while retaining only server-admitted direct evidence", () => {
    const model = presentVerifiedEvidenceCore(response(), canonical());
    expect(model.mode).toBe("production");
    expect(model.integrity).toBe("degraded");
    expect(model.pressure).toEqual({ value: null, status: "unavailable", evidenceIds: [] });
    expect(model.regime).toEqual({ label: null, evidenceIds: [] });
    expect(model.evidence).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: "quote:VIX", status: "current", validUntil: expect.any(String) }),
    ]));
    expect(model.domains.find(domain => domain.id === "volatility")?.status).toBe("current");
    expect(model.domains.find(domain => domain.id === "breadth")?.status).toBe("unavailable");
    expect(model.domains.find(domain => domain.id === "ai")?.status).toBe("unavailable");
    expect(model.scenarios).toHaveLength(3);
    expect(model.scenarios.every(scenario => scenario.status === "unsupported")).toBe(true);
  });

  it("does not permit a snapshot for another canonical state to render", () => {
    const model = presentVerifiedEvidenceCore(response(), { ...canonical(), stateId: "other-state" });
    expect(model.mode).toBe("production");
    expect(model.canonicalStateId).toBeNull();
    expect(model.evidence).toEqual([]);
  });

  it("preserves a disabled evidence interface as an unavailable production model", () => {
    const model = presentVerifiedEvidenceCore({ enabled: false, status: "DISABLED", snapshot: null, reason: "Collection is disabled.", nextCollectionAt: null }, canonical());
    expect(model.mode).toBe("production");
    expect(model.integrity).toBe("unavailable");
    expect(model.integrityReason).toBe("Collection is disabled.");
  });
});
