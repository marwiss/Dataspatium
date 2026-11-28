# Sources: databases, the bridge and linked files

Besides files, pasted text, web addresses and the preset open APIs (see
[api-konfiguration.md](api-konfiguration.md)), Dataspatium can fetch data from databases in three ways:
**Access files** are read directly in the browser, **databases on your own computer or network** are reached
through a small local bridge, and **database services over HTTP** (PostgREST, OData, GraphQL and others) become
ordinary sources in Import. Files chosen with the computer's file picker can also be **linked**, so that the
dataset is read again from disk with one click. Everything happens in the browser; nothing is sent anywhere but
to the database you name yourself.

In Import the sources are in groups in the left column: *Create sources* (see below), *Database sources* (External database, Database through the bridge
and Neo4j), *API sources*, *Geodata sources* (Geodata source, Your own geodata source, Geodataportalen and Boundaries for maps) and more, with OpenCDE and Phone under
*Common sources*. What you choose is shown in the middle. The forms that add a source have their help text above them, and
the new source opens there once it is saved. The same form is shown as a dialog when it is opened from somewhere else, such
as Neo4j from an OpenCDE server's card.

## Create sources

The group *Create sources* at the top of Import makes new, empty datasets to build yourself. Nothing is fetched from the
network.

- *New building model*: an empty IFC model, see [cad-bim.md](cad-bim.md).
- *New comprehensive plan* and *New detailed plan*: an empty digital plan to draw in the plan view, see
  [planer.md](planer.md#a-new-comprehensive-plan) and [planer.md](planer.md#a-new-detailed-plan).
- *New map layer*: an empty layer of points, lines or areas to draw on the map, see [kartor.md](kartor.md#a-new-map-layer).
- *New table*: an empty table to fill in by hand.

### New table

Give the name and the columns, one per line: the name alone (`place`, which becomes text) or the name and the type
(`count: integer`). The types are text, integer, number, date and true/false, in the app's words or the internal ones. *Create
the table* makes an empty table, and *Fill in the table* opens it in Process:

- *New row* adds an empty row at the end;
- double-click a cell to type in it.

Every new row and every changed cell is a step in the dataset's log and is undone with *Undo*. The same column lines are used
by *New dataset* in Field collection and by *New map layer*.

## Access files (mdb, accdb)

Drop the file on the surface in Import like any other file. It is read by mdb-reader directly in the browser,
without Access on the computer: the tables are listed in the *Settings* step, you choose one and get the columns
with the types Access declares (text, numbers, dates, yes/no). Queries, linked tables and password-protected
files cannot be read this way; use the bridge below instead. dBase files (.dbf) are read by the spreadsheet importer.

## The database bridge

Why the bridge is needed: the browser may not open a connection to a database, nor read files on the computer that you
have not chosen yourself. The bridge is a small script you start on the computer when you need it, in the spirit of a
local web server. It listens on your own computer only (127.0.0.1), requires a token shown in its window, is read-only
unless you start it with writing allowed and lets you approve every write. The app fetches tables through the bridge;
nothing leaves the computer except to the database you name yourself. It is used for Access, Excel, SQLite, SQL Server and
other ODBC sources, for MySQL, MariaDB, PostgreSQL and Oracle, which it connects to itself with its drivers, and to fetch from an
address that shuts out browsers (see *Fetching through the bridge* below). Its view in Import says the same at the top.

### Starting the bridge

- **Windows**: open PowerShell in the app's folder and run `powershell -ExecutionPolicy Bypass -File tools\db-bridge.ps1`.
  The bridge speaks ODBC, OLE DB and SqlClient and thereby reaches Access (mdb and accdb through Microsoft ACE),
  Excel, SQL Server (LocalDB and Express included), Oracle, Paradox, dBase and every ODBC data source (DSN) on the computer.
  You choose MySQL, MariaDB and PostgreSQL directly in the form; this bridge reaches them through their ODBC drivers (MySQL
  Connector/ODBC, MariaDB Connector/ODBC, psqlODBC) when they are installed. No administrator rights are needed.
- **macOS and Linux** (and Windows without PowerShell): `python tools/db_bridge.py` (Python 3). SQLite files always work. The
  bridge connects to MySQL and MariaDB, PostgreSQL and Oracle itself with its drivers, which you install once (only the ones you
  need): `pip install pymysql pg8000 oracledb`. With `pyodbc` (`pip install pyodbc`) it reaches ODBC sources too. A missing
  driver is named when the bridge starts and in the form, with the command that installs it.

The window shows the address (`http://127.0.0.1:<port>/`) and the token. Options: `-Port` or `--port` picks the
port, `-AllowWrite` or `--allow-write` allows changes, `-MaxRows` or `--max-rows` caps the rows per fetch
(default 100,000) and `-AllowOrigins` or `--allow-origin` names the app addresses allowed to call the bridge. A
page opened from the folder has the origin `null`, which is allowed, as are `localhost` and the app's address on
GitHub Pages. Close the window, or press Ctrl+C, to stop.

### The bridge's drivers

No driver ships with the app, and the bridge imports one only when it is installed. All have licences the app allows.

| Database | Driver in the Python bridge | Licence | Install | In the PowerShell bridge |
|---|---|---|---|---|
| MySQL, MariaDB | PyMySQL | MIT | `pip install pymysql` | MySQL Connector/ODBC or MariaDB Connector/ODBC |
| PostgreSQL, also PostGIS, TimescaleDB, CockroachDB and YugabyteDB | pg8000 | BSD-3-Clause | `pip install pg8000` | psqlODBC |
| Oracle (thin mode, no Oracle client needed) | python-oracledb | Apache-2.0 or UPL-1.0 | `pip install oracledb` | ODBC DSN or OLE DB |
| SQL Server and other ODBC sources | pyodbc with the source's ODBC driver | MIT (pyodbc) | `pip install pyodbc` | SqlClient, ODBC and OLE DB (built in) |

A database is given by host, port (3306, 5432 and 1521 when the field is empty), database (the service name for Oracle), user
name, password and encryption. The encryption has the databases' own names: for MySQL and MariaDB `preferred` (encrypts when
the server can, the default), `required`, `verify_identity`, `verify_ca` and `disabled`; for PostgreSQL `prefer` (the default),
`require`, `verify-full`, `verify-ca` and `disable`; for Oracle `disabled` (the default) and `verify_identity` (TCPS). Against a
server on another computer, choose `verify_identity` or `verify-full`: the server's certificate is then checked against the
computer's trusted certificates, and so is the host name. With `required` and `require` the bridge stops the connection when
the server does not encrypt.

Reads run in a read-only transaction (`SET SESSION TRANSACTION READ ONLY` in MySQL and MariaDB, `default_transaction_read_only`
in PostgreSQL, `SET TRANSACTION READ ONLY` in Oracle) that is rolled back, and a table is fetched with `LIMIT`, so that a large
table is not read whole. A server without the setting (CrateDB, QuestDB) keeps the keyword check below. Geometry columns in
PostGIS come as WKT with their SRID (`ST_AsEWKT`), which Visualise draws on the map; in your own SQL you write `ST_AsEWKT(geom)`
yourself.

### Using the bridge in the app

1. Choose *Database through the bridge* under *Database sources* in Import, paste the address and the token and press
   **Connect**. The token lasts for the session; *Save encrypted* stores it with the same passphrase as the API keys.
2. Describe the source: an Access or Excel file (path on the computer), SQL Server (server, database and user, or
   Windows sign-in in the PowerShell bridge), MySQL, MariaDB, PostgreSQL or Oracle (host, port, database, user, password and
   encryption), an ODBC data source (choose among the computer's DSNs) or a connection string. The form says whether the
   bridge has the driver, and otherwise how to install it. Press **Fetch tables**.
3. Choose a table, see the first hundred rows and press **Import**. The column types come from the database.
4. **Own SQL** runs a query in the database's own dialect and imports the result. SELECT shows directly; other
   statements need a bridge started with writing allowed and are approved one at a time in a dialog that shows
   the statement.

Imported datasets remember their source: *Update* in Manage, or *Saved fetches* in Import, fetches the table or
query again and replays the recipe. Passwords are never stored with the dataset. They are kept in the session like other
keys, and *Save encrypted* saves them with the passphrase together with the token; after a restart you unlock them, or open the
source again, before the dataset is updated. *Disconnect* forgets the token and the passwords. The SQL tab in Analyse can run
directly against the source last opened in the bridge (*Run against*).

### Fetching through the bridge

A service that does not let the browser read its answer (no CORS) cannot be reached from the app, neither from a folder nor
from the web. The bridge can fetch for the app instead. It is your choice and off by default: turn on **Fetch through the
bridge** under *Internet access* in Manage, and start the bridge with the hosts it may fetch from:

```
python tools/db_bridge.py --allow-host api.example.com
powershell -ExecutionPolicy Bypass -File tools\db-bridge.ps1 -AllowHosts api.example.com
```

When a fetch fails like a network error and a bridge is connected, the app sends the same request to the bridge (`POST
/fetch`), which fetches it and hands the answer back. The bridge fetches only over https and only from the hosts you named;
the page can never add one. It refuses addresses on this computer or the local network, sends only a few headers and no
cookies, follows at most three redirects to allowed hosts and stops at `--max-fetch-mb` (50 MB by default). The bridge’s log
shows the host and the path, never the query, the headers or the body. The consent for the purpose applies as before.
One preset is reached only this way: *Riksbank interest and exchange rates (SWEA)*. The source list marks it *Requires the
bridge*, and a fetch without the bridge says how: start the bridge with `--allow-host api.riksbank.se` to fetch from it.

### Controlling the app from outside

Programs on the computer can run the app's commands through the bridge: the same commands the flows and the AI assistant use
(reading datasets, actions in Process, export, R, Python, flows). It is off at every start and takes two steps: start the bridge with
`--allow-commands` (`-AllowCommands`) and turn on **Let programs on this computer control the app through the bridge** under
*Internet access* in Manage, where you confirm once for the session. Commands that only read run at once; everything that changes
something is shown in a dialog with the command and its arguments and runs only if you approve it. The status bar shows a terminal
icon while the control is on.

The command line `tools/dataspatium.py` (Python 3, standard library) uses the bridge's address and token (`--bridge` and `--token`, or
`DATASPATIUM_BRIDGE` and `DATASPATIUM_TOKEN`):

```
python tools/dataspatium.py list
python tools/dataspatium.py run read_rows --args '{"dataset": "Population", "limit": 5}'
python tools/dataspatium.py plan monthly-report.json
python tools/dataspatium.py cancel c3-1a2b3c4d
python tools/dataspatium.py mcp
```

`list` shows the commands with their parameters, `run` runs one and prints the answer as JSON, `plan` runs a flow file (the form
*Export* under Flows gives) as a plan you approve once, and `mcp` makes the commands tools for an AI program on the computer through
the Model Context Protocol (over the standard streams). The bridge keeps the queue in memory, and a command waits for the app until
you have approved it or five minutes have passed.
`cancel` cancels a command that is waiting in the queue or running in the app (Ctrl+C during `run` does the same), and
`POST /commands/<id>/cancel` is the way for other programs.
`python tools/check_bridge.py` tries the queue, the command line and MCP without a
browser.

### Security

- The bridge answers on 127.0.0.1 only, requires the token in every call and allows CORS only for the app's own addresses.
- Read-only by default: only SELECT passes, and a SELECT or WITH that changes something (INSERT, UPDATE, DELETE, INTO,
  FOR UPDATE and more, outside quotes) counts as a write. With writing allowed, your approval is still needed per statement;
  the bridge answers 428 until the app sends the approval.
- The bridge logs the latest calls (`GET /log`) with the kind of source and the start of the statement, never the address,
  user or password, and stops when its window is closed.
- Tokens and passwords are kept in the session or encrypted with a passphrase, never in clear text and never in
  shared configurations. A database's password leaves the app only in the call to the bridge on 127.0.0.1 and stays in the
  bridge's process; when a driver repeats it in an error message, both the bridge and the app take it out.

### Troubleshooting

- *Provider cannot be found*: install the Microsoft Access Database Engine (ACE) in its 64-bit version, or use an
  ODBC DSN with a 64-bit driver. The bridge is 64-bit when PowerShell is.
- *Wrong or missing token*: copy the token from the bridge's window again; it changes at every start unless you
  pass `-Token`.
- *The bridge does not answer*: check that the window is open and the address is right; try another port.
- *The bridge lacks the driver*: install it with the command in the form on the computer where the bridge runs, and restart
  the bridge. The PowerShell bridge needs an ODBC driver of the same bitness as PowerShell.
- *The server does not encrypt the connection*: choose `preferred` or `prefer`, or turn on TLS in the database.
- Execution policy: the script is started with `-ExecutionPolicy Bypass`, like the app's test tools, so no
  settings need changing.
- An IT department can review the scripts (`tools/db-bridge.ps1` and `tools/db_bridge.py`, about 500 and 1,000 lines) and
  start them with a fixed port and token. `python tools/check_bridge.py` tries the Python bridge's drivers against fake
  drivers, without databases.

## Database sources over HTTP

The way **External database** under *Database sources* in Import opens a form in the middle that makes an ordinary API
source out of an address and a key. It is for databases that answer over HTTP; MySQL, MariaDB, PostgreSQL and Oracle are
reached through the bridge, which connects to them itself with its drivers, since the browser cannot open a connection to them,
and the form has a button there. The app asks the service for its tables (schema discovery) and adds one endpoint per table plus a
generic one where you name the table yourself. The source then works like the preset APIs: parameters, preview,
pages followed automatically and saved fetches updated with one click.

| Family | Authentication | Discovery | Fetching | CORS |
|---|---|---|---|---|
| PostgREST / Supabase | `apikey` header (optional) | OpenAPI root | `select`, `order`, filters per line; pages with `limit`/`offset` | Allowed by default |
| OData v4 | Basic (optional) | Service document | `$select`, `$filter`, `$orderby`, `$top`; `@odata.nextLink` followed | Depends on the service |
| GraphQL | Bearer (optional) | None | You write the query; the first list under `data` becomes the table | Depends on the server |
| CouchDB | Basic (optional) | `_all_dbs` | `_all_docs` with the documents; `skip`/`limit` | Enable in CouchDB |
| ClickHouse | Basic (optional) | `SHOW TABLES` | SQL per table with `FORMAT JSON`; `add_http_cors_header=1` sent | Through the setting |
| Elasticsearch / OpenSearch | API key (optional) | `_cat/indices` | `_search` with `q`; `from`/`size`, at most 10,000 hits | `http.cors.*` |
| SPARQL | None | None | The query as a parameter; the variables become columns | Public endpoints allow it |
| InfluxDB v2 | Token | Buckets | Flux query; annotated CSV | Check the server |
| Google Sheets | None | None | A published or link-shared sheet as CSV | Google |
| Airtable | Personal token | Metadata API | Records with `offset`; the fields become columns | Allowed |

CORS means that the database's server must allow calls from the browser. A page opened from the folder sends the
origin `null`; in server mode the app's address. How to enable it is in each service's documentation (link in
the dialog). When the server cannot be changed, the proxy setting (see [api-konfiguration.md](api-konfiguration.md))
or *Fetch through the bridge* remain.

Keys and passwords stay in the session or are saved encrypted; the configuration that is created can be exported
and shared without them. The response formats `graphql`, `sparql` and `influx-csv` and `lift` (lifting a nested
object into columns) are described in [api-konfiguration.md](api-konfiguration.md) and can be used in your own
configurations.

### More databases and how they are reached

An open-source database is reached in one of three ways: directly from the browser over HTTP (External database, Neo4j),
through the bridge with a driver, or not yet.

| Database | Way | Reason |
|---|---|---|
| PostgreSQL, PostGIS, TimescaleDB | The bridge (pg8000); PostgREST or Supabase over HTTP | PostGIS and TimescaleDB are extensions of PostgreSQL; the geometry comes as WKT |
| CockroachDB, YugabyteDB, CrateDB, QuestDB | The bridge (pg8000) | They speak PostgreSQL's protocol; CrateDB and QuestDB lack read-only transactions, so the keyword check applies there |
| MySQL, MariaDB | The bridge (PyMySQL) | |
| Oracle | The bridge (python-oracledb in thin mode) | Pure Python, no Oracle client needed |
| SQL Server | The bridge: SqlClient in PowerShell, pyodbc in Python | python-tds (MIT) is not added: encryption needs pyOpenSSL and a CA certificate, otherwise the sign-in goes unencrypted |
| Firebird | The bridge through ODBC (Firebird's ODBC driver) | firebird-driver (MIT) needs Firebird's client library installed; ODBC suffices for now |
| SQLite | Files directly in the app, or the bridge | |
| Neo4j, Memgraph | The Neo4j source (Bolt over WebSocket) | Memgraph speaks Bolt; not tried against a real Memgraph |
| Elasticsearch, OpenSearch, CouchDB, ClickHouse, InfluxDB 2 | External database over HTTP | The server must allow CORS; ClickHouse is also reached through the bridge with the MySQL or PostgreSQL protocol |
| InfluxDB 3 | Not yet | Queried with SQL over `/api/v3/query_sql`; the family reads InfluxDB 2 with Flux |
| ArangoDB, SurrealDB | Not yet | Both answer over HTTP (AQL in `/_api/cursor`, SurrealQL in `/sql`) and can become families in External database |
| MongoDB | Not yet | pymongo (Apache-2.0) suits the bridge, but documents and queries are not SQL and need an answer format of their own; the Atlas Data API over HTTP is shut down |
| Cassandra, ScyllaDB | Not yet | cassandra-driver (Apache-2.0) speaks CQL without the DB-API, and there is no HTTP interface without add-ons |
| Trino, Presto | Not yet | trino (Apache-2.0) follows the DB-API, but the HTTP protocol lacks CORS and the driver pulls in more packages |
| Redis, Valkey | Not as a table source | Keys and values without tables |
| H2, HSQLDB, Derby | Not at all | Only JDBC (Java); no Python driver with an allowed licence |

### Neo4j over Bolt

The way **Neo4j** under *Database sources* connects to Neo4j Aura or an own server with Neo4j's driver over
WebSocket (`neo4j+s://…`, database, user name and password; the password is never stored in clear text). The source opens
a Cypher editor: the result becomes a table, or a graph dataset when the answer holds nodes and relationships; queries
can be kept on the source. The connection needs consent (purpose Neo4j) and is not subject to CORS; an own server without
TLS (`bolt://`) is reached only from a page over http://. See [grafer.md](grafer.md#neo4j-as-a-source).

### OpenCDE server (BCF and Documents API)

The way **OpenCDE** under *Common sources* connects to a server that implements buildingSMART's
OpenCDE APIs, for example [Dataregium](https://github.com/marwiss/Dataregium). Enter the server's address. Leave the client id empty when the server lets the app register itself (see below), otherwise the client id
its administrator registered for Dataspatium (a public client with the redirect URI
`http://127.0.0.1:8080/oauth-callback.html`, or the equivalent for the address the app is served from). The source opens
a view where you sign in to the server (OAuth2 with PKCE in a pop-up; from file:// you paste the address you end up on
after signing in), pick a project and fetch topics, comments, viewpoint components (one IFC element per row), events and
files as tables. *Fetch documents* opens the server's own document selection page (Documents API); the chosen files are
downloaded and imported as if dropped on the app, so an IFC model becomes a model dataset. Access tokens live in the
session only and are never exported with the source. The connection needs consent (purpose OpenCDE server) and a server
that allows requests from the browser (CORS).

A **local Dataregium** on your own computer (the server's on-premise mode, `opencde init --local`) answers at `http://127.0.0.1:8000`.
Enter that address and leave the client id empty: the local server lets the app register itself, allows calls from the app opened from
file:// and from `http://127.0.0.1:8080`, requires PKCE as usual and answers only when the address in the call is the computer's own.
The app sees from the address that the server is local; everything else works as against a server on the network.

The app speaks BCF API 3.0 and 2.1. It chooses the newest version the server offers, and a server of 2.1 alone works too: such a server often
has neither the Foundation API nor the Documents API, so the app reads the version from `/bcf/versions` and the sign-in addresses from
`/bcf/2.1/auth`, and leaves out *Fetch documents*. Under *More options* in the dialog you can choose the version yourself, and when the server offers
several you can change in the source's view. In 2.1 *Files in the project* lists only the BCF documents, issues have no number from the server and a
viewpoint cannot be deleted. In return a comment can answer another: the button *Reply* in the panel *Issues*.

A server with the Documents API alone, such as a Dataregium at the tier Documents, has no BCF projects to choose. The source's view then shows
*Fetch documents* without a project list, and the tab *To the CDE* in Share sends through the Documents API, where the server's own page asks
for the project. Below the tier BIM + GIS, *Fetch documents* skips a BCF file among the chosen ones, says why in the log and fetches the rest.

The card *The project's members* appears when the server has project administration (a Dataregium extension). A project's manager,
who need not be a server administrator, signs in with *Sign in as project manager* and sees the projects they manage and their members
with roles: viewer, contributor, editor or manager. You add a person by their exact user name on the server, change a role, remove a
member and rename the project; every change is confirmed first. The server does not let the project be left without a manager and
says so; projects are not deleted from here, and an administrator creates new accounts.

When the project has teams the card shows them too: name, responsible, members and the IDS document whose specifications mark
the team's part of the model. You add a team with a name, a responsible (an editor or manager), the members' user names and the IDS
document, picked among the project's files or given by its id, and remove a team; the server checks that what you named is in the
project. A change that touches one team's part is approved by that team's responsible, not by a manager (see *Change with AI* in CAD
and BIM).

When the server's administrator has turned mirroring on (Dataregium from step 7), the card also shows *Mirror to a forge*: the server
then mirrors the project's git repository one way to an empty repository at a forge, such as GitHub. You give the repository's https
address, a fine-grained token for that repository alone, when the token expires (at most a year; a year when you give none) and the
largest file the forge takes (100 MiB at GitHub; larger files are left out). You first confirm that the project's files, with the
personal data they may hold, leave the server. The token goes once to your server, in the request's body and never in the address or
the CDE log, and is never kept in the app; the server seals it and never shows it again. The card then shows the mirror's state:
waiting, mirrored, changed since the last mirroring or failed in the server's words, when it was last mirrored, which branches were
mirrored and which files were left out. *Stop mirroring* removes the mirror; the repository at the forge stays.

Topics are fetched in pages of 500. A list the server has capped (Dataregium caps at 1,000 items) is read to the end through
the server’s Link header with rel="next", but only on the same server, so that your token never goes anywhere else.

The card *IFC-DB* (formerly IFC-LPG) appears when the server has a graph, see [grafer.md](grafer.md#ifc-db-on-a-dataregium-server).

Under *Files in the project* the source lists the models and documents the server holds for the project. *Fetch* makes a
dataset of the file's own kind, so an IFC file becomes a model and a CSV file a table, and the dataset remembers which
server, project and version it came from. In Manage the card *From the CDE* shows this, and *Check for a new version* asks
the server whether the document has a newer version; that version is then fetched as a dataset of its own beside the old
one. When the server keeps a git history per project (Dataregium from phase 5.2), the card also shows the commit the version is in, and
from phase 5.5 the commit itself: its message with the trailers, who made it and who committed it, the base version and, for a merged
version, the upload as it came or the proposal's trial. The source also says what you may do in the project, such as create issues or upload documents. When the source is
made, the dialog asks the server where to sign in; if the server does not answer then, the app asks again at the first
sign-in.

While the server's own page is open in a pop-up (sign-in, document selection, upload), the app shows the button *Cancel*, so that you can stop waiting if the window was closed or lost.

While the server's own page is open in a pop-up (sign-in, document selection, upload), the app shows the button *Cancel*, so that you can stop waiting if the window was closed or lost.

If the server allows it, the app registers itself as a client when you leave the client id empty, so no administrator has to
hand anything out. Datasets can also go back to the server: the tab *To the CDE* in Share sends a dataset in any format, or the
original file, to a project, either through the Documents API, where the server's own page asks for title and version, or as a
BCF document. A dataset fetched from the server can be sent as a new version of its document.

For Dataregium's IFC graph the view offers starter code: the models in the graph and the latest finished one per document, elements per class, the walls' GTIN, issues per
status, issues and their elements, issues that touch an element, and a graph of issues, viewpoints and components. Choose a query,
edit and run. It requires that whoever runs the server has made Bolt reachable; the development stack does, a production server
seldom does.

A workspace bundle can also go through the server: the tab *To the CDE* sends it as a document, and the card with the project's
files shows the button *Receive* for bundle files, which receives the bundle exactly as when the file is dropped in Import.

The card *Log* at the bottom of the source's view shows everything the app has sent to the server during the session: time,
method, API (Foundation, BCF or Documents) and operation of the specification, status and duration. A click on a row shows the
headers (tokens and cookies masked), an explanation of what the operation does with a link to the specification, and the button
*Copy as curl*. Turn on *Keep bodies* to also see the request and response bodies (text, at most 64 kB; never token requests). The log
lives in memory only and is never sent; it can be saved as JSON or as a dataset. The app sets the header X-Request-Id on every request
so that the server's own log can be matched with the app's; if a server refuses the header, it is turned off for that source.

The server's side is described in Dataregium's documentation: [client-guide.md](https://github.com/marwiss/Dataregium/blob/main/docs/en/client-guide.md) (how a client connects) and [deploy/local.md](https://github.com/marwiss/Dataregium/blob/main/docs/en/deploy/local.md) (the development stack and how the app is tested against it).

Dataregium describes its extensions in `GET /.well-known/dataregium`; the app reads the document when the source opens and writes under
the heading which server it is and which extensions it has (self-registration, request log, administration, IFC-DB, graph
queries). A server without the document has no extensions, and everything in the specifications works anyway. The server's error
codes (`code` in the answer, for example `reauthentication_required`) are shown in your language; unknown codes show the server's own
text. The link *Open in Dataspatium* on the server's pages has the form `index.html#/inhamta/opencde?server=https://…` and opens
the dialog for a new source with the address filled in. A server the workspace already has as a source opens directly. The link can also name a project and a document
(`&project=…&document=…&version=…`): the project is chosen and the document fetched as a dataset once you are signed in. Pages that
Dataregium opens in a popup (sign-in, upload, document selection) appear in the app's language.

**Administration.** If you are an administrator on a Dataregium server, the source's view shows the card *Administration* (when the server's capabilities document says the administration API is on). The button *Sign in as administrator* asks for the scope `admin`; then the tabs Overview, Users (create, change, disable, reset password, delete), Projects (create, rename, members and roles, delete), Clients (register, change, rotate secret, revoke tokens, delete), Sessions (end one or all of a user), Audit, Settings and Health follow, plus Graph query when the server allows reading Cypher against the IFC graph. Dangerous operations need a fresh sign-in: the server answers `reauthentication_required`, the app opens the sign-in again and repeats the call. One-time values (an initial password, a client secret) are shown once with a Copy button and never written to the log. Every list can be saved as a dataset and fetched again from Hantera.

## Open geodata

*Geodata source* under *Geodata sources* is a list of **ready-made geodata sources**: open WFS, OGC API Features and
ArcGIS services of Nordic agencies and municipalities (SCB, SGU, Naturvårdsverket, SLU Artdatabanken, Riksantikvarieämbetet,
Skogsstyrelsen, Sundsvalls kommun, Kartverket, Miljødirektoratet, Riksantikvaren, Statistics Finland, SYKE, Helsinki, Väylävirasto,
Danmarks Miljøportal, Københavns Kommune, Plandata.dk, Landmælingar Íslands and others), all tried from the browser all
the way to a fetched feature with geometry, Kartverket's WFS services too, which give only GML. A preset source opens, the others are added with one click and their layers read from the service; filter
by name, country or contents. The list lives in `presets/geodata/services.json`. A service that is not in the list is
added under *Your own geodata source* (see below).

Three sources fetch plans: *Plandata.dk (WFS)* and *Skipulagsstofnun skipulagsgögn (ArcGIS)* have the button **Fetch
plan**, which reads a whole local plan or deiliskipulag (every layer) by its plan number and keeps it as a plan, and
*Ryhti kaavatiedot (OGC API Features)* gives Finland's plan index. See [planer.md](planer.md#plans-from-the-other-nordic-countries).
Boverket's Planbestämmelsekatalog is an ordinary API source (*Boverket Planbestämmelsekatalogen*), see [planer.md](planer.md).

A geodata source, ready-made or your own, is an ordinary API source. The app reads the service's layers and adds one
endpoint per layer plus a generic one where you name the layer yourself. The answers are read in WGS 84: the dataset gets a geometry column
and opens as a map in Process (see [kartor.md](kartor.md)). The source shows the layers as a filterable list; choose a
layer, limit by an area (bbox) when you can, and fetch. The preview shows the answer as a small map above the table,
and *Open as map* takes you to the saved dataset.

| Family | Discovery | Fetching | Key |
|---|---|---|---|
| WFS 2.0 (GeoServer, MapServer, ArcGIS Server, Deegree) | GetCapabilities | GetFeature in the GeoJSON format the capabilities name (`application/json`, `GEOJSON` and others) with `srsName=EPSG:4326`, or in GML when the service gives no GeoJSON (see below); area (bbox), CQL filter, columns; pages with `startIndex`/`count`, never larger than the service sends (`CountDefault`) | Bearer (optional) |
| OGC API Features | `/collections` | `/collections/{id}/items` with bbox, datetime and filter; next links are followed | Bearer (optional; required by Lantmäteriet's geodata platform) |
| ArcGIS REST (FeatureServer, MapServer) | The service description or a whole directory with its folders, and each service's layers except group and raster layers | `/{layer}/query` with where, area, `f=geojson` and `outSR=4326`; pages with `resultOffset`, never larger than `maxRecordCount`; a page the service cannot manage (error 500 for heavy polygons) is fetched again a quarter as large | Token (optional) |

Errors the service reports itself are shown with the service's text and code, for example *Service WFS is disabled
(ServiceUnavailable)* from a switched-off WFS or an ArcGIS error, and a WFS that gives neither GeoJSON nor GML says which
formats it gives.

**GML.** A WFS that gives only GML (Kartverket and other INSPIRE and deegree services) is read with the app's own GML
reader. It reads GML 3.2 (as WFS 2.0 sends it), GML 3.1.1 and GML 2.1.2 with simple features: points, lines, surfaces and
their multi forms, and the usual curves simplified (arcs and circles are drawn as short straight segments). The properties
become columns; a property that holds an object gives columns with a dot in their names, for example
`identifikasjon.lokalId`, and repeated values are joined with semicolons. The app asks for the answer in
`urn:ogc:def:crs:EPSG::4326` and sends the area with its system (`…,urn:ogc:def:crs:OGC:1.3:CRS84`), since the service's own
system may be another one. The axis order follows `srsName`: an EPSG code as a URN (`urn:ogc:def:crs:EPSG::4326`) or as
`http://www.opengis.net/def/crs/EPSG/0/…` is read in EPSG's order, that is latitude before longitude and northing before
easting in the systems EPSG defines so (SWEREF 99, RT 90, ETRS-TM), while CRS84, `EPSG:4326` and
`http://www.opengis.net/gml/srs/epsg.xml#4326` are read as x and y, as deegree, GeoServer and MapServer write them. A first
position that cannot lie in its system the way it is declared is read the other way. The coordinates become the app's
usual ones: longitude and latitude, or easting and northing. The same reader reads a .gml file in Acquire (see
[format.md](format.md)).

Preset geodata sources without a key (CORS verified): SCB open geodata, SGU's soils (bedrock, wells and groundwater
aquifers are in the list), the Swedish Agency for Marine and Water Management, the National Heritage Board's ancient
remains, the Swedish Forest Agency, Kartverket's administrative units, cadastral map and place names (Norway; GML),
Statistics Finland and SYKE's protected areas (Finland). The layers are read from the service the first time
the source is opened and can be reread with *Reread layers*; the list is kept in your copy of the source. Lantmäteriet's
geodata platform (detailed plans, buildings, shore protection, cultural heritage remains and the boundary of forest near the mountains) is a level 2 source with a Bearer key from a connected organisation.

**Trafikverket’s NVDB** (*Trafikverket NVDB: road data*) gives 45 object types from the Swedish national road database, such
as speed limits, road numbers, bearing capacity, number of lanes, street names, junctions and rest areas, with one endpoint
per object type. It needs a free key from [data.trafikverket.se](https://data.trafikverket.se/), which is sent in the request
body and never in the address. Give the area in WGS 84 as for the other sources; the app converts it to SWEREF 99 TM, and
without an area the whole country is fetched. The answers are read in pages of 5,000 objects, and the geometry is converted
to WGS 84 so that the dataset opens as a map. The data are CC0.

**Lantmäteriet’s STAC with a key** (*Lantmäteriet geodata with a key (STAC)*) searches Lantmäteriet’s four catalogues: vector
data (buildings, land cover, place names, property division and addresses), orthophotos, elevation data (the terrain model
and laser data) and maps. Choose a collection and give an area; the result is the files’ footprints as a map with the
addresses of the files. The card **Files in the source** in Manage then fetches the files with the key: the vector files are
read in as datasets (a ZIP is unpacked and a GeoPackage gives one dataset per layer), and rasters, point clouds and other
files the app does not read are saved on the computer, at most 20 at a time. Heights at points come from the operation
*Height from the terrain model* in Process, which reads the terrain model’s tiles directly. The key is the consumer key and
consumer secret from a free account in [Geotorget](https://geotorget.lantmateriet.se/); the app fetches an access token with
them, and it is sent only to Lantmäteriet’s API and the file server dl1.lantmateriet.se.
A height profile along a line is drawn by Visualise (*New chart* → *Height profile along a line*).

### Your own geodata source

**Your own geodata source**, right below *Geodata source* in *Geodata sources*, makes a source of the address of a
geodata service that is not among the ready-made ones, just like the database sources. Choose the family (WFS, OGC API
Features or ArcGIS REST), enter the address and, if the service requires one, the key (it is kept in the session only),
and choose *Add source*. The new source appears under *Added sources* and opens with its layers. The form is shown in
the middle in Import and as a dialog when it is opened from another mode, and it has the address
`#/inhamta/owngeodata` and a command in the palette.

### Geodataportalen

**Geodataportalen** (geodata.se) is Sweden's national catalogue of the geodata of agencies, regions and municipalities.
The view *Geodataportalen* under *Geodata sources* in Acquire searches the catalogue and shows one post per hit with
title, organisation, abstract and what the post links to. The switch *Only what can be fetched* (on from the start)
shows only posts with a service or file the app can fetch. Each post has an action per kind of link:

- **Add as a geodata source** for a WFS, OGC API Features or ArcGIS service: the form *Your own geodata source* opens in the
  workspace with the service and the address filled in, and *Add* makes the source.
- **Get the file** for a download (ZIP, GeoPackage, GeoJSON, GML): the file is fetched and read in as a file from an
  address, with preview and columns. When the link is an INSPIRE ATOM feed the app reads the feed first and lists its
  files, and the feeds of single datasets open with *Open the feed*.
- **Show on the map** for a WMS: the app reads the service's layers and draws the first as a WMS layer on a map in the
  post, over the county boundaries; choose another layer in the list. *Copy WMS address* gives the address to a map view
  in Visualise.

The addresses come from the catalogue and not from you, so the app asks before it contacts each new host (consent per
host), also for every later fetch from a source added from here. Posts whose conditions need a key, a licence or an
agreement (for example Lantmäteriet's products or INSPIRE's limitations under article 13) are marked *Needs a key or an
agreement* with the conditions. When a service shuts browsers out (CORS, as many downloads and ATOM feeds do) the post
says so and how the bridge on your own computer can fetch it, with a button to the bridge. The hit list can also be
fetched as a table under the *Endpoints* tab of the source *Geodataportalen (sök geodata)*.

Geodata services often answer with many features: limit by an area or a filter, and raise *Maximum pages* under *More
options* only when needed. Your own service must allow requests from the browser (CORS) just like the database sources;
most agencies' GeoServer and ArcGIS Server do.

## Boundaries for maps

*Boundaries for maps* under *Geodata sources* are simplified municipality and region boundaries for thematic maps that ship
with the app: counties and municipalities of Sweden (SCB, Digital boundaries, CC0), regions and municipalities of Denmark
(DAGI), counties and municipalities of Norway (Kartverket, CC BY 4.0) and regions and municipalities of Finland (Statistics
Finland, CC BY 4.0). Choose a set, read where it comes from and under which licence, and press **Import boundaries**. It
becomes a dataset with a code, a name and a geometry in longitude and latitude (WGS 84), which you join to your statistics
by the code and show on a map (see [visualisera.md](visualisera.md)). Nothing is fetched from the internet.

## Example data

*Example data* under *Other sources* are small open datasets that ship with the app, so that you can try the modes without
files of your own. Each example says what it is, where it comes from, under which licence and what has been changed;
**Import** makes a new dataset of one example and **Import all** of all of them. An example already in the workspace is
marked and can be opened directly. At the first start, when the workspace is empty, Files links here, and in Manage
**Try with example data** does. Nothing is fetched from the internet.

The comprehensive plan, the detailed plan and the house lie in the same place, in Björred in Lomma municipality: the house
stands in the detailed plan's residential area, and the detailed plan lies in the comprehensive plan's area for new housing.

| Example | Kind | Source and licence | Real or example |
|---|---|---|---|
| Population per municipality 2024 | Table: population and land area of Sweden's 290 municipalities | SCB, Statistikdatabasen, CC0 | Real |
| Comprehensive plan Lomma 2020 | Plan (comprehensive plan) in the exchange format for comprehensive plans (GeoJSON) | Lomma municipality, open data, CC0; the municipal boundary from SCB, CC0 | Real; Lomma's layers placed in the ÖP catalogue's categories by Dataspatium |
| Detailed plan Björreds vångar stage I | Plan (detailed plan) as Detaljplan 4.1 (GeoJSON) | Lomma municipality, open data, CC0 | The plan area, name, purpose and case number are real; the uses and provisions are an example, not the municipality's proposal |
| House in Björreds vångar (IFC) | Building model (IFC4) | buildingSMART International, Sample-Test-Files, CC BY 4.0 (© buildingSMART International Ltd.) | A real sample model, georeferenced on the lot by Dataspatium and without a person's name |
| Dwellings completed per municipality 2024 (JSON) | Table from SCB's answer in JSON-stat 2.0 | SCB, Statistikdatabasen, CC0 | Real |
| Neighbouring municipalities (graph for Neo4j) | Graph: the municipalities and which share a border, as a Cypher script | Computed from SCB's Digitala gränser, CC0 | Computed by Dataspatium |
| Swedish municipality boundaries (SCB) | Map layer: the municipalities' areas in WGS 84 | SCB, Digitala gränser, CC0 | Real, simplified for thematic maps |

The graph counts two municipalities as neighbours when they share a stretch of border, not when they only meet in a point.
The boundaries are simplified and follow land, so municipalities made up of islands only get no neighbours. The script also
runs in Neo4j, and the tables can be joined to the boundaries by the municipality code for a map. The sources, the changes
and how the files are built are in `presets/exempeldata/KALLA.md`.

## Linked files

In Chrome and Edge, Import has the button **Link a file on this computer**. The file is chosen with the computer's
file picker and imported as usual, but the dataset keeps a link to the file: **Update from disk** in Manage reads
the file again with the same settings, replaces the rows and replays the recipe (cleaning, new columns and joins
are redone). The browser may ask for permission to read the file again after a restart. Firefox lacks the
feature; there you import the file anew. Formats read through R (SPSS, Stata, SAS, PX, RDS, Parquet) cannot be linked.

## WebSocket

The app has a connection method for WebSocket (consent per purpose, JSON frames, requests and replies paired by
id). It is meant for streaming APIs; no presets use it yet. Neo4j goes over Bolt with its own driver.

## Limitations

- The bridge runs on the computer where the app is used; remote databases are reached through drivers or DSNs on that computer.
- At most 100,000 rows per fetch through the bridge unless `-MaxRows` is raised; large tables are best narrowed with SQL.
- Access files in the browser: no queries, linked tables or passwords; very large files take memory.
- Elasticsearch gives at most 10,000 hits per search (`from` + `size`).
- All HTTP sources require CORS; it cannot be bypassed from the browser.
