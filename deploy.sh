#!/usr/bin/env bash
# =====================================================================
#  Monoram Jewellers — upload the website to cPanel over FTPS
#
#  USE:
#      ./deploy.sh --dry-run     show what would be uploaded, change nothing
#      ./deploy.sh               actually upload
#      ./deploy.sh --stage-only  build the upload folder and stop, so you
#                                can look inside it. Uploads nothing and
#                                does not need a server login at all.
#
#  Read DEPLOY.md before the first run. Always do a --dry-run first.
#
#  WHAT IT DOES
#    1. Reads the server login from .env.deploy (never from this file).
#    2. Copies the website files — and only those — into a throwaway
#       folder called .deploy-staging.
#    3. Works out a short code from the contents of those files and writes
#       it into every address the browser will ask for, including the
#       import lines inside the scripts. That is what makes a new version
#       arrive on a phone by itself. See THE VERSION STAMP below.
#    4. Uploads the folder to the server.
#
#  It never deletes anything on the server. See the note by UPLOAD below.
# =====================================================================

set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$HERE"

ENV_FILE=".env.deploy"
STAGING=".deploy-staging"
DRY_RUN=0
STAGE_ONLY=0

for arg in "$@"; do
  case "$arg" in
    --dry-run|-n)   DRY_RUN=1 ;;
    --stage-only|-s) STAGE_ONLY=1 ;;
    --help|-h)
      sed -n '2,25p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'
      exit 0 ;;
    *)
      echo "Unknown option: $arg"
      echo "Use:  ./deploy.sh --dry-run    or    ./deploy.sh"
      exit 2 ;;
  esac
done

say()  { printf '%s\n' "$*"; }
rule() { printf '%s\n' "----------------------------------------------------------------"; }
die()  { printf '\n%s\n\n' "$*" >&2; exit 1; }

# ---------------------------------------------------------------------
#  Files that must NOT go on the public internet.
#
#  Matched against the path relative to this folder. A pattern ending in
#  / matches a whole folder and everything inside it.
#
#  .htaccess is deliberately NOT here. It is the file the entire caching
#  fix depends on, and it is the one an upload tool most often skips by
#  itself because its name starts with a dot. There is a check further
#  down that refuses to deploy if it did not make it into the staging
#  folder.
# ---------------------------------------------------------------------
EXCLUDE=(
  ".git/"  ".github/"  ".deploy-staging/"  "node_modules/"
  ".vscode/"  ".idea/"
  "*.sql"                 # the database patches — private
  "*.md"                  # your own notes
  "preview.html"          # sample data, must never reach a customer
  "deploy.sh"  "deploy.ps1"
  ".env.deploy"  ".env.deploy.example"  ".env"  ".env.deploy.local"
  ".gitignore"
  ".DS_Store"  "Thumbs.db"  "desktop.ini"
  "*.swp"  "*~"  "*.zip"  "*.log"  "*.bak"  "*.orig"
  "_*"                    # scratch files, which are named with a leading _
)

# Folders skipped whole. Reported once by name rather than file by file —
# .git alone holds well over a hundred files and listing them would bury
# the part of the report that matters.
EXCLUDE_DIRS=(".git" ".github" ".deploy-staging" "node_modules" ".vscode" ".idea")
PRUNED_DIRS=()

in_excluded_dir() {
  local path="$1" d
  for d in "${EXCLUDE_DIRS[@]}"; do
    if [[ "$path" == "$d/"* || "$path" == *"/$d/"* ]]; then
      printf '%s' "$d"; return 0
    fi
  done
  return 1
}

is_excluded() {
  local path="$1" pat
  for pat in "${EXCLUDE[@]}"; do
    case "$pat" in
      */) [[ "$path" == "${pat%/}" || "$path" == "${pat}"* ]] && return 0 ;;
      *)  # shellcheck disable=SC2053
          [[ "$(basename "$path")" == $pat ]] && return 0 ;;
    esac
  done
  return 1
}

# ---------------------------------------------------------------------
#  1. The server login
#
#  --stage-only uploads nothing, so it needs no login. Skipping the whole
#  section keeps it usable for checking a build on a machine that has no
#  .env.deploy at all.
# ---------------------------------------------------------------------
if [ "$STAGE_ONLY" -eq 1 ]; then
  FTP_HOST="(not needed)"; FTP_DIR="(not needed)"; FTP_PORT="-"; SITE_URL=""
