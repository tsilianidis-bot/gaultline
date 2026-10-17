import { ResearchSpecError } from "./errors";
import { canonicalSha256 } from "./hash";
import { IMPLEMENTATION_VERSION, SPEC_ID } from "./lock";
import { daysBetween } from "./dates";
import { loadLockedSpec, type FrozenSpec, type PillarSpec } from "./spec";
import type {
  BenchmarkBlock,
  InputPanel,
  Observation,
  PillarId,
  PillarResult,
  ProvenanceRecord,
  V2Computation,
} from "./types";

export function clip(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function roundTo(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

/** Midrank percentile on the inclusive expanding history. Range is (0, 100]. */
export function midrankPercentile(raw: number, history: readonly number[]): number {
  if (history.length === 0) throw new ResearchSpecError("EMPTY_HISTORY", "Percentile history is empty");
  let less = 0;
  let equal = 0;
  for (const value of history) {
    if (value < raw) less += 1;
    else if (value === raw) equal += 1;
  }
  if (equal === 0) throw new ResearchSpecError("RAW_NOT_IN_HISTORY", "Current raw value is missing from its history");
  return (100 * (less + 0.5 * equal)) / history.length;
}

export function stressScoreFromPercentile(percentile: number): number {
  return 100 * clip((percentile - 50) / 50, 0, 1);
}

export function bandForScore(score: number, spec: FrozenSpec = loadLockedSpec().spec): string {
  const matches = spec.bands.filter(band => score >= band.minInclusive && (band.maxExclusive == null || score < band.maxExclusive));
  if (matches.length !== 1) throw new ResearchSpecError("BAND_EDGE", `Score ${score} does not land in exactly one band`);
  return matches[0]!.id;
}

export function sahmGap(rates: readonly number[], trailing = 3, window = 12): number | null {
  if (rates.length < trailing + window - 1) return null;
  const averages: number[] = [];
  for (let index = trailing - 1; index < rates.length; index += 1) {
    let sum = 0;
    for (let lookback = 0; lookback < trailing; lookback += 1) sum += rates[index - lookback]!;
    averages.push(sum / trailing);
  }
  if (averages.length < window) return null;
  const latest = averages[averages.length - 1]!;
  let minimum = Infinity;
  for (let index = averages.length - window; index < averages.length; index += 1) minimum = Math.min(minimum, averages[index]!);
  return latest - minimum;
}

export function drawdownFromWindowHigh(closes: readonly number[], index: number, window: number): number | null {
  if (index + 1 < window) return null;
  let high = -Infinity;
  for (let cursor = index + 1 - window; cursor <= index; cursor += 1) high = Math.max(high, closes[cursor]!);
  if (!(high > 0)) return null;
  return ((high - closes[index]!) / high) * 100;
}

function unavailable(pillar: PillarSpec, reason: string, historyCount = 0): PillarResult {
  return {
    id: pillar.id as PillarId,
    seriesId: pillar.seriesId,
    status: "unavailable",
    raw: null,
    observationDate: null,
    releaseTime: null,
    realtimeStart: null,
    vintageId: null,
    provider: null,
    ingestionTime: null,
    percentile: null,
    score: null,
    reason,
    proxyLabel: pillar.proxyLabel ?? null,
    historyCount,
  };
}

function isEligible(observation: Observation, panel: InputPanel): boolean {
  if (observation.observationDate > panel.asOfDate) return false;
  if (observation.realtimeStart && observation.realtimeStart > panel.asOfDate) return false;
  if (observation.releaseTime && observation.releaseTime > panel.decisionTimeUtc) return false;
  return true;
}

function seriesRows(panel: InputPanel, seriesId: string): Observation[] {
  return panel.observations.filter(observation => observation.seriesId === seriesId);
}

function assertNoConflicts(rows: Observation[]): void {
  const seen = new Map<string, number>();
  for (const row of rows) {
    const key = `${row.observationDate}|${row.vintageId}|${row.realtimeStart ?? ""}`;
    const prior = seen.get(key);
    if (prior !== undefined && prior !== row.value) {
      throw new ResearchSpecError(
        "AMBIGUOUS_OBSERVATION",
        `Conflicting values for ${row.seriesId} on ${row.observationDate} vintage ${row.vintageId}`,
      );
    }
    seen.set(key, row.value);
  }
}

function revisionViolation(rows: Observation[], pillar: PillarSpec): boolean {
  if (pillar.revised) return false;
  return rows.some(row => {
    if (row.vintageId !== "UNREVISED") return true;
    if (row.realtimeStart && row.realtimeStart !== row.observationDate) return true;
    return false;
  });
}

function completeMarketPoint(row: Observation): boolean {
  return Boolean(row.releaseTime && row.vintageId && row.provider && row.ingestionTime && row.observationDate);
}

type HistoryPoint = { date: string; value: number; source: Observation };

function dedupeByDate(rows: Observation[]): HistoryPoint[] {
  const byDate = new Map<string, Observation>();
  for (const row of rows) {
    const prior = byDate.get(row.observationDate);
    if (prior && prior.value !== row.value) {
      throw new ResearchSpecError("AMBIGUOUS_OBSERVATION", `Two values for ${row.seriesId} on ${row.observationDate}`);
    }
    if (!prior) byDate.set(row.observationDate, row);
  }
  return Array.from(byDate.entries())
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([date, source]) => ({ date, value: source.value, source }));
}

function staleReason(pillar: PillarSpec, asOfDate: string, observationDate: string): string | null {
  if (daysBetween(observationDate, asOfDate) > pillar.staleCalendarDays) {
    if (pillar.seriesEnd && asOfDate > pillar.seriesEnd) return pillar.unavailableReason ?? "FUNDING_SUCCESSOR_NOT_APPROVED";
    return "STALE";
  }
  return null;
}

function scoreLevelPillar(pillar: PillarSpec, panel: InputPanel, spec: FrozenSpec): { result: PillarResult; history: HistoryPoint[] } {
  const rows = seriesRows(panel, pillar.seriesId);
  if (revisionViolation(rows, pillar)) return { result: unavailable(pillar, "REVISION_NOT_ALLOWED"), history: [] };
  if (pillar.seriesEnd && rows.some(row => row.observationDate > pillar.seriesEnd!)) {
    return { result: unavailable(pillar, "FABRICATED_SERIES_EXTENSION"), history: [] };
  }
  const eligible = rows.filter(row => isEligible(row, panel));
  assertNoConflicts(eligible);
  if (eligible.length === 0) return { result: unavailable(pillar, "MISSING"), history: [] };
  const history = dedupeByDate(eligible);
  const latest = history[history.length - 1]!;
  const stale = staleReason(pillar, panel.asOfDate, latest.date);
  if (stale) return { result: unavailable(pillar, stale, history.length), history: [] };
  const scored = finishPercentile(pillar, spec, latest.source, history, latest.value, panel.asOfDate);
  return { result: scored.result, history: scored.ok ? history : [] };
}

function finishPercentile(
  pillar: PillarSpec,
  spec: FrozenSpec,
  latest: Observation,
  history: HistoryPoint[],
  rawValue: number,
  asOfDate: string,
): { result: PillarResult; ok: boolean } {
  if (history.length === 0) return { result: unavailable(pillar, "MISSING"), ok: false };
  const marketOk = pillar.provenance !== "market" || completeMarketPoint(latest);
  const monthlyOk = pillar.provenance !== "monthly" || Boolean(latest.realtimeStart && latest.vintageId && latest.provider && latest.ingestionTime);
  if (!marketOk || !monthlyOk) return { result: unavailable(pillar, "INCOMPLETE_PROVENANCE", history.length), ok: false };
  const span = daysBetween(history[0]!.date, asOfDate);
  if (span < spec.minHistoryDays || history.length < spec.minHistoryObservations) {
    return { result: unavailable(pillar, "INSUFFICIENT_HISTORY", history.length), ok: false };
  }
  const percentile = midrankPercentile(rawValue, history.map(point => point.value));
  const score = roundTo(stressScoreFromPercentile(percentile), spec.persistedScoreDecimals);
  return {
    ok: true,
    result: {
      id: pillar.id as PillarId,
      seriesId: pillar.seriesId,
      status: "ok",
      raw: roundTo(rawValue, 6),
      observationDate: latest.observationDate,
      releaseTime: latest.releaseTime,
      realtimeStart: latest.realtimeStart,
      vintageId: latest.vintageId,
      provider: latest.provider,
      ingestionTime: latest.ingestionTime,
      percentile: roundTo(percentile, spec.percentileDecimals),
      score,
      reason: null,
      proxyLabel: pillar.proxyLabel ?? null,
      historyCount: history.length,
    },
  };
}

function scoreEquity(pillar: PillarSpec, panel: InputPanel, spec: FrozenSpec): { result: PillarResult; history: HistoryPoint[]; latestDrawdown: number | null } {
  const rows = seriesRows(panel, pillar.seriesId);
  if (revisionViolation(rows, pillar)) return { result: unavailable(pillar, "REVISION_NOT_ALLOWED"), history: [], latestDrawdown: null };
  const eligible = rows.filter(row => isEligible(row, panel));
  assertNoConflicts(eligible);
  const closes = dedupeByDate(eligible);
  if (closes.length === 0) return { result: unavailable(pillar, "MISSING"), history: [], latestDrawdown: null };
  const latestClose = closes[closes.length - 1]!;
  const stale = staleReason(pillar, panel.asOfDate, latestClose.date);
  const window = pillar.windowSessions ?? spec.equityWindowSessions;
  const drawdowns: HistoryPoint[] = [];
  const closeValues = closes.map(point => point.value);
  for (let index = 0; index < closes.length; index += 1) {
    const drawdown = drawdownFromWindowHigh(closeValues, index, window);
    if (drawdown == null) continue;
    drawdowns.push({ date: closes[index]!.date, value: drawdown, source: closes[index]!.source });
  }
  const latestDrawdown = drawdowns.length ? drawdowns[drawdowns.length - 1]!.value : null;
  if (stale) return { result: unavailable(pillar, stale, drawdowns.length), history: [], latestDrawdown: null };
  if (latestDrawdown == null) return { result: unavailable(pillar, "INSUFFICIENT_HISTORY", 0), history: [], latestDrawdown: null };
  const latestPoint = drawdowns[drawdowns.length - 1]!;
  const scored = finishPercentile(pillar, spec, latestPoint.source, drawdowns, latestDrawdown, panel.asOfDate);
  return { result: scored.result, history: scored.ok ? drawdowns : [], latestDrawdown };
}

type SahmPoint = HistoryPoint & { month: string };

function pathAsOf(rows: Observation[], cutoff: string): Observation[] {
  const months = Array.from(new Set(rows.map(row => row.observationDate))).sort();
  const path: Observation[] = [];
  for (const month of months) {
    const candidates = rows.filter(row => row.observationDate === month && row.observationDate <= cutoff && row.realtimeStart && row.realtimeStart <= cutoff);
    if (candidates.length === 0) continue;
    const bestStart = candidates.map(row => row.realtimeStart!).sort().at(-1)!;
    const chosen = candidates.filter(row => row.realtimeStart === bestStart);
    const values = new Set(chosen.map(row => row.value));
    if (values.size > 1) {
      throw new ResearchSpecError("AMBIGUOUS_OBSERVATION", `Conflicting UNRATE vintages for ${month} at ${bestStart}`);
    }
    path.push(chosen[0]!);
  }
  return path;
}

function scoreUnemployment(pillar: PillarSpec, panel: InputPanel, spec: FrozenSpec): { result: PillarResult; history: HistoryPoint[] } {
  const rows = seriesRows(panel, pillar.seriesId).filter(row => isEligible(row, panel));
  assertNoConflicts(rows);
  if (rows.length === 0) return { result: unavailable(pillar, "MISSING"), history: [] };
  if (rows.some(row => !row.realtimeStart || !row.vintageId)) return { result: unavailable(pillar, "INCOMPLETE_PROVENANCE"), history: [] };
  const trailing = pillar.trailingAverageMonths ?? 3;
  const window = pillar.minimumWindowMonths ?? 12;
  const cutoffs = Array.from(new Set(rows.map(row => row.realtimeStart!))).filter(cutoff => cutoff <= panel.asOfDate).sort();
  const points: SahmPoint[] = [];
  for (const cutoff of cutoffs) {
    const path = pathAsOf(rows, cutoff);
    const gap = sahmGap(path.map(row => row.value), trailing, window);
    if (gap == null || path.length === 0) continue;
    const latestMonth = path[path.length - 1]!;
    points.push({
      date: cutoff,
      month: latestMonth.observationDate,
      value: gap,
      source: { ...latestMonth, observationDate: cutoff },
    });
  }
  if (points.length === 0) return { result: unavailable(pillar, "VINTAGE_NOT_AVAILABLE", 0), history: [] };
  const latest = points[points.length - 1]!;
  if (daysBetween(latest.month, panel.asOfDate) > pillar.staleCalendarDays) {
    return { result: unavailable(pillar, "STALE", points.length), history: [] };
  }
  const history = points.map(point => ({ date: point.date, value: point.value, source: point.source }));
  const scored = finishPercentile(pillar, spec, latest.source, history, latest.value, panel.asOfDate);
  if (scored.result.status === "ok") {
    scored.result.observationDate = latest.month;
    scored.result.realtimeStart = latest.source.realtimeStart;
  }
  return { result: scored.result, history: scored.ok ? history : [] };
}

function sampleStdev(values: number[]): number | null {
  if (values.length < 2) return null;
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  const squareSum = values.reduce((sum, value) => sum + (value - mean) ** 2, 0);
  const stdev = Math.sqrt(squareSum / (values.length - 1));
  return stdev > 0 ? stdev : null;
}

function benchmarksFor(
  spec: FrozenSpec,
  histories: Map<string, HistoryPoint[]>,
  pillars: PillarResult[],
  equityDrawdown: number | null,
): BenchmarkBlock {
  const vol = pillars.find(pillar => pillar.id === "market_volatility");
  const vixHistory = histories.get("market_volatility") ?? [];
  const vixLevel = vol?.status === "ok" ? vol.raw : vixHistory.length ? vixHistory[vixHistory.length - 1]!.value : null;
  const zPillars: PillarId[] = [];
  const zScores: number[] = [];
  for (const pillar of pillars) {
    if (pillar.status !== "ok" || pillar.raw == null) continue;
    const history = histories.get(pillar.id) ?? [];
    const values = history.map(point => point.value);
    const stdev = sampleStdev(values);
    const raw = values[values.length - 1];
    if (stdev == null || raw == null) continue;
    const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
    zScores.push((raw - mean) / stdev);
    zPillars.push(pillar.id);
  }
  const ewZ = zScores.length ? roundTo(zScores.reduce((sum, value) => sum + value, 0) / zScores.length, spec.benchmarkZDecimals) : null;
  return {
    methodology: "vix_level_plus_spx_drawdown_plus_equal_weight_expanding_z",
    vixLevel: vixLevel == null ? null : roundTo(vixLevel, 6),
    vixAtLeast25: vixLevel == null ? null : vixLevel >= 25,
    spxDrawdownPct: equityDrawdown == null ? null : roundTo(equityDrawdown, 6),
    ewZ,
    ewZPillars: zPillars,
  };
}

function provenanceFor(pillars: PillarResult[]): ProvenanceRecord[] {
  return pillars.map(pillar => ({
    pillarId: pillar.id,
    seriesId: pillar.seriesId,
    used: pillar.status === "ok",
    observationDate: pillar.observationDate,
    releaseTime: pillar.releaseTime,
    realtimeStart: pillar.realtimeStart,
    vintageId: pillar.vintageId,
    ingestionTime: pillar.ingestionTime,
    provider: pillar.provider,
    coverageLabel: pillar.proxyLabel,
    reason: pillar.reason,
  }));
}

function assertPanelSeries(panel: InputPanel, spec: FrozenSpec): void {
  const allowed = new Set(spec.pillars.map(pillar => pillar.seriesId));
  for (const observation of panel.observations) {
    if (spec.forbiddenFundingSubstitutes.includes(observation.seriesId)) {
      throw new ResearchSpecError(
        "SPEC_VIOLATION",
        `${observation.seriesId} is not an approved input to ${SPEC_ID}. Funding substitutes stay outside this spec.`,
      );
    }
    if (!allowed.has(observation.seriesId)) {
      throw new ResearchSpecError("SPEC_VIOLATION", `${observation.seriesId} is not a pillar series in ${SPEC_ID}`);
    }
    if (!Number.isFinite(observation.value)) {
      throw new ResearchSpecError("SPEC_VIOLATION", `Non-finite value for ${observation.seriesId}`);
    }
  }
}

export function computeV2At(panel: InputPanel): V2Computation {
  const { spec, sha256 } = loadLockedSpec();
  assertPanelSeries(panel, spec);
  const histories = new Map<string, HistoryPoint[]>();
  const pillars: PillarResult[] = [];
  let equityDrawdown: number | null = null;
  for (const pillar of spec.pillars) {
    if (pillar.id === "equity_drawdown") {
      const scored = scoreEquity(pillar, panel, spec);
      pillars.push(scored.result);
      histories.set(pillar.id, scored.history);
      equityDrawdown = scored.latestDrawdown;
      continue;
    }
    if (pillar.id === "unemployment_deterioration") {
      const scored = scoreUnemployment(pillar, panel, spec);
      pillars.push(scored.result);
      histories.set(pillar.id, scored.history);
      continue;
    }
    const scored = scoreLevelPillar(pillar, panel, spec);
    pillars.push(scored.result);
    histories.set(pillar.id, scored.history);
  }
  const available = pillars.filter(pillar => pillar.status === "ok" && pillar.score != null);
  const benchmarks = benchmarksFor(spec, histories, pillars, equityDrawdown);
  const inputsProvenance = provenanceFor(pillars);
  const referenceSha256 = canonicalSha256(available.map(pillar => ({
    pillarId: pillar.id,
    points: (histories.get(pillar.id) ?? []).map(point => ({ date: point.date, value: point.value })),
  })));
  const base = {
    specId: SPEC_ID,
    specSha256: sha256,
    implementationVersion: IMPLEMENTATION_VERSION,
    asOfDate: panel.asOfDate,
    decisionTimeUtc: panel.decisionTimeUtc,
    pillars,
    benchmarks,
    inputsProvenance,
    referenceSha256,
    probabilitiesEmitted: false as const,
  };
  if (available.length < spec.minAvailablePillars) {
    return {
      ...base,
      status: "unavailable",
      v2Score: null,
      band: null,
      nPillars: available.length,
      missingDataStatus: "unavailable",
    };
  }
  const mean = available.reduce((sum, pillar) => sum + pillar.score!, 0) / available.length;
  const v2Score = roundTo(mean, spec.persistedScoreDecimals);
  return {
    ...base,
    status: "ok",
    v2Score,
    band: bandForScore(v2Score, spec),
    nPillars: available.length,
    missingDataStatus: available.length === spec.pillars.length ? "complete" : "partial",
  };
}
