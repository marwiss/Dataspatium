# Frequently asked questions

## Where is my data stored?

In the browser's own database (IndexedDB) on the computer and in the browser profile you use. Nothing is sent
anywhere. If you clear site data, switch profile or uninstall the browser, the data disappears. So take backups
under *Manage → Workspace*, or use a portable folder in Edge and Chrome so that the workspace also lives as
ordinary files on disk (see [kom-igang.md](kom-igang.md)).

## Do I need internet?

No. Internet is needed only when you fetch data from an API, push to or fetch from GitHub, click *Check for updates*
or use something that does not ship in the folder: some components (for example base maps) and R packages outside the
built-in selection are fetched when needed and then stored locally. The first time the app needs the internet for a
purpose it asks for permission; the answer can be remembered and changed under *Manage → Workspace → Internet
access*, where the log of requests is too. Everything else, R included, works without a network.

## Why does it take time the first time I use R?

R is loaded as WebAssembly (about 50 MB) and starts in a few seconds. Packages such as ggplot2 are installed in
the R session when you use them for the first time, which takes a few more seconds. The R session starts over when
you reload the page, but your datasets and scripts remain.

None of this loads when the app starts, only when it is used: R ships in the app folder and is unpacked in the browser the first
time the R tab opens, Python is fetched as components the first time you press Start Python, and 3D models, PDF and maps load the same
way when needed. Meanwhile the status bar says what is loading, and the R console shows which file it is waiting for.

## Can I interrupt R code that is stuck?

