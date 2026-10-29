import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  createDrizzleDecisionLedgerPersistence,
  type EvaluationResult,
} from "./decisionLedgerEvaluator";
import {
  startDisposableMariaDb,
  type DisposableMariaDb,
} from "./testing/disposableMariaDb";

const root = resolve(import.meta.dirname, "..");
const migrationPath = resolve(
  root,
  "drizzle/0079_decision_outcome_provenance.sql"
);

function migrationStatements(): string[] {
  return readFileSync(migrationPath, "utf8")
    .split("--> statement-breakpoint")
    .map(chunk =>
      chunk
        .split("\n")
        .filter(line => !line.trim().startsWith("--"))
        .join("\n")
        .trim()
    )
    .filter(Boolean);
}

function deferred<T = void>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((onResolve, onReject) => {
    resolve = onResolve;
    reject = onReject;
  });
  return { promise, resolve, reject };
}

function wait(milliseconds: number): Promise<void> {
  return new Promise(resolveWait => setTimeout(resolveWait, milliseconds));
}

function verifiedResult(
  outcome: "correct" | "incorrect" = "correct"
): EvaluationResult {
  const issuedAt = new Date("2026-01-05T22:00:00.000Z");
  const horizonAt = new Date("2026-01-12T22:00:00.000Z");
  const receivedAt = new Date("2026-01-14T22:00:00.000Z");
  return {
    outcome,
    evaluationState: "verified",
    evaluationNotes: `Synthetic SQL fixture automatic outcome: ${outcome}.`,
    priceAtResolution: outcome === "correct" ? 107 : 93,
    elapsedMs: 9 * 24 * 60 * 60 * 1000,
    provenance: {
      decisionLedgerId: 41,
      evaluationState: "verified",
      sourceProvider: "yahoo_finance_chart_daily",
      assetType: "stock",
      assetSymbol: "NVDA",
      originalIssuedAt: issuedAt,
      horizonAt,
      entryObservationAt: new Date("2026-01-05T14:30:00.000Z"),
      entryPrice: 100,
      horizonObservationAt: new Date("2026-01-13T14:30:00.000Z"),
      horizonPrice: outcome === "correct" ? 107 : 93,
      returnPct: outcome === "correct" ? 7 : -7,
      outcome,
      receivedAt,
      reason: "horizon_observation_verified",
      evidence: { fixture: "disposable-sql-only" },
    },
  };
}

type Setup = {
  database: string;
  connection: mysql.Connection;
};

