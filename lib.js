/* Shared: database client, language, formatting.
   The Supabase library is fetched at run time, never as a static import, so a
   slow or blocked CDN cannot stop the page from rendering. */

export const CFG = window.CONFIG || {};
export const configured = !!(CFG.SUPABASE_URL && CFG.SUPABASE_KEY);

let _sb = null;
export async function db() {
  if (!configured) return null;
  if (_sb) return _sb;
  const { createClient } = await import("https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm");
  _sb = createClient(CFG.SUPABASE_URL, CFG.SUPABASE_KEY);
  return _sb;
}

export const BHORI = 11.664, ANA = BHORI/16, RATTI = BHORI/96;

const BN = ["\u09E6","\u09E7","\u09E8","\u09E9","\u09EA","\u09EB","\u09EC","\u09ED","\u09EE","\u09EF"];
export const toBn = s => String(s).replace(/[0-9]/g, d => BN[+d]);
export let lang = localStorage.getItem("mj_lang") === "bn" ? "bn" : "en";
export const setLang = l => { lang = l; localStorage.setItem("mj_lang", l); };

const D = {
  jewellers:["Jewellers","\u099C\u09C1\u09AF\u09BC\u09C7\u09B2\u09BE\u09B0\u09CD\u09B8"],
  on_counter:["On the counter","\u09A6\u09CB\u0995\u09BE\u09A8\u09C7 \u09AF\u09BE \u0986\u099B\u09C7"],
  collection:["The collection","\u0986\u09AE\u09BE\u09A6\u09C7\u09B0 \u09B8\u0982\u0997\u09CD\u09B0\u09B9"],
  featured:["Featured","\u09A8\u09BF\u09B0\u09CD\u09AC\u09BE\u099A\u09BF\u09A4"],
  carat:["Carat","\u0995\u09CD\u09AF\u09BE\u09B0\u09C7\u099F"],
  weight:["Weight","\u0993\u099C\u09A8"],
  in_grams:["In grams","\u0997\u09CD\u09B0\u09BE\u09AE\u09C7"],
  price:["Price","\u09A6\u09BE\u09AE"],
  enquire:["Enquire","\u09AF\u09CB\u0997\u09BE\u09AF\u09CB\u0997"],
  enquire_p:["Enquire about this piece","\u098F\u0987 \u0997\u09B9\u09A8\u09BE \u09B8\u09AE\u09CD\u09AA\u09B0\u09CD\u0995\u09C7 \u099C\u09BE\u09A8\u09A4\u09C7 \u099A\u09BE\u0987"],
  ask_price:["Ask for price","\u09A6\u09BE\u09AE \u099C\u09BE\u09A8\u09A4\u09C7 \u09AF\u09CB\u0997\u09BE\u09AF\u09CB\u0997 \u0995\u09B0\u09C1\u09A8"],
  sold:["Sold","\u09AC\u09BF\u0995\u09CD\u09B0\u09BF \u09B9\u09AF\u09BC\u09C7 \u0997\u09C7\u099B\u09C7"],
  all:["All","\u09B8\u09AC"],
  no_items:["No pieces have been added yet.","\u098F\u0996\u09A8\u09CB \u0995\u09CB\u09A8\u09CB \u0997\u09B9\u09A8\u09BE \u09AF\u09CB\u0997 \u0995\u09B0\u09BE \u09B9\u09AF\u09BC\u09A8\u09BF\u0964"],
  photo:["Photograph","\u099B\u09AC\u09BF"],
  cat_note:["Prices are set by the shop and include the making charge where shown. Anything marked \u201Cask for price\u201D depends on the design. Weights are confirmed on the scale in front of you.","\u09A6\u09BE\u09AE \u09A6\u09CB\u0995\u09BE\u09A8 \u09A5\u09C7\u0995\u09C7 \u09A0\u09BF\u0995 \u0995\u09B0\u09BE\u0964 \u0993\u099C\u09A8 \u0986\u09AA\u09A8\u09BE\u09B0 \u09B8\u09BE\u09AE\u09A8\u09C7 \u09AE\u09C7\u09B6\u09BF\u09A8\u09C7 \u09A6\u09C7\u0996\u09BE\u09A8\u09CB \u09B9\u09AF\u09BC\u0964"],
  rate_today:["Today's rate","\u0986\u099C\u0995\u09C7\u09B0 \u09A6\u09BE\u09AE"],
  effective:["Effective","\u0995\u09BE\u09B0\u09CD\u09AF\u0995\u09B0"],
  per_bhori:["per bhori","\u09AA\u09CD\u09B0\u09A4\u09BF \u09AD\u09B0\u09BF"],
  per_gram:["per gram","\u09AA\u09CD\u09B0\u09A4\u09BF \u0997\u09CD\u09B0\u09BE\u09AE"],
  no_rate:["Today's rate has not been published yet.","\u0986\u099C\u0995\u09C7\u09B0 \u09A6\u09BE\u09AE \u098F\u0996\u09A8\u09CB \u09A6\u09C7\u0993\u09AF\u09BC\u09BE \u09B9\u09AF\u09BC\u09A8\u09BF\u0964"],
  metal_only:["Metal rate only. Making charge and VAT are added on top and depend on the design.","\u098F\u099F\u09BF \u09B6\u09C1\u09A7\u09C1 \u09B8\u09CB\u09A8\u09BE\u09B0 \u09A6\u09BE\u09AE\u0964 \u09AE\u099C\u09C1\u09B0\u09BF \u0993 \u09AD\u09CD\u09AF\u09BE\u099F \u0986\u09B2\u09BE\u09A6\u09BE\u0964"],
  step_note:["The rate holds steady until BAJUS announces a change, so the line steps rather than curves.","\u09AC\u09BE\u099C\u09C1\u09B8 \u09A8\u09A4\u09C1\u09A8 \u09A6\u09BE\u09AE \u09A8\u09BE \u09A6\u09C7\u0993\u09AF\u09BC\u09BE \u09AA\u09B0\u09CD\u09AF\u09A8\u09CD\u09A4 \u09A6\u09BE\u09AE \u098F\u0995\u0987 \u09A5\u09BE\u0995\u09C7\u0964"],
  share_rate:["Save today's rate as a picture","\u0986\u099C\u0995\u09C7\u09B0 \u09A6\u09BE\u09AE \u099B\u09AC\u09BF \u09B9\u09BF\u09B8\u09C7\u09AC\u09C7 \u09B8\u09C7\u09AD \u0995\u09B0\u09C1\u09A8"],
  tools:["Work out a price","\u09A6\u09BE\u09AE \u09B9\u09BF\u09B8\u09BE\u09AC \u0995\u09B0\u09C1\u09A8"],
  calc:["Price estimate","\u09A6\u09BE\u09AE\u09C7\u09B0 \u0985\u09A8\u09C1\u09AE\u09BE\u09A8"],
  calc_note:["An estimate only, at today's announced rate. The real price varies with the design, the making charge, VAT and any stones. Please confirm at the counter.","\u098F\u099F\u09BF \u09B6\u09C1\u09A7\u09C1 \u0985\u09A8\u09C1\u09AE\u09BE\u09A8\u0964 \u09A1\u09BF\u099C\u09BE\u0987\u09A8, \u09AE\u099C\u09C1\u09B0\u09BF, \u09AD\u09CD\u09AF\u09BE\u099F \u0993 \u09AA\u09BE\u09A5\u09B0 \u0985\u09A8\u09C1\u09AF\u09BE\u09AF\u09BC\u09C0 \u0986\u09B8\u09B2 \u09A6\u09BE\u09AE \u0986\u09B2\u09BE\u09A6\u09BE \u09B9\u09A4\u09C7 \u09AA\u09BE\u09B0\u09C7\u0964"],
  exch_calc:["Old gold exchange","\u09AA\u09C1\u09B0\u09BE\u09A4\u09A8 \u09B8\u09CB\u09A8\u09BE \u09AC\u09A6\u09B2"],
  exch_note:["An estimate of what old gold is worth toward a new piece. Old ornaments are weighed and tested in the shop, and a deduction may apply for solder and stones.","\u09AA\u09C1\u09B0\u09BE\u09A4\u09A8 \u09B8\u09CB\u09A8\u09BE\u09B0 \u0985\u09A8\u09C1\u09AE\u09BE\u09A8\u09BF\u0995 \u09AE\u09C2\u09B2\u09CD\u09AF\u0964 \u09A6\u09CB\u0995\u09BE\u09A8\u09C7 \u0993\u099C\u09A8 \u0993 \u09AA\u09B0\u09C0\u0995\u09CD\u09B7\u09BE \u0995\u09B0\u09C7 \u099A\u09C2\u09A1\u09BC\u09BE\u09A8\u09CD\u09A4 \u09A6\u09BE\u09AE \u09A0\u09BF\u0995 \u09B9\u09AC\u09C7\u0964"],
  old_weight:["Weight of old gold","\u09AA\u09C1\u09B0\u09BE\u09A4\u09A8 \u09B8\u09CB\u09A8\u09BE\u09B0 \u0993\u099C\u09A8"],
  worth:["Worth toward a new piece","\u09A8\u09A4\u09C1\u09A8 \u0997\u09B9\u09A8\u09BE\u09AF\u09BC \u09AE\u09C2\u09B2\u09CD\u09AF"],
  grade:["Grade","\u0995\u09CD\u09AF\u09BE\u09B0\u09C7\u099F"],
  making:["Making charge %","\u09AE\u099C\u09C1\u09B0\u09BF %"],
  metal_value:["Metal value","\u09B8\u09CB\u09A8\u09BE\u09B0 \u09AE\u09C2\u09B2\u09CD\u09AF"],
  estimate:["Estimate","\u0985\u09A8\u09C1\u09AE\u09BE\u09A8\u09BF\u0995"],
  why_here:["Why buy here","\u0995\u09C7\u09A8 \u0986\u09AE\u09BE\u09A6\u09C7\u09B0 \u0995\u09BE\u099B\u09C7 \u0995\u09BF\u09A8\u09AC\u09C7\u09A8"],
  hallmark:["Hallmarked","\u09B9\u09B2\u09AE\u09BE\u09B0\u09CD\u0995 \u0995\u09B0\u09BE"],
  hallmark_d:["Carat stamped and verifiable.","\u09AA\u09CD\u09B0\u09A4\u09BF\u099F\u09BF \u0997\u09B9\u09A8\u09BE\u09AF\u09BC \u0995\u09CD\u09AF\u09BE\u09B0\u09C7\u099F \u09B8\u09CD\u099F\u09CD\u09AF\u09BE\u09AE\u09CD\u09AA \u0995\u09B0\u09BE\u0964"],
  slip:["Written slip","\u09B2\u09BF\u0996\u09BF\u09A4 \u09B0\u09B8\u09BF\u09A6"],
  slip_d:["Weight, carat and making charge on paper.","\u0993\u099C\u09A8, \u0995\u09CD\u09AF\u09BE\u09B0\u09C7\u099F \u0993 \u09AE\u099C\u09C1\u09B0\u09BF \u09B2\u09BF\u0996\u09C7 \u09A6\u09C7\u0993\u09AF\u09BC\u09BE \u09B9\u09AF\u09BC\u0964"],
  exch:["Exchange","\u09AA\u09C1\u09B0\u09BE\u09A4\u09A8 \u09B8\u09CB\u09A8\u09BE \u09AC\u09A6\u09B2"],
  exch_d:["Old gold weighed in front of you.","\u09AA\u09C1\u09B0\u09BE\u09A4\u09A8 \u09B8\u09CB\u09A8\u09BE \u0986\u09AA\u09A8\u09BE\u09B0 \u09B8\u09BE\u09AE\u09A8\u09C7 \u0993\u099C\u09A8 \u0995\u09B0\u09BE \u09B9\u09AF\u09BC\u0964"],
  repair:["Repair","\u09AE\u09C7\u09B0\u09BE\u09AE\u09A4 \u0993 \u09AA\u09B2\u09BF\u09B6"],
  repair_d:["Polishing, resizing, chain repair.","\u09AA\u09B2\u09BF\u09B6, \u09AE\u09BE\u09AA \u09AC\u09A6\u09B2 \u0993 \u099A\u09C7\u0987\u09A8 \u09AE\u09C7\u09B0\u09BE\u09AE\u09A4\u0964"],
  bajus:["BAJUS member","\u09AC\u09BE\u099C\u09C1\u09B8 \u09B8\u09A6\u09B8\u09CD\u09AF"],
  visit:["Come in","\u0986\u09AE\u09BE\u09A6\u09C7\u09B0 \u09A0\u09BF\u0995\u09BE\u09A8\u09BE"],
  call_shop:["Call the shop","\u09AB\u09CB\u09A8 \u0995\u09B0\u09C1\u09A8"],
  whatsapp:["WhatsApp","\u09B9\u09CB\u09AF\u09BC\u09BE\u099F\u09B8\u0985\u09CD\u09AF\u09BE\u09AA"],
  map:["Find us on the map","\u09AE\u09CD\u09AF\u09BE\u09AA\u09C7 \u09A6\u09C7\u0996\u09C1\u09A8"],
  closed:["Closed","\u09AC\u09A8\u09CD\u09A7"],
  silver:["Silver","\u09B0\u09C1\u09AA\u09BE"],
  bhori:["Bhori","\u09AD\u09B0\u09BF"], ana:["Ana","\u0986\u09A8\u09BE"],
  ratti:["Ratti","\u09B0\u09A4\u09CD\u09A4\u09BF"], gram:["Gram","\u0997\u09CD\u09B0\u09BE\u09AE"],
  night_mode:["Night","\u09B0\u09BE\u09A4"], ivory_mode:["Ivory","\u09B9\u09BE\u09B2\u0995\u09BE"],
  not_setup:["The site is not connected to its database yet. Add your Supabase keys to config.js.","\u09A1\u09BE\u099F\u09BE\u09AC\u09C7\u09B8 \u09B8\u0982\u09AF\u09C1\u0995\u09CD\u09A4 \u09B9\u09AF\u09BC\u09A8\u09BF\u0964"]
};
export const t = k => (D[k] ? D[k][lang === "bn" ? 1 : 0] : k);

