/* =====================================================================
   Monoram Jewellers — the offline cache.

   YOU DO NOT HAVE TO EDIT THIS FILE. There is nothing here to bump by
   hand any more. The one line that changes is written by the deploy
   script, from the same version number it stamps into index.html, so the
   cache name and the pages can never disagree about which build is live.

   Network first, so a new gold rate is never served stale. Falls back to
   the saved copy only when the phone has no connection.

   preview.html is deliberately absent from the list below — it is a local
   development page full of sample data and must never reach a phone.
   ===================================================================== */

/* ---------------------------------------------------------------------
   THE VERSION. The deploy script replaces this one line, and nothing
   else in this file. "dev" is what it says in the repository, which is
   correct: a developer's own machine never installs this worker at all
   (app.js refuses to register it on localhost).
   --------------------------------------------------------------------- */
const VERSION = "dev";

const CACHE = "monoram-" + VERSION;

/* The fingerprint the pages use. index.html asks for "app.js?v=abc123",
   so the worker must save it under that same address or the saved copy
   is never the one the page asks for. Built from VERSION here rather
   than written out file by file, so the two cannot drift apart. */
const Q = "?v=" + VERSION;

/* index.html, the manifest and the icons are asked for WITHOUT a
   fingerprint — index.html is the address the visitor types, and it is
   the file that names the version of everything else, so it can never
   carry one itself. It is always re-checked with the server instead. */
const ASSETS = [
  "./index.html", "./admin.html", "./manifest.webmanifest",
  "./icon-192.png", "./icon-512.png",
  "./styles.css" + Q, "./config.js" + Q, "./marks.js" + Q,
  "./app.js" + Q, "./lib.js" + Q, "./theme.js" + Q,
  "./ambient.js" + Q, "./viewer.js" + Q, "./admin.js" + Q
];

self.addEventListener("install", e => {
  /* One file per request rather than addAll(), because addAll() throws the
     whole install away if a single file is missing — and a half-uploaded
     deploy would then leave the phone stuck on the old version for good. */
  e.waitUntil(caches.open(CACHE)
    .then(c => Promise.all(ASSETS.map(u => c.add(u).catch(() => {}))))
    .then(() => self.skipWaiting()));
});

self.addEventListener("activate", e => {
  e.waitUntil((async () => {
    /* Everything saved under any other name belongs to an older build. */
    const keys = await caches.keys();
    const old = keys.filter(k => k !== CACHE);
    await Promise.all(old.map(k => caches.delete(k)));
    await self.clients.claim();

    /* ---------------------------------------------------------------
       A tab left open all afternoon is still running the OLD app.js.
       Claiming it is not enough — the scripts are already loaded. So
       the pages are reloaded once, here.

       WHY THIS CANNOT LOOP, which is the usual way this trick fails:

         * "activate" fires once in the lifetime of one worker. A worker
           is one version of this file, so one deploy can produce at
           most one activate.
         * The reload is further gated on old.length — there must have
           been a cache belonging to an EARLIER build. On a phone's very
           first visit there is none, so a first install reloads nothing.
         * Those older caches are deleted three lines above, before any
           reload happens. So even if this handler somehow ran twice for
           the same worker, the second run would find old.length === 0
           and reload nothing.
         * After the reload the page is controlled by this same worker
           from its first byte. No new worker, no new activate, no
           second reload. The next reload needs a genuinely new deploy.

       admin.html is left alone on purpose. The owner may be halfway
       through typing a piece into a form when he deploys, and throwing
       that away to save him one manual refresh is a bad trade.

       AND THE RELOAD IS NOT AWAITED. That matters. This whole handler
       runs inside waitUntil(), and the worker stays in "activating"
       until it finishes. A reload asks this same worker to serve the
       page — so waiting for the reload to finish means waiting for a
       page that is itself waiting for this handler, and the tab hangs
       on a blank screen for ever. Start the reloads, do not wait for
       them, let the worker finish activating, and they go through.
       --------------------------------------------------------------- */
    if (!old.length) return;
    const windows = await self.clients.matchAll({ type: "window" });
    for (const c of windows) {
      if (c.url.indexOf("admin.html") !== -1) continue;
      try { c.navigate(c.url).catch(() => {}); } catch (err) {}
    }
  })());
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
