import { and, desc, eq, lt, sql } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { getDb } from "./db";
import {
  cryptoWatchlist,
  foundingAccessRequests,
  featureFlags,
  mobileWatchlist,
  positions,
  shadowStressAnnotations,
  users,
} from "../drizzle/schema";
import { adminAuditEvents } from "../drizzle/ownerAdminAuditSchema";

export type AdminAuditAction =
  | "FEATURE_FLAG_UPDATED"
  | "USER_TIER_UPDATED"
  | "FOUNDING_REQUEST_STATUS_UPDATED"
  | "USER_REMOVED"
  | "STRESS_ANNOTATION_CREATED"
  | "FOUNDING_APPROVAL_EMAIL_ATTEMPTED"
  | "FOUNDING_APPROVAL_EMAIL_RESULT_RECORDED";

export type AdminAuditOutcome = "SUCCEEDED" | "FAILED" | "ATTEMPTED";

type Tier = "free" | "core" | "premium" | "founding";
type FoundingStatus = "pending" | "approved" | "rejected";
type StressSeverity = "low" | "moderate" | "high" | "critical";
type AuditPrimitive = string | number | boolean | null;
type SafeAuditState = Readonly<Record<string, AuditPrimitive>>;
type ApprovalEmailDisposition = "NONE" | "ACCEPTED" | "AMBIGUOUS";

type AdminAuditDb = NonNullable<Awaited<ReturnType<typeof getDb>>>;
type AdminAuditTransaction = Parameters<Parameters<AdminAuditDb["transaction"]>[0]>[0];

export type AdminAuditDbProvider = () => Promise<AdminAuditDb | null>;

export class AdminAuditPersistenceError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message);
    this.name = "AdminAuditPersistenceError";
  }
}

export class AdminAuditNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AdminAuditNotFoundError";
  }
}

export class AdminAuditGuardError extends Error {
  constructor(
    message: string,
    public readonly code: "BAD_REQUEST" | "FORBIDDEN" | "CONFLICT",
  ) {
    super(message);
    this.name = "AdminAuditGuardError";
  }
}

/**
 * The initial before-effect record exists but no immutable adapter result is
 * available. The correlation value is generated server-side and contains no
 * recipient or other personal data; it is safe to show to the authorized
 * administrator who must reconcile the attempt rather than send blindly again.
 */
export class AdminAuditAmbiguousResultError extends Error {
  constructor(public readonly correlationId: string, public readonly cause?: unknown) {
    super(`Approval email result is ambiguous; do not retry. Audit correlation: ${correlationId}.`);
    this.name = "AdminAuditAmbiguousResultError";
  }
}

interface PendingAuditEvent {
  actorUserId: number;
  action: AdminAuditAction;
  targetType: "feature_flag" | "user" | "founding_access_request" | "stress_annotation";
  targetId?: number | null;
  targetKey?: string | null;
  correlationId?: string | null;
  before: SafeAuditState;
  after: SafeAuditState;
  outcome: AdminAuditOutcome;
  occurredAt?: Date;
}

export interface AdminAuditEventView {
  id: number;
  actorUserId: number;
  action: AdminAuditAction;
  targetType: string;
  targetId: number | null;
  targetKey: string | null;
  correlationId: string | null;
  before: SafeAuditState;
  after: SafeAuditState;
  outcome: AdminAuditOutcome;
  occurredAt: Date;
}

export interface AdminAuditPage {
  events: AdminAuditEventView[];
  nextBeforeId: number | null;
}

export interface PreparedApprovalEmailAttempt {
  correlationId: string;
  recipient: {
    email: string;
    name: string;
  };
}

const SENSITIVE_AUDIT_FIELD = /(?:^|_)(?:email|name|message|title|description|origin|url|token|secret|password|credential|cookie|authorization|body|openid)(?:$|_)/i;
const SAFE_CORRELATION_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function serializeSafeAuditState(state: SafeAuditState): string {
  for (const [key, value] of Object.entries(state)) {
    if (SENSITIVE_AUDIT_FIELD.test(key)) {
      throw new Error(`Sensitive field is not permitted in admin audit evidence: ${key}`);
    }
    if (typeof value === "string" && value.length > 128) {
      throw new Error(`Oversized string is not permitted in admin audit evidence: ${key}`);
    }
  }
  return JSON.stringify(state);
}

