# The eight modes

Dataspatium is divided into eight modes that follow the flow of the work, in the spirit of statistics production's
collect, process, analyse and disseminate: Import, Manage, Search, Process, Analyse, Visualise, Export, Share. All
modes share the same skeleton: the mode switcher at the top, the object panel on the left, the work area in the
middle, the inspector on the right and the status bar at the bottom, with the log folded in above it. The panels
never change places. Alt+1 to Alt+8 switch mode. An empty workspace opens in Import, a workspace with datasets in
Manage. The buttons at the top right open the command palette, change language, change theme (light, dark, follow
the system) and open the help.

**The status bar** shows the save state, how much storage the workspace uses, the selected dataset (name, rows and
columns; a click opens it in Manage), the state of the R engine (off, starting, ready, busy; a click starts it),
internet requests in progress (a click shows the log of requests), the buttons that collapse and expand the object
panel, the inspector and the log, and the number of lines in the log.

**Panel widths** are changed by dragging the edge between a panel and the work area; a double-click resets, and with
the keyboard the arrow keys move the edge (Shift for larger steps, Home and End for the smallest and largest width).
The widths are remembered. In narrower windows (below 1,100 px) the mode switcher shows only icons, with text on
the active mode, and the inspector opens as a sheet over the work area; below 760 px the object panel does the same.
A sheet closes with Esc or a click in the work area.

**Tooltips** appear for all buttons when the pointer rests on them or when they receive keyboard focus; on a touch
screen by holding a finger on the button.

The command palette (Ctrl+K or the magnifying glass at the top) reaches everything from one search field: switch
mode, open a dataset, a chart or a dashboard, run a processing action on the selected dataset, export, open the
workspace, search in data, create a bundle, copy a link to here, change theme or check for updates. Links have the
form `index.html#/<mode>/<short name>` (or a chart name in Visualise, a search text in Search) and work from a
folder too. Arrow up and down select, Enter runs
and Esc closes; the most recently run commands are at the top.

You change the height of the log panel by dragging its top edge, or with the arrow keys when the edge has focus. A double click resets the height, and the height is saved.

## Import

Here data comes in: files dropped on the surface, pasted text, web addresses and open APIs. File import goes in
steps: file, settings with preview, columns with types, done. Formats: CSV and other delimited text, fixed-width
text, Excel, ODS, JSON (including JSON-stat and GeoJSON), XML, SQLite, GeoPackage, shapefile and, via R, SPSS,
Stata, SAS, PX, Parquet, RDS and RData (see [format.md](format.md)); the R formats are imported in one step without
preview. Under Open APIs there are presets for Statistics Sweden (browse the subject tree or search for a table), the
Public Health Agency of Sweden, the National Board of Health and Welfare, Kolada, Eurostat, SMHI, air quality data,
the nature conservation register, Lantmäteriet's geodata catalogue and Sweden's data portal, as well as Boverket and
Lantmäteriet Direkt for those who have keys, and in addition sources in Denmark, Norway, Finland, Iceland, Greenland,
the Faroe Islands and Åland and Nordic Statistics; the country buttons above the list choose which countries'
sources are shown. Your own configurations are added from file and can be shared. *Saved fetches* lists the datasets
that came from an API and updates them with one click, one at a time or all. The first time the app needs to
contact the internet for a purpose (APIs, web addresses, GitHub, components) it asks for permission; the answer can
be remembered. See [api-konfiguration.md](api-konfiguration.md).

Under *Databases* there are two ways in: *Database through the bridge* (Access, Excel, SQL Server, SQLite and ODBC
sources on the computer through a small local script) and *Add a database source* (PostgREST, OData, GraphQL,
CouchDB, ClickHouse, Elasticsearch, SPARQL, InfluxDB, Google Sheets and Airtable over HTTP). Access files are also
read directly as files, and in Chrome and Edge a file can be linked so that the dataset is read again from disk.
See [kallor.md](kallor.md).

QGIS projects (.qgs, .qgz) become map views: layer order, visibility and symbols come along, the layers are matched to datasets with the same file name and data files dropped with the project are imported first (see [kartor.md](kartor.md)).

