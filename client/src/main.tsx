import { trpc } from "@/lib/trpc";
import { UNAUTHED_ERR_MSG } from '@shared/const';
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { httpBatchLink, TRPCClientError } from "@trpc/client";
import { createRoot } from "react-dom/client";
import superjson from "superjson";
import App from "./App";
import { getLoginUrl } from "./const";
import { TickerStoreProvider } from "./contexts/TickerStore";
import { AshaProvider } from "./contexts/AshaContext";
import "./index.css";

/**
 * FIX: Intercept HTTP responses that are NOT superjson-encoded tRPC envelopes.
 * This happens when Express middleware (e.g. rate limiter, auth guard) short-circuits
 * the request before tRPC handles it, returning a plain JSON error.
 * Without this wrapper the tRPC client throws "Unable to transform response from server".
 */
async function safeFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const response = await globalThis.fetch(input, { ...(init ?? {}), credentials: "include" });

  // If the response is OK, pass it through unchanged
  if (response.ok) return response;

  // For non-OK responses, check if the body is a valid tRPC envelope
  // by cloning and peeking at the JSON. If it's not, wrap it.
  const cloned = response.clone();
  try {
    const body = await cloned.json();
    // A valid tRPC envelope has either a `result` or `error` key at the top level
    // (or is an array of such objects for batched requests)
    const isValidEnvelope = (obj: unknown): boolean => {
      if (Array.isArray(obj)) return obj.every(isValidEnvelope);
      if (typeof obj !== "object" || obj === null) return false;
      return "result" in obj || "error" in obj;
    };
    if (isValidEnvelope(body)) return response; // already a valid tRPC envelope

    // Not a tRPC envelope — wrap it as a tRPC error so superjson can deserialize it
    const message =
      (typeof body === "object" && body !== null && "error" in body && typeof (body as Record<string, unknown>).error === "string")
        ? (body as { error: string }).error
        : `HTTP ${response.status}: ${response.statusText}`;

    const tRPCErrorBody = JSON.stringify({
      error: {
        json: {
          message,
          code: -32000,
          data: { code: "HTTP_ERROR", httpStatus: response.status },
        },
      },
    });
    return new Response(tRPCErrorBody, {
      status: response.status,
      headers: { "content-type": "application/json" },
    });
  } catch {
    // Body is not JSON at all — return a synthetic tRPC error
    const tRPCErrorBody = JSON.stringify({
      error: {
        json: {
          message: `HTTP ${response.status}: ${response.statusText}`,
          code: -32000,
          data: { code: "HTTP_ERROR", httpStatus: response.status },
        },
      },
    });
    return new Response(tRPCErrorBody, {
      status: response.status,
      headers: { "content-type": "application/json" },
    });
  }
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Data stays fresh for 2 minutes — avoids redundant refetches when switching tabs
      staleTime: 2 * 60 * 1000,
      // Keep unused query data in cache for 5 minutes
      gcTime: 5 * 60 * 1000,
      // Only retry once on failure (default 3 is too aggressive for market data)
      retry: 1,
      // Don't refetch on window focus — market data doesn't change that fast
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: 0,
    },
  },
});

const redirectToLoginIfUnauthorized = (error: unknown) => {
  if (!(error instanceof TRPCClientError)) return;
  if (typeof window === "undefined") return;

  const isUnauthorized = error.message === UNAUTHED_ERR_MSG;

  if (!isUnauthorized) return;

  window.location.href = getLoginUrl();
};

queryClient.getQueryCache().subscribe(event => {
  if (event.type === "updated" && event.action.type === "error") {
    const error = event.query.state.error;
    redirectToLoginIfUnauthorized(error);
    console.error("[API Query Error]", error);
  }
});

queryClient.getMutationCache().subscribe(event => {
  if (event.type === "updated" && event.action.type === "error") {
    const error = event.mutation.state.error;
    redirectToLoginIfUnauthorized(error);
    console.error("[API Mutation Error]", error);
  }
});

const trpcClient = trpc.createClient({
  links: [
    httpBatchLink({
      url: "/api/trpc",
      transformer: superjson,
      fetch: safeFetch,
    }),
  ],
});

createRoot(document.getElementById("root")!).render(
  <trpc.Provider client={trpcClient} queryClient={queryClient}>
    <QueryClientProvider client={queryClient}>
      <TickerStoreProvider>
        <AshaProvider>
          <App />
        </AshaProvider>
      </TickerStoreProvider>
    </QueryClientProvider>
  </trpc.Provider>
);

// ── Service Worker registration (PWA offline support) ─────────
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/sw.js", { scope: "/" })
      .then((reg) => {
        console.log("[SW] Registered:", reg.scope);
      })
      .catch((err) => {
        console.warn("[SW] Registration failed:", err);
      });
  });
}
