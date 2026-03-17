// ============================================================
// Service Worker for RHLOS PWA
// ============================================================

const CACHE_NAME = 'rhlos-v21';
const OFFLINE_URL = './';

// Files to cache for offline use (relative paths for GitHub Pages compatibility)
const STATIC_ASSETS = [
    './',
    './index.html',
    './css/style.css',
    './css/habits.css',
    './css/work.css',
    './js/app.js',
    './js/db.js',
    './js/habits-app.js',
    './js/habits-db.js',
    './js/5mj-app.js',
    './js/weekly-review.js',
    './js/homepage.js',
    './js/export.js',
    './js/work-db.js',
    './js/layout.js',
    './js/work-quick-add.js',
    './js/streak-celebration.js',
    './js/ov-app.js',
    './css/ov.css',
    './manifest.json',
    './icons/icon-192.png',
    './icons/icon-512.png'
];

// Install event - cache static assets
self.addEventListener('install', (event) => {
    console.log('[SW] Installing service worker...');
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log('[SW] Caching static assets');
                return cache.addAll(STATIC_ASSETS);
            })
            .then(() => {
                console.log('[SW] Static assets cached');
                return self.skipWaiting();
            })
            .catch((error) => {
                console.error('[SW] Failed to cache:', error);
            })
    );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
    console.log('[SW] Activating service worker...');
    event.waitUntil(
        caches.keys()
            .then((cacheNames) => {
                return Promise.all(
                    cacheNames
                        .filter((name) => name !== CACHE_NAME)
                        .map((name) => {
                            console.log('[SW] Deleting old cache:', name);
                            return caches.delete(name);
                        })
                );
            })
            .then(() => {
                console.log('[SW] Service worker activated');
                return self.clients.claim();
            })
    );
});

// Fetch event - network-first for app files, cache-first for static assets
self.addEventListener('fetch', (event) => {
    // Skip non-GET requests
    if (event.request.method !== 'GET') {
        return;
    }

    // Skip external requests (like weather API, CORS proxies)
    if (!event.request.url.startsWith(self.location.origin)) {
        return;
    }

    // Network-first for HTML, JS, and CSS (so updates load automatically)
    const url = new URL(event.request.url);
    const isAppFile = url.pathname.endsWith('.html')
        || url.pathname.endsWith('.js')
        || url.pathname.endsWith('.css')
        || url.pathname.endsWith('/');

    if (isAppFile) {
        event.respondWith(
            fetch(event.request)
                .then((networkResponse) => {
                    if (networkResponse && networkResponse.status === 200) {
                        const responseToCache = networkResponse.clone();
                        caches.open(CACHE_NAME).then((cache) => {
                            cache.put(event.request, responseToCache);
                        });
                    }
                    return networkResponse;
                })
                .catch(() => {
                    // Offline — fall back to cache
                    return caches.match(event.request).then((cached) => {
                        if (cached) return cached;
                        if (event.request.mode === 'navigate') {
                            return caches.match(OFFLINE_URL);
                        }
                        return null;
                    });
                })
        );
        return;
    }

    // Cache-first for static assets (images, icons, manifest)
    event.respondWith(
        caches.match(event.request)
            .then((cachedResponse) => {
                if (cachedResponse) return cachedResponse;
                return fetch(event.request).then((networkResponse) => {
                    if (networkResponse && networkResponse.status === 200) {
                        const responseToCache = networkResponse.clone();
                        caches.open(CACHE_NAME).then((cache) => {
                            cache.put(event.request, responseToCache);
                        });
                    }
                    return networkResponse;
                });
            })
            .catch(() => {
                if (event.request.mode === 'navigate') {
                    return caches.match(OFFLINE_URL);
                }
                return null;
            })
    );
});

// Handle messages from the main app
self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
});
