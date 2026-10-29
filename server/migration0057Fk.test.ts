/**
 * Isolated MariaDB checks for the 0057 foreign-key name.
 * The suite always starts an unprivileged disposable server and never touches
 * a shared socket, port, database, or environment-provided credential.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import mysql from "mysql2/promise";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  startDisposableMariaDb,
  type DisposableMariaDb,
} from "./testing/disposableMariaDb";

const root = resolve(import.meta.dirname, "..");
const LONG_FK =
  "algorithmOutcomeObservations_provenanceId_algorithmScoreProvenance_id_fk";
const SHORT_FK = "algo_outcome_prov_fk";

function statements(sql: string): string[] {
  return sql
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

function journalTags(): string[] {
  const journal = JSON.parse(
    readFileSync(resolve(root, "drizzle/meta/_journal.json"), "utf8")
  ) as {
    entries: Array<{ tag: string }>;
  };
  return journal.entries.map(entry => entry.tag);
}

async function applyFile(
  connection: mysql.Connection,
  tag: string,
  sql?: string
) {
  const source =
    sql ?? readFileSync(resolve(root, "drizzle", `${tag}.sql`), "utf8");
  for (const statement of statements(source)) {
    await connection.query(statement);
  }
}

async function fkName(connection: mysql.Connection): Promise<string | null> {
  const [rows] = await connection.query(
    `SELECT CONSTRAINT_NAME AS name
     FROM information_schema.TABLE_CONSTRAINTS
     WHERE CONSTRAINT_SCHEMA = DATABASE()
       AND TABLE_NAME = 'algorithmOutcomeObservations'
       AND CONSTRAINT_TYPE = 'FOREIGN KEY'`
  );
  const list = rows as Array<{ name: string }>;
  return list[0]?.name ?? null;
}

describe("0057 foreign-key name on disposable MariaDB", () => {
  const connections: mysql.Connection[] = [];
  let maria: DisposableMariaDb;

  beforeAll(async () => {
    maria = await startDisposableMariaDb();
  }, 60_000);

  afterAll(async () => {
    await Promise.all(
      connections.map(connection => connection.end().catch(() => undefined))
    );
    await maria?.close();
  }, 60_000);

  it("rejects the historical 72-character constraint name", async () => {
    const connection = await maria.createDatabase("faultline_rc_fk_reject");
    connections.push(connection);
    await applyFile(
      connection,
      "0057_flawless_nuke",
      readFileSync(
        resolve(root, "drizzle/0057_flawless_nuke.sql"),
        "utf8"
      ).replace(/ALTER TABLE[\s\S]*$/, "")
    );
    await expect(
      connection.query(
        `ALTER TABLE \`algorithmOutcomeObservations\` ADD CONSTRAINT \`${LONG_FK}\` FOREIGN KEY (\`provenanceId\`) REFERENCES \`algorithmScoreProvenance\`(\`id\`) ON DELETE cascade ON UPDATE no action`
      )
    ).rejects.toThrow(/too long|Identifier name/i);
    expect(LONG_FK.length).toBe(72);
    expect(SHORT_FK.length).toBeLessThanOrEqual(64);
  });

  it("applies the full current journal on an empty database", async () => {
    const connection = await maria.createDatabase("faultline_rc_fk_clean");
    connections.push(connection);
    for (const tag of journalTags()) {
      await applyFile(connection, tag);
    }
    const name = await fkName(connection);
    expect(name).toBe(SHORT_FK);
    expect((name ?? "").length).toBeLessThanOrEqual(64);
  });

  it("upgrades a database that already passed 0057 without the short name", async () => {
    const connection = await maria.createDatabase("faultline_rc_fk_upgrade");
    connections.push(connection);
    const tags = journalTags();
    const cutoff = tags.indexOf("0074_stripe_entitlement_resync");
    expect(cutoff).toBeGreaterThan(0);
    for (const tag of tags.slice(0, cutoff)) {
      if (tag === "0057_flawless_nuke") {
        const sql = readFileSync(
          resolve(root, "drizzle/0057_flawless_nuke.sql"),
          "utf8"
        ).replace(
          /ALTER TABLE `algorithmOutcomeObservations` ADD CONSTRAINT[\s\S]*?statement-breakpoint/,
          "--> statement-breakpoint"
        );
        await applyFile(connection, tag, sql);
        continue;
      }
      if (tag === "0058_lovely_skin") {
        await applyFile(connection, tag, "SELECT 1");
        continue;
      }
      await applyFile(connection, tag);
    }
    expect(await fkName(connection)).toBeNull();
    for (const tag of tags.slice(cutoff)) {
      await applyFile(connection, tag);
    }
    const [rows] = await connection.query(
      `SELECT CONSTRAINT_NAME AS name
       FROM information_schema.TABLE_CONSTRAINTS
       WHERE CONSTRAINT_SCHEMA = DATABASE()
         AND TABLE_NAME = 'algorithmOutcomeObservations'
         AND CONSTRAINT_TYPE = 'FOREIGN KEY'`
    );
    const names = (rows as Array<{ name: string }>).map(row => row.name);
    expect(names).toEqual([SHORT_FK]);
    expect(SHORT_FK.length).toBeLessThanOrEqual(64);
  });
});
