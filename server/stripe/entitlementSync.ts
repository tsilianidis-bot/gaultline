/**
 * Convergent entitlement decision. Implements docs/ENTITLEMENT_RULES.md.
 *
 * Webhooks do not patch from one event payload. They recompute access from the
 * current subscription list, cancellation markers, and a verified lifetime
 * payment. A cancellation marker outranks a Stripe payload whose own
 * timestamps are older. A corroborated resume (pause cleared, event.created
 * newer than the marker) may supersede that marker. Item period bounds are
 * authoritative for API version 2026-04-22.dahlia, with a subscription-level
 * fallback. A paid invoice with total > 0 renews when the amount was collected
 * in cash, by a discount, or by customer credit. An unverified lifetime
 * purchase does not. A full refund or an open or lost dispute revokes only
 * the linked purchase. A partial refund does not. A won dispute clears that
 * dispute alone when its source timestamp is newer, and also when the win
 * shares the opening event's second. An opening event cannot re-revoke that
 * same-second win.
 */

import { PRICING_PLANS, type AccessTier } from "../../shared/tiers";

export type PaidTier = Exclude<AccessTier, "free">;

export type InvoiceView = {
  id?: string | null;
  status?: string | null;
  amount_paid?: number | null;
  total?: number | null;
  created?: number | null;
  /** Period this invoice covers. Not a substitute for invoice.created. */
  period_start?: number | null;
  status_transitions?: { paid_at?: number | null } | null;
  discount?: { coupon?: { id?: string | null } | null } | null;
  discounts?: Array<unknown> | null;
  total_discount_amounts?: Array<{ amount?: number | null } | null> | null;
};

export type SubscriptionItemView = {
  price?: { id?: string | null } | null;
  current_period_start?: number | null;
  current_period_end?: number | null;
};

export type SubscriptionView = {
  id: string;
  status?: string | null;
  ended_at?: number | null;
  canceled_at?: number | null;
  current_period_start?: number | null;
  current_period_end?: number | null;
  start_date?: number | null;
  trial_end?: number | null;
  pause_collection?: unknown | null;
  items?: { data?: Array<SubscriptionItemView | null> | null } | null;
  latest_invoice?: string | InvoiceView | null;
};

export type CancellationMarker = {
  stripeSubscriptionId: string;
  canceledEventCreated: number;
  status: string;
  supersededEventCreated?: number | null;
};

export type ResumeEvidence = {
  subscriptionId: string;
  eventCreated: number;
};

export type LifetimeSessionView = {
  id?: string | null;
  mode?: string | null;
  payment_status?: string | null;
  amount_total?: number | null;
  created?: number | null;
  metadata?: { plan_id?: string | null } | null;
  payment_intent?: string | {
    id?: string | null;
    status?: string | null;
    amount_received?: number | null;
    amount?: number | null;
  } | null;
};

const TIER_RANK: Record<PaidTier, number> = { core: 1, premium: 2, founding: 3 };

export type EntitlementApply = {
  action: "apply";
  accessTier: AccessTier;
  stripeSubscriptionId: string | null;
  grantLifetime: boolean;
  lifetimePurchasedAt: Date | null;
  accessExpiresAt: Date | null;
  /** True when a subscription, not only lifetime, is part of the grant. */
  usesSubscription: boolean;
  /**
   * Set when this apply is a corroborated resume that must clear a cancellation
   * marker. Persisted in the same transaction as the user write.
   */
  supersedeCancellation: { stripeSubscriptionId: string; eventCreated: number } | null;
};

export type EntitlementConflictReason =
  | "stale_active_after_cancellation"
  | "subscription_list_incomplete"
  | "single_read"
  | "read_disagreement"
  | "invoice_unexpanded"
  | "missing_expiry"
  | "inconsistent_period";

export type EntitlementDecision =
  | EntitlementApply
  | { action: "needs_corroboration"; subscriptionId: string }
  | { action: "conflict"; reason: EntitlementConflictReason }
  | { action: "unresolved"; priceId: string | null; subscriptionId: string };

function positive(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : null;
}

/**
 * Dahlia (2026-04-22) puts current_period_start/end on subscription items.
 * Every item that carries a period must agree. When no item has a period,
 * fall back to the subscription, then trial_end.
 */
export function periodBounds(subscription: SubscriptionView):
  | { consistent: true; start: number | null; end: number | null }
  | { consistent: false } {
  const items = (subscription.items?.data ?? []).filter((item): item is SubscriptionItemView => item != null);
  const withEnd = items.filter(item => positive(item.current_period_end) != null);
  if (withEnd.length > 0) {
    if (withEnd.length !== items.length) return { consistent: false };
    const end = positive(withEnd[0].current_period_end);
    const start = positive(withEnd[0].current_period_start);
    for (const item of withEnd) {
      if (positive(item.current_period_end) !== end) return { consistent: false };
      if (positive(item.current_period_start) !== start) return { consistent: false };
    }
    return { consistent: true, start, end };
  }
  return {
    consistent: true,
    start: positive(subscription.current_period_start),
    end: positive(subscription.current_period_end) ?? positive(subscription.trial_end),
  };
}

