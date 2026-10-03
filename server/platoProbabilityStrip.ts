/**
 * PLATO display-text probability stripping (QA r10 B8, r13 B8a/B10).
 *
 * Wraps #60's shared stripProbabilityPercentClaims (server/stripProbabilityClaims.ts, unchanged)
 * so every PLATO surface (asha.ask, the greeting, the Intelligence Center) removes the same
 * probability-% sentences. Display text only: no evidence or scoring input passes through here.
 */
import { isProbabilityPercentClaim, stripProbabilityPercentClaims } from "./stripProbabilityClaims";

const SENTENCE_BREAK = /(?<=[.!?])\s+/;
const lineHasProbabilityClaim = (line: string) => line.split(SENTENCE_BREAK).some(isProbabilityPercentClaim);

/**
 * Removes every sentence that states a probability % (stripProbabilityPercentClaims, #60's shared
 * helper), line by line so the answer keeps its paragraphs. Text without such a claim is returned
 * unchanged, byte for byte.
 */
export function stripPlatoProbabilityClaims(text: unknown): unknown {
  if (typeof text !== "string") return text;
  const lines = text.split("\n");
  if (!lines.some(lineHasProbabilityClaim)) return text;
  return lines
    .flatMap(line => {
      if (!lineHasProbabilityClaim(line)) return [line];
      const kept = stripProbabilityPercentClaims(line) as string;
      return kept ? [kept] : [];
    })
    .join("\n")
    .trim();
}

/**
 * Recursively strips probability-% sentences from every string in a model output: strings at any
 * depth, inside arrays and objects. A list item left empty is dropped; other keys keep their place.
 */
export function deepStripPlatoProbabilityClaims(value: unknown): unknown {
  if (typeof value === "string") return stripPlatoProbabilityClaims(value);
  if (Array.isArray(value)) {
    return value
      .map(item => deepStripPlatoProbabilityClaims(item))
      .filter((item, index) => !(item === "" && typeof value[index] === "string" && value[index] !== ""));
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([key, item]) => [key, deepStripPlatoProbabilityClaims(item)]));
  }
  return value;
}
