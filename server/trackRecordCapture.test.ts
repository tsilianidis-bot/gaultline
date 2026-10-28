import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import type { IntelligenceEvidenceSnapshot, ValidatedIntelligenceEvidence } from "../shared/intelligenceEvidence";
import { INTELLIGENCE_EVIDENCE_METHOD_VERSION } from "../shared/intelligenceEvidence";
import { buildScheduledAssessment } from "../shared/intelligenceAccountability";
import {
  STRESS_BENCHMARK_REGISTRY_V1,
  STRESS_BENCHMARK_REGISTRY_V1_HASH,
  activeStressBenchmarkRegistry,
  registryCanonicalJson,
} from "../shared/stressBenchmarkRegistry";
import {
  REQUIRED_VERIFIED_EVIDENCE_IDS,
  captureTrackRecordFromScheduledRun,
  evidenceReferenceHash,
  hashStressBenchmarkRegistry,
  selectVerifiedEvidenceReferences,
  trackRecordCronWritesEnabled,
} from "./trackRecordCapture";

const NOW = Date.parse("2026-10-17T18:05:00.000Z");

function observation(id: string, overrides: Partial<ValidatedIntelligenceEvidence> = {}): ValidatedIntelligenceEvidence {
  return {
    id,
    label: id,
    kind: "market_quote",
    provider: "Yahoo Finance",
    origin: "observed",
    value: 12,
    unit: "points",
    observedAt: "2026-10-17T18:00:00.000Z",
    receivedAt: "2026-10-17T18:04:00.000Z",
    maxAgeMs: 20 * 60_000,
    validUntil: "2026-10-17T18:20:00.000Z",
    validationStatus: "verified",
    supportsCurrentClaim: true,
    validationReason: "Valid provenance, timestamps and source health.",
    modelVersion: null,
    sourceIdentifier: id,
    temporalStatus: "delayed",
    temporalDetail: "Provider timestamp retained.",
    historicalValue: null,
    lastVerified: null,
    ...overrides,
  };
}

function snapshot(overrides: Partial<IntelligenceEvidenceSnapshot> = {}): IntelligenceEvidenceSnapshot {
  return {
    kind: "intelligence-evidence-snapshot",
    methodVersion: INTELLIGENCE_EVIDENCE_METHOD_VERSION,
    capturedAt: "2026-10-17T18:04:30.000Z",
    canonicalStateId: "state-live-1",
    observations: REQUIRED_VERIFIED_EVIDENCE_IDS.map(id => observation(id)),
    providerHealth: [
      { id: "yahoo", label: "quotes", provider: "Yahoo", status: "healthy", observedAt: "2026-10-17T18:00:00.000Z", checkedAt: "2026-10-17T18:04:30.000Z", detail: "ok" },
      { id: "fred", label: "fred", provider: "FRED", status: "healthy", observedAt: "2026-10-17T00:00:00.000Z", checkedAt: "2026-10-17T18:04:30.000Z", detail: "ok" },
    ],
    domains: [],
    limitations: ["A read being unavailable, stale, or historical is not interpreted as calm or neutral."],
    persistence: "recorded",
    ...overrides,
  };
}

