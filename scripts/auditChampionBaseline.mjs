import { getPressureHistory } from "../server/db.ts";
import { summarizeChampionRecreation } from "../server/pressure/championBaseline.ts";

const records = await getPressureHistory();
const summary = summarizeChampionRecreation(records.map((record) => ({
  month: record.month,
  overallPressure: record.overallPressure,
  regime: record.regime,
  liquidityStress: record.liquidityStress,
  creditContagion: record.creditContagion,
  volatilityRegime: record.volatilityRegime,
  macroSensitivity: record.macroSensitivity,
  marketBreadth: record.marketBreadth,
  aiBubble: record.aiBubble,
  baaSpread: record.baaSpread === null ? null : Number(record.baaSpread),
  hySpreadProxy: record.hySpreadProxy === null ? null : Number(record.hySpreadProxy),
  tsy10y: record.tsy10y === null ? null : Number(record.tsy10y),
  tsy2y: record.tsy2y === null ? null : Number(record.tsy2y),
  fedfunds: record.fedfunds === null ? null : Number(record.fedfunds),
  cpiYoy: record.cpiYoy === null ? null : Number(record.cpiYoy),
  unemployment: record.unemployment === null ? null : Number(record.unemployment),
})));

console.log(JSON.stringify(summary, null, 2));
process.exit(0);
