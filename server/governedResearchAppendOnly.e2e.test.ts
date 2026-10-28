/**
 * Direct SQL proof for scripts/governed-research-append-only.sql.
 * Disposable MariaDB only. The script is not in the Drizzle journal and is not applied elsewhere.
 */
import { spawn, type ChildProcess } from "node:child_process";
import { mariaBinary } from "./testing/mariaBinary";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createConnection, type Connection } from "mysql2/promise";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const PRODUCTION_URL = /prod|railway|getfaultline|amazonaws|planetscale/i;
const PORT = 3310;
const SCRIPT = readFileSync("scripts/governed-research-append-only.sql", "utf8");

function assertIsolated(url: string): void {
  if (!url || PRODUCTION_URL.test(url) || !/127\.0\.0\.1|localhost/.test(url)) {
    throw new Error("Refusing to apply governed-research triggers against a production database.");
  }
}

function scriptStatements(sql: string): string[] {
  return sql
    .split("\n")
    .filter(line => !line.trim().startsWith("--"))
    .join("\n")
    .split(";")
    .map(statement => statement.trim())
    .filter(Boolean);
}

async function applyAppendOnly(connection: Connection): Promise<number> {
  const statements = scriptStatements(SCRIPT);
  for (const statement of statements) await connection.query(statement);
  return statements.length;
}

