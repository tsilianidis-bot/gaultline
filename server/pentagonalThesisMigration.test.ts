import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import mysql from "mysql2/promise";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  startDisposableMariaDb,
  type DisposableMariaDb,
} from "./testing/disposableMariaDb";

const root = resolve(import.meta.dirname, "..");
const database = "thesis_isolated";

function statements(): string[] {
  return readFileSync(
    resolve(root, "drizzle/0075_pentagonal_thesis_records.sql"),
    "utf8"
  )
    .split("--> statement-breakpoint")
    .map(chunk =>
      chunk
        .split("\n")
        .filter(line => !line.trim().startsWith("--"))
        .join("\n")
        .trim()
    )
    .filter(chunk => chunk.length > 0);
}

describe("pentagonal thesis migration on an isolated database", () => {
  let maria: DisposableMariaDb;
  let connection: mysql.Connection;

  beforeAll(async () => {
    maria = await startDisposableMariaDb();
    connection = await maria.createDatabase(database);
  }, 60_000);

  afterAll(async () => {
    await connection?.end();
    await maria?.close();
  }, 60_000);

  it("applies 0075, appends a thesis and an outcome row, and blocks update and delete", async () => {
    await connection.query(
      "DROP TABLE IF EXISTS pentagonalThesisOutcomeScores"
    );
    await connection.query("DROP TABLE IF EXISTS pentagonalThesisRecords");
    for (const statement of statements()) {
      await connection.query(statement);
    }

    await connection.query(
      "INSERT INTO pentagonalThesisRecords (recordId, scopeKind, symbol, thesisVersion, supersedesRecordId, engineVersion, contentHash, payloadJson, generatedAt) VALUES (?, 'stock', 'AAPL', 1, NULL, 'pentagonal-thesis-v1', ?, ?, ?)",
      [
        "record-1",
        "abc",
        '{"symbol":"AAPL"}',
        new Date("2026-10-27T15:00:00.000Z"),
      ]
    );
    await expect(
      connection.query(
        "UPDATE pentagonalThesisRecords SET payloadJson = '{\"rewritten\":true}' WHERE recordId = 'record-1'"
      )
    ).rejects.toThrow(/append-only/i);
    await expect(
      connection.query(
        "DELETE FROM pentagonalThesisRecords WHERE recordId = 'record-1'"
      )
    ).rejects.toThrow(/append-only/i);
    const [rows] = await connection.query(
      "SELECT payloadJson FROM pentagonalThesisRecords WHERE recordId = 'record-1'"
    );
    expect(JSON.parse(JSON.stringify(rows))[0].payloadJson).toContain("AAPL");

    await connection.query(
      "INSERT INTO pentagonalThesisOutcomeScores (scoreId, recordId, notes) VALUES ('score-1', 'record-1', 'unscored hook')"
    );
    await expect(
      connection.query(
        "UPDATE pentagonalThesisOutcomeScores SET notes = 'changed' WHERE scoreId = 'score-1'"
      )
    ).rejects.toThrow(/append-only/i);
    await expect(
      connection.query(
        "DELETE FROM pentagonalThesisOutcomeScores WHERE scoreId = 'score-1'"
      )
    ).rejects.toThrow(/append-only/i);
    const [scores] = await connection.query(
      "SELECT notes FROM pentagonalThesisOutcomeScores WHERE scoreId = 'score-1'"
    );
    expect(JSON.parse(JSON.stringify(scores))[0].notes).toBe("unscored hook");
  });
});
