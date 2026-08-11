import { db, configured, t, lang, setLang, money, num, esc, pick, bhoriLabel,
         BHORI, ANA, RATTI, KARATS, karatName,
         rateOf, bhoriRate, gramRate } from "./lib.js";
import { buildTheme, applyTheme, DEFAULTS, logoSVG, wordmarkSVG, jewellersSVG,
         bouquetSVG, mandalaSVG, RULE } from "./theme.js";
import { mountFX, wireFX, FX_DEFAULTS } from "./ambient.js";
import { wireViewer } from "./viewer.js";

const $ = id => document.getElementById(id);
const UNITS = { bhori: BHORI, ana: ANA, ratti: RATTI, gram: 1 };

let S = {}, RATES = [], LATEST = null, PREV = null, PRODUCTS = [], FEST = null;
let filter = "__all";
let mode = localStorage.getItem("mj_mode") || null;
let fxVisitor = localStorage.getItem("mj_fx");   // "on" | "off" | null = follow the shop setting
let unitVisitor = localStorage.getItem("mj_unit");  // "gram" | "bhori" | null = follow the shop

/* =====================================================================
   HOW A RATE IS PRESENTED

   Two ideas that must never be confused with each other:

     rates.unit          the unit the OWNER TYPED for that one row,
                         'gram' or 'bhori'. A fact about the stored number.
                         Read by rateOf() in lib.js, which returns both.

     settings.rate_unit  the unit the CUSTOMER SEES, 'gram' | 'bhori' |
                         'both'. Purely a display choice. It never touches
                         a stored number.

   rateParts() below is the ONE place that decides which figure leads,
   what it is called, and what (if anything) sits underneath. Rate cells,
   the 22 carat pill, the invitation hero, both calculators and the rate
   picture all call it. No other line of this file may name a unit.
   ===================================================================== */

/* what the shop published as its choice */
const shopUnit = () => ["gram", "bhori", "both"].includes(S.rate_unit) ? S.rate_unit : "gram";

/* what this visitor is looking at — their own choice wins, except when the
   shop chose 'both', where both figures are already on screen */
const liveUnit = () => {
  const shop = shopUnit();
  if (shop === "both") return "both";
  return (unitVisitor === "gram" || unitVisitor === "bhori") ? unitVisitor : shop;
};

/* -> { value, label, sub:{value,label}|null, delta } or null when the grade
   is blank. `forced` overrides the visitor's choice; the rate picture passes
   shopUnit() because the picture is the shop's own artwork, not the
   visitor's preference. */
/* The ONE mapping from a unit to the words for it. t("per_gram") and
   t("per_bhori") appear nowhere else in this file. */
const unitLabel = u => u === "bhori" ? t("per_bhori") : t("per_gram");

function rateParts(row, key, prevRow, forced) {
  const r = rateOf(row, key);
  if (!r) return null;
  const u = forced || liveUnit();
  const side = which => which === "bhori"
    ? { value: r.bhori, label: unitLabel("bhori") }
    : { value: r.gram,  label: unitLabel("gram")  };
  const head = side(u === "bhori" ? "bhori" : "gram");   // 'both' leads with gram
  const p = rateOf(prevRow, key);
  const was = p ? (u === "bhori" ? p.bhori : p.gram) : null;
  return {
    value: head.value,
    label: head.label,
    sub: u === "both" ? side("bhori") : null,
    /* the change is measured in whatever unit is on screen, so the arrow and
       the figure above it always agree */
    delta: was != null ? head.value - was : null
  };
}

/* ===================== load ===================== */
async function load() {
  if (window.PREVIEW_DATA) {
    const d = window.PREVIEW_DATA;
    S = d.settings || {}; RATES = (d.rates || []).slice();
    PRODUCTS = d.products || []; FEST = d.festival || null;
    return after();
  }
  if (!configured) {
    $("setupWarn").innerHTML = `<div class="setupwarn">${esc(t("not_setup"))}</div>`;
    return after();
  }
  const sb = await db();
  if (!sb) return after();
  const today = new Date().toISOString().slice(0, 10);
  const [set, rat, pro, fes] = await Promise.all([
    sb.from("settings").select("*").eq("id", 1).maybeSingle(),
    sb.from("rates").select("*").order("created_at", { ascending: false }).limit(12),
    sb.from("products").select("*").order("sort", { ascending: true })
                                   .order("created_at", { ascending: false }),
    sb.from("festivals").select("*").eq("active", true)
      .or(`ends_on.is.null,ends_on.gte.${today}`)
      .order("created_at", { ascending: false }).limit(1)
  ]);
  S = set.data || {};
  RATES = (rat.data || []).slice().reverse();
  PRODUCTS = pro.data || [];
  FEST = (fes.data || [])[0] || null;
  after();
  track("page");
}

function after() {
  LATEST = RATES.length ? RATES[RATES.length - 1] : null;
  PREV = RATES.length > 1 ? RATES[RATES.length - 2] : null;
  if (!mode) mode = S.theme_default === "ivory" ? "ivory" : "night";
  paint();
  render();
}

/* ===================== theme ===================== */
function themeSource() {
  /* a live festival can carry its own palette; otherwise use the shop setting */
  return FEST && FEST.festival_key ? Object.assign({}, S, { festival: FEST.festival_key }) : S;
}
function paint() {
  applyTheme(buildTheme(themeSource(), mode));
  const cs = getComputedStyle(document.documentElement);
  document.querySelector('meta[name="theme-color"]')
    ?.setAttribute("content", cs.getPropertyValue("--bg").trim());
  wireFX();
  const fxWanted = fxVisitor === "off" ? false
                 : fxVisitor === "on" ? true
                 : S.fx_on !== false;
  mountFX(Object.assign({}, S, { fx_on: fxWanted }), mode, {
    star: mode === "night" ? "#d9c8a2" : cs.getPropertyValue("--accent").trim(),
    gold: cs.getPropertyValue("--accent").trim()
  });
}
function toggleMode() {
  mode = mode === "night" ? "ivory" : "night";
  localStorage.setItem("mj_mode", mode);
  paint(); render();
}


