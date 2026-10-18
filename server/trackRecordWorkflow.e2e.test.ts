import { spawn, type ChildProcess } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createConnection, type Connection } from "mysql2/promise";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { INTELLIGENCE_EVIDENCE_METHOD_VERSION, type IntelligenceEvidenceSnapshot } from "../shared/intelligenceEvidence";
import { RESOLUTION_SUPPORTED, measurePerformance } from "../shared/intelligenceAccountability";
import { CANONICAL_STATE_SCHEMA_VERSION, type CanonicalIntelligenceState } from "../shared/canonicalIntelligenceState";
import { closeDbForTests } from "./db";
import { resolveRunContext } from "./forwardRunProvenance";
import { loadAccountabilityLedger, persistAccountabilityDevelopment, persistAccountabilityResolution } from "./intelligenceAccountability";
import { IntelligenceEvidenceStore } from "./intelligenceEvidence/store";
import { REQUIRED_VERIFIED_EVIDENCE_IDS, captureTrackRecordFromScheduledRun } from "./trackRecordCapture";
import type { ValidatedIntelligenceEvidence } from "../shared/intelligenceEvidence";

const PRODUCTION_URL = /prod|railway|getfaultline|amazonaws|planetscale/i;
const PORT = 3307;
const STATE_ID = "state-e2e-1";
const STATE_HASH = "b".repeat(64);
const INPUT_ID = "input:mock-workflow-1";
const FIXTURE_DATE = "2026-10-16";

function assertIsolatedTrackRecordDatabase(url: string): void {
  if (!url || PRODUCTION_URL.test(url) || !/127\.0\.0\.1|localhost/.test(url)) {
    throw new Error("Refusing to run the track record workflow against a production database.");
  }
}

function observation(id: string): ValidatedIntelligenceEvidence {
  return {
    id,
    label: id,
    kind: id.startsWith("fred:") ? "macro_release" : "market_quote",
    provider: id.startsWith("fred:") ? "FRED" : "Yahoo Finance",
    origin: "observed",
    value: 4,
    unit: "points",
    observedAt: "2026-10-16T20:14:00.000Z",
    receivedAt: "2026-10-16T20:18:00.000Z",
    maxAgeMs: 20 * 60_000,
    validationStatus: "verified",
    supportsCurrentClaim: true,
    validationReason: "Valid provenance, timestamps and source health.",
    modelVersion: null,
    sourceIdentifier: id,
    temporalStatus: "delayed",
    temporalDetail: "Provider timestamp retained.",
    historicalValue: null,
    lastVerified: null,
  };
}

function verifiedSnapshot(capturedAt: string): IntelligenceEvidenceSnapshot {
  return {
    kind: "intelligence-evidence-snapshot",
    methodVersion: INTELLIGENCE_EVIDENCE_METHOD_VERSION,
    capturedAt,
    purpose: "forward_recording",
    canonicalStateId: STATE_ID,
    canonicalStateHash: STATE_HASH, canonicalInputSnapshotId: INPUT_ID, canonicalPressureIndex: 41, canonicalRegime: "ELEVATED", canonicalCoherenceStatus: "COHERENT",
    observations: REQUIRED_VERIFIED_EVIDENCE_IDS.map(observation),
    providerHealth: [
      { id: "yahoo", label: "quotes", provider: "Yahoo", status: "healthy", observedAt: capturedAt, checkedAt: capturedAt, detail: "ok" },
      { id: "fred", label: "fred", provider: "FRED", status: "healthy", observedAt: capturedAt, checkedAt: capturedAt, detail: "ok" },
    ],
    domains: [],
    limitations: [],
    persistence: "recorded",
  };
}

