import { eq, or } from "drizzle-orm";
import { getDb } from "../db";
import { stripePaymentOrigins, stripePaymentReversalEvents } from "../../drizzle/billingPaymentLinkageSchema";

export const PAYMENT_ORIGIN_EVENT_TYPES = new Set([
  "checkout.session.completed",
  "checkout.session.async_payment_succeeded",
  "payment_intent.succeeded",
  "charge.succeeded",
]);

export const PAYMENT_REVERSAL_EVENT_TYPES = new Set([
  "charge.refunded",
  "refund.created",
  "refund.updated",
  "refund.failed",
  "charge.dispute.created",
  "charge.dispute.updated",
  "charge.dispute.closed",
  "charge.dispute.funds_withdrawn",
  "charge.dispute.funds_reinstated",
]);

export type StripeEventLike = {
  id: string;
  type: string;
  created?: number | null;
  livemode?: boolean;
  data: { object?: Record<string, unknown> | null };
};

export type PaymentOriginInput = {
  userId: number;
  stripeCheckoutSessionId: string | null;
  stripePaymentIntentId: string;
  stripeChargeId: string;
  stripeCustomerId: string;
  amount: number;
  currency: string;
  livemode: boolean;
  sourceEventId: string;
  sourceEventCreated: number;
};

export type PaymentOriginRecord = PaymentOriginInput & { id: number };

export type PaymentReversalInput = {
  stripeEventId: string;
  stripeEventType: string;
  reversalKind: "refund" | "dispute";
  providerObjectId: string | null;
  stripePaymentIntentId: string | null;
  stripeChargeId: string | null;
  stripeCustomerId: string | null;
  reversalAmount: number;
  currency: string;
  livemode: boolean;
  providerStatus: string;
  eventCreated: number;
};

export type ReconciledPaymentReversal = PaymentReversalInput & {
  stripePaymentOriginId: number;
  userId: number;
  stripeCheckoutSessionId: string | null;
  canonicalPaymentIntentId: string;
  canonicalChargeId: string;
  canonicalCustomerId: string;
  reconciliationState: "policy_pending";
};

export type PaymentLinkageStore = {
  findOrigins(identifiers: Pick<PaymentReversalInput, "stripePaymentIntentId" | "stripeChargeId">): Promise<PaymentOriginRecord[]>;
  captureReversal(reversal: ReconciledPaymentReversal): Promise<"recorded" | "duplicate">;
};

export class PaymentLinkageUnresolvedError extends Error {
  constructor(public readonly code: string, detail?: string) {
    super(detail ? `${code}: ${detail}` : code);
    this.name = "PaymentLinkageUnresolvedError";
  }
}

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object") {
    throw new PaymentLinkageUnresolvedError("malformed_object");
  }
  return value as Record<string, unknown>;
}

function requiredId(value: unknown, field: string): string {
  if (typeof value === "string" && value.trim()) return value;
  if (value && typeof value === "object" && "id" in value && typeof (value as { id?: unknown }).id === "string") {
    const id = (value as { id: string }).id.trim();
    if (id) return id;
  }
  throw new PaymentLinkageUnresolvedError("missing_identifier", field);
}

function optionalId(value: unknown): string | null {
  if (value == null) return null;
  return requiredId(value, "optional_identifier");
}

function requiredPositiveAmount(value: unknown, field: string): number {
  if (typeof value === "number" && Number.isSafeInteger(value) && value > 0) return value;
  throw new PaymentLinkageUnresolvedError("invalid_amount", field);
}

function requiredCurrency(value: unknown): string {
  if (typeof value === "string" && /^[a-z]{3}$/i.test(value)) return value.toLowerCase();
  throw new PaymentLinkageUnresolvedError("invalid_currency");
}

function requiredEventCreated(event: StripeEventLike): number {
  if (typeof event.created === "number" && Number.isSafeInteger(event.created) && event.created > 0) return event.created;
  throw new PaymentLinkageUnresolvedError("invalid_event_created");
}

function requiredLivemode(value: unknown): boolean {
  if (typeof value === "boolean") return value;
  throw new PaymentLinkageUnresolvedError("missing_livemode");
}

function requiredStatus(value: unknown, fallback: string): string {
  if (typeof value === "string" && value.trim()) return value;
  return fallback;
}

function eventObject(event: StripeEventLike): Record<string, unknown> {
  return asRecord(event.data.object);
}

