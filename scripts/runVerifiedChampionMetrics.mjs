import { runLockedVerifiedChampionMetrics } from "../server/verifiedChampionMetrics.ts";

const outputPath = "/home/ubuntu/copy-of-faultline/VERIFIED_CHAMPION_V1_METRICS.json";
const result = await runLockedVerifiedChampionMetrics(outputPath);
console.log(JSON.stringify(result, null, 2));
process.exit(0);
