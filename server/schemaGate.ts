/**
 * Boot-time check for the columns and tables this candidate selects.
 * An unmigrated users table throws "Unknown column 'accessExpiresAt'" on the
 * first user read. This check fails before listen, with the migration names.
 * It does not apply SQL. No DATABASE_URL means local tooling, and the boot
 * check is skipped.
 */
import mysql from "mysql2/promise";

export const REQUIRED_USER_COLUMNS = ["accessExpiresAt", "entitlementRevision"] as const;
export const REQUIRED_TABLES = [
  "stripeSubscriptionCancellations",
  "pentagonalThesisRecords",
  "pentagonalThesisOutcomeScores",
  "systemicRegimeModels",
  "systemicRegimeReadings",
  "signalConvergenceReadings",
  "stripePaymentOrigins",
  "stripePaymentReversalEvents",
  "decisionLedgerOutcomeProvenance",
  "publishingRunClaims",
  "publishingDeliveryClaims",
  "adminAuditEvents",
  "userAlertMonitorStates",
  "userAlertEvents",
  "userAlertEventAcknowledgements",
  "oauthAuthorizationStates",
  "authSessions",
] as const;
/** Named non-primary indexes from the accepted 0083 auth-state/session tail. */
export const REQUIRED_INDEXES = [
  "oauthAuthorizationStates_expiresAt_idx",
  "authSessions_openId_expiresAt_idx",
  "authSessions_expiresAt_idx",
] as const;
export const REQUIRED_FOREIGN_KEYS = [
  "algo_outcome_prov_fk",
  "stripePaymentReversalEvents_origin_fk",
  "decisionLedgerOutcomeProvenance_ledger_fk",
  "userAlertMonitorStates_user_fk",
  "userAlertEvents_user_fk",
  "userAlertEventAcknowledgements_event_fk",
] as const;

/**
 * Named UNIQUE and CHECK constraints from the accepted 0078-0083 tail.
 * Foreign keys remain separate above so failures name their relationship.
 */
export const REQUIRED_TABLE_CONSTRAINTS = [
  "stripePaymentOrigins_paymentIntent_uniq",
  "stripePaymentOrigins_charge_uniq",
  "stripePaymentOrigins_checkoutSession_uniq",
  "stripePaymentOrigins_sourceEvent_uniq",
  "stripePaymentReversalEvents_event_uniq",
  "stripePaymentReversalEvents_policy_pending_only",
  "decisionLedgerOutcomeProvenance_key_uniq",
  "decisionLedgerOutcomeProvenance_entry_horizon_state_uniq",
  "publishingRunClaims_runKey_uniq",
  "publishingDeliveryClaims_deliveryKey_uniq",
  "adminAuditEvents_correlation_action_unique",
  "adminAuditEvents_before_json",
  "adminAuditEvents_after_json",
  "adminAuditEvents_outcome",
  "adminAuditEvents_correlation_safe",
  "userAlertMonitorStates_user_rule_unique",
  "userAlertEvents_user_event_key_unique",
  "userAlertEventAcknowledgements_event_unique",
] as const;

/**
 * Append-only enforcement is implemented by these migration-owned triggers,
 * not by application code. Their absence is therefore a schema-readiness
 * failure even when all table names are present.
 */
export const REQUIRED_TRIGGERS = [
  "stripePaymentOrigins_immutable_update",
  "stripePaymentOrigins_immutable_delete",
  "stripePaymentReversalEvents_immutable_update",
  "stripePaymentReversalEvents_immutable_delete",
  "decision_ledger_outcome_provenance_block_update",
  "decision_ledger_outcome_provenance_block_delete",
  "adminAuditEvents_append_only_update",
  "adminAuditEvents_append_only_delete",
  "user_alert_events_append_only_update",
  "user_alert_events_append_only_delete",
  "user_alert_event_acknowledgements_append_only_update",
  "user_alert_event_acknowledgements_append_only_delete",
] as const;

/** Existing ordered journal 0071 defines these runtime writer targets. */
export const REQUIRED_SYSTEMIC_COLUMNS = {
  systemicRegimeModels: ["id", "modelVersion", "modelType", "pcaMethod", "nStates", "featureSchemaVersion", "trainingStart", "trainingEnd", "approved", "registryJson", "createdAt"],
  systemicRegimeReadings: ["id", "dataAsOf", "computedAt", "historyClass", "currentRegime", "systemicRiskScore", "crisisProbability", "stressBuildingProbability", "transitionProbability", "regimeConfidence", "creditStressZ", "volStressZ", "ratesStressZ", "pc1", "factorArrowsJson", "freshnessStatus", "modelVersion", "modelType", "payloadJson", "contributesToPressureIndex"],
  signalConvergenceReadings: ["id", "computedAt", "level", "deterioratingCount", "availableCount", "voteCount", "methodology", "payloadJson", "contributesToPressureIndex"],
} as const;

