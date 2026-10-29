import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { drizzle } from "drizzle-orm/mysql2";
import { createConnection, type Connection } from "mysql2/promise";
import {
  DELIVERY_CLAIM_LEASE_MS,
  DELIVERY_RETRY_DELAY_MS,
  PUBLISH_RUN_LEASE_MS,
  PUBLISH_RUN_RETRY_DELAY_MS,
  createPublishingClaimStore,
  dispatchEmailWithClaim,
  type PublishingClaimStore,
} from "./publishingDeliveryClaims";
import { startDisposableMariaDb, type DisposableMariaDb } from "./testing/disposableMariaDb";

let maria: DisposableMariaDb;
let admin: Connection;

async function connection(): Promise<Connection> {
  return await createConnection({ host: maria.host, port: maria.port, user: "root", database: "publishing_claims" });
}

function storeFor(conn: Connection) {
  const db = drizzle(conn);
  return createPublishingClaimStore(async () => db as never);
}

async function createClaimTables(conn: Connection): Promise<void> {
  await conn.query(`CREATE TABLE publishingRunClaims (
    id int NOT NULL AUTO_INCREMENT PRIMARY KEY,
    runKey varchar(160) NOT NULL,
    publishType varchar(32) NOT NULL,
    cycleDateEt varchar(10) NOT NULL,
    state enum('claimed','generating','completed','failed','exhausted') NOT NULL,
    attemptId varchar(32) NOT NULL,
    attempt int NOT NULL,
    leaseExpiresAt timestamp NULL,
    retryAfter timestamp NULL,
    outputStatus varchar(16) NULL,
    outputSlug varchar(220) NULL,
    failureReason varchar(255) NULL,
    completedAt timestamp NULL,
    createdAt timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updatedAt timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY publishingRunClaims_runKey_uniq (runKey),
    KEY publishingRunClaims_state_retry_idx (state, retryAfter)
  )`);
  await conn.query(`CREATE TABLE publishingDeliveryClaims (
    id int NOT NULL AUTO_INCREMENT PRIMARY KEY,
    deliveryKey varchar(220) NOT NULL,
    deliveryType varchar(48) NOT NULL,
    userId int NOT NULL,
    state enum('claimed','dispatching','accepted','rejected','skipped','exhausted','ambiguous') NOT NULL,
    attemptId varchar(32) NOT NULL,
    attempt int NOT NULL,
    leaseExpiresAt timestamp NULL,
    retryAfter timestamp NULL,
    providerAcceptedAt timestamp NULL,
    failureReason varchar(255) NULL,
    createdAt timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updatedAt timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY publishingDeliveryClaims_deliveryKey_uniq (deliveryKey),
    KEY publishingDeliveryClaims_state_retry_idx (state, retryAfter),
    KEY publishingDeliveryClaims_user_delivery_idx (userId, deliveryType)
  )`);
}

async function row(table: "publishingRunClaims" | "publishingDeliveryClaims", keyColumn: string, key: string) {
  const [rows] = await admin.query(`SELECT * FROM ${table} WHERE ${keyColumn} = ?`, [key]) as [Array<Record<string, unknown>>];
  return rows[0];
}