fi
if [ "$STAGE_ONLY" -eq 0 ] && [ ! -f "$ENV_FILE" ]; then
  die "STOPPED — there is no .env.deploy file.

Nothing has been uploaded and nothing has changed.

To fix it:
  1. In this folder, copy the file  .env.deploy.example
  2. Name the copy exactly         .env.deploy
  3. Open it and fill in the values from cPanel.

DEPLOY.md step 2 explains where each value comes from."
fi

# Read KEY=VALUE lines. Anything after a # on its own line is a comment.
if [ -f "$ENV_FILE" ]; then
while IFS= read -r line || [ -n "$line" ]; do
  line="${line%$'\r'}"                       # tolerate Windows line endings
  [[ "$line" =~ ^[[:space:]]*# ]] && continue
  [[ "$line" =~ ^[[:space:]]*$ ]] && continue
  [[ "$line" != *=* ]] && continue
  key="${line%%=*}"; val="${line#*=}"
  key="$(printf '%s' "$key" | tr -d '[:space:]')"
  val="${val#\"}"; val="${val%\"}"           # strip surrounding quotes
  val="${val#\'}"; val="${val%\'}"
  printf -v "$key" '%s' "$val"
done < "$ENV_FILE"
fi

FTP_PORT="${FTP_PORT:-21}"
FTP_INSECURE="${FTP_INSECURE:-no}"
SITE_URL="${SITE_URL:-}"

MISSING=()
if [ "$STAGE_ONLY" -eq 0 ]; then
  for v in FTP_HOST FTP_USER FTP_PASS FTP_DIR; do
    if [ -z "${!v:-}" ]; then MISSING+=("$v"); fi
  done
fi
if [ "${#MISSING[@]}" -gt 0 ]; then
  die "STOPPED — .env.deploy is missing a value for: ${MISSING[*]}

Nothing has been uploaded and nothing has changed.

Open .env.deploy and fill in the blank(s). Every line must look like
    NAME=value
with no spaces around the = sign, and nothing after the value."
fi

# A very common slip: pasting the host with ftp:// on the front.
case "$FTP_HOST" in
  ftp://*|ftps://*|http://*|https://*)
    die "STOPPED — FTP_HOST should not have a protocol in front of it.

You have:  FTP_HOST=$FTP_HOST
It should be just the address, like:
           FTP_HOST=ftp.yourdomain.com" ;;
esac

# ---------------------------------------------------------------------
#  2. Which tool will do the uploading
# ---------------------------------------------------------------------
if [ "$DRY_RUN" -eq 0 ] && [ "$STAGE_ONLY" -eq 0 ] && ! command -v lftp >/dev/null 2>&1; then
  die "STOPPED — lftp is not installed on this computer.

Nothing has been uploaded and nothing has changed.

lftp is the program that does the actual uploading.
  Windows : use deploy.ps1 instead — it needs nothing installed.
  Mac     : brew install lftp
  Ubuntu  : sudo apt install lftp

You can still run  ./deploy.sh --dry-run  without it, to see the file
list."
fi

# ---------------------------------------------------------------------
#  3. Build the staging copy
# ---------------------------------------------------------------------
STAMP_HUMAN="$(date '+%Y-%m-%d %H:%M')"
STAMP_TAG="$(date '+%Y%m%d-%H%M')"

rm -rf "$STAGING"
mkdir -p "$STAGING"

FILES=()
SKIPPED=()
while IFS= read -r f; do
  f="${f#./}"
  if d="$(in_excluded_dir "$f")"; then
    case " ${PRUNED_DIRS[*]:-} " in *" $d "*) ;; *) PRUNED_DIRS+=("$d") ;; esac
    continue
  fi
  if is_excluded "$f"; then SKIPPED+=("$f"); continue; fi
  FILES+=("$f")
done < <(find . -type f | sort)

if [ "${#FILES[@]}" -eq 0 ]; then
  die "STOPPED — no files to upload. Are you running this from the website folder?"
fi

for f in "${FILES[@]}"; do
  mkdir -p "$STAGING/$(dirname "$f")"
  cp "$f" "$STAGING/$f"
done

