// Simple service worker for PWA installability
const CACHE_NAME = 'bienestar-v1';

self.addEventListener('install', (event) => {
  console.log('Service Worker installing.');
});

self.addEventListener('activate', (event) => {
  console.log('Service Worker activating.');
});

self.addEventListener('fetch', (event) => {
  // Pass through for now
  event.respondWith(fetch(event.request));
});