function parseSafeAuditState(value: string, column: string): SafeAuditState {
  try {
    const parsed: unknown = JSON.parse(value);
    if (!parsed || Array.isArray(parsed) || typeof parsed !== "object") {
      throw new Error("must be an object");
    }
    for (const [key, entry] of Object.entries(parsed)) {
      if (SENSITIVE_AUDIT_FIELD.test(key) || !["string", "number", "boolean"].includes(typeof entry) && entry !== null) {
        throw new Error("contains a disallowed field or value");
      }
    }
    return parsed as SafeAuditState;
  } catch (error) {
    throw new AdminAuditPersistenceError(`Stored admin audit ${column} is invalid.`, error);
  }
}

function toBoolean(value: unknown): boolean {
  return value === true || value === 1 || value === "1";
}

function toDate(value: unknown): Date {
  return value instanceof Date ? value : new Date(String(value));
}

function assertSafeCorrelationId(correlationId: string): void {
  if (!SAFE_CORRELATION_ID.test(correlationId)) {
    throw new AdminAuditPersistenceError("Approval email correlation identifier is invalid.");
  }
}

export class AdminAuditStore {
  constructor(
    private readonly dbProvider: AdminAuditDbProvider = getDb,
    private readonly now: () => Date = () => new Date(),
    private readonly createCorrelationId: () => string = randomUUID,
  ) {}

  private async withTransaction<T>(operation: (tx: AdminAuditTransaction) => Promise<T>): Promise<T> {
    const db = await this.dbProvider();
    if (!db) throw new AdminAuditPersistenceError("Admin audit storage is unavailable.");
    try {
      return await db.transaction(async tx => operation(tx));
    } catch (error) {
      if (
        error instanceof AdminAuditPersistenceError ||
        error instanceof AdminAuditNotFoundError ||
        error instanceof AdminAuditGuardError ||
        error instanceof AdminAuditAmbiguousResultError
      ) {
        throw error;
      }
      throw new AdminAuditPersistenceError("Admin mutation and audit event could not be committed.", error);
    }
  }

  private async appendInTransaction(tx: AdminAuditTransaction, event: PendingAuditEvent): Promise<void> {
    if (event.correlationId) assertSafeCorrelationId(event.correlationId);
    await tx.insert(adminAuditEvents).values({
      actorUserId: event.actorUserId,
      action: event.action,
      targetType: event.targetType,
      targetId: event.targetId ?? null,
      targetKey: event.targetKey ?? null,
      correlationId: event.correlationId ?? null,
      beforeStateJson: serializeSafeAuditState(event.before),
      afterStateJson: serializeSafeAuditState(event.after),
      outcome: event.outcome,
      occurredAt: event.occurredAt ?? this.now(),
    });
  }

  async setFeatureFlag(input: { actorUserId: number; key: string; enabled: boolean }): Promise<void> {
    await this.withTransaction(async tx => {
      const [flag] = await tx.select({
        enabled: featureFlags.enabled,
      }).from(featureFlags).where(eq(featureFlags.key, input.key)).limit(1).for("update");
      if (!flag) throw new AdminAuditNotFoundError("Feature flag not found.");

      const before = { enabled: toBoolean(flag.enabled) };
      const after = { enabled: input.enabled };
      await tx.update(featureFlags).set({
        enabled: input.enabled ? 1 : 0,
        updatedBy: input.actorUserId,
        updatedAt: this.now(),
      }).where(eq(featureFlags.key, input.key));
      await this.appendInTransaction(tx, {
        actorUserId: input.actorUserId,
        action: "FEATURE_FLAG_UPDATED",
        targetType: "feature_flag",
        targetKey: input.key,
        before,
        after,
        outcome: "SUCCEEDED",
      });
    });
  }