function assertEventIdentity(event: StripeEventLike): void {
  if (typeof event.id !== "string" || !event.id.trim()) {
    throw new PaymentLinkageUnresolvedError("missing_event_id");
  }
}

function sameOptionalId(left: unknown, right: unknown): boolean {
  const leftId = optionalId(left);
  const rightId = optionalId(right);
  return leftId == null || rightId == null || leftId === rightId;
}

/** Stripe SDK supplies these event discriminators; unknown types never enter this flow. */
export function isPaymentOriginEvent(type: string): boolean {
  return PAYMENT_ORIGIN_EVENT_TYPES.has(type);
}

export function isPaymentReversalEvent(type: string): boolean {
  return PAYMENT_REVERSAL_EVENT_TYPES.has(type);
}

/**
 * Extract a payment-mode Checkout origin from an API-retrieved session. The
 * signed event and retrieved object must agree; a subscription-mode session is
 * intentionally not guessed as a payment-mode origin.
 */
export function paymentOriginFromCheckoutEvent(
  event: StripeEventLike,
  retrievedSession: unknown,
  userId: number,
): PaymentOriginInput | null {
  assertEventIdentity(event);
  if (!Number.isInteger(userId) || userId <= 0) throw new PaymentLinkageUnresolvedError("invalid_user");
  const signed = eventObject(event);
  const session = asRecord(retrievedSession);
  const sessionId = requiredId(session.id, "checkout_session");
  if (requiredId(signed.id, "signed_checkout_session") !== sessionId) {
    throw new PaymentLinkageUnresolvedError("checkout_session_mismatch");
  }
  const mode = session.mode;
  if (mode !== "payment") {
    if (mode === "subscription" || mode === "setup") return null;
    throw new PaymentLinkageUnresolvedError("unsupported_checkout_mode");
  }
  if (session.payment_status !== "paid") throw new PaymentLinkageUnresolvedError("checkout_not_paid");
  const livemode = requiredLivemode(event.livemode);
  if (requiredLivemode(session.livemode) !== livemode) throw new PaymentLinkageUnresolvedError("livemode_mismatch");
  if (!sameOptionalId(signed.customer, session.customer)) throw new PaymentLinkageUnresolvedError("checkout_customer_mismatch");
  const paymentIntent = asRecord(session.payment_intent);
  if (paymentIntent.status !== "succeeded") throw new PaymentLinkageUnresolvedError("payment_intent_not_succeeded");
  const amount = requiredPositiveAmount(paymentIntent.amount_received, "payment_intent.amount_received");
  const sessionAmount = requiredPositiveAmount(session.amount_total, "checkout.amount_total");
  if (amount !== sessionAmount) throw new PaymentLinkageUnresolvedError("amount_mismatch");
  const currency = requiredCurrency(paymentIntent.currency ?? session.currency);
  const sessionCurrency = requiredCurrency(session.currency);
  if (currency !== sessionCurrency) throw new PaymentLinkageUnresolvedError("currency_mismatch");
  const customerId = requiredId(paymentIntent.customer ?? session.customer, "customer");
  return {
    userId,
    stripeCheckoutSessionId: sessionId,
    stripePaymentIntentId: requiredId(paymentIntent.id, "payment_intent"),
    stripeChargeId: requiredId(paymentIntent.latest_charge, "charge"),
    stripeCustomerId: customerId,
    amount,
    currency,
    livemode,
    sourceEventId: event.id,
    sourceEventCreated: requiredEventCreated(event),
  };
}

export function paymentOriginFromPaymentIntentEvent(event: StripeEventLike, userId: number): PaymentOriginInput {
  assertEventIdentity(event);
  if (!Number.isInteger(userId) || userId <= 0) throw new PaymentLinkageUnresolvedError("invalid_user");
  const intent = eventObject(event);
  if (intent.status !== "succeeded") throw new PaymentLinkageUnresolvedError("payment_intent_not_succeeded");
  const livemode = requiredLivemode(event.livemode);
  if (intent.livemode != null && requiredLivemode(intent.livemode) !== livemode) {
    throw new PaymentLinkageUnresolvedError("livemode_mismatch");
  }
  return {
    userId,
    stripeCheckoutSessionId: null,
    stripePaymentIntentId: requiredId(intent.id, "payment_intent"),
    stripeChargeId: requiredId(intent.latest_charge, "charge"),
    stripeCustomerId: requiredId(intent.customer, "customer"),
    amount: requiredPositiveAmount(intent.amount_received, "payment_intent.amount_received"),
    currency: requiredCurrency(intent.currency),
    livemode,
    sourceEventId: event.id,
    sourceEventCreated: requiredEventCreated(event),
  };
}

