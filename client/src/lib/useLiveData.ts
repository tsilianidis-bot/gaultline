// ============================================================
// FAULTLINE — Live Data Client v3 (Proxy-based)
//
// Fetches all 10 FRED series via the backend proxy at /api/fred/bulk
// which handles the FRED API key and CORS server-side.
//
// Series mapping:
//   DGS10        → yield10Y (%)
//   DGS30        → yield30Y (%)
//   T10Y2Y       → yieldCurveSpread (bps, multiplied by 100)
//   CPIAUCSL     → cpi (YoY % computed from last 13 obs)
//   PPIACO       → ppi (YoY % computed from last 13 obs)
//   UNRATE       → unemployment (%)
//   M2SL         → fedBalanceSheet proxy ($ billions → $T)
//   BAMLH0A0HYM2 → hySpread (already in %, convert to bps ×100)
//   NFCI         → bankLiquidityStress (mapped 0–10)
//   SOFR         → fedFundsRate proxy (%)
//
// Caching: 15-min localStorage per series
// Auto-refresh: every 15 minutes
// Fallback: DEFAULT_INDICATORS on any failure
// ============================================================
import { useState, useEffect, useCallback, useRef } from 'react';
import { RawIndicators, DEFAULT_INDICATORS } from './engine';

// ── Series definitions ────────────────────────────────────────
const FRED_SERIES_CONFIG: Record<string, { limit: number; needsYoY: boolean }> = {
  DGS10:        { limit: 2,  needsYoY: false },
  DGS30:        { limit: 2,  needsYoY: false },
  T10Y2Y:       { limit: 2,  needsYoY: false },
  CPIAUCSL:     { limit: 14, needsYoY: true  },
  PPIACO:       { limit: 14, needsYoY: true  },
  UNRATE:       { limit: 2,  needsYoY: false },
  M2SL:         { limit: 2,  needsYoY: false },
  BAMLH0A0HYM2: { limit: 2,  needsYoY: false },
  NFCI:         { limit: 2,  needsYoY: false },
  SOFR:         { limit: 2,  needsYoY: false },
};

// ── Cache ─────────────────────────────────────────────────────
const CACHE_TTL_MS = 15 * 60 * 1000;
const CACHE_KEY_PREFIX = 'faultline_fred_v3_';

interface CacheEntry {
  seriesMap: Record<string, { date: string; value: string }[]>;
  fetchedAt: number;
}

function getCache(): CacheEntry | undefined {
  try {
    const raw = localStorage.getItem(CACHE_KEY_PREFIX + 'bulk');
    if (!raw) return undefined;
    const entry: CacheEntry = JSON.parse(raw);
    if (Date.now() - entry.fetchedAt > CACHE_TTL_MS) return undefined;
    return entry;
  } catch {
    return undefined;
  }
}

function setCache(seriesMap: Record<string, { date: string; value: string }[]>) {
  try {
    const entry: CacheEntry = { seriesMap, fetchedAt: Date.now() };
    localStorage.setItem(CACHE_KEY_PREFIX + 'bulk', JSON.stringify(entry));
  } catch {
    // ignore
  }
}

// ── Parse helpers ─────────────────────────────────────────────
function latestValid(obs: { date: string; value: string }[]): number | null {
  for (const o of obs) {
    if (o.value !== '.' && o.value !== '') {
      const v = parseFloat(o.value);
      if (!isNaN(v)) return v;
    }
  }
  return null;
}

function yoyPct(obs: { date: string; value: string }[]): number | null {
  const recent = latestValid(obs.slice(0, 3));
  const prior = latestValid(obs.slice(10, 14));
  if (recent === null || prior === null || prior === 0) return null;
  return parseFloat(((recent - prior) / Math.abs(prior) * 100).toFixed(2));
}

// ── Map FRED observations → RawIndicators ────────────────────
function mapToIndicators(
  series: Record<string, { date: string; value: string }[]>
): Partial<RawIndicators> {
  const result: Partial<RawIndicators> = {};

  const dgs10 = latestValid(series['DGS10'] ?? []);
  if (dgs10 !== null) result.yield10Y = dgs10;

  const dgs30 = latestValid(series['DGS30'] ?? []);
  if (dgs30 !== null) result.yield30Y = dgs30;

  const t10y2y = latestValid(series['T10Y2Y'] ?? []);
  if (t10y2y !== null) result.yieldCurveSpread = Math.round(t10y2y * 100);

  const cpiYoY = yoyPct(series['CPIAUCSL'] ?? []);
  if (cpiYoY !== null) result.cpi = cpiYoY;

  const ppiYoY = yoyPct(series['PPIACO'] ?? []);
  if (ppiYoY !== null) result.ppi = ppiYoY;

  const unrate = latestValid(series['UNRATE'] ?? []);
  if (unrate !== null) result.unemployment = unrate;

  const m2 = latestValid(series['M2SL'] ?? []);
  if (m2 !== null) result.fedBalanceSheet = parseFloat((m2 / 1000).toFixed(2));

  const hy = latestValid(series['BAMLH0A0HYM2'] ?? []);
  if (hy !== null) {
    result.hySpread = hy > 20 ? Math.round(hy) : Math.round(hy * 100);
  }

  const nfci = latestValid(series['NFCI'] ?? []);
  if (nfci !== null) {
    const stress = Math.max(0, Math.min(10, 5 + nfci * 3.5));
    result.bankLiquidityStress = parseFloat(stress.toFixed(2));
  }

  const sofr = latestValid(series['SOFR'] ?? []);
  if (sofr !== null) result.fedFundsRate = sofr;

  return result;
}

