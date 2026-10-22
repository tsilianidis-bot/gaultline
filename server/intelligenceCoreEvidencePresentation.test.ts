import { describe, expect, it } from "vitest";
import type { IntelligenceEvidenceResponse, IntelligenceEvidenceSnapshot } from "@shared/intelligenceEvidence";
import { pressureVectorLabel } from "@shared/pressureVectorLabels";
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

function snapshotOf(value: IntelligenceEvidenceResponse): IntelligenceEvidenceSnapshot {
  if (!value.snapshot) throw new Error("Expected test response to include a snapshot.");
  return value.snapshot;
}

function canonicalEngine(
  source: IntelligenceEvidenceSnapshot["observations"][number],
  engineId: string,
) {
  return {
    ...source,
    id: `canonical:${engineId}`,
    label: engineId,
    kind: "canonical_model" as const,
    provider: "FAULTLINE canonical MarketState",
    origin: "modeled" as const,
    value: 40,
    unit: "score_0_to_100",
    validationStatus: "delayed" as const,
    modelVersion: "champion-v1",
    sourceIdentifier: `canonical:canonical-1:${engineId}`,
    temporalStatus: "modeled" as const,
    temporalDetail: "Versioned canonical model output.",
  };
}

describe("verified evidence Core presentation", () => {
  it.each([Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY])("withholds non-finite evidence %s even when marked verified", (invalidValue) => {
    const value = response();
    const snapshot = snapshotOf(value);
    snapshot.observations[0]!.value = invalidValue;
    const previous = structuredClone(snapshot);
    previous.observations[0]!.observedAt = new Date(Date.now() - 180_000).toISOString();
    const model = presentVerifiedEvidenceCore(value, canonical(), previous);
    expect(model.integrity).toBe("unavailable");
    expect(model.evidence.some(item => item.id === "quote:VIX" && item.admitted)).toBe(false);
    expect(JSON.stringify(model)).not.toMatch(/NaN|Infinity/);
    expect(model.domains.every(domain => domain.previousObservation == null)).toBe(true);
  });

  it("withholds the full assessment while retaining only server-admitted direct evidence", () => {
    const model = presentVerifiedEvidenceCore(response(), canonical());
    expect(model.mode).toBe("production");
    expect(model.integrity).toBe("degraded");
    expect(model.pressure).toEqual({ value: null, status: "unavailable", evidenceIds: [] });
    expect(model.regime).toEqual({ label: null, evidenceIds: [] });
    expect(model.evidence).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: "quote:VIX", status: "current", validUntil: expect.any(String) }),
    ]));
    const yieldCurve = model.domains.find(domain => domain.id === "volatility");
    expect(yieldCurve?.label).toBe(pressureVectorLabel("volatility-regime"));
    expect(yieldCurve?.label).not.toBe("Volatility Regime");
    expect(yieldCurve?.status).toBe("unavailable");
    expect(yieldCurve?.evidenceIds ?? []).not.toContain("quote:VIX");
    expect(model.domains.find(domain => domain.id === "breadth")?.label).toBe(pressureVectorLabel("market-breadth"));
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

  it("keeps FRED releases recent, links their public series, and maps all six exact canonical engines", () => {
    const value = response();
    const snapshot = snapshotOf(value);
    const quote = snapshot.observations[0]!;
    snapshot.observations.push(
      {
        ...quote,
        id: "fred:DGS10",
        label: "10-year Treasury yield",
        kind: "macro_release",
        provider: "Federal Reserve Economic Data (FRED)",
        value: 4.12,
        unit: "percent",
        sourceIdentifier: "fred:DGS10",
        temporalStatus: "released",
        temporalDetail: "Released macro observation.",
      },
      {
        ...quote,
        id: "fred:DGS2",
        label: "2-year Treasury yield",
        kind: "macro_release",
        provider: "Federal Reserve Economic Data (FRED)",
        value: 3.77,
        unit: "percent",
        sourceIdentifier: "fred:DGS2",
        temporalStatus: "released",
        temporalDetail: "Released macro observation.",
      },
      ...[
        "liquidity-stress",
        "credit-contagion",
        "volatility-regime",
        "macro-sensitivity",
        "market-breadth",
        "ai-bubble",
      ].map(engineId => canonicalEngine(quote, engineId)),
    );
    snapshot.domains = snapshot.domains.map(domain => {
      if (domain.id === "bonds_rates") {
        return { ...domain, observationIds: ["fred:DGS10", "fred:DGS2"], currentObservationIds: ["fred:DGS10", "fred:DGS2"] };
      }
      if (domain.id === "volatility") {
        return { ...domain, observationIds: ["quote:VIX", "canonical:volatility-regime"], currentObservationIds: ["quote:VIX"] };
      }
      return domain;
    });

    const model = presentVerifiedEvidenceCore(value, canonical());
    expect(model.evidence).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: "quote:VIX", status: "current" }),
      expect.objectContaining({
        id: "fred:DGS10",
        status: "recent",
        sourceUrl: "https://fred.stlouisfed.org/series/DGS10",
      }),
      expect.objectContaining({
        id: "fred:DGS2",
        status: "recent",
        sourceUrl: "https://fred.stlouisfed.org/series/DGS2",
      }),
      ...[
        "liquidity-stress",
        "credit-contagion",
        "volatility-regime",
        "macro-sensitivity",
        "market-breadth",
        "ai-bubble",
      ].map(engineId => expect.objectContaining({ id: `canonical:${engineId}`, status: "static" })),
    ]));
    expect(model.domains.find(domain => domain.id === "volatility")).toMatchObject({
      label: pressureVectorLabel("volatility-regime"),
      status: "recent",
      evidenceIds: ["fred:DGS10", "fred:DGS2", "canonical:volatility-regime"],
    });
    expect(model.domains.find(domain => domain.id === "macro")).toMatchObject({
      label: pressureVectorLabel("macro-sensitivity"),
      status: "static",
      evidenceIds: ["canonical:macro-sensitivity"],
    });
    expect(model.domains.find(domain => domain.id === "breadth")).toMatchObject({
      label: pressureVectorLabel("market-breadth"),
      status: "static",
      evidenceIds: ["canonical:market-breadth"],
    });
    for (const domain of model.domains) {
      expect(domain.evidenceIds).not.toContain("quote:VIX");
      expect(domain.evidenceIds).not.toEqual(expect.arrayContaining(["fred:CPIAUCSL"]));
      expect(domain.assessment).toBeNull();
      expect(domain.direction).toBe("unknown");
      expect(domain.context).toBeNull();
      expect(domain.developingSince).toBeNull();
      expect(domain.historicalComparison).toBeNull();
      expect(domain.confidence ?? null).toBeNull();
      expect(domain.confirmationConditions ?? []).toEqual([]);
      expect(domain.invalidationConditions ?? []).toEqual([]);
      expect(domain.pressureContribution ?? null).toBeNull();
    }
    expect(model.domains.find(domain => domain.id === "macro")?.evidenceIds).not.toContain("fred:DGS10");
    expect(model.domains.find(domain => domain.id === "breadth")?.evidenceIds).not.toContain("fred:DGS10");
    for (const id of ["liquidity", "credit", "ai"] as const) {
      expect(model.domains.find(domain => domain.id === id)).toMatchObject({
        status: "static",
        confidence: null,
        confirmationConditions: [],
        invalidationConditions: [],
        pressureContribution: null,
      });
    }
  });

  it("marks an expired source deadline stale even when the source was recent or static", () => {
    const value = response();
    const snapshot = snapshotOf(value);
    const quote = snapshot.observations[0]!;
    const expired = new Date(Date.now() - 1_000).toISOString();
    snapshot.observations.push(
      {
        ...quote,
        id: "fred:DGS10",
        kind: "macro_release",
        provider: "Federal Reserve Economic Data (FRED)",
        value: 4.12,
        unit: "percent",
        sourceIdentifier: "fred:DGS10",
        temporalStatus: "released",
        validUntil: expired,
      },
      { ...canonicalEngine(quote, "liquidity-stress"), validUntil: expired },
    );
    snapshot.domains = snapshot.domains.map(domain => domain.id === "bonds_rates"
      ? { ...domain, observationIds: ["fred:DGS10"], currentObservationIds: [] }
      : domain,
    );

    const model = presentVerifiedEvidenceCore(value, canonical());
    expect(model.evidence.find(item => item.id === "fred:DGS10")?.status).toBe("stale");
    expect(model.evidence.find(item => item.id === "canonical:liquidity-stress")?.status).toBe("stale");
    expect(model.domains.find(domain => domain.id === "volatility")).toMatchObject({
      status: "stale",
      evidenceIds: ["fred:DGS10"],
    });
    expect(model.domains.find(domain => domain.id === "macro")?.evidenceIds ?? []).not.toContain("fred:DGS10");
    expect(model.domains.find(domain => domain.id === "macro")?.status).toBe("unavailable");
    expect(model.domains.find(domain => domain.id === "liquidity")?.status).toBe("stale");
  });

  it("fails closed rather than calling an unknown quote timing live", () => {
    const value = response();
    const snapshot = snapshotOf(value);
    snapshot.observations[0] = {
      ...snapshot.observations[0]!,
      temporalStatus: "released" as never,
    };

    const model = presentVerifiedEvidenceCore(value, canonical());
    expect(model.evidence.find(item => item.id === "quote:VIX")).toBeUndefined();
    expect(model.domains.find(domain => domain.id === "volatility")?.status).toBe("unavailable");
  });

  it("exposes an exact, strictly later prior source observation without calculating a domain change", () => {
    const value = response();
    const snapshot = snapshotOf(value);
    snapshot.observations.push({
      ...snapshot.observations[0]!,
      id: "fred:DGS10",
      label: "10-year Treasury yield",
      kind: "macro_release",
      provider: "Federal Reserve Economic Data (FRED)",
      value: 4.12,
      unit: "percent",
      sourceIdentifier: "fred:DGS10",
      temporalStatus: "released",
      temporalDetail: "Released macro observation.",
    });
    const previous = structuredClone(snapshot);
    previous.observations[0] = {
      ...previous.observations[0]!,
      value: 17.5,
      observedAt: new Date(Date.now() - 120_000).toISOString(),
    };
    const priorYield = previous.observations.find(item => item.id === "fred:DGS10")!;
    priorYield.value = 4.05;
    priorYield.observedAt = new Date(Date.now() - 2 * 24 * 60 * 60_000).toISOString();

    const model = presentVerifiedEvidenceCore(value, canonical(), previous);
    const yieldCurve = model.domains.find(domain => domain.id === "volatility");
    expect(yieldCurve?.evidenceIds).toEqual(["fred:DGS10"]);
    expect(yieldCurve?.evidenceIds).not.toContain("quote:VIX");
    expect(yieldCurve?.previousObservation).toBe(
      `fred:DGS10 (fred:DGS10): 4.05 percent at ${priorYield.observedAt} → 4.12 percent at ${snapshot.observations.find(item => item.id === "fred:DGS10")!.observedAt}`,
    );
    expect(yieldCurve?.previousObservation).not.toContain("quote:VIX");
  });

  it("rejects an older response rather than regressing from a newer same-state snapshot", () => {
    const value = response();
    const snapshot = snapshotOf(value);
    const previous = structuredClone(snapshot);
    previous.capturedAt = new Date(Date.parse(snapshot.capturedAt) + 60_000).toISOString();

    const model = presentVerifiedEvidenceCore(value, canonical(), previous);
    expect(model.canonicalStateId).toBeNull();
    expect(model.integrity).toBe("unavailable");
    expect(model.evidence).toEqual([]);
  });

  it.each([
    {
      name: "a refreshed snapshot that only revises a same-timestamp value",
      priorObservedAt: (snapshot: IntelligenceEvidenceSnapshot) => snapshot.observations[0]!.observedAt,
    },
    {
      name: "an out-of-order prior source observation",
      priorObservedAt: () => new Date(Date.now() - 30_000).toISOString(),
    },
    {
      name: "a future-dated prior source observation",
      priorObservedAt: () => new Date(Date.now() + 30_000).toISOString(),
    },
  ])("does not present a prior value for $name", ({ priorObservedAt }) => {
    const value = response();
    const snapshot = snapshotOf(value);
    snapshot.observations.push({
      ...snapshot.observations[0]!,
      id: "fred:DGS10",
      label: "10-year Treasury yield",
      kind: "macro_release",
      provider: "Federal Reserve Economic Data (FRED)",
      value: 4.12,
      unit: "percent",
      sourceIdentifier: "fred:DGS10",
      temporalStatus: "released",
      temporalDetail: "Released macro observation.",
    });
    const previous = structuredClone(snapshot);
    const priorYield = previous.observations.find(item => item.id === "fred:DGS10")!;
    priorYield.value = 4.05;
    priorYield.observedAt = priorObservedAt(snapshot);

    const model = presentVerifiedEvidenceCore(value, canonical(), previous);
    expect(model.domains.find(domain => domain.id === "volatility")?.previousObservation).toBeNull();
  });
});
