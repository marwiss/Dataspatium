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

What works in one version also works in the next. Each version belongs with the same version of Dataregium.

### Version 1 (with Dataregium 1)

- **Import**: files in some forty formats, from spreadsheets and statistics files to geodata and tables in documents, and data from the
  open APIs of Nordic and European agencies, with saved fetches (see [Open APIs](api-konfiguration.md)).
- **Process**: sort, filter, clean, type, recode, pivot and join, with data-quality rules, pseudonymisation, undo, versions and
  recipes (see [Process](bearbeta.md)).
- **Analyse**: R with ggplot2 and the tidyverse, SQL, notebooks that become reports and regular expressions, all in the browser (see
  [R](r-guide.md)).
- **Plans**: detailed and comprehensive plans as plan maps with Boverket's colours and symbols (see [Plans](planer.md)).
- **Visualise and document**: charts with Vega-Lite, D3 or R, dashboards and reports from templates as HTML, Word, PDF, PowerPoint or
  LaTeX (see [Visualise](visualisera.md)).
- **Export and share**: data in some ten formats, bundles, comments, a backup, sync with GitHub and a portable folder.
- **Dataregium as a source**: documents are fetched as datasets, and datasets and files are sent back (Documents API).
- **Six languages and a course**: Swedish, Danish, Norwegian (Bokmål), Finnish, Icelandic and English, an interactive course through
  every mode, and the command palette (Ctrl+K) that finds everything.

### Also in version 2 (with Dataregium 2)

- **More sources**: databases, open geodata and WMS, documents and images as collections, and text from scanned pages (see
  [Sources](kallor.md)).
- **Maps, plans and graphs**: map views with layers and geo tools, plans from all the Nordic countries, and graphs that are drawn,
  queried with Cypher and edited (see [Maps](kartor.md) and [Graphs](grafer.md)).
- **CAD and BIM**: IFC models in 3D with tables, properties and quantities, and DXF drawings (see [CAD and BIM](cad-bim.md)).
- **Python and statistics without code**: a Python console and forms for statistics and time series that write the code for you (see
  [Statistics](statistik.md)).
- **Search and keep order**: the *Search* mode with facets and saved lists, queries without code, folders, tags and batch actions
  (see [Search](soka.md)).
- **Share and Mobile**: the *Share* mode with bundles and publishing, a review of personal data before sharing, transfer with a QR
  code and *Dataspatium Mobile* to show and collect in the field (see [Share](dela.md)).
- **Flows and kinds**: saved chains that run with one click, watched sources, and modes that recognise what a dataset is and offer the
  right views and tools (see [Modes](lagen.md)).
- **Dataregium with issues**: models and topics from the server, topics from the 3D view, BCF files, the server's IFC graph and the
  administration (see [Dataspatium and Dataregium](#dataspatium-and-dataregium)).
- **Seven languages**: Nynorsk as well, with the handbook in the app and the course through all eight modes.

### Also in version 3 (with Dataregium 3)

- **Checking models**: the card *Validate the model* with the server's and the app's checks, and a clash check with its results as BCF
  topics (see [CAD and BIM](cad-bim.md)).
- **AI modelling**: *Ask AI about the model* and *Change with AI*, where the AI proposes and you preview in 3D and approve; the AI can
  never save or publish.
- **Versions against Dataregium**: publishing with a base version, a precheck, change proposals that the server tries and a manager
  approves, and *Compare versions* marked in 3D.
- **More**: the server's IFC graph in its skeleton form, a local Dataregium on your own computer and Sundsvall's WFS among the geodata
  sources.

![Dataspatium in Process mode: an IFC model in 3D with Compare versions, where a new wall is green and a changed fire rating is listed](../images/jamfor.png)

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