describe("governed research append-only triggers", () => {
  let server: ChildProcess | null = null;
  let admin: Connection | null = null;
  const datadir = mkdtempSync(join(tmpdir(), "governed-append-only-"));
  const url = `mysql://root@127.0.0.1:${PORT}/governed_append_only`;

  beforeAll(async () => {
    assertIsolated(url);
    await new Promise<void>((resolve, reject) => {
      const install = spawn(mariaBinary("mariadb-install-db"), ["--datadir", datadir, "--auth-root-authentication-method=normal", "--skip-test-db"], { stdio: "ignore" });
      install.on("error", reject);
      install.on("exit", code => code === 0 ? resolve() : reject(new Error(`mariadb-install-db exited ${code}`)));
    });
    server = spawn(mariaBinary("mariadbd"), [
      `--datadir=${datadir}`,
      "--bind-address=127.0.0.1",
      `--port=${PORT}`,
      `--socket=${join(datadir, "mysql.sock")}`,
      `--pid-file=${join(datadir, "mysql.pid")}`,
      "--skip-grant-tables",
    ], { stdio: "ignore" });
    admin = await waitForMysql();
    await admin.query("CREATE DATABASE governed_append_only");
    await admin.query("USE governed_append_only");
    await admin.query(`CREATE TABLE governedResearchObservations (
      id int NOT NULL AUTO_INCREMENT PRIMARY KEY,
      observationKey varchar(220) NOT NULL UNIQUE,
      observationVersion varchar(96) NOT NULL,
      historyClass enum('live_verified','reconstructed_research','revised_data_reconstruction','proxy_reconstruction') NOT NULL,
      observationDate timestamp NOT NULL,
      informationCutoff timestamp NOT NULL,
      inputSnapshotId varchar(128),
      sourceModel varchar(128) NOT NULL,
      modelVersion varchar(96) NOT NULL,
      originalStateJson text NOT NULL,
      originalInterpretation text,
      outcomeDefinition text,
      outcomeWindow varchar(128),
      sourceDataVersionsJson text NOT NULL,
      createdAt timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`);
    await admin.query(`CREATE TABLE governedResearchResolutions (
      id int NOT NULL AUTO_INCREMENT PRIMARY KEY,
      resolutionKey varchar(220) NOT NULL UNIQUE,
      observationId int NOT NULL,
      resolutionVersion varchar(96) NOT NULL,
      outcomeValueJson text NOT NULL,
      resolvedAt timestamp NOT NULL,
      sourceDataVersionsJson text NOT NULL,
      createdAt timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT governedResearchResolutions_observation_fk FOREIGN KEY (observationId) REFERENCES governedResearchObservations(id) ON DELETE RESTRICT
    )`);
    await admin.query(`CREATE TABLE marketMemory (
      id int NOT NULL AUTO_INCREMENT PRIMARY KEY,
      memoryKey varchar(120) NOT NULL UNIQUE,
      memoryValue text NOT NULL
    )`);
  }, 60_000);

  afterAll(async () => {
    await admin?.end();
    if (server && !server.killed) server.kill("SIGTERM");
  });

  it("is an unapplied script and leaves other tables writable", () => {
    expect(SCRIPT.startsWith("-- INERT")).toBe(true);
    const body = scriptStatements(SCRIPT).join("\n");
    expect(body).not.toMatch(/piV2|marketMemory|ALTER TABLE|INSERT INTO|DELETE FROM/);
    expect(body).toContain("BEFORE UPDATE ON governedResearchObservations");
    expect(body).toContain("BEFORE DELETE ON governedResearchResolutions");
    const journal = readFileSync("drizzle/meta/_journal.json", "utf8");
    expect(journal).not.toContain("governed-research-append-only");
    expect(journal).not.toContain("0074_pi_v2_research_private");
    expect(scriptStatements(SCRIPT)).toHaveLength(8);
  });

  it("blocks UPDATE and DELETE of forward rows, unresolved reconstructions, and resolutions", async () => {
    expect(await applyAppendOnly(admin!)).toBe(8);
    expect(await applyAppendOnly(admin!)).toBe(8);

    await admin!.query(
      "INSERT INTO governedResearchObservations (observationKey, observationVersion, historyClass, observationDate, informationCutoff, sourceModel, modelVersion, originalStateJson, originalInterpretation, sourceDataVersionsJson) VALUES (?, 'v1', 'live_verified', '2026-10-05 20:15:00', '2026-10-05 20:15:00', 'test', 'v1', '{}', 'forward', '{}')",
      ["forward-1"],
    );
    await admin!.query(
      "INSERT INTO governedResearchObservations (observationKey, observationVersion, historyClass, observationDate, informationCutoff, sourceModel, modelVersion, originalStateJson, originalInterpretation, sourceDataVersionsJson) VALUES (?, 'v1', 'reconstructed_research', '2026-09-01 18:00:00', '2026-09-01 18:00:00', 'test', 'v1', '{}', 'unresolved reconstruction', '{}')",
      ["reconstruction-unresolved"],
    );
    const [parents] = await admin!.query("SELECT id, observationKey FROM governedResearchObservations") as unknown as [Array<{ id: number; observationKey: string }>];
    const forwardId = parents.find(row => row.observationKey === "forward-1")!.id;
    const reconstructionId = parents.find(row => row.observationKey === "reconstruction-unresolved")!.id;
    await admin!.query(
      "INSERT INTO governedResearchResolutions (resolutionKey, observationId, resolutionVersion, outcomeValueJson, resolvedAt, sourceDataVersionsJson) VALUES ('resolution-1', ?, 'v1', '{}', '2026-10-06 20:15:00', '{}')",
      [forwardId],
    );
    await admin!.query("INSERT INTO marketMemory (memoryKey, memoryValue) VALUES ('other-writer', 'before')");

    const blocked: string[] = [];
    for (const statement of [
      ["update-forward", "UPDATE governedResearchObservations SET originalInterpretation = 'mutated' WHERE id = ?", [forwardId]],
      ["update-reconstruction", "UPDATE governedResearchObservations SET originalInterpretation = 'mutated' WHERE id = ?", [reconstructionId]],
      ["delete-reconstruction", "DELETE FROM governedResearchObservations WHERE id = ?", [reconstructionId]],
      ["update-resolution", "UPDATE governedResearchResolutions SET outcomeValueJson = '{\"changed\":true}' WHERE resolutionKey = 'resolution-1'", []],
      ["delete-resolution", "DELETE FROM governedResearchResolutions WHERE resolutionKey = 'resolution-1'", []],
      ["delete-parent", "DELETE FROM governedResearchObservations WHERE id = ?", [forwardId]],
    ] as const) {
      try {
        await admin!.query(statement[1], statement[2] as unknown[]);
        blocked.push(`${statement[0]}:allowed`);
      } catch (error) {
        const sql = error as { sqlState?: string; message?: string };
        expect(sql.sqlState).toBe("45000");
        expect(sql.message ?? "").toMatch(/append-only/);
        blocked.push(`${statement[0]}:45000`);
      }
    }
    expect(blocked).toEqual([
      "update-forward:45000",
      "update-reconstruction:45000",
      "delete-reconstruction:45000",
      "update-resolution:45000",
      "delete-resolution:45000",
      "delete-parent:45000",
    ]);

    await admin!.query(
      "INSERT INTO governedResearchObservations (observationKey, observationVersion, historyClass, observationDate, informationCutoff, sourceModel, modelVersion, originalStateJson, originalInterpretation, sourceDataVersionsJson) VALUES ('reconstruction-after-trigger', 'v1', 'reconstructed_research', '2026-09-02 18:00:00', '2026-09-02 18:00:00', 'test', 'v1', '{}', 'still insertable', '{}')",
    );
    await admin!.query("UPDATE marketMemory SET memoryValue = 'after' WHERE memoryKey = 'other-writer'");

    const [observations] = await admin!.query("SELECT observationKey, originalInterpretation FROM governedResearchObservations ORDER BY observationKey") as unknown as [Array<{ observationKey: string; originalInterpretation: string }>];
    expect(observations).toEqual([
      { observationKey: "forward-1", originalInterpretation: "forward" },
      { observationKey: "reconstruction-after-trigger", originalInterpretation: "still insertable" },
      { observationKey: "reconstruction-unresolved", originalInterpretation: "unresolved reconstruction" },
    ]);
    const [resolutions] = await admin!.query("SELECT resolutionKey, outcomeValueJson FROM governedResearchResolutions") as unknown as [Array<{ resolutionKey: string; outcomeValueJson: string }>];
    expect(resolutions).toEqual([{ resolutionKey: "resolution-1", outcomeValueJson: "{}" }]);
    const [memory] = await admin!.query("SELECT memoryValue FROM marketMemory WHERE memoryKey = 'other-writer'") as unknown as [Array<{ memoryValue: string }>];
    expect(memory[0]?.memoryValue).toBe("after");
  }, 60_000);
});

async function waitForMysql(): Promise<Connection> {
  let last: unknown;
  for (let attempt = 0; attempt < 40; attempt += 1) {
    try {
      return await createConnection({ host: "127.0.0.1", port: PORT, user: "root" });
    } catch (error) {
      last = error;
      await new Promise(resolve => setTimeout(resolve, 250));
    }
  }
  throw last;
}