export function paymentOriginFromChargeEvent(event: StripeEventLike, userId: number): PaymentOriginInput {
  assertEventIdentity(event);
  if (!Number.isInteger(userId) || userId <= 0) throw new PaymentLinkageUnresolvedError("invalid_user");
  const charge = eventObject(event);
  if (charge.paid !== true) throw new PaymentLinkageUnresolvedError("charge_not_paid");
  const livemode = requiredLivemode(event.livemode);
  if (charge.livemode != null && requiredLivemode(charge.livemode) !== livemode) {
    throw new PaymentLinkageUnresolvedError("livemode_mismatch");
  }
  return {
    userId,
    stripeCheckoutSessionId: null,
    stripePaymentIntentId: requiredId(charge.payment_intent, "payment_intent"),
    stripeChargeId: requiredId(charge.id, "charge"),
    stripeCustomerId: requiredId(charge.customer, "customer"),
    amount: requiredPositiveAmount(charge.amount_captured ?? charge.amount, "charge.amount"),
    currency: requiredCurrency(charge.currency),
    livemode,
    sourceEventId: event.id,
    sourceEventCreated: requiredEventCreated(event),
  };
}

/** Normalize only signed, documented refund/dispute payloads into neutral facts. */
export function paymentReversalFromEvent(event: StripeEventLike): PaymentReversalInput {
  assertEventIdentity(event);
  if (!isPaymentReversalEvent(event.type)) throw new PaymentLinkageUnresolvedError("unsupported_reversal_event", event.type);
  const object = eventObject(event);
  const livemode = requiredLivemode(event.livemode);
  if (object.livemode != null && requiredLivemode(object.livemode) !== livemode) {
    throw new PaymentLinkageUnresolvedError("livemode_mismatch");
  }
  const isDispute = event.type.startsWith("charge.dispute.");
  const isChargeRefundSummary = event.type === "charge.refunded";
  const chargeId = isChargeRefundSummary ? requiredId(object.id, "charge") : optionalId(object.charge);
  const paymentIntentId = optionalId(object.payment_intent);
  if (!chargeId && !paymentIntentId) throw new PaymentLinkageUnresolvedError("missing_original_payment_identifier");
  const amount = isChargeRefundSummary
    ? requiredPositiveAmount(object.amount_refunded, "charge.amount_refunded")
    : requiredPositiveAmount(object.amount, `${isDispute ? "dispute" : "refund"}.amount`);
  return {
    stripeEventId: event.id,
    stripeEventType: event.type,
    reversalKind: isDispute ? "dispute" : "refund",
    providerObjectId: isChargeRefundSummary ? null : requiredId(object.id, isDispute ? "dispute" : "refund"),
    stripePaymentIntentId: paymentIntentId,
    stripeChargeId: chargeId,
    stripeCustomerId: optionalId(object.customer),
    reversalAmount: amount,
    currency: requiredCurrency(object.currency),
    livemode,
    providerStatus: requiredStatus(object.status, isChargeRefundSummary ? "refunded" : "unknown"),
    eventCreated: requiredEventCreated(event),
  };
}

/**
 * Reversals link only to an exact, already-recorded origin. This performs no
 * entitlement mutation and never falls back to a current customer/user lookup.
 */
export function reconcileReversalWithOrigins(
  reversal: PaymentReversalInput,
  origins: PaymentOriginRecord[],
): ReconciledPaymentReversal {
  if (origins.length === 0) throw new PaymentLinkageUnresolvedError("missing_original_linkage");
  if (origins.length !== 1) throw new PaymentLinkageUnresolvedError("ambiguous_original_linkage");
  const origin = origins[0];
  if (reversal.stripePaymentIntentId && reversal.stripePaymentIntentId !== origin.stripePaymentIntentId) {
    throw new PaymentLinkageUnresolvedError("payment_intent_mismatch");
  }
  if (reversal.stripeChargeId && reversal.stripeChargeId !== origin.stripeChargeId) {
    throw new PaymentLinkageUnresolvedError("charge_mismatch");
  }
  if (reversal.stripeCustomerId && reversal.stripeCustomerId !== origin.stripeCustomerId) {
    throw new PaymentLinkageUnresolvedError("customer_mismatch");
  }
  if (reversal.livemode !== origin.livemode) throw new PaymentLinkageUnresolvedError("livemode_mismatch");
  if (reversal.currency !== origin.currency) throw new PaymentLinkageUnresolvedError("currency_mismatch");
  if (reversal.reversalAmount > origin.amount) throw new PaymentLinkageUnresolvedError("reversal_amount_exceeds_original");
  return {
    ...reversal,
    stripePaymentOriginId: origin.id,
    userId: origin.userId,
    stripeCheckoutSessionId: origin.stripeCheckoutSessionId,
    canonicalPaymentIntentId: origin.stripePaymentIntentId,
    canonicalChargeId: origin.stripeChargeId,
    canonicalCustomerId: origin.stripeCustomerId,
    reconciliationState: "policy_pending",
  };
}

