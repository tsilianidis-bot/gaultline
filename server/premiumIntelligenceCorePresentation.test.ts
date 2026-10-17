import { describe, expect, it } from "vitest";
import {
  adaptIntelligenceCore,
  createUnavailableCore,
  DOMAIN_LABELS,
} from "../client/src/components/intelligence-core-visual/adapter";
import type {
  CoreEvidence,
  IntelligenceCoreInput,
} from "../client/src/components/intelligence-core-visual/types";

const EVALUATED_AT = "2026-01-20T12:00:00.000Z";
const OBSERVED_AT = "2026-01-20T11:55:00.000Z";
const VALID_UNTIL = "2099-01-20T12:00:00.000Z";

function evidence(overrides: Partial<CoreEvidence> = {}): CoreEvidence {
  return {
    id: "e-current",
    label: "Verified current observation",
    source: "Upstream canonical evidence",
    sourceUrl: null,
    observationAt: OBSERVED_AT,
    status: "current",
    value: "50",
    explanation: "Admitted by the upstream canonical pipeline.",
    admitted: true,
    validUntil: VALID_UNTIL,
    ...overrides,
  };
}

function input(
  overrides: Partial<IntelligenceCoreInput> = {}
): IntelligenceCoreInput {
  const currentEvidence = evidence();
  return {
    canonicalStateId: "state:current",
    observationAt: OBSERVED_AT,
    evaluatedAt: EVALUATED_AT,
    integrity: "current",
    integrityReason: "Upstream integrity is current.",
    pressure: {
      value: 50,
      status: "current",
      evidenceIds: [currentEvidence.id],
    },
    regime: { label: "Measured regime", evidenceIds: [currentEvidence.id] },
    overview: "Evidence-backed overview.",
    overviewEvidenceIds: [currentEvidence.id],
    evidence: [currentEvidence],
    domains: [
      "liquidity",
      "credit",
      "volatility",
      "macro",
      "breadth",
      "ai",
    ].map(id => ({
      id: id as IntelligenceCoreInput["domains"][number]["id"],
      label: `Untrusted ${id} label`,
      status: "current" as const,
      assessment: `${id} assessment`,
      direction: "rising" as const,
      observationAt: OBSERVED_AT,
      evidenceIds: [currentEvidence.id],
      significance: `${id} significance`,
      context: `${id} context`,
      developingSince: "2026-01-19T00:00:00.000Z",
      historicalComparison: `${id} historical comparison`,
    })),
    relationships: [
      {
        id: "relationship:valid",
        from: "liquidity",
        to: "credit",
        kind: "association",
        explanation: "Admitted evidence supports this association.",
        evidenceIds: [currentEvidence.id],
        supported: true,
      },
    ],
    scenarios: [
      {
        id: "A",
        title: "A",
        status: "favored",
        summary: "A evidence-backed summary",
        conditions: ["A condition"],
        invalidations: [],
        evidenceIds: [currentEvidence.id],
        domainIds: ["liquidity"],
      },
      {
        id: "B",
        title: "B",
        status: "conditional",
        summary: "B evidence-backed summary",
        conditions: ["B condition"],
        invalidations: [],
        evidenceIds: [currentEvidence.id],
        domainIds: ["credit"],
      },
      {
        id: "C",
        title: "C",
        status: "favored",
        summary: "C evidence-backed stress case",
        conditions: ["C condition"],
        invalidations: [],
        evidenceIds: [currentEvidence.id],
        domainIds: ["volatility"],
      },
    ],
    emergingStress: [
      {
        id: "stress:valid",
        statement: "Evidence-backed emerging stress.",
        evidenceIds: [currentEvidence.id],
        domainIds: ["credit"],
      },
    ],
    trackRecord: {
      records: [
        {
          id: "record:forward",
          assessmentAt: "2026-01-10T00:00:00.000Z",
          classification: "forward_recorded",
          outcome: "supported",
          summary: "Forward record.",
          evidenceIds: [currentEvidence.id],
          example: false,
        },
        {
          id: "record:reconstructed",
          assessmentAt: "2026-01-11T00:00:00.000Z",
          classification: "reconstructed",
          outcome: "unresolved",
          summary: "Reconstructed research record.",
          evidenceIds: [currentEvidence.id],
          example: false,
        },
      ],
      metrics: [
        {
          id: "metric:forward",
          label: "Forward metric",
          displayValue: "2 / 3",
          eligibleSample: 3,
          minimumSample: 3,
          admitted: true,
          cohort: "forward_recorded",
          evidenceIds: [currentEvidence.id],
        },
        {
          id: "metric:reconstructed",
          label: "Reconstructed metric",
          displayValue: "5 / 8",
          eligibleSample: 8,
          minimumSample: 5,
          admitted: true,
          cohort: "reconstructed",
          evidenceIds: [currentEvidence.id],
        },
      ],
    },
    ...overrides,
  };
}

