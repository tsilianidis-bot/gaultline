/**
 * Convergent entitlement decision.
 *
 * Webhooks do not patch from the event payload. They recompute one user's
 * access from the current subscription list plus a verified lifetime payment.
 * A cancellation marker (Stripe event.created, unix seconds) outranks a later
 * Stripe payload whose own timestamps are older. That conflict is not sealed.
 * A paid $0 invoice renews only when the invoice is paid and carries a discount.
 * Paused subscriptions and pause_collection are not entitled.
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
  items?: { data?: Array<{ price?: { id?: string | null } | null } | null> | null } | null;
  latest_invoice?: string | InvoiceView | null;
};

export type CancellationMarker = {
  stripeSubscriptionId: string;
  canceledEventCreated: number;
  status: string;
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
};

export type EntitlementDecision =
  | EntitlementApply
  | { action: "needs_corroboration"; subscriptionId: string }
  | { action: "conflict"; reason: "stale_active_after_cancellation" | "subscription_list_incomplete" | "single_read" | "read_disagreement" | "invoice_unexpanded" | "missing_expiry" }
  | { action: "unresolved"; priceId: string | null; subscriptionId: string };

export function subscriptionEvidenceSec(subscription: SubscriptionView): number | null {
  const invoice = invoiceObject(subscription.latest_invoice);
  const candidates = [
    subscription.current_period_start,
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
 * Active renewals require a paid invoice. Amount 0 is a renewal only when a
 * discount is present (100% coupon). Trialing does not need a positive charge.
 * An unexpanded invoice id is unknown, not a refusal.
 */
export function subscriptionInvoiceDecision(
  subscription: SubscriptionView,
): { entitled: true; kind: "trial" | "paid" | "coupon" } | { entitled: false } | { entitled: "unknown" } {
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
  if ((amount ?? 0) > 0) return { entitled: true, kind: "paid" };
  if (amount === 0 || total === 0) {
    return invoiceHasDiscount(invoice) ? { entitled: true, kind: "coupon" } : { entitled: false };
  }
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

function invoiceObject(invoice: SubscriptionView["latest_invoice"]): InvoiceView | null {
  if (!invoice || typeof invoice === "string") return null;
  return invoice;
}

function conflictsWithMarker(subscription: SubscriptionView, marker: CancellationMarker | undefined): boolean {
  if (!marker) return false;
  const payment = subscriptionInvoiceDecision(subscription);
  if (payment.entitled !== true) return false;
  const evidence = subscriptionEvidenceSec(subscription);
  if (evidence == null) return true;
  return evidence <= marker.canceledEventCreated;
}

function subscriptionsAgree(listCopy: SubscriptionView, retrieved: SubscriptionView): boolean {
  if (listCopy.id !== retrieved.id) return false;
  if ((listCopy.status ?? "") !== (retrieved.status ?? "")) return false;
  if ((listCopy.current_period_end ?? null) !== (retrieved.current_period_end ?? null)) return false;
  if (Boolean(listCopy.pause_collection) !== Boolean(retrieved.pause_collection)) return false;
  const invoiceId = (subscription: SubscriptionView) => (
    typeof subscription.latest_invoice === "string"
      ? subscription.latest_invoice
      : subscription.latest_invoice?.id ?? null
  );
  return invoiceId(listCopy) === invoiceId(retrieved);
}

function expiryDate(subscription: SubscriptionView, nowMs: number): Date | null {
  const end = subscription.current_period_end ?? subscription.trial_end;
  if (typeof end !== "number" || end <= 0) return null;
  if (end * 1000 <= nowMs) return null;
  return new Date(end * 1000);
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
}): EntitlementDecision {
  const nowMs = input.nowMs ?? Date.now();
  const markers = new Map(input.markers.map(marker => [marker.stripeSubscriptionId, marker]));

  for (const subscription of input.subscriptions) {
    if (conflictsWithMarker(subscription, markers.get(subscription.id))) {
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
    if (!expires) {
      if (typeof (subscription.current_period_end ?? subscription.trial_end) !== "number") {
        return { action: "conflict", reason: "missing_expiry" };
      }
      continue;
    }
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
    if (corroboratedPayment.entitled !== true || conflictsWithMarker(input.corroborated, markers.get(winner.subscription.id))) {
      return { action: "conflict", reason: "read_disagreement" };
    }
    const expires = expiryDate(winner.subscription, nowMs);
    if (!expires) return { action: "conflict", reason: "missing_expiry" };
    return {
      action: "apply",
      accessTier: grantLifetime ? "founding" : winner.tier,
      stripeSubscriptionId: winner.subscription.id,
      grantLifetime,
      lifetimePurchasedAt: input.lifetimePurchasedAt,
      accessExpiresAt: expires,
      usesSubscription: true,
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
  };
}
