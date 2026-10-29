import { randomBytes } from "node:crypto";
import { and, eq } from "drizzle-orm";
import {
  publishingDeliveryClaims,
  publishingRunClaims,
} from "../drizzle/publishingDeliveryClaimsSchema";
import { getDb } from "./db";

/** A short pre-generation lease may be recovered once; LLM generation itself is never retried automatically. */
export const PUBLISH_RUN_LEASE_MS = 5 * 60 * 1000;
export const PUBLISH_RUN_RETRY_DELAY_MS = 60 * 1000;
export const MAX_PUBLISH_RUN_ATTEMPTS = 2;
/** A transport request becomes non-retryable as soon as it is durably marked dispatching. */
export const DELIVERY_CLAIM_LEASE_MS = 5 * 60 * 1000;
export const DELIVERY_RETRY_DELAY_MS = 60 * 60 * 1000;
export const MAX_DELIVERY_ATTEMPTS = 3;

type ClaimDb = NonNullable<Awaited<ReturnType<typeof getDb>>>;
type DbProvider = () => Promise<ClaimDb | null>;
type RunState = "claimed" | "generating" | "completed" | "failed" | "exhausted";
type DeliveryState = "claimed" | "dispatching" | "accepted" | "rejected" | "skipped" | "exhausted" | "ambiguous";

export interface PublishingRunClaim {
  key: string;
  publishType: string;
  cycleDateEt: string;
  attemptId: string;
  attempt: number;
}

export type PublishingRunClaimResult =
  | { status: "claimed"; claim: PublishingRunClaim; mode: "initial" | "recovered" }
  | { status: "completed"; outputStatus: string | null; outputSlug: string | null }
  | { status: "in-progress" }
  | { status: "ambiguous" }
  | { status: "exhausted" }
  | { status: "unavailable" };

export interface DeliveryClaim {
  key: string;
  deliveryType: string;
  userId: number;
  attemptId: string;
  attempt: number;
}

export type DeliveryClaimResult =
  | { status: "claimed"; claim: DeliveryClaim; mode: "initial" | "recovered" }
  | { status: "completed" }
  | { status: "in-progress" }
  | { status: "rejected" }
  | { status: "ambiguous" }
  | { status: "exhausted" }
  | { status: "unavailable" };

export interface PublishingClaimStore {
  claimRun(input: { publishType: string; cycleDateEt: string; nowMs?: number }): Promise<PublishingRunClaimResult>;
  beginGeneration(claim: PublishingRunClaim, nowMs?: number): Promise<boolean>;
  failRunBeforeGeneration(claim: PublishingRunClaim, reason: string, nowMs?: number): Promise<boolean>;
  completeRunWithoutGeneration(claim: PublishingRunClaim, outcome: { outputStatus: string; outputSlug?: string | null }, nowMs?: number): Promise<boolean>;
  finalizeRun<T>(
    claim: PublishingRunClaim,
    outcome: { outputStatus: string; outputSlug?: string | null },
    persist: (tx: any) => Promise<T>,
    nowMs?: number,
  ): Promise<{ status: "completed"; value: T } | { status: "stale" | "unavailable" }>;
  claimDelivery(input: { deliveryKey: string; deliveryType: string; userId: number; nowMs?: number }): Promise<DeliveryClaimResult>;
  beginDeliveryDispatch(claim: DeliveryClaim, nowMs?: number): Promise<boolean>;
  markDeliveryAccepted(claim: DeliveryClaim, nowMs?: number): Promise<boolean>;
  markDeliveryRejected(claim: DeliveryClaim, reason: string, nowMs?: number): Promise<"rejected" | "exhausted" | "stale" | "unavailable">;
  markDeliverySkipped(claim: DeliveryClaim, nowMs?: number): Promise<boolean>;
  markDeliveryAmbiguous(claim: DeliveryClaim, reason: string, nowMs?: number): Promise<boolean>;
}

function affectedRows(result: unknown): number {
  const header = Array.isArray(result) ? result[0] : result;
  if (!header || typeof header !== "object") return 0;
  const value = header as { affectedRows?: number; rowsAffected?: number };
  return value.affectedRows ?? value.rowsAffected ?? 0;
}

