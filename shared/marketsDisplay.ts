/**
 * Display-only helpers for the Markets page.
 * These do not score Pressure, FMOS, or canonical market state.
 * Missing or non-finite inputs stay Unavailable — never coerced to 0 / Mixed / Neutral.
 */

export const UNAVAILABLE_LABEL = "Unavailable";

export interface MarketObservation {
  symbol?: string;
  changePercent?: number | null;
  freshnessState?: string | null;
}

export function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

export function usableChangePercent(value: unknown): number | null {
  return isFiniteNumber(value) ? value : null;
}

export function isUsableObservation(item: MarketObservation | null | undefined): item is MarketObservation & { changePercent: number } {
  if (!item) return false;
  if (item.freshnessState === "UNAVAILABLE") return false;
  return usableChangePercent(item.changePercent) !== null;
}

export function advancingShare(items: MarketObservation[]): { percent: number | null; sampleSize: number } {
  const usable = items.filter(isUsableObservation);
  if (usable.length === 0) return { percent: null, sampleSize: 0 };
  const advancing = usable.filter(item => item.changePercent > 0).length;
  return { percent: (advancing / usable.length) * 100, sampleSize: usable.length };
}

export function rutVersusSpxSpread(items: MarketObservation[]): {
  spread: number | null;
  commentary: string | null;
} {
  const spx = items.find(item => item.symbol === "^GSPC");
  const rut = items.find(item => item.symbol === "^RUT");
  if (!isUsableObservation(spx) || !isUsableObservation(rut)) {
    return { spread: null, commentary: null };
  }
  const spread = rut.changePercent - spx.changePercent;
  const commentary = spread > 0.3
    ? "Small caps outperforming — broad participation"
    : spread < -0.3
      ? "Large caps leading — narrow rally"
      : "Small and large caps roughly in line";
  return { spread, commentary };
}

export function formatSpread(spread: number | null): string {
  if (spread === null) return UNAVAILABLE_LABEL;
  return `${spread >= 0 ? "+" : ""}${spread.toFixed(2)}% spread`;
}

export function displaySummaryValue(value: string | null | undefined): string {
  if (!value || value === "unavailable") return UNAVAILABLE_LABEL;
  return value.replace(/-/g, " ");
}

export function usEquitiesRead(status: string | null | undefined): string | null {
  if (status === "risk-on") {
    return "U.S. equity markets are broadly positive, with most major indices advancing.";
  }
  if (status === "risk-off") {
    return "U.S. equity markets are under pressure, with broad-based selling across major indices.";
  }
  if (status === "mixed") {
    return "U.S. equity markets are mixed, with no clear directional conviction across major indices.";
  }
  return null;
}

export function dollarEquityRelationship(
  dollar: string | null | undefined,
  usEquities: string | null | undefined,
): string {
  if (!dollar || !usEquities || dollar === "unavailable" || usEquities === "unavailable") {
    return UNAVAILABLE_LABEL;
  }
  if (dollar === "strengthening" && usEquities === "risk-on") return "Divergence — watch for reversal";
  if (dollar === "weakening" && usEquities === "risk-on") return "Aligned — dollar weakness supporting equities";
  return "Observed relationship is neither a confirmed alignment nor a confirmed divergence.";
}

export function rateEquityRelationship(
  rates: string | null | undefined,
  usEquities: string | null | undefined,
): string {
  if (!rates || !usEquities || rates === "unavailable" || usEquities === "unavailable") {
    return UNAVAILABLE_LABEL;
  }
  if (rates === "rising" && usEquities === "risk-on") return "Tension — rising yields pressuring valuations";
  if (rates === "falling" && usEquities === "risk-on") return "Supportive — falling yields tailwind for equities";
  return "Observed relationship is neither a confirmed alignment nor a confirmed divergence.";
}

export function cryptoRiskRelationship(
  crypto: string | null | undefined,
  usEquities: string | null | undefined,
): string {
  if (!crypto || !usEquities || crypto === "unavailable" || usEquities === "unavailable") {
    return UNAVAILABLE_LABEL;
  }
  if (crypto === "positive" && usEquities === "risk-on") return "Aligned — risk appetite broad";
  if (crypto === "negative" && usEquities === "risk-on") return "Divergence — crypto not confirming equity strength";
  return "Observed crypto and equity readings do not form a confirmed confirmation or divergence.";
}
