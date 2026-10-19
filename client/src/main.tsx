import { trpc } from "@/lib/trpc";
import { UNAUTHED_ERR_MSG } from '@shared/const';
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { httpBatchLink, httpLink, splitLink, TRPCClientError } from "@trpc/client";
import { createRoot } from "react-dom/client";
import { lazy, Suspense } from "react";
import superjson from "superjson";
import { navigateToLogin } from "./const";
import { initializeAnalytics } from "./lib/ga4";
import { useLocation } from "wouter";
import "./initial-entry-path";

initializeAnalytics();

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

// Track auth state at module level so the redirect handler can check it.
// Set to true once auth.me resolves with a user, false once it resolves without one.
// Starts as null (loading) to suppress redirects during the initial auth check.
let authResolved: boolean | null = null;
let authHasUser: boolean = false;

// Called by the auth.me query observer (set up after queryClient is created)
export function setAuthResolved(hasUser: boolean) {
  authResolved = true;
  authHasUser = hasUser;
}

const redirectToLoginIfUnauthorized = (error: unknown) => {
  if (!(error instanceof TRPCClientError)) return;
  if (typeof window === "undefined") return;

  const isUnauthorized = error.message === UNAUTHED_ERR_MSG;
  if (!isUnauthorized) return;

  // Only redirect if auth.me has already resolved and confirmed no user.
  // If auth.me is still loading (authResolved === null), this is a race-condition
  // error from a component that fired a protected query before the session was
  // confirmed. Suppress the redirect — the enabled: !!user guard should prevent
  // this, but this is a safety net for any remaining unguarded queries.
  if (authResolved === null) return; // auth still loading — suppress redirect
  if (authHasUser) return; // user is logged in — stale error, suppress redirect

  navigateToLogin();
};

queryClient.getQueryCache().subscribe(event => {
  // Track auth.me resolution so the redirect handler knows whether auth is loaded.
  // tRPC v11 query keys are arrays; auth.me key contains the path ["auth","me"].
  if (event.type === "updated") {
    const queryKey = event.query.queryKey;
    const isAuthMe = Array.isArray(queryKey) && queryKey.some(
      k => Array.isArray(k) && k[0] === 'auth' && k[1] === 'me'
    );
    if (isAuthMe) {
      if (event.action.type === "success") {
        setAuthResolved(Boolean(event.action.data));
      } else if (event.action.type === "error") {
        setAuthResolved(false);
      }
    }
  }
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
    // Queries that opt out with context.skipBatch (e.g. sectorRotation.current) go in their own
    // request so they can never hold a batch that carries core queries such as marketState.current.
    splitLink({
      condition: op => op.context.skipBatch === true,
      true: httpLink({
        url: "/api/trpc",
        transformer: superjson,
        fetch: safeFetch,
      }),
      false: httpBatchLink({
        url: "/api/trpc",
        transformer: superjson,
        fetch: safeFetch,
      }),
    }),
  ],
});

const MarketingEntry = lazy(() => import("./marketing-entry"));

const PRODUCT_FONT_STYLESHEET =
  "https://fonts.googleapis.com/css2?family=Rajdhani:wght@400;500;600;700&family=Orbitron:wght@400;500;600;700;800;900&display=swap";

function loadProductFonts() {
  if (document.getElementById("faultline-product-fonts")) return;
  const link = document.createElement("link");
  link.id = "faultline-product-fonts";
  link.rel = "stylesheet";
  link.href = PRODUCT_FONT_STYLESHEET;
  document.head.appendChild(link);
}

// Keep the established product application and all of its state providers in a
// route-level chunk. The public root still shares the exact tRPC/query client
// above, but does not fetch or evaluate product routing, ticker, ASHA, or
// experience state until a product route is requested.
const ProductEntry = lazy(async () => {
  loadProductFonts();
  const [
    ,
    { default: App },
    { TickerStoreProvider },
    { AshaProvider },
    { ExperienceProvider },
  ] = await Promise.all([
    import("./index.css"),
    import("./App"),
    import("./contexts/TickerStore"),
    import("./contexts/AshaContext"),
    import("./contexts/ExperienceContext"),
  ]);

  return {
    default: function ProductEntry() {
      return (
        <TickerStoreProvider>
          <AshaProvider>
            <ExperienceProvider>
              <App />
            </ExperienceProvider>
          </AshaProvider>
        </TickerStoreProvider>
      );
    },
  };
});

function EntryLoader() {
  return (
    <div
      aria-live="polite"
      style={{
        alignItems: "center",
        color: "rgba(0,255,200,0.4)",
        display: "flex",
        fontFamily: "'IBM Plex Mono', monospace",
        fontSize: "11px",
        height: "60vh",
        justifyContent: "center",
        letterSpacing: "0.15em",
      }}
    >
      LOADING MODULE…
    </div>
  );
}

function PathAwareEntry() {
  const [location] = useLocation();

  // Wouter Link navigation can stay client-side. Any transition away from the
  // public root switches to the original application rather than leaving a
  // marketing-only shell mounted on a product route.
  const Entry = location === "/" ? MarketingEntry : ProductEntry;
  return (
    <Suspense fallback={<EntryLoader />}>
      <Entry />
    </Suspense>
  );
}

createRoot(document.getElementById("root")!).render(
  <trpc.Provider client={trpcClient} queryClient={queryClient}>
    <QueryClientProvider client={queryClient}>
      <PathAwareEntry />
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