/* ===================== helpers ===================== */
const layout = () => ["thread", "invitation", "ornate"].includes(S.layout) ? S.layout : DEFAULTS.layout;
const language = () => (S.style_language === "ornate" ? "ornate" : "minimal");

const lockup = (cls = "") => `<div class="lock ${cls}">
  <span class="mk">${logoSVG(S)}</span>
  <span class="wm">${wordmarkSVG()}</span>
  <span class="jw">${jewellersSVG()}</span></div>`;

const MAGNIFIER = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"
  stroke-linecap="round" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5"/>
  <path d="M15.4 15.4L21 21M10.5 7.6v5.8M7.6 10.5h5.8"/></svg>`;

/* The button sits over the whole photograph, so anywhere on the picture opens
   the viewer, while the magnifier in the corner shows that it can be tapped. */
const photo = p => (p.photo_url
  ? `<img src="${esc(p.photo_url)}" alt="${esc(pick(p, "name") || "")}"
       loading="lazy" decoding="async">`
  : esc(t("photo")))
  + (pick(p, "tag") ? `<span class="tag">${esc(pick(p, "tag"))}</span>` : "")
  + (p.sold ? `<span class="soldb">${esc(t("sold"))}</span>` : "")
  + (p.photo_url ? `<button class="zoombtn" type="button" data-zoom="${esc(p.id ?? "")}"
       aria-label="${esc(t("view_photo"))}"><span class="zb">${MAGNIFIER}</span></button>` : "");

const waLink = nm => S.whatsapp
  ? `https://wa.me/${S.whatsapp}?text=${encodeURIComponent(`${t("enquire_p")}: ${nm || ""}`)}` : "#";

const priceHTML = p => (p.price_on_request || p.price == null)
  ? `<p class="price req">${esc(t("ask_price"))}</p>`
  : `<p class="price">${money(p.price)}</p>`;

/* One short line the owner can type per piece. Clamped to two lines in CSS,
   and absent entirely when the field is blank. */
const blurbHTML = p => pick(p, "blurb")
  ? `<p class="blurb">${esc(pick(p, "blurb"))}</p>` : "";

const weightLine = p => p.weight_bhori != null
  ? `${bhoriLabel(p.weight_bhori)} \u00B7 ${num((p.weight_bhori * BHORI).toFixed(2))} g` : "";

const ORN = { bq: "", md: "" };
function ornament() {
  if (!ORN.bq) { ORN.bq = bouquetSVG(); ORN.md = mandalaSVG(); }
  return ORN;
}
const orn = (cls, kind) => language() === "ornate"
  ? `<div class="orn ${cls}">${kind === "md" ? ornament().md : ornament().bq}</div>` : "";

const sechead = (kick, title) => `<div class="sechead">
  ${kick ? `<p class="kick">${esc(kick)}</p>` : ""}
  <h2>${esc(title)}</h2>
  <div class="rule">${RULE}</div></div>`;

/* ===================== render ===================== */
function render() {
  document.documentElement.lang = lang;
  // keep any fx-* classes: paint() owns those, render() owns layout and language
  const keep = [...document.body.classList].filter(c => c.indexOf("fx-") === 0);
  document.body.className = [`lay-${layout()}`, `lang-${language()}`,
    lang === "bn" ? "bn" : "", ...keep].filter(Boolean).join(" ");

  $("tbMark").innerHTML = logoSVG(S);
  $("tbName").innerHTML = `${esc(S.shop_name || "")}<span>${esc(pick(S, "address") || "")}</span>`;
  $("langBtn").textContent = lang === "bn" ? "English" : "\u09AC\u09BE\u0982\u09B2\u09BE";
  $("modeBtn").textContent = mode === "night" ? t("ivory_mode") : t("night_mode");
  $("modeBtn").classList.toggle("hide", S.theme_toggle === false);

  const fxLive = fxVisitor === "off" ? false : fxVisitor === "on" ? true : S.fx_on !== false;
  const fxBtn = $("fxBtn");
  if (fxBtn) {
  fxBtn.classList.toggle("hide", S.fx_on === false);   // owner switched it off entirely
  fxBtn.classList.toggle("is-off", !fxLive);
  fxBtn.setAttribute("aria-pressed", String(fxLive));
  fxBtn.title = fxLive ? t("fx_off_label") : t("fx_on_label");
  fxBtn.setAttribute("aria-label", fxBtn.title);
  fxBtn.innerHTML = fxLive
    ? `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"
         stroke-linecap="round"><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M18.4 5.6L17 7M7 17l-1.4 1.4"/>
         <circle cx="12" cy="12" r="3.2"/></svg>`
    : `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"
         stroke-linecap="round"><circle cx="12" cy="12" r="3.2"/><path d="M4 4l16 16"/></svg>`;
  }

  const bText = pick(S, "banner_text");
  $("banner").classList.toggle("hide", !(S.banner_on && bText));
  $("bannerText").textContent = bText || "";

  renderFestival();
  $("stage").innerHTML = { thread: viewThread, invitation: viewInvitation, ornate: viewOrnate }[layout()]();
  wireUp();
}

