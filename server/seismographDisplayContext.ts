/**
 * Display context for the getAssembledOutput response (SeismographNarrativeBanner,
 * MarketContextStrip, the ASHA / daily-brief / stock-page / report context blocks).
 *
 * Display and context only. The stored SeismographOutput, its scores, scenario
 * weights, analog ranking and the provider provenance that MarketState source
 * health reads are not changed: this runs on the response, before the
 * probability-contract overlay.
 *
 * - FRED status comes from the canonical state's input data quality (e.g.
 *   DELAYED on publication lag), not from the pressure packet's "live" label.
 * - Data freshness is the canonical data-quality state, not the packet count.
 * - The closest analog is shown only when the canonical outlook has a top
 *   analog; otherwise none is shown.
 */
import {
  buildASHAContextBlock,
  buildDailyBriefContext,
  buildMacroContextBlock,
  buildReportContext,
  type SeismographOutput,
} from "./seismographCore";
import type { SeismographProviderProvenance } from "./seismographCore.contract";
import { formatEt } from "../shared/credibilityLabels";

export interface CanonicalDataQualityInput {
  generatedAt: string | null;
  confidenceOrEvidenceQuality: string | null;
  delayedInputs: string[];
  staleInputs: string[];
  unavailableInputs: string[];
  fallbackInputs: string[];
  /** Every input id that feeds an engine. */
  engineInputIds: string[];
}

export interface SeismographDisplayContext {
  /** Null when no canonical state is bound: FRED status and freshness are then unverified. */
  dataQuality: CanonicalDataQualityInput | null;
  /** True only when the canonical outlook has a top analog. */
  canonicalTopAnalogAvailable: boolean;
}

/** Inputs that are not FRED observations. */
const NON_FRED_INPUT = /static|baseline|coingecko|polygon/i;

function fredInputs(ids: string[]): string[] {
  return ids.filter(id => !NON_FRED_INPUT.test(id));
}

export function fredProvenanceFromDataQuality(
  quality: CanonicalDataQualityInput | null,
  fallbackAsOf: number,
): SeismographProviderProvenance["fred"] {
  const asOfMs = quality?.generatedAt ? new Date(quality.generatedAt).getTime() : Number.NaN;
  const asOf = Number.isFinite(asOfMs) ? asOfMs : fallbackAsOf;
  if (!quality) {
    return { status: "unavailable", detail: "No canonical data-quality state is bound; FRED status is not verified.", asOf };
  }
  const fred = new Set(fredInputs(quality.engineInputIds));
  const pick = (list: string[]) => list.filter(id => fred.has(id));
  const unavailable = pick(quality.unavailableInputs);
  const stale = pick(quality.staleInputs);
  const fallback = pick(quality.fallbackInputs);
  const delayed = pick(quality.delayedInputs);
  const asOfText = formatEt(asOf);
  const suffix = asOfText ? ` Canonical state as of ${asOfText}.` : "";
  if (unavailable.length) return { status: "unavailable", detail: `FRED inputs unavailable: ${unavailable.join(", ")}.${suffix}`, asOf };
  if (stale.length) return { status: "stale", detail: `FRED inputs stale: ${stale.join(", ")}.${suffix}`, asOf };
  if (fallback.length) return { status: "fallback", detail: `FRED inputs on a governed fallback: ${fallback.join(", ")}.${suffix}`, asOf };
  if (delayed.length) return { status: "delayed", detail: `FRED inputs delayed (latest published release, within publication lag): ${delayed.join(", ")}.${suffix}`, asOf };
  return { status: "live", detail: `FRED inputs current.${suffix}`, asOf };
}

export function dataFreshnessFromDataQuality(quality: CanonicalDataQualityInput | null): {
  freshness: SeismographOutput["dataFreshness"];
  text: string;
} {
  if (!quality) return { freshness: "stale", text: "UNAVAILABLE (no canonical data-quality state)" };
  const status = quality.confidenceOrEvidenceQuality ?? "UNKNOWN";
  const parts = [
    quality.unavailableInputs.length ? `${quality.unavailableInputs.length} unavailable` : null,
    quality.staleInputs.length ? `${quality.staleInputs.length} stale` : null,
    quality.fallbackInputs.length ? `${quality.fallbackInputs.length} fallback` : null,
    quality.delayedInputs.length ? `${quality.delayedInputs.length} delayed` : null,
  ].filter(Boolean);
  const asOf = formatEt(quality.generatedAt);
  const text = `${status}${parts.length ? ` (${parts.join(", ")} inputs)` : ""}${asOf ? ` · canonical state ${asOf}` : ""}`;
  const freshness: SeismographOutput["dataFreshness"] =
    quality.unavailableInputs.length || quality.staleInputs.length ? "stale"
      : quality.delayedInputs.length || quality.fallbackInputs.length || status !== "COMPLETE" ? "recent"
        : "live";
  return { freshness, text };
}

/**
 * Apply the display context to an assembled output. Context blocks are rebuilt
 * from the display-gated output with the same builders the pipeline uses.
 */
export function applySeismographDisplayContext(
  output: SeismographOutput,
  context: SeismographDisplayContext,
): SeismographOutput {
  const { freshness, text } = dataFreshnessFromDataQuality(context.dataQuality);
  const gated: SeismographOutput = {
    ...output,
    dataFreshness: freshness,
    providerProvenance: {
      ...(output.providerProvenance ?? {}),
      fred: fredProvenanceFromDataQuality(context.dataQuality, output.computedAt),
    },
    ...(context.canonicalTopAnalogAvailable ? {} : { topAnalog: null, analogMatches: [] }),
  };
  gated.forDashboard = {
    ...output.forDashboard,
    dataFreshness: freshness,
    ...(context.canonicalTopAnalogAvailable ? {} : { topAnalog: null }),
  };
  gated.forASHA = buildASHAContextBlock(gated, { dataFreshnessText: text });
  gated.forDailyBrief = buildDailyBriefContext(gated);
  gated.forStockPages = { ...buildMacroContextBlock(gated), dataFreshness: freshness };
  gated.forReports = buildReportContext(gated);
  return gated;
}
