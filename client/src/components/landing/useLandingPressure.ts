/**
 * Landing-page read of the public canonical Pressure Index.
 * One snapshot via usePressureSnapshot (marketState.canonicalCurrent, shared
 * with /pressure-index); react-query dedupes the hero and Pressure section.
 */
import { useMemo } from "react";
import { usePressureSnapshot } from "@/hooks/usePressureSnapshot";
import { landingFromSnapshot, type LandingPressure } from "./landingPressure";

export * from "./landingPressure";
export { formatPressureAsOf, PRESSURE_BANDS } from "@/lib/pressureSnapshot";

export function useLandingPressure(): LandingPressure {
  const snapshot = usePressureSnapshot();
  return useMemo(() => landingFromSnapshot(snapshot), [snapshot]);
}
