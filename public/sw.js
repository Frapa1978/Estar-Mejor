const CACHE_NAME = 'estar-mejor-v1';

// LISTA ACTUALIZADA PARA GITHUB PAGES
const ASSETS_TO_CACHE = ['/',
  '/index.html',
  '/manifest.json',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png'
];

// 1. Instalación
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('Cacheando recursos para GitHub Pages...');
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
  self.skipWaiting();
});

// 2. Activación
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            console.log('Borrando caché antiguo:', cache);
            return caches.delete(cache);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// 3. Estrategia: Stale-While-Revalidate
self.addEventListener('fetch', (event) => {
  if (!event.request.url.startsWith('http')) return;

  event.respondWith(
    caches.match(event.request).then((response) => {
      const fetchPromise = fetch(event.request).then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200) {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            return caches.match('/index.html');
          });
        }
        return networkResponse;
      }).catch(() => {
        // CAMBIO CRÍTICO AQUÍ:
        // Si falla la red, devuelve el index.html relativo al proyecto
        if (event.request.mode === 'navigate') {
          return caches.match('./index.html');
        }
      });

      return response || fetchPromise;
    })
  );
});