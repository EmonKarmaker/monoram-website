<#
=====================================================================
  Monoram Jewellers — upload the website to cPanel over FTPS
  Windows version. Does exactly the same thing as deploy.sh.

  USE — open PowerShell in this folder, then:

      .\deploy.ps1 -DryRun      show what would be uploaded, change nothing
      .\deploy.ps1              actually upload
      .\deploy.ps1 -StageOnly   build the upload folder and stop, so you
                                can look inside it. Uploads nothing and
                                does not need a server login at all.

  If Windows refuses to run it ("running scripts is disabled"), use:

      powershell -ExecutionPolicy Bypass -File .\deploy.ps1 -DryRun

  Read DEPLOY.md before the first run. Always do a -DryRun first.

  WHAT IT NEEDS INSTALLED: nothing.
  It uploads with curl.exe, which is part of Windows 10 and Windows 11.

  WHAT IT DOES
    1. Reads the server login from .env.deploy (never from this file).
    2. Copies the website files — and only those — into a throwaway
       folder called .deploy-staging.
    3. Works out a short code from the contents of those files and writes
       it into every address the browser will ask for, including the
       import lines inside the scripts. That is what makes a new version
       arrive on a phone by itself. See THE VERSION STAMP below.
    4. Uploads the folder to the server, one file at a time.

  It never deletes anything on the server. See the note by UPLOAD below.
=====================================================================
#>

[CmdletBinding()]
param(
  [switch]$DryRun,
  # Build monoram-upload.zip instead of uploading — for the cPanel File
  # Manager route. Needs no .env.deploy and no internet connection.
  [switch]$Zip,
  # Build .deploy-staging and stop, leaving it in place to be inspected.
  # Needs no .env.deploy either.
  [switch]$StageOnly
)

$ErrorActionPreference = 'Stop'
Set-Location -Path $PSScriptRoot

$EnvFile = '.env.deploy'
$Staging = '.deploy-staging'

function Write-Rule { Write-Host '----------------------------------------------------------------' }
function Stop-With($Message) {
  Write-Host ''
  Write-Host $Message
  Write-Host ''
  exit 1
}

# ---------------------------------------------------------------------
#  Files that must NOT go on the public internet.
#
#  A pattern ending in \ matches a whole folder and everything in it.
#
#  .htaccess is deliberately NOT here. It is the file the entire caching
#  fix depends on, and it is the one an upload tool most often skips by
#  itself because its name starts with a dot. There is a check further
#  down that refuses to deploy if it did not make it into the staging
#  folder.
# ---------------------------------------------------------------------
$ExcludeDirs = @('.git', '.github', '.deploy-staging', 'node_modules', '.vscode', '.idea')
$ExcludeNames = @(
  '*.sql',                  # the database patches — private
  '*.md',                   # your own notes
  'preview.html',           # sample data, must never reach a customer
  'deploy.sh', 'deploy.ps1',
  '.env.deploy', '.env.deploy.example', '.env', '.env.deploy.local',
  '.gitignore',
  '.DS_Store', 'Thumbs.db', 'desktop.ini',
  '*.swp', '*~', '*.zip', '*.log', '*.bak', '*.orig',
  '_*'                      # scratch files, which are named with a leading _
)

function Test-Excluded($RelPath) {
  $parts = $RelPath -split '[\\/]'
  foreach ($d in $ExcludeDirs) { if ($parts -contains $d) { return $true } }
  $leaf = $parts[-1]
  foreach ($n in $ExcludeNames) { if ($leaf -like $n) { return $true } }
  return $false
}

