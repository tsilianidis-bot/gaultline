import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { capturesForwardEvidence } from "./forwardRunProvenance";
import { assessmentToResearchRecord, intelligenceTrackRecordFlagEnabled } from "./intelligenceAccountability";
import {
  AccountabilityImmutabilityError,
  AccountabilityLedger,
  MINIMUM_SAMPLES,
  PROVENANCE_FORWARD,
  PROVENANCE_RECONSTRUCTION,
  RESOLUTION_CONTRADICTED,
  RESOLUTION_SUPPORTED,
  RESOLUTION_UNRESOLVED,
  agreedProvenance,
  assertExampleSeedAllowed,
  buildPublicTrackRecord,
  buildReconstructionAssessment,
  buildScheduledAssessment,
  captureScheduledAssessment,
  emptyPublicTrackRecord,
  equalStandingScenarios,
  examplePublicTrackRecord,
  historyClassForProvenance,
  isForwardEvidence,
  isScheduledForwardRun,
  measurePerformance,
  median,
  provenanceLabel,
  seedExampleLedger,
  type MarketAssessmentInput,
  type ResolutionStatus,
  type StoredAssessment,
} from "../shared/intelligenceAccountability";

const scenarios = equalStandingScenarios("ELEVATED", ["The recorded regime changes."]);

function input(key: string, overrides: Partial<MarketAssessmentInput> = {}): MarketAssessmentInput {
  return {
    assessmentKey: key,
    provenance: PROVENANCE_FORWARD,
    assessedAt: "2026-01-15T18:05:00.000Z",
    summary: `Assessment ${key}`,
    canonicalStateId: "state-1",
    pressureIndex: 41,
    regime: "ELEVATED",
    scenarios,
    supportingObservations: [{
      observedAt: "2026-01-15T17:00:00.000Z",
      source: "FRED",
      statement: "Verified observation.",
      verified: true,
    }],
    evidence: { availableInputs: 6, requiredInputs: 6, unavailableInputs: [] },
    assessmentKind: "market_assessment",
    direction: "unchanged",
    ...overrides,
  };
}

function withStatus(key: string, status: ResolutionStatus | null, overrides: Partial<MarketAssessmentInput> = {}): StoredAssessment {
  const ledger = new AccountabilityLedger();
  ledger.recordAssessment(input(key, overrides));
  if (status) {
    ledger.appendResolution({
      resolutionKey: `${key}-resolution`,
      assessmentKey: key,
      resolvedAt: "2026-04-15T18:00:00.000Z",
      status,
      statement: status,
    });
  }
  return ledger.list()[0]!;
}

describe("accountability recording immutability", () => {
  it("rejects a rewrite of an existing assessment, including a provenance change", () => {
    const ledger = new AccountabilityLedger();
    ledger.recordAssessment(input("a"));
    expect(ledger.recordAssessment(input("a")).created).toBe(false);
    expect(() => ledger.recordAssessment(input("a", { summary: "rewritten" }))).toThrow(AccountabilityImmutabilityError);
    expect(() => ledger.recordAssessment(input("a", { provenance: PROVENANCE_RECONSTRUCTION }))).toThrow(AccountabilityImmutabilityError);
    expect(ledger.list()[0]?.summary).toBe("Assessment a");
    expect(ledger.list()[0]?.provenance).toBe(PROVENANCE_FORWARD);
    expect(ledger.list()[0]?.originalJson).toContain("\"provenance\":\"forward_recorded\"");
  });

  it("appends developments and resolutions without changing the original assessment", () => {
    const ledger = new AccountabilityLedger();
    const created = ledger.recordAssessment(input("a"));
    ledger.appendDevelopment({
      developmentKey: "d1",
      assessmentKey: "a",
      observedAt: "2026-02-01T00:00:00.000Z",
      statement: "Later observation.",
    });
    ledger.appendResolution({
      resolutionKey: "r1",
      assessmentKey: "a",
      resolvedAt: "2026-02-02T00:00:00.000Z",
      status: RESOLUTION_SUPPORTED,
      statement: "Supported.",
    });
    ledger.appendResolution({
      resolutionKey: "r2",
      assessmentKey: "a",
      resolvedAt: "2026-03-02T00:00:00.000Z",
      status: RESOLUTION_CONTRADICTED,
      statement: "A later append contradicted it.",
    });
    const stored = ledger.list()[0]!;
    expect(stored.originalJson).toBe(created.assessment.originalJson);
    expect(stored.developments).toHaveLength(1);
    expect(stored.resolutions.map(item => item.status)).toEqual([RESOLUTION_SUPPORTED, RESOLUTION_CONTRADICTED]);
    expect(ledger.appendDevelopment({
      developmentKey: "d1",
      assessmentKey: "a",
      observedAt: "2026-02-01T00:00:00.000Z",
      statement: "Later observation.",
    }).created).toBe(false);
  });

  it("does not favor scenario C and rejects a founder-thesis preference", () => {
    expect(() => new AccountabilityLedger().recordAssessment(input("c", { favoredScenario: "C" }))).toThrow(/Scenario C/);
    expect(() => new AccountabilityLedger().recordAssessment(input("c2", { founderThesisAffinity: "stress" }))).toThrow(/founder thesis/);
    const recorded = new AccountabilityLedger().recordAssessment(input("equal")).assessment;
    expect(recorded.scenarios.map(item => item.id)).toEqual(["A", "B", "C"]);
    expect(JSON.stringify(recorded.scenarios)).not.toMatch(/weight|probability|favou?red/i);
  });
});

