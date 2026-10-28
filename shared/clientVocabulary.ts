/**
 * Client vocabulary for FAULTLINE release-candidate responses.
 *
 * The denylist is the only place these trade-class tokens are listed as data.
 * Source engines neutralize their own named trade-class fields. The tRPC
 * boundary is a field-name guard. An exact denied token on a named trade
 * field becomes the condition label. `class` and `finalVerdictAction` are
 * removed. Tickers, ids, slugs, and URLs are never rewritten. A clean payload
 * is the same reference. `internalDirection` is the scoring field.
 *
 * Open owner decision: the ASHA words ACQUIRE, ADD GRADUALLY, KEEP, REDUCE,
 * and PASS OVER do not have an approved customer vocabulary. `neutralConditionLabel`
 * still maps an exact token for ledger scoring. The guard does not invent a
 * display label for them.
 *
 * Open owner decision: adminProcedure, ownerOrAdminProcedure, and the
 * admin-gated ownerSim path are not guarded. Public simulation reads are.
 */

export const UPPER_SIDE_CONDITION = "Upper-side condition";
export const LOWER_SIDE_CONDITION = "Lower-side condition";
export const MIXED_CONDITION = "Mixed condition";
export const UNSET_CONDITION = "Condition not established";
/** AssessmentDirection `unchanged` is not a mixed trade condition. */
export const UNCHANGED_LABEL = "Unchanged";

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
  if (trimmed.toUpperCase() === "UNCHANGED") return UNCHANGED_LABEL;
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
  return legacyVerdictScore(entry.verdict);
}

