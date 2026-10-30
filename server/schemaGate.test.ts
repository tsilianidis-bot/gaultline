import { describe, expect, it } from "vitest";
import {
  missingSchemaObjects,
  missingSystemicSchemaObjects,
  REQUIRED_FOREIGN_KEYS,
  REQUIRED_SYSTEMIC_COLUMNS,
  REQUIRED_TABLE_CONSTRAINTS,
  REQUIRED_TABLES,
  REQUIRED_TRIGGERS,
  REQUIRED_USER_COLUMNS,
  schemaGateMessage,
  systemicSchemaGateMessage,
} from "./schemaGate";

function completeSystemicSchema() {
  return Object.entries(REQUIRED_SYSTEMIC_COLUMNS).flatMap(([tableName, columns]) =>
    columns.map(columnName => ({
      tableName,
      columnName,
      dataType: tableName === "systemicRegimeModels" && columnName === "registryJson" ? "longtext" : "text",
    })),
  );
}

describe("deploy schema gate", () => {
  it("names the ordered journal tail when an accepted-tail object is absent", () => {
    const missing = missingSchemaObjects([], []);
    expect(missing).toContain("users.accessExpiresAt");
    expect(missing).toContain("table stripePaymentOrigins");
    expect(missing).toContain("foreign key stripePaymentReversalEvents_origin_fk");
    expect(missing).toContain("constraint stripePaymentReversalEvents_policy_pending_only");
    expect(missing).toContain("trigger user_alert_events_append_only_delete");

    const message = schemaGateMessage(missing);
    expect(message).toContain("Refusing to start");
    expect(message).toContain("0071_systemic_regime_engine.sql");
    expect(message).toContain("0074_stripe_entitlement_resync.sql through drizzle/0082_durable_alert_events.sql");
    expect(message).toContain("restored backup/PITR copy");
    expect(message).toContain("Unknown column");
  });

  it("passes only when all runtime tables, constraints, and append-only triggers are present", () => {
    expect(missingSchemaObjects(
      REQUIRED_USER_COLUMNS,
      REQUIRED_TABLES,
      REQUIRED_FOREIGN_KEYS,
      REQUIRED_TABLE_CONSTRAINTS,
      REQUIRED_TRIGGERS,
    )).toEqual([]);
  });

  it("fails closed for a missing systemic schema instead of attempting runtime DDL", () => {
    const missing = missingSystemicSchemaObjects([]);
    expect(missing).toContain("table systemicRegimeModels");
    expect(missing).toContain("table systemicRegimeReadings");
    expect(missing).toContain("table signalConvergenceReadings");
    const message = systemicSchemaGateMessage(missing);
    expect(message).toContain("0071_systemic_regime_engine.sql");
    expect(message).toContain("Automatic schema repair and migration at boot are disabled.");
  });

  it("accepts the source-backed 0071 schema shape and rejects a truncated model registry column", () => {
    const schema = completeSystemicSchema();
    expect(missingSystemicSchemaObjects(schema)).toEqual([]);
    const incompatible = schema.map(column =>
      column.tableName === "systemicRegimeModels" && column.columnName === "registryJson"
        ? { ...column, dataType: "text" }
        : column,
    );
    expect(missingSystemicSchemaObjects(incompatible)).toContain("systemicRegimeModels.registryJson (expected longtext)");
  });
});