describe("provenance separation", () => {
  it("keeps historical reconstructions out of forward labels and metrics", () => {
    const forward = withStatus("live", RESOLUTION_SUPPORTED);
    const reconstructed = withStatus("old", RESOLUTION_SUPPORTED, { provenance: PROVENANCE_RECONSTRUCTION, exampleData: false });
    expect(isForwardEvidence(forward)).toBe(true);
    expect(isForwardEvidence(reconstructed)).toBe(false);
    expect(provenanceLabel(forward)).toBe("Forward-recorded");
    expect(provenanceLabel(reconstructed)).toBe("Historical reconstruction");
    expect(provenanceLabel(withStatus("ex", null, { exampleData: true }))).toBe("Example data");
    expect(provenanceLabel(withStatus("exr", null, { exampleData: true, provenance: PROVENANCE_RECONSTRUCTION }))).not.toContain("Forward-recorded");
    const measured = measurePerformance([forward, reconstructed]);
    expect(measured.metrics.find(item => item.id === "directionalAccuracy")?.sampleSize).toBe(1);
    expect(historyClassForProvenance(PROVENANCE_FORWARD)).toBe("live_verified");
    expect(historyClassForProvenance(PROVENANCE_RECONSTRUCTION)).toBe("reconstructed_research");
    expect(agreedProvenance("reconstructed_research", PROVENANCE_FORWARD)).toBe("conflict");
    expect(agreedProvenance("live_verified", PROVENANCE_RECONSTRUCTION)).toBe("conflict");
    expect(agreedProvenance("live_verified", PROVENANCE_FORWARD)).toBe(PROVENANCE_FORWARD);
  });

  it("records a scheduled run as forward and refuses every other trigger", () => {
    expect(isScheduledForwardRun({ trigger: "SCHEDULED_CRON" })).toBe(capturesForwardEvidence({ trigger: "SCHEDULED_CRON" }));
    expect(isScheduledForwardRun({ trigger: "CRON_DEPLOY" })).toBe(false);
    const snapshot = {
      run: { trigger: "SCHEDULED_CRON" as const },
      stateId: "state-9",
      generatedAt: "2026-04-01T18:05:00.000Z",
      pressureIndex: 34,
      regime: "MODERATE",
      summary: "Scheduled assessment.",
      invalidationConditions: ["Regime label changes."],
      supportingObservations: [],
      evidence: { availableInputs: 5, requiredInputs: 6, unavailableInputs: ["hy_spread"] },
    };
    expect(buildScheduledAssessment(snapshot).provenance).toBe(PROVENANCE_FORWARD);
    expect(() => buildScheduledAssessment({ ...snapshot, run: { trigger: "BACKFILL_RECOVERY" } })).toThrow(/scheduled forward run/);
    expect(buildReconstructionAssessment(input("hist")).provenance).toBe(PROVENANCE_RECONSTRUCTION);
    const ledger = new AccountabilityLedger();
    expect(captureScheduledAssessment({ enabled: false, ledger, snapshot }).reason).toBe("flag_disabled");
    expect(ledger.list()).toHaveLength(0);
    expect(captureScheduledAssessment({ enabled: true, ledger, snapshot }).reason).toBe("appended");
    expect(captureScheduledAssessment({ enabled: true, ledger, snapshot }).reason).toBe("already_recorded");
    expect(ledger.list()).toHaveLength(1);
  });

  it("maps forward rows to live_verified research records and refuses example writes", () => {
    const row = withStatus("persist", null);
    const record = assessmentToResearchRecord(row);
    expect(record.historyClass).toBe("live_verified");
    expect(record.sourceModel).toBe("faultline-intelligence-accountability");
    expect(JSON.stringify(record.originalState)).not.toMatch(/probability|crash/i);
    const reconstruction = assessmentToResearchRecord(withStatus("old", null, { provenance: PROVENANCE_RECONSTRUCTION }));
    expect(reconstruction.historyClass).toBe("reconstructed_research");
    expect(() => assessmentToResearchRecord(withStatus("ex", null, { exampleData: true }))).toThrow(/Example data/);
  });
});