Under *Databases* there is also *Add geodata source*: a WFS, OGC API Features or ArcGIS service becomes a source whose
layers are fetched as GeoJSON and open as maps, and the source *Geodataportalen (sök geodata)* searches the Swedish
national geodata catalogue and adds services with one click. Preset geodata sources exist for SCB, SGU, the Agency for
Marine and Water Management, the National Heritage Board, the Forest Agency, Kartverket, Statistics Finland and SYKE,
plus Lantmäteriet's geodata platform for those with a key. See [kallor.md](kallor.md#open-geodata).

Digital plans are imported as plans: a Swedish detailed plan per the national specification (GeoJSON) or
Lantmäteriet's reference objects, a comprehensive plan per the specification or Boverket's ÖP model (GeoPackage, the
choice *The whole comprehensive plan as a plan*). The file is recognised by its contents, the plan's facts are shown
and the plan opens as a plan map in Process with Boverket's colours (see [planer.md](planer.md)).

Graphs (networks of nodes and edges) are imported as graphs from GraphML, GEXF, JSON with nodes and edges or Cypher
scripts; the file is recognised by its contents, the graph's facts are shown and the graph opens as a graph view in
Process (see [grafer.md](grafer.md)). Two tables become a graph with *Make graph from tables* in Manage.

Building models in IFC and drawings in DXF become datasets of the kind model. The facts of the file are shown and the model
opens in 3D or as a drawing in Process (see [cad-bim.md](cad-bim.md)).

**Field collection** in the list of sources builds a form on a dataset's columns and rules and sends it to the phone. The rows come back as a new version
(see [insamling.md](insamling.md)).

All sources in the list look the same, with a mark for their type and a line under the name. *Add a source* gathers all ways to add a source: a configuration file, a database or a geodata service.

**The app first says what the file is**, for example a table with places, a graph or a building model, and shows it in its own form: a map, the pictures, a sketch of the graph, the drawing or the first page. If something is worth asking about, it asks: coordinates that seem to have changed places, which coordinate system they are in, and whether a list of links should be read as a graph. Nothing changes until you answer, and the map shows what the answer does.

**Several different files** are sorted by what they are: pictures become one collection, documents another, and every other file a dataset of its own. You see the list first and can leave something out. You can also drop a whole folder or choose it with *Choose a folder*. A file that cannot be read does not stop the others.

**Guides.** Under Guides there are four short ways from a question to a result with real data: compare municipalities through Kolada, a population pyramid through Statistics Sweden, weather over a long time through SMHI and price development through the European Central Bank. A guide fetches, cleans and saves a chart. You get the table, the chart and the steps to build on. It fetches from the network only when you press *Run the guide*.

**Data packages.** A ZIP file with `datapackage.json` (Frictionless Data Package) is read with the types and titles from its schema, and each table becomes a dataset.

**Files from a CDE.** An OpenCDE source lists the project's models and documents, and *Fetch* makes a dataset of the file's own kind that remembers where it came from. See [kallor.md](kallor.md).

**BCF files.** A BCF file (bcf, bcfzip) becomes a table of issues, with comments and components beside it. See [format.md](format.md).

## Manage

The datasets' home. The object panel is a tree: datasets can live in folders with subfolders (`Economy/2026`) and
have tags; a filter field searches name, short name, tag and folder, and the list can be sorted by changed, name or
rows. Folders collapse and expand, and datasets can be dragged to a folder. The checkboxes select several datasets
(Shift selects a range) and the button *Actions (n)* opens the batch actions: organise (folder and tags), bundle,
export as ZIP with CSV files, re-fetch from API, run a recipe and delete. Folder and tags travel with the dataset in
its file, in bundles and in backups.

The overview of a dataset shows metadata, the column list, comments, a history of what has been done with the
dataset and versions, and here you rename and change the short name (the short name is used in SQL, R and chart
files), organise, delete and re-fetch from API. Under *Workspace* you find how much storage is used, persistent
storage, backup to ZIP and restore, in Edge and Chrome a portable folder (the workspace is saved as ordinary files in
a folder you choose, automatically after every change if you like, and can be loaded on another computer),
*Internet access* (which purposes may contact the internet, with a log of requests) and *Components* (parts of the
app and R packages that are fetched when needed, with size, source and buttons to fetch in advance or remove).
Bundles and GitHub have moved to the Share mode.