# ---------------------------------------------------------------------
#  1. The server login
# ---------------------------------------------------------------------
$cfg = @{}
# The zip and stage-only routes never connect to anything, so neither
# needs a server login.
if (-not $Zip -and -not $StageOnly) {

if (-not (Test-Path $EnvFile)) {
  Stop-With @"
STOPPED — there is no .env.deploy file.

Nothing has been uploaded and nothing has changed.

To fix it:
  1. In this folder, copy the file  .env.deploy.example
  2. Name the copy exactly         .env.deploy
     (Windows may not let you type a name starting with a dot in
      Explorer. In that case name it  env.deploy  first, then rename it
      to  .env.deploy  — with a dot on BOTH ends: ".env.deploy." — and
      Windows drops the trailing one for you.)
  3. Open it in Notepad and fill in the values from cPanel.

DEPLOY.md step 2 explains where each value comes from.
"@
}

foreach ($line in (Get-Content $EnvFile)) {
  $t = $line.Trim()
  if ($t -eq '' -or $t.StartsWith('#')) { continue }
  $i = $t.IndexOf('=')
  if ($i -lt 1) { continue }
  $k = $t.Substring(0, $i).Trim()
  $v = $t.Substring($i + 1).Trim()
  if ($v.Length -ge 2) {
    if (($v.StartsWith('"') -and $v.EndsWith('"')) -or
        ($v.StartsWith("'") -and $v.EndsWith("'"))) {
      $v = $v.Substring(1, $v.Length - 2)
    }
  }
  $cfg[$k] = $v
}

foreach ($d in @{ FTP_PORT = '21'; FTP_INSECURE = 'no'; SITE_URL = '' }.GetEnumerator()) {
  if (-not $cfg.ContainsKey($d.Key) -or $cfg[$d.Key] -eq '') { $cfg[$d.Key] = $d.Value }
}

$missing = @()
foreach ($k in @('FTP_HOST', 'FTP_USER', 'FTP_PASS', 'FTP_DIR')) {
  if (-not $cfg.ContainsKey($k) -or [string]::IsNullOrWhiteSpace($cfg[$k])) { $missing += $k }
}
if ($missing.Count -gt 0) {
  Stop-With @"
STOPPED — .env.deploy is missing a value for: $($missing -join ', ')

Nothing has been uploaded and nothing has changed.

Open .env.deploy in Notepad and fill in the blank(s). Every line must
look like
    NAME=value
with no spaces around the = sign, and nothing after the value.
"@
}

if ($cfg['FTP_HOST'] -match '^[a-z]+://') {
  Stop-With @"
STOPPED — FTP_HOST should not have a protocol in front of it.

You have:  FTP_HOST=$($cfg['FTP_HOST'])
It should be just the address, like:
           FTP_HOST=ftp.yourdomain.com
"@
}

}   # end of: if (-not $Zip -and -not $StageOnly)

# ---------------------------------------------------------------------
#  2. Which tool will do the uploading
# ---------------------------------------------------------------------
$curl = Join-Path $env:SystemRoot 'System32\curl.exe'
if (-not (Test-Path $curl)) {
  $found = Get-Command curl.exe -ErrorAction SilentlyContinue
  if ($found) { $curl = $found.Source } else { $curl = $null }
}
if (-not $DryRun -and -not $Zip -and -not $StageOnly -and -not $curl) {
  Stop-With @"
STOPPED — curl.exe was not found on this computer.

Nothing has been uploaded and nothing has changed.

curl.exe is normally part of Windows 10 and Windows 11, at
    C:\Windows\System32\curl.exe

If it is genuinely missing, use WinSCP instead — it is a free program
with a normal two-panel window, and DEPLOY.md explains how to use it by
hand. Download it from  https://winscp.net

You can still run  .\deploy.ps1 -DryRun  without curl, to see the file
list.
"@
}

# ---------------------------------------------------------------------
#  3. Build the staging copy
# ---------------------------------------------------------------------
$now = Get-Date
$stampHuman = $now.ToString('yyyy-MM-dd HH:mm')
$stampTag = $now.ToString('yyyyMMdd-HHmm')

if (Test-Path $Staging) { Remove-Item $Staging -Recurse -Force }
New-Item -ItemType Directory -Path $Staging | Out-Null

$root = (Get-Location).Path
$all = Get-ChildItem -Path . -Recurse -File -Force |
  ForEach-Object { $_.FullName.Substring($root.Length + 1) } |
  Sort-Object

$files = @()
$skipped = @()
$prunedDirs = @()
foreach ($rel in $all) {
  $parts = $rel -split '[\\/]'
  # A whole excluded folder is reported by name once, not file by file —
  # .git alone holds well over a hundred files and listing them would bury
  # the part of the report that matters.
  $inDir = $null
  foreach ($d in $ExcludeDirs) { if ($parts -contains $d) { $inDir = $d; break } }
  if ($inDir) {
    if ($prunedDirs -notcontains $inDir) { $prunedDirs += $inDir }
    continue
  }
  if (Test-Excluded $rel) { $skipped += $rel } else { $files += $rel }
}