/** Complete mock canonical state; it is not a provider or deployment assertion. */
function canonicalFixture(generatedAt: string): CanonicalIntelligenceState {
  const vectors = [
    ["liquidity-stress", 40], ["credit-contagion", 42], ["volatility-regime", 39],
    ["macro-sensitivity", 41], ["market-breadth", 43], ["ai-bubble", 41],
  ] as const;
  return {
    schemaVersion: CANONICAL_STATE_SCHEMA_VERSION,
    stateId: STATE_ID,
    generatedAt,
    effectiveAt: generatedAt,
    calculationStartedAt: "2026-10-16T20:19:50.000Z",
    calculationCompletedAt: generatedAt,
    championVersion: "mock-champion-v1",
    modelVersion: "mock-model-v1",
    scoringVersion: "mock-score-v1",
    configurationVersion: "mock-config-v1",
    inputSnapshotId: INPUT_ID,
    stateHash: STATE_HASH,
    regime: "ELEVATED",
    pressureIndex: 41,
    pressureLevel: "ELEVATED",
    pressureDirection: "Stable",
    pressureAcceleration: null,
    pressurePersistence: null,
    engines: vectors.map(([engineId, value]) => ({
      engineId,
      engineName: engineId,
      value,
      unit: "score_0_to_100",
      classification: null,
      direction: engineId === "ai-bubble" ? "Unknown" : "Stable",
      acceleration: null,
      persistence: null,
      observedAt: null,
      calculatedAt: generatedAt,
      sourceInputIds: ["fixture-input"],
      qualityStatus: "HEALTHY",
      freshnessStatus: "CURRENT",
      fallbackStatus: "NONE",
      modelVersion: "mock-model-v1",
      calculationVersion: "mock-score-v1",
      contributionToComposite: true,
    })),
    domains: {
      pressureVerification: {
        status: "verified",
        inputs: [
          { inputId: "tsy10y", value: 4, observationDate: FIXTURE_DATE },
          { inputId: "hySpread", value: 400, observationDate: FIXTURE_DATE },
        ],
      },
    },
    scenarioOutputs: {},
    probabilityClaimIds: [],
    analogClaimIds: [],
    historicalContext: {
      canonicalLiveHistory: "mock live history",
      reconstructedResearch: "mock reconstructed research",
      historicalAnalogOutput: "mock analog references",
      patternResolution: "mock resolutions",
    },
    dataQualitySummary: { status: "HEALTHY" },
    confidenceOrEvidenceQuality: "HEALTHY",
    staleInputs: [],
    delayedInputs: [],
    unavailableInputs: [],
    fallbackInputs: [],
    warnings: [],
    conflicts: [],
    historicalDatasetVersion: "mock-history-v1",
    researchDatasetVersion: "mock-research-v1",
    provenance: {
      manifestSource: "intelligenceStateManifests",
      governanceVersion: "mock-config-v1",
      coherenceStatus: "COHERENT",
      runTrigger: "SCHEDULED_CRON",
      scheduledPublication: true,
    },
  };
}

