const CACHE_NAME = "unitvfilm-cache-v1";
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
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.map((k) => (k !== CACHE_NAME ? caches.delete(k) : Promise.resolve())))
    ).then(() => self.clients.claim())
  );
});

// Basic strategy:
// - Navigation requests: network-first, fallback to cache
// - Same-origin GET: cache-first, update in background
self.addEventListener("fetch", (event) => {
  const req = event.request;
  const url = new URL(req.url);

  if (req.method !== "GET") return;

  // Navigation requests (HTML)
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req).then((res) => {
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

  // Stale-While-Revalidate for images
  if (req.destination === "image") {
    event.respondWith(
      caches.match(req).then((cached) => {
        const networkFetch = fetch(req).then((res) => {
          // Cache valid image responses
          if (res && res.status === 200 && res.type === 'basic') {
            const resClone = res.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(req, resClone)).catch(() => null);
          }
          return res;
        }).catch(() => null); // Fail silently on network error for images
        return cached || networkFetch;
      })
    );
    return;
  }

  // Same-origin assets (JS/CSS): Cache First, Network Background Update
  if (url.origin === self.location.origin) {
    event.respondWith(
      caches.match(req).then((cached) => {
        const networkFetch = fetch(req).then((res) => {
          const resClone = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, resClone)).catch(() => null);
          return res;
        }).catch(() => cached);
        return cached || networkFetch;
      })
    );
  }
});