if ($files.Count -eq 0) {
  Remove-Item $Staging -Recurse -Force
  Stop-With 'STOPPED — no files to upload. Are you running this from the website folder?'
}

foreach ($rel in $files) {
  $dest = Join-Path $Staging $rel
  $destDir = Split-Path $dest -Parent
  if (-not (Test-Path $destDir)) { New-Item -ItemType Directory -Path $destDir -Force | Out-Null }
  Copy-Item -LiteralPath $rel -Destination $dest -Force
}

# =======================================================================
#  THE VERSION STAMP — what stops a phone showing yesterday's site
#
#  This is the same work deploy.sh does, in PowerShell. Keep the two in
#  step: if you change a pattern here, change it there too.
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
#    when a file actually changes.
#
#  ALL OF THIS HAPPENS ON THE COPY IN .deploy-staging, NEVER on your own
#  files, so "git diff" stays clean and readable.
# =======================================================================

# The files the code is worked out from, in a fixed order — the same list
# as deploy.sh. .htaccess is not here on purpose: changing a server rule
# does not need every phone to re-download the site.
$hashInputs = @('index.html','admin.html','styles.css','config.js','marks.js',
                'app.js','lib.js','theme.js','ambient.js','viewer.js','admin.js','sw.js')

$sha = [System.Security.Cryptography.SHA1]::Create()
$buf = New-Object System.IO.MemoryStream
foreach ($h in $hashInputs) {
  if (Test-Path $h) {
    $bytes = [System.IO.File]::ReadAllBytes((Resolve-Path $h))
    $buf.Write($bytes, 0, $bytes.Length)
  }
}
$buf.Position = 0
$version = ([BitConverter]::ToString($sha.ComputeHash($buf)) -replace '-','').Substring(0,8).ToLower()
$buf.Dispose(); $sha.Dispose()
$q = "?v=$version"

function Edit-Staged($Name, [scriptblock]$Change) {
  $p = Join-Path $Staging $Name
  if (-not (Test-Path $p)) { return }
  $full = (Resolve-Path $p).Path
  $text = [System.IO.File]::ReadAllText($full)
  $text = & $Change $text
  [System.IO.File]::WriteAllText($full, $text)
}

# --- 1. the <script src> and <link href> tags in the two pages ----------
# Only these five names are touched. Everything else the pages link to —
# icons, Google Fonts, admin.html itself — is not matched.
foreach ($page in @('index.html','admin.html')) {
  Edit-Staged $page {
    param($t)
    $t = [regex]::Replace($t,
      '(src|href)="(styles\.css|config\.js|marks\.js|app\.js|admin\.js)"',
      "`$1=`"`$2$q`"")
    # the marker the owner can read in View source
    $t = [regex]::Replace($t, '(?m)^<head>$',
      "<head><!-- monoram build: $stampHuman  |  v=$version -->")
    $t
  }
}

# --- 2. the import lines inside the modules -----------------------------
# Anchored on  from "./  so the one import that must NOT be touched — the
# Supabase library in lib.js, which comes from a CDN over https — cannot
# be matched by accident.
foreach ($mod in @('app.js','admin.js','viewer.js')) {
  Edit-Staged $mod {
    param($t)
    [regex]::Replace($t, 'from "\./(lib|theme|ambient|viewer)\.js"', "from `"./`$1.js$q`"")
  }
}

