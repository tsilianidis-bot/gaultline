import { createHash } from "node:crypto";
import { eq } from "drizzle-orm";
import {
  verifiedHistoricalFormulaVersions,
  verifiedHistoricalScores,
  verifiedHistoricalSourceObservations,
  verifiedHistoricalValidationRuns,
} from "../drizzle/schema";
import { getDb } from "./db";

export const VERIFIED_CHAMPION_MODEL_VERSION = "CHAMPION_V1_FROZEN_20260819";
export const VERIFIED_CHAMPION_FORMULA_HASH = "99391a5227d04f2b198abc59091f40ca32a0c5e9be0f2aaebada16b3bc871216";
export const VERIFIED_CHAMPION_ENGINE_SOURCE_HASH = VERIFIED_CHAMPION_FORMULA_HASH;
export const VERIFIED_CHAMPION_SOURCE_COMMIT = "3a2aa901f9a7dbb4b646e8209a3f2eb12bb0df8c";

export type HistoricalQuality =
  | "POINT_IN_TIME_CONFIRMED"
  | "POINT_IN_TIME_APPROXIMATED"
  | "REVISED_HISTORICAL"
  | "UNAVAILABLE";

export type FrozenInputs = {
  hySpreadBps: number;
  sofr: number;
  tsy10y: number;
  tsy2y: number;
  cpiYoy: number;
  ppiYoy: number;
  fedFunds: number;
  unemployment: number;
};

type FredObservation = {
  realtime_start?: string;
  realtime_end?: string;
  date: string;
  value: string;
};

type RetrievedSeries = {
  seriesId: string;
  asOfDate: string;
  observations: FredObservation[];
  quality: HistoricalQuality;
  sourceUrl: string;
  fallbackReason?: string;
};

const SERIES = ["BAMLH0A0HYM2", "SOFR", "DGS10", "DGS2", "CPIAUCSL", "PPIACO", "FEDFUNDS", "UNRATE"] as const;
const FRED_OBSERVATIONS_ENDPOINT = "https://api.stlouisfed.org/fred/series/observations";
const FRED_MONTHLY_BUILD_PACE_MS = 5_000;
const QUALITY_RANK: Record<HistoricalQuality, number> = {
  POINT_IN_TIME_CONFIRMED: 1,
  POINT_IN_TIME_APPROXIMATED: 2,
  REVISED_HISTORICAL: 3,
  UNAVAILABLE: 4,
};

