import { index, int, mysqlTable, text, timestamp, uniqueIndex, varchar } from "drizzle-orm/mysql-core";

/**
 * Owner/admin mutation evidence only. This table deliberately has no foreign
 * keys: a retained audit event must survive a target-user deletion and must not
 * contain mutable user profile data. Approval-email events use a server-created
 * UUID correlation identifier, never a recipient address or request body.
 */
export const adminAuditEvents = mysqlTable("adminAuditEvents", {
  id: int("id").autoincrement().primaryKey(),
  actorUserId: int("actorUserId").notNull(),
  action: varchar("action", { length: 96 }).notNull(),
  targetType: varchar("targetType", { length: 64 }).notNull(),
  targetId: int("targetId"),
  targetKey: varchar("targetKey", { length: 128 }),
  correlationId: varchar("correlationId", { length: 36 }),
  beforeStateJson: text("beforeStateJson").notNull(),
  afterStateJson: text("afterStateJson").notNull(),
  outcome: varchar("outcome", { length: 24 }).notNull(),
  occurredAt: timestamp("occurredAt").defaultNow().notNull(),
}, table => ({
  actorOccurredAtIdx: index("adminAuditEvents_actor_occurredAt_idx").on(table.actorUserId, table.occurredAt),
  targetOccurredAtIdx: index("adminAuditEvents_target_occurredAt_idx").on(table.targetType, table.targetId, table.occurredAt),
  actionOccurredAtIdx: index("adminAuditEvents_action_occurredAt_idx").on(table.action, table.occurredAt),
  correlationActionUnique: uniqueIndex("adminAuditEvents_correlation_action_unique").on(table.correlationId, table.action),
}));

export type AdminAuditEvent = typeof adminAuditEvents.$inferSelect;
