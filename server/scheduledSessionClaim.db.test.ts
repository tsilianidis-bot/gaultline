/**
 * Disposable-database proof for the once-per-session claim.
 * Set DISPOSABLE_DATABASE_URL to an empty local MySQL/MariaDB. This file does
 * not read production DATABASE_URL and does not migrate the journal.
 */
import { spawn } from "node:child_process";
import { describe, expect, it } from "vitest";
import mysql from "mysql2/promise";
import { drizzle } from "drizzle-orm/mysql2";
import { and, notLike } from "drizzle-orm";
import { marketMemory } from "../drizzle/schema";
import {
  admitScheduledSessionOutcome,
  claimScheduledSeismographSession,
  completeScheduledSession,
  failScheduledSession,
  reconcileScheduledSessionScore,
} from "./scheduledSessionClaim";

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

function claimInProcess(databaseUrl: string, etDate: string, options: { nowMs?: number; trigger?: string } = {}): Promise<string> {
  const script = `
    import mysql from "mysql2/promise";
    import { drizzle } from "drizzle-orm/mysql2";
    import { claimScheduledSeismographSession } from "./server/scheduledSessionClaim.ts";
    mysql.createConnection(process.env.DISPOSABLE_DATABASE_URL).then(async (conn) => {
      const db = drizzle(conn);
      const result = await claimScheduledSeismographSession(process.env.CLAIM_ET_DATE, async () => db, {
        nowMs: process.env.CLAIM_NOW ? Number(process.env.CLAIM_NOW) : undefined,
        trigger: process.env.CLAIM_TRIGGER || undefined,
      });
      process.stdout.write(JSON.stringify(result));
      await conn.end();
    }).catch((error) => {
      console.error(error);
      process.exit(1);
    });
  `;
  return new Promise((resolve, reject) => {
    const child = spawn("pnpm", ["exec", "tsx", "-e", script], {
      cwd: process.cwd(),
      env: {
        ...process.env,
        DISPOSABLE_DATABASE_URL: databaseUrl,
        CLAIM_ET_DATE: etDate,
        CLAIM_NOW: options.nowMs == null ? "" : String(options.nowMs),
        CLAIM_TRIGGER: options.trigger ?? "",
      },
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
    const parsed = firstWave.map(result => JSON.parse(result) as { status: string });
    expect(parsed.filter(result => result.status === "claimed")).toHaveLength(1);
    expect(parsed.filter(result => result.status === "already_claimed")).toHaveLength(2);

    const retry = JSON.parse(await claimInProcess(databaseUrl, "2026-10-05")) as { status: string };
    expect(retry.status).toBe("already_claimed");

    const restarted = JSON.parse(await claimInProcess(databaseUrl, "2026-10-05")) as { status: string };
    expect(restarted.status).toBe("already_claimed");

    const otherSession = JSON.parse(await claimInProcess(databaseUrl, "2026-10-06")) as { status: string };
    expect(otherSession.status).toBe("claimed");
  }, 60_000);

  it("fails closed when the claim table is absent", async () => {
    const conn = await mysql.createConnection(serverUrl(databaseUrl));
    await conn.query("CREATE DATABASE IF NOT EXISTS faultline_claim");
    await conn.query("USE faultline_claim");
    await conn.query("DROP TABLE IF EXISTS marketMemory");
    await conn.end();
    const missing = await mysql.createConnection(databaseUrl);
    const db = drizzle(missing);
    await expect(claimScheduledSeismographSession("2026-10-05", async () => db as never)).resolves.toEqual({ status: "unavailable" });
    await missing.end();
  });

  it("recovers one failed claim inside the window and hides the keys", async () => {
    await resetTable(databaseUrl);
    const conn = await mysql.createConnection(databaseUrl);
    const db = drizzle(conn);
    const provider = async () => db as never;
    const now = Date.parse("2026-10-05T20:20:00.000Z");
    const first = await claimScheduledSeismographSession("2026-10-05", provider, { nowMs: now });
    expect(first.status).toBe("claimed");
    const retryWhileLeased = await claimScheduledSeismographSession("2026-10-05", provider, { nowMs: now + 1000, trigger: "SCHEDULED_CRON" });
    expect(retryWhileLeased.status).toBe("already_claimed");
    await expect(failScheduledSession("2026-10-05", first.generation!, provider, now)).resolves.toBe(true);
    await conn.end();

    const wave = await Promise.all([
      claimInProcess(databaseUrl, "2026-10-05", { nowMs: now + 2000, trigger: "SCHEDULED_CRON" }),
      claimInProcess(databaseUrl, "2026-10-05", { nowMs: now + 2000, trigger: "SCHEDULED_CRON" }),
    ]);
    const recovered = wave.map(result => JSON.parse(result) as { status: string; mode?: string });
    expect(recovered.filter(result => result.status === "claimed" && result.mode === "recovered")).toHaveLength(1);
    expect(recovered.filter(result => result.status === "already_claimed")).toHaveLength(1);

    const after = await mysql.createConnection(databaseUrl);
    const afterDb = drizzle(after);
    const outside = await claimScheduledSeismographSession("2026-10-06", async () => afterDb as never, { nowMs: now });
    await completeScheduledSession("2026-10-06", outside.generation!, async () => afterDb as never, now);
    await expect(claimScheduledSeismographSession("2026-10-06", async () => afterDb as never, {
      nowMs: now + 1000,
      trigger: "SCHEDULED_CRON",
    })).resolves.toMatchObject({ status: "already_claimed" });

    const blocked = await claimScheduledSeismographSession("2026-10-07", async () => afterDb as never, { nowMs: Date.parse("2026-10-07T20:20:00.000Z") });
    await admitScheduledSessionOutcome("2026-10-07", { pressureScore: 41, regime: "MODERATE RISK" }, async () => afterDb as never);
    await failScheduledSession("2026-10-07", blocked.generation!, async () => afterDb as never);
    await expect(claimScheduledSeismographSession("2026-10-07", async () => afterDb as never, {
      nowMs: Date.parse("2026-10-07T20:20:00.000Z") + 1000,
      trigger: "SCHEDULED_CRON",
    })).resolves.toMatchObject({ status: "reconcile" });

    const listed = await afterDb.select().from(marketMemory).where(and(
      notLike(marketMemory.memoryKey, "seismograph-scheduled-session:%"),
      notLike(marketMemory.memoryKey, "seismograph-scheduled-outcome:%"),
    ));
    expect(listed.some(row => String(row.memoryKey).startsWith("seismograph-scheduled-"))).toBe(false);
    const hidden = await afterDb.select().from(marketMemory);
    expect(hidden.some(row => String(row.memoryKey).startsWith("seismograph-scheduled-session:"))).toBe(true);
    await after.end();
  }, 60_000);

  it("caps recovery at one generation under concurrent callers", async () => {
    await resetTable(databaseUrl);
    const now = Date.parse("2026-10-05T20:20:00.000Z");
    const conn = await mysql.createConnection(databaseUrl);
    const db = drizzle(conn);
    const provider = async () => db as never;
    const first = await claimScheduledSeismographSession("2026-10-05", provider, { nowMs: now });
    await failScheduledSession("2026-10-05", first.generation!, provider, now);
    const recovered = await claimScheduledSeismographSession("2026-10-05", provider, { nowMs: now + 1000, trigger: "SCHEDULED_CRON" });
    expect(recovered).toMatchObject({ status: "claimed", generation: 2 });
    await failScheduledSession("2026-10-05", 2, provider, now + 1000);
    await conn.end();
    const wave = await Promise.all([
      claimInProcess(databaseUrl, "2026-10-05", { nowMs: now + 2000, trigger: "SCHEDULED_CRON" }),
      claimInProcess(databaseUrl, "2026-10-05", { nowMs: now + 2000, trigger: "SCHEDULED_CRON" }),
    ]);
    const parsed = wave.map(result => JSON.parse(result) as { status: string });
    expect(parsed.every(result => result.status === "exhausted")).toBe(true);
  }, 60_000);

  it("finishes one score after a crash and refuses a second write", async () => {
    await resetTable(databaseUrl);
    const now = Date.parse("2026-10-05T20:20:00.000Z");
    const conn = await mysql.createConnection(databaseUrl);
    const db = drizzle(conn);
    const provider = async () => db as never;
    const claimed = await claimScheduledSeismographSession("2026-10-05", provider, { nowMs: now });
    await admitScheduledSessionOutcome("2026-10-05", { pressureScore: 44, regime: "MODERATE RISK" }, provider, now);
    await failScheduledSession("2026-10-05", claimed.generation!, provider, now);
    let writes = 0;
    const options = {
      nowMs: now + 1000,
      trigger: "SCHEDULED_CRON",
      evidenceVerified: true,
      readingExists: async () => writes > 0,
      recordScore: async () => { writes += 1; },
    };
    const second = await mysql.createConnection(databaseUrl);
    const secondDb = drizzle(second);
    const wave = await Promise.all([
      reconcileScheduledSessionScore("2026-10-05", provider, options),
      reconcileScheduledSessionScore("2026-10-05", async () => secondDb as never, options),
    ]);
    await second.end();
    expect(writes).toBe(1);
    expect(wave.filter(result => result === "scored")).toHaveLength(1);
    await conn.end();
  }, 60_000);

  it("marks a pending outcome unrecoverable after the window closes", async () => {
    await resetTable(databaseUrl);
    const now = Date.parse("2026-10-05T20:20:00.000Z");
    const conn = await mysql.createConnection(databaseUrl);
    const db = drizzle(conn);
    const provider = async () => db as never;
    const claimed = await claimScheduledSeismographSession("2026-10-05", provider, { nowMs: now });
    await admitScheduledSessionOutcome("2026-10-05", { pressureScore: 44, regime: "MODERATE RISK" }, provider, now);
    await failScheduledSession("2026-10-05", claimed.generation!, provider, now);
    const late = await claimScheduledSeismographSession("2026-10-05", provider, {
      nowMs: Date.parse("2026-10-05T21:00:00.000Z"),
      trigger: "SCHEDULED_CRON",
    });
    expect(late.status).toBe("already_claimed");
    const rows = await db.select().from(marketMemory);
    const outcome = rows.find(row => String(row.memoryKey).includes("outcome"));
    expect(String(outcome?.memoryValue)).toContain("skipped: unrecoverable");
    await conn.end();
  }, 60_000);
});