/**
 * Renewal evidence is a period start, not an invoice timestamp.
 * invoice.created and start_date never outrank a cancellation. paid_at counts
 * only as proof that an invoice for a period was paid; the comparison value
 * is that period start (the invoice's own period_start when it is at least
 * the subscription period start). A later created timestamp on the same
 * period does not supersede a marker.
 */
export function subscriptionEvidenceSec(subscription: SubscriptionView): number | null {
  const bounds = periodBounds(subscription);
  if (!bounds.consistent) return null;
  const periodStart = bounds.start;
  const invoice = invoiceObject(subscription.latest_invoice);
  const invoicePeriodStart = positive(invoice?.period_start);
  const paidAt = positive(invoice?.status_transitions?.paid_at);
  if (invoicePeriodStart && paidAt && (periodStart == null || invoicePeriodStart >= periodStart)) {
    return invoicePeriodStart;
  }
  return periodStart;
}

export function invoiceHasDiscount(invoice: InvoiceView): boolean {
  if (invoice.discount?.coupon?.id) return true;
  if (Array.isArray(invoice.discounts) && invoice.discounts.length > 0) return true;
  const amounts = invoice.total_discount_amounts ?? [];
  return amounts.some(entry => (entry?.amount ?? 0) > 0);
}

/**
 * Active renewals require a paid invoice. Amount 0 renews when a discount is
 * present, or when total > 0 was settled by customer credit (amount_paid 0).
 * A paid invoice with total 0 and no discount is not a renewal and is not a
 * lifetime purchase. Trialing does not need a positive charge.
 */
export function subscriptionInvoiceDecision(
  subscription: SubscriptionView,
): { entitled: true; kind: "trial" | "paid" | "coupon" | "credit" } | { entitled: false } | { entitled: "unknown" } {
  const status = (subscription.status ?? "").toLowerCase();
  if (subscription.ended_at || status === "ended") return { entitled: false };
  if (subscription.pause_collection) return { entitled: false };
  if (status === "paused" || status === "canceled" || status === "cancelled" || status === "unpaid" || status === "past_due" || status === "incomplete" || status === "incomplete_expired") {
    return { entitled: false };
  }
  if (status !== "active" && status !== "trialing") return { entitled: false };
  if (status === "trialing") return { entitled: true, kind: "trial" };
  const invoice = subscription.latest_invoice;
  if (!invoice || typeof invoice === "string") return { entitled: "unknown" };
  if ((invoice.status ?? "").toLowerCase() !== "paid") return { entitled: false };
  const amount = typeof invoice.amount_paid === "number" ? invoice.amount_paid : null;
  const total = typeof invoice.total === "number" ? invoice.total : null;
  if (amount != null && amount > 0) return { entitled: true, kind: "paid" };
  if (invoiceHasDiscount(invoice)) return { entitled: true, kind: "coupon" };
  if (amount === 0 && total != null && total > 0) return { entitled: true, kind: "credit" };
  return { entitled: false };
}

export function verifiedLifetimePayment(session: LifetimeSessionView | null | undefined): boolean {
  if (!session) return false;
  if (session.metadata?.plan_id !== "lifetime") return false;
  if ((session.mode ?? "") !== "payment") return false;
  if ((session.payment_status ?? "").toLowerCase() !== "paid") return false;
  if (!(typeof session.amount_total === "number" && session.amount_total > 0)) return false;
  const intent = session.payment_intent;
  if (!intent || typeof intent === "string") return false;
  if (intent.status !== "succeeded") return false;
  return typeof intent.amount_received === "number" && intent.amount_received > 0;
}

function positiveUserId(value: unknown): number | null {
  if (typeof value !== "string" && typeof value !== "number") return null;
  const userId = typeof value === "number" ? value : parseInt(value, 10);
  return Number.isInteger(userId) && userId > 0 ? userId : null;
}

function metadataUserId(metadata: unknown): number | null {
  if (!metadata || typeof metadata !== "object") return null;
  return positiveUserId((metadata as { user_id?: unknown }).user_id);
}

/**
 * User ids carried on the event object, in lookup order after the Stripe
 * customer id: checkout/subscription/invoice metadata, then client_reference_id.
 * This does not hit the database. An empty list means the caller still looks
 * up the charge PaymentIntent before treating the event as unresolved.
 */
