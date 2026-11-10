[Svenska](../../README.md) · [Dansk](../da/README.md) · [Norsk bokmål](../nb/README.md) · [Norsk nynorsk](../nn/README.md) · [Suomi](../fi/README.md) · [Íslenska](../is/README.md) · **English**

<img src="../../src/ui/design/icon-192.png" alt="" width="64" height="64" align="left">

# Dataspatium OpenCDE client

Dataspatium is a web app for data from source to report: import data from files and open APIs, store and
manage datasets, review and correct values, analyse with R, visualise and export. Everything runs in your own
browser. No server, no installation, no accounts. Your data never leaves your computer unless you export it
yourself. Security is the first requirement: no network call without your action and your consent, secrets only encrypted, components pinned and verified, and everything shared is reviewed first.

![Dataspatium in Process mode with a table of Swedish municipalities](../images/bearbeta.png)

**Contents**

- [Download and get started](#download-and-get-started)
- [Requirements](#requirements)
- [What you can do](#what-you-can-do)
- [The OpenCDE APIs and their clients](#the-opencde-apis-and-their-clients)
- [Dataspatium and Dataregium](#dataspatium-and-dataregium)
- [Learn more](#learn-more)
- [Limitations in brief](#limitations-in-brief)
- [Personal data](#personal-data)
- [Next in the 3 series](#next-in-the-3-series)
- [Bugs and suggestions](#bugs-and-suggestions)
- [Development](#development)
- [Licence](#licence)

The interface is available in Swedish, Danish, Norwegian (Bokmål and Nynorsk), Finnish, Icelandic and English. The screenshots in the
documentation show the app in Swedish.

## Download and get started

1. **Download.** Go to the [latest release](https://github.com/marwiss/Dataspatium/releases/latest) and fetch
   the ZIP file under *Assets* (`dataspatium-<version>.zip`, about 100 MB; R and all R packages are included).
2. **Unpack.** Right-click the ZIP file and choose *Extract all* (Windows) or double-click it (macOS). Put the
   folder where you want it, for example in Documents. The app does not work directly inside the ZIP file.
3. **Open.** Double-click `index.html` in the folder, or drag the file into a browser window. If Windows asks which
   app to use, choose Edge, Chrome or Firefox. The first time, the app asks which language you want (it can be
   changed with the language button at the top right) and then starts the **beginner's course**, an interactive
   walkthrough of all the modes with example data that takes about ten minutes. Reopen it from the help (?).
4. **Import.** In *Import* mode, drop a file on the surface (or click *Try with example data*), check the column
   types and click *Import*. The dataset is stored in the browser on your computer.
5. **Carry on.** Switch mode at the top: *Manage* shows your datasets and the workspace, *Search* finds rows in
   them, *Process* shows the table with sorting, filters and actions, *Analyse* opens the R and SQL consoles,
   *Visualise* builds charts, *Export* downloads data, charts and documents and *Share* gives them to others.

Data is stored in the browser's own database. If you clear site data it disappears, so back up regularly under
*Manage > Workspace*. The backup is a ZIP file that can be restored on the same or another computer. Step by step
with more detail: [kom-igang.md](kom-igang.md) (Getting started).

The app is also available directly on the web, with nothing to download: <https://marwiss.github.io/Dataspatium/>.
From a web server it can be installed as an app of its own (Edge and Chrome: *Install* in the address bar) and then
works without a network too. The web version and the folder version have separate workspaces; move data between them
with a backup or a bundle.

## Requirements

- Windows, macOS or Linux.
- Microsoft Edge or Google Chrome (version 120 or later), or Firefox (version 128 or later). Safari is not
  supported.
- About 300 MB of free space for the app folder and at least 4 GB of memory (8 GB recommended for large
  datasets). No administrator rights are needed.
- Internet is needed only when you fetch data from open APIs, push to GitHub, check for updates or fetch a
  component or an R package that does not ship in the folder; the app asks for permission first.

## What you can do

- **Import**: CSV, Excel, ODS, JSON, JSON-stat, SDMX-JSON, GeoJSON, XML, SQLite, GeoPackage and shapefile files, tables in HTML, Markdown, Word and LaTeX documents, KML, KMZ, GPX and TopoJSON map files, SQL scripts, older spreadsheet formats (dBase, Lotus 1-2-3, Quattro Pro, SYLK, DIF), fixed-width
  text, statistical files from SPSS, Stata and SAS (with value labels) and Statistics Sweden's PX format, Parquet and RDS (via R), pasted
  text, files from web addresses, and data straight from open APIs at Statistics Sweden (SCB), the Public Health
  Agency of Sweden, the National Board of Health and Welfare, Kolada, Eurostat, SMHI, the Swedish Environmental
  Protection Agency, Lantmäteriet and Sweden's data portal as well as the ECB and the OECD, with saved fetches that
  update with one click and replay their recipes (see [api-konfiguration.md](api-konfiguration.md)). Example data
  and municipality and region boundaries for Sweden, Denmark, Norway and Finland are included.
- **Databases**: Access files are read directly in the browser; databases on the computer or in the network (SQL
  Server, ODBC, Excel, SQLite) are reached through a local bridge, and PostgREST/Supabase, OData, GraphQL, CouchDB,
  ClickHouse, Elasticsearch, SPARQL, InfluxDB, Google Sheets and Airtable become sources with one click. Files can be
  linked and read again from disk (see [kallor.md](kallor.md)).
- **Documents and images**: PDF, Word, OpenDocument, Markdown and text become document collections read in a reading view, page by
  page or as a whole; pictures become an image collection with EXIF details and a gallery. The tools Text (word
  frequency, keywords in context, co-occurrences) and Images (overview, duplicates) work without code (see [dokument.md](dokument.md)).
- **Process**: browse, sort and filter large tables, edit cells, clean, type, recode, group into classes, rank, compute shares, running totals and changes, pivot and join data,
  check data quality with a profile and rules (among them formats, Nordic identity numbers, references to other datasets and outliers), pseudonymise personal identity numbers before sharing, look up
  municipality and county from coordinates, with undo, versions and recipes that can be exported as R or SQL (see
  [bearbeta.md](bearbeta.md)).
- **Analyse**: a built-in R console with ggplot2 and the tidyverse (see [r-guide.md](r-guide.md)), a Python console
  with pandas and matplotlib fetched the first time (see [python.md](python.md)), an SQL console
  where datasets are joined by their short names, and notebooks with text, R and SQL cells that become reports in
  HTML, Word, PDF, Markdown or LaTeX (see [anteckningsbok.md](anteckningsbok.md)), and a Regex tab where regular expressions are tried on a column and used to filter, extract, replace and split (see [regex.md](regex.md)), entirely in the browser.
- **Maps**: geodatasets open as maps to zoom in, map views with several layers and a background map after consent
  become dashboards and published HTML, the geo tools compute area, points in areas, nearest, buffers and overlays
  without code, and QGIS projects become map views (see [kartor.md](kartor.md)).
- **Open geodata**: WFS, OGC API Features and ArcGIS services become sources whose layers are fetched as maps, with
  presets for SCB, SGU, HaV, RAÄ, the Forest Agency, Kartverket, Statistics Finland and SYKE, search in
  Geodataportalen, and WMS services as background map or layer (see [kallor.md](kallor.md)).
- **Plans**: Swedish digital detailed plans (the national specification, Lantmäteriet's geodata platform) open as plan
  maps with Boverket's colours and designations, the provisions are looked up in Boverket's catalogue of plan provisions
  (embedded copy), and comprehensive plans (the specification or Boverket's ÖP model) are shown theme by theme (see
- **Nordic plans**: Denmark's local plans and municipal plan frames (Plandata.dk), Finland's plan data model and plan
  index (Ryhti), Iceland's digital detailed and master plans (Skipulagsstofnun) and Norway's reguleringsplaner
  (GeoPackage) open as plans in each country's colours; a whole plan is fetched by its number from Plandata and Skipulagsstofnun.
- **Graphs**: GraphML, GEXF, JSON with nodes and edges and Cypher scripts open as graphs with an overview per label, focus
  and whole-graph views (Cytoscape and sigma), a Cypher subset translated to SQL, graph measures in the background and
  export in all four formats; two tables become a graph (see [grafer.md](grafer.md)).
  The graph is edited in Process and with writing Cypher (recipe steps), Neo4j is a source over Bolt, the Graph tab has
  PageRank, communities, centrality, pattern queries and layout, and graphs become charts in Visualise, dashboards and Publish.
  [planer.md](planer.md)).
- **CAD and BIM**: IFC models open in 3D (web-ifc and three.js) above a table of the building elements, and the selection follows
  both ways. Properties and quantities become tables, the Quantities tab counts per type, storey and material, and DXF drawings
  show as SVG with layers. The card *Validate the model* gathers the server's check (the IFC schema, buildingSMART's rules and the project's IDS files) and the
  checks in the app, and *Clash check* finds building parts that run into each other or lie too close and can send them as BCF topics (see [cad-bim.md](cad-bim.md)).
- **AI modelling and versions**: the panel *Ask AI about the model* lets a language model (Anthropic or an OpenAI-compatible API, with
  your own key stored encrypted) answer questions about an IFC model through tools that read the model's tables and, for a model from
  Dataregium, the server's named queries. In the mode *Change* the AI proposes a change set (storeys, grids, walls, slabs, openings,
  properties, moves) that is previewed in 3D, checked locally and by the server's precheck, and applied as a recipe step only when you
  approve; the AI can never save or publish. A change set can be sent to Dataregium as a change proposal, tried there against the base
  version and approved by a *manager* into the document's next version, with collisions listed when the document has moved on.
  *Compare versions* shows what is new, gone and changed between a model and a snapshot, another model, the server's change set per
  version or the server's diff, marked in 3D. A model from Dataregium is published with its base version, so that the server refuses
  when someone got there first.
- **Flows and watches**: a saved chain (fetch, recipes, scripts, lists, charts, dashboards, documents, export) runs with one click or at
  start, and watched sources say so in the status bar when they have new data (see [floden.md](floden.md)).
- **Statistics without code**: the Statistics tab does descriptive statistics, crosstabs, correlation, hypothesis tests, regression and
  clustering with forms that write and show the R or Python code. Time series operations in Process (periods, change, index, moving average,
  seasonal adjustment), and a regression can be saved and used as the recipe step Prediction (see [statistik.md](statistik.md)).
- **Field collection**: a form built on a dataset's columns and rules is sent to Dataspatium Mobil. The phone collects rows without a network, with photo and
  position, and the rows come back as a new version. The photos become an image collection and the positions end up on the map (see [insamling.md](insamling.md)).
- **The modes follow the dataset's kind**: the app says what a file is and what a dataset can also be used as, asks about coordinates, coordinate systems and links on import, sorts mixed folders and shows a picture per dataset in Manage. Search hits open where they are (page, picture, node, element, plan object or place), you can search by place, find nodes through their edges and elements through their properties, comment on a page, a picture, a node or a place, fix text, set positions on pictures, repair geometries, find duplicates in graphs and classify elements. Analyse opens in the right tool with code written for the dataset, shows the trend of a time series and counts places per area, and a selection travels with you between the modes (see [lagen.md](lagen.md)).
- **Visualise, Export and Share follow the kind**: chart suggestions with real pictures for every kind, cross-filters in dashboards and template words that put a map, a graph, a model or a plan into a document; KML, GPX and GeoPackage for places, a contact sheet for pictures, plan map and provisions for plans, quantities in Excel and glTF for models and PDF for drawings; in Share you choose whether the files go into the package, turn a dataset into a page of its own to send, and see each kind in its own form on the phone (see [visualisera.md](visualisera.md) and [dela.md](dela.md)).
- **Review before sharing**: everything that leaves the app is reviewed as a whole, with columns, running text, side tables, original files, picture positions, graph edges, comments and authors; personal data can be kept, pseudonymised or removed in the copy, and the dataset itself never changes (see [dela.md](dela.md)).
- **Code lists, descriptions and guides**: labels from SNI, SSYK, NACE and other lists with a click, data packages, DCAT-AP-SE, a quality declaration and four guides with real data (see [lagen.md](lagen.md)).
- **Text from pictures**: scanned PDF files, pictures and pictures of tables are read with text recognition in the browser, in all seven languages.
- **Provenance, working together and a library**: see where a dataset comes from and what it has become, work together through GitHub without losing anything, fetch recipes and templates with licences, and publish the workspace as a site.
- **Dataregium and OpenCDE**: an OpenCDE server such as [Dataregium](https://github.com/marwiss/Dataregium) becomes a source in Import, with OAuth2 sign-in and self-registration where the server allows it. The app fetches the project's models and documents and says when a newer version exists, shows the issues that point at the elements, creates issues from the selection in the 3D view with the view as viewpoint, comments and changes status, colours the model by issue status, saves the issues as a table with the tool Issues and the dashboard Issue status, reads and writes BCF files, sends datasets, files and workspace bundles to the server, queries the server's IFC graph with Cypher, reads what the server offers and explains its error codes, and logs every request with an X-Request-Id that pairs with the server's request log, and administers the server (users, projects, clients, sessions, audit, settings, health and graph queries) from the card Administration when you are an administrator (see [Dataspatium and Dataregium](#dataspatium-and-dataregium) below).
- **Light start**: big parts such as R and Python load when they are first used, and the status bar shows what is loading meanwhile.
- **Coordination with Dataregium, step 1**: the app reads the server's capabilities document, translates its error codes, carries a shared glossary in seven languages and opens a source from the link Open in Dataspatium.
- **Visualise**: charts with Vega-Lite (including choropleth and point maps with the bundled municipality and
  county boundaries, fixed axis limits, logarithmic scale, reference lines and trend lines), D3 templates or R, exported as SVG, PNG, PDF and PowerPoint, also in batch per group, and
  dashboards with shared filters that become HTML or PowerPoint (see [visualisera.md](visualisera.md)).
- **Document**: reports and codebooks from templates as HTML, Word, PDF, Markdown or LaTeX, also one document per
  municipality or year (see [dokumentmallar.md](dokumentmallar.md)).
- **Export and share**: data to CSV, Excel, ODS, JSON, GeoJSON, XML, SQLite, Parquet, SPSS, Stata and RDS; in the
  *Share* mode bundles with chosen datasets and objects, a message and a change log, sync with a GitHub repository, the
  computer's share menu and publishing of dashboards and documents as standalone HTML (see [dela.md](dela.md));
  direct transfer to phones and other computers on the same network with a QR code and a verification code, and
  *Dataspatium Mobile*, which receives, shows and forwards on the phone (see [mobil.md](mobil.md)); a review of
  personal data before anything is shared; comments on datasets and columns, a workspace backup as ZIP and, in Edge
  and Chrome, a portable folder with ordinary files.
- **Keeping order**: folders and tags for datasets, filter and sorting, and batch actions on several datasets at
  once (organise, bundle, export, re-fetch, run recipe, delete).
- **Find things fast**: the *Search* mode looks through every column of one or all datasets, with facets that narrow
  the hits and saved lists (see [soka.md](soka.md)); the command palette (Ctrl+K) switches mode, opens datasets,
  charts and dashboards and runs actions from a single search field.
- **Query without code**: the *Query* tab in Search joins datasets, picks columns and calculations, sets conditions
  and shows the SQL it creates; saved lists narrow the table in Process and the rows of charts.
- **Help in the app and presentation**: the whole handbook with search opens with ? or F1 at the chapter of the mode
  you are in, and **Present** shows a dashboard in the whole window one chart at a time.
- **Seven languages**: the interface, the messages and the documentation are available in Swedish, Danish,
  Norwegian (Bokmål and Nynorsk), Finnish, Icelandic and English.
- **Beginner's course**: an interactive walkthrough of all eight modes with example data, in all seven languages. It is
  shown the first time the app is opened and can be opened at any time from the help or the command palette.

## The OpenCDE APIs and their clients

OpenCDE is buildingSMART International's family of open web APIs for a common data environment, the place where a project shares
its models, documents and issues. A client and a server that follow the same specifications can work together, whoever built them.
Dataspatium uses all three:

| API | What the app does with it | Specification |
|---|---|---|
| Foundation API 1.0 | Reads which APIs the server offers, where to sign in and who the user is; registers the app as a client when the server allows it | [foundation-API](https://github.com/buildingSMART/foundation-API) |
| BCF API 3.0 and 2.1 | Reads and writes topics about a model, with comments and viewpoints (camera, components and snapshots) from the 3D view; picks the newest version the server offers | [BCF-API](https://github.com/buildingSMART/BCF-API) |
| Documents API 1.0 | Picks and fetches documents and versions through the server's own pages, so that an IFC model becomes a dataset, and uploads new versions, datasets and bundles | [documents-API](https://github.com/buildingSMART/documents-API) |

**Dataregium is one server, not the only one.** The app should connect to any server that follows the specifications: nothing in the
app depends on Dataregium, and Dataregium's extensions beyond the specifications (the capabilities document, the named graph queries,
the precheck, the base version, change proposals and the diff between versions) appear only when the server itself announces them.
The app needs three things from a server:

- that the server allows calls from the browser (CORS) from the app's origin: `null` when the app is opened from file://,
  `http://127.0.0.1:8080` from a local web server and `https://marwiss.github.io` from the web, with the headers Authorization,
  Content-Type and X-Request-ID;
- a client registration, made by the server's administrator (a public client with the redirect address
  `http://127.0.0.1:8080/oauth-callback.html`, or the equivalent for the address the app is served from) or by the app itself when the
  server allows it, and sign-in with OAuth2 authorization code with PKCE `S256`; from file:// you paste the address you land on after
  signing in;
- BCF API 3.0 or 2.1; the Documents API is optional, but without it the app cannot fetch or publish documents.

So far this is shown against Dataregium: the live suite runs against the server in both versions of the BCF API, and a server with
only 2.1 works. Other servers are untested; tell us how it went under [Bugs and suggestions](#bugs-and-suggestions). When the app and
a specification disagree, the specification decides. The server's side is described in Dataregium's README and client guide; the
app's in [kallor.md](kallor.md).

## Dataspatium and Dataregium

*Dataregium was called Kontroll until 8 November 2026.*

Dataspatium (the app in the browser) and [Dataregium](https://github.com/marwiss/Dataregium) (a server for buildingSMART's OpenCDE APIs Foundation, BCF and
Documents) are developed to work together as client and server. The app adds the server as a source in Import, signs in with OAuth2
and registers itself as a client when the server allows it, fetches the project's models and documents, reads and writes issues with
viewpoints from the 3D view, sends datasets, files and workspace bundles back through the Documents API, queries the server's IFC
graph with Cypher and logs every request with the same X-Request-Id the server writes in its request log. The graph queries and the administration are extensions outside the specifications; everything else goes through the three
OpenCDE APIs, so other OpenCDE clients work too. The server is not needed for the rest of the app: without one, everything else
works as before. Dataregium's README and `docs/client-guide.md` describe the
cooperation from the server's side; here it is described in [kallor.md](kallor.md) and [cad-bim.md](cad-bim.md).

The app speaks BCF API 3.0 and 2.1, so it also connects to servers that have only 2.1, and it draws and queries the server's IFC graph directly from Import.

Dataspatium 3.0.0 works with Dataregium 3.0.0. Both carry the same release number, so equal numbers belong together. The quick start
[snabbstart.md](snabbstart.md) takes the pair from nothing to an issue in twenty minutes.

### The releases 1, 2 and 3

There is one release per major number, and Dataspatium and Dataregium with the same number belong together:

| Dataspatium | What it has | Belongs with |
|---|---|---|
| 1.0.0 | The whole 1 series: data import, processing, R, Python, maps, charts, documents and sharing, and plans. Against a server only the Documents API: fetch documents as datasets and send datasets and files back. No issues and no models | Dataregium 1.0.0 (Documents API only) |
| 2.0.0 | The whole 2 series: IFC models in 3D with tables, properties and quantities, issues with viewpoints (BCF API 3.0 and 2.1), the server's IFC graph (IFC-LPG) drawn and queried, and plans from planning tools in full | Dataregium 2.0.0 |
| 3.0.0 | The 3 series: the card *Validate the model*, the clash check in the browser, BCF cameras in the model's coordinates, the graph in its skeleton form, Ask AI and Change with AI, Compare versions, publishing with a base version and a precheck, change proposals tried and approved on the server | Dataregium 3.0.0 |

A new release in the same major number replaces the previous one; only the newest in each series gets fixes. The app's update check
offers the next major number, and datasets, lists, charts, templates and scripts come along when you open the new version's `index.html`.

## Learn more

The file names are the same in every language (they are the Swedish originals), so links work the same way
everywhere.

- **The handbook** in the app: the same documentation as here, with search; open it with ? at the top right or F1.
- **The beginner's course** in the app: an interactive walkthrough of all the modes with example data; open it from
  the help (?) or with Ctrl+K.
- [Getting started](kom-igang.md): step by step with common questions.
- [Quick start with Dataregium](snabbstart.md): twenty minutes from nothing to an issue created in the 3D view and visible on the server.
- [User guide](anvandarguide.md): the whole workflow from file to report.
- [FAQ](faq.md): storage, security, R, APIs and updates.
- [The eight modes](lagen.md): what is where and why.
- [Search](soka.md) and [Share](dela.md): finding without code, and giving data to others.
- [Dataspatium Mobile](mobil.md): the phone as courier, receiver and viewer; transfer between devices.
- [Notebook](anteckningsbok.md): text, R and SQL in cells that become a report.
- [Documents and images](dokument.md): PDF, Word, OpenDocument, Markdown and pictures as datasets; the document view, the gallery and the tools Text and Images.
- [Maps](kartor.md): the map in Process, map views in Visualise, the geo tools and QGIS projects.
- [Regular expressions](regex.md): patterns for analysing, correcting and splitting text in datasets.
- [Formats and import](format.md): file formats, character encoding, decimal separators, dates and column types.
- [Open APIs](api-konfiguration.md): the preset sources, keys and how to write your own configuration.
- [R in Dataspatium](r-guide.md): the R console, `dm_read()`, `dm_write()` and the bundled packages.
- [Python in Dataspatium](python.md): the Python console, `dm_read()`, `dm_write()` and packages fetched on demand.
- [Visualise](visualisera.md): the chart builder, D3 templates, R charts, maps and dashboards.
- [Documents and templates](dokumentmallar.md): the template language and the output formats.
- [Security](sakerhet.md): threat model, the controls and the tests that prove them, personal data and retention, and how to report a vulnerability.
- [Licences](licenser.md): what you may do with the app and which licences the third-party components have.
- How contributions are received is in
  [CONTRIBUTING.md](../../CONTRIBUTING.md) (Swedish).

### Further reading

- [BCF API](https://github.com/buildingSMART/BCF-API), [Foundation API](https://github.com/buildingSMART/foundation-API) and [Documents API](https://github.com/buildingSMART/documents-API): the specifications the app follows against a server.
- [IFC](https://github.com/buildingSMART/IFC4.x-development): the file format for building models, and [IDS](https://github.com/buildingSMART/IDS): requirement specifications that models are checked against.
- External resources: [WebR](https://docs.r-wasm.org/webr/latest/), [R for beginners](https://www.r-project.org/),
  [Vega-Lite](https://vega.github.io/vega-lite/), [Statistics Sweden's API](https://www.scb.se/en/services/open-data-api/).

## Limitations in brief

- The app must be opened from an unpacked folder (file://) or an ordinary web server; it does not work directly
  inside a ZIP file.
- APIs without CORS support (for example the Riksbank's) cannot be called directly from the browser.
- A dataset should stay below a couple of million rows; the browser's memory sets the limit.
- When the app is opened from a folder, R code cannot be stopped in the middle of a calculation; use *Restart R*.
  From a web server (localhost or https) there is the button *Stop*.
- Several tabs work and keep each other informed, but do not edit the same dataset in two tabs at the same time:
  the one that saves last wins.
- The portable folder requires Edge or Chrome; Firefox lacks folder access (File System Access). Backup as ZIP
  works everywhere.
- The whole app is made for computers; on phones and tablets Dataspatium Mobile
  (<https://marwiss.github.io/Dataspatium/m/>) receives, shows and forwards. Safari is not supported for the whole
  app. In narrow windows the panels open as sheets over the work area.
- The bundled example data, API presets and map boundaries are Swedish; the app itself works with data from
  anywhere.

## Personal data

Dataspatium runs in your browser, and you are responsible for the data you put in. Everything the app saves (datasets and their
versions, lists, charts, documents, notebooks, comments and settings) lives in the browser's storage on your computer and leaves it
only when you export, share or publish; everything is then reviewed in full first, and personal data can be kept, pseudonymised or
removed in the copy. To a Dataregium server the app sends your sign-in (tokens are kept in the session or encrypted with your
passphrase, never in clear text), the topics, comments, proposals and files you create under your name on the server, and an
X-Request-ID per call; the server's own processing is in Dataregium's README. To an AI provider the app sends only what you ask and
the answers the tools read from the model, after consent for the purpose AI, with your own key stored encrypted; the project's policy
can restrict to local models. Comments and bundles carry the name you give yourself. The controls and the tests that show them are in
[sakerhet.md](sakerhet.md).

## Next in the 3 series

3.0.0 is the first release of the 3 series, made together with Dataregium 3.0.0: the checking of models, the clash check, the AI
steps and the version comparison, which [What you can do](#what-you-can-do) describes. Like every major number the series has a
single release, released again as it grows. What follows makes the app the client that edits the server's model and shows its
versions: the AI proposes, the person reviews and approves, the server tries and merges. This section says what is decided, for
whoever, person or AI agent, carries a part of it on; the server's side is in Dataregium's README under the same heading.

### Decided

- **Modelling happens in the app, not on the server.** The modelling wheel (the write tools and IfcOpenShell in the app's Python) is
  Dataspatium's own, under Dataspatium's licence, and carries no code from IFC-LPG; the server reaches it only through the APIs.
- **The AI proposes, the person approves.** A change set is previewed in 3D, checked locally and by the server's precheck, and
  applied only when you approve; deleting is confirmed once more; publishing and proposing to the server are buttons, never tools
  the AI can call. Built in 3.0.0.
- **The version model.** A change set goes to the server as a BCF topic with a snippet in the server's form (GlobalId and path as
  the key), the server tries it against the base version and a *manager* approves it into the next version; a publish with a stale
  base is refused (412) and the collisions are shown. Built in 3.0.0. Next: a three-way merge in the app at a collision, the version
  history per document and a BCF topic per approved change set.
- **Compare versions** from three sources: snapshots and other models in the app, the server's change set per version and the
  server's diff between versions. Built in 3.0.0.
- **The project's manager** gets a page in the app when Dataregium's API for members and roles exists.
- **Steps 4 and 5, after step 3:** a repository mode per project with a local Dataregium on your own computer and fetch and publish
  between the local and the remote one; large models drawn from the server's geometry API when the browser is not enough; project
  profiles with IDS and bSDD, IDS written by the AI and buildingSMART rules tied to elements.
- **Open formats** apply to exchange formats and stored data, not to AI APIs; the AI provider is chosen by the user with their own
  key, stored encrypted, and the project's policy can restrict to local models.

## Bugs and suggestions

Report bugs or requests as *Issues* here on GitHub. Describe the browser, the Dataspatium version (shown under the
help button) and what you did. See [CONTRIBUTING.md](../../CONTRIBUTING.md). Attach no personal data and no secrets. For a security
vulnerability follow [SECURITY.md](../../SECURITY.md) instead of opening an issue.

## Development

- No build step, no node.js. Open `index.html` directly, or serve the folder with `python -m http.server 8080`.
- Architecture in brief: all of the app's own code is classic scripts registered with `Dataspatium.define` in the order of `src/boot.js`; `src/platform` carries everything specific to file:// (assets, shims, workers, storage, consent); the engines SQLite, R (WebR) and Python (Pyodide) run in workers; `src/ui` holds the design tokens, the components (`dm-*`), the shell and one mode per file. Everything rendered is escaped, and nothing is fetched from the network without your action and consent.
- Third-party components: `python tools/fetch_vendor.py` followed by `python tools/wrap_assets.py`.
- Tests: `powershell -File tools/run-tests.ps1` or `tools/run-tests.sh` (headless Edge and Firefox).
  (Swedish).
- Security: the tests for consent, secrets, review before sharing, OAuth2 (PKCE, state, callback) and log masking are part of the suite; see [sakerhet.md](sakerhet.md).

## Licence

Dataspatium's own code, documentation and presets (everything except `vendor/`) are licensed under
[PolyForm Strict 1.0.0](../../LICENSE): free to download and use for non-commercial purposes, including in public
authorities and other public institutions, but not to modify, build on or redistribute without written
permission. The licensor is Dataspatium's author, reachable through the GitHub account
[marwiss](https://github.com/marwiss); open an issue for other terms. What the licence means in practice is
explained in [licenser.md](licenser.md).

Third-party components in `vendor/` have their own licences (MIT, BSD, Apache-2.0, ISC, OFL, MPL, LGPL and GPL), see
[THIRD_PARTY_LICENSES.md](../../THIRD_PARTY_LICENSES.md). R and the GPL-licensed R packages are distributed
unchanged; the source code is available from the [R project](https://cran.r-project.org/sources.html),
[webR](https://github.com/r-wasm/webr) and [CRAN](https://cran.r-project.org/) in the versions stated there. See [SECURITY.md](../../SECURITY.md) for how to report a vulnerability
and what the project does to stay secure.
