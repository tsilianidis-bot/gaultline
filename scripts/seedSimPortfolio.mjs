/**
 * Seed script: trigger the first sim portfolio daily update
 * Run with: node scripts/seedSimPortfolio.mjs
 */
import { createRequire } from "module";

const BASE = "http://localhost:3000";

async function triggerDailyUpdate() {
  console.log("[Seed] Triggering first sim portfolio daily update...");
  console.log("[Seed] This fetches live prices from Yahoo Finance + CoinGecko and runs FAULTLINE signal engine.");
  console.log("[Seed] Estimated time: 30-90 seconds...\n");

  const start = Date.now();

  // First enable the feature flag temporarily so the update can run
  // The runDailyUpdate procedure checks the flag internally — we need to bypass for seeding
  // Use the internal endpoint with a special header
  const res = await fetch(`${BASE}/api/trpc/simPortfolio.runDailyUpdate?batch=1`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-internal": "1",
    },
    body: JSON.stringify({ "0": { json: {} } }),
  });

  const elapsed = ((Date.now() - start) / 1000).toFixed(1);

  if (!res.ok) {
    const text = await res.text();
    console.error(`[Seed] HTTP ${res.status}: ${text.slice(0, 500)}`);
    return;
  }

  const data = await res.json();
  const result = data?.[0]?.result?.data?.json;
  const error = data?.[0]?.error?.json;

  if (error) {
    console.error(`[Seed] tRPC error: ${error.message}`);
    console.error(JSON.stringify(error, null, 2));
    return;
  }

  console.log(`[Seed] ✅ Daily update completed in ${elapsed}s`);
  console.log(`[Seed] Trades executed: ${result?.tradesExecuted ?? 0}`);
  console.log(`[Seed] Journal date: ${result?.journalDate ?? "N/A"}`);
  console.log(`[Seed] Result:`, JSON.stringify(result, null, 2));
}

triggerDailyUpdate().catch(err => {
  console.error("[Seed] Fatal error:", err);
  process.exit(1);
});
