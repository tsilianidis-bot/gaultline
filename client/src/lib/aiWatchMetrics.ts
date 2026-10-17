/* ============================================================
   AI Sector Watch (/app/watch/deep) header tiles: view model.

   Every tile is either bound to the canonical Pressure state
   (marketState.canonicalCurrent → engine "ai-bubble") with its source
   and as-of time in ET, labelled as the static reference value it is,
   or shown as Not tracked / Unavailable. No figure is invented here.

   FAULTLINE does not ingest AI capex, GPU-order or AI startup valuation
   data, so those tiles are "Not tracked".
   ============================================================ */
import type { PublicCanonicalIntelligenceState } from "@shared/canonicalIntelligenceState";
import { formatEt } from "@shared/credibilityLabels";
import { pressureVectorLabel } from "@shared/pressureVectorLabels";

export const AI_BUBBLE_ENGINE_ID = "ai-bubble";
/**
 * Static AI mega-cap concentration reference value used by the ai-bubble
 * vector (server/pressure/engine.ts scoreAIBubble; shared/pressureVectorLabels.ts).
 * A fixed baseline, not a live measurement: shown without a delta.
 */
export const AI_CONCENTRATION_STATIC_BASELINE_PCT = 32.4;

export interface AiWatchTile {
  id: "ai-capex" | "ai-concentration" | "gpu-orders" | "ai-startup-valuations";
  label: string;
  value: string;
  /** Source / basis line (never a delta). */
  note: string;
  tone: "neutral" | "baseline";
}

export interface AiBubbleRiskView {
  available: boolean;
  label: string;
  /** "44/100" when available, otherwise "Unavailable". */
  value: string;
  /** Source + as-of (ET) + quality, or the reason it is unavailable. */
  basis: string;
}

const NOT_TRACKED_NOTE = "FAULTLINE does not ingest this data";

export function aiWatchTiles(): AiWatchTile[] {
  return [
    { id: "ai-capex", label: "Total AI Capex", value: "Not tracked", note: NOT_TRACKED_NOTE, tone: "neutral" },
    {
      id: "ai-concentration",
      label: "AI Concentration (S&P) · Static Baseline",
      value: `~${AI_CONCENTRATION_STATIC_BASELINE_PCT.toFixed(1)}%`,
      note: "Static reference value used by the AI / Speculation vector · not live, no change tracked",
      tone: "baseline",
    },
    { id: "gpu-orders", label: "Hyperscaler GPU Orders", value: "Not tracked", note: NOT_TRACKED_NOTE, tone: "neutral" },
    { id: "ai-startup-valuations", label: "AI Startup Valuations", value: "Not tracked", note: NOT_TRACKED_NOTE, tone: "neutral" },
  ];
}

type CanonicalLike = Pick<PublicCanonicalIntelligenceState, "engines" | "effectiveAt"> | null | undefined;

/**
 * AI / Speculation (static baseline) vector score from the canonical state, on
 * the engine's own 0–100 scale. Missing state, missing engine, a non-finite
 * value or a non-0–100 unit → Unavailable (never a default number).
 */
export function selectAiBubbleRisk(state: CanonicalLike, opts: { isLoading?: boolean } = {}): AiBubbleRiskView {
  const label = pressureVectorLabel(AI_BUBBLE_ENGINE_ID);
  const unavailable = (basis: string): AiBubbleRiskView => ({ available: false, label, value: "Unavailable", basis });
  if (!state) return unavailable(opts.isLoading ? "Loading canonical Pressure state…" : "Canonical Pressure state unavailable");
  const engine = state.engines?.find(e => e.engineId === AI_BUBBLE_ENGINE_ID);
  if (!engine) return unavailable("AI / Speculation vector not present in the canonical Pressure state");
  const v = engine.value;
  if (typeof v !== "number" || !Number.isFinite(v) || v < 0 || v > 100 || engine.unit !== "score_0_to_100") {
    return unavailable("AI / Speculation vector has no valid 0–100 score in the canonical Pressure state");
  }
  const asOf = formatEt(engine.calculatedAt ?? state.effectiveAt);
  const parts = [
    "Canonical Pressure Index · AI / Speculation vector (static AI-concentration baseline, adjusted by live 10Y yield and HY spread)",
    `as of ${asOf ?? "—"}`,
  ];
  if (engine.freshnessStatus && engine.freshnessStatus !== "CURRENT") parts.push(engine.freshnessStatus);
  if (engine.qualityStatus && engine.qualityStatus !== "HEALTHY") parts.push(`quality ${engine.qualityStatus}`);
  return { available: true, label, value: `${Math.round(v)}/100`, basis: parts.join(" · ") };
}
