/* Colour + look engine.
   Two visual languages (minimal / ornate), three layouts, festival palettes.
   Everything resolves to CSS variables so the stylesheet stays generic. */

export const DEFAULTS = {
  logo_key:        "D5-padma-lotus",
  logo_custom:     null,
  layout:          "thread",     // thread | invitation | ornate
  style_language:  "minimal",    // minimal | ornate
  festival:        "none",
  theme_default:   "night",      // night | ivory
  theme_toggle:    true,
  theme_accent_override: null
};

export const LAYOUTS = [
  { k: "thread",     n: "Gold thread",  d: "One line down the middle, pieces hanging off it." },
  { k: "invitation", n: "Invitation",   d: "Everything inside a bordered frame, narrow and centred." },
  { k: "ornate",     n: "Ornate",       d: "Big hero, ornament in the corners, alternating spreads." }
];

export const LANGUAGES = [
  { k: "minimal", n: "Minimal", d: "Fine lines and space. Matches the printed card." },
  { k: "ornate",  n: "Ornate",  d: "Gold bloomwork and mandalas filling the corners." }
];

/* base palettes lifted from the printed cards */
export const BASES = {
  night: { bg:"#0f0c0c", panel:"#171313", panel2:"#1f1a19", line:"#2c2826",
           text:"#f9f2e1", mute:"#928b7d", ph:"#191514", phText:"#4b4540",
           shade:"rgba(0,0,0,.55)" },
  ivory: { bg:"#f9f5e5", panel:"#f3eeda", panel2:"#ece6cf", line:"#e0dcce",
           text:"#353132", mute:"#716558", ph:"#efe9d6", phText:"#b8b0a0",
           shade:"rgba(255,255,255,.72)" }
};

/* festival palettes touch the accent only, so the card's restraint is kept */
export const FESTIVALS = {
  none:     { n:"None",            night:"#edc163", ivory:"#a37722" },
  eid:      { n:"Eid",             night:"#7fd6a4", ivory:"#1f7a5a" },
  puja:     { n:"Durga Puja",      night:"#f0885f", ivory:"#a8321a" },
  boishakh: { n:"Pohela Boishakh", night:"#f2a65a", ivory:"#9c5311" },
  wedding:  { n:"Wedding season",  night:"#e79ab4", ivory:"#8e2b50" },
  victory:  { n:"Victory Day",     night:"#8fc48a", ivory:"#2f6b2a" }
};

