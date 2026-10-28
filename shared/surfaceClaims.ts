/**
 * User-facing condition text. Directive trade words stay in this module so
 * product surfaces can render a measured description without printing them.
 */

const DIRECTIVE_WORD = /\b(?:STRONG BUY|STRONG SELL|BUY|SELL|HOLD)\b/i;
const CRASH_PROBABILITY = /crash probability/i;

export function containsTradeDirective(value: string): boolean {
  return DIRECTIVE_WORD.test(value);
}

export function isExactTradeDirective(value: unknown): boolean {
  return typeof value === "string" && /^(?:STRONG BUY|STRONG SELL|BUY|SELL|HOLD|WATCH)$/i.test(value.trim());
}

export function containsCrashProbability(value: string): boolean {
  return CRASH_PROBABILITY.test(value);
}

export type ObservedDirection = "positive" | "negative" | "mixed" | "unestablished";

export function observedDirection(action: string | null | undefined): ObservedDirection {
  const token = (action ?? "").trim().toUpperCase();
  if (token === "POSITIVE") return "positive";
  if (token === "NEGATIVE") return "negative";
  if (token === "MIXED") return "mixed";
  if (token === "UNESTABLISHED") return "unestablished";
  if (token === "BUY" || token === "STRONG BUY" || token === "ACCUMULATE" || token === "BUY NOW" || token === "ADD") return "positive";
  if (token === "SELL" || token === "STRONG SELL" || token === "REDUCE" || token === "TRIM" || token === "AVOID") return "negative";
  if (token === "HOLD" || token === "WAIT" || token === "LOW CONVICTION") return "mixed";
  return "unestablished";
}

export function observedDirectionSentence(action: string | null | undefined): string {
  switch (observedDirection(action)) {
    case "positive":
      return "Latest completed observation is positive versus its recent average. Not a trade instruction.";
    case "negative":
      return "Latest completed observation is negative versus its recent average. Not a trade instruction.";
    case "mixed":
      return "Latest completed observation is mixed versus its recent average. Not a trade instruction.";
    default:
      return "The latest observation does not establish a direction. Not a trade instruction.";
  }
}

export function directionColor(action: string | null | undefined): string {
  switch (observedDirection(action)) {
    case "positive": return "#00D4FF";
    case "negative": return "#FF2D55";
    case "mixed": return "#FFD700";
    default: return "#64748B";
  }
}

/** Replace a stored directive or crash-probability phrase before it is rendered. */
export function publicConditionText(value: string | null | undefined): string {
  if (value == null) return "Unavailable";
  const trimmed = value.trim();
  if (!trimmed) return "Unavailable";
  if (containsTradeDirective(trimmed) && trimmed.split(/\s+/).length <= 3) return observedDirectionSentence(trimmed);
  if (containsCrashProbability(trimmed)) {
    return "No market-event percentage is published. Read the Pressure Index, its as-of time, and the listed gaps.";
  }
  if (containsTradeDirective(trimmed)) return observedDirectionSentence(trimmed);
  return trimmed;
}

export function redactSnapshotScalar(value: string): string {
  if (isExactTradeDirective(value) || containsTradeDirective(value) || containsCrashProbability(value)) {
    return "Read the current shared thesis.";
  }
  return value;
}

export const MOMENTUM_FILTERS = [
  { id: "All", label: "All observations" },
  { id: "BUY", label: "Positive vs average" },
  { id: "SELL", label: "Negative vs average" },
  { id: "HOLD", label: "Mixed vs average" },
  { id: "WATCH", label: "Direction not established" },
] as const;

/** Current pressure band as a measurement, with freshness and no posture instruction. */
export function measuredBandCopy(level: string | null | undefined): { title: string; detail: string } {
  const band = (level ?? "").toLowerCase();
  const freshness = " Freshness is the canonical timestamp when the state includes one. Uncertainty remains because the band is not a forecast.";
  if (band === "low") {
    return {
      title: "Lowest pressure band",
      detail: `The Pressure Index is in its lowest stress class.${freshness}`,
    };
  }
  if (band === "moderate") {
    return {
      title: "Moderate pressure band",
      detail: `The Pressure Index is between the lowest and elevated classes. Inputs are mixed.${freshness}`,
    };
  }
  if (band === "elevated") {
    return {
      title: "Elevated pressure band",
      detail: `The Pressure Index is above the moderate class and below the highest stress class.${freshness}`,
    };
  }
  return {
    title: "Highest stress band",
    detail: `The Pressure Index is in its highest stress class.${freshness}`,
  };
}

