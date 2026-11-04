# Formats and import

## Supported file formats

| Format | Import | Export | Comment |
|---|---|---|---|
| CSV, TSV, TXT with delimiters | Yes | Yes | Delimiter, character encoding and header row are detected automatically and can be changed |
| Fixed-width text | Yes | No | Choose the format in the import step (files named .fwf or .prn are recognised). Column starts are found from spaces present on every line, or given as positions |
| Excel xlsx, xlsm, xls, xlsb | Yes | xlsx | Choose sheet; dates and yes/no become real types |
| ODS and FODS (LibreOffice) | Yes | ods | Same type handling as Excel |
| Older spreadsheet formats: Excel 2003 XML, SYLK (slk), DIF, dBase (dbf), Lotus 1-2-3 (wk1, wk3, wk4, wks), Quattro Pro (wq1, wq2, wb1, wb2, wb3, qpw) | Yes | No | Read by the same spreadsheet reader as Excel; choose sheet. Excel 2003 XML is recognised by its content even when the file is called .xml |
| Tables in documents: HTML (html, htm, xhtml), Markdown (md), Word (docx), LaTeX (tex) | Yes | No | All tables in the file are listed with their heading or caption and their number of rows and columns. Merged cells (colspan and rowspan, Word's merged cells, `\multicolumn`) are filled in on every row and column they cover. The header row comes from `th`, `thead`, Markdown's delimiter row, Word's header row or `booktabs` (`\midrule`) |
| KML and KMZ (Google Earth) | Yes | No | One row per place with name, description, folder path, time and extended data as columns; points, lines, polygons and multi-geometries become GeoJSON |
| GPX (GPS tracks) | Yes | No | Choose a layer: waypoints, routes, tracks (with number of points and length in km) or track points (one row per point with time and elevation) |
| TopoJSON | Yes | No | Each object in the topology is a layer; the arcs are decoded into ordinary GeoJSON geometries. Recognised by its content even when the file is called .json |
| JSON | Yes | Yes | List of objects, an object containing a list (a path can be given), list of lists |
| NDJSON, JSON Lines | Yes | No | One object per line |
| JSON-stat | Yes | No | Recognised automatically (`class: dataset`, versions 1.x and 2.0); one row per cell with codes, texts and value |
| SDMX-JSON | Yes | No | Data messages in SDMX-JSON 1.0 and 2.0 (for example from the ECB and the OECD) are recognised automatically; one row per observation with a code and text column per dimension, the time period, the value and the attributes |
| GeoJSON | Yes | Yes | One row per feature; the properties become columns, the geometry a text column with GeoJSON that the map chart draws (the map also reads WKT text in a column, for example from CSV). At export the geometry column (GeoJSON or WKT) becomes each feature's geometry and the other columns its properties |
| Shapefile (ZIP with shp, dbf, prj, cpg, or shp alone) | Yes | No | The attributes become typed columns according to the dbf schema, the geometry GeoJSON in the column `geometry`. Choose the layer if the ZIP file has several, and simplify the geometry with a tolerance in map units. The coordinates are kept (for example SWEREF 99 TM or longitude/latitude) |
| XML | Yes | Yes | One row per repeated element (chosen in the import step); attributes and child elements become columns, nested elements get dotted names such as `lage.lan` |
| SQLite | Yes | Yes | Dataspatium's own file is restored with types, labels and history; in other databases you choose a table and the types are taken from the schema |
| SQL script (sql) | Yes | No | A script with `CREATE TABLE` and `INSERT`, for example a database dump, is run in an empty SQLite database and the tables are offered for selection. MySQL-specific lines (`SET`, `LOCK TABLES`, `USE`, `/*!…*/` and table options such as `ENGINE=`) are removed first; other dialects work as far as they follow SQLite's syntax |
| GeoPackage (gpkg) | Yes | No | The layers (feature and attribute tables) are chosen as tables; the geometry column becomes GeoJSON that the map chart draws, the reference system is shown |
| Access (mdb, accdb) | Yes | No | Read directly in the browser with mdb-reader; the table is chosen in the Settings step and the types come from Access. Queries, linked tables and passwords need the [database bridge](kallor.md). |
| Documents: PDF, Word (docx), OpenDocument (odt), Markdown (md), text (txt) | Yes | No | Becomes a document collection with one paragraph per row (document, page, paragraph, type, text, characters); several files at once become one collection and the originals travel along. See [dokument.md](dokument.md) |
| Images: JPEG, PNG, WebP, GIF, BMP, AVIF | Yes | No | Becomes an image collection with one row per picture (dimensions, size, date, camera and position from EXIF); a preview and a thumbnail are stored, not the originals. See [dokument.md](dokument.md) |
| QGIS project (qgs, qgz) | Yes | No | Becomes a map view in Visualise with the project's layer order, visibility and symbols (colours, line widths, point sizes); the layers are matched to datasets with the same file name and bundled data files are imported. See [kartor.md](kartor.md) |
| SPSS sav, zsav, por | Yes | sav | Through the R package haven. Variable labels become column labels and value labels column metadata (see below) |
| Stata dta | Yes | dta | Through haven. Value labels as for SPSS. At export the column names are shortened to Stata's rules (32 characters, ASCII) |
| SAS sas7bdat, xpt | Yes | No | Through haven |
| PX (PC-Axis, used by the Nordic statistics offices) | Yes | No | Through the R package pxR; the character encoding is read from the file's CODEPAGE or CHARSET. The result is a long table with one value column |
| Parquet | Yes | Yes | Through the R package nanoparquet; keeps types exactly |
| RDS, RData | Yes | rds | R objects; an RData file must contain a data.frame |
| Pasted text | Yes | | Tab-, semicolon- or comma-separated |

Delimited text files of 64 MB or more are read in chunks: the preview shows the first rows as usual, and at import
the rows are written to the dataset while the file is read, so that the whole text never needs to be in memory. The
column types are taken from the column step or guessed from the first chunk. Progress is shown as the rows read.

All file formats can also be fetched from a web address under *From web address* in Import, if the server allows
requests from the browser (CORS). Dataspatium's own configuration files (API source, chart, dashboard, document
template, notebook) are recognised by the field `format` and added directly.