function isDuplicateKey(error: unknown): boolean {
  const seen = new Set<unknown>();
  let current: unknown = error;
  while (current && typeof current === "object" && !seen.has(current)) {
    seen.add(current);
    const value = current as { code?: string; errno?: number; message?: string; cause?: unknown };
    if (value.code === "ER_DUP_ENTRY" || value.errno === 1062 || /Duplicate entry/i.test(value.message ?? "")) return true;
    current = value.cause;
  }
  return false;
}

function attemptId(): string {
  return randomBytes(16).toString("hex");
}

function dateAt(nowMs: number): Date {
  return new Date(nowMs);
}

function isExpired(value: Date | string | null | undefined, nowMs: number): boolean {
  const time = value instanceof Date ? value.getTime() : Date.parse(value ?? "");
  return Number.isFinite(time) && time <= nowMs;
}

function isReady(value: Date | string | null | undefined, nowMs: number): boolean {
  return isExpired(value, nowMs);
}

function validRunInput(publishType: string, cycleDateEt: string): boolean {
  return /^(daily_brief|weekly_review|monthly_report)$/.test(publishType)
    && /^\d{4}-\d{2}-\d{2}$/.test(cycleDateEt);
}

function validDeliveryInput(deliveryKey: string, deliveryType: string, userId: number): boolean {
  return deliveryKey.length > 0 && deliveryKey.length <= 220
    && deliveryType.length > 0 && deliveryType.length <= 48
    && Number.isSafeInteger(userId) && userId > 0;
}

function runKey(publishType: string, cycleDateEt: string): string {
  return `${publishType}:${cycleDateEt}`;
}

/**
 * A database-backed state machine. It is injectable so tests can use a private
 * disposable MariaDB and callers cannot fall back to process-local memory.
 */