function duplicateKey(error: unknown): boolean {
  const code = error && typeof error === "object" ? (error as { code?: unknown; errno?: unknown }) : null;
  return code?.code === "ER_DUP_ENTRY" || code?.errno === 1062;
}

function originRecord(row: typeof stripePaymentOrigins.$inferSelect): PaymentOriginRecord {
  return {
    id: row.id,
    userId: row.userId,
    stripeCheckoutSessionId: row.stripeCheckoutSessionId ?? null,
    stripePaymentIntentId: row.stripePaymentIntentId,
    stripeChargeId: row.stripeChargeId,
    stripeCustomerId: row.stripeCustomerId,
    amount: Number(row.amount),
    currency: row.currency,
    livemode: Boolean(row.livemode),
    sourceEventId: row.sourceEventId,
    sourceEventCreated: Number(row.sourceEventCreated),
  };
}

function originCompatible(existing: PaymentOriginRecord, incoming: PaymentOriginInput): void {
  if (
    existing.userId !== incoming.userId ||
    existing.stripePaymentIntentId !== incoming.stripePaymentIntentId ||
    existing.stripeChargeId !== incoming.stripeChargeId ||
    existing.stripeCustomerId !== incoming.stripeCustomerId ||
    existing.amount !== incoming.amount ||
    existing.currency !== incoming.currency ||
    existing.livemode !== incoming.livemode
  ) {
    throw new PaymentLinkageUnresolvedError("origin_linkage_conflict");
  }
  if (
    existing.stripeCheckoutSessionId &&
    incoming.stripeCheckoutSessionId &&
    existing.stripeCheckoutSessionId !== incoming.stripeCheckoutSessionId
  ) {
    throw new PaymentLinkageUnresolvedError("checkout_session_conflict");
  }
}

function singleCompatibleOrigin(rows: Array<typeof stripePaymentOrigins.$inferSelect>, incoming: PaymentOriginInput): PaymentOriginRecord | null {
  if (rows.length === 0) return null;
  if (rows.length !== 1) throw new PaymentLinkageUnresolvedError("ambiguous_origin_linkage");
  const existing = originRecord(rows[0]);
  originCompatible(existing, incoming);
  return existing;
}

/** Persist an exact origin; a second event may only fill a previously-null Checkout ID. */
export async function capturePaymentOrigin(incoming: PaymentOriginInput): Promise<"recorded" | "duplicate"> {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable: cannot persist Stripe payment linkage");
  const conditions = [
    eq(stripePaymentOrigins.stripePaymentIntentId, incoming.stripePaymentIntentId),
    eq(stripePaymentOrigins.stripeChargeId, incoming.stripeChargeId),
    ...(incoming.stripeCheckoutSessionId ? [eq(stripePaymentOrigins.stripeCheckoutSessionId, incoming.stripeCheckoutSessionId)] : []),
  ];
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      return await db.transaction(async (tx) => {
        const rows = await tx.select().from(stripePaymentOrigins).where(or(...conditions)).for("update");
        const existing = singleCompatibleOrigin(rows, incoming);
        if (!existing) {
          await tx.insert(stripePaymentOrigins).values(incoming);
          return "recorded";
        }
        if (!existing.stripeCheckoutSessionId && incoming.stripeCheckoutSessionId) {
          await tx.update(stripePaymentOrigins)
            .set({ stripeCheckoutSessionId: incoming.stripeCheckoutSessionId })
            .where(eq(stripePaymentOrigins.id, existing.id));
          return "recorded";
        }
        return "duplicate";
      });
    } catch (error) {
      if (!duplicateKey(error) || attempt === 1) throw error;
    }
  }
  throw new Error("unreachable payment-origin capture retry");
}

