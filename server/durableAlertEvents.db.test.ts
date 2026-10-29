import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createConnection } from "mysql2/promise";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { drizzle } from "drizzle-orm/mysql2";
import { closeDbForTests } from "./db";
import { createDurableAlertEventStore } from "./durableAlertEvents";
import { institutionalMemoryRouter } from "./routers/institutionalMemory";
import { startDisposableMariaDb, type DisposableMariaDb } from "./testing/disposableMariaDb";

let maria: DisposableMariaDb;
let connection: Awaited<ReturnType<DisposableMariaDb["createDatabase"]>>;
let databaseUrl = "";
let originalDatabaseUrl: string | undefined;

const observedAt = new Date("2026-10-29T12:00:00.000Z");
const nextObservedAt = new Date("2026-10-29T12:05:00.000Z");

function observation(value: number | null, freshness: "CURRENT" | "DELAYED" | "LAST CLOSE" | "STALE" | "UNAVAILABLE" | "UNKNOWN" = "CURRENT") {
  return {
    ruleId: "vix-25" as const,
    value,
    freshness,
    source: value == null ? null : "markets.getGlobalSnapshot · ^VIX",
    observedAt,
  };
}

function callerObservation(value: number | null, freshness: "CURRENT" | "DELAYED" | "LAST CLOSE" | "STALE" | "UNAVAILABLE" | "UNKNOWN" = "CURRENT") {
  const valueForStore = observation(value, freshness);
  return { ...valueForStore, observedAt: valueForStore.observedAt.toISOString() };
}

async function applyOwnedMigration() {
  const migration = await readFile(resolve(process.cwd(), "drizzle/0082_durable_alert_events.sql"), "utf8");
  for (const statement of migration.split("--> statement-breakpoint")) {
    if (statement.trim()) await connection.query(statement);
  }
}

function caller(userId: number | null) {
  return institutionalMemoryRouter.createCaller({
    req: {} as never,
    res: {} as never,
    user: userId == null ? null : { id: userId, role: "user", isQaSession: false } as never,
  });
}

beforeAll(async () => {
  maria = await startDisposableMariaDb();
  connection = await maria.createDatabase("durable_alert_events_test");
  databaseUrl = `mysql://root@${maria.host}:${maria.port}/durable_alert_events_test`;
  await connection.query(`CREATE TABLE users (
    id int NOT NULL AUTO_INCREMENT,
    openId varchar(64) NOT NULL,
    PRIMARY KEY (id),
    UNIQUE KEY users_openId_unique (openId)
  )`);
  await connection.query("INSERT INTO users (id, openId) VALUES (1, 'alert-user-one'), (2, 'alert-user-two'), (3, 'caller-user-one'), (4, 'caller-user-two')");
  await applyOwnedMigration();
  originalDatabaseUrl = process.env.DATABASE_URL;
  process.env.DATABASE_URL = databaseUrl;
  closeDbForTests();
}, 60_000);

afterAll(async () => {
  closeDbForTests();
  if (originalDatabaseUrl === undefined) delete process.env.DATABASE_URL;
  else process.env.DATABASE_URL = originalDatabaseUrl;
  await connection?.end();
  await maria?.close();
}, 60_000);

