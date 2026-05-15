// ============================================================
// FAULTLINE — Engine Context v3 (Live FRED Integration)
//
// Architecture:
//   useLiveData() → liveIndicators + rawFred
//   simulateOverrides → merged indicators
//   computeEngine(merged) → EngineOutput
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
import { RawIndicators, DEFAULT_INDICATORS, EngineOutput, computeEngine } from '@/lib/engine';
import { useLiveData, clearFredCache, FetchStatus } from '@/lib/useLiveData';

export interface EngineContextValue {
  // Reactive engine output
  indicators: RawIndicators;
  output: EngineOutput;

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
  const {
    indicators: liveIndicators,
    rawFred,
    fetchStatuses,
    isLoading,
    isLive,
    lastUpdated,
    error: dataError,
    successCount,
    failCount,
    refresh,
  } = useLiveData();

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

  // Merged indicators: live data + simulation overrides
  const indicators = useMemo<RawIndicators>(() => ({
    ...liveIndicators,
    ...simulateOverrides,
  }), [liveIndicators, simulateOverrides]);

  // Compute engine output from merged indicators
  const output = useMemo<EngineOutput>(() => computeEngine(indicators), [indicators]);

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
    clearFredCache();
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
