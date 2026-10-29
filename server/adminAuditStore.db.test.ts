/**
 * Direct SQL proof for owner/admin audit persistence. This suite owns a unique
 * disposable MariaDB datadir and port through the shared harness; it never
 * reads DATABASE_URL or contacts a provider.
 */
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { drizzle } from "drizzle-orm/mysql2";
import mysql, { type Pool } from "mysql2/promise";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  AdminAuditAmbiguousResultError,
  AdminAuditGuardError,
  AdminAuditPersistenceError,
  AdminAuditStore,
} from "./adminAuditStore";
import { startDisposableMariaDb, type DisposableMariaDb } from "./testing/disposableMariaDb";

const MIGRATION = readFileSync(resolve(import.meta.dirname, "..", "drizzle", "0081_admin_audit_events.sql"), "utf8");

function migrationStatements(sql: string): string[] {
  return sql
    .split("--> statement-breakpoint")
    .map(chunk => chunk.split("\n").filter(line => !line.trim().startsWith("--")).join("\n").trim())
    .filter(Boolean);
}

async function expectAppendOnlyBlock(query: string): Promise<void> {
  try {
    await connection!.query(query);
    throw new Error(`append-only guard unexpectedly allowed: ${query}`);
  } catch (error) {
    const sqlError = error as { sqlState?: string; message?: string };
    expect(sqlError.sqlState).toBe("45000");
    expect(sqlError.message ?? "").toMatch(/append-only/);
  }
}

let disposable: DisposableMariaDb | undefined;
let connection: Awaited<ReturnType<DisposableMariaDb["createDatabase"]>> | undefined;
let pool: Pool | undefined;
let store: AdminAuditStore;

beforeEach(async () => {
  disposable = await startDisposableMariaDb();
  const database = `owner_audit_${randomUUID().replaceAll("-", "")}`;
  connection = await disposable.createDatabase(database);
  await connection.query(`CREATE TABLE \`users\` (
    \`id\` int NOT NULL AUTO_INCREMENT PRIMARY KEY,
    \`openId\` varchar(64) NOT NULL UNIQUE,
    \`role\` enum('user','admin') NOT NULL DEFAULT 'user',
    \`accessTier\` enum('free','core','premium','founding') NOT NULL DEFAULT 'free',
    \`lifetimeAccess\` boolean NOT NULL DEFAULT false,
    \`accessExpiresAt\` timestamp NULL,
    \`entitlementRevision\` int NOT NULL DEFAULT 0,
    \`updatedAt\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
  ) ENGINE=InnoDB`);
  await connection.query(`CREATE TABLE \`featureFlags\` (
    \`id\` int NOT NULL AUTO_INCREMENT PRIMARY KEY,
    \`key\` varchar(80) NOT NULL UNIQUE,
    \`enabled\` int NOT NULL DEFAULT 1,
    \`description\` text,
    \`updatedBy\` int,
    \`updatedAt\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
    \`createdAt\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
  ) ENGINE=InnoDB`);
  await connection.query(`CREATE TABLE \`foundingAccessRequests\` (
    \`id\` int NOT NULL AUTO_INCREMENT PRIMARY KEY,
    \`userId\` int,
    \`email\` varchar(320) NOT NULL,
    \`name\` varchar(200),
    \`message\` text,
    \`status\` enum('pending','approved','rejected') NOT NULL DEFAULT 'pending',
    \`createdAt\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
    \`updatedAt\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
  ) ENGINE=InnoDB`);
  await connection.query("CREATE TABLE `positions` (`id` int NOT NULL AUTO_INCREMENT PRIMARY KEY, `userId` int NOT NULL) ENGINE=InnoDB");
  await connection.query("CREATE TABLE `cryptoWatchlist` (`id` int NOT NULL AUTO_INCREMENT PRIMARY KEY, `userId` int NOT NULL) ENGINE=InnoDB");
  await connection.query("CREATE TABLE `mobileWatchlist` (`id` int NOT NULL AUTO_INCREMENT PRIMARY KEY, `userId` int NOT NULL) ENGINE=InnoDB");
  await connection.query(`CREATE TABLE \`shadowStressAnnotations\` (
    \`id\` int NOT NULL AUTO_INCREMENT PRIMARY KEY,
    \`eventAt\` timestamp NOT NULL,
    \`eventType\` varchar(50) NOT NULL,
    \`title\` varchar(200) NOT NULL,
    \`description\` text,
    \`severity\` enum('low','moderate','high','critical') NOT NULL,
    \`v1AtEvent\` int,
    \`v3hAtEvent\` int,
    \`v1RegimeAtEvent\` varchar(50),
    \`v3hRegimeAtEvent\` varchar(50),
    \`createdBy\` int NOT NULL,
    \`createdAt\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
  ) ENGINE=InnoDB`);
  for (const statement of migrationStatements(MIGRATION)) await connection.query(statement);

  await connection.query("INSERT INTO `users` (`id`, `openId`, `role`, `accessTier`, `lifetimeAccess`) VALUES (1, 'owner-a', 'admin', 'free', false), (2, 'subscriber-b', 'user', 'free', false), (3, 'owner-c', 'admin', 'free', false)");
  await connection.query("INSERT INTO `featureFlags` (`key`, `enabled`) VALUES ('safe_feature', 1)");
  await connection.query("INSERT INTO `foundingAccessRequests` (`id`, `userId`, `email`, `name`, `status`) VALUES (7, 2, 'fixture@example.test', 'Fixture', 'pending')");

  pool = mysql.createPool({
    host: disposable.host,
    port: disposable.port,
    user: "root",
    database,
    timezone: "Z",
    connectionLimit: 4,
  });
  const db = drizzle(pool);
  store = new AdminAuditStore(async () => db as never);
}, 60_000);

