/**
 * FAULTLINE Sector Rotation — pure, deterministic calculations.
 *
 * Everything here is a pure function of its inputs (no I/O, no clock reads —
 * `now` is an input). The service layer (./service.ts) fetches the data and
 * calls buildSectorRotationReading(). Methodology and fixed parameters are in
 * shared/sectorRotation.ts (SECTOR_ROTATION_PARAMS) and
 * docs/sector-rotation/METHODOLOGY.md. Parameters were fixed a priori and are
 * not tuned against historical outcomes.
 *
 * Fail-closed rules:
 *  - A series with missing or misaligned completed bars is UNAVAILABLE and is
 *    not ranked; nothing is interpolated, carried forward or defaulted.
 *  - Multi-day returns, RS and breadth use completed daily bars only
 *    (session close 4 PM ET + 60 min). "Today %" during a session is labelled
 *    INTRADAY with its observation time.
 *  - A catalyst is only EVENT_DRIVEN / COMPANY_SPECIFIC with a fetched, dated,
 *    ticker-tagged news item; otherwise a computed co-move or exactly
 *    "CATALYST UNCLEAR".
 *  - All prose is templated from the computed object and validated
 *    (findUntraceableNumbers) — a sentence carrying a number the object does
 *    not contain is dropped.
 */
import {
  ACTION_LABEL, ARROW_GLYPH, BENCHMARK_TICKER, CATALYST_LABEL, CATALYST_UNCLEAR_TEXT, DEFENSIVE_SECTORS,
  QUADRANT_LABEL, SECTOR_ETFS, SECTOR_ROTATION_METHOD_VERSION, SECTOR_ROTATION_PARAMS,
  SECTOR_ROTATION_SCHEMA_VERSION,
  type CanonicalLink, type CatalystClass, type DailyChangeBasis, type DataStatus, type DriverId, type EventFamily,
  type EvidenceCheck, type LeadershipGroup, type MacroDriverReading, type MomentumArrow, type MoverRow, type NewsEvidence,
  type Quadrant, type SectorActionClass, type SectorBreadth, type SectorDriverLink, type SectorEtfTicker, type SectorRotationReading,
  type SectorRow, type ThesisAlignment, type TopMovers, type WatchIndicator,
} from "../../shared/sectorRotation";
import { PRESSURE_BANDS, pressureBand, type PressureBandRegime } from "../../shared/pressureBands";

const P = SECTOR_ROTATION_PARAMS;

// ── Inputs ────────────────────────────────────────────────────────────────────

export interface InputBar { timestamp: number; close: number; volume: number }
export interface ChartInput {
  ticker: string;
  bars: InputBar[];
  /** Provider-reported observation time (ms) of the latest price; null when not reported. */
  regularMarketTime: number | null;
  companyName?: string | null;
  error?: string | null;
}
export interface FredInput { id: string; observations: Array<{ date: string; value: string | number }>; error?: string | null }
export interface UniverseMember { ticker: string; name: string; sectorEtf: SectorEtfTicker }
export interface UniverseInput {
  status: "OK" | "UNAVAILABLE";
  name: string;
  source: string;
  /** Holdings as-of date, YYYY-MM-DD. */
  asOf: string | null;
  members: UniverseMember[];
  reason: string | null;
}
export interface NewsItemInput { id: string; title: string; publisher: string; url: string; publishedAt: string; tickers: string[] }
export interface NewsInput { status: "OK" | "UNAVAILABLE"; reason: string | null; items: NewsItemInput[] }
export interface SectorRotationInputs {
  now: number;
  canonical: CanonicalLink;
  /** Keyed by Yahoo symbol: SPY, the 11 sector ETFs, SOXX, SMH, IWM, CL=F, DX-Y.NYB, ^VIX. */
  charts: Record<string, ChartInput | undefined>;
  /** Keyed by FRED series id: DGS10, DGS2, BAMLH0A0HYM2, T10YIE, WALCL. */
  fred: Record<string, FredInput | undefined>;
  universe: UniverseInput;
  /** Keyed by Yahoo symbol of each universe member. */
  stockCharts: Record<string, ChartInput | undefined>;
  news: NewsInput;
}

// ── Time: America/New_York session helpers ───────────────────────────────────

const ET_PARTS = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
});
function etFields(ms: number) {
  const parts = Object.fromEntries(ET_PARTS.formatToParts(new Date(ms)).map(p => [p.type, p.value]));
  return { y: Number(parts.year), m: Number(parts.month), d: Number(parts.day), h: Number(parts.hour), mi: Number(parts.minute) };
}
/** YYYY-MM-DD of an instant in America/New_York. */
export function etDate(ms: number): string {
  const f = etFields(ms);
  return `${f.y}-${String(f.m).padStart(2, "0")}-${String(f.d).padStart(2, "0")}`;
}
function etOffsetMs(ms: number): number {
  const f = etFields(ms);
  const floored = Math.floor(ms / 60_000) * 60_000;
  return Date.UTC(f.y, f.m - 1, f.d, f.h, f.mi) - floored;
}
/** UTC instant of a wall-clock time in America/New_York on a YYYY-MM-DD date (DST-aware). */
export function etWallToUtc(date: string, hour: number, minute: number): number {
  const [y, m, d] = date.split("-").map(Number);
  const guess = Date.UTC(y, m - 1, d, hour, minute);
  const first = guess - etOffsetMs(guess);
  return guess - etOffsetMs(first);
}
/** Completed-bar rule: a session counts after its 4 PM ET close plus 60 minutes. */
export function sessionCompletedAt(sessionDate: string): number {
  return etWallToUtc(sessionDate, 16, 0) + P.completedBarDelayMinutes * 60_000;
}
export function isSessionComplete(sessionDate: string, now: number): boolean {
  return now >= sessionCompletedAt(sessionDate);
}
function calendarDaysBetween(a: string, b: string): number {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000);
}

export interface SessionBar { session: string; close: number; volume: number }
export interface SplitBars { completed: SessionBar[]; inProgress: SessionBar | null }

/** Map provider bars to ET sessions (last bar per session wins), split completed vs in-progress. */
export function splitBars(bars: InputBar[], now: number): SplitBars {
  const bySession = new Map<string, SessionBar>();
  for (const bar of [...bars].sort((a, b) => a.timestamp - b.timestamp)) {
    if (!Number.isFinite(bar.close) || bar.close <= 0 || !Number.isFinite(bar.timestamp)) continue;
    const session = etDate(bar.timestamp);
    bySession.set(session, { session, close: bar.close, volume: Number.isFinite(bar.volume) ? bar.volume : Number.NaN });
  }
  const ordered = Array.from(bySession.values()).sort((a, b) => a.session.localeCompare(b.session));
  const completed = ordered.filter(bar => isSessionComplete(bar.session, now));
  const last = ordered.at(-1) ?? null;
  const inProgress = last && !isSessionComplete(last.session, now) ? last : null;
  return { completed, inProgress };
}

// ── Numeric helpers ──────────────────────────────────────────────────────────

export const round2 = (x: number) => Math.round(x * 100) / 100;
const pct = (to: number, from: number) => (to / from - 1) * 100;
const mean = (xs: number[]) => xs.reduce((s, x) => s + x, 0) / xs.length;

/** n-session return over completed bars; null when fewer than n + 1 bars. */
export function completedReturn(completed: SessionBar[], n: number): number | null {
  if (completed.length < n + 1) return null;
  return round2(pct(completed[completed.length - 1].close, completed[completed.length - 1 - n].close));
}

/** First single-session move ≥ discontinuityGuardPct among the last n completed sessions, or null. */
export function findDiscontinuity(completed: SessionBar[], n: number): { session: string; pct: number } | null {
  for (let i = Math.max(1, completed.length - n); i < completed.length; i++) {
    const move = pct(completed[i].close, completed[i - 1].close);
    if (Math.abs(move) >= P.discontinuityGuardPct) return { session: completed[i].session, pct: round2(move) };
  }
  return null;
}

export interface DailyChange { pct: number; basis: DailyChangeBasis }
/** "Today %": intraday vs last completed close (labelled with as-of), else last completed session vs the one before. */
export function dailyChange(split: SplitBars, regularMarketTime: number | null): DailyChange | null {
  const { completed, inProgress } = split;
  if (inProgress && completed.length >= 1) {
    return {
      pct: round2(pct(inProgress.close, completed[completed.length - 1].close)),
      basis: { kind: "INTRADAY", asOf: regularMarketTime != null && Number.isFinite(regularMarketTime) ? new Date(regularMarketTime).toISOString() : null, sessionDate: inProgress.session },
    };
  }
  if (!inProgress && completed.length >= 2) {
    return { pct: round2(pct(completed[completed.length - 1].close, completed[completed.length - 2].close)), basis: { kind: "SESSION_CLOSE", sessionDate: completed[completed.length - 1].session } };
  }
  return null;
}

/** Volume vs normal: latest completed-session volume / mean of the prior 20 completed sessions. */
export function volumeRatio(split: SplitBars): { ratio: number | null; reason: string | null } {
  if (split.inProgress) return { ratio: null, reason: "Session in progress; partial-session volume is not compared." };
  const c = split.completed;
  if (c.length < P.volumeWindow + 1) return { ratio: null, reason: `Fewer than ${P.volumeWindow + 1} completed sessions of volume.` };
  const latest = c[c.length - 1].volume;
  const prior = c.slice(-(P.volumeWindow + 1), -1).map(bar => bar.volume);
  if (!Number.isFinite(latest) || latest <= 0 || prior.some(v => !Number.isFinite(v) || v <= 0)) return { ratio: null, reason: "Volume missing in the comparison window." };
  return { ratio: Math.round((latest / mean(prior)) * 10) / 10, reason: null };
}

// ── RRG-style relative rotation ──────────────────────────────────────────────

export const RRG_MIN_SESSIONS = P.rsRatioWindow + P.rsMomentumLookback + 1; // latest + prior reading

export function classifyQuadrant(rsRatio: number, rsMomentum: number): Quadrant {
  const c = P.quadrantCentre;
  if (rsRatio >= c && rsMomentum >= c) return "LEADING";
  if (rsRatio < c && rsMomentum >= c) return "IMPROVING";
  if (rsRatio >= c && rsMomentum < c) return "LOSING_MOMENTUM";
  return "LAGGING";
}
export function momentumArrow(rsMomentum: number): MomentumArrow {
  if (rsMomentum >= P.quadrantCentre + P.arrowBand) return "UP";
  if (rsMomentum <= P.quadrantCentre - P.arrowBand) return "DOWN";
  return "FLAT";
}

