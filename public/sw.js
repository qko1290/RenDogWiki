// =============================================
// File: public/sw.js
// (이미지 Cache First 캐시 – CloudFront/S3 GET 절감)
// =============================================
const CACHE = 'wiki-images-v1';

self.addEventListener('install', (e) => {
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)));
  })());
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const dest = req.destination || '';
  // 이미지 요청은 캐시 우선
  if (dest === 'image') {
    event.respondWith(cacheFirst(req));
  }
});

async function cacheFirst(request) {
  const cache = await caches.open(CACHE);
  const cached = await cache.match(request, { ignoreVary: true, ignoreSearch: false });
  if (cached) return cached;

  try {
    const fresh = await fetch(request, { credentials: 'omit', redirect: 'follow' });
    if (fresh && fresh.ok) {
      cache.put(request, fresh.clone());
    }
    return fresh;
  } catch (e) {
    return cached || Response.error();
  }
}
