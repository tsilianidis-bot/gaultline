/**
 * Client vocabulary for FAULTLINE release-candidate responses.
 *
 * The denylist is the only place these trade-class tokens are listed as data.
 * Source engines neutralize their own named trade-class fields. The tRPC
 * boundary is a field-name guard only: it never rewrites a value, and it
 * never copies a payload that has nothing to drop. Tickers, notes, titles,
 * ids, side, status, moveType, timeframe, direction, and verdict stay as
 * they are. `internalDirection` (`positive` | `negative` | `mixed` |
 * `unestablished`) is the scoring field.
 *
 * Open owner decision: the ASHA words ACQUIRE, ADD GRADUALLY, KEEP, REDUCE,
 * and PASS OVER do not have an approved customer vocabulary. `neutralConditionLabel`
 * still maps an exact token for ledger scoring. The guard does not invent a
 * display label for them.
 *
 * Open owner decision: adminProcedure, ownerOrAdminProcedure, and the
 * ownerSim / simPortfolio paths are not guarded. Whether those screens should
 * show a stored token is undecided.
 */

export const UPPER_SIDE_CONDITION = "Upper-side condition";
export const LOWER_SIDE_CONDITION = "Lower-side condition";
export const MIXED_CONDITION = "Mixed condition";
export const UNSET_CONDITION = "Condition not established";

export const CONDITION_ALLOWLIST = [
  UPPER_SIDE_CONDITION,
  LOWER_SIDE_CONDITION,
  MIXED_CONDITION,
  UNSET_CONDITION,
] as const;

export type ConditionLabel = (typeof CONDITION_ALLOWLIST)[number];

export type InternalDirection = "positive" | "negative" | "mixed" | "unestablished";

const UPPER = new Set([
  "STRONG BUY",
  "BUY",
  "BUY NOW",
  "ACCUMULATE",
  "ADD",
  "ADD GRADUALLY",
  "ACQUIRE",
  "OVERWEIGHT",
  "STRONG-UP",
  "UP-EDGE",
  "BUILD-EDGE",
]);

const LOWER = new Set([
  "STRONG SELL",
  "SELL",
  "STRONG REDUCE",
  "REDUCE",
  "TRIM",
  "AVOID",
  "UNDERWEIGHT",
  "LIGHT-EDGE",
  "DOWN-EDGE",
  "LOWER-EDGE",
  "LOWEST-EDGE",
]);

const MIXED = new Set([
  "HOLD",
  "WATCH",
  "WAIT",
  "KEEP",
  "UNCHANGED",
  "FLAT-EDGE",
  "OPEN-EDGE",
]);

const UNSET_TOKENS = new Set(["PASS OVER"]);

const DENYLIST = new Set(Array.from(UPPER).concat(Array.from(LOWER), Array.from(MIXED), Array.from(UNSET_TOKENS)));

export function conditionDirection(value: string | null | undefined): InternalDirection {
  const token = (value ?? "").trim().toUpperCase();
  if (!token) return "unestablished";
  if (value === UPPER_SIDE_CONDITION || UPPER.has(token)) return "positive";
  if (value === LOWER_SIDE_CONDITION || LOWER.has(token)) return "negative";
  if (value === MIXED_CONDITION || MIXED.has(token)) return "mixed";
  if (value === UNSET_CONDITION || UNSET_TOKENS.has(token)) return "unestablished";
  return "unestablished";
}

export function neutralConditionLabel(value: string | null | undefined): string {
  if (value == null) return UNSET_CONDITION;
  const trimmed = value.trim();
  if (!trimmed) return value;
  if ((CONDITION_ALLOWLIST as readonly string[]).includes(trimmed)) return trimmed;
  const direction = conditionDirection(trimmed);
  if (DENYLIST.has(trimmed.toUpperCase())) {
    if (direction === "positive") return UPPER_SIDE_CONDITION;
    if (direction === "negative") return LOWER_SIDE_CONDITION;
    if (direction === "mixed") return MIXED_CONDITION;
    return UNSET_CONDITION;
  }
  return trimmed;
}

export function internalDirectionFromText(value: string | null | undefined): InternalDirection {
  return conditionDirection(neutralConditionLabel(value));
}

