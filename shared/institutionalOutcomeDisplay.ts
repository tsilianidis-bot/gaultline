/**
 * Read-time display rule for broad institutional-event outcomes (institutionalEventOutcomes).
 *
 * Only corrected completed-session rows are valid outcomes: key
 * `institutional-event:<id>:broad-benchmark:<h>td:v2` AND outcomeJson.outcomeVersion
 * "v2-completed-bar". Legacy rows (intraday targets, 1962 DGS10 → "+0.0bp") stay in the
 * append-only table untouched, but are never returned or shown as outcomes. A horizon whose
 * only row is legacy is SUPERSEDED; a horizon with no row is PENDING.
 */

export const INSTITUTIONAL_OUTCOME_V2_VERSION = "v2-completed-bar";
export const INSTITUTIONAL_OUTCOME_HORIZONS = [1, 5, 20, 60] as const;

export function institutionalOutcomeKeyV2(eventId: number, horizonTradingDays: number): string {
  return `institutional-event:${eventId}:broad-benchmark:${horizonTradingDays}td:v2`;
}

const V2_KEY = /^institutional-event:\d+:broad-benchmark:\d+td:v2$/;

export function isVerifiedInstitutionalOutcome(row: { outcomeKey?: string | null; outcomeJson?: string | null }): boolean {
  if (!row.outcomeKey || !V2_KEY.test(row.outcomeKey)) return false;
  try {
    return JSON.parse(row.outcomeJson ?? "")?.outcomeVersion === INSTITUTIONAL_OUTCOME_V2_VERSION;
  } catch {
    return false;
  }
}

/** Events the broad collector measures (same predicate as collectBroadInstitutionalEventOutcomes). */
export function isBroadOutcomeEligibleEvent(event: { entityType?: string | null; eventType?: string | null }): boolean {
  return event.entityType === "market" || (event.entityType === "market_warning" && event.eventType === "warning_detected");
}

export type InstitutionalOutcomeStatus = "VERIFIED" | "SUPERSEDED" | "PENDING";
export type InstitutionalHorizonStatus = { horizonTradingDays: number; status: InstitutionalOutcomeStatus };

/**
 * Per-event view: `outcomes` holds verified v2 rows only (legacy rows are dropped, their
 * values never leave the server); `outcomeStatus` gives every horizon's state.
 */
export function buildInstitutionalOutcomeView<T extends { outcomeKey: string; outcomeJson: string; horizonTradingDays: number }>(rows: T[]) {
  const verified = rows.filter(isVerifiedInstitutionalOutcome).sort((a, b) => b.horizonTradingDays - a.horizonTradingDays);
  const legacyHorizons = new Set(rows.filter(row => !isVerifiedInstitutionalOutcome(row)).map(row => row.horizonTradingDays));
  const verifiedHorizons = new Set(verified.map(row => row.horizonTradingDays));
  const outcomeStatus: InstitutionalHorizonStatus[] = INSTITUTIONAL_OUTCOME_HORIZONS.map(horizonTradingDays => ({
    horizonTradingDays,
    status: verifiedHorizons.has(horizonTradingDays) ? "VERIFIED" : legacyHorizons.has(horizonTradingDays) ? "SUPERSEDED" : "PENDING",
  }));
  return { outcomes: verified, outcomeStatus };
}

export function institutionalOutcomeStatusText(status: InstitutionalOutcomeStatus): string {
  return status === "SUPERSEDED"
    ? "SUPERSEDED · earlier measurement withdrawn; corrected completed-session outcome pending"
    : status === "PENDING"
      ? "PENDING · completed source window not yet available"
      : "VERIFIED";
}
