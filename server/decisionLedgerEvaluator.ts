/**
 * Decision Ledger Evaluation Engine
 *
 * Intelligence Contract v2 (NOT implemented): approved stages REALITY → CAUSATION →
 * CONSEQUENCE → VERIFICATION → ACTION must eventually be stored and evaluated here.
 * Each stage requires confidence+basis, assumptions, supporting evidence,
 * mandatory “What Would Change My Mind?”, and confirmation/invalidation triggers.
 * Missing evidence must stay missing — do not invent scores or triggers.
 * Scope: docs/FAULTLINE_INTELLIGENCE_CONTRACT_V2_SCOPE.md
 *
 * Automatic outcomes are deliberately limited to source-backed, completed daily
 * observations. An execution-time quote and LLM narrative cannot prove what was
 * true at a declared horizon, so they are never used to finalize an outcome.
 */

import {
  getDailyBarsForPeriod,
  type YahooDailyBar,
} from "./yahooProxy";
import { getCoinOHLC, type CoinOHLCBar } from "./coingeckoProxy";
import { ledgerScoreDirection } from "../shared/clientVocabulary";
import {
  equitySessionCloseMs,
  etSessionDate,
} from "../shared/completedBars";
import { getDb } from "./db";
import { decisionLedger } from "../drizzle/schema";
import { eq, and } from "drizzle-orm";
import {
  decisionLedgerOutcomeProvenanceKey,
  decisionLedgerOutcomeProvenanceValues,
  type DecisionLedgerAutomatedOutcome,
  type DecisionLedgerOutcomeProvenanceInput,
} from "./decisionLedgerProvenance";
import { decisionLedgerOutcomeProvenance } from "../drizzle/decisionOutcomeProvenanceSchema";

const DAY_MS = 24 * 60 * 60 * 1000;
const STOCK_ENTRY_LOOKBACK_MS = 14 * DAY_MS;
const STOCK_HORIZON_GRACE_MS = 14 * DAY_MS;
const CRYPTO_ENTRY_LOOKBACK_MS = 2 * DAY_MS;
const CRYPTO_HORIZON_GRACE_MS = 2 * DAY_MS;
const CRYPTO_MAX_HISTORY_MS = 366 * DAY_MS;

// ── Timeframe parsing ─────────────────────────────────────────────────────────

/**
 * Parse a human-readable timeframe string into milliseconds.
 * Conservative: if ambiguous, returns the LONGER duration so we wait longer
 * before evaluating (avoids premature incorrect verdicts).
 */
export function parseTimeframeMs(timeframe: string): number {
  const t = timeframe.toLowerCase().trim();

  if (t.includes("intraday") || t.includes("same day") || t.includes("today")) {
    return DAY_MS;
  }

  const dayRange = t.match(/(\d+)(?:\s*[-–]\s*(\d+))?\s*day/);
  if (dayRange) {
    const upper = dayRange[2] ? parseInt(dayRange[2]) : parseInt(dayRange[1]);
    return upper * DAY_MS;
  }

  const weekRange = t.match(/(\d+)(?:\s*[-–]\s*(\d+))?\s*week/);
  if (weekRange) {
    const upper = weekRange[2] ? parseInt(weekRange[2]) : parseInt(weekRange[1]);
    return upper * 7 * DAY_MS;
  }

  const monthRange = t.match(/(\d+)(?:\s*[-–]\s*(\d+))?\s*month/);
  if (monthRange) {
    const upper = monthRange[2] ? parseInt(monthRange[2]) : parseInt(monthRange[1]);
    return upper * 30 * DAY_MS;
  }

  if (t.includes("short-term") || t.includes("short term")) return 14 * DAY_MS;
  if (t.includes("medium-term") || t.includes("medium term") || t.includes("mid-term")) return 60 * DAY_MS;
  if (t.includes("long-term") || t.includes("long term")) return 180 * DAY_MS;
  if (t.includes("swing")) return 10 * DAY_MS;
  if (t.includes("position")) return 90 * DAY_MS;

  return 30 * DAY_MS;
}

