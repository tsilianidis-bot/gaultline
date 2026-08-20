import { evaluatePhase1BAcceptanceGate } from "../server/phase1bAcceptanceGate.ts";
import { getDb } from "../server/db.ts";
import { governedIntelligenceClaims, intelligenceStateManifests, reconstructedHistoricalScores } from "../drizzle/schema.ts";
import { and, count, eq } from "drizzle-orm";
import { writeFile } from "node:fs/promises";

const db = await getDb();
if (!db) throw new Error("Database unavailable for Phase 1B acceptance gate");

const [coherent, claims, predictiveEligible, suppressed, qualifiedAnalogs, scores, missing] = await Promise.all([
  db.select({ total: count() }).from(intelligenceStateManifests).where(eq(intelligenceStateManifests.coherenceStatus, "COHERENT")),
  db.select({ total: count() }).from(governedIntelligenceClaims),
  db.select({ total: count() }).from(governedIntelligenceClaims).where(eq(governedIntelligenceClaims.displayStatus, "PREDICTIVE_ELIGIBLE")),
  db.select({ total: count() }).from(governedIntelligenceClaims).where(eq(governedIntelligenceClaims.displayStatus, "SUPPRESS_PREDICTIVE_PRESENTATION")),
  db.select({ total: count() }).from(governedIntelligenceClaims).where(and(eq(governedIntelligenceClaims.claimType, "ANALOG_SIMILARITY"), eq(governedIntelligenceClaims.displayStatus, "DISPLAY_WITH_QUALIFICATION"))),
  db.select({ total: count() }).from(reconstructedHistoricalScores).where(eq(reconstructedHistoricalScores.scoreStatus, "COMPLETE")),
  db.select({ total: count() }).from(reconstructedHistoricalScores).where(and(eq(reconstructedHistoricalScores.scoreMonth, "2018-03"), eq(reconstructedHistoricalScores.scoreStatus, "INCOMPLETE"))),
]);

const result = evaluatePhase1BAcceptanceGate({
  coherentStateManifestCount: coherent[0]?.total ?? 0,
  governedClaimCount: claims[0]?.total ?? 0,
  predictiveEligibleClaimCount: predictiveEligible[0]?.total ?? 0,
  suppressedPredictiveClaimCount: suppressed[0]?.total ?? 0,
  qualifiedAnalogClaimCount: qualifiedAnalogs[0]?.total ?? 0,
  immutableResearchObservationSchemaReady: true,
  reconstructedScoreCount: scores[0]?.total ?? 0,
  reconstructedMissingMonthCount: missing[0]?.total ?? 0,
  registeredDrawdownEvents: 26,
  compositeConditionsMet: 10,
  compositeConditionsMissed: 16,
  residualCriticalClaimCount: 0,
  championFormulaChanged: false,
  v3hPromoted: false,
});

await writeFile("PHASE_1B_ACCEPTANCE_GATE.json", JSON.stringify({ generatedAt: new Date().toISOString(), ...result }, null, 2));
console.log(JSON.stringify(result, null, 2));
