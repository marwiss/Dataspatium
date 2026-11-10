# Sources: databases, the bridge and linked files

Besides files, pasted text, web addresses and the preset open APIs (see
[api-konfiguration.md](api-konfiguration.md)), Dataspatium can fetch data from databases in three ways:
**Access files** are read directly in the browser, **databases on your own computer or network** are reached
through a small local bridge, and **database services over HTTP** (PostgREST, OData, GraphQL and others) become
ordinary sources in Import. Files chosen with the computer's file picker can also be **linked**, so that the
dataset is read again from disk with one click. Everything happens in the browser; nothing is sent anywhere but
to the database you name yourself.

## Access files (mdb, accdb)

Drop the file on the surface in Import like any other file. It is read by mdb-reader directly in the browser,
without Access on the computer: the tables are listed in the *Settings* step, you choose one and get the columns
with the types Access declares (text, numbers, dates, yes/no). Queries, linked tables and password-protected
files cannot be read this way; use the bridge below instead. dBase files (.dbf) are read by the spreadsheet importer.

## The database bridge

The bridge is a small script you start on the computer when you need it, in the spirit of a local web server. It
listens on your own computer only (127.0.0.1), requires a token shown in its window and is read-only unless you
start it with writing allowed. The app fetches tables through the bridge; nothing leaves the computer.

### Starting the bridge

- **Windows**: open PowerShell in the app's folder and run `powershell -ExecutionPolicy Bypass -File tools\db-bridge.ps1`.
  The bridge speaks ODBC, OLE DB and SqlClient and thereby reaches Access (mdb and accdb through Microsoft ACE),
  Excel, SQL Server (LocalDB and Express included), Oracle, PostgreSQL, MySQL/MariaDB, Paradox, dBase and every
  ODBC data source (DSN) on the computer. No administrator rights are needed.
- **macOS and Linux** (and Windows without PowerShell): `python tools/db_bridge.py` (Python 3, standard library).
  SQLite files always work; with `pyodbc` installed (`pip install pyodbc`) ODBC sources too.

The window shows the address (`http://127.0.0.1:<port>/`) and the token. Options: `-Port` or `--port` picks the
port, `-AllowWrite` or `--allow-write` allows changes, `-MaxRows` or `--max-rows` caps the rows per fetch
(default 100,000) and `-AllowOrigins` or `--allow-origin` names the app addresses allowed to call the bridge. A
page opened from the folder has the origin `null`, which is allowed, as are `localhost` and the app's address on
GitHub Pages. Close the window, or press Ctrl+C, to stop.

### Using the bridge in the app

1. Choose *Database through the bridge* under *Databases* in Import, paste the address and the token and press
   **Connect**. The token lasts for the session; *Save encrypted* stores it with the same passphrase as the API keys.
