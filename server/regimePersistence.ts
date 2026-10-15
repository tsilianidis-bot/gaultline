export type RegimePersistenceLabel =
  | "SNAPSHOT"
  | "EMERGING"
  | "PROVISIONAL"
  | "CONFIRMED"
  | "ESTABLISHED"
  | "STRUCTURAL";

export interface RegimePersistenceInput {
  pressureScore: number;
  regime: string;
}

export interface RegimePersistenceState {
  snapshotRegime: string;
  confirmedRegime: string | null;
  label: RegimePersistenceLabel;
  consecutiveReadings: number;
  matchingReadingsInLast5: number;
  windowSize: number;
  confirmationRule: string;
  hysteresisActive: boolean;
  explanation: string;
}

const REGIME_ORDER = [
  "LOW RISK",
  "MODERATE RISK",
  "ELEVATED RISK",
  "HIGH STRESS",
  "SYSTEMIC CRISIS",
] as const;

const REGIME_ENTRY_THRESHOLDS: Record<string, number> = {
  "LOW RISK": 0,
  "MODERATE RISK": 25,
  "ELEVATED RISK": 45,
  "HIGH STRESS": 65,
  "SYSTEMIC CRISIS": 80,
};

const HYSTERESIS_BUFFER = 3;

function regimeRank(regime: string): number {
  return REGIME_ORDER.indexOf(regime as (typeof REGIME_ORDER)[number]);
}

function persistenceLabel(consecutive: number): RegimePersistenceLabel {
  if (consecutive >= 20) return "STRUCTURAL";
  if (consecutive >= 10) return "ESTABLISHED";
  if (consecutive >= 5) return "CONFIRMED";
  if (consecutive >= 3) return "PROVISIONAL";
  if (consecutive >= 2) return "EMERGING";
  return "SNAPSHOT";
}

/**
 * A single canonical reading describes current conditions only.
 * Persistence upgrades confidence only after repeated evidence.
 *
 * Confirmation:
 * - 1 reading: snapshot
 * - 2 readings: emerging
 * - 3-4 readings: provisional
 * - 5+ readings: confirmed
 * - 10+ readings: established
 * - 20+ readings: structural
 * - durable confirmation also requires 4 of the latest 5 readings to agree
 *
 * Hysteresis:
 * - upward transitions must clear the next regime's normal entry threshold
 * - downward transitions must clear the prior regime threshold by 3 points
 * - transitions must still satisfy the 4-of-5 and 5-reading persistence rules
 */
export function computeRegimePersistence(
  readings: RegimePersistenceInput[],
  priorConfirmedRegime: string | null = null,
): RegimePersistenceState {
  if (readings.length === 0) {
    return {
      snapshotRegime: "UNKNOWN",
      confirmedRegime: priorConfirmedRegime,
      label: "SNAPSHOT",
      consecutiveReadings: 0,
      matchingReadingsInLast5: 0,
      windowSize: 0,
      confirmationRule: "4 of 5 canonical readings + 5/10/20 persistence tiers + 3-point hysteresis",
      hysteresisActive: Boolean(priorConfirmedRegime),
      explanation: "No canonical readings are available.",
    };
  }

  const latest = readings[0];
  const snapshotRegime = latest.regime;

  let consecutiveReadings = 0;
  for (const reading of readings) {
    if (reading.regime !== snapshotRegime) break;
    consecutiveReadings += 1;
  }

  const last5 = readings.slice(0, 5);
  const matchingReadingsInLast5 = last5.filter((r) => r.regime === snapshotRegime).length;
  const hasFourOfFive = last5.length >= 5 && matchingReadingsInLast5 >= 4;
  const label = persistenceLabel(consecutiveReadings);

  let confirmedRegime: string | null =
    hasFourOfFive && consecutiveReadings >= 5 ? snapshotRegime : priorConfirmedRegime;
  let hysteresisActive = false;

  if (priorConfirmedRegime && snapshotRegime !== priorConfirmedRegime) {
    const priorRank = regimeRank(priorConfirmedRegime);
    const snapshotRank = regimeRank(snapshotRegime);

    if (priorRank >= 0 && snapshotRank >= 0) {
      if (snapshotRank < priorRank) {
        const priorEntry = REGIME_ENTRY_THRESHOLDS[priorConfirmedRegime] ?? 0;
        const exitThreshold = priorEntry - HYSTERESIS_BUFFER;
        const clearedExitBuffer = latest.pressureScore <= exitThreshold;
        if (!clearedExitBuffer || !hasFourOfFive || consecutiveReadings < 5) {
          confirmedRegime = priorConfirmedRegime;
          hysteresisActive = true;
        } else {
          confirmedRegime = snapshotRegime;
        }
      } else if (snapshotRank > priorRank) {
        const newEntry = REGIME_ENTRY_THRESHOLDS[snapshotRegime] ?? 101;
        const clearedEntryThreshold = latest.pressureScore >= newEntry;
        if (!clearedEntryThreshold || !hasFourOfFive || consecutiveReadings < 5) {
          confirmedRegime = priorConfirmedRegime;
          hysteresisActive = true;
        } else {
          confirmedRegime = snapshotRegime;
        }
      }
    }
  }

  const tierText =
    label === "SNAPSHOT"
      ? "one reading describes the present only"
      : label === "EMERGING"
      ? "the regime is emerging but not confirmed"
      : label === "PROVISIONAL"
      ? "the regime is provisional"
      : label === "CONFIRMED"
      ? "the regime is confirmed"
      : label === "ESTABLISHED"
      ? "the regime is established"
      : "the regime is structural";

  const base = `Snapshot: ${snapshotRegime}; ${tierText}; ${matchingReadingsInLast5} of the last ${last5.length} readings agree.`;
  const explanation =
    hysteresisActive && priorConfirmedRegime
      ? `${base} Hysteresis retains ${priorConfirmedRegime} until the transition is persistent and clears the boundary buffer.`
      : base;

  return {
    snapshotRegime,
    confirmedRegime,
    label,
    consecutiveReadings,
    matchingReadingsInLast5,
    windowSize: last5.length,
    confirmationRule: "4 of 5 canonical readings + 5/10/20 persistence tiers + 3-point hysteresis",
    hysteresisActive,
    explanation,
  };
}