# =======================================================================
#  THE VERSION STAMP — what stops a phone showing yesterday's site
#
#  WHAT HAPPENS HERE
#    A short code is worked out from the CONTENTS of the website files —
#    something like a3f19c4d. It is then written into the staging copy in
#    four places, so that every address the browser asks for carries it:
#
#      index.html    <script src="app.js?v=a3f19c4d">
#      admin.html    the same, for admin.js
#      app.js        import { ... } from "./lib.js?v=a3f19c4d"
#      sw.js         one line, from which it builds both its cache name
#                    and its own list of addresses
#
#  WHY THE IMPORTS MATTER MOST
#    app.js is an ES module: it fetches lib.js, theme.js, ambient.js and
#    viewer.js by itself, using the addresses written inside it. Stamping
#    only the <script> tag in index.html would leave those four asking for
#    plain "./lib.js" — and a phone with an old lib.js in its cache would
#    happily hand it to the new app.js. A new file running against an old
#    one fails in ways nobody can diagnose. Stamping the import lines is
#    what makes the whole site update as one thing or not at all.
#
#  WHY A CODE FROM THE CONTENTS AND NOT THE DATE
#    A date changes on every deploy, so it would make every phone download
#    all 200KB again even when nothing changed. This code only changes
#    when a file actually changes. Deploy twice with no edits in between
#    and returning visitors download nothing at all.
#
#  ALL OF THIS HAPPENS ON THE COPY IN .deploy-staging, NEVER on your own
#  files. Your folder is left exactly as it was, so "git diff" stays
#  clean and readable.
# =======================================================================

# The files the code is worked out from. Order matters — it must be the
# same list in the same order every run, or the code would change by
# itself. .htaccess is not here on purpose: changing a server rule does
# not need every phone to re-download the site.
HASH_INPUTS=(index.html admin.html styles.css config.js marks.js
             app.js lib.js theme.js ambient.js viewer.js admin.js sw.js)

SHA_CMD=""
if command -v sha1sum >/dev/null 2>&1; then SHA_CMD="sha1sum"
elif command -v shasum >/dev/null 2>&1; then SHA_CMD="shasum -a 1"
fi

EXISTING_INPUTS=()
for f in "${HASH_INPUTS[@]}"; do [ -f "$f" ] && EXISTING_INPUTS+=("$f"); done

if [ -n "$SHA_CMD" ] && [ "${#EXISTING_INPUTS[@]}" -gt 0 ]; then
  VERSION="$(cat "${EXISTING_INPUTS[@]}" | $SHA_CMD | cut -c1-8)"
else
  # No sha1sum and no shasum on this computer. Fall back to the timestamp:
  # it always busts the cache, it just does so on every deploy instead of
  # only when something changed. Correct, slightly wasteful.
  VERSION="$STAMP_TAG"
  say "NOTE: neither sha1sum nor shasum was found, so the build code is"
  say "      the timestamp $VERSION. Everything still works; returning"
  say "      visitors just re-download the scripts on every deploy."
fi

Q="?v=$VERSION"

# --- 1. the <script src> and <link href> tags in the two pages ----------
# Only these five names are touched. admin.html links elsewhere in the
# page (icons, fonts, admin.html itself) and none of those are matched.
for f in index.html admin.html; do
  [ -f "$STAGING/$f" ] || continue
  sed -i.bak -E \
    "s#(src|href)=\"(styles\.css|config\.js|marks\.js|app\.js|admin\.js)\"#\1=\"\2$Q\"#g" \
    "$STAGING/$f"
  # the marker the owner can read in View source, right after <head>
  sed -i.bak "s#^<head>\$#<head><!-- monoram build: $STAMP_HUMAN  |  v=$VERSION -->#" \
    "$STAGING/$f"
  rm -f "$STAGING/$f.bak"
done

# --- 2. the import lines inside the modules -----------------------------
# Anchored on  from "./  so the one import that must NOT be touched — the
# Supabase library in lib.js, which comes from a CDN over https — cannot
# be matched by accident.
for f in app.js admin.js viewer.js; do
  [ -f "$STAGING/$f" ] || continue
  sed -i.bak -E \
    "s#from \"\./(lib|theme|ambient|viewer)\.js\"#from \"./\1.js$Q\"#g" \
    "$STAGING/$f"
  rm -f "$STAGING/$f.bak"
done

# --- 3. the offline cache ----------------------------------------------
# One line. sw.js builds its cache name and its whole address list from it,
# so there is nothing left for anyone to remember to bump.
if [ -f "$STAGING/sw.js" ]; then
  sed -i.bak "s#^const VERSION = \"dev\";\$#const VERSION = \"$VERSION\";#" "$STAGING/sw.js"
  rm -f "$STAGING/sw.js.bak"