2. Describe the source: an Access or Excel file (path on the computer), SQL Server (server, database and user, or
   Windows sign-in), an ODBC data source (choose among the computer's DSNs) or a connection string. Press
   **Fetch tables**.
3. Choose a table, see the first hundred rows and press **Import**. The column types come from the database.
4. **Own SQL** runs a query in the database's own dialect and imports the result. SELECT shows directly; other
   statements need a bridge started with writing allowed and are approved one at a time in a dialog that shows
   the statement.

Imported datasets remember their source: *Update* in Manage, or *Saved fetches* in Import, fetches the table or
query again and replays the recipe. Passwords are never stored with the dataset; after a restart the app asks you
to open the source again before updating. The SQL tab in Analyse can run directly against the source last opened
in the bridge (*Run against*).

### Security

- The bridge answers on 127.0.0.1 only, requires the token in every call and allows CORS only for the app's own addresses.
- Read-only by default: only SELECT passes. With writing allowed, your approval is still needed per statement;
  the bridge answers 428 until the app sends the approval.
- The bridge logs the latest calls (`GET /log`) and stops when its window is closed.
- Tokens and passwords are kept in the session or encrypted with a passphrase, never in clear text and never in
  shared configurations.

### Troubleshooting

- *Provider cannot be found*: install the Microsoft Access Database Engine (ACE) in its 64-bit version, or use an
  ODBC DSN with a 64-bit driver. The bridge is 64-bit when PowerShell is.
- *Wrong or missing token*: copy the token from the bridge's window again; it changes at every start unless you
  pass `-Token`.
- *The bridge does not answer*: check that the window is open and the address is right; try another port.
- Execution policy: the script is started with `-ExecutionPolicy Bypass`, like the app's test tools, so no
  settings need changing.
- An IT department can review the script (`tools/db-bridge.ps1`, about 200 lines) and start it with a fixed port and token.

## Database sources over HTTP

The way **Database source** under *Add sources* in Import makes an ordinary API source out of an address
and a key. The app asks the service for its tables (schema discovery) and adds one endpoint per table plus a
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
or the bridge through ODBC remain.

Keys and passwords stay in the session or are saved encrypted; the configuration that is created can be exported
and shared without them. The response formats `graphql`, `sparql` and `influx-csv` and `lift` (lifting a nested
object into columns) are described in [api-konfiguration.md](api-konfiguration.md) and can be used in your own
configurations.

### Neo4j over Bolt

The way **Neo4j** under *Add sources* (the family **Neo4j (Bolt)**, also in *Database source*) connects to Neo4j Aura or an own server with Neo4j's driver over
WebSocket (`neo4j+s://…`, database, user name and password; the password is never stored in clear text). The source opens
a Cypher editor: the result becomes a table, or a graph dataset when the answer holds nodes and relationships; queries
can be kept on the source. The connection needs consent (purpose Neo4j) and is not subject to CORS; an own server without
TLS (`bolt://`) is reached only from a page over http://. See [grafer.md](grafer.md#neo4j-as-a-source).

### OpenCDE server (BCF and Documents API)

The way **OpenCDE** under *Add sources* (the family **OpenCDE (BCF, Documents)**, also in *Database source*) connects to a server that implements buildingSMART's
OpenCDE APIs, for example [Dataregium](https://github.com/marwiss/Dataregium). Enter the server's address. Leave the client id empty when the server lets the app register itself (see below), otherwise the client id
its administrator registered for Dataspatium (a public client with the redirect URI
`http://127.0.0.1:8080/oauth-callback.html`, or the equivalent for the address the app is served from). The source opens
a view where you sign in to the server (OAuth2 with PKCE in a pop-up; from file:// you paste the address you end up on
after signing in), pick a project and fetch topics, comments, viewpoint components (one IFC element per row), events and
files as tables. *Fetch documents* opens the server's own document selection page (Documents API); the chosen files are
downloaded and imported as if dropped on the app, so an IFC model becomes a model dataset. Access tokens live in the
session only and are never exported with the source. The connection needs consent (purpose OpenCDE server) and a server
that allows requests from the browser (CORS).

The app speaks BCF API 3.0 and 2.1. It chooses the newest version the server offers, and a server of 2.1 alone works too: such a server often
has neither the Foundation API nor the Documents API, so the app reads the version from `/bcf/versions` and the sign-in addresses from
`/bcf/2.1/auth`, and leaves out *Fetch documents*. Under *More options* in the dialog you can choose the version yourself, and when the server offers
several you can change in the source's view. In 2.1 *Files in the project* lists only the BCF documents, issues have no number from the server and a
viewpoint cannot be deleted. In return a comment can answer another: the button *Reply* in the panel *Issues*.

The card *The project's members* appears when the server has project administration (a Dataregium extension). A project's manager,
who need not be a server administrator, signs in with *Sign in as project manager* and sees the projects they manage and their members
with roles: viewer, contributor, editor or manager. You add a person by their exact user name on the server, change a role, remove a
member and rename the project; every change is confirmed first. The server does not let the project be left without a manager and
says so; projects are not deleted from here, and an administrator creates new accounts.

Topics are fetched in pages of 500. A list the server has capped (Dataregium caps at 1,000 items) is read to the end through
the server’s Link header with rel="next", but only on the same server, so that your token never goes anywhere else.

The card *IFC-LPG* appears when the server has a graph, see [grafer.md](grafer.md#ifc-lpg-on-a-dataregium-server).

Under *Files in the project* the source lists the models and documents the server holds for the project. *Fetch* makes a
dataset of the file's own kind, so an IFC file becomes a model and a CSV file a table, and the dataset remembers which
server, project and version it came from. In Manage the card *From the CDE* shows this, and *Check for a new version* asks
the server whether the document has a newer version; that version is then fetched as a dataset of its own beside the old
one. The source also says what you may do in the project, such as create issues or upload documents. When the source is
made, the dialog asks the server where to sign in; if the server does not answer then, the app asks again at the first
sign-in.

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
the heading which server it is and which extensions it has (self-registration, request log, administration, IFC-LPG, graph
queries). A server without the document has no extensions, and everything in the specifications works anyway. The server's error
codes (`code` in the answer, for example `reauthentication_required`) are shown in your language; unknown codes show the server's own
text. The link *Open in Dataspatium* on the server's pages has the form `index.html#/inhamta/opencde?server=https://…` and opens
the dialog for a new source with the address filled in. A server the workspace already has as a source opens directly. The link can also name a project and a document
(`&project=…&document=…&version=…`): the project is chosen and the document fetched as a dataset once you are signed in. Pages that
Dataregium opens in a popup (sign-in, upload, document selection) appear in the app's language.

**Administration.** If you are an administrator on a Dataregium server, the source's view shows the card *Administration* (when the server's capabilities document says the administration API is on). The button *Sign in as administrator* asks for the scope `admin`; then the tabs Overview, Users (create, change, disable, reset password, delete), Projects (create, rename, members and roles, delete), Clients (register, change, rotate secret, revoke tokens, delete), Sessions (end one or all of a user), Audit, Settings and Health follow, plus Graph query when the server allows reading Cypher against the IFC graph. Dangerous operations need a fresh sign-in: the server answers `reauthentication_required`, the app opens the sign-in again and repeats the call. One-time values (an initial password, a client secret) are shown once with a Copy button and never written to the log. Every list can be saved as a dataset and fetched again from Hantera.

## Open geodata

The dialog for *Geodata source* under *Add sources* starts with a list of **ready-made geodata sources**: open WFS, OGC API Features and
ArcGIS services of Nordic agencies and municipalities (SCB, SGU, Naturvårdsverket, SLU Artdatabanken, Riksantikvarieämbetet,
Skogsstyrelsen, Kartverket, Miljødirektoratet, Riksantikvaren, Statistics Finland, SYKE, Helsinki, Väylävirasto,
Danmarks Miljøportal, Københavns Kommune, Plandata.dk, Landmælingar Íslands and others), all verified to work from the
browser. A preset source opens, the others are added with one click and their layers read from the service; filter
by name, country or contents. The list lives in `presets/geodata/services.json`. Below the list are the fields for a

Three sources fetch plans: *Plandata.dk (WFS)* and *Skipulagsstofnun skipulagsgögn (ArcGIS)* have the button **Fetch
plan**, which reads a whole local plan or deiliskipulag (every layer) by its plan number and keeps it as a plan, and
*Ryhti kaavatiedot (OGC API Features)* gives Finland's plan index. See [planer.md](planer.md#plans-from-the-other-nordic-countries).
service of your own. Boverket's Planbestämmelsekatalog is an ordinary API source (*Boverket Planbestämmelsekatalogen*),
see [planer.md](planer.md).

The way **Geodata source** under *Add sources* in Acquire makes an ordinary API source of the address of a geodata
service, just like the database sources. The app reads the service's layers and adds one endpoint per layer plus a
generic one where you name the layer yourself. The answers are GeoJSON in WGS 84: the dataset gets a geometry column
and opens as a map in Process (see [kartor.md](kartor.md)). The source shows the layers as a filterable list; choose a
layer, limit by an area (bbox) when you can, and fetch. The preview shows the answer as a small map above the table,
and *Open as map* takes you to the saved dataset.

| Family | Discovery | Fetching | Key |
|---|---|---|---|
| WFS 2.0 (GeoServer, MapServer, Deegree) | GetCapabilities | GetFeature with `outputFormat=application/json` and `srsName=EPSG:4326`; area (bbox), CQL filter, columns; pages with `startIndex`/`count` | Bearer (optional) |
| OGC API Features | `/collections` | `/collections/{id}/items` with bbox, datetime and filter; next links are followed | Bearer (optional; required by Lantmäteriet's geodata platform) |
| ArcGIS REST (FeatureServer, MapServer) | The service description or a whole directory | `/{layer}/query` with where, area, `f=geojson` and `outSR=4326`; pages with `resultOffset` | Token (optional) |

Preset geodata sources without a key (CORS verified): SCB open geodata, SGU, the Swedish Agency for Marine and Water
Management, the National Heritage Board's ancient remains, the Swedish Forest Agency, Kartverket's administrative units
and cadastral map (Norway), Statistics Finland and SYKE (Finland). The layers are read from the service the first time
the source is opened and can be reread with *Reread layers*; the list is kept in your copy of the source. Lantmäteriet's
geodata platform (detailed plans, buildings, shore protection, cultural heritage remains and the boundary of forest near the mountains) is a level 2 source with a Bearer key from a connected organisation.

**Trafikverket’s NVDB** (*Trafikverket NVDB: road data*) gives 45 object types from the Swedish national road database, such
as speed limits, road numbers, bearing capacity, number of lanes, street names, junctions and rest areas, with one endpoint
per object type. It needs a free key from [data.trafikverket.se](https://data.trafikverket.se/), which is sent in the request
body and never in the address. Give the area in WGS 84 as for the other sources; the app converts it to SWEREF 99 TM, and
without an area the whole country is fetched. The answers are read in pages of 5,000 objects, and the geometry is converted
to WGS 84 so that the dataset opens as a map. The data are CC0.

**Geodataportalen** (geodata.se) is Sweden's national catalogue of the geodata of agencies, regions and municipalities.
The source *Geodataportalen (sök geodata)* searches the catalogue and shows one record per hit with title,
organisation, abstract and services: a WFS, OGC API or ArcGIS service is added as a geodata source with one click and
opened at once, a WMS address is copied for use as a background map or WMS layer in a map view, and download files and
metadata open in a new tab. The hit list can also be fetched as a table under the *Endpoints* tab.

Geodata services often answer with many features: limit by an area or a filter, and raise *Maximum pages* under *More
options* only when needed. Your own service must allow requests from the browser (CORS) just like the database sources;
most agencies' GeoServer and ArcGIS Server do.
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
