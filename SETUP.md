# Monoram Jewellers — setup

Six steps. Do them in order. Steps 1–5 are easier on a computer because of step 4.

---

## 1. Create the database (free)

1. **supabase.com** → **Start your project** → sign in with Google (`rkarmaker948@gmail.com`).
2. **New project**.
   - Name: `monoram`
   - Database password: make one up and **write it down**. It cannot be recovered.
   - Region: **Singapore** or **Mumbai** — closest to Bangladesh, so the site is faster.
3. Wait about two minutes.

## 2. Create the tables

1. Left menu → **SQL Editor** → **New query**.
2. Open `setup.sql`, copy **all** of it, paste, click **Run**.

You should see "Success". This creates the tables, locks them so only you can write,
makes the photo store, and fills in your shop name, address, phones and email.
**No products and no rates are added.** You do that yourself in step 6.

## 3. Copy your two keys

Left menu → **Project Settings** → **API**. Copy the **Project URL** and the **anon**
(publishable) key.

> Never put the **service_role** key in these files. The anon key is meant to be public —
> your data is protected by the rules from step 2, not by hiding the key.

## 4. Paste them into config.js

```js
window.CONFIG = {
  SUPABASE_URL: "https://xxxxxxxx.supabase.co",
  SUPABASE_KEY: "eyJhbGciOi....",
  SITE_URL:     ""
};
```

Leave `SITE_URL` empty until the domain is bought.

## 5. Create your login, then shut the door

1. **Authentication** → **Users** → **Add user** → **Create new user**.
   Email, a strong password, and turn **Auto Confirm User** on.
2. **Important:** **Authentication** → **Sign In / Providers** → **Email** →
   turn **"Allow new users to sign up"** OFF.

   Skip this and a stranger could register an account and edit your website.

## 6. Put it online

1. Zip all the files in this folder.
2. Netlify site → **Deploys** → drag the zip onto the drop area.
3. Open the site. Empty collection, "rate has not been published yet" — correct.
4. Go to **your-site/admin.html**, sign in, then:
   - **Gold rate** → type today's rates → **Publish rate**
   - **Collection** → add your first piece
   - **Shop details** → opening hours, closing day, front page wording
   - **Appearance** → colours, if you want to change them

The website updates the moment you save. Nothing to re-upload.

---

## Today's rates for the first entry

BAJUS, effective 10:00 AM, 24 July 2026, per bhori. Numbers only, no commas:

| | |
|---|---|
| 22 carat | 220858 |
| 21 carat | 210943 |
| Traditional | 148016 |
| Silver | 4607 |

**There is no 18 carat anywhere in this build**, as you asked.

---

## The admin page

**Gold rate** — publish rates, see history, delete a mistake. Each publish adds a point
to the chart by itself. 22 carat, 21 carat, traditional and silver. There is no 18 carat
anywhere in this build.

**Collection** — add, edit, delete. Name, category, carat, weight in bhori, price, tag,
"ask for price", featured, sold, photo. Every field has an optional Bangla box. Photos are
shrunk to 1200px JPEG on your phone before uploading.

**Shop details** — front page heading and text, notice banner, name, tagline, address,
opening hours, closing day, phones, WhatsApp, email, and a tick box for each of
hallmarked / written slip / exchange / repair / BAJUS.

**Look** — four things in one place:

- *Logo* — the thirteen marks from your printed cards, shown as a grid. Tap one. Or upload
  your own SVG; it is checked for scripts before being accepted, and recoloured to match
  the theme automatically.
- *Page layout* — Gold thread, Invitation, or Ornate. Same content, three arrangements.
- *Decoration* — Minimal (fine lines, matches the card) or Ornate (gold bloomwork in the
  corners). This is separate from the layout, so you can have the Ornate layout with
  Minimal decoration, or any other combination.
- *Colour* — festival theme, which mode visitors see first, whether they may switch, and
  an optional accent colour of your own. Live preview of both night and ivory, with a
  warning if a colour would be hard to read.

**Festival card** — a library. Each card has a name, colour theme, heading and text in both
languages, an optional button, a picture, an end date, and an on/off switch. Save as many as
you like; only one shows at a time. Two ways to use it:

- Leave *"my picture already has the words on it"* unticked and the site lays your heading
  and text over the picture. Change the wording any time without a new image.
- Tick it and your picture is shown untouched, exactly as you designed it.

The card sits at the very top of the site. Visitors can close it with the ×, and it comes
back the next day. It disappears by itself after the end date.

**Visitors** — opens today, last 7 days, all time, enquiry taps, most-looked-at pieces.

## Night and ivory

Both palettes are taken from your printed cards — the near-black "night" card and the
"ivory and gold" card, with the exact same ink values. The site opens in whichever you
choose. Visitors can switch with the button top-right and their choice is remembered.
You can hide the switch if you would rather everyone saw the same thing.

Festival themes change the **accent** only — the gold becomes green for Eid, crimson for
Puja, and so on. The background stays as it is on the card. This is deliberate: flooding
the whole page with festival colour would lose the restraint that makes the marks work.

Every combination has been checked for readability. Where a colour would be too faint or a
button label unreadable, the code corrects it before it reaches the screen.

---

## Files

| File | What it does |
|---|---|
| `index.html`, `app.js`, `styles.css` | the public website |
| `admin.html`, `admin.js` | your admin page |
| `lib.js` | shared code, Bengali translations, the Monoram wordmark |
| `theme.js` | palettes, layouts, and the generated ornament |
| `marks.js` | the thirteen logo marks and the wordmark, as vectors |
| `config.js` | **the only file you edit** |
| `setup.sql` | run once in Supabase |
| `sw.js`, `manifest.webmanifest`, `icon-*.png` | add-to-home-screen |

---

## Still to do

- **Buy the domain**, then tell me — I'll point the site at it and fill in `SITE_URL`.
- **Add the QR code to the visiting card**, which needs the final web address first.

---

## Honest caveat

I have no internet access while building, so this has never run against a live Supabase
project. Syntax, database rules, page wiring and the colour maths are all checked. The
first real connection is not. If anything errors, send me the exact message.
