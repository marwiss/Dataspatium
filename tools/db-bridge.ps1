<#
Dataspatium database bridge for Windows (PowerShell 5.1 or later). SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0

A small local HTTP service that Dataspatium opens from Inhämta -> "Databas via bryggan". It lists the ODBC data
sources on this computer, the tables and columns of a database, and runs queries through ODBC, OLE DB or
SqlClient, so that Access, Excel, SQL Server and every ODBC source reachable from this computer can be imported
into the app. Nothing is installed and nothing leaves the computer: the service listens on 127.0.0.1 only,
requires the token printed at start, answers CORS only for the app's origins (a page opened from a folder sends
Origin "null") and is read-only unless -AllowWrite is given; even then every write needs the user's approval in
the app (the request carries approved: true). Close the window, press Ctrl+C or POST /stop to stop it.

As a go-between (POST /fetch) it fetches an https address for the app when the service does not let the browser read its
answer (no CORS), but only from the hosts named with -AllowHosts; the page can never add one. It refuses addresses on this
computer or the local network, sends only a few headers (no cookies), follows at most three redirects to allowed hosts and
stops at -MaxFetchMb.

Usage:
  powershell -ExecutionPolicy Bypass -File tools\db-bridge.ps1
  powershell -ExecutionPolicy Bypass -File tools\db-bridge.ps1 -Port 8731 -AllowWrite
