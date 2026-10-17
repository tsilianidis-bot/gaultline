export type PillarId =
  | "credit_stress"
  | "funding_stress"
  | "market_volatility"
  | "equity_drawdown"
  | "unemployment_deterioration";

export type Observation = {
  seriesId: string;
  observationDate: string;
  value: number;
  releaseTime: string | null;
  realtimeStart: string | null;
  vintageId: string;
  provider: string;
  ingestionTime: string;
};

export type InputPanel = {
  asOfDate: string;
  decisionTimeUtc: string;
  observations: Observation[];
};

export type PillarStatus = "ok" | "unavailable";

export type PillarResult = {
  id: PillarId;
  seriesId: string;
  status: PillarStatus;
  raw: number | null;
  observationDate: string | null;
  releaseTime: string | null;
  realtimeStart: string | null;
  vintageId: string | null;
  provider: string | null;
  ingestionTime: string | null;
  percentile: number | null;
  score: number | null;
  reason: string | null;
  proxyLabel: string | null;
  historyCount: number;
};

export type ProvenanceRecord = {
  pillarId: PillarId | null;
  seriesId: string;
  used: boolean;
  observationDate: string | null;
  releaseTime: string | null;
  realtimeStart: string | null;
  vintageId: string | null;
  ingestionTime: string | null;
  provider: string | null;
  coverageLabel: string | null;
  reason: string | null;
};

export type BenchmarkBlock = {
  methodology: "vix_level_plus_spx_drawdown_plus_equal_weight_expanding_z";
  vixLevel: number | null;
  vixAtLeast25: boolean | null;
  spxDrawdownPct: number | null;
  ewZ: number | null;
  ewZPillars: PillarId[];
};

export type V2Computation = {
  specId: "FL-PI-v2-research-0";
  specSha256: string;
  implementationVersion: string;
  asOfDate: string;
  decisionTimeUtc: string;
  status: "ok" | "unavailable";
  v2Score: number | null;
  band: string | null;
  nPillars: number;
  missingDataStatus: "complete" | "partial" | "unavailable";
  pillars: PillarResult[];
  benchmarks: BenchmarkBlock;
  inputsProvenance: ProvenanceRecord[];
  referenceSha256: string;
  probabilitiesEmitted: false;
};

export type RawDraft = {
  seriesId: string;
  observationDate: string;
  valueText: string;
  releaseTime: string | null;
  realtimeStart: string | null;
  vintageId: string;
  provider: string;
  coverageLabel: string;
  inComposite: boolean;
};

export type RawInputRow = RawDraft & {
  id: number;
  specId: "FL-PI-v2-research-0";
  ingestionTime: string;
  inputHash: string;
  createdAt: string;
};

export type SnapshotRow = {
  id: number;
  asOfDate: string;
  onSpecGrid: true;
  recordClass: "FORWARD_LIVE";
  specId: "FL-PI-v2-research-0";
  specSha256: string;
  implementationVersion: string;
  referenceSha256: string;
  runTrigger: "SCHEDULED_CRON" | "ADMIN_SEED";
  status: "ok" | "unavailable";
  v2Score: number | null;
  band: string | null;
  nPillars: number;
  missingDataStatus: "complete" | "partial" | "unavailable";
  pillarsJson: string;
  benchmarksJson: string;
  inputsProvenanceJson: string;
  inputSnapshotHash: string;
  decisionTimeUtc: string;
  v1Reading: number | null;
  v1MethodologyVersion: string | null;
  createdAt: string;
};

export type LedgerRow = {
  id: number;
  recordClass: "RETROSPECTIVE" | "FORWARD_LIVE";
  origin: "BACKFILL" | "OBSERVED_AT_DECISION";
  rowKind: "SCORE" | "OUTCOME";
  asOfDate: string;
  specId: "FL-PI-v2-research-0";
  specSha256: string;
  implementationVersion: string;
  targetId: string;
  horizon: string;
  snapshotId: number | null;
  parentLedgerId: number | null;
  score: number | null;
  outcome: 0 | 1 | null;
  artifactKind: string;
  notes: string | null;
  createdAt: string;
};

export type MonitorKind =
  | "MISSING_FRIDAY_SNAPSHOT"
  | "STALE_DATA"
  | "CALCULATION_FAILURE"
  | "SPEC_HASH_DRIFT"
  | "EXPECTED_UNAVAILABLE";

export type MonitorRow = {
  id: number;
  detectedAt: string;
  kind: MonitorKind;
  severity: "info" | "alert";
  specId: "FL-PI-v2-research-0";
  specSha256: string | null;
  asOfDate: string | null;
  detailJson: string;
  createdAt: string;
};
