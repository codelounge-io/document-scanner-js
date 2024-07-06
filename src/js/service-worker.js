const CACHE_NAME = 'document-scanner-cache-v1';
const urlsToCache = [
    '/',
    '/src/css/styles.css',
    '/src/js/document-scanner.js',
    '/src/js/jscanify/src/jscanify.js',
    '/src/js/opencv/opencv-4.7.0.js',
    '/src/js/jspdf/jspdf.js'
];

self.addEventListener('install', function(event) {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(function(cache) {
                console.log('Opened cache');
                return cache.addAll(urlsToCache.map(url => new Request(url, { mode: 'no-cors' })));
            })
            .catch(function(error) {
                console.error('Failed to cache:', error);
            })
    );
});

self.addEventListener('fetch', function(event) {
    event.respondWith(
        caches.match(event.request)
            .then(function(response) {
                if (response) {
                    return response;
                }
                return fetch(event.request).catch(function(error) {
                    console.error('Fetch failed:', error);
                    throw error;
                });
            })
    );
});