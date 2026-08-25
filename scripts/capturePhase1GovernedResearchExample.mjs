import { and, eq } from "drizzle-orm";
import { getDb } from "../server/db.ts";
import { reconstructedHistoricalOutcomes, reconstructedHistoricalScores } from "../drizzle/schema.ts";
import { appendGovernedResearchResolution, buildGovernedResearchObservation, persistGovernedResearchObservation } from "../server/intelligenceGovernance.ts";

const db = await getDb();
if (!db) throw new Error("Database unavailable");

const score = (await db.select().from(reconstructedHistoricalScores)
  .where(and(eq(reconstructedHistoricalScores.scoreMonth, "2020-03"), eq(reconstructedHistoricalScores.scoreStatus, "COMPLETE")))
  .limit(1))[0];
if (!score) throw new Error("Expected reconstructed 2020-03 score is unavailable");

const outcome = (await db.select().from(reconstructedHistoricalOutcomes)
  .where(and(eq(reconstructedHistoricalOutcomes.reconstructedScoreId, score.id), eq(reconstructedHistoricalOutcomes.horizonTradingDays, 60), eq(reconstructedHistoricalOutcomes.outcomeStatus, "COMPLETE")))
  .limit(1))[0];
if (!outcome) throw new Error("Expected independent 60-trading-day reconstructed outcome is unavailable");

const observation = buildGovernedResearchObservation({
  observationKey: `reconstructed-champion:${score.scoreKey}`,
  observationVersion: "phase1b-governed-observation-v1",
  historyClass: "reconstructed_research",
  observationDate: score.scoreTimestamp.toISOString(),
  informationCutoff: score.scoreTimestamp.toISOString(),
  inputSnapshotId: `reconstructed-inputs:${score.datasetChecksum}`,
  sourceModel: "champion-v1-frozen-reconstructed-research",
  modelVersion: "champion-v1-frozen",
  originalState: {
    scoreKey: score.scoreKey,
    scoreMonth: score.scoreMonth,
    pressureIndex: score.overallPressure,
    regime: score.regime,
    vectorScores: JSON.parse(score.vectorScoresJson),
    qualitySummary: score.qualitySummary,
    sourceObservationKeys: JSON.parse(score.sourceObservationKeysJson),
  },
  originalInterpretation: "Retrospective reconstructed research applying the frozen Champion V1 formula; not historical live FAULTLINE operation or a contemporaneous warning.",
  outcomeDefinition: "Independent S&P 500 outcome after the source score timestamp.",
  outcomeWindow: "60 completed trading days",
  sourceDataVersions: { datasetChecksum: score.datasetChecksum, qualitySummary: score.qualitySummary, outcomeLedger: "reconstructedHistoricalOutcomes" },
});

const persisted = await persistGovernedResearchObservation(observation);
if (persisted.id === null) throw new Error("Governed research observation persistence unavailable");

const resolution = await appendGovernedResearchResolution({
  observationId: persisted.id,
  resolutionVersion: "phase1b-independent-spy-resolution-v1",
  resolutionKey: `reconstructed-resolution:${score.scoreKey}:60d`,
  resolvedAt: new Date(`${outcome.endDate}T23:59:59.000Z`).toISOString(),
  outcomeValue: {
    independentOutcomeKey: outcome.outcomeKey,
    horizonTradingDays: outcome.horizonTradingDays,
    startDate: outcome.startDate,
    endDate: outcome.endDate,
    forwardReturnPct: outcome.forwardReturnPct,
    maximumDrawdownPct: outcome.maximumDrawdownPct,
    maximumAdverseExcursionPct: outcome.maximumAdverseExcursionPct,
    realizedVolatilityPct: outcome.realizedVolatilityPct,
    outcomeStatus: outcome.outcomeStatus,
  },
  sourceDataVersions: { source: "reconstructedHistoricalOutcomes", outcomeKey: outcome.outcomeKey },
});

console.log(JSON.stringify({ observation: persisted, resolution, scoreMonth: score.scoreMonth, scoreKey: score.scoreKey, outcomeKey: outcome.outcomeKey }, null, 2));
process.exit(0);