describe("verified evidence selection", () => {
  it("keeps the published registry frozen and hashed", () => {
    expect(Object.isFrozen(STRESS_BENCHMARK_REGISTRY_V1)).toBe(true);
    expect(Object.isFrozen(STRESS_BENCHMARK_REGISTRY_V1.events)).toBe(true);
    expect(STRESS_BENCHMARK_REGISTRY_V1.events).toHaveLength(0);
    expect(hashStressBenchmarkRegistry(STRESS_BENCHMARK_REGISTRY_V1)).toBe(STRESS_BENCHMARK_REGISTRY_V1_HASH);
    expect(activeStressBenchmarkRegistry()).toBe(STRESS_BENCHMARK_REGISTRY_V1);
    const edited = {
      versionId: STRESS_BENCHMARK_REGISTRY_V1.versionId,
      events: [{ id: "added-later", occurredAt: "2008-09-15T00:00:00.000Z", label: "not published" }],
      benchmarks: [],
    };
    expect(hashStressBenchmarkRegistry(edited)).not.toBe(STRESS_BENCHMARK_REGISTRY_V1_HASH);
    expect(registryCanonicalJson(STRESS_BENCHMARK_REGISTRY_V1)).toBe(registryCanonicalJson(activeStressBenchmarkRegistry()));
  });

  it("accepts verified recorded evidence and stores hashes without measurement copies", () => {
    const selected = selectVerifiedEvidenceReferences(snapshot(), NOW);
    expect(selected.ok).toBe(true);
    if (!selected.ok) return;
    expect(selected.canonicalStateId).toBe("state-live-1");
    expect(selected.references.map(item => item.id)).toEqual([...REQUIRED_VERIFIED_EVIDENCE_IDS]);
    expect(JSON.stringify(selected.references)).not.toMatch(/"value"/);
    expect(selected.references[0]?.contentHash).toBe(evidenceReferenceHash({
      id: "quote:SPY",
      observedAt: "2026-10-17T18:00:00.000Z",
      receivedAt: "2026-10-17T18:04:00.000Z",
      validationStatus: "verified",
      methodVersion: INTELLIGENCE_EVIDENCE_METHOD_VERSION,
    }));
    const changed = evidenceReferenceHash({
      id: "quote:SPY",
      observedAt: "2026-10-17T18:00:00.000Z",
      receivedAt: "2026-10-17T18:04:00.000Z",
      validationStatus: "stale",
      methodVersion: INTELLIGENCE_EVIDENCE_METHOD_VERSION,
    });
    expect(changed).not.toBe(selected.references[0]?.contentHash);
  });

  it("records nothing when evidence is missing, stale, failed, or rejected by the integrity gate", () => {
    expect(selectVerifiedEvidenceReferences(null, NOW)).toEqual({ ok: false, reason: "evidence_missing" });
    expect(selectVerifiedEvidenceReferences(snapshot({ persistence: "in_memory_only" }), NOW).ok && false).toBe(false);
    expect(selectVerifiedEvidenceReferences(snapshot({ persistence: "in_memory_only" }), NOW)).toMatchObject({ reason: "evidence_missing" });
    expect(selectVerifiedEvidenceReferences(snapshot({ capturedAt: "2026-10-17T17:00:00.000Z" }), NOW)).toMatchObject({ reason: "evidence_stale" });
    expect(selectVerifiedEvidenceReferences(snapshot({ canonicalStateId: null }), NOW)).toMatchObject({ reason: "canonical_state_missing" });
    expect(selectVerifiedEvidenceReferences(snapshot({
      providerHealth: [{ id: "fred", label: "fred", provider: "FRED", status: "unavailable", observedAt: null, checkedAt: "2026-10-17T18:04:30.000Z", detail: "down" }],
    }), NOW)).toMatchObject({ reason: "evidence_failed" });
    const missing = snapshot({ observations: snapshot().observations.filter(item => item.id !== "fred:DGS10") });
    expect(selectVerifiedEvidenceReferences(missing, NOW)).toMatchObject({ reason: "evidence_missing" });
    const stale = snapshot({
      observations: snapshot().observations.map(item => item.id === "quote:SPY" ? { ...item, validationStatus: "stale", supportsCurrentClaim: false } : item),
    });
    expect(selectVerifiedEvidenceReferences(stale, NOW)).toMatchObject({ reason: "evidence_stale" });
    const rejected = snapshot({
      observations: snapshot().observations.map(item => item.id === "fred:BAMLH0A0HYM2" ? { ...item, validationStatus: "unavailable", supportsCurrentClaim: false, value: null } : item),
    });
    expect(selectVerifiedEvidenceReferences(rejected, NOW)).toMatchObject({ reason: "integrity_gate_failed" });
  });

  it("refuses reconstructed inputs and non-scheduled triggers without writing", async () => {
    expect(selectVerifiedEvidenceReferences(snapshot({ persistence: "historical_reconstruction" as "recorded" }), NOW)).toMatchObject({ reason: "reconstructed_input" });
    expect(() => buildScheduledAssessment({
      run: { trigger: "SCHEDULED_CRON" },
      stateId: "state-live-1",
      generatedAt: "2026-10-17T18:05:00.000Z",
      pressureIndex: 40,
      regime: "ELEVATED",
      summary: "Scheduled assessment.",
      invalidationConditions: ["The recorded regime label changes."],
      supportingObservations: [],
      evidence: { availableInputs: 3, requiredInputs: 3, unavailableInputs: [] },
      reconstructed: true,
    })).toThrow(/reconstructed or historical/);
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const env = { TRACK_RECORD_CRON_WRITES: "true" };
    expect(await captureTrackRecordFromScheduledRun({
      run: { trigger: "CRON_DEPLOY" },
      pressureIndex: 40,
      regime: "ELEVATED",
      generatedAt: "2026-10-17T18:05:00.000Z",
      env,
      flagEnabled: true,
      loadSnapshot: async () => snapshot(),
    })).toEqual({ recorded: false, reason: "not_scheduled" });
    expect(await captureTrackRecordFromScheduledRun({
      run: { trigger: "SCHEDULED_CRON" },
      pressureIndex: 40,
      regime: "ELEVATED",
      generatedAt: "2026-10-17T18:05:00.000Z",
      env,
      flagEnabled: true,
      reconstructed: true,
      loadSnapshot: async () => snapshot(),
    })).toEqual({ recorded: false, reason: "reconstructed_input" });
    expect(trackRecordCronWritesEnabled({})).toBe(false);
    expect(trackRecordCronWritesEnabled({ TRACK_RECORD_CRON_WRITES: "false" })).toBe(false);
    for (const value of ["TRUE", " true ", "true ", "1", "yes", "True", "true\n"]) {
      expect(trackRecordCronWritesEnabled({ TRACK_RECORD_CRON_WRITES: value })).toBe(false);
    }
    expect(await captureTrackRecordFromScheduledRun({
      run: { trigger: "SCHEDULED_CRON" },
      pressureIndex: 40,
      regime: "ELEVATED",
      generatedAt: "2026-10-17T18:05:00.000Z",
      env: {},
      flagEnabled: true,
      loadSnapshot: async () => snapshot(),
    })).toEqual({ recorded: false, reason: "cron_writes_disabled" });
    expect(await captureTrackRecordFromScheduledRun({
      run: { trigger: "SCHEDULED_CRON" },
      pressureIndex: 40,
      regime: "ELEVATED",
      generatedAt: "2026-10-17T18:05:00.000Z",
      env,
      flagEnabled: false,
      loadSnapshot: async () => snapshot(),
    })).toEqual({ recorded: false, reason: "flag_disabled" });
    warn.mockRestore();
  });

  it("does not write Core evidence or canonical state", () => {
    const source = readFileSync("server/trackRecordCapture.ts", "utf8");
    const sql = readFileSync("scripts/intelligence-track-record-flag.sql", "utf8");
    expect(source).not.toMatch(/\.insert\(|tryClaim|startIntelligenceEvidenceCollector|calculateFaultlinePressure|canonicalIntelligenceState/);
    expect(source).toContain("loadLatest");
    expect(source).toContain("TRACK_RECORD_CRON_WRITES");
    expect(sql).toContain("enabled");
    expect(sql).toMatch(/0,/);
    expect(sql).toContain("WHERE NOT EXISTS");
    expect(sql).toContain("intelligence_track_record");
    expect(sql.startsWith("-- INERT")).toBe(true);
    expect(readFileSync("drizzle/meta/_journal.json", "utf8")).not.toContain("intelligence-track-record-flag");
    const digest = createHash("sha256").update(registryCanonicalJson(STRESS_BENCHMARK_REGISTRY_V1)).digest("hex");
    expect(digest).toBe(STRESS_BENCHMARK_REGISTRY_V1_HASH);
  });
});
