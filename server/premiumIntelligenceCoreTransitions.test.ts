import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { detectCoreVisualTransition } from "../client/src/components/intelligence-core-visual/transitions";
import type {
  CoreDomain,
  CoreEvidence,
  CoreRelationship,
  DomainId,
  IntelligenceCoreViewModel,
} from "../client/src/components/intelligence-core-visual/types";

const NOW = new Date("2026-06-01T12:00:00.000Z");
const PREVIOUS_OBSERVATION = "2026-06-01T10:00:00.000Z";
const PREVIOUS_EVALUATION = "2026-06-01T10:05:00.000Z";
const CURRENT_OBSERVATION = "2026-06-01T10:10:00.000Z";
const CURRENT_EVALUATION = "2026-06-01T10:15:00.000Z";
const VALID_UNTIL = "2026-06-02T12:00:00.000Z";

const DOMAIN_LABELS: Record<DomainId, string> = {
  liquidity: "Liquidity Stress",
  credit: "Credit Contagion",
  volatility: "Volatility Regime",
  macro: "Macro Sensitivity",
  breadth: "Market Breadth",
  ai: "AI Bubble Risk",
};
const DOMAIN_IDS = Object.keys(DOMAIN_LABELS) as DomainId[];

function evidence(overrides: Partial<CoreEvidence> = {}): CoreEvidence {
  return {
    id: "e-main",
    label: "Recorded observation",
    source: "Canonical provider",
    sourceUrl: null,
    observationAt: PREVIOUS_OBSERVATION,
    status: "current",
    value: "40",
    explanation: "Upstream-admitted observation.",
    admitted: true,
    validUntil: VALID_UNTIL,
    ...overrides,
  };
}

function domain(
  id: DomainId,
  evidenceIds: string[] = ["e-main"],
  status: CoreDomain["status"] = "current",
  observationAt: string | null = PREVIOUS_OBSERVATION
): CoreDomain {
  return {
    id,
    label: DOMAIN_LABELS[id],
    status,
    assessment: status === "current" ? `${id} assessment` : null,
    direction: status === "current" ? "stable" : "unknown",
    observationAt,
    evidenceIds,
    significance: "Recorded upstream evidence.",
    context: null,
    developingSince: null,
    historicalComparison: null,
  };
}

function unavailableDomain(id: DomainId): CoreDomain {
  return {
    ...domain(id, [], "unavailable", null),
    significance: "No admitted observation.",
  };
}

function model(
  overrides: Partial<IntelligenceCoreViewModel> = {}
): IntelligenceCoreViewModel {
  const main = evidence();
  return {
    canonicalStateId: "state:previous",
    observationAt: PREVIOUS_OBSERVATION,
    evaluatedAt: PREVIOUS_EVALUATION,
    integrity: "current",
    integrityReason: "Canonical evidence is current.",
    pressure: { value: 40, status: "current", evidenceIds: [main.id] },
    regime: { label: "Measured regime", evidenceIds: [main.id] },
    overview: null,
    overviewEvidenceIds: [],
    evidence: [main],
    domains: DOMAIN_IDS.map(id => domain(id, [main.id])),
    relationships: [],
    scenarios: [],
    emergingStress: [],
    trackRecord: { records: [], metrics: [] },
    mode: "production",
    animateVerifiedChange: false,
    ...overrides,
  };
}

function successor(
  previous: IntelligenceCoreViewModel,
  overrides: Partial<IntelligenceCoreViewModel> = {}
): IntelligenceCoreViewModel {
  return {
    ...previous,
    canonicalStateId: "state:current",
    observationAt: CURRENT_OBSERVATION,
    evaluatedAt: CURRENT_EVALUATION,
    ...overrides,
  };
}

function replaceDomain(
  value: IntelligenceCoreViewModel,
  replacement: CoreDomain
): CoreDomain[] {
  return value.domains.map(item =>
    item.id === replacement.id ? replacement : item
  );
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
});

afterEach(() => {
  vi.useRealTimers();
});

