# Putting the website live

Your website lives in a folder on a **cPanel shared-hosting server**. It changes
only when new files are uploaded into that folder. Nothing else updates it.

There is no automatic deployment. Pushing to GitHub does **not** put anything
live — GitHub is only a backup copy. See step 8.

---

## CHECKLIST

Once you have done this before, this is the whole routine:

1. Supabase → SQL Editor → run `patch2.sql`, then `patch3.sql` — **first time only**
2. `.\deploy.ps1 -Zip` — builds `monoram-upload.zip` with the right 16 files
3. cPanel → File Manager → **Settings → Show Hidden Files** → into the site folder
4. Upload the zip → right-click → **Extract** → **Overwrite all** → delete the zip
5. Open the site on your phone
6. If it looks unchanged: Chrome → ⋮ → Settings → Site settings → the site → **Clear & reset**
7. Prove it: view source, first line of `styles.css` shows today's date
8. `git add -A && git commit -m "..." && git push` — backup only, changes nothing live

Steps 2–4 are the zip route. If you set up FTP instead, they collapse into
`.\deploy.ps1 -DryRun` then `.\deploy.ps1` — see step 4 below.

---
---

# Step 1 — Update the database (first time only)

**These two files have never been run.** Until they are, the admin panel will
show an error about a missing column whenever you try to save a rate or edit a
piece, and the website cannot show a rate per gram.

You only ever do this once. Running them a second time is harmless, so if you
are unsure whether you did it, just do it.

1. Go to **supabase.com** and sign in.
2. Tap your project.
3. In the left menu, tap **SQL Editor**.
4. Tap **New query**. You get an empty white box.
5. Open the file **patch2.sql** from your website folder in Notepad.
   Select all of it (Ctrl+A), copy it (Ctrl+C).
6. Click into the white box in Supabase and paste (Ctrl+V).
7. Tap the green **Run** button, bottom right. (Or press Ctrl+Enter.)
8. Look at the panel that appears underneath.

**What success looks like:** a small green bar reading

> **Success. No rows returned**

That is the correct result. It looks like nothing happened, and that is exactly
right — the patch adds columns, and adding a column returns no rows. Do not run
it again looking for a different message.

**What a problem looks like:** a red box with a message in it. Read the message.
If it says something already exists, you have already run it and everything is
fine. Anything else, send me the red text.

9. Now do the same again with **patch3.sql**: New query → paste → Run →
   *Success. No rows returned.*

**The order matters.** patch2 first, then patch3. patch3 depends on patch2.

---

# Step 2 — Make an FTP account in cPanel

This is how your computer is allowed to put files on the server. You do this
once, and then never again.

1. Sign in to cPanel. (Your host emailed you the address — usually
   `yourdomain.com/cpanel` or `yourdomain.com:2083`.)
2. In the search box at the top, type **FTP** and tap **FTP Accounts**.
3. Under **Add FTP Account**, fill in:
   - **Log In** — type `deploy`
   - **Password** — tap **Password Generator**, then **Copy** the password it
     makes, and paste it somewhere safe right now. You cannot see it again.
   - **Directory** — cPanel fills this in for you as something like
     `/home/youracct/public_html/deploy`. **Change it** to just
     `public_html` (or whatever folder your site is in — see step 6).
     If you leave the default, the account can only reach an empty subfolder
     and your uploads will go nowhere useful.
   - **Quota** — choose **Unlimited**
4. Tap **Create FTP Account**.

### Now read the three values you need

Scroll down to the list of accounts and find the one you just made.

- **Username** — ⚠️ **This is the part people get wrong.** cPanel shows the
  full username, and it is almost always `deploy@yourdomain.com` — not just
  `deploy`. Copy exactly what cPanel displays, including the `@` and the
  domain. If you use only `deploy`, the connection is refused with no
  useful explanation.
- **Server address** — tap **Configure FTP Client** next to your account. It
  shows **FTP Server**, usually `ftp.yourdomain.com`. Copy it *without* any
  `ftp://` in front.
- **Directory** — the folder shown beside the account. This is your `FTP_DIR`.

---