describe("insufficient-evidence gating and metric math", () => {
  it("withholds every rate below its minimum and does not count unresolved rows", () => {
    const rows = [
      ...Array.from({ length: 29 }, (_, index) => withStatus(`s${index}`, index < 20 ? RESOLUTION_SUPPORTED : RESOLUTION_CONTRADICTED)),
      withStatus("open", null),
      withStatus("explicit", RESOLUTION_UNRESOLVED),
      withStatus("example", RESOLUTION_SUPPORTED, { exampleData: true }),
    ];
    const directional = measurePerformance(rows).metrics.find(item => item.id === "directionalAccuracy")!;
    expect(directional.status).toBe("insufficient_evidence");
    expect(directional.value).toBeNull();
    expect(directional.sampleSize).toBe(29);
    expect(emptyPublicTrackRecord().metrics.every(item => item.status === "insufficient_evidence" && item.value === null)).toBe(true);
  });

  it("computes fixed rates once the real forward sample is large enough", () => {
    const directionalRows = [
      ...Array.from({ length: 20 }, (_, index) => withStatus(`hit-${index}`, RESOLUTION_SUPPORTED)),
      ...Array.from({ length: 10 }, (_, index) => withStatus(`miss-${index}`, RESOLUTION_CONTRADICTED)),
    ];
    const directional = measurePerformance(directionalRows).metrics.find(item => item.id === "directionalAccuracy")!;
    expect(directional).toMatchObject({ status: "reported", sampleSize: 30, value: 20 / 30 });
    const regime = measurePerformance(directionalRows).regimeMetrics.find(item => item.regime === "ELEVATED")!;
    expect(regime).toMatchObject({ status: "reported", sampleSize: 30, minimumSample: MINIMUM_SAMPLES.regimePerformance, value: 20 / 30 });

    const warnings = [
      ...Array.from({ length: 18 }, (_, index) => withStatus(`w${index}`, RESOLUTION_SUPPORTED, { assessmentKind: "early_warning", direction: "stress_increase" })),
      ...Array.from({ length: 12 }, (_, index) => withStatus(`wf${index}`, RESOLUTION_CONTRADICTED, { assessmentKind: "early_warning", direction: "stress_increase" })),
    ];
    expect(measurePerformance(warnings).metrics.find(item => item.id === "falsePositiveRate")).toMatchObject({ status: "reported", value: 12 / 30 });

    const leadLedger = new AccountabilityLedger();
    for (let index = 0; index < 20; index += 1) {
      const key = `lead-${index}`;
      leadLedger.recordAssessment(input(key, { assessmentKind: "early_warning", direction: "stress_increase", assessedAt: "2026-01-01T00:00:00.000Z" }));
      leadLedger.appendDevelopment({
        developmentKey: `${key}-d`,
        assessmentKey: key,
        observedAt: new Date(Date.parse("2026-01-01T00:00:00.000Z") + (index + 1) * 86_400_000).toISOString(),
        statement: "Confirmed later.",
        confirmsWarning: true,
      });
      leadLedger.appendResolution({
        resolutionKey: `${key}-r`,
        assessmentKey: key,
        resolvedAt: "2026-03-01T00:00:00.000Z",
        status: RESOLUTION_SUPPORTED,
        statement: "Supported.",
      });
    }
    expect(median([1, 2, 3, 4])).toBe(2.5);
    expect(measurePerformance(leadLedger.list()).metrics.find(item => item.id === "leadTimeDays")).toMatchObject({ status: "reported", sampleSize: 20, value: 10.5 });

    const events = Array.from({ length: 20 }, (_, index) => ({
      id: `e${index}`,
      occurredAt: new Date(Date.parse("2020-01-01T00:00:00.000Z") + index * 90 * 86_400_000).toISOString(),
    }));
    const prior = events.slice(0, 5).map((event, index) => withStatus(`prior-${index}`, RESOLUTION_SUPPORTED, {
      assessmentKind: "early_warning",
      direction: "stress_increase",
      assessedAt: new Date(Date.parse(event.occurredAt) - 10 * 86_400_000).toISOString(),
    }));
    expect(measurePerformance(prior, events).metrics.find(item => item.id === "missedWarningRate")).toMatchObject({ status: "reported", sampleSize: 20, value: 15 / 20 });

    const benchmarkLedger = new AccountabilityLedger();
    for (let index = 0; index < 30; index += 1) {
      const key = `bench-${index}`;
      benchmarkLedger.recordAssessment(input(key));
      benchmarkLedger.appendDevelopment({
        developmentKey: `${key}-d`,
        assessmentKey: key,
        observedAt: "2026-02-01T00:00:00.000Z",
        statement: "Compared with the pre-registered benchmark.",
        benchmark: { id: "spy-20d", matched: index < 21 },
      });
    }
    expect(measurePerformance(benchmarkLedger.list()).metrics.find(item => item.id === "benchmarkComparison")).toMatchObject({ status: "reported", value: 21 / 30 });

    const coverage = [
      ...Array.from({ length: 7 }, (_, index) => withStatus(`cov-${index}`, null)),
      ...Array.from({ length: 3 }, (_, index) => withStatus(`gap-${index}`, null, { evidence: { availableInputs: 2, requiredInputs: 6, unavailableInputs: ["hy_spread"] }, supportingObservations: [] })),
    ];
    expect(measurePerformance(coverage).metrics.find(item => item.id === "evidenceCoverage")).toMatchObject({ status: "reported", sampleSize: 10, value: 0.7 });
  });

  it("does not let example data or reconstructions satisfy a minimum", () => {
    const filler = Array.from({ length: 40 }, (_, index) => withStatus(`fake-${index}`, RESOLUTION_SUPPORTED, {
      exampleData: true,
      provenance: index % 2 === 0 ? PROVENANCE_FORWARD : PROVENANCE_RECONSTRUCTION,
    }));
    const directional = measurePerformance(filler).metrics.find(item => item.id === "directionalAccuracy")!;
    expect(directional.status).toBe("insufficient_evidence");
    expect(directional.sampleSize).toBe(0);
    expect(directional.value).toBeNull();
  });
});

