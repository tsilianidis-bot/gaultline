import { describe, expect, it } from "vitest";
import { createEvidencePacket, validateEvidenceClaim, withholdUnsupportedForecast, type EvidenceClaim } from "../shared/evidenceContract";

const canonical = { stateId: "state:adversarial", effectiveAt: "2026-08-22T15:00:00.000Z" };
const base: Omit<EvidenceClaim, "claimId" | "evidenceClass" | "statement"> = { canonical, qualityStatus: "HEALTHY", evidenceStrength: "PRELIMINARY", limitations: [], createdAt: canonical.effectiveAt, effectiveAt: canonical.effectiveAt, forecastAuthorized: false };

describe("Phase 3 adversarial evidence-integrity cases", () => {
  it("CASE 1: leading value 44, composite 18, and historical 4–8 week lead cannot become a current target or horizon", () => {
    const claim = withholdUnsupportedForecast({ ...base, claimId: "withheld:macro-44", value: 44, unit: "score", limitations: ["Historical lead window only: 4–8 weeks."] });
    expect(claim.statement).not.toMatch(/reach 44|4–8 weeks/i);
    expect(validateEvidenceClaim({ ...claim, horizon: "4–8 weeks" }).status).toBe("INVALID");
  });

  it("CASE 2 and CASE 3: analog 93% and historical frequency 62% cannot be represented as current probability", () => {
    const historical: EvidenceClaim = { ...base, canonical: null, claimId: "historical:62", evidenceClass: "HISTORICAL", statement: "Historical continuation frequency was 62%.", datasetId: "history", methodologyId: "frequency", methodologyVersion: "v1", historicalPeriod: "2000-2025", eventDefinition: "continuation", sampleSize: 100 };
    const analog: EvidenceClaim = { ...base, canonical: null, claimId: "historical:93", evidenceClass: "HISTORICAL", statement: "Analog similarity was 93%.", datasetId: "history", methodologyId: "similarity", methodologyVersion: "v1", historicalPeriod: "2000-2025", eventDefinition: "similarity", analogSimilarity: 93 };
    expect(validateEvidenceClaim({ ...historical, probabilityValue: 62, probabilityType: "MODEL_PROBABILITY" }).status).toBe("INVALID");
    expect(validateEvidenceClaim({ ...analog, probabilityValue: 93, probabilityType: "MODEL_PROBABILITY" }).status).toBe("INVALID");
  });

  it("CASE 4 and CASE 7: one engine or AI suggestion cannot create system confirmation", () => {
    const claim: EvidenceClaim = { ...base, claimId: "interpreted:one-engine", evidenceClass: "INTERPRETED", statement: "System-wide deterioration confirmed.", derivedFromClaimIds: ["observed:one-engine"], confirmationProvenance: "ANALYST_INTERPRETATION" };
    expect(validateEvidenceClaim(claim).status).toBe("INVALID");
  });

  it("CASE 5 and CASE 9: poor data quality and high-quality observation do not fabricate healthy evidence or very strong thesis support", () => {
    const unavailable: EvidenceClaim = { ...base, claimId: "observed:stale", evidenceClass: "OBSERVED", statement: "Inputs are unavailable.", sourceIds: ["input:a"], sourceType: "MACRO_DATA", sourceTimestamp: canonical.effectiveAt, qualityStatus: "STALE" };
    const highQualityWeakThesis = { ...unavailable, claimId: "observed:direct", qualityStatus: "HEALTHY", evidenceStrength: "PRELIMINARY" as const, modelConfidence: "high" };
    expect(validateEvidenceClaim(unavailable).status).toBe("DEGRADED");
    expect(highQualityWeakThesis.evidenceStrength).toBe("PRELIMINARY");
  });

  it("CASE 6: no forecast model yields explicit withholding rather than target or horizon", () => {
    const claim = withholdUnsupportedForecast({ ...base, claimId: "withheld:no-model", limitations: [] });
    expect(claim).toMatchObject({ forecastAuthorized: false, forecastContract: null, probabilityType: "NONE" });
  });

  it("CASE 8: State A evidence cannot be packaged as State B interpretation", () => {
    const observed: EvidenceClaim = { ...base, claimId: "observed:a", evidenceClass: "OBSERVED", statement: "State A input.", sourceIds: ["source:a"], sourceType: "MARKET_DATA", sourceTimestamp: canonical.effectiveAt };
    const mixed = { ...observed, claimId: "interpreted:b", canonical: { ...canonical, stateId: "state:b" }, evidenceClass: "INTERPRETED" as const, statement: "State B interpretation.", derivedFromClaimIds: [observed.claimId] };
    expect(() => createEvidencePacket(canonical, [observed, mixed])).toThrow(/State-mixed evidence packet rejected/);
  });

  it("CASE 10: correlated observations do not automatically establish independent confirmation", () => {
    const claim: EvidenceClaim = { ...base, claimId: "interpreted:correlated", evidenceClass: "INTERPRETED", statement: "Two correlated observations are present; independent confirmation is not established.", derivedFromClaimIds: ["observed:source-a-1", "observed:source-a-2"] };
    expect(validateEvidenceClaim(claim).status).toBe("VALID");
    expect(claim.statement).toContain("not established");
  });
});
