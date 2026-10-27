/**
 * Append-only Pentagonal Thesis records.
 * Writes stay off unless PENTAGONAL_THESIS_RECORD_WRITES is exactly "true".
 * Recorded forecasts are insert-only. Outcome scoring is not implemented.
 */
import { and, desc, eq } from "drizzle-orm";
import { createHash, randomUUID } from "node:crypto";
import { pentagonalThesisRecords } from "../drizzle/schema";
import type { PentagonalThesis, ThesisPersistenceStatus, ThesisRecordPlan } from "../shared/pentagonalThesis";
import { findThesisIntegrityViolations, nextThesisRecord, scoreThesisOutcome, stableThesisPayload } from "../shared/pentagonalThesis";
import { getDb } from "./db";

export function thesisContentHash(thesis: PentagonalThesis): string {
  return createHash("sha256").update(stableThesisPayload(thesis)).digest("hex");
}

/**
 * A new thesis must append. Reusing the prior record id, keeping the same
 * version, or dropping the supersedes link would rewrite the stored row.
 */
export function assertAppendOnlyPlan(
  prior: { recordId: string; thesisVersion: number; payloadJson: string } | null,
  plan: ThesisRecordPlan,
): void {
  if (!prior) return;
  const reusesRow = plan.recordId === prior.recordId;
  const versionNotAdvanced = plan.thesisVersion !== prior.thesisVersion + 1;
  const dropsLink = plan.supersedesRecordId !== prior.recordId;
  const editsStoredPayload = plan.payloadJson === prior.payloadJson && plan.thesisVersion === prior.thesisVersion;
  if (reusesRow || versionNotAdvanced || dropsLink || editsStoredPayload) {
    throw new Error("Refusing to rewrite a prior thesis payload.");
  }
}

export function planAppendOnlyRecord(
  prior: { recordId: string; thesisVersion: number; payloadJson: string } | null,
  thesis: PentagonalThesis,
  recordId: string,
): ThesisRecordPlan {
  const stored = prior
    ? { recordId: prior.recordId, thesisVersion: prior.thesisVersion, payloadJson: prior.payloadJson }
    : null;
  const plan = nextThesisRecord(stored, thesis, recordId, thesisContentHash(thesis));
  if (stored && prior && prior.payloadJson !== stored.payloadJson) {
    throw new Error("Refusing to rewrite a prior thesis payload.");
  }
  assertAppendOnlyPlan(stored, plan);
  if (findThesisIntegrityViolations(thesis).length > 0) {
    throw new Error("Refusing to record a thesis that failed the integrity check.");
  }
  return plan;
}

export function thesisRecordWritesEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.PENTAGONAL_THESIS_RECORD_WRITES === "true";
}

export async function maybeAppendThesisRecord(
  thesis: PentagonalThesis,
  env: NodeJS.ProcessEnv = process.env,
): Promise<ThesisPersistenceStatus> {
  if (!thesisRecordWritesEnabled(env)) {
    return { written: false, reason: "PENTAGONAL_THESIS_RECORD_WRITES is off" };
  }
  if (!thesis.integrity.ok) {
    return { written: false, reason: "Thesis failed integrity checks and was not recorded." };
  }
  const db = await getDb();
  if (!db) return { written: false, reason: "Database unavailable. The thesis was computed and not recorded." };

  const priorRows = await db.select({
    recordId: pentagonalThesisRecords.recordId,
    thesisVersion: pentagonalThesisRecords.thesisVersion,
    payloadJson: pentagonalThesisRecords.payloadJson,
  }).from(pentagonalThesisRecords)
    .where(and(eq(pentagonalThesisRecords.scopeKind, thesis.scope), eq(pentagonalThesisRecords.symbol, thesis.symbol)))
    .orderBy(desc(pentagonalThesisRecords.thesisVersion))
    .limit(1);
  const prior = priorRows[0] ?? null;
  const plan = planAppendOnlyRecord(prior, thesis, randomUUID());
  await db.insert(pentagonalThesisRecords).values({
    recordId: plan.recordId,
    scopeKind: plan.scopeKind,
    symbol: plan.symbol,
    thesisVersion: plan.thesisVersion,
    supersedesRecordId: plan.supersedesRecordId,
    engineVersion: plan.engineVersion,
    contentHash: plan.contentHash,
    payloadJson: plan.payloadJson,
    generatedAt: new Date(plan.generatedAt),
  });
  return {
    written: true,
    reason: "Appended a new immutable thesis version.",
    recordId: plan.recordId,
    thesisVersion: plan.thesisVersion,
    supersedesRecordId: plan.supersedesRecordId,
  };
}

/** Reserved for a later, separate review. Calling it records nothing. */
export function requestThesisOutcomeScore(): never {
  return scoreThesisOutcome();
}