A document or image collection is shown with its number of documents and pages or pictures, with the document list or
the first thumbnails on the overview tab, and with the button *Read* or *Show pictures* that opens the reading view or
the gallery in Process (see [dokument.md](dokument.md)).

**Flows and watches** are in the object panel: saved chains that run with one click or at start, and sources that say when they have
new data (see [floden.md](floden.md)).

**What the app sees.** The overview shows what the dataset can also be used as: places on a map, a time series, regions that can be coloured, a network or running text. Each line says why, and you can switch off what is wrong or switch on what the app missed. The choice is saved in the dataset, and the modes follow it. Below it **Worth checking** lists what the kind of data needs: pages without text, pictures without a position, edges pointing at nodes that do not exist, elements without quantities or rows without a place.

**Selection.** The button *Use as selection* is in Search and in the views of Process. What you see then follows between the modes and shows in the status bar. In Process you show it through the list choice, in Export you choose whether only the selection goes along, and in bundles you can send only the selection. From the status bar you save it as a list, make it a dataset or clear it. If the rows of the dataset change the selection goes away, since it would no longer mean the same thing.

**Picture.** The overview shows a picture of the dataset: the first page, a map of its places, a sketch of the graph, the drawing, what the model is made of, or a line over time. A plain table has no picture.

**Several datasets.** When you have chosen several, *What they can do together* shows what is possible: one map when all have places, one table when all have the same columns, and one collection when all are pictures or all are documents. The chosen ones do not change. On export each gets its own form, for example pictures as a ZIP and graphs as GraphML.

**Versions** say what they hold in the dataset's own units, and the comparison shows which pictures, documents, nodes, edges or elements came and went.

**Code lists.** Columns that hold codes from a known list are shown on the overview: SNI, SSYK, NACE, ISCED, COFOG, NUTS, the Nordic equivalents, countries and municipalities. A click adds the names as value labels, and the values do not change. A short code only counts when the column's name agrees. The lists come with the app, and their sources and licences are in `presets/kodlistor/KALLA.md`.

**Description.** The Description tab holds what a data portal wants to know by DCAT-AP-SE: title, publisher, contact, theme, licence and period. The description follows the dataset, says what is missing and can be saved as RDF/XML or read from such a file. Nothing is sent from here.

**Provenance.** The Provenance tab shows where a dataset comes from and what it has become: the source, the datasets it was made from, the recipe and versions, and the datasets, charts, dashboards, documents, notebooks, lists, flows and shares that build on it. A click opens what you click on, and *Download as text* gives the same to put in a report.

**Library.** Under Library there are ready-made recipes, templates, scripts and notebooks, each with its licence. You see what something does before you add it. More libraries are fetched from an address, and *Save your own as a library file* makes a file of what you have made, to put in a GitHub repository or anywhere.

**From the CDE.** A dataset fetched from an OpenCDE server shows server, project and version, can ask for a newer version and open the model's issues.

**Issues.** A table of issues from a CDE gets the card Issues: how they stand per status, the dashboard Issue status and the way to the model. See [cad-bim.md](cad-bim.md).

## Search

Find and list without code. The *Search* tab searches all columns in one or all datasets; every word must occur on
the row, regardless of case. Hits are shown per dataset with counts, facets (the most common values in columns with
few distinct values, which narrow the search with one click) and a table where a row opens the whole record in the
inspector. A search can be saved as a list, become a new dataset or be opened in Process. The *Query* tab builds a
query over one or several datasets (columns, calculations, conditions, sorting) without code and shows the SQL it
creates; it can be opened in Analyse, saved as a list or become a dataset. The *Lists* tab collects saved searches
and queries per dataset and runs them again on today's data; lists also narrow the table in Process and the rows of
charts. See [soka.md](soka.md).

## Process

Everything you do with the table through buttons and dialogs: edit cells directly in the table, sort, filter and
see column statistics; actions for cleaning (search and replace with regular expressions, trim, case, encoding
repair, replace value, fill missing, duplicates, category cleaning), types (number, date, yes/no), structure
(calculated columns, split and combine, delete rows, pivot) and new datasets (group and aggregate, join, append).
The data quality profile points at what should be corrected, and quality rules (must not be missing, unique, range,
list, pattern, length, SQL condition) check the data on request with a report and the failing rows as a dataset of
their own. Everything is logged as a recipe that can be undone, replayed on another dataset and exported as R or
SQL code. Versions save snapshots to go back to. See [bearbeta.md](bearbeta.md).

