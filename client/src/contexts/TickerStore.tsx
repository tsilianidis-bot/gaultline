/* ============================================================
   FAULTLINE — TickerStore (Universal Intelligence Context)
   Global ticker context that carries the selected security
   across ALL analysis pages automatically.

   Usage:
     const { current, setTicker, clearTicker, resolveAskContext, askPlaceholder } = useTickerStore();

   When a user selects a security on ANY page, all analysis
   pages (Signal Outlook, Decision Engine, Diagnostic, Situation
   Room, Pre-Flight) automatically pick it up via this store.

   When a user submits a question, call resolveAskContext(question)
   BEFORE sending to the backend. It returns the resolved symbol
   and mode, and automatically updates the store state.
   ============================================================ */
import { createContext, useContext, useState, useCallback, ReactNode } from "react";
import {
  classifyAskIntent,
  getAskPlaceholder,
  type AskMode,
  type ClassifiedIntent,
} from "@/lib/askIntentClassifier";

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
  /** Current Ask mode (global, macro, stock, crypto, etc.) */
  askMode: AskMode;
  /** Placeholder text for the Ask input */
  askPlaceholder: string;
  /** Set the active ticker — broadcasts to all subscribed pages */
  setTicker: (ticker: string, name: string, assetType: AssetType) => void;
  /** Clear the active ticker and reset to global mode */
  clearTicker: () => void;
  /** Whether a ticker is currently selected */
  hasTicker: boolean;
  /**
   * Classify a question and resolve the context BEFORE sending to backend.
   * Automatically updates the store (clears ticker if global question, switches
   * ticker if new ticker detected in question).
   * Returns the classified intent for use in the backend call.
   */
  resolveAskContext: (question: string) => ClassifiedIntent;
}

const TickerStoreContext = createContext<TickerStoreState | null>(null);

export function TickerStoreProvider({ children }: { children: ReactNode }) {
  const [current, setCurrent] = useState<TickerEntry | null>(null);
  const [history, setHistory] = useState<TickerEntry[]>([]);
  const [askMode, setAskMode] = useState<AskMode>("global");

  const setTicker = useCallback((ticker: string, name: string, assetType: AssetType) => {
    const entry: TickerEntry = {
      ticker: ticker.toUpperCase(),
      name,
      assetType,
      selectedAt: Date.now(),
    };
    setCurrent(entry);
    setAskMode(assetType === "crypto" ? "crypto" : "stock");
    setHistory(prev => {
      // Remove duplicate, prepend new, cap at 10
      const filtered = prev.filter(h => h.ticker !== entry.ticker);
      return [entry, ...filtered].slice(0, 10);
    });
  }, []);

  const clearTicker = useCallback(() => {
    setCurrent(null);
    setAskMode("global");
  }, []);

  const resolveAskContext = useCallback((question: string): ClassifiedIntent => {
    const intent = classifyAskIntent(
      question,
      current?.ticker ?? null,
      current?.assetType ?? null,
    );

    // Auto-update store based on classification
    if (intent.shouldClearSymbol) {
      // Global/macro/portfolio question — clear symbol context
      setCurrent(null);
      setAskMode(intent.mode);
    } else if (intent.detectedTicker && intent.detectedTicker !== current?.ticker) {
      // New ticker detected in question — switch context
      const assetType: AssetType = intent.mode === "crypto" ? "crypto" : "stock";
      const entry: TickerEntry = {
        ticker: intent.detectedTicker,
        name: intent.detectedTicker,
        assetType,
        selectedAt: Date.now(),
      };
      setCurrent(entry);
      setAskMode(intent.mode);
      setHistory(prev => {
        const filtered = prev.filter(h => h.ticker !== entry.ticker);
        return [entry, ...filtered].slice(0, 10);
      });
    } else {
      // Keep current context, just update mode
      setAskMode(intent.mode);
    }

    return intent;
  }, [current]);

  const askPlaceholder = getAskPlaceholder(askMode, current?.ticker ?? null);

  return (
    <TickerStoreContext.Provider value={{
      current,
      history,
      askMode,
      askPlaceholder,
      setTicker,
      clearTicker,
      hasTicker: current !== null,
      resolveAskContext,
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