/* ---------- festival card ---------- */
function renderFestival() {
  const host = $("festHost");
  if (!FEST) { host.innerHTML = ""; return; }
  const todayKey = `${FEST.id}:${new Date().toISOString().slice(0, 10)}`;
  if (localStorage.getItem("mj_fest_seen") === todayKey) { host.innerHTML = ""; return; }

  const img = FEST.image_url
    ? `<img class="im" src="${esc(FEST.image_url)}" alt="${esc(pick(FEST, "title") || "")}">`
    : `<div class="im" style="height:200px;background:var(--accent-tint)"></div>`;
  const overlay = FEST.image_has_text ? "" : `<div class="ov">
      <p class="k">${esc(S.shop_name || "")}</p>
      <h3>${esc(pick(FEST, "title") || "")}</h3>
      ${pick(FEST, "text") ? `<p>${esc(pick(FEST, "text"))}</p>` : ""}
      ${pick(FEST, "cta_text") ? `<a class="cta" href="${esc(FEST.cta_link || "#collection")}">${esc(pick(FEST, "cta_text"))}</a>` : ""}
    </div>`;
  host.innerHTML = `<div class="fest" id="festCard">${img}${overlay}
    <button class="x" id="festX" aria-label="Close">&times;</button></div>`;
  $("festX").addEventListener("click", () => {
    localStorage.setItem("mj_fest_seen", todayKey);
    $("festCard").remove();
  });
}

/* ---------- shared blocks ---------- */
const heroText = () => ({
  title: pick(S, "hero_title") || S.shop_name || "",
  said: pick(S, "hero_text") || S.tagline || ""
});

function pillHTML() {
  const P = rateParts(LATEST, "k22", PREV);
  if (!P) return "";
  const d = P.delta;
  const delta = d ? `<span style="color:var(--${d < 0 ? "down" : "up"});font-size:12px">${
    d < 0 ? "\u2193" : "\u2191"} ${money(Math.abs(d))}</span>` : "";
  return `<div class="pill"><span class="l">${esc(karatName("k22"))}</span>
    <span class="v">${money(P.value)}</span>
    <span class="pu">${esc(P.label)}</span>${delta}
    ${P.sub ? `<span class="pg">${money(P.sub.value)} ${esc(P.sub.label)}</span>` : ""}</div>`;
}

/* The visitor's own gram/bhori switch, beside the rate rather than in the
   topbar — three control buttons up there already crowd a 360px screen.
   Hidden when the shop chose 'both', because then there is nothing to flip.
   Same shape as the theme and effects switches: a stored preference that
   falls back to the shop's setting when the visitor has not chosen. */
function unitSwitchHTML() {
  if (shopUnit() === "both") return "";
  const now = liveUnit();
  const opt = u => `<button class="uchip" type="button" data-unit="${u}"
    aria-pressed="${u === now}">${esc(unitLabel(u))}</button>`;
  return `<div class="unitsw" role="group" aria-label="${esc(t("unit_switch"))}">
    ${opt("gram")}${opt("bhori")}</div>`;
}

function rateBlock() {
  if (!LATEST) return `<section class="band" id="rate"><div class="wrap">
    ${sechead("", t("rate_today"))}<p class="emptymsg">${esc(t("no_rate"))}</p></div></section>`;

  /* Every cell is built by rateParts(), so the grid reads the same whether the
     row was saved per bhori or per gram, and follows the shop's display
     choice without this function knowing what the units are called. */
  const cells = KARATS.map(x => [karatName(x.k), rateParts(LATEST, x.k, PREV)])
    .filter(r => r[1]);
  const sv = rateParts(LATEST, "silver", PREV);
  if (sv) cells.push([t("silver"), sv]);

  const grid = cells.map(([label, P]) => {
    const d = P.delta;
    return `<div class="bcell"><p class="k">${esc(label)}</p>
      <p class="v">${money(P.value)}</p>
      <p class="u">${esc(P.label)}</p>
      ${P.sub ? `<p class="g">${esc(P.sub.label)} \u00B7 ${money(P.sub.value)}</p>` : ""}
      ${d ? `<p class="d ${d < 0 ? "down" : "up"}">${d < 0 ? "\u2193" : "\u2191"} ${money(Math.abs(d))}</p>` : ""}
    </div>`;
  }).join("");

  return `<section class="band" id="rate">
    ${orn("l", "md")}${orn("r", "md")}
    <div class="wrap">
      ${sechead(`${t("effective")} ${LATEST.effective}`, t("rate_today"))}
      ${unitSwitchHTML()}
      <div class="bandgrid">${grid}</div>
      <p class="note" style="text-align:center;max-width:56ch;margin:20px auto 0">${esc(t("metal_only"))}</p>
      ${RATES.length >= 2 ? `<div class="chartwrap">
        <p class="chartnote">${esc(t("step_note"))}</p>
        <svg class="mchart" id="chart" viewBox="0 0 640 165" preserveAspectRatio="xMidYMid meet" role="img"></svg>
      </div>` : ""}
      <div class="sharewrap"><button class="btn o" id="shareBtn" type="button"
        style="display:inline-flex;padding:12px 22px">${esc(t("share_rate"))}</button></div>
    </div></section>`;
}

function toolsBlock() {
  if (!LATEST) return "";
  const units = ["bhori", "ana", "ratti", "gram"]
    .map(u => `<option value="${u}">${esc(t(u))}</option>`).join("");
  const grades = KARATS.filter(x => rateOf(LATEST, x.k))
    .map(x => `<option value="${x.k}">${esc(karatName(x.k))}</option>`).join("");
  return `<section class="tools"><div class="wrap">
    ${sechead("", t("tools"))}
    <div class="toolgrid">
      <div class="tool"><h3>${esc(t("calc"))}</h3>
        <div class="field"><label for="w">${esc(t("weight"))}</label>
          <div class="pair"><input id="w" type="number" inputmode="decimal" value="1" min="0" step="any">
          <select id="u">${units}</select></div></div>
        <div class="field"><label for="k">${esc(t("grade"))}</label><select id="k">${grades}</select></div>
        <div class="field"><label for="mk">${esc(t("making"))}</label>
          <input id="mk" type="number" inputmode="decimal" value="12" min="0" max="40" step="1"></div>
        <div class="out">
          <div class="oline"><span id="wsum"></span><b id="gsum"></b></div>
          <div class="oline"><span>${esc(t("rate_used"))}</span><b id="rateUsed"></b></div>
          <div class="oline"><span>${esc(t("metal_value"))}</span><b id="metal"></b></div>
          <div class="oline"><span id="mkLabel"></span><b id="mkval"></b></div>
          <div class="oline total"><span>${esc(t("estimate"))}</span><b id="total"></b></div>
        </div>
        <p class="toolnote">${esc(t("calc_note"))}</p></div>
      <div class="tool"><h3>${esc(t("exch_calc"))}</h3>
        <div class="field"><label for="ew">${esc(t("old_weight"))}</label>
          <div class="pair"><input id="ew" type="number" inputmode="decimal" value="1" min="0" step="any">
          <select id="eu">${units}</select></div></div>
        <div class="field"><label for="ek">${esc(t("grade"))}</label><select id="ek">${grades}</select></div>
        <div class="out">
          <div class="oline"><span id="ewsum"></span><b id="egsum"></b></div>
          <div class="oline"><span>${esc(t("rate_used"))}</span><b id="eRateUsed"></b></div>
          <div class="oline total"><span>${esc(t("worth"))}</span><b id="eworth"></b></div>
        </div>
        <p class="toolnote">${esc(t("exch_note"))}</p></div>
    </div></div></section>`;
}

function trustBlock() {
  const rows = [[S.show_hallmark, "hallmark", "hallmark_d"], [S.show_slip, "slip", "slip_d"],
                [S.show_exchange, "exch", "exch_d"], [S.show_repair, "repair", "repair_d"]]
    .filter(r => r[0]);
  if (!rows.length && !S.bajus_member) return "";
  return `<section class="trust" id="why"><div class="wrap">
    ${sechead("", t("why_here"))}
    <div class="tgrid">${rows.map(r =>
      `<div><h3>${esc(t(r[1]))}</h3><p>${esc(t(r[2]))}</p></div>`).join("")}</div>
    ${S.bajus_member ? `<span class="bajus">${esc(t("bajus"))}</span>` : ""}
  </div></section>`;
}

const FB_ICON = `<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M22 12.06C22
  6.5 17.52 2 12 2S2 6.5 2 12.06c0 5.02 3.66 9.18 8.44 9.94v-7.03H7.9v-2.91h2.54V9.85c0-2.52
  1.49-3.91 3.77-3.91 1.09 0 2.24.2 2.24.2v2.46h-1.26c-1.24 0-1.63.78-1.63 1.57v1.89h2.78l-.45
  2.91h-2.33V22c4.78-.76 8.44-4.92 8.44-9.94z"/></svg>`;

function footerBlock() {
  const hrs = pick(S, "hours"), closed = pick(S, "closed_day");
  const line3 = [hrs, closed ? `${t("closed")}: ${closed}` : ""].filter(Boolean).join(" \u00B7 ");
  const bits = [S.shop_name, pick(S, "address"), line3,
                [S.phone1, S.phone2].filter(Boolean).join(" \u00B7 ")].filter(Boolean).map(esc);
  /* Monoram Jewellers on Google Maps: the store's own listing, not an area search.
     ftid is the place's permanent id, so the pin stays on the shop. */
  const mapUrl = S.map_url || "https://www.google.com/maps/place/Monoram+Jewellers/" +
    "@24.4586908,89.7041104,19z/data=!4m6!3m5!1s0x39fdeb526f3db25f:0x3be9b3800c1c45d1" +
    "!8m2!3d24.4586908!4d89.7041104";

  /* Each of these is optional. A field left blank in the admin page renders
     nothing at all here — never a bare label and never an empty link. */
  const propName = pick(S, "proprietor");
  const propLine = propName
    ? `<p class="prop">${esc(t("proprietor"))}: ${esc(propName)}</p>` : "";
  const fbPage = S.facebook_page
    ? `<a class="fblink" href="${esc(S.facebook_page)}" target="_blank" rel="noopener">
        ${FB_ICON}${esc(t("fb_page"))}</a>` : "";
  const fbProfile = S.facebook_profile
    ? `<p class="fbfine"><a href="${esc(S.facebook_profile)}" target="_blank" rel="noopener">
        ${esc(t("fb_profile"))}</a></p>` : "";

  return `<footer><div class="wrap">
    ${lockup("sm")}
    <h2 style="font-size:26px;margin-bottom:12px">${esc(t("visit"))}</h2>
    <p>${bits.join("<br>")}</p>
    ${propLine}
    <a class="maplink" href="${esc(mapUrl)}" target="_blank" rel="noopener">${esc(t("map"))}</a>
    ${fbPage ? `<div class="fbwrap">${fbPage}${fbProfile}</div>` : fbProfile}
    <p class="fine">${esc(S.email || "")}</p>
    ${S.show_admin_link === false ? "" : `<div><a class="adminlink" href="admin.html" rel="nofollow">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
        stroke-linecap="round"><rect x="4" y="10" width="16" height="10" rx="2"/>
        <path d="M8 10V7a4 4 0 0 1 8 0v3"/></svg>${esc(t("shop_login"))}</a></div>`}
  </div></footer>`;
}

function filtersHTML() {
  const cats = [...new Set(PRODUCTS.map(p => p.category).filter(Boolean))];
  if (cats.length < 2) return "";
  const chips = [{ v: "__all", l: t("all") }].concat(cats.map(c => {
    const row = PRODUCTS.find(p => p.category === c);
    return { v: c, l: pick(row, "category") || c };
  }));
  return `<div class="filters">${chips.map(c =>
    `<button class="fchip" type="button" data-v="${esc(c.v)}" aria-pressed="${c.v === filter}">${esc(c.l)}</button>`
  ).join("")}</div>`;
}

const shown = () => filter === "__all" ? PRODUCTS : PRODUCTS.filter(p => p.category === filter);

/* The order pieces actually appear in on screen. Ornate lifts the featured
   piece to the top, so this is not always the same as shown(). The viewer
   swipes through this, so swiping matches what the eye just scrolled past. */
let ORDER = [];
const setOrder = arr => { ORDER = arr.filter(p => p.photo_url); return arr; };

/* ---------- layout: gold thread ---------- */
function viewThread() {
  const { title, said } = heroText();
  const list = setOrder(shown());
  const beads = list.map(p => `<article class="bead${p.sold ? " is-sold" : ""}">
      <div class="art"><div class="ph">${photo(p)}</div></div>
      <div class="node"></div>
      <div class="side">
        <h3>${esc(pick(p, "name") || "")}</h3>
        <p class="m">${esc(pick(p, "category") || "")}${p.karat ? " \u00B7 " + esc(p.karat) : ""}</p>
        ${weightLine(p) ? `<p class="w">${esc(weightLine(p))}</p>` : ""}
        ${blurbHTML(p)}
        ${priceHTML(p)}
        <a class="ask" href="${waLink(pick(p, "name"))}" data-track="${p.id ?? ""}">${esc(t("enquire"))}</a>
      </div></article>`).join("");

  return `<section class="hero">${orn("bl")}${orn("tr")}
      ${lockup()}
      <h1>${esc(title)}</h1>
      ${said ? `<p class="said">${esc(said)}</p>` : ""}
      ${pillHTML()}
    </section>
    <section class="catalogue" id="collection"><div class="wrap">
      ${sechead(t("on_counter"), t("collection"))}
      ${filtersHTML()}
      ${list.length ? `<div class="beads"><div class="thread"></div>${beads}</div>
        <p class="catnote">${esc(t("cat_note"))}</p>`
        : `<p class="emptymsg">${esc(t("no_items"))}</p>`}
    </div></section>
    ${rateBlock()}${toolsBlock()}${trustBlock()}${footerBlock()}`;
}

/* ---------- layout: invitation ---------- */
function viewInvitation() {
  const { title, said } = heroText();
  const list = setOrder(shown());
  const cards = list.map(p => `<article class="card${p.sold ? " is-sold" : ""}">
      <div class="ph">${photo(p)}</div>
      <h3>${esc(pick(p, "name") || "")}</h3>
      <p class="m">${esc(pick(p, "category") || "")}${p.karat ? " \u00B7 " + esc(p.karat) : ""}</p>
      ${weightLine(p) ? `<p class="w">${esc(weightLine(p))}</p>` : ""}
      ${blurbHTML(p)}
      ${priceHTML(p)}
      <p style="text-align:center;margin:6px 0 0"><a class="ask" href="${waLink(pick(p, "name"))}"
        data-track="${p.id ?? ""}" style="font-size:10px;letter-spacing:.14em;text-transform:uppercase;
        color:var(--accent);text-decoration:none">${esc(t("enquire"))}</a></p>
    </article>`).join("");

  return `<div class="sheet">
      <div class="frame">
        ${orn("a")}${orn("b")}${orn("c")}${orn("d")}
        ${lockup()}
        <h1>${esc(title)}</h1>
        ${said ? `<p class="said">${esc(said)}</p>` : ""}
        ${(() => {
          const P = rateParts(LATEST, "k22", PREV);
          return P ? `<div class="invrate">
            <div class="l">${esc(karatName("k22"))} \u00B7 ${esc(P.label)}</div>
            <div class="v">${money(P.value)}</div>
            ${P.sub ? `<div class="g">${esc(P.sub.label)} \u00B7 ${money(P.sub.value)}</div>` : ""}
          </div>` : "";
        })()}
      </div>
      <section id="collection">
        ${sechead(t("on_counter"), t("collection"))}
        ${filtersHTML()}
        ${list.length ? `<div class="cards">${cards}</div>
          <p class="catnote">${esc(t("cat_note"))}</p>`
          : `<p class="emptymsg">${esc(t("no_items"))}</p>`}
      </section>
    </div>
    ${rateBlock()}${toolsBlock()}${trustBlock()}${footerBlock()}`;
}

/* ---------- layout: ornate ---------- */
function viewOrnate() {
  const { title, said } = heroText();
  const list = shown();
  const feat = filter === "__all" ? (list.find(p => p.featured) || list[0]) : null;
  const rest = feat ? list.filter(p => p !== feat) : list;
  setOrder(feat ? [feat, ...rest] : rest);   // featured sits at the top of the page

  const featHTML = feat ? `<article class="featured">
      ${orn("mand", "md")}
      <div class="ph">${photo(feat)}</div>
      <div>
        <p class="kick">${esc(t("featured"))}</p>
        <h3>${esc(pick(feat, "name") || "")}</h3>
        ${blurbHTML(feat)}
        <div class="spec">
          <div><span>${esc(t("carat"))}</span><b>${esc(feat.karat || "\u2014")}</b></div>
          ${feat.weight_bhori != null ? `
          <div><span>${esc(t("weight"))}</span><b>${esc(bhoriLabel(feat.weight_bhori))}</b></div>
          <div><span>${esc(t("in_grams"))}</span><b>${num((feat.weight_bhori * BHORI).toFixed(2))} g</b></div>` : ""}
          <div><span>${esc(t("price"))}</span><b>${feat.price_on_request || feat.price == null
            ? esc(t("ask_price")) : money(feat.price)}</b></div>
        </div>
        <a class="more" href="${waLink(pick(feat, "name"))}" data-track="${feat.id ?? ""}">${esc(t("enquire_p"))}</a>
      </div></article>` : "";

  const plates = rest.map(p => `<article class="plate${p.sold ? " is-sold" : ""}">
      <div class="ph">${photo(p)}</div>
      <div>
        <h3>${esc(pick(p, "name") || "")}</h3>
        <p class="m">${esc(pick(p, "category") || "")}${p.karat ? " \u00B7 " + esc(p.karat) : ""}</p>
        ${weightLine(p) ? `<p class="w">${esc(weightLine(p))}</p>` : ""}
        ${blurbHTML(p)}
        ${priceHTML(p)}
        <a class="ask" href="${waLink(pick(p, "name"))}" data-track="${p.id ?? ""}">${esc(t("enquire"))}</a>
      </div></article>`).join("");

  return `<section class="hero">
      <div class="halo"></div><div class="halo2"></div>${orn("bl")}${orn("tr")}
      ${lockup()}
      <h1>${esc(title)}</h1>
      ${said ? `<p class="said">${esc(said)}</p>` : ""}
      ${pillHTML()}
    </section>
    <section class="catalogue" id="collection"><div class="wrap">
      ${sechead(t("on_counter"), t("collection"))}
      ${filtersHTML()}
      ${list.length ? featHTML + plates + `<p class="catnote">${esc(t("cat_note"))}</p>`
        : `<p class="emptymsg">${esc(t("no_items"))}</p>`}
    </div></section>
    ${rateBlock()}${toolsBlock()}${trustBlock()}${footerBlock()}`;
}

/* ===================== chart ===================== */
function drawChart() {
  const svg = $("chart");
  if (!svg || RATES.length < 2) return;
  /* Chart the per-bhori figure so old and new rows sit on one scale. */
  const pts = RATES.slice(-6).filter(p => bhoriRate(p, "k22") != null);
  if (pts.length < 2) return;
  const vals = pts.map(p => bhoriRate(p, "k22"));
  const W = 640, H = 165, L = 62, R = 8, T = 12, B = 24;
  const lo = Math.min(...vals), hi = Math.max(...vals);
  const pad = (hi - lo) * 0.35 || 1000, min = lo - pad, max = hi + pad;
  const y = v => T + (H - T - B) * (1 - (v - min) / (max - min));
  const n = pts.length, seg = (W - L - R) / n, x = i => L + seg * i;
  let out = "";
  [min + (max - min) * 0.18, (min + max) / 2, max - (max - min) * 0.18].forEach(g => {
    out += `<line class="gridline" x1="${L}" y1="${y(g).toFixed(1)}" x2="${W - R}" y2="${y(g).toFixed(1)}"/>`
        +  `<text class="gridtext" x="0" y="${(y(g) + 3).toFixed(1)}">${money(g)}</text>`;
  });
  let d = `M ${x(0)} ${y(vals[0]).toFixed(1)}`;
  for (let i = 0; i < n; i++) {
    d += ` L ${(x(i) + seg).toFixed(1)} ${y(vals[i]).toFixed(1)}`;
    if (i < n - 1) d += ` L ${(x(i) + seg).toFixed(1)} ${y(vals[i + 1]).toFixed(1)}`;
  }
  out += `<path class="stepline" d="${d}"/>`;
  pts.forEach((p, i) => {
    const short = String(p.effective || "").split(",").pop().trim().slice(0, 12);
    out += `<circle class="knob" cx="${(x(i) + seg / 2).toFixed(1)}" cy="${y(vals[i]).toFixed(1)}" r="3.4"/>`
        +  `<text class="xlab" x="${(x(i) + seg / 2).toFixed(1)}" y="${H - 7}">${esc(short)}</text>`;
  });
  svg.innerHTML = out;
}

/* ===================== calculators ===================== */
function calcPrice() {
  if (!LATEST || !$("w")) return;
  const q = parseFloat($("w").value) || 0, u = $("u").value || "bhori";
  const g = q * UNITS[u], key = $("k").value || "k22";
  const perGram = gramRate(LATEST, key);        // never LATEST[key] / BHORI
  if (perGram == null) return;
  const metal = g * perGram;
  const pct = Math.max(0, parseFloat($("mk").value) || 0), mk = metal * pct / 100;
  /* the arithmetic is always done per gram; only the shown rate follows the
     display choice, and rateParts() owns that */
  const P = rateParts(LATEST, key, null);
  $("rateUsed").textContent = `${money(P.value)} ${P.label}`;
  $("wsum").textContent = `${num(q)} ${t(u)}`;
  $("gsum").textContent = `${num(g.toFixed(3))} g`;
  $("metal").textContent = money(metal);
  $("mkLabel").textContent = `${t("making").replace(" %", "")} ${num(pct)}%`;
  $("mkval").textContent = money(mk);
  $("total").textContent = money(metal + mk);
}
function calcExchange() {
  if (!LATEST || !$("ew")) return;
  const q = parseFloat($("ew").value) || 0, u = $("eu").value || "bhori";
  const g = q * UNITS[u], key = $("ek").value || "k22";
  const perGram = gramRate(LATEST, key);        // never LATEST[key] / BHORI
  if (perGram == null) return;
  const P = rateParts(LATEST, key, null);
  $("eRateUsed").textContent = `${money(P.value)} ${P.label}`;
  $("ewsum").textContent = `${num(q)} ${t(u)}`;
  $("egsum").textContent = `${num(g.toFixed(3))} g`;
  $("eworth").textContent = money(g * perGram);
}

/* ===================== rate picture ===================== */

/* Break `text` into lines that each fit inside maxWidth at the context's
   current font. A single word too long to fit on its own (which happens
   with a long Bangla compound) is split by character rather than allowed
   to run past the frame. Nothing this returns can overflow maxWidth. */
export function wrapText(ctx, text, maxWidth) {
  const out = [];
  const hardBreak = word => {
    let cur = "";
    for (const ch of word) {
      if (cur && ctx.measureText(cur + ch).width > maxWidth) { out.push(cur); cur = ch; }
      else cur += ch;
    }
    return cur;
  };
  let line = "";
  for (const word of String(text ?? "").split(/\s+/).filter(Boolean)) {
    const test = line ? line + " " + word : word;
    if (ctx.measureText(test).width <= maxWidth) { line = test; continue; }
    if (line) { out.push(line); line = ""; }
    if (ctx.measureText(word).width <= maxWidth) line = word;
    else line = hardBreak(word);
  }
  if (line) out.push(line);
  return out;
}

async function makeRateImage() {
  if (!LATEST) return;
  const c = $("rateCanvas");
  const W = 1080;                       // width is fixed; height is worked out below
  const MARGIN = 120;                   // text keeps this far from either edge
  const TEXTW = W - MARGIN * 2;
  const BOTTOM = 96;                    // clear space under the last footer line

  /* ---- what has to fit ----
     shopUnit(), not liveUnit(): the picture is the shop's published artwork,
     so it must not change because one visitor flipped their own switch. */
  const asShop = shopUnit();
  const rows = KARATS.map(x => [karatName(x.k), rateParts(LATEST, x.k, null, asShop)])
    .filter(r => r[1]);
  const sv = rateParts(LATEST, "silver", null, asShop);
  if (sv) rows.push([t("silver"), sv]);          // silver still only when it is set

  const foot = [];
  const propName = pick(S, "proprietor");
  if (propName) foot.push({ s: `${propName}, ${t("proprietor")}`, f: "300 27px Poppins, sans-serif", c: "accent", gap: 0 });
  if (S.shop_name) foot.push({ s: S.shop_name, f: "300 36px Cormorant Garamond, Georgia, serif", c: "text", gap: 44 });
  const addr = pick(S, "address");
  if (addr) foot.push({ s: addr, f: "300 25px Poppins, sans-serif", c: "accent", gap: 40 });
  const phones = [S.phone1, S.phone2].filter(Boolean).join("  ·  ");
  if (phones) foot.push({ s: phones, f: "300 25px Poppins, sans-serif", c: "accent", gap: 38 });

  /* ---- measure, then size the canvas to the content ---- */
  const measure = c.getContext("2d");
  measure.font = "300 24px Poppins, sans-serif";
  const noteLines = wrapText(measure, t("metal_only"), TEXTW);

  /* "Effective from" is free text the owner types, so it wraps as well, and the
     grade blocks start below however many lines it turns into. */
  measure.font = "300 25px Poppins, sans-serif";
  const effLines = wrapText(measure, `${t("effective")} ${LATEST.effective || ""}`.trim(), TEXTW);
  const rowsTop = Math.max(580, 462 + effLines.length * 32 + 54);

  /* a long name or address wraps too, and the wrap has to be paid for in height */
  foot.forEach(l => {
    measure.font = l.f;
    l.lines = wrapText(measure, l.s, TEXTW);
    l.extra = (l.lines.length - 1) * 34;
  });
  const footHeight = foot.reduce((a, l) => a + l.gap + l.extra, 0);

  const ROW_H = 118;                                  // label + per-gram line + divider
  const need = rowsTop + rows.length * ROW_H + 34     // header block through the last row
             + noteLines.length * 34 + 56             // disclaimer, then a gap
             + footHeight + BOTTOM;
  const H = Math.max(1350, Math.ceil(need));
  c.width = W; c.height = H;                          // resizing also clears the canvas

  const g = c.getContext("2d");
  const cs = getComputedStyle(document.documentElement);
  const V = k => cs.getPropertyValue(k).trim();
  const bg = V("--bg") || "#0f0c0c", accent = V("--accent") || "#edc163";
  const soft = V("--accent-soft") || "#f2d391", text = V("--text") || "#f9f2e1";
  const mute = V("--mute") || "#928b7d";

  g.fillStyle = bg; g.fillRect(0, 0, W, H);
  g.strokeStyle = accent; g.globalAlpha = .45; g.lineWidth = 2;
  g.strokeRect(46, 46, W - 92, H - 92);
  g.globalAlpha = 1;

  const drawSVG = async (svg, colour, x, y, w, h) => {
    try {
      const s = svg.replace("<svg", `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"`)
                   .replace(/currentColor/g, colour);
      const img = new Image();
      await new Promise((res, rej) => { img.onload = res; img.onerror = rej;
        img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(s); });
      g.drawImage(img, x, y, w, h);
    } catch (e) {}
  };
  await drawSVG(logoSVG(S), accent, W / 2 - 58, 120, 116, 116);
  await drawSVG(wordmarkSVG(), text, W / 2 - 230, 268, 460, 62);

  g.textAlign = "center";
  g.fillStyle = text; g.font = "300 44px Cormorant Garamond, Georgia, serif";
  wrapText(g, t("rate_today"), TEXTW).forEach((l, i) => g.fillText(l, W / 2, 420 + i * 48));
  g.fillStyle = mute; g.font = "300 25px Poppins, sans-serif";
  effLines.forEach((l, i) => g.fillText(l, W / 2, 462 + i * 32));

  /* ---- one block per grade, in whichever unit the shop publishes ---- */
  let y = rowsTop;
  rows.forEach(([label, P], i) => {
    g.textAlign = "left"; g.fillStyle = text; g.font = "300 38px Poppins, sans-serif";
    g.fillText(label, MARGIN, y);
    g.textAlign = "right"; g.fillStyle = soft; g.font = "500 42px Poppins, sans-serif";
    g.fillText(money(P.value), W - MARGIN, y);

    g.textAlign = "left"; g.fillStyle = mute; g.font = "300 23px Poppins, sans-serif";
    g.fillText(P.label, MARGIN, y + 38);
    if (P.sub) {
      g.textAlign = "right";
      g.fillText(`${money(P.sub.value)} ${P.sub.label}`, W - MARGIN, y + 38);
    }

    /* no divider under the last block, so a missing grade leaves no dangling rule */
    if (i < rows.length - 1) {
      g.strokeStyle = mute; g.globalAlpha = .25; g.lineWidth = 1;
      g.beginPath(); g.moveTo(MARGIN, y + 68); g.lineTo(W - MARGIN, y + 68); g.stroke();
      g.globalAlpha = 1;
    }
    y += ROW_H;
  });

  /* ---- disclaimer, wrapped rather than cut ---- */
  y += 34;
  g.textAlign = "center"; g.fillStyle = mute; g.font = "300 24px Poppins, sans-serif";
  noteLines.forEach(line => { g.fillText(line, W / 2, y); y += 34; });

  /* ---- footer, anchored to the bottom edge ---- */
  let fy = H - BOTTOM - footHeight;
  const COLOUR = { accent, text, soft, mute };
  foot.forEach(l => {
    fy += l.gap;
    g.font = l.f; g.fillStyle = COLOUR[l.c];
    l.lines.forEach(line => { g.fillText(line, W / 2, fy); fy += 34; });
    fy -= 34;                                   // fy stays on the last baseline drawn
  });

  const blob = await new Promise(r => c.toBlob(r, "image/jpeg", 0.92));
  const file = new File([blob], "monoram-gold-rate.jpg", { type: "image/jpeg" });
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try { await navigator.share({ files: [file] }); return; } catch (e) {}
  }
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob); a.download = "monoram-gold-rate.jpg"; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}

