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
/**
 * Scenario tiles (BULL, CRASH) never show a raw percent. A scenario or probability % renders only
 * when its contract status is explicitly AVAILABLE (shared/probabilityContract on the
 * probability-contract stream); otherwise the tile reads "Uncalibrated".
 */
export const BRIEFING_SCENARIO_UNCALIBRATED = "Uncalibrated";
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
  /** Canonical pressure on the engine's 0–10 scale, or null when absent/non-finite (never NaN). */
  pressureScore10: number | null;
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

type ScenarioKey = "bullProbability" | "crashProbability";

/**
 * Text for a scenario tile. Only an explicit AVAILABLE contract status with a valid integer
 * percent renders a number; the raw engine/projection number is never read here.
 */
export function briefingScenarioText(output: EngineOutput, key: ScenarioKey): string {
  const displays = (output as { probabilityDisplay?: Partial<Record<string, { state?: unknown; percent?: unknown }>> }).probabilityDisplay;
  const display = displays?.[key];
  const percent = display?.percent;
  if (display?.state === "AVAILABLE" && typeof percent === "number" && Number.isInteger(percent) && percent >= 0 && percent <= 100) {
    return `${percent}%`;
  }
  return BRIEFING_SCENARIO_UNCALIBRATED;
}

export function buildBriefingDisplay(output: EngineOutput, mode: BrowserMarketMode | undefined | null): BriefingDisplay {
  if (!isCanonicalMarketMode(mode)) {
    return {
      available: false,
      badgeLabel: BRIEFING_NOT_AVAILABLE,
      badgeRegime: null,
      badgeColor: UNAVAILABLE_COLOR,
      pressureScore10: null,
      stats: ["STATE", "PRESSURE", "BULL", "CRASH", "ANALOG"].map(label => ({
        label,
        value: BRIEFING_NOT_AVAILABLE,
        color: UNAVAILABLE_COLOR,
      })),
    };
  }

  const { overall, regime, analogs } = output;
  // Read the canonical pressure robustly: a missing or non-finite score reads NOT AVAILABLE, never NaN.
  // Same rule as the greeting context: only a score whose source is the canonical MarketState binds.
  const score10 = overall?.source === CANONICAL_SOURCE ? finite(overall.score) : undefined;
  const pressureColor = score10 != null ? briefingPressureColor(score10) : UNAVAILABLE_COLOR;
  const bull = briefingScenarioText(output, "bullProbability");
  const crash = briefingScenarioText(output, "crashProbability");
  const regimeLabel = nonEmpty(regime?.label);
  const analog = analogs?.[0];
  return {
    available: true,
    badgeLabel: score10 != null ? briefingPressureLabel(score10) : BRIEFING_NOT_AVAILABLE,
    badgeRegime: regimeLabel ?? null,
    badgeColor: pressureColor,
    pressureScore10: score10 ?? null,
    stats: [
      { label: "STATE", value: regimeLabel ? (regimeLabel.split(" ")[0] ?? regimeLabel) : BRIEFING_NOT_AVAILABLE, color: regimeLabel ? regime.color : UNAVAILABLE_COLOR },
      { label: "PRESSURE", value: score10 != null ? formatCanonicalScore(score10 * 10) : BRIEFING_NOT_AVAILABLE, color: pressureColor },
      { label: "BULL", value: bull, color: bull === BRIEFING_SCENARIO_UNCALIBRATED ? UNAVAILABLE_COLOR : "#00FF88" },
      { label: "CRASH", value: crash, color: crash === BRIEFING_SCENARIO_UNCALIBRATED ? UNAVAILABLE_COLOR : "#FF2D55" },
      { label: "ANALOG", value: analog?.era?.split(" ").slice(0, 2).join(" ") ?? "\u2014", color: "#00E5FF" },
    ],
  };
}

/**
 * Context for the post-login briefing greeting. Non-canonical: nothing (the server reads its own
 * canonical state). Canonical: canonical values only, and never a confidence (none exists here)
 * and never a scenario or probability percent.
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

// ── QA r13 B10: PLATO Intelligence Center (/app/asha) market state ──
export type IntelligenceCenterOrbState = "critical" | "rising" | "calm";
export const INTELLIGENCE_CENTER_UNAVAILABLE_COLOR = "#64748B";

export interface IntelligenceCenterMarketState {
  /** Canonical pressure on the 0-100 scale; null when there is no canonical reading. */
  pressure100: number | null;
  /** Canonical regime label; null when there is no canonical reading. */
  regime: string | null;
  color: string;
  orbState: IntelligenceCenterOrbState;
}

/**
 * The market state the Intelligence Center shows and sends to PLATO. Only a canonical reading binds
 * (the demo baseline never does). Pressure is canonical 0-100 with bands at 70 and 45; a missing
 * reading is null and renders in the neutral colour.
 */
export function buildIntelligenceCenterMarketState(
  output: EngineOutput,
  mode: BrowserMarketMode | undefined | null,
): IntelligenceCenterMarketState {
  const canonical = isCanonicalMarketMode(mode);
  const score10 = canonical && output?.overall?.source === CANONICAL_SOURCE ? finite(output.overall.score) : undefined;
  const pressure100 = score10 != null ? Math.min(100, Math.max(0, Math.round(score10 * 1000) / 100)) : null;
  const regime = canonical ? nonEmpty(output?.regime?.label) ?? null : null;
  if (pressure100 == null) return { pressure100, regime, color: INTELLIGENCE_CENTER_UNAVAILABLE_COLOR, orbState: "calm" };
  if (pressure100 >= 70) return { pressure100, regime, color: "#FF2D55", orbState: "critical" };
  if (pressure100 >= 45) return { pressure100, regime, color: "#FF9500", orbState: "rising" };
  return { pressure100, regime, color: "#00E5FF", orbState: "calm" };
}
