const CACHE_NAME = 'food-bridge-v2';

// List of files to cache. 
// Note: We use a resilient caching strategy below so one missing file won't break the app.
const urlsToCache = [
  './',
  './index.html',
  './manifest.json',
  './icon.png',
  './js/app-mode.js',
  './login.html',
  './restaurant.html',
  './orphanages.html',
  './driver.html'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      // Robust caching: Try to cache files individually.
      // If one fails, log it but don't stop the Service Worker from installing.
      return Promise.all(
        urlsToCache.map((url) => {
          return cache.add(url).catch((err) => {
            console.warn(`Failed to cache ${url}:`, err);
          });
        })
      );
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  // Clean up old caches
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  // Network First, Fallback to Cache strategy
  event.respondWith(
    fetch(event.request)
      .catch(() => {
        return caches.match(event.request);
      })
  );
});