fi

# --- 4. the stylesheet's first line, for View source -------------------
if [ -f "$STAGING/styles.css" ]; then
  sed -i.bak "1s|^/\* build:.*\*/\$|/* build: $STAMP_HUMAN  \|  v=$VERSION */|" \
    "$STAGING/styles.css"
  rm -f "$STAGING/styles.css.bak"
fi

# --- 5. refuse to deploy a half-stamped build --------------------------
# If a future edit renames a file or reformats an import, the patterns
# above stop matching and the stamping silently does nothing — which is
# exactly the invisible failure this whole scheme exists to prevent. So
# check the result instead of trusting it.
STAMP_ERRORS=()
grep -q "app\.js$Q" "$STAGING/index.html" 2>/dev/null \
  || STAMP_ERRORS+=("index.html does not reference app.js$Q")
grep -q "styles\.css$Q" "$STAGING/index.html" 2>/dev/null \
  || STAMP_ERRORS+=("index.html does not reference styles.css$Q")
for m in lib theme ambient viewer; do
  grep -q "\./$m\.js$Q" "$STAGING/app.js" 2>/dev/null \
    || STAMP_ERRORS+=("app.js still imports ./$m.js with no version")
done
grep -q "^const VERSION = \"$VERSION\";" "$STAGING/sw.js" 2>/dev/null \
  || STAMP_ERRORS+=("sw.js version line was not replaced")
# Nothing may reach the server still asking for an unversioned module.
if grep -qE 'from "\./(lib|theme|ambient|viewer)\.js"' \
     "$STAGING/app.js" "$STAGING/admin.js" "$STAGING/viewer.js" 2>/dev/null; then
  STAMP_ERRORS+=("an import specifier was left without a version")
fi

if [ "${#STAMP_ERRORS[@]}" -gt 0 ]; then
  rm -rf "$STAGING"
  printf 'STOPPED — the build version could not be stamped in.\n\n' >&2
  printf 'Nothing has been uploaded and nothing has changed.\n\n' >&2
  for e in "${STAMP_ERRORS[@]}"; do printf '  * %s\n' "$e" >&2; done
  die "Without that stamp, phones can keep showing an old copy of the site,
and a new script can run against an old one. That is the exact fault
this step exists to prevent, so the deploy stops here rather than
uploading something broken.

This almost always means a file was renamed, or an import line in
app.js, admin.js or viewer.js was reformatted. The patterns that do the
stamping are in deploy.sh, in the section headed THE VERSION STAMP."
fi

# --- the .htaccess check ------------------------------------------------
if [ ! -f "$STAGING/.htaccess" ]; then
  rm -rf "$STAGING"
  die "STOPPED — .htaccess did not make it into the upload list.

Nothing has been uploaded and nothing has changed.

That file carries the caching rules. Without it, a new stylesheet can sit
on the server for days while phones keep showing the old one. Check that
.htaccess still exists in this folder."
fi

# ---------------------------------------------------------------------
#  4. Report
# ---------------------------------------------------------------------
TOTAL_BYTES=0
rule
if [ "$STAGE_ONLY" -eq 1 ]; then
  say "STAGE ONLY — the upload folder is built and left in place."
elif [ "$DRY_RUN" -eq 1 ]; then
  say "DRY RUN — nothing will be uploaded and nothing will change."
else
  say "UPLOADING to $FTP_HOST"
fi
rule
say "From : $HERE"
say "To   : $FTP_DIR/  on  $FTP_HOST  (port $FTP_PORT, FTPS)"
say "Build: $STAMP_HUMAN"
say "Code : v=$VERSION"
say "       ^ this is the version now going live. To check that a phone"
say "         has it: open the site, View source, and look at the comment"
say "         on the second line. It must say the same code."
say ""
say "Files (${#FILES[@]}):"
for f in "${FILES[@]}"; do
  size=$(wc -c < "$STAGING/$f" | tr -d ' ')
  TOTAL_BYTES=$((TOTAL_BYTES + size))
  printf '  %-28s %8s bytes\n' "$f" "$size"
done
say ""
printf '  %-28s %8s bytes\n' "TOTAL (${#FILES[@]} files)" "$TOTAL_BYTES"

