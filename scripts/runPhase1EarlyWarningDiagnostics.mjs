import { writeFile } from "node:fs/promises";
import { runPhase1EarlyWarningDiagnostics } from "../server/phase1EarlyWarningDiagnostics.ts";

const result = await runPhase1EarlyWarningDiagnostics();
await writeFile(
  new URL("../PHASE_1_EARLY_WARNING_DIAGNOSTICS.json", import.meta.url),
  `${JSON.stringify(result, null, 2)}\n`,
  "utf8",
);
console.log(JSON.stringify({
  datasetTier: result.datasetTier,
  events: result.summary.eventCount,
  compositeWarned: result.summary.compositeWarnedCount,
  compositeMissed: result.summary.compositeMissedCount,
  macro4to8Weeks: result.leadIndicatorAssessment.macroSensitivityFourToEightWeeks.status,
}, null, 2));
