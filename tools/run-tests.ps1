<#
.SYNOPSIS
Runs a Dataspatium page headless in Edge (or Chrome) and Firefox from file:// and reports the console lines
`DATASPATIUM-LOG: ...` and the final `DATASPATIUM-TESTS: pass=N fail=M`.

.DESCRIPTION
Pages opened via file:// cannot be driven by node-based test runners without extra tooling, so the browsers'
own headless modes are used: Edge/Chrome print console messages to stderr with --enable-logging, Firefox prints
them to stdout when the profile sets devtools.console.stdout.content. Exit code: 0 all passed, 1 failures,
2 timeout or browser missing.

.EXAMPLE
powershell -File tools/run-tests.ps1
powershell -File tools/run-tests.ps1 -Url "index.html?autorun=1" -TimeoutSec 600 -Browsers edge
#>
param(
  [string]$Url = "tests/index.html",
  [int]$TimeoutSec = 300,
  [string[]]$Browsers = @("edge", "firefox"),
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

$pageUrl = Resolve-PageUrl $Url
$work = Join-Path $env:TEMP "dataspatium-tests"
New-Item -ItemType Directory -Force $work | Out-Null
$edgeExe = @("C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe", "C:\Program Files\Microsoft\Edge\Application\msedge.exe", "C:\Program Files\Google\Chrome\Application\chrome.exe") | Where-Object { Test-Path $_ } | Select-Object -First 1
$ffExe = @("C:\Program Files\Mozilla Firefox\firefox.exe", "C:\Program Files (x86)\Mozilla Firefox\firefox.exe") | Where-Object { Test-Path $_ } | Select-Object -First 1
$totalFail = 0
$timedOut = $false
$missingBrowser = $false

function Wait-ForSummary([string[]]$paths, [int]$timeout) {
  $deadline = (Get-Date).AddSeconds($timeout)
  while ((Get-Date) -lt $deadline) {
    Start-Sleep -Milliseconds 700
    foreach ($p in $paths) {
      if ((Test-Path $p) -and (Select-String -Path $p -Pattern 'DATASPATIUM-TESTS:' -Quiet)) { Start-Sleep -Milliseconds 500; return $true }
    }
  }
  return $false
}

function Stop-Browser($proc, [string]$marker) {
  if ($proc -and -not $proc.HasExited) { try { Stop-Process -Id $proc.Id -Force -Confirm:$false -ErrorAction Stop } catch {} }
  Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -like "*$marker*" } | ForEach-Object {
    try { Stop-Process -Id $_.ProcessId -Force -Confirm:$false -ErrorAction Stop } catch {}
  }
}

function Report([string]$browser, [string[]]$messages, [bool]$finished) {
  Write-Output "===== $browser"
  $fail = 0
  $sawSummary = $false
  foreach ($m in $messages) {
    if ($m -match '^DATASPATIUM-LOG: (.*)$') { Write-Output ("  " + $Matches[1]) }
    elseif ($m -match '^DATASPATIUM-TESTS: pass=(\d+) fail=(\d+)') { $sawSummary = $true; $fail = [int]$Matches[2]; Write-Output ("  " + $m) }
    elseif ($AllConsole -or $m -match 'Uncaught|Error|error|failed|Failed') { Write-Output ("  [console] " + $m) }
  }
  if (-not $finished) { Write-Output "  TIMEOUT: no DATASPATIUM-TESTS summary within $TimeoutSec s"; $script:timedOut = $true }
  elseif (-not $sawSummary) { Write-Output "  ERROR: summary line found in the log but could not be parsed ($($messages.Count) console messages)"; $script:timedOut = $true }
  $script:totalFail += $fail
}

foreach ($browser in $Browsers) {
  if ($browser -eq "edge") {
    if (-not $edgeExe) { Write-Output "===== edge: browser not found"; $missingBrowser = $true; continue }
    $profileDir = Join-Path $work "edge-profile"
    if (-not $KeepProfile -and (Test-Path $profileDir)) { Remove-Item -Recurse -Force $profileDir }
    $log = Join-Path $work "edge.log"
    if (Test-Path $log) { Remove-Item -Force $log }
    $edgeArgs = @('--headless', '--disable-gpu', '--no-first-run', '--no-default-browser-check', '--window-size=1400,1000',
                  '--enable-logging=stderr', '--v=0', "--user-data-dir=$profileDir", $pageUrl)
    $proc = Start-Process -FilePath $edgeExe -ArgumentList $edgeArgs -RedirectStandardError $log -RedirectStandardOutput (Join-Path $work "edge.out") -PassThru
    $finished = Wait-ForSummary @($log) $TimeoutSec
    Stop-Browser $proc "edge-profile"
    $messages = @()
    if (Test-Path $log) {
      foreach ($line in Get-Content $log) {
        # Chromium logs console messages as `INFO:CONSOLE:50] "text", source: ...` (older builds: `CONSOLE(50)]`).
        if ($line -match 'CONSOLE[:(]\d+\)?\]\s"(.*)", source:') { $messages += $Matches[1] }
      }
    }
    Report "edge ($edgeExe)" $messages $finished
  }
  elseif ($browser -eq "firefox") {
    if (-not $ffExe) { Write-Output "===== firefox: browser not found"; $missingBrowser = $true; continue }
    $profileDir = Join-Path $work "firefox-profile"
    if (-not $KeepProfile -and (Test-Path $profileDir)) { Remove-Item -Recurse -Force $profileDir }
    New-Item -ItemType Directory -Force $profileDir | Out-Null
    @(
      'user_pref("devtools.console.stdout.content", true);',
      'user_pref("browser.shell.checkDefaultBrowser", false);',
      'user_pref("datareporting.policy.dataSubmissionPolicyBypassNotification", true);',
      'user_pref("toolkit.telemetry.reportingpolicy.firstRun", false);',
      'user_pref("browser.startup.homepage_override.mstone", "ignore");',
      'user_pref("browser.aboutwelcome.enabled", false);'
    ) | Out-File -Encoding ascii (Join-Path $profileDir "user.js")
    $log = Join-Path $work "firefox.log"
    $err = Join-Path $work "firefox.err"
    foreach ($f in @($log, $err)) { if (Test-Path $f) { Remove-Item -Force $f } }
    $proc = Start-Process -FilePath $ffExe -ArgumentList @('--headless', '--no-remote', '--profile', "`"$profileDir`"", $pageUrl) -RedirectStandardOutput $log -RedirectStandardError $err -PassThru
    $finished = Wait-ForSummary @($log, $err) $TimeoutSec
    Stop-Browser $proc "firefox-profile"
    Start-Sleep -Milliseconds 800
    $messages = @()
    foreach ($f in @($log, $err)) {
      if (Test-Path $f) {
        foreach ($line in Get-Content $f) {
          # Firefox prints `console.log: "text"` (quoted) for strings.
          if ($line -match '^console\.(log|error|warn|info): "?(.*?)"?$') { $messages += $Matches[2] }
          elseif ($line -match 'JavaScript error|Error:') { $messages += $line }
        }
      }
    }
    Report "firefox ($ffExe)" $messages $finished
  }
  else { Write-Output "Unknown browser: $browser" }
}

if ($missingBrowser -or $timedOut) { exit 2 }
if ($totalFail -gt 0) { exit 1 }
exit 0