Parameters: -Port (0 = random), -Token (default random), -AllowWrite, -MaxRows (default 100000),
  -AllowOrigins (default "null" and https://marwiss.github.io; http://localhost and http://127.0.0.1 are always allowed),
  -AllowHosts (the hosts /fetch may reach, none by default), -MaxFetchMb (default 50).

Protocol (JSON): GET / (info), GET /sources (DSNs, ODBC drivers, OLE DB providers), POST /tables {source},
  POST /columns {source, table}, POST /rows {source, table, limit}, POST /query {source, sql, limit, approved},
  GET /log, GET or POST /stop, POST /fetch {url, method, headers, body (base64)} -> {status, statusText, headers, body}.
  With -AllowCommands: POST /commands {name, args} -> {id, state} from a program on this computer, GET /commands/<id> its state
  and answer, GET /commands/catalog the app's commands; the app registers them (POST /commands/catalog {commands}), picks
  commands up (GET /commands/next) and answers (POST /commands/<id>/result {ok, result, error}). POST /commands/<id>/cancel takes a queued command out of
  the queue and marks a running one cancelling, which the app stops at its next check. One thread: a poll answers at once.
  A source is {kind: access|excel|sqlserver|dsn|odbc|oledb, ...} with path, password,
  server, database, user, dsn or connectionString depending on the kind.
#>
param(
  [int]$Port = 0,
  [string]$Token = "",
  [switch]$AllowWrite,
  [string[]]$AllowOrigins = @("null", "https://marwiss.github.io"),
  [int]$MaxRows = 100000,
  [string[]]$AllowHosts = @(),
  [int]$MaxFetchMb = 50,
  [switch]$AllowCommands
)
$ErrorActionPreference = "Stop"
$Version = "2.6.0"
$Kinds = @("access", "excel", "sqlserver", "dsn", "odbc", "oledb")
if ($Port -eq 0) { $Port = Get-Random -Minimum 49152 -Maximum 65535 }
if ($Token -eq "") {
  $bytes = New-Object byte[] 18
  (New-Object System.Security.Cryptography.RNGCryptoServiceProvider).GetBytes($bytes)
  $Token = [Convert]::ToBase64String($bytes).Replace("+", "-").Replace("/", "_").TrimEnd("=")
}
$listener = New-Object System.Net.HttpListener
$prefix = "http://127.0.0.1:$Port/"
$listener.Prefixes.Add($prefix)
try { $listener.Start() } catch { Write-Output ("Kunde inte lyssna på " + $prefix + " (" + $_.Exception.Message + "). Prova en annan port med -Port."); exit 1 }
Write-Output ("Dataspatium-databasbrygga " + $Version + " lyssnar på " + $prefix)
Write-Output ("Token: " + $Token)
Write-Output "Klistra in adressen och token i appen under Inhämta -> Databas via bryggan. Stäng fönstret för att stoppa."
if ($AllowHosts.Count -gt 0) { Write-Output ("Hämtar via bryggan från: " + ($AllowHosts -join ", ")) }
if ($AllowWrite) { Write-Output "Skrivning TILLÅTEN (-AllowWrite); varje skrivning kräver ändå godkännande i appen." } else { Write-Output "Skrivskyddad: bara SELECT." }
if ($AllowCommands) { Write-Output "Kommandon TILLÅTNA (-AllowCommands): program på datorn kan köra appens kommandon när Styrning utifrån är på i appen." }

# ---- the command queue (-AllowCommands): programs on this computer -> the app that has Styrning utifrån on ----
$Commands = @{ Catalog = $null; Seen = [DateTime]::MinValue; Queue = New-Object System.Collections.ArrayList; Items = @{}; Seq = 0 }
function Test-CommandsConnected() { return (($null -ne $Commands.Catalog) -and (((Get-Date) - $Commands.Seen).TotalSeconds -lt 90)) }
function Invoke-CommandRoute($ctx, $method, $path, $body) {
  if ($method -eq "GET" -and $path -eq "/commands/catalog") { Send-Json $ctx 200 @{ connected = (Test-CommandsConnected); commands = $(if ($null -eq $Commands.Catalog) { @() } else { @($Commands.Catalog) }); queued = $Commands.Queue.Count }; return }
  if ($method -eq "GET" -and $path -eq "/commands/next") {
    $Commands.Seen = Get-Date
    if ($Commands.Queue.Count -gt 0) {
      $id = [string]$Commands.Queue[0]; $Commands.Queue.RemoveAt(0)
      $it = $Commands.Items[$id]; $it.state = "running"
      Send-Json $ctx 200 @{ id = $id; name = $it.name; args = $it.args }
    } else { Send-Json $ctx 200 @{} }
    return
  }
  if ($method -eq "POST" -and $path -eq "/commands/catalog") { $Commands.Catalog = @($body.commands); $Commands.Seen = Get-Date; Send-Json $ctx 200 @{ registered = $Commands.Catalog.Count }; return }
  if ($method -eq "POST" -and $path -eq "/commands") {
    if (-not (Test-CommandsConnected)) { Send-Json $ctx 409 @{ error = "Ingen app är ansluten: öppna Dataspatium, anslut bryggan och slå på Styrning utifrån under Hantera -> Internetåtkomst" }; return }
    if ($Commands.Queue.Count -ge 100) { Send-Json $ctx 429 @{ error = "Kön är full" }; return }
    $name = [string]$body.name
    if ($name.Trim() -eq "") { Send-Json $ctx 400 @{ error = "Ange name" }; return }
    $Commands.Seq++
    $id = "c" + $Commands.Seq + "-" + ([Guid]::NewGuid().ToString("N").Substring(0, 8))
    $Commands.Items[$id] = @{ id = $id; name = $name.Trim(); args = $body.args; state = "queued"; ok = $null; result = $null; error = $null; cancelled = $false }
    [void]$Commands.Queue.Add($id)
    Send-Json $ctx 202 @{ id = $id; state = "queued" }
    return
  }
  if ($method -eq "POST" -and $path -like "/commands/*/result") {
    $id = $path.Substring(10); $id = $id.Substring(0, $id.Length - 7)
    $it = $Commands.Items[$id]
    if ($null -eq $it) { Send-Json $ctx 404 @{ error = "Okänt kommando " + $id }; return }
    $it.cancelled = ($it.state -eq "cancelling")
    $it.state = "done"; $it.ok = [bool]$body.ok; $it.result = $body.result; $it.error = $body.error; $Commands.Seen = Get-Date
    Send-Json $ctx 200 @{ id = $id; state = "done" }
    return
  }
  if ($method -eq "POST" -and $path -like "/commands/*/cancel") {
    $id = $path.Substring(10); $id = $id.Substring(0, $id.Length - 7)
    $it = $Commands.Items[$id]
    if ($null -eq $it) { Send-Json $ctx 404 @{ error = "Okänt kommando " + $id }; return }
    if ($it.state -eq "queued") { $Commands.Queue.Remove($id); $it.state = "cancelled"; $it.cancelled = $true; $it.ok = $false; $it.error = "Avbrutet"; Send-Json $ctx 200 @{ id = $id; state = "cancelled" }; return }
    if ($it.state -eq "running" -or $it.state -eq "cancelling") { $it.state = "cancelling"; Send-Json $ctx 202 @{ id = $id; state = "cancelling" }; return }
    Send-Json $ctx 409 @{ error = "Kommandot är redan klart"; id = $id; state = $it.state }
    return
  }
  if ($method -eq "GET" -and $path -like "/commands/*") {
    $id = $path.Substring(10)
    $it = $Commands.Items[$id]
    if ($null -eq $it) { Send-Json $ctx 404 @{ error = "Okänt kommando " + $id }; return }
    Send-Json $ctx 200 @{ id = $it.id; name = $it.name; state = $it.state; ok = $it.ok; result = $it.result; error = $it.error; cancelled = [bool]$it.cancelled }
    return
  }
  Send-Json $ctx 404 @{ error = "Okänd sökväg " + $path }
}

function Send-Json($ctx, $status, $obj) {
  $json = $obj | ConvertTo-Json -Depth 8 -Compress
  $buf = [Text.Encoding]::UTF8.GetBytes($json)
  $ctx.Response.StatusCode = $status
  $ctx.Response.ContentType = "application/json; charset=utf-8"
  $ctx.Response.ContentLength64 = $buf.Length
  $ctx.Response.OutputStream.Write($buf, 0, $buf.Length)
  $ctx.Response.OutputStream.Close()
}

function Get-ConnectionInfo($source) {
  if ($null -eq $source -or -not $source.kind) { throw "Källan saknar kind." }
  switch ($source.kind) {
    "access" {
      if (-not $source.path) { throw "Ange sökvägen till Access-filen." }
      $cs = "Provider=Microsoft.ACE.OLEDB.12.0;Data Source=" + $source.path + ";"
      if ($source.password) { $cs += "Jet OLEDB:Database Password=" + $source.password + ";" }
      return @{ provider = "oledb"; cs = $cs }
    }
    "excel" {
      if (-not $source.path) { throw "Ange sökvägen till Excel-filen." }
      return @{ provider = "oledb"; cs = "Provider=Microsoft.ACE.OLEDB.12.0;Data Source=" + $source.path + ";Extended Properties=""Excel 12.0 Xml;HDR=YES;IMEX=1"";" }
    }
    "sqlserver" {
      if (-not $source.server) { throw "Ange servern." }
      $cs = "Server=" + $source.server + ";"
      if ($source.database) { $cs += "Database=" + $source.database + ";" }
      if ($source.user) { $cs += "User Id=" + $source.user + ";Password=" + $source.password + ";" } else { $cs += "Integrated Security=SSPI;" }
      $cs += "Encrypt=False;Connect Timeout=15;"
      return @{ provider = "sqlclient"; cs = $cs }
    }
    "dsn" {
      if (-not $source.dsn) { throw "Ange DSN." }
      $cs = "DSN=" + $source.dsn + ";"
      if ($source.user) { $cs += "Uid=" + $source.user + ";Pwd=" + $source.password + ";" }
      return @{ provider = "odbc"; cs = $cs }
    }
    "odbc" { if (-not $source.connectionString) { throw "Ange anslutningssträngen." }; return @{ provider = "odbc"; cs = $source.connectionString } }
    "oledb" { if (-not $source.connectionString) { throw "Ange anslutningssträngen." }; return @{ provider = "oledb"; cs = $source.connectionString } }
    default { throw ("Okänd källtyp: " + $source.kind) }
  }
}

function Open-Connection($source) {
  $info = Get-ConnectionInfo $source
  switch ($info.provider) {
    "oledb" { $cn = New-Object System.Data.OleDb.OleDbConnection($info.cs) }
    "odbc" { $cn = New-Object System.Data.Odbc.OdbcConnection($info.cs) }
    "sqlclient" { $cn = New-Object System.Data.SqlClient.SqlConnection($info.cs) }
  }
  $cn.Open()
  return $cn
}

# Identifier quoting per provider: [name] for OLE DB (Access, Excel) and SQL Server, "name" for ODBC.
function Quote-Name($cn, $name) {
  if ($cn -is [System.Data.Odbc.OdbcConnection]) { return '"' + ([string]$name).Replace('"', '""') + '"' }
  return "[" + ([string]$name).Replace("]", "]]") + "]"
}

function Test-ReadOnly($sql) {
  $s = ($sql -replace "/\*[\s\S]*?\*/", " " -replace "--[^\r\n]*", " ").Trim()
  if ($s.TrimEnd(";").Contains(";")) { return $false }
  $first = ($s -split "\s+")[0].ToUpperInvariant()
  return ($first -eq "SELECT" -or $first -eq "WITH" -or $first -eq "VALUES")
}

function Convert-Value($v) {
  if ($null -eq $v -or $v -is [DBNull]) { return $null }
  if ($v -is [DateTime]) { return $v.ToString("yyyy-MM-ddTHH:mm:ss") }
  if ($v -is [DateTimeOffset]) { return $v.UtcDateTime.ToString("yyyy-MM-ddTHH:mm:ss") }
  if ($v -is [byte[]]) { return [Convert]::ToBase64String($v) }
  if ($v -is [Guid] -or $v -is [TimeSpan] -or $v -is [char]) { return $v.ToString() }
  return $v
}

function Read-Table($cn, $sql, $limit) {
  $cmd = $cn.CreateCommand()
  $cmd.CommandText = $sql
  $cmd.CommandTimeout = 120
  $rd = $cmd.ExecuteReader()
  $cols = @()
  for ($i = 0; $i -lt $rd.FieldCount; $i++) { $cols += @{ name = $rd.GetName($i); type = $rd.GetFieldType($i).Name } }
  $rows = New-Object System.Collections.ArrayList
  $truncated = $false
  while ($rd.Read()) {
    if ($rows.Count -ge $limit) { $truncated = $true; break }
    $row = New-Object object[] $rd.FieldCount
    for ($i = 0; $i -lt $rd.FieldCount; $i++) { if ($rd.IsDBNull($i)) { $row[$i] = $null } else { $row[$i] = Convert-Value $rd.GetValue($i) } }
    [void]$rows.Add($row)
  }
  $rd.Close()
  return @{ columns = $cols; rows = $rows; truncated = $truncated }
}

function Get-Columns($cn, $table) {
  $cmd = $cn.CreateCommand()
  $cmd.CommandText = "SELECT * FROM " + (Quote-Name $cn $table) + " WHERE 1 = 0"
  $rd = $cmd.ExecuteReader([System.Data.CommandBehavior]::SchemaOnly)
  $schema = $rd.GetSchemaTable()
  $out = @()
  foreach ($r in $schema.Rows) {
    $nullable = $true
    if ($schema.Columns.Contains("AllowDBNull") -and -not ($r["AllowDBNull"] -is [DBNull])) { $nullable = [bool]$r["AllowDBNull"] }
    $out += @{ name = [string]$r["ColumnName"]; type = ([Type]$r["DataType"]).Name; nullable = $nullable }
  }
  $rd.Close()
  return $out
}

function Get-Tables($cn) {
  $out = @()
  if ($cn -is [System.Data.OleDb.OleDbConnection]) {
    $schema = $cn.GetOleDbSchemaTable([System.Data.OleDb.OleDbSchemaGuid]::Tables, @($null, $null, $null, $null))
    foreach ($r in $schema.Rows) {
      $type = [string]$r["TABLE_TYPE"]
      if ($type -eq "TABLE" -or $type -eq "VIEW") { $out += @{ name = [string]$r["TABLE_NAME"]; type = $type } }
    }
  } else {
    $schema = $cn.GetSchema("Tables")
    foreach ($r in $schema.Rows) {
      $type = ""
      if ($schema.Columns.Contains("TABLE_TYPE")) { $type = [string]$r["TABLE_TYPE"] }
      if ($type -eq "" -or $type -eq "TABLE" -or $type -eq "VIEW" -or $type -eq "BASE TABLE") {
        $name = [string]$r["TABLE_NAME"]
        if ($schema.Columns.Contains("TABLE_SCHEMA") -and -not ($r["TABLE_SCHEMA"] -is [DBNull]) -and [string]$r["TABLE_SCHEMA"] -ne "" -and [string]$r["TABLE_SCHEMA"] -ne "dbo") { $name = [string]$r["TABLE_SCHEMA"] + "." + $name }
        if ($type -eq "BASE TABLE") { $type = "TABLE" }
        $out += @{ name = $name; type = $type }
      }
    }
  }
  return $out
}

function Get-Sources() {
  $dsns = @(); $drivers = @(); $providers = @()
  try { foreach ($d in (Get-OdbcDsn)) { $dsns += @{ name = $d.Name; driver = $d.DriverName; platform = $d.Platform; scope = $d.DsnType } } } catch { }
  try { foreach ($d in (Get-OdbcDriver -Platform 64-bit)) { $drivers += $d.Name } } catch { }
  try {
    $en = [System.Data.OleDb.OleDbEnumerator]::GetRootEnumerator()
    while ($en.Read()) { $providers += [string]$en["SOURCES_NAME"] }
    $en.Close()
  } catch { }
  return @{ dsns = $dsns; drivers = $drivers; providers = $providers }
}

$log = New-Object System.Collections.ArrayList
# ---- the go-between (POST /fetch) ----
# Only https to the hosts named with -AllowHosts (none by default; the page can never add one), never to this computer or
# the local network, a few headers and no cookies, at most three redirects to allowed hosts and -MaxFetchMb. The address
# is checked just before the request; .NET then looks the name up from its own cache, so the window for a name that changes
# in between is small (the Python bridge connects to the checked address itself).
$FetchHeaders = @("accept", "accept-language", "authorization", "content-type", "range", "if-none-match", "if-modified-since")
$NeverHeaders = @("cookie", "cookie2", "host", "origin", "referer", "connection", "content-length", "transfer-encoding", "te", "upgrade", "expect", "keep-alive", "via", "forwarded")
$ReturnHeaders = @("Content-Type", "Content-Range", "ETag", "Last-Modified", "Link", "X-Total-Count", "Retry-After")
$AllowHosts = @($AllowHosts | ForEach-Object { ([string]$_).Trim().ToLowerInvariant() } | Where-Object { $_ -ne "" })
[Net.ServicePointManager]::SecurityProtocol = [Net.ServicePointManager]::SecurityProtocol -bor [Net.SecurityProtocolType]::Tls12

function Test-HeaderAllowed([string]$name) {
  $n = $name.ToLowerInvariant()
  if (($NeverHeaders -contains $n) -or $n.StartsWith("proxy-") -or $n.StartsWith("sec-") -or ($name -notmatch '^[A-Za-z0-9-]{1,64}$')) { return $false }
  return ($FetchHeaders -contains $n) -or ($n -match 'key|token|subscription')
}

function Test-PublicHost([string]$hostName) {
  $addresses = @([System.Net.Dns]::GetHostAddresses($hostName))
  if ($addresses.Count -eq 0) { return $false }
  foreach ($a in $addresses) {
    if ($a.IsIPv4MappedToIPv6) { $a = $a.MapToIPv4() }
    $b = $a.GetAddressBytes()
    if ([System.Net.IPAddress]::IsLoopback($a) -or $a.IsIPv6LinkLocal -or $a.IsIPv6SiteLocal -or $a.IsIPv6Multicast) { return $false }
    if ($a.AddressFamily -eq [System.Net.Sockets.AddressFamily]::InterNetwork) {
      if ($b[0] -eq 0 -or $b[0] -eq 10 -or $b[0] -eq 127 -or $b[0] -ge 224 -or ($b[0] -eq 172 -and $b[1] -ge 16 -and $b[1] -le 31) -or ($b[0] -eq 192 -and $b[1] -eq 168) -or ($b[0] -eq 169 -and $b[1] -eq 254) -or ($b[0] -eq 100 -and $b[1] -ge 64 -and $b[1] -le 127)) { return $false }
    } elseif ((($b[0] -band 0xfe) -eq 0xfc) -or $a.Equals([System.Net.IPAddress]::IPv6Any)) { return $false }
  }
  return $true
}

function Invoke-Relay($b) {
  $url = [string]$b.url
  $method = ([string]$b.method).ToUpperInvariant()
  if ($method -eq "") { $method = "GET" }
  if ($method -ne "GET" -and $method -ne "POST") { return @{ status = 400; result = @{ error = "Bara GET och POST" } } }
  $payload = $null
  if ($b.body) { $payload = [Convert]::FromBase64String([string]$b.body); if ($payload.Length -gt 10MB) { return @{ status = 413; result = @{ error = "Begärans kropp är större än 10 MB" } } } }
  for ($hop = 0; $hop -le 3; $hop++) {
    $u = $null
    if (-not [Uri]::TryCreate($url, [UriKind]::Absolute, [ref]$u) -or $u.Scheme -ne "https") { return @{ status = 400; result = @{ error = "Bryggan hämtar bara https-adresser" } } }
    $h = $u.Host.ToLowerInvariant()
    if ($AllowHosts -notcontains $h) { return @{ status = 403; result = @{ error = "Värden $h är inte tillåten. Starta bryggan med -AllowHosts $h om du vill hämta från den." } } }
    if (-not (Test-PublicHost $h)) { return @{ status = 403; result = @{ error = "$h pekar på den egna datorn eller det lokala nätet; bryggan hämtar inte därifrån" } } }
    $wr = [System.Net.HttpWebRequest]::Create($u)
    $wr.Method = $method; $wr.AllowAutoRedirect = $false; $wr.Timeout = 60000; $wr.ReadWriteTimeout = 60000
    if ($b.headers) {
      foreach ($p in $b.headers.PSObject.Properties) {
        if (-not (Test-HeaderAllowed $p.Name)) { continue }
        $v = [string]$p.Value
        switch ($p.Name.ToLowerInvariant()) {
          "accept" { $wr.Accept = $v }
          "content-type" { $wr.ContentType = $v }
          "if-modified-since" { $wr.IfModifiedSince = [DateTime]::Parse($v) }
          "range" { if ($v -match '^bytes=(\d+)-(\d*)$') { if ($Matches[2] -ne "") { $wr.AddRange([long]$Matches[1], [long]$Matches[2]) } else { $wr.AddRange([long]$Matches[1]) } } }
          default { $wr.Headers[$p.Name] = $v }
        }
      }
    }
    if ($payload -and $method -eq "POST") { $wr.ContentLength = $payload.Length; $s = $wr.GetRequestStream(); $s.Write($payload, 0, $payload.Length); $s.Close() }
    try { $res = $wr.GetResponse() } catch [System.Net.WebException] {
      if ($_.Exception.Response) { $res = $_.Exception.Response } else { return @{ status = 502; result = @{ error = "Kunde inte hämta från ${h}: " + $_.Exception.Message } } }
    }
    $code = [int]$res.StatusCode
    $location = $res.Headers["Location"]
    if ((@(301, 302, 303, 307, 308) -contains $code) -and $location) {
      $url = (New-Object Uri($u, $location)).AbsoluteUri
      if ($code -eq 303 -or (($code -eq 301 -or $code -eq 302) -and $method -eq "POST")) { $method = "GET"; $payload = $null }
      $res.Close(); continue
    }
    $ms = New-Object IO.MemoryStream
    $rs = $res.GetResponseStream()
    $buf = New-Object byte[] 65536
    while (($read = $rs.Read($buf, 0, $buf.Length)) -gt 0) {
      $ms.Write($buf, 0, $read)
      if ($ms.Length -gt ($MaxFetchMb * 1MB)) { $res.Close(); return @{ status = 413; result = @{ error = "Svaret är större än $MaxFetchMb MB (-MaxFetchMb)" } } }
    }
    $headers = @{}
    foreach ($k in $ReturnHeaders) { if ($res.Headers[$k]) { $headers[$k.ToLowerInvariant()] = $res.Headers[$k] } }
    $text = [string]$res.StatusDescription
    $res.Close()
    return @{ status = 200; result = @{ status = $code; statusText = $text; headers = $headers; body = [Convert]::ToBase64String($ms.ToArray()) } }
  }
  return @{ status = 508; result = @{ error = "För många omdirigeringar" } }
}

function Add-Log($entry) { [void]$log.Add($entry); if ($log.Count -gt 200) { $log.RemoveAt(0) } }

while ($listener.IsListening) {
  try { $ctx = $listener.GetContext() } catch { break }
  $req = $ctx.Request
  $origin = $req.Headers["Origin"]
  $originOk = $true
  if ($origin) {
    $originOk = ($AllowOrigins -contains $origin) -or ($origin -like "http://localhost:*") -or ($origin -like "http://127.0.0.1:*") -or ($origin -eq "http://localhost") -or ($origin -eq "http://127.0.0.1")
    if ($originOk) {
      $ctx.Response.Headers.Add("Access-Control-Allow-Origin", $origin)
      $ctx.Response.Headers.Add("Vary", "Origin")
      $ctx.Response.Headers.Add("Access-Control-Allow-Headers", "Authorization, Content-Type")
      $ctx.Response.Headers.Add("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
      $ctx.Response.Headers.Add("Access-Control-Max-Age", "600")
      if ($req.Headers["Access-Control-Request-Private-Network"] -eq "true") { $ctx.Response.Headers.Add("Access-Control-Allow-Private-Network", "true") }
    }
  }
  try {
    if (-not $originOk) { Send-Json $ctx 403 @{ error = "Ursprunget tillåts inte: " + $origin }; continue }
    if ($req.HttpMethod -eq "OPTIONS") { $ctx.Response.StatusCode = 204; $ctx.Response.OutputStream.Close(); continue }
    $hostName = [string]$req.UserHostName
    if (-not ($hostName -like "127.0.0.1*" -or $hostName -like "localhost*")) { Send-Json $ctx 403 @{ error = "Bara 127.0.0.1" }; continue }
    $auth = $req.Headers["Authorization"]
    if ($auth -ne ("Bearer " + $Token)) { Send-Json $ctx 401 @{ error = "Fel eller saknad token" }; continue }
    $path = $req.Url.AbsolutePath
    $body = $null
    if ($req.HasEntityBody) { $sr = New-Object IO.StreamReader($req.InputStream, $req.ContentEncoding); $text = $sr.ReadToEnd(); $sr.Close(); if ($text.Trim() -ne "") { $body = $text | ConvertFrom-Json } }
    if ($path -eq "/commands" -or $path -like "/commands/*") {
      if (-not $AllowCommands) { Send-Json $ctx 403 @{ error = "Bryggan startades utan -AllowCommands" }; continue }
      Invoke-CommandRoute $ctx $req.HttpMethod $path $body
      continue
    }
    switch ($path) {
      "/" { Send-Json $ctx 200 @{ name = "Dataspatium-databasbrygga"; version = $Version; platform = "windows"; allowWrite = [bool]$AllowWrite; kinds = $Kinds; maxRows = $MaxRows; fetch = $true; commands = [bool]$AllowCommands; allowHosts = $AllowHosts } }
      "/sources" { Send-Json $ctx 200 (Get-Sources) }
      "/tables" { $cn = Open-Connection $body.source; try { $t = @(Get-Tables $cn); Send-Json $ctx 200 @{ tables = $t; count = $t.Count } } finally { $cn.Close() } }
      "/columns" { $cn = Open-Connection $body.source; try { $c = @(Get-Columns $cn ([string]$body.table)); Send-Json $ctx 200 @{ columns = $c } } finally { $cn.Close() } }
      "/rows" {
        $limit = $MaxRows; if ($body.limit) { $limit = [Math]::Min([int]$body.limit, $MaxRows) }
        $cn = Open-Connection $body.source
        try { Send-Json $ctx 200 (Read-Table $cn ("SELECT * FROM " + (Quote-Name $cn ([string]$body.table))) $limit) } finally { $cn.Close() }
        Add-Log @{ at = (Get-Date).ToString("s"); kind = [string]$body.source.kind; table = [string]$body.table; write = $false }
      }
      "/query" {
        $sql = [string]$body.sql
        if ($sql.Trim() -eq "") { Send-Json $ctx 400 @{ error = "Tom fråga" }; continue }
        $write = -not (Test-ReadOnly $sql)
        if ($write -and -not $AllowWrite) { Send-Json $ctx 403 @{ error = "Bryggan är skrivskyddad; starta med -AllowWrite för att tillåta ändringar" }; continue }
        if ($write -and -not $body.approved) { Send-Json $ctx 428 @{ error = "Skrivning kräver användarens godkännande (approved: true)"; sql = $sql }; continue }
        $limit = $MaxRows; if ($body.limit) { $limit = [Math]::Min([int]$body.limit, $MaxRows) }
        $cn = Open-Connection $body.source
        try {
          if ($write) { $cmd = $cn.CreateCommand(); $cmd.CommandText = $sql; $cmd.CommandTimeout = 120; $n = $cmd.ExecuteNonQuery(); Send-Json $ctx 200 @{ affected = $n } }
          else { Send-Json $ctx 200 (Read-Table $cn $sql $limit) }
        } finally { $cn.Close() }
        Add-Log @{ at = (Get-Date).ToString("s"); kind = [string]$body.source.kind; sql = $sql.Substring(0, [Math]::Min(120, $sql.Length)); write = $write }
      }
      "/fetch" {
        $r = Invoke-Relay $body
        $where = $null; [void][Uri]::TryCreate([string]$body.url, [UriKind]::Absolute, [ref]$where)
        $logged = if ($r.result.status) { $r.result.status } else { $r.status }
        Add-Log @{ at = (Get-Date).ToString("s"); kind = "fetch"; host = $(if ($where) { $where.Host } else { "" }); path = $(if ($where) { $where.AbsolutePath } else { "" }); status = $logged }
        Send-Json $ctx $r.status $r.result
      }
      "/log" { Send-Json $ctx 200 @{ entries = $log } }
      "/stop" { Send-Json $ctx 200 @{ stopping = $true }; $listener.Stop() }
      default { Send-Json $ctx 404 @{ error = "Okänd sökväg " + $path } }
    }
  } catch {
    $message = $_.Exception.Message
    if ($_.Exception.InnerException) { $message = $message + " " + $_.Exception.InnerException.Message }
    try { Send-Json $ctx 500 @{ error = $message } } catch { }
  }
}
Write-Output "Bryggan har stoppats."