describe("durable publishing and delivery claims (disposable MariaDB)", () => {
  beforeAll(async () => {
    maria = await startDisposableMariaDb();
    admin = await maria.createDatabase("publishing_claims");
    await createClaimTables(admin);
  }, 60_000);

  afterAll(async () => {
    await maria?.close();
  });

  beforeEach(async () => {
    await admin.query("DELETE FROM publishingDeliveryClaims");
    await admin.query("DELETE FROM publishingRunClaims");
  });

  it("uses the unique run key to admit one overlap, recovers only before generation, and exhausts bounded failures", async () => {
    const left = await connection();
    const right = await connection();
    const leftStore = storeFor(left);
    const rightStore = storeFor(right);
    const now = Date.parse("2026-10-29T15:00:00.000Z");
    const input = { publishType: "daily_brief", cycleDateEt: "2026-10-29", nowMs: now };
    const results = await Promise.all([leftStore.claimRun(input), rightStore.claimRun(input)]);
    const winnerIndex = results.findIndex(result => result.status === "claimed");
    expect(winnerIndex).not.toBe(-1);
    expect(results.filter(result => result.status === "claimed")).toHaveLength(1);
    expect(results.filter(result => result.status === "in-progress")).toHaveLength(1);
    expect(await row("publishingRunClaims", "runKey", "daily_brief:2026-10-29")).toMatchObject({
      state: "claimed",
      attempt: 1,
    });

    const winningStore = winnerIndex === 0 ? leftStore : rightStore;
    const winningClaim = results[winnerIndex] as Extract<typeof results[number], { status: "claimed" }>;
    expect(await winningStore.beginGeneration(winningClaim.claim, now + 1)).toBe(true);
    await left.end();
    await right.end();

    // A restart after the lease cannot regenerate: the LLM boundary was crossed.
    const restarted = await connection();
    const restartStore = storeFor(restarted);
    await expect(restartStore.claimRun({ ...input, nowMs: now + PUBLISH_RUN_LEASE_MS + 1 }))
      .resolves.toEqual({ status: "ambiguous" });
    await restarted.end();

    const initialConn = await connection();
    const recoveryConn = await connection();
    const initialStore = storeFor(initialConn);
    const recoveryStore = storeFor(recoveryConn);
    const first = await initialStore.claimRun({ publishType: "weekly_review", cycleDateEt: "2026-10-29", nowMs: now });
    expect(first.status).toBe("claimed");
    await initialConn.end();
    const recovered = await recoveryStore.claimRun({
      publishType: "weekly_review",
      cycleDateEt: "2026-10-29",
      nowMs: now + PUBLISH_RUN_LEASE_MS + 1,
    });
    expect(recovered).toMatchObject({ status: "claimed", mode: "recovered", claim: { attempt: 2 } });
    const recoveredClaim = recovered as Extract<typeof recovered, { status: "claimed" }>;
    expect(await recoveryStore.failRunBeforeGeneration(recoveredClaim.claim, "source-unavailable", now + PUBLISH_RUN_LEASE_MS + 2)).toBe(true);
    await expect(recoveryStore.claimRun({
      publishType: "weekly_review",
      cycleDateEt: "2026-10-29",
      nowMs: now + PUBLISH_RUN_LEASE_MS + PUBLISH_RUN_RETRY_DELAY_MS + 3,
    })).resolves.toEqual({ status: "exhausted" });
    expect(await row("publishingRunClaims", "runKey", "weekly_review:2026-10-29")).toMatchObject({ state: "exhausted", attempt: 2 });
    await recoveryConn.end();
  }, 60_000);

  it("calls the mocked transport once under overlap, records provider acceptance, and never retries ambiguous acceptance", async () => {
    const firstConn = await connection();
    const secondConn = await connection();
    const firstStore = storeFor(firstConn);
    const secondStore = storeFor(secondConn);
    const now = Date.parse("2026-10-29T16:00:00.000Z");
    let sendCalls = 0;
    let release: (() => void) | undefined;
    const sent = new Promise<void>(resolve => { release = resolve; });
    let unblock: (() => void) | undefined;
    const blocked = new Promise<void>(resolve => { unblock = resolve; });
    const input = {
      deliveryKey: "onboarding:1:user:42",
      deliveryType: "onboarding_day_1",
      userId: 42,
      nowMs: now,
    };
    const first = dispatchEmailWithClaim(firstStore, {
      ...input,
      send: async () => {
        sendCalls += 1;
        release?.();
        await blocked;
        return { success: true };
      },
    });
    await sent;
    const overlapping = await dispatchEmailWithClaim(secondStore, {
      ...input,
      send: async () => {
        sendCalls += 1;
        return { success: true };
      },
    });
    expect(overlapping).toEqual({ status: "ambiguous" });
    expect(sendCalls).toBe(1);
    unblock?.();
    await expect(first).resolves.toEqual({ status: "accepted" });
    expect(await row("publishingDeliveryClaims", "deliveryKey", input.deliveryKey)).toMatchObject({ state: "accepted" });
    await firstConn.end();
    await secondConn.end();

    const laterConn = await connection();
    const laterStore = storeFor(laterConn);
    await expect(dispatchEmailWithClaim(laterStore, {
      ...input,
      nowMs: now + DELIVERY_CLAIM_LEASE_MS + 1,
      send: async () => {
        throw new Error("must not dispatch an accepted delivery again");
      },
    })).resolves.toEqual({ status: "completed" });
    await laterConn.end();

    const faultConn = await connection();
    const durableStore = storeFor(faultConn);
    const faultInput = { ...input, deliveryKey: "onboarding:2:user:42", deliveryType: "onboarding_day_2", nowMs: now };
    const acceptanceWriteFails: PublishingClaimStore = {
      ...durableStore,
      markDeliveryAccepted: async () => false,
    };
    await expect(dispatchEmailWithClaim(acceptanceWriteFails, {
      ...faultInput,
      send: async () => ({ success: true }),
    })).resolves.toEqual({ status: "ambiguous" });
    expect(await row("publishingDeliveryClaims", "deliveryKey", faultInput.deliveryKey)).toMatchObject({ state: "dispatching" });
    await faultConn.end();

    const afterAmbiguousConn = await connection();
    const afterAmbiguousStore = storeFor(afterAmbiguousConn);
    await expect(dispatchEmailWithClaim(afterAmbiguousStore, {
      ...faultInput,
      nowMs: now + DELIVERY_CLAIM_LEASE_MS + 1,
      send: async () => {
        throw new Error("must not retry an accepted-but-unrecorded transport");
      },
    })).resolves.toEqual({ status: "ambiguous" });
    await afterAmbiguousConn.end();
  }, 60_000);

  it("retries only explicit provider rejections and caps the third rejection", async () => {
    const conn = await connection();
    const store = storeFor(conn);
    const now = Date.parse("2026-10-29T17:00:00.000Z");
    const base = { deliveryKey: "brief:daily-brief-2026-10-29:user:9", deliveryType: "subscriber_daily_brief", userId: 9 };
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      const result = await dispatchEmailWithClaim(store, {
        ...base,
        nowMs: now + (attempt - 1) * (DELIVERY_RETRY_DELAY_MS + 1),
        send: async () => ({ success: false, error: "provider-explicit-rejection" }),
      });
      expect(result.status).toBe(attempt === 3 ? "exhausted" : "rejected");
    }
    expect(await row("publishingDeliveryClaims", "deliveryKey", base.deliveryKey)).toMatchObject({ state: "exhausted", attempt: 3 });
    await conn.end();
  }, 60_000);
});
