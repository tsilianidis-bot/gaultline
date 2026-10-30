/**
 * Synthetic local recovery proof only. This suite never reads DATABASE_URL or
 * app configuration and never treats a disposable backup/restore as production
 * backup, PITR, privilege, or operational-recovery acceptance.
 */
import { randomUUID, createHash } from "node:crypto";
import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import mysql, { type Connection } from "mysql2/promise";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  startDisposableMariaDb,
  type DisposableMariaDb,
} from "./testing/disposableMariaDb";

const root = resolve(import.meta.dirname, "..");
const journalPath = resolve(root, "drizzle/meta/_journal.json");
const migrationTags = [
  "0077_governed_research_immutability",
  "0078_payment_event_linkage",
  "0079_decision_outcome_provenance",
  "0080_publishing_delivery_claims",
  "0081_admin_audit_events",
  "0082_durable_alert_events",
  "0083_auth_state_and_sessions",
] as const;
const immutablePrefixSha256 = "318818c345df26cb45f99da89b6a215a5765c4eddf59624e65f908ab6395c3a1";

type JournalEntry = Readonly<{
  idx: number;
  version: string;
  when: number;
  tag: string;
  breakpoints: boolean;
}>;

type OwnedDatabase = Readonly<{
  name: string;
  connection: Connection;
}>;

function migrationStatements(sql: string): string[] {
  return sql
    .split("--> statement-breakpoint")
    .map(chunk => chunk.split("\n").filter(line => !line.trim().startsWith("--")).join("\n").trim())
    .filter(Boolean);
}

async function applyMigration(connection: Connection, tag: typeof migrationTags[number]): Promise<void> {
  const migration = await readFile(resolve(root, "drizzle", `${tag}.sql`), "utf8");
  for (const statement of migrationStatements(migration)) {
    await connection.query(statement);
  }
}

async function applyCurrentTail(connection: Connection): Promise<void> {
  for (const tag of migrationTags) {
    await applyMigration(connection, tag);
  }
}

async function createSyntheticPreTailSchema(connection: Connection): Promise<void> {
  await connection.query(`CREATE TABLE \`users\` (
    \`id\` int NOT NULL PRIMARY KEY,
    \`openId\` varchar(64) NOT NULL UNIQUE
  ) ENGINE=InnoDB`);
  await connection.query(`CREATE TABLE \`decision_ledger\` (
    \`id\` int NOT NULL PRIMARY KEY,
    \`outcome\` varchar(32) NOT NULL DEFAULT 'pending'
  ) ENGINE=InnoDB`);
  await connection.query(`CREATE TABLE \`governedResearchObservations\` (
    \`id\` int NOT NULL AUTO_INCREMENT PRIMARY KEY,
    \`observationKey\` varchar(220) NOT NULL UNIQUE,
    \`observationVersion\` varchar(96) NOT NULL,
    \`historyClass\` enum('live_verified','reconstructed_research','revised_data_reconstruction','proxy_reconstruction') NOT NULL,
    \`observationDate\` timestamp NOT NULL,
    \`informationCutoff\` timestamp NOT NULL,
    \`inputSnapshotId\` varchar(128),
    \`sourceModel\` varchar(128) NOT NULL,
    \`modelVersion\` varchar(96) NOT NULL,
    \`originalStateJson\` text NOT NULL,
    \`originalInterpretation\` text,
    \`outcomeDefinition\` text,
    \`outcomeWindow\` varchar(128),
    \`sourceDataVersionsJson\` text NOT NULL,
    \`createdAt\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
  ) ENGINE=InnoDB`);
  await connection.query(`CREATE TABLE \`governedResearchResolutions\` (
    \`id\` int NOT NULL AUTO_INCREMENT PRIMARY KEY,
    \`resolutionKey\` varchar(220) NOT NULL UNIQUE,
    \`observationId\` int NOT NULL,
    \`resolutionVersion\` varchar(96) NOT NULL,
    \`outcomeValueJson\` text NOT NULL,
    \`resolvedAt\` timestamp NOT NULL,
    \`sourceDataVersionsJson\` text NOT NULL,
    \`createdAt\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT \`governedResearchResolutions_observation_fk\`
      FOREIGN KEY (\`observationId\`) REFERENCES \`governedResearchObservations\`(\`id\`) ON DELETE RESTRICT
  ) ENGINE=InnoDB`);
}

