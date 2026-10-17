import { describe, expect, it } from "vitest";
import type { IntelligenceEvidenceSnapshot } from "../../shared/intelligenceEvidence";
import { deriveMaterialIntelligenceAssessment } from "./decisionLedger";

function snapshot(overrides: Partial<IntelligenceEvidenceSnapshot> = {}): IntelligenceEvidenceSnapshot {
  return {
    kind: "intelligence-evidence-snapshot",
    methodVersion: "intelligence-evidence-v1-2026-10-16",
    capturedAt: "2026-10-16T15:00:00.000Z",
    canonicalStateId: "canonical-state-1",
    canonicalState: {
      stateId: "canonical-state-1",
      generatedAt: "2026-10-16T14:59:00.000Z",
      effectiveAt: "2026-10-16T14:59:00.000Z",
      modelVersion: "champion-v1",
      regime: "Moderate Risk",
      pressureIndex: 44.6,
      pressureDirection: "Stable",
    },
    persistence: "recorded",
    limitations: [],
    providerHealth: [
      { id: "canonical", label: "Canonical", provider: "FAULTLINE", status: "healthy", observedAt: "2026-10-16T14:59:00.000Z", checkedAt: "2026-10-16T15:00:00.000Z", detail: "verified" },
      { id: "yahoo", label: "Quotes", provider: "Yahoo", status: "healthy", observedAt: "2026-10-16T14:58:00.000Z", checkedAt: "2026-10-16T15:00:00.000Z", detail: "verified" },
      { id: "fred", label: "FRED", provider: "FRED", status: "healthy", observedAt: "2026-10-16T00:00:00.000Z", checkedAt: "2026-10-16T15:00:00.000Z", detail: "released" },
      { id: "coingecko", label: "Crypto", provider: "CoinGecko", status: "healthy", observedAt: "2026-10-16T14:57:00.000Z", checkedAt: "2026-10-16T15:00:00.000Z", detail: "verified" },
    ],
    observations: [{
      id: "quote:SPY", label: "S&P 500 proxy", kind: "market_quote", provider: "Yahoo Finance", origin: "observed",
      value: 700, unit: "points", observedAt: "2026-10-16T14:58:00.000Z", receivedAt: "2026-10-16T14:59:00.000Z", maxAgeMs: 1_200_000,
      validationStatus: "verified", supportsCurrentClaim: true, validationReason: "verified", modelVersion: null,
      sourceIdentifier: "yahoo:SPY", temporalStatus: "delayed", temporalDetail: "provider-delayed", historicalValue: null, lastVerified: null,
    }],
    domains: [
      { id: "equities", label: "Equities", status: "healthy", observationIds: ["quote:SPY"], currentObservationIds: ["quote:SPY"], historicalObservationIds: [], limitation: null },
      { id: "bonds_rates", label: "Bonds / Rates", status: "healthy", observationIds: [], currentObservationIds: [], historicalObservationIds: [], limitation: null },
      { id: "credit", label: "Credit", status: "healthy", observationIds: [], currentObservationIds: [], historicalObservationIds: [], limitation: null },
      { id: "liquidity", label: "Liquidity", status: "healthy", observationIds: [], currentObservationIds: [], historicalObservationIds: [], limitation: null },
      { id: "volatility", label: "Volatility", status: "healthy", observationIds: [], currentObservationIds: [], historicalObservationIds: [], limitation: null },
      { id: "crypto", label: "Crypto", status: "healthy", observationIds: [], currentObservationIds: [], historicalObservationIds: [], limitation: null },
    ],
    ...overrides,
  };
}

describe("Intelligence Core append-only assessment ledger", () => {
  it("records an initial verified assessment with immutable evidence boundaries", () => {
    const assessment = deriveMaterialIntelligenceAssessment(snapshot(), null);
    expect(assessment).toMatchObject({
      reason: "initial_verified_snapshot",
      event: {
        eventType: "intelligence_core_assessment",
        sourceEngine: "intelligence_evidence_core",
        entityType: "market",
        direction: "neutral",
        pressureIndex: 44.6,
        marketRegime: "Moderate Risk",
        sourceObservedAt: new Date("2026-10-16T14:58:00.000Z"),
      },
    });
    expect(assessment?.event.newState).toMatchObject({
      assessmentVersion: "intelligence-core-assessment-v1-2026-10-16",
      scenario: "No scenario is asserted by the verified evidence record.",
    });
  });

  it("does not create decorative activity when neither canonical state nor source support changed", () => {
    const first = snapshot();
    const repeat = snapshot({ capturedAt: "2026-10-16T15:05:00.000Z" });
    expect(deriveMaterialIntelligenceAssessment(repeat, first)).toBeNull();
  });

  it("records an evidence-backed material source-support change without inventing a market direction", () => {
    const first = snapshot();
    const domains = first.domains.map(domain => domain.id === "crypto" ? {
      ...domain,
      status: "unavailable" as const,
      currentObservationIds: [],
      limitation: "No validated source observation is mapped to this domain.",
    } : domain);
    const next = snapshot({ capturedAt: "2026-10-16T15:05:00.000Z", domains });
    const assessment = deriveMaterialIntelligenceAssessment(next, first);
    expect(assessment).toMatchObject({ reason: "domain_support_changed", event: { severity: "low", direction: "neutral" } });
    expect(assessment?.event.supportingState).toMatchObject({ methodVersion: "intelligence-evidence-v1-2026-10-16" });
  });
});
