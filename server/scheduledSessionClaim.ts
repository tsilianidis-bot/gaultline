/**
 * Once-per-NYSE-session claim for the scheduled seismograph run.
 *
 * Reuses `marketMemory.memoryKey` (unique). No new table and no journal entry.
 * The first INSERT for `seismograph-scheduled-session:YYYY-MM-DD` wins. A
 * duplicate means another process already claimed that Eastern session.
 *
 * Fail-closed: if the database is missing, the table is absent, or the insert
 * fails for any reason other than a duplicate key, the claim is `unavailable`
 * and the caller must not run the pipeline or capture forward records. A claim
 * that is inserted and then followed by a crashed run stays claimed, so a
 * restart does not write a second forward record for that session.
 */
import { marketMemory } from "../drizzle/schema";
import { getDb } from "./db";

export const SCHEDULED_SEISMOGRAPH_CLAIM_PREFIX = "seismograph-scheduled-session:";

export type ScheduledSessionClaim = "claimed" | "already_claimed" | "unavailable";

type ClaimDb = NonNullable<Awaited<ReturnType<typeof getDb>>>;

export function scheduledSeismographClaimKey(etDate: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(etDate)) {
    throw new Error("Scheduled session date must be YYYY-MM-DD");
  }
  return `${SCHEDULED_SEISMOGRAPH_CLAIM_PREFIX}${etDate}`;
}

function isDuplicateKey(error: unknown): boolean {
  const seen = new Set<unknown>();
  let current: unknown = error;
  while (current && typeof current === "object" && !seen.has(current)) {
    seen.add(current);
    const candidate = current as { code?: string; errno?: number; message?: string; cause?: unknown };
    if (candidate.code === "ER_DUP_ENTRY" || candidate.errno === 1062 || /Duplicate entry/i.test(candidate.message ?? "")) {
      return true;
    }
    current = candidate.cause;
  }
  return false;
}

export async function claimScheduledSeismographSession(
  etDate: string,
  dbProvider: () => Promise<ClaimDb | null> = getDb,
): Promise<ScheduledSessionClaim> {
  let key: string;
  try {
    key = scheduledSeismographClaimKey(etDate);
  } catch {
    return "unavailable";
  }
  const db = await dbProvider().catch(() => null);
  if (!db) return "unavailable";
  try {
    await db.insert(marketMemory).values({
      memoryKey: key,
      memoryValue: JSON.stringify({
        kind: "seismograph-scheduled-session",
        etDate,
        claimedAt: new Date().toISOString(),
      }),
      description: `Scheduled seismograph once-per-session claim ${etDate}`,
      writtenBy: "scheduledSeismograph",
    });
    return "claimed";
  } catch (error) {
    if (isDuplicateKey(error)) return "already_claimed";
    return "unavailable";
  }
}
