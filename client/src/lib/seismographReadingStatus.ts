export type SeismographReadingStatus =
  | "LIVE"
  | "DELAYED"
  | "STALE"
  | "FALLBACK"
  | "UNAVAILABLE"
  | "LATEST VERIFIED";

export interface SeismographReadingMetadata {
  freshness?: "live" | "recent" | "delayed" | "stale" | string | null;
  providerProvenance?: {
    fred?: {
      status?: string | null;
      asOf?: number | null;
    } | null;
  } | null;
}

export interface SeismographReadingPresentation {
  status: SeismographReadingStatus;
  sourceAsOfText: string;
}

function validSourceAsOf(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) && value > 0 && value <= Date.now()
    ? value
    : null;
}

/**
 * Produces customer-visible status strictly from source provenance and the
 * already source-derived freshness classification. A generated/receipt time is
 * never substituted for a provider observation time.
 */
export function seismographReadingPresentation(
  input: SeismographReadingMetadata,
): SeismographReadingPresentation {
  const fred = input.providerProvenance?.fred ?? null;
  const asOf = validSourceAsOf(fred?.asOf);
  const sourceAsOfText = asOf === null
    ? "FRED source as-of unavailable"
    : `FRED source as of ${new Date(asOf).toISOString().replace(".000Z", "Z")}`;
  const providerStatus = String(fred?.status ?? "unavailable").toLowerCase();
  const freshness = String(input.freshness ?? "stale").toLowerCase();

  if (asOf === null || providerStatus === "unavailable") return { status: "UNAVAILABLE", sourceAsOfText };
  if (providerStatus === "fallback") return { status: "FALLBACK", sourceAsOfText };
  if (providerStatus === "stale" || freshness === "stale") return { status: "STALE", sourceAsOfText };
  if (providerStatus === "delayed" || freshness === "delayed") return { status: "DELAYED", sourceAsOfText };
  if (providerStatus === "live" && freshness === "live") return { status: "LIVE", sourceAsOfText };
  return { status: "LATEST VERIFIED", sourceAsOfText };
}