**Document collections** (PDF, Word, OpenDocument, Markdown, text) open as a reading view: choose a document,
turn the pages, show the PDF page as an image, search the whole collection and download the original. **Image collections** open as a gallery with thumbnails, a filter, a sort order and the picture's EXIF details in the
inspector, where the description can be edited. *Show as table* gives the ordinary table with every action in both
cases. See [dokument.md](dokument.md).

Datasets with geometry or coordinates open as a **map** to zoom and pan in; a click on a feature shows its attributes, a background map after consent, *Save as map view* for Visualise. *Show as table* gives the table (see [kartor.md](kartor.md)).

A selection from Search is marked in the 3D model, and the camera turns to it.

**Reading text in pictures.** Pages in a scanned PDF and pictures in a gallery can be read with text recognition, which runs in the browser. See [dokument.md](dokument.md).

**Issues.** The model view shows the project's BCF issues from a CDE and marks the elements they point at. See [cad-bim.md](cad-bim.md).

**Writing issues.** The model view creates issues from the selection with the view as viewpoint, comments and changes status, and saves the project's issues as a BCF file. See [cad-bim.md](cad-bim.md).

## Analyse

Code and statistics. The tools come in a fixed order: R, Python, SQL, Regex and last the Notebook, which joins pieces from
the others. The Python console has pandas, matplotlib, seaborn and plotly and is fetched as a component the first time you start it (see
[python.md](python.md)). The R console has ggplot2, dplyr, tidyr and other packages,
saved scripts, charts with export to SVG, PNG and PDF, and `dm_read()`/`dm_write()` to move data between the app and
R (see [r-guide.md](r-guide.md)); packages that do not ship with the app are fetched from webR's package repository
when the code needs them, after you have given permission. The SQL console works against the selected dataset
(`data`), where other datasets are reached by their short names so that a query can join several datasets; queries
show results that can be saved as a new dataset, modifying statements are logged as recipe steps (see
[bearbeta.md](bearbeta.md)). The Regex tab tries regular expressions on a column with the matches highlighted and
uses them to filter, extract, replace, split, mark, count or create a quality rule, with a pattern profile and a
library of Nordic patterns (see [regex.md](regex.md)). The notebook mixes text (Markdown), R and SQL in cells that
run in order and become a report in HTML, Word, PDF, Markdown or LaTeX (see
[anteckningsbok.md](anteckningsbok.md)). Later: statistical models.

When a document collection is selected there is the tab **Text** (word frequency with stopwords, keywords in context,
co-occurrences and an overview per document), and when an image collection is selected the tab **Images** (overview
by type, camera, year or month and duplicates by image hash). Both come after Regex and before the Notebook, and
every result can be saved as a new dataset. See [dokument.md](dokument.md).

For datasets with geometry there is the tab **Geo** (after Regex): measures, points in areas, nearest, buffer, overlay, dissolve and simplification, with Turf in the browser; the results become datasets that open as maps.

Graphs get the tab **Cypher** right after SQL (a Cypher subset translated to SQL, with the SQL shown) and the tab
**Graph** after Regex (summary, degree, components, shortest path, subgraph, nodes and edges as tables).

The tab **Statistics** after Regex does common analyses with forms that write and show the code (see [statistik.md](statistik.md)).

Models and drawings get the tab **Quantities** after Regex (count, length, area and volume per type, storey and material, from
the file or measured on the geometry).

Analyse opens in the tool that fits the dataset: Text for documents, Pictures for image collections, Graph for graphs, Quantities for models, Plan for plans, Geo for tables with places and otherwise Statistics. When you choose a tab yourself you stay there. R starts only when you open the tab R.

**Code to start from.** In R, Python and SQL there is a list of code written for the chosen dataset: a graph's edges, a model's quantities, pictures per month, the sum per period or the places as points. The choice pastes the code where the cursor is. A new notebook starts the same way. In SQL the side tables are shown with their columns, and a click writes a question about the table.

**Trend.** Statistics has the tool *Trend*, which gives one value per period and a straight line through them and says how much the value changes per period. A dataset that is a time series opens there.

