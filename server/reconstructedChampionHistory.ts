import { createHash } from "node:crypto";
import { access, readFile } from "node:fs/promises";
import { eq, sql } from "drizzle-orm";
import XLSX from "xlsx";
import {
  reconstructedHistoricalFormulaVersions,
  reconstructedHistoricalScores,
  reconstructedHistoricalSourceObservations,
  reconstructedHistoricalValidationRuns,
} from "../drizzle/schema";
import { getDb } from "./db";
import { assessFrozenInputCompleteness, calculateFrozenChampionV1, type FrozenInputs } from "./verifiedHistoricalValidation";

export const RECONSTRUCTED_CHAMPION_MODEL_VERSION = "CHAMPION_V1_FROZEN_20260819_RECONSTRUCTED_PHASE1B";
export const RECONSTRUCTED_CHAMPION_POLICY_VERSION = "RECONSTRUCTED_CHAMPION_V1_POLICY_20260819";
export const RECONSTRUCTED_CHAMPION_POLICY_PATH = "RECONSTRUCTED_CHAMPION_V1_DATA_POLICY.md";

type SourceClass = "ARCHIVED_OFFICIAL_REVISED" | "CURRENT_OFFICIAL_REVISED" | "OFFICIAL_PROXY_RECONSTRUCTED" | "UNAVAILABLE";
type SourcePoint = { date: string; value: number; sourceClass: SourceClass; sourceUrl: string; transformation: string; metadata: Record<string, unknown> };
type MonthResult = { month: string; scoreStatus: "COMPLETE" | "INCOMPLETE"; score: number | null; regime: string | null; missingFlags: string[]; sourcePoints: Record<string, SourcePoint | null>; vectorScores: Record<string, number> };

const FRED_ENDPOINT = "https://api.stlouisfed.org/fred/series/observations";
const ARCHIVED_BAML_PATH = process.env.PHASE1B_BAML_ARCHIVE_PATH ?? "/home/ubuntu/phase1b_sources/bamlh0a0hym2_fred_archive_20251104.decoded.csv";
const SOFR_PROXY_PATH = process.env.PHASE1B_SOFR_PROXY_PATH ?? "/home/ubuntu/phase1b_sources/HistoricalOvernightTreasGCRepoPriDealerSurvRate.xlsx";
const ARCHIVED_BAML_CAPTURE_URL = "https://web.archive.org/web/20251104204105id_/https://fred.stlouisfed.org/graph/fredgraph.csv?id=BAMLH0A0HYM2";
const SOFR_PROXY_URL = "https://www.newyorkfed.org/markets/opolicy/operating_policy_180309";
const OFFICIAL_SERIES = ["BAMLH0A0HYM2", "SOFR", "DGS10", "DGS2", "CPIAUCSL", "PPIACO", "FEDFUNDS", "UNRATE"] as const;