export function linkedUserIds(object: Record<string, unknown>): number[] {
  const parent = object.parent as { subscription_details?: { metadata?: unknown } } | undefined;
  const subscriptionDetails = object.subscription_details as { metadata?: unknown } | undefined;
  const nested = object.subscription;
  const candidates = [
    metadataUserId(object.metadata),
    metadataUserId(parent?.subscription_details?.metadata),
    metadataUserId(subscriptionDetails?.metadata),
    nested && typeof nested === "object" ? metadataUserId((nested as { metadata?: unknown }).metadata) : null,
    positiveUserId(object.client_reference_id),
  ];
  const ids: number[] = [];
  for (const userId of candidates) {
    if (userId && !ids.includes(userId)) ids.push(userId);
  }
  return ids;
}

export function cancellationMarkerFromEvent(event: {
  id: string;
  type: string;
  created?: number | null;
  data: { object?: { id?: string | null; status?: string | null; pause_collection?: unknown } | null };
}): { stripeSubscriptionId: string; canceledEventCreated: number; status: string; sourceEventId: string } | null {
  if (typeof event.created !== "number" || event.created <= 0) return null;
  const object = event.data.object;
  const subscriptionId = object?.id;
  if (!subscriptionId) return null;
  if (event.type === "customer.subscription.deleted") {
    return { stripeSubscriptionId: subscriptionId, canceledEventCreated: event.created, status: "canceled", sourceEventId: event.id };
  }
  if (event.type !== "customer.subscription.updated") return null;
  const status = (object?.status ?? "").toLowerCase();
  const paused = status === "paused" || Boolean(object?.pause_collection);
  const terminal = status === "canceled" || status === "cancelled" || status === "unpaid" || status === "past_due" || status === "incomplete_expired" || status === "ended";
  if (!paused && !terminal) return null;
  return {
    stripeSubscriptionId: subscriptionId,
    canceledEventCreated: event.created,
    status: paused && !terminal ? "paused" : status,
    sourceEventId: event.id,
  };
}

/**
 * Resume evidence is only the triggering subscription.updated whose status is
 * active or trialing and whose pause_collection is clear. invoice.paid is not
 * resume evidence: a delayed invoice must not erase a newer cancellation.
 */
export function resumeEvidenceFromEvent(event: {
  type: string;
  created?: number | null;
  data: { object?: { id?: string | null; status?: string | null; pause_collection?: unknown } | null };
}): ResumeEvidence | null {
  if (event.type !== "customer.subscription.updated") return null;
  if (typeof event.created !== "number" || event.created <= 0) return null;
  const object = event.data.object;
  const subscriptionId = object?.id;
  if (!subscriptionId) return null;
  const status = (object?.status ?? "").toLowerCase();
  if (status !== "active" && status !== "trialing") return null;
  if (object?.pause_collection) return null;
  return { subscriptionId, eventCreated: event.created };
}

function invoiceObject(invoice: SubscriptionView["latest_invoice"]): InvoiceView | null {
  if (!invoice || typeof invoice === "string") return null;
  return invoice;
}

export function latestInvoiceId(subscription: SubscriptionView): string | null {
  const invoice = subscription.latest_invoice;
  if (typeof invoice === "string") return invoice || null;
  if (!invoice || typeof invoice.id !== "string" || !invoice.id) return null;
  return invoice.id;
}

function markerSuperseded(marker: CancellationMarker): boolean {
  return marker.supersededEventCreated != null && marker.supersededEventCreated >= marker.canceledEventCreated;
}

function resumeLiftsMarker(subscription: SubscriptionView, marker: CancellationMarker, resume: ResumeEvidence | null): boolean {
  if (!resume) return false;
  if (resume.subscriptionId !== subscription.id) return false;
  if (resume.eventCreated <= marker.canceledEventCreated) return false;
  if (subscription.pause_collection) return false;
  const payment = subscriptionInvoiceDecision(subscription);
  return payment.entitled === true;
}

/**
 * A marker blocks an entitling subscription when the subscription's own
 * timestamps are missing or not newer than the marker, unless a corroborated
 * resume is allowed to supersede it.
 */
export function conflictsWithMarker(
  subscription: SubscriptionView,
  marker: CancellationMarker | undefined,
  resume: ResumeEvidence | null = null,
): boolean {
  if (!marker || markerSuperseded(marker)) return false;
  const payment = subscriptionInvoiceDecision(subscription);
  if (payment.entitled !== true) return false;
  if (resumeLiftsMarker(subscription, marker, resume)) return false;
  const evidence = subscriptionEvidenceSec(subscription);
  if (evidence == null) return true;
  return evidence <= marker.canceledEventCreated;
}

function priceIds(subscription: SubscriptionView): string[] {
  return (subscription.items?.data ?? [])
    .map(item => item?.price?.id)
    .filter((id): id is string => typeof id === "string" && id.length > 0)
    .sort();
}

