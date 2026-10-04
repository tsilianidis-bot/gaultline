/**
 * FAULTLINE Sector Rotation / Market Leadership layer — shared contract.
 *
 * Data-first: every number in a SectorRotationReading is computed by
 * deterministic server code (server/sectorRotation/calc.ts) from fetched market
 * data. Prose fields are deterministic templates over the computed object and
 * are validated so they cannot carry a number the object does not contain.
 * No LLM text, no probabilities, no demo or fallback values. Missing inputs are
 * carried as explicit UNAVAILABLE / STALE flags with their as-of times.
 *
 * This layer is display-only. It does not read or change the Pressure Index,
 * regime thresholds, engine output or the probability contract; it only
 * references the canonical regime / Pressure Index / stateId it was read beside.
 */

export const SECTOR_ROTATION_METHOD_VERSION = "sector-rotation-v1.0.0" as const;
export const SECTOR_ROTATION_SCHEMA_VERSION = 1 as const;

/** The 11 Select Sector SPDR ETFs (GICS sectors of the S&P 500) and the benchmark. */
export const SECTOR_ETFS = [
  { ticker: "XLK", sector: "Information Technology", short: "Technology" },
  { ticker: "XLF", sector: "Financials", short: "Financials" },
  { ticker: "XLE", sector: "Energy", short: "Energy" },
  { ticker: "XLV", sector: "Health Care", short: "Health Care" },
  { ticker: "XLI", sector: "Industrials", short: "Industrials" },
  { ticker: "XLY", sector: "Consumer Discretionary", short: "Discretionary" },
  { ticker: "XLP", sector: "Consumer Staples", short: "Staples" },
  { ticker: "XLU", sector: "Utilities", short: "Utilities" },
  { ticker: "XLB", sector: "Materials", short: "Materials" },
  { ticker: "XLRE", sector: "Real Estate", short: "Real Estate" },
  { ticker: "XLC", sector: "Communication Services", short: "Communication" },
] as const;
export type SectorEtfTicker = (typeof SECTOR_ETFS)[number]["ticker"];
export const BENCHMARK_TICKER = "SPY" as const;
/** Conventional defensive sectors used only for the regime-alignment sentence. */
export const DEFENSIVE_SECTORS: readonly SectorEtfTicker[] = ["XLU", "XLP", "XLV"];

/**
 * Fixed method parameters. Chosen a priori from the conventional RRG-style
 * construction; NOT tuned against historical outcomes. Changing any of these
 * requires a new methodVersion.
 */
export const SECTOR_ROTATION_PARAMS = {
  /** RS-Ratio = 100 × RS_t / SMA(RS, rsRatioWindow)_t, RS = sector close / SPY close. */
  rsRatioWindow: 50,
  /** RS-Momentum = 100 × RSRatio_t / RSRatio_(t − rsMomentumLookback). */
  rsMomentumLookback: 10,
  /** Quadrant centre line for both axes. Values exactly at 100 fall on the ≥ side. */
  quadrantCentre: 100,
  /** Display dead-band for the momentum arrow: RSM ≥ 100.5 ↑, ≤ 99.5 ↓, otherwise →. Does not affect quadrants. */
  arrowBand: 0.5,
  /** Return lookbacks in completed sessions. */
  shortLookback: 5,
  mediumLookback: 20,
  /** Breadth: share of a sector's constituents whose latest completed close is above their SMA(breadthWindow). */
  breadthWindow: 50,
  /** Breadth is withheld when fewer than this share of a sector's constituents have enough bars. */
  breadthMinCoverage: 0.9,
  /** Volume vs normal = latest completed-session volume / mean of the prior volumeWindow completed sessions. */
  volumeWindow: 20,
  /** Top-movers panel is withheld (UNAVAILABLE) below this share of the universe ranked. */
  moversMinCoverage: 0.95,
  /** Movers shown per side. */
  moversPerSide: 5,
  /** Catalyst co-move rule: a benchmark "explains" a move when it moved the same way by at least this share of it. */
  coMoveShare: 0.5,
  /** Early-indicator rule: minimum volume vs normal. */
  earlyIndicatorVolumeRatio: 1.5,
  /**
   * Corporate-action guard for constituent stocks: a single completed-session move of at least this
   * magnitude (%) inside a lookback window marks a possible unadjusted corporate action; the multi-day
   * metric that spans it is withheld (never "adjusted" by FAULTLINE).
   */
  discontinuityGuardPct: 50,
  /** Completed-bar rule: a session counts after its 4 PM ET close plus this many minutes. */
  completedBarDelayMinutes: 60,
  /** A completed session older than this many calendar days (ET) is labelled STALE. */
  staleAfterCalendarDays: 4,
  /** Universe holdings file older than this many calendar days is labelled STALE. */
  universeStaleAfterDays: 7,
} as const;

