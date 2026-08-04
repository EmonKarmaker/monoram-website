import { db, configured, t, lang, setLang, money, num, esc, pick, bhoriLabel,
         BHORI, ANA, RATTI, KARATS, karatName } from "./lib.js";
import { buildTheme, applyTheme, DEFAULTS, logoSVG, wordmarkSVG, jewellersSVG,
         bouquetSVG, mandalaSVG, RULE } from "./theme.js";
import { mountFX, wireFX, FX_DEFAULTS } from "./ambient.js";

const $ = id => document.getElementById(id);
const UNITS = { bhori: BHORI, ana: ANA, ratti: RATTI, gram: 1 };

let S = {}, RATES = [], LATEST = null, PREV = null, PRODUCTS = [], FEST = null;
let filter = "__all";
let mode = localStorage.getItem("mj_mode") || null;
let fxVisitor = localStorage.getItem("mj_fx");   // "on" | "off" | null = follow the shop setting

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

const photo = p => (p.photo_url
  ? `<img src="${esc(p.photo_url)}" alt="${esc(pick(p, "name") || "")}" loading="lazy">`
  : esc(t("photo")))
  + (pick(p, "tag") ? `<span class="tag">${esc(pick(p, "tag"))}</span>` : "")
  + (p.sold ? `<span class="soldb">${esc(t("sold"))}</span>` : "");

const waLink = nm => S.whatsapp
  ? `https://wa.me/${S.whatsapp}?text=${encodeURIComponent(`${t("enquire_p")}: ${nm || ""}`)}` : "#";

const priceHTML = p => (p.price_on_request || p.price == null)
  ? `<p class="price req">${esc(t("ask_price"))}</p>`
  : `<p class="price">${money(p.price)}</p>`;

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
  if (!LATEST) return "";
  const d = PREV ? LATEST.k22 - PREV.k22 : 0;
  const delta = d ? `<span style="color:var(--${d < 0 ? "down" : "up"});font-size:12px">${
    d < 0 ? "\u2193" : "\u2191"} ${money(Math.abs(d))}</span>` : "";
  return `<div class="pill"><span class="l">${esc(karatName("k22"))}</span>
    <span class="v">${money(LATEST.k22)}</span>${delta}</div>`;
}

