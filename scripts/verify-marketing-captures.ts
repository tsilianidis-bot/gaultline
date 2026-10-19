import { readFileSync, existsSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { createHash } from "node:crypto";
import {
  SHOWCASE_EVIDENCE,
  hasVerifiedCapture,
  isLocalMarketingAssetPath,
} from "../client/src/components/marketing/showcaseEvidence";

/** No network, database, model, screenshot generation or source mutation. */
const output = process.argv[2];
const root = process.cwd();
const rows = SHOWCASE_EVIDENCE.map(item => {
  const gate = item.verification;
  const qualified = hasVerifiedCapture(item);
  const artifacts: {
    viewport: string;
    path: string | null;
    exists: boolean;
    hashMatches: boolean;
  }[] = [];
  for (const [viewport, path, expectedHash] of [
    ["desktop", gate.actualCapturePath, gate.captureSha256],
    ["mobile", gate.mobileCapturePath, gate.mobileCaptureSha256],
  ] as const) {
    const absolute = isLocalMarketingAssetPath(path)
      ? resolve(root, "client/public", path.replace(/^\//, ""))
      : null;
    const exists = absolute !== null && existsSync(absolute);
    const hashMatches =
      exists &&
      createHash("sha256").update(readFileSync(absolute!)).digest("hex") ===
        expectedHash;
    artifacts.push({ viewport, path, exists, hashMatches });
  }
  const qualificationRecordExists =
    gate.operationalQualificationPath !== null &&
    existsSync(resolve(root, gate.operationalQualificationPath));
  return {
    id: item.id,
    category: item.label,
    classification: gate.observationClassification,
    sourceBranch: gate.sourceBranch,
    sourceSha: gate.sourceSha,
    captureDate: gate.capturedAt,
    observationDate: gate.observationAt,
    status: gate.status,
    manifestQualified: qualified,
    qualificationRecordExists,
    artifacts,
    admitted:
      qualified &&
      qualificationRecordExists &&
      artifacts.every(artifact => artifact.exists && artifact.hashMatches),
    blockers: item.promotionBlockers ?? [],
  };
});
const result = {
  schemaVersion: 1,
  purpose:
    "Source-integrity check; metadata and hashes do not independently prove market operation.",
  entries: rows,
  admittedCount: rows.filter(row => row.admitted).length,
  pendingCount: rows.filter(row => row.status === "pending").length,
  violations: rows
    .filter(row => row.status === "verified" && !row.admitted)
    .map(row => row.id),
};
if (output) writeFileSync(output, JSON.stringify(result, null, 2) + "\n");
console.log(JSON.stringify(result, null, 2));
process.exitCode = result.violations.length ? 1 : 0;
