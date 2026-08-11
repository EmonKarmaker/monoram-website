/* Tap-to-zoom photograph viewer.
   Vanilla, no dependencies, nothing fetched from a CDN.

   Rules it holds itself to, because most of the shop's visitors are on a
   cheap Android over a slow connection:
     - zoom and pan are CSS transforms only, never width/height, so the
       browser never re-lays-out or re-rasterises the picture mid-gesture;
     - only the photograph either side of the current one is preloaded;
     - the ambient particle canvas is stopped while the viewer is open —
       there is no point painting stars behind a fullscreen image. */

import { t, esc, pick, money, num, bhoriLabel, BHORI } from "./lib.js";
import { pauseFX, resumeFX } from "./ambient.js";

const MAXZ = 5, DOUBLE = 2.5, MINZ = 1;

let box = null, stage = null, img = null, bar = null, counter = null;
let list = [], idx = 0, opener = null;
let scale = 1, tx = 0, ty = 0, baseW = 0, baseH = 0;
let pushed = false, open = false, scrollY = 0;

const reduceMotion = () =>
  matchMedia("(prefers-reduced-motion: reduce)").matches;

/* ---------------------------------------------------------------- shell */
function build() {
  if (box) return;
  box = document.createElement("div");
  box.className = "viewer";
  box.id = "photoViewer";
  box.setAttribute("role", "dialog");
  box.setAttribute("aria-modal", "true");
  box.hidden = true;
  box.innerHTML = `
    <div class="vstage" id="vStage"><img class="vimg" id="vImg" alt="" draggable="false"></div>
    <button class="vbtn vx"   id="vClose" type="button"></button>
    <button class="vbtn vnav vprev" id="vPrev" type="button"><svg viewBox="0 0 24 24" fill="none"
      stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"
      aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg></button>
    <button class="vbtn vnav vnext" id="vNext" type="button"><svg viewBox="0 0 24 24" fill="none"
      stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"
      aria-hidden="true"><path d="M9 5l7 7-7 7"/></svg></button>
    <div class="vzoom">
      <button class="vbtn vz" id="vOut" type="button">&minus;</button>
      <button class="vbtn vz" id="vIn"  type="button">+</button>
    </div>
    <p class="vcount" id="vCount"></p>
    <div class="vbar" id="vBar"></div>`;
  document.body.appendChild(box);

  stage   = box.querySelector("#vStage");
  img     = box.querySelector("#vImg");
  bar     = box.querySelector("#vBar");
  counter = box.querySelector("#vCount");

  box.querySelector("#vClose").addEventListener("click", () => close());
  box.querySelector("#vPrev").addEventListener("click", () => go(-1));
  box.querySelector("#vNext").addEventListener("click", () => go(1));
  box.querySelector("#vIn").addEventListener("click", () => zoomAbout(scale * 1.5, null));
  box.querySelector("#vOut").addEventListener("click", () => zoomAbout(scale / 1.5, null));

  /* tapping the backdrop closes; the picture and the chrome do not */
  box.addEventListener("click", e => {
    if (e.target === box || e.target === stage) close();
  });
  /* "tappable away" — the caption bar hides on tap and comes back on the next */
  bar.addEventListener("click", () => box.classList.toggle("barsoff"));

  wirePointer();
  wireWheel();
  wireKeys();
  img.addEventListener("load", fit);
}

/* --------------------------------------------------------------- painting */
function apply(animate) {
  img.style.transition = (animate && !reduceMotion())
    ? "transform .22s cubic-bezier(.2,.7,.3,1)" : "none";
  img.style.transform = `translate3d(${tx}px, ${ty}px, 0) scale(${scale})`;
  box.classList.toggle("zoomed", scale > 1.01);
}

/* the picture's untransformed layout size, needed to work out pan limits */
function fit() {
  baseW = img.offsetWidth;
  baseH = img.offsetHeight;
  clamp();
  apply(false);
}

function limits() {
  const r = stage.getBoundingClientRect();
  return [Math.max(0, (baseW * scale - r.width) / 2),
          Math.max(0, (baseH * scale - r.height) / 2)];
}
function clamp() {
  const [mx, my] = limits();
  tx = Math.min(mx, Math.max(-mx, tx));
  ty = Math.min(my, Math.max(-my, ty));
}

/* Scale to `next`, keeping the point under `focal` (a client x/y, or null
   for the centre of the stage) pinned where it is. */
