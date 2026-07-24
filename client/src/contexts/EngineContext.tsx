// ============================================================
// FAULTLINE — Engine Context v3 (Live FRED Integration)
//
// Architecture:
//   marketState.get → canonical live output
//   simulateOverrides → deterministic local simulation output
//
// Exposes:
//   - output: full EngineOutput (scores, regime, probability, narrative)
//   - rawFred: raw FRED values for display in ticker/cards
//   - isLive: true when FRED data is active
//   - isRefreshing: true during cinematic refresh transition
//   - isSimulating: true when user has active pressure overrides
// ============================================================
import {
  createContext, useContext, useState, useMemo,
  useCallback, useEffect, ReactNode,
} from 'react';
import { RawIndicators, DEFAULT_INDICATORS, EngineOutput } from '@/lib/engine';
import type { FetchStatus } from '@/lib/useLiveData';
import { selectBrowserMarketOutput, type BrowserMarketMode } from '@/lib/marketStateProjection';
import { trpc } from '@/lib/trpc';
import type { CanonicalMarketState, MarketStateSourceHealth } from '@shared/marketState';

export interface EngineContextValue {
  // Reactive engine output
  indicators: RawIndicators;
  output: EngineOutput;
  marketState: CanonicalMarketState | null;
  marketMode: BrowserMarketMode;
  sourceHealth: MarketStateSourceHealth[];

  // Raw FRED values for display (e.g. ticker, chart labels)
  rawFred: Record<string, number | null>;

  // Per-series fetch diagnostics
  fetchStatuses: FetchStatus[];
  successCount: number;
  failCount: number;

  // Live data state
  isLoading: boolean;
  isLive: boolean;
  isRefreshing: boolean; // cinematic transition flag
  lastUpdated: Date | null;
  dataError: string | null;
  refresh: () => void;
  forceRefresh: () => void; // clears cache + refetches

  // Simulate Pressure: override individual indicators
  simulateOverrides: Partial<RawIndicators>;
  isSimulating: boolean;
  setSimulateOverride: (key: keyof RawIndicators, value: number) => void;
  clearSimulateOverride: (key: keyof RawIndicators) => void;
  resetSimulation: () => void;
  applySimulation: () => void;

  // Direct indicator control (for Simulate Pressure sliders)
  setIndicator: (key: keyof RawIndicators, value: number) => void;
  resetIndicators: () => void;
}

const EngineContext = createContext<EngineContextValue | null>(null);

export function EngineProvider({ children }: { children: ReactNode }) {
  const marketStateQuery = trpc.marketState.current.useQuery(undefined, {
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });
  const marketState = marketStateQuery.data ?? null;
  const isLoading = marketStateQuery.isLoading;
  const sourceHealth = marketState?.sourceHealth ?? [];
  const isLive = Boolean(
    marketState &&
    marketState.cache.status !== 'stale-if-error' &&
    !sourceHealth.some(source => source.required && source.status === 'unavailable'),
  );
  const lastUpdated = marketState ? new Date(marketState.sourceUpdatedAt) : null;
  const dataError = marketStateQuery.error?.message
    ?? marketState?.cache.staleReason
    ?? marketState?.warnings[0]
    ?? null;
  const rawFred: Record<string, number | null> = {};
  const fetchStatuses = useMemo<FetchStatus[]>(() => sourceHealth.map(source => ({
    seriesId: source.id,
    status: source.status === 'healthy' ? 'ok' : source.status === 'unavailable' ? 'error' : 'pending',
    latestValue: null,
    latestDate: source.asOf,
    error: source.status === 'healthy' ? undefined : source.detail,
    cached: marketState?.cache.status !== 'refreshed',
  })), [marketState?.cache.status, sourceHealth]);
  const successCount = sourceHealth.filter(source => source.status === 'healthy').length;
  const failCount = sourceHealth.filter(source => source.status === 'unavailable').length;
  const refresh = useCallback(() => {
    void marketStateQuery.refetch();
  }, [marketStateQuery.refetch]);

  // Cinematic refresh transition: briefly true when new data arrives
  const [isRefreshing, setIsRefreshing] = useState(false);
  const prevLiveRef = useMemo(() => ({ current: isLive }), []);

  useEffect(() => {
    if (lastUpdated && !isLoading) {
      setIsRefreshing(true);
      const t = setTimeout(() => setIsRefreshing(false), 800);
      return () => clearTimeout(t);
    }
  }, [lastUpdated, isLoading]);

  // Simulate Pressure overrides (user-controlled)
  const [simulateOverrides, setSimulateOverrides] = useState<Partial<RawIndicators>>({});
  const isSimulating = Object.keys(simulateOverrides).length > 0;

  // Deterministic baseline inputs are used only for explicit simulation or
  // when canonical server state is temporarily unavailable.
  const indicators = useMemo<RawIndicators>(() => ({
    ...DEFAULT_INDICATORS,
    ...simulateOverrides,
  }), [simulateOverrides]);

  const projected = useMemo(() => selectBrowserMarketOutput({
    marketState,
    baselineIndicators: DEFAULT_INDICATORS,
    simulationOverrides: simulateOverrides,
  }), [marketState, simulateOverrides]);
  const output = projected.output;
  const marketMode = projected.mode;

  // Simulate Pressure controls
  const setSimulateOverride = useCallback((key: keyof RawIndicators, value: number) => {
    setSimulateOverrides(prev => ({ ...prev, [key]: value }));
  }, []);

  const clearSimulateOverride = useCallback((key: keyof RawIndicators) => {
    setSimulateOverrides(prev => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }, []);

  const resetSimulation = useCallback(() => {
    setSimulateOverrides({});
  }, []);

  const applySimulation = useCallback(() => {
    setSimulateOverrides({});
  }, []);

  // Force refresh: clear cache then refetch
  const forceRefresh = useCallback(() => {
    refresh();
  }, [refresh]);

  // Legacy direct indicator control
  const setIndicator = useCallback((key: keyof RawIndicators, value: number) => {
    setSimulateOverrides(prev => ({ ...prev, [key]: value }));
  }, []);

  const resetIndicators = useCallback(() => {
    setSimulateOverrides({});
  }, []);

  return (
    <EngineContext.Provider value={{
      indicators,
      output,
      marketState,
      marketMode,
      sourceHealth,
      rawFred,
      fetchStatuses,
      successCount,
      failCount,
      isLoading,
      isLive,
      isRefreshing,
      lastUpdated,
      dataError,
      refresh,
      forceRefresh,
      simulateOverrides,
      isSimulating,
      setSimulateOverride,
      clearSimulateOverride,
      resetSimulation,
      applySimulation,
      setIndicator,
      resetIndicators,
    }}>
      {children}
    </EngineContext.Provider>
  );
}

export function useEngine(): EngineContextValue {
  const ctx = useContext(EngineContext);
  if (!ctx) throw new Error('useEngine must be used within EngineProvider');
  return ctx;
}