export interface RrgSeries { sessions: string[]; rsRatio: Array<number | null>; rsMomentum: Array<number | null> }
/**
 * RS_t = asset / benchmark; RS-Ratio_t = 100 × RS_t / SMA50(RS)_t;
 * RS-Momentum_t = 100 × RS-Ratio_t / RS-Ratio_(t−10). Inputs must be aligned closes.
 */
export function computeRrg(sessions: string[], asset: number[], bench: number[]): RrgSeries {
  const rs = asset.map((a, i) => a / bench[i]);
  const rsRatio: Array<number | null> = rs.map((_, i) => (i >= P.rsRatioWindow - 1 ? (100 * rs[i]) / mean(rs.slice(i - P.rsRatioWindow + 1, i + 1)) : null));
  const rsMomentum: Array<number | null> = rsRatio.map((r, i) => {
    const back = i - P.rsMomentumLookback >= 0 ? rsRatio[i - P.rsMomentumLookback] : null;
    return r != null && back != null ? (100 * r) / back : null;
  });
  return { sessions, rsRatio, rsMomentum };
}

/**
 * Align an asset's completed bars to the benchmark's completed sessions. Uses the
 * longest tail of benchmark sessions the asset fully covers; fails closed when the
 * asset's latest completed session differs from the benchmark's or the tail is short.
 */
export function alignToBenchmark(asset: SessionBar[], bench: SessionBar[], minSessions: number): { ok: true; sessions: string[]; asset: number[]; bench: number[] } | { ok: false; reason: string } {
  if (bench.length === 0) return { ok: false, reason: "Benchmark has no completed bars." };
  const map = new Map(asset.map(bar => [bar.session, bar.close]));
  const lastBench = bench[bench.length - 1].session;
  if (!map.has(lastBench)) return { ok: false, reason: `No completed bar for ${lastBench} (latest ${BENCHMARK_TICKER} session).` };
  const sessions: string[] = []; const a: number[] = []; const b: number[] = [];
  for (let i = bench.length - 1; i >= 0; i--) {
    const close = map.get(bench[i].session);
    if (close == null) break;
    sessions.unshift(bench[i].session); a.unshift(close); b.unshift(bench[i].close);
  }
  if (sessions.length < minSessions) return { ok: false, reason: `Only ${sessions.length} aligned completed sessions; ${minSessions} required.` };
  return { ok: true, sessions, asset: a, bench: b };
}

export interface RrgReading { rsRatio: number; rsMomentum: number; quadrant: Quadrant; arrow: MomentumArrow; priorRsRatio: number; priorQuadrant: Quadrant; sessionsInQuadrant: number }
export function latestRrg(series: RrgSeries): RrgReading | null {
  const t = series.sessions.length - 1;
  const r = series.rsRatio[t], m = series.rsMomentum[t], pr = series.rsRatio[t - 1], pm = series.rsMomentum[t - 1];
  if (r == null || m == null || pr == null || pm == null) return null;
  const quadrant = classifyQuadrant(r, m);
  let sessionsInQuadrant = 0;
  for (let i = t; i >= 0; i--) {
    const ri = series.rsRatio[i], mi = series.rsMomentum[i];
    if (ri == null || mi == null || classifyQuadrant(ri, mi) !== quadrant) break;
    sessionsInQuadrant++;
  }
  return { rsRatio: round2(r), rsMomentum: round2(m), quadrant, arrow: momentumArrow(m), priorRsRatio: round2(pr), priorQuadrant: classifyQuadrant(pr, pm), sessionsInQuadrant };
}

/** Rank by RS-Ratio descending (ties: ticker ascending). Returns ticker → rank (1 = strongest). */
export function rankBy(values: Array<{ ticker: string; value: number }>): Map<string, number> {
  const sorted = [...values].sort((a, b) => (b.value - a.value) || a.ticker.localeCompare(b.ticker));
  return new Map(sorted.map((v, i) => [v.ticker, i + 1]));
}

export const LEADERSHIP_GROUP_BY_QUADRANT: Record<Quadrant, LeadershipGroup> = {
  LEADING: "CURRENT_LEADERSHIP",
  IMPROVING: "EMERGING_LEADERSHIP",
  LOSING_MOMENTUM: "DETERIORATING_LEADERSHIP",
  LAGGING: "CONFIRMED_WEAKNESS",
};

// ── Breadth ──────────────────────────────────────────────────────────────────

export function sectorBreadth(members: UniverseMember[], stockSplits: Map<string, SplitBars>, benchLatest: string | null, universeOk: boolean): SectorBreadth {
  const total = members.length;
  if (!universeOk || total === 0) return { status: "UNAVAILABLE", pctAboveSma: null, counted: 0, total, reason: "Constituent universe unavailable." };
  let counted = 0, above = 0;
  for (const member of members) {
    const split = stockSplits.get(member.ticker);
    const c = split?.completed ?? [];
    if (c.length < P.breadthWindow || c[c.length - 1].session !== benchLatest || findDiscontinuity(c, P.breadthWindow - 1)) continue;
    const window = c.slice(-P.breadthWindow).map(bar => bar.close);
    counted++;
    if (c[c.length - 1].close > mean(window)) above++;
  }
  if (counted / total < P.breadthMinCoverage) {
    return { status: "UNAVAILABLE", pctAboveSma: null, counted, total, reason: `Only ${counted} of ${total} constituents have ${P.breadthWindow} aligned completed sessions.` };
  }
  return { status: "OK", pctAboveSma: Math.round((above / counted) * 1000) / 10, counted, total, reason: null };
}

// ── Formatting (shared by templates and the number validator) ────────────────

export const fmtSignedPct = (x: number) => `${x > 0 ? "+" : x < 0 ? "−" : ""}${Math.abs(x).toFixed(1)}%`;
export const fmtSignedPp = (x: number) => `${x > 0 ? "+" : x < 0 ? "−" : ""}${Math.abs(x).toFixed(1)} pp`;
export const fmtSignedBp = (x: number) => `${x > 0 ? "+" : x < 0 ? "−" : ""}${Math.abs(Math.round(x))} bp`;
const listOr = (xs: string[], none: string) => (xs.length ? xs.join(", ") : none);

// ── Action classes (mechanical rule: quadrant + evidence) ─────────────────────

export const ACTION_RULES: Record<SectorActionClass, string> = {
  OVERWEIGHT: "LEADING quadrant AND 20-session return above SPY AND breadth ≥ 50% of constituents above their 50-session average.",
  WATCH_FOR_CONFIRMATION: "IMPROVING quadrant, or LEADING without full confirmation (relative return, breadth, or breadth unavailable).",
  NEUTRAL: "LOSING MOMENTUM quadrant with 20-session return still above SPY.",
  UNDERWEIGHT: "LOSING MOMENTUM with 20-session return at or below SPY, or LAGGING without every AVOID condition.",
  AVOID: "LAGGING quadrant AND 20-session return below SPY AND breadth < 50% AND RS-Momentum falling (↓).",
};

export function classifyAction(input: { quadrant: Quadrant; relReturn20dPct: number | null; breadthPct: number | null; arrow: MomentumArrow }): { class: SectorActionClass; evidence: EvidenceCheck[] } {
  const { quadrant, relReturn20dPct: rel, breadthPct: breadth, arrow } = input;
  const relPositive = rel == null ? null : rel > 0;
  const breadthStrong = breadth == null ? null : breadth >= 50;
  const evidence: EvidenceCheck[] = [
    { id: "quadrant", label: "Rotation quadrant", observed: QUADRANT_LABEL[quadrant], passed: quadrant === "LEADING" || quadrant === "IMPROVING" },
    { id: "rel20", label: "20-session return vs SPY", observed: rel == null ? "Unavailable" : fmtSignedPp(rel), passed: relPositive },
    { id: "breadth", label: "Constituents above 50-session average", observed: breadth == null ? "Unavailable" : `${breadth.toFixed(1)}%`, passed: breadthStrong },
    { id: "momentum", label: "RS-Momentum direction", observed: ARROW_GLYPH[arrow], passed: arrow === "UP" ? true : arrow === "DOWN" ? false : null },
  ];
  let cls: SectorActionClass;
  if (quadrant === "LEADING") cls = relPositive === true && breadthStrong === true ? "OVERWEIGHT" : "WATCH_FOR_CONFIRMATION";
  else if (quadrant === "IMPROVING") cls = "WATCH_FOR_CONFIRMATION";
  else if (quadrant === "LOSING_MOMENTUM") cls = relPositive === true ? "NEUTRAL" : "UNDERWEIGHT";
  else cls = relPositive === false && breadthStrong === false && arrow === "DOWN" ? "AVOID" : "UNDERWEIGHT";
  return { class: cls, evidence };
}

// ── Macro drivers ────────────────────────────────────────────────────────────

const DRIVER_BAND = { yieldBp: 5, pricePct: 1, vixPts: 1, walclPct: 0.5, relPp: 1 } as const;
const dirOf = (change: number, band: number): "RISING" | "FALLING" | "FLAT" => (change >= band ? "RISING" : change <= -band ? "FALLING" : "FLAT");

function fredNumeric(input: FredInput | undefined): Array<{ date: string; value: number }> {
  if (!input || input.error) return [];
  return input.observations
    .map(o => ({ date: o.date, value: typeof o.value === "number" ? o.value : Number(o.value) }))
    .filter(o => /^\d{4}-\d{2}-\d{2}$/.test(o.date) && Number.isFinite(o.value))
    .sort((a, b) => a.date.localeCompare(b.date));
}
function unavailableDriver(id: DriverId, label: string, source: string, latestUnit: string, changeUnit: string, lookback: string, reason: string): MacroDriverReading {
  return { id, label, source, status: "UNAVAILABLE", latest: null, latestUnit, change: null, changeUnit, lookback, direction: null, asOf: null, reason };
}
function fredStatus(asOf: string, now: number, maxDays: number): DataStatus {
  return calendarDaysBetween(asOf, etDate(now)) > maxDays ? "STALE" : "OK";
}

