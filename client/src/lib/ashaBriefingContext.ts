/**
 * What the PLATO briefing surfaces may show and send to the model.
 *
 * The browser engine serves the DEFAULT_INDICATORS demo baseline when there is no canonical
 * MarketState (mode "deterministic-fallback") or while a simulation is active. Those numbers are
 * not market data: they must never be rendered as a reading or sent to PLATO as context.
 * Only canonical values bind, and no confidence is sent unless a real one exists.
 */
import type { EngineOutput } from "@/lib/engine";
import type { BrowserMarketMode } from "@/lib/marketStateProjection";
import { formatCanonicalScore } from "@shared/marketMetrics";

export const BRIEFING_NOT_AVAILABLE = "NOT AVAILABLE";
const UNAVAILABLE_COLOR = "rgba(148,163,184,0.55)";
const CANONICAL_SOURCE = "canonical-market-state";

export interface BriefingStat {
  label: string;
  value: string;
  color: string;
}

export interface BriefingDisplay {
  available: boolean;
  /** Status badge (e.g. "MODERATE RISK") or NOT AVAILABLE. */
  badgeLabel: string;
  /** Regime shown next to the badge; null when not canonical. */
  badgeRegime: string | null;
  badgeColor: string;
  stats: BriefingStat[];
}

/** Optional-only greeting context: absent fields are simply not sent. */
export interface BriefingGreetingContext {
  pressureScore?: number;
  regime?: string;
  regimeConfidence?: number;
  narrative?: string;
  trend?: string;
  keyDrivers?: string[];
}

export function isCanonicalMarketMode(mode: BrowserMarketMode | undefined | null): boolean {
  return mode === "canonical";
}

export function briefingPressureColor(score10: number): string {
  if (score10 >= 7) return "#FF3B5C";
  if (score10 >= 5.5) return "#FF9500";
  if (score10 >= 4) return "#FFD700";
  return "#00FF99";
}

export function briefingPressureLabel(score10: number): string {
  if (score10 >= 7) return "CRITICAL";
  if (score10 >= 5.5) return "ELEVATED";
  if (score10 >= 4) return "MODERATE RISK";
  return "STABLE";
}

function nonEmpty(value: string | null | undefined): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value : undefined;
}

function finite(value: number | null | undefined): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

export function buildBriefingDisplay(output: EngineOutput, mode: BrowserMarketMode | undefined | null): BriefingDisplay {
  if (!isCanonicalMarketMode(mode)) {
    return {
      available: false,
      badgeLabel: BRIEFING_NOT_AVAILABLE,
      badgeRegime: null,
      badgeColor: UNAVAILABLE_COLOR,
      stats: ["STATE", "PRESSURE", "BULL", "CRASH", "ANALOG"].map(label => ({
        label,
        value: BRIEFING_NOT_AVAILABLE,
        color: UNAVAILABLE_COLOR,
      })),
    };
  }

  const { overall, regime, probability, analogs } = output;
  const pressureColor = briefingPressureColor(overall.score);
  const bull = finite(probability?.bullProbability);
  const crash = finite(probability?.crashProbability);
  const analog = analogs[0];
  return {
    available: true,
    badgeLabel: briefingPressureLabel(overall.score),
    badgeRegime: regime.label,
    badgeColor: pressureColor,
    stats: [
      { label: "STATE", value: regime.label.split(" ")[0] ?? regime.label, color: regime.color },
      { label: "PRESSURE", value: formatCanonicalScore(overall.score * 10), color: pressureColor },
      { label: "BULL", value: bull != null ? `${bull}%` : "\u2014", color: "#00FF88" },
      { label: "CRASH", value: crash != null ? `${crash}%` : "\u2014", color: "#FF2D55" },
      { label: "ANALOG", value: analog?.era?.split(" ").slice(0, 2).join(" ") ?? "\u2014", color: "#00E5FF" },
    ],
  };
}

/**
 * Context for the post-login briefing greeting. Non-canonical: nothing (the server reads its own
 * canonical state). Canonical: canonical values only, and never a confidence (none exists here).
 */
export function buildBriefingGreetingContext(
  output: EngineOutput,
  mode: BrowserMarketMode | undefined | null,
): BriefingGreetingContext {
  if (!isCanonicalMarketMode(mode)) return {};
  const context: BriefingGreetingContext = {};
  if (output.overall.source === CANONICAL_SOURCE) {
    const score = finite(output.overall.score);
    if (score != null) context.pressureScore = Math.round(score * 1000) / 100;
  }
  const regime = nonEmpty(output.regime?.label);
  if (regime) context.regime = regime;
  const narrative = nonEmpty(output.narrative?.summary);
  if (narrative) context.narrative = narrative;
  // Canonical stress level and direction; the projection's deltas are always 0, so no trend is derived from them.
  const trend = nonEmpty(output.regime?.sublabel);
  if (trend) context.trend = trend;
  const keyDrivers = [...output.domains]
    .filter(domain => domain.source === CANONICAL_SOURCE)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map(domain => domain.label);
  if (keyDrivers.length > 0) context.keyDrivers = keyDrivers;
  return context;
}

export interface CanonicalGreetingState {
  pressureIndex?: number | null;
  regime?: string | null;
  confidenceOrEvidenceQuality?: string | null;
}

/** Context for the dashboard daily greeting: server canonical values plus canonical-mode engine text only. */
export function buildDailyGreetingContext(
  canonicalState: CanonicalGreetingState,
  output: EngineOutput,
  mode: BrowserMarketMode | undefined | null,
): BriefingGreetingContext {
  const context: BriefingGreetingContext = {};
  const pressure = finite(canonicalState.pressureIndex);
  if (pressure != null) context.pressureScore = pressure;
  const regime = nonEmpty(canonicalState.regime);
  if (regime) context.regime = regime;
  const quality = canonicalState.confidenceOrEvidenceQuality;
  context.narrative = `Current evidence quality: ${quality === "HEALTHY" ? "healthy" : quality === "DEGRADED" ? "limited" : quality === "PARTIAL" ? "partial" : "unavailable"}`;
  if (isCanonicalMarketMode(mode)) {
    const trend = nonEmpty(output.regime?.sublabel);
    if (trend) context.trend = trend;
    const keyRisks = (output.narrative?.keyRisks ?? []).filter(risk => nonEmpty(risk));
    if (keyRisks.length > 0) context.keyDrivers = keyRisks;
  }
  return context;
}
