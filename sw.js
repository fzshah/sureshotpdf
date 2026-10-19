// Sureshot PDF service worker: keeps the app available offline.
// PDFs are never sent here; they stay in the browser as local data.
const CACHE = 'sureshot-pdf-v5';
const APP_FILES = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icons/sureshot-192.png',
  './icons/sureshot-512.png',
  './icons/sureshot-maskable-512.png'
];
const LIBRARY_HOST = 'cdnjs.cloudflare.com';

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(APP_FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);

  // PDF.js and pdf-lib: pinned versions never change, so serve from cache once downloaded.
  if (url.hostname === LIBRARY_HOST) {
    event.respondWith(
      caches.match(request).then((cached) => cached || fetch(request).then((response) => {
        if (response.ok) {
          const copy = response.clone();
          caches.open(CACHE).then((cache) => cache.put(request, copy));
        }
        return response;
      }))
    );
    return;
  }

  if (!url.protocol.startsWith('http') || url.origin !== self.location.origin) return;

  // The app itself: network first so updates arrive, cached copy when offline.
  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response.ok) {
          const copy = response.clone();
          caches.open(CACHE).then((cache) => cache.put(request, copy));
        }
        return response;
      })
      .catch(() => caches.match(request).then((cached) => cached || (request.mode === 'navigate' ? caches.match('./index.html') : undefined)))
  );
});
