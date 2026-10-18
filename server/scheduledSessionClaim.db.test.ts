/**
 * Disposable-database proof for the once-per-session claim.
 * Set DISPOSABLE_DATABASE_URL to an empty local MySQL/MariaDB. This file does
 * not read production DATABASE_URL and does not migrate the journal.
 */
import { spawn } from "node:child_process";
import { describe, expect, it } from "vitest";
import mysql from "mysql2/promise";
import { drizzle } from "drizzle-orm/mysql2";
import { claimScheduledSeismographSession } from "./scheduledSessionClaim";

const url = process.env.DISPOSABLE_DATABASE_URL;
const dbTest = url ? describe : describe.skip;

function serverUrl(databaseUrl: string): string {
  return databaseUrl.replace(/\/[^/?]+(\?.*)?$/, "/$1");
}

async function resetTable(databaseUrl: string) {
  const conn = await mysql.createConnection(serverUrl(databaseUrl));
  await conn.query("CREATE DATABASE IF NOT EXISTS faultline_claim");
  await conn.query("USE faultline_claim");
  await conn.query("DROP TABLE IF EXISTS marketMemory");
  await conn.query(`CREATE TABLE marketMemory (
    id int NOT NULL AUTO_INCREMENT PRIMARY KEY,
    memoryKey varchar(120) NOT NULL,
    memoryValue text NOT NULL,
    description varchar(255) NULL,
    writtenBy varchar(60) NULL,
    updatedAt timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY marketMemory_memoryKey_unique (memoryKey)
  )`);
  await conn.end();
}

function claimInProcess(databaseUrl: string, etDate: string): Promise<string> {
  const script = `
    import mysql from "mysql2/promise";
    import { drizzle } from "drizzle-orm/mysql2";
    import { claimScheduledSeismographSession } from "./server/scheduledSessionClaim.ts";
    mysql.createConnection(process.env.DISPOSABLE_DATABASE_URL).then(async (conn) => {
      const db = drizzle(conn);
      const result = await claimScheduledSeismographSession(process.env.CLAIM_ET_DATE, async () => db);
      process.stdout.write(String(result));
      await conn.end();
    }).catch((error) => {
      console.error(error);
      process.exit(1);
    });
  `;
  return new Promise((resolve, reject) => {
    const child = spawn("pnpm", ["exec", "tsx", "-e", script], {
      cwd: process.cwd(),
      env: { ...process.env, DISPOSABLE_DATABASE_URL: databaseUrl, CLAIM_ET_DATE: etDate },
    });
    let out = "";
    let err = "";
    child.stdout.on("data", chunk => { out += String(chunk); });
    child.stderr.on("data", chunk => { err += String(chunk); });
    child.on("close", code => {
      if (code !== 0) reject(new Error(err || out || `claim process exited ${code}`));
      else resolve(out.trim());
    });
  });
}

dbTest("disposable MySQL once-per-session claim", () => {
  const databaseUrl = url!;

  it("serializes parallel processes, a retry, and a new process", async () => {
    await resetTable(databaseUrl);
    const firstWave = await Promise.all([
      claimInProcess(databaseUrl, "2026-10-05"),
      claimInProcess(databaseUrl, "2026-10-05"),
      claimInProcess(databaseUrl, "2026-10-05"),
    ]);
    expect(firstWave.filter(result => result === "claimed")).toHaveLength(1);
    expect(firstWave.filter(result => result === "already_claimed")).toHaveLength(2);

    const retry = await claimInProcess(databaseUrl, "2026-10-05");
    expect(retry).toBe("already_claimed");

    const restarted = await claimInProcess(databaseUrl, "2026-10-05");
    expect(restarted).toBe("already_claimed");

    const otherSession = await claimInProcess(databaseUrl, "2026-10-06");
    expect(otherSession).toBe("claimed");
  }, 60_000);

  it("fails closed when the claim table is absent", async () => {
    const conn = await mysql.createConnection(serverUrl(databaseUrl));
    await conn.query("CREATE DATABASE IF NOT EXISTS faultline_claim");
    await conn.query("USE faultline_claim");
    await conn.query("DROP TABLE IF EXISTS marketMemory");
    await conn.end();
    const db = drizzle(databaseUrl);
    await expect(claimScheduledSeismographSession("2026-10-05", async () => db as never)).resolves.toBe("unavailable");
  });
});
