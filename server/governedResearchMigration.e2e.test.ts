/**
 * Isolated proof for the journaled 0077 governed-research guard migration.
 * It starts a disposable MariaDB on local port 3320 and never reads DATABASE_URL.
 */
import { spawn, type ChildProcess } from "node:child_process";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { createConnection, type Connection } from "mysql2/promise";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { mariaBinary } from "./testing/mariaBinary";

const root = resolve(import.meta.dirname, "..");
const PORT = 3320;
const DATABASE = "governed_research_immutability_0077";
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

async function applyMigration(connection: Connection): Promise<void> {
  for (const statement of migrationStatements(MIGRATION)) {
    await connection.query(statement);
  }
}

async function waitForMariaDb(): Promise<Connection> {
  let lastError: unknown;
  for (let attempt = 0; attempt < 40; attempt += 1) {
    try {
      return await createConnection({
        host: "127.0.0.1",
        port: PORT,
        user: "root",
      });
    } catch (error) {
      lastError = error;
      await new Promise(resolve => setTimeout(resolve, 250));
    }
  }
  throw lastError;
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

describe("0077 governed research immutability migration", () => {
  let server: ChildProcess | null = null;
  let admin: Connection | null = null;
  const datadir = mkdtempSync(join(tmpdir(), "governed-research-0077-"));

  beforeAll(async () => {
    expect(PORT).toBe(3320);
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
    server = spawn(
      mariaBinary("mariadbd"),
      [
        `--datadir=${datadir}`,
        "--bind-address=127.0.0.1",
        `--port=${PORT}`,
        `--socket=${join(datadir, "mysql.sock")}`,
        `--pid-file=${join(datadir, "mysql.pid")}`,
        "--skip-grant-tables",
      ],
      { stdio: "ignore" }
    );
    admin = await waitForMariaDb();
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
    await admin?.end();
    if (server && !server.killed) server.kill("SIGTERM");
  });

  it("is journaled directly after 0076 and contains only four creation-only trigger statements", () => {
    const journal = JSON.parse(
      readFileSync(resolve(root, "drizzle/meta/_journal.json"), "utf8")
    ) as {
      entries: Array<{
        idx: number;
        tag: string;
        when: number;
        breakpoints: boolean;
      }>;
    };
    expect(journal.entries.slice(-2)).toEqual([
      expect.objectContaining({
        idx: 76,
        tag: "0076_algorithm_outcome_fk_name",
      }),
      expect.objectContaining({
        idx: 77,
        tag: MIGRATION_TAG,
        breakpoints: true,
      }),
    ]);
    expect(journal.entries.at(-1)!.when).toBeGreaterThan(
      journal.entries.at(-2)!.when
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
