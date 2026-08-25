import { describe, expect, it } from "vitest";
import { createEvidencePacket, validateEvidenceClaim, withholdUnsupportedForecast, type EvidenceClaim } from "../shared/evidenceContract";

const canonical = { stateId: "state:phase3-test", effectiveAt: "2026-08-22T15:00:00.000Z", inputSnapshotId: "input:test", modelVersion: "model:test", configurationVersion: "config:test" };
const base: Omit<EvidenceClaim, "claimId" | "evidenceClass" | "statement"> = {
  canonical, qualityStatus: "HEALTHY", evidenceStrength: "MODERATE", limitations: [], createdAt: "2026-08-22T15:00:00.000Z", effectiveAt: canonical.effectiveAt, forecastAuthorized: false,
};

describe("Phase 3 evidence contract", () => {
  it("A: OBSERVED claims require direct source provenance", () => {
    const claim: EvidenceClaim = { ...base, claimId: "observed:yield", evidenceClass: "OBSERVED", statement: "10-year Treasury yield is 4.2%.", sourceIds: ["FRED:DGS10"], sourceType: "MACRO_DATA", sourceTimestamp: canonical.effectiveAt };
    expect(validateEvidenceClaim(claim)).toMatchObject({ status: "VALID" });
    expect(validateEvidenceClaim({ ...claim, sourceIds: [] }).status).toBe("INVALID");
  });

  it("B and E: DERIVED and INTERPRETED claims retain dependencies and method identity", () => {
    const derived: EvidenceClaim = { ...base, claimId: "derived:spread", evidenceClass: "DERIVED", statement: "Credit-equity divergence is 12 points.", derivedFromClaimIds: ["observed:credit", "observed:equity"], methodologyId: "divergence", methodologyVersion: "v1" };
    const interpreted: EvidenceClaim = { ...base, claimId: "interpreted:divergence", evidenceClass: "INTERPRETED", statement: "Credit conditions are diverging from equities.", derivedFromClaimIds: [derived.claimId] };
    expect(validateEvidenceClaim(derived).status).toBe("VALID");
    expect(validateEvidenceClaim(interpreted).status).toBe("VALID");
    expect(validateEvidenceClaim({ ...interpreted, derivedFromClaimIds: [] }).status).toBe("INVALID");
  });

  it("C and D: historical frequency and analog similarity cannot become model probability", () => {
    const historical: EvidenceClaim = { ...base, canonical: null, claimId: "historical:frequency", evidenceClass: "HISTORICAL", statement: "Historical continuation frequency was 62%.", datasetId: "research:sample", methodologyId: "frequency", methodologyVersion: "v1", historicalPeriod: "2000-2025", eventDefinition: "defined continuation", sampleSize: 100 };
    const analog: EvidenceClaim = { ...base, claimId: "historical:analog", evidenceClass: "HISTORICAL", statement: "Analog similarity is 93%.", datasetId: "research:analog", methodologyId: "similarity", methodologyVersion: "v1", historicalPeriod: "2000-2025", eventDefinition: "feature similarity", analogModelId: "analog-v1", analogSimilarity: 93 };
    expect(validateEvidenceClaim(historical).status).toBe("VALID");
    expect(validateEvidenceClaim(analog).status).toBe("VALID");
    expect(validateEvidenceClaim({ ...historical, probabilityType: "MODEL_PROBABILITY", probabilityValue: 62 }).status).toBe("INVALID");
    expect(validateEvidenceClaim({ ...analog, probabilityType: "MODEL_PROBABILITY", probabilityValue: 93 }).status).toBe("INVALID");
  });

  it("F through J: unauthorized forecasts, targets, horizons, leading indicators, and historical lead windows are withheld", () => {
    const withheld = withholdUnsupportedForecast({ ...base, claimId: "withheld:macro", value: 44, unit: "score", limitations: ["Leading indicator only."] });
    expect(withheld).toMatchObject({ evidenceClass: "INTERPRETED", forecastAuthorized: false, probabilityType: "NONE" });
    expect(withheld.statement).toContain("No governed forecast available");
    expect(validateEvidenceClaim({ ...withheld, horizon: "4–8 weeks" }).status).toBe("INVALID");
  });

  it("K and L: current claims preserve canonical state identity and packets reject state mixing", () => {
    const observed: EvidenceClaim = { ...base, claimId: "observed:state-a", evidenceClass: "OBSERVED", statement: "Pressure Index is 18.", sourceIds: ["state:phase3-test"], sourceType: "MANIFEST", sourceTimestamp: canonical.effectiveAt };
    expect(createEvidencePacket(canonical, [observed]).canonicalState?.stateId).toBe(canonical.stateId);
    const foreign = { ...observed, claimId: "observed:state-b", canonical: { ...canonical, stateId: "state:other" } };
    expect(() => createEvidencePacket(canonical, [foreign])).toThrow(/State-mixed evidence packet rejected/);
  });

  it("M through T: unavailable evidence degrades, strength is distinct from quality/confidence, and unsupported system claims remain invalid", () => {
    const degraded: EvidenceClaim = { ...base, claimId: "observed:stale", evidenceClass: "OBSERVED", statement: "Spread is unavailable.", sourceIds: ["FRED:spread"], sourceType: "MACRO_DATA", sourceTimestamp: canonical.effectiveAt, qualityStatus: "UNAVAILABLE", evidenceStrength: "PRELIMINARY", modelConfidence: "high" };
    expect(validateEvidenceClaim(degraded).status).toBe("DEGRADED");
    expect(degraded.evidenceStrength).not.toBe(degraded.modelConfidence);
    const unsupportedConfirmation: EvidenceClaim = { ...base, claimId: "interpreted:system", evidenceClass: "INTERPRETED", statement: "System-wide deterioration confirmed.", derivedFromClaimIds: ["observed:one-engine"], confirmationProvenance: "ANALYST_INTERPRETATION" };
    expect(validateEvidenceClaim(unsupportedConfirmation).status).toBe("INVALID");
  });
});
