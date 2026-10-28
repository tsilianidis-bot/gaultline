/**
 * Client vocabulary for FAULTLINE release-candidate responses.
 *
 * The denylist is the only place these trade-class tokens are listed as data.
 * A tRPC response transformer rewrites an exact match to an allowlisted
 * condition label before the value reaches a customer. Internal scoring uses
 * `internalDirection` (`positive` | `negative` | `mixed` | `unestablished`),
 * which is not a trade class.
 *
 * Open owner decision: the ASHA words ACQUIRE, ADD GRADUALLY, KEEP, REDUCE,
 * and PASS OVER do not have an approved customer vocabulary. This module
 * maps them to condition labels for the release candidate only.
 *
 * Open owner decision: adminProcedure and ownerOrAdminProcedure are not
 * transformed. Whether an admin or owner screen should show a stored token
 * is undecided. Customer procedures, including simulation reads, are transformed.
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

const PRESERVE_KEYS = new Set(["internalDirection"]);

export function neutralizeClientPayload<T>(value: T): T {
  return walk(value) as T;
}

function walk(value: unknown): unknown {
  if (typeof value === "string") return neutralConditionLabel(value);
  if (typeof value !== "object" || value == null) return value;
  if (value instanceof Date) return value;
  if (Array.isArray(value)) return value.map(walk);
  const out: Record<string, unknown> = {};
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    if (PRESERVE_KEYS.has(key)) {
      out[key] = child;
      continue;
    }
    out[key] = walk(child);
  }
  return out;
}

/** True when a client JSON payload still contains a denied trade-class token. */
export function clientPayloadHasDeniedToken(json: string): boolean {
  const pattern = new RegExp(`\\b(?:${Array.from(DENYLIST).map(escapeRegExp).join("|")})\\b`, "i");
  return pattern.test(json);
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
