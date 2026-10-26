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
  completeStripeWebhookEvent,
  entitlementAuditExists,
  recordStripeWebhookEvent,
  releaseStripeWebhookEvent,
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
    const granted = results.filter(result => result.status === "fulfilled" && result.value === true);
    const unfinished = results.filter(result => result.status === "rejected");
    expect(granted).toHaveLength(1);
    expect(unfinished).toHaveLength(1);
    expect((unfinished[0] as PromiseRejectedResult).reason).toBeInstanceOf(UnfinishedStripeWebhookClaimError);
    expect((await claimRow("evt_concurrent_insert")).eventType).toBe("pending:invoice.paid");
  });

  it("lets exactly one of two concurrent deliveries reclaim an unfinished claim", async () => {
    expect(await recordStripeWebhookEvent("evt_concurrent_reclaim", "checkout.session.completed")).toBe(true);
    await admin!.query(
      "UPDATE stripeWebhookEvents SET processedAt = DATE_SUB(NOW(), INTERVAL 91 SECOND) WHERE eventId = ?",
      ["evt_concurrent_reclaim"],
    );

    const results = await Promise.allSettled([
      recordStripeWebhookEvent("evt_concurrent_reclaim", "checkout.session.completed"),
      recordStripeWebhookEvent("evt_concurrent_reclaim", "checkout.session.completed"),
    ]);
    const reclaimed = results.filter(result => result.status === "fulfilled" && result.value === true);
    const unfinished = results.filter(result => result.status === "rejected");
    expect(reclaimed).toHaveLength(1);
    expect(unfinished).toHaveLength(1);
    expect((unfinished[0] as PromiseRejectedResult).reason).toBeInstanceOf(UnfinishedStripeWebhookClaimError);

    const row = await claimRow("evt_concurrent_reclaim");
    expect(row.eventType).toBe("processing:checkout.session.completed");
    await expect(recordStripeWebhookEvent("evt_concurrent_reclaim", "checkout.session.completed"))
      .rejects.toBeInstanceOf(UnfinishedStripeWebhookClaimError);

    await completeStripeWebhookEvent("evt_concurrent_reclaim", "checkout.session.completed");
    expect(await recordStripeWebhookEvent("evt_concurrent_reclaim", "checkout.session.completed")).toBe(false);
    await completeStripeWebhookEvent("evt_concurrent_reclaim", "checkout.session.completed");
    expect((await claimRow("evt_concurrent_reclaim")).eventType).toBe("checkout.session.completed");
  });

  it("does not delete a completed claim, and a zero-row complete throws", async () => {
    expect(await recordStripeWebhookEvent("evt_complete_keep", "invoice.paid")).toBe(true);
    await completeStripeWebhookEvent("evt_complete_keep", "invoice.paid");
    await releaseStripeWebhookEvent("evt_complete_keep");
    expect(await recordStripeWebhookEvent("evt_complete_keep", "invoice.paid")).toBe(false);

    await expect(completeStripeWebhookEvent("evt_missing", "invoice.paid"))
      .rejects.toThrow("Stripe webhook claim evt_missing was not retained");

    expect(await recordStripeWebhookEvent("evt_wrong_type", "invoice.paid")).toBe(true);
    await expect(completeStripeWebhookEvent("evt_wrong_type", "customer.subscription.deleted"))
      .rejects.toThrow("was not retained");
    expect((await claimRow("evt_wrong_type")).eventType).toBe("pending:invoice.paid");
  });

  it("releases only an unfinished claim so a later delivery can process it", async () => {
    expect(await recordStripeWebhookEvent("evt_release", "invoice.paid")).toBe(true);
    await releaseStripeWebhookEvent("evt_release");
    expect(await claimRow("evt_release")).toBeUndefined();
    expect(await recordStripeWebhookEvent("evt_release", "invoice.paid")).toBe(true);
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
