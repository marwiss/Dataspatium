<#
.SYNOPSIS
Takes a screenshot of a Dataspatium page with headless Edge/Chrome after the app has had time to initialise.

.DESCRIPTION
Chromium's own --screenshot flag fires right after the load event, before IndexedDB and other asynchronous
initialisation finish. This script instead starts the browser with the DevTools protocol enabled, waits a real
number of milliseconds and then asks for Page.captureScreenshot. Optionally emulates light or dark colour scheme.

.EXAMPLE
powershell -File tools/screenshot.ps1 -Url "index.html#/inhamta" -Out shots/inhamta.png -Theme light
#>
param(
  [Parameter(Mandatory = $true)][string]$Url,
  [Parameter(Mandatory = $true)][string]$Out,
  [int]$WaitMs = 4000,
  [int]$Width = 1440,
  [int]$Height = 900,
  [ValidateSet("", "light", "dark")][string]$Theme = "",
  [string]$Eval = "",
  [string]$EvalFile = "",
  [int]$WaitAfterEvalMs = 1500,
  [int]$Port = 9333
)
$ErrorActionPreference = "Stop"
$root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)

function Resolve-PageUrl([string]$u) {
  if ($u -match '^[a-z]+://') { return $u }
  $hash = ""
  if ($u.Contains('#')) { $hashParts = $u.Split('#', 2); $u = $hashParts[0]; $hash = "#" + $hashParts[1] }
  $parts = $u.Split('?', 2)
  $abs = (Resolve-Path (Join-Path $root $parts[0])).Path -replace '\\', '/'
  $result = "file:///" + $abs
  if ($parts.Length -gt 1) { $result += "?" + $parts[1] }
  return $result + $hash
}

$exe = @("C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe", "C:\Program Files\Microsoft\Edge\Application\msedge.exe", "C:\Program Files\Google\Chrome\Application\chrome.exe") | Where-Object { Test-Path $_ } | Select-Object -First 1
if (-not $exe) { Write-Error "No Chromium browser found"; exit 2 }
$pageUrl = Resolve-PageUrl $Url
$profileDir = Join-Path $env:TEMP "dataspatium-shot-profile"
$outPath = if ([IO.Path]::IsPathRooted($Out)) { $Out } else { Join-Path (Get-Location) $Out }
New-Item -ItemType Directory -Force (Split-Path -Parent $outPath) | Out-Null

$proc = Start-Process -FilePath $exe -ArgumentList @('--headless', '--disable-gpu', '--no-first-run', '--hide-scrollbars', "--window-size=$Width,$Height", "--remote-debugging-port=$Port", "--user-data-dir=$profileDir", $pageUrl) -PassThru
try {
  $targets = $null
  for ($i = 0; $i -lt 50 -and -not $targets; $i++) {
    Start-Sleep -Milliseconds 200
    try { $targets = Invoke-RestMethod -Uri "http://127.0.0.1:$Port/json" -TimeoutSec 2 } catch { $targets = $null }
  }
  if (-not $targets) { throw "DevTools endpoint did not answer on port $Port" }
  $page = $targets | Where-Object { $_.type -eq 'page' } | Select-Object -First 1
  Start-Sleep -Milliseconds $WaitMs

  $ws = New-Object System.Net.WebSockets.ClientWebSocket
  $ws.ConnectAsync([Uri]$page.webSocketDebuggerUrl, [Threading.CancellationToken]::None).Wait()
  $seq = 0
  function Send-Cdp([string]$method, $params) {
    $script:seq++
    $msg = @{ id = $script:seq; method = $method; params = $params } | ConvertTo-Json -Compress -Depth 8
    $bytes = [Text.Encoding]::UTF8.GetBytes($msg)
    $ws.SendAsync([ArraySegment[byte]]::new($bytes), [Net.WebSockets.WebSocketMessageType]::Text, $true, [Threading.CancellationToken]::None).Wait()
    $wanted = $script:seq
    $buffer = New-Object byte[] 1048576
    while ($true) {
      $ms = New-Object IO.MemoryStream
      do {
        $segment = [ArraySegment[byte]]::new($buffer)
        $result = $ws.ReceiveAsync($segment, [Threading.CancellationToken]::None).Result
        $ms.Write($buffer, 0, $result.Count)
      } while (-not $result.EndOfMessage)
      $text = [Text.Encoding]::UTF8.GetString($ms.ToArray())
      $obj = $text | ConvertFrom-Json
      if ($obj.id -eq $wanted) { return $obj }
    }
  }
  if ($Theme) { Send-Cdp 'Emulation.setEmulatedMedia' @{ features = @(@{ name = 'prefers-color-scheme'; value = $Theme }) } | Out-Null; Start-Sleep -Milliseconds 300 }
  if ($EvalFile) { $Eval = Get-Content -Raw -Encoding UTF8 $EvalFile }
  if ($Eval) {
    # Run a JavaScript expression in the page (for example to click a button) before capturing.
    $evalResult = Send-Cdp 'Runtime.evaluate' @{ expression = $Eval; awaitPromise = $true; returnByValue = $true }
    if ($evalResult.result.exceptionDetails) { Write-Warning ("Eval failed: " + ($evalResult.result.exceptionDetails | ConvertTo-Json -Compress)) }
    elseif ($null -ne $evalResult.result.result.value) { Write-Output ("eval: " + ($evalResult.result.result.value | ConvertTo-Json -Compress -Depth 6)) }
    Start-Sleep -Milliseconds $WaitAfterEvalMs
  }
  $shot = Send-Cdp 'Page.captureScreenshot' @{ format = 'png' }
  [IO.File]::WriteAllBytes($outPath, [Convert]::FromBase64String($shot.result.data))
  $ws.Dispose()
  Write-Output "saved $outPath ($((Get-Item $outPath).Length) bytes)"
} finally {
  if ($proc -and -not $proc.HasExited) { Stop-Process -Id $proc.Id -Force -Confirm:$false }
  Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -like "*dataspatium-shot-profile*" } | ForEach-Object { try { Stop-Process -Id $_.ProcessId -Force -Confirm:$false -ErrorAction Stop } catch {} }
}
