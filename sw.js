const CACHE_NAME = 'medical-guide-v1';
const urlsToCache = [
  './',
  './index.html',
  './manifest.json',
  'https://cdn.tailwindcss.com',
  'https://aistudiocdn.com/lucide-react@^0.556.0',
  'https://aistudiocdn.com/react-dom@^19.2.1/',
  'https://aistudiocdn.com/@google/genai@^1.31.0',
  'https://aistudiocdn.com/react@^19.2.1/',
  'https://aistudiocdn.com/react@^19.2.1',
  'https://esm.sh/idb-keyval@6.2.1',
  'https://esm.sh/pdfjs-dist@3.11.174',
  'https://esm.sh/pdfjs-dist@3.11.174/build/pdf.worker.mjs',
  'https://esm.sh/html2canvas@1.4.1'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        // Attempt to cache all, but allow partial success for external CDNs (no-cors)
        const cachePromises = urlsToCache.map(url => {
            return fetch(new Request(url, { mode: 'no-cors' }))
                .then(response => {
                    if(!response) return;
                    return cache.put(url, response);
                }).catch(e => console.warn('Failed to cache:', url));
        });
        return Promise.all(cachePromises);
      })
  );
});

self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        // Cache hit - return response
        if (response) {
          return response;
        }
        return fetch(event.request);
      })
  );
});

self.addEventListener('activate', (event) => {
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});