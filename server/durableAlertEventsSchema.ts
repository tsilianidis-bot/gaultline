import {
  boolean,
  decimal,
  index,
  int,
  mysqlEnum,
  mysqlTable,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/mysql-core";
import { users } from "../drizzle/schema";

/**
 * Personal alert-monitor state. One row per authenticated user and fixed
 * threshold rule. A state row is a current evaluation baseline, not an event.
 */
export const userAlertMonitorStates = mysqlTable("userAlertMonitorStates", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  ruleId: varchar("ruleId", { length: 64 }).notNull(),
  lastBreached: boolean("lastBreached").notNull(),
  lastValue: decimal("lastValue", { precision: 18, scale: 6 }),
  lastFreshness: varchar("lastFreshness", { length: 32 }).notNull(),
  lastSource: varchar("lastSource", { length: 255 }),
  lastObservedAt: timestamp("lastObservedAt"),
  transitionSequence: int("transitionSequence").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  userRuleUnique: uniqueIndex("userAlertMonitorStates_user_rule_unique").on(table.userId, table.ruleId),
  userUpdatedIdx: index("userAlertMonitorStates_user_updated_idx").on(table.userId, table.updatedAt),
}));

/**
 * Append-only personal in-app alert history. `deliveryStatus = not_sent` is
 * deliberately explicit: this store does not send email, push, or any other
 * external notification. Acknowledgement is an immutable related record below,
 * never a mutable property of the event evidence itself.
 */
export const userAlertEvents = mysqlTable("userAlertEvents", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().references(() => users.id, { onDelete: "restrict" }),
  eventKey: varchar("eventKey", { length: 128 }).notNull(),
  ruleId: varchar("ruleId", { length: 64 }).notNull(),
  transitionSequence: int("transitionSequence").notNull(),
  category: mysqlEnum("category", ["threshold_breach"]).notNull(),
  severity: mysqlEnum("severity", ["critical", "high", "elevated", "moderate"]).notNull(),
  metric: varchar("metric", { length: 64 }).notNull(),
  direction: mysqlEnum("direction", ["above", "below"]).notNull(),
  threshold: decimal("threshold", { precision: 18, scale: 6 }).notNull(),
  observedValue: decimal("observedValue", { precision: 18, scale: 6 }).notNull(),
  source: varchar("source", { length: 255 }).notNull(),
  sourceObservedAt: timestamp("sourceObservedAt").notNull(),
  dataFreshness: varchar("dataFreshness", { length: 32 }).notNull(),
  evidenceKind: mysqlEnum("evidenceKind", ["client_observed"]).default("client_observed").notNull(),
  deliveryStatus: mysqlEnum("deliveryStatus", ["not_sent"]).default("not_sent").notNull(),
  eventAt: timestamp("eventAt").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  userEventKeyUnique: uniqueIndex("userAlertEvents_user_event_key_unique").on(table.userId, table.eventKey),
  userEventIdx: index("userAlertEvents_user_event_idx").on(table.userId, table.id),
  userRuleEventIdx: index("userAlertEvents_user_rule_event_idx").on(table.userId, table.ruleId, table.id),
}));

/**
 * One immutable acknowledgement can be appended for an event. The event owner
 * is derived through eventId in the service query; no caller-provided owner is
 * retained and no evidence row is updated to mark an acknowledgement.
 */
export const userAlertEventAcknowledgements = mysqlTable("userAlertEventAcknowledgements", {
  id: int("id").autoincrement().primaryKey(),
  eventId: int("eventId").notNull().references(() => userAlertEvents.id, { onDelete: "restrict" }),
  acknowledgedAt: timestamp("acknowledgedAt").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  eventUnique: uniqueIndex("userAlertEventAcknowledgements_event_unique").on(table.eventId),
}));