describe("premium intelligence-core presentation adapter", () => {
  it("creates a deterministic unavailable model with all topology and scenario slots", () => {
    const model = createUnavailableCore("No admitted canonical payload.");
    expect(model.mode).toBe("production");
    expect(model.pressure).toEqual({
      value: null,
      status: "unavailable",
      evidenceIds: [],
    });
    expect(model.domains).toHaveLength(6);
    expect(model.domains.map(domain => domain.label)).toEqual(
      Object.values(DOMAIN_LABELS)
    );
    expect(model.scenarios.map(scenario => scenario.id)).toEqual([
      "A",
      "B",
      "C",
    ]);
    expect(
      model.scenarios.every(scenario => scenario.status === "unsupported")
    ).toBe(true);
  });

  it("preserves valid inclusive pressure boundaries but withholds nonfinite and out-of-range values", () => {
    for (const value of [0, 100]) {
      const model = adaptIntelligenceCore(
        input({
          pressure: { value, status: "current", evidenceIds: ["e-current"] },
        })
      );
      expect(model.pressure).toMatchObject({ value, status: "current" });
    }
    for (const value of [Number.NaN, Number.POSITIVE_INFINITY, -1, 100.01]) {
      const model = adaptIntelligenceCore(
        input({
          pressure: { value, status: "current", evidenceIds: ["e-current"] },
        })
      );
      expect(model.pressure).toEqual({
        value: null,
        status: "unavailable",
        evidenceIds: [],
      });
    }
  });

  it("fails closed for missing canonical identity, malformed canonical time, and future observations", () => {
    expect(
      adaptIntelligenceCore(input({ canonicalStateId: null })).integrity
    ).toBe("unavailable");
    expect(
      adaptIntelligenceCore(input({ observationAt: "not-a-timestamp" }))
        .canonicalStateId
    ).toBeNull();
    expect(
      adaptIntelligenceCore(
        input({ observationAt: "2099-01-20T11:55:00.000Z" })
      ).pressure.value
    ).toBeNull();
  });

  it("requires current admitted, observed, non-expired evidence for current pressure and regime", () => {
    const missingDeadline = input({
      evidence: [evidence({ validUntil: null })],
    });
    const model = adaptIntelligenceCore(missingDeadline);
    expect(model.evidence).toEqual([]);
    expect(model.pressure.status).toBe("unavailable");
    expect(model.regime).toEqual({ label: null, evidenceIds: [] });
    expect(model.domains.every(domain => domain.status === "unavailable")).toBe(
      true
    );

    const unadmitted = input({ evidence: [evidence({ admitted: false })] });
    expect(adaptIntelligenceCore(unadmitted).pressure.value).toBeNull();
  });

  it("reclassifies old-clock-expired current evidence as stale historical evidence rather than verifying it indefinitely", () => {
    const expiredNow = evidence({ validUntil: "2026-02-01T12:00:00.000Z" });
    const model = adaptIntelligenceCore(input({ evidence: [expiredNow] }));
    expect(model.integrity).toBe("stale");
    expect(model.evidence).toMatchObject([
      { id: "e-current", status: "stale" },
    ]);
    expect(model.pressure).toEqual({
      value: null,
      status: "unavailable",
      evidenceIds: [],
    });
    expect(model.regime.label).toBeNull();
  });

  it("does not manufacture provenance or promote mixed current references", () => {
    const noSource = input({ evidence: [evidence({ source: "" })] });
    expect(adaptIntelligenceCore(noSource).evidence).toEqual([]);
    expect(adaptIntelligenceCore(noSource).pressure.status).toBe("unavailable");

    const stale = evidence({
      id: "e-stale",
      status: "stale",
      validUntil: null,
    });
    const mixed = adaptIntelligenceCore(
      input({
        evidence: [evidence(), stale],
        pressure: {
          value: 50,
          status: "current",
          evidenceIds: ["e-current", "e-stale"],
        },
      })
    );
    expect(mixed.pressure).toEqual({
      value: null,
      status: "unavailable",
      evidenceIds: [],
    });
  });

  it("withholds regime, overview, and current stress when global integrity is degraded and requires overview-specific lineage", () => {
    const degraded = adaptIntelligenceCore(input({ integrity: "degraded" }));
    expect(degraded.regime.label).toBeNull();
    expect(degraded.overview).toBeNull();
    expect(degraded.overviewEvidenceIds).toEqual([]);
    expect(degraded.emergingStress).toEqual([]);

    const missingOverviewLineage = adaptIntelligenceCore(
      input({ overviewEvidenceIds: undefined })
    );
    expect(missingOverviewLineage.overview).toBeNull();
    expect(missingOverviewLineage.overviewEvidenceIds).toEqual([]);
  });

  it("keeps delayed data explicitly delayed, masks non-current domain claims, and never animates it", () => {
    const delayed = evidence({
      id: "e-delayed",
      status: "delayed",
      validUntil: null,
    });
    const model = adaptIntelligenceCore(
      input({
        integrity: "delayed",
        evidence: [delayed],
        pressure: { value: 41, status: "delayed", evidenceIds: [delayed.id] },
        regime: {
          label: "Would be a current-looking regime",
          evidenceIds: [delayed.id],
        },
        domains: input().domains.map(domain => ({
          ...domain,
          status: "delayed",
          evidenceIds: [delayed.id],
        })),
        scenarios: input().scenarios,
      })
    );
    expect(model.pressure).toEqual({
      value: 41,
      status: "delayed",
      evidenceIds: ["e-delayed"],
    });
    expect(model.regime.label).toBeNull();
    expect(
      model.domains.every(
        domain =>
          domain.status === "delayed" &&
          domain.assessment === null &&
          domain.direction === "unknown"
      )
    ).toBe(true);
    expect(model.domains[0].context).toMatch(
      /^Historical context \(delayed\):/
    );
    expect(model.animateVerifiedChange).toBe(false);
  });

  it("requires actual supported relationship lineage and makes C conditional rather than favored", () => {
    const model = adaptIntelligenceCore(
      input({
        relationships: [
          ...input().relationships,
          {
            id: "relationship:no-support",
            from: "ai",
            to: "macro",
            kind: "causal",
            explanation: "Unsupported causal wording",
            evidenceIds: ["e-current"],
            supported: false,
          },
          {
            id: "relationship:missing-evidence",
            from: "ai",
            to: "macro",
            kind: "causal",
            explanation: "Missing lineage",
            evidenceIds: ["not-real"],
            supported: true,
          },
        ],
      })
    );
    expect(model.relationships.map(relationship => relationship.id)).toEqual([
      "relationship:valid",
    ]);
    expect(model.scenarios.find(scenario => scenario.id === "C")).toMatchObject(
      { status: "conditional", summary: "C evidence-backed stress case" }
    );
  });

  it("does not show scenario summaries or conditions where their evidence is absent", () => {
    const scenarios = input().scenarios.map(scenario =>
      scenario.id === "C" ? { ...scenario, evidenceIds: [] } : scenario
    );
    const model = adaptIntelligenceCore(input({ scenarios }));
    expect(model.scenarios.find(scenario => scenario.id === "C")).toEqual({
      id: "C",
      title: "Scenario C",
      status: "unsupported",
      summary: null,
      conditions: [],
      invalidations: [],
      evidenceIds: [],
      domainIds: [],
    });
  });

  it("keeps forward and reconstructed records separate, excludes examples, and requires valid metric lineage and thresholds", () => {
    const base = input();
    const model = adaptIntelligenceCore(
      input({
        trackRecord: {
          records: [
            ...base.trackRecord.records,
            {
              id: "record:example",
              assessmentAt: "2026-01-12T00:00:00.000Z",
              classification: "forward_recorded",
              outcome: "supported",
              summary: "Fixture only",
              evidenceIds: ["e-current"],
              example: true,
            },
            {
              id: "record:missing",
              assessmentAt: "2026-01-12T00:00:00.000Z",
              classification: "forward_recorded",
              outcome: "supported",
              summary: "Missing lineage",
              evidenceIds: ["missing"],
              example: false,
            },
          ],
          metrics: [
            ...base.trackRecord.metrics,
            {
              id: "metric:under-threshold",
              label: "Under threshold",
              displayValue: "1",
              eligibleSample: 2,
              minimumSample: 3,
              admitted: true,
              cohort: "forward_recorded",
              evidenceIds: ["e-current"],
            },
            {
              id: "metric:unadmitted",
              label: "Unadmitted",
              displayValue: "1",
              eligibleSample: 3,
              minimumSample: 3,
              admitted: false,
              cohort: "reconstructed",
              evidenceIds: ["e-current"],
            },
            {
              id: "metric:missing",
              label: "Missing lineage",
              displayValue: "1",
              eligibleSample: 3,
              minimumSample: 3,
              admitted: true,
              cohort: "forward_recorded",
              evidenceIds: ["missing"],
            },
          ],
        },
      })
    );
    expect(
      model.trackRecord.records.map(record => [
        record.id,
        record.classification,
      ])
    ).toEqual([
      ["record:forward", "forward_recorded"],
      ["record:reconstructed", "reconstructed"],
    ]);
    expect(
      model.trackRecord.metrics.map(metric => [metric.id, metric.cohort])
    ).toEqual([
      ["metric:forward", "forward_recorded"],
      ["metric:reconstructed", "reconstructed"],
    ]);
  });

  it("animates only a changed, successive production snapshot with valid current admitted lineage", () => {
    const priorEvidence = evidence({
      observationAt: "2026-01-19T11:55:00.000Z",
    });
    const previous = adaptIntelligenceCore(
      input({
        canonicalStateId: "state:previous",
        observationAt: "2026-01-19T11:55:00.000Z",
        evaluatedAt: "2026-01-19T12:00:00.000Z",
        evidence: [priorEvidence],
        pressure: {
          value: 30,
          status: "current",
          evidenceIds: [priorEvidence.id],
        },
        regime: { label: "Measured regime", evidenceIds: [priorEvidence.id] },
        overviewEvidenceIds: [priorEvidence.id],
      })
    );
    const current = adaptIntelligenceCore(
      input({
        canonicalStateId: "state:current",
        pressure: { value: 50, status: "current", evidenceIds: ["e-current"] },
      }),
      previous
    );
    expect(current.animateVerifiedChange).toBe(true);

    const sameSnapshot = adaptIntelligenceCore(
      input({
        canonicalStateId: "state:current",
        pressure: { value: 55, status: "current", evidenceIds: ["e-current"] },
      }),
      current
    );
    expect(sameSnapshot.animateVerifiedChange).toBe(false);

    const delayedEvidence = evidence({
      id: "e-delayed",
      status: "delayed",
      validUntil: null,
    });
    const delayed = adaptIntelligenceCore(
      input({
        canonicalStateId: "state:delayed",
        evidence: [delayedEvidence],
        pressure: {
          value: 60,
          status: "delayed",
          evidenceIds: [delayedEvidence.id],
        },
      }),
      current
    );
    expect(delayed.animateVerifiedChange).toBe(false);
  });
});

