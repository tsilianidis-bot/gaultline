/**
 * Direct seed script: run the first sim portfolio evaluation by calling
 * the engine functions directly (bypasses tRPC auth for seeding purposes).
 * Run with: node --experimental-specifier-resolution=node scripts/runFirstEvaluation.mjs
 */

// We call the /api/schedule/daily-sim-update endpoint which is a public POST endpoint
// registered for the heartbeat cron system

const BASE = "http://localhost:3000";

async function run() {
  console.log("[FirstEval] Calling scheduled daily-sim-update endpoint...");
  console.log("[FirstEval] This will fetch live prices and make real trade decisions.");
  console.log("[FirstEval] Estimated time: 30-120 seconds...\n");

  const start = Date.now();

  const res = await fetch(`${BASE}/api/schedule/daily-sim-update`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-heartbeat-secret": process.env.HEARTBEAT_SECRET ?? "",
    },
  });

  const elapsed = ((Date.now() - start) / 1000).toFixed(1);
  const text = await res.text();

  console.log(`[FirstEval] HTTP ${res.status} in ${elapsed}s`);
  console.log(`[FirstEval] Response: ${text.slice(0, 1000)}`);
}

run().catch(err => {
  console.error("[FirstEval] Fatal:", err.message);
  process.exit(1);
});