function subscriptionsAgree(listCopy: SubscriptionView, retrieved: SubscriptionView): boolean {
  if (listCopy.id !== retrieved.id) return false;
  if ((listCopy.status ?? "") !== (retrieved.status ?? "")) return false;
  if (Boolean(listCopy.pause_collection) !== Boolean(retrieved.pause_collection)) return false;
  const left = periodBounds(listCopy);
  const right = periodBounds(retrieved);
  if (!left.consistent || !right.consistent) return false;
  if (left.end !== right.end) return false;
  if (priceIds(listCopy).join("\0") !== priceIds(retrieved).join("\0")) return false;
  const invoiceId = (subscription: SubscriptionView) => (
    typeof subscription.latest_invoice === "string"
      ? subscription.latest_invoice
      : subscription.latest_invoice?.id ?? null
  );
  return invoiceId(listCopy) === invoiceId(retrieved);
}

/** Highest known paid price on the subscription. Any unknown price is unresolved. */
function highestEntitledPrice(
  subscription: SubscriptionView,
  resolveTier: (priceId: string) => PaidTier | null,
): { tier: PaidTier; priceId: string } | { unresolved: true; priceId: string | null } {
  const items = (subscription.items?.data ?? []).filter((item): item is SubscriptionItemView => item != null);
  const priceIdsOnSub = items.map(item => item.price?.id).filter((id): id is string => typeof id === "string" && id.length > 0);
  if (priceIdsOnSub.length === 0) return { unresolved: true, priceId: null };
  let best: { tier: PaidTier; priceId: string } | null = null;
  for (const priceId of priceIdsOnSub) {
    const tier = resolveTier(priceId);
    if (!tier) return { unresolved: true, priceId };
    if (!best || TIER_RANK[tier] > TIER_RANK[best.tier]) best = { tier, priceId };
  }
  return best ?? { unresolved: true, priceId: null };
}

function expiryDate(subscription: SubscriptionView, nowMs: number): Date | "missing" | "past" | "inconsistent" {
  const bounds = periodBounds(subscription);
  if (!bounds.consistent) return "inconsistent";
  if (bounds.end == null) return "missing";
  if (bounds.end * 1000 <= nowMs) return "past";
  return new Date(bounds.end * 1000);
}

function supersedeFor(
  subscription: SubscriptionView,
  marker: CancellationMarker | undefined,
  resume: ResumeEvidence | null,
): EntitlementApply["supersedeCancellation"] {
  if (!marker || !resume || markerSuperseded(marker)) return null;
  if (!resumeLiftsMarker(subscription, marker, resume)) return null;
  const evidence = subscriptionEvidenceSec(subscription);
  if (evidence != null && evidence > marker.canceledEventCreated) return null;
  return { stripeSubscriptionId: subscription.id, eventCreated: resume.eventCreated };
}