describe("refinement stale-domain lineage retention", () => {
  it("retains actually elapsed admitted source lineage as stale while withholding all current domain claims", () => {
    const model = adaptIntelligenceCore(
      input({
        evidence: [evidence({ validUntil: "2026-02-01T12:00:00.000Z" })],
      })
    );
    expect(model.domains[0]).toMatchObject({
      status: "stale",
      evidenceIds: ["e-current"],
      observationAt: OBSERVED_AT,
      assessment: null,
      direction: "unknown",
    });
    expect(model.pressure.value).toBeNull();
    expect(model.regime.label).toBeNull();
  });

  it("does not classify mixed current references, absent deadlines or unadmitted history as a verified expiry", () => {
    for (const source of [
      evidence({ status: "stale", validUntil: null }),
      evidence({ status: "stale", validUntil: VALID_UNTIL }),
      evidence({
        status: "stale",
        admitted: false,
        validUntil: "2026-02-01T12:00:00.000Z",
      }),
    ]) {
      expect(
        adaptIntelligenceCore(input({ evidence: [source] })).domains[0].status
      ).toBe("unavailable");
    }
    const raw = input();
    raw.evidence.push(
      evidence({
        id: "e-expired",
        status: "stale",
        validUntil: "2026-02-01T12:00:00.000Z",
      })
    );
    raw.domains[0].evidenceIds = ["e-current", "e-expired"];
    expect(adaptIntelligenceCore(raw).domains[0].status).toBe("unavailable");
  });
});
