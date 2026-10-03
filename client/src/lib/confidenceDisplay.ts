// QA r11 B9: the interpretation-integrity validator withholds model confidence
// (null). A withheld confidence is shown as "Not established" — never 0% or null%.
export const CONFIDENCE_NOT_ESTABLISHED = "Not established";

export function hasConfidenceValue(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

export function confidenceDisplayText(value: number | null | undefined): string {
  return hasConfidenceValue(value) ? `${Math.round(value)}%` : CONFIDENCE_NOT_ESTABLISHED;
}

// Launch fix-up: engine/LLM text can embed a heuristic confidence figure
// ("Confidence 42/100 is below the 55/100 minimum threshold…", "85/100
// confidence", "72% confidence"). Display text withholds the figure; the
// engines and prompts are unchanged.
const BELOW_THRESHOLD = /\bconfidence\s+\d{1,3}(?:\.\d+)?\s*\/\s*100\s+is below the\s+\d{1,3}(?:\.\d+)?\s*\/\s*100\s+minimum threshold/gi;
const FIGURE_THEN_CONFIDENCE = /\b\d{1,3}(?:\.\d+)?\s*(?:\/\s*100|%)\s+confidence\b/gi;
const CONFIDENCE_THEN_FIGURE = /\bconfidence(?:\s+(?:score|level|rating))?\s*(?:of|is|at|:|=)?\s*\d{1,3}(?:\.\d+)?\s*(?:\/\s*100|%)/gi;

export function withholdConfidenceFigures(text: string): string;
export function withholdConfidenceFigures(text: string | null | undefined): string | null | undefined;
export function withholdConfidenceFigures(text: string | null | undefined): string | null | undefined {
  if (typeof text !== "string") return text;
  return text
    .replace(BELOW_THRESHOLD, "The setup is below the minimum heuristic threshold")
    .replace(FIGURE_THEN_CONFIDENCE, "confidence not established")
    .replace(CONFIDENCE_THEN_FIGURE, m => (m[0] === "C" ? "Confidence not established" : "confidence not established"));
}
