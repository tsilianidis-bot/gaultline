import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

function source(relativePath: string): string {
  return readFileSync(resolve(import.meta.dirname, "..", relativePath), "utf8");
}

describe("Intelligence Contract v2 scope placeholders", () => {
  const scope = source("docs/FAULTLINE_INTELLIGENCE_CONTRACT_V2_SCOPE.md");

  it("records the approved stages and mandatory fields without implementing a v2 engine", () => {
    expect(scope).toContain("REALITY");
    expect(scope).toContain("CAUSATION");
    expect(scope).toContain("CONSEQUENCE");
    expect(scope).toContain("VERIFICATION");
    expect(scope).toContain("ACTION");
    expect(scope).toContain("What Would Change My Mind?");
    expect(scope).toContain("not implemented");
    expect(scope).not.toMatch(/default confidence\s*=\s*\d+/);
  });

  it("links Decision Ledger and Validation Center to the scope without invented scores", () => {
    const ledger = source("server/decisionLedgerEvaluator.ts");
    const validation = source("server/routers/intelligenceValidation.ts");
    const ledgerUi = source("client/src/pages/DecisionLedger.tsx");
    const validationUi = source("client/src/pages/IntelligenceValidation.tsx");

    for (const text of [ledger, validation, ledgerUi, validationUi]) {
      expect(text).toContain("FAULTLINE_INTELLIGENCE_CONTRACT_V2_SCOPE");
      expect(text).not.toMatch(/v2StageConfidence\s*=\s*\d+/);
      expect(text).not.toContain("INVENTED_V2_TRIGGER");
    }
  });
});
