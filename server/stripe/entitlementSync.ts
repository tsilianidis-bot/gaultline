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
 * purchase does not.
 */

import type { AccessTier } from "../../shared/tiers";

export type PaidTier = Exclude<AccessTier, "free">;

export type InvoiceView = {
  id?: string | null;
  status?: string | null;
  amount_paid?: number | null;
  total?: number | null;
  created?: number | null;
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

export function subscriptionEvidenceSec(subscription: SubscriptionView): number | null {
  const bounds = periodBounds(subscription);
  const invoice = invoiceObject(subscription.latest_invoice);
  const candidates = [
    bounds.consistent ? bounds.start : null,
    invoice?.status_transitions?.paid_at,
    invoice?.created,
    subscription.start_date,
  ].filter((value): value is number => typeof value === "number" && value > 0);
  if (candidates.length === 0) return null;
  return Math.max(...candidates);
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
  const amount = typeof intent.amount_received === "number" ? intent.amount_received : intent.amount;
  return typeof amount === "number" && amount > 0;
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
 * This does not hit the database. An empty list means the caller must not
 * acknowledge the event.
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

function subscriptionsAgree(listCopy: SubscriptionView, retrieved: SubscriptionView): boolean {
  if (listCopy.id !== retrieved.id) return false;
  if ((listCopy.status ?? "") !== (retrieved.status ?? "")) return false;
  if (Boolean(listCopy.pause_collection) !== Boolean(retrieved.pause_collection)) return false;
  const left = periodBounds(listCopy);
  const right = periodBounds(retrieved);
  if (!left.consistent || !right.consistent) return false;
  if (left.end !== right.end) return false;
  const invoiceId = (subscription: SubscriptionView) => (
    typeof subscription.latest_invoice === "string"
      ? subscription.latest_invoice
      : subscription.latest_invoice?.id ?? null
  );
  return invoiceId(listCopy) === invoiceId(retrieved);
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
}): EntitlementDecision {
  const nowMs = input.nowMs ?? Date.now();
  const resume = input.resume ?? null;
  const markers = new Map(input.markers.map(marker => [marker.stripeSubscriptionId, marker]));

  for (const subscription of input.subscriptions) {
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
  for (const subscription of input.subscriptions) {
    const payment = subscriptionInvoiceDecision(subscription);
    if (payment.entitled === "unknown") {
      if (!input.corroborated || input.corroborated.id !== subscription.id) {
        return { action: "needs_corroboration", subscriptionId: subscription.id };
      }
      return { action: "conflict", reason: "invoice_unexpanded" };
    }
    if (payment.entitled !== true) continue;
    const priceId = subscription.items?.data?.[0]?.price?.id ?? null;
    if (!priceId) return { action: "unresolved", priceId: null, subscriptionId: subscription.id };
    const tier = input.resolveTier(priceId);
    if (!tier) return { action: "unresolved", priceId, subscriptionId: subscription.id };
    const expires = expiryDate(subscription, nowMs);
    if (expires === "inconsistent") return { action: "conflict", reason: "inconsistent_period" };
    if (expires === "missing") return { action: "conflict", reason: "missing_expiry" };
    if (expires === "past") continue;
    if (!winner || TIER_RANK[tier] > TIER_RANK[winner.tier]) winner = { subscription, tier };
  }

  const grantLifetime = input.storedLifetime || input.lifetimeVerified;
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
