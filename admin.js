import { db, configured, BHORI, rateUnit } from "./lib.js";
import { DEFAULTS, buildTheme, contrast, hexToRgb, LAYOUTS, LANGUAGES, FESTIVALS,
         logoSVG } from "./theme.js";

const $ = id => document.getElementById(id);
const show = (el, on) => el.classList.toggle("hide", !on);
const msg = (el, text, kind = "ok") => {
  el.innerHTML = `<div class="msg ${kind}">${text}</div>`;
  if (kind === "ok") setTimeout(() => { el.innerHTML = ""; }, 4000);
};
const esc = s => String(s ?? "").replace(/[&<>"']/g,
  c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const taka = n => "\u09F3" + Math.round(n).toLocaleString("en-IN");

/* The database can be older than this copy of the website \u2014 a column the page
   saves may simply not exist yet. Supabase reports that as PGRST204 / "schema
   cache". Say what to do about it instead of showing the raw error. */
const missingColumn = err => {
  const m = String((err && err.message) || "");
  return (err && err.code === "PGRST204") || /schema cache/i.test(m) ||
         /could not find the .* column/i.test(m);
};
function saveError(el, err) {
  if (!missingColumn(err)) return msg(el, esc((err && err.message) || String(err)), "err");
  msg(el,
    "<b>Your database is one step behind this page.</b><br>" +
    "Open Supabase &rarr; SQL Editor, paste in the file <b>patch2.sql</b> from your website folder " +
    "and press Run. (If it still complains afterwards, run <b>patch.sql</b> as well.) " +
    "Then reload this page and save again.<br>" +
    `<span style="opacity:.7">Details: ${esc((err && err.message) || "")}</span>`, "err");
}

let SB = null;

if (!configured) {
  document.body.innerHTML =
    '<div class="login"><h1>Not connected</h1><p class="sub">Open <b>config.js</b> and paste in your ' +
    'Supabase URL and anon key, then reload this page.</p></div>';
  throw new Error("not configured");
}

/* ===================== auth ===================== */
async function boot() {
  SB = await db();
  if (!SB) { document.body.innerHTML =
    '<div class="login"><h1>Cannot reach the database</h1><p class="sub">Check your internet connection, then reload.</p></div>';
    return; }
  const { data } = await SB.auth.getSession();
  if (data.session) enter(data.session.user); else show($("loginBox"), true);
}
function enter(user) {
  show($("loginBox"), false); show($("app"), true);
  $("userEmail").textContent = user.email || "";
  loadAll();
}
$("loginBtn").addEventListener("click", async () => {
  const b = $("loginBtn"); b.disabled = true;
  const { data, error } = await SB.auth.signInWithPassword({
    email: $("email").value.trim(), password: $("pw").value });
  b.disabled = false;
  if (error) return msg($("loginMsg"), esc(error.message), "err");
  enter(data.user);
});
$("pw").addEventListener("keydown", e => { if (e.key === "Enter") $("loginBtn").click(); });
$("logout").addEventListener("click", async () => { await SB.auth.signOut(); location.reload(); });

/* ===================== tabs ===================== */
document.querySelectorAll(".tab").forEach(b => b.addEventListener("click", () => {
  document.querySelectorAll(".tab").forEach(x => x.setAttribute("aria-selected", x === b));
  ["rates", "items", "shop", "look", "fest", "stats"].forEach(n => show($("tab-" + n), n === b.dataset.tab));
  if (b.dataset.tab === "stats") loadStats();
  if (b.dataset.tab === "fest") loadFests();
}));

async function loadAll() { await Promise.all([loadRates(), loadItems(), loadShop(), loadFests()]); }

/* ===================== rates ===================== */
function defaultEffective() {
  const d = new Date();
  const time = d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
  const date = d.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
  return `${time}, ${date}`;
}
/* ---- per gram in, per bhori shown ----
   The four boxes are per gram. Under each one the page shows what that comes
   to per bhori, live as it is typed, so a wrong figure is obvious before it
   is published. A number over this limit is almost certainly a per-bhori
   figure typed into a per-gram box, so say so — but never block the save,
   because only the owner knows what the right number is. */
const GRAM_SUSPECT = 100000;
const RATE_KEYS = ["k22", "k21", "trad", "silver"];

function showConversion() {
  let warned = false;
  RATE_KEYS.forEach(k => {
    const el = $("r_" + k), out = $("c_" + k);
    if (!el || !out) return;
    const v = parseFloat(el.value);
    if (el.value === "" || !isFinite(v) || v <= 0) { out.textContent = ""; out.className = "conv"; return; }
    if (v > GRAM_SUSPECT) {
      warned = true;
      out.className = "conv warn";
      out.textContent = `That is ${taka(v)} for ONE GRAM. Did you type the bhori price by mistake?`;
      return;
    }
    out.className = "conv";
    out.textContent = `= ${taka(v * BHORI)} per bhori`;
  });
  $("rateWarn").innerHTML = warned
    ? '<div class="msg err">One of the boxes looks like a <b>per bhori</b> price. These boxes are ' +
      '<b>per gram</b>. Check it before you publish &mdash; you can still publish if it is right.</div>'
    : "";
}
RATE_KEYS.forEach(k => $("r_" + k) && $("r_" + k).addEventListener("input", showConversion));

async function loadRates() {
  if (!$("r_eff").value) $("r_eff").value = defaultEffective();
  const { data, error } = await SB.from("rates").select("*")
    .order("created_at", { ascending: false }).limit(20);
  if (error) return msg($("rateMsg"), esc(error.message), "err");
  const rows = data || [];
  window.__rates = rows;              // the unit preview reads the newest of these
  if (rows.length) {
    const l = rows[0];
    /* Prefill from the last rate, converted to per gram if that row was
       published per bhori. The stored row is never changed. */
    const wasBhori = rateUnit(l) === "bhori";
    RATE_KEYS.forEach(k => {
      const el = $("r_" + k);
      if (!el || el.value || l[k] == null) return;
      const n = Number(l[k]);
      if (!isFinite(n)) return;
      el.value = wasBhori ? +(n / BHORI).toFixed(2) : n;
    });
  }
  showConversion();
  drawUnitPreview();

  $("rateList").innerHTML = rows.length ? rows.map(r => {
    const bhori = rateUnit(r) === "bhori" ? Number(r.k22) : Number(r.k22) * BHORI;
    const unitPill = rateUnit(r) === "bhori"
      ? '<span class="pill">typed per bhori</span>'
      : '<span class="pill">typed per gram</span>';
    return `<div class="item"><div class="info"><b>${taka(bhori)} <span class="pill">22K</span></b>
      <span>${esc(r.effective)} &middot; ${taka(bhori / BHORI)} per gram ${unitPill}</span></div>
      <div class="ops"><button class="btn danger sm" data-delrate="${r.id}">Delete</button></div></div>`;
  }).join("") : '<p class="hint" style="margin:0">No rates published yet.</p>';
}
$("saveRate").addEventListener("click", async () => {
  const b = $("saveRate"); b.disabled = true;
  const row = {
    effective: $("r_eff").value.trim() || defaultEffective(),
    k22: parseFloat($("r_k22").value), k21: parseFloat($("r_k21").value),
    trad: parseFloat($("r_trad").value),
    silver: $("r_silver").value === "" ? null : parseFloat($("r_silver").value),
    unit: "gram"          // these boxes are per gram; say so on the row itself
  };
  if (["k22", "k21", "trad"].some(k => !isFinite(row[k]))) {
    b.disabled = false;
    return msg($("rateMsg"), "Fill in 22 carat, 21 carat and traditional.", "err");
  }
  const { error } = await SB.from("rates").insert(row);
  b.disabled = false;
  if (error) return saveError($("rateMsg"), error);
  msg($("rateMsg"), "Published. The website is updated.");
  RATE_KEYS.forEach(k => { const el = $("r_" + k); if (el) el.value = ""; });
  loadRates();
});
/* ---- which unit the WEBSITE SHOWS (settings.rate_unit) ----
   Not to be confused with rates.unit above, which records the unit the owner
   TYPED for one row. This one is display only and changes nothing stored. */
function drawUnitPreview() {
  const u = $("s_rateunit").value || "gram";
  /* Preview off the newest published rate, or off whatever is typed in the
     boxes above. Never off invented numbers. */
  const newest = (window.__rates || [])[0];
  let perGram = null;
  if (newest && newest.k22 != null) {
    perGram = rateUnit(newest) === "bhori" ? Number(newest.k22) / BHORI : Number(newest.k22);
  } else {
    const typed = parseFloat($("r_k22").value);
    if (isFinite(typed) && typed > 0) perGram = typed;
  }
  if (perGram == null) {
    $("unitPreview").innerHTML =
      '<p class="none">Publish a rate, or type one in the boxes above, ' +
      'and the preview will appear here.</p>';
    return;
  }
  const perBhori = perGram * BHORI;
  const head = u === "bhori" ? perBhori : perGram;
  const headLabel = u === "bhori" ? "per bhori" : "per gram";
  const sub = u === "both" ? `<span class="g">per bhori &middot; ${taka(perBhori)}</span>` : "";
  $("unitPreview").innerHTML =
    `<p class="k">22 Carat</p><p class="v">${taka(head)}</p>` +
    `<p class="u">${headLabel}</p>${sub}`;
}
["s_rateunit", "r_k22"].forEach(id =>
  $(id) && $(id).addEventListener("input", drawUnitPreview));
$("s_rateunit").addEventListener("change", drawUnitPreview);

$("saveRateUnit").addEventListener("click", async () => {
  const b = $("saveRateUnit"); b.disabled = true;
  const { error } = await SB.from("settings")
    .upsert({ id: 1, rate_unit: $("s_rateunit").value, updated_at: new Date().toISOString() });
  b.disabled = false;
  if (error) return saveError($("rateUnitMsg"), error);
  SETTINGS.rate_unit = $("s_rateunit").value;
  msg($("rateUnitMsg"), "Saved. The website shows prices that way now.");
});

$("rateList").addEventListener("click", async e => {
  const b = e.target.closest("[data-delrate]"); if (!b) return;
  if (!confirm("Delete this rate from the history?")) return;
  const { error } = await SB.from("rates").delete().eq("id", b.dataset.delrate);
  if (error) return msg($("rateMsg"), esc(error.message), "err");
  loadRates();
});

/* ===================== products ===================== */
/* Shrink an upload onto a canvas and hand back the JPEG — TOGETHER WITH the
   size it was drawn at. The shape of the picture is known for certain right
   here and nowhere else afterwards, so it is returned rather than thrown
   away: the website stores it and uses it to reserve the right amount of
   space before the photograph has downloaded, which is what stops the page
   jumping about on a slow phone. w and h are the saved pixels, not the
   camera's original ones. */
async function compress(file, max = 1200, quality = 0.82) {
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const w = Math.round(bmp.width * scale), h = Math.round(bmp.height * scale);
  const cv = document.createElement("canvas"); cv.width = w; cv.height = h;
  cv.getContext("2d").drawImage(bmp, 0, 0, w, h);
  const blob = await new Promise(r => cv.toBlob(r, "image/jpeg", quality));
  return { blob, w, h };
}
function clearItemForm() {
  ["i_id","i_name","i_name_bn","i_cat","i_cat_bn","i_blurb","i_blurb_bn",
   "i_weight","i_price","i_tag"].forEach(id => $(id).value = "");
  $("i_karat").value = "";
  ["i_req","i_sold","i_featured"].forEach(id => $(id).checked = false);
  $("i_photo").value = "";
  $("itemFormTitle").textContent = "Add a piece";
}
$("cancelItem").addEventListener("click", clearItemForm);

async function loadItems() {
  const { data, error } = await SB.from("products").select("*")
    .order("sort", { ascending: true }).order("created_at", { ascending: false });
  if (error) return msg($("itemMsg"), esc(error.message), "err");
  const rows = data || [];
  window.__items = rows;
  $("itemList").innerHTML = rows.length ? rows.map(p =>
    `<div class="item">
      ${p.photo_url ? `<img class="ph" src="${esc(p.photo_url)}" alt="">` : '<div class="ph"></div>'}
      <div class="info"><b>${esc(p.name)}${p.featured ? '<span class="pill">Featured</span>' : ""}${p.sold ? '<span class="pill">Sold</span>' : ""}</b>
        <span>${esc(p.category || "")}${p.karat ? " \u00B7 " + esc(p.karat) : ""}${
          p.price_on_request || p.price == null ? " \u00B7 ask for price" : " \u00B7 " + taka(p.price)}</span></div>
      <div class="ops">
        <button class="btn line sm" data-edit="${p.id}">Edit</button>
        <button class="btn danger sm" data-del="${p.id}">Delete</button></div>
    </div>`).join("") : '<p class="hint" style="margin:0">Nothing added yet.</p>';
}

$("saveItem").addEventListener("click", async () => {
  const b = $("saveItem"); b.disabled = true; b.textContent = "Saving\u2026";
  try {
    const name = $("i_name").value.trim();
    if (!name) throw new Error("Give the piece a name.");
    const row = {
      name,
      name_bn: $("i_name_bn").value.trim() || null,
      category: $("i_cat").value.trim() || null,
      category_bn: $("i_cat_bn").value.trim() || null,
      blurb: $("i_blurb").value.trim() || null,
      blurb_bn: $("i_blurb_bn").value.trim() || null,
      karat: $("i_karat").value || null,
      weight_bhori: $("i_weight").value === "" ? null : parseFloat($("i_weight").value),
      price: $("i_price").value === "" ? null : parseFloat($("i_price").value),
      price_on_request: $("i_req").checked,
      tag: $("i_tag").value.trim() || null,
      featured: $("i_featured").checked,
      sold: $("i_sold").checked
    };
    const file = $("i_photo").files[0];
    if (file) {
      const { blob, w, h } = await compress(file);
      const path = `products/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;
      const up = await SB.storage.from("photos").upload(path, blob, { contentType: "image/jpeg" });
      if (up.error) throw up.error;
      row.photo_path = path;
      row.photo_url = SB.storage.from("photos").getPublicUrl(path).data.publicUrl;
      /* saved with the picture, so the website can hold its shape open
         before the picture itself has come down the wire */
      row.photo_w = w;
      row.photo_h = h;
    }
    const id = $("i_id").value;
    // only one featured piece at a time
    if (row.featured) await SB.from("products").update({ featured: false }).neq("id", id || -1);
    const put = r => id ? SB.from("products").update(r).eq("id", id)
                        : SB.from("products").insert(r);
    let res = await put(row);

    /* The website files can reach the server before patch4.sql has been run,
       and then photo_w / photo_h do not exist in the database yet. Losing
       everything the owner just typed over that would be absurd, so the piece
       is saved again without those two columns and the shortfall is explained
       rather than shown as a raw error. Nothing else is ever retried. */
    let noShape = false;
    if (res.error && missingColumn(res.error) && /photo_[wh]/.test(String(res.error.message || ""))) {
      delete row.photo_w; delete row.photo_h;
      res = await put(row);
      noShape = !res.error;
    }
    if (res.error) throw res.error;

    if (noShape) msg($("itemMsg"),
      "<b>Saved — but not the shape of the photograph.</b><br>" +
      "Open Supabase &rarr; SQL Editor, paste in the file <b>patch4.sql</b> from your website " +
      "folder and press Run. Then edit this piece and choose its photograph again, and it will " +
      "keep its own proportions instead of being cropped square.", "err");
    else msg($("itemMsg"), id ? "Saved." : "Added to the collection.");
    clearItemForm(); loadItems();
  } catch (err) {
    msg($("itemMsg"), esc(err.message || String(err)), "err");
  } finally { b.disabled = false; b.textContent = "Save piece"; }
});

$("itemList").addEventListener("click", async e => {
  const ed = e.target.closest("[data-edit]"), dl = e.target.closest("[data-del]");
  if (ed) {
    const p = (window.__items || []).find(x => String(x.id) === ed.dataset.edit); if (!p) return;
    $("i_id").value = p.id; $("i_name").value = p.name || "";
    $("i_name_bn").value = p.name_bn || ""; $("i_cat").value = p.category || "";
    $("i_cat_bn").value = p.category_bn || ""; $("i_karat").value = p.karat || "";
    $("i_blurb").value = p.blurb || ""; $("i_blurb_bn").value = p.blurb_bn || "";
    $("i_weight").value = p.weight_bhori ?? ""; $("i_price").value = p.price ?? "";
    $("i_tag").value = p.tag || ""; $("i_req").checked = !!p.price_on_request;
    $("i_featured").checked = !!p.featured; $("i_sold").checked = !!p.sold;
    $("i_photo").value = "";
    $("itemFormTitle").textContent = "Edit piece";
    scrollTo({ top: 0, behavior: "smooth" });
  }
  if (dl) {
    if (!confirm("Delete this piece?")) return;
    const p = (window.__items || []).find(x => String(x.id) === dl.dataset.del);
    const { error } = await SB.from("products").delete().eq("id", dl.dataset.del);
    if (error) return msg($("itemMsg"), esc(error.message), "err");
    if (p?.photo_path) await SB.storage.from("photos").remove([p.photo_path]).catch(() => {});
    loadItems();
  }
});

/* ===================== shop settings ===================== */
const F = {
  s_hero:"hero_title", s_hero_bn:"hero_title_bn", s_herotext:"hero_text", s_herotext_bn:"hero_text_bn",
  s_banner:"banner_text", s_banner_bn:"banner_text_bn", s_name:"shop_name", s_tagline:"tagline",
  s_addr:"address", s_addr_bn:"address_bn", s_hours:"hours", s_hours_bn:"hours_bn",
  s_closed:"closed_day", s_closed_bn:"closed_day_bn",
  s_p1:"phone1", s_p2:"phone2", s_wa:"whatsapp", s_email:"email",
  s_prop:"proprietor", s_prop_bn:"proprietor_bn",
  s_fbpage:"facebook_page", s_fbprofile:"facebook_profile"
};
const C = { s_banner_on:"banner_on", s_hall:"show_hallmark", s_slip:"show_slip",
            s_exch:"show_exchange", s_rep:"show_repair", s_bajus:"bajus_member" };

let SETTINGS = {};
async function loadShop() {
  const { data, error } = await SB.from("settings").select("*").eq("id", 1).maybeSingle();
  if (error) return msg($("shopMsg"), esc(error.message), "err");
  SETTINGS = data || {};
  Object.entries(F).forEach(([el, col]) => { $(el).value = SETTINGS[col] ?? ""; });
  Object.entries(C).forEach(([el, col]) => { $(el).checked = !!SETTINGS[col]; });
  /* display unit lives on the Gold rate tab, but it is a settings column */
  $("s_rateunit").value =
    ["gram", "bhori", "both"].includes(SETTINGS.rate_unit) ? SETTINGS.rate_unit : "gram";
  drawUnitPreview();
  fillLook(SETTINGS);
  fillFx(SETTINGS);
}
$("saveShop").addEventListener("click", async () => {
  const b = $("saveShop"); b.disabled = true;
  const row = { id: 1, updated_at: new Date().toISOString() };
  Object.entries(F).forEach(([el, col]) => { row[col] = $(el).value.trim() || null; });
  Object.entries(C).forEach(([el, col]) => { row[col] = $(el).checked; });
  const { error } = await SB.from("settings").upsert(row);
  b.disabled = false;
  if (error) return saveError($("shopMsg"), error);
  Object.assign(SETTINGS, row);
  msg($("shopMsg"), "Saved. The website is updated.");
});

/* ===================== look ===================== */
let LOOK = {};

function fillLook(sv) {
  LOOK = {
    logo_key: sv.logo_key || DEFAULTS.logo_key,
    logo_custom: sv.logo_custom || null,
    layout: sv.layout || DEFAULTS.layout,
    style_language: sv.style_language || DEFAULTS.style_language,
    festival: sv.festival || "none",
    theme_default: sv.theme_default || DEFAULTS.theme_default,
    theme_toggle: sv.theme_toggle !== false,
    theme_accent_override: sv.theme_accent_override || null
  };
  $("c_fest").innerHTML = Object.entries(FESTIVALS)
    .map(([k, v]) => `<option value="${k}">${esc(v.n)}</option>`).join("");
  $("c_fest").value = LOOK.festival;
  $("c_default").value = LOOK.theme_default;
  $("c_toggle").checked = LOOK.theme_toggle;
  $("c_accent_t").value = LOOK.theme_accent_override || "";
  $("c_accent").value = LOOK.theme_accent_override || "#d4af63";
  drawLogoGrid(); drawPickers(); paintSwatch();
}

function drawLogoGrid() {
  const M = window.MARKS || {};
  const keys = Object.keys(M).filter(k => !k.startsWith("_"));
  $("logoGrid").innerHTML = keys.map(k =>
    `<button class="logbtn" type="button" data-logo="${esc(k)}"
      aria-pressed="${!LOOK.logo_custom && LOOK.logo_key === k}">
      ${M[k].s}<span>${esc(M[k].n)}</span></button>`).join("")
    + (LOOK.logo_custom ? `<button class="logbtn" type="button" data-logo="__custom"
        aria-pressed="true">${LOOK.logo_custom}<span>Your upload</span></button>` : "");
}

function drawPickers() {
  $("layoutGrid").innerHTML = LAYOUTS.map(l =>
    `<button class="pickbtn" type="button" data-layout="${l.k}" aria-pressed="${LOOK.layout === l.k}">
      <b>${esc(l.n)}</b><span>${esc(l.d)}</span></button>`).join("");
  $("langGrid").innerHTML = LANGUAGES.map(l =>
    `<button class="pickbtn" type="button" data-lang="${l.k}" aria-pressed="${LOOK.style_language === l.k}">
      <b>${esc(l.n)}</b><span>${esc(l.d)}</span></button>`).join("");
}

function paintSwatch() {
  const src = Object.assign({}, LOOK);
  const html = ["night", "ivory"].map(m => {
    const v = buildTheme(src, m);
    return `<div class="sw" style="margin-bottom:10px;background:${v["--bg"]};border-color:${v["--line"]}">
      <div class="swtop">
        <div style="color:${v["--accent"]};width:34px">${logoSVG(src)}</div>
        <p class="t" style="color:${v["--text"]};margin-top:8px">Monoram Jewellers</p>
        <p class="s" style="color:${v["--mute"]}">${m === "night" ? "Night" : "Ivory"} &middot; 22 Carat
          <span style="color:${v["--accent-soft"]}">\u09F32,20,858</span></p>
        <span class="pill" style="background:${v["--accent-tint"]};color:${v["--accent"]};
          border:1px solid ${v["--accent-line"]}">BAJUS member</span>
      </div>
      <div class="swbtns">
        <div class="swb" style="background:${v["--btn-bg"]};color:${v["--btn-text"]}">Call the shop</div>
        <div class="swb" style="border:1px solid ${v["--accent-line"]};color:${v["--accent"]}">WhatsApp</div>
      </div></div>`;
  }).join("");
  $("swatch").innerHTML = html;

  const warn = [];
  ["night", "ivory"].forEach(m => {
    const v = buildTheme(LOOK, m);
    if (contrast(v["--bg"], v["--accent"]) < 3)
      warn.push(`The accent is hard to see on the ${m} background.`);
  });
  $("contrastWarn").innerHTML = warn.length
    ? `<div class="msg err">${warn.map(esc).join("<br>")}</div>` : "";
}

$("logoGrid").addEventListener("click", e => {
  const b = e.target.closest("[data-logo]"); if (!b) return;
  if (b.dataset.logo !== "__custom") { LOOK.logo_key = b.dataset.logo; LOOK.logo_custom = null; }
  drawLogoGrid(); paintSwatch();
});
$("layoutGrid").addEventListener("click", e => {
  const b = e.target.closest("[data-layout]"); if (!b) return;
  LOOK.layout = b.dataset.layout; drawPickers();
});
$("langGrid").addEventListener("click", e => {
  const b = e.target.closest("[data-lang]"); if (!b) return;
  LOOK.style_language = b.dataset.lang; drawPickers();
});
$("c_fest").addEventListener("change", () => { LOOK.festival = $("c_fest").value; paintSwatch(); });
$("c_default").addEventListener("change", () => { LOOK.theme_default = $("c_default").value; });
$("c_toggle").addEventListener("change", () => { LOOK.theme_toggle = $("c_toggle").checked; });
$("c_accent").addEventListener("input", () => {
  $("c_accent_t").value = $("c_accent").value;
  LOOK.theme_accent_override = $("c_accent").value; paintSwatch();
});
$("c_accent_t").addEventListener("input", () => {
  const v = $("c_accent_t").value.trim();
  LOOK.theme_accent_override = v === "" ? null : (hexToRgb(v) ? v : LOOK.theme_accent_override);
  if (hexToRgb(v)) $("c_accent").value = v;
  paintSwatch();
});

$("logoFile").addEventListener("change", async e => {
  const f = e.target.files[0]; if (!f) return;
  if (f.size > 200000) return msg($("logoMsg"), "That SVG is too big. Keep it under 200 KB.", "err");
  const txt = await f.text();
  if (!/<svg[\s>]/i.test(txt)) return msg($("logoMsg"), "That file is not an SVG.", "err");
  if (/<script|onload=|onerror=/i.test(txt))
    return msg($("logoMsg"), "That SVG contains a script, so it cannot be used.", "err");
  let clean = txt.replace(/<\?xml[^>]*\?>/gi, "").replace(/<!DOCTYPE[^>]*>/gi, "").trim();
  clean = clean.replace(/(fill|stroke)="(?!none)[^"]*"/gi, '$1="currentColor"');
  LOOK.logo_custom = clean;
  drawLogoGrid(); paintSwatch();
  msg($("logoMsg"), "Loaded. Press Save look to use it.");
});
$("clearLogo").addEventListener("click", () => {
  LOOK.logo_custom = null; $("logoFile").value = "";
  drawLogoGrid(); paintSwatch();
});

$("saveLook").addEventListener("click", async () => {
  const b = $("saveLook"); b.disabled = true;
  const row = Object.assign({ id: 1, updated_at: new Date().toISOString() }, LOOK);
  const { error } = await SB.from("settings").upsert(row);
  b.disabled = false;
  if (error) return saveError($("lookMsg"), error);
  Object.assign(SETTINGS, row);
  msg($("lookMsg"), "Saved. The website looks like this now.");
});
$("resetLook").addEventListener("click", () => {
  fillLook({}); msg($("lookMsg"), "Back to the original. Press Save look to apply.");
});


/* ===================== background effects ===================== */
const FXBOOL = { x_on:"fx_on", x_twinkle:"fx_twinkle", x_drift:"fx_drift", x_glow:"fx_glow",
  x_shooting:"fx_shooting", x_web:"fx_web", x_grain:"fx_grain",
  x_adminlink:"show_admin_link" };

function fillFx(sv) {
  Object.entries(FXBOOL).forEach(([el, col]) => { $(el).checked = sv[col] !== false; });
  $("x_density").value = sv.fx_density || "normal";
}
$("saveFx").addEventListener("click", async () => {
  const b = $("saveFx"); b.disabled = true;
  const row = { id: 1, updated_at: new Date().toISOString(), fx_density: $("x_density").value };
  Object.entries(FXBOOL).forEach(([el, col]) => { row[col] = $(el).checked; });
  const { error } = await SB.from("settings").upsert(row);
  b.disabled = false;
  if (error) return saveError($("fxMsg"), error);
  Object.assign(SETTINGS, row);
  msg($("fxMsg"), "Saved. The website is updated.");
});

/* ===================== festival cards ===================== */
function clearFestForm() {
  ["f_id","f_name","f_title","f_title_bn","f_text","f_text_bn","f_cta","f_cta_bn","f_ends"]
    .forEach(id => $(id).value = "");
  $("f_key").value = "none";
  ["f_hastext","f_active"].forEach(id => $(id).checked = false);
  $("f_image").value = "";
  $("festFormTitle").textContent = "Add a festival card";
}
$("cancelFest").addEventListener("click", clearFestForm);

async function loadFests() {
  if (!$("f_key").options.length) {
    $("f_key").innerHTML = Object.entries(FESTIVALS)
      .map(([k, v]) => `<option value="${k}">${esc(v.n)}</option>`).join("");
  }
  const { data, error } = await SB.from("festivals").select("*")
    .order("created_at", { ascending: false });
  if (error) return msg($("festMsg"), esc(error.message), "err");
  const rows = data || [];
  window.__fests = rows;
  const today = new Date().toISOString().slice(0, 10);
  $("festList").innerHTML = rows.length ? rows.map(f => {
    const expired = f.ends_on && f.ends_on < today;
    const live = f.active && !expired;
    return `<div class="item">
      ${f.image_url ? `<img class="ph" src="${esc(f.image_url)}" alt="">` : '<div class="ph"></div>'}
      <div class="info"><b>${esc(f.name)}${live ? '<span class="pill">Showing now</span>' : ""}${
        expired ? '<span class="pill">Finished</span>' : ""}</b>
        <span>${esc(f.title || "")}${f.ends_on ? " \u00B7 until " + esc(f.ends_on) : " \u00B7 no end date"}</span></div>
      <div class="ops">
        <button class="btn line sm" data-fedit="${f.id}">Edit</button>
        <button class="btn danger sm" data-fdel="${f.id}">Delete</button></div>
    </div>`;
  }).join("") : '<p class="hint" style="margin:0">No festival cards yet.</p>';
}

$("saveFest").addEventListener("click", async () => {
  const b = $("saveFest"); b.disabled = true; b.textContent = "Saving\u2026";
  try {
    const name = $("f_name").value.trim();
    if (!name) throw new Error("Give this card a name so you can find it later.");
    const row = {
      name,
      festival_key: $("f_key").value || "none",
      title: $("f_title").value.trim() || null,
      title_bn: $("f_title_bn").value.trim() || null,
      text: $("f_text").value.trim() || null,
      text_bn: $("f_text_bn").value.trim() || null,
      cta_text: $("f_cta").value.trim() || null,
      cta_text_bn: $("f_cta_bn").value.trim() || null,
      cta_link: "#collection",
      image_has_text: $("f_hastext").checked,
      active: $("f_active").checked,
      ends_on: $("f_ends").value || null
    };
    if (row.image_has_text && !$("f_image").files[0] && !$("f_id").value)
      throw new Error("That option needs a picture, because the words are inside it.");
    const file = $("f_image").files[0];
    if (file) {
      const { blob } = await compress(file, 1600, 0.85);   // the festival card crops to a band; its shape is not stored
      const path = `festivals/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;
      const up = await SB.storage.from("photos").upload(path, blob, { contentType: "image/jpeg" });
      if (up.error) throw up.error;
      row.image_path = path;
      row.image_url = SB.storage.from("photos").getPublicUrl(path).data.publicUrl;
    }
    const id = $("f_id").value;
    if (row.active) await SB.from("festivals").update({ active: false }).neq("id", id || -1);
    const res = id ? await SB.from("festivals").update(row).eq("id", id)
                   : await SB.from("festivals").insert(row);
    if (res.error) throw res.error;
    msg($("festMsg"), id ? "Saved." : "Festival card added.");
    clearFestForm(); loadFests();
  } catch (err) {
    msg($("festMsg"), esc(err.message || String(err)), "err");
  } finally { b.disabled = false; b.textContent = "Save festival card"; }
});

$("festList").addEventListener("click", async e => {
  const ed = e.target.closest("[data-fedit]"), dl = e.target.closest("[data-fdel]");
  if (ed) {
    const f = (window.__fests || []).find(x => String(x.id) === ed.dataset.fedit); if (!f) return;
    $("f_id").value = f.id; $("f_name").value = f.name || "";
    $("f_key").value = f.festival_key || "none";
    $("f_title").value = f.title || ""; $("f_title_bn").value = f.title_bn || "";
    $("f_text").value = f.text || ""; $("f_text_bn").value = f.text_bn || "";
    $("f_cta").value = f.cta_text || ""; $("f_cta_bn").value = f.cta_text_bn || "";
    $("f_ends").value = f.ends_on || "";
    $("f_hastext").checked = !!f.image_has_text; $("f_active").checked = !!f.active;
    $("f_image").value = "";
    $("festFormTitle").textContent = "Edit festival card";
    scrollTo({ top: 0, behavior: "smooth" });
  }
  if (dl) {
    if (!confirm("Delete this festival card?")) return;
    const f = (window.__fests || []).find(x => String(x.id) === dl.dataset.fdel);
    const { error } = await SB.from("festivals").delete().eq("id", dl.dataset.fdel);
    if (error) return msg($("festMsg"), esc(error.message), "err");
    if (f && f.image_path) await SB.storage.from("photos").remove([f.image_path]).catch(() => {});
    loadFests();
  }
});

/* ===================== stats ===================== */
async function loadStats() {
  const since = d => new Date(Date.now() - d * 864e5).toISOString();
  const dayStart = new Date(); dayStart.setHours(0, 0, 0, 0);
  const [today, week, total, prod, recent] = await Promise.all([
    SB.from("views").select("id", { count: "exact", head: true })
      .eq("kind", "page").gte("created_at", dayStart.toISOString()),
    SB.from("views").select("id", { count: "exact", head: true })
      .eq("kind", "page").gte("created_at", since(7)),
    SB.from("views").select("id", { count: "exact", head: true }).eq("kind", "page"),
    SB.from("views").select("id", { count: "exact", head: true }).eq("kind", "product"),
    SB.from("views").select("product_id").eq("kind", "product").limit(2000)
  ]);
  $("v_today").textContent = today.count ?? 0;
  $("v_week").textContent  = week.count ?? 0;
  $("v_total").textContent = total.count ?? 0;
  $("v_prod").textContent  = prod.count ?? 0;

  const tally = {};
  (recent.data || []).forEach(r => { if (r.product_id) tally[r.product_id] = (tally[r.product_id] || 0) + 1; });
  const items = window.__items || [];
  const top = Object.entries(tally).sort((a, b) => b[1] - a[1]).slice(0, 8);
  $("topList").innerHTML = top.length ? top.map(([id, n]) => {
    const p = items.find(x => String(x.id) === String(id));
    return `<div class="item"><div class="info"><b>${esc(p ? p.name : "#" + id)}</b>
      <span>${n} tap${n === 1 ? "" : "s"}</span></div></div>`;
  }).join("") : '<p class="hint" style="margin:0">No taps recorded yet.</p>';
}

boot();