export type SystemicSchemaColumn = { tableName: string; columnName: string; dataType?: string | null };

export function schemaGateMessage(missing: string[]): string {
  return [
    "Refusing to start. The database is behind this build.",
    `Missing: ${missing.join(", ")}.`,
    "Apply the existing ordered journals, including drizzle/0071_systemic_regime_engine.sql and drizzle/0074_stripe_entitlement_resync.sql through drizzle/0083_auth_state_and_sessions.sql, only through the approved migration process.",
    "Rehearse the ordered change on an isolated restored backup/PITR copy before any deploy; automatic schema repair and migration at boot are disabled.",
    "See docs/RC_DEPLOYMENT_AND_SCHEDULER_RUNBOOK.md.",
    "Do not start against an unmigrated users table: a users select that includes accessExpiresAt fails with Unknown column.",
    "0076 must leave the foreign key algo_outcome_prov_fk on algorithmOutcomeObservations.",
  ].join(" ");
}

export function missingSchemaObjects(
  presentColumns: Iterable<string>,
  presentTables: Iterable<string>,
  presentForeignKeys: Iterable<string> = [],
  presentTableConstraints: Iterable<string> = [],
  presentTriggers: Iterable<string> = [],
  presentIndexes: Iterable<string> = [],
): string[] {
  const columns = new Set(presentColumns);
  const tables = new Set(presentTables);
  const foreignKeys = new Set(presentForeignKeys);
  const constraints = new Set(presentTableConstraints);
  const triggers = new Set(presentTriggers);
  const indexes = new Set(presentIndexes);
  const missing: string[] = [];
  for (const column of REQUIRED_USER_COLUMNS) {
    if (!columns.has(column)) missing.push(`users.${column}`);
  }
  for (const table of REQUIRED_TABLES) {
    if (!tables.has(table)) missing.push(`table ${table}`);
  }
  for (const index of REQUIRED_INDEXES) {
    if (!indexes.has(index)) missing.push(`index ${index}`);
  }
  for (const foreignKey of REQUIRED_FOREIGN_KEYS) {
    if (!foreignKeys.has(foreignKey)) missing.push(`foreign key ${foreignKey}`);
  }
  for (const constraint of REQUIRED_TABLE_CONSTRAINTS) {
    if (!constraints.has(constraint)) missing.push(`constraint ${constraint}`);
  }
  for (const trigger of REQUIRED_TRIGGERS) {
    if (!triggers.has(trigger)) missing.push(`trigger ${trigger}`);
  }
  return missing;
}

/**
 * Validates the complete runtime writer shape without issuing DDL. registryJson
 * must remain LONGTEXT because an approved model bundle can be stored there.
 */
export function missingSystemicSchemaObjects(present: Iterable<SystemicSchemaColumn>): string[] {
  const byTable = new Map<string, Map<string, string | null | undefined>>();
  for (const row of Array.from(present)) {
    const columns = byTable.get(row.tableName) ?? new Map<string, string | null | undefined>();
    columns.set(row.columnName, row.dataType);
    byTable.set(row.tableName, columns);
  }

  const missing: string[] = [];
  for (const [tableName, requiredColumns] of Object.entries(REQUIRED_SYSTEMIC_COLUMNS)) {
    const presentColumns = byTable.get(tableName);
    if (!presentColumns) {
      missing.push(`table ${tableName}`);
      continue;
    }
    for (const columnName of requiredColumns) {
      if (!presentColumns.has(columnName)) missing.push(`${tableName}.${columnName}`);
    }
  }
  const registryJsonType = byTable.get("systemicRegimeModels")?.get("registryJson")?.toLowerCase();
  if (registryJsonType && registryJsonType !== "longtext") {
    missing.push("systemicRegimeModels.registryJson (expected longtext)");
  }
  return missing;
}

export function systemicSchemaGateMessage(missing: string[]): string {
  return [
    "Refusing systemic-regime work. The database is not ready for this build.",
    `Missing or incompatible: ${missing.join(", ")}.`,
    "Apply the existing ordered drizzle/0071_systemic_regime_engine.sql migration on a backup before enabling collection.",
    "Automatic schema repair and migration at boot are disabled.",
  ].join(" ");
}

