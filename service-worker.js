/**
 * Service worker mínimo: cachea los archivos estáticos para que la app
 * cargue rápido y funcione offline en su V0 (sin datos remotos).
 */

const CACHE_NAME = 'libros-app-v1';
const ARCHIVOS_CACHE = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './storage.js',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ARCHIVOS_CACHE))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((nombres) =>
      Promise.all(
        nombres
          .filter((nombre) => nombre !== CACHE_NAME)
          .map((nombre) => caches.delete(nombre))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((respuestaCache) => {
      return respuestaCache || fetch(event.request);
    })
  );
});