export function decideEntitlement(input: {
  subscriptions: SubscriptionView[];
  listIncomplete: boolean;
  markers: CancellationMarker[];
  corroborated: SubscriptionView | null;
  storedLifetime: boolean;
  lifetimeVerified: boolean;
  lifetimePurchasedAt: Date | null;
  resolveTier: (priceId: string) => PaidTier | null;
  nowMs?: number;
  resume?: ResumeEvidence | null;
  /**
   * Invoice ids whose charge was fully refunded or is under an active dispute.
   * The subscription is skipped. A newer invoice id is unaffected.
   */
  revokedInvoiceIds?: readonly string[];
  /**
   * The stored lifetime flag is ignored for this decision. Set when that
   * purchase's own PaymentIntent is revoked and no newer lifetime payment
   * verified. Admin lifetime (no PaymentIntent) is not suppressed.
   */
  suppressStoredLifetime?: boolean;
}): EntitlementDecision {
  const nowMs = input.nowMs ?? Date.now();
  const resume = input.resume ?? null;
  const markers = new Map(input.markers.map(marker => [marker.stripeSubscriptionId, marker]));
  const revokedInvoices = new Set(input.revokedInvoiceIds ?? []);
  const considered = input.subscriptions.filter(subscription => {
    const invoiceId = latestInvoiceId(subscription);
    return invoiceId == null || !revokedInvoices.has(invoiceId);
  });

  for (const subscription of considered) {
    const payment = subscriptionInvoiceDecision(subscription);
    if (payment.entitled === true || payment.entitled === "unknown") {
      const bounds = periodBounds(subscription);
      if (!bounds.consistent) return { action: "conflict", reason: "inconsistent_period" };
    }
    if (conflictsWithMarker(subscription, markers.get(subscription.id), resume)) {
      return { action: "conflict", reason: "stale_active_after_cancellation" };
    }
  }
  if (input.listIncomplete) return { action: "conflict", reason: "subscription_list_incomplete" };

  let winner: { subscription: SubscriptionView; tier: PaidTier } | null = null;
  for (const subscription of considered) {
    const payment = subscriptionInvoiceDecision(subscription);
    if (payment.entitled === "unknown") {
      if (!input.corroborated || input.corroborated.id !== subscription.id) {
        return { action: "needs_corroboration", subscriptionId: subscription.id };
      }
      return { action: "conflict", reason: "invoice_unexpanded" };
    }
    if (payment.entitled !== true) continue;
    const priced = highestEntitledPrice(subscription, input.resolveTier);
    if ("unresolved" in priced) {
      return { action: "unresolved", priceId: priced.priceId, subscriptionId: subscription.id };
    }
    const tier = priced.tier;
    const expires = expiryDate(subscription, nowMs);
    if (expires === "inconsistent") return { action: "conflict", reason: "inconsistent_period" };
    if (expires === "missing") return { action: "conflict", reason: "missing_expiry" };
    if (expires === "past") continue;
    if (!winner || TIER_RANK[tier] > TIER_RANK[winner.tier]) winner = { subscription, tier };
  }

  const grantLifetime = (input.suppressStoredLifetime ? false : input.storedLifetime) || input.lifetimeVerified;
  if (winner) {
    if (!input.corroborated) return { action: "needs_corroboration", subscriptionId: winner.subscription.id };
    if (!subscriptionsAgree(winner.subscription, input.corroborated)) {
      return { action: "conflict", reason: "read_disagreement" };
    }
    const corroboratedPayment = subscriptionInvoiceDecision(input.corroborated);
    if (corroboratedPayment.entitled === "unknown") return { action: "conflict", reason: "invoice_unexpanded" };
    if (corroboratedPayment.entitled !== true || conflictsWithMarker(input.corroborated, markers.get(winner.subscription.id), resume)) {
      return { action: "conflict", reason: "read_disagreement" };
    }
    const expires = expiryDate(winner.subscription, nowMs);
    if (expires === "inconsistent") return { action: "conflict", reason: "inconsistent_period" };
    if (!(expires instanceof Date)) return { action: "conflict", reason: "missing_expiry" };
    return {
      action: "apply",
      accessTier: grantLifetime ? "founding" : winner.tier,
      stripeSubscriptionId: winner.subscription.id,
      grantLifetime,
      lifetimePurchasedAt: input.lifetimePurchasedAt,
      accessExpiresAt: expires,
      usesSubscription: true,
      supersedeCancellation: supersedeFor(winner.subscription, markers.get(winner.subscription.id), resume),
    };
  }

  return {
    action: "apply",
    accessTier: grantLifetime ? "founding" : "free",
    stripeSubscriptionId: null,
    grantLifetime,
    lifetimePurchasedAt: grantLifetime ? input.lifetimePurchasedAt : null,
    accessExpiresAt: null,
    usesSubscription: false,
    supersedeCancellation: null,
  };
}

/**
 * PaymentIntent of a Lifetime checkout. Promo codes are allowed, so the
 * session matches on plan_id lifetime, mode payment, and amount_total > 0.
 * This does not require amount_received: a later refund can zero that field
 * while the session still identifies the purchase. The list price is checked
 * only when the charge metadata itself says plan_id lifetime.
 */
export function lifetimePaymentIntentId(
  session: LifetimeSessionView | null | undefined,
): string | null {
  if (!session) return null;
  if (session.metadata?.plan_id !== "lifetime") return null;
  if ((session.mode ?? "") !== "payment") return null;
  if (!(typeof session.amount_total === "number" && session.amount_total > 0)) return null;
  const intent = session.payment_intent;
  if (typeof intent === "string" && intent) return intent;
  if (intent && typeof intent === "object" && typeof intent.id === "string" && intent.id) return intent.id;
  return null;
}

export type ChargeView = {
  id: string;
  amount: number | null;
  amount_refunded: number | null;
  refunded: boolean | null;
  customer: string | null;
  invoiceId: string | null;
  paymentIntentId: string | null;
  metadata: { plan_id?: string | null; user_id?: string | null } | null;
};

export type PurchaseRevocationMutation = {
  purchaseKey: string;
  reasonKind: string;
  purchaseKind: "lifetime" | "subscription";
  chargeId: string;
  invoiceId: string | null;
  paymentIntentId: string | null;
  subscriptionId: string | null;
  disputeId: string | null;
  disputeOutcome: "open" | "won" | "lost" | "charge_refunded" | null;
  active: boolean;
  sourceEventId: string;
  sourceEventCreated: number;
};

export type PurchaseRevocationSnapshot = PurchaseRevocationMutation & {
  userId: number;
};

