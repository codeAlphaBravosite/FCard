const VERSION = '1.0.0';
const CACHE_NAME = `anki-converter-cache-${VERSION}`;

// These are the files that make up the "app shell"
// The external JSZip library is included here to ensure offline functionality.
const STATIC_CACHE_URLS = [
  './', // Caches the root URL
  './index.html',
  './manifest.webmanifest',
  './icon-192x192.png',
  './icon-512x512.png',
  './icon-maskable-512x512.png',
  'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js'
];

// On install, pre-cache the app shell
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Service Worker: Caching App Shell');
        return cache.addAll(STATIC_CACHE_URLS);
      })
      .then(() => self.skipWaiting())
  );
});

// On activation, clean up old caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          // If a cache's name is not our current cache, delete it
          if (cacheName.startsWith('anki-converter-cache-') && cacheName !== CACHE_NAME) {
            console.log('Service Worker: Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// On fetch, serve from cache first, then network
self.addEventListener('fetch', event => {
  // We only want to handle GET requests
  if (event.request.method !== 'GET') {
    return;
  }
  
  event.respondWith(
    caches.match(event.request)
      .then(cachedResponse => {
        // If the resource is in the cache, return it
        if (cachedResponse) {
          return cachedResponse;
        }

        // If it's not in the cache, fetch it from the network
        return fetch(event.request)
          .then(networkResponse => {
            // OPTIONAL: Cache new requests on the fly.
            // Be careful with this, as it can cache unexpected resources.
            // For this simple app, pre-caching is sufficient, but this pattern is robust.
            // We only cache successful responses to our own origin or the CDN.
            if (networkResponse && networkResponse.status === 200) {
              const responseToCache = networkResponse.clone();
              caches.open(CACHE_NAME)
                .then(cache => {
                  cache.put(event.request, responseToCache);
                });
            }
            return networkResponse;
          });
      })
      .catch(error => {
        // This is a fallback for offline navigation, though less critical for a single-page app
        console.error('Fetch failed; returning offline page instead.', error);
        // In case of a navigation request error (e.g., offline), you can return a fallback page
        if (event.request.mode === 'navigate') {
          return caches.match('./index.html');
        }
      })
  );
});