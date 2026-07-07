/* ============================================================
   FAULTLINE Core — Service Worker v2
   Cache strategy:
   - Static assets (JS/CSS/fonts/images): Cache-First with
     background refresh (stale-while-revalidate)
   - API calls (/api/trpc, /api/*): Network-First with
     30s timeout (60s for heavy endpoints like dayTrade)
   - HTML navigation: Network-First (always fresh shell)
   - Offline fallback: /mobile (PWA shell)
   ============================================================ */

const CACHE_NAME = "faultline-core-v2";
const STATIC_CACHE = "faultline-static-v2";
const API_CACHE = "faultline-api-v2";

// Assets to precache on install
const PRECACHE_URLS = [
  "/mobile",
  "/manifest.json",
];

// ── Install: precache shell ───────────────────────────────────
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => {
      return cache.addAll(PRECACHE_URLS).catch((err) => {
        console.warn("[SW] Precache failed (non-fatal):", err);
      });
    }).then(() => self.skipWaiting())
  );
});

// ── Activate: clean old caches ────────────────────────────────
self.addEventListener("activate", (event) => {
  const CURRENT_CACHES = [CACHE_NAME, STATIC_CACHE, API_CACHE];
  event.waitUntil(
    caches.keys().then((cacheNames) =>
      Promise.all(
        cacheNames
          .filter((name) => !CURRENT_CACHES.includes(name))
          .map((name) => caches.delete(name))
      )
    ).then(() => self.clients.claim())
  );
});

// ── Fetch: route-based caching strategy ──────────────────────
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== "GET") return;

  // Skip cross-origin requests (CDN, external APIs)
  if (url.origin !== self.location.origin) return;

  // Skip Manus internal paths
  if (url.pathname.startsWith("/__manus__")) return;

  // ── API calls: Network-First with cache fallback ──────────
  if (url.pathname.startsWith("/api/")) {
    // Heavy endpoints (day trade scanner, market intelligence) need more time
    const isHeavy = url.pathname.includes("dayTrade") ||
                    url.pathname.includes("marketIntelligence") ||
                    url.pathname.includes("pressure") ||
                    url.pathname.includes("signals");
    const apiTimeout = isHeavy ? 60000 : 30000;
    event.respondWith(networkFirstWithTimeout(request, API_CACHE, apiTimeout));
    return;
  }

  // ── Static assets: Cache-First with background refresh ────
  if (
    url.pathname.match(/\.(js|css|woff2?|ttf|otf|eot|svg|png|jpg|jpeg|gif|ico|webp)$/) ||
    url.pathname.startsWith("/manus-storage/")
  ) {
    event.respondWith(cacheFirstWithRefresh(request, STATIC_CACHE));
    return;
  }

  // ── HTML navigation: Network-First ────────────────────────
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(() =>
        caches.match("/mobile").then((cached) => cached || new Response("Offline", { status: 503 }))
      )
    );
    return;
  }

  // ── Default: Network-First ────────────────────────────────
  event.respondWith(
    fetch(request).catch(() => caches.match(request))
  );
});

// ── Strategy: Cache-First with background refresh ────────────
async function cacheFirstWithRefresh(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);

  // Kick off background refresh (don't await)
  const networkFetch = fetch(request).then((response) => {
    if (response && response.status === 200) {
      cache.put(request, response.clone());
    }
    return response;
  }).catch(() => null);

  return cached || (await networkFetch) || new Response("Not found", { status: 404 });
}

// ── Strategy: Network-First with timeout ─────────────────────
async function networkFirstWithTimeout(request, cacheName, timeoutMs) {
  const cache = await caches.open(cacheName);

  const timeoutPromise = new Promise((_, reject) =>
    setTimeout(() => reject(new Error("Network timeout")), timeoutMs)
  );

  try {
    const response = await Promise.race([fetch(request), timeoutPromise]);
    // Only cache successful responses
    if (response && response.status === 200) {
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    // Try cache fallback
    const cached = await cache.match(request);
    if (cached) return cached;
    // Return a proper tRPC-compatible error response so the client can handle it gracefully
    return new Response(
      JSON.stringify([{ error: { json: { message: "Network unavailable — please check your connection", code: -32603, data: { code: "INTERNAL_SERVER_ERROR", httpStatus: 503 } } } }]),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  }
}
