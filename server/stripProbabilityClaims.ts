/**
 * LLM narratives must never carry an invented probability (James's rule;
 * probability contract). This removes, from model-written prose, every
 * sentence that states a probability / odds / chance / likelihood as a
 * percentage, or a bull / bear / crash / recession figure as a percentage.
 * Ordinary size statements ("A drawdown of 10% is typical", "Upside of 15%")
 * are kept: they state a move, not a probability.
 * Display text only: no scoring input passes through here.
 */
const PERCENT = String.raw`\d+(?:\.\d+)?\s*(?:%|percent\b)`;
const PROBABILITY_WORD = /\b(?:probabilit(?:y|ies)|odds|chances?|likelihood|likely)\b/i;
const EVENT_PERCENT = new RegExp(String.raw`\b(?:bull(?:ish)?|bear(?:ish)?|crash|recession|scenario)\b[^.!?\n]{0,60}?${PERCENT}|${PERCENT}[^.!?\n]{0,40}?\b(?:bull(?:ish)?|bear(?:ish)?|crash|recession|probabilit(?:y|ies)|odds|chances?)\b`, "i");
const HAS_PERCENT = new RegExp(PERCENT, "i");

export function isProbabilityPercentClaim(sentence: string): boolean {
  return HAS_PERCENT.test(sentence) && (PROBABILITY_WORD.test(sentence) || EVENT_PERCENT.test(sentence));
}

export function stripProbabilityPercentClaims(text: unknown): unknown {
  if (typeof text !== "string") return text;
  const kept = text
    .split(/(?<=[.!?])\s+/)
    .filter(sentence => !isProbabilityPercentClaim(sentence));
  return kept.join(" ").trim();
}