The formats that go through R start the R session when needed (a few seconds the first time) and have no preview:
the file is read by R and handed over with `dm_write()`, so the column types come from R. Yes/no becomes 0/1 in SPSS
and Stata, which lack a logical type.

Value labels (codes with names, such as `1 = Man` and `2 = Woman`) travel with the column as metadata in the SQLite
file (`_columns.value_labels`). When importing SPSS, Stata and SAS you choose in the settings step whether the column
shows the labels as text (the default) or keeps the codes; the labels are kept either way. They can be set, changed
and swapped for the codes in Process, are shown in the codebook, reach R as `haven::labelled` and are written to .sav
and .dta, where a column with the labels as text gets its codes back.

Data that is added in Import also ships with the app: the example data *Population per municipality 2024 (Sweden)*
and boundaries for maps as GeoJSON in longitude and latitude: municipalities and counties in Sweden (SCB, CC0),
municipalities and regions in Denmark (DAGI), municipalities and counties in Norway (Kartverket, CC BY 4.0) and
municipalities and regions in Finland (Statistics Finland, CC BY 4.0). Sources and licences are in
`presets/geo/KALLA.md`. Nothing is fetched from the internet.

**Digital plans** (kind plan): Swedish detailed plans per Lantmäteriet's national specification (GeoJSON,
`feature:typ`), reference objects from the national geodata platform, comprehensive plans per the specification's test
version (GeoJSON) and Boverket's ÖP model (GeoPackage with `innehall_op_*`). Recognised by their contents and opened
as a plan map; see [planer.md](planer.md).

## Character encoding

Text files are checked in this order: byte order mark (UTF-8, UTF-16), UTF-16 without BOM (many zero bytes), plain
ASCII, strict UTF-8 validation of the first megabyte, otherwise Windows-1252. Windows-1252 is common for files saved
from older Nordic Excel versions. You can always change the encoding in the import step.

