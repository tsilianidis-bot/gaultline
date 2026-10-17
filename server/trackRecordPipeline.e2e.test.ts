/**
 * Isolated pipeline: gate-verified fixture evidence, not a live provider fetch.
 * Live Yahoo, CoinGecko, and FRED reads are reported outside this file.
 * Nothing here is labeled as a genuine market print.
 */
import { spawn, type ChildProcess } from "node:child_process";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createConnection, type Connection } from "mysql2/promise";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { CanonicalIntelligenceState } from "../shared/canonicalIntelligenceState";
import { INTELLIGENCE_EVIDENCE_METHOD_VERSION } from "../shared/intelligenceEvidence";
import {
  AccountabilityLedger,
  AccountabilityValidationError,
  PROVENANCE_RECONSTRUCTION,
  buildReconstructionAssessment,
  classifyResolution,
  measurePerformance,
} from "../shared/intelligenceAccountability";
import { closeDbForTests } from "./db";
import { buildEvidenceSnapshot, IntelligenceEvidenceCollector } from "./intelligenceEvidence/collector";
import { isIntelligenceEvidenceEnabled } from "./intelligenceEvidence/config";
import { IntelligenceEvidenceStore } from "./intelligenceEvidence/store";
import {
  loadAccountabilityLedger,
  persistAccountabilityAssessment,
  persistAccountabilityDevelopment,
  persistAccountabilityResolution,
} from "./intelligenceAccountability";
import {
  FORWARD_INVALIDATION_CONDITION,
  REQUIRED_VERIFIED_EVIDENCE_IDS,
  evidenceReferenceHash,
  selectVerifiedEvidenceReferences,
  trackRecordCronWritesEnabled,
  captureTrackRecordFromScheduledRun,
} from "./trackRecordCapture";

const PRODUCTION_URL = /prod|railway|getfaultline|amazonaws|planetscale/i;
const PORT = 3308;
const STATE_ID = "state-pipeline-fixture-1";
const STATE_HASH = "a".repeat(64);
const INPUT_ID = "input:mock-pipeline-1";

function assertIsolated(url: string): void {
  if (!url || PRODUCTION_URL.test(url) || !/127\.0\.0\.1|localhost/.test(url)) {
    throw new Error("Refusing to run the track record pipeline against a production database.");
  }
}

function fixtureInputs(nowMs: number, overrides: Record<string, unknown> = {}) {
  const fredDate = new Date(nowMs).toISOString().slice(0, 10);
  return {
    canonical: {
      stateId: STATE_ID,
      stateHash: STATE_HASH, inputSnapshotId: INPUT_ID, pressureIndex: 42, regime: "ELEVATED",
      provenance: { coherenceStatus: "COHERENT" },
      domains: { pressureVerification: { status: "verified", receivedAt: new Date(nowMs - 60_000).toISOString(), inputs: [
        { inputId: "tsy10y", seriesId: "DGS10", sourceValue: 4.25, value: 4.25, observationDate: fredDate },
        { inputId: "tsy2y", seriesId: "DGS2", sourceValue: 4.1, value: 4.1, observationDate: fredDate },
        { inputId: "hySpread", seriesId: "BAMLH0A0HYM2", sourceValue: 3.1, value: 310, observationDate: fredDate },
      ] } },
      generatedAt: new Date(nowMs - 60_000).toISOString(),
      modelVersion: "champion-v1",
      confidenceOrEvidenceQuality: "HEALTHY",
      engines: [{
        engineId: "credit-stress",
        engineName: "Credit stress",
        value: 31,
        unit: "score_0_to_100",
        classification: null,
        direction: "Stable",
        acceleration: null,
        persistence: null,
        observedAt: null,
        calculatedAt: new Date(nowMs - 60_000).toISOString(),
        sourceInputIds: ["BAMLH0A0HYM2"],
        qualityStatus: "HEALTHY",
        freshnessStatus: "CURRENT",
        fallbackStatus: "NONE",
        modelVersion: "champion-v1",
        calculationVersion: "score-v1",
        contributionToComposite: true,
      }],
    } as unknown as CanonicalIntelligenceState,
    quotes: ["SPY", "QQQ", "IWM", "^VIX"].map((ticker, index) => ({
      ticker,
      price: 500 + index,
      prevClose: 499,
      open: 499,
      high: 501,
      low: 498,
      volume: 1000,
      change: 1,
      changePercent: 1,
      marketState: "REGULAR" as const,
      isDelayed: true,
      source: "yahoo" as const,
      observedAt: nowMs - 120_000,
      fetchedAt: nowMs - 60_000,
    })),
    crypto: null,
    fred: {
      timestamp: new Date(nowMs - 60_000).toISOString(),
      results: {
        DGS10: { observations: [{ date: fredDate, value: "4.25" }], cached: false },
        DGS2: { observations: [{ date: fredDate, value: "3.80" }], cached: false },
        BAMLH0A0HYM2: { observations: [{ date: fredDate, value: "3.10" }], cached: false },
      },
    },
    ...overrides,
  };
}

