/**
 * Atomic Stripe webhook claims against a disposable local MariaDB.
 * No migration is applied. Tables mirror drizzle/0074_stripe_entitlement_resync.sql,
 * which is not applied to any shared database. Production URLs are refused.
 */
import { spawn, type ChildProcess } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createConnection, type Connection } from "mysql2/promise";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  closeDbForTests,
  commitEntitlementResync,
  completeStripeWebhookEvent,
  entitlementAuditExists,
  getAllUsersWithTier,
  getUserTier,
  listStripeCancellationMarkers,
  recordStripeWebhookEvent,
  releaseStripeWebhookEvent,
  setUserTier,
  StaleStripeWebhookClaimError,
  UnfinishedStripeWebhookClaimError,
  upsertStripeCancellationMarker,
  writeEntitlementAudit,
  ZeroRowEntitlementWriteError,
} from "./db";

type ResyncParams = Parameters<typeof commitEntitlementResync>[0];
function resync(
  overrides: Omit<ResyncParams, "observedRevision" | "observedMarkers" | "markerSubscriptionIds"> &
    Partial<Pick<ResyncParams, "observedRevision" | "observedMarkers" | "markerSubscriptionIds">>,
) {
  return commitEntitlementResync({
    observedRevision: 0,
    observedMarkers: [],
    markerSubscriptionIds: [],
    ...overrides,
  });
}

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
      "--default-time-zone=+00:00",
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
      accessExpiresAt timestamp NULL,
      entitlementRevision int NOT NULL DEFAULT 0,
      name text NULL,
      email varchar(320) NULL,
      role enum('user','admin') NOT NULL DEFAULT 'user',
      createdAt timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
      lastSignedIn timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`);
    await admin.query(`CREATE TABLE stripeSubscriptionCancellations (
      id int NOT NULL AUTO_INCREMENT PRIMARY KEY,
      stripeSubscriptionId varchar(64) NOT NULL,
      canceledEventCreated bigint NOT NULL,
      status varchar(32) NOT NULL,
      sourceEventId varchar(128) NOT NULL,
      userId int NULL,
      supersededEventCreated bigint NULL,
      createdAt timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY stripeSubscriptionCancellations_sub_uniq (stripeSubscriptionId)
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
    await admin!.query("DELETE FROM stripeSubscriptionCancellations");
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

    const lost = await resync({
      eventId: "evt_stale_fence",
      eventType: "invoice.paid",
      attemptId: original!.attemptId,
      userId,
      desired: { accessTier: "founding", stripeSubscriptionId: "sub_stale", grantLifetime: false, lifetimePurchasedAt: null, accessExpiresAt: null },
      audit: { fromTier: "premium", toTier: "founding", reason: "invoice.paid", stripeSubscriptionId: "sub_stale" },
    });
    expect(lost).toBe("claim_lost");
    const [unchanged] = await admin!.query(
      "SELECT accessTier, stripeSubscriptionId FROM users WHERE id = ?",
      [userId],
    ) as unknown as [Array<{ accessTier: string; stripeSubscriptionId: string }>];
    expect(unchanged[0]).toEqual({ accessTier: "premium", stripeSubscriptionId: "sub_stale" });

    const applied = await resync({
      eventId: "evt_stale_fence",
      eventType: "invoice.paid",
      attemptId: reclaimed!.attemptId,
      userId,
      desired: { accessTier: "premium", stripeSubscriptionId: "sub_stale", grantLifetime: false, lifetimePurchasedAt: null, accessExpiresAt: new Date("2027-01-01T00:00:00Z") },
      audit: { fromTier: "premium", toTier: "premium", reason: "invoice.paid", stripeSubscriptionId: "sub_stale" },
    });
    expect(applied).toBe("applied");
    expect((await claimRow("evt_stale_fence")).eventType).toBe("invoice.paid");
    expect(await entitlementAuditExists("evt_stale_fence")).toBe(true);
  });

  it("keeps lifetime access when a subscription resync would otherwise write free", async () => {
    await admin!.query(
      "INSERT INTO users (openId, accessTier, stripeSubscriptionId, lifetimeAccess) VALUES ('match', 'premium', 'sub_match', 0), ('life', 'free', 'sub_life', 1)",
    );
    const [rows] = await admin!.query("SELECT id, openId FROM users ORDER BY id") as unknown as [Array<{ id: number; openId: string }>];
    const idOf = (openId: string) => rows.find(row => row.openId === openId)!.id;
    const desired = { accessTier: "free" as const, stripeSubscriptionId: null, grantLifetime: false, lifetimePurchasedAt: null, accessExpiresAt: null };

    const match = await recordStripeWebhookEvent("evt_revoke_match", "customer.subscription.deleted");
    expect(await resync({
      eventId: "evt_revoke_match",
      eventType: "customer.subscription.deleted",
      attemptId: match!.attemptId,
      userId: idOf("match"),
      desired,
      audit: { fromTier: "premium", toTier: "free", reason: "customer.subscription.deleted", stripeSubscriptionId: "sub_match" },
    })).toBe("applied");
    const [downgraded] = await admin!.query("SELECT accessTier, stripeSubscriptionId, lifetimeAccess FROM users WHERE openId = 'match'") as unknown as [Array<{ accessTier: string; stripeSubscriptionId: string | null; lifetimeAccess: number }>];
    expect(downgraded[0].accessTier).toBe("free");
    expect(downgraded[0].stripeSubscriptionId).toBeNull();

    const life = await recordStripeWebhookEvent("evt_revoke_life", "customer.subscription.deleted");
    expect(await resync({
      eventId: "evt_revoke_life",
      eventType: "customer.subscription.deleted",
      attemptId: life!.attemptId,
      userId: idOf("life"),
      desired,
      audit: { fromTier: "free", toTier: "free", reason: "customer.subscription.deleted", stripeSubscriptionId: "sub_life" },
    })).toBe("applied");
    const [lifetime] = await admin!.query("SELECT accessTier, stripeSubscriptionId, lifetimeAccess FROM users WHERE openId = 'life'") as unknown as [Array<{ accessTier: string; stripeSubscriptionId: string | null; lifetimeAccess: number }>];
    expect(lifetime[0].accessTier).toBe("founding");
    expect(lifetime[0].stripeSubscriptionId).toBeNull();
    expect(Number(lifetime[0].lifetimeAccess)).toBe(1);
    expect(await getUserTier(idOf("life"))).toBe("founding");
  });

  it("high 1: a missing user is a zero-row write and does not seal the claim", async () => {
    const attempt = await recordStripeWebhookEvent("evt_missing_user", "invoice.paid");
    await expect(resync({
      eventId: "evt_missing_user",
      eventType: "invoice.paid",
      attemptId: attempt!.attemptId,
      userId: 999999,
      desired: { accessTier: "premium", stripeSubscriptionId: "sub_x", grantLifetime: false, lifetimePurchasedAt: null, accessExpiresAt: new Date("2027-01-01T00:00:00Z") },
      audit: { fromTier: "free", toTier: "premium", reason: "invoice.paid" },
    })).rejects.toBeInstanceOf(ZeroRowEntitlementWriteError);
    expect((await claimRow("evt_missing_user")).eventType).toContain(attempt!.attemptId);
    expect(await entitlementAuditExists("evt_missing_user")).toBe(false);
  });

  it("keeps a cancellation marker monotonic against an older event", async () => {
    await upsertStripeCancellationMarker({
      stripeSubscriptionId: "sub_mark", canceledEventCreated: 200, status: "canceled", sourceEventId: "evt_new", userId: 1,
    });
    await upsertStripeCancellationMarker({
      stripeSubscriptionId: "sub_mark", canceledEventCreated: 100, status: "paused", sourceEventId: "evt_old", userId: 1,
    });
    const markers = await listStripeCancellationMarkers(["sub_mark"]);
    expect(markers).toEqual([expect.objectContaining({ canceledEventCreated: 200, status: "canceled", stripeSubscriptionId: "sub_mark" })]);
    await upsertStripeCancellationMarker({
      stripeSubscriptionId: "sub_mark", canceledEventCreated: 300, status: "paused", sourceEventId: "evt_pause", userId: 1,
    });
    expect(await listStripeCancellationMarkers(["sub_mark"])).toEqual([
      expect.objectContaining({ canceledEventCreated: 300, status: "paused" }),
    ]);
  });

  it("rolls back the user write when the audit insert fails", async () => {
    await admin!.query(
      "INSERT INTO users (openId, accessTier, stripeSubscriptionId, lifetimeAccess) VALUES ('rollback', 'free', NULL, 0)",
    );
    const [users] = await admin!.query("SELECT id FROM users WHERE openId = 'rollback'") as unknown as [Array<{ id: number }>];
    const attempt = await recordStripeWebhookEvent("evt_rollback", "invoice.paid");
    await expect(resync({
      eventId: "evt_rollback",
      eventType: "invoice.paid",
      attemptId: attempt!.attemptId,
      userId: users[0].id,
      desired: { accessTier: "premium", stripeSubscriptionId: "sub_rollback", grantLifetime: false, lifetimePurchasedAt: null, accessExpiresAt: new Date("2027-01-01T00:00:00Z") },
      audit: { fromTier: "free", toTier: "premium", reason: "x".repeat(200), stripeSubscriptionId: "sub_rollback" },
    })).rejects.toThrow();
    const [user] = await admin!.query("SELECT accessTier, stripeSubscriptionId FROM users WHERE openId = 'rollback'") as unknown as [Array<{ accessTier: string; stripeSubscriptionId: string | null }>];
    expect(user[0]).toEqual({ accessTier: "free", stripeSubscriptionId: null });
    expect((await claimRow("evt_rollback")).eventType).toContain(attempt!.attemptId);
    expect(await entitlementAuditExists("evt_rollback")).toBe(false);
    expect(await getUserTier(users[0].id)).toBe("free");
  });

  it("does not seal a grant computed against a stale revision or a cancellation that landed later", async () => {
    await admin!.query(
      "INSERT INTO users (openId, accessTier, lifetimeAccess, entitlementRevision) VALUES ('cas', 'free', 0, 0)",
    );
    const [users] = await admin!.query("SELECT id FROM users WHERE openId = 'cas'") as unknown as [Array<{ id: number }>];
    const userId = users[0].id;
    const staleRevision = await recordStripeWebhookEvent("evt_stale_revision", "invoice.paid");
    await admin!.query("UPDATE users SET entitlementRevision = 1 WHERE id = ?", [userId]);
    expect(await resync({
      eventId: "evt_stale_revision",
      eventType: "invoice.paid",
      attemptId: staleRevision!.attemptId,
      userId,
      observedRevision: 0,
      desired: { accessTier: "premium", stripeSubscriptionId: "sub_cas", grantLifetime: false, lifetimePurchasedAt: null, accessExpiresAt: new Date("2027-06-01T00:00:00Z"), stripeCustomerId: "cus_cas" },
      audit: { fromTier: "free", toTier: "premium", reason: "invoice.paid" },
    })).toBe("stale_state");
    const [unchanged] = await admin!.query("SELECT accessTier, stripeCustomerId, entitlementRevision FROM users WHERE id = ?", [userId]) as unknown as [Array<{ accessTier: string; stripeCustomerId: string | null; entitlementRevision: number }>];
    expect(unchanged[0]).toEqual({ accessTier: "free", stripeCustomerId: null, entitlementRevision: 1 });
    expect((await claimRow("evt_stale_revision")).eventType).toContain(staleRevision!.attemptId);

    const staleMarker = await recordStripeWebhookEvent("evt_stale_marker", "invoice.paid");
    await upsertStripeCancellationMarker({
      stripeSubscriptionId: "sub_cas", canceledEventCreated: 500, status: "canceled", sourceEventId: "evt_cancel_cas", userId,
    });
    expect(await resync({
      eventId: "evt_stale_marker",
      eventType: "invoice.paid",
      attemptId: staleMarker!.attemptId,
      userId,
      observedRevision: 1,
      observedMarkers: [],
      markerSubscriptionIds: ["sub_cas"],
      desired: { accessTier: "premium", stripeSubscriptionId: "sub_cas", grantLifetime: false, lifetimePurchasedAt: null, accessExpiresAt: new Date("2027-06-01T00:00:00Z") },
      audit: { fromTier: "free", toTier: "premium", reason: "invoice.paid" },
    })).toBe("stale_state");
    expect((await claimRow("evt_stale_marker")).eventType).toContain(staleMarker!.attemptId);
    expect((await admin!.query("SELECT accessTier FROM users WHERE id = ?", [userId]) as unknown as [Array<{ accessTier: string }>])[0][0].accessTier).toBe("free");
  });

  it("lets one of two concurrent commits win and leaves the loser unsealed", async () => {
    await admin!.query(
      "INSERT INTO users (openId, accessTier, lifetimeAccess) VALUES ('race', 'free', 0)",
    );
    const [users] = await admin!.query("SELECT id FROM users WHERE openId = 'race'") as unknown as [Array<{ id: number }>];
    const userId = users[0].id;
    const first = await recordStripeWebhookEvent("evt_race_a", "invoice.paid");
    const second = await recordStripeWebhookEvent("evt_race_b", "invoice.paid");
    const desired = { accessTier: "premium" as const, stripeSubscriptionId: "sub_race", grantLifetime: false, lifetimePurchasedAt: null, accessExpiresAt: new Date("2027-06-01T00:00:00Z"), stripeCustomerId: "cus_race" };
    const results = await Promise.all([
      resync({
        eventId: "evt_race_a", eventType: "invoice.paid", attemptId: first!.attemptId, userId, observedRevision: 0, desired,
        audit: { fromTier: "free", toTier: "premium", reason: "invoice.paid", stripeCustomerId: "cus_race" },
      }),
      resync({
        eventId: "evt_race_b", eventType: "invoice.paid", attemptId: second!.attemptId, userId, observedRevision: 0,
        desired: { ...desired, accessTier: "core", stripeSubscriptionId: "sub_race_b" },
        audit: { fromTier: "free", toTier: "core", reason: "invoice.paid" },
      }),
    ]);
    expect(results.filter(result => result === "applied")).toHaveLength(1);
    expect(results.filter(result => result === "stale_state")).toHaveLength(1);
    const [row] = await admin!.query("SELECT accessTier, stripeCustomerId, entitlementRevision FROM users WHERE id = ?", [userId]) as unknown as [Array<{ accessTier: string; stripeCustomerId: string; entitlementRevision: number }>];
    expect(["premium", "core"]).toContain(row[0].accessTier);
    expect(row[0].stripeCustomerId).toBe("cus_race");
    expect(Number(row[0].entitlementRevision)).toBe(1);
    const sealed = results[0] === "applied" ? "evt_race_a" : "evt_race_b";
    const open = sealed === "evt_race_a" ? "evt_race_b" : "evt_race_a";
    expect((await claimRow(sealed)).eventType).not.toContain(":");
    expect((await claimRow(open)).eventType).toContain(":");
  });

  it("does not overwrite a stored customer or seal a free downgrade from an unbound customer", async () => {
    await admin!.query(
      "INSERT INTO users (openId, accessTier, stripeCustomerId, stripeSubscriptionId, lifetimeAccess) VALUES ('bound', 'premium', 'cus_paid', 'sub_paid', 0)",
    );
    const [users] = await admin!.query("SELECT id FROM users WHERE openId = 'bound'") as unknown as [Array<{ id: number }>];
    const userId = users[0].id;
    const attempt = await recordStripeWebhookEvent("evt_second_customer", "checkout.session.completed");
    expect(await resync({
      eventId: "evt_second_customer",
      eventType: "checkout.session.completed",
      attemptId: attempt!.attemptId,
      userId,
      desired: {
        accessTier: "free",
        stripeSubscriptionId: null,
        grantLifetime: false,
        lifetimePurchasedAt: null,
        accessExpiresAt: null,
        stripeCustomerId: "cus_new",
      },
      audit: { fromTier: "premium", toTier: "free", reason: "checkout.session.completed", stripeCustomerId: "cus_new" },
    })).toBe("customer_conflict");
    const [row] = await admin!.query(
      "SELECT accessTier, stripeCustomerId, stripeSubscriptionId, entitlementRevision FROM users WHERE id = ?",
      [userId],
    ) as unknown as [Array<{ accessTier: string; stripeCustomerId: string; stripeSubscriptionId: string; entitlementRevision: number }>];
    expect(row[0]).toEqual({
      accessTier: "premium",
      stripeCustomerId: "cus_paid",
      stripeSubscriptionId: "sub_paid",
      entitlementRevision: 0,
    });
    expect((await claimRow("evt_second_customer")).eventType).toContain(attempt!.attemptId);
    expect(await entitlementAuditExists("evt_second_customer")).toBe(true);
  });

  it("persists a customer id without clearing it on a later write that omits it", async () => {
    await admin!.query("INSERT INTO users (openId, accessTier, lifetimeAccess) VALUES ('cus', 'free', 0)");
    const [users] = await admin!.query("SELECT id FROM users WHERE openId = 'cus'") as unknown as [Array<{ id: number }>];
    const userId = users[0].id;
    const first = await recordStripeWebhookEvent("evt_cus_1", "checkout.session.completed");
    expect(await resync({
      eventId: "evt_cus_1", eventType: "checkout.session.completed", attemptId: first!.attemptId, userId,
      desired: { accessTier: "premium", stripeSubscriptionId: "sub_cus", grantLifetime: false, lifetimePurchasedAt: null, accessExpiresAt: new Date("2027-06-01T00:00:00Z"), stripeCustomerId: "cus_persist" },
      audit: { fromTier: "free", toTier: "premium", reason: "checkout.session.completed" },
    })).toBe("applied");
    const second = await recordStripeWebhookEvent("evt_cus_2", "invoice.paid");
    expect(await resync({
      eventId: "evt_cus_2", eventType: "invoice.paid", attemptId: second!.attemptId, userId, observedRevision: 1,
      desired: { accessTier: "premium", stripeSubscriptionId: "sub_cus", grantLifetime: false, lifetimePurchasedAt: null, accessExpiresAt: new Date("2027-07-01T00:00:00Z") },
      audit: { fromTier: "premium", toTier: "premium", reason: "invoice.paid" },
    })).toBe("applied");
    const [row] = await admin!.query("SELECT stripeCustomerId FROM users WHERE id = ?", [userId]) as unknown as [Array<{ stripeCustomerId: string }>];
    expect(row[0].stripeCustomerId).toBe("cus_persist");
  });

  it("supersedes a pause on resume and lets a newer cancellation clear that supersession", async () => {
    await admin!.query("INSERT INTO users (openId, accessTier, lifetimeAccess) VALUES ('resume', 'free', 0)");
    const [users] = await admin!.query("SELECT id FROM users WHERE openId = 'resume'") as unknown as [Array<{ id: number }>];
    const userId = users[0].id;
    await upsertStripeCancellationMarker({
      stripeSubscriptionId: "sub_resume", canceledEventCreated: 200, status: "paused", sourceEventId: "evt_pause_resume", userId,
    });
    const attempt = await recordStripeWebhookEvent("evt_resume_apply", "customer.subscription.updated");
    expect(await resync({
      eventId: "evt_resume_apply",
      eventType: "customer.subscription.updated",
      attemptId: attempt!.attemptId,
      userId,
      observedMarkers: [{ stripeSubscriptionId: "sub_resume", canceledEventCreated: 200, status: "paused", supersededEventCreated: null }],
      markerSubscriptionIds: ["sub_resume"],
      supersedeCancellation: { stripeSubscriptionId: "sub_resume", eventCreated: 250 },
      desired: { accessTier: "premium", stripeSubscriptionId: "sub_resume", grantLifetime: false, lifetimePurchasedAt: null, accessExpiresAt: new Date("2027-08-01T00:00:00Z") },
      audit: { fromTier: "free", toTier: "premium", reason: "customer.subscription.updated" },
    })).toBe("applied");
    expect(await listStripeCancellationMarkers(["sub_resume"])).toEqual([
      expect.objectContaining({ canceledEventCreated: 200, status: "paused", supersededEventCreated: 250 }),
    ]);
    await upsertStripeCancellationMarker({
      stripeSubscriptionId: "sub_resume", canceledEventCreated: 100, status: "canceled", sourceEventId: "evt_old_cancel", userId,
    });
    expect(await listStripeCancellationMarkers(["sub_resume"])).toEqual([
      expect.objectContaining({ canceledEventCreated: 200, supersededEventCreated: 250 }),
    ]);
    await upsertStripeCancellationMarker({
      stripeSubscriptionId: "sub_resume", canceledEventCreated: 300, status: "canceled", sourceEventId: "evt_new_cancel", userId,
    });
    expect(await listStripeCancellationMarkers(["sub_resume"])).toEqual([
      expect.objectContaining({ canceledEventCreated: 300, status: "canceled", supersededEventCreated: null }),
    ]);
  });

  it("lets admin set and revoke lifetime so the effective tier matches", async () => {
    await admin!.query("INSERT INTO users (openId, accessTier, lifetimeAccess) VALUES ('admin-tier', 'free', 1)");
    const [users] = await admin!.query("SELECT id FROM users WHERE openId = 'admin-tier'") as unknown as [Array<{ id: number }>];
    const userId = users[0].id;
    expect(await getUserTier(userId)).toBe("founding");
    await setUserTier(userId, "premium");
    expect(await getUserTier(userId)).toBe("founding");
    await setUserTier(userId, "core", false);
    expect(await getUserTier(userId)).toBe("core");
    await setUserTier(userId, "premium", true);
    expect(await getUserTier(userId)).toBe("founding");
    await setUserTier(userId, "free");
    expect(await getUserTier(userId)).toBe("free");
    const listed = await getAllUsersWithTier();
    expect(listed.find(row => row.id === userId)).toMatchObject({ lifetimeAccess: false, effectiveTier: "free", accessTier: "free" });
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