## Delimiters and decimal separators

The delimiter is guessed among semicolon, comma, tab and pipe. Nordic CSV files usually use semicolons, since the
comma is the decimal separator. The decimal separator is decided per column: if comma decimals are at least as
common as point decimals, comma is chosen. Thousands separators (space, non-breaking space, point with comma
decimals) are removed.

## Column types

| Type | Recognised as | Stored as |
|---|---|---|
| Text | Everything that fits nothing else, and all numbers with a leading zero (municipality codes, postcodes, personal identity numbers) | TEXT |
| Integer | `12`, `-3`, `1 234` | INTEGER |
| Decimal number | `1 234,5`, `1.5`, `2,0`, `1.5e3` | REAL |
| Date | `2024-01-31`, `31/12/2024`, `31.12.2024`, `31-12-2024` | TEXT, ISO 8601 `YYYY-MM-DD` |
| Date and time | `2024-01-31 10:05`, `2024-01-31T10:05:00Z`, Excel dates with time | TEXT, `YYYY-MM-DD HH:MM:SS` |
| Yes/no | `ja`, `nej`, `true`, `false`, `sant`, `falskt`, `j`, `n`, `yes`, `no` | INTEGER 0/1 |

A column gets a type only if all filled-in values in the sample fit. Empty values always become "empty" (NULL). Values
that cannot be interpreted with a type you choose manually also become empty.

## The dataset's file

Each dataset is an SQLite file with the tables `data` (the rows), `_columns` (name, type, label, original name,
description, unit and value labels; the last three are added when an older file is opened), `_meta` (name, short name,
description, timestamps, source, import settings), `_log` (everything done with the dataset) and, once someone has
commented, `_comments` (time, name, text, column and whether the comment is resolved). The file can be opened in R
with RSQLite, in DB Browser for SQLite and in most other tools.

## The workspace's files

The backup (ZIP), the portable folder (Edge and Chrome) and the folder in a GitHub repository have the same
structure: `manifest.json` with a list of the contents, `datasets/<id>.sqlite` per dataset, `charts/<id>.viz.json` per
saved chart, `documents/<id>.doc.json` per document template of your own, `dashboards/<id>.dash.json` per dashboard,
`notebooks/<id>.nb.json` per notebook and `scripts/<id>.script.json` per saved R script, SQL script or regex pattern. A
bundle (*Bundle* in the Share mode) has the same structure but contains only what you chose. Its manifest has
`kind: bundle`, the sender's name (`author`), the message (`message`) and the changes in each dataset since it was last
shared or received (`changes`), and the bundle also has `CHANGELOG.md` with the same and the unresolved comments in
readable form. When a bundle is loaded, the message and the changes are shown, and everything that already exists is
skipped (datasets with the same id, charts, dashboards, templates and notebooks with the same name), except the
datasets you choose to replace with the bundle's version; your version is then kept under *Versions*. With automatic
saving on, changed datasets are written to the portable folder shortly after each save and files for deleted datasets
are removed. The folder can be loaded on another computer in the same way as a bundle.

The manifest has `format: 2` since version 2.0: every dataset in the list has, besides `id`, `name` and `shortName`,
also `folder` (the folder, such as `Economy/2026`, or empty) and `tags` (a list). Older bundles and backups (without
`format`) are read as before. Folder and tags are also in the dataset's own file (`_meta`), so they come along
wherever the file goes, as does `kind` (`table`, `graph`, `document`, `images`, `model`); in 2.0 all datasets are
tables.

The rows in `_log` have a timestamp, action type and details as JSON. The action types are among others `import`, `op`
(a recipe step with `op`, `params`, `result` and `description`; these rows make up the recipe), `undo`, `snapshot`,
`restore`, `comment` (a new comment), `shared` and `received` (when the dataset was shared or received in a bundle or
from GitHub; the change log of the next bundle starts after the latest of them). Manage shows the rows as readable
text. The recipe export in Process builds on the `op` rows, see [bearbeta.md](bearbeta.md).
