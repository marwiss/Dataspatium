<#
.SYNOPSIS
Runs a Dataspatium page headless in Edge (or Chrome) and Firefox from file:// and reports the console lines
`DATASPATIUM-LOG: ...` and the final `DATASPATIUM-TESTS: pass=N fail=M`.

.DESCRIPTION
Pages opened via file:// cannot be driven by node-based test runners without extra tooling, so the browsers'
own headless modes are used: Edge/Chrome print console messages to stderr with --enable-logging, Firefox prints
them to stdout when the profile sets devtools.console.stdout.content. Exit code: 0 all passed, 1 failures,
2 timeout or browser missing.

-Shards N splits the suite into N parts of about the same time per browser (?shard=i/N, tests/harness.js), and -Jobs K
runs up to K browsers at once. With -Jobs above 1 the files with a test marked serial run afterwards, one browser at a
time (?serial=skip, then ?serial=only), so that nothing measures time beside another browser. Each browser has its own
profile and log folder under %TEMP%\dm-tests-<code>\<run>, and the parts of one browser add up to one DATASPATIUM-TESTS
line. -Timings adds ?timings=1 (DATASPATIUM-TIME lines per file, for tools/affected_tests.py --weights).

-Lock waits until the machine is free (no %TEMP%\dm-matrix.lock, no other headless Edge or Firefox, no test containers)
and holds the lock while it runs, so that a short run never starts beside the matrix or a neighbour's suite (LD-01, LD-03).
An agent checks its own test files this way before the matrix:
  powershell -File tools/run-tests.ps1 -Lock -Browsers edge -Url "tests/index.html?files=raster,map"

.EXAMPLE
powershell -File tools/run-tests.ps1
powershell -File tools/run-tests.ps1 -Url "index.html?autorun=1" -TimeoutSec 600 -Browsers edge
powershell -File tools/run-tests.ps1 -Jobs 2 -TimeoutSec 1800
powershell -File tools/run-tests.ps1 -Shards 2 -Jobs 4 -TimeoutSec 1800
powershell -File tools/run-tests.ps1 -Lock -Browsers edge -Url "tests/index.html?files=raster,map"
#>
param(
  [string]$Url = "tests/index.html",
  [int]$TimeoutSec = 300,
  [string[]]$Browsers = @("edge", "firefox"),
  [int]$Width = 1400,
  [int]$Height = 1000,
  [int]$Shards = 1,
  [int]$Jobs = 1,
  [switch]$Timings,
  [switch]$Lock,
  [int]$LockWaitSec = 7200,
  [switch]$KeepProfile,
  [switch]$AllConsole
)
$ErrorActionPreference = "Stop"
$root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)

function Resolve-PageUrl([string]$u) {
  if ($u -match '^[a-z]+://') { return $u }
  # Split off query string and hash before resolving the file path.
  $hash = ""
  if ($u.Contains('#')) { $hashParts = $u.Split('#', 2); $u = $hashParts[0]; $hash = "#" + $hashParts[1] }
  $parts = $u.Split('?', 2)
  $abs = (Resolve-Path (Join-Path $root $parts[0])).Path -replace '\\', '/'
  $result = "file:///" + $abs
  if ($parts.Length -gt 1) { $result += "?" + $parts[1] }
  return $result + $hash
}

# Adds query parameters to an address, before its hash.
function Add-Query([string]$u, [string[]]$params) {
  $params = @($params | Where-Object { $_ })
  if (-not $params.Count) { return $u }
  $hash = ""
  if ($u.Contains('#')) { $hashParts = $u.Split('#', 2); $u = $hashParts[0]; $hash = "#" + $hashParts[1] }
  $sep = if ($u.Contains('?')) { "&" } else { "?" }
  return $u + $sep + ($params -join "&") + $hash
}

$pageUrl = Resolve-PageUrl $Url
# One folder per copy of the repository, and in it one per run: runs at the same time never share a profile or a log (LD-01).
$repoKey = [BitConverter]::ToString([System.Security.Cryptography.SHA256]::Create().ComputeHash([Text.Encoding]::UTF8.GetBytes((Resolve-Path (Join-Path $PSScriptRoot "..")).Path.ToLowerInvariant()))).Replace("-", "").Substring(0, 8)
$base = Join-Path $env:TEMP "dm-tests-$repoKey"
$work = Join-Path $base ((Get-Date -Format "yyyyMMdd-HHmmss") + "-$PID")
New-Item -ItemType Directory -Force $work | Out-Null
# Runs older than two days are removed; a run that is still going is never that old.
Get-ChildItem -Directory $base -ErrorAction SilentlyContinue | Where-Object { $_.Name -match '^\d{8}-\d{6}-\d+$' -and $_.LastWriteTime -lt (Get-Date).AddDays(-2) } |
  ForEach-Object { try { Remove-Item -Recurse -Force $_.FullName -ErrorAction Stop } catch {} }