afterEach(async () => {
  const ownedPool = pool;
  const ownedConnection = connection;
  const ownedDisposable = disposable;
  pool = undefined;
  connection = undefined;
  disposable = undefined;
  try {
    await ownedPool?.end();
  } finally {
    try {
      await ownedConnection?.end();
    } finally {
      await ownedDisposable?.close();
    }
  }
}, 60_000);

describe("owner/admin durable audit store", () => {
  it("registers the accepted migration with SQL append-only guards", async () => {
    expect(MIGRATION.startsWith("-- REGISTERED / ACCEPTED WAVE-2 INTEGRATION")).toBe(true);
    expect(migrationStatements(MIGRATION)).toHaveLength(3);
    const journal = JSON.parse(readFileSync(resolve(import.meta.dirname, "..", "drizzle", "meta", "_journal.json"), "utf8")) as {
      entries: Array<{ idx: number; version: string; when: number; tag: string; breakpoints: boolean }>;
    };
    expect(journal.entries.find(entry => entry.tag === "0081_admin_audit_events")).toEqual({
      idx: 81,
      version: "5",
      when: 1793270956097,
      tag: "0081_admin_audit_events",
      breakpoints: true,
    });

    await store.setFeatureFlag({ actorUserId: 1, key: "safe_feature", enabled: false });
    const [rows] = await connection!.query<Array<{ id: number; beforeStateJson: string; afterStateJson: string; targetKey: string | null }>>(
      "SELECT `id`, `beforeStateJson`, `afterStateJson`, `targetKey` FROM `adminAuditEvents` ORDER BY `id`",
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ targetKey: "safe_feature" });
    expect(JSON.parse(rows[0]!.beforeStateJson)).toEqual({ enabled: true });
    expect(JSON.parse(rows[0]!.afterStateJson)).toEqual({ enabled: false });
    expect(`${rows[0]!.beforeStateJson}${rows[0]!.afterStateJson}`).not.toMatch(/email|name|secret|token|credential/i);

    await expectAppendOnlyBlock("UPDATE `adminAuditEvents` SET `outcome` = 'FAILED' WHERE `id` = 1");
    await expectAppendOnlyBlock("DELETE FROM `adminAuditEvents` WHERE `id` = 1");
  });

  it("serializes concurrent feature-control writes into a truthful before/after chain", async () => {
    // This seed is part of this test's own chain; it must not depend on the
    // migration/guard test having run first.
    await store.setFeatureFlag({ actorUserId: 1, key: "safe_feature", enabled: false });
    await Promise.all([
      store.setFeatureFlag({ actorUserId: 1, key: "safe_feature", enabled: true }),
      store.setFeatureFlag({ actorUserId: 3, key: "safe_feature", enabled: false }),
    ]);
    const [events] = await connection!.query<Array<{ beforeStateJson: string; afterStateJson: string; actorUserId: number }>>(
      "SELECT `beforeStateJson`, `afterStateJson`, `actorUserId` FROM `adminAuditEvents` WHERE `action` = 'FEATURE_FLAG_UPDATED' ORDER BY `id`",
    );
    expect(events).toHaveLength(3);
    let prior = true;
    for (const event of events) {
      const before = JSON.parse(event.beforeStateJson) as { enabled: boolean };
      const after = JSON.parse(event.afterStateJson) as { enabled: boolean };
      expect(before.enabled).toBe(prior);
      prior = after.enabled;
    }
    const [flagRows] = await connection!.query<Array<{ enabled: number }>>("SELECT `enabled` FROM `featureFlags` WHERE `key` = 'safe_feature'");
    expect(Boolean(flagRows[0]!.enabled)).toBe(prior);
    expect(events.slice(-2).map(event => event.actorUserId).sort()).toEqual([1, 3]);
  });

  it("rolls back the target mutation when audit persistence fails", async () => {
    await connection!.query(`CREATE TRIGGER \`adminAuditEvents_test_insert_failure\`
      BEFORE INSERT ON \`adminAuditEvents\`
      FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'test audit insert failure'`);
    try {
      await expect(store.setFeatureFlag({ actorUserId: 1, key: "safe_feature", enabled: false }))
        .rejects.toBeInstanceOf(AdminAuditPersistenceError);
      const [rows] = await connection!.query<Array<{ enabled: number }>>("SELECT `enabled` FROM `featureFlags` WHERE `key` = 'safe_feature'");
      expect(Boolean(rows[0]!.enabled)).toBe(true);
    } finally {
      await connection!.query("DROP TRIGGER IF EXISTS `adminAuditEvents_test_insert_failure`");
    }
  });

  it("records safe subscriber/admin outcomes, correlated approval email attempt/result evidence, and preserves removal guards", async () => {
    await store.setUserTier({ actorUserId: 1, userId: 2, tier: "premium", lifetimeAccess: true });
    await store.updateFoundingRequestStatus({ actorUserId: 1, requestId: 7, status: "approved" });
    await store.addStressAnnotation({
      actorUserId: 1,
      eventAt: "2026-10-29T12:00:00.000Z",
      eventType: "market_stress",
      title: "Never retained in audit evidence",
      description: "Sensitive free text never reaches the event record.",
      severity: "high",
      v1AtEvent: 55,
      v3hAtEvent: 61,
    });
    const attempt = await store.prepareApprovalEmailAttempt({ actorUserId: 1, requestId: 7 });
    await store.recordApprovalEmailResult({
      actorUserId: 1,
      requestId: 7,
      correlationId: attempt.correlationId,
      accepted: true,
    });
    await expect(store.removeUser({ actorUserId: 1, userId: 1 })).rejects.toEqual(expect.any(AdminAuditGuardError));
    await expect(store.removeUser({ actorUserId: 1, userId: 3 })).rejects.toEqual(expect.any(AdminAuditGuardError));
    await store.removeUser({ actorUserId: 1, userId: 2 });

    const page = await store.list({ limit: 50 });
    const events = page.events;
    expect(events.map(event => event.action)).toEqual(expect.arrayContaining([
      "USER_TIER_UPDATED",
      "FOUNDING_REQUEST_STATUS_UPDATED",
      "STRESS_ANNOTATION_CREATED",
      "FOUNDING_APPROVAL_EMAIL_ATTEMPTED",
      "FOUNDING_APPROVAL_EMAIL_RESULT_RECORDED",
      "USER_REMOVED",
    ]));
    const stress = events.find(event => event.action === "STRESS_ANNOTATION_CREATED")!;
    expect(stress.after).toEqual({
      eventAt: "2026-10-29T12:00:00.000Z",
      eventType: "market_stress",
      severity: "high",
      v1AtEvent: 55,
      v3hAtEvent: 61,
      hasDescription: true,
    });
    const emailAttempt = events.find(event => event.action === "FOUNDING_APPROVAL_EMAIL_ATTEMPTED")!;
    const emailResult = events.find(event => event.action === "FOUNDING_APPROVAL_EMAIL_RESULT_RECORDED")!;
    expect(emailAttempt).toMatchObject({
      targetType: "founding_access_request",
      targetId: 7,
      outcome: "ATTEMPTED",
      before: { approvalStatus: "approved" },
      after: { dispatchIntent: "approval_email", dispatchStatus: "attempt_recorded" },
    });
    expect(emailResult).toMatchObject({
      targetType: "founding_access_request",
      targetId: 7,
      correlationId: emailAttempt.correlationId,
      outcome: "SUCCEEDED",
      after: { adapterResult: "accepted", deliveryClaimed: false },
    });
    expect(emailAttempt.correlationId).toMatch(/^[0-9a-f-]{36}$/i);
    expect(JSON.stringify(events)).not.toContain("fixture@example.test");
    expect(JSON.stringify(events)).not.toContain("Fixture");
    expect(JSON.stringify(events)).not.toContain("Never retained in audit evidence");
    const [deleted] = await connection!.query<Array<{ id: number }>>("SELECT `id` FROM `users` WHERE `id` = 2");
    expect(deleted).toEqual([]);
  });

  it("uses an actual locked request claim to block concurrent or ambiguous approval-email retries", async () => {
    await connection!.query("INSERT INTO `foundingAccessRequests` (`id`, `email`, `name`, `status`) VALUES (8, 'second-fixture@example.test', 'Second Fixture', 'approved')");

    const claims = await Promise.allSettled([
      store.prepareApprovalEmailAttempt({ actorUserId: 1, requestId: 8 }),
      store.prepareApprovalEmailAttempt({ actorUserId: 3, requestId: 8 }),
    ]);
    const fulfilled = claims.filter((claim): claim is PromiseFulfilledResult<Awaited<ReturnType<typeof store.prepareApprovalEmailAttempt>>> => claim.status === "fulfilled");
    const rejected = claims.filter((claim): claim is PromiseRejectedResult => claim.status === "rejected");
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect(rejected[0]!.reason).toBeInstanceOf(AdminAuditAmbiguousResultError);
    const attempt = fulfilled[0]!.value;

    const [attemptRows] = await connection!.query<Array<{ action: string; actorUserId: number; correlationId: string | null; outcome: string }>>(
      "SELECT `action`, `actorUserId`, `correlationId`, `outcome` FROM `adminAuditEvents` WHERE `targetId` = 8 ORDER BY `id`",
    );
    expect(attemptRows).toEqual([{
      action: "FOUNDING_APPROVAL_EMAIL_ATTEMPTED",
      actorUserId: expect.any(Number),
      correlationId: attempt.correlationId,
      outcome: "ATTEMPTED",
    }]);
    const winningActorUserId = attemptRows[0]!.actorUserId;

    await connection!.query(`CREATE TRIGGER \`adminAuditEvents_result_insert_failure\`
      BEFORE INSERT ON \`adminAuditEvents\`
      FOR EACH ROW
      BEGIN
        IF NEW.\`action\` = 'FOUNDING_APPROVAL_EMAIL_RESULT_RECORDED' THEN
          SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'test result append failure';
        END IF;
      END`);
    try {
      await expect(store.recordApprovalEmailResult({
        actorUserId: winningActorUserId,
        requestId: 8,
        correlationId: attempt.correlationId,
        accepted: true,
      })).rejects.toBeInstanceOf(AdminAuditPersistenceError);
    } finally {
      await connection!.query("DROP TRIGGER IF EXISTS `adminAuditEvents_result_insert_failure`");
    }

    await expect(store.prepareApprovalEmailAttempt({ actorUserId: winningActorUserId, requestId: 8 }))
      .rejects.toMatchObject({ correlationId: attempt.correlationId });
    await store.recordApprovalEmailResult({
      actorUserId: winningActorUserId,
      requestId: 8,
      correlationId: attempt.correlationId,
      accepted: true,
    });
    await expect(store.prepareApprovalEmailAttempt({ actorUserId: winningActorUserId, requestId: 8 }))
      .rejects.toMatchObject({ code: "CONFLICT" });

    const firstPage = await store.list({ limit: 1 });
    expect(firstPage.events).toHaveLength(1);
    expect(firstPage.nextBeforeId).toBeTypeOf("number");
    const olderPage = await store.list({ limit: 1, beforeId: firstPage.nextBeforeId! });
    expect(olderPage.events[0]!.id).toBeLessThan(firstPage.events[0]!.id);
  });
});
