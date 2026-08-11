# Looking at the website on your own computer

This lets you open the shop's website on your own Windows machine, before
anything goes out to the world.

---

> # ⚠️ READ THIS FIRST
>
> ## The website on your computer is joined to the REAL database.
>
> `config.js` holds the keys to the live Supabase project. It does not matter
> that the page is running on your own machine — **what you see is the real
> shop's real information, and anything you save goes straight to the real
> website.**
>
> - **Looking is completely safe.** Scrolling, tapping, switching between
>   English and Bangla, trying the calculator — none of that changes anything.
> - **Saving is not.** If you open the admin page from your computer and press
>   *Publish rate*, *Save piece* or *Delete*, the live website changes for
>   every customer, immediately. There is no "local copy" to practise on.
>
> **If you only want to look at the design, use `preview.html` instead**
> (Part 3 below). That page is fed made-up sample data and never touches the
> database at all.

---

## Part 1 — Start the little web server

The website cannot be opened by double-clicking `index.html`. Its code is
split into modules, and for security every browser refuses to load modules
from a plain file on disk — they have to arrive over a web address. So you
run a tiny server on your own machine for a moment. It is not on the internet
and nobody else can reach it.

### Step 1 — Open a terminal in the website folder

1. Open **File Explorer** and go to your website folder (the one holding
   `index.html`).
2. Click once in the **address bar** at the top, so the folder path turns blue.
3. Type `powershell` over it and press **Enter**.

**What you should see:** a dark blue or black window opens, with the last line
showing your folder path followed by `>`. Something like:

```
PS E:\Live_Projects\DAD\monoram-website>
```

### Step 2 — Start the server

Type this and press **Enter**:

```
py -3 -m http.server 5500
```

**What you should see:**

```
Serving HTTP on :: port 5500 (http://[::]:5500/) ...
```

That is it working. **Leave this window open** — closing it switches the
server off.

**If it says `py` is not recognised**, Python is not installed. Either
install it from **python.org** (tick *Add Python to PATH* during setup), or
skip Python entirely and use this instead, which needs Node.js:

```
npx --yes http-server -p 5500
```

On Mac or Linux the command is `python3 -m http.server 5500`.

### Step 3 — Open the website

Open your browser and go to:

**http://localhost:5500**

**What you should see:** the Monoram shop, exactly as customers see it —
the gold logo, today's real rate, and the real collection.

### Step 4 — Stop the server when you are done

Click on the blue terminal window and press **Ctrl + C**. The `Serving HTTP`
message stops and you get your `>` prompt back. You can then close the window.

---

## Part 2 — The admin page on your computer

Go to **http://localhost:5500/admin.html** and sign in with your usual email
and password.

This works. The sign-in uses an email and password, which Supabase accepts
from any address including `localhost`. (It would *not* work if we used
"magic link" emails — those only come back to addresses on an approved list.
We do not use them.)

> **Remember the warning at the top of this page.** This admin page is the
> real admin page. Every Save and every Delete changes the live website at
> once. If you are only exploring, look but do not press Save.

---

## Part 3 — The safe sample page

To look at the design, try layouts, or show someone the site without any risk
at all, open:

**http://localhost:5500/preview.html**

**What you should see:** the same shop, but with a **dark red bar across the
very top** reading *SAMPLE PREVIEW — MADE-UP DATA*, and every name, price and
photograph on the page clearly marked SAMPLE.

This page never connects to the database. It cannot show you a real price and
it cannot change anything. Use it freely.

To try a different look, open `preview.html` in Notepad and find these lines
near the middle:

```js
layout: "thread",             /* change to "invitation" or "ornate" to compare */
style_language: "minimal",    /* or "ornate" */
...
rate_unit: "gram",            /* "gram" | "bhori" | "both" */
```

Change the word inside the quotes, save the file, and refresh the browser.
Nothing you do in this file affects the real website — it is only used by
`preview.html`.

---

## If something goes wrong

### "This site can't be reached" at localhost:5500

The server is not running. Go back to **Part 1, Step 2**. Check the blue
terminal window still shows `Serving HTTP on :: port 5500`.

### The page is blank, or the collection never appears

Press **F12** to open the browser's developer panel and click the **Console**
tab. If you see a message mentioning `CORS`, `file://` or `module`, you have
opened the file by double-clicking it instead of going through
`http://localhost:5500`. Use the address.

### "Address already in use" when starting the server

Port 5500 is taken, probably by a server you left running earlier. Either
close that other terminal window, or use a different number:

```
py -3 -m http.server 5501
```

then go to **http://localhost:5501** instead.

### The local page is stuck showing an old version

The website normally saves a copy of itself onto the device so it works
without internet. **That is now switched off for `localhost` and
`127.0.0.1`**, so this should not happen any more — and if a copy was left
behind from before, opening the page once on localhost removes it
automatically.

If a page still looks stale, clear it out by hand:

1. On the localhost page, press **F12**.
2. Click the **Application** tab (you may need the **»** arrow to find it).
3. In the left menu click **Service Workers**. If anything is listed, click
   **Unregister** beside it.
4. In the same left menu click **Storage**, then the **Clear site data**
   button.
5. Close the developer panel and press **Ctrl + Shift + R** to reload.

**What you should see:** the page reloads and is up to date.

> This only affects the copy on *your* computer. Customers' phones are a
> separate matter — see **DEPLOY.md, Step 3** for those.

### I want to be sure I have not changed anything real

Open **http://localhost:5500/admin.html**, sign in, and look at **Gold rate →
History** and **Collection**. If the lists match what you expect, nothing was
changed. Every change is a row you can see there, and rates can be removed
with their **Delete** button.
