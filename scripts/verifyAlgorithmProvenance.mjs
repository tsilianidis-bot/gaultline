import { calculateFaultlinePressure } from "../server/pressure/engine.ts";
import { recordForwardChampionProvenance } from "../server/algorithmProvenance.ts";

const pressure = await calculateFaultlinePressure();
const result = await recordForwardChampionProvenance(pressure);
console.log(JSON.stringify({
  score: pressure.overallPressure,
  regime: pressure.regime,
  dataSource: pressure.dataSource,
  provenance: result,
}, null, 2));
process.exit(0);