function sqlList(values: readonly string[]): string {
  return values.map(value => `'${value}'`).join(", ");
}

export async function assertDeploySchemaReady(databaseUrl = process.env.DATABASE_URL): Promise<void> {
  if (!databaseUrl) {
    console.log("[Schema] DATABASE_URL is unset. Skipping the 0071 and 0074-0083 boot checks.");
    return;
  }
  const connection = await mysql.createConnection(databaseUrl);
  try {
    await connection.query("SET time_zone = '+00:00'");
    const [columnRows] = await connection.query(
      `SELECT COLUMN_NAME AS name FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users'
         AND COLUMN_NAME IN ('accessExpiresAt', 'entitlementRevision')`,
    );
    const [tableRows] = await connection.query(
      `SELECT TABLE_NAME AS name FROM information_schema.TABLES
       WHERE TABLE_SCHEMA = DATABASE()
         AND TABLE_NAME IN (${sqlList(REQUIRED_TABLES)})`,
    );
    const [indexRows] = await connection.query(
      `SELECT DISTINCT INDEX_NAME AS name FROM information_schema.STATISTICS
       WHERE TABLE_SCHEMA = DATABASE()
         AND (
           (TABLE_NAME = 'oauthAuthorizationStates' AND INDEX_NAME = 'oauthAuthorizationStates_expiresAt_idx')
           OR (TABLE_NAME = 'authSessions' AND INDEX_NAME = 'authSessions_openId_expiresAt_idx')
           OR (TABLE_NAME = 'authSessions' AND INDEX_NAME = 'authSessions_expiresAt_idx')
         )`,
    );
    const [foreignKeyRows] = await connection.query(
      `SELECT CONSTRAINT_NAME AS name FROM information_schema.TABLE_CONSTRAINTS
       WHERE CONSTRAINT_SCHEMA = DATABASE()
         AND CONSTRAINT_TYPE = 'FOREIGN KEY'
         AND CONSTRAINT_NAME IN (${sqlList(REQUIRED_FOREIGN_KEYS)})`,
    );
    const [constraintRows] = await connection.query(
      `SELECT CONSTRAINT_NAME AS name FROM information_schema.TABLE_CONSTRAINTS
       WHERE CONSTRAINT_SCHEMA = DATABASE()
         AND CONSTRAINT_NAME IN (${sqlList(REQUIRED_TABLE_CONSTRAINTS)})`,
    );
    const [triggerRows] = await connection.query(
      `SELECT TRIGGER_NAME AS name FROM information_schema.TRIGGERS
       WHERE TRIGGER_SCHEMA = DATABASE()
         AND TRIGGER_NAME IN (${sqlList(REQUIRED_TRIGGERS)})`,
    );
    const missing = missingSchemaObjects(
      (columnRows as Array<{ name: string }>).map(row => row.name),
      (tableRows as Array<{ name: string }>).map(row => row.name),
      (foreignKeyRows as Array<{ name: string }>).map(row => row.name),
      (constraintRows as Array<{ name: string }>).map(row => row.name),
      (triggerRows as Array<{ name: string }>).map(row => row.name),
      (indexRows as Array<{ name: string }>).map(row => row.name),
    );
    if (missing.length > 0) throw new Error(schemaGateMessage(missing));
  } finally {
    await connection.end();
  }
  await assertSystemicRegimeSchemaReady(databaseUrl);
}

/**
 * Read-only check used by systemic jobs as a second boundary for direct callers.
 * It deliberately does not create, alter, or otherwise repair the candidate schema.
 */
export async function assertSystemicRegimeSchemaReady(databaseUrl = process.env.DATABASE_URL): Promise<void> {
  if (!databaseUrl) {
    throw new Error("Refusing systemic-regime work. DATABASE_URL is required for schema readiness checks.");
  }
  const connection = await mysql.createConnection(databaseUrl);
  try {
    await connection.query("SET time_zone = '+00:00'");
    const [rows] = await connection.query(
      `SELECT TABLE_NAME AS tableName, COLUMN_NAME AS columnName, DATA_TYPE AS dataType
       FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE()
         AND TABLE_NAME IN ('systemicRegimeModels', 'systemicRegimeReadings', 'signalConvergenceReadings')`,
    );
    const missing = missingSystemicSchemaObjects(rows as SystemicSchemaColumn[]);
    if (missing.length > 0) throw new Error(systemicSchemaGateMessage(missing));
  } finally {
    await connection.end();
  }
}