/* ===================== wiring ===================== */
function wireUp() {
  drawChart();
  calcPrice(); calcExchange();
  ["w", "u", "k", "mk"].forEach(id => $(id) && $(id).addEventListener("input", calcPrice));
  ["ew", "eu", "ek"].forEach(id => $(id) && $(id).addEventListener("input", calcExchange));
  const sb2 = $("shareBtn"); if (sb2) sb2.addEventListener("click", makeRateImage);
  document.querySelectorAll(".uchip").forEach(b => b.addEventListener("click", () => {
    unitVisitor = b.dataset.unit;
    localStorage.setItem("mj_unit", unitVisitor);
    render();
    /* keep the rate section under the thumb instead of jumping to the top */
    document.getElementById("rate")?.scrollIntoView({ block: "start" });
  }));
  document.querySelectorAll(".fchip").forEach(b => b.addEventListener("click", () => {
    filter = b.dataset.v; render();
    const c = document.getElementById("collection");
    if (c) c.scrollIntoView({ behavior: "smooth", block: "start" });
  }));

  const tel = (S.phone1 || "").replace(/[^\d+]/g, "");
  $("callBtn").textContent = t("call_shop");
  $("callBtn").href = tel ? "tel:" + tel : "#";
  $("waBtn").textContent = t("whatsapp");
  $("waBtn").href = S.whatsapp ? "https://wa.me/" + S.whatsapp : "#";
  $("waBtn").classList.toggle("hide", !S.whatsapp);

  /* Facebook rides along as an icon, and only when the page is actually set */
  const fb = $("fbBtn");
  if (fb) {
    const on = !!S.facebook_page;
    fb.classList.toggle("hide", !on);
    if (on) {
      fb.href = S.facebook_page;
      fb.innerHTML = FB_ICON;
      fb.setAttribute("aria-label", t("fb_page"));
      fb.title = t("fb_page");
    }
  }
}