// ── Fetch via backend proxy ───────────────────────────────────
export interface FetchStatus {
  seriesId: string;
  status: 'ok' | 'error' | 'pending';
  latestValue: number | null;
  latestDate: string | null;
  error?: string;
  cached: boolean;
}

async function fetchAllViaProxy(): Promise<{
  seriesMap: Record<string, { date: string; value: string }[]>;
  fetchStatuses: FetchStatus[];
}> {
  const cached = getCache();
  if (cached) {
    const statuses: FetchStatus[] = Object.keys(FRED_SERIES_CONFIG).map(id => {
      const obs = cached.seriesMap[id] ?? [];
      return {
        seriesId: id,
        status: 'ok' as const,
        latestValue: latestValid(obs),
        latestDate: obs[0]?.date ?? null,
        cached: true,
      };
    });
    return { seriesMap: cached.seriesMap, fetchStatuses: statuses };
  }

  const seriesPayload = Object.entries(FRED_SERIES_CONFIG).map(([id, cfg]) => ({
    id,
    limit: cfg.limit,
  }));

  const res = await fetch('/api/fred/bulk', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ series: seriesPayload }),
    signal: AbortSignal.timeout(30000),
  });

  if (!res.ok) {
    throw new Error(`Proxy returned HTTP ${res.status}`);
  }

  const data = await res.json() as {
    results: Record<string, { observations: { date: string; value: string }[]; cached: boolean; error?: string }>;
    timestamp: string;
  };

  const seriesMap: Record<string, { date: string; value: string }[]> = {};
  const fetchStatuses: FetchStatus[] = [];

  for (const [id, result] of Object.entries(data.results)) {
    seriesMap[id] = result.observations;
    fetchStatuses.push({
      seriesId: id,
      status: result.error ? 'error' : 'ok',
      latestValue: latestValid(result.observations),
      latestDate: result.observations[0]?.date ?? null,
      error: result.error,
      cached: result.cached,
    });
  }

  setCache(seriesMap);
  return { seriesMap, fetchStatuses };
}

// ── Public hook ───────────────────────────────────────────────
export interface LiveDataState {
  indicators: RawIndicators;
  rawFred: Record<string, number | null>;
  fetchStatuses: FetchStatus[];
  isLoading: boolean;
  isLive: boolean;
  lastUpdated: Date | null;
  error: string | null;
  successCount: number;
  failCount: number;
  refresh: () => void;
}

export function useLiveData(): LiveDataState {
  const [indicators, setIndicators] = useState<RawIndicators>(DEFAULT_INDICATORS);
  const [rawFred, setRawFred] = useState<Record<string, number | null>>({});
  const [fetchStatuses, setFetchStatuses] = useState<FetchStatus[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLive, setIsLive] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successCount, setSuccessCount] = useState(0);
  const [failCount, setFailCount] = useState(0);
  const fetchCountRef = useRef(0);

  const fetchAll = useCallback(async () => {
    const fetchId = ++fetchCountRef.current;
    setIsLoading(true);
    setError(null);

    try {
      const { seriesMap, fetchStatuses: statuses } = await fetchAllViaProxy();

      if (fetchId !== fetchCountRef.current) return;

      const ok = statuses.filter(s => s.status === 'ok' && s.latestValue !== null).length;
      const fail = statuses.filter(s => s.status === 'error').length;

      setFetchStatuses(statuses);
      setSuccessCount(ok);
      setFailCount(fail);

      const rawValues: Record<string, number | null> = {};
      for (const [id, obs] of Object.entries(seriesMap)) {
        rawValues[id] = latestValid(obs);
      }
      setRawFred(rawValues);

      if (ok >= 3) {
        const livePatch = mapToIndicators(seriesMap);
        const merged: RawIndicators = { ...DEFAULT_INDICATORS, ...livePatch };
        setIndicators(merged);
        setIsLive(true);
        setLastUpdated(new Date());
        setError(null);
        console.info(`[FAULTLINE] LIVE: ${ok}/${statuses.length} FRED series loaded via proxy`);
      } else {
        setIndicators(DEFAULT_INDICATORS);
        setIsLive(false);
        setError(`Only ${ok} series available — showing simulated baseline`);
        console.warn(`[FAULTLINE] Insufficient FRED data (${ok}/${statuses.length})`);
      }
    } catch (err) {
      if (fetchId !== fetchCountRef.current) return;
      setIndicators(DEFAULT_INDICATORS);
      setIsLive(false);
      setError('FRED proxy connection error — showing simulated baseline');
      console.error('[FAULTLINE] FRED proxy error:', err);
    } finally {
      if (fetchId === fetchCountRef.current) {
        setIsLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  useEffect(() => {
    const interval = setInterval(() => {
      try { localStorage.removeItem(CACHE_KEY_PREFIX + 'bulk'); } catch {}
      fetchAll();
    }, CACHE_TTL_MS);
    return () => clearInterval(interval);
  }, [fetchAll]);

  return {
    indicators,
    rawFred,
    fetchStatuses,
    isLoading,
    isLive,
    lastUpdated,
    error,
    successCount,
    failCount,
    refresh: fetchAll,
  };
}

export function clearFredCache() {
  try { localStorage.removeItem(CACHE_KEY_PREFIX + 'bulk'); } catch {}
}