describe("durable user alert events", () => {
  it("uses real local SQL to baseline, append each fresh transition once, preserve stale state, and page history", async () => {
    const store = createDurableAlertEventStore(drizzle(connection));

    await expect(store.synchronize(1, [observation(20)])).resolves.toMatchObject({ created: [], skipped: [] });
    const first = await store.synchronize(1, [{ ...observation(30), observedAt: nextObservedAt }]);
    expect(first.created).toHaveLength(1);
    expect(first.created[0]).toMatchObject({
      userId: 1,
      ruleId: "vix-25",
      eventKey: "vix-25:transition:1",
      evidenceKind: "client_observed",
      deliveryStatus: "not_sent",
      dataFreshness: "CURRENT",
    });

    await expect(store.synchronize(1, [{ ...observation(31), observedAt: new Date("2026-10-29T12:10:00.000Z") }])).resolves.toMatchObject({ created: [] });
    await expect(store.synchronize(1, [{ ...observation(20, "STALE"), observedAt: new Date("2026-10-29T12:15:00.000Z") }])).resolves.toMatchObject({
      created: [],
      skipped: [{ ruleId: "vix-25", reason: "unavailable_or_stale", freshness: "STALE" }],
    });
    // The stale lower value did not clear the active state, so this fresh
    // still-breached value cannot create a synthetic second transition.
    await expect(store.synchronize(1, [{ ...observation(31), observedAt: new Date("2026-10-29T12:20:00.000Z") }])).resolves.toMatchObject({ created: [] });
    await expect(store.synchronize(1, [{ ...observation(20), observedAt: new Date("2026-10-29T12:25:00.000Z") }])).resolves.toMatchObject({ created: [] });
    const second = await store.synchronize(1, [{ ...observation(30), observedAt: new Date("2026-10-29T12:30:00.000Z") }]);
    expect(second.created.map(event => event.eventKey)).toEqual(["vix-25:transition:2"]);

    const firstPage = await store.list(1, { limit: 1 });
    expect(firstPage.events).toHaveLength(1);
    expect(firstPage.nextCursor).toBeTypeOf("number");
    const secondPage = await store.list(1, { limit: 1, cursor: firstPage.nextCursor! });
    expect(secondPage.events).toHaveLength(1);
    expect(secondPage.nextCursor).toBeNull();
    expect(secondPage.events[0]?.deliveryStatus).toBe("not_sent");
  });

  it("exposes the monitor through protected callers, enforces user ownership, and never treats a test fixture as sent notification evidence", async () => {
    const userOne = caller(3);
    const userTwo = caller(4);
    const anonymous = caller(null);

    const initial = await userTwo.syncMyAlertMonitor({ observations: [callerObservation(20)] });
    expect(initial).toMatchObject({ status: "available", created: [] });
    const created = await userTwo.syncMyAlertMonitor({ observations: [{ ...callerObservation(30), observedAt: "2026-10-29T13:00:00.000Z" }] });
    expect(created.status).toBe("available");
    expect(created.created).toHaveLength(1);
    const eventId = created.created[0]!.id;

    const ownHistory = await userTwo.listMyAlertEvents({ limit: 10 });
    expect(ownHistory).toMatchObject({ status: "available" });
    expect(ownHistory.events).toHaveLength(1);
    expect(ownHistory.events[0]).toMatchObject({
      userId: 4,
      evidenceKind: "client_observed",
      deliveryStatus: "not_sent",
    });
    await expect(userOne.acknowledgeMyAlertEvent({ id: eventId })).resolves.toMatchObject({ status: "available", acknowledged: false });
    expect((await userOne.listMyAlertEvents({ limit: 10 })).events).toEqual([]);
    await expect(userTwo.acknowledgeMyAlertEvent({ id: eventId })).resolves.toMatchObject({ status: "available", acknowledged: true });
    expect((await userTwo.listMyAlertEvents({ limit: 10 })).events[0]?.acknowledgedAt).not.toBeNull();
    await expect(anonymous.listMyAlertEvents({ limit: 10 })).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("uses direct local SQL to block event evidence edits and deletes, append one immutable acknowledgement, and converge overlapping first baselines", async () => {
    const firstConnection = await createConnection({
      host: maria.host,
      port: maria.port,
      user: "root",
      database: "durable_alert_events_test",
    });
    const secondConnection = await createConnection({
      host: maria.host,
      port: maria.port,
      user: "root",
      database: "durable_alert_events_test",
    });
    try {
      const firstStore = createDurableAlertEventStore(drizzle(firstConnection));
      const secondStore = createDurableAlertEventStore(drizzle(secondConnection));

      // Two first-fresh observations use independent connections and overlap at
      // the unique baseline claim. Both must converge to exactly one baseline
      // and no synthetic transition event.
      const firstBaseline = observation(20);
      const [left, right] = await Promise.all([
        firstStore.synchronize(2, [firstBaseline]),
        secondStore.synchronize(2, [firstBaseline]),
      ]);
      expect(left.created).toEqual([]);
      expect(right.created).toEqual([]);
      const [baselineRows] = await connection.query("SELECT lastBreached, transitionSequence FROM userAlertMonitorStates WHERE userId = 2 AND ruleId = 'vix-25'");
      expect(JSON.parse(JSON.stringify(baselineRows))).toEqual([{ lastBreached: 0, transitionSequence: 0 }]);
      const [initialEvents] = await connection.query("SELECT id FROM userAlertEvents WHERE userId = 2");
      expect(JSON.parse(JSON.stringify(initialEvents))).toEqual([]);

      const created = await firstStore.synchronize(2, [{ ...observation(30), observedAt: nextObservedAt }]);
      expect(created.created).toHaveLength(1);
      const eventId = created.created[0]!.id;

      // The one-per-event unique acknowledgement is an insert-only transition:
      // two concurrent owners produce one new acknowledgement and one false.
      const acknowledgements = await Promise.all([
        firstStore.acknowledge(2, eventId, new Date("2026-10-29T12:06:00.000Z")),
        secondStore.acknowledge(2, eventId, new Date("2026-10-29T12:06:01.000Z")),
      ]);
      expect(acknowledgements.sort()).toEqual([false, true]);
      await expect(connection.query(
        "INSERT INTO userAlertEventAcknowledgements (eventId, acknowledgedAt) VALUES (?, ?)",
        [eventId, new Date("2026-10-29T12:06:02.000Z")],
      )).rejects.toThrow(/duplicate/i);

      // These are direct SQL attempts, not application-path validation. Event
      // evidence is never acknowledged by updating it; both tables reject all
      // updates/deletes after their initial append.
      await expect(connection.query(
        "UPDATE userAlertEvents SET observedValue = 999.000000 WHERE id = ?",
        [eventId],
      )).rejects.toThrow(/append-only/i);
      await expect(connection.query("DELETE FROM userAlertEvents WHERE id = ?", [eventId])).rejects.toThrow(/append-only/i);
      await expect(connection.query(
        "UPDATE userAlertEventAcknowledgements SET acknowledgedAt = ? WHERE eventId = ?",
        [new Date("2026-10-29T12:07:00.000Z"), eventId],
      )).rejects.toThrow(/append-only/i);
      await expect(connection.query("DELETE FROM userAlertEventAcknowledgements WHERE eventId = ?", [eventId])).rejects.toThrow(/append-only/i);

      const [eventRows] = await connection.query("SELECT observedValue, source, deliveryStatus FROM userAlertEvents WHERE id = ?", [eventId]);
      expect(JSON.parse(JSON.stringify(eventRows))).toEqual([{
        observedValue: "30.000000",
        source: "markets.getGlobalSnapshot · ^VIX",
        deliveryStatus: "not_sent",
      }]);
      const [acknowledgementRows] = await connection.query("SELECT eventId FROM userAlertEventAcknowledgements WHERE eventId = ?", [eventId]);
      expect(JSON.parse(JSON.stringify(acknowledgementRows))).toEqual([{ eventId }]);
    } finally {
      await firstConnection.end();
      await secondConnection.end();
    }
  });
});
