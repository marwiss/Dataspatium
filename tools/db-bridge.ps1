<#
Dataspatium database bridge for Windows (PowerShell 5.1 or later). SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0

A small local HTTP service that Dataspatium opens from Inhämta -> "Databas via bryggan". It lists the ODBC data
sources on this computer, the tables and columns of a database, and runs queries through ODBC, OLE DB or
SqlClient, so that Access, Excel, SQL Server and every ODBC source reachable from this computer can be imported
into the app. Nothing is installed and nothing leaves the computer: the service listens on 127.0.0.1 only,
requires the token printed at start, answers CORS only for the app's origins (a page opened from a folder sends
Origin "null") and is read-only unless -AllowWrite is given; even then every write needs the user's approval in
the app (the request carries approved: true). Close the window, press Ctrl+C or POST /stop to stop it.

Usage:
  powershell -ExecutionPolicy Bypass -File tools\db-bridge.ps1
  powershell -ExecutionPolicy Bypass -File tools\db-bridge.ps1 -Port 8731 -AllowWrite
Parameters: -Port (0 = random), -Token (default random), -AllowWrite, -MaxRows (default 100000),
  -AllowOrigins (default "null" and https://marwiss.github.io; http://localhost and http://127.0.0.1 are always allowed).

Protocol (JSON): GET / (info), GET /sources (DSNs, ODBC drivers, OLE DB providers), POST /tables {source},
  POST /columns {source, table}, POST /rows {source, table, limit}, POST /query {source, sql, limit, approved},
  GET /log, GET or POST /stop. A source is {kind: access|excel|sqlserver|dsn|odbc|oledb, ...} with path, password,
  server, database, user, dsn or connectionString depending on the kind.
#>
param(
  [int]$Port = 0,
  [string]$Token = "",
  [switch]$AllowWrite,
  [string[]]$AllowOrigins = @("null", "https://marwiss.github.io"),
  [int]$MaxRows = 100000
)
$ErrorActionPreference = "Stop"
$Version = "2.3.0"
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
if ($AllowWrite) { Write-Output "Skrivning TILLÅTEN (-AllowWrite); varje skrivning kräver ändå godkännande i appen." } else { Write-Output "Skrivskyddad: bara SELECT." }

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
    switch ($path) {
      "/" { Send-Json $ctx 200 @{ name = "Dataspatium-databasbrygga"; version = $Version; platform = "windows"; allowWrite = [bool]$AllowWrite; kinds = $Kinds; maxRows = $MaxRows } }
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
