/**
 * Boot-time check for the columns and tables this candidate selects.
 * An unmigrated users table throws "Unknown column 'accessExpiresAt'" on the
 * first user read. This check fails before listen, with the migration names.
 * It does not apply SQL. No DATABASE_URL means local tooling, and the check
 * is skipped.
 */
import mysql from "mysql2/promise";

export const REQUIRED_USER_COLUMNS = ["accessExpiresAt", "entitlementRevision"] as const;
export const REQUIRED_TABLES = [
  "stripeSubscriptionCancellations",
  "pentagonalThesisRecords",
  "pentagonalThesisOutcomeScores",
] as const;
export const REQUIRED_FOREIGN_KEYS = ["algo_outcome_prov_fk"] as const;

export function schemaGateMessage(missing: string[]): string {
  return [
    "Refusing to start. The database is behind this build.",
    `Missing: ${missing.join(", ")}.`,
    "Apply drizzle/0074_stripe_entitlement_resync.sql, drizzle/0075_pentagonal_thesis_records.sql, and drizzle/0076_algorithm_outcome_fk_name.sql on a backup before this deploy.",
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

export async function assertDeploySchemaReady(databaseUrl = process.env.DATABASE_URL): Promise<void> {
  if (!databaseUrl) {
    console.log("[Schema] DATABASE_URL is unset. Skipping the 0074-0076 boot check.");
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
         AND TABLE_NAME IN ('stripeSubscriptionCancellations', 'pentagonalThesisRecords', 'pentagonalThesisOutcomeScores')`,
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
    if (missing.length > 0) {
      throw new Error(schemaGateMessage(missing));
    }
  } finally {
    await connection.end();
  }
}
