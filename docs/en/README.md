[Svenska](../../README.md) · [Dansk](../da/README.md) · [Norsk](../nb/README.md) · [Suomi](../fi/README.md) · [Íslenska](../is/README.md) · **English**

# Dataspatium

Dataspatium is a web app for data from source to report: import data from files and open APIs, store and
manage datasets, review and correct values, analyse with R, visualise and export. Everything runs in your own
browser. No server, no installation, no accounts. Your data never leaves your computer unless you export it
yourself.

![Dataspatium in Process mode with a table of Swedish municipalities](../images/bearbeta.png)

The interface is available in Swedish, Danish, Norwegian, Finnish, Icelandic and English. The screenshots in the
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
- **Six languages**: the interface, the messages and the documentation are available in Swedish, Danish,
  Norwegian (Bokmål), Finnish, Icelandic and English.
- **Beginner's course**: an interactive walkthrough of all eight modes with example data, in all six languages. It is
  shown the first time the app is opened and can be opened at any time from the help or the command palette.

## Learn more

The file names are the same in every language (they are the Swedish originals), so links work the same way
everywhere.

- **The handbook** in the app: the same documentation as here, with search; open it with ? at the top right or F1.
- **The beginner's course** in the app: an interactive walkthrough of all the modes with example data; open it from
  the help (?) or with Ctrl+K.
- [Getting started](kom-igang.md): step by step with common questions.
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
- [Licences](licenser.md): what you may do with the app and which licences the third-party components have.
- [Development](../utveckling.md), [Architecture](../arkitektur.md) and [Style guide](../stilguide.md) for those
  who want to understand the code (in Swedish); how contributions are received is in
  [CONTRIBUTING.md](../../CONTRIBUTING.md) (Swedish).
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

## Bugs and suggestions

Report bugs or requests as *Issues* here on GitHub. Describe the browser, the Dataspatium version (shown under the
help button) and what you did. See [CONTRIBUTING.md](../../CONTRIBUTING.md).

## Development

- No build step, no node.js. Open `index.html` directly, or serve the folder with `python -m http.server 8080`.
- Third-party components: `python tools/fetch_vendor.py` followed by `python tools/wrap_assets.py`.
- Tests: `powershell -File tools/run-tests.ps1` (headless Edge and Firefox). See [utveckling.md](../utveckling.md)
  (Swedish).

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
[webR](https://github.com/r-wasm/webr) and [CRAN](https://cran.r-project.org/) in the versions stated there.
