import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { ResearchSpecError } from "./errors";
import { sha256Hex } from "./hash";
import { EXPECTED_SPEC_SHA256, SPEC_FILENAME, SPEC_ID } from "./lock";

export const FIRST_OFFICIAL_FRIDAY = "2026-10-16";

export type BandSpec = {
  id: string;
  minInclusive: number;
  maxExclusive: number | null;
};

export type PillarSpec = {
  id: string;
  seriesId: string;
  provider: string;
  liveProvider?: string;
  alternateReferenceProvider?: string;
  transform: string;
  direction: "higher_is_stress";
  frequency: "daily" | "monthly";
  revised: boolean;
  proxyLabel?: string;
  seriesEnd?: string;
  afterSeriesEnd?: string;
  unavailableReason?: string;
  substitution?: string;
  staleCalendarDays: number;
  provenance: "market" | "monthly";
  windowSessions?: number;
  rawUnit?: string;
  historyMode?: string;
  trailingAverageMonths?: number;
  minimumWindowMonths?: number;
  percentileClock?: string;
  liveVintageClass?: string;
  historicalVintageClass?: string;
  notes: string;
};

export type NonCompositeSpec = {
  seriesId: string;
  label: string;
  fredCoverageStart: string;
  coverageProbeDate: string;
  role: string;
  inComposite: false;
  licenseForFullHistory: string;
  notes: string;
};

export type FrozenSpec = {
  specId: typeof SPEC_ID;
  status: "FROZEN";
  frozenOn: string;
  publicDisplay: false;
  probabilitiesEmitted: false;
  platoReceivesV2: false;
  weightPolicy: "equal_mean_of_available";
  nominalWeightEach: 0.2;
  weightOptimization: "forbidden";
  noImputation: true;
  minAvailablePillars: number;
  minHistoryDays: number;
  minHistoryObservations: number;
  dailyStaleCalendarDays: number;
  unemploymentStaleCalendarDays: number;
  equityWindowSessions: number;
  percentileMethod: "midrank";
  scoreTransform: string;
  persistedScoreDecimals: number;
  percentileDecimals: number;
  benchmarkZDecimals: number;
  firstOfficialFriday: typeof FIRST_OFFICIAL_FRIDAY;
  hindsightCutoff: string;
  decisionClock: { timeZone: "America/New_York"; localTime: "14:00"; weekday: "Friday" };
  bands: BandSpec[];
  pillars: PillarSpec[];
  documentedNonComposite: NonCompositeSpec[];
  forbiddenFundingSubstitutes: string[];
  evaluation: {
    targets: string[];
    calendarDayHorizons: number[];
    sessionHorizons: number[];
    recessionExtraHorizonDays: number[];
    primaryEquityHorizonSessions: number;
    primaryRecessionHorizonDays: number;
    blockLengthWeeks: number;
    bootstrapDraws: number;
    bootstrapSeed: number;
    weightEstimation: "forbidden_on_this_spec";
    tliqUnderThisSpec: "NOT_EVALUABLE";
  };
};

const specPath = fileURLToPath(new URL(`./spec/${SPEC_FILENAME}`, import.meta.url));

let cached: { spec: FrozenSpec; sha256: string; bytes: Buffer } | null = null;

export function readSpecBytes(): Buffer {
  return readFileSync(specPath);
}

export function hashSpecBytes(bytes: Buffer = readSpecBytes()): string {
  return sha256Hex(bytes);
}

function requireEqual(actual: unknown, expected: unknown, label: string): void {
  const same = JSON.stringify(actual) === JSON.stringify(expected);
  if (!same) {
    throw new ResearchSpecError("SPEC_SHAPE", `${label} does not match the preregistered FL-PI-v2-research-0 contract`);
  }
}

