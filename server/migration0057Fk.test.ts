/**
 * Isolated MariaDB checks for the 0057 foreign-key name.
 * The suite always starts an unprivileged disposable server and never touches
 * a shared socket, port, database, or environment-provided credential.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";
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

/**
 * Split ordinary MySQL SQL as the local client does: on semicolons outside
 * quoted strings/comments, while retaining compound CREATE TRIGGER bodies.
 * The fresh-bootstrap generator emits normal semicolon-delimited SQL; its
 * Drizzle breakpoint comments are not the SQL statement delimiter.
 */
function statements(sql: string): string[] {
  const result: string[] = [];
  let start = 0;
  let quote: "'" | '"' | "`" | null = null;
  let lineComment = false;
  let blockComment = false;
  let word = "";
  let isTrigger = false;
  let triggerDepth = 0;
  let pendingTriggerEnd = false;

  const withoutBreakpointMarkers = (statement: string) => statement
    .replace(/^\s*--> statement-breakpoint\s*$/gm, "");
  const executable = (statement: string) => withoutBreakpointMarkers(statement)
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n")
    .filter(line => !line.trimStart().startsWith("--") && !line.trimStart().startsWith("#"))
    .join("\n")
    .trim();
  const push = (end: number) => {
    const statement = withoutBreakpointMarkers(sql.slice(start, end));
    if (executable(statement)) result.push(statement.trim());
  };
  const finishWord = (end: number) => {
    if (!word) return;
    const keyword = word.toUpperCase();
    if (!isTrigger && keyword === "TRIGGER"
      && /\bCREATE\s+(?:OR\s+REPLACE\s+)?TRIGGER\s*$/i.test(sql.slice(start, end))) {
      isTrigger = true;
    }
    if (triggerDepth > 0 && pendingTriggerEnd) pendingTriggerEnd = false;
    if (isTrigger && keyword === "BEGIN") triggerDepth += 1;
    if (triggerDepth > 0 && keyword === "END") pendingTriggerEnd = true;
    word = "";
  };

  for (let index = 0; index < sql.length; index += 1) {
    const char = sql[index]!;
    const next = sql[index + 1];
    if (lineComment) {
      if (char === "\n") lineComment = false;
      continue;
    }
    if (blockComment) {
      if (char === "*" && next === "/") {
        blockComment = false;
        index += 1;
      }
      continue;
    }
    if (quote) {
      if (char === "\\") {
        index += 1;
      } else if (char === quote) {
        if (next === quote) index += 1;
        else quote = null;
      }
      continue;
    }
    if (sql.startsWith("--> statement-breakpoint", index)) {
      finishWord(index);
      lineComment = true;
      index += "--> statement-breakpoint".length - 1;
      continue;
    }
    if (char === "-" && next === "-" && (index === 0 || /\s/.test(sql[index - 1]!))) {
      finishWord(index);
      lineComment = true;
      index += 1;
      continue;
    }
    if (char === "#") {
      finishWord(index);
      lineComment = true;
      continue;
    }
    if (char === "/" && next === "*") {
      finishWord(index);
      blockComment = true;
      index += 1;
      continue;
    }
    if (char === "'" || char === '"' || char === "`") {
      finishWord(index);
      quote = char;
      continue;
    }
    if (/[A-Za-z0-9_]/.test(char)) {
      word += char;
      continue;
    }
    finishWord(index);
    if (char === ";") {
      if (pendingTriggerEnd) {
        triggerDepth -= 1;
        pendingTriggerEnd = false;
      }
      if (triggerDepth === 0) {
        push(index + 1);
        start = index + 1;
        isTrigger = false;
      }
    }
  }
  finishWord(sql.length);
  if (start < sql.length) push(sql.length);
  return result;
}

function legacy0057SchemaWithoutForeignKey(): string {
  const historical = readFileSync(
    resolve(root, "drizzle/0057_flawless_nuke.sql"),
    "utf8"
  );
  const historicalForeignKey = `ALTER TABLE \`algorithmOutcomeObservations\` ADD CONSTRAINT \`${LONG_FK}\` FOREIGN KEY (\`provenanceId\`) REFERENCES \`algorithmScoreProvenance\`(\`id\`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint`;
  const legacy = historical.replace(historicalForeignKey, "");
  if (legacy === historical) {
    throw new Error("Could not build the controlled 0057 legacy-schema fixture.");
  }
  return legacy;
}

function freshBootstrapStatements(): string[] {
  const result = spawnSync(
    process.execPath,
    [resolve(root, "scripts/buildCandidateFreshMySqlMigrationSql.mjs")],
    { cwd: root, encoding: "utf8", maxBuffer: 16 * 1024 * 1024 }
  );
  if (result.status !== 0) {
    throw new Error(`Fresh bootstrap builder failed: ${result.stderr}`);
  }
  return statements(result.stdout);
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

  it("applies the generated fresh bootstrap on an empty database", async () => {
    const connection = await maria.createDatabase("faultline_rc_fk_clean");
    connections.push(connection);
    for (const statement of freshBootstrapStatements()) {
      await connection.query(statement);
    }
    const name = await fkName(connection);
    expect(name).toBe(SHORT_FK);
    expect((name ?? "").length).toBeLessThanOrEqual(64);
  });

  it("repairs a controlled 0057 legacy schema that lacks the short foreign-key name", async () => {
    const connection = await maria.createDatabase("faultline_rc_fk_upgrade");
    connections.push(connection);
    // Do not replay raw 0060 here: its historical index ordering cannot fresh-
    // bootstrap MariaDB and is unrelated to 0057/0076 foreign-key repair.
    await applyFile(connection, "0057_flawless_nuke", legacy0057SchemaWithoutForeignKey());
    expect(await fkName(connection)).toBeNull();
    await applyFile(connection, "0076_algorithm_outcome_fk_name");
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
