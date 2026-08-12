#!/usr/bin/env bash
# =====================================================================
#  Monoram Jewellers — upload the website to cPanel over FTPS
#
#  USE:
#      ./deploy.sh --dry-run     show what would be uploaded, change nothing
#      ./deploy.sh               actually upload
#
#  Read DEPLOY.md before the first run. Always do a --dry-run first.
#
#  WHAT IT DOES
#    1. Reads the server login from .env.deploy (never from this file).
#    2. Copies the website files — and only those — into a throwaway
#       folder called .deploy-staging.
#    3. Stamps today's date into that copy of styles.css and sw.js, so
#       you can tell at a glance whether the live site is the new build.
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

for arg in "$@"; do
  case "$arg" in
    --dry-run|-n) DRY_RUN=1 ;;
    --help|-h)
      sed -n '2,20p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'
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
# ---------------------------------------------------------------------
if [ ! -f "$ENV_FILE" ]; then
  die "STOPPED — there is no .env.deploy file.

Nothing has been uploaded and nothing has changed.

To fix it:
  1. In this folder, copy the file  .env.deploy.example
  2. Name the copy exactly         .env.deploy
  3. Open it and fill in the values from cPanel.

DEPLOY.md step 2 explains where each value comes from."
fi

# Read KEY=VALUE lines. Anything after a # on its own line is a comment.
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

FTP_PORT="${FTP_PORT:-21}"
FTP_INSECURE="${FTP_INSECURE:-no}"
SITE_URL="${SITE_URL:-}"

MISSING=()
for v in FTP_HOST FTP_USER FTP_PASS FTP_DIR; do
  if [ -z "${!v:-}" ]; then MISSING+=("$v"); fi
done
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
if [ "$DRY_RUN" -eq 0 ] && ! command -v lftp >/dev/null 2>&1; then
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

# --- the version marker -------------------------------------------------
# styles.css line 1, and the offline cache name in sw.js. Both are changed
# ONLY in the staging copy — the files in this folder are left alone, so
# your own copy never fills up with deploy noise. On the live site they
# carry the date, which is how you tell the new build from the old one.
if [ -f "$STAGING/styles.css" ]; then
  sed -i.bak "1s|^/\* build:.*\*/$|/* build: $STAMP_HUMAN */|" "$STAGING/styles.css"
  rm -f "$STAGING/styles.css.bak"
fi
if [ -f "$STAGING/sw.js" ]; then
  sed -i.bak "s|^const CACHE = \"\(monoram-v[0-9]*\)\".*$|const CACHE = \"\1-$STAMP_TAG\";|" "$STAGING/sw.js"
  rm -f "$STAGING/sw.js.bak"
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
if [ "$DRY_RUN" -eq 1 ]; then
  say "DRY RUN — nothing will be uploaded and nothing will change."
else
  say "UPLOADING to $FTP_HOST"
fi
rule
say "From : $HERE"
say "To   : $FTP_DIR/  on  $FTP_HOST  (port $FTP_PORT, FTPS)"
say "Build: $STAMP_HUMAN"
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

say "DONE — ${#FILES[@]} files uploaded, build $STAMP_HUMAN."
say ""
say "Now check it on your phone:"
if [ -n "$SITE_URL" ]; then
  say "  1. Open  $SITE_URL"
else
  say "  1. Open the website"
fi
say "  2. If it looks unchanged, clear the phone's copy:"
say "     Chrome → ⋮ → Settings → Site settings → the site → Clear & reset"
say "  3. To prove the new build arrived, view the page source and look"
say "     at the first line of styles.css. It should read:"
say "         /* build: $STAMP_HUMAN */"
rule
