import { writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import type { TrpcContext } from "../server/_core/context";

if (process.env.DATABASE_URL)
  throw new Error(
    "Refusing a database-connected run. This check is only for the database-free sandbox candidate."
  );
// No mock responses: any accidental provider request aborts rather than inventing evidence.
globalThis.fetch = async () => {
  throw new Error(
    "External requests are forbidden in this database-free readiness check."
  );
};

const { marketStateRouter } = await import("../server/routers/marketState");
const { organicContentRouter } = await import(
  "../server/routers/organicContent"
);
const context = { user: null } as TrpcContext;
const canonical = await marketStateRouter
  .createCaller(context)
  .canonicalCurrent();
const brief = await organicContentRouter
  .createCaller(context)
  .listPublished({ contentType: "daily_market_brief", limit: 1, offset: 0 });
const result = {
  sourceBranch: execFileSync("git", ["branch", "--show-current"], {
    encoding: "utf8",
  }).trim(),
  sourceSha: execFileSync("git", ["rev-parse", "HEAD"], {
    encoding: "utf8",
  }).trim(),
  verifiedAt: new Date().toISOString(),
  scope:
    "Real public router read procedures in the local database-free candidate; no API response fixtures or external requests.",
  canonicalUnavailable: canonical === null,
  snapshotBoundBriefUnavailable: brief.items.length === 0 && brief.total === 0,
  operationalCapturesAdmissible: false,
  classification: "Unavailable runtime; not operational market-data evidence.",
  blockers: [
    "No approved nonproduction canonical manifest store is connected.",
    "No published snapshot-bound Daily Brief resource is connected.",
  ],
};
if (!result.canonicalUnavailable || !result.snapshotBoundBriefUnavailable)
  throw new Error(
    "Unexpected data in database-free runtime; stop and independently qualify before any capture."
  );
if (process.argv[2])
  writeFileSync(process.argv[2], JSON.stringify(result, null, 2) + "\n");
console.log(JSON.stringify(result, null, 2));
