/* ============================================================
   FAULTLINE — TickerStore (Universal Intelligence Context)
   Global ticker context that carries the selected security
   across ALL analysis pages automatically.

   Usage:
     const { ticker, setTicker, assetType, setAssetType } = useTickerStore();

   When a user selects a security on ANY page, all analysis
   pages (Signal Outlook, Decision Engine, Diagnostic, Situation
   Room, Pre-Flight) automatically pick it up via this store.
   ============================================================ */
import { createContext, useContext, useState, useCallback, ReactNode } from "react";

export type AssetType = "stock" | "crypto";

export interface TickerEntry {
  ticker: string;
  name: string;
  assetType: AssetType;
  selectedAt: number; // timestamp
}

interface TickerStoreState {
  /** Currently active ticker */
  current: TickerEntry | null;
  /** Recent ticker history (last 10) */
  history: TickerEntry[];
  /** Set the active ticker — broadcasts to all subscribed pages */
  setTicker: (ticker: string, name: string, assetType: AssetType) => void;
  /** Clear the active ticker */
  clearTicker: () => void;
  /** Whether a ticker is currently selected */
  hasTicker: boolean;
}

const TickerStoreContext = createContext<TickerStoreState | null>(null);

export function TickerStoreProvider({ children }: { children: ReactNode }) {
  const [current, setCurrent] = useState<TickerEntry | null>(null);
  const [history, setHistory] = useState<TickerEntry[]>([]);

  const setTicker = useCallback((ticker: string, name: string, assetType: AssetType) => {
    const entry: TickerEntry = {
      ticker: ticker.toUpperCase(),
      name,
      assetType,
      selectedAt: Date.now(),
    };
    setCurrent(entry);
    setHistory(prev => {
      // Remove duplicate, prepend new, cap at 10
      const filtered = prev.filter(h => h.ticker !== entry.ticker);
      return [entry, ...filtered].slice(0, 10);
    });
  }, []);

  const clearTicker = useCallback(() => {
    setCurrent(null);
  }, []);

  return (
    <TickerStoreContext.Provider value={{
      current,
      history,
      setTicker,
      clearTicker,
      hasTicker: current !== null,
    }}>
      {children}
    </TickerStoreContext.Provider>
  );
}

export function useTickerStore(): TickerStoreState {
  const ctx = useContext(TickerStoreContext);
  if (!ctx) throw new Error("useTickerStore must be used within TickerStoreProvider");
  return ctx;
}
