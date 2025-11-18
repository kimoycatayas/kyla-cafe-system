/**
 * Service Worker for offline support and caching
 */

const CACHE_NAME = "kyla-pos-v1";
const STATIC_CACHE_NAME = "kyla-pos-static-v1";

// Assets to cache on install
const STATIC_ASSETS = ["/", "/manifest.json", "/kyla-cafe-system-logo.png"];

// Install event - cache static assets
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    })
  );
  self.skipWaiting();
});

// Activate event - clean up old caches
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME && name !== STATIC_CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    })
  );
  self.clients.claim();
});

// Fetch event - network first, fallback to cache
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests and external URLs
  if (request.method !== "GET" || url.origin !== self.location.origin) {
    return;
  }

  // For API requests, always try network first (IndexedDB handles offline)
  if (url.pathname.startsWith("/api/")) {
    return;
  }

  // For static assets, try cache first
  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }

      return fetch(request).then((response) => {
        // Don't cache non-successful responses
        if (!response || response.status !== 200 || response.type !== "basic") {
          return response;
        }

        const responseToCache = response.clone();
        caches.open(STATIC_CACHE_NAME).then((cache) => {
          cache.put(request, responseToCache);
        });

        return response;
      });
    })
  );
});

// Background sync for offline operations
self.addEventListener("sync", (event) => {
  if (event.tag === "sync-queue") {
    event.waitUntil(
      // The sync manager will handle this
      fetch("/api/sync", { method: "POST" }).catch(() => {
        // Ignore errors, will retry on next sync
      })
    );
  }
});
