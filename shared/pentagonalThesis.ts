/**
 * FAULTLINE Pentagonal Thesis — shared stock-analysis contract.
 *
 * One pure function turns supplied observations into the five-section thesis.
 * It does not fetch data, invent missing numbers, or assign probabilities.
 * Callers must pass only observations they actually hold.
 */

export const PENTAGONAL_THESIS_ENGINE_VERSION = "pentagonal-thesis-v1" as const;

export const THESIS_SECTIONS = ["happening", "why", "next", "watch", "do"] as const;
export type ThesisSectionId = (typeof THESIS_SECTIONS)[number];

export type EvidenceKind = "fact" | "inference" | "forecast";
export type EpistemicStatus = "verified" | "hypothesis" | "unavailable";
export type QualitativeConfidence = "insufficient" | "limited" | "moderate";
export type ThesisScope = "stock" | "sector" | "market";

export const QUOTE_FRESH_MS = 4 * 24 * 60 * 60 * 1000;
export const BAR_FRESH_MS = 5 * 24 * 60 * 60 * 1000;
export const MARKET_FRESH_MS = 72 * 60 * 60 * 1000;
export const PROFILE_FRESH_MS = 7 * 24 * 60 * 60 * 1000;

export interface CompletedBar {
  high: number;
  low: number;
  close: number;
  volume: number | null;
  timestamp: string;
}

export interface QuoteObservation {
  price: number | null;
  previousClose: number | null;
  volume: number | null;
  changePercent: number | null;
  source: string;
  observedAt: string | null;
  fetchedAt: string | null;
  delayed: boolean;
}

export interface MarketContextObservation {
  pressureIndex: number | null;
  regime: string | null;
  source: string;
  observedAt: string | null;
  /** Caller already applied canonical usability. The engine still requires a finite value and a fresh timestamp. */
  usable: boolean;
}

export interface ProfileObservation {
  name: string | null;
  sector: string | null;
  industry: string | null;
  marketCap: number | null;
  trailingPe: number | null;
  earningsDate: string | null;
  source: string;
  observedAt: string | null;
}

export interface SessionRankObservation {
  list: "gainers" | "losers";
  rank: number;
  universeSize: number;
  source: string;
  observedAt: string | null;
}

export interface PentagonalThesisInput {
  symbol: string;
  scope?: ThesisScope;
  generatedAt: string;
  quote: QuoteObservation | null;
  bars: CompletedBar[];
  market: MarketContextObservation | null;
  profile: ProfileObservation | null;
  sessionRank?: SessionRankObservation | null;
}

export interface ThesisEvidenceItem {
  id: string;
  section: ThesisSectionId;
  statement: string;
  kind: EvidenceKind;
  epistemic: EpistemicStatus;
  source: string;
  timestamp: string | null;
  fresh: boolean;
  stale: boolean;
  missing: boolean;
  /** True only for fresh evidence that is allowed to support the read. */
  driver: boolean;
  value?: number | string | null;
  unit?: string | null;
}

export type InvalidationRule =
  | "completed_close_below"
  | "completed_close_above"
  | "completed_close_outside"
  | "none";

export interface ThesisScenario {
  id: "bull" | "base" | "bear";
  title: string;
  narrative: string;
  evidenceIds: string[];
  assumptions: string[];
  confidence: QualitativeConfidence;
  invalidation: string;
  invalidationMeasurable: boolean;
  invalidationRule: InvalidationRule;
  invalidationLevel: number | null;
  invalidationUpper: number | null;
}

export interface ThesisGap {
  field: string;
  reason: string;
  citedAsDriver: false;
}

export interface ThesisReferenceLevels {
  sessions: number | null;
  low: number | null;
  high: number | null;
  latestCompletedClose: number | null;
}

export interface PentagonalThesis {
  engineVersion: typeof PENTAGONAL_THESIS_ENGINE_VERSION;
  symbol: string;
  scope: ThesisScope;
  generatedAt: string;
  headline: string;
  sections: {
    happening: ThesisSection;
    why: ThesisSection;
    next: ThesisSection & { scenarios: ThesisScenario[] };
    watch: ThesisSection;
    do: ThesisSection;
  };
  items: ThesisEvidenceItem[];
  gaps: ThesisGap[];
  referenceLevels: ThesisReferenceLevels;
  pressureIncluded: boolean;
  regimeIncluded: boolean;
  integrity: { ok: boolean; violations: string[] };
  persistence?: ThesisPersistenceStatus;
}

export interface ThesisSection {
  id: ThesisSectionId;
  title: string;
  summary: string;
  itemIds: string[];
}

export interface ThesisPersistenceStatus {
  written: boolean;
  reason: string;
  recordId?: string;
  thesisVersion?: number;
  supersedesRecordId?: string | null;
}

export interface ThesisRecordPlan {
  recordId: string;
  scopeKind: ThesisScope;
  symbol: string;
  thesisVersion: number;
  supersedesRecordId: string | null;
  engineVersion: typeof PENTAGONAL_THESIS_ENGINE_VERSION;
  contentHash: string;
  payloadJson: string;
  generatedAt: string;
  outcomeStatus: "UNSCORED";
}

