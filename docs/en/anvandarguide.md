# User guide

This guide describes how you work in Dataspatium from the first file to the finished report. It assumes that you
have opened the app as described in [kom-igang.md](kom-igang.md). Details about each mode are in
[lagen.md](lagen.md), about file formats in [format.md](format.md), about APIs in
[api-konfiguration.md](api-konfiguration.md), about processing in [bearbeta.md](bearbeta.md), about R in
[r-guide.md](r-guide.md), about Python in [python.md](python.md), about charts in [visualisera.md](visualisera.md) and about documents in
[dokumentmallar.md](dokumentmallar.md). Common questions are answered in [faq.md](faq.md).

## The workspace

The screen looks the same in every mode. At the top you switch mode (Import, Manage, Search, Process, Analyse,
Visualise, Export, Share; Alt+1 to Alt+8 work too) and reach the command palette (the magnifying glass or Ctrl+K),
the language button, the theme (light or dark) and the help button with the version number and *Check for updates*.
The command palette is the fastest way to most things: type a few letters to switch mode, open a dataset, a chart
or a dashboard, search in data or run a processing action on the selected dataset. On the left are the objects of
the mode (datasets, sources, charts, templates), in the middle the work area and on the right the inspector with
properties and statistics. At the bottom is the status bar: save state, storage, the selected dataset, the R engine,
internet requests in progress and the buttons that collapse the panels and open the log, where every action, warning
and error is written; that is what you read when something does not turn out as you intended. Panel widths are
changed by dragging the edge towards the work area, and in narrow windows the panels open as sheets over the work
area (see [lagen.md](lagen.md)).

Everything you create is saved automatically in the browser's database on your computer. Nothing is sent anywhere
unless you yourself fetch from an API, check the version, push to GitHub or share. The first time the app needs the
internet for a purpose it asks for permission, and the answer can be remembered; under *Manage → Workspace → Internet
access* you see what is allowed and which requests have been made. Parts of the app that do not ship in the folder
(some components and R packages) are fetched the same way when needed and then stored locally.

## The beginner's course

The beginner's course is a good way to get to know the app. It starts after the language choice the first time the
app is opened, and otherwise from the help (the question mark at the top right) or with the command *Open the
beginner's course* in the command palette. The course is shown in a panel at the bottom right while you work in the
real app, and it follows the example *Population per municipality 2024 (Sweden)* in nine steps:

1. Welcome: what the app does and how the screen is arranged.
2. Import: import the example data, and what a dataset is.
3. Manage: name and short name, source, columns, versions and backups.
4. Process: the table, column profiles and a calculated column that becomes a step in the recipe.
5. Analyse with SQL: the population per county, and how short names combine datasets.
6. Analyse with R: `dm_read()`, a summary and a histogram with ggplot2.
7. Visualise: a horizontal bar chart of the population per county.
8. Export: data, charts and documents.
9. Done: where to go next.

Each step explains a concept and gives a task. A frame marks the button to click, and the step is ticked off when the
app sees that the task is done. *Do it for me* (or *Show me*) performs the step, so you can follow along without
typing anything. The course can be minimised with the arrow and closed with the cross; next time it continues where
you left off. It creates the example dataset, a column in it and a chart, which you delete as usual when you no longer
need them.

## A workflow from file to report

### 1. Import data (Import)

Drop a file on the surface, paste a table or fetch a file from a web address (the server must allow CORS; a shared
Dataspatium configuration is added directly). Check the preview: character encoding, delimiter, header row and
decimal separator are guessed but can be changed. In the column step each column gets a type; codes with leading
zeros (municipality codes, personal identity numbers) are kept as text. Give the dataset a name and import. The
area below the surface has data that ships with the app: the button for the example data *Population per
municipality 2024 (Sweden)* and the list *Boundaries for maps* with municipality and region boundaries for Sweden,
Denmark, Norway and Finland.

Under *Add sources* → *Open APIs* there is the catalogue of presets (the ones you add come under *Added sources*; SCB and Boverket are there from the start) for SCB, the Public Health Agency of Sweden, the National Board of Health and
Welfare, Kolada, Eurostat, SMHI, air quality data, the Nature Conservation Register, Lantmäteriet's geodata
catalogue and Sweden's data portal, as well as Boverket and Lantmäteriet Direkt for those who have their own keys.
In addition there are the statistics offices and several other agencies in Denmark, Norway, Finland and Iceland,
the self-governing areas and Nordic Statistics; the country buttons above the list choose which countries'
sources are shown. Browse or search for a table, choose variables, preview and fetch into a new dataset or add to an existing one. A
fetched dataset remembers its query, so it can be fetched again from Manage when the source has been updated, and
*Saved fetches* in Import updates such datasets with one click and replays their recipes.