// ── Evaluation contracts ──────────────────────────────────────────────────────

export type LedgerOutcome = DecisionLedgerAutomatedOutcome;
export type EvaluationState = "verified" | "pending_unverifiable";

export interface LedgerEntryForEvaluation {
  id: number;
  ticker: string | null;
  assetType: "stock" | "crypto" | null;
  verdict: string;
  opportunityScore: number;
  confidence: number;
  primaryDriver: string;
  expectedTimeframe: string;
  priceAtEntry: number | null;
  createdAt: Date;
  recommendationType?: string | null;
}

export interface HorizonEvaluationSources {
  getStockDailyBars(
    ticker: string,
    startDate: string,
    endDate: string
  ): Promise<YahooDailyBar[]>;
  getCryptoDailyBars(ticker: string, days: number): Promise<CoinOHLCBar[]>;
}

const liveHorizonEvaluationSources: HorizonEvaluationSources = {
  getStockDailyBars: getDailyBarsForPeriod,
  getCryptoDailyBars: getCoinOHLC,
};

export interface EvaluationResult {
  /** Null means no automatic outcome was finalized; the original row remains pending. */
  outcome: LedgerOutcome | null;
  evaluationState: EvaluationState;
  evaluationNotes: string;
  priceAtResolution: number | null;
  elapsedMs: number;
  provenance: DecisionLedgerOutcomeProvenanceInput;
}

type PriceObservation = Readonly<{
  price: number;
  /** Provider-supplied timestamp, not a synthesized session close. */
  observedAt: Date;
  /** Timestamp used only to decide whether a bar is before/after issuance/horizon. */
  selectionAt: Date;
}>;

type SourceEvidence = Readonly<{
  provider: "yahoo_finance_chart_daily" | "coingecko_ohlc_daily";
  entry: PriceObservation;
  horizon: PriceObservation;
  evidence: Record<string, unknown>;
}>;

