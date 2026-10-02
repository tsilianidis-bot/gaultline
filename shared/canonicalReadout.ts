/* ============================================================
   Canonical cross-page readout (presentation only).

   ONE source for the values that NOW / Brief, Pressure, Watch, ACT, Signals and
   the context strip must show identically for the same canonical stateId:

     - scenario probabilities → the governed snapshot's scenarioOutputs
       (marketState.canonicalCurrent; claim ids seismograph.scenario.*).
       Bull / neutral / bear only. Missing → null → "—" (never 0, never a
       different engine's distribution).
     - direction → the snapshot's pressureDirection (see snapshotEvidence).
     - historical percentile → marketState.now.historicalPercentile (the
       Seismograph's percentile of the score in its history), never the score.
     - threat / support classification → the evidence family's own signal:
       bearish | stressed = threat, bullish | recovering = support,
       neutral = neither. Strength order alone never makes a family a threat
       or a support.

   Nothing here calculates a score or a probability.
   ============================================================ */

export interface CanonicalScenarioSet {
  bull: number;
  neutral: number;
  bear: number;
}

const isPct = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 100;

/** The governed bull/neutral/bear set, or null when any member is missing/invalid. */
export function canonicalScenarioSet(
  scenarioOutputs: Readonly<Record<string, number | null | undefined>> | null | undefined,
): CanonicalScenarioSet | null {
  if (!scenarioOutputs) return null;
  const { bull, neutral, bear } = scenarioOutputs;
  if (!isPct(bull) || !isPct(neutral) || !isPct(bear)) return null;
  return { bull, neutral, bear };
}

/** "43%" for a valid probability, "—" when withheld (NaN / null / undefined). */
export function formatScenarioPercent(value: number | null | undefined): string {
  if (!isPct(value)) return "—";
  const rounded = Math.round(value * 10) / 10;
  return `${Number.isInteger(rounded) ? rounded.toFixed(0) : rounded.toFixed(1)}%`;
}

export type EvidenceClass = "threat" | "support" | "neutral";

export function evidenceClass(signal: string | null | undefined): EvidenceClass {
  if (signal === "bearish" || signal === "stressed") return "threat";
  if (signal === "bullish" || signal === "recovering") return "support";
  return "neutral";
}

export interface EvidenceFamilyLike {
  name: string;
  signal: string;
  strength: number;
  currentValue: string;
}

export interface ClassifiedEvidence {
  /** "Name: value", strongest first. */
  threats: string[];
  supports: string[];
  neutral: string[];
}

export function evidenceLine(family: Pick<EvidenceFamilyLike, "name" | "currentValue">): string {
  return `${family.name}: ${family.currentValue}`;
}

export function classifyEvidenceFamilies(families: readonly EvidenceFamilyLike[] | null | undefined): ClassifiedEvidence {
  const sorted = [...(families ?? [])].sort((a, b) => b.strength - a.strength);
  const pick = (cls: EvidenceClass) => sorted.filter(f => evidenceClass(f.signal) === cls).map(evidenceLine);
  return { threats: pick("threat"), supports: pick("support"), neutral: pick("neutral") };
}

/**
 * Map the canonical composite direction (snapshotEvidence directionDisplay) to a
 * score trend. "Unavailable"/unknown → undefined (show no trend), never a guess
 * from the score level.
 */
export function canonicalDirectionTrend(direction: string | null | undefined): "rising" | "falling" | "stable" | undefined {
  if (direction === "Deteriorating" || direction === "Accelerating") return "rising";
  if (direction === "Improving") return "falling";
  if (direction === "Stable") return "stable";
  return undefined;
}

/** A real historical percentile (0–100) or undefined — never the score itself. */
export function canonicalHistoricalPercentile(value: number | null | undefined): number | undefined {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 100 ? value : undefined;
}

/** Leading scenario(s) of the canonical set; ties name every leader. null = withheld. */
export function canonicalScenarioLeader(
  set: Partial<Record<"bull" | "neutral" | "bear", number | null | undefined>> | null | undefined,
): { keys: Array<"bull" | "neutral" | "bear">; value: number } | null {
  const entries = (["bull", "neutral", "bear"] as const)
    .map(key => ({ key, value: set?.[key] }))
    .filter((e): e is { key: "bull" | "neutral" | "bear"; value: number } => isPct(e.value));
  if (entries.length === 0) return null;
  const value = Math.max(...entries.map(e => e.value));
  return { keys: entries.filter(e => e.value === value).map(e => e.key), value };
}