**Count per area.** Under Geo, *Points in areas* counts places per area, with the area and the number per square kilometre. The places can be pictures with positions, and the areas can be a plan, a table with shapes or the municipal and county boundaries that come with the app.

**Issues.** The tool Issues in the Quantities tab counts issues and elements per status, type, element type or storey. See [cad-bim.md](cad-bim.md).

## Visualise

Charts with three engines and one look: the chart builder (Vega-Lite) with bars, lines, areas, points, histograms,
heat maps, box plots, pies and maps (choropleth maps from GeoJSON or shapefile data); D3 templates for ranking, slope
charts and population pyramids; and R scripts with ggplot2. Saved charts can be exported as SVG, PNG, PDF and
PowerPoint, shared as viz files, shown in a gallery and created in batch per group. Dashboards gather saved charts
in a grid with shared filters and are exported as HTML or PowerPoint. See [visualisera.md](visualisera.md).

The chart kind **Map** is a map view with several layers from datasets with geometry or coordinates and the bundled boundaries, colour by category or class, labels, a saved view and a background map after consent; interactive in dashboards, presentations and published HTML, exported to SVG, PNG and PDF without the background map (see [kartor.md](kartor.md)).

**Issue status.** The dashboard Issue status is created from an issue table, and a model chart can carry colours by issue status. See [cad-bim.md](cad-bim.md).

## Export

Files to your own computer, in three tabs. **Data**: CSV (Excel-friendly or standard), Excel, ODS, JSON, XML,
SQLite and, via R, Parquet, SPSS, Stata and RDS. **Charts**: saved charts and dashboards (also all charts as one
PowerPoint) as SVG, PNG and PDF, singly or in batch per group to ZIP. **Documents**: reports, codebooks and
compilations from templates in Markdown with placeholders, as HTML, Word, PDF, Markdown or LaTeX, singly or in batch
per group (see [dokumentmallar.md](dokumentmallar.md)). What is meant for other people is in Share.

A dataset that is more than a table divides the formats into **The whole dataset** and **Only the table**, and says what does not go along. Documents can be had as original files or plain text, pictures as a ZIP and graphs as two CSV files.

**By the kind of dataset.** Tables with places can be saved as KML, GPX and GeoPackage, in degrees. In GPX, points become waypoints, and lines and the outlines of areas become tracks. Picture collections can become a contact sheet in PDF with pictures and names. A plan can become a plan map in PDF with a legend, the plan provisions in Word, and the original file if the plan came from a file. An IFC model can give its quantities in Excel, with sums per type and all values, and its geometry as glTF. A DXF drawing can become a PDF. If you export several datasets in Manage, each gets its own form.

**Batch per storey or document.** Batch per group works with any column. A model is divided by the column `vaning`, and the picture of the model then shows only that storey. A document is divided by the column `dokument`.

**Other tools.** *Data package* gives a ZIP with CSV files and `datapackage.json`, which many tools can read. A graph's edges and a model's properties follow as tables of their own. *Quality declaration* gives a Word document in the form Statistics Sweden uses, filled in from the profile, rules, comments, changes and description, with places to write what only a person can say.

## Share

Give data to others. **Bundle**: a ZIP with chosen datasets, charts, dashboards, templates, notebooks and scripts, a
message and a change log, which the recipient opens under *Receive* and can replace their own versions with.
**GitHub**: the workspace as a folder in a repository, push and fetch, with an access token stored encrypted.
**Share menu**: the computer's or phone's own share menu for a file or a bundle (e-mail, Teams, messaging apps).
**Publish**: dashboards and documents as standalone HTML files. **Devices**: direct transfer to phones and other computers on the same network with a QR code, a
verification code and pairing, and Dataspatium Mobile on the phone (see [mobil.md](mobil.md)). **Receive**:
bundles from a file or a web address, with sender and changes visible before anything is taken in. Datasets that
leave the app are reviewed for personal data first. See [dela.md](dela.md).

**To the CDE.** A dataset or its original file to a project on an OpenCDE server, through the Documents API or as a BCF document. See [dela.md](dela.md).

**Workspace bundle via the CDE.** The tab To the CDE sends a bundle as a document; the recipient receives it in the source's file list. See [dela.md](dela.md).