describe("evidence pipeline on an isolated database", () => {
  let server: ChildProcess | null = null;
  let admin: Connection | null = null;
  const previousUrl = process.env.DATABASE_URL;
  const datadir = mkdtempSync(join(tmpdir(), "track-record-pipeline-"));
  const url = `mysql://root@127.0.0.1:${PORT}/track_record_pipeline`;

  beforeAll(async () => {
    assertIsolated(url);
    await new Promise<void>((resolve, reject) => {
      const install = spawn("mariadb-install-db", ["--datadir", datadir, "--auth-root-authentication-method=normal", "--skip-test-db"], { stdio: "ignore" });
      install.on("exit", code => code === 0 ? resolve() : reject(new Error(`mariadb-install-db exited ${code}`)));
    });
    server = spawn("mariadbd", [
      `--datadir=${datadir}`,
      "--bind-address=127.0.0.1",
      `--port=${PORT}`,
      `--socket=${join(datadir, "mysql.sock")}`,
      `--pid-file=${join(datadir, "mysql.pid")}`,
      "--skip-grant-tables",
    ], { stdio: "ignore" });
    admin = await waitForMysql();
    await admin.query("CREATE DATABASE track_record_pipeline");
    await admin.query("USE track_record_pipeline");
    await admin.query(`CREATE TABLE featureFlags (
      id int NOT NULL AUTO_INCREMENT PRIMARY KEY,
      \`key\` varchar(80) NOT NULL UNIQUE,
      enabled int NOT NULL DEFAULT 1,
      description text,
      updatedBy int,
      updatedAt timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
      createdAt timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`);
    await admin.query(`CREATE TABLE governedResearchObservations (
      id int NOT NULL AUTO_INCREMENT PRIMARY KEY,
      observationKey varchar(220) NOT NULL UNIQUE,
      observationVersion varchar(96) NOT NULL,
      historyClass enum('live_verified','reconstructed_research','revised_data_reconstruction','proxy_reconstruction') NOT NULL,
      observationDate timestamp NOT NULL,
      informationCutoff timestamp NOT NULL,
      inputSnapshotId varchar(128),
      sourceModel varchar(128) NOT NULL,
      modelVersion varchar(96) NOT NULL,
      originalStateJson text NOT NULL,
      originalInterpretation text,
      outcomeDefinition text,
      outcomeWindow varchar(128),
      sourceDataVersionsJson text NOT NULL,
      createdAt timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`);
    await admin.query(`CREATE TABLE governedResearchResolutions (
      id int NOT NULL AUTO_INCREMENT PRIMARY KEY,
      resolutionKey varchar(220) NOT NULL UNIQUE,
      observationId int NOT NULL,
      resolutionVersion varchar(96) NOT NULL,
      outcomeValueJson text NOT NULL,
      resolvedAt timestamp NOT NULL,
      sourceDataVersionsJson text NOT NULL,
      createdAt timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT governedResearchResolutions_observation_fk FOREIGN KEY (observationId) REFERENCES governedResearchObservations(id) ON DELETE RESTRICT
    )`);
    await admin.query(`CREATE TABLE marketMemory (
      id int NOT NULL AUTO_INCREMENT PRIMARY KEY,
      memoryKey varchar(120) NOT NULL UNIQUE,
      memoryValue text NOT NULL,
      description varchar(255),
      writtenBy varchar(60),
      updatedAt timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`);
    await admin.query("INSERT INTO featureFlags (`key`, enabled, description) VALUES ('intelligence_track_record', 0, 'default off')");
    process.env.DATABASE_URL = url;
    delete process.env.TRACK_RECORD_CRON_WRITES;
    delete process.env.FAULTLINE_INTELLIGENCE_EVIDENCE_ENABLED;
    closeDbForTests();
  }, 60_000);

  afterAll(async () => {
    closeDbForTests();
    if (previousUrl === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = previousUrl;
    await admin?.end();
    server?.kill("SIGTERM");
  });

  it("refuses a production-looking database url", () => {
    expect(() => assertIsolated("mysql://user@railway.internal/faultline")).toThrow(/production database/);
  });

  it("runs gate, scheduled append, readback, and the refusal cases", async () => {
    const nowMs = Date.now();
    const generatedAt = new Date(nowMs).toISOString();
    const drafted = buildEvidenceSnapshot(fixtureInputs(nowMs), new Date(nowMs));
    expect(drafted.persistence).toBe("in_memory_only");
    expect(drafted.canonicalStateId).toBe(STATE_ID);
    expect(drafted.methodVersion).toBe(INTELLIGENCE_EVIDENCE_METHOD_VERSION);
    for (const id of REQUIRED_VERIFIED_EVIDENCE_IDS) {
      const observation = drafted.observations.find(item => item.id === id);
      expect(observation).toMatchObject({
        validationStatus: "verified",
        supportsCurrentClaim: true,
        origin: "observed",
      });
      expect(observation?.observedAt).toBeTruthy();
      expect(observation?.receivedAt).toBeTruthy();
      expect(observation?.sourceIdentifier).toMatch(/^(yahoo|fred):/);
    }
    expect(drafted.observations.find(item => item.id === "canonical:credit-stress")).toMatchObject({
      origin: "modeled",
      validationStatus: "delayed",
    });
    expect(selectVerifiedEvidenceReferences(drafted, nowMs)).toMatchObject({ reason: "evidence_missing" });

    expect(isIntelligenceEvidenceEnabled({})).toBe(false);
    expect(isIntelligenceEvidenceEnabled({ FAULTLINE_INTELLIGENCE_EVIDENCE_ENABLED: "true" })).toBe(true);
    expect(trackRecordCronWritesEnabled({})).toBe(false);
    const boot = readFileSync("server/_core/index.ts", "utf8");
    expect(boot).toContain("if (isIntelligenceEvidenceEnabled()) startIntelligenceEvidenceCollector();");
    expect(boot).not.toContain("systemic-regime-train");
    const governance = readFileSync("server/intelligenceGovernance.ts", "utf8");
    expect(governance).not.toContain(".delete(governedResearch");
    expect(governance).not.toContain(".update(governedResearch");

    const scheduled = { trigger: "SCHEDULED_CRON" as const };
    const base = { expectedStateHash: STATE_HASH, expectedInputSnapshotId: INPUT_ID, loadCanonical: async () => fixtureInputs(nowMs).canonical, pressureIndex: 42, regime: "ELEVATED", generatedAt, nowMs };
    expect(await captureTrackRecordFromScheduledRun({ expectedCanonicalStateId: STATE_ID,
      ...base,
      run: scheduled,
      env: {},
      loadSnapshot: async () => drafted,
    })).toEqual({ recorded: false, reason: "cron_writes_disabled" });
    expect(await captureTrackRecordFromScheduledRun({ expectedCanonicalStateId: STATE_ID,
      ...base,
      run: scheduled,
      env: { TRACK_RECORD_CRON_WRITES: "true" },
      loadSnapshot: async () => drafted,
    })).toEqual({ recorded: false, reason: "flag_disabled" });

    await admin!.query("UPDATE featureFlags SET enabled = 1 WHERE `key` = 'intelligence_track_record'");
    expect(await captureTrackRecordFromScheduledRun({ expectedCanonicalStateId: STATE_ID,
      ...base,
      run: scheduled,
      env: {},
      loadSnapshot: async () => drafted,
    })).toEqual({ recorded: false, reason: "cron_writes_disabled" });

    const on = { TRACK_RECORD_CRON_WRITES: "true" };
    expect(await captureTrackRecordFromScheduledRun({ expectedCanonicalStateId: STATE_ID,
      ...base, run: scheduled, env: on, loadSnapshot: async () => null,
    })).toEqual({ recorded: false, reason: "evidence_missing" });
    const stale = { ...drafted, persistence: "recorded" as const, capturedAt: new Date(nowMs - 30 * 60_000).toISOString() };
    expect(await captureTrackRecordFromScheduledRun({ expectedCanonicalStateId: STATE_ID,
      ...base, run: scheduled, env: on, loadSnapshot: async () => stale,
    })).toEqual({ recorded: false, reason: "evidence_stale" });
    expect(await captureTrackRecordFromScheduledRun({ expectedCanonicalStateId: STATE_ID,
      ...base,
      run: scheduled,
      env: on,
      loadSnapshot: async () => ({ ...drafted, persistence: "historical_reconstruction" as "recorded" }),
    })).toEqual({ recorded: false, reason: "reconstructed_input" });
    const failedFred = fixtureInputs(nowMs, {
      fred: {
        timestamp: new Date(nowMs - 60_000).toISOString(),
        results: {
          DGS10: { observations: [], cached: false, error: "HTTP 503" },
          DGS2: { observations: [], cached: false, error: "HTTP 503" },
          BAMLH0A0HYM2: { observations: [], cached: false, error: "HTTP 503" },
        },
      },
    });
    const failedSnapshot = { ...buildEvidenceSnapshot(failedFred, new Date(nowMs)), persistence: "recorded" as const };
    expect(failedSnapshot.observations.find(item => item.id === "fred:DGS10")?.validationStatus).toBe("unavailable");
    expect(await captureTrackRecordFromScheduledRun({ expectedCanonicalStateId: STATE_ID,
      ...base, run: scheduled, env: on, loadSnapshot: async () => failedSnapshot,
    })).toEqual({ recorded: false, reason: "evidence_failed" });
    const rejected = {
      ...drafted,
      persistence: "recorded" as const,
      observations: drafted.observations.map(item => item.id === "quote:SPY"
        ? { ...item, validationStatus: "unavailable" as const, supportsCurrentClaim: false, value: null }
        : item),
    };
    expect(await captureTrackRecordFromScheduledRun({ expectedCanonicalStateId: STATE_ID,
      ...base, run: scheduled, env: on, loadSnapshot: async () => rejected,
    })).toEqual({ recorded: false, reason: "integrity_gate_failed" });

    for (const trigger of ["CRON_DEPLOY", "MANUAL", "AD_HOC", "BACKFILL_RECOVERY"] as const) {
      expect(await captureTrackRecordFromScheduledRun({ expectedCanonicalStateId: STATE_ID,
        ...base, run: { trigger }, env: on, loadSnapshot: async () => ({ ...drafted, persistence: "recorded" as const }),
      })).toEqual({ recorded: false, reason: "not_scheduled" });
    }
    expect(await captureTrackRecordFromScheduledRun({ expectedCanonicalStateId: STATE_ID,
      ...base,
      run: scheduled,
      env: on,
      historyClass: "reconstructed_research",
      loadSnapshot: async () => ({ ...drafted, persistence: "recorded" as const }),
    })).toEqual({ recorded: false, reason: "reconstructed_input" });
    expect(await loadAccountabilityLedger()).toHaveLength(0);

    const collector = new IntelligenceEvidenceCollector(new IntelligenceEvidenceStore(), async () => fixtureInputs(Date.now()));
    const recorded = await collector.refresh();
    expect(recorded?.persistence).toBe("recorded");
    expect(recorded?.canonicalStateId).toBe(STATE_ID);
    const loaded = await new IntelligenceEvidenceStore().loadLatest();
    expect(loaded?.persistence).toBe("recorded");
    expect(loaded?.canonicalStateId).toBe(STATE_ID);
    const selected = selectVerifiedEvidenceReferences(loaded, Date.now());
    expect(selected.ok).toBe(true);
    if (!selected.ok) return;
    expect(selected.references.map(item => item.id)).toEqual([...REQUIRED_VERIFIED_EVIDENCE_IDS]);
    expect(JSON.stringify(selected.references)).not.toMatch(/"value"/);
    const spy = loaded!.observations.find(item => item.id === "quote:SPY")!;
    expect(selected.references[0]?.contentHash).toBe(evidenceReferenceHash({
      id: spy.id,
      observedAt: spy.observedAt,
      receivedAt: spy.receivedAt,
      validationStatus: spy.validationStatus,
      methodVersion: loaded!.methodVersion,
      value: spy.value, provider: spy.provider, sourceIdentifier: spy.sourceIdentifier, origin: spy.origin, unit: spy.unit,
    }));
    const [memoryRows] = await admin!.query("SELECT COUNT(*) AS n FROM marketMemory WHERE memoryKey LIKE 'intelligence-evidence:%'") as unknown as [Array<{ n: number }>];
    expect(Number(memoryRows[0]?.n)).toBe(1);

    const bound = await collector.refreshForCanonicalRun(STATE_ID);
    expect(bound?.purpose).toBe("forward_recording");
    const appended = await captureTrackRecordFromScheduledRun({ expectedCanonicalStateId: STATE_ID, ...base, run: scheduled, env: on });
    expect(appended).toEqual({ recorded: true, reason: "appended" });
    const duplicate = await captureTrackRecordFromScheduledRun({ expectedCanonicalStateId: STATE_ID,
      ...base, run: scheduled, env: on, pressureIndex: 7,
    });
    expect(duplicate).toEqual({ recorded: false, reason: "canonical_state_mismatch" });
    const sameSession = await captureTrackRecordFromScheduledRun({ expectedCanonicalStateId: STATE_ID,
      ...base,
      run: scheduled,
      env: on,
      generatedAt: new Date(Date.parse(generatedAt) + 60_000).toISOString(),
      pressureIndex: 8,
    });
    expect(sameSession).toEqual({ recorded: false, reason: "canonical_state_mismatch" });
    expect(await captureTrackRecordFromScheduledRun({ expectedCanonicalStateId: STATE_ID, ...base, run: scheduled, env: on }))
      .toEqual({ recorded: false, reason: "already_recorded" });
    for (const override of [{ expectedStateHash: "b".repeat(64) }, { expectedInputSnapshotId: "input:wrong" }, { regime: "wrong" }])
      expect(await captureTrackRecordFromScheduledRun({ expectedCanonicalStateId: STATE_ID, ...base, ...override, run: scheduled, env: on }))
        .toEqual({ recorded: false, reason: "canonical_state_mismatch" });
    expect(await captureTrackRecordFromScheduledRun({ expectedCanonicalStateId: STATE_ID, ...base, run: scheduled, env: on,
      generatedAt: new Date(nowMs - 10 * 60_000).toISOString() }))
      .toEqual({ recorded: false, reason: "temporal_cutoff_failed" });
    const [counts] = await admin!.query("SELECT historyClass, COUNT(*) AS n FROM governedResearchObservations GROUP BY historyClass") as unknown as [Array<{ historyClass: string; n: number }>];
    expect(counts).toEqual([{ historyClass: "live_verified", n: 1 }]);

    const rows = await loadAccountabilityLedger();
    expect(rows).toHaveLength(1);
    expect(rows[0]?.provenance).toBe("forward_recorded");
    expect(rows[0]?.canonicalStateId).toBe(STATE_ID);
    expect(rows[0]?.pressureIndex).toBe(42);
    expect(rows[0]?.canonicalStateHash).toBe(STATE_HASH);
    expect(rows[0]?.inputSnapshotId).toBe(INPUT_ID);
    expect(rows[0]?.registryVersionId).toBe("stress-benchmark-registry-v1");
    expect(rows[0]?.scenarios.map(item => item.id)).toEqual(["A", "B", "C"]);
    expect(new Set(rows[0]?.scenarios.map(item => item.invalidation)).size).toBe(1);
    expect(JSON.stringify(rows[0]?.scenarios)).not.toMatch(/"favou?red"|"founderThesis|"weight"/i);
    expect(JSON.stringify(rows[0]?.evidenceReferences)).not.toMatch(/"value"/);
    const ledger = new AccountabilityLedger();
    expect(() => ledger.recordAssessment({
      ...rows[0]!,
      founderThesisAffinity: "C",
    })).toThrow(AccountabilityValidationError);

    const originalJson = rows[0]!.originalJson;
    const [observationRow] = await admin!.query("SELECT id, originalStateJson FROM governedResearchObservations") as unknown as [Array<{ id: number; originalStateJson: string }>];
    const observationId = observationRow[0]!.id;
    const before = observationRow[0]!.originalStateJson;
    await persistAccountabilityDevelopment(observationId, {
      developmentKey: "match-invalidation",
      observedAt: new Date(nowMs + 86_400_000).toISOString(),
      statement: FORWARD_INVALIDATION_CONDITION,
      benchmark: null,
      confirmsWarning: false,
    });
    await persistAccountabilityResolution(observationId, {
      resolutionKey: "stored-label-disagrees",
      resolvedAt: new Date(nowMs + 90_000_000).toISOString(),
      status: "supported",
      statement: "Stored label is not the classification rule.",
    });
    const afterDevelopments = await loadAccountabilityLedger();
    expect(afterDevelopments[0]?.originalJson).toBe(originalJson);
    const [afterRow] = await admin!.query("SELECT originalStateJson FROM governedResearchObservations WHERE id = ?", [observationId]) as unknown as [Array<{ originalStateJson: string }>];
    expect(afterRow[0]?.originalStateJson).toBe(before);
    const first = classifyResolution(afterDevelopments[0]!);
    const second = classifyResolution(afterDevelopments[0]!);
    expect(first).toBe("contradicted");
    expect(second).toBe(first);
    expect(afterDevelopments[0]?.resolutions[0]?.status).toBe("supported");
    const directional = measurePerformance(afterDevelopments).metrics.find(item => item.id === "directionalAccuracy")!;
    expect(directional.sampleSize).toBe(1);
    expect(directional.status).toBe("insufficient_evidence");
    expect(directional.value).toBeNull();

    const rewritten = await persistAccountabilityAssessment({ ...afterDevelopments[0]!, summary: "A later edit of the original assessment." });
    expect(rewritten).toEqual({ created: false, id: observationId });
    const [still] = await admin!.query("SELECT originalStateJson FROM governedResearchObservations WHERE id = ?", [observationId]) as unknown as [Array<{ originalStateJson: string }>];
    expect(still[0]?.originalStateJson).toBe(before);

    const reconstruction = new AccountabilityLedger().recordAssessment(buildReconstructionAssessment({
      assessmentKey: "reconstruction-fixture-1",
      assessedAt: new Date(nowMs - 86_400_000).toISOString(),
      summary: "Historical reconstruction fixture. Not a forward record.",
      canonicalStateId: null,
      pressureIndex: null,
      regime: "ELEVATED",
      scenarios: rows[0]!.scenarios,
      supportingObservations: [],
      evidence: { availableInputs: 0, requiredInputs: 3, unavailableInputs: ["fixture"] },
      assessmentKind: "market_assessment",
      direction: "unspecified",
    })).assessment;
    expect(reconstruction.provenance).toBe(PROVENANCE_RECONSTRUCTION);
    const savedReconstruction = await persistAccountabilityAssessment(reconstruction);
    expect(savedReconstruction.created).toBe(true);
    const mixed = await loadAccountabilityLedger();
    expect(mixed.map(item => item.provenance).sort()).toEqual(["forward_recorded", "historical_reconstruction"]);
    expect(measurePerformance(mixed).metrics.find(item => item.id === "directionalAccuracy")!.sampleSize).toBe(1);
    const [classes] = await admin!.query("SELECT historyClass, COUNT(*) AS n FROM governedResearchObservations GROUP BY historyClass ORDER BY historyClass") as unknown as [Array<{ historyClass: string; n: number }>];
    expect(classes).toEqual([
      { historyClass: "live_verified", n: 1 },
      { historyClass: "reconstructed_research", n: 1 },
    ]);

    const appendOnly = readFileSync("scripts/governed-research-append-only.sql", "utf8")
      .split("\n")
      .filter(line => !line.trim().startsWith("--"))
      .join("\n")
      .split(";")
      .map(statement => statement.trim())
      .filter(Boolean);
    for (const statement of appendOnly) await admin!.query(statement);
    await admin!.beginTransaction();
    let parentDeleteBlocked = false;
    try {
      await admin!.query("DELETE FROM governedResearchObservations WHERE id = ?", [observationId]);
    } catch (error) {
      parentDeleteBlocked = (error as { sqlState?: string }).sqlState === "45000";
    }
    let directUpdateBlocked = false;
    try {
      await admin!.query("UPDATE governedResearchObservations SET originalInterpretation = 'mutated' WHERE id = ?", [observationId]);
    } catch (error) {
      directUpdateBlocked = (error as { sqlState?: string }).sqlState === "45000";
    }
    let childlessDeleteBlocked = false;
    try {
      await admin!.query("DELETE FROM governedResearchObservations WHERE historyClass = 'reconstructed_research'");
    } catch (error) {
      childlessDeleteBlocked = (error as { sqlState?: string }).sqlState === "45000";
    }
    await admin!.rollback();
    expect(parentDeleteBlocked).toBe(true);
    expect(directUpdateBlocked).toBe(true);
    expect(childlessDeleteBlocked).toBe(true);
    const [remaining] = await admin!.query("SELECT COUNT(*) AS n FROM governedResearchObservations") as unknown as [Array<{ n: number }>];
    expect(Number(remaining[0]?.n)).toBe(2);
    const [unchanged] = await admin!.query("SELECT originalInterpretation FROM governedResearchObservations WHERE id = ?", [observationId]) as unknown as [Array<{ originalInterpretation: string }>];
    expect(unchanged[0]?.originalInterpretation).not.toBe("mutated");
  }, 60_000);
});

async function waitForMysql(): Promise<Connection> {
  let last: unknown;
  for (let attempt = 0; attempt < 40; attempt += 1) {
    try {
      return await createConnection({ host: "127.0.0.1", port: PORT, user: "root" });
    } catch (error) {
      last = error;
      await new Promise(resolve => setTimeout(resolve, 250));
    }
  }
  throw last;
}
