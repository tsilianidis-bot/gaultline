/**
 * Signal Outlook "FAULTLINE Environment" panel: Pressure Index and Regime come from the
 * canonical snapshot (outlook.getOutlook → canonicalState), like every other surface,
 * so the panel reads e.g. "34/100 · MODERATE RISK". "Unavailable" when there is no snapshot.
 */
export type OutlookCanonicalEnvironment = { pressureIndex: number | null; regime: string | null } | null | undefined;

export function outlookEnvironmentDisplay(canonical: OutlookCanonicalEnvironment) {
  const p = canonical?.pressureIndex;
  const pressureIndex = typeof p === "number" && Number.isFinite(p) ? p : null;
  const regime = canonical?.regime?.trim() ? canonical.regime : null;
  return {
    pressureIndex,
    pressureText: pressureIndex === null ? "Unavailable" : `${pressureIndex}/100`,
    badge: pressureIndex === null ? "PRESSURE UNAVAILABLE" : `PRESSURE ${pressureIndex}`,
    regimeText: regime ?? "Unavailable",
  };
}