export function createPublishingClaimStore(dbProvider: DbProvider = getDb): PublishingClaimStore {
  async function database(): Promise<ClaimDb | null> {
    return await dbProvider().catch(() => null);
  }

  async function getRun(db: ClaimDb, key: string) {
    const rows = await db.select().from(publishingRunClaims)
      .where(eq(publishingRunClaims.runKey, key)).limit(1);
    return rows[0] ?? null;
  }

  async function getDelivery(db: ClaimDb, key: string) {
    const rows = await db.select().from(publishingDeliveryClaims)
      .where(eq(publishingDeliveryClaims.deliveryKey, key)).limit(1);
    return rows[0] ?? null;
  }

  async function claimRun(input: { publishType: string; cycleDateEt: string; nowMs?: number }): Promise<PublishingRunClaimResult> {
    if (!validRunInput(input.publishType, input.cycleDateEt)) return { status: "unavailable" };
    const db = await database();
    if (!db) return { status: "unavailable" };
    const nowMs = input.nowMs ?? Date.now();
    const key = runKey(input.publishType, input.cycleDateEt);
    const firstAttemptId = attemptId();
    try {
      await db.insert(publishingRunClaims).values({
        runKey: key,
        publishType: input.publishType,
        cycleDateEt: input.cycleDateEt,
        state: "claimed",
        attemptId: firstAttemptId,
        attempt: 1,
        leaseExpiresAt: dateAt(nowMs + PUBLISH_RUN_LEASE_MS),
        retryAfter: null,
        failureReason: null,
      });
      return {
        status: "claimed",
        mode: "initial",
        claim: { key, publishType: input.publishType, cycleDateEt: input.cycleDateEt, attemptId: firstAttemptId, attempt: 1 },
      };
    } catch (error) {
      if (!isDuplicateKey(error)) return { status: "unavailable" };
    }

    // A duplicate insert is expected under overlapping callbacks. Reclaim only
    // a pre-generation/explicitly-rejected claim; never a generating run.
    for (let race = 0; race < 2; race += 1) {
      let existing: Awaited<ReturnType<typeof getRun>>;
      try {
        existing = await getRun(db, key);
      } catch {
        return { status: "unavailable" };
      }
      if (!existing) return { status: "unavailable" };
      const state = existing.state as RunState;
      if (state === "completed") {
        return { status: "completed", outputStatus: existing.outputStatus ?? null, outputSlug: existing.outputSlug ?? null };
      }
      if (state === "generating") return { status: "ambiguous" };
      if (state === "exhausted") return { status: "exhausted" };
      const canRecover = state === "claimed"
        ? isExpired(existing.leaseExpiresAt, nowMs)
        : state === "failed" && isReady(existing.retryAfter, nowMs);
      if (!canRecover) return { status: "in-progress" };
      if (existing.attempt >= MAX_PUBLISH_RUN_ATTEMPTS) {
        try {
          const exhausted = await db.update(publishingRunClaims).set({
            state: "exhausted",
            leaseExpiresAt: null,
            retryAfter: null,
            failureReason: "publish-run-recovery-exhausted",
          }).where(and(
            eq(publishingRunClaims.runKey, key),
            eq(publishingRunClaims.attemptId, existing.attemptId),
            eq(publishingRunClaims.state, state),
          ));
          if (affectedRows(exhausted) === 1) return { status: "exhausted" };
          continue;
        } catch {
          return { status: "unavailable" };
        }
      }
      const recoveredAttemptId = attemptId();
      try {
        const recovered = await db.update(publishingRunClaims).set({
          state: "claimed",
          attemptId: recoveredAttemptId,
          attempt: existing.attempt + 1,
          leaseExpiresAt: dateAt(nowMs + PUBLISH_RUN_LEASE_MS),
          retryAfter: null,
          failureReason: null,
        }).where(and(
          eq(publishingRunClaims.runKey, key),
          eq(publishingRunClaims.attemptId, existing.attemptId),
          eq(publishingRunClaims.state, state),
        ));
        if (affectedRows(recovered) === 1) {
          return {
            status: "claimed",
            mode: "recovered",
            claim: { key, publishType: input.publishType, cycleDateEt: input.cycleDateEt, attemptId: recoveredAttemptId, attempt: existing.attempt + 1 },
          };
        }
      } catch {
        return { status: "unavailable" };
      }
    }
    return { status: "in-progress" };
  }

  async function beginGeneration(claim: PublishingRunClaim, nowMs = Date.now()): Promise<boolean> {
    const db = await database();
    if (!db) return false;
    try {
      const result = await db.update(publishingRunClaims).set({
        state: "generating",
        leaseExpiresAt: dateAt(nowMs + PUBLISH_RUN_LEASE_MS),
        retryAfter: null,
      }).where(and(
        eq(publishingRunClaims.runKey, claim.key),
        eq(publishingRunClaims.attemptId, claim.attemptId),
        eq(publishingRunClaims.state, "claimed"),
      ));
      return affectedRows(result) === 1;
    } catch {
      return false;
    }
  }

  async function failRunBeforeGeneration(claim: PublishingRunClaim, reason: string, nowMs = Date.now()): Promise<boolean> {
    const db = await database();
    if (!db) return false;
    try {
      const result = await db.update(publishingRunClaims).set({
        state: "failed",
        leaseExpiresAt: null,
        retryAfter: dateAt(nowMs + PUBLISH_RUN_RETRY_DELAY_MS),
        failureReason: reason.slice(0, 255),
      }).where(and(
        eq(publishingRunClaims.runKey, claim.key),
        eq(publishingRunClaims.attemptId, claim.attemptId),
        eq(publishingRunClaims.state, "claimed"),
      ));
      return affectedRows(result) === 1;
    } catch {
      return false;
    }
  }

  async function completeRunWithoutGeneration(
    claim: PublishingRunClaim,
    outcome: { outputStatus: string; outputSlug?: string | null },
    nowMs = Date.now(),
  ): Promise<boolean> {
    const db = await database();
    if (!db) return false;
    try {
      const result = await db.update(publishingRunClaims).set({
        state: "completed",
        leaseExpiresAt: null,
        retryAfter: null,
        outputStatus: outcome.outputStatus,
        outputSlug: outcome.outputSlug ?? null,
        completedAt: dateAt(nowMs),
      }).where(and(
        eq(publishingRunClaims.runKey, claim.key),
        eq(publishingRunClaims.attemptId, claim.attemptId),
        eq(publishingRunClaims.state, "claimed"),
      ));
      return affectedRows(result) === 1;
    } catch {
      return false;
    }
  }

  async function finalizeRun<T>(
    claim: PublishingRunClaim,
    outcome: { outputStatus: string; outputSlug?: string | null },
    persist: (tx: any) => Promise<T>,
    nowMs = Date.now(),
  ): Promise<{ status: "completed"; value: T } | { status: "stale" | "unavailable" }> {
    const db = await database();
    if (!db) return { status: "unavailable" };
    try {
      return await db.transaction(async (tx: any) => {
        const result = await tx.update(publishingRunClaims).set({
          state: "completed",
          leaseExpiresAt: null,
          retryAfter: null,
          outputStatus: outcome.outputStatus,
          outputSlug: outcome.outputSlug ?? null,
          completedAt: dateAt(nowMs),
        }).where(and(
          eq(publishingRunClaims.runKey, claim.key),
          eq(publishingRunClaims.attemptId, claim.attemptId),
          eq(publishingRunClaims.state, "generating"),
        ));
        if (affectedRows(result) !== 1) return { status: "stale" } as const;
        const value = await persist(tx);
        return { status: "completed", value } as const;
      });
    } catch {
      // Do not convert a possible remote generation into a retryable claim.
      // The row remains `generating` unless this transaction committed.
      return { status: "unavailable" };
    }
  }

  async function claimDelivery(input: { deliveryKey: string; deliveryType: string; userId: number; nowMs?: number }): Promise<DeliveryClaimResult> {
    if (!validDeliveryInput(input.deliveryKey, input.deliveryType, input.userId)) return { status: "unavailable" };
    const db = await database();
    if (!db) return { status: "unavailable" };
    const nowMs = input.nowMs ?? Date.now();
    const firstAttemptId = attemptId();
    try {
      await db.insert(publishingDeliveryClaims).values({
        deliveryKey: input.deliveryKey,
        deliveryType: input.deliveryType,
        userId: input.userId,
        state: "claimed",
        attemptId: firstAttemptId,
        attempt: 1,
        leaseExpiresAt: dateAt(nowMs + DELIVERY_CLAIM_LEASE_MS),
        retryAfter: null,
        failureReason: null,
      });
      return {
        status: "claimed",
        mode: "initial",
        claim: { key: input.deliveryKey, deliveryType: input.deliveryType, userId: input.userId, attemptId: firstAttemptId, attempt: 1 },
      };
    } catch (error) {
      if (!isDuplicateKey(error)) return { status: "unavailable" };
    }

    for (let race = 0; race < 2; race += 1) {
      let existing: Awaited<ReturnType<typeof getDelivery>>;
      try {
        existing = await getDelivery(db, input.deliveryKey);
      } catch {
        return { status: "unavailable" };
      }
      if (!existing) return { status: "unavailable" };
      const state = existing.state as DeliveryState;
      if (state === "accepted" || state === "skipped") return { status: "completed" };
      if (state === "dispatching" || state === "ambiguous") return { status: "ambiguous" };
      if (state === "exhausted") return { status: "exhausted" };
      const canRecover = state === "claimed"
        ? isExpired(existing.leaseExpiresAt, nowMs)
        : state === "rejected" && isReady(existing.retryAfter, nowMs);
      if (!canRecover) return state === "rejected" ? { status: "rejected" } : { status: "in-progress" };
      if (existing.attempt >= MAX_DELIVERY_ATTEMPTS) {
        try {
          const exhausted = await db.update(publishingDeliveryClaims).set({
            state: "exhausted",
            leaseExpiresAt: null,
            retryAfter: null,
            failureReason: "delivery-recovery-exhausted",
          }).where(and(
            eq(publishingDeliveryClaims.deliveryKey, input.deliveryKey),
            eq(publishingDeliveryClaims.attemptId, existing.attemptId),
            eq(publishingDeliveryClaims.state, state),
          ));
          if (affectedRows(exhausted) === 1) return { status: "exhausted" };
          continue;
        } catch {
          return { status: "unavailable" };
        }
      }
      const recoveredAttemptId = attemptId();
      try {
        const recovered = await db.update(publishingDeliveryClaims).set({
          state: "claimed",
          attemptId: recoveredAttemptId,
          attempt: existing.attempt + 1,
          leaseExpiresAt: dateAt(nowMs + DELIVERY_CLAIM_LEASE_MS),
          retryAfter: null,
          failureReason: null,
        }).where(and(
          eq(publishingDeliveryClaims.deliveryKey, input.deliveryKey),
          eq(publishingDeliveryClaims.attemptId, existing.attemptId),
          eq(publishingDeliveryClaims.state, state),
        ));
        if (affectedRows(recovered) === 1) {
          return {
            status: "claimed",
            mode: "recovered",
            claim: { key: input.deliveryKey, deliveryType: input.deliveryType, userId: input.userId, attemptId: recoveredAttemptId, attempt: existing.attempt + 1 },
          };
        }
      } catch {
        return { status: "unavailable" };
      }
    }
    return { status: "in-progress" };
  }

  async function beginDeliveryDispatch(claim: DeliveryClaim, nowMs = Date.now()): Promise<boolean> {
    const db = await database();
    if (!db) return false;
    try {
      const result = await db.update(publishingDeliveryClaims).set({
        state: "dispatching",
        leaseExpiresAt: dateAt(nowMs + DELIVERY_CLAIM_LEASE_MS),
        retryAfter: null,
      }).where(and(
        eq(publishingDeliveryClaims.deliveryKey, claim.key),
        eq(publishingDeliveryClaims.attemptId, claim.attemptId),
        eq(publishingDeliveryClaims.state, "claimed"),
      ));
      return affectedRows(result) === 1;
    } catch {
      return false;
    }
  }

  async function markDeliveryAccepted(claim: DeliveryClaim, nowMs = Date.now()): Promise<boolean> {
    const db = await database();
    if (!db) return false;
    try {
      const result = await db.update(publishingDeliveryClaims).set({
        state: "accepted",
        leaseExpiresAt: null,
        retryAfter: null,
        providerAcceptedAt: dateAt(nowMs),
        failureReason: null,
      }).where(and(
        eq(publishingDeliveryClaims.deliveryKey, claim.key),
        eq(publishingDeliveryClaims.attemptId, claim.attemptId),
        eq(publishingDeliveryClaims.state, "dispatching"),
      ));
      return affectedRows(result) === 1;
    } catch {
      return false;
    }
  }

  async function markDeliveryRejected(claim: DeliveryClaim, reason: string, nowMs = Date.now()): Promise<"rejected" | "exhausted" | "stale" | "unavailable"> {
    const db = await database();
    if (!db) return "unavailable";
    const state: DeliveryState = claim.attempt >= MAX_DELIVERY_ATTEMPTS ? "exhausted" : "rejected";
    try {
      const result = await db.update(publishingDeliveryClaims).set({
        state,
        leaseExpiresAt: null,
        retryAfter: state === "rejected" ? dateAt(nowMs + DELIVERY_RETRY_DELAY_MS) : null,
        failureReason: reason.slice(0, 255),
      }).where(and(
        eq(publishingDeliveryClaims.deliveryKey, claim.key),
        eq(publishingDeliveryClaims.attemptId, claim.attemptId),
        eq(publishingDeliveryClaims.state, "dispatching"),
      ));
      if (affectedRows(result) !== 1) return "stale";
      return state;
    } catch {
      return "unavailable";
    }
  }

  async function markDeliverySkipped(claim: DeliveryClaim, nowMs = Date.now()): Promise<boolean> {
    const db = await database();
    if (!db) return false;
    try {
      const result = await db.update(publishingDeliveryClaims).set({
        state: "skipped",
        leaseExpiresAt: null,
        retryAfter: null,
        providerAcceptedAt: null,
        failureReason: "policy-skipped-no-transport",
      }).where(and(
        eq(publishingDeliveryClaims.deliveryKey, claim.key),
        eq(publishingDeliveryClaims.attemptId, claim.attemptId),
        eq(publishingDeliveryClaims.state, "claimed"),
      ));
      return affectedRows(result) === 1;
    } catch {
      return false;
    }
  }

  async function markDeliveryAmbiguous(claim: DeliveryClaim, reason: string, _nowMs = Date.now()): Promise<boolean> {
    const db = await database();
    if (!db) return false;
    try {
      const result = await db.update(publishingDeliveryClaims).set({
        state: "ambiguous",
        leaseExpiresAt: null,
        retryAfter: null,
        failureReason: reason.slice(0, 255),
      }).where(and(
        eq(publishingDeliveryClaims.deliveryKey, claim.key),
        eq(publishingDeliveryClaims.attemptId, claim.attemptId),
        eq(publishingDeliveryClaims.state, "dispatching"),
      ));
      return affectedRows(result) === 1;
    } catch {
      return false;
    }
  }

  return {
    claimRun,
    beginGeneration,
    failRunBeforeGeneration,
    completeRunWithoutGeneration,
    finalizeRun,
    claimDelivery,
    beginDeliveryDispatch,
    markDeliveryAccepted,
    markDeliveryRejected,
    markDeliverySkipped,
    markDeliveryAmbiguous,
  };
}