if [ "${#SKIPPED[@]}" -gt 0 ]; then
  say ""
  say "Not uploaded, on purpose (${#SKIPPED[@]}):"
  for f in "${SKIPPED[@]}"; do say "  $f"; done
fi
if [ -n "${PRUNED_DIRS+x}" ] && [ "${#PRUNED_DIRS[@]}" -gt 0 ]; then
  say ""
  say "Also skipped entirely: $(printf '%s, ' "${PRUNED_DIRS[@]}" | sed 's/, $//')"
  say "  (working folders, never part of the website)"
fi

if [ "$STAGE_ONLY" -eq 1 ]; then
  say ""
  rule
  say "STAGE ONLY FINISHED. Nothing was uploaded."
  say ""
  say "The exact files that would go to the server are in:"
  say "    $STAGING/"
  say ""
  say "Version stamped in: v=$VERSION"
  say "Look inside $STAGING/index.html and $STAGING/app.js to see it."
  rule
  exit 0
fi

if [ "$DRY_RUN" -eq 1 ]; then
  rm -rf "$STAGING"
  say ""
  rule
  say "DRY RUN FINISHED. Nothing was uploaded. Nothing on the server changed."
  say ""
  say "If the list above looks right — index.html, styles.css, app.js and"
  say ".htaccess are all in it, and no .sql or .md files are — then run"
  say "the real thing:"
  say ""
  say "    ./deploy.sh"
  rule
  exit 0
fi

# ---------------------------------------------------------------------
#  5. Upload
#
#  mirror -R uploads the staging folder to the server.
#
#  There is deliberately NO --delete. The script only ever adds and
#  overwrites; it never removes a file from the server. If it did, it
#  would wipe anything you had put there by hand — a photo, an old page,
#  a file the host itself created — simply because it is not in this
#  folder. Additive is the safe choice for a live shop.
#
#  --ignore-time is not used: the staging copy is rebuilt every run, so
#  every file is newer than the one on the server and every file is sent.
# ---------------------------------------------------------------------
VERIFY_LINE="set ssl:verify-certificate yes;"
if [ "$FTP_INSECURE" = "yes" ]; then
  VERIFY_LINE="set ssl:verify-certificate no;"
  say ""
  say "NOTE: certificate checking is off (FTP_INSECURE=yes in .env.deploy)."
  say "      The connection is still encrypted."
fi

say ""
rule
say "Connecting..."
rule

set +e
lftp -c "
set ftp:ssl-force true;
set ftp:ssl-protect-data true;
set ssl:check-hostname no;
$VERIFY_LINE
set net:max-retries 3;
set net:timeout 20;
set ftp:passive-mode true;
open -u '$FTP_USER','$FTP_PASS' -p $FTP_PORT '$FTP_HOST';
mirror -R --verbose --no-perms --parallel=2 '$STAGING' '$FTP_DIR';
bye
"
RC=$?
set -e

rm -rf "$STAGING"

say ""
rule
if [ "$RC" -ne 0 ]; then
  say "UPLOAD FAILED (lftp exit code $RC)."
  say ""
  say "The site on the server has NOT been fully updated. Common causes:"
  say ""
  say "  * Wrong username. cPanel usually wants the full user@domain"
  say "    form. Check FTP_USER in .env.deploy."
  say "  * A certificate error. Set FTP_INSECURE=yes in .env.deploy and"
  say "    try again."
  say "  * Connection refused. Your host may not allow FTPS on port 21."
  say "    See the 'If it goes wrong' section of DEPLOY.md."
  rule
  exit "$RC"
fi

say "DONE — ${#FILES[@]} files uploaded, build $STAMP_HUMAN, v=$VERSION."
say ""
say "You do not need to clear anything on any phone. Every address on the"
say "page now ends in ?v=$VERSION, which no phone has ever asked for, so"
say "no phone can have an old copy of it. A tab left open reloads itself."
say ""
say "To check a phone has the new build:"
if [ -n "$SITE_URL" ]; then
  say "  1. Open  $SITE_URL"
else
  say "  1. Open the website"
fi
say "  2. Menu → View page source (or add  view-source:  in front of the"
say "     address). The second line reads:"
say "         <!-- monoram build: $STAMP_HUMAN  |  v=$VERSION -->"
say "  3. If it shows an older code, the phone is being served by a cache"
say "     in FRONT of Apache — LiteSpeed or Cloudflare. Section 5 of"
say "     .htaccess lists exactly what to check in cPanel."
rule
