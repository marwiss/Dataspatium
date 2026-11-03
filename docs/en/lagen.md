# The six modes

Dataspatium is divided into six modes that follow the flow of the work, in the same spirit as statistics
production's collect, process, analyse and disseminate: Import, Manage, Process, Analyse, Visualise, Export. All
modes share the same skeleton: the mode switcher at the top, the object panel on the left, the workspace in the
middle, the properties panel on the right and the log at the bottom. The panels never change places. Alt+1 to
Alt+6 switch mode. An empty workspace opens in Import, a workspace with datasets in Manage. The buttons at the
top right toggle the panels, switch theme (light, dark, follow the system), change language and open the help.

The command palette (Ctrl+K or the magnifying glass at the top) reaches everything from one search field: switch
mode, open a dataset, a chart or a dashboard, run a processing action on the selected dataset, export, open the
workspace, switch theme or check for updates. Arrow up and down select, Enter runs and Esc closes; the most
recently run commands are at the top.

## Import

This is where data comes in: files dropped on the surface, pasted text, web addresses and open APIs. File import
goes in steps: file, settings with preview, columns with types, done. Formats: CSV and other delimited text,
fixed-width text, Excel, ODS, JSON (including JSON-stat and GeoJSON), XML, SQLite, GeoPackage, shapefile and, via
R: SPSS, Stata, SAS, PX, Parquet, RDS and RData (see [format.md](format.md)); the R formats are imported in one
step without a preview. Under Open APIs there are presets for SCB (browse the subject tree or search for a table),
the Public Health Agency of Sweden, the National Board of Health and Welfare, Kolada, Eurostat, SMHI, air quality
data, the Nature Conservation Register, Lantmäteriet's geodata catalogue and Sweden's data portal, as well as
Boverket and Lantmäteriet Direkt for those who have keys, and in addition sources in Denmark, Norway, Finland,
Iceland, Greenland, the Faroe Islands and Åland and Nordic Statistics; the country buttons above the list choose
which countries' sources are shown. Your own configurations are added from file and can be shared. See
[api-konfiguration.md](api-konfiguration.md).

## Manage

The datasets' home. Overview with metadata, column list, history of what has been done with the dataset,
versions, rename and short name (the short name is used in SQL, R and chart files), delete, re-fetch from API (one
dataset or all at once). The workspace also lives here: how much storage is used, persistent storage, backup to
ZIP and restore and, in Edge and Chrome, a portable folder: the workspace is saved as ordinary files in a folder you
choose, automatically after every change if you want, and can be loaded on another computer. *Share bundle*
creates a ZIP with chosen datasets, charts, dashboards, templates and notebooks for a colleague, who loads it under
*Restore from ZIP*.

## Process

Everything you do with the table through buttons and dialogs: edit cells directly in the table, sort, filter and
see column statistics; actions for cleaning (find and replace with regular expressions, trim, case, character
encoding repair, replace value, fill missing, duplicates, category cleaning), types (numbers, dates, yes/no),
structure (calculated columns, split and combine, delete rows, pivot) and new datasets (group and aggregate,
join, append). The data quality profile points at what should be corrected, and quality rules (must not be
missing, unique, range, list, pattern, length, SQL condition) check the data on demand with a report and failing
rows as a dataset of their own. Everything is logged as a recipe that can be undone, replayed on another dataset
and exported as R or SQL code. Versions save snapshots to go back to. See [bearbeta.md](bearbeta.md).

## Analyse

Code and statistics. R console with ggplot2, dplyr, tidyr and other packages, saved scripts, charts with export to
SVG, PNG and PDF, and `dm_read()`/`dm_write()` for moving data between the app and R (see
[r-guide.md](r-guide.md)). SQL console against the selected dataset (`data`), where other datasets are reached by
their short names so that one query can join several datasets; queries show results that can be saved as a new
dataset, modifying statements are logged as recipe steps (see [bearbeta.md](bearbeta.md)). The notebook mixes
text (Markdown), R and SQL in cells that run in order and become a report in HTML, Word, PDF, Markdown or LaTeX
(see [anteckningsbok.md](anteckningsbok.md)). The Regex tab tries regular expressions on a column with the matches marked and uses them to filter, extract,
replace, split, flag, count or create a quality rule, with a pattern profile and a library of Nordic patterns
(see [regex.md](regex.md)). Later: statistical models.

## Visualise

Charts with three engines and one look: the chart builder (Vega-Lite) with bars, lines, areas, points,
histograms, heat maps, box plots, pies and maps (choropleth maps from GeoJSON or shapefile data); D3 templates for
ranking, slope charts and population pyramids; and R scripts with ggplot2. Saved charts can be exported as SVG,
PNG, PDF and PowerPoint, shared as viz files, shown in a gallery and created in batch per group. Dashboards gather
saved charts in a grid with shared filters and are exported as HTML or PowerPoint. See
[visualisera.md](visualisera.md).

## Export

Three tabs. **Data**: CSV (adapted for Excel or standard), Excel, ODS, JSON, XML, SQLite and, via R: Parquet,
SPSS, Stata and RDS. **Charts**: saved charts and dashboards (also all charts as one PowerPoint) as SVG, PNG and
PDF, one at a time or in batch per group to a ZIP. **Documents**: reports, codebooks and summaries from templates
in Markdown with placeholders, as HTML, Word, PDF, Markdown or LaTeX, one at a time or in batch per group (see
[dokumentmallar.md](dokumentmallar.md)). Later: Dataspatium bundles for sharing whole workspaces.