function sameReversal(existing: typeof stripePaymentReversalEvents.$inferSelect, incoming: ReconciledPaymentReversal): boolean {
  return existing.stripeEventType === incoming.stripeEventType
    && existing.reversalKind === incoming.reversalKind
    && (existing.providerObjectId ?? null) === incoming.providerObjectId
    && existing.stripePaymentOriginId === incoming.stripePaymentOriginId
    && existing.userId === incoming.userId
    && existing.stripePaymentIntentId === incoming.canonicalPaymentIntentId
    && existing.stripeChargeId === incoming.canonicalChargeId
    && existing.stripeCustomerId === incoming.canonicalCustomerId
    && Number(existing.reversalAmount) === incoming.reversalAmount
    && existing.currency === incoming.currency
    && Boolean(existing.livemode) === incoming.livemode
    && existing.providerStatus === incoming.providerStatus
    && Number(existing.eventCreated) === incoming.eventCreated
    && existing.reconciliationState === "policy_pending";
}

class DatabasePaymentLinkageStore implements PaymentLinkageStore {
  async findOrigins(identifiers: Pick<PaymentReversalInput, "stripePaymentIntentId" | "stripeChargeId">): Promise<PaymentOriginRecord[]> {
    const db = await getDb();
    if (!db) throw new Error("Database unavailable: cannot reconcile Stripe payment reversal");
    const conditions = [
      ...(identifiers.stripePaymentIntentId ? [eq(stripePaymentOrigins.stripePaymentIntentId, identifiers.stripePaymentIntentId)] : []),
      ...(identifiers.stripeChargeId ? [eq(stripePaymentOrigins.stripeChargeId, identifiers.stripeChargeId)] : []),
    ];
    if (conditions.length === 0) throw new PaymentLinkageUnresolvedError("missing_original_payment_identifier");
    const rows = await db.select().from(stripePaymentOrigins).where(or(...conditions));
    return rows.map(originRecord);
  }

  async captureReversal(incoming: ReconciledPaymentReversal): Promise<"recorded" | "duplicate"> {
    const db = await getDb();
    if (!db) throw new Error("Database unavailable: cannot persist Stripe payment reversal");
    const values = {
      stripeEventId: incoming.stripeEventId,
      stripeEventType: incoming.stripeEventType,
      reversalKind: incoming.reversalKind,
      providerObjectId: incoming.providerObjectId,
      stripePaymentOriginId: incoming.stripePaymentOriginId,
      userId: incoming.userId,
      stripeCheckoutSessionId: incoming.stripeCheckoutSessionId,
      stripePaymentIntentId: incoming.canonicalPaymentIntentId,
      stripeChargeId: incoming.canonicalChargeId,
      stripeCustomerId: incoming.canonicalCustomerId,
      reversalAmount: incoming.reversalAmount,
      currency: incoming.currency,
      livemode: incoming.livemode,
      providerStatus: incoming.providerStatus,
      eventCreated: incoming.eventCreated,
      reconciliationState: incoming.reconciliationState,
    };
    try {
      await db.insert(stripePaymentReversalEvents).values(values);
      return "recorded";
    } catch (error) {
      if (!duplicateKey(error)) throw error;
    }
    const [existing] = await db.select().from(stripePaymentReversalEvents)
      .where(eq(stripePaymentReversalEvents.stripeEventId, incoming.stripeEventId))
      .limit(1);
    if (existing && sameReversal(existing, incoming)) return "duplicate";
    throw new PaymentLinkageUnresolvedError("reversal_event_conflict");
  }
}

const databasePaymentLinkageStore = new DatabasePaymentLinkageStore();

/** Capture a signed reversal as policy-pending evidence, or fail closed for replay. */
export async function reconcilePaymentReversalEvent(
  event: StripeEventLike,
  store: PaymentLinkageStore = databasePaymentLinkageStore,
): Promise<"recorded" | "duplicate"> {
  const reversal = paymentReversalFromEvent(event);
  const origins = await store.findOrigins({
    stripePaymentIntentId: reversal.stripePaymentIntentId,
    stripeChargeId: reversal.stripeChargeId,
  });
  const reconciled = reconcileReversalWithOrigins(reversal, origins);
  return store.captureReversal(reconciled);
}
