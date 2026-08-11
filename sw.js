/* BUMP THE CACHE NAME BELOW ON EVERY DEPLOY — v2 to v3, v3 to v4, and so on.
   A phone that has saved the shop to its home screen keeps serving the old
   files until the name changes.

   Network first, so a new gold rate is never served stale.
   Falls back to cache when the phone is offline. */
/* preview.html is deliberately NOT listed below — it is a local development
   page full of sample data and must never be cached onto a visitor's phone. */
const CACHE = "monoram-v3";
const ASSETS = ["./index.html", "./styles.css", "./app.js", "./lib.js",
                "./config.js", "./theme.js", "./marks.js", "./ambient.js",
                "./viewer.js", "./manifest.webmanifest",
                "./admin.html", "./admin.js",
                "./icon-192.png", "./icon-512.png"];

self.addEventListener("install", e => {
  /* One file per request rather than addAll(), because addAll() throws the
     whole install away if a single file is missing — and a half-uploaded
     deploy would then leave the phone stuck on the old version for good. */
  e.waitUntil(caches.open(CACHE)
    .then(c => Promise.all(ASSETS.map(u => c.add(u).catch(() => {}))))
    .then(() => self.skipWaiting()));
});

self.addEventListener("activate", e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;          // never cache Supabase or fonts
  e.respondWith(
    fetch(req)
      .then(res => {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(req, copy)).catch(() => {});
        return res;
      })
      .catch(() => caches.match(req).then(r => r || caches.match("./index.html")))
  );
});