const SECTION_TITLES: Record<ThesisSectionId, string> = {
  happening: "What's happening",
  why: "Why",
  next: "What's next",
  watch: "What to watch",
  do: "What to do",
};

const BANNED_LANGUAGE: Array<[RegExp, string]> = [
  [/\bprobabilit/i, "probability language"],
  [/\bcrash probability\b/i, "crisis probability language"],
  [/\b\d+(?:\.\d+)?\s*%\s*(?:chance|odds|confidence)\b/i, "numeric chance language"],
  [/\b(?:chance|odds)\b[^.]{0,40}\b\d+(?:\.\d+)?\s*%/i, "numeric chance language"],
  [/\bhistorical accuracy\b/i, "historical accuracy claim"],
  [/\bpredictive accuracy\b/i, "predictive accuracy claim"],
  [/\bearly[- ]warning\b/i, "early-warning claim"],
  [/\bweight optimization\b/i, "weight-optimization claim"],
  [/\bbackfill(?:ed)?\b/i, "backfill claim"],
  [/\byou should (?:buy|sell)\b/i, "unsupported trade instruction"],
  [/\b(?:recommend|recommending)\s+(?:a\s+)?(?:buy|sell)\b/i, "unsupported trade instruction"],
  [/\baction:\s*(?:buy|sell)\b/i, "unsupported trade instruction"],
];

export function finiteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

export function formatObservedNumber(value: number, digits: number): string {
  if (!finiteNumber(value)) throw new Error("Refusing to format a non-finite observation.");
  return value.toFixed(digits);
}

function formatPrice(value: number): string {
  return `$${formatObservedNumber(value, 2)}`;
}

function formatSignedPercent(value: number): string {
  const sign = value > 0 ? "+" : "";
  return `${sign}${formatObservedNumber(value, 2)}%`;
}

export function normalizeThesisSymbol(symbol: string): string | null {
  const upper = symbol.trim().toUpperCase();
  if (!/^[A-Z][A-Z0-9.-]{0,9}$/.test(upper)) return null;
  return upper;
}

function ageMs(timestamp: string | null, now: string): number | null {
  if (!timestamp) return null;
  const observed = Date.parse(timestamp);
  const generated = Date.parse(now);
  if (!Number.isFinite(observed) || !Number.isFinite(generated)) return null;
  return generated - observed;
}

function isFresh(timestamp: string | null, now: string, limitMs: number): boolean {
  const age = ageMs(timestamp, now);
  return age != null && age >= 0 && age <= limitMs;
}

function quoteTimestamp(quote: QuoteObservation | null): string | null {
  if (!quote) return null;
  return quote.observedAt ?? quote.fetchedAt;
}

interface BarStats {
  freshBars: CompletedBar[];
  stale: boolean;
  latest: CompletedBar | null;
  momentum: { percent: number; sessions: number } | null;
  volatility: { dailyStdevPercent: number; returns: number } | null;
  range: { low: number; high: number; sessions: number } | null;
  averageVolume: { value: number; sessions: number } | null;
}

function usableBars(bars: CompletedBar[], now: string): BarStats {
  const parsed = bars
    .filter(bar => finiteNumber(bar.high) && finiteNumber(bar.low) && finiteNumber(bar.close) && bar.high >= bar.low && bar.close > 0)
    .map(bar => ({ ...bar, volume: finiteNumber(bar.volume) ? bar.volume : null, time: Date.parse(bar.timestamp) }))
    .filter(bar => Number.isFinite(bar.time))
    .sort((a, b) => a.time - b.time);

  const latest = parsed.at(-1) ?? null;
  const freshEnough = latest != null && isFresh(new Date(latest.time).toISOString(), now, BAR_FRESH_MS);
  const freshBars = freshEnough ? parsed.map(({ time: _time, ...bar }) => bar) : [];
  const stale = parsed.length > 0 && !freshEnough;

  let momentum: BarStats["momentum"] = null;
  if (freshBars.length >= 6) {
    const last = freshBars[freshBars.length - 1]!.close;
    const prior = freshBars[freshBars.length - 6]!.close;
    if (prior > 0) momentum = { percent: ((last - prior) / prior) * 100, sessions: 5 };
  }

  const returns: number[] = [];
  const window = freshBars.slice(-21);
  for (let i = 1; i < window.length; i += 1) {
    const previous = window[i - 1]!.close;
    const current = window[i]!.close;
    if (previous > 0) returns.push((current - previous) / previous);
  }
  let volatility: BarStats["volatility"] = null;
  if (returns.length >= 5) {
    const mean = returns.reduce((sum, value) => sum + value, 0) / returns.length;
    const variance = returns.reduce((sum, value) => sum + (value - mean) ** 2, 0) / (returns.length - 1);
    volatility = { dailyStdevPercent: Math.sqrt(variance) * 100, returns: returns.length };
  }

  let range: BarStats["range"] = null;
  if (freshBars.length >= 20) {
    const sample = freshBars.slice(-20);
    range = {
      low: Math.min(...sample.map(bar => bar.low)),
      high: Math.max(...sample.map(bar => bar.high)),
      sessions: sample.length,
    };
  }

  const volumeSample = freshBars.slice(-20).map(bar => bar.volume).filter(finiteNumber);
  const averageVolume = volumeSample.length >= 20
    ? { value: volumeSample.reduce((sum, value) => sum + value, 0) / volumeSample.length, sessions: volumeSample.length }
    : null;

  return { freshBars, stale, latest: freshBars.at(-1) ?? null, momentum, volatility, range, averageVolume };
}