function zoomAbout(next, focal, animate = true) {
  const s2 = Math.min(MAXZ, Math.max(MINZ, next));
  const r = stage.getBoundingClientRect();
  const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
  const fx = focal ? focal.x : cx, fy = focal ? focal.y : cy;
  /* image-space point currently under the focal point */
  const ux = (fx - cx - tx) / scale, uy = (fy - cy - ty) / scale;
  scale = s2;
  tx = fx - cx - ux * scale;
  ty = fy - cy - uy * scale;
  if (scale <= MINZ + 0.001) { scale = MINZ; tx = 0; ty = 0; }
  clamp();
  apply(animate);
}

/* --------------------------------------------------------------- content */
function detailHTML(p) {
  const spec = [pick(p, "category"), p.karat].filter(Boolean).join(" · ");
  const w = p.weight_bhori != null
    ? `${bhoriLabel(p.weight_bhori)} · ${num((p.weight_bhori * BHORI).toFixed(2))} g` : "";
  const price = p.sold ? `<span class="sold">${esc(t("sold"))}</span>`
    : (p.price_on_request || p.price == null)
      ? `<span class="req">${esc(t("ask_price"))}</span>`
      : money(p.price);
  return `<h3>${esc(pick(p, "name") || "")}</h3>
    ${spec ? `<p class="m">${esc(spec)}</p>` : ""}
    ${w ? `<p class="w">${esc(w)}</p>` : ""}
    <p class="p">${price}</p>`;
}

function show(i, animate) {
  idx = (i + list.length) % list.length;
  const p = list[idx];
  scale = 1; tx = 0; ty = 0;
  box.classList.remove("barsoff");
  img.style.transition = "none";
  img.src = p.photo_url || "";
  img.alt = pick(p, "name") || t("photo");
  bar.innerHTML = detailHTML(p);
  box.setAttribute("aria-label", `${pick(p, "name") || t("photo")} — ${t("photo")}`);
  counter.textContent = list.length > 1 ? `${num(idx + 1)} / ${num(list.length)}` : "";
  const many = list.length > 1;
  box.querySelector("#vPrev").hidden = !many;
  box.querySelector("#vNext").hidden = !many;
  apply(false);
  preloadNeighbours();
}

/* only the one either side — never the whole collection */
function preloadNeighbours() {
  if (list.length < 2) return;
  [idx - 1, idx + 1].forEach(i => {
    const p = list[(i + list.length) % list.length];
    if (p && p.photo_url) { const im = new Image(); im.decoding = "async"; im.src = p.photo_url; }
  });
}

function go(step) {
  if (list.length < 2) return;
  show(idx + step, true);
}

/* ---------------------------------------------------------- open / close */
export function openViewer(items, startIndex, origin) {
  build();
  list = (items || []).filter(p => p && p.photo_url);
  if (!list.length) return;
  const wanted = items[startIndex];
  const at = Math.max(0, list.indexOf(wanted));
  opener = origin || null;

  scrollY = window.scrollY;
  document.body.style.top = `-${scrollY}px`;
  document.body.classList.add("vlock");

  box.hidden = false;
  open = true;
  pauseFX();
  show(at, false);

  /* the Android back button closes the picture instead of leaving the shop */
  try { history.pushState({ mjViewer: 1 }, ""); pushed = true; } catch (e) { pushed = false; }

  box.querySelector("#vClose").focus({ preventScroll: true });
}

export function close(fromPop) {
  if (!open) return;
  open = false;
  box.hidden = true;

  document.body.classList.remove("vlock");
  document.body.style.top = "";
  window.scrollTo(0, scrollY);            // exactly where they were

  resumeFX();
  if (opener && document.contains(opener)) opener.focus({ preventScroll: true });
  opener = null;

  if (pushed && !fromPop) { pushed = false; try { history.back(); } catch (e) {} }
  if (fromPop) pushed = false;
}

addEventListener("popstate", () => { if (open) close(true); });

/* -------------------------------------------------------------- keyboard */
function wireKeys() {
  /* On the document, not on the dialog: tapping or clicking the picture moves
     focus to <body>, and a listener bound to the dialog would then never see
     the arrow keys again. Guarded by `open` so it costs nothing when closed. */
  document.addEventListener("keydown", e => {
    if (!open) return;
    if (e.key === "Escape") { e.preventDefault(); return close(); }
    if (e.key === "ArrowLeft")  { e.preventDefault(); return go(-1); }
    if (e.key === "ArrowRight") { e.preventDefault(); return go(1); }
    if (e.key === "+" || e.key === "=") { e.preventDefault(); return zoomAbout(scale * 1.5, null); }
    if (e.key === "-" || e.key === "_") { e.preventDefault(); return zoomAbout(scale / 1.5, null); }
    if (e.key !== "Tab") return;
    /* focus stays inside the dialog */
    const f = [...box.querySelectorAll("button")].filter(b => !b.hidden && b.offsetParent !== null);
    if (!f.length) return;
    const first = f[0], last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  });
}

