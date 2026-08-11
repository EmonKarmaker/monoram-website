# Putting the new website live

Four things to do, in this order. Do not skip step 1 — the website will show
errors until the database has the new columns.

You can do all of this from your phone.

---

## Step 1 — Add the new columns to the database

The website now stores a few things it did not store before: which unit each
gold rate was typed in, your name as proprietor, your two Facebook links, and
a short description for each piece.

1. Open **supabase.com** in your phone's browser and sign in.
2. Tap your project, **monoram**.
3. In the left-hand menu tap **SQL Editor**.
4. Tap **+ New query** (top of the list).
5. Open the file **patch2.sql** from your website folder, select all of the
   text, and copy it.
6. Paste it into the big empty box in the SQL Editor.
7. Tap the green **Run** button (bottom right). On a phone you can also press
   Ctrl+Enter if you have a keyboard.

**What "it worked" looks like:** a green bar appears under the box saying
**Success. No rows returned**. That is the correct result — this file changes
the shape of the tables, it does not look anything up, so having no rows to
show back is exactly right.

**If you see red instead:** read the message. If it says something already
exists, that is harmless — the file is written to be safe to run twice. Run it
again if you are unsure; nothing is lost either way.

> This file never deletes a column, never renames one, and never removes a row.
> Your rates, your pieces and your photos are untouched.

---

## Step 2 — Send the new website files up

1. On your computer, open the website folder.
2. Commit everything and push it to **master**:

   ```
   git add -A
   git commit -m "Per-gram rates, photo viewer, proprietor and Facebook"
   git push origin master
   ```

**How to confirm the host picked it up:** open your host's dashboard
(Netlify / Vercel / Cloudflare Pages — whichever you used) and look at the
**Deploys** list. The newest entry should show today's date and the words
**Published** or **Ready**, in green. If it says **Failed**, tap it and read
the log; the most common cause is a file that did not get committed.

Give it about a minute after it goes green before checking your phone.

---

## Step 3 — Make your phone forget the old version

This is the step people miss. Your phone keeps a copy of the website so it
works without internet, and it will happily keep showing you the old one.

**If you open the site in a browser:**

- Chrome on Android: tap the **⋮** menu → **Settings** → **Privacy and
  security** → **Delete browsing data** → tick **Cached images and files** →
  **Delete data**. Then open the site again.
- Or simpler: open the site, pull down to refresh twice in a row.

**If you added the shop to your home screen (the app icon):**

1. Press and hold the Monoram icon on your home screen.
2. Tap **App info** (or the ⓘ symbol).
3. Tap **Storage** → **Clear cache**. If it still looks old, tap
   **Clear storage** as well — this only clears the saved copy, it does not
   log you out of anything important.
4. Open the app again.

**How to tell it worked:** the gold rate section now shows a small
**per gram** figure underneath each big per-bhori price. If you only see the
big price, you are still on the old copy.

---

## Step 4 — The domain and the QR code

Do this last, once everything above is working.

### 4a. Buy the domain

1. Go to **dash.cloudflare.com** and sign in.
2. In the left menu tap **Domain Registration** → **Register Domain**.
3. Type the name you want and tap **Search**.
4. Pick one that is available, tap **Purchase**, and pay.

Cloudflare Registrar sells at cost with no first-year discount trick, and WHOIS
privacy is included free.

### 4b. Point the domain at the website

1. Still in Cloudflare, tap your new domain, then **DNS** → **Records**.
2. Your host will have given you a target. Add what it asks for:
   - if it gave you a **name** like `monoram.netlify.app`, add a **CNAME**
     record, Name `@`, Target that name, Proxy status **Proxied** (orange
     cloud);
   - if it gave you an **IP address**, add an **A** record, Name `@`, IPv4
     address that number, Proxy **Proxied**.
3. Add a second record the same way with Name `www`.
4. Go to your host's dashboard → **Domain settings** → **Add custom domain**,
   and type your new domain there too. The host needs to know about it as well.

Wait up to an hour, then open your domain in a browser. You should see the shop.

### 4c. Fill in the address, and REGENERATE THE QR CODE

The QR code on your visiting card currently points nowhere, because the
website did not have an address when the cards were designed. It must be
regenerated once the domain works.

1. Open **config.js** in your website folder.
2. Find this line:

   ```js
   SITE_URL:     ""    // your domain once bought, e.g. https://monoram.com
   ```

3. Put your domain between the quotes, with `https://` at the front and **no**
   slash at the end:

   ```js
   SITE_URL:     "https://your-domain-here.com"
   ```

4. Save, then commit and push again exactly as in Step 2.
5. Make a new QR code pointing at the same address. Any free generator will do
   — search "QR code generator", paste your full `https://...` address, and
   download the **SVG** or the largest PNG offered.
6. **Test the new QR before you print anything.** Open your phone camera, point
   it at the code on screen, and check it opens your shop. Print only after it
   does.
7. Send the new code to whoever prints your cards. The old cards will keep
   pointing nowhere — they cannot be fixed, only replaced.

---

# If it goes wrong

### "Could not find the ... column" — the admin page says the database is behind

You skipped Step 1, or it did not finish.

Go back to **Step 1** and run **patch2.sql** again. If the message names
something older (`fx_density`, `layout`, `show_admin_link`), run **patch.sql**
first and then **patch2.sql**.

Running either file twice is safe.

### The phone still shows the old website

The saved copy has not been replaced. Go back to **Step 3**.

If it is still stubborn, the surest fix: uninstall the home-screen icon (press
and hold → **Uninstall** / drag to remove), open the site in Chrome, then add
it to the home screen again from the **⋮** menu → **Add to Home screen**.

Nothing is lost by doing this — the shop's information lives in the database,
not on the phone.

### The gold rate looks about eleven times too small

A rate was published with the wrong unit. The four rate boxes are **per gram**
now — the number your source gives you, around 20,000, not around 235,000.

Open **admin.html** → **Gold rate**. Under each box it tells you what your
number comes to per bhori. If that reading does not look like a normal bhori
price, the number in the box is wrong. Fix it and publish again. The old wrong
rate can be removed from the **History** list with its **Delete** button.

### Admin sign-in fails

Work through these in order:

1. **"Invalid login credentials"** — the email or password is wrong. Go to
   supabase.com → your project → **Authentication** → **Users**. Find your
   email, tap the **⋯** at the end of the row, and choose **Send password
   recovery**. Check your email and set a new password.
2. **No user listed at all** — the account was never made. On that same
   **Users** page tap **Add user** → **Create new user**, type your email and
   a password, and tick **Auto Confirm User**. Then sign in with those.
3. **"Cannot reach the database"** — the phone has no internet, or the Supabase
   project is paused. A free Supabase project pauses after a week with no
   traffic. Open the project on supabase.com; if it shows a **Restore** or
   **Resume** button, tap it and wait a minute or two.
4. **The page is blank or says "Not connected"** — `config.js` lost its keys.
   Open it and check `SUPABASE_URL` and `SUPABASE_KEY` are both filled in.

### Something on the page looks broken after a deploy

Bump the cache name in **sw.js**. The line near the top reads:

```js
const CACHE = "monoram-v2";
```

Change `v2` to `v3`, push, and do Step 3 again. **Do this on every deploy** —
it is what tells every phone to fetch the new files instead of its saved copy.
