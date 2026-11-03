# User guide

This guide describes how you work in Dataspatium from the first file to the finished report. It assumes that you
have opened the app as described in [kom-igang.md](kom-igang.md). Details about each mode are in
[lagen.md](lagen.md), about file formats in [format.md](format.md), about APIs in
[api-konfiguration.md](api-konfiguration.md), about processing in [bearbeta.md](bearbeta.md), about R in
[r-guide.md](r-guide.md), about charts in [visualisera.md](visualisera.md) and about documents in
[dokumentmallar.md](dokumentmallar.md). Common questions are answered in [faq.md](faq.md).

## The workspace

The screen looks the same in every mode. At the top you switch mode (Import, Manage, Process, Analyse, Visualise,
Export; Alt+1 to Alt+6 work too) and see the workspace status (saved or unsaved), the command palette (the
magnifying glass or Ctrl+K), the language button, the theme (light or dark) and the help button with the version
number and *Check for updates*. The command palette is the fastest way to most things: type a few letters to switch
mode, open a dataset, a chart or a dashboard, or run a processing action on the selected dataset. On the left are
the objects of the mode (datasets, sources, charts, templates), in the middle the workspace and on the right the
inspector with properties and statistics. At the bottom is the log, where every action, warning and error is
written; that is what you read when something does not turn out as you intended.

Everything you create is saved automatically in the browser's database on your computer. Nothing is sent anywhere
unless you yourself fetch from an API, check the version or export.

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
buttons below the surface add data that ships with the app: the example data *Population per municipality 2024 (Sweden)*
and SCB's municipality and county boundaries for maps.

Under *Open APIs* there are presets for SCB, the Public Health Agency of Sweden, the National Board of Health and
Welfare, Kolada, Eurostat, SMHI, air quality data, the Nature Conservation Register, Lantmäteriet's geodata
catalogue and Sweden's data portal, as well as Boverket and Lantmäteriet Direkt for those who have their own keys.
In addition there are the statistics offices and several other agencies in Denmark, Norway, Finland and Iceland,
the self-governing areas and Nordic Statistics; the country buttons above the list choose which countries'
sources are shown. Browse or search for a table, choose variables, preview and fetch into a new dataset or add to an existing one. A
fetched dataset remembers its query, so it can be fetched again from Manage when the source has been updated.

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

## Keeping order (Manage)

Every dataset has an overview (source, size, description), a column list with types, labels, descriptions and
units (set under Process with *Label, description and unit*), a history of everything done and versions. Rename
and change the short name, delete or re-fetch from API. Under *Workspace* you see how much storage is used, request
persistent storage, take a backup as ZIP and restore. The app reminds you at start when more than the chosen
number of days have passed since the last backup (30 days by default; changed or switched off in the same card).
In Edge and Chrome the workspace can also be mirrored to a portable folder on disk, automatically on every change.

## Sharing with others

- A selection: *Share bundle* under Manage gives a ZIP with chosen datasets, charts, dashboards, templates and
  notebooks. The recipient loads it under *Restore from ZIP*; whatever already exists is skipped.
- The whole workspace: the backup (ZIP) is restored under Manage on another computer.
- One dataset: export as SQLite (everything comes along) or Parquet.
- API configurations (`.api.json`), charts and document templates (JSON) and recipes (JSON, R or SQL) are exported
  and loaded as files. Keys never come along.

## Keyboard

Alt+1 to Alt+6 switch mode and Ctrl+K opens the command palette. The first Tab press on the page shows the link
*Skip to content*, which moves focus past the mode switcher and the object panel. Everything is reachable with
Tab and Enter; dialogs close with Esc. In the table the arrow keys move between cells and Enter edits. The app
follows the system setting for reduced motion.

## Language

The interface is available in Swedish, Danish, Norwegian (Bokmål), Finnish, Icelandic and English. The first time
the app is opened you choose a language; the language button at the top right (or the *Language* command in the
palette) changes it later. The choice is stored in the browser, so each computer and browser profile has its own.
Numbers in the interface follow the language's conventions; the data itself is never changed. R's messages follow
the same choice, while template placeholders such as `{{datamangd}}` and the table keywords `kolumner`, `sortera`,
`topp`, `filter` and `rubrik` are part of the template syntax and stay the same in every language. The
documentation exists in all six languages under `docs/` (Swedish in `docs/`, the others in `docs/<language>/`).

## When something goes wrong

Read the log at the bottom: errors you can fix are described in your language with suggestions. If R hangs, use
*Restart R*; the datasets are not affected. Take a backup before clearing browser data. Bugs are reported as issues
on GitHub, see [CONTRIBUTING.md](../../CONTRIBUTING.md).