describe("public projection, flag, and example seed", () => {
  it("publishes no probability fields and labels example rows", () => {
    const view = examplePublicTrackRecord();
    const serialized = JSON.stringify(view);
    expect(serialized).not.toMatch(/probability|crash|Pre-Flight|predictive|percent/i);
    expect(view.examplePreview).toBe(true);
    expect(view.disclaimer).toContain("Not investment advice");
    expect(view.metrics.every(item => item.status === "insufficient_evidence")).toBe(true);
    expect(view.chronology.some(item => item.currentStatus === RESOLUTION_CONTRADICTED)).toBe(true);
    expect(view.chronology.some(item => item.currentStatus === RESOLUTION_UNRESOLVED)).toBe(true);
    expect(view.chronology.every(item => item.provenanceLabel !== "Forward-recorded")).toBe(true);
    expect(view.inventory.forwardRecorded).toBe(0);
  });

  it("keeps the flag off unless the row is explicitly enabled", () => {
    expect(intelligenceTrackRecordFlagEnabled(null)).toBe(false);
    expect(intelligenceTrackRecordFlagEnabled(undefined)).toBe(false);
    expect(intelligenceTrackRecordFlagEnabled({ enabled: 0 })).toBe(false);
    expect(intelligenceTrackRecordFlagEnabled({ enabled: 1 })).toBe(true);
  });

  it("refuses to seed example data in production or without an explicit opt-in", () => {
    expect(() => assertExampleSeedAllowed({ NODE_ENV: "production", TRACK_RECORD_ALLOW_EXAMPLE_SEED: "1" })).toThrow(/production/);
    expect(() => assertExampleSeedAllowed({ NODE_ENV: "development", DATABASE_URL: "mysql://railway.internal/prod" })).toThrow(/production database/);
    expect(() => seedExampleLedger({ NODE_ENV: "test" })).toThrow(/TRACK_RECORD_ALLOW_EXAMPLE_SEED/);
    const seeded = seedExampleLedger({ NODE_ENV: "test", TRACK_RECORD_ALLOW_EXAMPLE_SEED: "1", DATABASE_URL: "" });
    expect(seeded.list().every(row => row.exampleData)).toBe(true);
    expect(buildPublicTrackRecord(seeded.list()).chronology).toHaveLength(0);
  });
});

describe("accountability surface does not join the five-question navigation", () => {
  it("keeps the page behind the flag and out of primary navigation", () => {
    const page = readFileSync("client/src/pages/IntelligenceTrackRecord.tsx", "utf8");
    const nav = readFileSync("client/src/components/LeftNavDrawer.tsx", "utf8");
    const registry = readFileSync("shared/routeRegistry.ts", "utf8");
    const server = readFileSync("server/intelligenceAccountability.ts", "utf8");
    expect(page).toContain("PUBLIC_DISCLAIMER");
    expect(page).toContain("Insufficient evidence");
    expect(page).toContain("import.meta.env.DEV");
    expect(page).not.toMatch(/Pre-Flight|crash probability|predictive/i);
    expect(nav).toContain("intelligence-track-record");
    expect(nav).toContain('item.id !== "intelligence-track-record" || showAccountability');
    expect(registry).not.toContain("intelligence-track-record");
    expect(server).not.toMatch(/pressure\/engine|stripe|marketStateService|pressure\/v2/);
  });
});
