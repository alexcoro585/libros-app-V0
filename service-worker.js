/**
 * Service worker mínimo: intenta siempre red primero (para no quedarse
 * nunca en una version vieja del codigo tras un despliegue nuevo) y usa
 * el cache solo como respaldo cuando no hay conexion.
 */

const CACHE_NAME = 'libros-app-v5';
const ARCHIVOS_CACHE = [
  './',
  './index.html',
  './historial.html',
  './calendario.html',
  './styles.css',
  './app.js',
  './historial.js',
  './calendario.js',
  './libros-utils.js',
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
    fetch(event.request)
      .then((respuestaRed) => {
        const copia = respuestaRed.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copia));
        return respuestaRed;
      })
      .catch(() => caches.match(event.request))
  );
});