Yes, when the app runs from a web server (for example `python -m http.server 8080` on your own computer, or https on
an intranet): then the button *Stop* sits next to *Run* in the R tab, and the R session with its objects remains. When
the app is opened from a folder (file://) the browser does not allow the mechanism this needs; use *Restart R* in
Analyse instead. The datasets are not affected.

## How does Python work in the app?

Python (Pyodide) does not ship in the folder. The first time you press *Start Python* or *Run* in the Python tab, the
app asks for permission to fetch components and downloads Python with numpy and pandas (about 22 MB) from jsDelivr,
checked against known digests. After that everything is kept in the browser and Python starts without the internet.
Packages the code imports (matplotlib, scipy, scikit-learn and the others Pyodide offers) are fetched the same way
when needed. See [python.md](python.md).

## Why does an API not work?

Most often the API lacks CORS support, that is, the browser is not allowed to read the response. Then Dataspatium
can only reach it through a proxy that you run yourself (setting under Import). Some APIs also require a key, for
example Boverket and Lantmäteriet Direkt. See [api-konfiguration.md](api-konfiguration.md), which also describes
how to get keys.

## How are API keys stored?

Either only in memory during the session or encrypted with a passphrase you choose. Never in clear text, and they
never come along when you share a configuration.

## How large datasets can the app handle?

A couple of million rows in Edge and Chrome, somewhat fewer in Firefox; the browser's memory sets the limit.
Measured times for one million rows are in [utveckling.md](../utveckling.md) (Swedish). Text files of 64 MB or more are read
in chunks, so the import itself does not require the whole file to fit in memory as text.

## What is the difference between Firefox and Edge or Chrome?

Look and features are the same, but Firefox lacks folder access, so the portable folder is not available there.
Backup as ZIP works everywhere.

## Can the app run from a web server or an intranet?

Yes. Put the folder unchanged on any static web server; no server functions are needed. Over https, and on your own
computer over `http://localhost`, the app registers a service worker (`sw-coi.js`) that makes the page *cross-origin
isolated*, and then R code can be stopped. The first time, the page reloads once when it takes over. Over plain http on
an intranet the browser allows no service workers, but a server that itself sends the headers
`Cross-Origin-Opener-Policy: same-origin` and `Cross-Origin-Embedder-Policy: credentialless` gives the same. Everything
else works as from the folder. The browser stores data per address, so the workspace in the folder and the one on the
server are separate; move between them with a backup or a bundle.

From a web server, including <https://marwiss.github.io/Dataspatium/>, the app can be installed as an app of its own:
in Edge and Chrome through the *Install* icon in the address bar or the browser menu. It then gets its own window and
icon, the files are stored in the browser so that it works without a network, and storage becomes persistent. New
versions are fetched when the app is opened again with a network.

## Can I open index.html directly inside the ZIP file?

No. Unpack the ZIP file first (right-click and choose *Extract all* in Windows) and then open `index.html` in the
unpacked folder.

## How do I update?

Download the new version and unpack it into a new folder. Your data lives in the browser, not in the folder, so it
remains when you open the new version's `index.html` on the same computer and in the same browser. Under the help
button there is *Check for updates*, which compares your version with the latest release on GitHub. The check is
made only when you click.

## Can I change the language?

Yes. The first time the app is opened you choose a language; afterwards the language button at the top right (the
icon with letters) or the command *Language* in the palette opens the same chooser. Swedish, Danish, Norwegian
(Bokmål and Nynorsk), Finnish, Icelandic and English are available. The app reloads in the chosen language after unsaved
changes have been saved. The choice is stored in the browser, so each computer and profile has its own.

## Are there sources from the other Nordic countries?

Yes. Under *Add sources* → *Open APIs* in Import there are the statistics offices of Denmark, Norway, Finland, Iceland,
Greenland, the Faroe Islands and Åland, Nordic Statistics, the Norwegian Institute of Public Health, the
Brønnøysund register, the Norwegian Mapping Authority, MET Norway, THL's Sotkanet, PRH's company register,
Digitraffic, the Finnish Meteorological Institute, the Icelandic Met Office and the Danish and Finnish data
portals. The country buttons above the list choose which countries' sources are shown; the choice is stored in
the browser. All sources have been checked for CORS and need no key. See
[api-konfiguration.md](api-konfiguration.md).

## Can I have the app open in several tabs?

Yes. The tabs share the same workspace and keep each other informed: if you save or delete something in one tab,
the others reload their lists and log what happened. Still, do not edit the same dataset in two tabs at the same
time; if both have unsaved changes, the one that saves last wins.

## Can another local HTML file read my data?

In Edge and Chrome all files opened via file:// share the same storage. So do not open unknown HTML files locally
while you have sensitive data in the app. Keys are never stored in clear text. Firefox keeps local files apart.

## May I use the app at work?

Yes, if the employer is a public authority, municipality, region, school, university or a non-profit organisation,
that is, non-commercial use. Commercial use requires permission from the licensor. See
[licenser.md](licenser.md).

## How do I make a map of municipalities or counties?

Click *Swedish municipality boundaries (SCB)* or *Swedish county boundaries (SCB)* in Import; the boundaries ship with the app
(SCB's simplified boundaries for thematic maps, CC0). Then join your values to the boundaries on the municipality
code or county code in Process (*Join*), and choose the chart type *Map* in Visualise. Points with longitude and
latitude (for example measuring stations) are drawn with *Point map*, with the boundaries as background. Your own
boundaries can be imported from GeoJSON, shapefile or GeoPackage. See [visualisera.md](visualisera.md).

## How do I get municipality or county from coordinates?

Choose *Geodata > Municipality and county from coordinates* in Process (through Actions or the palette). The
action looks up each point's municipality and county in SCB's bundled boundaries and adds the columns kommunkod,
kommun, lanskod and lan; coordinates in SWEREF 99 TM are recognised. The boundaries cover the land area, so points
in water become empty. The same group has centroid and area from geometry and conversion between SWEREF 99 TM and
WGS 84. See [bearbeta.md](bearbeta.md).

## How do I combine several datasets in one SQL query?

Every dataset has a short name (shown below the name in the object panel, changed under Manage > Rename). In the
SQL tab under Analyse the selected dataset is called `data` but is also reached by its short name, and all other
datasets are reached by their short names: `select k.kommun, b.folkmangd from befolkning_2024 b join
kommungranser k on k.kommunkod = b.kommunkod`. The result can be saved as a new dataset. In R,
`dm_read("shortname")` reads the same dataset. See [bearbeta.md](bearbeta.md).

## How do I check that the data is up to standard?

*Data quality* in Process profiles all columns and suggests actions. *Rules* let you write down requirements (must
not be missing, unique, range, list, pattern, length or an SQL condition) and run them after every import; failing
rows can be saved as a dataset of their own and the result downloaded as a report. The rules are stored in the
dataset and come along when you share it. See [bearbeta.md](bearbeta.md).

## Can I remove personal identity numbers before I share a dataset?

Yes. The action *Pseudonymise* in Process replaces identifiers with salted hashes, masked values or running
numbers, and the data quality profile suggests it when a column looks like it contains personal identity numbers.
It is pseudonymisation, not anonymisation: other columns can still point out persons, so go through the whole
dataset before you share it. See [bearbeta.md](bearbeta.md).

## How do I share data with a colleague?

Easiest in the *Share* mode: under *Bundle* you choose datasets and whether charts, dashboards, templates, notebooks
and scripts should come along, write a message and send the ZIP file, for example through the *Share menu* tab
(e-mail, Teams and other apps). The colleague opens it under *Receive*, sees your message and what has changed and can
replace their own versions. Comments, folders and tags come along. On the same network the bundle goes directly between the computers or through the
phone (the *Devices* tab, see [mobil.md](mobil.md)). If you work on the same workspace, you can also use a shared
GitHub repository (the *GitHub* tab). Before anything leaves the app, the datasets are reviewed for personal
data, which can be pseudonymised or dropped in the copy. Dashboards and documents can be published as standalone HTML files (the
*Publish* tab). You can also export a single dataset as SQLite (keeps types, labels, comments and history) or take a
backup of the whole workspace. Charts and document templates can be exported as JSON files, API configurations as
`.api.json`, and recipes as JSON, R or SQL. See [dela.md](dela.md).

## How do I open the beginner's course again?

Click the question mark at the top right and choose *Open the beginner's course*, or press Ctrl+K and type *course*.
The course continues where you left off; if you have finished it, it starts again from the beginning. It is
available in all seven languages.

## How do I keep order among many datasets?

Give them folders and tags: *Organise* in Manage, or drag a dataset to a folder in the object panel. Folders can
have subfolders (`Economy/2026`), the filter field searches name, tag and folder, and the checkboxes select several
datasets for batch actions. Folder and tags travel with the dataset in bundles and backups, and in R `dm_list()`
shows the folder.

## What are components?

Parts of the app that do not ship in the folder, to keep it small: for example base maps and R packages outside the
built-in selection. They are fetched from a fixed address when something needs them, after you have given
permission, and are checked against a known checksum where one exists. They are then stored in the browser and need
not be fetched again. Under *Manage → Workspace → Components* you see which ones exist and how large they are, and
can fetch them in advance or remove them.

## Can I use the app on my phone?

The whole app is made for computers, but the phone can take part: Dataspatium Mobile
(<https://marwiss.github.io/Dataspatium/m/>) receives bundles and files from the computer over the local network,
shows the tables, forwards them and hands them to another computer. Open *Share → Devices* on the computer and scan
the QR code; see [mobil.md](mobil.md). On tablets in server mode the whole app can be used: in narrow windows the
mode switcher shows icons and the panels open as sheets over the work area.

## How do I move data to a phone without the internet?

The computer and the phone only need the same local network; the transfer goes directly between them with WebRTC
and passes no server. The first time, the phone has to fetch the mobile page from the web (or from a web server of
your own on the intranet); after that it sits in the cache. If there is no shared network: turn on tethering on the
phone and connect the computer to it. See [mobil.md](mobil.md).

## Where is the help?

In the app: the **?** button at the top right or F1 opens the handbook at the chapter of the mode you are in, with
search over every section and links between the documents. The same texts are in [docs/](anvandarguide.md) on
GitHub. The beginner's course opens from the handbook or with Ctrl+K.

## Can I show a dashboard on a large screen?

Yes. Open the dashboard in Visualise and click **Present**: the dashboard fills the window, the arrow keys go one
chart at a time, F gives full screen and Esc ends. The shared filters stay at the top. See
[visualisera.md](visualisera.md).

## Can I read an Access database or a SQL Server table?

Yes. Access files (mdb, accdb) are dropped on the surface in Import and read directly in the browser. SQL Server,
ODBC sources, Excel and Access queries are reached through the database bridge, a small script you start on the
computer; services such as PostgREST, OData and GraphQL are added as sources with an address. See
[kallor.md](kallor.md).

## Can I read PDF files, Word documents and pictures?

Yes. Drop them in Import: documents (PDF, Word, OpenDocument, Markdown, text) become a document collection with one paragraph per
row, pictures an image collection with one row per picture and EXIF details. Several files at once become a collection. Process
shows them as a reading view or a gallery, and Analyse has the tools Text and Images without code. Scanned PDF files
without a text layer can be read with text recognition. See [dokument.md](dokument.md).

## Can I show maps and compute on geodata?

Yes. A dataset with geometry (GeoJSON, Shapefile, GeoPackage, KML, GPX) or longitude and latitude opens as a map in
Process. In Visualise the chart kind *Map* makes map views with several layers and a background map for dashboards and
publishing, and in Analyse the tab *Geo* computes area, points in areas, nearest, buffers and overlays without code.
QGIS projects can be dropped in Import. Background maps are fetched only after your consent. See [kartor.md](kartor.md).

## How do I see what the app sends to an OpenCDE server?

Open the source in Import and unfold the card *Log* at the bottom. Every request is there with API, operation, status and duration,
and a click shows headers, an explanation and a curl line to copy. The log lives in memory during the session and never leaves the
computer unless you save it as JSON or a dataset yourself. See [kallor.md](kallor.md).


## Can't find the answer here?

Read [anvandarguide.md](anvandarguide.md) or open an issue on GitHub (see
[CONTRIBUTING.md](../../CONTRIBUTING.md)).