Databases: Access files are dropped on the surface like other files; databases on the computer (SQL Server, ODBC,
Excel, SQLite) are reached through *Database through the bridge* and services over HTTP (PostgREST, OData, GraphQL
and more) through *Database source*; OpenCDE and Neo4j have ways of their own under Add sources. In Chrome and Edge a file can be linked and read again from disk. See
[kallor.md](kallor.md).

### 2. Review and correct (Process)

The table shows the dataset row by row even when it has hundreds of thousands of rows. Click a header to sort and
see the column's statistics on the right: count, missing, distinct, minimum, maximum, mean and most common values.
Filter with the search field. Double-click a cell to change it.

*Data quality* goes through all columns and points at problems (numbers stored as text, mixed date formats,
duplicates, encoding errors, deviating categories) with a button that performs the right action. *Rules* let you
write down what must hold (must not be missing, unique, range, list, pattern, length, SQL condition), run the check
at any time, save failing rows as a dataset of their own and download a report. All actions are also in the
palette: remove empty rows, trim, case, find and replace with regular expressions, change type, parse dates and
numbers, fill missing values, duplicates, cluster similar categories and more. Every action is logged as a recipe
step and can be undone. Before sharing, identifiers such as personal identity numbers can be pseudonymised with
salted hashes, masking or running numbers; the salt is never stored in the recipe.

### 3. Combine and reshape (Process)

Calculated columns, split and combine columns, filter out rows, rename and reorder, pivot between wide and long
form, group and aggregate, join two datasets on a key and append datasets with the same columns. Aggregations,
joins and appends become new datasets, so the origin remains. The group *Geodata* gives centroid and area from
geometries, conversion between SWEREF 99 TM and WGS 84 and municipality and county from coordinates with the
bundled boundaries.

The recipe (all steps in order) can be shown, replayed on a new version of the data and exported as JSON, R code or
SQL. Versions are taken at import, before bulk operations and on request; two versions can be compared and an
older one restored.

### 4. Analyse with R and SQL (Analyse)

The R console runs real R (WebR) in the browser. `dm_list()` shows the datasets, `dm_read("Name")` reads one as a
data.frame with the right types, `dm_write(df, "New name")` sends a data.frame back as a new dataset.
`theme_dataspatium()` and `dm_palette()` give ggplot2 the app's look. Charts are shown in the panel and exported as
SVG, PNG or PDF. Packages such as ggplot2, dplyr, tidyr, data.table, haven and readxl ship with the app and are
installed in the session the first time they are used. Scripts can be saved and run again. The first start takes a
few seconds.

The SQL tab queries the dataset's table `data` directly with SQLite. Other datasets are reached by their short
names (shown below the name in the object panel), so one query can join several datasets, for example
`select ... from befolkning_2024 b join kommungranser k on k.kommunkod = b.kommunkod`. SELECT queries show the
result (up to 5,000 rows) and can be saved as a new dataset; UPDATE, DELETE and ALTER are logged as recipe steps.
The button *Insert dm_read()* and the R examples in the inspector use the short name too.

The *Notebook* tab gathers text (Markdown), R and SQL in cells that run in order and save their output. A finished
notebook is exported as HTML, Word, PDF, Markdown or LaTeX, with or without the code. See
[anteckningsbok.md](anteckningsbok.md).

The *Regex* tab tries a regular expression on a column as you type: the most common values are shown with the
matches marked and the matching rows are counted. The same pattern can then filter rows, extract groups into new
columns, replace, split, flag or count matches, or become a quality rule. *Pattern profile* shows the shapes of the
values (for example `9999-99-99` and `99/99/9999` for dates), and the library on the left has ready-made patterns
for personal identity numbers, postcodes and dates, among others. See [regex.md](regex.md).

### 5. Visualise (Visualise)

The chart builder creates bar, line, area, point, pie and other charts from a dataset: choose columns for axes,
colour and facets, aggregation, sorting and titles. D3 templates give special charts (lollipop, slope chart,
population pyramid) and R charts can be saved with their code. All engines use the same colours and fonts. Saved
charts are gathered in the gallery and exported as SVG, PNG, PDF or PowerPoint, one at a time or one per group (for
example per municipality) to a ZIP or a presentation. Maps are drawn with the chart type *Map* from a dataset with
geometry (the bundled municipality or county boundaries, or your own from GeoJSON, shapefile and GeoPackage)
joined to values per municipality code, and with *Point map* from longitude and latitude with the boundaries as
background. A dashboard gathers several saved charts in a grid with shared filters, for example county or year,
and is exported as standalone HTML or PowerPoint.

