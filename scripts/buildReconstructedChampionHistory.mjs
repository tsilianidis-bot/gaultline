import { buildReconstructedChampionV1History } from "../server/reconstructedChampionHistory.ts";

const fromMonth = process.argv[2] ?? "2000-01";
const toMonth = process.argv[3] ?? "2026-07";
const result = await buildReconstructedChampionV1History(fromMonth, toMonth);
console.log(JSON.stringify({ fromMonth, toMonth, result }, null, 2));
process.exit(0);
