import { bigint, boolean, index, int, mysqlTable, timestamp, uniqueIndex, varchar } from "drizzle-orm/mysql-core";

/**
 * Forward-only linkage between a confirmed Stripe payment and the local user it
 * was originally attributed to. This is deliberately separate from users:
 * legacy entitlement rows have no invented payment provenance.
 */
export const stripePaymentOrigins = mysqlTable("stripePaymentOrigins", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  stripeCheckoutSessionId: varchar("stripeCheckoutSessionId", { length: 255 }),
  stripePaymentIntentId: varchar("stripePaymentIntentId", { length: 255 }).notNull(),
  stripeChargeId: varchar("stripeChargeId", { length: 255 }).notNull(),
  stripeCustomerId: varchar("stripeCustomerId", { length: 255 }).notNull(),
  amount: bigint("amount", { mode: "number" }).notNull(),
  currency: varchar("currency", { length: 3 }).notNull(),
  livemode: boolean("livemode").notNull(),
  sourceEventId: varchar("sourceEventId", { length: 255 }).notNull(),
  sourceEventCreated: bigint("sourceEventCreated", { mode: "number" }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  paymentIntentUniq: uniqueIndex("stripePaymentOrigins_paymentIntent_uniq").on(table.stripePaymentIntentId),
  chargeUniq: uniqueIndex("stripePaymentOrigins_charge_uniq").on(table.stripeChargeId),
  checkoutSessionUniq: uniqueIndex("stripePaymentOrigins_checkoutSession_uniq").on(table.stripeCheckoutSessionId),
  sourceEventUniq: uniqueIndex("stripePaymentOrigins_sourceEvent_uniq").on(table.sourceEventId),
  userIdx: index("stripePaymentOrigins_user_idx").on(table.userId),
  customerIdx: index("stripePaymentOrigins_customer_idx").on(table.stripeCustomerId),
}));

/**
 * Signed refund/dispute lifecycle evidence. `policy_pending` is intentionally
 * not an entitlement state: a founder-approved policy must decide any access
 * mutation from these facts later in separate reviewed policy state. The SQL
 * migration makes this row append-only and restricts it to policy_pending.
 */
export const stripePaymentReversalEvents = mysqlTable("stripePaymentReversalEvents", {
  id: int("id").autoincrement().primaryKey(),
  stripeEventId: varchar("stripeEventId", { length: 255 }).notNull(),
  stripeEventType: varchar("stripeEventType", { length: 128 }).notNull(),
  reversalKind: varchar("reversalKind", { length: 16 }).notNull(),
  providerObjectId: varchar("providerObjectId", { length: 255 }),
  stripePaymentOriginId: int("stripePaymentOriginId").notNull().references(
    () => stripePaymentOrigins.id,
    { onDelete: "restrict", onUpdate: "restrict" },
  ),
  userId: int("userId").notNull(),
  stripeCheckoutSessionId: varchar("stripeCheckoutSessionId", { length: 255 }),
  stripePaymentIntentId: varchar("stripePaymentIntentId", { length: 255 }).notNull(),
  stripeChargeId: varchar("stripeChargeId", { length: 255 }).notNull(),
  stripeCustomerId: varchar("stripeCustomerId", { length: 255 }).notNull(),
  reversalAmount: bigint("reversalAmount", { mode: "number" }).notNull(),
  currency: varchar("currency", { length: 3 }).notNull(),
  livemode: boolean("livemode").notNull(),
  providerStatus: varchar("providerStatus", { length: 64 }).notNull(),
  eventCreated: bigint("eventCreated", { mode: "number" }).notNull(),
  reconciliationState: varchar("reconciliationState", { length: 32 }).notNull().default("policy_pending"),
  recordedAt: timestamp("recordedAt").defaultNow().notNull(),
}, (table) => ({
  eventUniq: uniqueIndex("stripePaymentReversalEvents_event_uniq").on(table.stripeEventId),
  providerObjectIdx: index("stripePaymentReversalEvents_providerObject_idx").on(table.providerObjectId),
  originIdx: index("stripePaymentReversalEvents_origin_idx").on(table.stripePaymentOriginId, table.eventCreated),
  userIdx: index("stripePaymentReversalEvents_user_idx").on(table.userId, table.eventCreated),
}));

export type StripePaymentOrigin = typeof stripePaymentOrigins.$inferSelect;
export type StripePaymentReversalEvent = typeof stripePaymentReversalEvents.$inferSelect;
