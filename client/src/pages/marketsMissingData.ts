/**
 * Markets page missing-data presentation.
 * Missing/non-finite observations stay Unavailable; genuine zeros remain zeros.
 */

export type ChangeObservation = {
  changePercent?: number | null;
  freshnessState?: string | null;
};

export type Availability<T> = { status: "unavailable"; value: null } | { status: "ok"; value: T };

export function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

/** A usable change observation is a finite percent, including genuine 0, and is not UNAVAILABLE. */
export function isUsableChangeObservation(
  item: ChangeObservation | null | undefined,
): item is ChangeObservation & { changePercent: number } {
  if (item == null) return false;
  if (item.freshnessState === "UNAVAILABLE") return false;
  return isFiniteNumber(item.changePercent);
}

export function advancingShare(items: Array<ChangeObservation | null | undefined>): Availability<number> {
  const usable = items.filter(isUsableChangeObservation);
  if (usable.length === 0) return { status: "unavailable", value: null };
  const advancing = usable.filter(item => item.changePercent > 0).length;
  return { status: "ok", value: (advancing / usable.length) * 100 };
}

export function rutVersusSpxSpread(
  rut: ChangeObservation | null | undefined,
  spx: ChangeObservation | null | undefined,
): Availability<number> {
  if (!isUsableChangeObservation(rut) || !isUsableChangeObservation(spx)) {
    return { status: "unavailable", value: null };
  }
  return { status: "ok", value: rut.changePercent - spx.changePercent };
}

export function rutSpxCommentary(spread: number | null | undefined): string | null {
  if (!isFiniteNumber(spread)) return null;
  if (spread > 0.3) return "Small caps outperforming — broad participation";
  if (spread < -0.3) return "Large caps leading — narrow rally";
  return "Small and large caps roughly in line";
}

function hasUsableSummaryField(value: string | null | undefined): value is string {
  return typeof value === "string" && value.length > 0 && value !== "unavailable";
}

export function dollarEquityRelationship(
  dollar: string | null | undefined,
  usEquities: string | null | undefined,
): string {
  if (!hasUsableSummaryField(dollar) || !hasUsableSummaryField(usEquities)) return "Unavailable";
  if (dollar === "strengthening" && usEquities === "risk-on") return "Divergence — watch for reversal";
  if (dollar === "weakening" && usEquities === "risk-on") return "Aligned — dollar weakness supporting equities";
  return "Neutral";
}

export function rateEquityRelationship(
  rates: string | null | undefined,
  usEquities: string | null | undefined,
): string {
  if (!hasUsableSummaryField(rates) || !hasUsableSummaryField(usEquities)) return "Unavailable";
  if (rates === "rising" && usEquities === "risk-on") return "Tension — rising yields pressuring valuations";
  if (rates === "falling" && usEquities === "risk-on") return "Supportive — falling yields tailwind for equities";
  return "Neutral";
}

export function cryptoRiskRelationship(
  crypto: string | null | undefined,
  usEquities: string | null | undefined,
): string {
  if (!hasUsableSummaryField(crypto) || !hasUsableSummaryField(usEquities)) return "Unavailable";
  if (crypto === "positive" && usEquities === "risk-on") return "Aligned — risk appetite broad";
  if (crypto === "negative" && usEquities === "risk-on") return "Divergence — crypto not confirming equity strength";
  return "Mixed";
}

export function usEquitiesCommentary(status: string | null | undefined): string | null {
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
