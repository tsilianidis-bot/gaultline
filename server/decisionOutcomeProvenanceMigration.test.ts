import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  startDisposableMariaDb,
  type DisposableMariaDb,
} from "./testing/disposableMariaDb";
import { createDecisionLedgerOutcomeProvenanceWriter } from "./decisionLedgerProvenance";

const root = resolve(import.meta.dirname, "..");
const database = "ledger_provenance_isolated";
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

describe("0079 Decision Ledger outcome provenance migration", () => {
  let maria: DisposableMariaDb;
  let connection: mysql.Connection;

  beforeAll(async () => {
    maria = await startDisposableMariaDb();
    connection = await maria.createDatabase(database);
    await connection.query(`CREATE TABLE \`decision_ledger\` (
      \`id\` int NOT NULL AUTO_INCREMENT PRIMARY KEY,
      \`outcome\` varchar(32) NOT NULL DEFAULT 'pending'
    )`);
  }, 60_000);

  afterAll(async () => {
    await connection?.end();
    await maria?.close();
  }, 60_000);

  it("is journaled in the accepted tail, applies locally, and preserves immutable evidence receipts", async () => {
    const migration = readFileSync(migrationPath, "utf8");
    const journal = JSON.parse(readFileSync(resolve(root, "drizzle/meta/_journal.json"), "utf8")) as {
      entries: Array<{ idx: number; version: string; when: number; tag: string; breakpoints: boolean }>;
    };
    expect(journal.entries.find(entry => entry.tag === "0079_decision_outcome_provenance")).toEqual({
      idx: 79,
      version: "5",
      when: 1793270956095,
      tag: "0079_decision_outcome_provenance",
      breakpoints: true,
    });
    expect(migration).toContain("FOREIGN KEY (`decisionLedgerId`) REFERENCES `decision_ledger`(`id`) ON DELETE RESTRICT");
    expect(migration).toContain("UNIQUE(`decisionLedgerId`,`horizonAt`,`evaluationState`)");
    expect(migration).not.toMatch(/\b(?:ALTER TABLE|DROP TABLE|INSERT INTO|UPDATE\s+decision_ledger)\b/i);
    expect(migrationStatements()).toHaveLength(4);

    for (const statement of migrationStatements()) {
      await connection.query(statement);
    }
    await connection.query("INSERT INTO decision_ledger (id, outcome) VALUES (41, 'pending')");
    const writer = createDecisionLedgerOutcomeProvenanceWriter(drizzle(connection));
    await writer.append({
      provenanceKey: "receipt-41",
      decisionLedgerId: 41,
      evaluationState: "verified",
      sourceProvider: "yahoo_finance_chart_daily",
      assetType: "stock",
      assetSymbol: "NVDA",
      originalIssuedAt: new Date("2026-01-05T22:00:00.000Z"),
      horizonAt: new Date("2026-01-12T22:00:00.000Z"),
      entryObservationAt: new Date("2026-01-05T14:30:00.000Z"),
      entryPrice: 100,
      horizonObservationAt: new Date("2026-01-12T14:30:00.000Z"),
      horizonPrice: 107,
      returnPct: 7,
      outcome: "correct",
      receivedAt: new Date("2026-01-14T22:00:00.000Z"),
      reason: "horizon_observation_verified",
      evidence: { selectionRule: "horizon_daily_close_v1" },
    });

    const [rows] = await connection.query(
      "SELECT decisionLedgerId, sourceProvider, entryPrice, horizonPrice, returnPct, outcome, reason FROM decisionLedgerOutcomeProvenance"
    );
    expect(JSON.parse(JSON.stringify(rows))).toEqual([
      {
        decisionLedgerId: 41,
        sourceProvider: "yahoo_finance_chart_daily",
        entryPrice: 100,
        horizonPrice: 107,
        returnPct: 7,
        outcome: "correct",
        reason: "horizon_observation_verified",
      },
    ]);

    await expect(
      connection.query(
        "UPDATE decisionLedgerOutcomeProvenance SET horizonPrice = 500 WHERE provenanceKey = 'receipt-41'"
      )
    ).rejects.toThrow(/append-only/i);
    await expect(
      connection.query(
        "DELETE FROM decisionLedgerOutcomeProvenance WHERE provenanceKey = 'receipt-41'"
      )
    ).rejects.toThrow(/append-only/i);
    await expect(
      connection.query("DELETE FROM decision_ledger WHERE id = 41")
    ).rejects.toThrow();

    const [preserved] = await connection.query(
      "SELECT horizonPrice FROM decisionLedgerOutcomeProvenance WHERE provenanceKey = 'receipt-41'"
    );
    expect(JSON.parse(JSON.stringify(preserved))).toEqual([{ horizonPrice: 107 }]);
  });
});
