import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const schema = readFileSync(resolve(root, "drizzle/schema.ts"), "utf8");
const shadowEngine = readFileSync(resolve(root, "server/pressure/shadowEngine.ts"), "utf8");
const engineVersionRepair = readFileSync(resolve(root, "drizzle/0056_shadow_model_engine_version_repair.sql"), "utf8");
const legacyFlagRepair = readFileSync(resolve(root, "drizzle/0057_shadow_model_legacy_flag_default_repair.sql"), "utf8");
const outcomeRepair = readFileSync(resolve(root, "drizzle/0058_shadow_forward_outcomes_compatibility_repair.sql"), "utf8");
const horizonRepair = readFileSync(resolve(root, "drizzle/0059_shadow_forward_outcomes_legacy_horizon_nullable.sql"), "utf8");

describe("V3-H shadow persistence schema compatibility", () => {
  it("keeps canonical schema fields aligned with the active shadow writer", () => {
    [
      'engineVersion:       varchar("engineVersion"',
      'horizon:             mysqlEnum("horizon", ["1d", "5d", "20d"]).notNull()',
      'sp500ReturnPct:      decimal("sp500ReturnPct"',
      'stressEventOccurred: boolean("stressEventOccurred")',
      'engineVersion: "v3h-1.0.0"',
      'for (const [horizon, days] of [["1d", 1], ["5d", 5], ["20d", 20]] as const)',
    ].forEach(expected => {
      expect(`${schema}\n${shadowEngine}`).toContain(expected);
    });
  });

  it("records additive repairs for the deployed legacy table drift without dropping historical columns", () => {
    expect(engineVersionRepair).toContain("ADD COLUMN `engineVersion`");
    expect(legacyFlagRepair).toContain("`v3hHigher` boolean NOT NULL DEFAULT false");
    ["`horizon`", "`sp500ReturnPct`", "`nasdaqReturnPct`", "`vixAtOutcome`", "`stressEventOccurred`"].forEach(column => {
      expect(outcomeRepair).toContain(column);
    });
    expect(horizonRepair).toContain("MODIFY COLUMN `horizonDays` int NULL");
    [engineVersionRepair, legacyFlagRepair, outcomeRepair, horizonRepair].forEach(migration => {
      expect(migration).not.toContain("DROP");
    });
  });
});