async function track(kind, productId) {
  if (!configured || window.PREVIEW_DATA) return;
  try {
    const sb = await db();
    if (sb) await sb.from("views").insert({ kind, product_id: productId ?? null });
  } catch (e) {}
}

addEventListener("scroll", () => {
  $("topbar").classList.toggle("solid", scrollY > innerHeight * 0.5);
}, { passive: true });
$("langBtn").addEventListener("click", () => { setLang(lang === "bn" ? "en" : "bn"); render(); });
$("modeBtn").addEventListener("click", toggleMode);
if ($("fxBtn")) $("fxBtn").addEventListener("click", () => {
  const live = fxVisitor === "off" ? false : fxVisitor === "on" ? true : S.fx_on !== false;
  fxVisitor = live ? "off" : "on";
  localStorage.setItem("mj_fx", fxVisitor);
  paint(); render();
});
document.addEventListener("click", e => {
  const a = e.target.closest("[data-track]");
  if (a && a.dataset.track) track("product", Number(a.dataset.track));
});
/* the viewer walks whatever is on screen now, in the order it is shown */
wireViewer(() => ORDER);

/* Never install the offline cache on a developer's own machine: a cached local
   build can outlive the session and keep showing stale pages for days. Any
   worker already installed on localhost is torn down here too. */
const IS_LOCAL = ["localhost", "127.0.0.1", "::1", "[::1]", ""].includes(location.hostname);
if ("serviceWorker" in navigator && !window.PREVIEW_DATA && !IS_LOCAL) {
  addEventListener("load", () => navigator.serviceWorker.register("sw.js").catch(() => {}));
} else if ("serviceWorker" in navigator && IS_LOCAL) {
  navigator.serviceWorker.getRegistrations()
    .then(rs => rs.forEach(r => r.unregister()))
    .catch(() => {});
}

load().catch(err => {
  console.error(err);
  after();   /* still draw the shop with whatever we have */
});