function item(partial: ThesisEvidenceItem): ThesisEvidenceItem {
  return partial;
}

function gap(field: string, reason: string): ThesisGap {
  return { field, reason, citedAsDriver: false };
}

function section(id: ThesisSectionId, summary: string, itemIds: string[]): ThesisSection {
  return { id, title: SECTION_TITLES[id], summary, itemIds };
}

export function thesisStatements(thesis: Pick<PentagonalThesis, "headline" | "sections" | "items" | "gaps">): string[] {
  const scenarioText = thesis.sections.next.scenarios.flatMap(scenario => [
    scenario.title,
    scenario.narrative,
    scenario.invalidation,
    ...scenario.assumptions,
  ]);
  return [
    thesis.headline,
    ...Object.values(thesis.sections).map(part => part.summary),
    ...thesis.items.map(entry => entry.statement),
    ...thesis.gaps.map(entry => entry.reason),
    ...scenarioText,
  ];
}

export function findThesisIntegrityViolations(thesis: PentagonalThesis): string[] {
  const violations: string[] = [];
  for (const text of thesisStatements(thesis)) {
    for (const [pattern, label] of BANNED_LANGUAGE) {
      if (pattern.test(text)) violations.push(label);
    }
  }
  for (const entry of thesis.items) {
    if (!entry.source.trim()) violations.push(`missing source on ${entry.id}`);
    if (entry.driver && (entry.stale || entry.missing || !entry.fresh)) violations.push(`stale or missing driver ${entry.id}`);
    if (entry.driver && entry.epistemic === "unavailable") violations.push(`unavailable driver ${entry.id}`);
  }
  for (const entry of thesis.gaps) {
    if (entry.citedAsDriver) violations.push(`gap cited as driver: ${entry.field}`);
  }
  const driverIds = new Set(thesis.items.filter(entry => entry.driver).map(entry => entry.id));
  for (const scenario of thesis.sections.next.scenarios) {
    if (scenario.confidence !== "insufficient" && scenario.evidenceIds.some(id => !driverIds.has(id))) {
      violations.push(`scenario ${scenario.id} cites evidence that is not a driver`);
    }
    if (scenario.invalidationMeasurable && scenario.invalidationRule === "none") {
      violations.push(`scenario ${scenario.id} claims a measurable invalidation without a rule`);
    }
  }
  if (thesis.pressureIncluded && !thesis.items.some(entry => entry.id === "happening:pressure" && entry.driver)) {
    violations.push("pressure marked included without a fresh driver");
  }
  if (thesis.regimeIncluded && !thesis.items.some(entry => entry.id === "happening:regime" && entry.driver)) {
    violations.push("regime marked included without a fresh driver");
  }
  return Array.from(new Set(violations));
}

export function scenarioIsInvalidated(scenario: ThesisScenario, close: number | null): boolean | null {
  if (!scenario.invalidationMeasurable || !finiteNumber(close)) return null;
  if (scenario.invalidationRule === "completed_close_below" && finiteNumber(scenario.invalidationLevel)) {
    return close < scenario.invalidationLevel;
  }
  if (scenario.invalidationRule === "completed_close_above" && finiteNumber(scenario.invalidationLevel)) {
    return close > scenario.invalidationLevel;
  }
  if (
    scenario.invalidationRule === "completed_close_outside"
    && finiteNumber(scenario.invalidationLevel)
    && finiteNumber(scenario.invalidationUpper)
  ) {
    return close < scenario.invalidationLevel || close > scenario.invalidationUpper;
  }
  return null;
}

