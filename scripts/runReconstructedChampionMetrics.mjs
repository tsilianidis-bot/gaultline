import { writeFile } from "node:fs/promises";
import { runReconstructedChampionMetrics } from "../server/reconstructedChampionMetrics.ts";

const result = await runReconstructedChampionMetrics();
const payload = { generatedAt: new Date().toISOString(), ...result };
await writeFile("RECONSTRUCTED_CHAMPION_V1_METRICS.json", `${JSON.stringify(payload, null, 2)}\n`);
console.log(JSON.stringify(payload, null, 2));
process.exit(0);
