/* ============================================================
   ASHA Context
   Pages inject their page-specific context here.
   The global AshaPanel reads from this context.

   FIX: useRegisterAshaContext previously used JSON.stringify(ctx)
   as a useEffect dependency. When pages built ctx inline with
   arrays/objects, this produced a new string every render,
   causing an infinite setState → rerender loop that crashed React.

   Solution: compare only stable primitive fields as dependencies,
   and guard the stringify with try/catch. Pages MUST memoize the
   ctx object with useMemo to prevent unnecessary re-runs.
   ============================================================ */
import { createContext, useContext, useState, ReactNode, useCallback, useEffect, useRef } from "react";

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
    setPageContextState(prev => {
      // Only update if something actually changed to prevent unnecessary rerenders
      try {
        if (JSON.stringify(prev) === JSON.stringify(ctx)) return prev;
      } catch {
        // If stringify fails, always update
      }
      return ctx;
    });
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
// IMPORTANT: Pass a memoized ctx object from the calling page:
//   const ctx = useMemo(() => ({ page: "seismograph", ... }), [dep1, dep2]);
//   useRegisterAshaContext(ctx);
//
// This hook uses a ref-based approach to avoid JSON.stringify in
// the dependency array, which caused infinite render loops.
export function useRegisterAshaContext(ctx: AshaPageContextValue) {
  const { setPageContext } = useAshaContext();
  const ctxRef = useRef(ctx);

  // Update ref on every render so the effect always has latest value
  ctxRef.current = ctx;

  // Only re-run when the page changes (the most stable identifier)
  // For same-page updates, the ref ensures latest data is used
  const page = ctx.page;
  const pressureScore = ctx.pressureScore;
  const regime = ctx.regime;

  useEffect(() => {
    setPageContext(ctxRef.current);
    // Reset to dashboard on unmount
    return () => setPageContext({ page: "dashboard" });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, pressureScore, regime]);
}