/** Production 1cb5dee scored stored verdict text by substring, not by an exact token. */
function legacyVerdictScore(verdict: string): 1 | -1 | 0 {
  const text = verdict.toLowerCase();
  if (text.includes("bull") || text.includes("buy") || text.includes("long") || text.includes("accumulate") || text.includes("upside")) return 1;
  if (text.includes("bear") || text.includes("sell") || text.includes("short") || text.includes("avoid") || text.includes("downside")) return -1;
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

/** Depth cap so a hostile or cyclic payload cannot walk forever. Past this depth the named fields are still neutralized. */
export const CLIENT_PAYLOAD_MAX_DEPTH = 12;
/**
 * Soft cap. Past this many nodes the walk keeps going and logs once.
 * It does not replace later objects or arrays with null.
 */
export const CLIENT_PAYLOAD_MAX_NODES = 8000;

/**
 * Exact-token fields. Comparison is trim + lowercase + no spaces, underscores,
 * or hyphens. Ticker, id, slug, and URL fields are not in this set.
 */
const LABEL_FIELDS = new Set([
  "action",
  "actionbias",
  "actiontype",
  "direction",
  "entrysignal",
  "exitsignal",
  "proposedaction",
  "recommendation",
  "recommendationaction",
  "signal",
  "signaldirection",
  "signalaction",
  "tradeaction",
  "verdict",
  "verdictaction",
]);

/** Exact tokens on these names are removed. Relabeling them would merge distinct classes or decide the ASHA vocabulary. */
const DROP_FIELDS = new Set([
  "actionclass",
  "class",
  "finalverdictaction",
]);

const VALUE_PRESERVE_FIELDS = new Set([
  "email",
  "guid",
  "href",
  "id",
  "link",
  "name",
  "openid",
  "slug",
  "symbol",
  "ticker",
  "url",
  "xpostid",
]);

export function normalizeClientFieldName(key: string): string {
  return key.trim().toLowerCase().replace(/[\s_-]+/g, "");
}

function deniedExactToken(value: string): boolean {
  const token = value.trim().toUpperCase();
  return token.length > 0 && DENYLIST.has(token);
}

function isOpaque(value: object): boolean {
  if (Array.isArray(value)) return false;
  if (value instanceof Date || value instanceof Map || value instanceof Set || value instanceof URL || value instanceof Error) return true;
  if (typeof Buffer !== "undefined" && Buffer.isBuffer(value)) return true;
  if (ArrayBuffer.isView(value)) return true;
  const proto = Object.getPrototypeOf(value);
  return proto !== Object.prototype && proto !== null;
}

const CHANNEL_PROSE_TOKENS = [
  "STRONG BUY",
  "BUY NOW",
  "STRONG SELL",
  "STRONG REDUCE",
  "ADD GRADUALLY",
  "PASS OVER",
  "ACCUMULATE",
  "ACQUIRE",
  "OVERWEIGHT",
  "UNDERWEIGHT",
  "BUY",
  "SELL",
  "AVOID",
];

let channelTokenPattern: RegExp | null = null;

function channelTokenRegex(): RegExp {
  if (!channelTokenPattern) {
    const tokens = [...CHANNEL_PROSE_TOKENS].sort((left, right) => right.length - left.length).map(escapeRegExp);
    channelTokenPattern = new RegExp(`\\b(?:${tokens.join("|")})\\b`, "gi");
  }
  return channelTokenPattern;
}

const URL_OR_EMAIL = /https?:\/\/[^\s<>"']+|www\.[^\s<>"']+|[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;

const MASK_EDGE = "\uE000";
const HOST_SUFFIX = /^(?:com|net|org|io|co|edu|gov|uk|ai|app|dev|info|biz)\b/i;

function maskUrlsAndEmails(text: string): { text: string; masks: string[] } {
  const masks: string[] = [];
  const masked = text.replace(URL_OR_EMAIL, (span) => {
    const token = `${MASK_EDGE}${masks.length}${MASK_EDGE}`;
    masks.push(span);
    return token;
  });
  return { text: masked, masks };
}

function restoreMasks(text: string, masks: string[]): string {
  if (masks.length === 0) return text;
  return text.replace(new RegExp(`${MASK_EDGE}(\\d+)${MASK_EDGE}`, "g"), (full, index: string) => {
    const parsed = Number(index);
    return parsed < masks.length ? masks[parsed] ?? full : full;
  });
}

/**
 * Cashtags and hashtags stay. Hyphenated names stay (`Buy-Rite`).
 * A trade word immediately before a host suffix stays (`BUY.com`).
 * A trade word after a dot is its own segment and is neutralized (`price.SELL`, `a.BUY`).
 */
function protectedProseToken(text: string, offset: number, length: number): boolean {
  const before = offset > 0 ? text[offset - 1] ?? "" : "";
  const after = text[offset + length] ?? "";
  if (before === "$" || before === "#") return true;
  const word = /[A-Za-z0-9]/;
  if (before === "-" && word.test(text[offset - 2] ?? "")) return true;
  if (after === "-" && word.test(text[offset + length + 1] ?? "")) return true;
  if (after === "." && HOST_SUFFIX.test(text.slice(offset + length + 1))) return true;
  return false;
}

/** Replace an exact trade token, or a whole-word BUY/SELL-class token inside stored prose. */
export function neutralizeChannelText(text: string): string {
  if (!text) return text;
  if (deniedExactToken(text)) return neutralConditionLabel(text);
  const masked = maskUrlsAndEmails(text);
  const pattern = channelTokenRegex();
  pattern.lastIndex = 0;
  const replaced = masked.text.replace(pattern, (match, offset, whole) => {
    if (protectedProseToken(whole, offset, match.length)) return match;
    return neutralConditionLabel(match);
  });
  return restoreMasks(replaced, masked.masks);
}

/**
 * Output check for RSS, blog, organic, X, and daily-brief payloads.
 * Content fields lose whole-word trade tokens. Ticker, id, slug, and URL fields stay.
 */
export function neutralizeChannelPayload<T>(value: T): T {
  return walkChannel(value, new WeakMap()) as T;
}

function walkChannel(value: unknown, mapped: WeakMap<object, unknown>): unknown {
  if (typeof value === "string") return neutralizeChannelText(value);
  if (value == null || typeof value !== "object") return value;
  if (mapped.has(value)) return mapped.get(value);
  if (Array.isArray(value)) {
    const copy = value.slice();
    mapped.set(value, copy);
    let changed = false;
    for (let index = 0; index < value.length; index += 1) {
      const next = walkChannel(value[index], mapped);
      if (next !== value[index]) {
        copy[index] = next;
        changed = true;
      }
    }
    if (!changed) {
      mapped.set(value, value);
      return value;
    }
    return copy;
  }
  if (isOpaque(value)) return value;
  const record = value as Record<string, unknown>;
  const copy: Record<string, unknown> = { ...record };
  mapped.set(value, copy);
  let changed = false;
  for (const key of Object.keys(record)) {
    const child = record[key];
    const field = normalizeClientFieldName(key);
    if (VALUE_PRESERVE_FIELDS.has(field)) continue;
    const next = typeof child === "string"
      ? (LABEL_FIELDS.has(field) && deniedExactToken(child) ? neutralConditionLabel(child) : neutralizeChannelText(child))
      : child != null && typeof child === "object" ? walkChannel(child, mapped) : child;
    if (next !== child) {
      copy[key] = next;
      changed = true;
    }
  }
  if (!changed) {
    mapped.set(value, value);
    return value;
  }
  return copy;
}

/**
 * Named trade-class fields only. An exact denied token becomes the condition
 * label, except `class` and `finalVerdictAction`, which are removed. Ticker,
 * id, slug, and URL values are never rewritten. Map, Set, Buffer, URL, Error,
 * and Date pass through. Past the depth cap the named fields are still
 * neutralized. A clean payload is the same reference.
 */
export function guardNamedClientFields<T>(value: T): T {
  return visit(value, 0, new WeakMap(), { n: 0, warned: false }) as T;
}

function noteNode(budget: { n: number; warned: boolean }) {
  budget.n += 1;
  if (budget.n > CLIENT_PAYLOAD_MAX_NODES && !budget.warned) {
    budget.warned = true;
    console.warn(`FAULTLINE client payload walk passed ${CLIENT_PAYLOAD_MAX_NODES} nodes; values are kept and the walk continues.`);
  }
}

function namedFieldChange(key: string, child: unknown): { kind: "keep" } | { kind: "drop" } | { kind: "label"; value: string } {
  if (typeof child !== "string") return { kind: "keep" };
  const field = normalizeClientFieldName(key);
  if (VALUE_PRESERVE_FIELDS.has(field) || !deniedExactToken(child)) return { kind: "keep" };
  if (DROP_FIELDS.has(field)) return { kind: "drop" };
  if (LABEL_FIELDS.has(field)) return { kind: "label", value: neutralConditionLabel(child) };
  return { kind: "keep" };
}

function visit(value: unknown, depth: number, mapped: WeakMap<object, unknown>, budget: { n: number; warned: boolean }): unknown {
  if (value == null || typeof value !== "object") return value;
  if (mapped.has(value)) return mapped.get(value);
  if (Array.isArray(value)) {
    noteNode(budget);
    const copy = value.slice();
    mapped.set(value, copy);
    let changed = false;
    for (let index = 0; index < value.length; index += 1) {
      const child = value[index];
      const next = visit(child, depth + 1, mapped, budget);
      if (next !== child) {
        copy[index] = next;
        changed = true;
      }
    }
    if (!changed) {
      mapped.set(value, value);
      return value;
    }
    return copy;
  }
  if (isOpaque(value)) return value;
  noteNode(budget);
  // Past CLIENT_PAYLOAD_MAX_DEPTH the named fields on this node are still labeled or dropped.
  // Past CLIENT_PAYLOAD_MAX_NODES the walk continues. Nested values are never replaced with null.
  const record = value as Record<string, unknown>;
  const copy: Record<string, unknown> = { ...record };
  mapped.set(value, copy);
  let changed = false;
  for (const key of Object.keys(record)) {
    const child = record[key];
    const change = namedFieldChange(key, child);
    if (change.kind === "drop") {
      delete copy[key];
      changed = true;
      continue;
    }
    if (change.kind === "label") {
      copy[key] = change.value;
      changed = true;
      continue;
    }
    if (child != null && typeof child === "object") {
      const next = visit(child, depth + 1, mapped, budget);
      if (next !== child) {
        copy[key] = next;
        changed = true;
      }
    }
  }
  if (!changed) {
    mapped.set(value, value);
    return value;
  }
  return copy;
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
