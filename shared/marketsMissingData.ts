/**
 * Markets page display helpers for missing vs genuine-zero observations.
 * Display/interpretation accuracy only — does not change canonical scoring.
 */

export type MarketsFreshness =
  | "LIVE"
  | "DELAYED"
  | "LATEST_VERIFIED"
  | "STALE"
  | "UNAVAILABLE";

export type MarketsObservation = {
  changePercent?: number | null;
  freshnessState?: MarketsFreshness | null;
};

export const MARKETS_UNAVAILABLE_LABEL = "Unavailable";

export function isValidNumericObservation(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

/** STALE and UNAVAILABLE must not feed live-looking aggregates. DELAYED may display if labeled. */
export function isUsableFreshness(freshness: MarketsFreshness | null | undefined): boolean {
  if (freshness === "STALE" || freshness === "UNAVAILABLE") return false;
  return true;
}

export function isLiveFreshness(freshness: MarketsFreshness | null | undefined): boolean {
  return freshness === "LIVE" || freshness === undefined || freshness === null;
}

export type PercentDisplay =
  | { kind: "unavailable"; label: typeof MARKETS_UNAVAILABLE_LABEL; value: null }
  | { kind: "percent"; label: string; value: number };

export function usIndicesAdvancing(
  items: ReadonlyArray<MarketsObservation>,
): PercentDisplay {
  const usable = items.filter(
    (item) =>
      isValidNumericObservation(item.changePercent) &&
      isUsableFreshness(item.freshnessState),
  );
  if (usable.length === 0) {
    return { kind: "unavailable", label: MARKETS_UNAVAILABLE_LABEL, value: null };
  }
  const advancing = usable.filter((item) => item.changePercent > 0).length;
  const value = (advancing / usable.length) * 100;
  return { kind: "percent", label: `${value.toFixed(1)}%`, value };
}

export type SpreadDisplay =
  | {
      kind: "unavailable";
      label: typeof MARKETS_UNAVAILABLE_LABEL;
      value: null;
      commentary: null;
      live: false;
    }
  | {
      kind: "spread";
      label: string;
      value: number;
      commentary: string | null;
      live: boolean;
    };

function freshnessOrLive(
  freshness: MarketsFreshness | null | undefined,
): MarketsFreshness {
  return freshness ?? "LIVE";
}

export function areComparableObservations(
  left: MarketsObservation | undefined,
  right: MarketsObservation | undefined,
): boolean {
  if (!left || !right) return false;
  if (
    !isValidNumericObservation(left.changePercent) ||
    !isValidNumericObservation(right.changePercent)
  ) {
    return false;
  }
  if (!isUsableFreshness(left.freshnessState) || !isUsableFreshness(right.freshnessState)) {
    return false;
  }
  return freshnessOrLive(left.freshnessState) === freshnessOrLive(right.freshnessState);
}

export function rutVersusSpxSpread(
  rut: MarketsObservation | undefined,
  spx: MarketsObservation | undefined,
): SpreadDisplay {
  if (!areComparableObservations(rut, spx)) {
    return {
      kind: "unavailable",
      label: MARKETS_UNAVAILABLE_LABEL,
      value: null,
      commentary: null,
      live: false,
    };
  }
  const value = rut!.changePercent! - spx!.changePercent!;
  const live =
    isLiveFreshness(rut!.freshnessState) && isLiveFreshness(spx!.freshnessState);
  let commentary: string | null = null;
  if (live) {
    if (value > 0.3) commentary = "Small caps outperforming — broad participation";
    else if (value < -0.3) commentary = "Large caps leading — narrow rally";
    else commentary = "Small and large caps roughly in line";
  }
  const sign = value >= 0 ? "+" : "";
  return {
    kind: "spread",
    label: `${sign}${value.toFixed(2)}%`,
    value,
    commentary,
    live,
  };
}

function hasPresentTone(value: string | null | undefined): boolean {
  return typeof value === "string" && value.length > 0 && value !== "unavailable";
}

export function crossAssetRelationship(options: {
  left: string | null | undefined;
  right: string | null | undefined;
  aligned?: string;
  divergence?: string;
  fallback: "Neutral" | "Mixed";
  isAligned: boolean;
  isDivergence: boolean;
}): string {
  if (!hasPresentTone(options.left) || !hasPresentTone(options.right)) {
    return MARKETS_UNAVAILABLE_LABEL;
  }
  if (options.isDivergence && options.divergence) return options.divergence;
  if (options.isAligned && options.aligned) return options.aligned;
  return options.fallback;
}

export function usEquitiesReadSentence(
  usEquities: string | null | undefined,
): string | null {
  if (!hasPresentTone(usEquities)) return null;
  if (usEquities === "risk-on") {
    return "U.S. equity markets are broadly positive, with most major indices advancing.";
  }
  if (usEquities === "risk-off") {
    return "U.S. equity markets are under pressure, with broad-based selling across major indices.";
  }
  if (usEquities === "mixed") {
    return "U.S. equity markets are mixed, with no clear directional conviction across major indices.";
  }
  return null;
}