describe("premium Intelligence Core visual transitions", () => {
  it("returns no transition for an initial render, an unchanged replay, or an out-of-order replay", () => {
    const previous = model();
    expect(detectCoreVisualTransition(null, previous)).toBeNull();
    expect(detectCoreVisualTransition(previous, previous)).toBeNull();

    const replay = successor(previous, {
      canonicalStateId: "state:replayed",
      observationAt: "2026-06-01T09:59:00.000Z",
    });
    expect(detectCoreVisualTransition(previous, replay)).toBeNull();
  });

  it("rejects incomplete and future-dated current claims", () => {
    const previous = model();
    const missingSource = successor(previous, {
      evidence: [evidence({ source: "" })],
      regime: { label: "Different words", evidenceIds: ["e-main"] },
      pressure: { value: 55, status: "current", evidenceIds: ["e-main"] },
    });
    expect(detectCoreVisualTransition(previous, missingSource)).toBeNull();

    const future = successor(previous, {
      evaluatedAt: "2026-06-02T10:15:00.000Z",
      observationAt: "2026-06-02T10:10:00.000Z",
      regime: { label: "Different words", evidenceIds: ["e-main"] },
    });
    expect(detectCoreVisualTransition(previous, future)).toBeNull();
  });

  it("does not call an expired new source a new admission", () => {
    const delayed = evidence({
      id: "e-credit-delayed",
      status: "delayed",
      validUntil: null,
    });
    const previous = model({
      evidence: [evidence(), delayed],
      domains: replaceDomain(
        model(),
        domain("credit", [delayed.id], "delayed")
      ),
    });
    const expiredNew = evidence({
      id: "e-credit-current",
      observationAt: CURRENT_OBSERVATION,
      validUntil: "2026-06-01T11:00:00.000Z",
    });
    const current = successor(previous, {
      evidence: [evidence(), expiredNew],
      domains: replaceDomain(
        previous,
        domain("credit", [expiredNew.id], "current", CURRENT_OBSERVATION)
      ),
    });

    expect(detectCoreVisualTransition(previous, current)).toBeNull();
  });

  it("never mixes production and demonstration snapshots", () => {
    const previous = model();
    const current = successor(previous, {
      mode: "demonstration",
      regime: { label: "Different regime", evidenceIds: ["e-main"] },
    });
    expect(detectCoreVisualTransition(previous, current)).toBeNull();
  });

  it("records genuine current regime and pressure changes with a stable event id", () => {
    const previous = model();
    const recordedClaim = evidence({
      id: "e-recorded-claim",
      observationAt: CURRENT_OBSERVATION,
    });
    const current = successor(previous, {
      evidence: [evidence(), recordedClaim],
      regime: { label: "Recorded new regime", evidenceIds: [recordedClaim.id] },
      pressure: {
        value: 55,
        status: "current",
        evidenceIds: [recordedClaim.id],
      },
    });

    const first = detectCoreVisualTransition(previous, current);
    const repeated = detectCoreVisualTransition(previous, current);
    expect(first).toMatchObject({
      regimeChanged: true,
      pressureChanged: true,
      admittedDomains: [],
      expiredDomains: [],
      relationshipIds: [],
      summary: [
        "Verified regime changed: Measured regime → Recorded new regime",
        "Verified pressure changed: 40 → 55",
      ],
    });
    expect(repeated?.id).toBe(first?.id);
  });

  it("permits a genuine demonstration transition only when both snapshots are demonstrations", () => {
    const previous = model({ mode: "demonstration" });
    const recordedClaim = evidence({
      id: "e-demo-recorded-claim",
      observationAt: CURRENT_OBSERVATION,
    });
    const current = successor(previous, {
      mode: "demonstration",
      evidence: [evidence(), recordedClaim],
      regime: { label: "Recorded new regime", evidenceIds: [recordedClaim.id] },
    });
    expect(detectCoreVisualTransition(previous, current)).toMatchObject({
      regimeChanged: true,
    });
  });

  it("highlights a newly admitted domain only for a current, usable new source", () => {
    const delayed = evidence({
      id: "e-credit-delayed",
      status: "delayed",
      validUntil: null,
    });
    const old = model();
    const previous = {
      ...old,
      evidence: [evidence(), delayed],
      domains: replaceDomain(old, domain("credit", [delayed.id], "delayed")),
    };
    const currentCredit = evidence({
      id: "e-credit-current",
      observationAt: CURRENT_OBSERVATION,
    });
    const current = successor(previous, {
      evidence: [evidence(), currentCredit],
      domains: replaceDomain(
        previous,
        domain("credit", [currentCredit.id], "current", CURRENT_OBSERVATION)
      ),
    });

    expect(detectCoreVisualTransition(previous, current)).toMatchObject({
      admittedDomains: ["credit"],
      summary: ["Credit Contagion: delayed → current"],
    });
  });

  it("records only a verified deadline expiry with the retained evidence identity", () => {
    const expiring = evidence({
      id: "e-expiring",
      validUntil: "2026-06-01T10:06:00.000Z",
    });
    const previous = model({
      evidence: [expiring],
      domains: [
        domain("liquidity", [expiring.id]),
        ...DOMAIN_IDS.filter(id => id !== "liquidity").map(unavailableDomain),
      ],
    });
    const current = {
      ...previous,
      integrity: "stale" as const,
      evidence: [{ ...expiring, status: "stale" as const }],
      domains: replaceDomain(
        previous,
        domain("liquidity", [expiring.id], "stale")
      ),
    };

    expect(detectCoreVisualTransition(previous, current)).toMatchObject({
      expiredDomains: ["liquidity"],
      summary: ["Liquidity Stress observation expired"],
    });
  });

  it("does not animate a source status downgrade that is not a real deadline expiry", () => {
    const previous = model();
    const current = {
      ...previous,
      integrity: "stale" as const,
      evidence: [{ ...evidence(), status: "stale" as const }],
      domains: replaceDomain(
        previous,
        domain("liquidity", ["e-main"], "stale")
      ),
    };
    expect(detectCoreVisualTransition(previous, current)).toBeNull();
  });

  it("rejects unsupported relationships", () => {
    const previous = model();
    const unsupported: CoreRelationship = {
      id: "relation:unsupported",
      from: "liquidity",
      to: "credit",
      kind: "causal",
      explanation: "Not admitted upstream.",
      evidenceIds: ["e-main"],
      supported: false,
    };
    const current = successor(previous, { relationships: [unsupported] });
    expect(detectCoreVisualTransition(previous, current)).toBeNull();
  });

  it("reports an upstream association as an association and never infers causality", () => {
    const previous = model();
    const association: CoreRelationship = {
      id: "relation:association",
      from: "liquidity",
      to: "credit",
      kind: "association",
      explanation: "The upstream record supports an association only.",
      evidenceIds: ["e-main"],
      supported: true,
    };
    const current = successor(previous, { relationships: [association] });

    expect(association.kind).toBe("association");
    expect(detectCoreVisualTransition(previous, current)).toMatchObject({
      relationshipIds: [association.id],
      summary: ["1 newly supported association"],
    });
  });
});

it("does not invent a retained-source expiry by changing its deadline, source or observation", () => {
  const expiring = evidence({ validUntil: "2026-06-01T10:06:00.000Z" });
  const previous = model({
    evidence: [expiring],
    domains: [
      domain("liquidity"),
      ...DOMAIN_IDS.filter(id => id !== "liquidity").map(unavailableDomain),
    ],
  });
  for (const changed of [
    { ...expiring, validUntil: "2026-06-01T10:07:00.000Z" },
    { ...expiring, source: "Different source" },
    { ...expiring, observationAt: CURRENT_OBSERVATION },
  ]) {
    const current = successor(previous, {
      integrity: "stale",
      evidence: [{ ...changed, status: "stale" }],
      domains: replaceDomain(
        previous,
        domain("liquidity", ["e-main"], "stale")
      ),
    });
    expect(detectCoreVisualTransition(previous, current)).toBeNull();
  }
});