export function computeDrivers(inputs: SectorRotationInputs, splits: Map<string, SplitBars>, rel20: Map<string, number | null>): MacroDriverReading[] {
  const { now, fred } = inputs;
  const out: MacroDriverReading[] = [];
  const N = P.mediumLookback;
  const fredBp = (id: DriverId, label: string, series: string, toBpLevel: boolean): MacroDriverReading => {
    const obs = fredNumeric(fred[series]);
    if (obs.length < N + 1) return unavailableDriver(id, label, `FRED ${series}`, toBpLevel ? "bp" : "%", "bp", `${N} observations`, fred[series]?.error ? `FRED ${series}: ${fred[series]?.error}` : `FRED ${series}: fewer than ${N + 1} observations.`);
    const latest = obs[obs.length - 1], base = obs[obs.length - 1 - N];
    const change = (latest.value - base.value) * 100;
    return { id, label, source: `FRED ${series}`, status: fredStatus(latest.date, now, 7), latest: toBpLevel ? Math.round(latest.value * 100) : round2(latest.value), latestUnit: toBpLevel ? "bp" : "%", change: Math.round(change), changeUnit: "bp", lookback: `${N} observations`, direction: dirOf(change, DRIVER_BAND.yieldBp), asOf: latest.date, reason: null };
  };
  out.push(fredBp("UST10Y", "10-year Treasury yield", "DGS10", false));
  // Curve: DGS10 − DGS2 on matching dates.
  {
    const d10 = new Map(fredNumeric(fred.DGS10).map(o => [o.date, o.value]));
    const both = fredNumeric(fred.DGS2).filter(o => d10.has(o.date)).map(o => ({ date: o.date, value: (d10.get(o.date)! - o.value) }));
    if (both.length < N + 1) out.push(unavailableDriver("CURVE_2S10S", "2s10s Treasury curve", "FRED DGS10 − DGS2", "bp", "bp", `${N} observations`, "FRED DGS10/DGS2: fewer than 21 matched observations."));
    else {
      const latest = both[both.length - 1], base = both[both.length - 1 - N];
      const change = (latest.value - base.value) * 100;
      out.push({ id: "CURVE_2S10S", label: "2s10s Treasury curve", source: "FRED DGS10 − DGS2", status: fredStatus(latest.date, now, 7), latest: Math.round(latest.value * 100), latestUnit: "bp", change: Math.round(change), changeUnit: "bp", lookback: `${N} observations`, direction: dirOf(change, DRIVER_BAND.yieldBp), asOf: latest.date, reason: null });
    }
  }
  out.push(fredBp("HY_SPREAD", "High-yield credit spread (OAS)", "BAMLH0A0HYM2", true));
  out.push(fredBp("BREAKEVEN_10Y", "10-year breakeven inflation", "T10YIE", false));
  // Liquidity: Fed balance sheet (weekly), 4-week change.
  {
    const obs = fredNumeric(fred.WALCL);
    if (obs.length < 5) out.push(unavailableDriver("LIQUIDITY_FED_BALANCE_SHEET", "Fed balance sheet (liquidity proxy)", "FRED WALCL", "$bn", "%", "4 weeks", fred.WALCL?.error ? `FRED WALCL: ${fred.WALCL.error}` : "FRED WALCL: fewer than 5 observations."));
    else {
      const latest = obs[obs.length - 1], base = obs[obs.length - 5];
      const change = pct(latest.value, base.value);
      out.push({ id: "LIQUIDITY_FED_BALANCE_SHEET", label: "Fed balance sheet (liquidity proxy)", source: "FRED WALCL", status: fredStatus(latest.date, now, 14), latest: Math.round(latest.value / 1000), latestUnit: "$bn", change: round2(change), changeUnit: "%", lookback: "4 weeks", direction: dirOf(change, DRIVER_BAND.walclPct), asOf: latest.date, reason: null });
    }
  }
  // Yahoo completed-bar drivers.
  const yahooDriver = (id: DriverId, label: string, symbol: string, mode: "pct" | "pts", band: number): MacroDriverReading => {
    const split = splits.get(symbol);
    const c = split?.completed ?? [];
    if (c.length < N + 1) return unavailableDriver(id, label, `Yahoo chart ${symbol}`, mode === "pct" ? "level" : "pts", mode === "pct" ? "%" : "pts", `${N} sessions`, inputs.charts[symbol]?.error ? `Yahoo ${symbol}: ${inputs.charts[symbol]?.error}` : `Yahoo ${symbol}: fewer than ${N + 1} completed sessions.`);
    const latest = c[c.length - 1], base = c[c.length - 1 - N];
    const change = mode === "pct" ? pct(latest.close, base.close) : latest.close - base.close;
    const status: DataStatus = calendarDaysBetween(latest.session, etDate(now)) > P.staleAfterCalendarDays ? "STALE" : "OK";
    return { id, label, source: `Yahoo chart ${symbol}`, status, latest: round2(latest.close), latestUnit: mode === "pct" ? "level" : "pts", change: round2(change), changeUnit: mode === "pct" ? "%" : "pts", lookback: `${N} sessions`, direction: dirOf(change, band), asOf: latest.session, reason: null };
  };
  out.push(yahooDriver("DOLLAR", "US dollar index (DXY)", "DX-Y.NYB", "pct", DRIVER_BAND.pricePct));
  out.push(yahooDriver("OIL_WTI", "WTI crude oil (front month)", "CL=F", "pct", DRIVER_BAND.pricePct));
  out.push(yahooDriver("VIX", "Equity volatility (VIX)", "^VIX", "pts", DRIVER_BAND.vixPts));
  out.push(unavailableDriver("GROWTH_EXPECTATIONS", "Growth expectations", "None in existing FAULTLINE sources", "", "", "", "No growth-expectations series is available from FAULTLINE's existing sources; not substituted."));
  const relDriver = (id: DriverId, label: string, tickers: string[], source: string): MacroDriverReading => {
    const vals = tickers.map(t => rel20.get(t) ?? null);
    if (vals.some(v => v == null)) return unavailableDriver(id, label, source, "pp vs SPY", "", `${N} sessions`, `${tickers.join(", ")} or SPY: 20-session relative return unavailable.`);
    const value = round2(mean(vals as number[]));
    const spy = splits.get(BENCHMARK_TICKER)?.completed ?? [];
    return { id, label, source, status: "OK", latest: value, latestUnit: "pp vs SPY", change: null, changeUnit: "", lookback: `${N} sessions`, direction: dirOf(value, DRIVER_BAND.relPp), asOf: spy.at(-1)?.session ?? null, reason: null };
  };
  out.push(relDriver("SEMIS_LEADERSHIP", "AI / semiconductor leadership (SOXX vs SPY)", ["SOXX"], "Yahoo chart SOXX, SPY"));
  out.push(relDriver("DEFENSIVE_POSITIONING", "Defensive positioning (XLU, XLP, XLV vs SPY)", ["XLU", "XLP", "XLV"], "Yahoo chart XLU, XLP, XLV, SPY"));
  out.push(relDriver("SMALL_CAP_PARTICIPATION", "Small-cap participation (IWM vs SPY)", ["IWM"], "Yahoo chart IWM, SPY"));
  return out;
}

/** Conventional sector ↔ driver linkages. Direction only; no fitted coefficients. */
export const SECTOR_DRIVER_LINKS: Array<{ sector: SectorEtfTicker; driver: DriverId; expectedSign: 1 | -1 }> = [
  { sector: "XLF", driver: "UST10Y", expectedSign: 1 }, { sector: "XLF", driver: "CURVE_2S10S", expectedSign: 1 }, { sector: "XLF", driver: "HY_SPREAD", expectedSign: -1 },
  { sector: "XLE", driver: "OIL_WTI", expectedSign: 1 },
  { sector: "XLK", driver: "SEMIS_LEADERSHIP", expectedSign: 1 }, { sector: "XLK", driver: "UST10Y", expectedSign: -1 },
  { sector: "XLC", driver: "SEMIS_LEADERSHIP", expectedSign: 1 },
  { sector: "XLU", driver: "UST10Y", expectedSign: -1 }, { sector: "XLU", driver: "VIX", expectedSign: 1 },
  { sector: "XLRE", driver: "UST10Y", expectedSign: -1 },
  { sector: "XLP", driver: "VIX", expectedSign: 1 }, { sector: "XLV", driver: "VIX", expectedSign: 1 },
  { sector: "XLY", driver: "SMALL_CAP_PARTICIPATION", expectedSign: 1 }, { sector: "XLY", driver: "HY_SPREAD", expectedSign: -1 },
  { sector: "XLI", driver: "CURVE_2S10S", expectedSign: 1 }, { sector: "XLI", driver: "SMALL_CAP_PARTICIPATION", expectedSign: 1 },
  { sector: "XLB", driver: "DOLLAR", expectedSign: -1 }, { sector: "XLB", driver: "BREAKEVEN_10Y", expectedSign: 1 },
];

function driverChangeText(d: MacroDriverReading): string {
  if (d.id === "SEMIS_LEADERSHIP" || d.id === "DEFENSIVE_POSITIONING" || d.id === "SMALL_CAP_PARTICIPATION") return `${d.label} ${fmtSignedPp(d.latest!)} over ${P.mediumLookback} sessions`;
  if (d.changeUnit === "bp") return `${d.label} ${fmtSignedBp(d.change!)} over ${d.lookback}`;
  if (d.changeUnit === "pts") return `${d.label} ${d.change! > 0 ? "+" : d.change! < 0 ? "−" : ""}${Math.abs(d.change!).toFixed(1)} pts over ${d.lookback}`;
  return `${d.label} ${fmtSignedPct(d.change!)} over ${d.lookback}`;
}

export function computeDriverLinks(sectors: SectorRow[], drivers: MacroDriverReading[]): SectorDriverLink[] {
  const byId = new Map(drivers.map(d => [d.id, d]));
  return SECTOR_DRIVER_LINKS.map(link => {
    const row = sectors.find(s => s.ticker === link.sector);
    const d = byId.get(link.driver);
    const base = { sector: link.sector, driver: link.driver, expectedSign: link.expectedSign };
    if (!row || row.relReturn20dPct == null || !d || d.status === "UNAVAILABLE" || d.direction == null) {
      return { ...base, observed: "UNAVAILABLE" as const, text: `${link.sector} vs ${d?.label ?? link.driver}: input unavailable.` };
    }
    const sectorDir = row.relReturn20dPct >= DRIVER_BAND.relPp ? 1 : row.relReturn20dPct <= -DRIVER_BAND.relPp ? -1 : 0;
    const driverDir = d.direction === "RISING" ? 1 : d.direction === "FALLING" ? -1 : 0;
    const sectorText = `${link.sector} ${fmtSignedPp(row.relReturn20dPct)} vs SPY over ${P.mediumLookback} sessions`;
    if (sectorDir === 0 || driverDir === 0) return { ...base, observed: "NO_CLEAR_DIRECTION" as const, text: `${sectorText}; ${driverChangeText(d)} — no clear joint direction.` };
    const consistent = sectorDir * driverDir === link.expectedSign;
    return { ...base, observed: consistent ? "CONSISTENT" as const : "DIVERGING" as const, text: `${sectorText} while ${driverChangeText(d)} — ${consistent ? "consistent with" : "diverging from"} the conventional link (observed co-movement, not established causation).` };
  });
}