export type DataStatus = "OK" | "STALE" | "UNAVAILABLE";
export type Quadrant = "LEADING" | "IMPROVING" | "LOSING_MOMENTUM" | "LAGGING";
export type MomentumArrow = "UP" | "FLAT" | "DOWN";
export type SectorActionClass = "OVERWEIGHT" | "NEUTRAL" | "UNDERWEIGHT" | "AVOID" | "WATCH_FOR_CONFIRMATION";
export type CatalystClass = "EVENT_DRIVEN" | "COMPANY_SPECIFIC" | "SECTOR_DRIVEN" | "MACRO_DRIVEN" | "CATALYST_UNCLEAR";
export type EventFamily = "EARNINGS" | "GUIDANCE" | "M_AND_A" | "REGULATORY" | "ANALYST_ACTION";
export type ThesisAlignment = "REINFORCES" | "CONTRADICTS" | "UNDETERMINED";
export type LeadershipGroup = "CURRENT_LEADERSHIP" | "EMERGING_LEADERSHIP" | "DETERIORATING_LEADERSHIP" | "CONFIRMED_WEAKNESS";

export const QUADRANT_LABEL: Record<Quadrant, string> = {
  LEADING: "Leading",
  IMPROVING: "Improving",
  LOSING_MOMENTUM: "Losing momentum",
  LAGGING: "Lagging",
};
export const ARROW_GLYPH: Record<MomentumArrow, string> = { UP: "↑", FLAT: "→", DOWN: "↓" };
export const ACTION_LABEL: Record<SectorActionClass, string> = {
  OVERWEIGHT: "OVERWEIGHT",
  NEUTRAL: "NEUTRAL",
  UNDERWEIGHT: "UNDERWEIGHT",
  AVOID: "AVOID",
  WATCH_FOR_CONFIRMATION: "WATCH FOR CONFIRMATION",
};
export const CATALYST_LABEL: Record<CatalystClass, string> = {
  EVENT_DRIVEN: "EVENT-DRIVEN",
  COMPANY_SPECIFIC: "COMPANY-SPECIFIC",
  SECTOR_DRIVEN: "SECTOR-DRIVEN",
  MACRO_DRIVEN: "MACRO-DRIVEN",
  CATALYST_UNCLEAR: "CATALYST UNCLEAR",
};
export const CATALYST_UNCLEAR_TEXT = "CATALYST UNCLEAR" as const;
export const LEADERSHIP_GROUP_LABEL: Record<LeadershipGroup, string> = {
  CURRENT_LEADERSHIP: "Current leadership",
  EMERGING_LEADERSHIP: "Emerging leadership",
  DETERIORATING_LEADERSHIP: "Deteriorating leadership",
  CONFIRMED_WEAKNESS: "Confirmed weakness",
};

/** How "today %" was measured. Intraday values always carry their observation time. */
export type DailyChangeBasis =
  | { kind: "INTRADAY"; asOf: string | null; sessionDate: string }
  | { kind: "SESSION_CLOSE"; sessionDate: string };

export interface EvidenceCheck {
  id: string;
  label: string;
  /** Pre-formatted observed value from the computed object (or "Unavailable"). */
  observed: string;
  /** true = supports the class rule, false = fails it, null = input unavailable. */
  passed: boolean | null;
}

export interface SectorBreadth {
  status: DataStatus;
  /** % of counted constituents whose latest completed close is above SMA50. */
  pctAboveSma: number | null;
  counted: number;
  total: number;
  reason: string | null;
}

export interface SectorRow {
  ticker: SectorEtfTicker;
  sector: string;
  status: "RANKED" | "UNAVAILABLE";
  unavailableReason: string | null;
  latestCompletedSession: string | null;
  dailyChangePct: number | null;
  dailyBasis: DailyChangeBasis | null;
  return5dPct: number | null;
  return20dPct: number | null;
  /** Sector 20-session return minus SPY 20-session return, percentage points. */
  relReturn20dPct: number | null;
  rsRatio: number | null;
  rsMomentum: number | null;
  quadrant: Quadrant | null;
  arrow: MomentumArrow | null;
  rank: number | null;
  priorRank: number | null;
  /** priorRank − rank: positive = moved up the leadership table. */
  rankChange: number | null;
  priorQuadrant: Quadrant | null;
  /** Consecutive completed sessions (including the latest) in the current quadrant, within the computable window. */
  sessionsInQuadrant: number | null;
  leadershipGroup: LeadershipGroup | null;
  breadth: SectorBreadth;
  action: { class: SectorActionClass; rule: string; evidence: EvidenceCheck[] } | null;
}

export type DriverId =
  | "UST10Y" | "CURVE_2S10S" | "DOLLAR" | "OIL_WTI" | "HY_SPREAD" | "BREAKEVEN_10Y" | "VIX"
  | "LIQUIDITY_FED_BALANCE_SHEET" | "GROWTH_EXPECTATIONS" | "SEMIS_LEADERSHIP" | "DEFENSIVE_POSITIONING" | "SMALL_CAP_PARTICIPATION";

