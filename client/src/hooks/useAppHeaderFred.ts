import { useQuery } from "@tanstack/react-query";
import { APP_HEADER_FRED_SERIES, type AppHeaderFredSeriesId, type FredObservation } from "@/lib/appHeaderStrip";

export type AppHeaderFred = Partial<Record<AppHeaderFredSeriesId, FredObservation[] | null>>;

const EMPTY: AppHeaderFred = {};

async function loadAppHeaderFred(): Promise<AppHeaderFred> {
  const entries = await Promise.all(APP_HEADER_FRED_SERIES.map(async ({ id, limit }) => {
    try {
      const res = await fetch(`/api/fred?series_id=${id}&limit=${limit}`);
      if (!res.ok) return [id, null] as const;
      const body = await res.json();
      return [id, Array.isArray(body?.observations) ? body.observations as FredObservation[] : null] as const;
    } catch {
      return [id, null] as const;
    }
  }));
  return Object.fromEntries(entries);
}

/**
 * FRED observations for the /app header strip and S.O.B. inputs (public /api/fred
 * proxy, server-cached). One shared query, so the header and the Pressure page
 * read the same observations. Missing series stay null → UNAVAILABLE.
 */
export function useAppHeaderFred(): AppHeaderFred {
  const { data } = useQuery({
    queryKey: ["app-header-fred"],
    queryFn: loadAppHeaderFred,
    refetchInterval: 15 * 60 * 1000,
    staleTime: 15 * 60 * 1000,
    retry: false,
  });
  return data ?? EMPTY;
}