function withheldThesis(symbol: string, generatedAt: string, reason: string): PentagonalThesis {
  const unavailable = item({
    id: "happening:unavailable",
    section: "happening",
    statement: reason,
    kind: "fact",
    epistemic: "unavailable",
    source: "pentagonal-thesis-engine",
    timestamp: generatedAt,
    fresh: false,
    stale: false,
    missing: true,
    driver: false,
  });
  const thesis: PentagonalThesis = {
    engineVersion: PENTAGONAL_THESIS_ENGINE_VERSION,
    symbol,
    scope: "stock",
    generatedAt,
    headline: "A stock thesis cannot be built from the symbol that was supplied.",
    sections: {
      happening: section("happening", reason, [unavailable.id]),
      why: section("why", "No verified cause is available.", []),
      next: {
        ...section("next", "Bull, base, and bear paths are not sketched.", []),
        scenarios: (["bull", "base", "bear"] as const).map(id => ({
          id,
          title: id === "bull" ? "Constructive path" : id === "base" ? "Range path" : "Weaker path",
          narrative: "This path is not sketched because the symbol is not usable.",
          evidenceIds: [],
          assumptions: ["No observation was accepted."],
          confidence: "insufficient",
          invalidation: "No measurable invalidation line is available.",
          invalidationMeasurable: false,
          invalidationRule: "none",
          invalidationLevel: null,
          invalidationUpper: null,
        })),
      },
      watch: section("watch", "Nothing is placed on the watch list until a usable symbol is supplied.", []),
      do: section("do", "No conditional next step is offered. This is not a recommendation to buy, sell, or size a position.", []),
    },
    items: [unavailable],
    gaps: [gap("symbol", reason)],
    referenceLevels: { sessions: null, low: null, high: null, latestCompletedClose: null },
    pressureIncluded: false,
    regimeIncluded: false,
    integrity: { ok: true, violations: [] },
  };
  thesis.integrity = { ok: true, violations: findThesisIntegrityViolations(thesis) };
  thesis.integrity.ok = thesis.integrity.violations.length === 0;
  return thesis;
}

