// ---------------------------------------------------------------------------
// sw.js  --  minimal service worker for PWA install support (no caching)
// ---------------------------------------------------------------------------

// No-op: required for PWA installability but does not cache anything.
// All requests pass straight through to the network.

self.addEventListener('install', () => {
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    // Clear any caches left over from previous versions
    event.waitUntil(
        caches.keys().then((keys) =>
            Promise.all(keys.map((k) => caches.delete(k)))
        )
    );
    self.clients.claim();
});
