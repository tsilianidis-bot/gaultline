import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(import.meta.dirname, "..");
const canonicalHistoricalMigrations = {
  "drizzle/0057_flawless_nuke.sql":
    "e27c5cd660735b2d8309cce11a236fee47ad3cff6bf038e5d026f0cd3b6f1cb5",
  "drizzle/0058_lovely_skin.sql":
    "48d8aa97a70e6a43fbbcb23ae327b588a6d275e59e13dd80c1954c263ea6ec87",
  "drizzle/0060_overrated_golden_guardian.sql":
    "d4e7fb08e58512cf03cadc77a4502b4857839da8ad1665cd541b61dc2f16aa41",
  "drizzle/0064_misty_lockheed.sql":
    "0ed12d875314da0a6b66631bac8473c75f19ed04d43437797fb20378c44b71cc",
} as const;

function sha256(path: string): string {
  return createHash("sha256")
    .update(readFileSync(resolve(root, path)))
    .digest("hex");
}

describe("migration source integrity and readiness wiring", () => {
  it("preserves the canonical checksum-sensitive 0057, 0058, 0060, and 0064 sources", () => {
    for (const [path, expectedHash] of Object.entries(
      canonicalHistoricalMigrations
    )) {
      expect(sha256(path), path).toBe(expectedHash);
    }
  });

  it("configures every 0078-0082 runtime declaration module as a Drizzle schema input", () => {
    const config = readFileSync(resolve(root, "drizzle.config.ts"), "utf8");
    for (const path of [
      "./drizzle/schema.ts",
      "./drizzle/billingPaymentLinkageSchema.ts",
      "./drizzle/decisionOutcomeProvenanceSchema.ts",
      "./drizzle/publishingDeliveryClaimsSchema.ts",
      "./drizzle/ownerAdminAuditSchema.ts",
      "./server/durableAlertEventsSchema.ts",
    ]) {
      expect(config).toContain(`"${path}"`);
    }
  });

  it("builds source-only fresh MySQL bootstrap SQL while preserving every journal ledger entry", () => {
    const result = spawnSync(
      process.execPath,
      ["scripts/buildCandidateFreshMySqlMigrationSql.mjs"],
      { cwd: root, encoding: "utf8", maxBuffer: 16 * 1024 * 1024 }
    );
    expect(result.status, result.stderr).toBe(0);
    expect(result.stderr).toContain('"lastTag":"0082_durable_alert_events"');
    expect(result.stdout).toContain("-- journal 82: 0082_durable_alert_events");
    expect(result.stdout).toContain("INSERT INTO `__drizzle_migrations`");
    expect(result.stdout).toContain(
      "CREATE TRIGGER `user_alert_events_append_only_update`"
    );
  });
});