  async setUserTier(input: {
    actorUserId: number;
    userId: number;
    tier: Tier;
    lifetimeAccess?: boolean;
  }): Promise<{ tier: Tier; lifetimeAccess: boolean }> {
    return await this.withTransaction(async tx => {
      const [user] = await tx.select({
        accessTier: users.accessTier,
        lifetimeAccess: users.lifetimeAccess,
      }).from(users).where(eq(users.id, input.userId)).limit(1).for("update");
      if (!user) throw new AdminAuditNotFoundError("User not found.");

      // Match the pre-existing admin-grant semantics exactly.
      const clearLifetime = input.lifetimeAccess === false || (input.lifetimeAccess === undefined && input.tier === "free");
      const grantLifetime = input.lifetimeAccess === true;
      const nextLifetimeAccess = grantLifetime ? true : clearLifetime ? false : toBoolean(user.lifetimeAccess);
      const before = { accessTier: user.accessTier, lifetimeAccess: toBoolean(user.lifetimeAccess) };
      const after = { accessTier: input.tier, lifetimeAccess: nextLifetimeAccess };
      await tx.update(users).set({
        accessTier: input.tier,
        accessExpiresAt: null,
        entitlementRevision: sql`${users.entitlementRevision} + 1`,
        updatedAt: this.now(),
        ...(grantLifetime ? { lifetimeAccess: true } : {}),
        ...(clearLifetime ? { lifetimeAccess: false } : {}),
      }).where(eq(users.id, input.userId));
      await this.appendInTransaction(tx, {
        actorUserId: input.actorUserId,
        action: "USER_TIER_UPDATED",
        targetType: "user",
        targetId: input.userId,
        before,
        after,
        outcome: "SUCCEEDED",
      });
      return { tier: input.tier, lifetimeAccess: nextLifetimeAccess };
    });
  }

  async updateFoundingRequestStatus(input: {
    actorUserId: number;
    requestId: number;
    status: FoundingStatus;
  }): Promise<void> {
    await this.withTransaction(async tx => {
      const [request] = await tx.select({
        status: foundingAccessRequests.status,
        userId: foundingAccessRequests.userId,
      }).from(foundingAccessRequests).where(eq(foundingAccessRequests.id, input.requestId)).limit(1).for("update");
      if (!request) throw new AdminAuditNotFoundError("Founding access request not found.");

      await tx.update(foundingAccessRequests).set({ status: input.status, updatedAt: this.now() })
        .where(eq(foundingAccessRequests.id, input.requestId));
      await this.appendInTransaction(tx, {
        actorUserId: input.actorUserId,
        action: "FOUNDING_REQUEST_STATUS_UPDATED",
        targetType: "founding_access_request",
        targetId: input.requestId,
        before: { status: request.status, linkedUserId: request.userId ?? null },
        after: { status: input.status, linkedUserId: request.userId ?? null },
        outcome: "SUCCEEDED",
      });
    });
  }

  async removeUser(input: { actorUserId: number; userId: number }): Promise<void> {
    if (input.actorUserId === input.userId) {
      throw new AdminAuditGuardError("You cannot remove your own account.", "BAD_REQUEST");
    }
    await this.withTransaction(async tx => {
      const [target] = await tx.select({
        role: users.role,
        accessTier: users.accessTier,
        lifetimeAccess: users.lifetimeAccess,
      }).from(users).where(eq(users.id, input.userId)).limit(1).for("update");
      if (!target) throw new AdminAuditNotFoundError("User not found.");
      // This stronger guard protects the last administrator as well as every
      // other administrator; no admin account can be removed from this console.
      if (target.role === "admin") {
        throw new AdminAuditGuardError("Administrator accounts cannot be removed through this console.", "FORBIDDEN");
      }

      await tx.delete(positions).where(eq(positions.userId, input.userId));
      await tx.delete(cryptoWatchlist).where(eq(cryptoWatchlist.userId, input.userId));
      await tx.delete(mobileWatchlist).where(eq(mobileWatchlist.userId, input.userId));
      await tx.delete(users).where(eq(users.id, input.userId));
      await this.appendInTransaction(tx, {
        actorUserId: input.actorUserId,
        action: "USER_REMOVED",
        targetType: "user",
        targetId: input.userId,
        before: {
          role: target.role,
          accessTier: target.accessTier,
          lifetimeAccess: toBoolean(target.lifetimeAccess),
        },
        after: { removed: true },
        outcome: "SUCCEEDED",
      });
    });
  }

