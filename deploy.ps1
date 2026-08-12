<#
=====================================================================
  Monoram Jewellers — upload the website to cPanel over FTPS
  Windows version. Does exactly the same thing as deploy.sh.

  USE — open PowerShell in this folder, then:

      .\deploy.ps1 -DryRun      show what would be uploaded, change nothing
      .\deploy.ps1              actually upload

  If Windows refuses to run it ("running scripts is disabled"), use:

      powershell -ExecutionPolicy Bypass -File .\deploy.ps1 -DryRun

  Read DEPLOY.md before the first run. Always do a -DryRun first.

  WHAT IT NEEDS INSTALLED: nothing.
  It uploads with curl.exe, which is part of Windows 10 and Windows 11.

  WHAT IT DOES
    1. Reads the server login from .env.deploy (never from this file).
    2. Copies the website files — and only those — into a throwaway
       folder called .deploy-staging.
    3. Stamps today's date into that copy of styles.css and sw.js, so
       you can tell at a glance whether the live site is the new build.
    4. Uploads the folder to the server, one file at a time.

  It never deletes anything on the server. See the note by UPLOAD below.
=====================================================================
#>

[CmdletBinding()]
param(
  [switch]$DryRun,
  # Build monoram-upload.zip instead of uploading — for the cPanel File
  # Manager route. Needs no .env.deploy and no internet connection.
  [switch]$Zip
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
# The zip route never connects to anything, so it needs no server login.
if (-not $Zip) {

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

}   # end of: if (-not $Zip)

# ---------------------------------------------------------------------
#  2. Which tool will do the uploading
# ---------------------------------------------------------------------
$curl = Join-Path $env:SystemRoot 'System32\curl.exe'
if (-not (Test-Path $curl)) {
  $found = Get-Command curl.exe -ErrorAction SilentlyContinue
  if ($found) { $curl = $found.Source } else { $curl = $null }
}
if (-not $DryRun -and -not $Zip -and -not $curl) {
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

# --- the version marker -------------------------------------------------
# styles.css line 1, and the offline cache name in sw.js. Both are changed
# ONLY in the staging copy — the files in this folder are left alone, so
# your own copy never fills up with deploy noise. On the live site they
# carry the date, which is how you tell the new build from the old one.
$cssPath = Join-Path $Staging 'styles.css'
if (Test-Path $cssPath) {
  $css = Get-Content $cssPath -Raw
  $css = [regex]::Replace($css, '^/\* build:.*?\*/', "/* build: $stampHuman */")
  [System.IO.File]::WriteAllText((Resolve-Path $cssPath), $css)
}
$swPath = Join-Path $Staging 'sw.js'
if (Test-Path $swPath) {
  $sw = Get-Content $swPath -Raw
  $sw = [regex]::Replace($sw, 'const CACHE = "(monoram-v\d+)"', "const CACHE = `"`$1-$stampTag`"")
  [System.IO.File]::WriteAllText((Resolve-Path $swPath), $sw)
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
if ($Zip) {
  Write-Host 'BUILDING A ZIP for the cPanel File Manager. Nothing is uploaded.'
} elseif ($DryRun) {
  Write-Host 'DRY RUN — nothing will be uploaded and nothing will change.'
} else {
  Write-Host "UPLOADING to $($cfg['FTP_HOST'])"
}
Write-Rule
Write-Host "From : $root"
if (-not $Zip) {
  Write-Host "To   : $($cfg['FTP_DIR'])/  on  $($cfg['FTP_HOST'])  (port $($cfg['FTP_PORT']), FTPS)"
}
Write-Host "Build: $stampHuman"
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
  Write-Host 'Then check the site, and confirm the first line of styles.css'
  Write-Host "reads:   /* build: $stampHuman */"
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

Write-Host "DONE — $okCount files uploaded, build $stampHuman."
Write-Host ''
Write-Host 'Now check it on your phone:'
if ($cfg['SITE_URL'] -ne '') {
  Write-Host "  1. Open  $($cfg['SITE_URL'])"
} else {
  Write-Host '  1. Open the website'
}
Write-Host '  2. If it looks unchanged, clear the phone''s copy:'
Write-Host '     Chrome -> three dots -> Settings -> Site settings -> the site'
Write-Host '     -> Clear & reset'
Write-Host '  3. To prove the new build arrived, view the page source and look'
Write-Host '     at the first line of styles.css. It should read:'
Write-Host "         /* build: $stampHuman */"
Write-Rule
