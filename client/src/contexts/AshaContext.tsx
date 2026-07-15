/* ============================================================
   ASHA Context
   Pages inject their page-specific context here.
   The global AshaPanel reads from this context.
   ============================================================ */
import { createContext, useContext, useState, ReactNode, useCallback } from "react";

export interface AshaPageContextValue {
  page: string;
  pressureScore?: number;
  regime?: string;
  regimeConfidence?: number;
  narrative?: string;
  trend?: string;
  keyDrivers?: string[];
  historicalAnalog?: string;
  transitionProbability?: number;
  additionalContext?: Record<string, unknown>;
}

interface AshaContextType {
  pageContext: AshaPageContextValue;
  setPageContext: (ctx: AshaPageContextValue) => void;
}

const AshaContext = createContext<AshaContextType>({
  pageContext: { page: "dashboard" },
  setPageContext: () => {},
});

export function AshaProvider({ children }: { children: ReactNode }) {
  const [pageContext, setPageContextState] = useState<AshaPageContextValue>({ page: "dashboard" });

  const setPageContext = useCallback((ctx: AshaPageContextValue) => {
    setPageContextState(ctx);
  }, []);

  return (
    <AshaContext.Provider value={{ pageContext, setPageContext }}>
      {children}
    </AshaContext.Provider>
  );
}

export function useAshaContext() {
  return useContext(AshaContext);
}

// ── Hook for pages to register their context ─────────────────
import { useEffect } from "react";

export function useRegisterAshaContext(ctx: AshaPageContextValue) {
  const { setPageContext } = useAshaContext();
  useEffect(() => {
    setPageContext(ctx);
    // Reset to dashboard on unmount
    return () => setPageContext({ page: "dashboard" });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(ctx)]);
}