### 6. Documents (Export, the Documents tab)

Document templates are written in Markdown with placeholders: `{{datamangd}}`, `{{antal_rader}}`,
`{{#tabell}}…{{/tabell}}` for rows, `{{diagram "Name"}}` for a saved chart, `{{sidbrytning}}` and key figures
such as `{{summor.kolumn}}`. Report, codebook and group summary are built in. Generate as HTML, Word, PDF, Markdown
or LaTeX, one at a time or one document per group.

### 7. Export data (Export, the Data tab)

CSV (adapted for Excel in Sweden or standard), Excel, ODS, JSON, GeoJSON (for datasets with geometry), XML, SQLite
and, via R: Parquet, SPSS, Stata and RDS. SQLite and Parquet keep the types exactly; all formats can be imported
again.

## Finding things in data (Search)

Search finds rows without code. Type one or more words, choose all datasets or only the selected one and press
*Search*. Hits are shown per dataset; the facets (the most common values in columns with few distinct values) narrow
the search with one click, and a row in the table shows the whole record in the inspector. The search can be saved as
a list, become a new dataset or be opened in Process with the dataset selected. The *Query* tab builds a query over
one or several datasets with columns, calculations, conditions and sorting, without code, and shows the SQL it
creates; saved lists narrow the table in Process and the rows of charts. See [soka.md](soka.md).

## Keeping order (Manage)

Every dataset has an overview (source, size, description, folder and tags), a column list with types, labels,
descriptions and units (set under Process with *Label, description and unit*), comments, a readable history of
everything done and versions. Rename and change the short name, organise, delete or re-fetch from API (update with
the recipe, or add rows). Under *Workspace* you see how much storage is used, request persistent storage, take a
backup as ZIP and restore. The app reminds you at start when more than the chosen number of days have passed since
the last backup (30 days by default; changed or switched off in the same card). In Edge and Chrome the workspace can
also be mirrored to a portable folder on disk, automatically on every change.

The object panel in Manage is a tree. *Organise* gives a dataset a folder (with subfolders, such as `Economy/2026`)
and tags; folders can be collapsed, and a dataset can be dragged to another folder. The filter field searches name,
short name, tag and folder, and the list can be sorted by changed, name or rows. The checkboxes select several
datasets (Shift selects a range), and the button *Actions (n)* does the same thing with all of them at once:
organise, bundle, export as ZIP with CSV files, re-fetch from API, run a recipe or delete. Folder and tags are stored
in the dataset's file and travel in bundles, backups and GitHub; in R, `dm_list()` shows the folder and
`dm_read("Folder/Name")` reads a dataset in a folder.

## Sharing with others

Everything meant for other people is in the *Share* mode (see [dela.md](dela.md)):

- A selection: *Bundle* gives a ZIP with chosen datasets, charts, dashboards, templates, notebooks and scripts, a
  message and a change log: what was done with each dataset since it was last shared, and the comments that are not
  resolved. The recipient opens it under *Receive*, sees the message and the changes and chooses, for datasets that
  already exist, whether to replace them with the bundle's version (their own is kept under *Versions*); the rest is
  skipped. Under Manage, *Actions* on several selected datasets does the same.
- Comments: every dataset has the tab *Comments* in Manage, and in Process you comment on a column from the inspector.
  The comments live in the dataset's file and travel in bundles, backups, the portable folder and GitHub. You give the
  name shown yourself; it is stored only in the browser.
- The whole workspace: the backup (ZIP) is restored under Manage on another computer.
- Between computers through GitHub: the *GitHub* tab pushes the workspace to a GitHub repository (preferably private)
  and fetches it on another computer. This needs a fine-grained personal access token that may only read and write the
  contents of that repository. The token is used for the session or stored encrypted, and nothing is sent until you
  press *Push to GitHub* or *Fetch from GitHub*. Only changed files are sent, in one commit with your message; when
  fetching you choose, as for bundles, whether existing datasets are replaced.
- Directly to a phone or another computer on the same network: the *Devices* tab shows a QR code that the phone
  scans; Dataspatium Mobile receives, shows and forwards (see [mobil.md](mobil.md)). Both devices show the same
  verification code, and after pairing one scan is enough.
