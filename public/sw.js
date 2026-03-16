const CACHE_NAME = "unitvfilm-cache-v2";
const CONTENT_CACHE = "unitvfilm-content-v2";
const IMAGE_CACHE = "unitvfilm-images-v2";

const APP_SHELL = [
  "/",
  "/index.html",
  "/manifest.webmanifest",
  "/favicon.ico",
  "/placeholder.svg",
];

self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)).catch(() => null)
  );
});

self.addEventListener("activate", (event) => {
  const validCaches = [CACHE_NAME, CONTENT_CACHE, IMAGE_CACHE];
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.map((k) => (!validCaches.includes(k) ? caches.delete(k) : Promise.resolve())))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET or chrome-extension
  if (request.method !== "GET" || url.protocol === "chrome-extension:") {
    return;
  }

  // Firebase Realtime Database: network-first, cache for offline
  if (url.hostname.includes("firebasedatabase.app") || url.hostname.includes("firebaseio.com")) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(CONTENT_CACHE).then((cache) => cache.put(request, clone));
          }
          return response;
        })
        .catch(() => caches.match(request))
    );
    return;
  }

  // External video embeds: network-only (never cache)
  if (
    url.hostname.includes("youtube") ||
    url.hostname.includes("vimeo") ||
    url.hostname.includes("dailymotion") ||
    url.pathname.includes("/embed")
  ) {
    return;
  }

  // Images: cache-first with network fallback
  if (request.destination === "image" || /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(url.pathname)) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((response) => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(IMAGE_CACHE).then((cache) => cache.put(request, clone));
          }
          return response;
        }).catch(() => null);
      })
    );
    return;
  }

  // Navigation requests: network-first with offline fallback
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).then((res) => {
        const resClone = res.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put("/", resClone)).catch(() => null);
        return res;
      }).catch(async () => {
        const cache = await caches.open(CACHE_NAME);
        return (await cache.match("/")) || (await cache.match("/index.html"));
      })
    );
    return;
  }

  // Same-origin assets (JS/CSS): cache-first with background update
  if (url.origin === self.location.origin) {
    event.respondWith(
      caches.match(request).then((cached) => {
        const networkFetch = fetch(request).then((res) => {
          const resClone = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, resClone)).catch(() => null);
          return res;
        }).catch(() => cached);
        return cached || networkFetch;
      })
    );
  }
});