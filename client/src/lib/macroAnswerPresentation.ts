/**
 * Macro Answer (/app/act/deep, /app/discover) — presentation-only helpers.
 *
 * Credibility + information-hierarchy rules (James, 2026-10-05):
 *  - The canonical risk classification comes only from pressureBand(pressureIndex);
 *    direction comes only from the canonical pressureDirection field. A colour
 *    bucket ("TRANSITIONING") never stands in for either.
 *  - "LIVE" is reserved for the governed integrity label; engine coverage is
 *    counted from canonicalState.engines[].freshnessStatus, never hard-coded.
 *  - Model prose never carries scenario numbers: the governed probability
 *    contract (#60) is the only scenario source, and it is UNCALIBRATED.
 *  - Analog similarity is shown only when the canonical analog gate
 *    (marketState.outlook.topAnalog) qualifies one — the same gate NOW uses.
 *  - Historical percentile is relative rarity over the stated monthly record,
 *    not Pressure Index severity.
 *
 * Nothing here computes, rescales or defaults an engine value.
 */
import { pressureBand } from "@shared/pressureBands";
import { formatOrdinal } from "@shared/historicalPercentile";
import type { GovernedEarlyWarningPresentation } from "@shared/earlyWarningPresentation";
import { NO_HIGH_CONFIDENCE_ANALOG_TEXT } from "@shared/nowInterpretationCopy";
import { pressureVectorLabel } from "@shared/pressureVectorLabels";

export { NO_HIGH_CONFIDENCE_ANALOG_TEXT };

// ── Top answer labels ──────────────────────────────────────────────────────────

export const TOP_ANSWER_LABELS = {
  pressureIndex: "PRESSURE INDEX",
  riskRegime: "RISK REGIME",
  regimeDirection: "REGIME DIRECTION",
  materialEarlyWarning: "MATERIAL EARLY WARNING",
  confidence: "CONFIDENCE",
  bias: "BIAS",
} as const;

const UNAVAILABLE = "UNAVAILABLE";

function finiteScore(value: number | null | undefined): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export function pressureIndexText(pressureIndex: number | null | undefined): string {
  const score = finiteScore(pressureIndex);
  return score === null ? UNAVAILABLE : `${Math.round(score)} / 100`;
}

/** Canonical risk classification — pressureBand() is the single source (#70). */
export function riskRegimeText(pressureIndex: number | null | undefined): string {
  const score = finiteScore(pressureIndex);
  return score === null ? UNAVAILABLE : pressureBand(score).regime;
}

/** Band colour for the risk regime cell (same pressureBand() call). */
export function riskRegimeColor(pressureIndex: number | null | undefined): string {
  const score = finiteScore(pressureIndex);
  return score === null ? "#94A3B8" : pressureBand(score).color;
}

/** Canonical direction of change (canonicalState.pressureDirection). */
export function regimeDirectionText(direction: string | null | undefined): string {
  const d = String(direction ?? "").trim();
  if (!d || /^unknown$/i.test(d)) return "NOT ESTABLISHED";
  return d.toUpperCase();
}

// ── Data status (replaces "DATA · LIVE") ──────────────────────────────────────

export type EngineFreshnessLike = { freshnessStatus?: string | null };

export interface EngineCoverage {
  total: number;
  /** Count per freshness status, upper-cased, in display order. */
  byStatus: Array<{ status: string; count: number }>;
  current: number;
  notCurrent: number;
}

const STATUS_ORDER = ["CURRENT", "DELAYED", "STALE", "FALLBACK", "UNAVAILABLE"];

export function engineCoverage(engines: readonly EngineFreshnessLike[] | null | undefined): EngineCoverage {
  const counts = new Map<string, number>();
  for (const engine of engines ?? []) {
    const status = String(engine?.freshnessStatus ?? "UNKNOWN").trim().toUpperCase() || "UNKNOWN";
    counts.set(status, (counts.get(status) ?? 0) + 1);
  }
  const statuses = Array.from(counts.keys()).sort((a, b) => {
    const ia = STATUS_ORDER.indexOf(a);
    const ib = STATUS_ORDER.indexOf(b);
    return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib) || a.localeCompare(b);
  });
  const total = (engines ?? []).length;
  const current = counts.get("CURRENT") ?? 0;
  return { total, byStatus: statuses.map(status => ({ status, count: counts.get(status) ?? 0 })), current, notCurrent: total - current };
}