function sha256(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function monthEndBusinessDay(month: string) {
  const [year, monthNumber] = month.split("-").map(Number);
  const date = new Date(Date.UTC(year, monthNumber, 0));
  while (date.getUTCDay() === 0 || date.getUTCDay() === 6) date.setUTCDate(date.getUTCDate() - 1);
  return date.toISOString().slice(0, 10);
}

function priorMonth(month: string) {
  const cursor = new Date(`${month}-01T00:00:00.000Z`);
  cursor.setUTCMonth(cursor.getUTCMonth() - 1);
  return cursor.toISOString().slice(0, 7);
}

function buildMonths(fromMonth: string, toMonth: string) {
  const months: string[] = [];
  const cursor = new Date(`${fromMonth}-01T00:00:00.000Z`);
  const end = new Date(`${toMonth}-01T00:00:00.000Z`);
  while (cursor <= end) {
    months.push(cursor.toISOString().slice(0, 7));
    cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  }
  return months;
}

function csvRows(content: string) {
  const [header, ...rows] = content.trim().split(/\r?\n/);
  const valueIndex = header.split(",").indexOf("BAMLH0A0HYM2");
  if (valueIndex < 0) throw new Error("Archived BAML source does not have the exact expected series column");
  return rows.flatMap(row => {
    const parts = row.split(",");
    const value = Number(parts[valueIndex]);
    return parts[0] && Number.isFinite(value) ? [{ date: parts[0]!, value }] : [];
  });
}

async function loadArchivedBaml() {
  await access(ARCHIVED_BAML_PATH);
  const content = await readFile(ARCHIVED_BAML_PATH, "utf8");
  const checksum = sha256(content);
  return csvRows(content).map(row => ({
    ...row,
    sourceClass: "ARCHIVED_OFFICIAL_REVISED" as const,
    sourceUrl: ARCHIVED_BAML_CAPTURE_URL,
    transformation: "Exact BAMLH0A0HYM2 percentage observation multiplied by 100 to express basis points",
    metadata: { archiveCaptureUrl: ARCHIVED_BAML_CAPTURE_URL, archiveFileChecksum: checksum, archivedAt: "2025-11-04T20:41:05Z", datasetTier: "RECONSTRUCTED_HISTORICAL_RESEARCH_HISTORY" },
  }));
}

function excelDateToIso(value: unknown): string | null {
  if (typeof value === "number") {
    const parsed = XLSX.SSF.parse_date_code(value);
    return parsed ? `${String(parsed.y).padStart(4, "0")}-${String(parsed.m).padStart(2, "0")}-${String(parsed.d).padStart(2, "0")}` : null;
  }
  if (typeof value === "string") {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString().slice(0, 10);
  }
  return null;
}

async function loadSofrProxy() {
  await access(SOFR_PROXY_PATH);
  const workbook = XLSX.readFile(SOFR_PROXY_PATH, { cellDates: false });
  const firstSheet = workbook.Sheets[workbook.SheetNames[0]!];
  const rows = XLSX.utils.sheet_to_json<unknown[]>(firstSheet, { header: 1, raw: true });
  const fileChecksum = sha256(await readFile(SOFR_PROXY_PATH));
  return rows.flatMap(row => {
    const date = excelDateToIso(row[0]);
    const value = Number(row[1]);
    return date && Number.isFinite(value) ? [{
      date,
      value,
      sourceClass: "OFFICIAL_PROXY_RECONSTRUCTED" as const,
      sourceUrl: SOFR_PROXY_URL,
      transformation: "Published primary-dealer overnight Treasury GC repo survey rate used directly as an approved SOFR proxy; no fitted adjustment",
      metadata: { proxy: "Historical Overnight Treasury GC Repo Primary Dealer Survey Rate", sourceFileChecksum: fileChecksum, proxyLimitations: "Volume-weighted mean and narrower primary-dealer general-collateral coverage; not SOFR", datasetTier: "RECONSTRUCTED_HISTORICAL_RESEARCH_HISTORY" },
    }] : [];
  });
}

async function fetchFredSeries(seriesId: string, observationStart: string, observationEnd: string): Promise<SourcePoint[]> {
  const apiKey = process.env.FRED_API_KEY;
  if (!apiKey) throw new Error("FRED_API_KEY is required for reconstructed history ingestion");
  const url = new URL(FRED_ENDPOINT);
  url.searchParams.set("series_id", seriesId);
  url.searchParams.set("api_key", apiKey);
  url.searchParams.set("file_type", "json");
  url.searchParams.set("observation_start", observationStart);
  url.searchParams.set("observation_end", observationEnd);
  url.searchParams.set("sort_order", "asc");
  url.searchParams.set("limit", "100000");
  const response = await fetch(url, { signal: AbortSignal.timeout(30_000) });
  const body = await response.json() as { observations?: Array<{ date: string; value: string }>; error_message?: string };
  if (!response.ok || !body.observations) throw new Error(`FRED ${seriesId}: ${body.error_message ?? response.status}`);
  return body.observations.flatMap(observation => {
    const value = Number(observation.value);
    if (!Number.isFinite(value)) return [];
    const isBaml = seriesId === "BAMLH0A0HYM2";
    const isSofr = seriesId === "SOFR";
    return [{
      date: observation.date,
      value,
      sourceClass: "CURRENT_OFFICIAL_REVISED" as const,
      sourceUrl: `https://fred.stlouisfed.org/series/${seriesId}`,
      transformation: isBaml ? "Exact BAMLH0A0HYM2 percentage observation multiplied by 100 to express basis points" : isSofr ? "Official SOFR percentage observation used directly" : "Official revised observation used under the locked reconstructed-history policy",
      metadata: { provider: "FRED", seriesId, retrievalEndpoint: FRED_ENDPOINT, datasetTier: "RECONSTRUCTED_HISTORICAL_RESEARCH_HISTORY", nonVintage: true },
    }];
  });
}

function indexPoints(points: SourcePoint[]) {
  return new Map(points.map(point => [point.date, point]));
}

export function selectSameMonthDaily(points: Map<string, SourcePoint>, month: string): SourcePoint | null {
  const eligible = [...points.values()].filter(point => point.date.startsWith(month));
  return eligible.sort((left, right) => right.date.localeCompare(left.date))[0] ?? null;
}

export function selectPriorReleasedMonthly(points: Map<string, SourcePoint>, month: string): SourcePoint | null {
  const maxReferenceMonth = priorMonth(month);
  const eligible = [...points.values()].filter(point => point.date.slice(0, 7) <= maxReferenceMonth);
  return eligible.sort((left, right) => right.date.localeCompare(left.date))[0] ?? null;
}

function yearAgoMonthly(points: Map<string, SourcePoint>, latest: SourcePoint): SourcePoint | null {
  const [year, month, day] = latest.date.split("-").map(Number);
  const target = `${String(year - 1).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  return points.get(target) ?? null;
}

export function buildReconstructedMonth(month: string, series: Record<string, Map<string, SourcePoint>>): MonthResult {
  const baml = selectSameMonthDaily(series.BAMLH0A0HYM2!, month);
  const sofr = selectSameMonthDaily(series.SOFR!, month);
  const dgs10 = selectSameMonthDaily(series.DGS10!, month);
  const dgs2 = selectSameMonthDaily(series.DGS2!, month);
  const cpi = selectPriorReleasedMonthly(series.CPIAUCSL!, month);
  const ppi = selectPriorReleasedMonthly(series.PPIACO!, month);
  const fedFunds = selectPriorReleasedMonthly(series.FEDFUNDS!, month);
  const unrate = selectPriorReleasedMonthly(series.UNRATE!, month);
  const cpiPrior = cpi ? yearAgoMonthly(series.CPIAUCSL!, cpi) : null;
  const ppiPrior = ppi ? yearAgoMonthly(series.PPIACO!, ppi) : null;
  const inputs: Partial<FrozenInputs> = {
    hySpreadBps: baml ? baml.value * 100 : null,
    sofr: sofr?.value ?? null,
    tsy10y: dgs10?.value ?? null,
    tsy2y: dgs2?.value ?? null,
    cpiYoy: cpi && cpiPrior && cpiPrior.value !== 0 ? ((cpi.value / cpiPrior.value) - 1) * 100 : null,
    ppiYoy: ppi && ppiPrior && ppiPrior.value !== 0 ? ((ppi.value / ppiPrior.value) - 1) * 100 : null,
    fedFunds: fedFunds?.value ?? null,
    unemployment: unrate?.value ?? null,
  };
  const completeness = assessFrozenInputCompleteness(inputs);
  const calculation = completeness.scoreStatus === "COMPLETE" ? calculateFrozenChampionV1(inputs as FrozenInputs) : null;
  return {
    month,
    scoreStatus: completeness.scoreStatus,
    score: calculation?.overallPressure ?? null,
    regime: calculation?.regime ?? null,
    missingFlags: completeness.missingFlags,
    sourcePoints: { BAMLH0A0HYM2: baml, SOFR: sofr, DGS10: dgs10, DGS2: dgs2, CPIAUCSL: cpi, PPIACO: ppi, FEDFUNDS: fedFunds, UNRATE: unrate },
    vectorScores: calculation?.vectorScores ?? {},
  };
}

async function ensureFormulaVersion() {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const formulaHash = sha256({ frozenFormula: "CHAMPION_V1_FROZEN_20260819", policyVersion: RECONSTRUCTED_CHAMPION_POLICY_VERSION });
  await db.insert(reconstructedHistoricalFormulaVersions).values({
    modelVersion: RECONSTRUCTED_CHAMPION_MODEL_VERSION,
    formulaHash,
    sourceCommit: "5c2a0211",
    policyVersion: RECONSTRUCTED_CHAMPION_POLICY_VERSION,
    policyPath: RECONSTRUCTED_CHAMPION_POLICY_PATH,
    formulaJson: JSON.stringify({ frozenFormula: "CHAMPION_V1_FROZEN_20260819", weights: [0.2, 0.2, 0.15, 0.2, 0.1, 0.15], policy: RECONSTRUCTED_CHAMPION_POLICY_VERSION }),
    status: "frozen",
  }).onDuplicateKeyUpdate({ set: { modelVersion: sql`modelVersion` } });
  const formula = await db.select().from(reconstructedHistoricalFormulaVersions).where(eq(reconstructedHistoricalFormulaVersions.modelVersion, RECONSTRUCTED_CHAMPION_MODEL_VERSION)).limit(1);
  if (!formula[0]) throw new Error("Reconstructed formula version was not persisted");
  return formula[0];
}

async function insertBatches<T extends Record<string, unknown>>(rows: T[], insert: (batch: T[]) => Promise<unknown>) {
  for (let offset = 0; offset < rows.length; offset += 100) await insert(rows.slice(offset, offset + 100));
}

export async function buildReconstructedChampionV1History(fromMonth = "2000-01", toMonth = "2026-07") {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const formula = await ensureFormulaVersion();
  const endDate = monthEndBusinessDay(toMonth);
  const [bamlArchive, sofrProxy, bamlFred, sofrFred, dgs10, dgs2, cpi, ppi, fedFunds, unrate] = await Promise.all([
    loadArchivedBaml(),
    loadSofrProxy(),
    toMonth >= "2023-08" ? fetchFredSeries("BAMLH0A0HYM2", "2023-08-01", endDate) : Promise.resolve([]),
    toMonth >= "2018-04" ? fetchFredSeries("SOFR", "2018-04-01", endDate) : Promise.resolve([]),
    fetchFredSeries("DGS10", "1998-01-01", endDate),
    fetchFredSeries("DGS2", "1998-01-01", endDate),
    fetchFredSeries("CPIAUCSL", "1998-01-01", endDate),
    fetchFredSeries("PPIACO", "1998-01-01", endDate),
    fetchFredSeries("FEDFUNDS", "1998-01-01", endDate),
    fetchFredSeries("UNRATE", "1998-01-01", endDate),
  ]);
  const bamlByDate = indexPoints([...bamlArchive, ...bamlFred]);
  const sofrByDate = indexPoints([...sofrProxy, ...sofrFred]);
  const series = {
    BAMLH0A0HYM2: bamlByDate,
    SOFR: sofrByDate,
    DGS10: indexPoints(dgs10),
    DGS2: indexPoints(dgs2),
    CPIAUCSL: indexPoints(cpi),
    PPIACO: indexPoints(ppi),
    FEDFUNDS: indexPoints(fedFunds),
    UNRATE: indexPoints(unrate),
  };
  const results = buildMonths(fromMonth, toMonth).map(month => buildReconstructedMonth(month, series));
  const sourceRows = results.flatMap(result => Object.entries(result.sourcePoints).flatMap(([seriesId, point]) => {
    if (!point) return [];
    const sourceKey = sha256({ policy: RECONSTRUCTED_CHAMPION_POLICY_VERSION, seriesId, date: point.date, value: point.value, sourceClass: point.sourceClass, sourceUrl: point.sourceUrl });
    return [{ sourceKey, seriesId, sourceClass: point.sourceClass, observationDate: point.date, valueText: String(point.value), valueNumeric: point.value, publicationAvailableAt: null, sourceUrl: point.sourceUrl, transformation: point.transformation, sourceMetadataJson: JSON.stringify(point.metadata) }];
  }));
  await insertBatches(sourceRows, batch => db.insert(reconstructedHistoricalSourceObservations).values(batch).onDuplicateKeyUpdate({ set: { sourceKey: sql`sourceKey` } }));
  const sourceKeyByPoint = new Map(sourceRows.map(row => [`${row.seriesId}:${row.observationDate}:${row.valueText}:${row.sourceClass}`, row.sourceKey]));
  const scoreRows = results.map(result => {
    const sourceKeys = Object.entries(result.sourcePoints).flatMap(([seriesId, point]) => point ? [sourceKeyByPoint.get(`${seriesId}:${point.date}:${String(point.value)}:${point.sourceClass}`)!] : []);
    const scoreDate = result.sourcePoints.DGS10?.date ?? monthEndBusinessDay(result.month);
    const rawInputs = Object.fromEntries(Object.entries(result.sourcePoints).map(([seriesId, point]) => [seriesId, point?.value ?? null]));
    const datasetChecksum = sha256({ formulaVersion: formula.modelVersion, policyVersion: RECONSTRUCTED_CHAMPION_POLICY_VERSION, month: result.month, scoreDate, rawInputs, sourceKeys, missingFlags: result.missingFlags });
    return {
      scoreKey: sha256({ formulaVersionId: formula.id, month: result.month, datasetChecksum }),
      formulaVersionId: formula.id,
      scoreMonth: result.month,
      scoreTimestamp: new Date(`${scoreDate}T23:59:59.000Z`),
      scoreStatus: result.scoreStatus,
      overallPressure: result.score,
      regime: result.regime,
      vectorScoresJson: JSON.stringify(result.vectorScores),
      rawInputsJson: JSON.stringify({ ...rawInputs, staticAiConcentrationScore: 65, reconstructed: true }),
      sourceObservationKeysJson: JSON.stringify(sourceKeys),
      qualitySummary: result.scoreStatus === "COMPLETE" ? "RECONSTRUCTED_HISTORICAL" as const : "UNAVAILABLE" as const,
      missingFlagsJson: JSON.stringify(result.missingFlags),
      datasetChecksum,
    };
  });
  await insertBatches(scoreRows, batch => db.insert(reconstructedHistoricalScores).values(batch).onDuplicateKeyUpdate({ set: { scoreKey: sql`scoreKey` } }));
  const complete = results.filter(result => result.scoreStatus === "COMPLETE");
  const incomplete = results.filter(result => result.scoreStatus === "INCOMPLETE");
  const runChecksum = sha256({ formulaVersion: formula.modelVersion, policy: RECONSTRUCTED_CHAMPION_POLICY_VERSION, scoreRows: scoreRows.map(row => ({ month: row.scoreMonth, datasetChecksum: row.datasetChecksum })) });
  await db.insert(reconstructedHistoricalValidationRuns).values({
    runKey: sha256({ formulaVersionId: formula.id, policy: RECONSTRUCTED_CHAMPION_POLICY_VERSION, runChecksum }),
    formulaVersionId: formula.id,
    policyVersion: RECONSTRUCTED_CHAMPION_POLICY_VERSION,
    datasetChecksum: runChecksum,
    coverageJson: JSON.stringify({ requested: [fromMonth, toMonth], completeMonths: complete.map(row => row.month), incompleteMonths: incomplete.map(row => ({ month: row.month, missingFlags: row.missingFlags })) }),
    limitationJson: JSON.stringify({ tier: "RECONSTRUCTED_HISTORICAL_RESEARCH_HISTORY", pointInTime: false, BAML: "archived exact FRED capture plus current retained FRED", SOFR: "official primary-dealer GC repo proxy before official SOFR; March 2018 gap remains unscored" }),
    status: "COMPLETE",
  }).onDuplicateKeyUpdate({ set: { runKey: sql`runKey` } });
  return { requested: { fromMonth, toMonth }, complete: complete.length, incomplete: incomplete.length, earliestCompleteMonth: complete[0]?.month ?? null, latestCompleteMonth: complete.at(-1)?.month ?? null, incompleteMonths: incomplete.map(row => ({ month: row.month, missingFlags: row.missingFlags })) };
}

export const RECONSTRUCTED_SOURCE_SERIES = OFFICIAL_SERIES;