/** Full refund revokes. A partial refund and a zero-amount charge do not. */
export function refundExtent(charge: Pick<ChargeView, "amount" | "amount_refunded" | "refunded">): "full" | "partial" | "none" {
  const amount = typeof charge.amount === "number" ? charge.amount : null;
  const refundedAmount = typeof charge.amount_refunded === "number" ? charge.amount_refunded : 0;
  if (amount == null || amount <= 0) return "none";
  if (charge.refunded === true || refundedAmount >= amount) return "full";
  if (refundedAmount > 0) return "partial";
  return "none";
}

export function disputeCloseDisposition(status: string | null | undefined): "won" | "revoke" | "ignore" | "unknown" {
  const normalized = (status ?? "").toLowerCase();
  if (normalized === "won") return "won";
  if (normalized === "lost" || normalized === "charge_refunded") return "revoke";
  if (normalized === "warning_closed" || normalized === "prevented") return "ignore";
  return "unknown";
}

function idString(value: unknown): string | null {
  if (typeof value === "string" && value) return value;
  if (value && typeof value === "object" && "id" in value && typeof (value as { id?: unknown }).id === "string") {
    const id = (value as { id: string }).id;
    return id || null;
  }
  return null;
}

/**
 * Dahlia (2026-04-22) removed Charge.invoice. A charge record never supplies
 * the invoice id, including when an older payload still carries that key.
 * The invoice id comes from InvoicePayment, looked up by payment_intent.
 */
export function chargeViewFromRecord(object: Record<string, unknown> | null | undefined): ChargeView | null {
  if (!object) return null;
  const id = idString(object.id) ?? (typeof object.id === "string" ? object.id : null);
  if (!id) return null;
  const metadata = object.metadata;
  return {
    id,
    amount: typeof object.amount === "number" ? object.amount : null,
    amount_refunded: typeof object.amount_refunded === "number" ? object.amount_refunded : null,
    refunded: typeof object.refunded === "boolean" ? object.refunded : null,
    customer: idString(object.customer),
    invoiceId: null,
    paymentIntentId: idString(object.payment_intent),
    metadata: metadata && typeof metadata === "object" ? metadata as ChargeView["metadata"] : null,
  };
}

export type InvoicePaymentView = {
  id?: string | null;
  invoice?: unknown;
  status?: string | null;
  payment?: { type?: string | null; payment_intent?: unknown } | null;
};

/**
 * Invoice paid by this PaymentIntent. A paid InvoicePayment wins. A canceled
 * one does not count. Dahlia charge fixtures have no invoice field.
 */
export function invoiceIdFromInvoicePayments(
  paymentIntentId: string,
  payments: readonly InvoicePaymentView[],
): string | null {
  let fallback: string | null = null;
  for (const payment of payments) {
    const intent = idString(payment.payment?.payment_intent);
    if (intent !== paymentIntentId) continue;
    const invoiceId = idString(payment.invoice);
    if (!invoiceId) continue;
    const status = (payment.status ?? "").toLowerCase();
    if (status === "paid") return invoiceId;
    if (!fallback && status !== "canceled" && status !== "cancelled") fallback = invoiceId;
  }
  return fallback;
}

export type LinkedPurchase =
  | { kind: "lifetime"; purchaseKey: string; paymentIntentId: string; chargeId: string }
  | { kind: "subscription"; purchaseKey: string; invoiceId: string; chargeId: string; subscriptionId: string | null }
  | { kind: "unrelated"; chargeId: string }
  | { kind: "unresolved"; chargeId: string };

/**
 * A charge is the Lifetime purchase only when its PaymentIntent is that
 * checkout, the charge itself carries plan_id lifetime at the Lifetime
 * amount, or the stored lifetime PaymentIntent is this charge. A subscription
 * purchase is the invoice paid by the charge's PaymentIntent. Amount alone
 * never links an unrelated charge to either one. A charge with a customer and
 * a positive amount but no InvoicePayment is unresolved, not unrelated: the
 * lookup may not have caught up, so the caller retries instead of sealing.
 */