/** e.g. "ENGINE COVERAGE · 2 CURRENT · 4 DELAYED" — counts are whatever the canonical state carries. */
export function engineCoverageText(coverage: EngineCoverage): string {
  if (coverage.total === 0) return "ENGINE COVERAGE · UNAVAILABLE";
  const parts = coverage.byStatus.map(({ status, count }) => `${count} ${status}`);
  if (!coverage.byStatus.some(s => s.status === "CURRENT")) parts.unshift("0 CURRENT");
  return `ENGINE COVERAGE · ${parts.join(" · ")}`;
}

export function engineCoverageDetail(coverage: EngineCoverage, engines: ReadonlyArray<EngineFreshnessLike & { engineName?: string | null; engineId?: string }>): string {
  const lagging = engines
    .filter(e => String(e.freshnessStatus ?? "").toUpperCase() !== "CURRENT")
    .map(e => `${e.engineId ? pressureVectorLabel(e.engineId, e.engineName) : (e.engineName ?? "engine")} (${String(e.freshnessStatus ?? "UNKNOWN").toUpperCase()})`);
  return `${coverage.total} canonical engines. ${lagging.length ? `Not current: ${lagging.join(", ")}.` : "All engines current."}`;
}

/** The governed customer integrity label (LIVE only when truly live). */
export function canonicalStateText(integrityLabel: string | null | undefined): string {
  return `CANONICAL STATE · ${String(integrityLabel ?? UNAVAILABLE).toUpperCase()}`;
}

// ── Early warning + invalidation ─────────────────────────────────────────────

export function materialEarlyWarningText(presentation: GovernedEarlyWarningPresentation | null | undefined): string {
  if (!presentation) return UNAVAILABLE;
  if (presentation.kind === "NO_MATERIAL_EARLY_WARNING") return "NONE QUALIFIED";
  if (presentation.kind === "ACTIVE_GOVERNED_WARNING") return presentation.conciseTitle.toUpperCase();
  return "EVALUATION UNAVAILABLE";
}

export const NO_QUALIFYING_THESIS_INVALIDATION_TEXT =
  "No active material thesis currently qualifies for a governed invalidation trigger." as const;
export const NO_GOVERNED_INVALIDATION_PLAN_TEXT =
  "A governed warning is active, but no governed invalidation plan is defined for it." as const;
export const INVALIDATION_EVALUATION_UNAVAILABLE_TEXT =
  "Governed invalidation conditions cannot be evaluated for the current state." as const;

/**
 * Governed invalidation conditions exist only on a qualified, active Phase 10
 * warning (Phase 9 plan). Model-written invalidation text is already withheld
 * by validateInterpretationOutput; it is never displayed here.
 */
export function invalidationLines(presentation: GovernedEarlyWarningPresentation | null | undefined): string[] {
  if (!presentation || presentation.kind === "GOVERNED_EVALUATION_UNAVAILABLE") return [INVALIDATION_EVALUATION_UNAVAILABLE_TEXT];
  if (presentation.kind === "NO_MATERIAL_EARLY_WARNING") return [NO_QUALIFYING_THESIS_INVALIDATION_TEXT];
  const conditions = presentation.invalidationConditions.filter(c => c.trim());
  return conditions.length ? conditions : [NO_GOVERNED_INVALIDATION_PLAN_TEXT];
}

// ── Bias (answer stance) ─────────────────────────────────────────────────────

