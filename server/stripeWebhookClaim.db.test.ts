/**
 * Atomic Stripe webhook claims against a disposable local MariaDB.
 * No migration is applied. The table matches the existing stripeWebhookEvents
 * unique eventId constraint. Production URLs are refused.
 */
import { spawn, type ChildProcess } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createConnection, type Connection } from "mysql2/promise";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  closeDbForTests,
  commitStripeEntitlement,
  completeStripeWebhookEvent,
  entitlementAuditExists,
  getUserTier,
  recordStripeWebhookEvent,
  releaseStripeWebhookEvent,
  StaleStripeWebhookClaimError,
  UnfinishedStripeWebhookClaimError,
  writeEntitlementAudit,
} from "./db";

const PRODUCTION_URL = /prod|railway|getfaultline|amazonaws|planetscale/i;
const PORT = 3311;

function assertIsolated(url: string): void {
  if (!url || PRODUCTION_URL.test(url) || !/127\.0\.0\.1|localhost/.test(url)) {
    throw new Error("Refusing to run Stripe claim tests against a non-local database.");
  }
}

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

describe("stripe webhook claim concurrency", () => {
  let server: ChildProcess | null = null;
  let admin: Connection | null = null;
  const previousUrl = process.env.DATABASE_URL;
  const datadir = mkdtempSync(join(tmpdir(), "stripe-webhook-claim-"));
  const url = `mysql://root@127.0.0.1:${PORT}/stripe_webhook_claim`;

  beforeAll(async () => {
    assertIsolated(url);
    await new Promise<void>((resolve, reject) => {
      const install = spawn("mariadb-install-db", [
        "--datadir", datadir,
        "--auth-root-authentication-method=normal",
        "--skip-test-db",
      ], { stdio: "ignore" });
      install.on("error", reject);
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
    server.on("error", () => {});
    admin = await waitForMysql();
    await admin.query("CREATE DATABASE stripe_webhook_claim");
    await admin.query("USE stripe_webhook_claim");
    await admin.query(`CREATE TABLE stripeWebhookEvents (
      id int NOT NULL AUTO_INCREMENT PRIMARY KEY,
      eventId varchar(128) NOT NULL,
      eventType varchar(128) NOT NULL,
      processedAt timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY stripeWebhookEvents_eventId_uniq (eventId)
    )`);
    await admin.query(`CREATE TABLE users (
      id int NOT NULL AUTO_INCREMENT PRIMARY KEY,
      openId varchar(64) NOT NULL,
      accessTier enum('free','core','premium','founding') NOT NULL DEFAULT 'free',
      stripeCustomerId varchar(64) NULL,
      stripeSubscriptionId varchar(64) NULL,
      lifetimeAccess tinyint NOT NULL DEFAULT 0,
      lifetimePurchasedAt timestamp NULL,
      updatedAt timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`);
    await admin.query(`CREATE TABLE entitlementAuditLog (
      id int NOT NULL AUTO_INCREMENT PRIMARY KEY,
      userId int NOT NULL,
      fromTier varchar(32),
      toTier varchar(32) NOT NULL,
      reason varchar(128) NOT NULL,
      stripeEventId varchar(128),
      stripeCustomerId varchar(64),
      stripeSubscriptionId varchar(64),
      createdAt timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`);
    process.env.DATABASE_URL = url;
    closeDbForTests();
  }, 60_000);

  afterAll(async () => {
    closeDbForTests();
    if (previousUrl === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = previousUrl;
    await admin?.end();
    if (server && !server.killed) server.kill("SIGTERM");
  });

  beforeEach(async () => {
    process.env.DATABASE_URL = url;
    closeDbForTests();
    await admin!.query("DELETE FROM stripeWebhookEvents");
    await admin!.query("DELETE FROM entitlementAuditLog");
    await admin!.query("DELETE FROM users");
  });

  async function claimRow(eventId: string) {
    const [rows] = await admin!.query(
      "SELECT eventId, eventType, processedAt FROM stripeWebhookEvents WHERE eventId = ?",
      [eventId],
    ) as unknown as [Array<{ eventId: string; eventType: string; processedAt: Date }>];
    return rows[0];
  }

  it("lets exactly one of two concurrent first deliveries claim a new event", async () => {
    const results = await Promise.allSettled([
      recordStripeWebhookEvent("evt_concurrent_insert", "invoice.paid"),
      recordStripeWebhookEvent("evt_concurrent_insert", "invoice.paid"),
    ]);
    const granted = results.filter(result => result.status === "fulfilled" && result.value && typeof result.value === "object");
    const unfinished = results.filter(result => result.status === "rejected");
    expect(granted).toHaveLength(1);
    expect(unfinished).toHaveLength(1);
    expect((unfinished[0] as PromiseRejectedResult).reason).toBeInstanceOf(UnfinishedStripeWebhookClaimError);
    const row = await claimRow("evt_concurrent_insert");
    expect(row.eventType.startsWith("pending:")).toBe(true);
    expect(row.eventType.endsWith(":invoice.paid")).toBe(true);
  });

  it("lets exactly one of two concurrent deliveries reclaim an unfinished claim", async () => {
    const first = await recordStripeWebhookEvent("evt_concurrent_reclaim", "checkout.session.completed");
    expect(first?.attemptId).toMatch(/^[0-9a-f]{16}$/);
    await admin!.query(
      "UPDATE stripeWebhookEvents SET processedAt = DATE_SUB(NOW(), INTERVAL 91 SECOND) WHERE eventId = ?",
      ["evt_concurrent_reclaim"],
    );

    const results = await Promise.allSettled([
      recordStripeWebhookEvent("evt_concurrent_reclaim", "checkout.session.completed"),
      recordStripeWebhookEvent("evt_concurrent_reclaim", "checkout.session.completed"),
    ]);
    const reclaimed = results.filter(result => result.status === "fulfilled" && result.value && typeof result.value === "object");
    const unfinished = results.filter(result => result.status === "rejected");
    expect(reclaimed).toHaveLength(1);
    expect(unfinished).toHaveLength(1);
    expect((unfinished[0] as PromiseRejectedResult).reason).toBeInstanceOf(UnfinishedStripeWebhookClaimError);

    const row = await claimRow("evt_concurrent_reclaim");
    expect(row.eventType.startsWith("processing:")).toBe(true);
    expect(row.eventType.endsWith(":checkout.session.completed")).toBe(true);
    const winner = (reclaimed[0] as PromiseFulfilledResult<{ attemptId: string }>).value;
    expect(row.eventType).toContain(winner.attemptId);
    await expect(recordStripeWebhookEvent("evt_concurrent_reclaim", "checkout.session.completed"))
      .rejects.toBeInstanceOf(UnfinishedStripeWebhookClaimError);

    await completeStripeWebhookEvent("evt_concurrent_reclaim", "checkout.session.completed", winner.attemptId);
    expect(await recordStripeWebhookEvent("evt_concurrent_reclaim", "checkout.session.completed")).toBeNull();
    await completeStripeWebhookEvent("evt_concurrent_reclaim", "checkout.session.completed", winner.attemptId);
    expect((await claimRow("evt_concurrent_reclaim")).eventType).toBe("checkout.session.completed");
  });

  it("does not delete a completed claim, and a zero-row complete throws", async () => {
    const kept = await recordStripeWebhookEvent("evt_complete_keep", "invoice.paid");
    await completeStripeWebhookEvent("evt_complete_keep", "invoice.paid", kept!.attemptId);
    await releaseStripeWebhookEvent("evt_complete_keep", kept!.attemptId, "invoice.paid");
    expect(await recordStripeWebhookEvent("evt_complete_keep", "invoice.paid")).toBeNull();

    await expect(completeStripeWebhookEvent("evt_missing", "invoice.paid", "a1b2c3d4e5f67890"))
      .rejects.toThrow("Stripe webhook claim evt_missing was not retained");

    const wrong = await recordStripeWebhookEvent("evt_wrong_type", "invoice.paid");
    await expect(completeStripeWebhookEvent("evt_wrong_type", "customer.subscription.deleted", wrong!.attemptId))
      .rejects.toBeInstanceOf(StaleStripeWebhookClaimError);
    expect((await claimRow("evt_wrong_type")).eventType).toContain(wrong!.attemptId);
  });

  it("releases only an unfinished claim so a later delivery can process it", async () => {
    const released = await recordStripeWebhookEvent("evt_release", "invoice.paid");
    await releaseStripeWebhookEvent("evt_release", released!.attemptId, "invoice.paid");
    expect(await claimRow("evt_release")).toBeUndefined();
    expect(await recordStripeWebhookEvent("evt_release", "invoice.paid")).toMatchObject({ attemptId: expect.stringMatching(/^[0-9a-f]{16}$/) });
  });

  it("stops a stale attempt from writing, completing, or releasing after reclaim", async () => {
    await admin!.query(
      "INSERT INTO users (openId, accessTier, stripeSubscriptionId, lifetimeAccess) VALUES ('user-stale', 'premium', 'sub_stale', 0)",
    );
    const [users] = await admin!.query("SELECT id FROM users WHERE openId = 'user-stale'") as unknown as [Array<{ id: number }>];
    const userId = users[0].id;
    const original = await recordStripeWebhookEvent("evt_stale_fence", "invoice.paid");
    await admin!.query(
      "UPDATE stripeWebhookEvents SET processedAt = DATE_SUB(NOW(), INTERVAL 91 SECOND) WHERE eventId = ?",
      ["evt_stale_fence"],
    );
    const reclaimed = await recordStripeWebhookEvent("evt_stale_fence", "invoice.paid");
    expect(reclaimed?.attemptId).not.toBe(original!.attemptId);

    await expect(completeStripeWebhookEvent("evt_stale_fence", "invoice.paid", original!.attemptId))
      .rejects.toBeInstanceOf(StaleStripeWebhookClaimError);
    await expect(releaseStripeWebhookEvent("evt_stale_fence", original!.attemptId, "invoice.paid"))
      .rejects.toBeInstanceOf(StaleStripeWebhookClaimError);
    expect((await claimRow("evt_stale_fence")).eventType).toContain(reclaimed!.attemptId);

    const lost = await commitStripeEntitlement({
      eventId: "evt_stale_fence",
      eventType: "invoice.paid",
      attemptId: original!.attemptId,
      userId,
      patch: { accessTier: "founding", stripeSubscriptionId: "sub_stale" },
      audit: { fromTier: "premium", toTier: "founding", reason: "invoice.paid", stripeSubscriptionId: "sub_stale" },
    });
    expect(lost).toBe("claim_lost");
    const [unchanged] = await admin!.query(
      "SELECT accessTier, stripeSubscriptionId FROM users WHERE id = ?",
      [userId],
    ) as unknown as [Array<{ accessTier: string; stripeSubscriptionId: string }>];
    expect(unchanged[0]).toEqual({ accessTier: "premium", stripeSubscriptionId: "sub_stale" });

    const applied = await commitStripeEntitlement({
      eventId: "evt_stale_fence",
      eventType: "invoice.paid",
      attemptId: reclaimed!.attemptId,
      userId,
      patch: { accessTier: "premium", stripeSubscriptionId: "sub_stale" },
      audit: { fromTier: "premium", toTier: "premium", reason: "invoice.paid", stripeSubscriptionId: "sub_stale" },
    });
    expect(applied).toBe("applied");
    expect((await claimRow("evt_stale_fence")).eventType).toBe("invoice.paid");
    expect(await entitlementAuditExists("evt_stale_fence")).toBe(true);
  });

  it("revokes only when lifetimeAccess is false and the subscription id still matches", async () => {
    await admin!.query(
      "INSERT INTO users (openId, accessTier, stripeSubscriptionId, lifetimeAccess) VALUES ('match', 'premium', 'sub_match', 0), ('life', 'founding', 'sub_life', 1), ('moved', 'premium', 'sub_other', 0)",
    );
    const [rows] = await admin!.query(
      "SELECT id, openId FROM users ORDER BY id",
    ) as unknown as [Array<{ id: number; openId: string }>];
    const idOf = (openId: string) => rows.find(row => row.openId === openId)!.id;

    const match = await recordStripeWebhookEvent("evt_revoke_match", "customer.subscription.deleted");
    expect(await commitStripeEntitlement({
      eventId: "evt_revoke_match",
      eventType: "customer.subscription.deleted",
      attemptId: match!.attemptId,
      userId: idOf("match"),
      revokeSubscriptionId: "sub_match",
      audit: { fromTier: "premium", toTier: "free", reason: "customer.subscription.deleted", stripeSubscriptionId: "sub_match" },
    })).toBe("applied");
    const [downgraded] = await admin!.query("SELECT accessTier, stripeSubscriptionId, lifetimeAccess FROM users WHERE openId = 'match'") as unknown as [Array<{ accessTier: string; stripeSubscriptionId: string | null; lifetimeAccess: number }>];
    expect(downgraded[0].accessTier).toBe("free");
    expect(downgraded[0].stripeSubscriptionId).toBeNull();

    const life = await recordStripeWebhookEvent("evt_revoke_life", "customer.subscription.deleted");
    expect(await commitStripeEntitlement({
      eventId: "evt_revoke_life",
      eventType: "customer.subscription.deleted",
      attemptId: life!.attemptId,
      userId: idOf("life"),
      revokeSubscriptionId: "sub_life",
      audit: { fromTier: "founding", toTier: "free", reason: "customer.subscription.deleted", stripeSubscriptionId: "sub_life" },
    })).toBe("revoke_skipped");
    const [lifetime] = await admin!.query("SELECT accessTier, stripeSubscriptionId, lifetimeAccess FROM users WHERE openId = 'life'") as unknown as [Array<{ accessTier: string; stripeSubscriptionId: string; lifetimeAccess: number }>];
    expect(lifetime[0].accessTier).toBe("founding");
    expect(lifetime[0].stripeSubscriptionId).toBe("sub_life");
    expect(Number(lifetime[0].lifetimeAccess)).toBe(1);
    expect(await getUserTier(idOf("life"))).toBe("founding");

    const moved = await recordStripeWebhookEvent("evt_revoke_moved", "customer.subscription.updated");
    expect(await commitStripeEntitlement({
      eventId: "evt_revoke_moved",
      eventType: "customer.subscription.updated",
      attemptId: moved!.attemptId,
      userId: idOf("moved"),
      revokeSubscriptionId: "sub_old",
      audit: { fromTier: "premium", toTier: "free", reason: "customer.subscription.updated:canceled", stripeSubscriptionId: "sub_old" },
    })).toBe("revoke_skipped");
    const [still] = await admin!.query("SELECT accessTier, stripeSubscriptionId FROM users WHERE openId = 'moved'") as unknown as [Array<{ accessTier: string; stripeSubscriptionId: string }>];
    expect(still[0]).toEqual({ accessTier: "premium", stripeSubscriptionId: "sub_other" });
  });

  it("rolls back the user write when the audit insert fails", async () => {
    await admin!.query(
      "INSERT INTO users (openId, accessTier, stripeSubscriptionId, lifetimeAccess) VALUES ('rollback', 'free', NULL, 0)",
    );
    const [users] = await admin!.query("SELECT id FROM users WHERE openId = 'rollback'") as unknown as [Array<{ id: number }>];
    const attempt = await recordStripeWebhookEvent("evt_rollback", "invoice.paid");
    await expect(commitStripeEntitlement({
      eventId: "evt_rollback",
      eventType: "invoice.paid",
      attemptId: attempt!.attemptId,
      userId: users[0].id,
      patch: { accessTier: "premium", stripeSubscriptionId: "sub_rollback" },
      audit: { fromTier: "free", toTier: "premium", reason: "x".repeat(200), stripeSubscriptionId: "sub_rollback" },
    })).rejects.toThrow();
    const [user] = await admin!.query("SELECT accessTier, stripeSubscriptionId FROM users WHERE openId = 'rollback'") as unknown as [Array<{ accessTier: string; stripeSubscriptionId: string | null }>];
    expect(user[0]).toEqual({ accessTier: "free", stripeSubscriptionId: null });
    expect((await claimRow("evt_rollback")).eventType).toContain(attempt!.attemptId);
    expect(await entitlementAuditExists("evt_rollback")).toBe(false);
    expect(await getUserTier(users[0].id)).toBe("free");
  });

  it("records an entitlement audit the webhook can see on a replay", async () => {
    expect(await entitlementAuditExists("evt_audit_row")).toBe(false);
    await writeEntitlementAudit({
      userId: 1,
      fromTier: "free",
      toTier: "premium",
      reason: "invoice.paid",
      stripeEventId: "evt_audit_row",
      strict: true,
    });
    expect(await entitlementAuditExists("evt_audit_row")).toBe(true);
  });
});
