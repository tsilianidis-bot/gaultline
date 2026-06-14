/**
 * One-time seed script: create the two simulated portfolio accounts.
 * Run with: node scripts/seedSimAccounts.mjs
 */
import { createRequire } from "module";
import { register } from "node:module";
import { pathToFileURL } from "node:url";

// Use tsx to run TypeScript directly
import { execSync } from "child_process";

const today = new Date().toISOString().slice(0, 10);

const code = `
import { upsertSimAccount } from "./server/db.js";

async function seed() {
  await upsertSimAccount({
    accountType: "stocks",
    cashBalance: "10000.00",
    startedAt: "${today}",
  });
  console.log("✅ Stocks account seeded");

  await upsertSimAccount({
    accountType: "crypto",
    cashBalance: "10000.00",
    startedAt: "${today}",
  });
  console.log("✅ Crypto account seeded");
  process.exit(0);
}
seed().catch(e => { console.error(e); process.exit(1); });
`;

import { writeFileSync, unlinkSync } from "fs";
const tmpFile = "/tmp/seedSimAccounts_run.ts";
writeFileSync(tmpFile, code);

try {
  execSync(`cd /home/ubuntu/copy-of-faultline && npx tsx ${tmpFile}`, { stdio: "inherit" });
} finally {
  unlinkSync(tmpFile);
}
