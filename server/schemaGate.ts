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
] as const;
export const REQUIRED_FOREIGN_KEYS = ["algo_outcome_prov_fk"] as const;

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
    "Apply the existing ordered journals, including drizzle/0071_systemic_regime_engine.sql, drizzle/0074_stripe_entitlement_resync.sql, drizzle/0075_pentagonal_thesis_records.sql, and drizzle/0076_algorithm_outcome_fk_name.sql, on a backup before this deploy.",
    "See docs/RC_DEPLOYMENT_AND_SCHEDULER_RUNBOOK.md.",
    "Do not start against an unmigrated users table: a users select that includes accessExpiresAt fails with Unknown column.",
    "0076 must leave the foreign key algo_outcome_prov_fk on algorithmOutcomeObservations.",
  ].join(" ");
}

export function missingSchemaObjects(
  presentColumns: Iterable<string>,
  presentTables: Iterable<string>,
  presentForeignKeys: Iterable<string> = [],
): string[] {
  const columns = new Set(presentColumns);
  const tables = new Set(presentTables);
  const keys = new Set(presentForeignKeys);
  const missing: string[] = [];
  for (const column of REQUIRED_USER_COLUMNS) {
    if (!columns.has(column)) missing.push(`users.${column}`);
  }
  for (const table of REQUIRED_TABLES) {
    if (!tables.has(table)) missing.push(`table ${table}`);
  }
  for (const key of REQUIRED_FOREIGN_KEYS) {
    if (!keys.has(key)) missing.push(`foreign key ${key}`);
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

export async function assertDeploySchemaReady(databaseUrl = process.env.DATABASE_URL): Promise<void> {
  if (!databaseUrl) {
    console.log("[Schema] DATABASE_URL is unset. Skipping the 0071 and 0074-0076 boot checks.");
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
         AND TABLE_NAME IN ('stripeSubscriptionCancellations', 'pentagonalThesisRecords', 'pentagonalThesisOutcomeScores', 'systemicRegimeModels', 'systemicRegimeReadings', 'signalConvergenceReadings')`,
    );
    const [keyRows] = await connection.query(
      `SELECT CONSTRAINT_NAME AS name FROM information_schema.TABLE_CONSTRAINTS
       WHERE CONSTRAINT_SCHEMA = DATABASE()
         AND TABLE_NAME = 'algorithmOutcomeObservations'
         AND CONSTRAINT_NAME = 'algo_outcome_prov_fk'
         AND CONSTRAINT_TYPE = 'FOREIGN KEY'`,
    );
    const missing = missingSchemaObjects(
      (columnRows as Array<{ name: string }>).map(row => row.name),
      (tableRows as Array<{ name: string }>).map(row => row.name),
      (keyRows as Array<{ name: string }>).map(row => row.name),
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
