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
import { createContext, useContext, useState, ReactNode, useCallback, useEffect, useMemo, useRef } from "react";

const ASHA_THREAD_STORAGE_KEY = "faultline:asha-thread:v1";
const MAX_ASHA_THREAD_MESSAGES = 24;

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

export interface AshaThreadMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  page: string;
  createdAt: number;
  confidence?: "high" | "moderate" | "low";
  sources?: string[];
  enginesConsulted?: string[];
}

export interface AshaThreadExchange {
  question: string;
  answer: string;
  page: string;
  confidence: "high" | "moderate" | "low";
  sources: string[];
  enginesConsulted: string[];
}

function loadPersistedThread(): AshaThreadMessage[] {
  if (typeof window === "undefined") return [];

  try {
    const stored = window.sessionStorage.getItem(ASHA_THREAD_STORAGE_KEY);
    if (!stored) return [];
    const parsed = JSON.parse(stored);
    if (!Array.isArray(parsed)) return [];

    return parsed.filter((message): message is AshaThreadMessage => (
      message
      && typeof message.id === "string"
      && (message.role === "user" || message.role === "assistant")
      && typeof message.content === "string"
      && typeof message.page === "string"
      && typeof message.createdAt === "number"
    )).slice(-MAX_ASHA_THREAD_MESSAGES);
  } catch {
    return [];
  }
}

function createThreadMessageId(role: AshaThreadMessage["role"]): string {
  const token = typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `${role}-${token}`;
}

interface AshaContextType {
  pageContext: AshaPageContextValue;
  setPageContext: (ctx: AshaPageContextValue) => void;
  threadMessages: AshaThreadMessage[];
  threadHistory: Array<{ role: "user" | "assistant"; content: string }>;
  appendThreadExchange: (exchange: AshaThreadExchange) => void;
  clearThread: () => void;
}

const AshaContext = createContext<AshaContextType>({
  pageContext: { page: "dashboard" },
  setPageContext: () => {},
  threadMessages: [],
  threadHistory: [],
  appendThreadExchange: () => {},
  clearThread: () => {},
});

export function AshaProvider({ children }: { children: ReactNode }) {
  const [pageContext, setPageContextState] = useState<AshaPageContextValue>({ page: "dashboard" });
  const [threadMessages, setThreadMessages] = useState<AshaThreadMessage[]>(loadPersistedThread);

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

  useEffect(() => {
    try {
      window.sessionStorage.setItem(ASHA_THREAD_STORAGE_KEY, JSON.stringify(threadMessages));
    } catch {
      // Session persistence is best-effort; the in-memory thread remains authoritative.
    }
  }, [threadMessages]);

  const appendThreadExchange = useCallback((exchange: AshaThreadExchange) => {
    const createdAt = Date.now();
    const nextMessages: AshaThreadMessage[] = [
      {
        id: createThreadMessageId("user"),
        role: "user",
        content: exchange.question,
        page: exchange.page,
        createdAt,
      },
      {
        id: createThreadMessageId("assistant"),
        role: "assistant",
        content: exchange.answer,
        page: exchange.page,
        createdAt: createdAt + 1,
        confidence: exchange.confidence,
        sources: exchange.sources,
        enginesConsulted: exchange.enginesConsulted,
      },
    ];

    setThreadMessages(previous => (
      [...previous, ...nextMessages].slice(-MAX_ASHA_THREAD_MESSAGES)
    ));
  }, []);

  const clearThread = useCallback(() => setThreadMessages([]), []);
  const threadHistory = useMemo(
    () => threadMessages.map(({ role, content }) => ({ role, content })),
    [threadMessages],
  );

  return (
    <AshaContext.Provider value={{
      pageContext,
      setPageContext,
      threadMessages,
      threadHistory,
      appendThreadExchange,
      clearThread,
    }}>
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