function rateBlock() {
  if (!LATEST) return `<section class="band" id="rate"><div class="wrap">
    ${sechead("", t("rate_today"))}<p class="emptymsg">${esc(t("no_rate"))}</p></div></section>`;

  const cells = KARATS.map(x => [karatName(x.k), LATEST[x.k], PREV ? PREV[x.k] : null])
    .filter(r => r[1] != null);
  if (LATEST.silver != null) cells.push([t("silver"), LATEST.silver, PREV ? PREV.silver : null]);

  const grid = cells.map(([label, v, pv]) => {
    const d = pv != null ? v - pv : null;
    return `<div class="bcell"><p class="k">${esc(label)}</p>
      <p class="v">${money(v)}</p>
      <p class="g">${esc(t("per_bhori"))} \u00B7 ${money(v / BHORI)}</p>
      ${d ? `<p class="d ${d < 0 ? "down" : "up"}">${d < 0 ? "\u2193" : "\u2191"} ${money(Math.abs(d))}</p>` : ""}
    </div>`;
  }).join("");

  return `<section class="band" id="rate">
    ${orn("l", "md")}${orn("r", "md")}
    <div class="wrap">
      ${sechead(`${t("effective")} ${LATEST.effective}`, t("rate_today"))}
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
  const grades = KARATS.filter(x => LATEST[x.k] != null)
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

function footerBlock() {
  const hrs = pick(S, "hours"), closed = pick(S, "closed_day");
  const line3 = [hrs, closed ? `${t("closed")}: ${closed}` : ""].filter(Boolean).join(" \u00B7 ");
  const bits = [S.shop_name, pick(S, "address"), line3,
                [S.phone1, S.phone2].filter(Boolean).join(" \u00B7 ")].filter(Boolean).map(esc);
  const mapUrl = S.map_url || "https://maps.app.goo.gl/gYMx4zU31RED2Xxt6";
  return `<footer><div class="wrap">
    ${lockup("sm")}
    <h2 style="font-size:26px;margin-bottom:12px">${esc(t("visit"))}</h2>
    <p>${bits.join("<br>")}</p>
    <a class="maplink" href="${esc(mapUrl)}" target="_blank" rel="noopener">${esc(t("map"))}</a>
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

/* ---------- layout: gold thread ---------- */
function viewThread() {
  const { title, said } = heroText();
  const list = shown();
  const beads = list.map(p => `<article class="bead${p.sold ? " is-sold" : ""}">
      <div class="art"><div class="ph">${photo(p)}</div></div>
      <div class="node"></div>
      <div class="side">
        <h3>${esc(pick(p, "name") || "")}</h3>
        <p class="m">${esc(pick(p, "category") || "")}${p.karat ? " \u00B7 " + esc(p.karat) : ""}</p>
        ${weightLine(p) ? `<p class="w">${esc(weightLine(p))}</p>` : ""}
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
  const list = shown();
  const cards = list.map(p => `<article class="card${p.sold ? " is-sold" : ""}">
      <div class="ph">${photo(p)}</div>
      <h3>${esc(pick(p, "name") || "")}</h3>
      <p class="m">${esc(pick(p, "category") || "")}${p.karat ? " \u00B7 " + esc(p.karat) : ""}</p>
      ${weightLine(p) ? `<p class="w">${esc(weightLine(p))}</p>` : ""}
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
        ${LATEST ? `<div class="invrate">
          <div class="l">${esc(karatName("k22"))} \u00B7 ${esc(t("per_bhori"))}</div>
          <div class="v">${money(LATEST.k22)}</div></div>` : ""}
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

  const featHTML = feat ? `<article class="featured">
      ${orn("mand", "md")}
      <div class="ph">${photo(feat)}</div>
      <div>
        <p class="kick">${esc(t("featured"))}</p>
        <h3>${esc(pick(feat, "name") || "")}</h3>
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
  const pts = RATES.slice(-6), vals = pts.map(p => Number(p.k22));
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
  const metal = g * (LATEST[key] / BHORI);
  const pct = Math.max(0, parseFloat($("mk").value) || 0), mk = metal * pct / 100;
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
  $("ewsum").textContent = `${num(q)} ${t(u)}`;
  $("egsum").textContent = `${num(g.toFixed(3))} g`;
  $("eworth").textContent = money(g * (LATEST[key] / BHORI));
}

/* ===================== rate picture ===================== */
async function makeRateImage() {
  if (!LATEST) return;
  const c = $("rateCanvas"), g = c.getContext("2d"), W = c.width, H = c.height;
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
  g.fillText(t("rate_today"), W / 2, 420);
  g.fillStyle = mute; g.font = "300 25px Poppins, sans-serif";
  g.fillText(`${t("effective")} ${LATEST.effective}`, W / 2, 462);

  const rows = KARATS.filter(x => LATEST[x.k] != null).map(x => [karatName(x.k), money(LATEST[x.k])]);
  if (LATEST.silver != null) rows.push([t("silver"), money(LATEST.silver)]);
  let y = 580;
  rows.forEach(([label, val]) => {
    g.textAlign = "left"; g.fillStyle = text; g.font = "300 38px Poppins, sans-serif";
    g.fillText(label, 120, y);
    g.textAlign = "right"; g.fillStyle = soft; g.font = "500 42px Poppins, sans-serif";
    g.fillText(val, W - 120, y);
    g.strokeStyle = mute; g.globalAlpha = .25; g.lineWidth = 1;
    g.beginPath(); g.moveTo(120, y + 26); g.lineTo(W - 120, y + 26); g.stroke();
    g.globalAlpha = 1; y += 100;
  });
  g.textAlign = "center"; g.fillStyle = mute; g.font = "300 24px Poppins, sans-serif";
  g.fillText(t("per_bhori"), W / 2, y + 12);
  g.fillText(t("metal_only").slice(0, 62), W / 2, y + 68);
  g.fillStyle = text; g.font = "300 34px Cormorant Garamond, Georgia, serif";
  g.fillText(S.shop_name || "", W / 2, H - 190);
  g.fillStyle = accent; g.font = "300 25px Poppins, sans-serif";
  g.fillText(S.address || "", W / 2, H - 150);
  g.fillText([S.phone1, S.phone2].filter(Boolean).join("  \u00B7  "), W / 2, H - 112);

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
if ("serviceWorker" in navigator && !window.PREVIEW_DATA) {
  addEventListener("load", () => navigator.serviceWorker.register("sw.js").catch(() => {}));
}

load().catch(err => {
  console.error(err);
  after();   /* still draw the shop with whatever we have */
});
