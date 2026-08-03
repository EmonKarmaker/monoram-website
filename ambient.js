/* ============================================================
   Ambient background effects.

   Night  : star field  — twinkle, drift, glow near touch, shooting stars
   Ivory  : gold dust   — slow motes rising, plus CSS sheen / alpona / grain

   Everything is optional and switched from the admin page. The loop stops
   when the tab is hidden, thins right down on small screens, and refuses to
   animate at all if the visitor has asked their phone to reduce motion.
   ============================================================ */

export const FX_DEFAULTS = {
  fx_on:        true,
  fx_density:   "normal",   // low | normal | high
  // night
  fx_twinkle:   true,
  fx_drift:     true,
  fx_glow:      true,
  fx_shooting:  true,
  // ivory
  fx_web:       true,   // filigree web of gold nodes and hairlines
  fx_grain:     true    // fine paper texture, no movement
};

const DENSITY = { low: 0.5, normal: 1, high: 1.7 };
const reduceMotion = () =>
  window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

let raf = null, canvas = null, ctx = null, parts = [], shooters = [];
let cfg = {}, mode = "night", pointer = { x: -9999, y: -9999, has: false };
let W = 0, H = 0, DPR = 1, last = 0, sinceShooter = 0;

const rnd = (a, b) => a + Math.random() * (b - a);

/* ---------- setup ---------- */
function ensureCanvas() {
  if (canvas) return canvas;
  canvas = document.createElement("canvas");
  canvas.id = "fxCanvas";
  canvas.className = "fxlayer";
  canvas.setAttribute("aria-hidden", "true");
  document.body.insertBefore(canvas, document.body.firstChild);
  ctx = canvas.getContext("2d");
  return canvas;
}

function resize() {
  if (!canvas) return;
  DPR = Math.min(window.devicePixelRatio || 1, 2);
  W = window.innerWidth;
  H = window.innerHeight;
  canvas.width = Math.floor(W * DPR);
  canvas.height = Math.floor(H * DPR);
  canvas.style.width = W + "px";
  canvas.style.height = H + "px";
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  seed();
}

/* how many particles: scaled by screen area, thinned hard on phones */
function count() {
  const area = W * H;
  const base = mode === "night" ? 6500 : 23000;   // one particle per N pixels
  const n = Math.round(area / base * (DENSITY[cfg.fx_density] || 1));
  const cap = mode === "night" ? (W < 640 ? 100 : 260) : (W < 640 ? 40 : 88);
  return Math.max(10, Math.min(n, cap));
}

function seed() {
  parts = [];
  shooters = [];
  const n = count();
  for (let i = 0; i < n; i++) {
    parts.push(mode === "night" ? newStar() : newNode());
  }
}

const newStar = () => {
  // a few big bright ones carry the look; the rest are fine dust behind them
  const hero = Math.random() < 0.16;
  return {
    x: Math.random() * W,
    y: Math.random() * H,
    r: hero ? rnd(1.8, 3.2) : rnd(0.8, 1.8),
    depth: rnd(0.3, 1),
    base: hero ? rnd(0.85, 1) : rnd(0.42, 0.8),
    halo: hero,
    phase: Math.random() * Math.PI * 2,
    speed: rnd(0.35, 1.1),
    glow: 0
  };
};

/* Ivory gets a filigree web instead: fine gold nodes joined by hairlines.
   Lines read clearly on cream where scattered specks did not, and the whole
   thing reaches toward the finger, so the interactivity is obvious. */
const newNode = () => ({
  x: Math.random() * W,
  y: Math.random() * H,
  r: rnd(1.1, 2.4),
  depth: rnd(0.3, 1),
  base: rnd(0.34, 0.62),
  vx: rnd(-9, 9),
  vy: rnd(-9, 9),
  phase: Math.random() * Math.PI * 2,
  glow: 0
});