export function buildPentagonalThesis(input: PentagonalThesisInput): PentagonalThesis {
  const symbol = normalizeThesisSymbol(input.symbol);
  if (!symbol || !Number.isFinite(Date.parse(input.generatedAt))) {
    return withheldThesis(input.symbol.trim().toUpperCase() || "UNKNOWN", input.generatedAt || new Date(0).toISOString(), "The symbol or generation time was missing, so no stock read was produced.");
  }

  const now = input.generatedAt;
  const items: ThesisEvidenceItem[] = [];
  const gaps: ThesisGap[] = [
    gap("insider", "Insider filings are not used. Synthetic Form-4 data is excluded and is not a driver."),
    gap("macro-calendar", "No macro-release calendar is connected for this symbol, so no release is cited as a driver."),
    gap("plato", "PLATO is not asked to explain causes and is not a source for this thesis."),
    gap("session-rank", "This read does not infer a session winner or loser rank. A rank is included only when a screener observation is supplied."),
  ];

  const quoteTime = quoteTimestamp(input.quote);
  const quoteFresh = input.quote != null && isFresh(quoteTime, now, QUOTE_FRESH_MS) && finiteNumber(input.quote.price);
  if (!input.quote || !finiteNumber(input.quote.price)) {
    gaps.push(gap("price", "No current price was supplied. Price is not cited as a driver."));
  } else if (!quoteFresh) {
    gaps.push(gap("price", "The price observation is missing a usable timestamp or is older than the freshness window. It is not cited as a driver."));
  }

  const bars = usableBars(input.bars, now);
  if (bars.stale) gaps.push(gap("bars", "Completed daily bars are present but stale. They are not cited as drivers."));
  if (!bars.latest) gaps.push(gap("bars", "No fresh completed daily bars were supplied, so momentum, volatility, and technical levels are not cited as drivers."));

  const profileTime = input.profile?.observedAt ?? null;
  const profileFresh = input.profile != null && isFresh(profileTime, now, PROFILE_FRESH_MS);
  if (!input.profile || !profileFresh) {
    gaps.push(gap("profile", "No fresh company profile was supplied. Sector and fundamentals are not cited as drivers."));
  } else {
    if (!input.profile.sector) gaps.push(gap("sector", "The company profile did not include a sector. Sector is not cited as a driver."));
    if (!finiteNumber(input.profile.marketCap) && !finiteNumber(input.profile.trailingPe)) {
      gaps.push(gap("fundamentals", "The company profile did not include market cap or trailing earnings multiple. Fundamentals are not cited as drivers."));
    }
    if (!input.profile.earningsDate) gaps.push(gap("earnings", "No earnings date was supplied. Earnings are not cited as a driver."));
  }

  const marketFresh = input.market != null
    && input.market.usable
    && isFresh(input.market.observedAt, now, MARKET_FRESH_MS);
  const pressureOk = marketFresh && finiteNumber(input.market?.pressureIndex);
  const regimeOk = marketFresh && typeof input.market?.regime === "string" && input.market.regime.trim().length > 0;
  if (!pressureOk) gaps.push(gap("pressure", "A fresh canonical Pressure Index reading was not usable. Pressure is not cited as a driver."));
  if (!regimeOk) gaps.push(gap("regime", "A fresh canonical regime label was not usable. Regime is not cited as a driver."));

  if (quoteFresh && input.quote) {
    const delayed = input.quote.delayed ? " The quote is delayed." : "";
    const timeNote = input.quote.observedAt ? "" : " The provider did not supply an observation time, so the timestamp is the fetch time.";
    items.push(item({
      id: "happening:price",
      section: "happening",
      statement: `${symbol} was last observed at ${formatPrice(input.quote.price!)}.${delayed}${timeNote}`,
      kind: "fact",
      epistemic: "verified",
      source: input.quote.source,
      timestamp: quoteTime,
      fresh: true,
      stale: false,
      missing: false,
      driver: true,
      value: input.quote.price,
      unit: "USD",
    }));
    if (finiteNumber(input.quote.previousClose) && input.quote.previousClose > 0) {
      const change = ((input.quote.price! - input.quote.previousClose) / input.quote.previousClose) * 100;
      items.push(item({
        id: "happening:session-change",
        section: "happening",
        statement: `Versus the reported prior close of ${formatPrice(input.quote.previousClose)}, the observed price is ${formatSignedPercent(change)}.`,
        kind: "inference",
        epistemic: "verified",
        source: input.quote.source,
        timestamp: quoteTime,
        fresh: true,
        stale: false,
        missing: false,
        driver: true,
        value: change,
        unit: "percent",
      }));
    } else if (finiteNumber(input.quote.changePercent)) {
      items.push(item({
        id: "happening:session-change",
        section: "happening",
        statement: `The provider reported a session change of ${formatSignedPercent(input.quote.changePercent)} and did not supply a prior close in this read.`,
        kind: "fact",
        epistemic: "verified",
        source: input.quote.source,
        timestamp: quoteTime,
        fresh: true,
        stale: false,
        missing: false,
        driver: true,
        value: input.quote.changePercent,
        unit: "percent",
      }));
    } else {
      gaps.push(gap("session-change", "A prior close was not supplied, so the session change is not cited as a driver."));
    }
    if (finiteNumber(input.quote.volume)) {
      items.push(item({
        id: "happening:volume",
        section: "happening",
        statement: `Reported volume is ${formatObservedNumber(input.quote.volume, 0)} shares.`,
        kind: "fact",
        epistemic: "verified",
        source: input.quote.source,
        timestamp: quoteTime,
        fresh: true,
        stale: false,
        missing: false,
        driver: true,
        value: input.quote.volume,
        unit: "shares",
      }));
    } else {
      gaps.push(gap("volume", "Volume was not supplied with the quote. Volume is not cited as a driver."));
    }
  }

  if (bars.latest) {
    items.push(item({
      id: "happening:last-close",
      section: "happening",
      statement: `The latest completed daily close is ${formatPrice(bars.latest.close)}.`,
      kind: "fact",
      epistemic: "verified",
      source: "completed-daily-bars",
      timestamp: bars.latest.timestamp,
      fresh: true,
      stale: false,
      missing: false,
      driver: true,
      value: bars.latest.close,
      unit: "USD",
    }));
  }
  if (bars.momentum) {
    items.push(item({
      id: "happening:momentum",
      section: "happening",
      statement: `Across the last ${bars.momentum.sessions} completed sessions, the close changed ${formatSignedPercent(bars.momentum.percent)}.`,
      kind: "inference",
      epistemic: "verified",
      source: "completed-daily-bars",
      timestamp: bars.latest?.timestamp ?? null,
      fresh: true,
      stale: false,
      missing: false,
      driver: true,
      value: bars.momentum.percent,
      unit: "percent",
    }));
  } else if (bars.latest) {
    gaps.push(gap("momentum", "Fewer than six fresh completed sessions are available, so momentum is not cited as a driver."));
  }
  if (bars.volatility) {
    items.push(item({
      id: "happening:volatility",
      section: "happening",
      statement: `The sample standard deviation of ${bars.volatility.returns} close-to-close returns is ${formatObservedNumber(bars.volatility.dailyStdevPercent, 2)} percentage points. This is not an annualized figure.`,
      kind: "inference",
      epistemic: "verified",
      source: "completed-daily-bars",
      timestamp: bars.latest?.timestamp ?? null,
      fresh: true,
      stale: false,
      missing: false,
      driver: true,
      value: bars.volatility.dailyStdevPercent,
      unit: "daily_return_percent",
    }));
  } else if (bars.latest) {
    gaps.push(gap("volatility", "Not enough fresh close-to-close returns were available, so volatility is not cited as a driver."));
  }
  if (bars.range && bars.latest) {
    items.push(item({
      id: "happening:range",
      section: "happening",
      statement: `The last ${bars.range.sessions} completed sessions traded between ${formatPrice(bars.range.low)} and ${formatPrice(bars.range.high)}.`,
      kind: "inference",
      epistemic: "verified",
      source: "completed-daily-bars",
      timestamp: bars.latest.timestamp,
      fresh: true,
      stale: false,
      missing: false,
      driver: true,
      value: bars.range.low,
      unit: "USD",
    }));
  } else if (bars.latest) {
    gaps.push(gap("technical-levels", "Fewer than 20 fresh completed sessions are available, so no technical level is cited as a driver."));
  }
  if (quoteFresh && input.quote && finiteNumber(input.quote.volume) && bars.averageVolume) {
    const ratio = input.quote.volume / bars.averageVolume.value;
    items.push(item({
      id: "happening:volume-vs-average",
      section: "happening",
      statement: `Reported volume is ${formatObservedNumber(ratio, 2)} times the average volume of the last ${bars.averageVolume.sessions} completed sessions.`,
      kind: "inference",
      epistemic: "verified",
      source: input.quote.source,
      timestamp: quoteTime,
      fresh: true,
      stale: false,
      missing: false,
      driver: true,
      value: ratio,
      unit: "multiple",
    }));
  }

  if (profileFresh && input.profile?.sector) {
    items.push(item({
      id: "happening:sector",
      section: "happening",
      statement: `The quote profile classifies ${symbol} in ${input.profile.sector}${input.profile.industry ? `, ${input.profile.industry}` : ""}. That is a classification, not a sector-rotation call.`,
      kind: "fact",
      epistemic: "verified",
      source: input.profile.source,
      timestamp: profileTime,
      fresh: true,
      stale: false,
      missing: false,
      driver: true,
      value: input.profile.sector,
      unit: null,
    }));
  }
  if (profileFresh && finiteNumber(input.profile?.marketCap)) {
    items.push(item({
      id: "happening:market-cap",
      section: "happening",
      statement: `The quote profile reports market cap of ${formatObservedNumber(input.profile!.marketCap!, 0)}.`,
      kind: "fact",
      epistemic: "verified",
      source: input.profile!.source,
      timestamp: profileTime,
      fresh: true,
      stale: false,
      missing: false,
      driver: true,
      value: input.profile!.marketCap,
      unit: "USD",
    }));
  }
  if (profileFresh && finiteNumber(input.profile?.trailingPe)) {
    items.push(item({
      id: "happening:trailing-pe",
      section: "happening",
      statement: `The quote profile reports a trailing earnings multiple of ${formatObservedNumber(input.profile!.trailingPe!, 2)}.`,
      kind: "fact",
      epistemic: "verified",
      source: input.profile!.source,
      timestamp: profileTime,
      fresh: true,
      stale: false,
      missing: false,
      driver: true,
      value: input.profile!.trailingPe,
      unit: "multiple",
    }));
  }
  if (pressureOk && input.market) {
    items.push(item({
      id: "happening:pressure",
      section: "happening",
      statement: `The canonical Pressure Index is ${formatObservedNumber(input.market.pressureIndex!, 0)} on its 0–100 scale. This is market context, not proof that the index caused the stock move.`,
      kind: "fact",
      epistemic: "verified",
      source: input.market.source,
      timestamp: input.market.observedAt,
      fresh: true,
      stale: false,
      missing: false,
      driver: true,
      value: input.market.pressureIndex,
      unit: "score_0_to_100",
    }));
  }
  if (regimeOk && input.market) {
    items.push(item({
      id: "happening:regime",
      section: "happening",
      statement: `The canonical regime label is "${input.market.regime}". This is a classification, not a crisis reading and not proof of why ${symbol} moved.`,
      kind: "fact",
      epistemic: "verified",
      source: input.market.source,
      timestamp: input.market.observedAt,
      fresh: true,
      stale: false,
      missing: false,
      driver: true,
      value: input.market.regime,
      unit: null,
    }));
  }

  const rank = input.sessionRank;
  const rankFresh = rank != null && isFresh(rank.observedAt, now, QUOTE_FRESH_MS) && Number.isInteger(rank.rank) && rank.rank > 0 && rank.universeSize >= rank.rank;
  if (rank && !rankFresh) gaps.push(gap("session-rank-stale", "A session rank was supplied without a fresh timestamp or a usable rank, so it is not cited as a driver."));
  if (rankFresh && rank) {
    items.push(item({
      id: "happening:session-rank",
      section: "happening",
      statement: `A screener observation places ${symbol} at rank ${rank.rank} of ${rank.universeSize} on the ${rank.list} list.`,
      kind: "fact",
      epistemic: "verified",
      source: rank.source,
      timestamp: rank.observedAt,
      fresh: true,
      stale: false,
      missing: false,
      driver: true,
      value: rank.rank,
      unit: "rank",
    }));
  }

  const verifiedIds = items.filter(entry => entry.driver).map(entry => entry.id);
  const whyItems: ThesisEvidenceItem[] = [];
  if (verifiedIds.length === 0) {
    whyItems.push(item({
      id: "why:no-cause",
      section: "why",
      statement: "No verified cause is available. Missing and stale inputs are listed separately and are not treated as forces.",
      kind: "inference",
      epistemic: "unavailable",
      source: "pentagonal-thesis-engine",
      timestamp: now,
      fresh: false,
      stale: false,
      missing: true,
      driver: false,
    }));
  } else {
    whyItems.push(item({
      id: "why:observation-only",
      section: "why",
      statement: "The verified forces in this read are the fresh observations above. Arithmetic such as a session change or a return over completed sessions describes those observations. It does not establish a cause.",
      kind: "inference",
      epistemic: "verified",
      source: "pentagonal-thesis-engine",
      timestamp: now,
      fresh: true,
      stale: false,
      missing: false,
      driver: true,
    }));
  }
  if (pressureOk || regimeOk) {
    whyItems.push(item({
      id: "why:market-hypothesis",
      section: "why",
      statement: "Hypothesis, not a verified link: the fresh market-context label may sit in the background of this symbol. This thesis does not treat that market reading as the cause of the move.",
      kind: "inference",
      epistemic: "hypothesis",
      source: input.market?.source ?? "canonical-intelligence-state",
      timestamp: input.market?.observedAt ?? null,
      fresh: true,
      stale: false,
      missing: false,
      driver: false,
    }));
  }

  const confidence: QualitativeConfidence = bars.range && bars.momentum && quoteFresh
    ? "moderate"
    : quoteFresh || bars.latest
      ? "limited"
      : "insufficient";
  const low = bars.range?.low ?? null;
  const high = bars.range?.high ?? null;
  const latestClose = bars.latest?.close ?? null;
  const levelEvidence = ["happening:range", "happening:last-close"].filter(id => verifiedIds.includes(id));

  const scenarios: ThesisScenario[] = bars.range && latestClose != null
    ? [
        {
          id: "bull",
          title: "Constructive path",
          narrative: `A constructive path would be later completed daily closes that remain above the ${bars.range.sessions}-session low of ${formatPrice(low!)}. The latest completed close is ${formatPrice(latestClose)}.${latestClose < low! ? " That close is already below the line, so this sketch is already invalidated by the latest completed bar." : ""}`,
          evidenceIds: levelEvidence,
          assumptions: ["The last 20 completed sessions remain the reference range.", "No earnings date, macro release, or company catalyst is assumed."],
          confidence,
          invalidation: `Invalidated by a completed daily close below ${formatPrice(low!)}.`,
          invalidationMeasurable: true,
          invalidationRule: "completed_close_below",
          invalidationLevel: low,
          invalidationUpper: null,
        },
        {
          id: "base",
          title: "Range path",
          narrative: `A range path would be later completed daily closes that stay between ${formatPrice(low!)} and ${formatPrice(high!)}.`,
          evidenceIds: levelEvidence,
          assumptions: ["The high and low are the extremes of the last 20 completed sessions, not a forecast target."],
          confidence,
          invalidation: `Invalidated by a completed daily close below ${formatPrice(low!)} or above ${formatPrice(high!)}.`,
          invalidationMeasurable: true,
          invalidationRule: "completed_close_outside",
          invalidationLevel: low,
          invalidationUpper: high,
        },
        {
          id: "bear",
          title: "Weaker path",
          narrative: `A weaker path would be later completed daily closes that fall through ${formatPrice(low!)}. A push through ${formatPrice(high!)} would cut against that sketch.`,
          evidenceIds: levelEvidence,
          assumptions: ["The weaker path is a sketch of the range, not a forecast that the low will break."],
          confidence,
          invalidation: `Invalidated by a completed daily close above ${formatPrice(high!)}.`,
          invalidationMeasurable: true,
          invalidationRule: "completed_close_above",
          invalidationLevel: high,
          invalidationUpper: null,
        },
      ]
    : (["bull", "base", "bear"] as const).map(id => ({
        id,
        title: id === "bull" ? "Constructive path" : id === "base" ? "Range path" : "Weaker path",
        narrative: "This path is not sketched. A fresh 20-session range is not available, so no price line is invented.",
        evidenceIds: [],
        assumptions: ["Missing range data is not filled in."],
        confidence: "insufficient" as const,
        invalidation: "No measurable invalidation line is available.",
        invalidationMeasurable: false,
        invalidationRule: "none" as const,
        invalidationLevel: null,
        invalidationUpper: null,
      }));

  const nextItems: ThesisEvidenceItem[] = scenarios.map(scenario => item({
    id: `next:${scenario.id}`,
    section: "next",
    statement: `${scenario.narrative} ${scenario.invalidation}`,
    kind: "forecast",
    epistemic: scenario.confidence === "insufficient" ? "unavailable" : "hypothesis",
    source: scenario.invalidationMeasurable ? "completed-daily-bars" : "pentagonal-thesis-engine",
    timestamp: bars.latest?.timestamp ?? now,
    fresh: scenario.invalidationMeasurable,
    stale: false,
    missing: !scenario.invalidationMeasurable,
    driver: false,
  }));

  const watchItems: ThesisEvidenceItem[] = [];
  if (bars.range) {
    watchItems.push(item({
      id: "watch:levels",
      section: "watch",
      statement: `Watch a completed daily close below ${formatPrice(low!)} or above ${formatPrice(high!)}. Those are the edges of the last ${bars.range.sessions} completed sessions.`,
      kind: "inference",
      epistemic: "verified",
      source: "completed-daily-bars",
      timestamp: bars.latest?.timestamp ?? null,
      fresh: true,
      stale: false,
      missing: false,
      driver: true,
    }));
  } else {
    watchItems.push(item({
      id: "watch:levels-missing",
      section: "watch",
      statement: "No technical level is on watch, because a fresh 20-session range was not available.",
      kind: "fact",
      epistemic: "unavailable",
      source: "pentagonal-thesis-engine",
      timestamp: now,
      fresh: false,
      stale: false,
      missing: true,
      driver: false,
    }));
  }
  if (profileFresh && input.profile?.earningsDate && Number.isFinite(Date.parse(input.profile.earningsDate))) {
    watchItems.push(item({
      id: "watch:earnings",
      section: "watch",
      statement: `The quote profile supplies an earnings timestamp of ${input.profile.earningsDate}. Confirm it with the company before treating it as a catalyst.`,
      kind: "fact",
      epistemic: "verified",
      source: input.profile.source,
      timestamp: profileTime,
      fresh: true,
      stale: false,
      missing: false,
      driver: true,
      value: input.profile.earningsDate,
    }));
  } else {
    watchItems.push(item({
      id: "watch:earnings-missing",
      section: "watch",
      statement: "No earnings date is on watch.",
      kind: "fact",
      epistemic: "unavailable",
      source: "pentagonal-thesis-engine",
      timestamp: now,
      fresh: false,
      stale: false,
      missing: true,
      driver: false,
    }));
  }
  watchItems.push(item({
    id: "watch:macro-missing",
    section: "watch",
    statement: "No macro release is on watch for this symbol.",
    kind: "fact",
    epistemic: "unavailable",
    source: "pentagonal-thesis-engine",
    timestamp: now,
    fresh: false,
    stale: false,
    missing: true,
    driver: false,
  }));

  const doSummary = bars.range
    ? `If you already have a plan, the measurable lines in this read are ${formatPrice(low!)} and ${formatPrice(high!)} on a completed daily close. FAULTLINE is not telling you to enter or exit.`
    : "There is not enough fresh range evidence to describe a conditional price line. Do not treat missing inputs as a reason to act.";
  const doItem = item({
    id: "do:conditional",
    section: "do",
    statement: `${doSummary} This is not a recommendation to buy, sell, or size a position.`,
    kind: "forecast",
    epistemic: bars.range ? "hypothesis" : "unavailable",
    source: "pentagonal-thesis-engine",
    timestamp: now,
    fresh: Boolean(bars.range),
    stale: false,
    missing: !bars.range,
    driver: false,
  });

  const allItems = [...items, ...whyItems, ...nextItems, ...watchItems, doItem];
  const happeningIds = items.map(entry => entry.id);
  const happeningSummary = happeningIds.length
    ? `Here is what can be said from fresh observations for ${symbol}. Anything missing or stale is listed under gaps and is not used as a driver.`
    : `Fresh observations for ${symbol} are not available. Missing inputs are not used as drivers.`;

  const thesis: PentagonalThesis = {
    engineVersion: PENTAGONAL_THESIS_ENGINE_VERSION,
    symbol,
    scope: input.scope ?? "stock",
    generatedAt: now,
    headline: quoteFresh && input.quote
      ? `${symbol} has a fresh price observation. The rest of this read uses only the evidence that is actually present.`
      : `${symbol} does not have a fresh price observation. This read does not fill the gap.`,
    sections: {
      happening: section("happening", happeningSummary, happeningIds),
      why: section("why", whyItems[0]?.statement ?? "No verified cause is available.", whyItems.map(entry => entry.id)),
      next: {
        ...section("next", bars.range
          ? "Three sketches — constructive, range, and weaker — use the same completed-session range. None of them is ranked ahead of the others."
          : "Bull, base, and bear paths are withheld because a fresh 20-session range is not available.", nextItems.map(entry => entry.id)),
        scenarios,
      },
      watch: section("watch", "Watch only the levels, dates, and gaps that this read actually has.", watchItems.map(entry => entry.id)),
      do: section("do", doItem.statement, [doItem.id]),
    },
    items: allItems,
    gaps,
    referenceLevels: {
      sessions: bars.range?.sessions ?? null,
      low,
      high,
      latestCompletedClose: latestClose,
    },
    pressureIncluded: pressureOk,
    regimeIncluded: regimeOk,
    integrity: { ok: true, violations: [] },
  };
  const violations = findThesisIntegrityViolations(thesis);
  thesis.integrity = { ok: violations.length === 0, violations };
  return thesis;
}

/** Future outcome scoring is a hook only. It must not rewrite a recorded forecast. */
export function scoreThesisOutcome(): never {
  throw new Error("Pentagonal thesis outcome scoring is a future hook only. Forecasts are not rewritten and no accuracy claim is recorded.");
}

export function stableThesisPayload(thesis: PentagonalThesis): string {
  const { persistence: _persistence, integrity: _integrity, ...body } = thesis;
  return JSON.stringify(body);
}

export function nextThesisRecord(
  prior: { recordId: string; thesisVersion: number; payloadJson: string } | null,
  thesis: PentagonalThesis,
  recordId: string,
  contentHash: string,
): ThesisRecordPlan {
  return {
    recordId,
    scopeKind: thesis.scope,
    symbol: thesis.symbol,
    thesisVersion: (prior?.thesisVersion ?? 0) + 1,
    supersedesRecordId: prior?.recordId ?? null,
    engineVersion: thesis.engineVersion,
    contentHash,
    payloadJson: stableThesisPayload(thesis),
    generatedAt: thesis.generatedAt,
    outcomeStatus: "UNSCORED",
  };
}
