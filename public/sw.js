/* eslint-disable no-restricted-globals */
/**
 * TMLGuide Service Worker
 *
 * - Versioned caches with automatic cleanup on activate.
 * - Precaches the core offline guide bundle.
 * - Network-first for same-origin HTML navigation requests (falling back to cache, then /offline).
 * - Stale-while-revalidate for same-origin static assets (_next/static/, icons, fonts).
 * - Strictly bypasses non-GET requests, cross-origin requests, /api/*, and radio audio streams.
 */

const CACHE_VERSION = "tmlguide-v1";
const STATIC_CACHE = "tmlguide-static-v1";
const ALLOWED_CACHES = new Set([CACHE_VERSION, STATIC_CACHE]);

const PRECACHE_URLS = [
  "/offline",
  "/",
  "/guides",
  "/guides/tickets",
  "/tools",
];

const STATIC_ASSET_PATTERN =
  /\.(?:woff2?|ttf|otf|svg|png|webp|ico|css|js)$/i;

const AUDIO_STREAM_PATTERN =
  /\.(?:mp3|aac|ogg|m3u8|pls|wav|flac)(?:\?|$)/i;

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_VERSION)
      .then((cache) =>
        Promise.allSettled(
          PRECACHE_URLS.map((url) =>
            cache.add(new Request(url, { cache: "reload" })),
          ),
        ),
      )
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => !ALLOWED_CACHES.has(key))
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

function isRadioOrMediaRequest(request, url) {
  if (request.destination === "audio" || request.destination === "video") {
    return true;
  }
  if (request.headers.has("range")) {
    return true;
  }
  if (AUDIO_STREAM_PATTERN.test(url.pathname)) {
    return true;
  }
  if (url.hostname.includes("streamtheworld")) {
    return true;
  }
  return false;
}

function isStaticAssetRequest(url) {
  return (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/icons/") ||
    url.pathname.startsWith("/brand/") ||
    STATIC_ASSET_PATTERN.test(url.pathname)
  );
}

function isNavigationRequest(request) {
  if (request.mode === "navigate") {
    return true;
  }
  const accept = request.headers.get("accept") || "";
  return accept.includes("text/html");
}

self.addEventListener("fetch", (event) => {
  const { request } = event;

  // Strict bypass: non-GET requests
  if (request.method !== "GET") {
    return;
  }

  let url;
  try {
    url = new URL(request.url);
  } catch {
    return;
  }

  // Strict bypass: cross-origin requests (includes One World Radio streams)
  if (url.origin !== self.location.origin) {
    return;
  }

  // Strict bypass: API routes
  if (url.pathname === "/api" || url.pathname.startsWith("/api/")) {
    return;
  }

  // Strict bypass: audio / video / radio streams
  if (isRadioOrMediaRequest(request, url)) {
    return;
  }

  // Network-first for same-origin HTML navigation requests
  if (isNavigationRequest(request)) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response && response.ok && response.type === "basic") {
            const copy = response.clone();
            event.waitUntil(
              caches
                .open(CACHE_VERSION)
                .then((cache) => cache.put(request, copy))
                .catch(() => {}),
            );
          }
          return response;
        })
        .catch(async () => {
          const cached = await caches.match(request);
          if (cached) {
            return cached;
          }
          const offlineFallback = await caches.match("/offline");
          if (offlineFallback) {
            return offlineFallback;
          }
          return new Response(
            "You are currently offline. Please check your connection and try again.",
            {
              status: 503,
              statusText: "Service Unavailable",
              headers: { "Content-Type": "text/plain; charset=utf-8" },
            },
          );
        }),
    );
    return;
  }

  // Stale-while-revalidate for same-origin static assets
  if (isStaticAssetRequest(url)) {
    event.respondWith(
      caches.open(STATIC_CACHE).then(async (cache) => {
        const cached = await cache.match(request);
        const networkPromise = fetch(request)
          .then((response) => {
            if (response && response.ok && response.type === "basic") {
              cache.put(request, response.clone()).catch(() => {});
            }
            return response;
          })
          .catch(() => undefined);

        if (cached) {
          event.waitUntil(networkPromise);
          return cached;
        }

        const fresh = await networkPromise;
        if (fresh) {
          return fresh;
        }

        return new Response("", { status: 504, statusText: "Gateway Timeout" });
      }),
    );
  }
});
