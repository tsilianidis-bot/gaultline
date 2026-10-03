// QA r11 B9: the interpretation-integrity validator withholds model confidence
// (null). A withheld confidence is shown as "Not established" — never 0% or null%.
export const CONFIDENCE_NOT_ESTABLISHED = "Not established";

export function hasConfidenceValue(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

export function confidenceDisplayText(value: number | null | undefined): string {
  return hasConfidenceValue(value) ? `${Math.round(value)}%` : CONFIDENCE_NOT_ESTABLISHED;
}