export interface MacroDriverReading {
  id: DriverId;
  label: string;
  /** Exact source, e.g. "FRED DGS10" or "Yahoo chart CL=F". */
  source: string;
  status: DataStatus;
  latest: number | null;
  latestUnit: string;
  /** Change over the driver's lookback, in changeUnit. */
  change: number | null;
  changeUnit: string;
  lookback: string;
  direction: "RISING" | "FALLING" | "FLAT" | null;
  asOf: string | null;
  reason: string | null;
}

export interface SectorDriverLink {
  sector: SectorEtfTicker;
  driver: DriverId;
  /** Conventional sign of the linkage: +1 sector RS tends to move with the driver, −1 against it. */
  expectedSign: 1 | -1;
  /** CONSISTENT = sector's RS direction and driver direction match the conventional sign; DIVERGING = they do not. */
  observed: "CONSISTENT" | "DIVERGING" | "NO_CLEAR_DIRECTION" | "UNAVAILABLE";
  text: string;
}

export interface WatchIndicator {
  id: string;
  label: string;
  source: string;
  status: DataStatus;
  current: string;
  confirms: string;
  invalidates: string;
  state: "CONFIRMING" | "NOT_CONFIRMING" | "UNAVAILABLE";
}

export interface NewsEvidence {
  id: string;
  title: string;
  publisher: string;
  url: string;
  publishedAt: string;
  source: "polygon-news";
}

export interface MoverRow {
  ticker: string;
  company: string;
  sectorEtf: SectorEtfTicker;
  sector: string;
  todayPct: number;
  todayBasis: DailyChangeBasis;
  return5dPct: number | null;
  return5dReason: string | null;
  volumeRatio: number | null;
  volumeRatioReason: string | null;
  catalyst: {
    class: CatalystClass;
    eventFamily: EventFamily | null;
    /** Exactly CATALYST_UNCLEAR_TEXT when class is CATALYST_UNCLEAR. */
    why: string;
    /** Present for EVENT_DRIVEN / COMPANY_SPECIFIC — never absent for those classes. */
    news: NewsEvidence | null;
    /** Present for SECTOR_DRIVEN / MACRO_DRIVEN. */
    coMove: { benchmark: string; benchmarkPct: number; stockPct: number } | null;
  };
  thesisAlignment: ThesisAlignment;
  earlyIndicator: { flagged: boolean; rule: string; text: string | null };
}

export interface TopMovers {
  status: DataStatus;
  reason: string | null;
  universe: {
    name: string;
    source: string;
    asOf: string | null;
    total: number;
    ranked: number;
    unavailable: string[];
    status: DataStatus;
  };
  basis: DailyChangeBasis | null;
  newsStatus: DataStatus;
  newsReason: string | null;
  winners: MoverRow[];
  losers: MoverRow[];
}

export interface CanonicalLink {
  stateId: string | null;
  stateHash: string | null;
  stateGeneratedAt: string | null;
  /** Filled by the scheduled run when the reading is stored beside a run; null on a live read. */
  runId: string | null;
  regime: string | null;
  pressureIndex: number | null;
}

/**
 * Versioned, storable reading. Produced by the pure function
 * buildSectorRotationReading(inputs). See docs/sector-rotation/STORAGE_PROPOSAL.md.
 */
export interface SectorRotationReading {
  schemaVersion: typeof SECTOR_ROTATION_SCHEMA_VERSION;
  methodVersion: typeof SECTOR_ROTATION_METHOD_VERSION;
  generatedAt: string;
  canonical: CanonicalLink;
  status: DataStatus;
  benchmark: { ticker: typeof BENCHMARK_TICKER; status: DataStatus; latestCompletedSession: string | null; dailyChangePct: number | null; dailyBasis: DailyChangeBasis | null; return20dPct: number | null; reason: string | null };
  sectors: SectorRow[];
  leadershipChanges: Array<{ ticker: SectorEtfTicker; from: Quadrant; to: Quadrant; text: string }>;
  drivers: MacroDriverReading[];
  driverLinks: SectorDriverLink[];
  watch: WatchIndicator[];
  movers: TopMovers;
  /** Derived counts quoted by the narrative (kept in the object so every quoted number is traceable). */
  summary: {
    confirmingIndicators: number;
    measurableIndicators: number;
    reinforcingMovers: number;
    contradictingMovers: number;
    catalystCounts: Record<CatalystClass, number>;
  };
  narrative: {
    whyItMatters: string | null;
    happening: string | null;
    why: string | null;
    next: string | null;
    watch: string | null;
    act: string | null;
  };
  missingData: Array<{ id: string; status: Exclude<DataStatus, "OK">; reason: string; asOf: string | null }>;
  params: typeof SECTOR_ROTATION_PARAMS;
}
