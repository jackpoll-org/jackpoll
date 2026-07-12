/*
 * Jackpoll service worker (PWA / mobile-app foundation).
 *
 * Hand-written (no build step) so it works with Next 16 + Turbopack. Strategy:
 *   - navigations: network-first, fall back to the cached page, then an
 *     offline shell — so a previously visited survey opens without a network;
 *   - static assets (_next/static, icons, fonts): stale-while-revalidate;
 *   - public survey reads (GET .../public/surveys/...): network-first with a
 *     cache fallback, so a loaded survey can be filled offline (Phase 2).
 * Owner/dashboard and any non-GET request always go to the network.
 */
const VERSION = "v2";
const STATIC_CACHE = `static-${VERSION}`;
const PAGES_CACHE = `pages-${VERSION}`;
const DATA_CACHE = `survey-data-${VERSION}`;
const OFFLINE_URL = "/offline.html";

const PRECACHE = ["/offline.html", "/manifest.webmanifest", "/icons/icon.svg"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => cache.addAll(PRECACHE)),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => !k.endsWith(VERSION))
          .map((k) => caches.delete(k)),
      ),
    ),
  );
  self.clients.claim();
});

function isStaticAsset(url) {
  return (
    url.pathname.startsWith("/_next/static") ||
    url.pathname.startsWith("/icons/") ||
    url.pathname.endsWith(".woff2") ||
    url.pathname === "/manifest.webmanifest"
  );
}

function isPublicSurveyRead(url) {
  return /\/public\/surveys\//.test(url.pathname);
}

async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  const network = fetch(request)
    .then((response) => {
      if (response.ok) cache.put(request, response.clone());
      return response;
    })
    .catch(() => cached);
  return cached || network;
}

async function networkFirst(request, cacheName, fallback) {
  const cache = await caches.open(cacheName);
  try {
    const response = await fetch(request);
    if (response.ok) cache.put(request, response.clone());
    return response;
  } catch {
    const cached = await cache.match(request);
    if (cached) return cached;
    if (fallback) return caches.match(fallback);
    throw new Error("offline and not cached");
  }
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  const sameOrigin = url.origin === self.location.origin;

  if (request.mode === "navigate") {
    event.respondWith(networkFirst(request, PAGES_CACHE, OFFLINE_URL));
    return;
  }
  if (sameOrigin && isStaticAsset(url)) {
    event.respondWith(staleWhileRevalidate(request, STATIC_CACHE));
    return;
  }
  if (isPublicSurveyRead(url)) {
    event.respondWith(networkFirst(request, DATA_CACHE));
    return;
  }
  // Everything else: passthrough (default network).
});

// Let the page trigger an immediate activation after an update.
self.addEventListener("message", (event) => {
  if (event.data === "SKIP_WAITING") self.skipWaiting();
});

// ── Web Push (#74) ─────────────────────────────────────────────────
// The backend sends an aes128gcm payload of { title, body, url? }. Show it as
// a notification; clicking focuses an open tab or opens the target URL.
self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: "Jackpoll", body: event.data ? event.data.text() : "" };
  }
  const title = data.title || "Jackpoll";
  const options = {
    body: data.body || "",
    icon: "/icons/icon.svg",
    badge: "/icons/icon.svg",
    data: { url: data.url || "/" },
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = (event.notification.data && event.notification.data.url) || "/";
  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clients) => {
        for (const client of clients) {
          if ("focus" in client) {
            client.navigate(target);
            return client.focus();
          }
        }
        return self.clients.openWindow(target);
      }),
  );
});
