import { persistPreRegisteredChampionEvaluationProtocol } from "../server/verifiedHistoricalEventDefinitions.ts";

const result = await persistPreRegisteredChampionEvaluationProtocol();
console.log(JSON.stringify(result, null, 2));
process.exit(0);