# Step 3 — Fill in .env.deploy

1. In your website folder, find the file **.env.deploy.example**.
2. Make a copy of it in the same folder.
3. Rename the copy to exactly **.env.deploy** — with the dot at the front and
   no `.example` on the end.

   > Windows Explorer may refuse a name starting with a dot. If it does, name
   > it `.env.deploy.` — with a dot on the **end** as well — and press Enter.
   > Windows removes the trailing dot and you are left with the right name.

4. Open **.env.deploy** in Notepad and fill in the values from step 2:

   ```
   FTP_HOST=ftp.yourdomain.com
   FTP_USER=deploy@yourdomain.com
   FTP_PASS=the-password-you-copied
   FTP_DIR=public_html
   SITE_URL=https://yourdomain.com
   ```

5. Save and close.

This file holds your server password. It is listed in `.gitignore`, so it never
goes to GitHub. Never paste its contents into a chat or an email.

---

# Step 4 — Dry run first, then the real upload

## 4a. The dry run — always do this first

Open the website folder, right-click in an empty part of the window, and choose
**Open in Terminal** (or **Open PowerShell window here**). Then type:

```powershell
.\deploy.ps1 -DryRun
```

If Windows says *"running scripts is disabled on this system"*, use this
instead — it does the same thing:

```powershell
powershell -ExecutionPolicy Bypass -File .\deploy.ps1 -DryRun
```

**Nothing is uploaded.** You get a list of every file that *would* go up, then
a list of what is deliberately being left behind, then a total.

Check three things in that list:

- ✅ `.htaccess` is there — **it must be the first line.** This is the file the
  whole caching fix depends on, and it is the one an upload most often skips
  silently because its name starts with a dot.
- ✅ `index.html`, `styles.css` and `app.js` are there.
- ✅ **No** `.sql` files and **no** `.md` files in the upload list. Those are
  your private notes and the database patches; they belong in the
  "Not uploaded, on purpose" list underneath.

## 4b. The real upload

When the list looks right:

```powershell
.\deploy.ps1
```

It prints each file as it goes up, then a count, then the address to open.
It takes a few seconds — the whole site is about 260 KB.

**It never deletes anything on the server.** It only adds files and overwrites
ones with the same name. That is deliberate: if it deleted whatever was not in
your folder, it would wipe anything you had put up by hand.

> **On a Mac or Linux**, use `./deploy.sh --dry-run` and `./deploy.sh`. They do
> exactly the same thing. They need a program called `lftp`
> (`brew install lftp` on a Mac, `sudo apt install lftp` on Ubuntu). The
> Windows script needs nothing installed — it uses `curl.exe`, which is already
> part of Windows.

---

# Step 5 — The zip and File Manager route

This is the route that needs no FTP account at all. Steps 2, 3 and 4 above are
not needed for it.

## 5a. Let the script build the zip

In the website folder, open a terminal and run:

```powershell
.\deploy.ps1 -Zip
```

(If Windows blocks it: `powershell -ExecutionPolicy Bypass -File .\deploy.ps1 -Zip`)

This needs no internet and no `.env.deploy`. It produces **`monoram-upload.zip`**
in the website folder, containing exactly the 16 files that belong on the server
— with `.htaccess` included and the build date stamped in. It prints the full
list of what went inside, and **refuses to produce a zip at all if `.htaccess`
is missing from it.**

> **Do not zip the folder by hand in Explorer.** Selecting the files yourself is
> how `.htaccess` gets left out and how `.sql` and `.md` files end up public. If
> you must do it by hand — from a phone, say — include `.htaccess` and exclude
> every `.sql`, every `.md`, and `preview.html`. The files must sit at the **top
> level** of the zip, not inside a folder.

## 5b. Upload and extract

1. Sign in to cPanel and open **File Manager**.

### ⚠️ Do this before anything else — turn on hidden files

**File Manager hides dotfiles by default, and `.htaccess` is a dotfile.**
Without this setting it will not appear, you will not notice it is missing, and
the caching rules will never reach the server. That is precisely how a whole
round of work once went live looking unstyled.

