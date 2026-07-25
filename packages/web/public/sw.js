/*
 * Offline shell.
 *
 * Two rules learned the hard way:
 *
 * 1. NEVER fall back to index.html for a non-navigation request. Returning HTML
 *    for a .js request produces:
 *      "Expected a JavaScript-or-Wasm module script but the server responded
 *       with a MIME type of text/html"
 *    and a blank screen. Only navigations may fall back to the shell.
 *
 * 2. Hashed assets are immutable, so cache-first is right for them. The HTML
 *    document is NOT — it points at the current hashes, so it must be
 *    network-first or a stale copy will reference bundles that no longer exist
 *    after a deploy, giving a blank screen again.
 */
const VERSION = 'v3';
const SHELL_CACHE = `solawi-shell-${VERSION}`;
const ASSET_CACHE = `solawi-assets-${VERSION}`;
const SHELL = ['/', '/manifest.webmanifest', '/icon.svg'];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(SHELL_CACHE)
      .then((c) => c.addAll(SHELL))
      .catch(() => {})
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((k) => k !== SHELL_CACHE && k !== ASSET_CACHE).map((k) => caches.delete(k)),
      ))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('message', (e) => {
  if (e.data === 'skip-waiting') self.skipWaiting();
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  const url = new URL(req.url);

  // Never touch the API or anything that is not a plain GET on this origin.
  if (req.method !== 'GET') return;
  if (url.origin !== location.origin) return;
  if (url.pathname.startsWith('/api/') || url.pathname === '/health') return;

  // Navigations: network first, shell as the offline fallback.
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(SHELL_CACHE).then((c) => c.put('/', copy)).catch(() => {});
          return res;
        })
        .catch(() => caches.match('/').then((hit) => hit ?? Response.error())),
    );
    return;
  }

  // Hashed build output is immutable: cache-first is safe and fast.
  if (url.pathname.startsWith('/assets/')) {
    e.respondWith(
      caches.match(req).then((hit) =>
        hit ?? fetch(req).then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(ASSET_CACHE).then((c) => c.put(req, copy)).catch(() => {});
          }
          return res;
        }),
      ),
    );
    return;
  }

  // Everything else: try the network, fall back to cache, then just fail.
  // Crucially there is NO index.html fallback here — a failed script request
  // must fail as a script, not silently become HTML.
  e.respondWith(
    fetch(req)
      .then((res) => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(SHELL_CACHE).then((c) => c.put(req, copy)).catch(() => {});
        }
        return res;
      })
      .catch(() => caches.match(req).then((hit) => hit ?? Response.error())),
  );
});