// ── Catalysts (top movers) ───────────────────────────────────────────────────
//
// A news item can explain a move (EVENT-DRIVEN / COMPANY-SPECIFIC) only when ALL hold
// (`qualifyNewsItem`, every check deterministic and fixed in code):
//  1. inside the move's window (filtered by the builder) with a parseable publishedAt;
//  2. a publisher on APPROVED_NEWS_PUBLISHERS (missing publisher → rejected);
//  3. tagged with the mover and with ≤ maxNewsTickerTags tickers;
//  4. not a movers roundup / market-wrap headline (ROUNDUP_PATTERN);
//  5. the TITLE explicitly names the mover — an exchange-qualified or $/parenthesised
//     ticker, a bare ticker that is unambiguous (≥ 3 letters, not a common word), or a
//     controlled alias (see buildAliasIndex) — and the alias is not shared by another issuer;
//  6. the title names no other S&P 500 issuer (one company's results never explain a peer).
// SECTOR-DRIVEN / MACRO-DRIVEN are price co-move classifications and never carry a headline.

/** Title keyword families, checked in this priority order. Specific phrases only (no bare "profit", "results", "revenue", "EPS", "SEC", "outlook"). */
export const EVENT_FAMILY_PATTERNS: Array<{ family: EventFamily; label: string; pattern: RegExp }> = [
  { family: "EARNINGS", label: "Earnings / results", pattern: /\b(earnings|quarterly (?:results|profit|revenue|sales)|(?:first|second|third|fourth)[- ]quarter (?:results|earnings|profit|revenue|sales|loss)|q[1-4] (?:results|earnings|revenue|sales|profit|loss)|(?:beats?|miss(?:es)?|tops?) (?:\w+ )?(?:estimates|expectations|forecasts|consensus))\b/i },
  { family: "GUIDANCE", label: "Guidance", pattern: /\b(guidance|(?:raises|lifts|boosts|cuts|lowers|trims|reaffirms|reiterates|withdraws) (?:its |full-year |annual |\w+ )?(?:outlook|forecast|guidance)|(?:full-year|annual|fy ?\d{0,4}) (?:outlook|forecast))\b/i },
  { family: "M_AND_A", label: "M&A", pattern: /\b(acquires?|acquired|acquisition|merger|merge|buyout|takeover|to be acquired|agrees? to buy|tender offer)\b/i },
  { family: "REGULATORY", label: "Regulatory", pattern: /\b(fda|ftc|doj|antitrust|regulators?|regulatory|recall|sec (?:probe|investigation|charges|settlement|subpoena|lawsuit)|(?:fda|regulatory) approval|approves? (?:its|the) (?:drug|device|merger|deal))\b/i },
  { family: "ANALYST_ACTION", label: "Analyst action", pattern: /\b(upgrades?|upgraded|downgrades?|downgraded|price target|initiates? coverage|(?:reiterates?|maintains?) (?:buy|sell|hold|outperform|underperform|overweight|underweight|neutral)|outperform|underperform)\b/i },
];

/** Controlled publisher allowlist (normalised: lowercase, letters/digits only, trailing "inc" removed). Newswires carry the company's own statement; the rest are news desks. Opinion / promotional outlets are not on it. */
export const APPROVED_NEWS_PUBLISHERS: readonly string[] = ["benzinga", "globenewswire", "prnewswire", "businesswire", "accesswire", "reuters", "marketwatch", "cnbc", "investingcom", "barrons", "thewallstreetjournal", "bloomberg"];
export const normalizePublisher = (name: string | null | undefined) => (name ?? "").toLowerCase().replace(/[^a-z0-9]/g, "").replace(/inc$/, "");
export const isApprovedPublisher = (name: string | null | undefined) => { const n = normalizePublisher(name); return n.length > 0 && APPROVED_NEWS_PUBLISHERS.includes(n); };

/** Movers roundups and market wraps never explain a single stock, even when they name it. */
export const ROUNDUP_PATTERN = /\b(biggest (?:movers|moves|gainers|losers)|stocks? making (?:the )?(?:biggest )?moves|(?:top|midday|premarket|pre-market|after-hours|afternoon|morning) (?:movers|gainers|losers)|movers (?:and shakers|to watch)|stocks? (?:to watch|on the move|moving|that moved)|stock market (?:today|news)|market (?:wrap|recap)|trending stocks|(?:gainers|losers) (?:and|&) (?:gainers|losers)|\d+ stocks)\b/i;

/** Bare tickers that are ordinary words; they only count when exchange-qualified, $-prefixed or parenthesised. */
const AMBIGUOUS_BARE_TICKERS = new Set(["A", "ALL", "ARE", "BALL", "BIG", "BK", "C", "CAT", "D", "DAY", "DD", "DE", "DOW", "ED", "EL", "F", "FAST", "GE", "GO", "HAS", "HD", "HE", "IT", "J", "K", "KEY", "KO", "L", "LOW", "MA", "MO", "MS", "NOW", "O", "ON", "PEG", "PH", "PM", "RE", "SO", "T", "TT", "V", "WM", "WELL", "WAT", "ZION"]);
/** Single words that may not act as a company alias on their own. */
const ALIAS_STOPWORDS = new Set(["american", "general", "international", "national", "united", "first", "western", "eastern", "southern", "northern", "global", "public", "digital", "technology", "technologies", "energy", "financial", "capital", "health", "healthcare", "medical", "systems", "services", "industries", "group", "holdings", "realty", "trust", "power", "electric", "motors", "insurance", "bank", "devices", "solutions", "partners", "resources", "brands", "foods", "products", "communications", "entertainment", "semiconductor", "pharmaceuticals", "therapeutics", "labs", "laboratories", "materials", "chemical", "water", "royal", "pacific", "atlantic", "texas", "southwest", "target", "match", "visa", "apple", "ball", "news", "fox", "progressive", "steel", "best", "dollar", "home", "booking",
  // Ordinary words / first names / places that start S&P 500 issuer names: such an issuer is named only by its full name or ticker.
  "advanced", "align", "analog", "applied", "arthur", "automatic", "baker", "block", "bloom", "boston", "camden", "cardinal", "carnival", "carrier", "charles",
  "church", "cincinnati", "citizens", "coherent", "comfort", "consolidated", "cooper", "crown", "delta", "devon", "dominion", "dover", "edison", "everest",
  "expand", "extra", "federal", "fidelity", "fifth", "flex", "franklin", "genuine", "globe", "hartford", "henry", "illinois", "interactive", "invitation",
  "kinder", "marathon", "martin", "monolithic", "monster", "morgan", "mosaic", "norfolk", "packaging", "parker", "philip", "phillips", "pinnacle", "principal",
  "quest", "ralph", "raymond", "regions", "republic", "simon", "smith", "state", "super", "tractor", "travelers", "union", "universal", "vertex", "waste",
  "waters", "wells", "williams", "willis", "zebra"]);
/** Controlled extra aliases (exact phrases, case-insensitive). Changing this list is a methodology change. */
export const EXPLICIT_COMPANY_ALIASES: Readonly<Record<string, readonly string[]>> = {
  GOOGL: ["Alphabet", "Google"], GOOG: ["Alphabet", "Google"], META: ["Meta Platforms", "Facebook"], "BRK-B": ["Berkshire Hathaway", "Berkshire"],
  AAPL: ["Apple Inc"], AMZN: ["Amazon.com", "Amazon"], T: ["AT&T"], NWS: ["News Corp"], NWSA: ["News Corp"], FOX: ["Fox Corp"], FOXA: ["Fox Corp"], LOW: ["Lowe's"],
};
const LEGAL_SUFFIXES = new Set(["&", "inc", "corp", "corporation", "co", "cos", "company", "companies", "ltd", "plc", "holdings", "holding", "group", "sa", "nv", "ag", "lp", "the", "incorporated", "class", "cl", "a", "b", "c", "reit", "new", "de"]);

export interface AliasIndex {
  /** issuer key per ticker (share classes of one issuer share a key). */
  issuerOf: Map<string, string>;
  /** alias phrase (lowercase) → issuer keys using it. */
  aliasIssuers: Map<string, Set<string>>;
  /** issuer key → its alias phrases. */
  issuerAliases: Map<string, string[]>;
  tickersOfIssuer: Map<string, string[]>;
  /** Precompiled matchers (built once per reading). */
  aliasMatchers: Array<{ alias: string; re: RegExp; keys: Set<string> }>;
  tickerMatchers: Array<{ ticker: string; key: string; qualified: RegExp; bare: RegExp | null }>;
}

const tickerForms = (t: string) => [t, t.replace("-", "."), t.replace("-", "/")];

