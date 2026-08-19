import { buildVerifiedChampionV1History } from "../server/verifiedHistoricalValidation.ts";

const args = process.argv.slice(2);
const from = args[0] ?? "2018-05";
const to = args[1] ?? new Date().toISOString().slice(0, 7);
const maxMonths = args[2] ? Number(args[2]) : undefined;

const result = await buildVerifiedChampionV1History({ fromMonth: from, toMonth: to, maxMonths });
console.log(JSON.stringify({ from, to, maxMonths: maxMonths ?? null, result }, null, 2));
process.exit(0);