$edgeExe = @("C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe", "C:\Program Files\Microsoft\Edge\Application\msedge.exe", "C:\Program Files\Google\Chrome\Application\chrome.exe") | Where-Object { Test-Path $_ } | Select-Object -First 1
$ffExe = @("C:\Program Files\Mozilla Firefox\firefox.exe", "C:\Program Files (x86)\Mozilla Firefox\firefox.exe") | Where-Object { Test-Path $_ } | Select-Object -First 1
# A browser that has just closed can hold its files for a moment more.
function Remove-WithRetry([string]$Path) {
  for ($i = 0; $i -lt 40; $i++) {
    try { Remove-Item -Recurse -Force $Path -ErrorAction Stop; return } catch { Start-Sleep -Milliseconds 500 }
  }
  Remove-Item -Recurse -Force $Path
}

# The jobs: one per browser and part, and with -Jobs above 1 one more per browser for the files that measure time.
$serialSplit = $Jobs -gt 1
$jobList = @()
$missing = @()
foreach ($browser in $Browsers) {
  if ($browser -notin @("edge", "firefox")) { Write-Output "Unknown browser: $browser"; continue }
  $exe = if ($browser -eq "edge") { $edgeExe } else { $ffExe }
  if (-not $exe) { $missing += $browser; continue }
  $parts = @()
  for ($i = 1; $i -le $Shards; $i++) {
    $parts += [pscustomobject]@{ Label = $(if ($Shards -gt 1) { "part $i/$Shards" } else { "" }); Name = $(if ($Shards -gt 1) { "$browser-$i-of-$Shards" } else { $browser });
      Params = @($(if ($Shards -gt 1) { "shard=$i/$Shards" }), $(if ($serialSplit) { "serial=skip" })); Serial = $false }
  }
  if ($serialSplit) { $parts += [pscustomobject]@{ Label = "serial"; Name = "$browser-serial"; Params = @("serial=only"); Serial = $true } }
  foreach ($p in $parts) {
    $dir = Join-Path $work $p.Name
    New-Item -ItemType Directory -Force $dir | Out-Null
    $profileDir = if ($KeepProfile) { Join-Path $base "keep-$($p.Name)" } else { Join-Path $dir "profile" }
    $jobList += [pscustomobject]@{ Browser = $browser; Exe = $exe; Label = $p.Label; Name = $p.Name; Serial = $p.Serial; Dir = $dir; Profile = $profileDir
      Url = (Add-Query $pageUrl (@($p.Params) + @($(if ($Timings) { "timings=1" })))); Logs = @(); Proc = $null; Start = $null; Seconds = 0
      Finished = $false; Offsets = @{}; Started = $false; Restarted = $false }
  }
}