  async addStressAnnotation(input: {
    actorUserId: number;
    eventAt: string;
    eventType: string;
    title: string;
    description?: string;
    severity: StressSeverity;
    v1AtEvent?: number;
    v3hAtEvent?: number;
  }): Promise<void> {
    await this.withTransaction(async tx => {
      const eventAt = new Date(input.eventAt);
      const result = await tx.insert(shadowStressAnnotations).values({
        eventAt,
        eventType: input.eventType,
        title: input.title,
        description: input.description,
        severity: input.severity,
        v1AtEvent: input.v1AtEvent ?? null,
        v3hAtEvent: input.v3hAtEvent ?? null,
        createdBy: input.actorUserId,
      });
      const insertId = Number((result[0] as { insertId?: number } | undefined)?.insertId);
      if (!Number.isSafeInteger(insertId) || insertId < 1) {
        throw new AdminAuditPersistenceError("Stress annotation insert did not return an identifier.");
      }
      await this.appendInTransaction(tx, {
        actorUserId: input.actorUserId,
        action: "STRESS_ANNOTATION_CREATED",
        targetType: "stress_annotation",
        targetId: insertId,
        before: { exists: false },
        after: {
          eventAt: eventAt.toISOString(),
          eventType: input.eventType,
          severity: input.severity,
          v1AtEvent: input.v1AtEvent ?? null,
          v3hAtEvent: input.v3hAtEvent ?? null,
          hasDescription: Boolean(input.description),
        },
        outcome: "SUCCEEDED",
      });
    });
  }

  private async latestApprovalEmailDisposition(
    tx: AdminAuditTransaction,
    requestId: number,
  ): Promise<{ disposition: ApprovalEmailDisposition; correlationId?: string }> {
    const rows = await tx.select({
      action: adminAuditEvents.action,
      correlationId: adminAuditEvents.correlationId,
      outcome: adminAuditEvents.outcome,
    }).from(adminAuditEvents)
      .where(and(
        eq(adminAuditEvents.targetType, "founding_access_request"),
        eq(adminAuditEvents.targetId, requestId),
      ))
      .orderBy(desc(adminAuditEvents.id))
      .for("update");

    const latestAttempt = rows.find(row => row.action === "FOUNDING_APPROVAL_EMAIL_ATTEMPTED");
    if (!latestAttempt?.correlationId) return { disposition: "NONE" };
    const result = rows.find(row =>
      row.action === "FOUNDING_APPROVAL_EMAIL_RESULT_RECORDED" &&
      row.correlationId === latestAttempt.correlationId,
    );
    if (!result) return { disposition: "AMBIGUOUS", correlationId: latestAttempt.correlationId };
    if (result.outcome === "SUCCEEDED") return { disposition: "ACCEPTED", correlationId: latestAttempt.correlationId };
    return { disposition: "NONE" };
  }

  /**
   * Lock the approved request and append immutable before-effect evidence before
   * an external adapter is invoked. A subsequent call sees the unresolved
   * attempt (or accepted result) and cannot blindly send a second email.
   */
  async prepareApprovalEmailAttempt(input: {
    actorUserId: number;
    requestId: number;
  }): Promise<PreparedApprovalEmailAttempt> {
    return await this.withTransaction(async tx => {
      const [request] = await tx.select({
        email: foundingAccessRequests.email,
        name: foundingAccessRequests.name,
        status: foundingAccessRequests.status,
      }).from(foundingAccessRequests)
        .where(eq(foundingAccessRequests.id, input.requestId))
        .limit(1)
        .for("update");
      if (!request) throw new AdminAuditNotFoundError("Founding access request not found.");
      if (request.status !== "approved") {
        throw new AdminAuditGuardError("Only an approved founding request can receive an approval email.", "BAD_REQUEST");
      }

      const previous = await this.latestApprovalEmailDisposition(tx, input.requestId);
      if (previous.disposition === "ACCEPTED") {
        throw new AdminAuditGuardError(
          `Approval email is already recorded as accepted for this request (audit correlation: ${previous.correlationId}).`,
          "CONFLICT",
        );
      }
      if (previous.disposition === "AMBIGUOUS" && previous.correlationId) {
        throw new AdminAuditAmbiguousResultError(previous.correlationId);
      }

      const correlationId = this.createCorrelationId();
      assertSafeCorrelationId(correlationId);
      await this.appendInTransaction(tx, {
        actorUserId: input.actorUserId,
        action: "FOUNDING_APPROVAL_EMAIL_ATTEMPTED",
        targetType: "founding_access_request",
        targetId: input.requestId,
        correlationId,
        before: { approvalStatus: request.status },
        after: { dispatchIntent: "approval_email", dispatchStatus: "attempt_recorded" },
        outcome: "ATTEMPTED",
      });
      return {
        correlationId,
        // Recipient data is intentionally returned only to the same in-process
        // caller to build the adapter payload; it never enters audit evidence.
        recipient: { email: request.email, name: request.name ?? "" },
      };
    });
  }

