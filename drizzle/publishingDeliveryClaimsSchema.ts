import { index, int, mysqlEnum, mysqlTable, timestamp, uniqueIndex, varchar } from "drizzle-orm/mysql-core";

/**
 * Durable guards for scheduled publishing and message transport attempts.
 *
 * These tables intentionally do not declare foreign keys to legacy content or
 * user tables. A claim must survive an article/user retention or reconciliation
 * operation so that an unknown remote side effect is never automatically sent
 * again merely because a related row disappeared.
 */
export const publishingRunClaims = mysqlTable("publishingRunClaims", {
  id: int("id").autoincrement().primaryKey(),
  /** Stable `publishType:YYYY-MM-DD` key, unique across callbacks/restarts. */
  runKey: varchar("runKey", { length: 160 }).notNull(),
  publishType: varchar("publishType", { length: 32 }).notNull(),
  cycleDateEt: varchar("cycleDateEt", { length: 10 }).notNull(),
  /** `generating` is deliberately non-recoverable automatically: a process may have invoked an LLM. */
  state: mysqlEnum("state", ["claimed", "generating", "completed", "failed", "exhausted"]).notNull(),
  attemptId: varchar("attemptId", { length: 32 }).notNull(),
  attempt: int("attempt").notNull(),
  leaseExpiresAt: timestamp("leaseExpiresAt"),
  retryAfter: timestamp("retryAfter"),
  outputStatus: varchar("outputStatus", { length: 16 }),
  outputSlug: varchar("outputSlug", { length: 220 }),
  failureReason: varchar("failureReason", { length: 255 }),
  completedAt: timestamp("completedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (t) => ({
  runKeyUnique: uniqueIndex("publishingRunClaims_runKey_uniq").on(t.runKey),
  stateRetryIdx: index("publishingRunClaims_state_retry_idx").on(t.state, t.retryAfter),
}));

/**
 * A single recipient/message identity. `accepted` means the configured email
 * transport accepted the request; it is not a recipient-delivery receipt.
 * `dispatching` and `ambiguous` are intentionally not eligible for automatic
 * recovery because the remote transport may already have accepted the message.
 */
export const publishingDeliveryClaims = mysqlTable("publishingDeliveryClaims", {
  id: int("id").autoincrement().primaryKey(),
  /** Stable message identity, e.g. `onboarding:1:user:42` or `brief:slug:user:42`. */
  deliveryKey: varchar("deliveryKey", { length: 220 }).notNull(),
  deliveryType: varchar("deliveryType", { length: 48 }).notNull(),
  userId: int("userId").notNull(),
  state: mysqlEnum("state", ["claimed", "dispatching", "accepted", "rejected", "skipped", "exhausted", "ambiguous"]).notNull(),
  attemptId: varchar("attemptId", { length: 32 }).notNull(),
  attempt: int("attempt").notNull(),
  leaseExpiresAt: timestamp("leaseExpiresAt"),
  retryAfter: timestamp("retryAfter"),
  /** Provider acceptance only; recipient receipt/delivery is deliberately absent until webhook reconciliation exists. */
  providerAcceptedAt: timestamp("providerAcceptedAt"),
  failureReason: varchar("failureReason", { length: 255 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (t) => ({
  deliveryKeyUnique: uniqueIndex("publishingDeliveryClaims_deliveryKey_uniq").on(t.deliveryKey),
  stateRetryIdx: index("publishingDeliveryClaims_state_retry_idx").on(t.state, t.retryAfter),
  userDeliveryIdx: index("publishingDeliveryClaims_user_delivery_idx").on(t.userId, t.deliveryType),
}));