/** Deterministic company-name normalisation of the SSGA holdings name. */
export function normalizeCompanyName(name: string): string {
  // SSGA writes possessives as "LOWE S"; a lone "s" token is dropped.
  const tokens = name.toLowerCase().replace(/\+/g, "&").replace(/[’']s\b/g, "").replace(/[^a-z0-9& ]/g, " ").split(/\s+/).filter(t => t && t !== "s");
  while (tokens.length > 1 && LEGAL_SUFFIXES.has(tokens[tokens.length - 1])) tokens.pop();
  while (tokens.length > 1 && tokens[0] === "the") tokens.shift();
  return tokens.join(" ");
}

/** Controlled, deterministic aliases from the universe list + EXPLICIT_COMPANY_ALIASES. */
export function buildAliasIndex(members: readonly UniverseMember[]): AliasIndex {
  const issuerOf = new Map<string, string>(); const tickersOfIssuer = new Map<string, string[]>();
  for (const m of [...members].sort((a, b) => a.ticker.localeCompare(b.ticker))) {
    const key = normalizeCompanyName(m.name) || m.ticker.toLowerCase();
    issuerOf.set(m.ticker, key); tickersOfIssuer.set(key, [...(tickersOfIssuer.get(key) ?? []), m.ticker]);
  }
  const firstTokenIssuers = new Map<string, Set<string>>();
  for (const key of Array.from(tickersOfIssuer.keys())) { const first = key.split(" ")[0]; (firstTokenIssuers.get(first) ?? firstTokenIssuers.set(first, new Set()).get(first)!).add(key); }
  const issuerAliases = new Map<string, string[]>(); const aliasIssuers = new Map<string, Set<string>>();
  const add = (key: string, alias: string) => {
    const a = alias.toLowerCase().replace(/[’']s\b/g, "").trim(); if (!a) return;
    if (!a.includes(" ") && (a.length < 4 || ALIAS_STOPWORDS.has(a))) return; // single-word aliases must be distinctive
    issuerAliases.set(key, Array.from(new Set([...(issuerAliases.get(key) ?? []), a])));
    (aliasIssuers.get(a) ?? aliasIssuers.set(a, new Set()).get(a)!).add(key);
  };
  for (const [key, tickers] of Array.from(tickersOfIssuer)) {
    add(key, key);
    const first = key.split(" ")[0];
    if (first.length >= 5 && !ALIAS_STOPWORDS.has(first) && firstTokenIssuers.get(first)!.size === 1) add(key, first);
    for (const t of tickers) for (const extra of EXPLICIT_COMPANY_ALIASES[t] ?? []) add(key, extra);
  }
  const aliasMatchers = Array.from(aliasIssuers).sort(([a], [b]) => a.localeCompare(b)).map(([alias, keys]) => ({ alias, keys, re: new RegExp(`(^|[^a-z0-9&])${escapeRe(alias)}([^a-z0-9&]|$)`) }));
  const tickerMatchers = Array.from(issuerOf).map(([ticker, key]) => {
    const forms = tickerForms(ticker).map(escapeRe).join("|");
    return {
      ticker, key,
      qualified: new RegExp(`(?:\\$(?:${forms})\\b|\\((?:(?:nyse|nasdaq|nysearca|cboe|bats)\\s*:\\s*)?(?:${forms})\\)|\\b(?:nyse|nasdaq)\\s*:\\s*(?:${forms})\\b)`, "i"),
      bare: ticker.length >= 3 && !AMBIGUOUS_BARE_TICKERS.has(ticker) ? new RegExp(`(^|[^A-Za-z0-9$])(?:${forms})([^A-Za-z0-9]|$)`) : null,
    };
  });
  return { issuerOf, aliasIssuers, issuerAliases, tickersOfIssuer, aliasMatchers, tickerMatchers };
}

/** Issuers the title names explicitly (qualified tickers, unambiguous bare tickers, controlled aliases), and whether an alias in it is shared by several issuers. */
export function issuersNamedInTitle(title: string, idx: AliasIndex): { issuers: Set<string>; ambiguousAliases: string[] } {
  const issuers = new Set<string>(); const ambiguousAliases: string[] = [];
  // Exchange qualifiers ("(NASDAQ: TER)", "NYSE: X") are notation, not a mention of the exchange operator as an issuer.
  const lower = ` ${title.toLowerCase().replace(/[’']s\b/g, "").replace(/\b(?:nyse|nasdaq|nysearca|cboe|bats)\s*:\s*/g, " ")} `;
  for (const m of idx.aliasMatchers) {
    if (!m.re.test(lower)) continue;
    if (m.keys.size > 1) { ambiguousAliases.push(m.alias); continue; }
    issuers.add(Array.from(m.keys)[0]);
  }
  const allCaps = title === title.toUpperCase();
  for (const m of idx.tickerMatchers) {
    if (m.qualified.test(title) || (!allCaps && m.bare && m.bare.test(title))) issuers.add(m.key);
  }
  return { issuers, ambiguousAliases };
}

export type NewsRejection = "PUBLISHER_MISSING" | "PUBLISHER_NOT_APPROVED" | "NOT_TAGGED" | "TOO_MANY_TAGS" | "BAD_TIMESTAMP" | "ROUNDUP" | "NOT_NAMED" | "AMBIGUOUS_NAME" | "NAMES_OTHER_ISSUER";
/** Applies rules 2–6 to one item for one mover. Returns null when the item qualifies. */
export function qualifyNewsItem(item: NewsItemInput, ticker: string, idx: AliasIndex): NewsRejection | null {
  if (!item.publisher || !item.publisher.trim()) return "PUBLISHER_MISSING";
  if (!isApprovedPublisher(item.publisher)) return "PUBLISHER_NOT_APPROVED";
  if (!Number.isFinite(Date.parse(item.publishedAt))) return "BAD_TIMESTAMP";
  if (!item.tickers.includes(ticker)) return "NOT_TAGGED";
  if (item.tickers.length > P.maxNewsTickerTags) return "TOO_MANY_TAGS";
  if (ROUNDUP_PATTERN.test(item.title)) return "ROUNDUP";
  const own = idx.issuerOf.get(ticker);
  if (!own) return "NOT_NAMED";
  const { issuers, ambiguousAliases } = issuersNamedInTitle(item.title, idx);
  if (!issuers.has(own)) return ambiguousAliases.length ? "AMBIGUOUS_NAME" : "NOT_NAMED";
  if (Array.from(issuers).some(k => k !== own)) return "NAMES_OTHER_ISSUER";
  return null;
}

export interface CatalystInput {
  ticker: string;
  stockPct: number;
  sectorEtf: SectorEtfTicker;
  sectorPct: number | null;
  spyPct: number | null;
  /** News items inside the move's window (the builder filters by time). */
  news: NewsItemInput[];
  newsAvailable: boolean;
  /** Controlled alias index for the universe (buildAliasIndex). */
  aliases: AliasIndex;
}

const sameSign = (a: number, b: number) => (a > 0 && b > 0) || (a < 0 && b < 0);
/** A benchmark "explains" a move when it moved the same way by at least coMoveShare of the move. */
export const explains = (benchmarkPct: number | null, stockPct: number) => benchmarkPct != null && sameSign(benchmarkPct, stockPct) && Math.abs(benchmarkPct) >= P.coMoveShare * Math.abs(stockPct);

/**
 * Mechanical catalyst rule, first match wins (news items must pass qualifyNewsItem):
 *  1 EVENT_DRIVEN     — a qualifying item whose title matches an event family.
 *  2 COMPANY_SPECIFIC — a qualifying item AND the sector ETF does NOT explain the move.
 *  3 SECTOR_DRIVEN    — the sector ETF explains the move AND SPY does not explain the sector's move (price only, no headline).
 *  4 MACRO_DRIVEN     — SPY explains the move (price only, no headline).
 *  5 CATALYST_UNCLEAR — otherwise (including when news is unavailable or no item qualifies).
 */
export function classifyCatalyst(input: CatalystInput): MoverRow["catalyst"] {
  const items = input.newsAvailable
    ? [...input.news].filter(n => qualifyNewsItem(n, input.ticker, input.aliases) === null).sort((a, b) => b.publishedAt.localeCompare(a.publishedAt) || a.id.localeCompare(b.id))
    : [];
  const toEvidence = (n: NewsItemInput): NewsEvidence => ({ id: n.id, title: n.title, publisher: n.publisher, url: n.url, publishedAt: n.publishedAt, source: "polygon-news" });
  for (const fam of EVENT_FAMILY_PATTERNS) {
    const hit = items.find(n => fam.pattern.test(n.title));
    if (hit) return { class: "EVENT_DRIVEN", eventFamily: fam.family, why: hit.title, news: toEvidence(hit), coMove: null };
  }
  if (items.length > 0 && !explains(input.sectorPct, input.stockPct)) {
    return { class: "COMPANY_SPECIFIC", eventFamily: null, why: items[0].title, news: toEvidence(items[0]), coMove: null };
  }
  if (explains(input.sectorPct, input.stockPct) && !explains(input.spyPct, input.sectorPct!)) {
    return { class: "SECTOR_DRIVEN", eventFamily: null, why: `Moved with ${input.sectorEtf} (${fmtSignedPct(input.sectorPct!)}) — sector co-move.`, news: null, coMove: { benchmark: input.sectorEtf, benchmarkPct: input.sectorPct!, stockPct: input.stockPct } };
  }
  if (explains(input.spyPct, input.stockPct)) {
    return { class: "MACRO_DRIVEN", eventFamily: null, why: `Moved with SPY (${fmtSignedPct(input.spyPct!)}) — broad-market co-move.`, news: null, coMove: { benchmark: BENCHMARK_TICKER, benchmarkPct: input.spyPct!, stockPct: input.stockPct } };
  }
  return { class: "CATALYST_UNCLEAR", eventFamily: null, why: CATALYST_UNCLEAR_TEXT, news: null, coMove: null };
}

export function thesisAlignment(side: "winner" | "loser", quadrant: Quadrant | null): ThesisAlignment {
  if (!quadrant) return "UNDETERMINED";
  const strong = quadrant === "LEADING" || quadrant === "IMPROVING";
  return (side === "winner") === strong ? "REINFORCES" : "CONTRADICTS";
}

export const EARLY_INDICATOR_RULE = `Flagged when the move CONTRADICTS its sector's quadrant, is SECTOR-DRIVEN or CATALYST UNCLEAR (not explained by a company item or the broad market), and volume is ≥ ${P.earlyIndicatorVolumeRatio}× normal.`;
export function earlyIndicator(m: Pick<MoverRow, "ticker" | "sectorEtf" | "todayPct" | "volumeRatio" | "thesisAlignment"> & { catalystClass: CatalystClass; quadrant: Quadrant | null }): MoverRow["earlyIndicator"] {
  const flagged = m.thesisAlignment === "CONTRADICTS" && (m.catalystClass === "SECTOR_DRIVEN" || m.catalystClass === "CATALYST_UNCLEAR") && m.volumeRatio != null && m.volumeRatio >= P.earlyIndicatorVolumeRatio;
  return {
    flagged,
    rule: EARLY_INDICATOR_RULE,
    text: flagged && m.quadrant ? `${m.ticker} ${fmtSignedPct(m.todayPct)} against ${m.sectorEtf}'s ${QUADRANT_LABEL[m.quadrant]} reading on ${m.volumeRatio!.toFixed(1)}× normal volume — possible early sign of a ${m.sectorEtf} turn; needs sector RS confirmation.` : null,
  };
}

/** News window for a move: (close of the session before the measured one, end of the measured move]. */
export function newsWindow(basis: DailyChangeBasis, priorCompletedSession: string | null, now: number): { start: number; end: number } | null {
  if (!priorCompletedSession) return null;
  const start = etWallToUtc(priorCompletedSession, 16, 0);
  const end = basis.kind === "SESSION_CLOSE" ? etWallToUtc(basis.sessionDate, 16, 0) : (basis.asOf ? Date.parse(basis.asOf) : now);
  return { start, end };
}

// ── Number-traceability validator for templated prose ────────────────────────

/** Numeric tokens that are part of fixed labels/parameters, not data. */
const LABEL_TOKENS = /\b(10-year|2s10s|S&P 500|SMA50|50-session|20-session|5-day|20-day|10Y|2Y|DGS10|DGS2|T10YIE|WALCL|BAMLH0A0HYM2|XL[A-Z]{1,2}|SOXX|SMH|IWM|SPY)\b/g;

function collectNumbers(value: unknown, out: Set<string>): void {
  if (typeof value === "number" && Number.isFinite(value)) {
    const a = Math.abs(value);
    for (const d of [0, 1, 2]) out.add(a.toFixed(d));
    out.add(String(a));
    out.add(String(Math.round(a)));
  } else if (Array.isArray(value)) value.forEach(v => collectNumbers(v, out));
  else if (value && typeof value === "object") Object.values(value).forEach(v => collectNumbers(v, out));
}

function collectTickers(value: unknown, out: Set<string>): void {
  if (Array.isArray(value)) value.forEach(v => collectTickers(v, out));
  else if (value && typeof value === "object") {
    for (const [k, v] of Object.entries(value)) {
      if ((k === "ticker" || k === "sectorEtf") && typeof v === "string") out.add(v);
      else collectTickers(v, out);
    }
  }
}
const escapeRe = (x: string) => x.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Returns numeric tokens in `text` that do not appear (as a formatted value) anywhere in `source`. */
export function findUntraceableNumbers(text: string, source: unknown): string[] {
  const allowed = new Set<string>();
  collectNumbers(source, allowed);
  collectNumbers(SECTOR_ROTATION_PARAMS, allowed);
  const tickers = new Set<string>();
  collectTickers(source, tickers);
  let stripped = text.replace(LABEL_TOKENS, " ");
  // Ticker symbols that appear in the object are identifiers, not numbers.
  for (const t of Array.from(tickers).filter(t => /\d/.test(t))) stripped = stripped.replace(new RegExp(`\\b${escapeRe(t)}\\b`, "g"), " ");
  const tokens = stripped.match(/\d+(?:\.\d+)?/g) ?? [];
  return tokens.filter(t => !allowed.has(t) && !allowed.has(String(Number(t))));
}

// ── Builder ──────────────────────────────────────────────────────────────────

function chartSplit(chart: ChartInput | undefined, now: number): SplitBars {
  return chart && !chart.error ? splitBars(chart.bars, now) : { completed: [], inProgress: null };
}

/** Risk vs calm bands — derived from the canonical pressureBand table, not a local mapping. */
const RISK_REGIMES = new Set<PressureBandRegime>(PRESSURE_BANDS.filter(b => b.min >= 45).map(b => b.regime));
const CALM_REGIMES = new Set<PressureBandRegime>(PRESSURE_BANDS.filter(b => b.max <= 44).map(b => b.regime));
/** Prefer the score→label from pressureBand(); fall back to the stored regime string when no score is available. */
export function canonicalRegimeLabel(pressureIndex: number | null | undefined, regime: string | null | undefined): string | null {
  if (pressureIndex != null && Number.isFinite(pressureIndex)) return pressureBand(pressureIndex).regime;
  if (regime && (RISK_REGIMES.has(regime as PressureBandRegime) || CALM_REGIMES.has(regime as PressureBandRegime))) return regime;
  return regime ?? null;
}

/**
 * Pure function: inputs → versioned SectorRotationReading. Deterministic for a
 * given input (generatedAt = inputs.now).
 */
export function buildSectorRotationReading(inputs: SectorRotationInputs): SectorRotationReading {
  const { now } = inputs;
  const missing: SectorRotationReading["missingData"] = [];
  const splits = new Map<string, SplitBars>();
  for (const [symbol, chart] of Object.entries(inputs.charts)) splits.set(symbol, chartSplit(chart, now));
  const spySplit = splits.get(BENCHMARK_TICKER) ?? { completed: [], inProgress: null };
  const spyLatest = spySplit.completed.at(-1)?.session ?? null;
  const spyDaily = dailyChange(spySplit, inputs.charts[BENCHMARK_TICKER]?.regularMarketTime ?? null);
  const spyRet20 = completedReturn(spySplit.completed, P.mediumLookback);
  const spyStale = spyLatest != null && calendarDaysBetween(spyLatest, etDate(now)) > P.staleAfterCalendarDays;
  const spyOk = spySplit.completed.length >= RRG_MIN_SESSIONS;
  const benchmark: SectorRotationReading["benchmark"] = {
    ticker: BENCHMARK_TICKER, status: !spyOk ? "UNAVAILABLE" : spyStale ? "STALE" : "OK", latestCompletedSession: spyLatest,
    dailyChangePct: spyDaily?.pct ?? null, dailyBasis: spyDaily?.basis ?? null, return20dPct: spyRet20,
    reason: !spyOk ? (inputs.charts[BENCHMARK_TICKER]?.error ?? `SPY: fewer than ${RRG_MIN_SESSIONS} completed sessions.`) : spyStale ? `Latest completed SPY session ${spyLatest} is older than ${P.staleAfterCalendarDays} calendar days.` : null,
  };
  if (benchmark.status !== "OK") missing.push({ id: "SPY", status: benchmark.status as "STALE" | "UNAVAILABLE", reason: benchmark.reason ?? "", asOf: spyLatest });

  // Universe / stock bars (used for breadth and movers).
  const universeOk = inputs.universe.status === "OK" && inputs.universe.members.length > 0;
  const stockSplits = new Map<string, SplitBars>();
  if (universeOk) for (const m of inputs.universe.members) stockSplits.set(m.ticker, chartSplit(inputs.stockCharts[m.ticker], now));

  // Relative-rotation for each sector ETF (and SOXX / SMH / IWM for watch + drivers).
  const rrgFor = (symbol: string): { rrg: RrgReading | null; reason: string | null } => {
    if (!spyOk) return { rrg: null, reason: "Benchmark SPY unavailable." };
    const split = splits.get(symbol);
    if (!split || split.completed.length === 0) return { rrg: null, reason: inputs.charts[symbol]?.error ?? `${symbol}: no completed bars.` };
    const aligned = alignToBenchmark(split.completed, spySplit.completed, RRG_MIN_SESSIONS);
    if (!aligned.ok) return { rrg: null, reason: `${symbol}: ${aligned.reason}` };
    return { rrg: latestRrg(computeRrg(aligned.sessions, aligned.asset, aligned.bench)), reason: null };
  };
  const rel20 = new Map<string, number | null>();
  for (const symbol of [...SECTOR_ETFS.map(s => s.ticker), "SOXX", "SMH", "IWM"]) {
    const split = splits.get(symbol);
    const r = split && spySplit.completed.length && split.completed.at(-1)?.session === spyLatest ? completedReturn(split.completed, P.mediumLookback) : null;
    rel20.set(symbol, r != null && spyRet20 != null ? round2(r - spyRet20) : null);
  }

  const provisional = SECTOR_ETFS.map(etf => {
    const split = splits.get(etf.ticker) ?? { completed: [], inProgress: null };
    const { rrg, reason } = rrgFor(etf.ticker);
    const daily = dailyChange(split, inputs.charts[etf.ticker]?.regularMarketTime ?? null);
    const members = universeOk ? inputs.universe.members.filter(m => m.sectorEtf === etf.ticker) : [];
    return { etf, split, rrg, reason, daily, breadth: sectorBreadth(members, stockSplits, spyLatest, universeOk) };
  });
  const ranked = provisional.filter(p => p.rrg);
  const rank = rankBy(ranked.map(p => ({ ticker: p.etf.ticker, value: p.rrg!.rsRatio })));
  const priorRank = rankBy(ranked.map(p => ({ ticker: p.etf.ticker, value: p.rrg!.priorRsRatio })));

  const sectors: SectorRow[] = provisional.map((p): SectorRow => {
    const { etf, rrg, split, daily, breadth } = p;
    if (!rrg) {
      missing.push({ id: etf.ticker, status: "UNAVAILABLE", reason: p.reason ?? "Unavailable.", asOf: split.completed.at(-1)?.session ?? null });
      return {
        ticker: etf.ticker, sector: etf.sector, status: "UNAVAILABLE", unavailableReason: p.reason ?? "Unavailable.", latestCompletedSession: split.completed.at(-1)?.session ?? null,
        dailyChangePct: null, dailyBasis: null, return5dPct: null, return20dPct: null, relReturn20dPct: null, rsRatio: null, rsMomentum: null, quadrant: null, arrow: null,
        rank: null, priorRank: null, rankChange: null, priorQuadrant: null, sessionsInQuadrant: null, leadershipGroup: null, breadth, action: null,
      };
    }
    if (breadth.status !== "OK") missing.push({ id: `${etf.ticker}:breadth`, status: "UNAVAILABLE", reason: breadth.reason ?? "Breadth unavailable.", asOf: spyLatest });
    const relReturn20dPct = rel20.get(etf.ticker) ?? null;
    const action = classifyAction({ quadrant: rrg.quadrant, relReturn20dPct, breadthPct: breadth.pctAboveSma, arrow: rrg.arrow });
    const r = rank.get(etf.ticker)!, pr = priorRank.get(etf.ticker)!;
    // Daily % shown only when it is on the same session as SPY's.
    const sameBasis = daily && spyDaily && daily.basis.kind === spyDaily.basis.kind && daily.basis.sessionDate === spyDaily.basis.sessionDate;
    return {
      ticker: etf.ticker, sector: etf.sector, status: "RANKED", unavailableReason: null, latestCompletedSession: split.completed.at(-1)?.session ?? null,
      dailyChangePct: sameBasis ? daily!.pct : null, dailyBasis: sameBasis ? daily!.basis : null,
      return5dPct: completedReturn(split.completed, P.shortLookback), return20dPct: completedReturn(split.completed, P.mediumLookback), relReturn20dPct,
      rsRatio: rrg.rsRatio, rsMomentum: rrg.rsMomentum, quadrant: rrg.quadrant, arrow: rrg.arrow,
      rank: r, priorRank: pr, rankChange: pr - r, priorQuadrant: rrg.priorQuadrant, sessionsInQuadrant: rrg.sessionsInQuadrant,
      leadershipGroup: LEADERSHIP_GROUP_BY_QUADRANT[rrg.quadrant], breadth,
      action: { class: action.class, rule: ACTION_RULES[action.class], evidence: action.evidence },
    };
  }).sort((a, b) => (a.rank ?? 99) - (b.rank ?? 99) || a.ticker.localeCompare(b.ticker));

  const leadershipChanges = sectors
    .filter(s => s.quadrant && s.priorQuadrant && s.quadrant !== s.priorQuadrant)
    .map(s => ({ ticker: s.ticker, from: s.priorQuadrant!, to: s.quadrant!, text: `${s.ticker} moved from ${QUADRANT_LABEL[s.priorQuadrant!]} to ${QUADRANT_LABEL[s.quadrant!]} in the latest completed session.` }));

  const drivers = computeDrivers(inputs, splits, rel20);
  for (const d of drivers) if (d.status !== "OK") missing.push({ id: `driver:${d.id}`, status: d.status as "STALE" | "UNAVAILABLE", reason: d.reason ?? `${d.label} stale (as of ${d.asOf}).`, asOf: d.asOf });
  const driverLinks = computeDriverLinks(sectors, drivers);

  // Watch indicators.
  const watch: WatchIndicator[] = [];
  const rsWatch = (id: string, label: string, symbols: string[], confirms: string, invalidates: string) => {
    const readings = symbols.map(s => ({ s, ...rrgFor(s) }));
    if (readings.some(r => !r.rrg)) {
      watch.push({ id, label, source: `Yahoo chart ${symbols.join(", ")}, SPY`, status: "UNAVAILABLE", current: readings.find(r => !r.rrg)?.reason ?? "Unavailable", confirms, invalidates, state: "UNAVAILABLE" });
      return;
    }
    watch.push({
      id, label, source: `Yahoo chart ${symbols.join(", ")}, SPY`, status: "OK",
      current: readings.map(r => `${r.s}: RS-Ratio ${r.rrg!.rsRatio.toFixed(2)}, RS-Momentum ${r.rrg!.rsMomentum.toFixed(2)} ${ARROW_GLYPH[r.rrg!.arrow]} (${QUADRANT_LABEL[r.rrg!.quadrant]})`).join(" · "),
      confirms, invalidates, state: readings.every(r => r.rrg!.rsMomentum >= P.quadrantCentre) ? "CONFIRMING" : "NOT_CONFIRMING",
    });
  };
  rsWatch("XLF_SPY", "XLF / SPY relative strength", ["XLF"], "RS-Momentum holding ≥ 100 (financials' relative strength still rising).", "RS-Momentum below 100; below 100 on RS-Ratio as well means Lagging.");
  rsWatch("XLK_SPY", "XLK / SPY relative strength", ["XLK"], "RS-Momentum holding ≥ 100 (technology's relative strength still rising).", "RS-Momentum below 100; below 100 on RS-Ratio as well means Lagging.");
  rsWatch("SEMIS_SPY", "SOXX / SMH vs SPY (AI / semis leadership)", ["SOXX", "SMH"], "Both semiconductor ETFs with RS-Momentum ≥ 100.", "Either semiconductor ETF with RS-Momentum below 100.");
  rsWatch("DEFENSIVE", "XLU / XLV defensive rotation", ["XLU", "XLV"], "Both XLU and XLV with RS-Momentum ≥ 100 (defensive bid building).", "Either with RS-Momentum below 100 (defensive bid fading).");
  rsWatch("IWM_SPY", "IWM / SPY small-cap participation", ["IWM"], "RS-Momentum ≥ 100 (participation broadening beyond large caps).", "RS-Momentum below 100 (narrowing participation).");
  {
    const oil = drivers.find(d => d.id === "OIL_WTI")!;
    const xle = sectors.find(s => s.ticker === "XLE")!;
    const confirms = "XLE 20-session return and a directional WTI move (beyond ±1%) pointing the same way.", invalidates = "XLE and WTI moving in opposite directions, or WTI flat, over 20 sessions.";
    if (oil.status === "UNAVAILABLE" || oil.change == null || xle.return20dPct == null) watch.push({ id: "XLE_OIL", label: "XLE vs WTI oil", source: "Yahoo chart XLE, CL=F", status: "UNAVAILABLE", current: oil.reason ?? xle.unavailableReason ?? "Unavailable", confirms, invalidates, state: "UNAVAILABLE" });
    else watch.push({ id: "XLE_OIL", label: "XLE vs WTI oil", source: "Yahoo chart XLE, CL=F", status: oil.status, current: `XLE ${fmtSignedPct(xle.return20dPct)} · WTI ${fmtSignedPct(oil.change)} (${P.mediumLookback} sessions)`, confirms, invalidates, state: oil.direction !== "FLAT" && sameSign(xle.return20dPct, oil.change) ? "CONFIRMING" : "NOT_CONFIRMING" });
  }
  {
    const hy = drivers.find(d => d.id === "HY_SPREAD")!;
    const confirms = "HY OAS flat or tightening over 20 observations (risk appetite intact).", invalidates = `HY OAS widening by ${DRIVER_BAND.yieldBp} bp or more over 20 observations.`;
    if (hy.status === "UNAVAILABLE" || hy.change == null) watch.push({ id: "HY_SPREAD", label: "High-yield credit spreads", source: hy.source, status: "UNAVAILABLE", current: hy.reason ?? "Unavailable", confirms, invalidates, state: "UNAVAILABLE" });
    else watch.push({ id: "HY_SPREAD", label: "High-yield credit spreads", source: hy.source, status: hy.status, current: `${hy.latest} bp, ${fmtSignedBp(hy.change)} (${hy.direction})`, confirms, invalidates, state: hy.direction === "RISING" ? "NOT_CONFIRMING" : "CONFIRMING" });
  }
  {
    const y = drivers.find(d => d.id === "UST10Y")!;
    const confirms = "10Y direction matching a leading sector's conventional rate link (rising: XLF; falling: XLU, XLRE, XLK).", invalidates = "10Y direction running against every leading sector's rate link.";
    const leadingRateLinked = SECTOR_DRIVER_LINKS.filter(l => l.driver === "UST10Y" && sectors.find(s => s.ticker === l.sector)?.quadrant === "LEADING");
    if (y.status === "UNAVAILABLE" || y.change == null) watch.push({ id: "UST10Y", label: "Treasury yield direction", source: y.source, status: "UNAVAILABLE", current: y.reason ?? "Unavailable", confirms, invalidates, state: "UNAVAILABLE" });
    else {
      const dir = y.direction === "RISING" ? 1 : y.direction === "FALLING" ? -1 : 0;
      const ok = dir !== 0 && leadingRateLinked.some(l => l.expectedSign === dir);
      watch.push({ id: "UST10Y", label: "Treasury yield direction", source: y.source, status: y.status, current: `10Y ${y.latest}%, ${fmtSignedBp(y.change)} (${y.direction})`, confirms, invalidates, state: ok ? "CONFIRMING" : "NOT_CONFIRMING" });
    }
  }

  const movers = buildMovers(inputs, stockSplits, sectors, spyDaily, spySplit);
  if (movers.status !== "OK") missing.push({ id: "movers", status: movers.status as "STALE" | "UNAVAILABLE", reason: movers.reason ?? "", asOf: movers.universe.asOf });
  if (movers.newsStatus !== "OK") missing.push({ id: "news", status: "UNAVAILABLE", reason: movers.newsReason ?? "News unavailable.", asOf: null });

  const status: DataStatus = benchmark.status === "UNAVAILABLE" || ranked.length === 0 ? "UNAVAILABLE" : benchmark.status === "STALE" ? "STALE" : "OK";
  const moverRows = [...movers.winners, ...movers.losers];
  const summary: SectorRotationReading["summary"] = {
    confirmingIndicators: watch.filter(w => w.state === "CONFIRMING").length,
    measurableIndicators: watch.filter(w => w.state !== "UNAVAILABLE").length,
    reinforcingMovers: moverRows.filter(m => m.thesisAlignment === "REINFORCES").length,
    contradictingMovers: moverRows.filter(m => m.thesisAlignment === "CONTRADICTS").length,
    catalystCounts: Object.fromEntries((Object.keys(CATALYST_LABEL) as CatalystClass[]).map(c => [c, moverRows.filter(m => m.catalyst.class === c).length])) as Record<CatalystClass, number>,
  };
  const draft: SectorRotationReading = {
    schemaVersion: SECTOR_ROTATION_SCHEMA_VERSION, methodVersion: SECTOR_ROTATION_METHOD_VERSION, generatedAt: new Date(now).toISOString(),
    canonical: inputs.canonical, status, benchmark, sectors, leadershipChanges, drivers, driverLinks, watch, movers, summary,
    narrative: { whyItMatters: null, happening: null, why: null, next: null, watch: null, act: null },
    missingData: missing, params: SECTOR_ROTATION_PARAMS,
  };
  if (status === "UNAVAILABLE") return draft;
  return { ...draft, narrative: validatedNarrative(draft) };
}

function buildMovers(inputs: SectorRotationInputs, stockSplits: Map<string, SplitBars>, sectors: SectorRow[], spyDaily: DailyChange | null, spySplit: SplitBars): TopMovers {
  const u = inputs.universe;
  const universeStale = u.asOf != null && calendarDaysBetween(u.asOf, etDate(inputs.now)) > P.universeStaleAfterDays;
  const universe: TopMovers["universe"] = { name: u.name, source: u.source, asOf: u.asOf, total: u.members.length, ranked: 0, unavailable: [], status: u.status === "OK" ? (universeStale ? "STALE" : "OK") : "UNAVAILABLE" };
  const empty = (reason: string): TopMovers => ({ status: "UNAVAILABLE", reason, universe, basis: spyDaily?.basis ?? null, newsStatus: inputs.news.status === "OK" ? "OK" : "UNAVAILABLE", newsReason: inputs.news.reason, winners: [], losers: [] });
  if (u.status !== "OK" || u.members.length === 0) return empty(u.reason ?? "Constituent universe unavailable.");
  if (!spyDaily) return empty("SPY daily change unavailable; movers cannot be put on a common session basis.");
  const rows: Array<{ m: UniverseMember; daily: DailyChange; split: SplitBars; company: string }> = [];
  for (const m of u.members) {
    const split = stockSplits.get(m.ticker) ?? { completed: [], inProgress: null };
    const chart = inputs.stockCharts[m.ticker];
    const daily = dailyChange(split, chart?.regularMarketTime ?? null);
    if (!daily || daily.basis.kind !== spyDaily.basis.kind || daily.basis.sessionDate !== spyDaily.basis.sessionDate) { universe.unavailable.push(m.ticker); continue; }
    // A single-day move this large is treated as a possible unadjusted corporate action: not ranked.
    if (Math.abs(daily.pct) >= P.discontinuityGuardPct) { universe.unavailable.push(m.ticker); continue; }
    rows.push({ m, daily, split, company: chart?.companyName?.trim() || m.name });
  }
  universe.ranked = rows.length;
  if (rows.length / u.members.length < P.moversMinCoverage) {
    return empty(`Only ${rows.length} of ${u.members.length} constituents have a quote on the ${spyDaily.basis.sessionDate} session basis (minimum ${Math.round(P.moversMinCoverage * 100)}% required).`);
  }
  const sorted = [...rows].sort((a, b) => (b.daily.pct - a.daily.pct) || a.m.ticker.localeCompare(b.m.ticker));
  const winners = sorted.filter(r => r.daily.pct > 0).slice(0, P.moversPerSide);
  const losers = [...rows].sort((a, b) => (a.daily.pct - b.daily.pct) || a.m.ticker.localeCompare(b.m.ticker)).filter(r => r.daily.pct < 0).slice(0, P.moversPerSide);
  const sectorByTicker = new Map(sectors.map(s => [s.ticker, s]));
  const newsOk = inputs.news.status === "OK";
  const priorSession = spyDaily.basis.kind === "SESSION_CLOSE" ? spySplit.completed.at(-2)?.session ?? null : spySplit.completed.at(-1)?.session ?? null;
  const window = newsWindow(spyDaily.basis, priorSession, inputs.now);
  const aliases = buildAliasIndex(u.members);
  const toRow = (side: "winner" | "loser") => (r: (typeof rows)[number]): MoverRow => {
    const sector = sectorByTicker.get(r.m.sectorEtf);
    const vr = volumeRatio(r.split);
    const news = newsOk && window ? inputs.news.items.filter(n => { const t = Date.parse(n.publishedAt); return Number.isFinite(t) && t > window.start && t <= window.end; }) : [];
    const catalyst = classifyCatalyst({ ticker: r.m.ticker, stockPct: r.daily.pct, sectorEtf: r.m.sectorEtf, sectorPct: sector?.dailyChangePct ?? null, spyPct: spyDaily.pct, news, newsAvailable: newsOk && window != null, aliases });
    const alignment = thesisAlignment(side, sector?.quadrant ?? null);
    const jump = findDiscontinuity(r.split.completed, P.shortLookback);
    const ret5 = jump ? null : completedReturn(r.split.completed, P.shortLookback);
    return {
      ticker: r.m.ticker, company: r.company, sectorEtf: r.m.sectorEtf, sector: SECTOR_ETFS.find(s => s.ticker === r.m.sectorEtf)!.sector,
      todayPct: r.daily.pct, todayBasis: r.daily.basis, return5dPct: ret5,
      return5dReason: jump ? `Withheld: single-session move of ${fmtSignedPct(jump.pct)} on ${jump.session} (possible unadjusted corporate action).` : ret5 == null ? `Fewer than ${P.shortLookback + 1} completed sessions.` : null,
      volumeRatio: vr.ratio, volumeRatioReason: vr.reason, catalyst, thesisAlignment: alignment,
      earlyIndicator: earlyIndicator({ ticker: r.m.ticker, sectorEtf: r.m.sectorEtf, todayPct: r.daily.pct, volumeRatio: vr.ratio, thesisAlignment: alignment, catalystClass: catalyst.class, quadrant: sector?.quadrant ?? null }),
    };
  };
  const coverageNote = universe.unavailable.length ? `${universe.unavailable.length} of ${u.members.length} constituents unavailable and not ranked.` : null;
  return {
    status: universe.status === "STALE" ? "STALE" : "OK", reason: universe.status === "STALE" ? `Constituent list as of ${u.asOf}. ${coverageNote ?? ""}`.trim() : coverageNote,
    universe, basis: spyDaily.basis, newsStatus: newsOk ? "OK" : "UNAVAILABLE", newsReason: newsOk ? null : inputs.news.reason ?? "News source unavailable.",
    winners: winners.map(toRow("winner")), losers: losers.map(toRow("loser")),
  };
}

// ── Templated narrative ──────────────────────────────────────────────────────

function byQuadrant(sectors: SectorRow[], q: Quadrant): string[] {
  return sectors.filter(s => s.quadrant === q).map(s => s.ticker);
}

export function composeNarrative(r: SectorRotationReading): SectorRotationReading["narrative"] {
  const s = r.sectors;
  const leading = byQuadrant(s, "LEADING"), improving = byQuadrant(s, "IMPROVING"), losing = byQuadrant(s, "LOSING_MOMENTUM"), lagging = byQuadrant(s, "LAGGING");
  const top = s.find(x => x.rank === 1);
  const biggestMove = [...s].filter(x => x.rankChange != null && x.rankChange !== 0).sort((a, b) => Math.abs(b.rankChange!) - Math.abs(a.rankChange!) || a.ticker.localeCompare(b.ticker))[0];
  const happening = [
    `Leading: ${listOr(leading, "none")}. Improving: ${listOr(improving, "none")}. Losing momentum: ${listOr(losing, "none")}. Lagging: ${listOr(lagging, "none")}.`,
    top ? `Top-ranked: ${top.ticker} (RS-Ratio ${top.rsRatio!.toFixed(2)}).` : "",
    biggestMove ? `Largest rank change: ${biggestMove.ticker} ${biggestMove.rankChange! > 0 ? "up" : "down"} ${Math.abs(biggestMove.rankChange!)} vs the prior session.` : "No rank changes vs the prior session.",
  ].filter(Boolean).join(" ");

  const consistent = r.driverLinks.filter(l => l.observed === "CONSISTENT" && s.find(x => x.ticker === l.sector)?.quadrant && (s.find(x => x.ticker === l.sector)!.quadrant === "LEADING" || s.find(x => x.ticker === l.sector)!.quadrant === "LAGGING"));
  const moverRows = [...r.movers.winners, ...r.movers.losers];
  const catalystCounts = (Object.keys(CATALYST_LABEL) as CatalystClass[]).map(c => [c, r.summary.catalystCounts[c]] as const).filter(([, n]) => n > 0);
  const why = [
    consistent.length ? `Observed co-movement (not causation): ${consistent.slice(0, 2).map(l => l.text.split(" — ")[0]).join("; ")}.` : "No leading or lagging sector shows a measured driver moving in its conventional direction.",
    r.movers.status === "UNAVAILABLE" ? "Top-mover catalysts unavailable." : `Top movers: ${catalystCounts.map(([c, n]) => `${n} ${CATALYST_LABEL[c].toLowerCase()}`).join(", ") || "none"}.`,
  ].join(" ");

  const reinf = r.summary.reinforcingMovers, contra = r.summary.contradictingMovers;
  const next = [
    `Emerging leadership: ${listOr(improving, "none")}. Deteriorating leadership: ${listOr(losing, "none")}.`,
    r.leadershipChanges.length ? `Quadrant changes: ${r.leadershipChanges.map(c => `${c.ticker} ${QUADRANT_LABEL[c.from]} → ${QUADRANT_LABEL[c.to]}`).join("; ")}.` : "No quadrant changes in the latest completed session.",
    r.movers.status === "UNAVAILABLE" ? "" : `Top movers: ${reinf} reinforce and ${contra} contradict the sector map.`,
  ].filter(Boolean).join(" ");

  const confirming = r.summary.confirmingIndicators, measurable = r.summary.measurableIndicators;
  const early = moverRows.filter(m => m.earlyIndicator.flagged).map(m => m.ticker);
  const watch = `${confirming} of ${measurable} measurable indicators currently confirming. ${early.length ? `Possible early indicators: ${early.join(", ")}.` : "No top mover meets the early-indicator rule."}`;

  const classes: SectorActionClass[] = ["OVERWEIGHT", "WATCH_FOR_CONFIRMATION", "NEUTRAL", "UNDERWEIGHT", "AVOID"];
  const act = classes.map(c => `${ACTION_LABEL[c]}: ${listOr(s.filter(x => x.action?.class === c).map(x => x.ticker), "none")}`).join(". ") + ".";

  // WHY IT MATTERS: rotation + strongest / weakest stock vs the canonical regime.
  const defensiveStrong = DEFENSIVE_SECTORS.filter(t => { const q = s.find(x => x.ticker === t)?.quadrant; return q === "LEADING" || q === "IMPROVING"; }).length;
  const defensiveWeak = DEFENSIVE_SECTORS.filter(t => { const q = s.find(x => x.ticker === t)?.quadrant; return q === "LAGGING" || q === "LOSING_MOMENTUM"; }).length;
  const tilt = defensiveStrong >= 2 ? "defensive" : defensiveWeak >= 2 ? "cyclical / growth" : "mixed";
  // Band label from pressureBand(score) when a score is present — never a local score→label cascade.
  const regime = canonicalRegimeLabel(r.canonical.pressureIndex, r.canonical.regime);
  let alignment = "";
  if (regime && tilt !== "mixed") {
    const fits = (RISK_REGIMES.has(regime as PressureBandRegime) && tilt === "defensive") || (CALM_REGIMES.has(regime as PressureBandRegime) && tilt !== "defensive");
    alignment = RISK_REGIMES.has(regime as PressureBandRegime) || CALM_REGIMES.has(regime as PressureBandRegime) ? `, ${fits ? "consistent with" : "at odds with"} that regime` : "";
  }
  const regimeLead = regime ? `Under FAULTLINE's ${regime} regime${r.canonical.pressureIndex != null ? ` (Pressure Index ${r.canonical.pressureIndex})` : ""}` : "With the FAULTLINE regime unavailable";
  const s1 = `${regimeLead}, leadership is ${tilt}${leading.length ? ` (${leading.join(", ")} leading` : " (no sector leading"}${lagging.length ? `; ${lagging.join(", ")} lagging)` : ")"}${alignment}.`;
  const w = r.movers.winners[0], l = r.movers.losers[0];
  const moverPart = (m: MoverRow) => `${m.ticker} ${fmtSignedPct(m.todayPct)} (${CATALYST_LABEL[m.catalyst.class]}, ${m.thesisAlignment === "UNDETERMINED" ? "sector reading unavailable" : `${m.thesisAlignment.toLowerCase()} ${m.sectorEtf}'s ${QUADRANT_LABEL[(s.find(x => x.ticker === m.sectorEtf)?.quadrant ?? "LAGGING") as Quadrant].toLowerCase()} reading`})`;
  const s2 = r.movers.status === "UNAVAILABLE" ? "Top stock movers are unavailable." : w || l ? `Strongest: ${w ? moverPart(w) : "none"}; weakest: ${l ? moverPart(l) : "none"}.` : "No constituent moved up or down on this basis.";
  return { whyItMatters: `${s1} ${s2}`, happening, why, next, watch, act };
}

/** Compose and validate prose; any field carrying an untraceable number is withheld (null). */
export function validatedNarrative(r: SectorRotationReading): SectorRotationReading["narrative"] {
  const n = composeNarrative(r);
  const source = { ...r, narrative: undefined };
  const out = { ...n };
  for (const key of Object.keys(out) as Array<keyof typeof out>) {
    const text = out[key];
    if (text && findUntraceableNumbers(text, source).length > 0) out[key] = null;
  }
  return out;
}