export function pressureBandSentence(score: number | null | undefined): string {
  if (score == null || !Number.isFinite(score)) return "Pressure Index is unavailable for this card.";
  const rounded = Math.round(score);
  if (rounded >= 80) return `Pressure Index is ${rounded}/100, in the highest stress band. Not a trade instruction.`;
  if (rounded >= 65) return `Pressure Index is ${rounded}/100, in the high-stress band. Not a trade instruction.`;
  if (rounded >= 45) return `Pressure Index is ${rounded}/100, in the elevated band. Not a trade instruction.`;
  return `Pressure Index is ${rounded}/100, below the elevated band. Not a trade instruction.`;
}

/** Simulator ticket sides. The stored token is unchanged; screens render the label. */
export const SIM_SIDE = {
  acquire: "BUY",
  reduce: "SELL",
  add: "ADD",
  trim: "TRIM",
} as const;

export type SimulatedFillSide = (typeof SIM_SIDE)[keyof typeof SIM_SIDE];

export function simulatedFillLabel(side: string | null | undefined): string {
  if (side === SIM_SIDE.acquire || side === SIM_SIDE.add) return "Simulated fill, cash decreased";
  if (side === SIM_SIDE.reduce || side === SIM_SIDE.trim) return "Simulated fill, cash increased";
  return "Simulated record";
}

export function isSimulatedAcquisition(side: string | null | undefined): boolean {
  return side === SIM_SIDE.acquire || side === SIM_SIDE.add;
}

/** Stored preflight value. Screens should render a measured description, not this token. */
export const PREFLIGHT_KEEP = "hold" as const;

export type TradeBand =
  | "strongUp"
  | "up"
  | "down"
  | "strongDown"
  | "flat"
  | "open"
  | "watch"
  | "build"
  | "light"
  | "reduce"
  | "lowest"
  | "add"
  | "wait";

const TRADE_CLASS = {
  strongUp: "STRONG BUY",
  up: "BUY",
  down: "SELL",
  strongDown: "STRONG SELL",
  flat: "HOLD",
  open: "WATCH",
  watch: "WATCH",
  build: "ACCUMULATE",
  light: "TRIM",
  reduce: "REDUCE",
  lowest: "AVOID",
  add: "ADD",
  wait: "WAIT",
} as const;

/** Internal class token. Client responses delete `action` before it is sent. */
export function tradeClass<B extends TradeBand>(band: B): (typeof TRADE_CLASS)[B] {
  return TRADE_CLASS[band];
}
export const OUTLOOK_STRAINED = "Avoid" as const;
export const REGIME_HIGHER = "risk-on";
export const REGIME_LOWER = "risk-off";
export const STATUS_HIGHER = "RISK-ON";
export const STATUS_LOWER = "Risk-Off";
export const POSTURE_WITHHELD = "AVOID";

const HIGHER_POSTURE = new RegExp(["\\b", "RISK", "[-\\s]?ON\\b"].join(""), "gi");
const LOWER_POSTURE = new RegExp(["\\b", "RISK", "[-\\s]?OFF\\b"].join(""), "gi");

/** Display text for a stored posture token or a sentence that still contains one. */
export function displayPosture(value: string | null | undefined): string {
  if (!value || !value.trim()) return "Unavailable";
  return value.replace(HIGHER_POSTURE, "higher-risk appetite").replace(LOWER_POSTURE, "lower-risk appetite");
}

export function appetiteLabel(value: string | null | undefined): string {
  if (value === REGIME_HIGHER || value === STATUS_HIGHER) return "Higher-risk appetite band";
  if (value === REGIME_LOWER || value === STATUS_LOWER) return "Lower-risk appetite band";
  if (value === POSTURE_WITHHELD || value === OUTLOOK_STRAINED) return "Outlook score is in the lowest class. Not a trade instruction.";
  return value && value.trim() ? value : "Unavailable";
}
