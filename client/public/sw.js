/* ============================================================
   FAULTLINE Core — Service Worker v5
   Cache strategy:
   - API calls (/api/*): BYPASS — pass straight through to
     network with NO timeout and NO caching. tRPC calls must
     never be intercepted by the service worker.
   - Static assets (JS/CSS/fonts/images): Network-First with
     cache fallback (ensures users always get latest bundles)
   - HTML navigation: Network-First (always fresh shell)
   - Offline fallback: /mobile (PWA shell)
   ============================================================ */

const CACHE_NAME = "faultline-core-v5";
const STATIC_CACHE = "faultline-static-v5";

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

// ── Activate: clean ALL old caches immediately ────────────────
self.addEventListener("activate", (event) => {
  const CURRENT_CACHES = [CACHE_NAME, STATIC_CACHE];
  event.waitUntil(
    caches.keys().then((cacheNames) =>
      Promise.all(
        cacheNames
          .filter((name) => !CURRENT_CACHES.includes(name))
          .map((name) => {
            console.log("[SW v5] Deleting stale cache:", name);
            return caches.delete(name);
          })
      )
    ).then(() => {
      console.log("[SW v5] Activated — all stale caches cleared");
      return self.clients.claim();
    })
  );
});

// ── Fetch: route-based caching strategy ──────────────────────
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests — let them pass through untouched
  if (request.method !== "GET") return;

  // Skip cross-origin requests (CDN, external APIs)
  if (url.origin !== self.location.origin) return;

  // Skip Manus internal paths
  if (url.pathname.startsWith("/__manus__")) return;

  // ── API calls: BYPASS completely — no timeout, no cache ──
  // tRPC and all API calls must go directly to the network.
  // Any interception here causes "Unable to transform response"
  // errors when the server is slow (cold starts, heavy queries).
  if (url.pathname.startsWith("/api/")) {
    // Do NOT call event.respondWith() — browser handles it natively
    return;
  }

  // ── Static assets: Network-First with cache fallback ─────
  // Changed from Cache-First to Network-First so new JS bundles
  // are always fetched immediately after a deployment.
  if (
    url.pathname.match(/\.(js|css|woff2?|ttf|otf|eot|svg|png|jpg|jpeg|gif|ico|webp)$/) ||
    url.pathname.startsWith("/manus-storage/")
  ) {
    event.respondWith(networkFirstWithCache(request, STATIC_CACHE));
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

// ── Strategy: Network-First with cache fallback ───────────────
async function networkFirstWithCache(request, cacheName) {
  const cache = await caches.open(cacheName);
  try {
    const networkResponse = await fetch(request);
    if (networkResponse && networkResponse.status === 200) {
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch {
    // Network failed — serve from cache if available
    const cached = await cache.match(request);
    return cached || new Response("Not found", { status: 404 });
  }
}