  /**
   * Append the known adapter result to the pre-effect attempt. This does not
   * assert mailbox delivery; accepted means adapter acceptance only.
   */
  async recordApprovalEmailResult(input: {
    actorUserId: number;
    requestId: number;
    correlationId: string;
    accepted: boolean;
  }): Promise<void> {
    assertSafeCorrelationId(input.correlationId);
    await this.withTransaction(async tx => {
      const [request] = await tx.select({ id: foundingAccessRequests.id })
        .from(foundingAccessRequests)
        .where(eq(foundingAccessRequests.id, input.requestId))
        .limit(1)
        .for("update");
      if (!request) throw new AdminAuditNotFoundError("Founding access request not found.");

      const matchingEvents = await tx.select({
        action: adminAuditEvents.action,
        actorUserId: adminAuditEvents.actorUserId,
      }).from(adminAuditEvents)
        .where(and(
          eq(adminAuditEvents.targetType, "founding_access_request"),
          eq(adminAuditEvents.targetId, input.requestId),
          eq(adminAuditEvents.correlationId, input.correlationId),
        ))
        .orderBy(desc(adminAuditEvents.id))
        .for("update");
      const attempt = matchingEvents.find(event => event.action === "FOUNDING_APPROVAL_EMAIL_ATTEMPTED");
      if (!attempt) {
        throw new AdminAuditGuardError("Approval email result has no recorded attempt.", "BAD_REQUEST");
      }
      if (attempt.actorUserId !== input.actorUserId) {
        throw new AdminAuditGuardError("Approval email result actor does not match the recorded attempt.", "FORBIDDEN");
      }
      if (matchingEvents.some(event => event.action === "FOUNDING_APPROVAL_EMAIL_RESULT_RECORDED")) {
        throw new AdminAuditGuardError("Approval email result is already recorded for this correlation.", "CONFLICT");
      }

      await this.appendInTransaction(tx, {
        actorUserId: input.actorUserId,
        action: "FOUNDING_APPROVAL_EMAIL_RESULT_RECORDED",
        targetType: "founding_access_request",
        targetId: input.requestId,
        correlationId: input.correlationId,
        before: { dispatchStatus: "attempt_recorded" },
        after: {
          adapterResult: input.accepted ? "accepted" : "rejected",
          deliveryClaimed: false,
        },
        outcome: input.accepted ? "SUCCEEDED" : "FAILED",
      });
    });
  }

  async list(input: { limit: number; beforeId?: number }): Promise<AdminAuditPage> {
    const db = await this.dbProvider();
    if (!db) throw new AdminAuditPersistenceError("Admin audit storage is unavailable.");
    try {
      const rows = input.beforeId
        ? await db.select().from(adminAuditEvents)
          .where(lt(adminAuditEvents.id, input.beforeId))
          .orderBy(desc(adminAuditEvents.id))
          .limit(input.limit + 1)
        : await db.select().from(adminAuditEvents)
          .orderBy(desc(adminAuditEvents.id))
          .limit(input.limit + 1);
      const pageRows = rows.slice(0, input.limit);
      const events = pageRows.map(row => ({
        id: row.id,
        actorUserId: row.actorUserId,
        action: row.action as AdminAuditAction,
        targetType: row.targetType,
        targetId: row.targetId ?? null,
        targetKey: row.targetKey ?? null,
        correlationId: row.correlationId ?? null,
        before: parseSafeAuditState(row.beforeStateJson, "before state"),
        after: parseSafeAuditState(row.afterStateJson, "after state"),
        outcome: row.outcome as AdminAuditOutcome,
        occurredAt: toDate(row.occurredAt),
      }));
      return {
        events,
        nextBeforeId: rows.length > input.limit ? events.at(-1)?.id ?? null : null,
      };
    } catch (error) {
      if (error instanceof AdminAuditPersistenceError) throw error;
      throw new AdminAuditPersistenceError("Admin audit history could not be read.", error);
    }
  }
}

export const adminAuditStore = new AdminAuditStore();
