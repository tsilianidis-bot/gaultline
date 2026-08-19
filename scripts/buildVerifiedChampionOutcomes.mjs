import { buildIndependentSp500Outcomes } from "../server/verifiedHistoricalOutcomes.ts";

const fromMonth = process.argv[2] ?? "2023-08";
const toMonth = process.argv[3] ?? "2026-07";
const result = await buildIndependentSp500Outcomes(fromMonth, toMonth);

console.log(JSON.stringify({ fromMonth, toMonth, result }, null, 2));
process.exit(0);
