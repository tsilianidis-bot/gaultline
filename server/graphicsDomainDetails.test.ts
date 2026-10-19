import { afterEach, describe, expect, it, vi } from "vitest";
import { adaptIntelligenceCore } from "../client/src/components/intelligence-core-visual/adapter";
import { STATUS_LABELS } from "../client/src/components/intelligence-core-visual/CoreTopology";
import type { IntelligenceCoreInput } from "../client/src/components/intelligence-core-visual/types";

const NOW = new Date("2026-10-19T12:00:00Z");
const OBSERVED_AT = "2026-10-19T10:00:00Z";
const EVALUATED_AT = "2026-10-19T11:00:00Z";

function inputFor(
  status: "recent" | "delayed" | "static",
  validUntil: string,
  confidence: unknown = "Calibrated band: moderate"
): IntelligenceCoreInput {
  return {
    canonicalStateId: `state:${status}`,
    observationAt: OBSERVED_AT,
    evaluatedAt: EVALUATED_AT,
    integrity: status,
    integrityReason: "Canonical source status supplied.",
    pressure: { value: 48, status, evidenceIds: ["macro-observation"] },
    regime: { label: "Must not be shown", evidenceIds: ["macro-observation"] },
    overview: "Must not be shown",
    overviewEvidenceIds: ["macro-observation"],
    evidence: [
      {
        id: "macro-observation",
        label: "Macro release",
        source: "Canonical release",
        sourceUrl: null,
        observationAt: OBSERVED_AT,
        status,
        value: "3.1%",
        explanation: "A released macro observation.",
        admitted: true,
        validUntil,
      },
    ],
    domains: [
      {
        id: "macro",
        label: "Untrusted label is ignored",
        status,
        assessment: "Must not restore a historical assessment",
        direction: "rising",
        observationAt: OBSERVED_AT,
        evidenceIds: ["macro-observation"],
        significance: "Canonical domain significance.",
        context: "Released context.",
        developingSince: OBSERVED_AT,
        historicalComparison: "Prior release.",
        confidence: confidence as string | null,
        confirmationConditions: ["Release persists", "Release persists", 1 as never],
        invalidationConditions: ["Revised release", { unsafe: true } as never],
        pressureContribution: "Contributes to the supplied pressure readout.",
        previousObservation: "Prior released reading: 2.9%.",
      },
    ],
    relationships: [],
    scenarios: [],
    emergingStress: [],
    trackRecord: { records: [], metrics: [] },
  };
}

afterEach(() => vi.useRealTimers());

describe("Intelligence Core graphics domain details", () => {
  it("keeps a complete recent observation inspectable without promoting it to a live claim", () => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);

    const model = adaptIntelligenceCore(
      inputFor("recent", "2026-10-19T18:00:00Z")
    );
    const domain = model.domains.find(item => item.id === "macro")!;

    expect(model.integrity).toBe("recent");
    expect(model.pressure).toMatchObject({ status: "recent", value: null });
    expect(model.regime.label).toBeNull();
    expect(model.overview).toBeNull();
    expect(domain).toMatchObject({
      status: "recent",
      assessment: null,
      direction: "unknown",
      confidence: "Calibrated band: moderate",
      confirmationConditions: ["Release persists"],
      invalidationConditions: ["Revised release"],
      pressureContribution: "Contributes to the supplied pressure readout.",
      previousObservation: "Prior released reading: 2.9%.",
    });
    expect(model.evidence[0]?.status).toBe("recent");
    expect(STATUS_LABELS.recent).toBe("RECENT");
    expect(STATUS_LABELS.current).toBe("LIVE");
  });

  it("does not turn a numeric confidence into a calibrated label", () => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);

    const model = adaptIntelligenceCore(
      inputFor("recent", "2026-10-19T18:00:00Z", 0.82)
    );

    expect(model.domains.find(item => item.id === "macro")?.confidence).toBeNull();
  });

  it("downgrades an elapsed static/model record to stale across the visual status boundary", () => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);

    const model = adaptIntelligenceCore(
      inputFor("static", "2026-10-19T10:30:00Z")
    );
    const domain = model.domains.find(item => item.id === "macro")!;

    expect(model.evidence[0]?.status).toBe("stale");
    expect(model.integrity).toBe("stale");
    expect(model.pressure).toMatchObject({ status: "stale", value: null });
    expect(domain.status).toBe("stale");
    expect(domain.assessment).toBeNull();
    expect(STATUS_LABELS.static).toBe("RECENT · MODEL");
    expect(STATUS_LABELS.degraded).toBe("UNAVAILABLE · DEGRADED");
  });
});
