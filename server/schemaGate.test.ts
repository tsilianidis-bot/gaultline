import { describe, expect, it } from "vitest";
import {
  missingSchemaObjects,
  missingSystemicSchemaObjects,
  REQUIRED_SYSTEMIC_COLUMNS,
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
  it("names the existing ordered journals when accessExpiresAt is absent", () => {
    const missing = missingSchemaObjects([], []);
    expect(missing).toContain("users.accessExpiresAt");
    expect(missing).toContain("foreign key algo_outcome_prov_fk");
    const message = schemaGateMessage(missing);
    expect(message).toContain("Refusing to start");
    expect(message).toContain("0071_systemic_regime_engine.sql");
    expect(message).toContain("0074_stripe_entitlement_resync.sql");
    expect(message).toContain("0075_pentagonal_thesis_records.sql");
    expect(message).toContain("0076_algorithm_outcome_fk_name.sql");
    expect(message).toContain("Unknown column");
  });

  it("passes when the required columns, tables, and foreign key are present", () => {
    expect(missingSchemaObjects(
      ["accessExpiresAt", "entitlementRevision"],
      [
        "stripeSubscriptionCancellations",
        "pentagonalThesisRecords",
        "pentagonalThesisOutcomeScores",
        "systemicRegimeModels",
        "systemicRegimeReadings",
        "signalConvergenceReadings",
      ],
      ["algo_outcome_prov_fk"],
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