/* ---------- drawing ---------- */
function paint(dt, t) {
  ctx.clearRect(0, 0, W, H);
  const night = mode === "night";
  const ink = night ? cfg._star : cfg._gold;
  const drift = cfg.fx_drift && pointer.has;
  const px = drift ? (pointer.x - W / 2) / (W / 2) : 0;
  const py = drift ? (pointer.y - H / 2) / (H / 2) : 0;

  // ---- work out where every particle is this frame ----
  const pts = [];
  for (const p of parts) {
    if (!night) {
      // slow wander, bouncing off the edges
      p.x += p.vx * dt; p.y += p.vy * dt;
      if (p.x < 0 || p.x > W) p.vx *= -1;
      if (p.y < 0 || p.y > H) p.vy *= -1;
      p.x = Math.max(0, Math.min(W, p.x));
      p.y = Math.max(0, Math.min(H, p.y));
    }
    const ox = drift ? -px * 20 * p.depth : 0;
    const oy = drift ? -py * 20 * p.depth : 0;
    let x = p.x + ox, y = p.y + oy;

    // reach toward the finger — this is what makes it feel alive
    let near = 0;
    if (pointer.has) {
      const d = Math.hypot(x - pointer.x, y - pointer.y);
      const reach = night ? 150 : 210;
      near = d < reach ? (1 - d / reach) : 0;
      if (cfg.fx_glow && near > 0) {
        const pull = night ? 0.10 : 0.16;
        x += (pointer.x - x) * near * pull;
        y += (pointer.y - y) * near * pull;
      }
    }
    if (cfg.fx_glow) p.glow += (near - p.glow) * Math.min(1, dt * 7);
    else if (p.glow > 0.001) p.glow += (0 - p.glow) * Math.min(1, dt * 7);

    let a = p.base * (0.6 + 0.4 * p.depth);
    if (night && cfg.fx_twinkle) a *= 0.6 + 0.4 * Math.sin(t / 1000 * p.speed + p.phase);
    if (!night) a *= 0.82 + 0.18 * Math.sin(t / 1600 + p.phase);
    a += p.glow * 0.6;
    pts.push({ x, y, a: Math.max(0, Math.min(1, a)), r: p.r * (1 + p.glow * 0.8),
               glow: p.glow, halo: p.halo });
  }

  // ---- ivory: join near neighbours with hairlines ----
  if (!night) {
    const LINK = Math.min(200, Math.max(120, W * 0.16));
    ctx.lineWidth = 1;
    ctx.strokeStyle = ink;
    for (let i = 0; i < pts.length; i++) {
      for (let j = i + 1; j < pts.length; j++) {
        const dx = pts[i].x - pts[j].x, dy = pts[i].y - pts[j].y;
        const d2 = dx * dx + dy * dy;
        if (d2 > LINK * LINK) continue;
        const d = Math.sqrt(d2);
        const strength = 1 - d / LINK;
        const lift = Math.max(pts[i].glow, pts[j].glow);
        ctx.globalAlpha = Math.min(0.62, strength * 0.38 + lift * 0.45);
        ctx.beginPath();
        ctx.moveTo(pts[i].x, pts[i].y);
        ctx.lineTo(pts[j].x, pts[j].y);
        ctx.stroke();
      }
    }
    // and a line from the finger to whatever is close
    if (pointer.has) {
      for (const q of pts) {
        if (q.glow < 0.06) continue;
        ctx.globalAlpha = Math.min(0.5, q.glow * 0.6);
        ctx.beginPath();
        ctx.moveTo(pointer.x, pointer.y);
        ctx.lineTo(q.x, q.y);
        ctx.stroke();
      }
    }
  }

  // ---- the particles themselves ----
  for (const q of pts) {
    if (night && q.halo) {                       // soft bloom on the bright ones
      const g = ctx.createRadialGradient(q.x, q.y, 0, q.x, q.y, q.r * 5);
      g.addColorStop(0, cfg._gold);
      g.addColorStop(1, "rgba(0,0,0,0)");
      ctx.globalAlpha = q.a * 0.38;
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(q.x, q.y, q.r * 5, 0, 6.2832); ctx.fill();
    }
    ctx.globalAlpha = q.a;
    ctx.fillStyle = (night && (q.halo || q.glow > 0.2)) ? cfg._gold : ink;
    ctx.beginPath();
    ctx.arc(q.x, q.y, q.r, 0, 6.2832);
    ctx.fill();
  }

  // ---- shooting stars, night only ----
  if (night && cfg.fx_shooting) {
    sinceShooter += dt;
    if (sinceShooter > rnd(6, 12) && shooters.length < 2) {
      sinceShooter = 0;
      const fromLeft = Math.random() < 0.5;
      shooters.push({
        x: fromLeft ? rnd(-80, W * 0.4) : rnd(W * 0.6, W + 80),
        y: rnd(-40, H * 0.45),
        vx: (fromLeft ? 1 : -1) * rnd(240, 380),
        vy: rnd(120, 190),
        life: 0, span: rnd(0.7, 1.1)
      });
    }
    for (let i = shooters.length - 1; i >= 0; i--) {
      const s = shooters[i];
      s.life += dt; s.x += s.vx * dt; s.y += s.vy * dt;
      const k = s.life / s.span;
      if (k >= 1) { shooters.splice(i, 1); continue; }
      const fade = Math.sin(Math.PI * k);
      const tailX = s.x - s.vx * 0.12, tailY = s.y - s.vy * 0.12;
      const g = ctx.createLinearGradient(s.x, s.y, tailX, tailY);
      g.addColorStop(0, cfg._gold);
      g.addColorStop(1, "rgba(0,0,0,0)");
      ctx.globalAlpha = 0.85 * fade;
      ctx.strokeStyle = g; ctx.lineWidth = 1.8; ctx.lineCap = "round";
      ctx.beginPath(); ctx.moveTo(s.x, s.y); ctx.lineTo(tailX, tailY); ctx.stroke();
    }
  }
  ctx.globalAlpha = 1;
}