export const money = n => {
  const s = "\u09F3" + Math.round(n).toLocaleString("en-IN");
  return lang === "bn" ? toBn(s) : s;
};
export const num = n => (lang === "bn" ? toBn(n) : String(n));
export const esc = s => String(s ?? "").replace(/[&<>"\']/g,
  c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","\'":"&#39;"}[c]));
export const pick = (row, f) => (lang === "bn" && row?.[f + "_bn"]) ? row[f + "_bn"] : row?.[f];

export const bhoriLabel = b => {
  if (b == null || b === "") return "";
  const w = Math.floor(b), a = Math.round((b - w) * 16), o = [];
  if (w) o.push(num(w) + " " + t("bhori"));
  if (a) o.push(num(a) + " " + t("ana"));
  return o.join(" ") || num(0) + " " + t("bhori");
};

/* No 18 carat. */
export const KARATS = [
  {k:"k22",  en:"22 Carat",    bn:"\u09E8\u09E8 \u0995\u09CD\u09AF\u09BE\u09B0\u09C7\u099F"},
  {k:"k21",  en:"21 Carat",    bn:"\u09E8\u09E7 \u0995\u09CD\u09AF\u09BE\u09B0\u09C7\u099F"},
  {k:"trad", en:"Traditional", bn:"\u09B8\u09A8\u09BE\u09A4\u09A8"}
];
export const karatName = k => {
  const r = KARATS.find(x => x.k === k);
  return r ? (lang === "bn" ? r.bn : r.en) : k;
};
