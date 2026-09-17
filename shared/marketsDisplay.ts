/**
 * Markets overlay display helpers.
 * Fail closed on missing/non-finite/stale observations. Genuine zeros remain zeros.
 * Does not author Champion Pressure or FMOS scores.
 */

export type MarketsFreshness =
  | "LIVE"
  | "DELAYED"
  | "LATEST_VERIFIED"
  | "STALE"
  | "UNAVAILABLE";

export type MarketsObservation = {
  changePercent?: number | null;
  freshnessState?: MarketsFreshness | string | null;
};

export function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

export function validChangePercent(value: unknown): number | null {
  return isFiniteNumber(value) ? value : null;
}

/** STALE and UNAVAILABLE must not feed live-looking aggregates. DELAYED may display if labeled. */
export function isUsableFreshness(freshness: string | null | undefined): boolean {
  return freshness !== "STALE" && freshness !== "UNAVAILABLE";
}

export function isUsableChangeObservation(
  item: MarketsObservation | null | undefined,
): item is MarketsObservation & { changePercent: number } {
  if (item == null) return false;
  if (!isUsableFreshness(item.freshnessState ?? null)) return false;
  return isFiniteNumber(item.changePercent);
}

export function appearsLive(freshnessState: string | null | undefined): boolean {
  return freshnessState === "LIVE";
}

/** Share of usable U.S. index observations that are advancing. Null when none are valid. */
export function advancingShare(items: ReadonlyArray<MarketsObservation | unknown>): number | null {
  const usable = items
    .map((item) => {
      if (item != null && typeof item === "object") return item as MarketsObservation;
      return { changePercent: item as number | null, freshnessState: "LIVE" };
    })
    .filter(isUsableChangeObservation);
  if (usable.length === 0) return null;
  const advancing = usable.filter((item) => item.changePercent > 0).length;
  return (advancing / usable.length) * 100;
}

export function areComparableObservations(
  left: MarketsObservation | null | undefined,
  right: MarketsObservation | null | undefined,
): boolean {
  if (!isUsableChangeObservation(left) || !isUsableChangeObservation(right)) return false;
  return left.freshnessState === right.freshnessState;
}

export function rutVersusSpxSpread(
  rut: MarketsObservation | unknown,
  spx: MarketsObservation | unknown,
): { value: number | null; live: boolean } {
  const left = observationFrom(rut);
  const right = observationFrom(spx);
  if (!areComparableObservations(left, right) || !isUsableChangeObservation(left) || !isUsableChangeObservation(right)) {
    return { value: null, live: false };
  }
  return {
    value: left.changePercent - right.changePercent,
    live: appearsLive(left.freshnessState) && appearsLive(right.freshnessState),
  };
}

function observationFrom(value: MarketsObservation | unknown): MarketsObservation | undefined {
  if (value == null) return undefined;
  if (typeof value === "object") return value as MarketsObservation;
  return { changePercent: value as number | null, freshnessState: "LIVE" };
}

export function rutSpxCommentary(spread: number | null, live = true): string | null {
  if (!isFiniteNumber(spread) || !live) return null;
  if (spread > 0.3) return "Small caps outperforming — broad participation";
  if (spread < -0.3) return "Large caps leading — narrow rally";
  return "Small and large caps roughly in line";
}

export type OverlayTone =
  | "risk-on"
  | "risk-off"
  | "mixed"
  | "unavailable"
  | "positive"
  | "negative"
  | "closed"
  | "elevated"
  | "normal"
  | "low"
  | "strengthening"
  | "weakening"
  | "stable"
  | "rising"
  | "falling";

export function overlayLabel(value: string | null | undefined): string {
  if (!value || value === "unavailable") return "Unavailable";
  return value.replace(/-/g, " ");
}

export function usEquityRead(status: string | null | undefined): string | null {
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

export function relationshipRead(
  left: string | null | undefined,
  right: string | null | undefined,
  aligned: string,
  divergent: string,
  presentFallback = "Unavailable",
): string {
  if (!left || left === "unavailable" || !right || right === "unavailable") return "Unavailable";
  if (left === "strengthening" && right === "risk-on") return divergent;
  if (left === "weakening" && right === "risk-on") return aligned;
  if (left === "rising" && right === "risk-on") return divergent;
  if (left === "falling" && right === "risk-on") return aligned;
  if (left === "positive" && right === "risk-on") return aligned;
  if (left === "negative" && right === "risk-on") return divergent;
  return presentFallback;
}