function finitePositive(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

function validDate(value: Date): boolean {
  return Number.isFinite(value.getTime());
}

function isoDate(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

function stockSelectionTime(bar: YahooDailyBar): Date | null {
  if (!Number.isFinite(bar.timestamp)) return null;
  const sessionDate = etSessionDate(bar.timestamp);
  if (!sessionDate) return null;
  const closeMs = equitySessionCloseMs(sessionDate);
  return closeMs == null ? null : new Date(closeMs);
}

function sourceFailureResult(
  entry: LedgerEntryForEvaluation,
  now: Date,
  horizonAt: Date,
  reason: string,
  sourceProvider: DecisionLedgerOutcomeProvenanceInput["sourceProvider"]
): EvaluationResult {
  const elapsedMs = Math.max(0, now.getTime() - entry.createdAt.getTime());
  const originalStoredEntryPrice = finitePositive(entry.priceAtEntry)
    ? entry.priceAtEntry
    : null;
  const notes = `Automatic outcome remains pending: ${reason.replaceAll("_", " ")}. No auditable source-backed as-of/horizon price pair was recorded.`;

  return {
    outcome: null,
    evaluationState: "pending_unverifiable",
    evaluationNotes: notes,
    priceAtResolution: null,
    elapsedMs,
    provenance: {
      decisionLedgerId: entry.id,
      evaluationState: "pending_unverifiable",
      sourceProvider,
      assetType: entry.assetType,
      assetSymbol: entry.ticker?.toUpperCase() ?? null,
      originalIssuedAt: entry.createdAt,
      horizonAt,
      entryObservationAt: null,
      entryPrice: null,
      horizonObservationAt: null,
      horizonPrice: null,
      returnPct: null,
      outcome: null,
      receivedAt: now,
      reason,
      evidence: {
        selectionRule: "horizon_daily_close_v1",
        originalIssuedAt: entry.createdAt.toISOString(),
        declaredTimeframe: entry.expectedTimeframe,
        designatedHorizonAt: horizonAt.toISOString(),
        originalStoredEntryPrice,
        originalStoredEntryPriceStatus: originalStoredEntryPrice == null
          ? "missing"
          : "unverified_legacy_row_not_used_for_scoring",
        receiptMeaning: "Time the evaluator received the adapter result; not a provider observation time.",
      },
    },
  };
}

async function stockSourceEvidence(
  entry: LedgerEntryForEvaluation,
  issuedAt: Date,
  horizonAt: Date,
  sources: HorizonEvaluationSources
): Promise<SourceEvidence | null> {
  if (!entry.ticker) return null;
  const startDate = isoDate(issuedAt.getTime() - STOCK_ENTRY_LOOKBACK_MS);
  const endDate = isoDate(horizonAt.getTime() + STOCK_HORIZON_GRACE_MS);
  const bars = await sources.getStockDailyBars(entry.ticker, startDate, endDate);
  const observations = bars
    .filter(bar => finitePositive(bar.close))
    .map(bar => ({ bar, selectionAt: stockSelectionTime(bar) }))
    .filter((item): item is { bar: YahooDailyBar; selectionAt: Date } => item.selectionAt != null)
    .map(({ bar, selectionAt }) => ({
      price: bar.close,
      observedAt: new Date(bar.timestamp),
      selectionAt,
    }))
    .filter(item => validDate(item.observedAt))
    .sort((left, right) => left.selectionAt.getTime() - right.selectionAt.getTime());

  const entryObservation = observations
    .filter(item => item.selectionAt.getTime() <= issuedAt.getTime())
    .at(-1);
  const horizonObservation = observations.find(item =>
    item.selectionAt.getTime() >= horizonAt.getTime()
    && item.selectionAt.getTime() <= horizonAt.getTime() + STOCK_HORIZON_GRACE_MS
  );
  if (!entryObservation || !horizonObservation) return null;

  return {
    provider: "yahoo_finance_chart_daily",
    entry: entryObservation,
    horizon: horizonObservation,
    evidence: {
      rangeRequested: { startDate, endDate },
      entrySelection: "latest completed NYSE session close at or before original issuance",
      horizonSelection: "first completed NYSE session close at or after designated horizon, within 14 calendar days",
      entrySelectionAt: entryObservation.selectionAt.toISOString(),
      horizonSelectionAt: horizonObservation.selectionAt.toISOString(),
    },
  };
}

async function cryptoSourceEvidence(
  entry: LedgerEntryForEvaluation,
  issuedAt: Date,
  horizonAt: Date,
  now: Date,
  sources: HorizonEvaluationSources
): Promise<SourceEvidence | null> {
  if (!entry.ticker) return null;
  const requiredHistoryMs = now.getTime() - (issuedAt.getTime() - CRYPTO_ENTRY_LOOKBACK_MS);
  if (requiredHistoryMs > CRYPTO_MAX_HISTORY_MS) return null;
  const days = Math.max(3, Math.ceil(requiredHistoryMs / DAY_MS) + 1);
  const bars = await sources.getCryptoDailyBars(entry.ticker, days);
  const observations = bars
    .filter(bar => finitePositive(bar.close) && Number.isFinite(bar.timestamp))
    .map(bar => ({
      price: bar.close,
      observedAt: new Date(bar.timestamp),
      selectionAt: new Date(bar.timestamp),
    }))
    .filter(item => validDate(item.observedAt))
    .sort((left, right) => left.selectionAt.getTime() - right.selectionAt.getTime());

  const entryObservation = observations
    .filter(item => item.selectionAt.getTime() <= issuedAt.getTime())
    .at(-1);
  const horizonObservation = observations.find(item =>
    item.selectionAt.getTime() >= horizonAt.getTime()
    && item.selectionAt.getTime() <= horizonAt.getTime() + CRYPTO_HORIZON_GRACE_MS
  );
  if (!entryObservation || !horizonObservation) return null;

  return {
    provider: "coingecko_ohlc_daily",
    entry: entryObservation,
    horizon: horizonObservation,
    evidence: {
      requestedDays: days,
      entrySelection: "latest provider daily candle close at or before original issuance",
      horizonSelection: "first provider daily candle close at or after designated horizon, within 2 calendar days",
      entrySelectionAt: entryObservation.selectionAt.toISOString(),
      horizonSelectionAt: horizonObservation.selectionAt.toISOString(),
    },
  };
}

/** Returns the expected market direction; neutral or unestablished means unscorable. */
function verdictDirection(
  verdict: string,
  recommendationType?: string | null
): 1 | -1 | 0 {
  return ledgerScoreDirection({ verdict, recommendationType });
}

function scoreHorizonEvidence(
  entry: LedgerEntryForEvaluation,
  now: Date,
  horizonAt: Date,
  evidence: SourceEvidence
): EvaluationResult {
  const direction = verdictDirection(entry.verdict, entry.recommendationType);
  const observedReturnPct = Number(
    (((evidence.horizon.price - evidence.entry.price) / evidence.entry.price) * 100).toFixed(12)
  );
  if (direction === 0) {
    const elapsedMs = Math.max(0, now.getTime() - entry.createdAt.getTime());
    return {
      outcome: null,
      evaluationState: "pending_unverifiable",
      evaluationNotes: "Automatic outcome remains pending: unestablished direction. Source-backed daily observations were retained, but no deterministic directional scoring rule applies.",
      priceAtResolution: null,
      elapsedMs,
      provenance: {
        decisionLedgerId: entry.id,
        evaluationState: "pending_unverifiable",
        sourceProvider: evidence.provider,
        assetType: entry.assetType,
        assetSymbol: entry.ticker?.toUpperCase() ?? null,
        originalIssuedAt: entry.createdAt,
        horizonAt,
        entryObservationAt: evidence.entry.observedAt,
        entryPrice: evidence.entry.price,
        horizonObservationAt: evidence.horizon.observedAt,
        horizonPrice: evidence.horizon.price,
        returnPct: observedReturnPct,
        outcome: null,
        receivedAt: now,
        reason: "unestablished_direction",
        evidence: {
          selectionRule: "horizon_daily_close_v1",
          originalIssuedAt: entry.createdAt.toISOString(),
          declaredTimeframe: entry.expectedTimeframe,
          designatedHorizonAt: horizonAt.toISOString(),
          sourceProvider: evidence.provider,
          entryObservation: {
            observedAt: evidence.entry.observedAt.toISOString(),
            selectionAt: evidence.entry.selectionAt.toISOString(),
            close: evidence.entry.price,
          },
          horizonObservation: {
            observedAt: evidence.horizon.observedAt.toISOString(),
            selectionAt: evidence.horizon.selectionAt.toISOString(),
            close: evidence.horizon.price,
          },
          receiptMeaning: "Time the evaluator received the adapter result; not a provider observation time.",
          ...evidence.evidence,
        },
      },
    };
  }

  const priceChange = (evidence.horizon.price - evidence.entry.price) / evidence.entry.price;
  const priceMove = direction * priceChange;
  let outcome: LedgerOutcome;
  if (priceMove >= 0.06) outcome = "correct";
  else if (priceMove >= 0.02) outcome = "partially_correct";
  else if (priceMove <= -0.06) outcome = "incorrect";
  else if (priceMove <= -0.02) outcome = "partially_correct";
  else outcome = "still_active";

  const pct = (priceChange * 100).toFixed(2);
  const directionLabel = direction === 1 ? "bullish" : "bearish";
  const horizonPrice = evidence.horizon.price;
  const notes = `${entry.ticker?.toUpperCase() ?? "Asset"} moved ${pct}% between the source-backed entry and horizon daily closes, evaluated as ${outcome.replaceAll("_", " ")} for the ${directionLabel} recommendation. Provider: ${evidence.provider}. This automated evaluation is informational only.`;
  const elapsedMs = Math.max(0, now.getTime() - entry.createdAt.getTime());

  return {
    outcome,
    evaluationState: "verified",
    evaluationNotes: notes,
    priceAtResolution: horizonPrice,
    elapsedMs,
    provenance: {
      decisionLedgerId: entry.id,
      evaluationState: "verified",
      sourceProvider: evidence.provider,
      assetType: entry.assetType,
      assetSymbol: entry.ticker?.toUpperCase() ?? null,
      originalIssuedAt: entry.createdAt,
      horizonAt,
      entryObservationAt: evidence.entry.observedAt,
      entryPrice: evidence.entry.price,
      horizonObservationAt: evidence.horizon.observedAt,
      horizonPrice,
      returnPct: observedReturnPct,
      outcome,
      receivedAt: now,
      reason: "horizon_observation_verified",
      evidence: {
        selectionRule: "horizon_daily_close_v1",
        originalIssuedAt: entry.createdAt.toISOString(),
        declaredTimeframe: entry.expectedTimeframe,
        designatedHorizonAt: horizonAt.toISOString(),
        sourceProvider: evidence.provider,
        entryObservation: {
          observedAt: evidence.entry.observedAt.toISOString(),
          selectionAt: evidence.entry.selectionAt.toISOString(),
          close: evidence.entry.price,
        },
        horizonObservation: {
          observedAt: evidence.horizon.observedAt.toISOString(),
          selectionAt: evidence.horizon.selectionAt.toISOString(),
          close: horizonPrice,
        },
        returnPct: observedReturnPct,
        originalStoredEntryPrice: finitePositive(entry.priceAtEntry)
          ? entry.priceAtEntry
          : null,
        originalStoredEntryPriceStatus: "unverified_legacy_row_not_used_for_scoring",
        receiptMeaning: "Time the evaluator received the adapter result; not a provider observation time.",
        ...evidence.evidence,
      },
    },
  };
}

/**
 * Evaluates one entry from completed, provider-timestamped daily bars. It never
 * asks an LLM or reads a current quote. Missing source data produces a durable
 * pending/unverifiable receipt rather than a relabelled original outcome.
 */
export async function evaluateLedgerEntry(
  entry: LedgerEntryForEvaluation,
  options: {
    now?: Date;
    sources?: HorizonEvaluationSources;
  } = {}
): Promise<EvaluationResult> {
  const now = options.now ?? new Date();
  const sources = options.sources ?? liveHorizonEvaluationSources;
  const horizonAt = new Date(
    entry.createdAt.getTime() + parseTimeframeMs(entry.expectedTimeframe)
  );

  if (!validDate(entry.createdAt) || !validDate(now) || !validDate(horizonAt)) {
    return sourceFailureResult(entry, now, horizonAt, "invalid_issuance_or_horizon", null);
  }
  if (entry.createdAt.getTime() > now.getTime()) {
    return sourceFailureResult(entry, now, horizonAt, "original_issuance_in_future", null);
  }
  if (!entry.ticker || !entry.assetType) {
    return sourceFailureResult(entry, now, horizonAt, "asset_not_supported_for_horizon_price_evaluation", null);
  }

  try {
    const evidence = entry.assetType === "stock"
      ? await stockSourceEvidence(entry, entry.createdAt, horizonAt, sources)
      : await cryptoSourceEvidence(entry, entry.createdAt, horizonAt, now, sources);
    // In production this is captured after the adapter resolves. Tests pass a
    // fixed value through `now` so their receipt evidence remains reproducible.
    const sourceReceiptAt = options.now ?? new Date();
    if (!evidence) {
      const sourceProvider = entry.assetType === "stock"
        ? "yahoo_finance_chart_daily"
        : "coingecko_ohlc_daily";
      return sourceFailureResult(entry, sourceReceiptAt, horizonAt, "horizon_or_entry_observation_unavailable", sourceProvider);
    }
    return scoreHorizonEvidence(entry, sourceReceiptAt, horizonAt, evidence);
  } catch {
    const sourceReceiptAt = options.now ?? new Date();
    const sourceProvider = entry.assetType === "stock"
      ? "yahoo_finance_chart_daily"
      : "coingecko_ohlc_daily";
    return sourceFailureResult(entry, sourceReceiptAt, horizonAt, "source_fetch_failed", sourceProvider);
  }
}

// ── Batch evaluation (called by heartbeat) ────────────────────────────────────

export interface DecisionLedgerEvaluationPersistence {
  pendingEntries(): Promise<LedgerEntryForEvaluation[]>;
  /**
   * Inserts the deterministic receipt and, for a verified outcome, conditionally
   * finalizes the original row in the same database transaction.
   */
  persistEvaluation(
    entryId: number,
    result: EvaluationResult
  ): Promise<DecisionLedgerEvaluationPersistenceResult>;
}

export type DecisionLedgerEvaluationPersistenceResult =
  | "finalized"
  | "unverifiable_recorded"
  | "already_recorded"
  | "manual_resolution";

export class DecisionLedgerOutcomeFinalizationConflictError extends Error {
  constructor(entryId: number) {
    super(`Decision Ledger entry ${entryId} was no longer pending for automatic finalization.`);
    this.name = "DecisionLedgerOutcomeFinalizationConflictError";
  }
}

/** Explicit fault hook used only by disposable-SQL recovery regressions. */
export interface DecisionLedgerPersistenceTestHooks {
  afterReceiptInserted?: () => Promise<void> | void;
}

function mysqlAffectedRows(result: unknown): number {
  if (Array.isArray(result)) {
    const header = result[0] as { affectedRows?: unknown } | undefined;
    if (typeof header?.affectedRows === "number") return header.affectedRows;
  }
  if (result && typeof result === "object" && "affectedRows" in result) {
    const rows = (result as { affectedRows?: unknown }).affectedRows;
    if (typeof rows === "number") return rows;
  }
  return 0;
}

function isDuplicateKeyError(error: unknown): boolean {
  let current = error;
  for (let depth = 0; depth < 4; depth += 1) {
    if (!current || typeof current !== "object") return false;
    if ("code" in current && (current as { code?: unknown }).code === "ER_DUP_ENTRY") {
      return true;
    }
    current = "cause" in current ? (current as { cause?: unknown }).cause : undefined;
  }
  return false;
}

/**
 * This deliberately small structural type keeps the evaluator directly
 * testable against Drizzle's mysql2 connection without changing server/db.ts.
 */
type DrizzleLedgerTransaction = {
  insert: (...args: any[]) => {
    values: (values: Record<string, unknown>) => Promise<unknown>;
  };
  update: (...args: any[]) => {
    set: (values: Record<string, unknown>) => {
      where: (condition: unknown) => Promise<unknown>;
    };
  };
};

export function createDrizzleDecisionLedgerPersistence(
  database: unknown
  , hooks: DecisionLedgerPersistenceTestHooks = {}
): DecisionLedgerEvaluationPersistence {
  const db = database as {
    select: () => {
      from: (table: typeof decisionLedger) => {
        where: (condition: unknown) => { limit: (count: number) => Promise<LedgerEntryForEvaluation[]> };
      };
    };
    transaction: <T>(
      callback: (tx: DrizzleLedgerTransaction) => Promise<T>
    ) => Promise<T>;
  };

  return {
    pendingEntries: () =>
      db
        .select()
        .from(decisionLedger)
        .where(
          and(
            eq(decisionLedger.outcome, "pending"),
            eq(decisionLedger.autoEvaluated, false)
          )
        )
        .limit(100),
    async persistEvaluation(entryId, result) {
      const provenance = {
        ...result.provenance,
        provenanceKey: decisionLedgerOutcomeProvenanceKey(result.provenance),
      };
      try {
        return await db.transaction(async tx => {
          try {
            await tx
              .insert(decisionLedgerOutcomeProvenance)
              .values(decisionLedgerOutcomeProvenanceValues(provenance));
          } catch (error) {
            // A previous committed worker owns this deterministic horizon/state
            // receipt. It must not be reinterpreted or overwritten here.
            if (isDuplicateKeyError(error)) return "already_recorded";
            throw error;
          }

          await hooks.afterReceiptInserted?.();
          if (result.outcome == null) return "unverifiable_recorded";

          const updated = await tx
            .update(decisionLedger)
            .set({
              outcome: result.outcome,
              evaluationNotes: result.evaluationNotes,
              priceAtResolution: result.priceAtResolution,
              elapsedMs: result.elapsedMs,
              autoEvaluated: true,
              evaluatedAt: result.provenance.receivedAt,
              resolvedAt: result.provenance.receivedAt,
            })
            .where(and(
              eq(decisionLedger.id, entryId),
              eq(decisionLedger.outcome, "pending"),
              eq(decisionLedger.autoEvaluated, false)
            ));
          if (mysqlAffectedRows(updated) !== 1) {
            // Throwing inside the transaction rolls the just-inserted receipt
            // back too, so a retry has one deterministic repair path.
            throw new DecisionLedgerOutcomeFinalizationConflictError(entryId);
          }
          return "finalized";
        });
      } catch (error) {
        if (error instanceof DecisionLedgerOutcomeFinalizationConflictError) {
          return "manual_resolution";
        }
        throw error;
      }
    },
  };
}

export type ExpiredLedgerEvaluationSummary = {
  evaluated: number;
  skipped: number;
  unverifiable: number;
  errors: number;
  results: Array<{
    id: number;
    outcome: LedgerOutcome | "pending";
    ticker: string | null;
    evaluationState: EvaluationState;
  }>;
};

/**
 * Evaluates only elapsed pending entries. The companion receipt and any automatic
 * finalization occur in one transaction. If either statement fails, the original
 * row remains pending and no partial automatic receipt survives (fail closed).
 */
export async function evaluateExpiredEntries(options: {
  now?: Date;
  sources?: HorizonEvaluationSources;
  persistence?: DecisionLedgerEvaluationPersistence;
  getDatabase?: () => Promise<unknown | null>;
} = {}): Promise<ExpiredLedgerEvaluationSummary> {
  const now = options.now ?? new Date();
  let persistence = options.persistence;
  if (!persistence) {
    const database = await (options.getDatabase ?? getDb)();
    if (!database) {
      return { evaluated: 0, skipped: 0, unverifiable: 0, errors: 0, results: [] };
    }
    persistence = createDrizzleDecisionLedgerPersistence(database);
  }

  const pending = await persistence.pendingEntries();
  let evaluated = 0;
  let skipped = 0;
  let unverifiable = 0;
  let errors = 0;
  const results: ExpiredLedgerEvaluationSummary["results"] = [];

  for (const entry of pending) {
    try {
      const timeframeMs = parseTimeframeMs(entry.expectedTimeframe);
      const ageMs = now.getTime() - entry.createdAt.getTime();
      if (ageMs < timeframeMs) {
        skipped++;
        continue;
      }

      const result = await evaluateLedgerEntry(entry, {
        now,
        sources: options.sources,
      });

      const persisted = await persistence.persistEvaluation(entry.id, result);
      if (result.outcome == null) {
        if (persisted === "manual_resolution") {
          skipped++;
          continue;
        }
        unverifiable++;
        results.push({
          id: entry.id,
          outcome: "pending",
          ticker: entry.ticker,
          evaluationState: result.evaluationState,
        });
        continue;
      }

      if (persisted !== "finalized") {
        // Another evaluator committed the deterministic receipt or a manual
        // resolver won the compare-and-set. Neither is an evaluator error.
        skipped++;
        continue;
      }
      results.push({
        id: entry.id,
        outcome: result.outcome,
        ticker: entry.ticker,
        evaluationState: result.evaluationState,
      });
      evaluated++;
    } catch (error) {
      console.error(`[LedgerEval] Error evaluating entry ${entry.id}:`, error);
      errors++;
    }
  }

  console.log(
    `[LedgerEval] Batch complete: evaluated=${evaluated}, skipped=${skipped}, unverifiable=${unverifiable}, errors=${errors}`
  );
  return { evaluated, skipped, unverifiable, errors, results };
}