# --- 3. the offline cache ----------------------------------------------
# One line. sw.js builds its cache name and its whole address list from it,
# so there is nothing left for anyone to remember to bump.
Edit-Staged 'sw.js' {
  param($t)
  [regex]::Replace($t, '(?m)^const VERSION = "dev";$', "const VERSION = `"$version`";")
}

# --- 4. the stylesheet's first line, for View source -------------------
Edit-Staged 'styles.css' {
  param($t)
  [regex]::Replace($t, '^/\* build:.*?\*/', "/* build: $stampHuman  |  v=$version */")
}

# --- 5. refuse to deploy a half-stamped build --------------------------
# If a future edit renames a file or reformats an import, the patterns
# above stop matching and the stamping silently does nothing — which is
# exactly the invisible failure this whole scheme exists to prevent. So
# check the result instead of trusting it.
$stampErrors = @()
$idx = [System.IO.File]::ReadAllText((Resolve-Path (Join-Path $Staging 'index.html')).Path)
if ($idx -notmatch [regex]::Escape("app.js$q"))    { $stampErrors += "index.html does not reference app.js$q" }
if ($idx -notmatch [regex]::Escape("styles.css$q")) { $stampErrors += "index.html does not reference styles.css$q" }
$appTxt = [System.IO.File]::ReadAllText((Resolve-Path (Join-Path $Staging 'app.js')).Path)
foreach ($m in @('lib','theme','ambient','viewer')) {
  if ($appTxt -notmatch [regex]::Escape("./$m.js$q")) { $stampErrors += "app.js still imports ./$m.js with no version" }
}
$swTxt = [System.IO.File]::ReadAllText((Resolve-Path (Join-Path $Staging 'sw.js')).Path)
if ($swTxt -notmatch [regex]::Escape("const VERSION = `"$version`";")) { $stampErrors += 'sw.js version line was not replaced' }
# Nothing may reach the server still asking for an unversioned module.
foreach ($mod in @('app.js','admin.js','viewer.js')) {
  $p = Join-Path $Staging $mod
  if (Test-Path $p) {
    $txt = [System.IO.File]::ReadAllText((Resolve-Path $p).Path)
    if ($txt -match 'from "\./(lib|theme|ambient|viewer)\.js"') {
      $stampErrors += "$mod has an import specifier left without a version"
    }
  }
}

if ($stampErrors.Count -gt 0) {
  Remove-Item $Staging -Recurse -Force
  $list = ($stampErrors | ForEach-Object { "  * $_" }) -join "`n"
  Stop-With @"
STOPPED — the build version could not be stamped in.

Nothing has been uploaded and nothing has changed.

$list

Without that stamp, phones can keep showing an old copy of the site,
and a new script can run against an old one. That is the exact fault
this step exists to prevent, so the deploy stops here rather than
uploading something broken.

This almost always means a file was renamed, or an import line in
app.js, admin.js or viewer.js was reformatted. The patterns that do the
stamping are in deploy.ps1, in the section headed THE VERSION STAMP.
"@
}

# --- the .htaccess check ------------------------------------------------
if (-not (Test-Path (Join-Path $Staging '.htaccess'))) {
  Remove-Item $Staging -Recurse -Force
  Stop-With @"
STOPPED — .htaccess did not make it into the upload list.

Nothing has been uploaded and nothing has changed.

That file carries the caching rules. Without it, a new stylesheet can sit
on the server for days while phones keep showing the old one. Check that
.htaccess still exists in this folder.
"@
}

# ---------------------------------------------------------------------
#  4. Report
# ---------------------------------------------------------------------
Write-Rule
if ($StageOnly) {
  Write-Host 'STAGE ONLY — the upload folder is built and left in place.'
} elseif ($Zip) {
  Write-Host 'BUILDING A ZIP for the cPanel File Manager. Nothing is uploaded.'
} elseif ($DryRun) {
  Write-Host 'DRY RUN — nothing will be uploaded and nothing will change.'
} else {
  Write-Host "UPLOADING to $($cfg['FTP_HOST'])"
}
Write-Rule
Write-Host "From : $root"
if (-not $Zip -and -not $StageOnly) {
  Write-Host "To   : $($cfg['FTP_DIR'])/  on  $($cfg['FTP_HOST'])  (port $($cfg['FTP_PORT']), FTPS)"
}
Write-Host "Build: $stampHuman"
Write-Host "Code : v=$version"
Write-Host '       ^ this is the version now going live. To check that a phone'
Write-Host '         has it: open the site, View source, and look at the comment'
Write-Host '         on the second line. It must say the same code.'
Write-Host ''
Write-Host "Files ($($files.Count)):"
$total = 0
foreach ($rel in $files) {
  $size = (Get-Item (Join-Path $Staging $rel)).Length
  $total += $size
  Write-Host ("  {0,-28} {1,8} bytes" -f $rel, $size)
}
Write-Host ''
Write-Host ("  {0,-28} {1,8} bytes" -f "TOTAL ($($files.Count) files)", $total)

if ($skipped.Count -gt 0) {
  Write-Host ''
  Write-Host "Not uploaded, on purpose ($($skipped.Count)):"
  foreach ($rel in $skipped) { Write-Host "  $rel" }
}
if ($prunedDirs.Count -gt 0) {
  Write-Host ''
  Write-Host ("Also skipped entirely: " + (($prunedDirs | Sort-Object) -join ', ') +
              "  (working folders, never part of the website)")
}

# ---------------------------------------------------------------------
#  4b. The zip, for the File Manager route
#
#  Built with .NET rather than Compress-Archive, because Compress-Archive
#  takes a wildcard path and can silently leave out a file whose name
#  starts with a dot — which is exactly how .htaccess goes missing and the
#  caching rules never reach the server. CreateFromDirectory takes the
#  whole folder and cannot skip anything.
#
#  The files sit at the TOP LEVEL of the zip, not inside a folder, so
#  extracting it in public_html puts them straight where they belong.
# ---------------------------------------------------------------------
if ($StageOnly) {
  Write-Host ''
  Write-Rule
  Write-Host 'STAGE ONLY FINISHED. Nothing was uploaded.'
  Write-Host ''
  Write-Host 'The exact files that would go to the server are in:'
  Write-Host "    $Staging\"
  Write-Host ''
  Write-Host "Version stamped in: v=$version"
  Write-Host "Look inside $Staging\index.html and $Staging\app.js to see it."
  Write-Rule
  exit 0
}

if ($Zip) {
  $zipName = "monoram-upload.zip"
  $zipPath = Join-Path $root $zipName
  if (Test-Path $zipPath) { Remove-Item $zipPath -Force }
  Add-Type -AssemblyName System.IO.Compression.FileSystem
  [System.IO.Compression.ZipFile]::CreateFromDirectory(
    (Resolve-Path $Staging).Path, $zipPath,
    [System.IO.Compression.CompressionLevel]::Optimal, $false)

  # Prove what actually landed inside it, rather than assuming.
  $zipRead = [System.IO.Compression.ZipFile]::OpenRead($zipPath)
  $entries = $zipRead.Entries | ForEach-Object { $_.FullName } | Sort-Object
  $zipRead.Dispose()

  Remove-Item $Staging -Recurse -Force

  Write-Host ''
  Write-Rule
  Write-Host "Inside the zip ($($entries.Count) files):"
  foreach ($e in $entries) { Write-Host "  $e" }
  if ($entries -notcontains '.htaccess') {
    Remove-Item $zipPath -Force
    Stop-With 'STOPPED — .htaccess did not make it into the zip. The zip has been deleted.'
  }
  Write-Host ''
  Write-Host '  .htaccess is present.'
  Write-Rule
  Write-Host "ZIP READY:  $zipPath"
  Write-Host ("Size: {0:N0} bytes    Build: {1}" -f (Get-Item $zipPath).Length, $stampHuman)
  Write-Host ''
  Write-Host 'Now, in cPanel:'
  Write-Host '  1. File Manager -> Settings (top right) -> tick'
  Write-Host '     "Show Hidden Files (dotfiles)" -> Save.'
  Write-Host '     Without this you cannot see .htaccess and cannot tell'
  Write-Host '     whether it arrived.'
  Write-Host '  2. Go into the folder that already contains the live'
  Write-Host '     index.html (usually public_html).'
  Write-Host '  3. Upload -> choose monoram-upload.zip -> wait for 100%.'
  Write-Host '  4. Back in the folder, right-click the zip -> Extract.'
  Write-Host '  5. When asked about existing files, choose OVERWRITE ALL.'
  Write-Host '  6. Delete monoram-upload.zip from the server afterwards.'
  Write-Host '  7. Check .htaccess is listed in the folder.'
  Write-Host ''
  Write-Host 'Then open the site and View source. The second line reads:'
  Write-Host "    <!-- monoram build: $stampHuman  |  v=$version -->"
  Write-Rule
  exit 0
}

if ($DryRun) {
  Remove-Item $Staging -Recurse -Force
  Write-Host ''
  Write-Rule
  Write-Host 'DRY RUN FINISHED. Nothing was uploaded. Nothing on the server changed.'
  Write-Host ''
  Write-Host 'If the list above looks right — index.html, styles.css, app.js and'
  Write-Host '.htaccess are all in it, and no .sql or .md files are — then run'
  Write-Host 'the real thing:'
  Write-Host ''
  Write-Host '    .\deploy.ps1'
  Write-Rule
  exit 0
}

# ---------------------------------------------------------------------
#  5. Upload
#
#  One curl call per file. There is deliberately NO deletion step: the
#  script only ever adds and overwrites, it never removes a file from the
#  server. If it did, it would wipe anything you had put there by hand —
#  a photo, an old page, a file the host itself created — simply because
#  it is not in this folder. Additive is the safe choice for a live shop.
# ---------------------------------------------------------------------
$base = "ftp://$($cfg['FTP_HOST']):$($cfg['FTP_PORT'])/" + ($cfg['FTP_DIR'].Trim('/')) + '/'

$curlArgs = @('--ssl-reqd', '--ftp-create-dirs', '--disable-epsv', '-sS',
              '--connect-timeout', '20', '--retry', '2')
if ($cfg['FTP_INSECURE'] -eq 'yes') {
  $curlArgs += '-k'
  Write-Host ''
  Write-Host 'NOTE: certificate checking is off (FTP_INSECURE=yes in .env.deploy).'
  Write-Host '      The connection is still encrypted.'
}

Write-Host ''
Write-Rule
Write-Host 'Connecting...'
Write-Rule

$okCount = 0
$failed = @()
foreach ($rel in $files) {
  $local = (Get-Item (Join-Path $Staging $rel)).FullName
  $remote = $base + ($rel -replace '\\', '/')
  & $curl @curlArgs '--user' "$($cfg['FTP_USER']):$($cfg['FTP_PASS'])" '-T' $local $remote
  if ($LASTEXITCODE -eq 0) {
    Write-Host ("  uploaded  {0}" -f $rel)
    $okCount++
  } else {
    Write-Host ("  FAILED    {0}   (curl exit code {1})" -f $rel, $LASTEXITCODE)
    $failed += $rel
  }
}

Remove-Item $Staging -Recurse -Force

Write-Host ''
Write-Rule
if ($failed.Count -gt 0) {
  Write-Host "UPLOAD INCOMPLETE — $okCount of $($files.Count) files went up."
  Write-Host ''
  Write-Host 'These did not:'
  foreach ($rel in $failed) { Write-Host "  $rel" }
  Write-Host ''
  Write-Host 'The site on the server is now a MIXTURE of old and new files.'
  Write-Host 'Fix the cause and run the deploy again — it is safe to repeat.'
  Write-Host ''
  Write-Host 'Common causes:'
  Write-Host '  * Wrong username. cPanel usually wants the full user@domain'
  Write-Host '    form. Check FTP_USER in .env.deploy.'
  Write-Host '  * A certificate error (curl exit code 60). Set'
  Write-Host '    FTP_INSECURE=yes in .env.deploy and try again.'
  Write-Host '  * Connection refused (curl exit code 7). Your host may not'
  Write-Host '    allow FTPS on port 21. See DEPLOY.md, "If it goes wrong".'
  Write-Rule
  exit 1
}

Write-Host "DONE — $okCount files uploaded, build $stampHuman, v=$version."
Write-Host ''
Write-Host 'You do not need to clear anything on any phone. Every address on the'
Write-Host "page now ends in ?v=$version, which no phone has ever asked for, so"
Write-Host 'no phone can have an old copy of it. A tab left open reloads itself.'
Write-Host ''
Write-Host 'To check a phone has the new build:'
if ($cfg['SITE_URL'] -ne '') {
  Write-Host "  1. Open  $($cfg['SITE_URL'])"
} else {
  Write-Host '  1. Open the website'
}
Write-Host '  2. Menu -> View page source (or add  view-source:  in front of the'
Write-Host '     address). The second line reads:'
Write-Host "         <!-- monoram build: $stampHuman  |  v=$version -->"
Write-Host '  3. If it shows an older code, the phone is being served by a cache'
Write-Host '     in FRONT of Apache — LiteSpeed or Cloudflare. Section 5 of'
Write-Host '     .htaccess lists exactly what to check in cPanel.'
Write-Rule
