const CACHE_NAME = 'estar-mejor-v1';

// Lista de recursos básicos
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png'
];

// 1. Instalación
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      // Usamos return para asegurar que se complete la carga
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
  self.skipWaiting(); // Obliga al SW a activarse inmediatamente
});

// 2. Activación
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            return caches.delete(cache);
          }
        })
      );
    })
  );
  self.clients.claim(); // Toma el control de las pestañas abiertas inmediatamente
});

// 3. Estrategia: Cache First con Network Update (Stale-While-Revalidate)
self.addEventListener('fetch', (event) => {
  // FILTRO CRÍTICO: Solo procesar peticiones HTTP/HTTPS (ignora extensiones de Chrome)
  if (!event.request.url.startsWith('http')) return;

  event.respondWith(
    caches.match(event.request).then((response) => {
      const fetchPromise = fetch(event.request).then((networkResponse) => {
        // Solo guardamos en caché si la respuesta es válida
        if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }
        return networkResponse;
      }).catch(() => {
        // Si falla la red y es una navegación (cambio de página), mostrar index.html
        if (event.request.mode === 'navigate') {
          return caches.match('/');
        }
      });

      return response || fetchPromise;
    })
  );
});