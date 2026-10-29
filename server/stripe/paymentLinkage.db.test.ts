/**
 * Direct SQL proof for the reserved BILL-07 payment-linkage migration.
 *
 * This test starts an identity-verified, credential-free MariaDB owned by this
 * process. It never applies 0078 to a shared or deployed database and does not
 * contact Stripe. The fixtures are synthetic evidence only.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import mysql from "mysql2/promise";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  startDisposableMariaDb,
  type DisposableMariaDb,
} from "../testing/disposableMariaDb";

const root = resolve(import.meta.dirname, "../..");
const database = "billing_linkage_isolated";

function migrationStatements(): string[] {
  return readFileSync(
    resolve(root, "drizzle/0078_payment_event_linkage.sql"),
    "utf8",
  )
    .split("--> statement-breakpoint")
    .map(chunk => chunk
      .split("\n")
      .filter(line => !line.trim().startsWith("--"))
      .join("\n")
      .trim())
    .filter(Boolean);
}

function originValues(suffix: string, checkoutSessionId: string | null = `cs_${suffix}`): unknown[] {
  return [
    7,
    checkoutSessionId,
    `pi_${suffix}`,
    `ch_${suffix}`,
    "cus_synthetic",
    150_000,
    "usd",
    false,
    `evt_origin_${suffix}`,
    1_700_000_000,
  ];
}

const insertOriginSql = `
  INSERT INTO stripePaymentOrigins (
    userId, stripeCheckoutSessionId, stripePaymentIntentId, stripeChargeId,
    stripeCustomerId, amount, currency, livemode, sourceEventId, sourceEventCreated
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`;

function reversalValues(suffix: string, originId: number, state = "policy_pending"): unknown[] {
  return [
    `evt_reversal_${suffix}`,
    "refund.created",
    "refund",
    `re_${suffix}`,
    originId,
    7,
    `cs_${suffix}`,
    `pi_${suffix}`,
    `ch_${suffix}`,
    "cus_synthetic",
    25_000,
    "usd",
    false,
    "succeeded",
    1_700_000_100,
    state,
  ];
}

const insertReversalSql = `
  INSERT INTO stripePaymentReversalEvents (
    stripeEventId, stripeEventType, reversalKind, providerObjectId,
    stripePaymentOriginId, userId, stripeCheckoutSessionId,
    stripePaymentIntentId, stripeChargeId, stripeCustomerId, reversalAmount,
    currency, livemode, providerStatus, eventCreated, reconciliationState
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`;

type OriginRow = { id: number; stripeCheckoutSessionId: string | null };

async function originId(connection: mysql.Connection, suffix: string): Promise<number> {
  const [rows] = await connection.query(
    "SELECT id FROM stripePaymentOrigins WHERE sourceEventId = ?",
    [`evt_origin_${suffix}`],
  ) as unknown as [OriginRow[]];
  if (!rows[0]) throw new Error(`Synthetic origin ${suffix} was not inserted.`);
  return Number(rows[0].id);
}

function settledCounts(results: PromiseSettledResult<unknown>[]) {
  return {
    fulfilled: results.filter(result => result.status === "fulfilled"),
    rejected: results.filter(result => result.status === "rejected"),
  };
}

describe("0078 payment linkage SQL integrity", () => {
  let maria: DisposableMariaDb;
  let connection: mysql.Connection;

  beforeAll(async () => {
    maria = await startDisposableMariaDb();
    connection = await maria.createDatabase(database);
    for (const statement of migrationStatements()) {
      await connection.query(statement);
    }
  }, 60_000);

  afterAll(async () => {
    await connection?.end();
    await maria?.close();
  }, 60_000);

  it("rejects direct original-payment edits/deletes while allowing only a one-time Checkout Session completion", async () => {
    await connection.execute(insertOriginSql, originValues("immutable"));
    await expect(connection.execute(
      "UPDATE stripePaymentOrigins SET amount = ? WHERE sourceEventId = ?",
      [150_001, "evt_origin_immutable"],
    )).rejects.toThrow(/immutable/i);
    await expect(connection.execute(
      "DELETE FROM stripePaymentOrigins WHERE sourceEventId = ?",
      ["evt_origin_immutable"],
    )).rejects.toThrow(/append-only/i);

    await connection.execute(insertOriginSql, originValues("checkout_fill", null));
    await connection.execute(
      "UPDATE stripePaymentOrigins SET stripeCheckoutSessionId = ? WHERE sourceEventId = ?",
      ["cs_checkout_fill", "evt_origin_checkout_fill"],
    );
    const [filledRows] = await connection.query(
      "SELECT stripeCheckoutSessionId FROM stripePaymentOrigins WHERE sourceEventId = ?",
      ["evt_origin_checkout_fill"],
    ) as unknown as [OriginRow[]];
    expect(filledRows[0]?.stripeCheckoutSessionId).toBe("cs_checkout_fill");
    await expect(connection.execute(
      "UPDATE stripePaymentOrigins SET stripeCheckoutSessionId = ? WHERE sourceEventId = ?",
      ["cs_rewritten", "evt_origin_checkout_fill"],
    )).rejects.toThrow(/immutable/i);
  });

  it("enforces reversal origin linkage, policy_pending-only immutable evidence, and duplicate event rejection", async () => {
    await expect(connection.execute(
      insertReversalSql,
      reversalValues("orphan", 999_999),
    )).rejects.toThrow(/foreign key|constraint/i);

    await connection.execute(insertOriginSql, originValues("reversal"));
    const linkedOriginId = await originId(connection, "reversal");
    await connection.execute(insertReversalSql, reversalValues("reversal", linkedOriginId));

    await expect(connection.execute(
      insertReversalSql,
      reversalValues("not_pending", linkedOriginId, "policy_decided"),
    )).rejects.toThrow(/constraint|check/i);
    await expect(connection.execute(
      "UPDATE stripePaymentReversalEvents SET providerStatus = ? WHERE stripeEventId = ?",
      ["rewritten", "evt_reversal_reversal"],
    )).rejects.toThrow(/immutable/i);
    await expect(connection.execute(
      "DELETE FROM stripePaymentReversalEvents WHERE stripeEventId = ?",
      ["evt_reversal_reversal"],
    )).rejects.toThrow(/append-only/i);
    await expect(connection.execute(
      "DELETE FROM stripePaymentOrigins WHERE id = ?",
      [linkedOriginId],
    )).rejects.toThrow(/append-only/i);
    await expect(connection.execute(
      insertReversalSql,
      reversalValues("reversal", linkedOriginId),
    )).rejects.toThrow(/duplicate|uniq/i);
  });

  it("leaves exactly one durable record for concurrent duplicate origin and reversal events", async () => {
    const firstOrigin = await mysql.createConnection({
      host: maria.host,
      port: maria.port,
      user: "root",
      database,
      multipleStatements: false,
    });
    const secondOrigin = await mysql.createConnection({
      host: maria.host,
      port: maria.port,
      user: "root",
      database,
      multipleStatements: false,
    });
    try {
      const originRace = await Promise.allSettled([
        firstOrigin.execute(insertOriginSql, originValues("origin_race")),
        secondOrigin.execute(insertOriginSql, originValues("origin_race")),
      ]);
      const originOutcomes = settledCounts(originRace);
      expect(originOutcomes.fulfilled).toHaveLength(1);
      expect(originOutcomes.rejected).toHaveLength(1);
      expect(String((originOutcomes.rejected[0] as PromiseRejectedResult).reason)).toMatch(/duplicate|ER_DUP_ENTRY/i);

      const racedOriginId = await originId(connection, "origin_race");
      const firstReversal = await mysql.createConnection({
        host: maria.host,
        port: maria.port,
        user: "root",
        database,
        multipleStatements: false,
      });
      const secondReversal = await mysql.createConnection({
        host: maria.host,
        port: maria.port,
        user: "root",
        database,
        multipleStatements: false,
      });
      try {
        const reversalRace = await Promise.allSettled([
          firstReversal.execute(insertReversalSql, reversalValues("origin_race", racedOriginId)),
          secondReversal.execute(insertReversalSql, reversalValues("origin_race", racedOriginId)),
        ]);
        const reversalOutcomes = settledCounts(reversalRace);
        expect(reversalOutcomes.fulfilled).toHaveLength(1);
        expect(reversalOutcomes.rejected).toHaveLength(1);
        expect(String((reversalOutcomes.rejected[0] as PromiseRejectedResult).reason)).toMatch(/duplicate|ER_DUP_ENTRY/i);
      } finally {
        await firstReversal.end();
        await secondReversal.end();
      }

      const [originRows] = await connection.query(
        "SELECT id FROM stripePaymentOrigins WHERE sourceEventId = ?",
        ["evt_origin_origin_race"],
      ) as unknown as [OriginRow[]];
      const [reversalRows] = await connection.query(
        "SELECT id FROM stripePaymentReversalEvents WHERE stripeEventId = ?",
        ["evt_reversal_origin_race"],
      ) as unknown as [OriginRow[]];
      expect(originRows).toHaveLength(1);
      expect(reversalRows).toHaveLength(1);
    } finally {
      await firstOrigin.end();
      await secondOrigin.end();
    }
  });
});