async function expectSqlState(operation: () => Promise<unknown>, sqlState: string): Promise<void> {
  try {
    await operation();
    throw new Error(`expected SQLSTATE ${sqlState}`);
  } catch (error) {
    const databaseError = error as { sqlState?: string };
    expect(databaseError.sqlState).toBe(sqlState);
  }
}

async function expectPermissionDenied(operation: () => Promise<unknown>): Promise<void> {
  try {
    await operation();
    throw new Error("restricted runtime user unexpectedly modified evidence");
  } catch (error) {
    const databaseError = error as { code?: string; errno?: number };
    expect(databaseError.code).toBe("ER_TABLEACCESS_DENIED_ERROR");
    expect(databaseError.errno).toBe(1142);
  }
}

async function runCli(command: string, argumentsList: string[], input?: string): Promise<string> {
  return await new Promise<string>((resolveRun, rejectRun) => {
    let stdout = "";
    let stderr = "";
    const child = spawn(command, argumentsList, { stdio: ["pipe", "pipe", "pipe"] });
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", chunk => {
      stdout += chunk;
    });
    child.stderr.on("data", chunk => {
      stderr += chunk;
    });
    child.once("error", rejectRun);
    child.once("exit", code => {
      if (code === 0) resolveRun(stdout);
      else rejectRun(new Error(`${command} exited ${code ?? "null"}: ${stderr}`));
    });
    child.stdin.end(input);
  });
}

