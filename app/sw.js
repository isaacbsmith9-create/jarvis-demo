// Offline support: precache the app shell, serve it cache-first, refresh it in the background.
// VERSION and FILES are filled in by tools/build-app.mjs.
const VERSION = '89cd48cb7a';
const FILES = ["./","./app.css","./icons/apple-touch-icon.png","./icons/icon-192.png","./icons/icon-512.png","./icons/icon-maskable-512.png","./icons/icon.svg","./index.html","./js/foods.js","./js/insights.js","./js/main.js","./js/ml.js","./js/plan.data.js","./js/ru.js","./js/store.js","./js/ui.js","./js/util.js","./js/view.food.js","./js/view.more.js","./js/view.plan.js","./js/view.progress.js","./js/view.today.js","./js/view.train.js"];
const CACHE = 'baseline-' + VERSION;

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k.startsWith('baseline-') && k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== location.origin || !url.pathname.startsWith(new URL('./', location).pathname)) return;
  const key = req.mode === 'navigate' ? './index.html' : req;
  e.respondWith(caches.open(CACHE).then(async (c) => {
    const hit = await c.match(key, { ignoreSearch: true });
    const net = fetch(req).then((r) => { if (r.ok && req.mode !== 'navigate') c.put(req, r.clone()); return r; }).catch(() => null);
    return hit || (await net) || new Response('Offline', { status: 503 });
  }));
});