function sha256(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function sleep(milliseconds: number) {
  return new Promise(resolve => setTimeout(resolve, milliseconds));
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function linearMap(value: number, inMin: number, inMax: number, outMin: number, outMax: number): number {
  return clamp(outMin + ((value - inMin) / (inMax - inMin)) * (outMax - outMin), Math.min(outMin, outMax), Math.max(outMin, outMax));
}

function classifyRegime(pressure: number): string {
  if (pressure >= 80) return "SYSTEMIC CRISIS";
  if (pressure >= 65) return "HIGH STRESS";
  if (pressure >= 45) return "ELEVATED RISK";
  if (pressure >= 25) return "MODERATE RISK";
  return "LOW RISK";
}

/** Exact frozen V1 score calculation. It only accepts complete historical inputs. */
export function calculateFrozenChampionV1(inputs: FrozenInputs) {
  const liquidity = Math.round(
    linearMap(inputs.hySpreadBps, 200, 800, 0, 100) * 0.65 +
    linearMap(inputs.sofr, 2, 6, 0, 60) * 0.35
  );
  const credit = Math.round(
    linearMap(inputs.hySpreadBps, 200, 700, 0, 80) * 0.5 +
    linearMap(inputs.tsy10y, 2, 6, 0, 50) * 0.25 +
    linearMap(inputs.unemployment, 3.5, 7, 0, 60) * 0.25
  );
  const spread = inputs.tsy10y - inputs.tsy2y;
  const spreadScore = spread < -1 ? 90 : spread < -0.5 ? 75 : spread < 0 ? 60 : spread < 0.5 ? 40 : 20;
  const volatility = Math.round(spreadScore * 0.6 + linearMap(inputs.tsy10y, 2.5, 6, 0, 50) * 0.4);
  const macro = Math.round(
    linearMap(inputs.cpiYoy, 1.5, 7, 0, 80) * 0.35 +
    linearMap(inputs.ppiYoy, 0, 10, 0, 70) * 0.25 +
    linearMap(inputs.fedFunds, 1, 6, 0, 80) * 0.4
  );
  const breadth = Math.round(
    linearMap(inputs.unemployment, 3.5, 7, 0, 80) * 0.6 +
    linearMap(inputs.tsy10y, 2, 6, 0, 60) * 0.4
  );
  const aiSpeculation = Math.round(
    65 * 0.5 +
    linearMap(inputs.tsy10y, 2, 6, 0, 40) * 0.3 +
    linearMap(inputs.hySpreadBps, 200, 600, 0, 30) * 0.2
  );
  const vectorScores = {
    liquidityStress: clamp(liquidity, 0, 100),
    creditContagion: clamp(credit, 0, 100),
    volatilityRegime: clamp(volatility, 0, 100),
    macroSensitivity: clamp(macro, 0, 100),
    marketBreadth: clamp(breadth, 0, 100),
    aiBubble: clamp(aiSpeculation, 0, 100),
  };
  const overallPressure = Math.round(
    vectorScores.liquidityStress * 0.2 +
    vectorScores.creditContagion * 0.2 +
    vectorScores.volatilityRegime * 0.15 +
    vectorScores.macroSensitivity * 0.2 +
    vectorScores.marketBreadth * 0.1 +
    vectorScores.aiBubble * 0.15
  );
  return { vectorScores, overallPressure, regime: classifyRegime(overallPressure) };
}

function lastBusinessDayOfMonth(month: string): string {
  const [year, monthNumber] = month.split("-").map(Number);
  const date = new Date(Date.UTC(year, monthNumber, 0));
  while (date.getUTCDay() === 0 || date.getUTCDay() === 6) date.setUTCDate(date.getUTCDate() - 1);
  return date.toISOString().slice(0, 10);
}

async function fetchSeriesAsOf(seriesId: string, asOfDate: string, limit: number): Promise<RetrievedSeries> {
  const apiKey = process.env.FRED_API_KEY;
  if (!apiKey) {
    return { seriesId, asOfDate, observations: [], quality: "UNAVAILABLE", sourceUrl: "https://fred.stlouisfed.org/", fallbackReason: "FRED_API_KEY unavailable" };
  }
  const baseUrl = new URL(FRED_OBSERVATIONS_ENDPOINT);
  baseUrl.searchParams.set("series_id", seriesId);
  baseUrl.searchParams.set("api_key", apiKey);
  baseUrl.searchParams.set("file_type", "json");
  baseUrl.searchParams.set("observation_end", asOfDate);
  baseUrl.searchParams.set("sort_order", "desc");
  baseUrl.searchParams.set("limit", String(limit));
  baseUrl.searchParams.set("realtime_start", asOfDate);
  baseUrl.searchParams.set("realtime_end", asOfDate);

  try {
    const response = await fetch(baseUrl, { signal: AbortSignal.timeout(15_000) });
    const responseText = await response.text();
    const body = JSON.parse(responseText) as { observations?: FredObservation[]; error_message?: string };
    if (response.ok && body.observations?.length) {
      return {
        seriesId,
        asOfDate,
        observations: body.observations,
        quality: classifySeriesHistoricalQuality(seriesId, seriesId !== "BAMLH0A0HYM2"),
        sourceUrl: FRED_OBSERVATIONS_ENDPOINT,
        fallbackReason: seriesId === "BAMLH0A0HYM2" ? "BAMLH0A0HYM2 is always classified REVISED_HISTORICAL because its FRED response is not accepted as ALFRED point-in-time vintage evidence." : undefined,
      };
    }
    const hasNoAlfredVintage = body.error_message?.includes("does not exist in ALFRED");
    // The BAML credit series and SOFR do not offer an ALFRED vintage history
    // for their early periods. A current FRED historical observation is never
    // treated as point-in-time data; it is explicitly marked by quality tier.
    if (hasNoAlfredVintage) {
      baseUrl.searchParams.delete("realtime_start");
      baseUrl.searchParams.delete("realtime_end");
      const revisedResponse = await fetch(baseUrl, { signal: AbortSignal.timeout(15_000) });
      const revisedText = await revisedResponse.text();
      const revisedBody = JSON.parse(revisedText) as { observations?: FredObservation[]; error_message?: string };
      if (revisedResponse.ok && revisedBody.observations?.length) {
        return {
          seriesId,
          asOfDate,
          observations: revisedBody.observations,
          quality: classifySeriesHistoricalQuality(seriesId, false),
          sourceUrl: FRED_OBSERVATIONS_ENDPOINT,
          fallbackReason: seriesId === "BAMLH0A0HYM2"
            ? "Series has no ALFRED vintage history; current FRED historical values are explicitly classified REVISED_HISTORICAL"
            : "Series has no ALFRED vintage history for this cutoff; current FRED historical values are explicitly classified POINT_IN_TIME_APPROXIMATED",
        };
      }
    }
    return { seriesId, asOfDate, observations: [], quality: "UNAVAILABLE", sourceUrl: FRED_OBSERVATIONS_ENDPOINT, fallbackReason: body.error_message ?? `HTTP ${response.status}` };
  } catch (error) {
    return { seriesId, asOfDate, observations: [], quality: "UNAVAILABLE", sourceUrl: FRED_OBSERVATIONS_ENDPOINT, fallbackReason: String(error) };
  }
}

function numericObservations(result: RetrievedSeries): Array<{ observation: FredObservation; value: number }> {
  return result.observations
    .map(observation => ({ observation, value: Number(observation.value) }))
    .filter(row => Number.isFinite(row.value));
}

function worstQuality(qualities: HistoricalQuality[]): HistoricalQuality {
  return qualities.reduce((worst, current) => QUALITY_RANK[current] > QUALITY_RANK[worst] ? current : worst, "POINT_IN_TIME_CONFIRMED");
}

export function worstHistoricalQuality(qualities: HistoricalQuality[]): HistoricalQuality {
  return worstQuality(qualities);
}

export function classifySeriesHistoricalQuality(seriesId: string, hasAlfredVintage: boolean): HistoricalQuality {
  if (hasAlfredVintage) return "POINT_IN_TIME_CONFIRMED";
  return seriesId === "BAMLH0A0HYM2" ? "REVISED_HISTORICAL" : "POINT_IN_TIME_APPROXIMATED";
}

export function assessFrozenInputCompleteness(inputs: Partial<Record<keyof FrozenInputs, number | null>>) {
  const required: Array<keyof FrozenInputs> = ["hySpreadBps", "sofr", "tsy10y", "tsy2y", "cpiYoy", "ppiYoy", "fedFunds", "unemployment"];
  const missingFlags = required.filter(key => inputs[key] === null || inputs[key] === undefined);
  return { scoreStatus: missingFlags.length === 0 ? "COMPLETE" as const : "INCOMPLETE" as const, missingFlags };
}

async function persistSourceObservations(result: RetrievedSeries): Promise<string[]> {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const keys: string[] = [];
  for (const row of numericObservations(result)) {
    const sourceKey = sha256({ seriesId: result.seriesId, asOfDate: result.asOfDate, observationDate: row.observation.date, realtimeStart: row.observation.realtime_start ?? null, realtimeEnd: row.observation.realtime_end ?? null, value: row.observation.value, quality: result.quality });
    keys.push(sourceKey);
    await db.insert(verifiedHistoricalSourceObservations).values({
      sourceKey,
      seriesId: result.seriesId,
      observationDate: row.observation.date,
      realtimeStart: row.observation.realtime_start ?? null,
      realtimeEnd: row.observation.realtime_end ?? null,
      valueText: row.observation.value,
      valueNumeric: row.value,
      publicationAvailableAt: result.quality === "POINT_IN_TIME_CONFIRMED" ? new Date(`${result.asOfDate}T23:59:59.000Z`) : null,
      availabilityTimestamp: result.quality === "POINT_IN_TIME_CONFIRMED" ? new Date(`${result.asOfDate}T23:59:59.000Z`) : null,
      qualityClassification: result.quality,
      sourceUrl: result.sourceUrl,
      transformation: result.seriesId === "BAMLH0A0HYM2" ? "Latest valid value multiplied by 100 when raw value <= 20 to express basis points" : "Latest valid observation available by score timestamp",
      sourceMetadataJson: JSON.stringify({ asOfDate: result.asOfDate, fallbackReason: result.fallbackReason ?? null, originalObservation: row.observation }),
    }).onDuplicateKeyUpdate({ set: { sourceKey } });
  }
  return keys;
}

async function ensureFormulaVersion(): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  await db.insert(verifiedHistoricalFormulaVersions).values({
    modelVersion: VERIFIED_CHAMPION_MODEL_VERSION,
    formulaHash: VERIFIED_CHAMPION_FORMULA_HASH,
    engineSourceHash: VERIFIED_CHAMPION_ENGINE_SOURCE_HASH,
    sourceCommit: VERIFIED_CHAMPION_SOURCE_COMMIT,
    formulaJson: JSON.stringify({ weights: { liquidity: 0.2, credit: 0.2, volatility: 0.15, macro: 0.2, breadth: 0.1, aiSpeculation: 0.15 }, scoreScale: "0-100", rounding: "round once after weighted vector sum", staticAiConcentrationScore: 65 }),
    frozenSpecificationPath: "CHAMPION_V1_FROZEN_SPECIFICATION.md",
    status: "frozen",
  }).onDuplicateKeyUpdate({ set: { formulaHash: VERIFIED_CHAMPION_FORMULA_HASH } });
  const rows = await db.select().from(verifiedHistoricalFormulaVersions).where(eq(verifiedHistoricalFormulaVersions.modelVersion, VERIFIED_CHAMPION_MODEL_VERSION)).limit(1);
  if (!rows[0]) throw new Error("Frozen formula version was not persisted");
  return rows[0].id;
}

function buildMonthRange(fromMonth: string, toMonth: string): string[] {
  const months: string[] = [];
  const cursor = new Date(`${fromMonth}-01T00:00:00.000Z`);
  const finalMonth = new Date(`${toMonth}-01T00:00:00.000Z`);
  while (cursor <= finalMonth) {
    months.push(cursor.toISOString().slice(0, 7));
    cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  }
  return months;
}

export type VerifiedBuildOptions = {
  fromMonth: string;
  toMonth: string;
  maxMonths?: number;
};

export async function buildVerifiedChampionV1History(options: VerifiedBuildOptions) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const formulaVersionId = await ensureFormulaVersion();
  const months = buildMonthRange(options.fromMonth, options.toMonth).slice(0, options.maxMonths ?? Number.MAX_SAFE_INTEGER);
  const summary = { complete: 0, incomplete: 0, byQuality: {} as Record<HistoricalQuality, number>, earliestCompleteMonth: null as string | null, records: [] as Array<{ month: string; status: string; quality: HistoricalQuality; score: number | null }> };

  for (const month of months) {
    const monthEndCandidate = lastBusinessDayOfMonth(month);
    const [hy, sofr, dgs10, dgs2, cpi, ppi, fedFunds, unrate] = await Promise.all([
      fetchSeriesAsOf("BAMLH0A0HYM2", monthEndCandidate, 2),
      fetchSeriesAsOf("SOFR", monthEndCandidate, 2),
      fetchSeriesAsOf("DGS10", monthEndCandidate, 2),
      fetchSeriesAsOf("DGS2", monthEndCandidate, 2),
      fetchSeriesAsOf("CPIAUCSL", monthEndCandidate, 14),
      fetchSeriesAsOf("PPIACO", monthEndCandidate, 14),
      fetchSeriesAsOf("FEDFUNDS", monthEndCandidate, 2),
      fetchSeriesAsOf("UNRATE", monthEndCandidate, 2),
    ]);
    const results = [hy, sofr, dgs10, dgs2, cpi, ppi, fedFunds, unrate];
    const sourceKeys = (await Promise.all(results.map(persistSourceObservations))).flat();
    const observation = (result: RetrievedSeries, index = 0) => numericObservations(result)[index]?.value ?? null;
    const scoreDate = numericObservations(dgs10)[0]?.observation.date ?? monthEndCandidate;
    const hyRaw = observation(hy);
    const inputs = {
      hySpreadBps: hyRaw === null ? null : (hyRaw > 20 ? hyRaw : hyRaw * 100),
      sofr: observation(sofr),
      tsy10y: observation(dgs10),
      tsy2y: observation(dgs2),
      cpiLatest: observation(cpi),
      cpiPriorYear: observation(cpi, 12),
      ppiLatest: observation(ppi),
      ppiPriorYear: observation(ppi, 12),
      fedFunds: observation(fedFunds),
      unemployment: observation(unrate),
    };
    const cpiYoy = inputs.cpiLatest !== null && inputs.cpiPriorYear !== null && inputs.cpiPriorYear !== 0 ? Number((((inputs.cpiLatest / inputs.cpiPriorYear) - 1) * 100).toFixed(2)) : null;
    const ppiYoy = inputs.ppiLatest !== null && inputs.ppiPriorYear !== null && inputs.ppiPriorYear !== 0 ? Number((((inputs.ppiLatest / inputs.ppiPriorYear) - 1) * 100).toFixed(2)) : null;
    const frozenInputs: Partial<FrozenInputs> = { ...inputs, cpiYoy, ppiYoy };
    delete (frozenInputs as Record<string, unknown>).cpiLatest;
    delete (frozenInputs as Record<string, unknown>).cpiPriorYear;
    delete (frozenInputs as Record<string, unknown>).ppiLatest;
    delete (frozenInputs as Record<string, unknown>).ppiPriorYear;
    const completeness = assessFrozenInputCompleteness(frozenInputs);
    const missingFlags = completeness.missingFlags;
    const quality = worstQuality(results.map(result => result.quality));
    const scoreStatus = completeness.scoreStatus;
    const calculation = scoreStatus === "COMPLETE" ? calculateFrozenChampionV1(frozenInputs as FrozenInputs) : null;
    const datasetChecksum = sha256({ modelVersion: VERIFIED_CHAMPION_MODEL_VERSION, month, scoreDate, frozenInputs, sourceKeys, quality, missingFlags });
    const scoreKey = sha256({ formulaVersionId, month, datasetChecksum });
    await db.insert(verifiedHistoricalScores).values({
      scoreKey,
      formulaVersionId,
      scoreMonth: month,
      scoreTimestamp: new Date(`${scoreDate}T23:59:59.000Z`),
      scoreStatus,
      overallPressure: calculation?.overallPressure ?? null,
      regime: calculation?.regime ?? null,
      vectorScoresJson: JSON.stringify(calculation?.vectorScores ?? {}),
      rawInputsJson: JSON.stringify({ ...frozenInputs, staticAiConcentrationScore: 65 }),
      sourceObservationKeysJson: JSON.stringify(sourceKeys),
      qualitySummary: quality,
      missingFlagsJson: JSON.stringify(missingFlags),
      datasetChecksum,
    }).onDuplicateKeyUpdate({
      set: {
        scoreKey,
        scoreTimestamp: new Date(`${scoreDate}T23:59:59.000Z`),
        scoreStatus,
        overallPressure: calculation?.overallPressure ?? null,
        regime: calculation?.regime ?? null,
        vectorScoresJson: JSON.stringify(calculation?.vectorScores ?? {}),
        rawInputsJson: JSON.stringify({ ...frozenInputs, staticAiConcentrationScore: 65 }),
        sourceObservationKeysJson: JSON.stringify(sourceKeys),
        qualitySummary: quality,
        missingFlagsJson: JSON.stringify(missingFlags),
        datasetChecksum,
        calculatedAt: new Date(),
      },
    });
    summary.byQuality[quality] = (summary.byQuality[quality] ?? 0) + 1;
    if (scoreStatus === "COMPLETE") {
      summary.complete += 1;
      summary.earliestCompleteMonth ??= month;
    } else summary.incomplete += 1;
    summary.records.push({ month, status: scoreStatus, quality, score: calculation?.overallPressure ?? null });
    if (month !== months.at(-1)) await sleep(FRED_MONTHLY_BUILD_PACE_MS);
  }

  const runChecksum = sha256(summary.records);
  await db.insert(verifiedHistoricalValidationRuns).values({
    runKey: sha256({ formulaVersionId, fromMonth: options.fromMonth, toMonth: options.toMonth, maxMonths: options.maxMonths ?? null, runChecksum }),
    formulaVersionId,
    scoringTimestampPolicy: "Last eligible US trading day is the latest valid DGS10 daily observation returned on or before the calendar month-end cutoff; include only observations returned by FRED/ALFRED as available by that as-of date.",
    missingDataPolicy: "Never use live runtime fallback constants. Persist INCOMPLETE score rows with explicit missing flags when any required frozen input is unavailable.",
    datasetChecksum: runChecksum,
    coverageJson: JSON.stringify(summary),
    partitionJson: JSON.stringify({ development: null, validation: null, holdout: null, status: "UNLOCKED_PENDING_SUFFICIENT_VERIFIED_HISTORY" }),
    status: summary.complete > 0 ? "COMPLETE" : "BLOCKED",
    limitationJson: JSON.stringify({ bamlH0Vintage: "BAMLH0A0HYM2 does not exist in ALFRED; any historical BAML observation is explicitly REVISED_HISTORICAL.", sofrVintages: "SOFR does not offer ALFRED vintages in early coverage; these observations are explicitly POINT_IN_TIME_APPROXIMATED.", staticAiConcentration: "Static model estimate retained exactly from frozen Champion V1." }),
  }).onDuplicateKeyUpdate({ set: { runKey: sha256({ formulaVersionId, fromMonth: options.fromMonth, toMonth: options.toMonth, runChecksum }) } });
  return summary;
}

export function describeSeriesCoverage() {
  return SERIES.map(seriesId => ({
    seriesId,
    qualityRule: seriesId === "BAMLH0A0HYM2" ? "REVISED_HISTORICAL (no ALFRED vintage series)" : seriesId === "SOFR" ? "POINT_IN_TIME_CONFIRMED when a vintage exists; otherwise POINT_IN_TIME_APPROXIMATED" : "POINT_IN_TIME_CONFIRMED when FRED realtime query returns an as-of vintage",
    earliestPotentialCoverage: seriesId === "BAMLH0A0HYM2" ? "2023-08-21 observed current source-retention boundary on 2026-08-19; must be re-probed each run" : seriesId === "SOFR" ? "2018-04" : "subject to official series availability",
  }));
}
