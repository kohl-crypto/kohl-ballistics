// Kohl Ballistics offline cache (lance edition). VERSION changes with every build so phones pick up updates.
const VERSION = "kohl-lance-20261015152824";
const FILES = ["./", "./index.html", "./manifest.json", "icons/icon-192.png", "icons/icon-512.png", "icons/maskable-512.png", "icons/apple-touch-icon.png", "fonts/barlow-condensed-latin-500-normal.woff2", "fonts/barlow-condensed-latin-600-normal.woff2", "fonts/barlow-condensed-latin-700-normal.woff2", "fonts/jetbrains-mono-latin-400-normal.woff2", "fonts/jetbrains-mono-latin-600-normal.woff2", "fonts/source-sans-3-latin-400-normal.woff2", "fonts/source-sans-3-latin-600-normal.woff2", "fonts/source-sans-3-latin-700-normal.woff2"];
self.addEventListener("install", e => { e.waitUntil(caches.open(VERSION).then(c => c.addAll(FILES))); });
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== VERSION && (k.startsWith("kohl-lance-") || /^kohl-\d/.test(k))).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
// Serve from the phone first so it works with no signal; refresh the stored copy in the background when online.
// Only this app's own files are cached; calls to Claude go straight to the network.
self.addEventListener("fetch", e => {
  if (e.request.method !== "GET" || new URL(e.request.url).origin !== location.origin) return;
  e.respondWith(caches.open(VERSION).then(async c => {
    const hit = await c.match(e.request, { ignoreSearch: true });
    const net = fetch(e.request).then(r => { if (r && r.ok) c.put(e.request, r.clone()); return r; }).catch(() => null);
    return hit || (await net) || c.match("./index.html");
  }));
});
