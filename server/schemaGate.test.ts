import { describe, expect, it } from "vitest";
import { missingSchemaObjects, schemaGateMessage } from "./schemaGate";

describe("deploy schema gate", () => {
  it("names 0074-0076 when accessExpiresAt is absent", () => {
    const missing = missingSchemaObjects([], []);
    expect(missing).toContain("users.accessExpiresAt");
    expect(missing).toContain("foreign key algo_outcome_prov_fk");
    const message = schemaGateMessage(missing);
    expect(message).toContain("Refusing to start");
    expect(message).toContain("0074_stripe_entitlement_resync.sql");
    expect(message).toContain("0075_pentagonal_thesis_records.sql");
    expect(message).toContain("0076_algorithm_outcome_fk_name.sql");
    expect(message).toContain("Unknown column");
  });

  it("passes when the required columns and tables are present", () => {
    expect(missingSchemaObjects(
      ["accessExpiresAt", "entitlementRevision"],
      ["stripeSubscriptionCancellations", "pentagonalThesisRecords", "pentagonalThesisOutcomeScores"],
      ["algo_outcome_prov_fk"],
    )).toEqual([]);
  });
});