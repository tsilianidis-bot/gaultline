import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { registryCanonicalJson, type StressBenchmarkRegistry } from "../shared/stressBenchmarkRegistry";
import { capturesForwardEvidence } from "./forwardRunProvenance";
import { assessmentToResearchRecord, intelligenceTrackRecordFlagEnabled } from "./intelligenceAccountability";
import { CUSTOMER_SEARCH_ITEMS, TOOLS_HOME_CONTEXTUAL_SECTION } from "../shared/navigationHierarchy";
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
  classifyResolution,
  DIVERSITY_GUARD,
  emptyPublicTrackRecord,
  equalStandingScenarios,
  examplePublicTrackRecord,
  historyClassForProvenance,
  isForwardEvidence,
  isScheduledForwardRun,
  measurePerformance,
  median,
  provenanceLabel,
  RESOLUTION_RULE_ID,
  seedExampleLedger,
  type MarketAssessmentInput,
  type ResolutionStatus,
  type StoredAssessment,
} from "../shared/intelligenceAccountability";

const scenarios = equalStandingScenarios("ELEVATED", ["The recorded regime changes."]);

function testRegistry(
  events: StressBenchmarkRegistry["events"],
  benchmarks: StressBenchmarkRegistry["benchmarks"] = [],
): StressBenchmarkRegistry {
  const versionId = "test-registry";
  const contentHash = createHash("sha256").update(registryCanonicalJson({ versionId, events, benchmarks })).digest("hex");
  return { versionId, contentHash, events, benchmarks };
}

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

function spread(index: number): Partial<MarketAssessmentInput> {
  return {
    assessedAt: new Date(Date.parse("2026-01-01T18:05:00.000Z") + (index % 10) * 86_400_000).toISOString(),
    regime: index % 2 === 0 ? "ELEVATED" : "MODERATE",
    canonicalStateId: `state-${index}`,
  };
}