- Through the computer's or phone's share menu: the *Share menu* tab sends a dataset as CSV, Excel, ODS or JSON, or
  all datasets as a bundle, to e-mail, Teams and other apps (Edge and Chrome; Firefox saves the file).
- Review first: when datasets are bundled or sent, the app looks for identity numbers, e-mail and phone numbers and
  lets you pseudonymise or drop the columns in the copy.
- As a finished web page: the *Publish* tab turns a dashboard or a document into a standalone HTML file.
- One dataset: export as SQLite (everything comes along) or Parquet under Export.
- API configurations (`.api.json`), charts and document templates (JSON) and recipes (JSON, R or SQL) are exported
  and loaded as files. Keys never come along.

## The AI assistant

*AI assistant* in the status bar, or *AI assistant* in the command palette (Ctrl+K), opens a panel where an AI does tasks for
you with the app's commands, in every mode. It uses the AI provider you have added under *Providers*, a cloud service with your
key or a local model, and is reached only after you have given consent for the provider's host.

Write what you want done and press *Send* (or Ctrl+Enter). The AI reads first, for example which datasets and columns there are,
and chooses its next step by what it learns. The steps show in the panel as they run.

- Everything that changes something, such as an action in Process, an export or an R or Python script, is shown first in a
  dialog of its own with the command and its arguments. It runs only if you press *Approve*, and it can be undone afterwards.
- When the way on depends on what you want, the AI asks you in the panel with a few answers to choose from. An answer to a
  question never approves anything.
- For a task that will be done again, the AI can propose a whole flow, which you save with *Save as a flow*. After a task you can
  also save the approved steps as a flow. Both then run without the AI under *Flows and watches*.
- The AI answers in the app's language. *Stop* cancels before the next step. The AI remembers the conversation between sessions: it is
  kept as the notebook *AI assistant* under Analyse, which you can read and delete, and never goes into a bundle for others. *New
  conversation* starts again and forgets it.

What the AI reads in the datasets counts as data, never as instructions. What is sent to a cloud service leaves the computer, so
choose a local model for sensitive tasks.

## Help in the app

The whole handbook is in the app: the **?** button at the top right, the **F1** key or the *Help* command in the
command palette opens it at the chapter of the mode you are in. The contents are on the left, above them a search
field that searches every section, and links between the documents are followed inside the handbook. Dialogs with a
**?** button open the right section directly. The handbook follows the app's language and needs no network; at the
bottom are the version, *Check for updates* and the link to the documentation on GitHub.

## Keyboard

Alt+1 to Alt+8 switch mode, Ctrl+K opens the command palette and F1 opens the handbook. The edge between a panel and the work area can
receive focus with Tab and be moved with the arrow keys (Shift for larger steps, Home and End for the smallest and
largest width). The first Tab press on the page shows the link
*Skip to content*, which moves focus past the mode switcher and the object panel. Everything is reachable with
Tab and Enter; dialogs close with Esc. In the table the arrow keys move between cells and Enter edits. The app
follows the system setting for reduced motion.

Tabs are switched with the left and right arrow keys, Home and End. Every button, field and code editor has a name
that screen readers announce, dialogs are announced with their title and the page has landmarks for the mode
switcher, the object panel, the work area and the inspector. Text and field borders have WCAG AA contrast in both the
light and the dark theme. Charts from the chart builder are described for screen readers by Vega; for R charts and
D3 templates the figures are in the table in Process.

## Language

The interface is available in Swedish, Danish, Norwegian (Bokmål and Nynorsk), Finnish, Icelandic and English. The first time
the app is opened you choose a language; the language button at the top right (or the *Language* command in the
palette) changes it later. The choice is stored in the browser, so each computer and browser profile has its own.
Numbers in the interface follow the language's conventions; the data itself is never changed. R's messages follow
the same choice, while template placeholders such as `{{datamangd}}` and the table keywords `kolumner`, `sortera`,
`topp`, `filter` and `rubrik` are part of the template syntax and stay the same in every language. The
documentation exists in all seven languages under `docs/` (Swedish in `docs/`, the others in `docs/<language>/`).

## When something goes wrong

Read the log at the bottom: errors you can fix are described in your language with suggestions. If R hangs, use
*Restart R*; the datasets are not affected. Take a backup before clearing browser data. Bugs are reported as issues
on GitHub, see [CONTRIBUTING.md](../../CONTRIBUTING.md).
