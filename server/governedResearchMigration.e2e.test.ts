/**
 * Isolated proof for the journaled 0077 governed-research guard migration.
 * It starts a disposable MariaDB on a unique loopback port and never reads DATABASE_URL.
 */
import { spawn, type ChildProcess } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { createConnection, type Connection } from "mysql2/promise";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { mariaBinary } from "./testing/mariaBinary";

const root = resolve(import.meta.dirname, "..");
const DATABASE = `governed_0077_${randomUUID().replaceAll("-", "")}`;
const MIGRATION_TAG = "0077_governed_research_immutability";
const MIGRATION = readFileSync(
  resolve(root, "drizzle", `${MIGRATION_TAG}.sql`),
  "utf8"
);
const TRIGGERS = [
  "governedResearchObservations_append_only_update",
  "governedResearchObservations_append_only_delete",
  "governedResearchResolutions_append_only_update",
  "governedResearchResolutions_append_only_delete",
] as const;

function migrationStatements(sql: string): string[] {
  return sql
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

type MariaDbIdentity = Readonly<{
  datadir: string;
  pidFile: string;
  port: number;
  pid: number;
}>;

function assertMariaDbIdentity(
  actual: MariaDbIdentity,
  expected: MariaDbIdentity
): void {
  const mismatches: string[] = [];
  if (resolve(actual.datadir) !== resolve(expected.datadir)) mismatches.push("datadir");
  if (resolve(actual.pidFile) !== resolve(expected.pidFile)) mismatches.push("pidFile");
  if (actual.port !== expected.port) mismatches.push("port");
  if (actual.pid !== expected.pid) mismatches.push("pid");
  if (mismatches.length > 0) {
    throw new Error(`Refusing MariaDB connection with mismatched identity: ${mismatches.join(", ")}`);
  }
}

function hasExited(child: ChildProcess): boolean {
  return child.exitCode !== null || child.signalCode !== null;
}

function assertChildRunning(child: ChildProcess, startupError: () => Error | null): void {
  const error = startupError();
  if (error) throw new Error(`mariadbd failed to start: ${error.message}`);
  if (!child.pid) throw new Error("mariadbd did not expose a child PID");
  if (hasExited(child)) {
    throw new Error(`mariadbd exited before isolated setup (code=${child.exitCode}, signal=${child.signalCode})`);
  }
}

async function freeLoopbackPort(): Promise<number> {
  return await new Promise((resolvePort, rejectPort) => {
    const reservation = createServer();
    reservation.once("error", rejectPort);
    reservation.listen(0, "127.0.0.1", () => {
      const address = reservation.address();
      if (!address || typeof address === "string") {
        reservation.close(() => rejectPort(new Error("unable to reserve a loopback MariaDB port")));
        return;
      }
      reservation.close(error => error ? rejectPort(error) : resolvePort(address.port));
    });
  });
}

async function applyMigration(connection: Connection): Promise<void> {
  for (const statement of migrationStatements(MIGRATION)) {
    await connection.query(statement);
  }
}

async function waitForMariaDb(
  port: number,
  child: ChildProcess,
  startupError: () => Error | null
): Promise<Connection> {
  let lastError: unknown;
  for (let attempt = 0; attempt < 40; attempt += 1) {
    assertChildRunning(child, startupError);
    try {
      const connection = await createConnection({
        host: "127.0.0.1",
        port,
        user: "root",
      });
      try {
        assertChildRunning(child, startupError);
        return connection;
      } catch (error) {
        await connection.end();
        throw error;
      }
    } catch (error) {
      lastError = error;
      await new Promise(resolve => setTimeout(resolve, 250));
    }
  }
  throw lastError ?? new Error("mariadbd did not accept an isolated connection");
}

async function assertConnectedMariaDbIdentity(connection: Connection, expected: MariaDbIdentity): Promise<void> {
  const [rows] = (await connection.query(
    "SELECT @@datadir AS datadir, @@pid_file AS pidFile, @@port AS port"
  )) as unknown as [Array<{ datadir: string; pidFile: string; port: number | string }>];
  const row = rows[0];
  if (!row) throw new Error("MariaDB identity query returned no row");
  const pid = Number.parseInt(readFileSync(expected.pidFile, "utf8").trim(), 10);
  if (!Number.isSafeInteger(pid) || pid < 1) {
    throw new Error("MariaDB pid file did not contain a process ID");
  }
  assertMariaDbIdentity({
    datadir: row.datadir,
    pidFile: row.pidFile,
    port: Number(row.port),
    pid,
  }, expected);
}

function waitForChildExit(child: ChildProcess, timeoutMs: number): Promise<void> {
  if (hasExited(child)) return Promise.resolve();
  return new Promise((resolveExit, rejectExit) => {
    const timeout = setTimeout(() => {
      child.off("exit", onExit);
      rejectExit(new Error(`mariadbd did not exit within ${timeoutMs}ms`));
    }, timeoutMs);
    const onExit = () => {
      clearTimeout(timeout);
      resolveExit();
    };
    child.once("exit", onExit);
  });
}

async function stopMariaDb(child: ChildProcess): Promise<void> {
  if (hasExited(child)) return;
  let exited = waitForChildExit(child, 10_000);
  child.kill("SIGTERM");
  try {
    await exited;
  } catch {
    if (hasExited(child)) return;
    exited = waitForChildExit(child, 10_000);
    child.kill("SIGKILL");
    await exited;
  }
}

async function expectBlocked(
  connection: Connection,
  sql: string,
  values: unknown[] = []
): Promise<void> {
  try {
    await connection.query(sql, values);
    throw new Error(`guard unexpectedly allowed: ${sql}`);
  } catch (error) {
    const databaseError = error as { sqlState?: string; message?: string };
    expect(databaseError.sqlState).toBe("45000");
    expect(databaseError.message ?? "").toMatch(/append-only/);
  }
}

describe("0077 MariaDB harness identity guard", () => {
  it("rejects mismatching database datadir, pid file, port, or child PID", () => {
    const expected: MariaDbIdentity = {
      datadir: "/tmp/governed-expected",
      pidFile: "/tmp/governed-expected/mysql.pid",
      port: 33_201,
      pid: 7_007,
    };
    for (const [field, actual] of [
      ["datadir", { ...expected, datadir: "/tmp/governed-other" }],
      ["pidFile", { ...expected, pidFile: "/tmp/governed-expected/other.pid" }],
      ["port", { ...expected, port: 33_202 }],
      ["pid", { ...expected, pid: 7_008 }],
    ] as const) {
      expect(() => assertMariaDbIdentity(actual, expected)).toThrow(field);
    }
  });
});

describe("0077 governed research immutability migration", () => {
  let server: ChildProcess | null = null;
  let admin: Connection | null = null;
  let startupError: Error | null = null;
  const datadir = mkdtempSync(join(tmpdir(), `governed-research-0077-${process.pid}-`));
  const pidFile = join(datadir, "mysql.pid");

  beforeAll(async () => {
    const port = await freeLoopbackPort();
    expect(port).toBeGreaterThan(1023);
    expect(port).toBeLessThan(65_536);
    await new Promise<void>((resolveInstall, rejectInstall) => {
      const install = spawn(
        mariaBinary("mariadb-install-db"),
        [
          `--datadir=${datadir}`,
          "--auth-root-authentication-method=normal",
          "--skip-test-db",
        ],
        { stdio: "ignore" }
      );
      install.on("error", rejectInstall);
      install.on("exit", code =>
        code === 0
          ? resolveInstall()
          : rejectInstall(new Error(`mariadb-install-db exited ${code}`))
      );
    });
    const child = spawn(
      mariaBinary("mariadbd"),
      [
        `--datadir=${datadir}`,
        "--bind-address=127.0.0.1",
        `--port=${port}`,
        `--socket=${join(datadir, "mysql.sock")}`,
        `--pid-file=${pidFile}`,
        "--skip-grant-tables",
      ],
      { stdio: "ignore" }
    );
    server = child;
    child.once("error", error => {
      startupError = error;
    });
    assertChildRunning(child, () => startupError);
    const childPid = child.pid;
    if (!childPid) throw new Error("mariadbd did not expose a child PID");
    const expectedIdentity: MariaDbIdentity = { datadir, pidFile, port, pid: childPid };
    const connection = await waitForMariaDb(port, child, () => startupError);
    try {
      await assertConnectedMariaDbIdentity(connection, expectedIdentity);
      assertChildRunning(child, () => startupError);
    } catch (error) {
      await connection.end();
      throw error;
    }
    admin = connection;
    await admin.query(`CREATE DATABASE \`${DATABASE}\``);
    await admin.query(`USE \`${DATABASE}\``);
    await admin.query(`CREATE TABLE \`governedResearchObservations\` (
      \`id\` int NOT NULL AUTO_INCREMENT PRIMARY KEY,
      \`observationKey\` varchar(220) NOT NULL UNIQUE,
      \`observationVersion\` varchar(96) NOT NULL,
      \`historyClass\` enum('live_verified','reconstructed_research','revised_data_reconstruction','proxy_reconstruction') NOT NULL,
      \`observationDate\` timestamp NOT NULL,
      \`informationCutoff\` timestamp NOT NULL,
      \`inputSnapshotId\` varchar(128),
      \`sourceModel\` varchar(128) NOT NULL,
      \`modelVersion\` varchar(96) NOT NULL,
      \`originalStateJson\` text NOT NULL,
      \`originalInterpretation\` text,
      \`outcomeDefinition\` text,
      \`outcomeWindow\` varchar(128),
      \`sourceDataVersionsJson\` text NOT NULL,
      \`createdAt\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`);
    await admin.query(`CREATE TABLE \`governedResearchResolutions\` (
      \`id\` int NOT NULL AUTO_INCREMENT PRIMARY KEY,
      \`resolutionKey\` varchar(220) NOT NULL UNIQUE,
      \`observationId\` int NOT NULL,
      \`resolutionVersion\` varchar(96) NOT NULL,
      \`outcomeValueJson\` text NOT NULL,
      \`resolvedAt\` timestamp NOT NULL,
      \`sourceDataVersionsJson\` text NOT NULL,
      \`createdAt\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT \`governedResearchResolutions_observation_fk\`
        FOREIGN KEY (\`observationId\`) REFERENCES \`governedResearchObservations\`(\`id\`) ON DELETE RESTRICT
    )`);
    await admin.query(`CREATE TABLE \`unrelatedWriter\` (
      \`id\` int NOT NULL AUTO_INCREMENT PRIMARY KEY,
      \`writerKey\` varchar(96) NOT NULL UNIQUE,
      \`writerValue\` text NOT NULL
    )`);
  }, 60_000);

  afterAll(async () => {
    const connection = admin;
    admin = null;
    try {
      await connection?.end();
    } finally {
      const child = server;
      server = null;
      if (child) await stopMariaDb(child);
      rmSync(datadir, { recursive: true, force: true });
    }
  });

  it("is journaled directly after 0076 and contains only four creation-only trigger statements", () => {
    const journal = JSON.parse(
      readFileSync(resolve(root, "drizzle/meta/_journal.json"), "utf8")
    ) as {
      entries: Array<{
        idx: number;
        version: string;
        tag: string;
        when: number;
        breakpoints: boolean;
      }>;
    };
    const migrationIndex = journal.entries.findIndex(entry => entry.tag === MIGRATION_TAG);
    expect(migrationIndex).toBe(77);
    expect(journal.entries[migrationIndex - 1]).toEqual({
      idx: 76,
      version: "5",
      when: 1792300000000,
      tag: "0076_algorithm_outcome_fk_name",
      breakpoints: true,
    });
    expect(journal.entries[migrationIndex]).toEqual({
      idx: 77,
      version: "5",
      when: 1793241851962,
      tag: MIGRATION_TAG,
      breakpoints: true,
    });
    expect(journal.entries[migrationIndex]!.when).toBeGreaterThan(
      journal.entries[migrationIndex - 1]!.when
    );
    expect(migrationStatements(MIGRATION)).toHaveLength(4);
    expect(MIGRATION).toContain("--> statement-breakpoint");
    expect(migrationStatements(MIGRATION).join("\n")).not.toMatch(
      /DROP TRIGGER|DROP TABLE|CREATE TABLE|ALTER TABLE|INSERT\s+INTO/i
    );
    expect(
      readFileSync(
        resolve(root, "scripts/governed-research-append-only.sql"),
        "utf8"
      )
    ).toMatch(/^-- INERT/);
    expect(JSON.stringify(journal)).not.toContain(
      "governed-research-append-only"
    );
  });

  it("preserves existing forward and reconstructed history while rejecting edits and deletions", async () => {
    const connection = admin!;
    await connection.query(
      "INSERT INTO `governedResearchObservations` (`observationKey`, `observationVersion`, `historyClass`, `observationDate`, `informationCutoff`, `sourceModel`, `modelVersion`, `originalStateJson`, `originalInterpretation`, `sourceDataVersionsJson`) VALUES ('forward-existing', 'v1', 'live_verified', '2026-10-05 20:15:00', '2026-10-05 20:15:00', 'test', 'v1', '{}', 'forward original', '{}'), ('reconstructed-existing', 'v1', 'reconstructed_research', '2026-09-01 18:00:00', '2026-09-01 18:00:00', 'test', 'v1', '{}', 'reconstruction original', '{}')"
    );
    const [existingObservations] = (await connection.query(
      "SELECT `id`, `observationKey` FROM `governedResearchObservations` ORDER BY `observationKey`"
    )) as unknown as [Array<{ id: number; observationKey: string }>];
    const forwardId = existingObservations.find(
      row => row.observationKey === "forward-existing"
    )!.id;
    const reconstructedId = existingObservations.find(
      row => row.observationKey === "reconstructed-existing"
    )!.id;
    await connection.query(
      "INSERT INTO `governedResearchResolutions` (`resolutionKey`, `observationId`, `resolutionVersion`, `outcomeValueJson`, `resolvedAt`, `sourceDataVersionsJson`) VALUES ('forward-resolution-existing', ?, 'v1', '{\"outcome\":\"forward\"}', '2026-10-06 20:15:00', '{}'), ('reconstructed-resolution-existing', ?, 'v1', '{\"outcome\":\"reconstructed\"}', '2026-10-06 20:15:00', '{}')",
      [forwardId, reconstructedId]
    );
    await connection.query(
      "INSERT INTO `unrelatedWriter` (`writerKey`, `writerValue`) VALUES ('unrelated-existing', 'before')"
    );

    await applyMigration(connection);

    const [triggerRows] = (await connection.query(
      `SELECT TRIGGER_NAME AS name FROM information_schema.TRIGGERS
       WHERE TRIGGER_SCHEMA = DATABASE()
       AND EVENT_OBJECT_TABLE IN ('governedResearchObservations', 'governedResearchResolutions')
       ORDER BY TRIGGER_NAME`
    )) as unknown as [Array<{ name: string }>];
    expect(triggerRows.map(row => row.name)).toEqual([...TRIGGERS].sort());

    const [preservedObservations] = (await connection.query(
      "SELECT `observationKey`, `historyClass`, `originalInterpretation` FROM `governedResearchObservations` ORDER BY `observationKey`"
    )) as unknown as [
      Array<{
        observationKey: string;
        historyClass: string;
        originalInterpretation: string;
      }>,
    ];
    expect(preservedObservations).toEqual([
      {
        observationKey: "forward-existing",
        historyClass: "live_verified",
        originalInterpretation: "forward original",
      },
      {
        observationKey: "reconstructed-existing",
        historyClass: "reconstructed_research",
        originalInterpretation: "reconstruction original",
      },
    ]);
    const [preservedResolutions] = (await connection.query(
      "SELECT `resolutionKey`, `outcomeValueJson` FROM `governedResearchResolutions` ORDER BY `resolutionKey`"
    )) as unknown as [
      Array<{ resolutionKey: string; outcomeValueJson: string }>,
    ];
    expect(preservedResolutions).toEqual([
      {
        resolutionKey: "forward-resolution-existing",
        outcomeValueJson: '{"outcome":"forward"}',
      },
      {
        resolutionKey: "reconstructed-resolution-existing",
        outcomeValueJson: '{"outcome":"reconstructed"}',
      },
    ]);

    for (const [sql, values] of [
      [
        "UPDATE `governedResearchObservations` SET `originalInterpretation` = 'changed' WHERE `id` = ?",
        [forwardId],
      ],
      [
        "DELETE FROM `governedResearchObservations` WHERE `id` = ?",
        [forwardId],
      ],
      [
        "UPDATE `governedResearchObservations` SET `originalInterpretation` = 'changed' WHERE `id` = ?",
        [reconstructedId],
      ],
      [
        "DELETE FROM `governedResearchObservations` WHERE `id` = ?",
        [reconstructedId],
      ],
      [
        "UPDATE `governedResearchResolutions` SET `outcomeValueJson` = '{\"changed\":true}' WHERE `resolutionKey` = 'forward-resolution-existing'",
        [],
      ],
      [
        "DELETE FROM `governedResearchResolutions` WHERE `resolutionKey` = 'forward-resolution-existing'",
        [],
      ],
      [
        "UPDATE `governedResearchResolutions` SET `outcomeValueJson` = '{\"changed\":true}' WHERE `resolutionKey` = 'reconstructed-resolution-existing'",
        [],
      ],
      [
        "DELETE FROM `governedResearchResolutions` WHERE `resolutionKey` = 'reconstructed-resolution-existing'",
        [],
      ],
    ] as Array<[string, unknown[]]>) {
      await expectBlocked(connection, sql, values);
    }

    await connection.query(
      "INSERT INTO `governedResearchObservations` (`observationKey`, `observationVersion`, `historyClass`, `observationDate`, `informationCutoff`, `sourceModel`, `modelVersion`, `originalStateJson`, `originalInterpretation`, `sourceDataVersionsJson`) VALUES ('followup-observation', 'v1', 'reconstructed_research', '2026-09-02 18:00:00', '2026-09-02 18:00:00', 'test', 'v1', '{}', 'appendable followup', '{}')"
    );
    const [followupRows] = (await connection.query(
      "SELECT `id` FROM `governedResearchObservations` WHERE `observationKey` = 'followup-observation'"
    )) as unknown as [Array<{ id: number }>];
    await connection.query(
      "INSERT INTO `governedResearchResolutions` (`resolutionKey`, `observationId`, `resolutionVersion`, `outcomeValueJson`, `resolvedAt`, `sourceDataVersionsJson`) VALUES ('followup-resolution', ?, 'v1', '{\"outcome\":\"followup\"}', '2026-10-07 20:15:00', '{}')",
      [followupRows[0]!.id]
    );
    await connection.query(
      "UPDATE `unrelatedWriter` SET `writerValue` = 'after' WHERE `writerKey` = 'unrelated-existing'"
    );

    const [finalObservations] = (await connection.query(
      "SELECT `observationKey`, `originalInterpretation` FROM `governedResearchObservations` ORDER BY `observationKey`"
    )) as unknown as [
      Array<{ observationKey: string; originalInterpretation: string }>,
    ];
    expect(finalObservations).toEqual([
      {
        observationKey: "followup-observation",
        originalInterpretation: "appendable followup",
      },
      {
        observationKey: "forward-existing",
        originalInterpretation: "forward original",
      },
      {
        observationKey: "reconstructed-existing",
        originalInterpretation: "reconstruction original",
      },
    ]);
    const [finalResolutions] = (await connection.query(
      "SELECT `resolutionKey` FROM `governedResearchResolutions` ORDER BY `resolutionKey`"
    )) as unknown as [Array<{ resolutionKey: string }>];
    expect(finalResolutions.map(row => row.resolutionKey)).toEqual([
      "followup-resolution",
      "forward-resolution-existing",
      "reconstructed-resolution-existing",
    ]);
    const [unrelatedRows] = (await connection.query(
      "SELECT `writerValue` FROM `unrelatedWriter` WHERE `writerKey` = 'unrelated-existing'"
    )) as unknown as [Array<{ writerValue: string }>];
    expect(unrelatedRows).toEqual([{ writerValue: "after" }]);
  }, 60_000);
});
