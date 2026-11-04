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

The button **Add a database source** under *Databases* in Import makes an ordinary API source out of an address
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

## Open geodata

The dialog *Add geodata source* starts with a list of **ready-made geodata sources**: open WFS, OGC API Features and
ArcGIS services of Nordic agencies and municipalities (SCB, SGU, Naturvårdsverket, Riksantikvarieämbetet,
Skogsstyrelsen, Kartverket, Miljødirektoratet, Riksantikvaren, Statistics Finland, SYKE, Helsinki, Väylävirasto,
Danmarks Miljøportal, Københavns Kommune, Plandata.dk, Landmælingar Íslands and others), all verified to work from the
browser. A preset source opens, the others are added with one click and their layers read from the service; filter
by name, country or contents. The list lives in `presets/geodata/services.json`. Below the list are the fields for a

Three sources fetch plans: *Plandata.dk (WFS)* and *Skipulagsstofnun skipulagsgögn (ArcGIS)* have the button **Fetch
plan**, which reads a whole local plan or deiliskipulag (every layer) by its plan number and keeps it as a plan, and
*Ryhti kaavatiedot (OGC API Features)* gives Finland's plan index. See [planer.md](planer.md#plans-from-the-other-nordic-countries).
service of your own. Boverket's Planbestämmelsekatalog is an ordinary API source (*Boverket Planbestämmelsekatalogen*),
see [planer.md](planer.md).

The button **Add geodata source** under *Databases* in Acquire makes an ordinary API source of the address of a geodata
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
geodata platform (detailed plans) is a level 2 source with a Bearer key from a connected organisation.

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
id). It is used by coming sources such as Neo4j (Bolt over WebSocket, planned for 2.9) and streaming APIs; no
presets use it yet.

## Limitations

- The bridge runs on the computer where the app is used; remote databases are reached through drivers or DSNs on that computer.
- At most 100,000 rows per fetch through the bridge unless `-MaxRows` is raised; large tables are best narrowed with SQL.
- Access files in the browser: no queries, linked tables or passwords; very large files take memory.
- Elasticsearch gives at most 10,000 hits per search (`from` + `size`).
- All HTTP sources require CORS; it cannot be bypassed from the browser.