1. In File Manager, tap **Settings** (top right).
2. Tick **Show Hidden Files (dotfiles)**.
3. Tap **Save**.

You should now see `.htaccess` in the folder listing. If you do not, it is not
on the server and must be uploaded.

### Then

2. Navigate into the folder that holds the live `index.html` (see step 6).
3. Tap **Upload**, choose `monoram-upload.zip`, and wait for it to reach 100%.
4. Go **Back to /home/.../public_html**, right-click the zip, choose
   **Extract**, and confirm.
5. When it asks about existing files, choose **Overwrite all**. If you skip
   instead, the old files stay and nothing changes.
6. **Delete the zip from the server afterwards.** Leaving it there means anyone
   can download your whole site as one file.
7. Check `.htaccess` is now in the listing. If it is not, upload `.htaccess` on
   its own with the **Upload** button.

---

# Step 6 — Make sure it is the right folder

**This is the most common reason an upload appears to work and the website does
not change.** If your domain points at a subfolder rather than `public_html`,
uploading to `public_html` succeeds perfectly and changes nothing anyone can
see.

To find the right folder:

1. In cPanel, open **Domains**.
2. Find your domain in the list and look at the **Document Root** column.
   It says something like `/home/youracct/public_html` or
   `/home/youracct/public_html/monoram`.
3. That is your folder. The part after `/home/youracct/` is what goes in
   `FTP_DIR` — so `public_html` or `public_html/monoram`.

The simplest check of all: **the correct folder is the one that already
contains the live `index.html`.** Open File Manager, go looking for
`index.html`, and whichever folder it is in is the one you upload to.

---

# Step 7 — Make your phone forget the old version

Your phone keeps a copy of the site so it opens instantly. After an upload it
may still show you yesterday's copy for a while.

1. Open the site in Chrome.
2. Tap **⋮** (three dots, top right) → **Settings**.
3. Tap **Site settings** → **All sites** (or **Data stored**).
4. Find your site in the list and tap it.
5. Tap **Clear & reset**, and confirm.
6. Close the tab completely and open the site again.

If you added the site to your home screen, close it from the recent-apps list
first, otherwise it reopens from its own saved copy.

### Proving the new version actually arrived

Do not judge by eye. Check the build stamp:

1. On a computer, open the site, right-click → **View page source**.
2. Find the line `<link rel="stylesheet" href="styles.css">` and click it.
3. **The very first line of that file shows the date and time you deployed.**

   ```css
   /* build: 2026-08-13 01:23 */
   ```

If that date is old, the upload did not arrive — go back to step 6 and check
the folder.

You can also check on the phone: Chrome → **⋮** → **Developer tools** is not
available on mobile, so the view-source method on a computer is the reliable
one. On a computer you can also open **F12 → Application → Service Workers**
and read the cache name, which ends in the same date stamp.

---

# Step 8 — Push to GitHub (backup only)

```
git add -A
git commit -m "describe what changed"
git push
```

**This does not deploy anything.** It saves a copy of your files to GitHub so
they cannot be lost if this computer dies. The live website does not notice
and does not change. Uploading in step 4 is the only thing that makes the site
change.

---
---

# If it goes wrong

## The site looks exactly the same after uploading

Two causes, in order of likelihood:

**1. You uploaded to the wrong folder.** By far the most common. Go back to
step 6 and find the folder that already contains the live `index.html`. An
upload to `public_html` when the domain points at `public_html/monoram` reports
complete success and changes nothing.

**2. Your phone is showing its saved copy.** Do step 7. Then check the build
stamp — that tells you which of the two it is. If the stamp on the live site is
new but your phone shows the old design, it is the phone. If the stamp is old,
it is the folder.

## The whole site shows "500 Internal Server Error"

An `.htaccess` directive your host does not allow. Everything in that file is
wrapped in `<IfModule>` guards to prevent this, but hosts vary and it is still
possible.

**To get the site back immediately:**

1. cPanel → **File Manager** → your website folder.
2. Turn on hidden files if you have not (Settings → Show Hidden Files → Save).
3. Right-click `.htaccess` → **Rename** → change it to `.htaccess.off`
4. Reload the site. It will be working again within seconds.