export function linkChargeToPurchase(input: {
  charge: ChargeView;
  sessions: LifetimeSessionView[];
  subscriptions?: SubscriptionView[];
  lifetimeAmountCents?: number;
  storedLifetimePaymentIntentId?: string | null;
}): LinkedPurchase {
  const lifetimeAmount = input.lifetimeAmountCents ?? PRICING_PLANS.lifetime.amountCents;
  const paymentIntentId = input.charge.paymentIntentId;
  const sessionMatch = paymentIntentId
    ? input.sessions.some(session => lifetimePaymentIntentId(session) === paymentIntentId)
    : false;
  const metadataMatch = input.charge.metadata?.plan_id === "lifetime"
    && input.charge.amount === lifetimeAmount
    && paymentIntentId != null;
  const storedMatch = Boolean(
    paymentIntentId
    && input.storedLifetimePaymentIntentId
    && input.storedLifetimePaymentIntentId === paymentIntentId,
  );
  if ((sessionMatch || metadataMatch || storedMatch) && paymentIntentId) {
    return {
      kind: "lifetime",
      purchaseKey: `pi:${paymentIntentId}`,
      paymentIntentId,
      chargeId: input.charge.id,
    };
  }
  const invoiceId = input.charge.invoiceId;
  if (invoiceId && (input.charge.amount ?? 0) > 0) {
    const subscriptionId = (input.subscriptions ?? []).find(subscription => latestInvoiceId(subscription) === invoiceId)?.id ?? null;
    return {
      kind: "subscription",
      purchaseKey: `invoice:${invoiceId}`,
      invoiceId,
      chargeId: input.charge.id,
      subscriptionId,
    };
  }
  if (input.charge.customer && (input.charge.amount ?? 0) > 0) {
    return { kind: "unresolved", chargeId: input.charge.id };
  }
  return { kind: "unrelated", chargeId: input.charge.id };
}

export type ChargePlan = {
  reason: string;
  mutation: PurchaseRevocationMutation | null;
};

/**
 * What this event wants to record if it wins the source-timestamp race.
 * Partial refunds, zero-amount charges, unrelated charges, and non-revoking
 * dispute closes return an audit reason and no mutation.
 */
export function planChargeRevocation(input: {
  eventId: string;
  eventType: string;
  created: number;
  charge: ChargeView;
  sessions: LifetimeSessionView[];
  subscriptions?: SubscriptionView[];
  storedLifetimePaymentIntentId?: string | null;
  dispute?: { id: string; status: string | null; phase: "created" | "closed" };
}): ChargePlan {
  const linked = linkChargeToPurchase({
    charge: input.charge,
    sessions: input.sessions,
    subscriptions: input.subscriptions,
    storedLifetimePaymentIntentId: input.storedLifetimePaymentIntentId,
  });
  if (linked.kind === "unresolved") return { reason: "invoice_unlinked", mutation: null };
  if (input.eventType === "charge.refunded") {
    const extent = refundExtent(input.charge);
    if (extent === "none") return { reason: "charge.refunded:none", mutation: null };
    if (linked.kind === "unrelated") return { reason: "charge.refunded:unrelated", mutation: null };
    if (extent === "partial") return { reason: "charge.refunded:partial", mutation: null };
    return {
      reason: "charge.refunded:full",
      mutation: mutationFor(linked, {
        eventId: input.eventId,
        created: input.created,
        active: true,
        reasonKind: "full_refund",
        disputeId: null,
        disputeOutcome: null,
      }),
    };
  }
  if (!input.dispute) return { reason: `${input.eventType}:unrelated`, mutation: null };
  if (linked.kind === "unrelated") return { reason: `${input.eventType}:unrelated`, mutation: null };
  if ((input.charge.amount ?? 0) <= 0) return { reason: `${input.eventType}:none`, mutation: null };
  if (input.dispute.phase === "created") {
    return {
      reason: "charge.dispute.created",
      mutation: mutationFor(linked, {
        eventId: input.eventId,
        created: input.created,
        active: true,
        reasonKind: `dispute:${input.dispute.id}`,
        disputeId: input.dispute.id,
        disputeOutcome: "open",
      }),
    };
  }
  const disposition = disputeCloseDisposition(input.dispute.status);
  if (disposition === "unknown") return { reason: "charge.dispute.closed:unknown", mutation: null };
  if (disposition === "ignore") return { reason: `charge.dispute.closed:${(input.dispute.status ?? "ignored").toLowerCase()}`, mutation: null };
  const won = disposition === "won";
  const outcome = won ? "won" as const : (input.dispute.status ?? "").toLowerCase() === "charge_refunded" ? "charge_refunded" as const : "lost" as const;
  return {
    reason: won ? "charge.dispute.closed:won" : outcome === "charge_refunded" ? "charge.dispute.closed:charge_refunded" : "charge.dispute.closed:lost",
    mutation: mutationFor(linked, {
      eventId: input.eventId,
      created: input.created,
      active: !won,
      reasonKind: `dispute:${input.dispute.id}`,
      disputeId: input.dispute.id,
      disputeOutcome: outcome,
    }),
  };
}

function mutationFor(
  linked: Exclude<LinkedPurchase, { kind: "unrelated" } | { kind: "unresolved" }>,
  action: {
    eventId: string;
    created: number;
    active: boolean;
    reasonKind: string;
    disputeId: string | null;
    disputeOutcome: PurchaseRevocationMutation["disputeOutcome"];
  },
): PurchaseRevocationMutation {
  return {
    purchaseKey: linked.purchaseKey,
    reasonKind: action.reasonKind,
    purchaseKind: linked.kind,
    chargeId: linked.chargeId,
    invoiceId: linked.kind === "subscription" ? linked.invoiceId : null,
    paymentIntentId: linked.kind === "lifetime" ? linked.paymentIntentId : null,
    subscriptionId: linked.kind === "subscription" ? linked.subscriptionId : null,
    disputeId: action.disputeId,
    disputeOutcome: action.disputeOutcome,
    active: action.active,
    sourceEventId: action.eventId,
    sourceEventCreated: action.created,
  };
}

