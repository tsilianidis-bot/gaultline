import { useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { selectPressureSnapshot, type PressureSnapshotView } from "@/lib/pressureSnapshot";

/**
 * One authoritative Pressure Index snapshot for gauges (public page, landing hero, app).
 * Reads marketState.canonicalCurrent once; ring, number, band, regime, timestamp and
 * interpretation must all be taken from the returned view.
 */
export function usePressureSnapshot(): PressureSnapshotView {
  const { data, isLoading, error } = trpc.marketState.canonicalCurrent.useQuery(undefined, {
    refetchInterval: 60_000,
    staleTime: 30_000,
  });
  return useMemo(() => selectPressureSnapshot({ data, isLoading, error }), [data, isLoading, error]);
}