export function validateSpec(spec: FrozenSpec): void {
  requireEqual(spec.specId, SPEC_ID, "specId");
  requireEqual(spec.status, "FROZEN", "status");
  requireEqual(spec.publicDisplay, false, "publicDisplay");
  requireEqual(spec.probabilitiesEmitted, false, "probabilitiesEmitted");
  requireEqual(spec.platoReceivesV2, false, "platoReceivesV2");
  requireEqual(spec.weightPolicy, "equal_mean_of_available", "weightPolicy");
  requireEqual(spec.nominalWeightEach, 0.2, "nominalWeightEach");
  requireEqual(spec.weightOptimization, "forbidden", "weightOptimization");
  requireEqual(spec.noImputation, true, "noImputation");
  requireEqual(spec.minAvailablePillars, 3, "minAvailablePillars");
  requireEqual(spec.minHistoryDays, 1825, "minHistoryDays");
  requireEqual(spec.minHistoryObservations, 60, "minHistoryObservations");
  requireEqual(spec.dailyStaleCalendarDays, 10, "dailyStaleCalendarDays");
  requireEqual(spec.unemploymentStaleCalendarDays, 70, "unemploymentStaleCalendarDays");
  requireEqual(spec.equityWindowSessions, 252, "equityWindowSessions");
  requireEqual(spec.percentileMethod, "midrank", "percentileMethod");
  requireEqual(spec.firstOfficialFriday, FIRST_OFFICIAL_FRIDAY, "firstOfficialFriday");
  requireEqual(spec.decisionClock.timeZone, "America/New_York", "decisionClock.timeZone");
  requireEqual(spec.decisionClock.localTime, "14:00", "decisionClock.localTime");
  requireEqual(spec.pillars.map(pillar => pillar.id), [
    "credit_stress",
    "funding_stress",
    "market_volatility",
    "equity_drawdown",
    "unemployment_deterioration",
  ], "pillar ids");
  requireEqual(spec.pillars.map(pillar => pillar.seriesId), ["BAA10Y", "TEDRATE", "VIXCLS", "SP500", "UNRATE"], "pillar series");
  requireEqual(spec.pillars.map(pillar => pillar.direction), [
    "higher_is_stress",
    "higher_is_stress",
    "higher_is_stress",
    "higher_is_stress",
    "higher_is_stress",
  ], "directions");
  const funding = spec.pillars[1]!;
  requireEqual(funding.seriesEnd, "2022-01-21", "TED end");
  requireEqual(funding.substitution, "forbidden", "funding substitution");
  requireEqual(funding.unavailableReason, "FUNDING_SUCCESSOR_NOT_APPROVED", "funding reason");
  requireEqual(spec.pillars[0]!.proxyLabel, "IG_SPREAD_PROXY", "credit proxy label");
  requireEqual(spec.documentedNonComposite[0]?.seriesId, "BAMLH0A0HYM2", "HY series");
  requireEqual(spec.documentedNonComposite[0]?.inComposite, false, "HY composite flag");
  requireEqual(spec.documentedNonComposite[0]?.fredCoverageStart, "2023-10-16", "HY window start");
  for (const seriesId of ["DCPF3M", "DTB3", "CP_TBILL", "FRA_OIS"]) {
    if (!spec.forbiddenFundingSubstitutes.includes(seriesId)) {
      throw new ResearchSpecError("SPEC_SHAPE", `${seriesId} must stay on the forbidden substitute list`);
    }
  }
  if (spec.pillars.some(pillar => spec.forbiddenFundingSubstitutes.includes(pillar.seriesId))) {
    throw new ResearchSpecError("SPEC_SHAPE", "A forbidden substitute is listed as a pillar");
  }
  requireEqual(spec.evaluation.weightEstimation, "forbidden_on_this_spec", "weight estimation");
  requireEqual(spec.evaluation.tliqUnderThisSpec, "NOT_EVALUABLE", "T-LIQ");
  requireEqual(spec.evaluation.bootstrapSeed, 20261014, "bootstrap seed");
  requireEqual(spec.bands.map(band => band.id), ["LOW", "MODERATE", "ELEVATED", "HIGH", "SYSTEMIC_CRISIS"], "bands");
  const edges = spec.bands.map(band => [band.minInclusive, band.maxExclusive]);
  requireEqual(edges, [[0, 25], [25, 45], [45, 65], [65, 80], [80, null]], "band edges");
}

export function loadLockedSpec(): { spec: FrozenSpec; sha256: string } {
  if (cached) return { spec: cached.spec, sha256: cached.sha256 };
  const bytes = readSpecBytes();
  const sha256 = hashSpecBytes(bytes);
  if (sha256 !== EXPECTED_SPEC_SHA256) {
    throw new ResearchSpecError(
      "SPEC_HASH_DRIFT",
      `Spec file hash ${sha256} does not match locked hash ${EXPECTED_SPEC_SHA256}`,
    );
  }
  const spec = JSON.parse(bytes.toString("utf8")) as FrozenSpec;
  validateSpec(spec);
  cached = { spec, sha256, bytes };
  return { spec, sha256 };
}

export function clearSpecCache(): void {
  cached = null;
}