/* ----------------------------------------------------------------- wheel */
function wireWheel() {
  stage.addEventListener("wheel", e => {
    e.preventDefault();
    zoomAbout(scale * (e.deltaY < 0 ? 1.16 : 1 / 1.16), { x: e.clientX, y: e.clientY }, false);
  }, { passive: false });
}

/* ------------------------------------------------- touch / mouse gestures */
function wirePointer() {
  const pts = new Map();
  let startD = 0, startS = 1, startT = null, moved = false;
  let lastTap = 0, lastTapX = 0, lastTapY = 0;

  const centre = () => {
    const a = [...pts.values()];
    return { x: (a[0].x + a[1].x) / 2, y: (a[0].y + a[1].y) / 2 };
  };
  const spread = () => {
    const a = [...pts.values()];
    return Math.hypot(a[0].x - a[1].x, a[0].y - a[1].y);
  };

  stage.addEventListener("pointerdown", e => {
    if (e.button != null && e.button !== 0) return;
    stage.setPointerCapture(e.pointerId);
    pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    moved = false;
    if (pts.size === 2) { startD = spread(); startS = scale; }
    else startT = { x: e.clientX, y: e.clientY, tx, ty, at: Date.now() };
  });

  stage.addEventListener("pointermove", e => {
    if (!pts.has(e.pointerId)) return;
    pts.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (pts.size >= 2) {                       // pinch
      moved = true;
      if (startD > 0) zoomAbout(startS * (spread() / startD), centre(), false);
      return;
    }
    if (!startT) return;
    const dx = e.clientX - startT.x, dy = e.clientY - startT.y;
    if (Math.abs(dx) > 6 || Math.abs(dy) > 6) moved = true;

    if (scale > 1.01) {                        // one-finger pan
      tx = startT.tx + dx; ty = startT.ty + dy;
      clamp(); apply(false);
    } else if (moved) {                        // not zoomed: drag the whole frame
      box.style.setProperty("--vdx", `${dx}px`);
      box.style.setProperty("--vdy", `${Math.max(0, dy)}px`);
      box.classList.add("dragging");
    }
  });

  const end = e => {
    if (!pts.has(e.pointerId)) return;
    const last = pts.get(e.pointerId);
    pts.delete(e.pointerId);
    box.classList.remove("dragging");
    box.style.removeProperty("--vdx");
    box.style.removeProperty("--vdy");

    if (pts.size === 1) {                      // one finger lifted from a pinch
      const a = [...pts.entries()][0];
      startT = { x: a[1].x, y: a[1].y, tx, ty, at: Date.now() };
      return;
    }
    if (pts.size > 0) return;

    if (!moved && startT) {                    // a tap
      const now = Date.now();
      const near = Math.abs(last.x - lastTapX) < 40 && Math.abs(last.y - lastTapY) < 40;
      if (now - lastTap < 320 && near) {       // double tap
        lastTap = 0;
        zoomAbout(scale > 1.01 ? MINZ : DOUBLE, { x: last.x, y: last.y });
      } else {
        lastTap = now; lastTapX = last.x; lastTapY = last.y;
      }
      startT = null;
      return;
    }

    if (startT && scale <= 1.01) {             // a swipe, only while not zoomed
      const dx = last.x - startT.x, dy = last.y - startT.y;
      if (dy > 90 && Math.abs(dy) > Math.abs(dx)) close();
      else if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy)) go(dx < 0 ? 1 : -1);
    }
    startT = null;
  };
  stage.addEventListener("pointerup", end);
  stage.addEventListener("pointercancel", end);
}

/* --------------------------------------------------------------- hook-up */
/* One delegated listener for the whole page, so adding a card costs nothing.
   `getList` hands back the products currently on screen, in order. */
export function wireViewer(getList) {
  document.addEventListener("click", e => {
    const hit = e.target.closest("[data-zoom]");
    if (!hit) return;
    e.preventDefault();
    const items = getList();
    const at = items.findIndex(p => String(p.id) === hit.dataset.zoom);
    openViewer(items, at < 0 ? 0 : at, hit);
  });
  document.addEventListener("keydown", e => {
    if (e.key !== "Enter" && e.key !== " ") return;
    const hit = e.target.closest && e.target.closest("[data-zoom]");
    if (!hit) return;
    e.preventDefault();
    hit.click();
  });
}