The site now runs without the caching rules — usable, but phones may hold old
files. Send me the message from cPanel → **Errors** (or your host's error log)
and I will find which line the host objects to.

## The admin page says a column is missing

You have not run step 1, or only ran patch2 and not patch3. Go back and run
them in order. The exact column named in the error tells you which patch:
`unit`, `proprietor`, `facebook_page`, `blurb` → patch2. `rate_unit` → patch3.

## FTP connection refused, or it hangs

- **Wrong username.** Check `FTP_USER` in `.env.deploy` is the full
  `deploy@yourdomain.com` form, exactly as cPanel shows it. This is the single
  most common cause.
- **A certificate error** (curl exit code 60, or lftp saying "certificate").
  Plenty of shared hosts use a certificate that does not match the FTP address.
  Open `.env.deploy` and set `FTP_INSECURE=yes`, then try again. The connection
  stays encrypted; the script simply stops checking the server's identity.
- **Connection refused** (curl exit code 7). The scripts use **FTPS —
  explicit TLS on port 21**, which is what cPanel offers by default. If your
  host has turned plain FTP off *and* uses a different port, ask them for the
  FTPS port and put it in `FTP_PORT`.
- **Some hosts only allow SFTP** (port 22), which is a different protocol these
  scripts do not speak. If your host says that, tell me and I will switch the
  scripts over.
- **Still stuck?** Download **WinSCP** (free, from `winscp.net`), choose File
  protocol **FTP**, Encryption **TLS/SSL Explicit encryption**, and put in the
  same host, username and password. It has a normal two-panel window: your
  files on the left, the server on the right. Drag the files across. Make sure
  its **Options → Preferences → Panels → Show hidden files** is ticked, or
  `.htaccess` will not appear.

## Only some files uploaded

Run the deploy again. It is safe to repeat — it overwrites and never deletes,
so a second run simply finishes the job.

---
---

# Appendix — only if you are still buying the domain

Not part of the routine above. Skip this entirely if the site already has its
address.

## Buying it

Any registrar works. Cloudflare Registrar sells at cost with no first-year
discount trick and includes WHOIS privacy free: **dash.cloudflare.com** →
**Domain Registration** → **Register Domain**.

## Pointing it at the server

1. In cPanel, find **Shared IP Address** in the right-hand sidebar under
   **General Information**. It looks like `192.0.2.45`.
2. At your registrar's DNS page, add two **A** records pointing at that number:
   one named `@`, one named `www`.
3. If you use Cloudflare's DNS, leave both on the **grey** cloud (DNS only)
   until cPanel has issued the certificate — the orange cloud hides your server
   from the certificate check and AutoSSL fails. Switch to orange afterwards if
   you want their caching.
4. Back in cPanel: **Domains** → **Create A New Domain**, and set the document
   root to the folder your site is in.
5. cPanel → **SSL/TLS Status** → tick the domain → **Run AutoSSL**.

Wait up to an hour, then open the domain. You should see the shop, with a
padlock in the address bar.

> **About https:** the `.htaccess` file deliberately does **not** force https
> itself. cPanel hosts almost always redirect to https already, and two
> redirects pointing at each other put the browser in a loop — "too many
> redirects" — and the site stops loading entirely. If the site really is
> reachable over plain `http://` with no redirect, turn it on in cPanel
> (**Domains** → the domain → **Force HTTPS Redirect**) rather than in
> `.htaccess`. One place cannot loop.

## The QR code on your cards

The QR code on the visiting cards points nowhere until the domain works, and it
**must be regenerated** once it does.

1. Open **config.js** and put your address between the quotes, with `https://`
   at the front and no slash at the end:
   `SITE_URL: "https://your-domain-here.com"`
2. Save, then **deploy** (step 4). Pushing to GitHub will not do it.
3. Make a new QR code pointing at the same address — any free generator; download
   the **SVG** or the largest PNG offered.
4. **Test it before printing anything.** Point your phone camera at the code on
   screen and check it opens the shop.
5. Send the new code to the printer. The old cards cannot be fixed, only
   replaced.
