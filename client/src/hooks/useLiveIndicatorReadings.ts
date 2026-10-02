import { useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { useAppHeaderFred } from "@/hooks/useAppHeaderFred";
import { buildLiveIndicatorReadings, type LiveIndicatorReadings } from "@/lib/liveIndicatorReadings";

/**
 * Real macro indicator readings (FRED + markets snapshot), shared with the
 * /app header strip queries. Missing sources stay absent → UNAVAILABLE.
 */
export function useLiveIndicatorReadings(): { readings: LiveIndicatorReadings; isLoading: boolean } {
  const quotesQuery = trpc.markets.getGlobalSnapshot.useQuery(undefined, {
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });
  const fred = useAppHeaderFred();
  const readings = useMemo(
    () => buildLiveIndicatorReadings({ quotes: quotesQuery.data?.items ?? null, fred, now: Date.now() }),
    [quotesQuery.data, fred],
  );
  return { readings, isLoading: quotesQuery.isLoading };
}
