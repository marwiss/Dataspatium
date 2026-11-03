# Getting started with Dataspatium

This guide takes you from download to your first export. It assumes nothing more than a modern browser.

## 1. Download and unpack

Fetch the latest release from <https://github.com/marwiss/Dataspatium/releases/latest>: the ZIP file
`dataspatium-<version>.zip` under *Assets*. Unpack it into a folder of your choice, for example
`Documents\Dataspatium`. The folder contains `index.html`, the folders `src`, `vendor` and `docs` and more. Do not
move or rename files inside the folder; the whole folder, however, can be moved freely, even to a USB stick.

## 2. Open the app

Double-click `index.html`. The browser opens the app from your computer (the address starts with `file:///`).
If double-clicking does not work, right-click and choose *Open with* and your browser, or drag the file into an
open browser window.

The first time, the app asks which language you want: Swedish, Danish, Norwegian, Finnish, Icelandic or English.
The choice is stored in the browser and can be changed at any time with the language button (the icon with
letters) at the top right, or through the command palette. Fonts and icons are loaded from the folder; that takes
a second. Nothing is fetched from the internet.

## 3. The modes

At the top there are six modes. The panel on the left shows objects (datasets and sources), the middle is the
workspace, the panel on the right shows properties and statistics, and at the bottom there is a log. The panels can
be collapsed with the buttons at the top right. Alt+1 to Alt+6 switch mode from the keyboard.

| Mode | What you do there |
|---|---|
| Import | Import files, paste tables and fetch from open APIs in Sweden and the other Nordic countries, such as SCB, Kolada, Eurostat, the National Board of Health and Welfare, SMHI, Statistics Denmark, Statistics Norway, Statistics Finland and Statistics Iceland ([api-konfiguration.md](api-konfiguration.md)) |
| Manage | See your datasets, rename, delete, save versions, back up and restore the workspace |
| Process | Edit cells, sort and filter, clean and type, calculate columns, pivot, join datasets; all with undo, versions and recipes ([bearbeta.md](bearbeta.md)) |
| Analyse | R console with ggplot2 and the tidyverse, saved scripts and chart export; SQL console against the selected dataset |
| Visualise | Build charts with Vega-Lite, D3 templates or R scripts, save, export and create them in batch ([visualisera.md](visualisera.md)) |
| Export | Download data as CSV, Excel, JSON or SQLite, saved charts as SVG, PNG or PDF and documents from templates as HTML, Word, PDF, Markdown or LaTeX ([dokumentmallar.md](dokumentmallar.md)) |

## 4. Import a file

1. Go to *Import* and drop a file on the dashed surface (or click and choose a file). Supported file formats:
   CSV, TSV and other delimited text files, Excel (xlsx, xls, xlsm, xlsb), ODS, JSON, NDJSON, JSON-stat,
   GeoJSON, XML, SQLite, GeoPackage, shapefile (ZIP with shp and dbf), fixed-width text and statistical files
   from SPSS (sav), Stata (dta), SAS (sas7bdat, xpt), SCB's PX format, Parquet and R (rds, RData). Files can also
   be fetched straight from a web address under *From web address*. The statistical formats are read by R and
   imported in one step without a preview; the first time this takes a few seconds while R starts. See
   [format.md](format.md).
2. Check the settings. Dataspatium guesses the character encoding (UTF-8 or Windows-1252), the delimiter,
   whether the first row holds headers and whether the decimal separator is a comma or a point. The preview shows
   the first 100 rows.
3. Check the columns. Each column gets a type: text, integer, decimal number, date, date and time or yes/no. Codes
   with leading zeros (municipality codes, postcodes) are kept as text. Change names or types if needed and
   untick columns you do not want.
4. Give the dataset a name and click *Import*. You can then open it directly in *Process*.

Tip: you can also paste a table from Excel or a web page through *Paste* in the panel on the left.

## 5. Browse and review

*Process* shows the table. Click a column header to sort (ascending, descending, unsorted) and to see the column's
statistics on the right: count, missing, distinct, minimum, maximum, mean, sum and most common values. Type in the
filter field to show only rows containing the text. Large tables are rendered row by row as you scroll, so even
hundreds of thousands of rows can be browsed.

## 6. Export

In *Export* you choose format and file name and click *Export and download*.

- CSV with the profile *Adapted for Excel in Sweden* uses semicolons, decimal commas and UTF-8 with BOM so that
  Excel in the Nordic countries opens the file correctly straight away. The *Standard* profile gives commas and
  decimal points.
- Excel (xlsx) and ODS keep numbers, dates and yes/no as real types.
- JSON gives a list of objects, XML a file with one element per row.
- SQLite gives the dataset's own file, which can also be read in R, DB Browser for SQLite and many other tools.
- Parquet, SPSS (sav), Stata (dta) and RDS are written by R and start the R session when needed.

All formats can be imported again into Dataspatium.

## 7. Back up

The datasets live in the browser's database on this computer. They disappear if you clear site data, switch
browser profile or uninstall the browser. Go to *Manage*, choose *Workspace* and click *Back up the workspace*.
You get a ZIP file with all datasets. Restore by dropping the ZIP file on the surface *Restore from ZIP*.

In Edge and Chrome you can also choose a *portable folder*: the workspace is saved as ordinary files (one SQLite
file per dataset plus charts and templates) in a folder you choose, for example on a USB stick or in a
synchronised folder. Switch on *Save automatically on changes* and the folder is kept up to date. On another
computer you choose the same folder and click *Load from the folder*. After a browser restart it asks once for
permission to use the folder again; click *Reconnect*.

If you want to send a selection to a colleague, use *Share bundle* on the same page: choose datasets and whether
charts, dashboards, templates and notebooks should come along. The colleague drops the bundle on *Restore from
ZIP*; whatever already exists in their workspace is skipped.

## Common questions

**The page is empty or only shows "Dataspatium is starting".** Check that the whole folder was unpacked (not
just `index.html`) and that you are using a current version of Edge, Chrome or Firefox. Open the browser console
(F12) and look for red errors; please report them as an issue.

**My å, ä and ö became strange characters.** Change the character encoding in the import step *Settings*, usually
between UTF-8 and Windows-1252.

**Numbers became text.** The column contained some value that could not be read as a number, or numbers with
leading zeros. Change the type in the *Columns* step to force an interpretation; values that cannot be
interpreted become empty.

**Can I share data with a colleague?** Yes, export the dataset (SQLite or CSV) or take a backup of the workspace
and send the ZIP file. The colleague imports or restores in their Dataspatium.

**Why no server or cloud service?** So that your data stays with you and so that the app works without
installation, accounts or internet.

More questions and answers are in [faq.md](faq.md). When you want to move on from the first steps,
[anvandarguide.md](anvandarguide.md) describes the whole workflow from file to report.
