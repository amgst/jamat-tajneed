// Cache only the offline notice and app icons. Person records stay with the data service.
const CACHE = 'tajneed-offline-v1';
const OFFLINE = '/offline.html';
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll([
    OFFLINE, '/icons/icon-192.png', '/icons/icon-512.png'
  ])).then(() => self.skipWaiting()));
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(
    keys.filter(key => key.startsWith('tajneed-offline-') && key !== CACHE).map(key => caches.delete(key))
  )).then(() => self.clients.claim()));
});
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;
  if (['/icons/icon-192.png', '/icons/icon-512.png'].includes(url.pathname)) {
    event.respondWith(caches.match(url.pathname).then(cached => cached || fetch(event.request)));
    return;
  }
  if (event.request.mode !== 'navigate') return;
  event.respondWith(fetch(event.request).catch(async () => {
    const offline = await caches.match(OFFLINE);
    return offline || new Response('Connect to the internet to open Tajneed.', { status: 503, headers: { 'Content-Type': 'text/plain' } });
  }));
});
