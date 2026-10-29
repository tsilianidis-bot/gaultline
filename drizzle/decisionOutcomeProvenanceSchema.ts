import {
  double,
  index,
  int,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/mysql-core";
import { decisionLedger } from "./schema";

/**
 * Append-only evidence captured for an automatic Decision Ledger evaluation.
 * This is deliberately separate from decision_ledger: older recommendations
 * remain untouched, and every attempted horizon evaluation has its own receipt.
 */
export const decisionLedgerOutcomeProvenance = mysqlTable(
  "decisionLedgerOutcomeProvenance",
  {
    id: int("id").autoincrement().primaryKey(),
    provenanceKey: varchar("provenanceKey", { length: 96 }).notNull(),
    decisionLedgerId: int("decisionLedgerId")
      .notNull()
      .references(() => decisionLedger.id, { onDelete: "restrict" }),
    provenanceVersion: varchar("provenanceVersion", { length: 48 })
      .notNull(),
    evaluationState: mysqlEnum("evaluationState", [
      "verified",
      "pending_unverifiable",
    ]).notNull(),
    /** Provider queried for the historical bars; null when no asset source applies. */
    sourceProvider: varchar("sourceProvider", { length: 64 }),
    assetType: mysqlEnum("assetType", ["stock", "crypto"]),
    assetSymbol: varchar("assetSymbol", { length: 20 }),
    /** Original decision_ledger.createdAt, copied only into this receipt. */
    originalIssuedAt: timestamp("originalIssuedAt").notNull(),
    /** Original issuance plus the parsed declared horizon, copied only into this receipt. */
    horizonAt: timestamp("horizonAt").notNull(),
    /** Provider-supplied timestamp for the price used as the source-backed entry baseline. */
    entryObservationAt: timestamp("entryObservationAt"),
    entryPrice: double("entryPrice"),
    /** Provider-supplied timestamp for the source-backed horizon observation. */
    horizonObservationAt: timestamp("horizonObservationAt"),
    horizonPrice: double("horizonPrice"),
    returnPct: double("returnPct"),
    outcome: mysqlEnum("outcome", [
      "correct",
      "incorrect",
      "partially_correct",
      "still_active",
    ]),
    /** When this evaluator received the adapter response; never a provider observation time. */
    receivedAt: timestamp("receivedAt").notNull(),
    reason: varchar("reason", { length: 96 }).notNull(),
    /** Selection rule, non-scoring legacy value, and numerical evidence. */
    evidenceJson: text("evidenceJson").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => ({
    provenanceKeyUnique: uniqueIndex(
      "decisionLedgerOutcomeProvenance_key_uniq"
    ).on(table.provenanceKey),
    /** One immutable receipt per entry/horizon/state prevents conflicting retries. */
    ledgerHorizonStateUnique: uniqueIndex(
      "decisionLedgerOutcomeProvenance_entry_horizon_state_uniq"
    ).on(table.decisionLedgerId, table.horizonAt, table.evaluationState),
    ledgerReceiptIdx: index("decisionLedgerOutcomeProvenance_ledger_receipt_idx").on(
      table.decisionLedgerId,
      table.receivedAt
    ),
  })
);

export type DecisionLedgerOutcomeProvenance =
  typeof decisionLedgerOutcomeProvenance.$inferSelect;
export type InsertDecisionLedgerOutcomeProvenance =
  typeof decisionLedgerOutcomeProvenance.$inferInsert;