export const publishingClaimStore = createPublishingClaimStore();

export interface EmailTransportResult {
  success: boolean;
  error?: string;
}

export type ClaimedEmailDispatchResult =
  | { status: "accepted" }
  | { status: "rejected" | "exhausted" | "completed" | "in-progress" | "ambiguous" | "unavailable" };

/**
 * The transport callback is intentionally injected. A remote send is invoked
 * only after a durable `dispatching` transition. A throw or an acceptance that
 * cannot be persisted is held for reconciliation, never retried automatically.
 */
export async function dispatchEmailWithClaim(
  store: PublishingClaimStore,
  input: { deliveryKey: string; deliveryType: string; userId: number; send: () => Promise<EmailTransportResult>; nowMs?: number },
): Promise<ClaimedEmailDispatchResult> {
  const claimed = await store.claimDelivery(input);
  if (claimed.status !== "claimed") {
    return { status: claimed.status === "completed" ? "completed" : claimed.status };
  }
  const claim = claimed.claim;
  if (!await store.beginDeliveryDispatch(claim, input.nowMs)) return { status: "unavailable" };
  let response: EmailTransportResult;
  try {
    response = await input.send();
  } catch (error) {
    await store.markDeliveryAmbiguous(claim, `transport-threw:${error instanceof Error ? error.message : String(error)}`, input.nowMs).catch(() => false);
    return { status: "ambiguous" };
  }
  if (response.success) {
    const accepted = await store.markDeliveryAccepted(claim, input.nowMs).catch(() => false);
    // If this write fails, the existing durable `dispatching` record is itself
    // the ambiguity fence. It must not be converted into an automatic retry.
    return accepted ? { status: "accepted" } : { status: "ambiguous" };
  }
  const rejected = await store.markDeliveryRejected(claim, response.error ?? "transport-rejected", input.nowMs);
  // A stale fence after the transport boundary cannot safely be treated as
  // retryable, even when this response explicitly reported rejection.
  return { status: rejected === "stale" ? "ambiguous" : rejected };
}

export function onboardingDeliveryKey(step: number, userId: number): string {
  if (!Number.isInteger(step) || step < 1 || step > 3 || !Number.isSafeInteger(userId) || userId <= 0) {
    throw new Error("Onboarding delivery key requires a supported step and positive user ID");
  }
  return `onboarding:${step}:user:${userId}`;
}

export function briefDeliveryKey(slug: string, userId: number): string {
  if (!/^[a-z0-9-]{1,180}$/.test(slug) || !Number.isSafeInteger(userId) || userId <= 0) {
    throw new Error("Brief delivery key requires a safe article slug and positive user ID");
  }
  return `brief:${slug}:user:${userId}`;
}
