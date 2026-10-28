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
  if (token === "BUY" || token === "STRONG BUY" || token === "ACCUMULATE" || token === "BUY NOW" || token === "ADD") return "positive";
  if (token === "SELL" || token === "STRONG SELL" || token === "REDUCE" || token === "TRIM") return "negative";
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
  if (side === SIM_SIDE.acquire || side === SIM_SIDE.add) return "Simulated acquisition";
  if (side === SIM_SIDE.reduce || side === SIM_SIDE.trim) return "Simulated reduction";
  return "Simulated record";
}

export function isSimulatedAcquisition(side: string | null | undefined): boolean {
  return side === SIM_SIDE.acquire || side === SIM_SIDE.add;
}

/** Stored preflight value. Screens should render a measured description, not this token. */
export const PREFLIGHT_KEEP = "hold";