describe("track record workflow on an isolated database", () => {
  let server: ChildProcess | null = null;
  let admin: Connection | null = null;
  const previousUrl = process.env.DATABASE_URL;
  const datadir = mkdtempSync(join(tmpdir(), "track-record-mysql-"));
  const url = `mysql://root@127.0.0.1:${PORT}/track_record_test`;

  beforeAll(async () => {
    assertIsolatedTrackRecordDatabase(url);
    if (previousUrl) assertIsolatedTrackRecordDatabase(previousUrl);
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
    await admin.query("CREATE DATABASE track_record_test");
    await admin.query("USE track_record_test");
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
    await admin.query(`INSERT INTO featureFlags (\`key\`, enabled, description) VALUES ('intelligence_track_record', 0, 'default off')`);
    process.env.DATABASE_URL = url;
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
    expect(() => assertIsolatedTrackRecordDatabase("mysql://railway.internal/prod")).toThrow(/production database/);
  });

  it("runs cron, evidence read, append, resolution, and the gates", async () => {
    const generatedAt = "2026-10-16T20:20:00.000Z";
    const nowMs = Date.parse("2026-10-16T20:21:00.000Z");
    const scheduledRun = resolveRunContext("cron-endpoint", new Date(generatedAt));
    expect(scheduledRun).toMatchObject({ trigger: "SCHEDULED_CRON", triggerSource: "cron-endpoint", scheduledWindow: true });
    const stored = verifiedSnapshot("2026-10-16T20:19:30.000Z");
    const write = await new IntelligenceEvidenceStore().insert(stored);
    expect(write).toBe("INSERTED");
    const loaded = await new IntelligenceEvidenceStore().loadLatest(STATE_ID, true);
    expect(loaded?.canonicalStateId).toBe(STATE_ID);
    expect(loaded?.purpose).toBe("forward_recording");
    expect(JSON.stringify(loaded?.observations[0])).not.toBe(JSON.stringify({ copied: true }));

    const canonical = canonicalFixture(generatedAt);
    const base = {
      expectedStateHash: STATE_HASH, expectedInputSnapshotId: INPUT_ID,
      loadCanonical: async () => canonical,
      pressureIndex: 41,
      regime: "ELEVATED",
      generatedAt,
      nowMs,
      env: { TRACK_RECORD_CRON_WRITES: "false" },
    };
    expect(await captureTrackRecordFromScheduledRun({ expectedCanonicalStateId: STATE_ID, ...base, run: scheduledRun })).toEqual({ recorded: false, reason: "cron_writes_disabled" });
    expect(await captureTrackRecordFromScheduledRun({ expectedCanonicalStateId: STATE_ID,
      ...base,
      run: scheduledRun,
      env: { TRACK_RECORD_CRON_WRITES: "true" },
    })).toEqual({ recorded: false, reason: "flag_disabled" });

    await admin!.query("UPDATE featureFlags SET enabled = 1 WHERE `key` = 'intelligence_track_record'");
    const missing = await captureTrackRecordFromScheduledRun({ expectedCanonicalStateId: STATE_ID,
      ...base,
      run: scheduledRun,
      env: { TRACK_RECORD_CRON_WRITES: "true" },
      loadSnapshot: async () => null,
    });
    expect(missing).toEqual({ recorded: false, reason: "evidence_missing" });
    expect(await loadAccountabilityLedger()).toHaveLength(0);

    const reconstructed = await captureTrackRecordFromScheduledRun({ expectedCanonicalStateId: STATE_ID,
      ...base,
      run: scheduledRun,
      env: { TRACK_RECORD_CRON_WRITES: "true" },
      historyClass: "reconstructed_research",
    });
    expect(reconstructed).toEqual({ recorded: false, reason: "reconstructed_input" });
    expect(await loadAccountabilityLedger()).toHaveLength(0);

    const appended = await captureTrackRecordFromScheduledRun({ expectedCanonicalStateId: STATE_ID,
      ...base,
      run: scheduledRun,
      env: { TRACK_RECORD_CRON_WRITES: "true" },
    });
    expect(appended).toEqual({ recorded: true, reason: "appended" });
    const duplicate = await captureTrackRecordFromScheduledRun({ expectedCanonicalStateId: STATE_ID,
      ...base,
      run: scheduledRun,
      env: { TRACK_RECORD_CRON_WRITES: "true" },
    });
    expect(duplicate).toEqual({ recorded: false, reason: "already_recorded" });

    const rows = await loadAccountabilityLedger();
    expect(rows).toHaveLength(1);
    expect(rows[0]?.provenance).toBe("forward_recorded");
    expect(rows[0]?.canonicalStateId).toBe(STATE_ID);
    expect(rows[0]?.registryVersionId).toBe("stress-benchmark-registry-v1");
    expect(rows[0]?.evidenceReferences.map(item => item.id)).toEqual([...REQUIRED_VERIFIED_EVIDENCE_IDS]);
    expect(JSON.stringify(rows[0]?.evidenceReferences)).not.toMatch(/"value"/);
    expect(JSON.stringify(rows[0])).not.toMatch(/"value":4/);

    const [observationRow] = await admin!.query("SELECT id, historyClass FROM governedResearchObservations") as unknown as [Array<{ id: number; historyClass: string }>];
    expect(observationRow[0]?.historyClass).toBe("live_verified");
    const observationId = observationRow[0]!.id;
    await persistAccountabilityDevelopment(observationId, {
      developmentKey: "later-1",
      observedAt: "2026-10-18T18:00:00.000Z",
      statement: "Later observation did not match the frozen invalidation.",
      benchmark: null,
      confirmsWarning: false,
    });
    await persistAccountabilityResolution(observationId, {
      resolutionKey: "res-1",
      resolvedAt: "2026-10-18T18:10:00.000Z",
      status: RESOLUTION_SUPPORTED,
      statement: "Classified from the frozen invalidation rule.",
    });
    const after = await loadAccountabilityLedger();
    expect(after[0]?.developments).toHaveLength(1);
    expect(after[0]?.resolutions.map(item => item.status)).toEqual([RESOLUTION_SUPPORTED]);
    const directional = measurePerformance(after).metrics.find(item => item.id === "directionalAccuracy")!;
    expect(directional.status).toBe("insufficient_evidence");
    expect(directional.value).toBeNull();
    expect(directional.sampleSize).toBe(1);
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