/** Leading stance of the answer's suggested bias, e.g. "NEUTRAL / WATCH while …" → "NEUTRAL / WATCH". */
export function biasStanceText(suggestedBias: string | null | undefined, finalVerdictAction?: string | null): string {
  const raw = String(suggestedBias ?? "").trim();
  if (raw) {
    const head = raw.split(/\s+(?:while|until|unless|as long as|provided|if)\s+|[,;:.(—–]|\s-\s/i)[0].trim();
    if (head && head.length <= 32) return head.toUpperCase();
  }
  const action = String(finalVerdictAction ?? "").trim();
  return action ? action.toUpperCase() : "NOT STATED";
}

// ── Prose sanitizers (display only) ──────────────────────────────────────────

function splitSentences(text: string): string[] {
  return text.split(/(?<=[.!?])\s+/).filter(s => s.trim() !== "");
}

function filterSentences(text: string, drop: (sentence: string) => boolean, keepNonEmpty: boolean): string {
  const sentences = splitSentences(text);
  const kept = sentences.filter(s => !drop(s));
  if (kept.length === 0 && keepNonEmpty) return text;
  return kept.join(" ").trim();
}

const SCENARIO_NUMBER_PATTERNS: RegExp[] = [
  /\bscenario\s+(?:component|score|weight|vote|share|split|value)s?\b[^.!?]*\d/i,
  /\b(?:bull|bear|neutral|crash|base)(?:ish)?\s+scenario\b[^.!?]{0,30}?\b\d{1,3}(?:\.\d+)?\s*(?:%|\/\s*100|points?\b|\b)/i,
  /\b\d{1,3}(?:\.\d+)?\s*%?\s*(?:bull|bear|neutral|crash)(?:ish)?\s+scenario\b/i,
];

/** True when a sentence carries a scenario number (never governed in model prose). */
export function hasUngovernedScenarioNumber(sentence: string): boolean {
  return SCENARIO_NUMBER_PATTERNS.some(p => p.test(sentence));
}

const ANALOG_SIMILARITY_PATTERNS: RegExp[] = [
  /\b\d{1,3}(?:\.\d+)?\s*%\s*(?:vector\s+|pattern\s+)?(?:similar(?:ity)?|match)\b/i,
  /\bsimilarity\s*(?:score\s*)?(?:of\s*|at\s*|is\s*)?\d{1,3}(?:\.\d+)?\s*%/i,
];

export function hasAnalogSimilarityFigure(sentence: string): boolean {
  return ANALOG_SIMILARITY_PATTERNS.some(p => p.test(sentence));
}

export interface RestatementContext {
  pressureIndex: number | null;
  riskRegime: string | null;
}

const RESTATEMENT_PATTERNS: RegExp[] = [
  /\binsufficient cross-engine (?:evidence|confirmation)\b/i,
  /\bno (?:qualif(?:ied|ying) |governed |active )?material (?:developing |early[- ])?warning\b/i,
  /\bdoes not meet FAULTLINE.{0,3}s qualification requirements for a material\b/i,
  /\bconfidence (?:is |remains )?not (?:yet )?established\b/i,
];

/** A sentence that only restates the top-answer conclusion (PI + regime, no-warning, no-confidence). */
export function isConclusionRestatement(sentence: string, ctx: RestatementContext): boolean {
  if (RESTATEMENT_PATTERNS.some(p => p.test(sentence))) return true;
  const score = finiteScore(ctx.pressureIndex);
  // Only short sentences: a longer one carries other content (a driver, a value) worth keeping.
  if (score === null || !ctx.riskRegime || sentence.length > 140) return false;
  const mentionsIndex = /\bpressure index\b|\bPI\b/i.test(sentence) && new RegExp(`\\b${Math.round(score)}\\b`).test(sentence);
  const regimeWords = ctx.riskRegime.toLowerCase().replace(/\s+risk$/, "");
  const mentionsRegime = new RegExp(`\\b${regimeWords}(?:\\s+risk)?\\b`, "i").test(sentence);
  return mentionsIndex && mentionsRegime;
}

export interface ProseSanitizeContext extends RestatementContext {
  /** Canonical analog gate (marketState.outlook.topAnalog != null). */
  analogQualified: boolean;
}

export function sanitizeProse(text: string, ctx: ProseSanitizeContext, opts: { dedupe: boolean }): string {
  // Scenario numbers and unqualified analog figures are removed outright (may empty the text).
  let out = filterSentences(text, s => hasUngovernedScenarioNumber(s) || (!ctx.analogQualified && hasAnalogSimilarityFigure(s)), false);
  // Conclusion restatements are removed only while something else remains.
  if (opts.dedupe) out = filterSentences(out, s => isConclusionRestatement(s, ctx), true);
  return out;
}

const PROSE_FIELDS = [
  "executiveSummary", "whyThisVerdict", "primaryDriver", "bullCase", "bearCase", "finalVerdictRationale",
  "whatChangesThesis", "historicalAnalog", "historicalAnalogOutcome", "riskSummary", "actionVerdictReason",
  "suggestedBiasCondition",
] as const;
const NO_DEDUPE_FIELDS = new Set<string>(["suggestedAction", "suggestedBias"]);
const PROSE_LIST_FIELDS = [
  "bullKeyDrivers", "bearKeyDrivers", "catalysts", "threats", "keyDrivers", "risks", "watchCatalysts",
  "whyNotBuy", "whyNotSell", "riskFactors", "confidenceReasons",
] as const;

/**
 * Display-only copy of an answer with ungoverned figures and repeated
 * conclusions removed from model prose. The served answer is not mutated.
 */
export function sanitizeMacroAnswerForDisplay<T extends Record<string, any>>(answer: T, ctx: ProseSanitizeContext): T {
  const out: Record<string, any> = { ...answer };
  for (const key of [...PROSE_FIELDS, ...Array.from(NO_DEDUPE_FIELDS)]) {
    if (typeof out[key] === "string") out[key] = sanitizeProse(out[key], ctx, { dedupe: !NO_DEDUPE_FIELDS.has(key) });
  }
  for (const key of PROSE_LIST_FIELDS) {
    if (!Array.isArray(out[key])) continue;
    const items = (out[key] as unknown[]).map(item => (typeof item === "string" ? sanitizeProse(item, ctx, { dedupe: false }) : item));
    const nonEmpty = items.filter(item => item !== "");
    const deduped = nonEmpty.filter(item => typeof item !== "string" || !isConclusionRestatement(item, ctx));
    out[key] = deduped.length ? deduped : nonEmpty;
  }
  if (Array.isArray(out.evidenceScores)) {
    out.evidenceScores = out.evidenceScores.map((s: any) => (s && typeof s.explanation === "string"
      ? { ...s, explanation: sanitizeProse(s.explanation, ctx, { dedupe: false }) }
      : s));
  }
  if (out.collectiveReading && typeof out.collectiveReading === "object") {
    const c = { ...out.collectiveReading };
    for (const key of ["summary", "strongestReason", "practicalAction"]) {
      if (typeof c[key] === "string") c[key] = sanitizeProse(c[key], ctx, { dedupe: key === "summary" });
    }
    out.collectiveReading = c;
  }
  if (!ctx.analogQualified) {
    out.historicalAnalog = null;
    out.historicalAnalogOutcome = null;
  }
  return out as T;
}

// ── Evidence Engine (model-interpreted categories) ───────────────────────────

export const EVIDENCE_ENGINE_DESCRIPTOR =
  "Model-interpreted category signals for this answer — not canonical engine scores or engine freshness." as const;

export function evidenceSignalCounts(scores: ReadonlyArray<{ signal: string; explanation?: string | null }>): {
  bullish: number; bearish: number; neutral: number; notApplicable: number; total: number;
} {
  const notApplicable = scores.filter(s => /not applicable/i.test(String(s.explanation ?? ""))).length;
  return {
    bullish: scores.filter(s => s.signal === "bullish").length,
    bearish: scores.filter(s => s.signal === "bearish").length,
    neutral: scores.filter(s => s.signal === "neutral").length,
    notApplicable,
    total: scores.length,
  };
}

// ── Historical position + analogs ────────────────────────────────────────────

export const HISTORICAL_PERCENTILE_TOOLTIP =
  "Historical percentile measures relative rarity, not the 0–100 Pressure Index severity level. It is the share of monthly Pressure Index readings in the pressureHistory record that are strictly lower than the current reading." as const;

export interface HistoricalPositionCopy {
  label: string;
  line: string;
  tooltip: string;
}

/** Null when there is no monthly record (the engine's empty-history default of 50 is never shown). */
export function historicalPositionCopy(input: { percentile: number | null | undefined; n: number | null | undefined; dataRange?: string | null }): HistoricalPositionCopy | null {
  const p = finiteScore(input.percentile);
  const n = finiteScore(input.n);
  if (p === null || n === null || n <= 0) return null;
  const rounded = Math.max(0, Math.min(100, Math.round(p)));
  const range = input.dataRange && input.dataRange !== "N/A" ? ` (${input.dataRange})` : "";
  const record = n === 1 ? "the 1 monthly reading" : `the ${Math.round(n)} monthly readings`;
  return {
    label: `HISTORICAL POSITION · ${formatOrdinal(rounded)} percentile`,
    line: `The current reading is higher than ${rounded}% of ${record} on record${range}.`,
    tooltip: HISTORICAL_PERCENTILE_TOOLTIP,
  };
}

export const HISTORICAL_POSITION_UNAVAILABLE = "HISTORICAL POSITION · Not available" as const;

export const ANALOG_SIMILARITY_DESCRIPTOR = "Historical similarity — not forecast probability." as const;
export const ANALOG_NOT_QUALIFIED_DETAIL =
  "Analysis completed; no analog met FAULTLINE’s governed analog threshold, so similarity scores are not shown." as const;

export function analogSimilarityLabel(similarity: number): string {
  return `${Math.round(similarity)}% SIMILARITY`;
}

export const OUTCOME_SPLIT_WITHHELD_TEXT =
  "Outcome split withheld — an uncalibrated historical frequency, not a forecast probability." as const;