const clamp = n => Math.max(0, Math.min(255, Math.round(n)));
export function hexToRgb(hex) {
  let h = String(hex || "").trim().replace("#", "");
  if (h.length === 3) h = h.split("").map(c => c + c).join("");
  if (!/^[0-9a-fA-F]{6}$/.test(h)) return null;
  return [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16));
}
export const rgbToHex = a => "#" + a.map(v => clamp(v).toString(16).padStart(2, "0")).join("");
export function mix(a, b, t) {
  const A = hexToRgb(a), B = hexToRgb(b);
  if (!A || !B) return a;
  return rgbToHex([0, 1, 2].map(i => A[i] + (B[i] - A[i]) * t));
}
export function rgba(hex, alpha) {
  const c = hexToRgb(hex);
  return c ? `rgba(${c[0]},${c[1]},${c[2]},${alpha})` : hex;
}
export function luminance(hex) {
  const c = hexToRgb(hex);
  if (!c) return 0;
  const [r, g, b] = c.map(v => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
export function contrast(a, b) {
  const L1 = luminance(a), L2 = luminance(b), hi = Math.max(L1, L2), lo = Math.min(L1, L2);
  return (hi + 0.05) / (lo + 0.05);
}
export const readableText = bg => (luminance(bg) < 0.4 ? "#f9f2e1" : "#353132");

/* nudge an accent until it reads against the background */
function safeAccent(accent, bg) {
  let a = accent, guard = 0;
  const toward = luminance(bg) < 0.4 ? "#ffffff" : "#000000";
  while (contrast(a, bg) < 3.2 && guard++ < 16) a = mix(a, toward, 0.09);
  return a;
}

export function buildTheme(s, mode) {
  const g = k => (s && s[k] != null && s[k] !== "" ? s[k] : DEFAULTS[k]);
  const key = mode === "ivory" ? "ivory" : "night";
  const base = BASES[key];
  const fest = FESTIVALS[g("festival")] || FESTIVALS.none;
  let accent = g("theme_accent_override") || fest[key];
  accent = safeAccent(accent, base.bg);

  const dark = key === "night";
  const soft = dark ? mix(accent, "#ffffff", 0.34) : mix(accent, "#000000", 0.18);

  /* the button is a solid accent fill, so pick whichever ink reads better on it,
     then deepen the fill until that ink is comfortably legible */
  let btnBg = accent;
  const pickInk = bg => (contrast(bg, "#0f0c0c") >= contrast(bg, "#f9f2e1") ? "#0f0c0c" : "#f9f2e1");
  let btnText = pickInk(btnBg);
  let guard = 0;
  while (contrast(btnBg, btnText) < 4.5 && guard++ < 16) {
    btnBg = mix(btnBg, btnText === "#0f0c0c" ? "#ffffff" : "#000000", 0.08);
    btnText = pickInk(btnBg);
  }

  return {
    "--bg": base.bg,
    "--panel": base.panel,
    "--panel-2": base.panel2,
    "--line": base.line,
    "--text": base.text,
    "--mute": base.mute,
    "--accent": accent,
    "--accent-soft": soft,
    "--accent-deep": mix(accent, base.bg, 0.42),
    "--accent-line": rgba(accent, dark ? 0.30 : 0.34),
    "--accent-tint": mix(base.bg, accent, dark ? 0.10 : 0.12),
    "--btn-bg": btnBg,
    "--btn-bg-2": mix(btnBg, "#ffffff", dark ? 0.28 : 0.16),
    "--btn-text": btnText,
    "--ph": base.ph,
    "--ph-text": base.phText,
    "--shade": base.shade,
    "--halo-1": rgba(accent, dark ? 0.15 : 0.20),
    "--halo-2": rgba(accent, dark ? 0.08 : 0.12),
    "--hero-top": mix(base.bg, accent, dark ? 0.07 : 0.05),
    "--o1": mix(accent, base.bg, 0.42),
    "--o2": mix(accent, base.bg, 0.22),
    "--o3": accent,
    "--o4": soft,
    "--o5": mix(soft, "#ffffff", 0.35),
    "--down": dark ? "#8fb6cf" : "#3d6f8e",
    "--up": dark ? "#e0b878" : "#8a5a18"
  };
}

export function applyTheme(vars) {
  const r = document.documentElement.style;
  Object.entries(vars).forEach(([k, v]) => r.setProperty(k, v));
}

/* ---------- ornament, generated so it costs nothing to ship ---------- */
function petal(cx, cy, ang, ln, wd, tp) {
  const a = ang * Math.PI / 180, ca = Math.cos(a), sa = Math.sin(a);
  const T = (x, y) => `${(cx + x * ca - y * sa).toFixed(1)},${(cy + x * sa + y * ca).toFixed(1)}`;
  return `M${T(0,0)}C${T(wd,ln*.3)} ${T(wd*tp,ln*.9)} ${T(0,ln)}C${T(-wd*tp,ln*.9)} ${T(-wd,ln*.3)} ${T(0,0)}Z`;
}
const O = ["var(--o1)", "var(--o2)", "var(--o3)", "var(--o4)", "var(--o5)"];

export function bloom(cx, cy, r, ph = 0) {
  let s = "";
  [[1,26,.115],[.82,20,.115],[.64,15,.12],[.46,11,.13],[.30,8,.145]].forEach(([f,n,wf],i) => {
    let d = "";
    for (let k = 0; k < n; k++) d += petal(cx, cy, ph + i * (180 / n) + k * 360 / n, r * f, r * f * wf, .4);
    s += `<path fill="${O[i]}" d="${d}"/>`;
  });
  return s;
}

export function bouquetSVG() {
  const spec = [[6,8,44,0],[50,-2,29,14],[18,50,31,8],[62,34,20,22],[-4,74,22,4],[52,68,15,18],[84,10,15,10]];
  const body = spec.map(([x,y,r,ph]) => bloom(x + 6, 300 - (y + 6), r, ph)).join("");
  return `<svg viewBox="0 0 300 300" aria-hidden="true">${body}</svg>`;
}

export function mandalaSVG() {
  const cx = 120, cy = 120, r = 116;
  let s = "";
  const ring = (n, f, wf, tp, i, off = 0) => {
    let d = "";
    for (let k = 0; k < n; k++) d += petal(cx, cy, off + k * 360 / n, r * f, r * f * wf, tp);
    s += `<path fill="${O[i]}" d="${d}"/>`;
  };
  ring(40, 1, .045, .28, 0);
  s += `<circle cx="${cx}" cy="${cy}" r="${r*.845}" fill="none" stroke="${O[1]}" stroke-width="1"/>`;
  ring(20, .80, .105, .60, 1, 9);
  s += `<circle cx="${cx}" cy="${cy}" r="${r*.60}" fill="none" stroke="${O[2]}" stroke-width="1"/>`;
  ring(16, .52, .085, .42, 2);
  ring(16, .36, .055, .50, 3, 11.25);
  s += `<circle cx="${cx}" cy="${cy}" r="${r*.30}" fill="none" stroke="${O[3]}" stroke-width="1"/>`;
  ring(12, .26, .075, .65, 3);
  ring(12, .15, .055, .70, 4, 15);
  return `<svg viewBox="0 0 240 240" aria-hidden="true">${s}</svg>`;
}

/* the fine rule used throughout the minimal language */
export const RULE = `<svg viewBox="0 0 120 8" aria-hidden="true" style="width:120px;height:8px">
<line x1="6" y1="4" x2="50" y2="4" stroke="var(--accent)" stroke-width="0.6"/>
<rect x="57" y="1" width="6" height="6" transform="rotate(45 60 4)" fill="var(--accent)"/>
<line x1="70" y1="4" x2="114" y2="4" stroke="var(--accent)" stroke-width="0.6"/></svg>`;

/* logo resolution: custom upload wins, else one of the thirteen card marks */
export function logoSVG(s) {
  if (s && s.logo_custom) return s.logo_custom;
  const key = (s && s.logo_key) || DEFAULTS.logo_key;
  const M = window.MARKS || {};
  return (M[key] && M[key].s) || (M[DEFAULTS.logo_key] && M[DEFAULTS.logo_key].s) || "";
}
export const wordmarkSVG = () => (window.MARKS && window.MARKS._wordmark ? window.MARKS._wordmark.s : "");
export const jewellersSVG = () => (window.MARKS && window.MARKS._jewellers ? window.MARKS._jewellers.s : "");