function Start-Browser($j) {
  if ($j.Browser -eq "edge") {
    $log = Join-Path $j.Dir "edge.log"
    $edgeArgs = @('--headless', '--disable-gpu', '--no-first-run', '--no-default-browser-check', "--window-size=$Width,$Height",
                  '--enable-logging=stderr', '--v=0', "--user-data-dir=$($j.Profile)", $j.Url)
    $j.Logs = @($log)
    $j.Proc = Start-Process -FilePath $j.Exe -ArgumentList $edgeArgs -RedirectStandardError $log -RedirectStandardOutput (Join-Path $j.Dir "edge.out") -PassThru
  } else {
    New-Item -ItemType Directory -Force $j.Profile | Out-Null
    @(
      'user_pref("devtools.console.stdout.content", true);',
      'user_pref("browser.shell.checkDefaultBrowser", false);',
      'user_pref("datareporting.policy.dataSubmissionPolicyBypassNotification", true);',
      'user_pref("toolkit.telemetry.reportingpolicy.firstRun", false);',
      'user_pref("browser.startup.homepage_override.mstone", "ignore");',
      'user_pref("browser.aboutwelcome.enabled", false);'
    ) | Out-File -Encoding ascii (Join-Path $j.Profile "user.js")
    $log = Join-Path $j.Dir "firefox.log"
    $err = Join-Path $j.Dir "firefox.err"
    $j.Logs = @($log, $err)
    $j.Proc = Start-Process -FilePath $j.Exe -ArgumentList @('--headless', '--no-remote', '--width', "$Width", '--height', "$Height", '--profile', "`"$($j.Profile)`"", $j.Url) -RedirectStandardOutput $log -RedirectStandardError $err -PassThru
  }
  $j.Start = Get-Date
}

# "summary" when the summary line has come, "started" once the page has written a line, reading only what the browser wrote
# since the last look.
function Get-Progress($j) {
  $seen = ""
  foreach ($p in $j.Logs) {
    if (-not (Test-Path $p)) { continue }
    try {
      $fs = [System.IO.File]::Open($p, 'Open', 'Read', 'ReadWrite, Delete')
      try {
        $from = [Math]::Max(0, [long]($j.Offsets[$p]) - 64)
        if ($fs.Length -le $from) { continue }
        $fs.Seek($from, 'Begin') | Out-Null
        $buf = New-Object byte[] ($fs.Length - $from)
        $n = $fs.Read($buf, 0, $buf.Length)
        $j.Offsets[$p] = $from + $n
        $text = [Text.Encoding]::ASCII.GetString($buf, 0, $n)
        if ($text.Contains('DATASPATIUM-TESTS:')) { return "summary" }
        if ($text.Contains('DATASPATIUM-')) { $seen = "started" }
      } finally { $fs.Dispose() }
    } catch {}
  }
  return $seen
}

function Stop-Browser($j) {
  $proc = $j.Proc
  if ($proc -and -not $proc.HasExited) { try { Stop-Process -Id $proc.Id -Force -Confirm:$false -ErrorAction Stop } catch {} }
  $marker = $j.Profile
  Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -like "*$marker*" } | ForEach-Object {
    try { Stop-Process -Id $_.ProcessId -Force -Confirm:$false -ErrorAction Stop } catch {}
  }
}

# Runs the jobs with at most $max browsers at once.
function Invoke-Phase($list, [int]$max) {
  $queue = New-Object System.Collections.Queue
  foreach ($j in $list) { $queue.Enqueue($j) }
  $running = New-Object System.Collections.ArrayList
  while ($queue.Count -or $running.Count) {
    while ($running.Count -lt $max -and $queue.Count) {
      $j = $queue.Dequeue()
      if (-not $KeepProfile -and (Test-Path $j.Profile)) { Remove-WithRetry $j.Profile }
      Start-Browser $j
      [void]$running.Add($j)
    }
    Start-Sleep -Milliseconds 700
    foreach ($j in @($running)) {
      $state = Get-Progress $j
      if ($state) { $j.Started = $true }
      $done = $state -eq "summary"
      if ($done) { Start-Sleep -Milliseconds 500; $j.Finished = $true }
      # A browser that has written nothing after three minutes never opened the page (seen once in Firefox right after another
      # Firefox ended): it is started again, once.
      elseif (-not $j.Started -and -not $j.Restarted -and ((Get-Date) - $j.Start).TotalSeconds -gt 180) {
        Stop-Browser $j
        $j.Restarted = $true; $j.Offsets = @{}
        if (-not $KeepProfile -and (Test-Path $j.Profile)) { Remove-WithRetry $j.Profile }
        Start-Browser $j
        continue
      }
      if ($done -or ((Get-Date) - $j.Start).TotalSeconds -gt $TimeoutSec) {
        $j.Seconds = [int]((Get-Date) - $j.Start).TotalSeconds
        Stop-Browser $j
        $running.Remove($j)
      }
    }
  }
}

function Get-Messages($j) {
  $messages = @()
  if ($j.Browser -eq "firefox") { Start-Sleep -Milliseconds 800 }
  foreach ($f in $j.Logs) {
    if (-not (Test-Path $f)) { continue }
    foreach ($line in Get-Content $f) {
      if ($j.Browser -eq "edge") {
        # Chromium logs console messages as `INFO:CONSOLE:50] "text", source: ...` (older builds: `CONSOLE(50)]`).
        if ($line -match 'CONSOLE[:(]\d+\)?\]\s"(.*)", source:') { $messages += $Matches[1] }
      } else {
        # Firefox prints `console.log: "text"` (quoted) for strings.
        if ($line -match '^console\.(log|error|warn|info): "?(.*?)"?$') { $messages += $Matches[2] }
        elseif ($line -match 'JavaScript error|Error:') { $messages += $line }
      }
    }
  }
  return $messages
}

# The lock of the whole machine's browser runs (the matrix holds it too). Created atomically, so two runs never both take it; a
# lock left by a run of this script whose process is gone is taken over.
$lockFile = Join-Path $env:TEMP "dm-matrix.lock"
$lockText = "run-tests pid $PID $(Get-Date -Format s) $root"
function Test-Busy {
  $b = @(Get-CimInstance Win32_Process -Filter "Name='msedge.exe' OR Name='firefox.exe'" | Where-Object { $_.CommandLine -match 'headless' }).Count
  $c = 0
  if (Get-Command podman -ErrorAction SilentlyContinue) { $c = @(podman ps -q --filter label=org.testcontainers=true 2>$null).Count }
  if ($b -gt 0 -or $c -gt 0) { return "browsers=$b testcontainers=$c" }
  return ""
}
function Enter-Lock {
  $since = Get-Date; $told = $since
  while ($true) {
    if (Test-Path $lockFile) {
      $held = "$(Get-Content $lockFile -ErrorAction SilentlyContinue)"
      if ($held -match '^run-tests pid (\d+) ' -and -not (Get-Process -Id ([int]$Matches[1]) -ErrorAction SilentlyContinue)) { Remove-Item -Force $lockFile -ErrorAction SilentlyContinue }
      $busy = "lock: $held"
    } else { $busy = Test-Busy }
    if (-not $busy) {
      try {
        $fs = [System.IO.File]::Open($lockFile, 'CreateNew', 'Write', 'None')
        $bytes = [Text.Encoding]::UTF8.GetBytes($lockText); $fs.Write($bytes, 0, $bytes.Length); $fs.Dispose()
        return $true
      } catch { $busy = "lock taken" }
    }
    if (((Get-Date) - $since).TotalSeconds -gt $LockWaitSec) { Write-Output "===== no free machine within $LockWaitSec s ($busy)"; return $false }
    if (((Get-Date) - $told).TotalMinutes -ge 5) { Write-Output "waiting $([int]((Get-Date) - $since).TotalMinutes) min: $busy"; $told = Get-Date }
    Start-Sleep -Seconds 10
  }
}
if ($Lock -and -not (Enter-Lock)) { exit 2 }

$wall = Get-Date
try {
  Invoke-Phase @($jobList | Where-Object { -not $_.Serial }) $Jobs
  Invoke-Phase @($jobList | Where-Object { $_.Serial }) 1
} finally {
  if ($Lock -and (Test-Path $lockFile) -and "$(Get-Content $lockFile -ErrorAction SilentlyContinue)" -eq $lockText) { Remove-Item -Force $lockFile }
}

$totalFail = 0
$timedOut = $missing.Count -gt 0
foreach ($m in $missing) { Write-Output "===== ${m}: browser not found" }
foreach ($browser in $Browsers) {
  $mine = @($jobList | Where-Object { $_.Browser -eq $browser })
  if (-not $mine.Count) { continue }
  Write-Output "===== $browser ($($mine[0].Exe))"
  $pass = 0; $fail = 0; $notes = @()
  foreach ($j in $mine) {
    $p = 0; $f = 0; $saw = $false
    foreach ($m in (Get-Messages $j)) {
      if ($m -match '^DATASPATIUM-LOG: (.*)$') { Write-Output ("  " + $Matches[1]) }
      elseif ($m -match '^DATASPATIUM-TESTS: pass=(\d+) fail=(\d+)') { $saw = $true; $p = [int]$Matches[1]; $f = [int]$Matches[2] }
      elseif ($m -match '^DATASPATIUM-TIME: ') { Write-Output ("  " + $m) }
      elseif ($AllConsole -or $m -match 'Uncaught|Error|error|failed|Failed') { Write-Output ("  [console] " + $m) }
    }
    $label = if ($j.Label) { $j.Label + ": " } else { "" }
    if (-not $j.Finished) { $notes += "  TIMEOUT: ${label}no DATASPATIUM-TESTS summary within $TimeoutSec s (logs in $($j.Dir))"; $timedOut = $true }
    elseif (-not $saw) { $notes += "  ERROR: ${label}summary line found in the log but could not be parsed"; $timedOut = $true }
    elseif ($j.Label) { $notes += "  ${label}pass=$p fail=$f in $($j.Seconds) s" }
    if ($j.Restarted) { $notes += "  NOTE: ${label}started again after three minutes without a line from the page" }
    $pass += $p; $fail += $f
  }
  $notes | ForEach-Object { Write-Output $_ }
  Write-Output "  DATASPATIUM-TESTS: pass=$pass fail=$fail"
  $totalFail += $fail
}
$browserTime = ($jobList | ForEach-Object { $_.Seconds } | Measure-Object -Sum).Sum
Write-Output ("===== wall $([int]((Get-Date) - $wall).TotalSeconds) s, browser time $browserTime s, $($jobList.Count) browser(s), at most $Jobs at once; logs in $work")
if (-not $KeepProfile) { foreach ($j in $jobList) { if (Test-Path $j.Profile) { try { Remove-WithRetry $j.Profile } catch {} } } }

if ($timedOut) { exit 2 }
if ($totalFail -gt 0) { exit 1 }
exit 0