function withStatus(key: string, status: ResolutionStatus | null, overrides: Partial<MarketAssessmentInput> = {}): StoredAssessment {
  const ledger = new AccountabilityLedger();
  const recorded = input(key, overrides);
  ledger.recordAssessment(recorded);
  if (status === RESOLUTION_SUPPORTED || status === RESOLUTION_CONTRADICTED) {
    ledger.appendDevelopment({
      developmentKey: `${key}-d`,
      assessmentKey: key,
      observedAt: "2026-04-01T18:00:00.000Z",
      statement: status === RESOLUTION_CONTRADICTED
        ? recorded.scenarios[0]!.invalidation
        : "Later observation did not match a frozen invalidation.",
    });
  }
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
      statement: "Supported.",
    });
    expect(() => ledger.appendResolution({
      resolutionKey: "r2",
      assessmentKey: "a",
      resolvedAt: "2026-03-02T00:00:00.000Z",
      status: RESOLUTION_CONTRADICTED,
      statement: "A later label tried to call it contradicted.",
    })).toThrow(/cannot be chosen/);
    const stored = ledger.list()[0]!;
    expect(stored.originalJson).toBe(created.assessment.originalJson);
    expect(stored.developments).toHaveLength(1);
    expect(stored.resolutions.map(item => item.status)).toEqual([RESOLUTION_SUPPORTED]);
    expect(classifyResolution(stored)).toBe(RESOLUTION_SUPPORTED);
    expect(ledger.appendDevelopment({
      developmentKey: "d1",
      assessmentKey: "a",
      observedAt: "2026-02-01T00:00:00.000Z",
      statement: "Later observation.",
    }).created).toBe(false);
    expect(ledger.appendResolution({
      resolutionKey: "r1",
      assessmentKey: "a",
      resolvedAt: "2026-02-02T00:00:00.000Z",
      status: RESOLUTION_CONTRADICTED,
      statement: "Edited.",
    }).created).toBe(false);
    expect(ledger.list()[0]?.resolutions[0]?.statement).toBe("Supported.");
  });

  it("does not favor scenario C and rejects a founder-thesis preference", () => {
    expect(() => new AccountabilityLedger().recordAssessment(input("kind", { assessmentKind: "forecast" as "market_assessment" }))).toThrow(/assessmentKind/);
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
    const laterSameSession = { ...snapshot, generatedAt: "2026-04-01T20:30:00.000Z", stateId: "state-other", pressureIndex: 90 };
    expect(buildScheduledAssessment(laterSameSession).assessmentKey).toBe("scheduled:nyse:2026-04-01");
    expect(buildScheduledAssessment(snapshot).assessmentKey).toBe("scheduled:nyse:2026-04-01");
    expect(buildScheduledAssessment(snapshot).assessedAt).toBe("2026-04-01T18:05:00.000Z");
    expect(() => captureScheduledAssessment({ enabled: true, ledger, snapshot: laterSameSession })).toThrow(AccountabilityImmutabilityError);
    expect(ledger.list()).toHaveLength(1);
    expect(ledger.list()[0]?.pressureIndex).toBe(34);
    const nextSession = { ...snapshot, generatedAt: "2026-04-02T20:15:00.000Z" };
    expect(buildScheduledAssessment(nextSession).assessmentKey).toBe("scheduled:nyse:2026-04-02");
    expect(captureScheduledAssessment({ enabled: true, ledger, snapshot: nextSession }).reason).toBe("appended");
    expect(ledger.list()).toHaveLength(2);
    expect(buildScheduledAssessment({ ...snapshot, generatedAt: "2026-11-02T21:15:00.000Z" }).assessmentKey).toBe("scheduled:nyse:2026-11-02");
    expect(buildScheduledAssessment({ ...snapshot, generatedAt: "2026-11-27T21:15:00.000Z" }).assessmentKey).toBe("scheduled:nyse:2026-11-27");
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
      ...Array.from({ length: 20 }, (_, index) => withStatus(`hit-${index}`, RESOLUTION_SUPPORTED, spread(index))),
      ...Array.from({ length: 10 }, (_, index) => withStatus(`miss-${index}`, RESOLUTION_CONTRADICTED, spread(index + 20))),
    ];
    const directional = measurePerformance(directionalRows).metrics.find(item => item.id === "directionalAccuracy")!;
    expect(directional).toMatchObject({ status: "reported", sampleSize: 30, value: 20 / 30 });
    const regime = measurePerformance(directionalRows).regimeMetrics.find(item => item.regime === "ELEVATED")!;
    expect(regime).toMatchObject({ status: "reported", sampleSize: 15, minimumSample: MINIMUM_SAMPLES.regimePerformance, value: 10 / 15 });

    const warnings = [
      ...Array.from({ length: 18 }, (_, index) => withStatus(`w${index}`, RESOLUTION_SUPPORTED, { ...spread(index), assessmentKind: "early_warning", direction: "stress_increase" })),
      ...Array.from({ length: 12 }, (_, index) => withStatus(`wf${index}`, RESOLUTION_CONTRADICTED, { ...spread(index + 18), assessmentKind: "early_warning", direction: "stress_increase" })),
    ];
    expect(measurePerformance(warnings).metrics.find(item => item.id === "falsePositiveRate")).toMatchObject({ status: "reported", value: 12 / 30 });

    const leadLedger = new AccountabilityLedger();
    for (let index = 0; index < 20; index += 1) {
      const key = `lead-${index}`;
      const assessedAt = new Date(Date.parse("2026-01-01T00:00:00.000Z") + (index % 10) * 86_400_000).toISOString();
      leadLedger.recordAssessment(input(key, {
        ...spread(index),
        assessmentKind: "early_warning",
        direction: "stress_increase",
        assessedAt,
      }));
      leadLedger.appendDevelopment({
        developmentKey: `${key}-d`,
        assessmentKey: key,
        observedAt: new Date(Date.parse(assessedAt) + (index + 1) * 86_400_000).toISOString(),
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
    const eventRegistry = testRegistry(events.map(event => ({ ...event, label: event.id })));
    expect(measurePerformance(prior, events, eventRegistry).metrics.find(item => item.id === "missedWarningRate")).toMatchObject({ status: "reported", sampleSize: 20, value: 15 / 20 });
    expect(measurePerformance(prior, events).metrics.find(item => item.id === "missedWarningRate")?.sampleSize).toBe(0);

    const benchRegistry = testRegistry([], [{ id: "spy-20d", label: "SPY 20 trading-day comparison" }]);
    const benchmarkLedger = new AccountabilityLedger();
    for (let index = 0; index < 30; index += 1) {
      const key = `bench-${index}`;
      benchmarkLedger.recordAssessment(input(key, {
        ...spread(index),
        preregisteredBenchmarkId: "spy-20d",
        registryVersionId: benchRegistry.versionId,
        registryContentHash: benchRegistry.contentHash,
      }));
      benchmarkLedger.appendDevelopment({
        developmentKey: `${key}-d`,
        assessmentKey: key,
        observedAt: "2026-02-01T00:00:00.000Z",
        statement: "Compared with the pre-registered benchmark.",
        benchmark: { id: "spy-20d", matched: index < 21 },
      });
    }
    expect(measurePerformance(benchmarkLedger.list(), [], benchRegistry).metrics.find(item => item.id === "benchmarkComparison")).toMatchObject({ status: "reported", value: 21 / 30 });
    expect(measurePerformance(benchmarkLedger.list()).metrics.find(item => item.id === "benchmarkComparison")?.sampleSize).toBe(0);

    const coverage = [
      ...Array.from({ length: 7 }, (_, index) => withStatus(`cov-${index}`, null, spread(index))),
      ...Array.from({ length: 3 }, (_, index) => withStatus(`gap-${index}`, null, { ...spread(index + 7), evidence: { availableInputs: 2, requiredInputs: 6, unavailableInputs: ["hy_spread"] }, supportingObservations: [] })),
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

describe("frozen classification and diversity guard", () => {
  it("classifies from the frozen invalidation text and ignores a stored label", () => {
    expect(RESOLUTION_RULE_ID).toBe("invalidation-match-v1");
    const supported = withStatus("rule-s", RESOLUTION_SUPPORTED);
    const contradicted = withStatus("rule-c", RESOLUTION_CONTRADICTED);
    const unresolved = withStatus("rule-u", RESOLUTION_UNRESOLVED);
    expect(classifyResolution(supported)).toBe(RESOLUTION_SUPPORTED);
    expect(classifyResolution(contradicted)).toBe(RESOLUTION_CONTRADICTED);
    expect(classifyResolution(unresolved)).toBe(RESOLUTION_UNRESOLVED);
    const lying = structuredClone(supported);
    lying.resolutions[0]!.status = RESOLUTION_CONTRADICTED;
    expect(classifyResolution(lying)).toBe(RESOLUTION_SUPPORTED);
    expect(currentStatusIgnoresLabel(lying)).toBe(RESOLUTION_SUPPORTED);

    const ledger = new AccountabilityLedger();
    ledger.recordAssessment(input("undo"));
    ledger.appendDevelopment({
      developmentKey: "hit",
      assessmentKey: "undo",
      observedAt: "2026-02-01T00:00:00.000Z",
      statement: scenarios[0]!.invalidation,
    });
    ledger.appendDevelopment({
      developmentKey: "spin",
      assessmentKey: "undo",
      observedAt: "2026-03-01T00:00:00.000Z",
      statement: "A later note tried to walk the invalidation back.",
    });
    expect(classifyResolution(ledger.list()[0]!)).toBe(RESOLUTION_CONTRADICTED);
    expect(() => ledger.appendResolution({
      resolutionKey: "spin-label",
      assessmentKey: "undo",
      resolvedAt: "2026-03-02T00:00:00.000Z",
      status: RESOLUTION_SUPPORTED,
      statement: "Called supported after the fact.",
    })).toThrow(/cannot be chosen/);
    const priorOnly = new AccountabilityLedger();
    priorOnly.recordAssessment(input("prior"));
    priorOnly.appendDevelopment({
      developmentKey: "before",
      assessmentKey: "prior",
      observedAt: "2025-12-01T00:00:00.000Z",
      statement: scenarios[0]!.invalidation,
    });
    expect(classifyResolution(priorOnly.list()[0]!)).toBe(RESOLUTION_UNRESOLVED);
  });

  it("keeps contradicted assessments in the public chronology", () => {
    const rows = [withStatus("shown-s", RESOLUTION_SUPPORTED), withStatus("shown-c", RESOLUTION_CONTRADICTED)];
    const view = buildPublicTrackRecord(rows);
    expect(view.chronology.map(item => item.assessmentKey).sort()).toEqual(["shown-c", "shown-s"]);
    expect(view.chronology.find(item => item.assessmentKey === "shown-c")?.currentStatus).toBe(RESOLUTION_CONTRADICTED);
    expect(view.chronology.find(item => item.assessmentKey === "shown-s")?.scenarios[0]?.invalidation).toBe(scenarios[0]!.invalidation);
  });

  it("withholds rates when the sample is one day, one regime, or one canonical state", () => {
    expect(DIVERSITY_GUARD.minimumDistinctUtcDates).toBe(5);
    const oneDay = Array.from({ length: 30 }, (_, index) => withStatus(`day-${index}`, index < 20 ? RESOLUTION_SUPPORTED : RESOLUTION_CONTRADICTED, {
      regime: index % 2 === 0 ? "ELEVATED" : "MODERATE",
      canonicalStateId: `state-${index}`,
    }));
    const dayMetric = measurePerformance(oneDay).metrics.find(item => item.id === "directionalAccuracy")!;
    expect(dayMetric).toMatchObject({ status: "insufficient_evidence", sampleSize: 30, value: null });
    expect(dayMetric.detail).toMatch(/UTC date/);

    const oneRegime = Array.from({ length: 30 }, (_, index) => withStatus(`reg-${index}`, index < 20 ? RESOLUTION_SUPPORTED : RESOLUTION_CONTRADICTED, {
      ...spread(index),
      regime: "ELEVATED",
    }));
    const regimeMetric = measurePerformance(oneRegime).metrics.find(item => item.id === "directionalAccuracy")!;
    expect(regimeMetric).toMatchObject({ status: "insufficient_evidence", value: null });
    expect(regimeMetric.detail).toMatch(/one regime/);
    expect(measurePerformance(oneRegime).regimeMetrics.find(item => item.regime === "ELEVATED")).toMatchObject({ status: "reported", sampleSize: 30, value: 20 / 30 });

    const oneCluster = Array.from({ length: 30 }, (_, index) => withStatus(`cl-${index}`, index < 20 ? RESOLUTION_SUPPORTED : RESOLUTION_CONTRADICTED, {
      ...spread(index),
      canonicalStateId: "state-same",
    }));
    const clusterMetric = measurePerformance(oneCluster).metrics.find(item => item.id === "directionalAccuracy")!;
    expect(clusterMetric.detail).toMatch(/one canonical state/);
    expect(clusterMetric.value).toBeNull();

    const leadLedger = new AccountabilityLedger();
    for (let index = 0; index < 20; index += 1) {
      const key = `same-day-lead-${index}`;
      leadLedger.recordAssessment(input(key, {
        assessmentKind: "early_warning",
        direction: "stress_increase",
        assessedAt: "2026-01-01T00:00:00.000Z",
        regime: index % 2 === 0 ? "ELEVATED" : "MODERATE",
        canonicalStateId: `lead-state-${index}`,
      }));
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
        statement: "Supported.",
      });
    }
    const leads = measurePerformance(leadLedger.list()).metrics.find(item => item.id === "leadTimeDays")!;
    expect(leads).toMatchObject({ status: "insufficient_evidence", sampleSize: 20, value: null });
    expect(leads.detail).toMatch(/UTC date/);

    const shortLeads = leadLedger.list().slice(0, 19);
    expect(measurePerformance(shortLeads).metrics.find(item => item.id === "leadTimeDays")).toMatchObject({ status: "insufficient_evidence", sampleSize: 19, value: null });
  });

  it("counts missed warnings and benchmarks only from preregistered ids", () => {
    const note = withStatus("note", RESOLUTION_SUPPORTED, { assessmentKind: "early_warning", direction: "stress_increase" });
    expect(measurePerformance([note]).metrics.find(item => item.id === "missedWarningRate")).toMatchObject({ status: "insufficient_evidence", sampleSize: 0, value: null });
    const sameDay = Array.from({ length: 20 }, (_, index) => ({ id: `same-${index}`, occurredAt: "2024-06-01T00:00:00.000Z" }));
    expect(measurePerformance([], sameDay).metrics.find(item => item.id === "missedWarningRate")?.sampleSize).toBe(0);
    const concentrated = measurePerformance([], sameDay, testRegistry(sameDay.map(event => ({ ...event, label: event.id })))).metrics.find(item => item.id === "missedWarningRate")!;
    expect(concentrated).toMatchObject({ status: "insufficient_evidence", sampleSize: 20, value: null });
    expect(concentrated.detail).toMatch(/UTC date/);
    const duplicates = Array.from({ length: 20 }, () => ({ id: "event-1", occurredAt: "2024-06-01T00:00:00.000Z" }));
    const duplicateRegistry = testRegistry([{ id: "event-1", occurredAt: "2024-06-01T00:00:00.000Z", label: "event-1" }]);
    expect(measurePerformance([], duplicates, duplicateRegistry).metrics.find(item => item.id === "missedWarningRate")?.sampleSize).toBe(1);
    expect(measurePerformance([], [{ id: " ", occurredAt: "2024-06-01T00:00:00.000Z" }]).metrics.find(item => item.id === "missedWarningRate")?.sampleSize).toBe(0);

    const unregistered = new AccountabilityLedger();
    for (let index = 0; index < 30; index += 1) {
      const key = `bare-${index}`;
      unregistered.recordAssessment(input(key, spread(index)));
      unregistered.appendDevelopment({
        developmentKey: `${key}-d`,
        assessmentKey: key,
        observedAt: "2026-05-01T00:00:00.000Z",
        statement: "Compared after the fact.",
        benchmark: { id: "spy-20d", matched: true },
      });
    }
    expect(measurePerformance(unregistered.list()).metrics.find(item => item.id === "benchmarkComparison")).toMatchObject({ sampleSize: 0, value: null, status: "insufficient_evidence" });

    const mismatched = new AccountabilityLedger();
    mismatched.recordAssessment(input("mismatch", { ...spread(0), preregisteredBenchmarkId: "spy-20d" }));
    mismatched.appendDevelopment({
      developmentKey: "mismatch-d",
      assessmentKey: "mismatch",
      observedAt: "2026-05-01T00:00:00.000Z",
      statement: "Different benchmark.",
      benchmark: { id: "chosen-later", matched: true },
    });
    expect(measurePerformance(mismatched.list()).metrics.find(item => item.id === "benchmarkComparison")?.sampleSize).toBe(0);
  });
});

function currentStatusIgnoresLabel(row: StoredAssessment): ResolutionStatus {
  return classifyResolution(row);
}

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
    const governance = readFileSync("server/intelligenceGovernance.ts", "utf8");
    const schema = readFileSync("drizzle/schema.ts", "utf8");
    const router = readFileSync("server/routers/intelligenceAccountability.ts", "utf8");
    const cron = readFileSync("server/scheduledSeismograph.ts", "utf8");
    expect(page).toContain("This record is not published.");
    expect(page).toContain("PUBLIC_DISCLAIMER");
    expect(page).toContain("Insufficient evidence");
    expect(page).toContain("import.meta.env.DEV");
    expect(page).toContain("intelligenceAccountability.emptyPreview");
    expect(page).not.toContain("isOwnerOrAdmin");
    expect(page).not.toContain("emptyPublicTrackRecord");
    expect(router).toContain("emptyPreview: ownerOrAdminProcedure");
    expect(page).not.toMatch(/Pre-Flight|crash probability|predictive/i);
    expect(nav).toContain("NAVIGATION_HIERARCHY");
    expect(CUSTOMER_SEARCH_ITEMS.some(item => item.path.includes("intelligence-track-record"))).toBe(false);
    expect(TOOLS_HOME_CONTEXTUAL_SECTION.items.some(item => item.path.includes("intelligence-track-record"))).toBe(false);
    expect(registry).not.toContain("intelligence-track-record");
    expect(server).not.toMatch(/pressure\/engine|stripe|marketStateService|pressure\/v2/);
    expect(server).not.toMatch(/\.update\(|\.delete\(/);
    expect(governance).not.toMatch(/\.update\(governedResearch|\.delete\(governedResearch/);
    expect(schema).toContain('onDelete("restrict")');
    const procedure = router.slice(router.indexOf("publicRecord"));
    expect(procedure.indexOf("if (!enabled)")).toBeLessThan(procedure.indexOf("loadAccountabilityLedger"));
    expect(procedure).toContain("enabled: false");
    expect(cron).toContain("captureTrackRecordFromScheduledRun");
    expect(cron).toContain("TRACK_RECORD_CRON_WRITES");
    expect(cron).not.toContain("captureScheduledAssessment");
  });
});