describe("current migration journal and synthetic local recovery", () => {
  let maria: DisposableMariaDb;

  beforeAll(async () => {
    maria = await startDisposableMariaDb();
  }, 60_000);

  afterAll(async () => {
    await maria?.close();
  }, 60_000);

  async function createOwnedDatabase(label: string): Promise<OwnedDatabase> {
    const name = `${label}_${randomUUID().replaceAll("-", "")}`;
    return { name, connection: await maria.createDatabase(name) };
  }

  it("preserves every immutable prefix field and order while registering the complete current accepted tail", async () => {
    const journal = JSON.parse(await readFile(journalPath, "utf8")) as { entries: JournalEntry[] };
    expect(journal.entries).toHaveLength(84);
    expect(journal.entries.map(entry => entry.idx)).toEqual(Array.from({ length: 84 }, (_, idx) => idx));
    expect(createHash("sha256").update(JSON.stringify(journal.entries.slice(0, 77))).digest("hex"))
      .toBe(immutablePrefixSha256);
    expect(journal.entries.slice(76)).toEqual([
      { idx: 76, version: "5", when: 1792300000000, tag: "0076_algorithm_outcome_fk_name", breakpoints: true },
      { idx: 77, version: "5", when: 1793241851962, tag: "0077_governed_research_immutability", breakpoints: true },
      { idx: 78, version: "5", when: 1793270956094, tag: "0078_payment_event_linkage", breakpoints: true },
      { idx: 79, version: "5", when: 1793270956095, tag: "0079_decision_outcome_provenance", breakpoints: true },
      { idx: 80, version: "5", when: 1793270956096, tag: "0080_publishing_delivery_claims", breakpoints: true },
      { idx: 81, version: "5", when: 1793270956097, tag: "0081_admin_audit_events", breakpoints: true },
      { idx: 82, version: "5", when: 1793270956098, tag: "0082_durable_alert_events", breakpoints: true },
      { idx: 83, version: "5", when: 1793386577182, tag: "0083_auth_state_and_sessions", breakpoints: true },
    ]);
  });

  it("applies the current accepted tail on a fresh synthetic pre-tail schema and enforces new FK and append-only guards", async () => {
    const fresh = await createOwnedDatabase("journal_fresh");
    try {
      await createSyntheticPreTailSchema(fresh.connection);
      await applyCurrentTail(fresh.connection);
      const [tables] = await fresh.connection.query<Array<{ tableName: string }>>(
        `SELECT TABLE_NAME AS tableName FROM information_schema.TABLES
         WHERE TABLE_SCHEMA = DATABASE()
         AND TABLE_NAME IN ('stripePaymentOrigins', 'stripePaymentReversalEvents', 'decisionLedgerOutcomeProvenance', 'publishingRunClaims', 'publishingDeliveryClaims', 'adminAuditEvents', 'userAlertMonitorStates', 'userAlertEvents', 'userAlertEventAcknowledgements', 'oauthAuthorizationStates', 'authSessions')
         ORDER BY TABLE_NAME`
      );
      expect(tables.map(row => row.tableName)).toEqual([
        "adminAuditEvents",
        "authSessions",
        "decisionLedgerOutcomeProvenance",
        "oauthAuthorizationStates",
        "publishingDeliveryClaims",
        "publishingRunClaims",
        "stripePaymentOrigins",
        "stripePaymentReversalEvents",
        "userAlertEventAcknowledgements",
        "userAlertEvents",
        "userAlertMonitorStates",
      ]);
      await fresh.connection.query("INSERT INTO `users` (`id`, `openId`) VALUES (7, 'fresh-owner')");
      await fresh.connection.query(`INSERT INTO \`userAlertEvents\`
        (\`userId\`, \`eventKey\`, \`ruleId\`, \`transitionSequence\`, \`category\`, \`severity\`, \`metric\`, \`direction\`, \`threshold\`, \`observedValue\`, \`source\`, \`sourceObservedAt\`, \`dataFreshness\`, \`eventAt\`)
        VALUES (7, 'fresh-event', 'risk', 1, 'threshold_breach', 'high', 'pressure', 'above', 50, 55, 'synthetic', '2026-10-29 12:00:00', 'fresh', '2026-10-29 12:00:00')`);
      await expectSqlState(
        () => fresh.connection.query("UPDATE `userAlertEvents` SET `observedValue` = 56 WHERE `eventKey` = 'fresh-event'"),
        "45000"
      );
      await expectSqlState(
        () => fresh.connection.query("DELETE FROM `users` WHERE `id` = 7"),
        "23000"
      );
    } finally {
      await fresh.connection.end();
    }
  }, 60_000);

  it("upgrades a seeded synthetic legacy database, restores a local dump into a separate owned database, and applies only the new 0082 tail", async () => {
    const source = await createOwnedDatabase("journal_legacy_source");
    const restored = await createOwnedDatabase("journal_restored");
    const dumpDirectory = await mkdtemp(join(tmpdir(), "faultline-synthetic-recovery-"));
    const dumpPath = join(dumpDirectory, "legacy-current-tail.sql");
    const runtimeUser = `dbhr_${randomUUID().replaceAll("-", "").slice(0, 24)}`;
    const runtimePassword = randomUUID().replaceAll("-", "");
    const account = `'${runtimeUser}'@'127.0.0.1'`;
    let runtime: Connection | undefined;
    let userCreated = false;
    try {
      await createSyntheticPreTailSchema(source.connection);
      await source.connection.query("INSERT INTO `users` (`id`, `openId`) VALUES (7, 'legacy-owner')");
      await source.connection.query("INSERT INTO `decision_ledger` (`id`, `outcome`) VALUES (41, 'pending')");
      await source.connection.query(`INSERT INTO \`governedResearchObservations\`
        (\`observationKey\`, \`observationVersion\`, \`historyClass\`, \`observationDate\`, \`informationCutoff\`, \`sourceModel\`, \`modelVersion\`, \`originalStateJson\`, \`originalInterpretation\`, \`sourceDataVersionsJson\`)
        VALUES ('legacy-observation', 'v1', 'reconstructed_research', '2026-09-01 18:00:00', '2026-09-01 18:00:00', 'synthetic', 'v1', '{}', 'preserved legacy evidence', '{}')`);
      await source.connection.query(`INSERT INTO \`governedResearchResolutions\`
        (\`resolutionKey\`, \`observationId\`, \`resolutionVersion\`, \`outcomeValueJson\`, \`resolvedAt\`, \`sourceDataVersionsJson\`)
        VALUES ('legacy-resolution', 1, 'v1', '{"outcome":"recorded"}', '2026-10-01 18:00:00', '{}')`);

      for (const tag of migrationTags.slice(0, 5)) {
        await applyMigration(source.connection, tag);
      }
      await source.connection.query(`INSERT INTO \`stripePaymentOrigins\`
        (\`userId\`, \`stripePaymentIntentId\`, \`stripeChargeId\`, \`stripeCustomerId\`, \`amount\`, \`currency\`, \`livemode\`, \`sourceEventId\`, \`sourceEventCreated\`)
        VALUES (7, 'pi_synthetic_legacy', 'ch_synthetic_legacy', 'cus_synthetic_legacy', 9900, 'usd', false, 'evt_synthetic_legacy', 1793270956)`);
      await source.connection.query(`INSERT INTO \`stripePaymentReversalEvents\`
        (\`stripeEventId\`, \`stripeEventType\`, \`reversalKind\`, \`stripePaymentOriginId\`, \`userId\`, \`stripePaymentIntentId\`, \`stripeChargeId\`, \`stripeCustomerId\`, \`reversalAmount\`, \`currency\`, \`livemode\`, \`providerStatus\`, \`eventCreated\`)
        VALUES ('evt_reversal_synthetic', 'charge.refunded', 'refund', 1, 7, 'pi_synthetic_legacy', 'ch_synthetic_legacy', 'cus_synthetic_legacy', 9900, 'usd', false, 'succeeded', 1793270960)`);
      await source.connection.query(`INSERT INTO \`decisionLedgerOutcomeProvenance\`
        (\`provenanceKey\`, \`decisionLedgerId\`, \`provenanceVersion\`, \`evaluationState\`, \`sourceProvider\`, \`assetType\`, \`assetSymbol\`, \`originalIssuedAt\`, \`horizonAt\`, \`entryObservationAt\`, \`entryPrice\`, \`horizonObservationAt\`, \`horizonPrice\`, \`returnPct\`, \`outcome\`, \`receivedAt\`, \`reason\`, \`evidenceJson\`)
        VALUES ('legacy-receipt-41', 41, 'v1', 'verified', 'synthetic_backup', 'stock', 'NVDA', '2026-01-05 22:00:00', '2026-01-12 22:00:00', '2026-01-05 14:30:00', 100, '2026-01-12 14:30:00', 107, 7, 'correct', '2026-01-14 22:00:00', 'synthetic_recovery_check', '{"fixture":true}')`);
      await source.connection.query(`INSERT INTO \`adminAuditEvents\`
        (\`actorUserId\`, \`action\`, \`targetType\`, \`targetId\`, \`beforeStateJson\`, \`afterStateJson\`, \`outcome\`)
        VALUES (7, 'SYNTHETIC_LEGACY_EVIDENCE', 'synthetic', 41, '{}', '{}', 'SUCCEEDED')`);

      const dump = await runCli("/usr/bin/mysqldump", [
        "--no-defaults",
        "--protocol=TCP",
        `--host=${maria.host}`,
        `--port=${maria.port}`,
        "--user=root",
        "--skip-comments",
        "--single-transaction",
        source.name,
      ]);
      expect(dump).toContain("CREATE TABLE `decisionLedgerOutcomeProvenance`");
      expect(dump).toContain("INSERT INTO `adminAuditEvents`");
      await writeFile(dumpPath, dump, "utf8");

      await runCli("/usr/bin/mariadb", [
        "--no-defaults",
        "--protocol=TCP",
        `--host=${maria.host}`,
        `--port=${maria.port}`,
        "--user=root",
        restored.name,
      ], dump);
      await applyMigration(restored.connection, "0082_durable_alert_events");

      const [preserved] = await restored.connection.query<Array<{
        provenanceKey: string;
        sourceProvider: string;
        returnPct: number;
      }>>("SELECT `provenanceKey`, `sourceProvider`, `returnPct` FROM `decisionLedgerOutcomeProvenance`");
      expect(preserved).toEqual([{ provenanceKey: "legacy-receipt-41", sourceProvider: "synthetic_backup", returnPct: 7 }]);
      await expectSqlState(
        () => restored.connection.query("UPDATE `decisionLedgerOutcomeProvenance` SET `returnPct` = 99 WHERE `provenanceKey` = 'legacy-receipt-41'"),
        "45000"
      );
      await expectSqlState(
        () => restored.connection.query("DELETE FROM `decision_ledger` WHERE `id` = 41"),
        "23000"
      );
      await expectSqlState(
        () => restored.connection.query("UPDATE `governedResearchObservations` SET `originalInterpretation` = 'changed' WHERE `id` = 1"),
        "45000"
      );

      // Privileged setup creates the throwaway account. The local runtime account
      // is deliberately restricted to SELECT/INSERT and has no UPDATE/DELETE/DROP.
      await restored.connection.query(`CREATE USER ${account} IDENTIFIED BY '${runtimePassword}'`);
      userCreated = true;
      await restored.connection.query(`GRANT SELECT, INSERT ON \`${restored.name}\`.* TO ${account}`);
      const [grants] = await restored.connection.query<Array<Record<string, string>>>(`SHOW GRANTS FOR ${account}`);
      const grantsText = grants.map(grant => Object.values(grant).join(" ")).join(" ");
      expect(grantsText).toContain("GRANT SELECT, INSERT ON");
      expect(grantsText).not.toContain("UPDATE");
      expect(grantsText).not.toContain("DELETE");

      runtime = await mysql.createConnection({
        host: maria.host,
        port: maria.port,
        user: runtimeUser,
        password: runtimePassword,
        database: restored.name,
      });
      await runtime.query(`INSERT INTO \`userAlertEvents\`
        (\`userId\`, \`eventKey\`, \`ruleId\`, \`transitionSequence\`, \`category\`, \`severity\`, \`metric\`, \`direction\`, \`threshold\`, \`observedValue\`, \`source\`, \`sourceObservedAt\`, \`dataFreshness\`, \`eventAt\`)
        VALUES (7, 'restored-runtime-event', 'risk', 1, 'threshold_breach', 'high', 'pressure', 'above', 50, 55, 'synthetic', '2026-10-29 12:00:00', 'fresh', '2026-10-29 12:00:00')`);
      await expectPermissionDenied(
        () => runtime!.query("UPDATE `userAlertEvents` SET `observedValue` = 56 WHERE `eventKey` = 'restored-runtime-event'")
      );
      await expectPermissionDenied(
        () => runtime!.query("DELETE FROM `userAlertEvents` WHERE `eventKey` = 'restored-runtime-event'")
      );
      await expectSqlState(
        () => restored.connection.query("UPDATE `userAlertEvents` SET `observedValue` = 56 WHERE `eventKey` = 'restored-runtime-event'"),
        "45000"
      );
      await expectSqlState(
        () => restored.connection.query("DELETE FROM `users` WHERE `id` = 7"),
        "23000"
      );
    } finally {
      await runtime?.end();
      if (userCreated) await restored.connection.query(`DROP USER IF EXISTS ${account}`);
      await source.connection.end();
      await restored.connection.end();
      await rm(dumpDirectory, { recursive: true, force: true });
    }
  }, 60_000);
});