describe("Decision Ledger receipt/finalization atomicity (disposable MariaDB)", () => {
  let maria: DisposableMariaDb;
  const connections: mysql.Connection[] = [];
  let sequence = 0;

  beforeAll(async () => {
    maria = await startDisposableMariaDb();
  }, 60_000);

  afterAll(async () => {
    await Promise.all(
      connections.map(connection => connection.end().catch(() => undefined))
    );
    await maria?.close();
  }, 60_000);

  async function setup(): Promise<Setup> {
    sequence += 1;
    const database = `ledger_atomic_${sequence}`;
    const connection = await maria.createDatabase(database);
    connections.push(connection);
    await connection.query(`CREATE TABLE \`decision_ledger\` (
      \`id\` int NOT NULL AUTO_INCREMENT PRIMARY KEY,
      \`outcome\` enum('pending','correct','incorrect','partially_correct','still_active') NOT NULL DEFAULT 'pending',
      \`evaluationNotes\` text,
      \`priceAtResolution\` double,
      \`elapsedMs\` bigint,
      \`autoEvaluated\` boolean NOT NULL DEFAULT false,
      \`evaluatedAt\` timestamp NULL,
      \`resolvedAt\` timestamp NULL
    ) ENGINE=InnoDB`);
    for (const statement of migrationStatements()) {
      await connection.query(statement);
    }
    await connection.query("INSERT INTO decision_ledger (id, outcome, autoEvaluated) VALUES (41, 'pending', false)");
    return { database, connection };
  }

  async function peerConnection(database: string): Promise<mysql.Connection> {
    const connection = await mysql.createConnection({
      host: maria.host,
      port: maria.port,
      user: "root",
      database,
    });
    connections.push(connection);
    return connection;
  }

  it("rolls back the automatic receipt when a concurrent manual resolution wins", async () => {
    const { database, connection } = await setup();
    const manual = await peerConnection(database);
    const persistence = createDrizzleDecisionLedgerPersistence(drizzle(connection));
    await manual.query("START TRANSACTION");
    await manual.query("SELECT id FROM decision_ledger WHERE id = 41 FOR UPDATE");
    const automatic = persistence.persistEvaluation(41, verifiedResult("correct"));
    let automaticSettled = false;
    void automatic.then(() => {
      automaticSettled = true;
    });
    // The actual foreign-key insert waits on the manual resolver's parent-row lock.
    await wait(50);
    expect(automaticSettled).toBe(false);
    await manual.query(
      "UPDATE decision_ledger SET outcome = 'incorrect', evaluationNotes = 'manual resolution', autoEvaluated = false WHERE id = 41"
    );
    await manual.query("COMMIT");

    await expect(automatic).resolves.toBe("manual_resolution");
    const [ledgerRows] = await manual.query(
      "SELECT outcome, evaluationNotes, autoEvaluated FROM decision_ledger WHERE id = 41"
    );
    expect(JSON.parse(JSON.stringify(ledgerRows))).toEqual([
      {
        outcome: "incorrect",
        evaluationNotes: "manual resolution",
        autoEvaluated: 0,
      },
    ]);
    const [receiptRows] = await manual.query(
      "SELECT COUNT(*) AS count FROM decisionLedgerOutcomeProvenance WHERE decisionLedgerId = 41"
    );
    expect(Number((receiptRows as Array<{ count: number }>)[0]?.count)).toBe(0);
  });

  it("allows exactly one of two concurrent evaluators to write a verified receipt and outcome", async () => {
    const { database, connection } = await setup();
    const secondWorker = await peerConnection(database);
    const firstReceiptInserted = deferred<void>();
    const releaseFirstWorker = deferred<void>();
    const first = createDrizzleDecisionLedgerPersistence(drizzle(connection), {
      afterReceiptInserted: async () => {
        firstReceiptInserted.resolve();
        await releaseFirstWorker.promise;
      },
    });
    const second = createDrizzleDecisionLedgerPersistence(drizzle(secondWorker));

    const firstAttempt = first.persistEvaluation(41, verifiedResult("correct"));
    await firstReceiptInserted.promise;
    let secondSettled = false;
    const secondAttempt = second
      .persistEvaluation(41, verifiedResult("incorrect"))
      .then(result => {
        secondSettled = true;
        return result;
      });

    // The second INSERT is blocked on the first transaction's unique receipt key.
    await wait(50);
    expect(secondSettled).toBe(false);
    releaseFirstWorker.resolve();

    await expect(firstAttempt).resolves.toBe("finalized");
    await expect(secondAttempt).resolves.toBe("already_recorded");
    const [ledgerRows] = await secondWorker.query(
      "SELECT outcome, autoEvaluated FROM decision_ledger WHERE id = 41"
    );
    expect(JSON.parse(JSON.stringify(ledgerRows))).toEqual([
      { outcome: "correct", autoEvaluated: 1 },
    ]);
    const [receiptRows] = await secondWorker.query(
      "SELECT outcome, COUNT(*) AS count FROM decisionLedgerOutcomeProvenance WHERE decisionLedgerId = 41 GROUP BY outcome"
    );
    expect(JSON.parse(JSON.stringify(receiptRows))).toEqual([
      { outcome: "correct", count: 1 },
    ]);
  });

  it("rolls back a post-receipt failure and deterministically succeeds on a later retry", async () => {
    const { connection } = await setup();
    const failing = createDrizzleDecisionLedgerPersistence(drizzle(connection), {
      afterReceiptInserted: async () => {
        throw new Error("synthetic disposable-SQL post-receipt finalization failure");
      },
    });

    await expect(failing.persistEvaluation(41, verifiedResult("correct"))).rejects.toThrow(
      "post-receipt finalization failure"
    );
    const [afterFailure] = await connection.query(
      "SELECT outcome, autoEvaluated FROM decision_ledger WHERE id = 41"
    );
    expect(JSON.parse(JSON.stringify(afterFailure))).toEqual([
      { outcome: "pending", autoEvaluated: 0 },
    ]);
    const [orphanedReceipts] = await connection.query(
      "SELECT COUNT(*) AS count FROM decisionLedgerOutcomeProvenance WHERE decisionLedgerId = 41"
    );
    expect(Number((orphanedReceipts as Array<{ count: number }>)[0]?.count)).toBe(0);

    const recovery = createDrizzleDecisionLedgerPersistence(drizzle(connection));
    await expect(recovery.persistEvaluation(41, verifiedResult("correct"))).resolves.toBe("finalized");
    const [afterRecovery] = await connection.query(
      "SELECT outcome, autoEvaluated FROM decision_ledger WHERE id = 41"
    );
    expect(JSON.parse(JSON.stringify(afterRecovery))).toEqual([
      { outcome: "correct", autoEvaluated: 1 },
    ]);
    const [recoveredReceipts] = await connection.query(
      "SELECT COUNT(*) AS count FROM decisionLedgerOutcomeProvenance WHERE decisionLedgerId = 41"
    );
    expect(Number((recoveredReceipts as Array<{ count: number }>)[0]?.count)).toBe(1);
  });
});