/** Price-scoring sign for the ledger evaluator. Stored direction wins over the display sentence. */
export function ledgerScoreDirection(entry: {
  verdict: string;
  recommendationType?: string | null;
  internalDirection?: string | null;
}): 1 | -1 | 0 {
  const stored = entry.internalDirection || entry.recommendationType;
  if (stored === "positive") return 1;
  if (stored === "negative") return -1;
  if (stored === "mixed" || stored === "unestablished") return 0;
  const fromVerdict = internalDirectionFromText(entry.verdict);
  if (fromVerdict === "positive") return 1;
  if (fromVerdict === "negative") return -1;
  return 0;
}

export function conditionColor(value: string | null | undefined): string {
  switch (conditionDirection(value)) {
    case "positive": return "#00D4FF";
    case "negative": return "#FF2D55";
    case "mixed": return "#FFD700";
    default: return "#64748B";
  }
}

/** Depth cap so a hostile or cyclic payload cannot walk forever. */
export const CLIENT_PAYLOAD_MAX_DEPTH = 12;

/**
 * Named trade-class fields only. Comparison is trim + lowercase + no spaces,
 * underscores, or hyphens, so " Action ", "ACTION", "final_verdict_action",
 * and "Final Verdict Action" are the same field. direction, verdict, symbol,
 * notes, title, id, side, status, moveType, and timeframe are not in this set.
 */
const GUARDED_FIELDS = new Set([
  "action",
  "actionbias",
  "actionclass",
  "actiontype",
  "class",
  "finalverdictaction",
  "proposedaction",
  "recommendationaction",
  "signalaction",
  "tradeaction",
  "verdictaction",
]);

export function normalizeClientFieldName(key: string): string {
  return key.trim().toLowerCase().replace(/[\s_-]+/g, "");
}

function deniedExactToken(value: string): boolean {
  const token = value.trim().toUpperCase();
  return token.length > 0 && DENYLIST.has(token);
}

function isOpaque(value: object): boolean {
  if (value instanceof Date || value instanceof Map || value instanceof Set || value instanceof URL || value instanceof Error) return true;
  if (typeof Buffer !== "undefined" && Buffer.isBuffer(value)) return true;
  if (ArrayBuffer.isView(value)) return true;
  const proto = Object.getPrototypeOf(value);
  return proto !== Object.prototype && proto !== null;
}

/**
 * Drop a named trade-class field when its value is an exact denied token.
 * The string itself is never rewritten. Map, Set, Buffer, URL, Error, and
 * Date are returned intact. A clean payload is returned as the same reference.
 */
export function guardNamedClientFields<T>(value: T): T {
  return visit(value, 0, new WeakSet()) as T;
}

function visit(value: unknown, depth: number, seen: WeakSet<object>): unknown {
  if (depth > CLIENT_PAYLOAD_MAX_DEPTH) return value;
  if (value == null || typeof value !== "object") return value;
  if (seen.has(value)) return value;
  if (Array.isArray(value)) {
    seen.add(value);
    let copy: unknown[] | null = null;
    for (let index = 0; index < value.length; index += 1) {
      const next = visit(value[index], depth + 1, seen);
      if (next !== value[index]) {
        if (!copy) copy = value.slice();
        copy[index] = next;
      }
    }
    return copy ?? value;
  }
  if (isOpaque(value)) return value;
  seen.add(value);
  const record = value as Record<string, unknown>;
  let copy: Record<string, unknown> | null = null;
  for (const key of Object.keys(record)) {
    const child = record[key];
    const drop = typeof child === "string" && GUARDED_FIELDS.has(normalizeClientFieldName(key)) && deniedExactToken(child);
    if (drop) {
      if (!copy) copy = { ...record };
      delete copy[key];
      continue;
    }
    if (child != null && typeof child === "object") {
      const next = visit(child, depth + 1, seen);
      if (next !== child) {
        if (!copy) copy = { ...record };
        copy[key] = next;
      }
    }
  }
  return copy ?? value;
}

/** @deprecated Use guardNamedClientFields. Kept so existing call sites stay source-compatible. */
export function neutralizeClientPayload<T>(value: T): T {
  return guardNamedClientFields(value);
}

/** True when a client JSON payload still contains a denied trade-class token. */
export function clientPayloadHasDeniedToken(json: string): boolean {
  const pattern = new RegExp(`\\b(?:${Array.from(DENYLIST).map(escapeRegExp).join("|")})\\b`, "i");
  return pattern.test(json);
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