/**
 * Timestamp order for one purchase reason. An older event never applies.
 * The same event id is a replay and does not write again.
 * An equal timestamp is ordered so a clear wins: a dispute won in the same
 * second it was opened restores access, and the opening event cannot revoke
 * that clear. Delivery order does not change the result.
 */
export function reducePurchaseRevocation(
  existing: { active: boolean; sourceEventCreated: number; sourceEventId: string } | null,
  incoming: { active: boolean; sourceEventCreated: number; sourceEventId: string },
): { apply: boolean; stale: boolean } {
  if (!existing) return { apply: true, stale: false };
  if (existing.sourceEventId === incoming.sourceEventId) return { apply: false, stale: false };
  if (incoming.sourceEventCreated < existing.sourceEventCreated) return { apply: false, stale: true };
  if (incoming.sourceEventCreated === existing.sourceEventCreated) {
    if (!incoming.active && existing.active) return { apply: true, stale: false };
    if (incoming.active && !existing.active) return { apply: false, stale: true };
    return { apply: false, stale: false };
  }
  return { apply: true, stale: false };
}

export function revokedInvoiceIds(rows: ReadonlyArray<Pick<PurchaseRevocationSnapshot, "active" | "invoiceId">>): string[] {
  const ids: string[] = [];
  for (const row of rows) {
    if (!row.active || !row.invoiceId || ids.includes(row.invoiceId)) continue;
    ids.push(row.invoiceId);
  }
  return ids;
}

export function revokedLifetimePaymentIntentIds(rows: ReadonlyArray<Pick<PurchaseRevocationSnapshot, "active" | "purchaseKind" | "paymentIntentId">>): string[] {
  const ids: string[] = [];
  for (const row of rows) {
    if (!row.active || row.purchaseKind !== "lifetime" || !row.paymentIntentId || ids.includes(row.paymentIntentId)) continue;
    ids.push(row.paymentIntentId);
  }
  return ids;
}

/**
 * Stored lifetime is cleared only when its own PaymentIntent is revoked, or
 * when a legacy row has no PaymentIntent and every Lifetime session we can
 * see is revoked. An admin grant has no Lifetime session and stays, even
 * when some other PaymentIntent is revoked. A newer unrevoked Lifetime
 * session keeps access.
 */
export function lifetimeRevocationDecision(input: {
  storedLifetime: boolean;
  storedPaymentIntentId: string | null;
  sessions: LifetimeSessionView[];
  revokedPaymentIntentIds: readonly string[];
}): { suppressStoredLifetime: boolean; lifetimeVerified: boolean; lifetimePurchasedAt: Date | null; lifetimePaymentIntentId: string | null } {
  const revoked = new Set(input.revokedPaymentIntentIds);
  let lifetimeVerified = false;
  let lifetimePurchasedAt: Date | null = null;
  let grantedPaymentIntentId: string | null = null;
  const visibleLifetimeIntentIds: string[] = [];
  for (const session of input.sessions) {
    const paymentIntentId = lifetimePaymentIntentId(session);
    if (paymentIntentId) visibleLifetimeIntentIds.push(paymentIntentId);
    if (paymentIntentId && revoked.has(paymentIntentId)) continue;
    if (!verifiedLifetimePayment(session)) continue;
    lifetimeVerified = true;
    if (!lifetimePurchasedAt && typeof session.created === "number") lifetimePurchasedAt = new Date(session.created * 1000);
    if (!grantedPaymentIntentId && paymentIntentId) grantedPaymentIntentId = paymentIntentId;
  }
  const storedPi = input.storedPaymentIntentId;
  const storedRevoked = input.storedLifetime && storedPi != null && revoked.has(storedPi);
  const newerStoredPurchase = input.storedLifetime && storedPi != null && !revoked.has(storedPi);
  const legacyRevoked = input.storedLifetime
    && storedPi == null
    && visibleLifetimeIntentIds.length > 0
    && visibleLifetimeIntentIds.every(id => revoked.has(id))
    && !lifetimeVerified;
  const suppressStoredLifetime = !lifetimeVerified && !newerStoredPurchase && (storedRevoked || legacyRevoked);
  return {
    suppressStoredLifetime,
    lifetimeVerified,
    lifetimePurchasedAt,
    lifetimePaymentIntentId: grantedPaymentIntentId,
  };
}