/* one still frame, for reduce-motion visitors */
function paintStill() {
  ctx.clearRect(0, 0, W, H);
  const ink = mode === "night" ? cfg._star : cfg._gold;
  for (const p of parts) {
    ctx.globalAlpha = Math.max(0, Math.min(1, p.base * (0.55 + 0.45 * p.depth)));
    ctx.fillStyle = ink;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r, 0, 6.2832);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function frame(now) {
  if (document.hidden) { raf = null; return; }     // stop dead when not looked at
  const dt = Math.min(0.05, (now - last) / 1000 || 0.016);
  last = now;
  paint(dt, now);
  raf = requestAnimationFrame(frame);
}

function start() {
  if (raf) return;
  last = performance.now();
  raf = requestAnimationFrame(frame);
}
function stop() {
  if (raf) cancelAnimationFrame(raf);
  raf = null;
}

/* ---------- public ---------- */
export function mountFX(settings, currentMode, colours) {
  cfg = Object.assign({}, FX_DEFAULTS, settings || {});
  cfg._star = colours.star;
  cfg._gold = colours.gold;
  mode = currentMode === "ivory" ? "ivory" : "night";

  const wantCanvas = cfg.fx_on && (mode === "night" ? true : cfg.fx_web);

  document.body.classList.toggle("fx-grain", !!(cfg.fx_on && mode === "ivory" && cfg.fx_grain));

  if (!wantCanvas) {
    stop();
    if (canvas) { canvas.remove(); canvas = null; ctx = null; }
    return;
  }

  ensureCanvas();
  resize();

  if (reduceMotion()) { stop(); paintStill(); return; }
  start();
}

export function unmountFX() {
  stop();
  if (canvas) { canvas.remove(); canvas = null; ctx = null; }
  document.body.classList.remove("fx-grain");
}

/* ---------- listeners, attached once ---------- */
let wired = false;
export function wireFX() {
  if (wired) return;
  wired = true;
  let rt = null;
  addEventListener("resize", () => {
    clearTimeout(rt);
    rt = setTimeout(() => { if (canvas) resize(); }, 180);
  });
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) stop();
    else if (canvas && !reduceMotion()) start();
  });
  const move = e => {
    const t = e.touches ? e.touches[0] : e;
    if (!t) return;
    pointer.x = t.clientX; pointer.y = t.clientY; pointer.has = true;
  };
  addEventListener("pointermove", move, { passive: true });
  addEventListener("touchmove", move, { passive: true });
  addEventListener("pointerleave", () => { pointer.has = false; });
  addEventListener("touchend", () => { pointer.has = false; }, { passive: true });
}
