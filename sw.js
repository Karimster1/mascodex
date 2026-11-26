// Red primero, caché de respaldo: se actualiza sola y funciona sin internet.
const C = 'mascodex-v6';
const FILES = ['./', 'index.html', 'styles.css', 'species.js', 'app.js', 'manifest.webmanifest', 'icons/icon-192.png', 'icons/icon-512.png'];
self.addEventListener('install', e => e.waitUntil(caches.open(C).then(c => c.addAll(FILES)).then(() => self.skipWaiting())));
self.addEventListener('activate', e => e.waitUntil(caches.keys()
  .then(ks => Promise.all(ks.filter(k => /^masco(tario|dex)-/.test(k) && k !== C).map(k => caches.delete(k))))
  .then(() => self.clients.claim())));
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== location.origin) return;
  // Red primero, pero si la señal es mala no se espera más de 3 s: se usa la copia guardada
  const net = fetch(e.request).then(r => {
    if (r.ok) { const copy = r.clone(); e.waitUntil(caches.open(C).then(c => c.put(e.request, copy))); }
    return r;
  });
  e.waitUntil(net.catch(() => {}));
  const cached = () => caches.match(e.request, { ignoreSearch: true });
  const slow = new Promise(ok => setTimeout(ok, 3000)).then(cached);
  e.respondWith(Promise.race([net, slow.then(r => r || net)]).catch(() => cached().then(r => r || Response.error())));
});
